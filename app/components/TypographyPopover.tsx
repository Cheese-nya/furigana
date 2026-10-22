'use client';

import React from 'react';
import { GlassPopover } from './glass/GlassPopover';
import { LiquidSelector } from './glass/LiquidSelector';
import type { Translations } from '../utils/i18n';

type RubyMode = 'hiragana' | 'katakana' | 'romaji';

export interface TypographyPopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  placement?: 'below' | 'above';
  fontFamily: 'serif' | 'sans';
  onFontFamilyChange: (value: 'serif' | 'sans') => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  showRuby: boolean;
  onShowRubyChange: (value: boolean) => void;
  /** Ruby mode row (phones, where the toolbar has no room for it). */
  rubyType?: RubyMode;
  onRubyTypeChange?: (value: RubyMode) => void;
  /** Writing direction row (reader only). */
  writingMode?: 'horizontal' | 'vertical';
  onWritingModeChange?: (value: 'horizontal' | 'vertical') => void;
  t: Translations;
}

const SEG = 'flex w-full [&>[data-opt]]:h-7 [&>[data-opt]]:flex-1 [&>[data-opt]]:px-2 [&>[data-opt]]:text-[13px]';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1.5 pt-2">
      <div className="mb-1.5 text-xs font-semibold text-[var(--label-2)]">{label}</div>
      {children}
    </div>
  );
}

/** Mockup "排版" popover: ruby mode (phones), font, size, show-ruby switch. */
export function TypographyPopover({
  open, onClose, anchor, placement, fontFamily, onFontFamilyChange, fontSize, onFontSizeChange, showRuby, onShowRubyChange,
  rubyType, onRubyTypeChange, writingMode, onWritingModeChange, t,
}: TypographyPopoverProps) {
  return (
    <GlassPopover open={open} onClose={onClose} anchor={anchor} placement={placement} ariaLabel={t.typographySettings} className="w-[280px]">
      {rubyType && onRubyTypeChange && (
        <Group label={t.rubyLabel}>
          <LiquidSelector
            variant="solid"
            className={SEG}
            role="radiogroup"
            ariaLabel={t.rubyLabel}
            value={rubyType}
            onChange={onRubyTypeChange}
            options={[
              { value: 'hiragana', label: t.hiragana },
              { value: 'katakana', label: t.katakana },
              { value: 'romaji', label: t.romaji },
            ]}
          />
        </Group>
      )}
      {writingMode && onWritingModeChange && (
        <Group label={t.writingModeShort}>
          <LiquidSelector
            variant="solid"
            className={SEG}
            role="radiogroup"
            ariaLabel={t.writingModeShort}
            testId="reader-writing-mode-toggle"
            value={writingMode}
            onChange={onWritingModeChange}
            options={[
              { value: 'horizontal', label: t.writingModeHorizontal },
              { value: 'vertical', label: t.writingModeVertical },
            ]}
          />
        </Group>
      )}
      <Group label={t.fontLabel}>
        <LiquidSelector
          variant="solid"
          className={SEG}
          role="radiogroup"
          ariaLabel={t.fontLabel}
          value={fontFamily}
          onChange={onFontFamilyChange}
          options={[
            { value: 'serif', label: t.fontMinchoShort },
            { value: 'sans', label: t.fontGothicShort },
          ]}
        />
      </Group>
      <Group label={t.fontSizeLabel}>
        <input
          type="range"
          min={14}
          max={26}
          value={fontSize}
          aria-label={t.fontSizeLabel}
          onChange={event => onFontSizeChange(Number(event.target.value))}
          className="w-full accent-[var(--label)]"
        />
      </Group>
      <div className="flex items-center justify-between px-3 py-2 font-medium">
        {t.showRubyLabel}
        <button type="button" role="switch" aria-checked={showRuby} aria-label={t.showRubyLabel} className="switch" onClick={() => onShowRubyChange(!showRuby)}>
          <i />
        </button>
      </div>
    </GlassPopover>
  );
}
