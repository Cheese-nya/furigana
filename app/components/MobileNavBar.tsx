'use client';

import React, { useState } from 'react';
import { LiquidSelector } from './glass/LiquidSelector';
import { GlassButton } from './glass/GlassButton';
import { useGlass } from './glass/hooks';
import { IconBooks, IconEdit, IconGear, IconRead, IconStack } from './glass/icons';
import type { Translations } from '../utils/i18n';

export type AppTab = 'editor' | 'library' | 'reader' | 'batch_files';

export interface MobileNavBarProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  bookCount?: number;
  /** Slides away (reader immersion). */
  hidden?: boolean;
  renderSettings: (anchor: HTMLElement | null, open: boolean, close: () => void) => React.ReactNode;
  t: Translations;
}

/** Phone tab bar: one glass capsule of tabs plus a round settings button. */
export function MobileNavBar({ activeTab, onChange, bookCount = 0, hidden = false, renderSettings, t }: MobileNavBarProps) {
  const glassRef = useGlass<HTMLElement>();
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLButtonElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tab = (icon: React.ReactNode, label: string, badge?: number) => (
    <span className="flex flex-col items-center justify-center gap-px">
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--ink)] px-1 text-[8px] font-bold tabular-nums leading-none text-[var(--on-ink)]">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </span>
  );

  return (
    <div
      aria-hidden={hidden || undefined}
      className={`fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 px-4 pb-[max(14px,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-[600ms] [transition-timing-function:var(--spring-smooth)] md:hidden ${
        hidden ? 'pointer-events-none translate-y-[160%] opacity-0' : ''
      }`}
    >
      <nav ref={glassRef} data-testid="mobile-nav-bar" aria-label={t.sidebarTitle} className="glass flex h-[52px] items-center rounded-full p-[3px]">
        <LiquidSelector
          variant="bare"
          ariaLabel={t.sidebarTitle}
          className="h-full [&>[data-opt]]:flex [&>[data-opt]]:h-[46px] [&>[data-opt]]:w-[68px] [&>[data-opt]]:items-center [&>[data-opt]]:justify-center [&>[data-opt]]:rounded-full [&>[data-opt]]:text-[10px] [&>[data-opt]]:font-semibold [&>[data-opt][aria-selected=false]]:text-[var(--label-2)] min-[400px]:[&>[data-opt]]:w-[74px]"
          value={activeTab}
          onChange={onChange}
          options={[
            { value: 'editor', label: tab(<IconEdit size={20} />, t.mobileNavEditor) },
            { value: 'library', label: tab(<IconBooks size={20} />, t.mobileNavLibrary, bookCount) },
            { value: 'reader', label: tab(<IconRead size={20} />, t.mobileNavReader) },
            { value: 'batch_files', label: tab(<IconStack size={20} />, t.mobileNavBatch) },
          ]}
        />
      </nav>
      <GlassButton
        ref={setSettingsAnchor}
        variant="glass"
        icon
        aria-label={t.settingsTitle}
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen(open => !open)}
        className="!h-[52px] !w-[52px]"
      >
        <IconGear size={20} />
      </GlassButton>
      {renderSettings(settingsAnchor, settingsOpen, () => setSettingsOpen(false))}
    </div>
  );
}
