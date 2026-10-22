'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { ScriptLine } from '../utils/furigana';
import type { Translations } from '../utils/i18n';
import type { BookItem } from '../utils/libraryDatabase';

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
  light: 'bg-[#ffffff]/95 text-[#18181b] border-zinc-200/80 dark:border-white/10',
  sepia: 'bg-[#fbf6ec]/95 text-[#3d3124] border-[#e6dac3]/90',
  mint: 'bg-[#eef6f0]/95 text-[#1e3326] border-[#cde2d3]/90',
  dark: 'bg-[#121622]/96 text-[#f1f5f9] border-white/10 dark:bg-[#121622]/96 dark:text-slate-100 dark:border-white/10',
};

const HEADER_GLASS_CLASS: Record<ReaderTheme, string> = {
  light:
    'bg-[#ffffff]/86 border-zinc-200/75 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.96)]',
  sepia:
    'bg-[#fbf6ec]/88 border-[#e2d3b9]/85 shadow-[0_10px_30px_-12px_rgba(61,49,36,0.09),inset_0_1px_0_rgba(255,252,245,0.92)]',
  mint:
    'bg-[#eef6f0]/88 border-[#c5decc]/85 shadow-[0_10px_30px_-12px_rgba(30,51,38,0.09),inset_0_1px_0_rgba(245,255,248,0.92)]',
  dark:
    'bg-[#161b29]/92 border-white/12 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.10)]',
};

const DRAWER_GLASS_CLASS: Record<ReaderTheme, string> = {
  light:
    'bg-[#f8fafc]/96 border-zinc-200/80 backdrop-blur-3xl shadow-[0_24px_56px_-12px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.96)]',
  sepia:
    'bg-[#f8f0e0]/96 border-[#e2d3b9]/85 backdrop-blur-3xl shadow-[0_24px_56px_-12px_rgba(61,49,36,0.18),inset_0_1px_0_rgba(255,252,245,0.90)]',
  mint:
    'bg-[#e6f2e9]/96 border-[#c5decc]/85 backdrop-blur-3xl shadow-[0_24px_56px_-12px_rgba(30,51,38,0.18),inset_0_1px_0_rgba(245,255,248,0.90)]',
  dark:
    'bg-[#131826]/96 border-white/14 backdrop-blur-3xl shadow-[0_24px_56px_-12px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.12)]',
};

const CANVAS_PAPER_CLASS: Record<ReaderTheme, string> = {
  light:
    'bg-gradient-to-b from-white/75 via-white/40 to-zinc-50/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_0_40px_rgba(15,23,42,0.025)]',
  sepia:
    'bg-gradient-to-b from-[#fdf9f0]/80 via-[#fbf6ec]/55 to-[#f5ecda]/50 shadow-[inset_0_1px_0_rgba(255,252,245,0.92),inset_0_0_48px_rgba(120,90,50,0.055)]',
  mint:
    'bg-gradient-to-b from-[#f4faf6]/80 via-[#eef6f0]/55 to-[#e4f0e7]/50 shadow-[inset_0_1px_0_rgba(245,255,248,0.92),inset_0_0_44px_rgba(30,65,42,0.045)]',
  dark:
    'bg-gradient-to-b from-white/[0.03] via-transparent to-black/20 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_52px_rgba(0,0,0,0.38)]',
};

const SWATCH: Record<ReaderTheme, string> = {
  light: 'bg-[#ffffff] border-zinc-300',
  sepia: 'bg-[#f4e7cf] border-[#c9b48f]',
  mint: 'bg-[#d7eadc] border-[#8fbf9d]',
  dark: 'bg-[#181c2a] border-slate-600',
};

const RUBY_MUTED: Record<ReaderTheme, string> = { light: '#52525b', sepia: '#6e563a', mint: '#355943', dark: '#cbd5e1' };
const RUBY_ACCENT: Record<ReaderTheme, string> = { light: '#2563eb', sepia: '#2563eb', mint: '#2563eb', dark: '#93c5fd' };

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

function CloseIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function BackChevronIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function StudioEditIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

function HorizontalIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function VerticalIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M12 4v16M17 4v10" />
    </svg>
  );
}

function FullscreenEnterIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9V5.25A1.5 1.5 0 015.25 3.75H9M15 3.75h3.75a1.5 1.5 0 011.5 1.5V9M20.25 15v3.75a1.5 1.5 0 01-1.5 1.5H15M9 20.25H5.25a1.5 1.5 0 01-1.5-1.5V15" />
    </svg>
  );
}

function FullscreenExitIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75v3.75a1.5 1.5 0 01-1.5 1.5H3.75M15 3.75v3.75a1.5 1.5 0 001.5 1.5h3.75M20.25 15h-3.75a1.5 1.5 0 00-1.5 1.5v3.75M3.75 15h3.75a1.5 1.5 0 011.5 1.5v3.75" />
    </svg>
  );
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
  const [hudVisible, setHudVisible] = useState<boolean>(false);
  const [query, setQuery] = useState('');
  const [hintDismissed, setHintDismissed] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(() => new Set());
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastProgressRef = useRef<number>(-1);
  const prevDarkModeRef = useRef<boolean | undefined>(darkMode);

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
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, rubyVisibilityMode, fontFamily, writingMode, showLineNumbers, textAlign, customRubyColor }));
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
      const restoreBg = darkMode ? '#0b0d13' : '#eef2f9';
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
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (drawer) {
          setDrawer(null);
        } else {
          setIsFullscreen(false);
          setHudVisible(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, drawer]);

  const bookId = book?.bookId ?? null;
  const [prevBookId, setPrevBookId] = useState<string | null>(bookId);
  if (bookId !== prevBookId) {
    setPrevBookId(bookId);
    setRevealedTokens(new Set());
    setHintDismissed(false);
    setDrawer(null);
    setIsFullscreen(false);
    setHudVisible(false);
    setHighlightLine(null);
  }

  useEffect(() => {
    lastProgressRef.current = -1;
  }, [bookId]);

  const lineCount = annotatedLines.length;
  const percent = book ? Math.round(clamp(book.readingProgress.percentage, 0, 100)) : 0;

  const searchHits = (() => {
    if (!book) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return contentLines(book.content).flatMap((text, lineIndex) => {
      if (!text.toLowerCase().includes(needle)) return [];
      return [{ lineIndex, text }];
    }).slice(0, 80);
  })();

  const goToLine = (lineIndex: number) => {
    setHighlightLine(lineIndex);
    setDrawer(null);
    onUpdateProgress(0, lineIndex);
    window.requestAnimationFrame(() => {
      document.getElementById(`reader-line-${lineIndex}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const handleScroll = () => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const container = canvasRef.current;
      if (!container) return;
      const nodes = container.querySelectorAll<HTMLElement>('[id^="reader-line-"]');
      if (!nodes.length) return;
      const top = container.getBoundingClientRect().top;
      let index = 0;
      nodes.forEach(node => {
        if (node.getBoundingClientRect().top - top <= 32) index = Number(node.id.replace('reader-line-', '')) || 0;
      });
      if (index !== lastProgressRef.current) {
        lastProgressRef.current = index;
        onUpdateProgress(0, index);
      }
    });
  };

  const handleCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isFullscreen) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        'button, a, input, label, select, textarea, [role="button"], .ruby-interactive-token, #reader-active-drawer'
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
  const headerGlass = HEADER_GLASS_CLASS[theme];
  const drawerGlass = DRAWER_GLASS_CLASS[theme];
  const canvasPaper = CANVAS_PAPER_CLASS[theme];
  const muted = theme === 'dark' ? 'text-[#94a3b8] border-[#334155]/80' : 'text-current/65 border-current/15';
  const glassTrack = theme === 'dark'
    ? 'bg-[#0b0e17]/75 border-[#334155]/85 text-[#e2e8f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
    : 'bg-[#ffffff]/70 border-current/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]';
  const glassPillButton = theme === 'dark'
    ? 'bg-[#1e2436]/90 border-[#334155]/85 text-[#e2e8f0] hover:bg-[#283048] hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
    : 'bg-[#ffffff]/78 border-current/15 hover:bg-[#ffffff]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]';
  const activePill = theme === 'dark'
    ? { backgroundColor: '#f4f4f5', color: '#18181b' }
    : { backgroundColor: '#18181b', color: '#ffffff' };
  const isVertical = writingMode === 'vertical';
  const activeRubyColor = customRubyColor || RUBY_MUTED[theme];

  const writingModeButtons = (
    <>
      <button
        type="button"
        aria-pressed={writingMode === 'horizontal'}
        className={`lg-pill-interactive inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 sm:px-3 text-xs font-medium transition-all ${writingMode === 'horizontal' ? 'shadow-2xs' : 'opacity-70 hover:opacity-100'}`}
        style={writingMode === 'horizontal' ? activePill : undefined}
        onClick={() => setWritingMode('horizontal')}
      >
        <HorizontalIcon />
        {t.writingModeHorizontal}
      </button>
      <button
        type="button"
        aria-pressed={writingMode === 'vertical'}
        className={`lg-pill-interactive inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 sm:px-3 text-xs font-medium transition-all ${writingMode === 'vertical' ? 'shadow-2xs' : 'opacity-70 hover:opacity-100'}`}
        style={writingMode === 'vertical' ? activePill : undefined}
        onClick={() => setWritingMode('vertical')}
      >
        <VerticalIcon />
        {t.writingModeVertical}
      </button>
    </>
  );

  if (!book) {
    return (
      <section
        data-reader-theme={theme}
        className={`flex-1 min-h-[65vh] backdrop-blur-2xl rounded-2xl sm:rounded-3xl border shadow-[0_16px_40px_-12px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center p-6 sm:p-8 ${shell}`}
      >
        <div className="max-w-md text-center space-y-5">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-xl ${glassTrack}`}
            aria-hidden
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.25A2.25 2.25 0 016.25 3h5.25v16.5H6.25A2.25 2.25 0 004 21.75V5.25z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 5.25A2.25 2.25 0 0017.75 3h-5.25v16.5h5.25A2.25 2.25 0 0120 21.75V5.25z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">{t.readerEmptyTitle}</h2>
            <p className={`text-sm leading-relaxed ${muted}`}>{t.readerEmptyDesc}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <button
              type="button"
              className="lg-pill-interactive min-h-11 rounded-full px-5 text-sm font-medium shadow-md transition-all hover:opacity-90"
              style={activePill}
              onClick={onGoToLibrary}
            >
              {t.readerGoToLibrary}
            </button>
            <button
              type="button"
              className={`lg-pill-interactive min-h-11 rounded-full border px-5 text-sm font-medium backdrop-blur-md transition-all ${glassPillButton}`}
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

  const cornerHudActive = isFullscreen && (hudVisible || drawer !== null);
  const cornerVisibilityClass = cornerHudActive
    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
    : 'opacity-0 scale-95 pointer-events-none';

  return (
    <section
      data-reader-theme={theme}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      className={
        isFullscreen
          ? `fixed inset-0 z-50 w-full h-[100dvh] flex flex-col justify-between overflow-hidden overscroll-none select-none rounded-none border-0 backdrop-blur-2xl ${shell}`
          : `flex-1 flex flex-col min-h-0 rounded-2xl sm:rounded-3xl border backdrop-blur-2xl shadow-[0_16px_44px_-12px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.15)] overflow-hidden ${shell}`
      }
    >
      {!isFullscreen && (
        <header className={`lg-container liquid-glass-nav relative z-30 border-b backdrop-blur-2xl transition-colors ${headerGlass}`}>
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-2.5 md:px-5">
            <button
              type="button"
              className={`lg-pill-interactive inline-flex min-h-9 sm:min-h-10 items-center gap-1.5 rounded-full border px-3 sm:px-3.5 text-xs font-medium transition-all active:scale-[0.98] ${glassPillButton}`}
              onClick={onGoToLibrary}
            >
              <BackChevronIcon />
              <span>{t.readerBackToLibrary}</span>
            </button>
            <div className="min-w-0 flex-1 px-1">
              <h2 className="truncate text-sm md:text-base font-semibold tracking-tight">{book.title}</h2>
              {book.author?.trim() && (
                <p className={`truncate text-[11px] ${muted}`}>{book.author.trim()}</p>
              )}
            </div>
            <span className={`hidden xs:inline-flex sm:inline-flex shrink-0 items-center rounded-full border px-2.5 sm:px-3 py-1 text-[11px] font-medium tabular-nums ${glassTrack}`}>
              {fill(t.libraryBookLines, { count: lineCount })}
            </span>
            <button
              type="button"
              data-testid="reader-fullscreen-btn"
              aria-label={t.readerEnterFullscreen}
              className={`lg-pill-interactive inline-flex min-h-9 sm:min-h-10 items-center gap-1.5 rounded-full border px-3 sm:px-3.5 text-xs font-medium transition-all active:scale-[0.98] ${glassPillButton}`}
              onClick={() => {
                setIsFullscreen(true);
                setHudVisible(false);
                setDrawer(null);
              }}
            >
              <FullscreenEnterIcon />
              <span>{t.readerEnterFullscreen}</span>
            </button>
            <button
              type="button"
              className={`lg-pill-interactive inline-flex min-h-9 sm:min-h-10 items-center gap-1.5 rounded-full border px-3 sm:px-3.5 text-xs font-medium transition-all active:scale-[0.98] ${glassPillButton}`}
              onClick={() => onGoToEditor(book)}
            >
              <StudioEditIcon />
              <span>{t.libraryEditInStudio}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 pb-2.5 sm:px-4 sm:pb-2.5 md:px-5">
            <div
              role="group"
              aria-label={t.writingModeLabel}
              data-testid="reader-writing-mode-toggle"
              className={`inline-flex shrink-0 items-center rounded-full border p-0.5 ${glassTrack}`}
            >
              {writingModeButtons}
            </div>
            <div className={`inline-flex flex-wrap items-center gap-0.5 rounded-full border p-0.5 max-w-full overflow-x-auto no-scrollbar ${glassTrack}`}>
              {VISIBILITY.map(mode => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={rubyVisibilityMode === mode}
                  className={`lg-pill-interactive min-h-8 shrink-0 rounded-full px-2.5 sm:px-3 text-[11px] sm:text-xs font-medium transition-all ${rubyVisibilityMode === mode ? 'shadow-2xs' : 'opacity-70 hover:opacity-100'}`}
                  style={rubyVisibilityMode === mode ? activePill : undefined}
                  onClick={() => setRubyVisibilityMode(mode)}
                >
                  {visibilityLabel[mode]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-expanded={drawer === 'search'}
                aria-controls="reader-active-drawer"
                className={`lg-pill-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 sm:px-3.5 text-xs font-medium transition-all active:scale-[0.98] ${drawer === 'search' ? 'ring-2 ring-current/25' : ''} ${glassPillButton}`}
                onClick={() => setDrawer(current => current === 'search' ? null : 'search')}
              >
                <SearchIcon />
                <span className="hidden sm:inline">{t.readerSearchButton}</span>
              </button>
              <button
                type="button"
                aria-expanded={drawer === 'appearance'}
                aria-controls="reader-active-drawer"
                aria-label={t.typographySettings}
                className={`lg-pill-interactive inline-flex min-h-9 items-center justify-center rounded-full border px-3.5 sm:px-4 text-xs font-semibold tracking-wide transition-all active:scale-[0.98] ${drawer === 'appearance' ? 'ring-2 ring-current/25' : ''} ${glassPillButton}`}
                onClick={() => setDrawer(current => current === 'appearance' ? null : 'appearance')}
              >
                Aa
              </button>
            </div>
          </div>
        </header>
      )}

      {isFullscreen && (
        <div
          data-testid="reader-fullscreen-hud"
          data-hud-visible={cornerHudActive ? 'true' : 'false'}
          className="pointer-events-none fixed inset-0 z-40"
        >
          {/* Corner 1: Top-Left (Exit Fullscreen, Back to Library, Title) */}
          <div
            data-testid="reader-corner-top-left"
            className={`lg-container fixed left-3.5 sm:left-6 top-[max(0.875rem,env(safe-area-inset-top))] flex items-center gap-1.5 rounded-full border p-1 backdrop-blur-2xl transition-all duration-200 ${headerGlass} ${cornerVisibilityClass}`}
          >
            <button
              type="button"
              data-testid="reader-exit-fullscreen-btn"
              aria-label={t.readerExitFullscreen}
              className={`lg-pill-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all active:scale-[0.98] ${glassPillButton}`}
              onClick={() => {
                setIsFullscreen(false);
                setHudVisible(false);
                setDrawer(null);
              }}
            >
              <FullscreenExitIcon />
              <span>{t.readerExitFullscreen}</span>
            </button>
            <button
              type="button"
              className={`lg-pill-interactive inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 sm:px-3 text-xs font-medium transition-all active:scale-[0.98] ${glassPillButton}`}
              onClick={() => {
                setIsFullscreen(false);
                setHudVisible(false);
                onGoToLibrary();
              }}
            >
              <BackChevronIcon />
              <span className="hidden sm:inline">{t.readerBackToLibrary}</span>
            </button>
            <span className="hidden md:inline-block max-w-[14rem] truncate px-2.5 text-xs font-semibold tracking-tight">
              {book.title}
            </span>
          </div>

          {/* Corner 2: Top-Right (Search & Aa Typography Settings) */}
          <div
            data-testid="reader-corner-top-right"
            className={`lg-container fixed right-3.5 sm:right-6 top-[max(0.875rem,env(safe-area-inset-top))] flex items-center gap-1.5 rounded-full border p-1 backdrop-blur-2xl transition-all duration-200 ${headerGlass} ${cornerVisibilityClass}`}
          >
            <button
              type="button"
              aria-expanded={drawer === 'search'}
              aria-controls="reader-active-drawer"
              className={`lg-pill-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 sm:px-3.5 text-xs font-medium transition-all active:scale-[0.98] ${drawer === 'search' ? 'ring-2 ring-current/25' : ''} ${glassPillButton}`}
              onClick={() => setDrawer(current => current === 'search' ? null : 'search')}
            >
              <SearchIcon />
              <span className="hidden sm:inline">{t.readerSearchButton}</span>
            </button>
            <button
              type="button"
              aria-expanded={drawer === 'appearance'}
              aria-controls="reader-active-drawer"
              aria-label={t.typographySettings}
              className={`lg-pill-interactive inline-flex min-h-9 items-center justify-center rounded-full border px-3.5 sm:px-4 text-xs font-semibold tracking-wide transition-all active:scale-[0.98] ${drawer === 'appearance' ? 'ring-2 ring-current/25' : ''} ${glassPillButton}`}
              onClick={() => setDrawer(current => current === 'appearance' ? null : 'appearance')}
            >
              Aa
            </button>
          </div>

          {/* Corner 3: Bottom-Left (Writing Mode & Ruby Visibility Controls) */}
          <div
            data-testid="reader-corner-bottom-left"
            className={`lg-container fixed left-3.5 sm:left-6 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-wrap items-center gap-1.5 max-w-[calc(100vw-9rem)] sm:max-w-none rounded-3xl sm:rounded-full border p-1 backdrop-blur-2xl transition-all duration-200 ${headerGlass} ${cornerVisibilityClass}`}
          >
            <div
              role="group"
              aria-label={t.writingModeLabel}
              className={`inline-flex shrink-0 items-center rounded-full border p-0.5 ${glassTrack}`}
            >
              {writingModeButtons}
            </div>
            <div className={`hidden sm:inline-flex items-center gap-0.5 rounded-full border p-0.5 ${glassTrack}`}>
              {VISIBILITY.map(mode => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={rubyVisibilityMode === mode}
                  className={`lg-pill-interactive min-h-8 shrink-0 rounded-full px-2.5 text-[11px] font-medium transition-all ${rubyVisibilityMode === mode ? 'shadow-2xs' : 'opacity-70 hover:opacity-100'}`}
                  style={rubyVisibilityMode === mode ? activePill : undefined}
                  onClick={() => setRubyVisibilityMode(mode)}
                >
                  {visibilityLabel[mode]}
                </button>
              ))}
            </div>
          </div>

          {/* Corner 4: Bottom-Right (Reading Progress & Edit in Studio) */}
          <div
            data-testid="reader-corner-bottom-right"
            className={`lg-container fixed right-3.5 sm:right-6 bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-1.5 rounded-full border p-1 backdrop-blur-2xl transition-all duration-200 ${headerGlass} ${cornerVisibilityClass}`}
          >
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold tabular-nums ${glassTrack}`}>
              {percent}%
            </span>
            <button
              type="button"
              className={`lg-pill-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all active:scale-[0.98] ${glassPillButton}`}
              onClick={() => {
                setIsFullscreen(false);
                setHudVisible(false);
                onGoToEditor(book);
              }}
            >
              <StudioEditIcon />
              <span className="hidden sm:inline">{t.libraryEditInStudio}</span>
            </button>
          </div>
        </div>
      )}

      {drawer && (
        <>
          <div
            className="fixed inset-0 z-40 touch-none overscroll-none bg-black/20 backdrop-blur-[2px] sm:hidden"
            aria-hidden="true"
            onClick={() => setDrawer(null)}
            onTouchMove={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          />
          <div
            id="reader-active-drawer"
            role="region"
            aria-label={drawer === 'search' ? t.readerSearchButton : t.typographySettings}
            className={`z-50 max-h-[62vh] sm:max-h-[72vh] overflow-y-auto overscroll-contain touch-pan-y reader-drawer-scroll-lock border px-3.5 py-3.5 md:px-5 max-sm:fixed max-sm:inset-x-3 max-sm:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] max-sm:top-auto max-sm:rounded-3xl sm:fixed sm:right-6 sm:top-[calc(max(1rem,env(safe-area-inset-top))+3.75rem)] sm:w-[32rem] md:w-[38rem] sm:rounded-3xl ${drawerGlass}`}
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            onTouchMove={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-current/20 sm:hidden" aria-hidden="true" />
            {drawer === 'search' && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                      type="search"
                      className={`w-full min-h-10 rounded-full border px-4 text-sm outline-none focus:ring-2 focus:ring-current/20 ${glassTrack}`}
                      value={query}
                      aria-label={t.readerSearchPlaceholder}
                      placeholder={t.readerSearchPlaceholder}
                      onChange={event => setQuery(event.target.value)}
                    />
                    <button
                      type="button"
                      className={`min-h-10 rounded-full border px-3 text-xs transition-all ${glassPillButton}`}
                      aria-label="close"
                      onClick={() => setDrawer(null)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <div role="status" aria-live="polite" className={`min-h-5 px-1 text-[11px] ${muted}`}>
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
                          className="min-h-10 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-current/5"
                          onClick={() => goToLine(hit.lineIndex)}
                        >
                          <span className={`mr-2 text-[11px] tabular-nums ${muted}`}>L{hit.lineIndex + 1}</span>
                          {highlight(hit.text, query).map((part, index) => part.hit
                            ? <mark key={index} className="rounded-sm bg-amber-200/80 text-inherit">{part.text}</mark>
                            : <span key={index}>{part.text}</span>)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {drawer === 'appearance' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold tracking-tight opacity-85">{t.typographySettings}</span>
                    <button
                      type="button"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-all ${glassPillButton}`}
                      aria-label="close"
                      onClick={() => setDrawer(null)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="grid gap-3.5 md:grid-cols-2">
                    <fieldset className={`rounded-2xl border p-3 ${glassTrack}`}>
                      <legend className="px-1 text-xs font-medium">{t.readerThemeLabel}</legend>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {THEMES.map(item => (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={theme === item}
                            className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-all ${
                              theme === item ? 'ring-2 ring-current/35 shadow-2xs' : 'opacity-80 hover:opacity-100'
                            } ${glassPillButton}`}
                            onClick={() => setTheme(item)}
                          >
                            <span className={`h-3.5 w-3.5 rounded-full border ${SWATCH[item]}`} />
                            {themeLabel[item]}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className={`rounded-2xl border p-3 ${glassTrack}`}>
                      <legend className="px-1 text-xs font-medium">{t.readerFontFamilyLabel}</legend>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-pressed={fontFamily === 'sans'}
                          className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition-all ${fontFamily === 'sans' ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                          style={fontFamily === 'sans' ? activePill : undefined}
                          onClick={() => setFontFamily('sans')}
                        >
                          {t.fontGothic}
                        </button>
                        <button
                          type="button"
                          aria-pressed={fontFamily === 'serif'}
                          className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition-all ${fontFamily === 'serif' ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                          style={fontFamily === 'serif' ? activePill : undefined}
                          onClick={() => setFontFamily('serif')}
                        >
                          {t.fontMincho}
                        </button>
                      </div>
                    </fieldset>
                    <fieldset className={`rounded-2xl border p-3 ${glassTrack}`}>
                      <legend className="px-1 text-xs font-medium">{t.rubyModeLabel}</legend>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {RUBY_TYPES.map(item => (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={rubyType === item}
                            className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition-all ${rubyType === item ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                            style={rubyType === item ? activePill : undefined}
                            onClick={() => onRubyTypeChange(item)}
                          >
                            {rubyLabel[item]}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className={`rounded-2xl border p-3 ${glassTrack}`}>
                      <legend className="px-1 text-xs font-medium">{t.readerLineNumbers}</legend>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-testid="reader-line-numbers-hide-btn"
                          aria-pressed={!showLineNumbers}
                          className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition-all ${!showLineNumbers ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                          style={!showLineNumbers ? activePill : undefined}
                          onClick={() => setShowLineNumbers(false)}
                        >
                          {t.readerLineNumbersHide}
                        </button>
                        <button
                          type="button"
                          data-testid="reader-line-numbers-show-btn"
                          aria-pressed={showLineNumbers}
                          className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition-all ${showLineNumbers ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                          style={showLineNumbers ? activePill : undefined}
                          onClick={() => setShowLineNumbers(true)}
                        >
                          {t.readerLineNumbersShow}
                        </button>
                      </div>
                    </fieldset>
                    {writingMode === 'horizontal' && (
                      <fieldset className={`rounded-2xl border p-3 ${glassTrack}`}>
                        <legend className="px-1 text-xs font-medium">{t.readerTextAlign}</legend>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid="reader-align-left-btn"
                            aria-pressed={textAlign === 'left'}
                            className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition-all ${textAlign === 'left' ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                            style={textAlign === 'left' ? activePill : undefined}
                            onClick={() => setTextAlign('left')}
                          >
                            {t.readerAlignLeft}
                          </button>
                          <button
                            type="button"
                            data-testid="reader-align-center-btn"
                            aria-pressed={textAlign === 'center'}
                            className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition-all ${textAlign === 'center' ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                            style={textAlign === 'center' ? activePill : undefined}
                            onClick={() => setTextAlign('center')}
                          >
                            {t.readerAlignCenter}
                          </button>
                        </div>
                      </fieldset>
                    )}
                    <fieldset className={`rounded-2xl border p-3 ${glassTrack}`}>
                      <legend className="px-1 text-xs font-medium">{t.readerRubyColor}</legend>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          data-testid="ruby-color-default-btn"
                          aria-pressed={!customRubyColor}
                          className={`min-h-8 rounded-full border px-3 text-xs font-medium transition-all ${!customRubyColor ? 'shadow-2xs' : 'opacity-75 hover:opacity-100'}`}
                          style={!customRubyColor ? activePill : undefined}
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
                              customRubyColor.toLowerCase() === color ? 'scale-110 ring-2 ring-current/45' : 'opacity-85 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setCustomRubyColor(color)}
                          />
                        ))}
                        <label className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all ${glassPillButton}`}>
                          <input
                            type="color"
                            data-testid="ruby-color-picker"
                            aria-label={t.readerRubyColorCustom}
                            value={customRubyColor || '#0071e3'}
                            onChange={event => setCustomRubyColor(event.target.value)}
                            className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                          />
                          <span>{t.readerRubyColorCustom}</span>
                        </label>
                      </div>
                    </fieldset>
                    <div className={`grid gap-3 rounded-2xl border p-3 sm:grid-cols-3 md:col-span-2 ${glassTrack}`}>
                      <label className="flex flex-col justify-between text-xs font-medium">
                        <span className="flex items-center justify-between">
                          <span>{t.bodyFontSize}</span>
                          <span className="tabular-nums opacity-75">{fontSize}px</span>
                        </span>
                        <input
                          className="mt-2 w-full accent-current"
                          type="range"
                          min={14}
                          max={32}
                          value={fontSize}
                          onChange={event => onFontSizeChange(Number(event.target.value))}
                        />
                      </label>
                      <label className="flex flex-col justify-between text-xs font-medium">
                        <span className="flex items-center justify-between">
                          <span>{t.rubyFontSize}</span>
                          <span className="tabular-nums opacity-75">{rubyFontSize}px</span>
                        </span>
                        <input
                          className="mt-2 w-full accent-current"
                          type="range"
                          min={8}
                          max={18}
                          value={rubyFontSize}
                          onChange={event => onRubyFontSizeChange(Number(event.target.value))}
                        />
                      </label>
                      <label className="flex flex-col justify-between text-xs font-medium">
                        <span className="flex items-center justify-between">
                          <span>{t.lineSpacing}</span>
                          <span className="tabular-nums opacity-75">{lineSpacing.toFixed(1)}</span>
                        </span>
                        <input
                          className="mt-2 w-full accent-current"
                          type="range"
                          min={1.4}
                          max={3}
                          step={0.1}
                          value={lineSpacing}
                          onChange={event => onLineSpacingChange(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      <div
        ref={canvasRef}
        onScroll={handleScroll}
        onClick={handleCanvasClick}
        className={`flex-1 ${drawer !== null ? 'overflow-hidden overscroll-none' : 'overflow-y-auto'} ${isFullscreen ? 'pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]' : 'pb-10'}`}
      >
        {isProcessing && <p className={`px-5 pt-4 text-xs md:px-10 ${muted}`}>{t.annotatingProgress}</p>}
        {rubyVisibilityMode === 'touch_reveal' && !hintDismissed && (
          <p className={`mx-5 mt-4 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2 text-xs leading-relaxed md:mx-10 ${glassTrack}`}>
            <span>{t.readerTouchRevealHint}</span>
            <button type="button" className="min-h-8 shrink-0 rounded-full px-2" onClick={() => setHintDismissed(true)} aria-label="dismiss">
              <CloseIcon />
            </button>
          </p>
        )}

        {isProcessing && annotatedLines.length === 0 ? (
          <div className="mx-auto max-w-5xl px-5 py-8 xl:max-w-6xl sm:px-10 md:px-14" aria-hidden="true">
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
            className={isVertical
              ? `vertical-script-flow mx-auto w-full max-w-none px-6 py-8 md:px-12 rounded-2xl sm:rounded-3xl transition-colors duration-300 ${drawer !== null ? 'overscroll-none' : ''} ${canvasPaper}`
              : `mx-auto max-w-5xl xl:max-w-6xl px-5 sm:px-10 md:px-14 py-8 rounded-2xl sm:rounded-3xl transition-colors duration-300 ${drawer !== null ? 'overscroll-none' : ''} ${canvasPaper} ${textAlign === 'center' ? 'text-center' : 'text-left'}`}
            style={{
              fontFamily: FONT_STACK[fontFamily],
              ...(isVertical ? { height: 'calc(100vh - 180px)' } : {}),
            }}
          >
            <p className={`mb-6 text-[11px] font-medium uppercase tracking-[0.24em] ${muted}`}>
              全文 · {fill(t.libraryBookLines, { count: lineCount })}
            </p>
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
                  className={isVertical
                    ? 'mb-4 rounded-lg'
                    : `group/line flex items-baseline ${textAlign === 'center' ? 'justify-center text-center' : 'justify-start text-left'} mb-1 rounded-lg px-1 py-1.5 ${active ? 'bg-amber-400/15' : ''}`}
                >
                  {showLineNumbers && (
                    <span
                      data-testid="reader-line-number"
                      className={`select-none align-top tabular-nums ${muted} ${isVertical ? 'mr-1 inline-block text-[0.62em]' : 'mr-3 inline-block w-7 shrink-0 text-right text-[11px]'}`}
                    >
                      {globalLineIdx + 1}
                    </span>
                  )}
                  <span className="align-top" style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}>
                    {timecode && <span className={`mr-2 inline-block text-[0.62em] tracking-wide ${muted}`}>{timecode}</span>}
                    {speaker && (
                      <span className={`mr-2 inline-flex items-center rounded-md border px-1.5 py-0.5 align-middle text-[0.72em] font-medium tracking-wide ${muted}`}>
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
                      const authoritative = token.readingSource === 'manual' || token.readingSource === 'glossary' || token.readingSource === 'learned';
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
                          onKeyDown={interactive ? (event: ReactKeyboardEvent<HTMLElement>) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              activate();
                            }
                          } : undefined}
                          className={`${rubyMode === 'hidden' ? 'group ' : ''}${interactive ? 'ruby-interactive-token cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current' : ''}`}
                          onClick={() => {
                            if (!interactive) return;
                            activate();
                          }}
                        >
                          {surface}
                          {rubyMode !== 'omit' && (
                            <rt
                              className={`select-none leading-none ${emphasized ? 'font-semibold' : 'font-normal'} ${rubyMode === 'hidden' ? 'opacity-0 transition-opacity group-hover:opacity-100' : ''}`}
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

      {!isFullscreen && (
        <div className={`flex items-center justify-between gap-2 border-t px-3.5 py-1.5 text-[11px] md:px-5 ${muted}`}>
          <span>全文 · {fill(t.libraryBookLines, { count: lineCount })}</span>
          <span className="tabular-nums">{percent}%</span>
        </div>
      )}
    </section>
  );
}
