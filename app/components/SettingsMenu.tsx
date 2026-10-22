'use client';

import React, { useState } from 'react';
import { Modal } from './Modal';
import { GlassPopover, PopoverItem, PopoverSeparator } from './glass/GlassPopover';
import { LiquidSelector } from './glass/LiquidSelector';
import { IconGitHub, IconHeart, IconMoon, IconPulse, IconRefresh, IconSun, IconXLogo } from './glass/icons';
import type { Locale, Translations } from '../utils/i18n';

export interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  placement?: 'below' | 'above';
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  darkMode: boolean;
  onDarkModeChange: (dark: boolean) => void;
  dictionaryStatus: 'loading' | 'ready' | 'degraded';
  dictionaryLabel: string;
  onOpenDepModal: () => void;
  onReloadDict: () => void;
  t: Translations;
}

/** Language, appearance, engine status and about — one glass popover. */
export function SettingsMenu({
  open,
  onClose,
  anchor,
  placement,
  locale,
  onLocaleChange,
  darkMode,
  onDarkModeChange,
  dictionaryStatus,
  dictionaryLabel,
  onOpenDepModal,
  onReloadDict,
  t,
}: SettingsMenuProps) {
  const [rewardOpen, setRewardOpen] = useState(false);
  const dot = dictionaryStatus === 'ready' ? 'bg-[var(--ok)]' : dictionaryStatus === 'loading' ? 'bg-[var(--label-3)] animate-pulse' : 'bg-[var(--review)]';

  return (
    <>
      <GlassPopover open={open} onClose={onClose} anchor={anchor} placement={placement} ariaLabel={t.settingsTitle} className="w-[272px]">
        <div className="px-2.5 pb-1.5 pt-2">
          <div className="mb-1.5 text-xs font-semibold text-[var(--label-2)]">{t.languageLabel}</div>
          <LiquidSelector
            variant="solid"
            className="flex w-full [&>[data-opt]]:h-7 [&>[data-opt]]:flex-1 [&>[data-opt]]:text-[13px]"
            role="radiogroup"
            ariaLabel={t.languageLabel}
            value={locale}
            onChange={onLocaleChange}
            options={[{ value: 'zh-CN', label: '简体中文' }, { value: 'en', label: 'English' }]}
          />
        </div>
        <div className="px-2.5 pb-2 pt-1.5">
          <div className="mb-1.5 text-xs font-semibold text-[var(--label-2)]">{t.appearanceLabel}</div>
          <LiquidSelector
            variant="solid"
            className="flex w-full [&>[data-opt]]:h-7 [&>[data-opt]]:flex-1 [&>[data-opt]]:text-[13px]"
            role="radiogroup"
            ariaLabel={t.navDarkModeToggle}
            testId="dark-mode-toggle"
            value={darkMode ? 'dark' : 'light'}
            onChange={value => onDarkModeChange(value === 'dark')}
            options={[
              { value: 'light', label: <span className="inline-flex items-center justify-center gap-1.5"><IconSun size={14} />{t.themeLight}</span>, ariaLabel: t.themeLight },
              { value: 'dark', label: <span className="inline-flex items-center justify-center gap-1.5"><IconMoon size={14} />{t.themeDark}</span>, ariaLabel: t.themeDark },
            ]}
          />
        </div>
        <PopoverSeparator />
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--label-2)]">
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`} />
          <span className="min-w-0 flex-1 truncate" title={dictionaryLabel}>{dictionaryLabel}</span>
        </div>
        {dictionaryStatus === 'degraded' && (
          <PopoverItem icon={<IconRefresh size={17} />} onClick={onReloadDict} data-testid="header-dict-reload-btn">{t.reloadDict}</PopoverItem>
        )}
        <PopoverItem icon={<IconPulse size={17} />} onClick={() => { onClose(); onOpenDepModal(); }}>{t.sidebarDeps}</PopoverItem>
        <PopoverItem icon={<IconHeart size={17} />} onClick={() => { onClose(); setRewardOpen(true); }}>{t.donateAuthor}</PopoverItem>
        <PopoverSeparator />
        <div className="flex items-center gap-1 px-1.5 pb-1 pt-0.5">
          <a
            href="https://x.com/beimisama"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter / X @beimisama"
            title="X / Twitter (@beimisama)"
            className="flex w-9 h-9 items-center justify-center rounded-full text-[var(--label-2)] transition-colors hover:bg-[var(--item-hover)] hover:text-[var(--label)]"
          >
            <IconXLogo size={15} />
          </a>
          <a
            href="https://github.com/Cheese-nya/furigana"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub @Cheese-nya"
            title="GitHub (Cheese-nya/furigana)"
            className="flex w-9 h-9 items-center justify-center rounded-full text-[var(--label-2)] transition-colors hover:bg-[var(--item-hover)] hover:text-[var(--label)]"
          >
            <IconGitHub size={16} />
          </a>
          <span data-testid="app-version-badge" className="ml-auto pr-2 text-[11px] font-medium tabular-nums text-[var(--label-3)]">Furigana v1.2.0</span>
        </div>
      </GlassPopover>

      <Modal isOpen={rewardOpen} onClose={() => setRewardOpen(false)} title={t.supportAuthorTitle}>
        <div className="flex flex-col items-center justify-center space-y-4 py-2">
          <div className="rounded-2xl bg-white p-3 shadow-xs">
            <img src="./reward_qrcode.png" alt="Reward QR Code" className="h-64 w-64 rounded-xl object-contain" />
          </div>
          <p className="text-xs font-medium tracking-wide text-[var(--label-2)]">{t.supportAuthorDesc}</p>
        </div>
      </Modal>
    </>
  );
}
