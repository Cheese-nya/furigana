'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ScriptLine } from '../utils/furigana';
import type { Translations } from '../utils/i18n';
import type { BookItem } from '../utils/libraryDatabase';
import { TypographyPopover } from './TypographyPopover';
import { GlassButton } from './glass/GlassButton';
import { useGlass } from './glass/hooks';
import { IconChevronLeft, IconRead, IconRuby, IconTextFormat } from './glass/icons';

type RubyMode = 'hiragana' | 'katakana' | 'romaji';
export type ReaderFontFamily = 'serif' | 'sans';
export type ReaderWritingMode = 'horizontal' | 'vertical';

export interface ReaderPanelProps {
  t: Translations;
  book: BookItem | null;
  annotatedLines: ScriptLine[];
  isProcessing: boolean;
  rubyType: RubyMode;
  onRubyTypeChange: (mode: RubyMode) => void;
  onUpdateProgress: (chapterIndex: number, lineIndex: number, totalLines?: number) => void;
  onGoToLibrary: () => void;
}

interface ReaderPrefs {
  fontFamily: ReaderFontFamily;
  fontSize: number;
  showRuby: boolean;
  writingMode: ReaderWritingMode;
}

const PREFS_KEY = 'furigana_reader_prefs_v3';
const DEFAULT_PREFS: ReaderPrefs = { fontFamily: 'serif', fontSize: 19, showRuby: true, writingMode: 'horizontal' };
const FONT_STACK: Record<ReaderFontFamily, string> = {
  serif: 'var(--font-mincho)',
  sans: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif',
};
const SPEAKER = /^([^：:]{1,16})[：:](.*)$/;

