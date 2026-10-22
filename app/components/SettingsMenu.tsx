'use client';

import React from 'react';
import { GlassPopover, PopoverItem, PopoverSeparator } from './glass/GlassPopover';
import { LiquidSelector } from './glass/LiquidSelector';
import { IconCheck, IconDictionary } from './glass/icons';
import type { ThemeMode } from '../hooks/useThemeMode';
import type { Locale, Translations } from '../utils/i18n';

export interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  placement?: 'below' | 'above';
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  learnedCount: number;
  glossaryCount: number;
  onOpenLearned: () => void;
  onOpenGlossary: () => void;
  dictionaryStatus: 'loading' | 'ready' | 'degraded';
  dictionaryLabel: string;
  /** Extra controls shown above the settings (the phone workbench puts ruby mode and typography here). */
  extra?: React.ReactNode;
  t: Translations;
}

/** Settings popover — exactly the mockup: language, appearance, learned readings, glossary, engine status. */
export function SettingsMenu({
  open,
  onClose,
  anchor,
  placement,
  locale,
  onLocaleChange,
  themeMode,
  onThemeModeChange,
  learnedCount,
  glossaryCount,
  onOpenLearned,
  onOpenGlossary,
  dictionaryStatus,
  dictionaryLabel,
  extra,
  t,
}: SettingsMenuProps) {
  const dot = dictionaryStatus === 'ready' ? 'bg-[var(--ok)]' : dictionaryStatus === 'loading' ? 'bg-[var(--label-3)] animate-pulse' : 'bg-[var(--danger)]';
  const segClass = 'flex w-full [&>[data-opt]]:h-7 [&>[data-opt]]:flex-1 [&>[data-opt]]:px-2 [&>[data-opt]]:text-[13px]';

  return (
    <GlassPopover open={open} onClose={onClose} anchor={anchor} placement={placement} ariaLabel={t.settingsTitle} className="w-[260px]">
      {extra}
      <div className="px-2.5 pb-1.5 pt-2">
        <div className="mb-1.5 text-xs font-semibold text-[var(--label-2)]">{t.languageLabel}</div>
        <LiquidSelector
          variant="solid"
          className={segClass}
          role="radiogroup"
          ariaLabel={t.languageLabel}
          value={locale}
          onChange={onLocaleChange}
          options={[{ value: 'zh-CN', label: '中文' }, { value: 'en', label: 'English' }]}
        />
      </div>
      <div className="px-2.5 pb-2 pt-1.5">
        <div className="mb-1.5 text-xs font-semibold text-[var(--label-2)]">{t.appearanceLabel}</div>
        <LiquidSelector
          variant="solid"
          className={segClass}
          role="radiogroup"
          ariaLabel={t.navDarkModeToggle}
          testId="dark-mode-toggle"
          value={themeMode}
          onChange={onThemeModeChange}
          options={[
            { value: 'auto', label: t.themeAuto },
            { value: 'light', label: t.themeLight },
            { value: 'dark', label: t.themeDark },
          ]}
        />
      </div>
      <PopoverSeparator />
      <PopoverItem icon={<IconCheck size={17} />} detail={learnedCount} onClick={() => { onClose(); onOpenLearned(); }}>{t.learnedReadingsMenu}</PopoverItem>
      <PopoverItem icon={<IconDictionary size={17} />} detail={glossaryCount} onClick={() => { onClose(); onOpenGlossary(); }}>{t.properNounGlossary}</PopoverItem>
      <PopoverSeparator />
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2 text-xs text-[var(--label-2)]">
        <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`} />
        <span className="min-w-0 flex-1 truncate" title={dictionaryLabel}>{dictionaryLabel}</span>
      </div>
    </GlassPopover>
  );
}
