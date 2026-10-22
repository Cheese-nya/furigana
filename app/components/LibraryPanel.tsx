'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { badgeClass, buttonActiveClass, buttonClass, inputClass } from './uiTokens';
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
const SORT_MODES: LibrarySortMode[] = ['recent', 'updated', 'title'];
const THEMES: BookCoverTheme[] = ['indigo', 'emerald', 'amber', 'rose', 'slate'];

/** Apple Books signature colour band: woven silk / satin ribbon gradients, one per script theme. */
const COVER_BAND: Record<BookCoverTheme, string> = {
  indigo: 'bg-gradient-to-r from-[#3b4d6b] via-[#506a92] to-[#31425c] book-silk-band book-silk-indigo',
  emerald: 'bg-gradient-to-r from-[#2c4a3e] via-[#3d6757] to-[#233c31] book-silk-band book-silk-emerald',
  amber: 'bg-gradient-to-r from-[#5a4d3c] via-[#7a674e] to-[#493e30] book-silk-band book-silk-amber',
  rose: 'bg-gradient-to-r from-[#6b3e3e] via-[#8d5454] to-[#583232] book-silk-band book-silk-rose',
  slate: 'bg-gradient-to-r from-[#3f3f46] via-[#595963] to-[#323238] book-silk-band book-silk-slate',
};

/** Solid accent used by the slim reading progress bar. */
const COVER_BAR: Record<BookCoverTheme, string> = {
  indigo: 'bg-[#3b4d6b]',
  emerald: 'bg-[#2c4a3e]',
  amber: 'bg-[#5a4d3c]',
  rose: 'bg-[#6b3e3e]',
  slate: 'bg-[#3f3f46]',
};

const GLASS_PANEL =
  'lg-container liquid-glass-panel backdrop-blur-2xl bg-white/75 dark:bg-[#161924]/82 border border-white/70 dark:border-white/10 rounded-3xl shadow-[0_12px_36px_-10px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_18px_42px_-10px_rgba(0,0,0,0.6),inset_0_1px_0.5px_rgba(255,255,255,0.12)]';

const CAPSULE_TRACK =
  'inline-flex flex-wrap items-center gap-0.5 rounded-full border border-white/80 dark:border-white/10 bg-zinc-900/[0.04] dark:bg-[#0d1018]/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]';

const CAPSULE_PILL_ACTIVE =
  'lg-pill-interactive bg-zinc-900 text-white dark:bg-indigo-500/25 dark:text-indigo-100 dark:ring-1 dark:ring-indigo-400/30 shadow-[0_4px_12px_-2px_rgba(15,23,42,0.25)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.45)]';

const CAPSULE_PILL_IDLE =
  'lg-pill-interactive text-zinc-600 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-slate-100 hover:bg-white/65 dark:hover:bg-white/[0.06]';

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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11 5.52.44a.56.56 0 01.32.99l-4.2 3.6 1.28 5.39a.56.56 0 01-.84.6L12 16.96l-4.73 2.67a.56.56 0 01-.84-.6l1.28-5.39-4.2-3.6a.56.56 0 01.32-.99l5.52-.44 2.13-5.11z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.25A2.25 2.25 0 016.25 3h5.25v16.5H6.25A2.25 2.25 0 004 21.75V5.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 5.25A2.25 2.25 0 0017.75 3h-5.25v16.5h5.25A2.25 2.25 0 0120 21.75V5.25z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L8.25 19.5 4.5 20.25l.75-3.75L16.862 4.487z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12M9.75 7.5V6a1.5 1.5 0 011.5-1.5h1.5A1.5 1.5 0 0114.25 6v1.5M7.5 7.5l.75 11.25a1.5 1.5 0 001.5 1.4h4.5a1.5 1.5 0 001.5-1.4L16.5 7.5" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="5.5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="18.5" cy="12" r="1.75" />
    </svg>
  );
}

interface BookShelfCardProps {
  book: BookItem;
  isActive: boolean;
  categoryLabelText: string;
  t: Translations;
  onOpenInReader: (book: BookItem) => void;
  onOpenInEditor: (book: BookItem) => void;
  onOpenMetaModal: (book: BookItem) => void;
  onToggleFavorite: (bookId: string) => void;
  onRequestDelete: (bookId: string) => void;
  onOpenActions: (bookId: string) => void;
}

const LONG_PRESS_MS = 480;

