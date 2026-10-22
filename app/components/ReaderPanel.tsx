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
  onUpdateProgress: (chapterIndex: number, lineIndex: number) => void;
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
  const articleRef = useRef<HTMLElement | null>(null);
  const lastYRef = useRef(0);
  const travelRef = useRef(0);
  const lastLineRef = useRef(-1);
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
    let y: number;
    let max: number;
    if (isVertical && article) {
      // vertical-rl scrolls horizontally (scrollLeft runs negative toward the end)
      y = Math.abs(article.scrollLeft);
      max = Math.max(0, article.scrollWidth - article.clientWidth);
    } else {
      const doc = document.documentElement;
      y = window.scrollY || doc.scrollTop;
      max = Math.max(0, doc.scrollHeight - window.innerHeight);
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
    let index = 0;
    nodes.forEach(node => {
      const rect = node.getBoundingClientRect();
      if (isVertical ? rect.right >= window.innerWidth - 72 : rect.top <= 72) index = Number(node.dataset.line) || 0;
    });
    if (index !== lastLineRef.current) {
      lastLineRef.current = index;
      onUpdateProgress(0, index);
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
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [handleScroll]);

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (String(window.getSelection() || '')) return;
    if ((event.target as HTMLElement).closest('button, a, input')) return;
    setHudVisible(prev => !prev);
  };

  if (!book) {
    return (
      <section className="grid min-h-[70vh] flex-1 place-items-center px-6 text-center">
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
    <section className="relative flex min-w-0 flex-1 flex-col">
      <div className="scroll-edge fixed inset-x-0 top-0 z-10 h-[76px]" aria-hidden />

      <article
        ref={articleRef}
        lang="ja"
        data-testid="reader-script-canvas"
        data-writing-mode={prefs.writingMode}
        onClick={handleCanvasClick}
        onScroll={isVertical ? handleScroll : undefined}
        className={
          isVertical
            ? 'vertical-script-flow w-full overflow-x-auto px-6 pb-[110px] pt-[70px] md:px-12'
            : 'mx-auto w-full max-w-[34em] px-6 pb-[140px] pt-[70px]'
        }
        style={{
          fontFamily: FONT_STACK[prefs.fontFamily],
          fontSize: `${prefs.fontSize}px`,
          lineHeight: 2.35,
          letterSpacing: '0.02em',
          ...(isVertical ? { height: 'calc(100dvh - 20px)' } : {}),
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
