'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlassButton, GlassCapsule } from './glass/GlassButton';
import { GlassPopover, PopoverItem, PopoverSeparator } from './glass/GlassPopover';
import { LiquidSelector, type LiquidOption } from './glass/LiquidSelector';
import { useGlass } from './glass/hooks';
import {
  IconBooks,
  IconCheck,
  IconChevronDown,
  IconClose,
  IconEdit,
  IconGear,
  IconImport,
  IconLink,
  IconMore,
  IconPaste,
  IconPlus,
  IconRead,
  IconSearch,
  IconStar,
  IconStarFill,
  IconTrash,
} from './glass/icons';
import type { BookCategory, BookCoverTheme, BookItem, BookMetadataPatch } from '../utils/libraryDatabase';
import type { Translations } from '../utils/i18n';

export interface LibraryPanelProps {
  t: Translations;
  books: BookItem[];
  activeBookId: string | null;
  onOpenInReader: (book: BookItem) => void;
  onOpenInEditor: (book: BookItem) => void;
  onImportFiles: (files: FileList) => Promise<void>;
  onImportPixivNovel?: (urlOrId: string) => Promise<void>;
  onUpdateBookMetadata?: (bookId: string, patch: BookMetadataPatch) => void;
  onCreateOrUpdateBook: (input: { bookId?: string; title: string; author?: string; category?: BookCategory; coverTheme?: BookCoverTheme; content: string }) => void;
  onToggleFavorite: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  /** Retained so `app/page.tsx` keeps compiling; the backup & maintenance UI was removed. */
  onExportBackup?: () => void;
  /** Retained so `app/page.tsx` keeps compiling; the backup & maintenance UI was removed. */
  onImportBackup?: (file: File) => void | Promise<unknown>;
  onResetStarterBooks: () => void;
}

type LibrarySortMode = 'recent' | 'updated' | 'title';

const CATEGORIES: Array<BookCategory | 'all'> = ['all', 'script', 'novel', 'subtitle', 'other'];
const COMPOSER_CATEGORIES: BookCategory[] = ['script', 'novel', 'subtitle', 'other'];
const SORT_MODES: LibrarySortMode[] = ['recent', 'updated', 'title'];
const THEMES: BookCoverTheme[] = ['indigo', 'emerald', 'amber', 'rose', 'slate'];

/** Liquid Glass v2 typographic cover palette (Bunkobon & Daihon paper/cloth colours). */
const COVER_BG: Record<BookCoverTheme, string> = {
  indigo: '#26324A',
  emerald: '#4B5D3A',
  amber: '#9A4A28',
  rose: '#5B3550',
  slate: '#3D4450',
};

const COVER_TEXT_COLOR = '#F6F1E6';
const COVER_SPINE_SHADING =
  'linear-gradient(90deg, rgba(0,0,0,.22) 0, rgba(255,255,255,.14) 3%, rgba(0,0,0,.06) 6%, transparent 12%), linear-gradient(160deg, rgba(255,255,255,.12), transparent 40%)';
const COVER_SHADOW_REST = '0 1px 2px rgba(0,0,0,.12), 0 8px 20px -10px rgba(0,0,0,.35)';
const COVER_SHADOW_LIFTED = '0 2px 4px rgba(0,0,0,.12), 0 24px 40px -14px rgba(0,0,0,.5)';

interface BookDerivedMeta {
  contentRef: string;
  titleRef: string;
  authorRef: string;
  descRef: string;
  lines: number;
  haystack: string;
}

const bookDerivedCache = new WeakMap<BookItem, BookDerivedMeta>();

function lineCount(content: string): number {
  if (!content) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i += 1) {
    const code = content.charCodeAt(i);
    if (code === 10) {
      count += 1;
    } else if (code === 13) {
      count += 1;
      if (i + 1 < content.length && content.charCodeAt(i + 1) === 10) {
        i += 1;
      }
    }
  }
  return count;
}

