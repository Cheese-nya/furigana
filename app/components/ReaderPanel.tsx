'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { ScriptLine } from '../utils/furigana';
import type { Translations } from '../utils/i18n';
import type { BookItem } from '../utils/libraryDatabase';
import { GlassButton } from './glass/GlassButton';
import { GlassPopover, PopoverItem, PopoverSeparator } from './glass/GlassPopover';
import { LiquidSelector } from './glass/LiquidSelector';
import { useGlass } from './glass/hooks';
import {
  IconChevronLeft,
  IconClose,
  IconEdit,
  IconRead,
  IconRuby,
  IconSearch,
  IconTextFormat,
} from './glass/icons';

export type ReaderTheme = 'light' | 'sepia' | 'mint' | 'dark';
export type RubyVisibilityMode = 'all' | 'touch_reveal' | 'review_only' | 'none';
export type ReaderFontFamily = 'sans' | 'serif';
export type ReaderWritingMode = 'horizontal' | 'vertical';
export type ReaderTextAlign = 'left' | 'center';

export interface ReaderPanelProps {
  t: Translations;
  book: BookItem | null;
  annotatedLines: ScriptLine[];
  isProcessing: boolean;
  darkMode?: boolean;
  rubyType: 'hiragana' | 'katakana' | 'romaji';
  onRubyTypeChange: (mode: 'hiragana' | 'katakana' | 'romaji') => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  rubyFontSize: number;
  onRubyFontSizeChange: (size: number) => void;
  lineSpacing: number;
  onLineSpacingChange: (spacing: number) => void;
  onTokenClick: (lineIndex: number, tokenIndex: number) => void;
  onUpdateProgress: (chapterIndex: number, lineIndex: number) => void;
  // Bookmark hooks are retained as optional props so app/page.tsx keeps compiling,
  // but the minimalist script reader no longer renders bookmark UI.
  onAddBookmark?: (lineIndex: number, label?: string) => void;
  onRemoveBookmark?: (bookmarkId: string) => void;
  onGoToLibrary: () => void;
  onGoToEditor: (book?: BookItem) => void;
}

type Drawer = 'search' | 'appearance' | null;

const PREFS_KEY = 'furigana_reader_prefs_v2';
const THEMES: ReaderTheme[] = ['light', 'sepia', 'mint', 'dark'];
const VISIBILITY: RubyVisibilityMode[] = ['all', 'touch_reveal', 'review_only', 'none'];
const RUBY_TYPES = ['hiragana', 'katakana', 'romaji'] as const;
const RUBY_COLOR_SWATCHES = ['#0071e3', '#e11d48', '#d97706', '#059669', '#7c3aed', '#ec4899'] as const;
const SPEAKER = /^([^：:]{1,16})[：:](.*)$/;
const TIMECODE = /\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/;

const THEME_CLASS: Record<ReaderTheme, string> = {
  light: 'bg-[#fbfaf7] text-[#141416]',
  sepia: 'bg-[#f5ecd9] text-[#3d3124]',
  mint: 'bg-[#e8f3ec] text-[#1e3326]',
  dark: 'bg-[#11131a] text-[#f2f2f7]',
};

const CANVAS_PAPER_CLASS: Record<ReaderTheme, string> = {
  light: 'text-[#141416]',
  sepia: 'text-[#3d3124]',
  mint: 'text-[#1e3326]',
  dark: 'text-[#f2f2f7]',
};

const SWATCH: Record<ReaderTheme, string> = {
  light: 'bg-[#ffffff] border-zinc-300',
  sepia: 'bg-[#f4e7cf] border-[#c9b48f]',
  mint: 'bg-[#d7eadc] border-[#8fbf9d]',
  dark: 'bg-[#181c2a] border-slate-600',
};

const RUBY_MUTED: Record<ReaderTheme, string> = {
  light: 'rgba(20, 20, 22, 0.62)',
  sepia: 'rgba(61, 49, 36, 0.64)',
  mint: 'rgba(30, 51, 38, 0.64)',
  dark: 'rgba(242, 242, 247, 0.62)',
};

const RUBY_ACCENT: Record<ReaderTheme, string> = {
  light: 'rgba(20, 20, 22, 0.78)',
  sepia: 'rgba(61, 49, 36, 0.80)',
  mint: 'rgba(30, 51, 38, 0.80)',
  dark: 'rgba(242, 242, 247, 0.78)',
};

// Exact canvas colours used to paint the window chrome so fullscreen reading never shows black bars.
const CANVAS_BG: Record<ReaderTheme, string> = {
  light: '#fbfaf7',
  sepia: '#f5ecd9',
  mint: '#e8f3ec',
  dark: '#11131a',
};

const FONT_STACK: Record<ReaderFontFamily, string> = {
  sans: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
  serif: '"Yu Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Source Han Serif", "Songti SC", serif',
};

interface ReaderPrefs {
  theme: ReaderTheme;
  rubyVisibilityMode: RubyVisibilityMode;
  fontFamily: ReaderFontFamily;
  writingMode: ReaderWritingMode;
  showLineNumbers: boolean;
  textAlign: ReaderTextAlign;
  customRubyColor: string;
}

