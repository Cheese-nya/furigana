'use client';

import type { ReactNode } from 'react';
import type { Translations } from '../utils/i18n';

export type AppTab = 'editor' | 'library' | 'reader' | 'batch_files';

export interface MobileNavBarProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  bookCount?: number;
  t: Translations;
}

// One glass control inside the shared GlassEffectContainer — no nested blur stacking.
const BUTTON = 'relative flex min-h-[34px] [@media(max-height:520px)_and_(orientation:landscape)]:min-h-[30px] [@media(max-height:520px)_and_(orientation:landscape)]:flex-row [@media(max-height:520px)_and_(orientation:landscape)]:gap-1.5 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] px-1.5 py-0.5 text-[10px] leading-none font-medium lg-pill-interactive';
const ACTIVE = 'liquid-glass-pill-active text-indigo-700 dark:text-indigo-200 font-semibold shadow-[0_2px_8px_-3px_rgba(79,70,229,0.28),inset_0_1px_0.5px_rgba(255,255,255,0.94)] dark:shadow-[0_2px_8px_-3px_rgba(99,102,241,0.4),inset_0_1px_0.5px_rgba(255,255,255,0.20)] ring-1 ring-indigo-500/12 dark:ring-indigo-400/22';
const IDLE = 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/45 dark:hover:bg-white/[0.06]';

const ICON_CLASS = 'h-3.5 w-3.5';

function EditorIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.85} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v3.375A2.625 2.625 0 0116.875 20.25H5.25A2.625 2.625 0 012.625 17.625V6A2.625 2.625 0 015.25 3.375H9" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.85} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75c-1.5-1.5-3.75-2.25-7.5-2.25v13.5c3.75 0 6 .75 7.5 2.25 1.5-1.5 3.75-2.25 7.5-2.25V4.5c-3.75 0-6 .75-7.5 2.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v13.5" />
    </svg>
  );
}

function ReaderIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.85} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.25A2.25 2.25 0 016.25 3h5.25v16.5H6.25A2.25 2.25 0 004 21.75V5.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 5.25A2.25 2.25 0 0017.75 3h-5.25v16.5h5.25A2.25 2.25 0 0120 21.75V5.25z" />
    </svg>
  );
}

function BatchIcon() {
  return (
    <svg className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.85} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A1.5 1.5 0 014.5 6h4.379a1.5 1.5 0 011.06.44l1.122 1.12a1.5 1.5 0 001.06.44H19.5A1.5 1.5 0 0121 9.5v8.25a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.75V7.5z" />
    </svg>
  );
}

export function MobileNavBar({ activeTab, onChange, bookCount = 0, t }: MobileNavBarProps) {
  const items: Array<{ tab: AppTab; label: string; icon: ReactNode; badge?: number }> = [
    { tab: 'editor', label: t.mobileNavEditor, icon: <EditorIcon /> },
    { tab: 'library', label: t.mobileNavLibrary, icon: <LibraryIcon />, badge: bookCount },
    { tab: 'reader', label: t.mobileNavReader, icon: <ReaderIcon /> },
    { tab: 'batch_files', label: t.mobileNavBatch, icon: <BatchIcon /> },
  ];

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-0.5">
      <nav
        data-testid="mobile-nav-bar"
        aria-label={t.sidebarTitle}
        className="mx-auto flex max-w-[332px] items-center justify-around gap-0.5 rounded-[28px] liquid-glass-nav lg-container px-1.5 py-1"
      >
        {items.map(item => (
          <button
            key={item.tab}
            type="button"
            onClick={() => onChange(item.tab)}
            aria-current={activeTab === item.tab ? 'page' : undefined}
            className={`${BUTTON} ${activeTab === item.tab ? ACTIVE : IDLE}`}
          >
            <span className="relative flex items-center justify-center">
              {item.icon}
              {item.badge ? (
                <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 px-1 text-[8px] font-bold tabular-nums leading-none text-white ring-1 ring-white/80 dark:ring-slate-900/80 shadow-xs">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </span>
            <span className="truncate tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