function loadPrefs(): ReaderPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') as Partial<ReaderPrefs>;
    return {
      fontFamily: parsed.fontFamily === 'sans' ? 'sans' : 'serif',
      fontSize: typeof parsed.fontSize === 'number' ? Math.min(26, Math.max(14, parsed.fontSize)) : DEFAULT_PREFS.fontSize,
      showRuby: typeof parsed.showRuby === 'boolean' ? parsed.showRuby : true,
      writingMode: parsed.writingMode === 'vertical' ? 'vertical' : 'horizontal',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/**
 * Immersive reader (mockup): the text fills the screen, one glass capsule at
 * the bottom (back, title + progress, ruby toggle, Aa). Scrolling down hides
 * the capsule — judged by distance travelled in one direction, because touch
 * and trackpads deliver many tiny deltas — and a 2px progress line takes its
 * place; scrolling up, reaching the top/bottom or tapping the page brings it back.
 */
export function ReaderPanel({ t, book, annotatedLines, isProcessing, rubyType, onRubyTypeChange, onUpdateProgress, onGoToLibrary }: ReaderPanelProps) {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  const [hudVisible, setHudVisible] = useState(true);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [aaAnchor, setAaAnchor] = useState<HTMLButtonElement | null>(null);
  const [aaOpen, setAaOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const lastYRef = useRef(0);
  const travelRef = useRef(0);
  const lastLineRef = useRef(-1);
  // Line to bring back to the top once it has been rendered: the saved place when a book opens, or the
  // current place when a re-annotation empties the page and the lines stream back in.
  const resumeLineRef = useRef<number | null>(null);
  const bookRef = useRef(book);
  // The line we put back, until the reader moves it themselves; re-placed once the layout settles.
  const placedLineRef = useRef<number | null>(null);
  const userMovedRef = useRef(false);
  const settleTimersRef = useRef<number[]>([]);
  const placeLineRef = useRef<(line: number) => boolean>(() => false);
  const frameRef = useRef<number | null>(null);
  const capsuleRef = useGlass<HTMLDivElement>();
  const isVertical = prefs.writingMode === 'vertical';

  const updatePrefs = (patch: Partial<ReaderPrefs>) => {
    setPrefs(previous => {
      const next = { ...previous, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage write failures
      }
      return next;
    });
  };

  const [prevBookId, setPrevBookId] = useState(book?.bookId ?? null);
  if ((book?.bookId ?? null) !== prevBookId) {
    setPrevBookId(book?.bookId ?? null);
    setHudVisible(true);
    setScrollPercent(0);
    setAaOpen(false);
  }

  const processScroll = useCallback(() => {
    const article = articleRef.current;
    const scroller = scrollerRef.current;
    let y: number;
    let max: number;
    if (isVertical && article) {
      // vertical-rl scrolls horizontally (scrollLeft runs negative toward the end)
      y = Math.abs(article.scrollLeft);
      max = Math.max(0, article.scrollWidth - article.clientWidth);
    } else if (scroller) {
      y = scroller.scrollTop;
      max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    } else {
      return;
    }
    if (max > 0) setScrollPercent(Math.round(Math.min(100, Math.max(0, (y / max) * 100))));

    const dy = y - lastYRef.current;
    lastYRef.current = y;
    if (dy !== 0) {
      const travel = Math.sign(dy) === Math.sign(travelRef.current) ? travelRef.current + dy : dy;
      travelRef.current = travel;
      if (y >= max - 4 || y < 40) setHudVisible(true);
      else if (travel > 24) setHudVisible(false);
      else if (travel < -12) setHudVisible(true);
    }

    if (!article) return;
    const nodes = article.querySelectorAll<HTMLElement>('[data-line]');
    // An emptied page (re-annotating) clamps the scroll to 0; that is not the reader's place, so keep the saved one.
    if (nodes.length === 0) return;
    let index = 0;
    nodes.forEach(node => {
      const rect = node.getBoundingClientRect();
      if (isVertical ? rect.right >= window.innerWidth - 72 : rect.top <= 72) index = Number(node.dataset.line) || 0;
    });
    // Right after a restore, layout drift must not rewrite the saved place; only the reader's own scrolling may.
    if (placedLineRef.current !== null && !userMovedRef.current) return;
    if (index !== lastLineRef.current) {
      lastLineRef.current = index;
      onUpdateProgress(0, index, nodes.length);
    }
  }, [isVertical, onUpdateProgress]);

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      processScroll();
    });
  }, [processScroll]);

  useEffect(() => {
    lastYRef.current = 0;
    travelRef.current = 0;
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [handleScroll]);

  useEffect(() => { bookRef.current = book; });

  // A book opened (or changed): the place to return to is the one saved with it.
  const bookId = book?.bookId ?? null;
  useEffect(() => {
    const saved = bookRef.current?.readingProgress.lineIndex ?? 0;
    resumeLineRef.current = saved > 0 ? saved : null;
    lastLineRef.current = -1;
    placedLineRef.current = null;
    userMovedRef.current = false;
  }, [bookId]);

  // Any hand on the page means the reader has taken over: stop re-placing.
  useEffect(() => {
    const markMoved = () => { userMovedRef.current = true; };
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    events.forEach(name => window.addEventListener(name, markMoved, { passive: true, capture: true }));
    return () => events.forEach(name => window.removeEventListener(name, markMoved, true));
  }, []);

  // The lines were emptied by a re-annotation: remember where the reader was so they land back there.
  const lineTotal = annotatedLines.length;
  useEffect(() => {
    if (lineTotal === 0 && lastLineRef.current > 0) resumeLineRef.current = lastLineRef.current;
  }, [lineTotal]);

  // Switching between horizontal and vertical lays the page out again: keep the place across it.
  useEffect(() => {
    if (lastLineRef.current > 0) resumeLineRef.current = lastLineRef.current;
  }, [isVertical]);

  const placeLine = useCallback((line: number): boolean => {
    const article = articleRef.current;
    const node = article?.querySelector<HTMLElement>(`[data-line="${line}"]`);
    if (!article || !node) return false;
    const rect = node.getBoundingClientRect();
    if (isVertical) {
      // vertical-rl: lines run right to left, and the saved line is the one crossing the right-hand edge;
      // land it well inside the 72px band the progress check uses, so layout drift cannot pick the neighbour
      article.scrollLeft += rect.right - (window.innerWidth - 56);
    } else {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollTop += rect.top - 70;
    }
    return true;
  }, [isVertical]);

  // Bring the remembered line back as soon as it exists in the page.
  useEffect(() => {
    const target = resumeLineRef.current;
    if (target === null || lineTotal <= target) return;
    if (!placeLine(target)) return;
    resumeLineRef.current = null;
    placedLineRef.current = target;
    lastLineRef.current = target;
    // Web fonts and ruby settle a moment later and can nudge the layout; put the line back until they have.
    settleTimersRef.current.forEach(clearTimeout);
    const again = () => { if (placedLineRef.current === target && !userMovedRef.current) placeLineRef.current(target); };
    settleTimersRef.current = [250, 700, 1500].map(ms => window.setTimeout(again, ms));
    void document.fonts?.ready.then(again);
  }, [lineTotal, bookId, placeLine]);

  useEffect(() => { placeLineRef.current = placeLine; }, [placeLine]);
  useEffect(() => () => settleTimersRef.current.forEach(clearTimeout), []);

  // Annotating adds and removes a status line above the text, which nudges the layout; once it is done,
  // put the line back exactly (unless the reader has already started scrolling).
  useEffect(() => {
    const line = placedLineRef.current;
    if (isProcessing || line === null || userMovedRef.current) return;
    placeLine(line);
  }, [isProcessing, placeLine]);

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (String(window.getSelection() || '')) return;
    if ((event.target as HTMLElement).closest('button, a, input')) return;
    setHudVisible(prev => !prev);
  };

  if (!book) {
    return (
      <section className="grid min-h-0 flex-1 place-items-center px-6 text-center">
        <div className="max-w-sm rounded-[18px] bg-[var(--surface)] p-8 shadow-[var(--card-shadow)]">
          <IconRead size={46} className="mx-auto text-[var(--label-3)]" />
          <h3 className="mb-1.5 mt-3.5 text-xl font-semibold">{t.readerEmptyTitle}</h3>
          <p className="mb-[18px] text-sm leading-relaxed text-[var(--label-2)]">{t.readerEmptyDesc}</p>
          <button type="button" className="btn btn-ink" onClick={onGoToLibrary}>{t.readerBackToLibrary}</button>
        </div>
      </section>
    );
  }

  const lineCount = annotatedLines.length;

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="scroll-edge fixed inset-x-0 top-0 z-10 h-[76px]" aria-hidden />

      <div ref={scrollerRef} onScroll={isVertical ? undefined : handleScroll} onClick={handleCanvasClick} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article
          ref={articleRef}
          lang="ja"
          data-testid="reader-script-canvas"
          data-writing-mode={prefs.writingMode}
          onScroll={isVertical ? handleScroll : undefined}
          className={
            isVertical
              ? 'vertical-script-flow h-full w-full overflow-x-auto px-6 pb-[110px] pt-[70px] md:px-12'
              : 'mx-auto w-full max-w-[34em] px-6 pb-[140px] pt-[70px]'
          }
          style={{
            fontFamily: FONT_STACK[prefs.fontFamily],
            fontSize: `${prefs.fontSize}px`,
            lineHeight: 2.35,
            letterSpacing: '0.02em',
          }}
        >
          <header className={isVertical ? 'ml-9' : 'mb-9'}>
            <h2 className="text-[26px] font-semibold leading-snug">{book.title}</h2>
            <p className="mt-1 font-sans text-[13px] tracking-normal text-[var(--label-2)]">
              {book.author?.trim() ? `${book.author.trim()} · ` : ''}{fill(t.libraryBookLines, { count: lineCount })}
            </p>
          </header>

          {isProcessing && <p className="mb-4 font-sans text-xs text-[var(--label-2)]">{t.annotatingProgress}</p>}

          {annotatedLines.map((line, lineIndex) => {
            const speakerMatch = (line.rawText || line.cleanText || '').match(SPEAKER);
            const speaker = line.speaker || speakerMatch?.[1];
            // Strip "名前：" from the token stream; the speaker is shown as a label instead.
            let skip = 0;
            if (speaker) {
              const joined = line.tokens.map(token => token.surface).join('');
              const afterName = joined.startsWith(speaker) ? joined.slice(speaker.length) : joined;
              const delimiter = afterName.match(/^[：:]\s*/);
              skip = (joined.startsWith(speaker) ? speaker.length : 0) + (delimiter ? delimiter[0].length : 0);
            }
            return (
              <p key={`${line.id}-${lineIndex}`} data-line={lineIndex} className={isVertical ? 'ml-4' : 'mb-[0.6em]'}>
                {speaker && <span className="mr-[0.4em] font-sans text-[0.72em] font-semibold tracking-normal text-[var(--label-2)]">{speaker}</span>}
                {line.tokens.length === 0 && <br />}
                {line.tokens.map((token, tokenIndex) => {
                  let surface = token.surface;
                  if (skip > 0) {
                    if (surface.length <= skip) { skip -= surface.length; return null; }
                    surface = surface.slice(skip);
                    skip = 0;
                  }
                  if (!token.ruby) return <span key={tokenIndex}>{surface}</span>;
                  return (
                    <ruby key={tokenIndex}>
                      {surface}
                      <rt className="text-[0.5em]" style={{ color: 'var(--ruby)', visibility: prefs.showRuby ? 'visible' : 'hidden' }}>{token.ruby}</rt>
                    </ruby>
                  );
                })}
              </p>
            );
          })}
        </article>
      </div>

      {/* Bottom glass capsule */}
      <div
        ref={capsuleRef}
        className={`glass fixed bottom-[max(22px,env(safe-area-inset-bottom))] left-1/2 z-40 flex h-[52px] w-[min(470px,calc(100%-32px))] -translate-x-1/2 items-center gap-0.5 rounded-full px-2 ${
          hudVisible || aaOpen
            ? 'transition-[translate,opacity] duration-[620ms,220ms] [transition-timing-function:var(--spring-bouncy),ease]'
            : 'pointer-events-none translate-y-[calc(100%+40px)] opacity-0 transition-[translate,opacity] duration-[340ms,260ms] [transition-timing-function:cubic-bezier(.4,0,.7,.2),ease]'
        }`}
      >
        <GlassButton icon aria-label={t.readerBackToLibrary} onClick={onGoToLibrary}>
          <IconChevronLeft />
        </GlassButton>
        <div className="min-w-0 flex-1 text-center">
          <b className="block truncate text-[13px]">{book.title}</b>
          <span className="text-[11px] tabular-nums text-[var(--label-2)]">{fill(t.libraryBookProgress, { percent: scrollPercent })}</span>
        </div>
        <GlassButton icon aria-label={t.showRubyLabel} aria-pressed={prefs.showRuby} onClick={() => updatePrefs({ showRuby: !prefs.showRuby })}>
          <IconRuby />
        </GlassButton>
        <GlassButton ref={setAaAnchor} icon aria-label={t.typographyShort} aria-expanded={aaOpen} onClick={() => setAaOpen(open => !open)}>
          <IconTextFormat />
        </GlassButton>
      </div>

      {/* 2px progress line while the capsule is away */}
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-1 left-[22px] right-[22px] z-30 h-[2px] overflow-hidden rounded-[1px] bg-[var(--fill-2)] transition-opacity duration-300 ${
          hudVisible || aaOpen ? 'opacity-0' : 'opacity-100 delay-[120ms]'
        }`}
      >
        <i className="block h-full rounded-[1px] bg-[var(--label)] opacity-[0.38]" style={{ width: `${scrollPercent}%` }} />
      </div>

      <TypographyPopover
        open={aaOpen}
        onClose={() => setAaOpen(false)}
        anchor={aaAnchor}
        placement="above"
        rubyType={rubyType}
        onRubyTypeChange={onRubyTypeChange}
        writingMode={prefs.writingMode}
        onWritingModeChange={writingMode => updatePrefs({ writingMode })}
        fontFamily={prefs.fontFamily}
        onFontFamilyChange={fontFamily => updatePrefs({ fontFamily })}
        fontSize={prefs.fontSize}
        onFontSizeChange={fontSize => updatePrefs({ fontSize })}
        showRuby={prefs.showRuby}
        onShowRubyChange={showRuby => updatePrefs({ showRuby })}
        t={t}
      />
    </section>
  );
}