const DEFAULT_PREFS: ReaderPrefs = {
  theme: 'sepia',
  rubyVisibilityMode: 'all',
  fontFamily: 'sans',
  writingMode: 'horizontal',
  showLineNumbers: false,
  textAlign: 'left',
  customRubyColor: '',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

function isTheme(value: unknown): value is ReaderTheme {
  return value === 'light' || value === 'sepia' || value === 'mint' || value === 'dark';
}

function isVisibility(value: unknown): value is RubyVisibilityMode {
  return value === 'all' || value === 'touch_reveal' || value === 'review_only' || value === 'none';
}

function isFont(value: unknown): value is ReaderFontFamily {
  return value === 'sans' || value === 'serif';
}

function isWritingMode(value: unknown): value is ReaderWritingMode {
  return value === 'horizontal' || value === 'vertical';
}

function loadPrefs(): ReaderPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '') as Partial<ReaderPrefs>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_PREFS.theme,
      rubyVisibilityMode: isVisibility(parsed.rubyVisibilityMode) ? parsed.rubyVisibilityMode : DEFAULT_PREFS.rubyVisibilityMode,
      fontFamily: isFont(parsed.fontFamily) ? parsed.fontFamily : DEFAULT_PREFS.fontFamily,
      writingMode: isWritingMode(parsed.writingMode) ? parsed.writingMode : DEFAULT_PREFS.writingMode,
      showLineNumbers: typeof parsed.showLineNumbers === 'boolean' ? parsed.showLineNumbers : DEFAULT_PREFS.showLineNumbers,
      textAlign: parsed.textAlign === 'center' ? 'center' : 'left',
      customRubyColor: typeof parsed.customRubyColor === 'string' ? parsed.customRubyColor : DEFAULT_PREFS.customRubyColor,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function contentLines(content: string): string[] {
  return content.replace(/\r\n?/g, '\n').split('\n');
}

function highlight(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const needle = query.trim();
  if (!needle) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  let index = lower.indexOf(target);
  while (index >= 0) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), hit: false });
    parts.push({ text: text.slice(index, index + needle.length), hit: true });
    cursor = index + needle.length;
    index = lower.indexOf(target, cursor);
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}