const BookShelfCard = memo(function BookShelfCard({
  book,
  isActive,
  categoryLabelText,
  t,
  onOpenInReader,
  onOpenInEditor,
  onOpenMetaModal,
  onToggleFavorite,
  onRequestDelete,
  onOpenActions,
}: BookShelfCardProps) {
  // Touch devices have no hover, so a long press (or the ⋯ button) opens the action sheet.
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
  const started = percent > 0 || book.lastReadAt > 0;
  const hasCoverImage = Boolean(book.coverUrl?.trim());
  const hasAuthor = Boolean(book.author?.trim());
  const hasDescription = Boolean(book.description?.trim());
  const derived = getBookDerivedMeta(book);

  return (
    <div className="group relative flex flex-col pb-5 sm:pb-7">
      <article
        data-testid="script-book-cover"
        data-leather-theme={book.coverTheme}
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
          pressOriginRef.current = { x: event.clientX, y: event.clientY };
          pressTimerRef.current = window.setTimeout(() => {
            pressTimerRef.current = null;
            longPressedRef.current = true;
            onOpenActions(book.bookId);
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
          if (!longPressedRef.current) onOpenActions(book.bookId);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenInReader(book);
          }
        }}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        className={`book-leather-cover book-leather-${book.coverTheme} book-leather-theme-${book.coverTheme} relative flex aspect-[3/4.2] w-full cursor-pointer flex-col overflow-hidden rounded-l-[3px] rounded-r-[7px] bg-gradient-to-b from-white to-[#faf9f5] dark:from-[#242a3c] dark:to-[#141824] outline-none shadow-[0_10px_24px_-6px_rgba(0,0,0,0.14),2px_0_0_0_#fafaf9,4px_0_0_0_#e4e4e7] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.68),2px_0_0_0_#333a4d,4px_0_0_0_#2b3142] transition-all duration-300 ease-out group-hover:-translate-y-2.5 group-hover:scale-[1.03] group-hover:-rotate-[0.6deg] group-hover:shadow-[0_20px_38px_-10px_rgba(0,0,0,0.22),2px_0_0_0_#fafaf9,4px_0_0_0_#e4e4e7] dark:group-hover:shadow-[0_24px_46px_-8px_rgba(0,0,0,0.78),2px_0_0_0_#3d455c,4px_0_0_0_#333a4d] focus-visible:ring-2 focus-visible:ring-amber-300/80 ${isActive ? 'ring-2 ring-amber-300/90' : ''}`}
      >
        <span
          data-testid="book-leather-grain"
          className="book-leather-grain pointer-events-none absolute inset-0 z-[1]"
          aria-hidden
        />
        <span
          data-testid="book-leather-sheen"
          className="book-leather-sheen pointer-events-none absolute inset-0 z-[2]"
          aria-hidden
        />
        <span
          data-testid="book-leather-frame"
          className="book-leather-frame top-5 bottom-2.5 left-4 right-2.5 rounded-r-[6px] rounded-l-[2px] pointer-events-none absolute z-[3]"
          aria-hidden
        />

        {hasCoverImage && (
          <>
            <img
              src={book.coverUrl!.trim()}
              alt={book.title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              data-testid="book-cover-image"
              className="absolute inset-0 z-[4] w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[48%] bg-gradient-to-t from-black/90 via-black/60 to-transparent"
              aria-hidden
            />
          </>
        )}

        <div
          data-testid="book-cover-color-band"
          className={`book-silk-band relative z-10 h-3.5 w-full shrink-0 ${COVER_BAND[book.coverTheme]}`}
          aria-hidden
        />
        <span
          className="book-3d-spine-groove pointer-events-none absolute inset-y-0 left-0 z-20 w-3.5 bg-gradient-to-r from-black/12 via-white/30 to-transparent"
          aria-hidden
        />

        <button
          type="button"
          aria-pressed={book.favorite}
          aria-label={t.libraryFilterFavorites}
          className={`book-action-btn absolute right-2 top-2 sm:right-2.5 sm:top-2.5 z-20 grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-black/[0.06] transition-colors ${
            book.favorite
              ? 'bg-white text-amber-400 opacity-100'
              : `bg-white/90 text-zinc-400 hover:text-amber-500 ${hasCoverImage ? 'opacity-0 group-hover:opacity-100' : ''}`
          }`}
          onClick={event => {
            event.stopPropagation();
            onToggleFavorite(book.bookId);
          }}
        >
          <StarIcon filled={book.favorite} />
        </button>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col p-2.5 sm:p-3.5 pl-4.5 sm:pl-5.5 pr-3 sm:pr-3.5">
          <div className={`flex flex-wrap items-center gap-1 pr-6 sm:pr-7 ${hasCoverImage ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-200' : ''}`}>
            <span className={`${badgeClass} book-cover-badge px-1.5 py-0.5 text-[8px] sm:text-[9px] leading-none`}>{categoryLabelText}</span>
            <span className={`${badgeClass} book-cover-badge px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold uppercase leading-none tracking-wide`}>{book.format.toUpperCase()}</span>
          </div>

          {!hasCoverImage && (
            <>
              <h4
                className="book-leather-title mt-1.5 sm:mt-2 max-sm:line-clamp-2 max-sm:text-[12.5px] max-sm:leading-[1.3] line-clamp-3 font-semibold text-sm sm:text-base text-[#1d1d1f] tracking-tight leading-snug"
              >
                {book.title}
              </h4>
              {hasAuthor && (
                <p
                  data-testid="book-cover-author"
                  className="mt-0.5 sm:mt-1 line-clamp-1 text-[9.5px] sm:text-[10px] font-medium tracking-wide text-[#6e6e73]"
                >
                  {book.author.trim()}
                </p>
              )}
              {hasDescription && (
                <p
                  data-testid="book-cover-description"
                  className="mt-1 sm:mt-1.5 max-sm:line-clamp-2 line-clamp-3 text-[10px] sm:text-[11px] leading-snug sm:leading-relaxed text-[#6e6e73]/90"
                >
                  {book.description!.trim()}
                </p>
              )}
            </>
          )}

          <div className="mt-auto flex flex-col gap-1 sm:gap-1.5 pt-1.5 sm:pt-2">
            {hasCoverImage && (
              <div className="book-cover-obi flex flex-col gap-0.5 pb-0.5">
                <h4
                  className="book-cover-obi-title max-sm:line-clamp-2 max-sm:text-[12.5px] line-clamp-3 font-semibold text-sm sm:text-base text-[#1d1d1f] tracking-tight leading-snug"
                >
                  {book.title}
                </h4>
                {hasAuthor && (
                  <p
                    data-testid="book-cover-author"
                    className="book-cover-obi-author line-clamp-1 text-[9.5px] sm:text-[10px] text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                  >
                    {book.author.trim()}
                  </p>
                )}
                {hasDescription && (
                  <p
                    data-testid="book-cover-description"
                    className="book-cover-obi-desc max-sm:line-clamp-1 line-clamp-2 text-[9.5px] sm:text-[10px] leading-snug text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                  >
                    {book.description!.trim()}
                  </p>
                )}
              </div>
            )}
            <div
              className={`book-cover-meta-stats flex items-center justify-between text-[9.5px] sm:text-[10px] ${
                hasCoverImage
                  ? 'text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]'
                  : 'text-[#6e6e73]'
              }`}
            >
              <span>{fill(t.libraryBookLines, { count: derived.lines })}</span>
              <span className="pointer-coarse:ml-auto">{fill(t.libraryBookProgress, { percent })}</span>
              <button
                type="button"
                data-testid="book-more-actions-btn"
                aria-label={t.libraryMoreActions}
                aria-haspopup="dialog"
                className="book-action-btn -my-1 ml-1.5 hidden pointer-coarse:grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/[0.06] bg-white/90 text-zinc-600 shadow-xs"
                onClick={event => {
                  event.stopPropagation();
                  onOpenActions(book.bookId);
                }}
              >
                <MoreIcon />
              </button>
            </div>
            <div className={`h-1 overflow-hidden rounded-full ${hasCoverImage ? 'bg-white/30' : 'bg-black/[0.06]'}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full ${hasCoverImage ? 'bg-white' : COVER_BAR[book.coverTheme]}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="flex pointer-coarse:hidden items-center justify-between sm:justify-start gap-1 sm:gap-1.5 pt-0.5 transition-opacity duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                type="button"
                aria-label={started ? t.libraryContinueReading : t.libraryStartReading}
                title={started ? t.libraryContinueReading : t.libraryStartReading}
                className="book-action-primary grid w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0 place-items-center bg-zinc-900 text-white shadow-xs transition-transform duration-150 hover:scale-105 hover:bg-zinc-700"
                onClick={event => {
                  event.stopPropagation();
                  onOpenInReader(book);
                }}
              >
                <BookOpenIcon />
              </button>
              <button
                type="button"
                aria-label={t.libraryEditInStudio}
                title={t.libraryEditInStudio}
                className="book-action-btn grid w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0 place-items-center border border-black/[0.06] bg-white/90 text-zinc-600 shadow-xs transition-transform duration-150 hover:scale-105 hover:text-zinc-900"
                onClick={event => {
                  event.stopPropagation();
                  onOpenInEditor(book);
                }}
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                data-testid="book-settings-gear-btn"
                aria-label={t.libEditMetaAction}
                title={t.libEditMetaAction}
                className="book-action-btn grid w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0 place-items-center border border-black/[0.06] bg-white/90 text-zinc-600 shadow-xs transition-transform duration-150 hover:scale-105 hover:text-zinc-900"
                onClick={event => {
                  event.stopPropagation();
                  onOpenMetaModal(book);
                }}
              >
                <GearIcon />
              </button>
              <button
                type="button"
                aria-label={t.delete}
                title={t.delete}
                className="book-action-danger ml-auto grid w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0 place-items-center border border-rose-200/80 bg-white/90 text-rose-600 shadow-xs transition-transform duration-150 hover:scale-105 hover:bg-rose-50"
                onClick={event => {
                  event.stopPropagation();
                  onRequestDelete(book.bookId);
                }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        </div>
      </article>
      <span className="h-2.5 mx-1 mt-2 rounded-full bg-gradient-to-b from-black/[0.08] to-transparent blur-[1px] group-hover:scale-x-95 group-hover:from-black/[0.18] transition-transform duration-300" aria-hidden />

      <div
        data-testid="shelf-row-divider"
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 -left-3.5 sm:-left-4 -right-3.5 sm:-right-4 h-px bg-gradient-to-r from-black/[0.08] via-black/[0.14] to-black/[0.08] dark:from-white/[0.08] dark:via-white/[0.15] dark:to-white/[0.08] shadow-[0_1px_0_0_rgba(255,255,255,0.78)] dark:shadow-[0_1px_0_0_rgba(0,0,0,0.55)]"
      />
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
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BookCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<LibrarySortMode>('recent');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pixivOpen, setPixivOpen] = useState(false);
  const [pixivUrl, setPixivUrl] = useState('');
  const [isImportingPixiv, setIsImportingPixiv] = useState(false);
  const [pixivStatus, setPixivStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionBookId, setActionBookId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', author: '', category: 'script' as BookCategory, coverTheme: 'indigo' as BookCoverTheme, content: '' });
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

  const categoryLabel: Record<BookCategory | 'all', string> = {
    all: t.libraryCategoryAll,
    script: t.libraryCategoryScript,
    novel: t.libraryCategoryNovel,
    subtitle: t.libraryCategorySubtitle,
    other: t.libraryCategoryOther,
  };
  const sortLabel: Record<LibrarySortMode, string> = {
    recent: t.librarySortRecent,
    updated: t.librarySortUpdated,
    title: t.librarySortTitle,
  };

  const actionBook = actionBookId ? books.find(book => book.bookId === actionBookId) ?? null : null;
  const deleteBook = confirmDeleteId ? books.find(book => book.bookId === confirmDeleteId) ?? null : null;

  useEffect(() => {
    if (!actionBookId && !confirmDeleteId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActionBookId(null);
      setConfirmDeleteId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionBookId, confirmDeleteId]);

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
    <section className="flex-1 flex flex-col gap-3.5 sm:gap-5 pb-24 md:pb-6">
      <div className={`${GLASS_PANEL} p-3.5 sm:p-5 md:p-6 flex flex-col gap-3 sm:gap-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-1.5 max-w-2xl">
            <span className={`${badgeClass} inline-flex items-center gap-1.5 bg-white/85 dark:bg-white/[0.08] border-white/80 dark:border-white/10`}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75c-1.5-1.5-3.75-2.25-7.5-2.25v13.5c3.75 0 6 .75 7.5 2.25 1.5-1.5 3.75-2.25 7.5-2.25V4.5c-3.75 0-6 .75-7.5 2.25z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v13.5" />
              </svg>
              {t.libraryTab}
            </span>
            <h2 className="font-semibold text-lg sm:text-xl md:text-2xl text-zinc-900 tracking-tight">{t.libraryTitle}</h2>
            <p className="text-xs md:text-sm text-zinc-500 leading-relaxed line-clamp-2 sm:line-clamp-none">{t.libraryDesc}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
            <button
              type="button"
              disabled={busy}
              className={`${buttonClass} min-h-9 sm:min-h-10 rounded-full px-3 sm:px-4 text-xs`}
              onClick={() => importRef.current?.click()}
            >
              {t.libraryImportBook}
            </button>
            <button
              type="button"
              data-testid="pixiv-import-toggle-btn"
              aria-expanded={pixivOpen}
              className={`${pixivOpen ? buttonActiveClass : buttonClass} min-h-9 sm:min-h-10 rounded-full px-3 sm:px-4 text-xs inline-flex items-center gap-1.5`}
              onClick={() => {
                setPixivOpen(open => !open);
                setPixivStatus(null);
              }}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              {t.libPixivImportBtn}
            </button>
            <button
              type="button"
              className={`${composerOpen ? buttonActiveClass : buttonClass} min-h-9 sm:min-h-10 rounded-full px-3 sm:px-4 text-xs`}
              onClick={() => setComposerOpen(open => !open)}
            >
              {t.libraryNewBook}
            </button>
          </div>
        </div>

        {pixivOpen && (
          <form
            onSubmit={event => { void handlePixivImportSubmit(event); }}
            className="lg-grouped-card flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 rounded-2xl p-3"
          >
            <input
              type="text"
              data-testid="pixiv-url-input"
              value={pixivUrl}
              disabled={isImportingPixiv}
              placeholder={t.libPixivInputPlaceholder}
              aria-label={t.libPixivInputPlaceholder}
              onChange={event => setPixivUrl(event.target.value)}
              className={`${inputClass} min-h-10 flex-1 rounded-xl bg-white/90 px-3.5 text-sm`}
            />
            <button
              type="submit"
              data-testid="pixiv-import-submit-btn"
              disabled={isImportingPixiv || !pixivUrl.trim()}
              className={`${buttonActiveClass} min-h-10 rounded-full px-5 text-xs shrink-0 disabled:opacity-50`}
            >
              {isImportingPixiv ? t.libPixivFetching : t.libPixivFetchBtn}
            </button>
            {pixivStatus && (
              <span
                role="status"
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  pixivStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                }`}
              >
                {pixivStatus.message}
              </span>
            )}
          </form>
        )}

        {composerOpen && (
          <form
            className="lg-grouped-card grid gap-3 rounded-2xl p-3.5 sm:p-4"
            onSubmit={event => {
              event.preventDefault();
              saveDraft();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className={`${inputClass} min-h-10 rounded-xl bg-white/85 px-3.5 text-sm`}
                value={draft.title}
                aria-label={t.scriptTitlePlaceholder}
                placeholder={t.scriptTitlePlaceholder}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                required
              />
              <input
                className={`${inputClass} min-h-10 rounded-xl bg-white/85 px-3.5 text-sm`}
                value={draft.author}
                aria-label={t.libraryBookAuthorPlaceholder}
                placeholder={t.libraryBookAuthorPlaceholder}
                onChange={event => setDraft(current => ({ ...current, author: event.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={CAPSULE_TRACK}>
                {(['script', 'novel', 'subtitle', 'other'] as const).map(item => (
                  <button
                    key={item}
                    type="button"
                    className={`min-h-8 rounded-full px-3 text-xs font-medium transition-all ${draft.category === item ? CAPSULE_PILL_ACTIVE : CAPSULE_PILL_IDLE}`}
                    onClick={() => setDraft(current => ({ ...current, category: item }))}
                  >
                    {categoryLabel[item]}
                  </button>
                ))}
              </div>
              <span className="mx-1 h-5 w-px bg-zinc-200/80" aria-hidden />
              {THEMES.map(theme => (
                <button
                  key={theme}
                  type="button"
                  aria-label={theme}
                  aria-pressed={draft.coverTheme === theme}
                  className={`lg-pill-interactive h-7 w-7 rounded-full ${COVER_BAND[theme]} transition-transform ${draft.coverTheme === theme ? 'scale-105 ring-2 ring-zinc-900 ring-offset-2' : 'opacity-85 hover:opacity-100'}`}
                  onClick={() => setDraft(current => ({ ...current, coverTheme: theme }))}
                />
              ))}
            </div>
            <textarea
              className={`${inputClass} min-h-36 rounded-xl bg-white/85 px-3.5 py-2.5 text-sm leading-relaxed`}
              value={draft.content}
              aria-label={t.inputPlaceholder}
              placeholder={t.inputPlaceholder}
              onChange={event => setDraft(current => ({ ...current, content: event.target.value }))}
              required
            />
            <div className="flex justify-end gap-2">
              <button type="button" className={`${buttonClass} min-h-9 rounded-full px-4 text-xs`} onClick={() => setComposerOpen(false)}>{t.cancel}</button>
              <button type="submit" className={`${buttonActiveClass} min-h-9 rounded-full px-4 text-xs`} disabled={!draft.title.trim() || !draft.content.trim()}>{t.save}</button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-2.5 border-t border-zinc-200/60 dark:border-white/10 pt-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2 sm:gap-2.5">
            <form role="search" onSubmit={event => event.preventDefault()} className="relative flex-1 min-w-[180px]">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 z-10 flex items-center">
                <SearchIcon />
              </span>
              <input
                className="min-h-9 sm:min-h-10 w-full rounded-full border border-white/80 dark:border-white/10 bg-white/88 dark:bg-[#0d1018]/90 pl-9 pr-4 text-xs sm:text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] transition-colors focus:border-zinc-900/30 dark:focus:border-indigo-400/50 focus:bg-white dark:focus:bg-[#111520] focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-indigo-500/20"
                value={query}
                placeholder={t.librarySearchPlaceholder}
                onChange={event => setQuery(event.target.value)}
                aria-label={t.librarySearchPlaceholder}
              />
            </form>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className={`${CAPSULE_TRACK} max-w-full overflow-x-auto no-scrollbar`}>
                {CATEGORIES.map(item => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    className={`min-h-7 sm:min-h-8 shrink-0 rounded-full px-2.5 sm:px-3 text-[11px] sm:text-xs font-medium transition-all ${category === item ? CAPSULE_PILL_ACTIVE : CAPSULE_PILL_IDLE}`}
                    onClick={() => setCategory(item)}
                  >
                    {categoryLabel[item]}
                  </button>
                ))}
              </div>

              <div className={`${CAPSULE_TRACK} max-w-full overflow-x-auto no-scrollbar`}>
                {SORT_MODES.map(mode => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={sortBy === mode}
                    className={`min-h-7 sm:min-h-8 shrink-0 rounded-full px-2 sm:px-2.5 text-[11px] sm:text-xs font-medium transition-all ${sortBy === mode ? CAPSULE_PILL_ACTIVE : CAPSULE_PILL_IDLE}`}
                    onClick={() => setSortBy(mode)}
                  >
                    {sortLabel[mode]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-pressed={favoritesOnly}
                className={`lg-pill-interactive inline-flex min-h-8 sm:min-h-9 items-center gap-1.5 rounded-full border px-3 sm:px-3.5 text-[11px] sm:text-xs font-medium transition-all ${
                  favoritesOnly
                    ? 'border-zinc-900 bg-zinc-900 text-amber-400 dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-300 shadow-[0_4px_12px_-2px_rgba(15,23,42,0.25)]'
                    : 'border-white/80 dark:border-white/10 bg-white/80 dark:bg-[#0d1018]/80 text-zinc-600 dark:text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-none hover:bg-white dark:hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white'
                }`}
                onClick={() => setFavoritesOnly(current => !current)}
              >
                <StarIcon filled={favoritesOnly} />
                {t.libraryFilterFavorites}
              </button>

              {hasActiveFilter && (
                <button
                  type="button"
                  className="lg-pill-interactive inline-flex min-h-8 sm:min-h-9 items-center rounded-full border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-[#0d1018]/80 px-2.5 sm:px-3 text-[11px] sm:text-xs font-medium text-zinc-600 dark:text-slate-300 transition-colors hover:bg-white dark:hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white"
                  onClick={resetFilters}
                >
                  {t.libraryResetFilters}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className={`${GLASS_PANEL} p-10 text-center text-sm text-zinc-500`}>
          <p>{t.libraryEmptyState}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {hasActiveFilter && (
              <button type="button" className={`${buttonClass} min-h-10 rounded-full px-4 text-xs`} onClick={resetFilters}>
                {t.libraryResetFilters}
              </button>
            )}
            {books.length === 0 && (
              <button type="button" className={`${buttonClass} min-h-10 rounded-full px-4 text-xs`} onClick={onResetStarterBooks}>
                {t.libraryResetStarterBooks}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          data-testid="apple-books-shelf"
          className="relative overflow-hidden grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 [@media(max-height:520px)_and_(orientation:landscape)]:grid-cols-3 gap-x-5 sm:gap-x-7 gap-y-10 max-sm:gap-x-3.5 max-sm:gap-y-7 pt-4 sm:pt-5 pb-7 sm:pb-8 px-3 sm:px-6 rounded-2xl bg-[#f5f5f7]/90 border border-black/[0.06] shadow-[0_18px_42px_-16px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-10px_24px_-12px_rgba(0,0,0,0.06)]"
        >
          {visible.map(book => (
            <BookShelfCard
              key={book.bookId}
              book={book}
              isActive={activeBookId === book.bookId}
              categoryLabelText={categoryLabel[book.category]}
              t={t}
              onOpenInReader={onOpenInReader}
              onOpenInEditor={onOpenInEditor}
              onOpenMetaModal={openMetaModal}
              onToggleFavorite={onToggleFavorite}
              onRequestDelete={setConfirmDeleteId}
              onOpenActions={setActionBookId}
            />
          ))}
        </div>
      )}

      {actionBook && (
        <div
          data-testid="book-action-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={actionBook.title}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/35 dark:bg-black/65 p-0 sm:p-4 backdrop-blur-md"
          onClick={() => setActionBookId(null)}
        >
          <div
            onClick={event => event.stopPropagation()}
            className="lg-sheet w-full max-w-sm max-sm:rounded-t-[28px] max-sm:rounded-b-none sm:rounded-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-1"
          >
            <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-slate-400/45 dark:bg-white/25 sm:hidden" aria-hidden="true" />
            <p className="px-2 pb-2 text-center text-sm font-semibold text-zinc-900 dark:text-slate-100 line-clamp-2">{actionBook.title}</p>
            {[
              { label: actionBook.lastReadAt > 0 || actionBook.readingProgress.percentage > 0 ? t.libraryContinueReading : t.libraryStartReading, icon: <BookOpenIcon />, run: () => onOpenInReader(actionBook) },
              { label: t.libraryEditInStudio, icon: <PencilIcon />, run: () => onOpenInEditor(actionBook) },
              { label: t.libEditMetaAction, icon: <GearIcon />, run: () => openMetaModal(actionBook) },
              { label: actionBook.favorite ? t.libraryRemoveFavorite : t.libraryAddFavorite, icon: <StarIcon filled={actionBook.favorite} />, run: () => onToggleFavorite(actionBook.bookId) },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                className="flex min-h-12 items-center gap-3 rounded-2xl px-4 text-left text-[15px] text-zinc-900 dark:text-slate-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:bg-black/[0.08]"
                onClick={() => {
                  setActionBookId(null);
                  item.run();
                }}
              >
                <span className="text-zinc-500 dark:text-slate-400">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="flex min-h-12 items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/15"
              onClick={() => {
                setActionBookId(null);
                setConfirmDeleteId(actionBook.bookId);
              }}
            >
              <TrashIcon />
              {t.delete}
            </button>
            <button
              type="button"
              className="mt-1 min-h-12 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] text-[15px] font-semibold text-zinc-900 dark:text-slate-100"
              onClick={() => setActionBookId(null)}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {deleteBook && (
        <div
          data-testid="book-delete-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="book-delete-title"
          aria-describedby="book-delete-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 dark:bg-black/65 p-6 backdrop-blur-md"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            onClick={event => event.stopPropagation()}
            className="lg-sheet w-full max-w-xs rounded-[24px] p-5 flex flex-col gap-4 text-center"
          >
            <div>
              <h3 id="book-delete-title" className="font-semibold text-base text-zinc-900 dark:text-slate-100">{t.libraryDeleteBookTitle}</h3>
              <p id="book-delete-desc" className="mt-1.5 text-[13px] leading-relaxed text-zinc-600 dark:text-slate-300">
                {t.libraryDeleteBookConfirm.replace('{title}', deleteBook.title)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                autoFocus
                className="min-h-11 rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-sm font-medium text-zinc-900 dark:text-slate-100"
                onClick={() => setConfirmDeleteId(null)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                className="min-h-11 rounded-full bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700"
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

      {editingMetaBookId && (
        <div
          data-testid="book-meta-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t.libEditMetaTitle}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/35 dark:bg-black/65 p-0 sm:p-4 backdrop-blur-md"
          onClick={closeMetaModal}
        >
          <form
            onClick={event => event.stopPropagation()}
            onSubmit={saveMetaModal}
            className="lg-sheet w-full max-w-lg max-sm:rounded-t-[32px] max-sm:rounded-b-none sm:rounded-[32px] p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="mx-auto -mt-1.5 mb-0.5 h-1.5 w-10 rounded-full bg-slate-400/45 dark:bg-white/25 sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/10 pb-3">
              <h3 className="font-semibold text-base sm:text-lg text-zinc-900 dark:text-slate-100">{t.libEditMetaTitle}</h3>
              <button
                type="button"
                aria-label={t.libMetaCancel}
                onClick={closeMetaModal}
                className="lg-pill-interactive grid h-8 w-8 place-items-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-zinc-500 dark:text-slate-400 hover:bg-black/[0.1] dark:hover:bg-white/[0.14] hover:text-zinc-900 dark:hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[120px_1fr] items-start">
              <div className="mx-auto sm:mx-0 w-28">
                <div
                  data-leather-theme={metaDraft.coverTheme}
                  className={`book-leather-cover book-leather-${metaDraft.coverTheme} book-leather-theme-${metaDraft.coverTheme} relative flex aspect-[3/4.2] w-full flex-col overflow-hidden rounded-l-[3px] rounded-r-[7px] bg-gradient-to-b from-white to-[#faf9f5] dark:from-[#242a3c] dark:to-[#141824] shadow-[0_10px_24px_-6px_rgba(0,0,0,0.16),2px_0_0_0_#fafaf9,4px_0_0_0_#e4e4e7] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.68),2px_0_0_0_#333a4d,4px_0_0_0_#2b3142]`}
                >
                  <span className="book-leather-grain pointer-events-none absolute inset-0 z-[1]" aria-hidden />
                  <span className="book-leather-sheen pointer-events-none absolute inset-0 z-[2]" aria-hidden />
                  <span className="book-leather-frame top-1.5 bottom-1.5 left-3 right-1.5 rounded-r-[5px] rounded-l-[1.5px] pointer-events-none absolute z-[3]" aria-hidden />
                  {Boolean(metaDraft.coverUrl.trim()) && (
                    <img
                      src={metaDraft.coverUrl.trim()}
                      alt={metaDraft.title || t.untitledScript}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 z-[4] h-full w-full object-cover"
                    />
                  )}
                  <div className={`book-silk-band relative z-10 h-2.5 w-full shrink-0 ${COVER_BAND[metaDraft.coverTheme]}`} aria-hidden />
                  <span className="book-3d-spine-groove pointer-events-none absolute inset-y-0 left-0 z-20 w-2.5 bg-gradient-to-r from-black/12 via-white/30 to-transparent" aria-hidden />
                  {!metaDraft.coverUrl.trim() && (
                    <div className="relative z-10 flex flex-1 flex-col p-2 pl-3.5">
                      <h4 className="mt-1 line-clamp-3 font-semibold text-[11px] leading-snug text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {metaDraft.title.trim() || t.untitledScript}
                      </h4>
                      {Boolean(metaDraft.author.trim()) && (
                        <p data-testid="book-cover-author" className="mt-0.5 line-clamp-1 text-[9px] text-[#6e6e73] dark:text-[#94a3b8]">
                          {metaDraft.author.trim()}
                        </p>
                      )}
                      {Boolean(metaDraft.description.trim()) && (
                        <p data-testid="book-cover-description" className="mt-1 line-clamp-2 text-[8px] leading-tight text-[#6e6e73]/90 dark:text-[#94a3b8]/90">
                          {metaDraft.description.trim()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-zinc-700 dark:text-slate-300">
                  <span>{t.libMetaBookTitle}</span>
                  <input
                    type="text"
                    data-testid="book-meta-title-input"
                    value={metaDraft.title}
                    onChange={event => setMetaDraft(current => ({ ...current, title: event.target.value }))}
                    className={`${inputClass} min-h-9 rounded-xl bg-white/90 px-3 text-sm`}
                    required
                  />
                </label>

                <label className="grid gap-1 text-xs font-medium text-zinc-700 dark:text-slate-300">
                  <span>{t.libMetaAuthor}</span>
                  <input
                    type="text"
                    data-testid="book-meta-author-input"
                    value={metaDraft.author}
                    placeholder={t.libMetaAuthorPlaceholder}
                    onChange={event => setMetaDraft(current => ({ ...current, author: event.target.value }))}
                    className={`${inputClass} min-h-9 rounded-xl bg-white/90 px-3 text-sm`}
                  />
                </label>
              </div>
            </div>

            <label className="grid gap-1 text-xs font-medium text-zinc-700 dark:text-slate-300">
              <span>{t.libMetaDescription}</span>
              <textarea
                data-testid="book-meta-description-input"
                value={metaDraft.description}
                placeholder={t.libMetaDescriptionPlaceholder}
                onChange={event => setMetaDraft(current => ({ ...current, description: event.target.value }))}
                rows={3}
                className={`${inputClass} rounded-xl bg-white/90 px-3 py-2 text-sm leading-relaxed`}
              />
            </label>

            <div className="grid gap-2 text-xs font-medium text-zinc-700 dark:text-slate-300">
              <span>{t.libMetaCover}</span>
              <input
                type="text"
                data-testid="book-meta-cover-url-input"
                value={metaDraft.coverUrl}
                placeholder={t.libMetaCoverUrlPlaceholder}
                onChange={event => setMetaDraft(current => ({ ...current, coverUrl: event.target.value }))}
                className={`${inputClass} min-h-9 rounded-xl bg-white/90 px-3 text-sm`}
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
                  className={`${buttonClass} min-h-8 rounded-full px-3.5 text-xs`}
                  onClick={() => coverUploadRef.current?.click()}
                >
                  {t.libMetaCoverUpload}
                </button>
                {Boolean(metaDraft.coverUrl.trim()) && (
                  <button
                    type="button"
                    data-testid="book-meta-cover-clear-btn"
                    className={`${buttonClass} min-h-8 rounded-full px-3.5 text-xs text-rose-600`}
                    onClick={() => setMetaDraft(current => ({ ...current, coverUrl: '' }))}
                  >
                    {t.libMetaCoverClear}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-slate-300">{t.libMetaTheme}</span>
              <div className="flex items-center gap-2">
                {THEMES.map(theme => (
                  <button
                    key={theme}
                    type="button"
                    aria-label={theme}
                    aria-pressed={metaDraft.coverTheme === theme}
                    className={`lg-pill-interactive h-7 w-7 rounded-full ${COVER_BAND[theme]} transition-transform ${metaDraft.coverTheme === theme ? 'scale-110 ring-2 ring-zinc-900 dark:ring-white ring-offset-2 dark:ring-offset-[#141824]' : 'opacity-85 hover:opacity-100'}`}
                    onClick={() => setMetaDraft(current => ({ ...current, coverTheme: theme }))}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200/60 dark:border-white/10 pt-3">
              <button
                type="button"
                data-testid="book-meta-cancel-btn"
                className={`${buttonClass} min-h-9 rounded-full px-4 text-xs`}
                onClick={closeMetaModal}
              >
                {t.libMetaCancel}
              </button>
              <button
                type="submit"
                data-testid="book-meta-save-btn"
                className={`${buttonActiveClass} min-h-9 rounded-full px-5 text-xs`}
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
