'use client';

import React from 'react';
import { Locale, Translations } from '../utils/i18n';
import {
  glassNavClass,
  glassPillActiveClass,
  glassPillGroupClass,
  glassPillInactiveClass,
  neuButton,
} from './uiTokens';

export type AppTabId = 'editor' | 'library' | 'reader' | 'batch_files';

export interface AppHeaderTabItem {
  id: AppTabId;
  label: string;
  badge?: number;
  icon?: React.ReactNode;
}

export interface AppHeaderProps {
  activeTab: AppTabId;
  onSelectTab: (tab: AppTabId) => void;
  tabs?: AppHeaderTabItem[];
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  dictionaryStatus: 'loading' | 'ready' | 'degraded';
  dictionaryLabel: string;
  isKuromojiLoading: boolean;
  onOpenDepModal: () => void;
  onReloadDict: () => void;
  libraryBookCount: number;
  t: Translations;
}

export default function AppHeader({
  activeTab,
  onSelectTab,
  tabs,
  locale,
  onLocaleChange,
  darkMode,
  onToggleDarkMode,
  dictionaryStatus,
  dictionaryLabel,
  isKuromojiLoading,
  onOpenDepModal,
  onReloadDict,
  libraryBookCount,
  t,
}: AppHeaderProps) {
  const defaultTabs: AppHeaderTabItem[] = [
    {
      id: 'editor',
      label: t.mobileNavEditor,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v3.375A2.625 2.625 0 0116.875 20.25H5.25A2.625 2.625 0 012.625 17.625V6A2.625 2.625 0 015.25 3.375H9" />
        </svg>
      ),
    },
    {
      id: 'library',
      label: t.mobileNavLibrary,
      badge: libraryBookCount > 0 ? libraryBookCount : undefined,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75c-1.5-1.5-3.75-2.25-7.5-2.25v13.5c3.75 0 6 .75 7.5 2.25 1.5-1.5 3.75-2.25 7.5-2.25V4.5c-3.75 0-6 .75-7.5 2.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v13.5" />
        </svg>
      ),
    },
    {
      id: 'reader',
      label: t.mobileNavReader,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.25A2.25 2.25 0 016.25 3h5.25v16.5H6.25A2.25 2.25 0 004 21.75V5.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 5.25A2.25 2.25 0 0017.75 3h-5.25v16.5h5.25A2.25 2.25 0 0120 21.75V5.25z" />
        </svg>
      ),
    },
    {
      id: 'batch_files',
      label: t.mobileNavBatch,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A1.5 1.5 0 014.5 6h4.379a1.5 1.5 0 011.06.44l1.122 1.12a1.5 1.5 0 001.06.44H19.5A1.5 1.5 0 0121 9.5v8.25a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.75V7.5z" />
        </svg>
      ),
    },
  ];

  const resolvedTabs = tabs ?? defaultTabs;

  return (
    <header
      className={`relative z-30 mb-3.5 sm:mb-6 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 md:grid md:grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center ${glassNavClass}`}
    >
      {/* Left: Liquid Glass logo mark + wordmark + version label (version hidden < lg to prevent md-xl collision) */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 min-w-0">
        <span className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-[11px] sm:rounded-xl liquid-glass-panel border border-white/80 dark:border-white/15 shadow-2xs">
          <img src="./logo.png" alt="Furigana logo" className="h-full w-full object-cover" />
        </span>
        <div className="flex items-baseline min-w-0">
          <span
            data-testid="app-brand-title"
            className="font-semibold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap"
          >
            Furigana
          </span>
          <span
            data-testid="app-version-badge"
            className="hidden lg:inline ml-1.5 text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500 tracking-normal whitespace-nowrap"
          >
            v1.2.0
          </span>
        </div>
      </div>

      {/* Center: Primary Tab Switcher Capsule (centered, never overlaps brand area) */}
      <div
        className={`hidden md:flex items-center gap-0.5 flex-shrink-0 justify-self-center ${glassPillGroupClass}`}
        role="tablist"
        aria-label={t.sidebarTitle}
      >
        {resolvedTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? glassPillActiveClass : glassPillInactiveClass
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                  activeTab === tab.id
                    ? 'bg-blue-500/15 text-blue-700 dark:bg-indigo-500/25 dark:text-indigo-200'
                    : 'bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Right: Unified Liquid Glass capsule — dictionary status, language switch & dark mode */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 justify-self-end">
        <div className={`lg-container inline-flex items-center gap-1 sm:gap-1.5 ${glassPillGroupClass}`}>
          {/* Interactive Dictionary Status Button (< xl shows dot only, retains full title & aria-label) */}
          <button
            type="button"
            onClick={onOpenDepModal}
            title={dictionaryLabel}
            aria-label={dictionaryLabel}
            className={`lg-btn lg-pill-interactive inline-flex items-center gap-1.5 rounded-full px-2 sm:px-2.5 py-1 text-xs font-medium cursor-pointer ${
              dictionaryStatus === 'degraded'
                ? 'text-amber-800 dark:text-amber-200 bg-amber-50/85 dark:bg-amber-950/60 hover:bg-amber-100/80'
                : isKuromojiLoading
                  ? 'text-blue-700 dark:text-blue-200 bg-blue-50/85 dark:bg-blue-950/60 hover:bg-blue-100/80'
                  : 'text-emerald-800 dark:text-emerald-200 bg-emerald-50/85 dark:bg-emerald-950/60 hover:bg-emerald-100/80'
            }`}
          >
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                dictionaryStatus === 'degraded'
                  ? 'bg-amber-500 animate-pulse'
                  : isKuromojiLoading
                    ? 'bg-blue-500 animate-ping'
                    : 'bg-emerald-500'
              }`}
            />
            <span className="hidden xl:inline max-w-[140px] truncate">{dictionaryLabel}</span>
          </button>

          {/* Inline reload action when the dictionary needs repair */}
          {dictionaryStatus === 'degraded' && (
            <button
              type="button"
              data-testid="header-dict-reload-btn"
              onClick={onReloadDict}
              title={t.reloadDict}
              className="lg-btn lg-pill-interactive rounded-full px-1.5 py-1 text-[10px] font-semibold whitespace-nowrap text-amber-800 dark:text-amber-200 underline decoration-amber-500/60 underline-offset-2 hover:bg-amber-100/70 dark:hover:bg-amber-900/50"
            >
              {t.reloadDict}
            </button>
          )}

          {/* Language Switcher */}
          <div className="inline-flex items-center" role="group" aria-label={t.languageLabel}>
            {(['zh-CN', 'en'] as const).map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => onLocaleChange(lang)}
                aria-pressed={locale === lang}
                className={`lg-btn px-1.5 sm:px-2 py-1 text-[11px] ${
                  locale === lang ? glassPillActiveClass : glassPillInactiveClass
                }`}
              >
                {lang === 'zh-CN' ? '中' : 'EN'}
              </button>
            ))}
          </div>

          {/* Dark Mode Toggle Button (ASCII Sun / Moon Slash Logo) */}
          <button
            type="button"
            data-testid="dark-mode-toggle"
            onClick={onToggleDarkMode}
            title={t.navDarkModeToggle}
            aria-label={t.navDarkModeToggle}
            aria-pressed={darkMode}
            className="lg-btn lg-pill-interactive rounded-full px-2 sm:px-2.5 py-1 sm:py-1.5 inline-flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <span className="font-mono text-xs tracking-tight inline-flex items-center gap-1">
              <span className={!darkMode ? 'text-amber-500 font-bold' : 'opacity-45'}>☼</span>
              <span className="opacity-40">/</span>
              <span className={darkMode ? 'text-indigo-300 font-bold' : 'opacity-45'}>☾</span>
            </span>
          </button>
        </div>

        {/* Social quick links (hidden on narrow mobile since available in Sidebar drawer) */}
        <div className="hidden lg:flex items-center gap-1.5">
          <a
            href="https://x.com/beimisama"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter / X @beimisama"
            title="X / Twitter (@beimisama)"
            className={`w-9 h-9 ${neuButton} flex items-center justify-center`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://github.com/Cheese-nya/furigana"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub @Cheese-nya"
            title="GitHub (Cheese-nya/furigana)"
            className={`w-9 h-9 ${neuButton} flex items-center justify-center`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