export function ReaderPanel({
  t,
  book,
  annotatedLines,
  isProcessing,
  rubyType,
  onRubyTypeChange,
  fontSize,
  onFontSizeChange,
  rubyFontSize,
  onRubyFontSizeChange,
  lineSpacing,
  onLineSpacingChange,
  onTokenClick,
  onUpdateProgress,
  onGoToLibrary,
  onGoToEditor,
  darkMode,
}: ReaderPanelProps) {
  const [theme, setTheme] = useState<ReaderTheme>(() => {
    const saved = loadPrefs().theme;
    if (darkMode || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))) {
      return 'dark';
    }
    return saved === 'dark' ? 'sepia' : saved;
  });
  const [rubyVisibilityMode, setRubyVisibilityMode] = useState<RubyVisibilityMode>(() => loadPrefs().rubyVisibilityMode);
  const [fontFamily, setFontFamily] = useState<ReaderFontFamily>(() => loadPrefs().fontFamily);
  const [writingMode, setWritingMode] = useState<ReaderWritingMode>(() => loadPrefs().writingMode);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(() => loadPrefs().showLineNumbers);
  const [textAlign, setTextAlign] = useState<ReaderTextAlign>(() => loadPrefs().textAlign);
  const [customRubyColor, setCustomRubyColor] = useState<string>(() => loadPrefs().customRubyColor);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  // hudVisible controls the bottom floating glass capsule visibility (starts visible).
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const [query, setQuery] = useState('');
  const [hintDismissed, setHintDismissed] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(() => new Set());
  const [highlightLine, setHighlightLine] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [aaBtnEl, setAaBtnEl] = useState<HTMLButtonElement | null>(null);
  const capsuleGlassRef = useGlass<HTMLDivElement>();
  const rafRef = useRef<number | null>(null);
  const lastProgressRef = useRef<number>(-1);
  const lastScrollYRef = useRef<number>(0);
  const travelRef = useRef<number>(0);
  // Where the reader is in the text right now (0–100), from the scroll position.
  const [scrollPercent, setScrollPercent] = useState<number | null>(null);
  const prevDarkModeRef = useRef<boolean | undefined>(darkMode);

  const applyFullscreen = useCallback((enter: boolean) => {
    setIsFullscreen(enter);
    if (typeof document === 'undefined') return;
    if (enter) {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (darkMode === undefined) return;
    if (prevDarkModeRef.current !== darkMode) {
      prevDarkModeRef.current = darkMode;
      setTheme(current => {
        if (darkMode) return 'dark';
        return current === 'dark' ? 'sepia' : current;
      });
    }
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ theme, rubyVisibilityMode, fontFamily, writingMode, showLineNumbers, textAlign, customRubyColor })
    );
  }, [theme, rubyVisibilityMode, fontFamily, writingMode, showLineNumbers, textAlign, customRubyColor]);

  // Keep the document chrome painted with the exact reader canvas colour so pulling the page
  // (or a secondary drawer) can never expose black bars at the top/bottom of the viewport.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const canvasBackground = CANVAS_BG[theme];
    const isReaderDark = theme === 'dark';
    const win = window as unknown as {
      webkit?: { messageHandlers?: { furiganaTheme?: { postMessage?: (msg: { bg: string; isDark: boolean }) => void } } };
      AndroidBridge?: { syncTheme?: (bg: string, isDark: boolean) => void };
    };
    root.style.setProperty('--bg-primary', canvasBackground);
    root.style.backgroundColor = canvasBackground;
    body.style.backgroundColor = canvasBackground;
    root.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.removeAttribute('media');
      meta.setAttribute('content', canvasBackground);
    });
    win.webkit?.messageHandlers?.furiganaTheme?.postMessage?.({ bg: canvasBackground, isDark: isReaderDark });
    win.AndroidBridge?.syncTheme?.(canvasBackground, isReaderDark);
    return () => {
      const restoreBg = darkMode ? '#000000' : '#F2F2F7';
      root.style.setProperty('--bg-primary', restoreBg);
      root.style.backgroundColor = restoreBg;
      body.style.backgroundColor = restoreBg;
      document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
        meta.removeAttribute('media');
        meta.setAttribute('content', restoreBg);
      });
      win.webkit?.messageHandlers?.furiganaTheme?.postMessage?.({ bg: restoreBg, isDark: Boolean(darkMode) });
      win.AndroidBridge?.syncTheme?.(restoreBg, Boolean(darkMode));
    };
  }, [theme, darkMode]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (drawer) {
          setDrawer(null);
        } else {
          applyFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, drawer, applyFullscreen]);

  const bookId = book?.bookId ?? null;
  const [prevBookId, setPrevBookId] = useState<string | null>(bookId);
  if (bookId !== prevBookId) {
    setPrevBookId(bookId);
    setRevealedTokens(new Set());
    setHintDismissed(false);
    setDrawer(null);
    setIsFullscreen(false);
    setHudVisible(true);
    setScrollPercent(null);
    setHighlightLine(null);
  }

  useEffect(() => {
    lastProgressRef.current = -1;
    lastScrollYRef.current = 0;
    travelRef.current = 0;
  }, [bookId]);

  const lineCount = annotatedLines.length;
  const percent = scrollPercent ?? (book ? Math.round(clamp(book.readingProgress.percentage, 0, 100)) : 0);

  const searchHits = (() => {
    if (!book) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return contentLines(book.content)
      .flatMap((text, lineIndex) => {
        if (!text.toLowerCase().includes(needle)) return [];
        return [{ lineIndex, text }];
      })
      .slice(0, 80);
  })();

  const goToLine = (lineIndex: number) => {
    setHighlightLine(lineIndex);
    setDrawer(null);
    onUpdateProgress(0, lineIndex);
    window.requestAnimationFrame(() => {
      document.getElementById(`reader-line-${lineIndex}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const processScroll = useCallback(() => {
    const container = canvasRef.current;
    const doc = document.documentElement;
    const useElementScroller =
      container !== null &&
      container.scrollHeight > container.clientHeight + 2 &&
      container.scrollTop > 0;

    const y = useElementScroller
      ? container.scrollTop
      : window.scrollY || doc.scrollTop || (container ? container.scrollTop : 0);
    const max = useElementScroller
      ? Math.max(0, container.scrollHeight - container.clientHeight)
      : Math.max(0, doc.scrollHeight - window.innerHeight);

    const dy = y - lastScrollYRef.current;
    lastScrollYRef.current = y;
    if (max > 0) setScrollPercent(Math.round(clamp((y / max) * 100, 0, 100)));
    if (dy !== 0) {
      let travel = travelRef.current;
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      travelRef.current = travel;
      if (y >= max - 4 || y < 40) {
        setHudVisible(true);
      } else if (travel > 24) {
        setHudVisible(false);
      } else if (travel < -12) {
        setHudVisible(true);
      }
    }

    if (!container) return;
    const nodes = container.querySelectorAll<HTMLElement>('[id^="reader-line-"]');
    if (!nodes.length) return;
    const refTop = Math.max(0, container.getBoundingClientRect().top);
    let index = 0;
    nodes.forEach(node => {
      if (node.getBoundingClientRect().top - refTop <= 72) {
        index = Number(node.id.replace('reader-line-', '')) || 0;
      }
    });
    if (index !== lastProgressRef.current) {
      lastProgressRef.current = index;
      onUpdateProgress(0, index);
    }
  }, [onUpdateProgress]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      processScroll();
    });
  }, [processScroll]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [handleScroll]);

  const handleCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && String(window.getSelection?.() ?? '')) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        'button, a, input, label, select, textarea, [role="button"], ruby, .ruby-interactive-token, #reader-active-drawer'
      )
    ) {
      return;
    }
    if (drawer) {
      setDrawer(null);
      return;
    }
    setHudVisible(prev => !prev);
  };

  const themeLabel: Record<ReaderTheme, string> = {
    light: t.readerThemeLight,
    sepia: t.readerThemeSepia,
    mint: t.readerThemeMint,
    dark: t.readerThemeDark,
  };
  const visibilityLabel: Record<RubyVisibilityMode, string> = {
    all: t.readerRubyVisibilityAll,
    touch_reveal: t.readerRubyVisibilityTouch,
    review_only: t.readerRubyVisibilityReview,
    none: t.readerRubyVisibilityNone,
  };
  const rubyLabel: Record<(typeof RUBY_TYPES)[number], string> = {
    hiragana: t.hiragana,
    katakana: t.katakana,
    romaji: t.romaji,
  };

  const shell = THEME_CLASS[theme];
  const canvasPaper = CANVAS_PAPER_CLASS[theme];
  const muted = theme === 'dark' ? 'text-[#94a3b8] border-[#334155]/80' : 'text-current/60 border-current/15';
  const isVertical = writingMode === 'vertical';
  const activeRubyColor = customRubyColor || RUBY_MUTED[theme];

  if (!book) {
    return (
      <section
        data-reader-theme={theme}
        className="flex min-h-[70vh] flex-1 items-center justify-center p-6"
      >
        <div className="w-full max-w-md rounded-[18px] bg-[var(--surface)] p-8 text-center shadow-[var(--card-shadow)]">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center text-[var(--label-3)]" aria-hidden>
            <IconRead className="h-[42px] w-[42px]" />
          </div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--label)]">
            {t.readerEmptyTitle}
          </h2>
          <p className="mx-auto mt-1.5 mb-5 max-w-[280px] text-[13px] leading-relaxed text-[var(--label-2)]">
            {t.readerEmptyDesc}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn btn-ink"
              onClick={onGoToLibrary}
            >
              {t.readerGoToLibrary}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onGoToEditor()}
            >
              {t.readerGoToEditor}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const rubyState = (token: ScriptLine['tokens'][number], key: string): 'show' | 'hidden' | 'omit' => {
    if (!token.ruby) return 'omit';
    if (rubyVisibilityMode === 'none') return 'omit';
    if (rubyVisibilityMode === 'review_only') {
      return token.needsReview || token.readingSource === 'manual' || token.readingSource === 'glossary' || token.readingSource === 'learned' ? 'show' : 'omit';
    }
    if (rubyVisibilityMode === 'touch_reveal') return revealedTokens.has(key) ? 'show' : 'hidden';
    return 'show';
  };

  const capsuleVisible = hudVisible || drawer !== null;

  return (
    <section
      data-reader-theme={theme}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      className={
        isFullscreen
          ? `fixed inset-0 z-50 min-h-screen w-full overflow-y-auto overscroll-none transition-colors duration-300 ${shell}`
          : `min-h-screen w-full flex-1 transition-colors duration-300 ${shell}`
      }
    >
      <div
        ref={canvasRef}
        onScroll={handleScroll}
        onClick={handleCanvasClick}
        className="w-full"
      >
        {isProcessing && (
          <p className={`mx-auto max-w-[34em] px-6 pt-6 text-xs ${muted}`}>{t.annotatingProgress}</p>
        )}
        {rubyVisibilityMode === 'touch_reveal' && !hintDismissed && (
          <div className="mx-auto max-w-[34em] px-6 pt-6">
            <p className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--fill-2)] px-3.5 py-2 text-xs leading-relaxed text-[var(--label-2)]">
              <span>{t.readerTouchRevealHint}</span>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--label-2)] hover:bg-[var(--fill)] hover:text-[var(--label)]"
                onClick={() => setHintDismissed(true)}
                aria-label="dismiss"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </p>
          </div>
        )}

        {isProcessing && annotatedLines.length === 0 ? (
          <div className="mx-auto max-w-[34em] px-6 pt-[70px] pb-[140px]" aria-hidden="true">
            {[0, 1, 2, 3].map(index => (
              <div key={index} className="mb-3 h-6 animate-pulse rounded bg-current/10" />
            ))}
          </div>
        ) : (
          <article
            lang="ja"
            data-testid="reader-script-canvas"
            data-writing-mode={writingMode}
            data-text-align={!isVertical ? textAlign : undefined}
            className={
              isVertical
                ? `vertical-script-flow mx-auto w-full max-w-none px-6 pt-[70px] pb-[140px] md:px-12 transition-colors duration-300 ${canvasPaper}`
                : `mx-auto max-w-[34em] px-6 pt-[70px] pb-[140px] transition-colors duration-300 ${canvasPaper} ${
                    textAlign === 'center' ? 'text-center' : 'text-left'
                  }`
            }
            style={{
              fontFamily: FONT_STACK[fontFamily],
              fontSize: `${fontSize}px`,
              lineHeight: lineSpacing,
              ...(isVertical ? { height: 'calc(100vh - 180px)' } : {}),
            }}
          >
            <header className="mb-9">
              <h2 className="text-[26px] font-semibold tracking-tight leading-snug">{book.title}</h2>
              <p className={`mt-1 text-[13px] ${muted}`}>
                {book.author?.trim() ? `${book.author.trim()} · ` : ''}全文 · {fill(t.libraryBookLines, { count: lineCount })}
              </p>
            </header>

            {annotatedLines.map((line, globalLineIdx) => {
              const speakerMatch = (line.rawText || line.cleanText || '').match(SPEAKER);
              const speaker = line.speaker || speakerMatch?.[1];
              const timecode = TIMECODE.test(line.rawText || '') ? (line.rawText.match(TIMECODE)?.[0] || '') : '';
              const active = highlightLine === globalLineIdx;
              const joinedSurface = speaker ? line.tokens.map(token => token.surface).join('') : '';
              let remainingSpeakerChars = 0;
              if (speaker) {
                if (joinedSurface.startsWith(speaker)) {
                  const afterSpeaker = joinedSurface.slice(speaker.length);
                  const delimiterMatch = afterSpeaker.match(/^[：:]\s*/);
                  remainingSpeakerChars = speaker.length + (delimiterMatch ? delimiterMatch[0].length : 0);
                } else {
                  const delimiterMatch = joinedSurface.match(/^[：:]\s*/);
                  if (delimiterMatch) remainingSpeakerChars = delimiterMatch[0].length;
                }
              }
              return (
                <div
                  id={`reader-line-${globalLineIdx}`}
                  key={`${line.id}-${globalLineIdx}`}
                  className={
                    isVertical
                      ? 'mb-4 rounded-lg'
                      : `group/line flex items-baseline ${
                          textAlign === 'center' ? 'justify-center text-center' : 'justify-start text-left'
                        } mb-1.5 rounded-lg px-1 py-1.5 ${active ? 'bg-[var(--fill)]' : ''}`
                  }
                >
                  {showLineNumbers && (
                    <span
                      data-testid="reader-line-number"
                      className={`select-none align-top tabular-nums ${muted} ${
                        isVertical ? 'mr-1 inline-block text-[0.62em]' : 'mr-3 inline-block w-7 shrink-0 text-right text-[11px]'
                      }`}
                    >
                      {globalLineIdx + 1}
                    </span>
                  )}
                  <span className="align-top" style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}>
                    {timecode && <span className={`mr-2 inline-block text-[0.62em] tracking-wide ${muted}`}>{timecode}</span>}
                    {speaker && (
                      <span
                        className={`mr-2 inline-flex items-center rounded-md border px-1.5 py-0.5 align-middle text-[0.72em] font-medium tracking-wide ${muted}`}
                      >
                        {speaker}
                      </span>
                    )}
                    {line.tokens.length === 0 && <br />}
                    {line.tokens.map((token, tokenIdx) => {
                      let surface = token.surface;
                      if (remainingSpeakerChars > 0) {
                        if (surface.length <= remainingSpeakerChars) {
                          remainingSpeakerChars -= surface.length;
                          return null;
                        }
                        surface = surface.slice(remainingSpeakerChars);
                        remainingSpeakerChars = 0;
                      }
                      const key = `${globalLineIdx}:${tokenIdx}`;
                      const revealed = revealedTokens.has(key);
                      const rubyMode = rubyState(token, key);
                      const interactive = token.hasKanji;
                      const Tag = rubyMode === 'omit' ? 'span' : 'ruby';
                      const authoritative =
                        token.readingSource === 'manual' ||
                        token.readingSource === 'glossary' ||
                        token.readingSource === 'learned';
                      const emphasized = authoritative;
                      const rubyColor = customRubyColor
                        ? activeRubyColor
                        : emphasized
                          ? RUBY_ACCENT[theme]
                          : activeRubyColor;
                      const activate = () => {
                        if (rubyVisibilityMode === 'touch_reveal' && interactive && !revealed) {
                          setRevealedTokens(current => new Set(current).add(key));
                          return;
                        }
                        onTokenClick(globalLineIdx, tokenIdx);
                      };
                      return (
                        <Tag
                          key={tokenIdx}
                          id={interactive ? `reader-token-${globalLineIdx}-${tokenIdx}` : undefined}
                          tabIndex={interactive ? 0 : undefined}
                          role={interactive ? 'button' : undefined}
                          aria-expanded={rubyVisibilityMode === 'touch_reveal' && interactive ? revealed : undefined}
                          onKeyDown={
                            interactive
                              ? (event: ReactKeyboardEvent<HTMLElement>) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    activate();
                                  }
                                }
                              : undefined
                          }
                          className={`${rubyMode === 'hidden' ? 'group ' : ''}${
                            interactive
                              ? 'ruby-interactive-token cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
                              : ''
                          }`}
                          onClick={() => {
                            if (!interactive) return;
                            activate();
                          }}
                        >
                          {surface}
                          {rubyMode !== 'omit' && (
                            <rt
                              className={`select-none leading-none ${emphasized ? 'font-semibold' : 'font-normal'} ${
                                rubyMode === 'hidden' ? 'opacity-0 transition-opacity group-hover:opacity-100' : ''
                              }`}
                              aria-hidden={rubyMode === 'hidden' ? true : undefined}
                              style={{ fontSize: `${rubyFontSize}px`, color: rubyColor }}
                            >
                              {token.ruby}
                            </rt>
                          )}
                        </Tag>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </article>
        )}
      </div>

      {/* Floating bottom centre glass capsule */}
      <div
        ref={capsuleGlassRef}
        data-hud-visible={capsuleVisible ? 'true' : 'false'}
        className={`glass fixed left-1/2 -translate-x-1/2 bottom-[max(22px,env(safe-area-inset-bottom))] z-40 flex h-[52px] w-[min(470px,calc(100%-32px))] items-center gap-0.5 rounded-full px-2 ${
          capsuleVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-[calc(100%+40px)] opacity-0 pointer-events-none'
        }`}
        style={{
          transition: capsuleVisible
            ? 'translate 620ms var(--spring-bouncy), opacity 220ms ease'
            : 'translate 340ms cubic-bezier(.4,0,.7,.2), opacity 260ms ease',
        }}
      >
        <GlassButton
          icon
          aria-label={t.readerBackToLibrary}
          onClick={() => {
            applyFullscreen(false);
            onGoToLibrary();
          }}
        >
          <IconChevronLeft />
        </GlassButton>

        <div className="min-w-0 flex-1 overflow-hidden px-1.5 text-center">
          <b className="block truncate text-[13px] font-bold leading-tight text-[var(--label)]">
            {book.title}
          </b>
          <span className="block text-[11px] leading-tight text-[var(--label-2)] tabular-nums">
            {fill(t.libraryBookProgress || `已读 ${percent}%`, { percent })}
          </span>
        </div>

        <GlassButton
          icon
          aria-label={t.readerRubyVisibilityLabel}
          aria-pressed={rubyVisibilityMode !== 'none'}
          onClick={() => setRubyVisibilityMode(prev => (prev === 'none' ? 'all' : 'none'))}
        >
          <IconRuby />
        </GlassButton>

        <GlassButton
          ref={setAaBtnEl}
          icon
          aria-label={t.typographySettings}
          aria-expanded={drawer !== null}
          aria-controls="reader-active-drawer"
          onClick={() => setDrawer(current => (current ? null : 'appearance'))}
        >
          <IconTextFormat />
        </GlassButton>
      </div>

      {/* 2px progress line visible only while the capsule is hidden */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed bottom-1 left-[22px] right-[22px] z-30 h-[2px] overflow-hidden rounded bg-[var(--fill-2)] transition-opacity duration-300 ${
          !capsuleVisible ? 'opacity-100 delay-[120ms]' : 'opacity-0'
        }`}
      >
        <i
          className="block h-full rounded bg-[var(--label)] opacity-[0.38]"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Aa & Search GlassPopover */}
      <GlassPopover
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        anchor={aaBtnEl}
        placement="above"
        ariaLabel={drawer === 'search' ? t.readerSearchButton : t.typographySettings}
        className="w-[min(340px,calc(100vw-20px))]"
      >
        <div
          id="reader-active-drawer"
          className="max-h-[70vh] overflow-y-auto overscroll-contain touch-pan-y reader-drawer-scroll-lock p-1"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onTouchMove={event => {
            event.stopPropagation();
          }}
        >
          {drawer === 'search' ? (
            <div className="space-y-2 p-2">
              <div className="flex items-center gap-1.5">
                <GlassButton
                  icon
                  aria-label={t.typographySettings}
                  onClick={() => setDrawer('appearance')}
                >
                  <IconChevronLeft />
                </GlassButton>
                <input
                  type="search"
                  className="h-9 flex-1 rounded-full bg-[var(--fill)] px-3.5 text-[13px] text-[var(--label)] outline-none placeholder:text-[var(--label-3)]"
                  value={query}
                  aria-label={t.readerSearchPlaceholder}
                  placeholder={t.readerSearchPlaceholder}
                  onChange={event => setQuery(event.target.value)}
                />
                <GlassButton
                  icon
                  aria-label="close"
                  onClick={() => setDrawer(null)}
                >
                  <IconClose />
                </GlassButton>
              </div>
              <div role="status" aria-live="polite" className="min-h-4 px-1 text-[11px] text-[var(--label-2)]">
                {query.trim() && searchHits.length === 0
                  ? t.readerSearchNoResults
                  : query.trim()
                    ? fill(t.readerSearchResultsCount, { count: searchHits.length })
                    : '\u00a0'}
              </div>
              <ul className="space-y-1">
                {searchHits.map(hit => (
                  <li key={hit.lineIndex}>
                    <button
                      type="button"
                      className="w-full rounded-[12px] px-3 py-2 text-left text-[13px] text-[var(--label)] transition-colors hover:bg-[var(--item-hover)]"
                      onClick={() => goToLine(hit.lineIndex)}
                    >
                      <span className="mr-2 text-[11px] text-[var(--label-2)] tabular-nums">L{hit.lineIndex + 1}</span>
                      {highlight(hit.text, query).map((part, index) =>
                        part.hit ? (
                          <mark key={index} className="rounded-xs bg-[var(--fill)] px-0.5 text-[var(--label)] font-semibold">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={index}>{part.text}</span>
                        )
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Theme swatches */}
              <div className="px-2.5 pt-2 pb-1.5">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.readerThemeLabel}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {THEMES.map(item => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={theme === item}
                      className={`flex h-8 items-center justify-center gap-1.5 rounded-full border px-2 text-[12px] font-medium transition-all ${
                        theme === item
                          ? 'border-[var(--label)] bg-[var(--fill)] text-[var(--label)] font-semibold'
                          : 'border-[var(--sep)] bg-transparent text-[var(--label-2)] hover:text-[var(--label)]'
                      }`}
                      onClick={() => setTheme(item)}
                    >
                      <span className={`h-3 w-3 shrink-0 rounded-full border ${SWATCH[item]}`} />
                      <span className="truncate">{themeLabel[item]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font family */}
              <div className="px-2.5 pt-2 pb-1.5">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.readerFontFamilyLabel}</div>
                <LiquidSelector<ReaderFontFamily>
                  variant="solid"
                  role="radiogroup"
                  ariaLabel={t.readerFontFamilyLabel}
                  className="flex w-full"
                  value={fontFamily}
                  onChange={setFontFamily}
                  options={[
                    {
                      value: 'sans',
                      label: fontFamily === 'sans' ? t.fontGothic : t.fontGothic,
                      className: 'flex-1 h-7 text-[13px]',
                    },
                    {
                      value: 'serif',
                      label: fontFamily === 'serif' ? t.fontMincho : t.fontMincho,
                      className: 'flex-1 h-7 text-[13px]',
                    },
                  ]}
                />
              </div>

              {/* Font size, ruby size, line spacing sliders */}
              <div className="px-2.5 pt-2 pb-1.5 space-y-2.5">
                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[var(--label-2)]">
                    <span>{t.bodyFontSize}</span>
                    <span className="tabular-nums">{fontSize}px</span>
                  </span>
                  <input
                    className="w-full accent-[var(--label)]"
                    type="range"
                    min={14}
                    max={32}
                    value={fontSize}
                    onChange={event => onFontSizeChange(Number(event.target.value))}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[var(--label-2)]">
                    <span>{t.rubyFontSize}</span>
                    <span className="tabular-nums">{rubyFontSize}px</span>
                  </span>
                  <input
                    className="w-full accent-[var(--label)]"
                    type="range"
                    min={8}
                    max={18}
                    value={rubyFontSize}
                    onChange={event => onRubyFontSizeChange(Number(event.target.value))}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[var(--label-2)]">
                    <span>{t.lineSpacing}</span>
                    <span className="tabular-nums">{lineSpacing.toFixed(1)}</span>
                  </span>
                  <input
                    className="w-full accent-[var(--label)]"
                    type="range"
                    min={1.4}
                    max={3}
                    step={0.1}
                    value={lineSpacing}
                    onChange={event => onLineSpacingChange(Number(event.target.value))}
                  />
                </label>
              </div>

              {/* Writing mode */}
              <div className="px-2.5 pt-2 pb-1.5">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.writingModeLabel}</div>
                <LiquidSelector<ReaderWritingMode>
                  variant="solid"
                  role="radiogroup"
                  ariaLabel={t.writingModeLabel}
                  testId="reader-writing-mode-toggle" // data-testid="reader-writing-mode-toggle"
                  className="flex w-full"
                  value={writingMode}
                  onChange={mode => {
                    if (mode === 'vertical') setWritingMode('vertical');
                    else setWritingMode('horizontal');
                  }}
                  options={[
                    { value: 'horizontal', label: t.writingModeHorizontal, className: 'flex-1 h-7 text-[13px]' },
                    { value: 'vertical', label: t.writingModeVertical, className: 'flex-1 h-7 text-[13px]' },
                  ]}
                />
              </div>

              {/* Ruby type */}
              <div className="px-2.5 pt-2 pb-1.5">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.rubyModeLabel}</div>
                <LiquidSelector<'hiragana' | 'katakana' | 'romaji'>
                  variant="solid"
                  role="radiogroup"
                  ariaLabel={t.rubyModeLabel}
                  className="flex w-full"
                  value={rubyType}
                  onChange={onRubyTypeChange}
                  options={RUBY_TYPES.map(item => ({
                    value: item,
                    label: rubyLabel[item],
                    className: 'flex-1 h-7 text-[13px]',
                  }))}
                />
              </div>

              {/* Ruby visibility */}
              <div className="px-2.5 pt-2 pb-1.5">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.readerRubyVisibilityLabel}</div>
                <LiquidSelector<RubyVisibilityMode>
                  variant="solid"
                  role="radiogroup"
                  ariaLabel={t.readerRubyVisibilityLabel}
                  className="flex w-full"
                  value={rubyVisibilityMode}
                  onChange={setRubyVisibilityMode}
                  options={VISIBILITY.map(mode => ({
                    value: mode,
                    label: visibilityLabel[mode],
                    className: 'flex-1 h-7 px-1.5 text-[12px]',
                  }))}
                />
              </div>

              {/* Line numbers */}
              <div className="px-2.5 pt-2 pb-1.5">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.readerLineNumbers}</div>
                <LiquidSelector<'hide' | 'show'>
                  variant="solid"
                  role="radiogroup"
                  ariaLabel={t.readerLineNumbers}
                  className="flex w-full"
                  value={showLineNumbers ? 'show' : 'hide'}
                  onChange={val => setShowLineNumbers(val === 'show')}
                  options={[
                    {
                      value: 'hide',
                      label: t.readerLineNumbersHide,
                      testId: 'reader-line-numbers-hide-btn', // data-testid="reader-line-numbers-hide-btn"
                      className: 'flex-1 h-7 text-[13px]',
                    },
                    {
                      value: 'show',
                      label: t.readerLineNumbersShow,
                      testId: 'reader-line-numbers-show-btn', // data-testid="reader-line-numbers-show-btn"
                      className: 'flex-1 h-7 text-[13px]',
                    },
                  ]}
                />
              </div>

              {/* Alignment */}
              {writingMode === 'horizontal' && (
                <div className="px-2.5 pt-2 pb-1.5">
                  <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.readerTextAlign}</div>
                  <LiquidSelector<ReaderTextAlign>
                    variant="solid"
                    role="radiogroup"
                    ariaLabel={t.readerTextAlign}
                    className="flex w-full"
                    value={textAlign}
                    onChange={setTextAlign}
                    options={[
                      {
                        value: 'left',
                        label: t.readerAlignLeft,
                        testId: 'reader-align-left-btn', // data-testid="reader-align-left-btn"
                        className: 'flex-1 h-7 text-[13px]',
                      },
                      {
                        value: 'center',
                        label: t.readerAlignCenter,
                        testId: 'reader-align-center-btn', // data-testid="reader-align-center-btn"
                        className: 'flex-1 h-7 text-[13px]',
                      },
                    ]}
                  />
                </div>
              )}

              {/* Ruby colour */}
              <div className="px-2.5 pt-2 pb-1.5">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--label-2)]">{t.readerRubyColor}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="ruby-color-default-btn"
                    aria-pressed={!customRubyColor}
                    className={`h-7 rounded-full border px-2.5 text-[12px] font-medium transition-all ${
                      !customRubyColor
                        ? 'border-[var(--label)] bg-[var(--fill)] text-[var(--label)] font-semibold'
                        : 'border-[var(--sep)] text-[var(--label-2)] hover:text-[var(--label)]'
                    }`}
                    onClick={() => setCustomRubyColor('')}
                  >
                    {t.readerRubyColorDefault}
                  </button>
                  {RUBY_COLOR_SWATCHES.map(color => (
                    <button
                      key={color}
                      type="button"
                      data-testid={`ruby-color-swatch-${color}`}
                      aria-label={color}
                      aria-pressed={customRubyColor.toLowerCase() === color}
                      className={`h-6 w-6 rounded-full border border-black/15 transition-transform ${
                        customRubyColor.toLowerCase() === color
                          ? 'scale-110 ring-2 ring-[var(--label)]'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setCustomRubyColor(color)}
                    />
                  ))}
                  <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--sep)] px-2.5 text-[12px] font-medium text-[var(--label-2)] hover:text-[var(--label)]">
                    <input
                      type="color"
                      data-testid="ruby-color-picker"
                      aria-label={t.readerRubyColorCustom}
                      value={customRubyColor || '#52525b'}
                      onChange={event => setCustomRubyColor(event.target.value)}
                      className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    />
                    <span>{t.readerRubyColorCustom}</span>
                  </label>
                </div>
              </div>

              <PopoverSeparator />

              {/* Fullscreen toggle row */}
              {isFullscreen ? (
                <PopoverItem
                  data-testid="reader-exit-fullscreen-btn"
                  aria-label={t.readerExitFullscreen}
                  onClick={() => applyFullscreen(false)}
                >
                  {t.readerExitFullscreen}
                </PopoverItem>
              ) : (
                <PopoverItem
                  data-testid="reader-fullscreen-btn"
                  aria-label={t.readerEnterFullscreen}
                  onClick={() => applyFullscreen(true)}
                >
                  {t.readerEnterFullscreen}
                </PopoverItem>
              )}

              {/* Open in editor */}
              <PopoverItem
                icon={<IconEdit />}
                onClick={() => {
                  setDrawer(null);
                  applyFullscreen(false);
                  onGoToEditor(book);
                }}
              >
                {t.libraryEditInStudio}
              </PopoverItem>

              {/* Search entry */}
              <PopoverItem
                icon={<IconSearch />}
                onClick={() => setDrawer('search')}
              >
                {t.readerSearchButton}
              </PopoverItem>
            </div>
          )}
        </div>
      </GlassPopover>
    </section>
  );
}