function getBookDerivedMeta(book: BookItem): BookDerivedMeta {
  const desc = book.description ?? '';
  const cached = bookDerivedCache.get(book);
  if (
    cached &&
    cached.contentRef === book.content &&
    cached.titleRef === book.title &&
    cached.authorRef === book.author &&
    cached.descRef === desc
  ) {
    return cached;
  }
  const next: BookDerivedMeta = {
    contentRef: book.content,
    titleRef: book.title,
    authorRef: book.author,
    descRef: desc,
    lines: lineCount(book.content),
    haystack: `${book.title}\n${book.author}\n${desc}\n${book.content.slice(0, 96)}`.toLowerCase(),
  };
  bookDerivedCache.set(book, next);
  return next;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

async function resizeCoverImageToDataUrl(file: File, maxDimension = 600): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined') return rawDataUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width || maxDimension;
      const height = img.naturalHeight || img.height || maxDimension;
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export interface BookActionTrigger {
  bookId: string;
  point?: { x: number; y: number } | null;
  anchor?: HTMLElement | null;
}

interface BookShelfCardProps {
  book: BookItem;
  isActive: boolean;
  isMenuOpen: boolean;
  categoryLabelText: string;
  t: Translations;
  onOpenInReader: (book: BookItem) => void;
  onOpenActions: (trigger: BookActionTrigger) => void;
}

const LONG_PRESS_MS = 480;

const BookShelfCard = memo(function BookShelfCard({
  book,
  isActive,
  isMenuOpen,
  categoryLabelText,
  t,
  onOpenInReader,
  onOpenActions,
}: BookShelfCardProps) {
  const pressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const cancelPress = () => {
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
    pressOriginRef.current = null;
  };
  useEffect(() => cancelPress, []);

  const percent = Math.max(0, Math.min(100, Math.round(book.readingProgress.percentage)));
  const hasCoverImage = Boolean(book.coverUrl?.trim());
  const hasAuthor = Boolean(book.author?.trim());
  const isSubtitle = book.category === 'subtitle';
  const derived = getBookDerivedMeta(book);
  const coverBg = COVER_BG[book.coverTheme] ?? COVER_BG.indigo;

  return (
    <div className="group relative flex min-w-0 flex-col">
      <article
        data-testid="script-book-cover"
        role="button"
        tabIndex={0}
        aria-label={book.title}
        onClick={() => {
          if (longPressedRef.current) {
            longPressedRef.current = false;
            return;
          }
          onOpenInReader(book);
        }}
        onPointerDown={event => {
          longPressedRef.current = false;
          if (event.pointerType === 'mouse') return;
          const pt = { x: event.clientX, y: event.clientY };
          pressOriginRef.current = pt;
          pressTimerRef.current = window.setTimeout(() => {
            pressTimerRef.current = null;
            longPressedRef.current = true;
            onOpenActions({ bookId: book.bookId, point: pt });
          }, LONG_PRESS_MS);
        }}
        onPointerMove={event => {
          const origin = pressOriginRef.current;
          if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) cancelPress();
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={event => {
          event.preventDefault();
          if (!longPressedRef.current) {
            onOpenActions({ bookId: book.bookId, point: { x: event.clientX, y: event.clientY } });
          }
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenInReader(book);
          }
        }}
        style={{
          backgroundColor: coverBg,
          color: COVER_TEXT_COLOR,
          boxShadow: isMenuOpen ? COVER_SHADOW_LIFTED : COVER_SHADOW_REST,
          scale: isMenuOpen ? '1.05' : undefined,
          transition: 'scale 560ms var(--spring-bouncy), box-shadow 300ms',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        className={`relative aspect-[3/4.2] w-full cursor-pointer select-none overflow-hidden rounded-[4px_10px_10px_4px] outline-none active:scale-[0.96] active:duration-[140ms] focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
          isActive ? 'ring-2 ring-[var(--review)]' : ''
        }`}
      >
        {/* Solid theme colour fill layer */}
        <span
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundColor: coverBg }}
          aria-hidden
        />

        {hasCoverImage ? (
          <img
            src={book.coverUrl!.trim()}
            alt={book.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            data-testid="book-cover-image"
            className="absolute inset-0 z-[1] h-full w-full object-cover"
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 z-[1]" style={{ color: COVER_TEXT_COLOR }}>
            <span className="absolute left-4 top-4 text-[10px] font-bold tracking-[0.1em] opacity-70">
              {categoryLabelText}
            </span>
            {isSubtitle ? (
              <h4 className="absolute bottom-7 left-4 right-4 line-clamp-3 font-mono text-[15px] font-semibold leading-[1.35] tracking-normal">
                {book.title}
              </h4>
            ) : (
              <h4
                style={{ writingMode: 'vertical-rl', fontFamily: 'var(--font-mincho)' }}
                className="absolute top-4 right-4 max-h-[calc(100%-32px)] overflow-hidden text-[19px] font-semibold leading-[1.35] tracking-[0.08em]"
              >
                {book.title}
              </h4>
            )}
            {hasAuthor && (
              <p
                data-testid="book-cover-author"
                style={{ writingMode: 'vertical-rl', fontFamily: 'var(--font-mincho)' }}
                className="absolute bottom-4 left-[18px] max-h-[calc(100%-48px)] overflow-hidden text-[11px] tracking-[0.12em] opacity-[0.78]"
              >
                {book.author.trim()}
              </p>
            )}
          </div>
        )}

        {/* Spine shading overlay */}
        <span
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{ background: COVER_SPINE_SHADING }}
          aria-hidden
        />

        {/* Mouse / keyboard hover action trigger */}
        <div
          className={` absolute right-2 top-2 z-[3] transition-opacity duration-150 ${
            isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
          onClick={event => event.stopPropagation()}
        >
          <GlassButton
            icon
            variant="glass"
            data-testid="book-more-actions-btn"
            aria-label={t.libraryMoreActions}
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            className="!h-7 !w-7 rounded-full"
            onClick={event => {
              event.stopPropagation();
              onOpenActions({ bookId: book.bookId, anchor: event.currentTarget });
            }}
          >
            <IconMore size={16} />
          </GlassButton>
        </div>

        {/* Reading progress = 3px bar at the cover bottom */}
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[3px] bg-black/18"
        >
          <div className="h-full bg-white/85" style={{ width: `${percent}%` }} />
        </div>
      </article>

      {/* Under the cover: 1-line title + meta line */}
      <div className="mt-2.5 truncate text-[13px] font-semibold text-[var(--label)]" title={book.title}>
        {book.title}
      </div>
      <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[var(--label-2)]">
        {book.favorite && <IconStarFill size={12} className="shrink-0 text-[var(--review)]" aria-hidden />}
        <span className="truncate">
          {categoryLabelText} · {book.format.toUpperCase()} · {fill(t.libraryBookLines, { count: derived.lines })} · {fill(t.libraryBookProgress, { percent })}
        </span>
      </div>
    </div>
  );
});

export function LibraryPanel({
  t,
  books,
  activeBookId,
  onOpenInReader,
  onOpenInEditor,
  onImportFiles,
  onImportPixivNovel,
  onUpdateBookMetadata,
  onCreateOrUpdateBook,
  onToggleFavorite,
  onDeleteBook,
  onResetStarterBooks,
}: LibraryPanelProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const [sortBtnEl, setSortBtnEl] = useState<HTMLButtonElement | null>(null);
  const [newBtnEl, setNewBtnEl] = useState<HTMLButtonElement | null>(null);
  const searchGlassRef = useGlass<HTMLFormElement>();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BookCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<LibrarySortMode>('recent');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pixivOpen, setPixivOpen] = useState(false);
  const [pixivUrl, setPixivUrl] = useState('');
  const [isImportingPixiv, setIsImportingPixiv] = useState(false);
  const [pixivStatus, setPixivStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<BookActionTrigger | null>(null);
  const [draft, setDraft] = useState({
    title: '',
    author: '',
    category: 'script' as BookCategory,
    coverTheme: 'indigo' as BookCoverTheme,
    content: '',
  });
  const [editingMetaBookId, setEditingMetaBookId] = useState<string | null>(null);
  const [metaDraft, setMetaDraft] = useState<{
    title: string;
    author: string;
    description: string;
    coverUrl: string;
    coverTheme: BookCoverTheme;
  }>({
    title: '',
    author: '',
    description: '',
    coverUrl: '',
    coverTheme: 'indigo',
  });

  const categoryLabel: Record<BookCategory | 'all', string> = useMemo(
    () => ({
      all: t.libraryCategoryAll,
      script: t.libraryCategoryScript,
      novel: t.libraryCategoryNovel,
      subtitle: t.libraryCategorySubtitle,
      other: t.libraryCategoryOther,
    }),
    [t.libraryCategoryAll, t.libraryCategoryNovel, t.libraryCategoryOther, t.libraryCategoryScript, t.libraryCategorySubtitle],
  );

  const sortLabel: Record<LibrarySortMode, string> = useMemo(
    () => ({
      recent: t.librarySortRecent,
      updated: t.librarySortUpdated,
      title: t.librarySortTitle,
    }),
    [t.librarySortRecent, t.librarySortTitle, t.librarySortUpdated],
  );

  const categoryOptions = useMemo<Array<LiquidOption<BookCategory | 'all'>>>(
    () => CATEGORIES.map(item => ({ value: item, label: categoryLabel[item] })),
    [categoryLabel],
  );

  const composerCategoryOptions = useMemo<Array<LiquidOption<BookCategory>>>(
    () => COMPOSER_CATEGORIES.map(item => ({ value: item, label: categoryLabel[item] })),
    [categoryLabel],
  );

  const actionBookId = actionMenu?.bookId ?? null;
  const actionBook = actionBookId ? books.find(book => book.bookId === actionBookId) ?? null : null;
  const deleteBook = confirmDeleteId ? books.find(book => book.bookId === confirmDeleteId) ?? null : null;

  const closeActionMenu = useCallback(() => {
    setActionMenu(null);
  }, []);

  useEffect(() => {
    if (!actionBookId && !confirmDeleteId && !editingMetaBookId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActionMenu(null);
      setConfirmDeleteId(null);
      setEditingMetaBookId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionBookId, confirmDeleteId, editingMetaBookId]);

  const hasActiveFilter = Boolean(query.trim()) || category !== 'all' || favoritesOnly;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return books
      .filter(book => category === 'all' || book.category === category)
      .filter(book => !favoritesOnly || book.favorite)
      .filter(book => {
        if (!needle) return true;
        return getBookDerivedMeta(book).haystack.includes(needle);
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title, 'ja');
        }
        if (sortBy === 'updated') {
          return b.updatedAt - a.updatedAt;
        }
        return (b.lastReadAt || b.updatedAt) - (a.lastReadAt || a.updatedAt);
      });
  }, [books, category, favoritesOnly, query, sortBy]);

  const importBooks = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      await onImportFiles(list);
    } finally {
      setBusy(false);
    }
  };

  const handlePixivImportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = pixivUrl.trim();
    if (!target || !onImportPixivNovel || isImportingPixiv) return;
    setIsImportingPixiv(true);
    setPixivStatus(null);
    try {
      await onImportPixivNovel(target);
      setPixivUrl('');
      setPixivStatus({ type: 'success', message: t.libPixivImportSuccess });
    } catch (error) {
      const detail = error instanceof Error && error.message ? `：${error.message}` : '';
      setPixivStatus({ type: 'error', message: `${t.libPixivImportError}${detail}` });
    } finally {
      setIsImportingPixiv(false);
    }
  };

  const openMetaModal = useCallback((book: BookItem) => {
    setEditingMetaBookId(book.bookId);
    setMetaDraft({
      title: book.title,
      author: book.author ?? '',
      description: book.description ?? '',
      coverUrl: book.coverUrl ?? '',
      coverTheme: book.coverTheme,
    });
  }, []);

  const closeMetaModal = () => {
    setEditingMetaBookId(null);
  };

  const saveMetaModal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingMetaBookId) return;
    const targetBook = books.find(item => item.bookId === editingMetaBookId);
    const nextTitle = metaDraft.title.trim() || targetBook?.title || t.untitledScript;
    const patch: BookMetadataPatch = {
      title: nextTitle,
      author: metaDraft.author.trim(),
      description: metaDraft.description.trim(),
      coverUrl: metaDraft.coverUrl.trim(),
      coverTheme: metaDraft.coverTheme,
    };
    if (onUpdateBookMetadata) {
      onUpdateBookMetadata(editingMetaBookId, patch);
    } else if (targetBook) {
      onCreateOrUpdateBook({
        bookId: targetBook.bookId,
        title: nextTitle,
        author: patch.author,
        category: targetBook.category,
        coverTheme: metaDraft.coverTheme,
        content: targetBook.content,
      });
    }
    setEditingMetaBookId(null);
  };

  const handleCoverUpload = async (file: File | undefined) => {
    if (!file) return;
    const resizedDataUrl = await resizeCoverImageToDataUrl(file, 600);
    if (resizedDataUrl) {
      setMetaDraft(current => ({ ...current, coverUrl: resizedDataUrl }));
    }
  };

  const saveDraft = () => {
    const title = draft.title.trim();
    const content = draft.content.replace(/\r\n?/g, '\n');
    if (!title || !content.trim()) return;
    onCreateOrUpdateBook({
      title,
      author: draft.author.trim() || undefined,
      category: draft.category,
      coverTheme: draft.coverTheme,
      content,
    });
    setDraft({ title: '', author: '', category: 'script', coverTheme: 'indigo', content: '' });
    setComposerOpen(false);
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setFavoritesOnly(false);
  };

  return (
    <section className="relative flex-1 flex flex-col gap-4 pb-24 md:pb-6">
      {/* Hidden file input for book imports */}
      <input
        ref={importRef}
        type="file"
        accept=".txt,.md,.markdown,.srt,.vtt,.docx,text/plain,text/markdown,application/x-subrip,text/vtt,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        className="hidden"
        onChange={event => {
          void importBooks(event.target.files);
          event.target.value = '';
        }}
      />

      {/* Soft scroll-edge blur behind the floating toolbar */}
      <div className="scroll-edge pointer-events-none sticky top-0 z-10 -mx-2 -mb-14 h-16" aria-hidden />

      {/* Rule 4: Floating toolbar row */}
      <div className="sticky top-[max(10px,env(safe-area-inset-top))] z-20 flex flex-wrap items-center gap-2.5 pointer-events-none">
        {/* Desktop search capsule (~230px) */}
        <form
          ref={searchGlassRef}
          role="search"
          onSubmit={event => event.preventDefault()}
          className="glass pointer-events-auto hidden md:inline-flex h-[42px] w-[230px] items-center gap-2 rounded-full px-3.5 text-[var(--label-2)]"
        >
          <IconSearch size={18} className="shrink-0 text-[var(--label-2)]" />
          <input
            type="search"
            value={query}
            placeholder={t.librarySearchPlaceholder}
            aria-label={t.librarySearchPlaceholder}
            onChange={event => setQuery(event.target.value)}
            className="w-full min-w-0 border-0 bg-transparent text-sm text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
          />
        </form>

        {/* Desktop category LiquidSelector (variant="glass") */}
        <LiquidSelector
          variant="glass"
          options={categoryOptions}
          value={category}
          onChange={setCategory}
          ariaLabel={t.libraryTab}
          className="pointer-events-auto hidden md:inline-flex h-[42px]"
        />

        {/* Sort + Favorites GlassCapsule (right-aligned on phones, left-grouped on desktop) */}
        <GlassCapsule className="pointer-events-auto ml-auto md:ml-0">
          <GlassButton
            ref={setSortBtnEl}
            aria-haspopup="dialog"
            aria-expanded={sortMenuOpen}
            aria-label={sortLabel[sortBy]}
            onClick={() => setSortMenuOpen(open => !open)}
          >
            <span>{sortLabel[sortBy]}</span>
            <IconChevronDown size={14} />
          </GlassButton>
          <GlassButton
            icon
            aria-pressed={favoritesOnly}
            aria-label={t.libraryFilterFavorites}
            title={t.libraryFilterFavorites}
            style={{ color: favoritesOnly ? 'var(--review)' : undefined }}
            onClick={() => setFavoritesOnly(current => !current)}
          >
            {favoritesOnly ? <IconStarFill size={18} /> : <IconStar size={18} />}
          </GlassButton>
        </GlassCapsule>

        {/* Spacer pushing "+" New button to the right on desktop */}
        <div className="hidden md:block md:flex-1 pointer-events-none" />

        {/* Right: Prominent "+" New GlassButton */}
        <GlassButton
          ref={setNewBtnEl}
          variant="prominent"
          aria-haspopup="dialog"
          aria-expanded={newMenuOpen}
          aria-label={t.libraryNewBook}
          className="pointer-events-auto h-[42px] px-4 rounded-full"
          onClick={() => setNewMenuOpen(open => !open)}
        >
          <IconPlus size={18} />
          <span>{t.libraryNewBook}</span>
        </GlassButton>
      </div>

      {/* Phones (< md): large title "台本库" above full-width search + solid LiquidSelector */}
      <div className="md:hidden flex flex-col gap-2.5">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em] text-[var(--label)]">
          {t.libraryTitle}
        </h1>
        <form
          role="search"
          onSubmit={event => event.preventDefault()}
          className="flex h-[42px] w-full items-center gap-2 rounded-full bg-[var(--fill)] px-3.5 text-[var(--label-2)]"
        >
          <IconSearch size={18} className="shrink-0 text-[var(--label-2)]" />
          <input
            type="search"
            value={query}
            placeholder={t.librarySearchPlaceholder}
            aria-label={t.librarySearchPlaceholder}
            onChange={event => setQuery(event.target.value)}
            className="w-full min-w-0 border-0 bg-transparent text-sm text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
          />
        </form>
        <LiquidSelector
          variant="solid"
          options={categoryOptions}
          value={category}
          onChange={setCategory}
          ariaLabel={t.libraryTab}
          className="self-start max-w-full overflow-x-auto no-scrollbar"
        />
      </div>

      {/* Sort GlassPopover */}
      <GlassPopover
        open={sortMenuOpen}
        onClose={() => setSortMenuOpen(false)}
        anchor={sortBtnEl}
        ariaLabel={sortLabel[sortBy]}
      >
        {SORT_MODES.map(mode => {
          const active = sortBy === mode;
          return (
            <PopoverItem
              key={mode}
              aria-pressed={active}
              icon={active ? <IconCheck size={18} /> : <span className="inline-block w-[18px]" />}
              onClick={() => {
                setSortBy(mode);
                setSortMenuOpen(false);
              }}
            >
              {sortLabel[mode]}
            </PopoverItem>
          );
        })}
      </GlassPopover>

      {/* "+" New GlassPopover */}
      <GlassPopover
        open={newMenuOpen}
        onClose={() => setNewMenuOpen(false)}
        anchor={newBtnEl}
        ariaLabel={t.libraryNewBook}
      >
        <PopoverItem
          icon={<IconImport size={18} />}
          detail="TXT · DOCX · SRT"
          disabled={busy}
          onClick={() => {
            setNewMenuOpen(false);
            importRef.current?.click();
          }}
        >
          {t.libraryImportBook}
        </PopoverItem>
        <PopoverItem
          data-testid="pixiv-import-toggle-btn"
          aria-expanded={pixivOpen}
          icon={<IconLink size={18} />}
          onClick={() => {
            setNewMenuOpen(false);
            setPixivOpen(open => !open);
            setPixivStatus(null);
          }}
        >
          {t.libPixivImportBtn}
        </PopoverItem>
        <PopoverItem
          aria-expanded={composerOpen}
          icon={<IconPaste size={18} />}
          onClick={() => {
            setNewMenuOpen(false);
            setComposerOpen(open => !open);
          }}
        >
          {t.libraryNewBook}
        </PopoverItem>
      </GlassPopover>

      {/* Inline Pixiv URL import panel (solid card) */}
      {pixivOpen && (
        <form
          onSubmit={event => {
            void handlePixivImportSubmit(event);
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 rounded-[24px] bg-[var(--surface)] p-3.5 sm:p-4 shadow-[var(--card-shadow)]"
        >
          <input
            type="text"
            data-testid="pixiv-url-input"
            value={pixivUrl}
            disabled={isImportingPixiv}
            placeholder={t.libPixivInputPlaceholder}
            aria-label={t.libPixivInputPlaceholder}
            onChange={event => setPixivUrl(event.target.value)}
            className="min-h-10 flex-1 rounded-xl border-0 bg-[var(--fill-2)] px-3.5 text-sm text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPixivOpen(false);
                setPixivStatus(null);
              }}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              data-testid="pixiv-import-submit-btn"
              disabled={isImportingPixiv || !pixivUrl.trim()}
              className="btn btn-ink shrink-0 disabled:opacity-40"
            >
              {isImportingPixiv ? t.libPixivFetching : t.libPixivFetchBtn}
            </button>
          </div>
          {pixivStatus && (
            <span
              role="status"
              style={{ color: pixivStatus.type === 'success' ? 'var(--ok)' : 'var(--danger)' }}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--fill-2)]"
            >
              {pixivStatus.message}
            </span>
          )}
        </form>
      )}

      {/* Inline New / Paste composer modal card (solid surface) */}
      {composerOpen && (
        <form
          className="grid gap-3.5 rounded-[26px] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--card-shadow)]"
          onSubmit={event => {
            event.preventDefault();
            saveDraft();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="min-h-10 rounded-xl border-0 bg-[var(--fill-2)] px-3.5 text-sm text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
              value={draft.title}
              aria-label={t.scriptTitlePlaceholder}
              placeholder={t.scriptTitlePlaceholder}
              onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
              required
            />
            <input
              className="min-h-10 rounded-xl border-0 bg-[var(--fill-2)] px-3.5 text-sm text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
              value={draft.author}
              aria-label={t.libraryBookAuthorPlaceholder}
              placeholder={t.libraryBookAuthorPlaceholder}
              onChange={event => setDraft(current => ({ ...current, author: event.target.value }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <LiquidSelector
              variant="solid"
              role="radiogroup"
              ariaLabel={t.libraryTab}
              options={composerCategoryOptions}
              value={draft.category}
              onChange={cat => setDraft(current => ({ ...current, category: cat }))}
            />
            <span className="mx-1 h-5 w-px bg-[var(--sep)]" aria-hidden />
            <div className="flex items-center gap-2">
              {THEMES.map(theme => (
                <button
                  key={theme}
                  type="button"
                  aria-label={theme}
                  aria-pressed={draft.coverTheme === theme}
                  style={{ backgroundColor: COVER_BG[theme] }}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    draft.coverTheme === theme
                      ? 'scale-110 ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  onClick={() => setDraft(current => ({ ...current, coverTheme: theme }))}
                />
              ))}
            </div>
          </div>
          <textarea
            className="min-h-36 rounded-xl border-0 bg-[var(--fill-2)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
            value={draft.content}
            aria-label={t.inputPlaceholder}
            placeholder={t.inputPlaceholder}
            onChange={event => setDraft(current => ({ ...current, content: event.target.value }))}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setComposerOpen(false)}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-ink" disabled={!draft.title.trim() || !draft.content.trim()}>
              {t.save}
            </button>
          </div>
        </form>
      )}

      {/* Shelf or Empty State */}
      {visible.length === 0 ? (
        <div className="grid min-h-[52vh] place-items-center py-12 text-center text-sm text-[var(--label-2)]">
          <div>
            <IconBooks size={46} strokeWidth={1.4} className="mx-auto text-[var(--label-3)]" />
            {books.length === 0 ? (
              <>
                <h3 className="mt-3.5 mb-1.5 text-[20px] font-semibold text-[var(--label)]">{t.libraryTitle}</h3>
                <p className="mx-auto mb-4 max-w-[280px] leading-relaxed text-[var(--label-2)]">{t.libraryEmptyState}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ink"
                    onClick={() => importRef.current?.click()}
                  >
                    <IconImport size={18} />
                    <span>{t.libraryImportBook}</span>
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPixivOpen(true);
                      setPixivStatus(null);
                    }}
                  >
                    <IconLink size={18} />
                    <span>{t.libPixivImportBtn}</span>
                  </button>
                  <button type="button" className="btn" onClick={onResetStarterBooks}>
                    {t.libraryResetStarterBooks}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mx-auto mt-3.5 mb-4 max-w-[280px] leading-relaxed text-[var(--label-2)]">
                  {t.libraryEmptyState}
                </p>
                {hasActiveFilter && (
                  <div className="flex justify-center">
                    <button type="button" className="btn btn-ink" onClick={resetFilters}>
                      {t.libraryResetFilters}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          data-testid="apple-books-shelf"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-7 pt-1.5 pb-8"
        >
          {visible.map(book => (
            <BookShelfCard
              key={book.bookId}
              book={book}
              isActive={activeBookId === book.bookId}
              isMenuOpen={actionBookId === book.bookId}
              categoryLabelText={categoryLabel[book.category]}
              t={t}
              onOpenInReader={onOpenInReader}
              onOpenActions={setActionMenu}
            />
          ))}
        </div>
      )}

      {/* Book Context Menu GlassPopover */}
      <GlassPopover
        open={Boolean(actionBook)}
        onClose={closeActionMenu}
        point={actionMenu?.point ?? null}
        anchor={actionMenu?.anchor ?? null}
        ariaLabel={actionBook?.title}
      >
        {actionBook && (
          <>
            <PopoverItem
              icon={<IconRead size={18} />}
              onClick={() => {
                const target = actionBook;
                closeActionMenu();
                onOpenInReader(target);
              }}
            >
              {actionBook.lastReadAt > 0 || actionBook.readingProgress.percentage > 0
                ? t.libraryContinueReading
                : t.libraryStartReading}
            </PopoverItem>
            <PopoverItem
              icon={<IconEdit size={18} />}
              onClick={() => {
                const target = actionBook;
                closeActionMenu();
                onOpenInEditor(target);
              }}
            >
              {t.libraryEditInStudio}
            </PopoverItem>
            <PopoverItem
              icon={
                actionBook.favorite ? (
                  <IconStarFill size={18} className="text-[var(--review)]" />
                ) : (
                  <IconStar size={18} />
                )
              }
              onClick={() => {
                const targetId = actionBook.bookId;
                closeActionMenu();
                onToggleFavorite(targetId);
              }}
            >
              {actionBook.favorite ? t.libraryRemoveFavorite : t.libraryAddFavorite}
            </PopoverItem>
            <PopoverItem
              data-testid="book-settings-gear-btn"
              icon={<IconGear size={18} />}
              onClick={() => {
                const target = actionBook;
                closeActionMenu();
                openMetaModal(target);
              }}
            >
              {t.libEditMetaAction}
            </PopoverItem>
            <PopoverSeparator />
            <PopoverItem
              danger
              icon={<IconTrash size={18} />}
              onClick={() => {
                const targetId = actionBook.bookId;
                closeActionMenu();
                setConfirmDeleteId(targetId);
              }}
            >
              {t.delete}
            </PopoverItem>
          </>
        )}
      </GlassPopover>

      {/* Two-step Delete Confirm Dialog (centred solid sheet) */}
      {deleteBook && (
        <div
          data-testid="book-delete-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="book-delete-title"
          aria-describedby="book-delete-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6 backdrop-blur-[2px]"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            onClick={event => event.stopPropagation()}
            className="w-full max-w-xs rounded-[26px] bg-[var(--surface)] p-5 text-center shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] flex flex-col gap-4"
          >
            <div>
              <h3 id="book-delete-title" className="font-semibold text-base text-[var(--label)]">
                {t.libraryDeleteBookTitle}
              </h3>
              <p id="book-delete-desc" className="mt-1.5 text-[13px] leading-relaxed text-[var(--label-2)]">
                {t.libraryDeleteBookConfirm.replace('{title}', deleteBook.title)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                autoFocus
                className="btn h-11 justify-center"
                onClick={() => setConfirmDeleteId(null)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                className="btn btn-danger h-11 justify-center font-semibold"
                onClick={() => {
                  const book = deleteBook;
                  setConfirmDeleteId(null);
                  onDeleteBook(book.bookId);
                }}
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Info & Category Modal (solid surface) */}
      {editingMetaBookId && (
        <div
          data-testid="book-meta-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t.libEditMetaTitle}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25 p-0 sm:p-4 backdrop-blur-[2px]"
          onClick={closeMetaModal}
        >
          <form
            onClick={event => event.stopPropagation()}
            onSubmit={saveMetaModal}
            className="w-full max-w-lg max-sm:rounded-t-[30px] max-sm:rounded-b-none sm:rounded-[30px] bg-[var(--surface)] p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="mx-auto -mt-1.5 mb-0.5 h-1.5 w-10 rounded-full bg-[var(--label-3)] sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-[var(--sep)] pb-3">
              <h3 className="font-semibold text-base sm:text-lg text-[var(--label)]">{t.libEditMetaTitle}</h3>
              <button
                type="button"
                aria-label={t.libMetaCancel}
                onClick={closeMetaModal}
                className="btn !h-8 !w-8 !p-0 justify-center rounded-full"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[120px_1fr] items-start">
              {/* Typographic cover preview (retains book-cover-author & book-cover-description testids) */}
              <div className="mx-auto sm:mx-0 w-28">
                <div
                  style={{
                    backgroundColor: COVER_BG[metaDraft.coverTheme] ?? COVER_BG.indigo,
                    color: COVER_TEXT_COLOR,
                    boxShadow: COVER_SHADOW_REST,
                  }}
                  className="relative flex aspect-[3/4.2] w-full flex-col overflow-hidden rounded-[4px_10px_10px_4px]"
                >
                  {Boolean(metaDraft.coverUrl.trim()) && (
                    <img
                      src={metaDraft.coverUrl.trim()}
                      alt={metaDraft.title || t.untitledScript}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 z-[1] h-full w-full object-cover"
                    />
                  )}
                  <span
                    className="pointer-events-none absolute inset-0 z-[2]"
                    style={{ background: COVER_SPINE_SHADING }}
                    aria-hidden
                  />
                  {!metaDraft.coverUrl.trim() && (
                    <div className="relative z-[3] flex flex-1 flex-col p-2.5 pl-3.5" style={{ color: COVER_TEXT_COLOR }}>
                      <h4
                        style={{ fontFamily: 'var(--font-mincho)' }}
                        className="mt-1 line-clamp-3 font-semibold text-[11px] leading-snug"
                      >
                        {metaDraft.title.trim() || t.untitledScript}
                      </h4>
                      {Boolean(metaDraft.author.trim()) && (
                        <p
                          data-testid="book-cover-author"
                          style={{ fontFamily: 'var(--font-mincho)' }}
                          className="mt-0.5 line-clamp-1 text-[9px] opacity-80"
                        >
                          {metaDraft.author.trim()}
                        </p>
                      )}
                      {Boolean(metaDraft.description.trim()) && (
                        <p
                          data-testid="book-cover-description"
                          className="mt-1 line-clamp-2 text-[8px] leading-tight opacity-75"
                        >
                          {metaDraft.description.trim()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-[var(--label-2)]">
                  <span>{t.libMetaBookTitle}</span>
                  <input
                    type="text"
                    data-testid="book-meta-title-input"
                    value={metaDraft.title}
                    onChange={event => setMetaDraft(current => ({ ...current, title: event.target.value }))}
                    className="min-h-10 rounded-xl border-0 bg-[var(--fill-2)] px-3.5 text-sm text-[var(--label)] outline-none"
                    required
                  />
                </label>

                <label className="grid gap-1 text-xs font-medium text-[var(--label-2)]">
                  <span>{t.libMetaAuthor}</span>
                  <input
                    type="text"
                    data-testid="book-meta-author-input"
                    value={metaDraft.author}
                    placeholder={t.libMetaAuthorPlaceholder}
                    onChange={event => setMetaDraft(current => ({ ...current, author: event.target.value }))}
                    className="min-h-10 rounded-xl border-0 bg-[var(--fill-2)] px-3.5 text-sm text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
                  />
                </label>
              </div>
            </div>

            <label className="grid gap-1 text-xs font-medium text-[var(--label-2)]">
              <span>{t.libMetaDescription}</span>
              <textarea
                data-testid="book-meta-description-input"
                value={metaDraft.description}
                placeholder={t.libMetaDescriptionPlaceholder}
                onChange={event => setMetaDraft(current => ({ ...current, description: event.target.value }))}
                rows={3}
                className="rounded-xl border-0 bg-[var(--fill-2)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
              />
            </label>

            <div className="grid gap-2 text-xs font-medium text-[var(--label-2)]">
              <span>{t.libMetaCover}</span>
              <input
                type="text"
                data-testid="book-meta-cover-url-input"
                value={metaDraft.coverUrl}
                placeholder={t.libMetaCoverUrlPlaceholder}
                onChange={event => setMetaDraft(current => ({ ...current, coverUrl: event.target.value }))}
                className="min-h-10 rounded-xl border-0 bg-[var(--fill-2)] px-3.5 text-sm text-[var(--label)] placeholder:text-[var(--label-3)] outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={coverUploadRef}
                  type="file"
                  accept="image/*"
                  data-testid="book-meta-cover-file-input"
                  className="hidden"
                  onChange={event => {
                    void handleCoverUpload(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  data-testid="book-meta-cover-upload-btn"
                  className="btn text-xs"
                  onClick={() => coverUploadRef.current?.click()}
                >
                  {t.libMetaCoverUpload}
                </button>
                {Boolean(metaDraft.coverUrl.trim()) && (
                  <button
                    type="button"
                    data-testid="book-meta-cover-clear-btn"
                    className="btn btn-danger text-xs"
                    onClick={() => setMetaDraft(current => ({ ...current, coverUrl: '' }))}
                  >
                    {t.libMetaCoverClear}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs font-medium text-[var(--label-2)]">{t.libMetaTheme}</span>
              <div className="flex items-center gap-2">
                {THEMES.map(theme => (
                  <button
                    key={theme}
                    type="button"
                    aria-label={theme}
                    aria-pressed={metaDraft.coverTheme === theme}
                    style={{ backgroundColor: COVER_BG[theme] }}
                    className={`h-7 w-7 rounded-full transition-transform ${
                      metaDraft.coverTheme === theme
                        ? 'scale-110 ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    onClick={() => setMetaDraft(current => ({ ...current, coverTheme: theme }))}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--sep)] pt-3">
              <button
                type="button"
                data-testid="book-meta-cancel-btn"
                className="btn"
                onClick={closeMetaModal}
              >
                {t.libMetaCancel}
              </button>
              <button
                type="submit"
                data-testid="book-meta-save-btn"
                className="btn btn-ink"
              >
                {t.libMetaSave}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
