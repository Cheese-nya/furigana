import React, { useState } from 'react';
import { Modal } from './Modal';
import type { Locale, Translations } from '../utils/i18n';

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  t: Translations;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  isOpen,
  onToggle,
  title = '假名标注工具',
  locale,
  onLocaleChange,
  t,
}) => {
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);

  return (
    <>
      {/* Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-slate-900/30 dark:bg-black/55 backdrop-blur-md z-40 transition-opacity duration-200"
        />
      )}

      {/* iOS / iPadOS Liquid Glass Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 sm:w-80 max-w-[84vw] z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div
          data-testid="sidebar-drawer"
          className="h-full flex flex-col liquid-glass-panel lg-sheet rounded-none rounded-r-[32px] backdrop-blur-2xl bg-white/88 dark:bg-[#131724]/95 border-r border-white/80 dark:border-white/10 shadow-[0_24px_60px_rgba(15,23,42,0.18),inset_-1px_0_0_rgba(255,255,255,0.72)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.75),inset_-1px_0_0_rgba(255,255,255,0.08)]"
        >
          {/* Header with safe-area top padding */}
          <div className="px-4 sm:px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3.5 sm:pb-4 flex items-center justify-between border-b border-slate-200/60 dark:border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <img src="./logo.png" alt="Software Logo" className="w-8 h-8 rounded-[10px] border border-white/85 dark:border-white/15 object-cover shadow-2xs shrink-0" />
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {title}
              </span>
            </div>
            <button
              onClick={onToggle}
              aria-label="关闭侧边栏"
              className="w-8 h-8 rounded-full lg-pill-interactive text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-white/75 dark:hover:bg-white/12 border border-white/70 dark:border-white/10 flex items-center justify-center shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items Group */}
          <div className="flex-1 overflow-y-auto py-4 px-3.5 flex flex-col gap-1.5">
            <div className="lg-grouped-card rounded-[22px] p-1.5 flex flex-col gap-1">
              {items.map((item, index) => {
                const isDeps = item.href === '#deps' || item.label === t.sidebarDeps;
                const itemIcon = isDeps ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                ) : item.icon;

                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      onToggle();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm lg-pill-interactive ${
                      item.active
                        ? 'liquid-glass-btn-primary lg-btn-prominent font-semibold text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-white/80 dark:hover:border-white/10 font-medium'
                    }`}
                  >
                    <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${item.active ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                      {itemIcon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Section with Language Selector, Reward Button & Twitter Author info */}
          <div className="px-3.5 sm:px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3 border-t border-slate-200/60 dark:border-white/10">
            {/* Language Switcher */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
                <span>{t.languageLabel}</span>
                <svg className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9s1.3-6.2 3.8-9z" />
                </svg>
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-full liquid-glass-pill-group lg-container bg-slate-200/60 dark:bg-[#0b0e17]/85 border border-white/70 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => onLocaleChange('zh-CN')}
                  className={`py-1.5 text-xs rounded-full lg-pill-interactive ${
                    locale === 'zh-CN'
                      ? 'liquid-glass-pill-active bg-white dark:bg-indigo-500/25 text-indigo-950 dark:text-slate-100 border border-transparent dark:border-indigo-400/30 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  简体中文
                </button>
                <button
                  type="button"
                  onClick={() => onLocaleChange('en')}
                  className={`py-1.5 text-xs rounded-full lg-pill-interactive ${
                    locale === 'en'
                      ? 'liquid-glass-pill-active bg-white dark:bg-indigo-500/25 text-indigo-950 dark:text-slate-100 border border-transparent dark:border-indigo-400/30 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Donate / Reward Button */}
            <button
              onClick={() => setIsRewardModalOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full liquid-glass-btn lg-pill-interactive text-slate-800 dark:text-slate-100 font-medium text-xs"
            >
              <img
                src="./cheese_icon.jpg"
                alt="Cheese Logo"
                className="w-4 h-4 rounded-full object-cover ring-1 ring-white/80 dark:ring-white/20"
              />
              <span>{t.donateAuthor}</span>
            </button>

            {/* Social quick links */}
            <div className="flex items-center justify-center gap-2.5">
              <a
                href="https://x.com/beimisama"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter / X @beimisama"
                title="X / Twitter (@beimisama)"
                className="w-9 h-9 rounded-full liquid-glass-btn lg-pill-interactive text-slate-700 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white flex items-center justify-center"
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
                className="w-9 h-9 rounded-full liquid-glass-btn lg-pill-interactive text-slate-700 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white flex items-center justify-center"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
                </svg>
              </a>
            </div>

            {/* Author Handle with Twitter Icon & Version */}
            <div className="flex flex-col items-center justify-center gap-1.5 pt-0.5">
              <a
                href="https://x.com/beimisama"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current text-slate-500 dark:text-slate-400" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>チーズ@beimisama</span>
              </a>
              <div className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-300 bg-white/75 dark:bg-white/[0.06] border border-white/85 dark:border-white/10 px-2.5 py-0.5 rounded-full shadow-2xs">
                Furigana v1.2.0
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Reward QR Code Modal */}
      <Modal
        isOpen={isRewardModalOpen}
        onClose={() => setIsRewardModalOpen(false)}
        title={t.supportAuthorTitle}
      >
        <div className="flex flex-col items-center justify-center py-2 space-y-4">
          <div className="p-3 bg-white border border-white/80 dark:border-white/20 rounded-2xl shadow-xs">
            <img
              src="./reward_qrcode.png"
              alt="Reward QR Code"
              className="w-64 h-64 object-contain rounded-xl"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            {t.supportAuthorDesc}
          </p>
        </div>
      </Modal>
    </>
  );
};
