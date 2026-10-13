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
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs z-40 transition-opacity duration-200"
        />
      )}

      {/* Clean Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col bg-white border-r border-zinc-200 shadow-xl">
          {/* Header */}
          <div className="p-5 flex items-center justify-between border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <img src="./logo.png" alt="Software Logo" className="w-8 h-8 rounded-lg border border-zinc-200/80 object-cover" />
              <span className="text-base font-semibold text-zinc-900 tracking-tight truncate">
                {title}
              </span>
            </div>
            <button
              onClick={onToggle}
              aria-label="关闭侧边栏"
              className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-5 px-3 flex flex-col gap-1.5">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  onToggle();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-zinc-900 text-white font-medium shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 font-medium'
                }`}
              >
                <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${item.active ? 'text-white' : 'text-zinc-400'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Footer Section with Language Selector, Reward Button & Twitter Author info */}
          <div className="p-4 flex flex-col gap-3.5 border-t border-zinc-100">
            {/* Language Switcher */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-zinc-500 flex items-center justify-between">
                <span>{t.languageLabel}</span>
                <span className="text-[10px] text-zinc-400 font-mono">🌐</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-lg border border-zinc-200/80">
                <button
                  type="button"
                  onClick={() => onLocaleChange('zh-CN')}
                  className={`py-1 text-xs font-medium rounded-md transition-all ${
                    locale === 'zh-CN'
                      ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  简体中文
                </button>
                <button
                  type="button"
                  onClick={() => onLocaleChange('en')}
                  className={`py-1 text-xs font-medium rounded-md transition-all ${
                    locale === 'en'
                      ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Donate / Reward Button */}
            <button
              onClick={() => setIsRewardModalOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 font-medium text-xs shadow-xs transition-colors"
            >
              <img
                src="./cheese_icon.jpg"
                alt="Cheese Logo"
                className="w-4 h-4 rounded-sm object-cover"
              />
              <span>{t.donateAuthor}</span>
            </button>

            {/* Author Handle with Twitter Icon & Version */}
            <div className="flex flex-col items-center justify-center gap-1.5 pt-0.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-600">
                <svg className="w-3.5 h-3.5 fill-current text-zinc-500" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>チーズ@beimisama</span>
              </div>
              <div className="text-[11px] font-medium text-zinc-500 bg-zinc-100 border border-zinc-200/80 px-2.5 py-0.5 rounded-full">
                Furigana V1.1.0
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
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <img
              src="./reward_qrcode.png"
              alt="Reward QR Code"
              className="w-64 h-64 object-contain rounded-lg"
            />
          </div>
          <p className="text-xs text-zinc-500 font-medium tracking-wide">
            {t.supportAuthorDesc}
          </p>
        </div>
      </Modal>
    </>
  );
};
