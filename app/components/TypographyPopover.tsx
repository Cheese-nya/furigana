'use client';

import React, { useState } from 'react';
import type { Translations } from '../utils/i18n';
import { GlassButton } from './glass/GlassButton';
import { GlassPopover } from './glass/GlassPopover';
import { IconTextFormat } from './glass/icons';

export interface TypographyPopoverProps {
  fontSize: number;
  setFontSize: (size: number) => void;
  rubyFontSize: number;
  setRubyFontSize: (size: number) => void;
  lineSpacing: number;
  setLineSpacing: (spacing: number) => void;
  rubyColor: string;
  setRubyColor: (color: string) => void;
  t: Translations;
}

export function TypographyPopover({
  fontSize,
  setFontSize,
  rubyFontSize,
  setRubyFontSize,
  lineSpacing,
  setLineSpacing,
  rubyColor,
  setRubyColor,
  t,
}: TypographyPopoverProps) {
  const [open, setOpen] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const rubyColors = [
    { value: 'var(--ruby)', label: t.rubyColorLabel },
    { value: 'var(--label-2)', label: t.bodyFontSize },
    { value: 'var(--label)', label: t.typographySettings },
    { value: 'var(--review)', label: t.needsReviewBadge },
    { value: 'var(--ok)', label: t.manualSource },
  ];

  return (
    <>
      <GlassButton
        ref={setTriggerEl}
        variant="item"
        onClick={() => setOpen(previous => !previous)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <IconTextFormat />
        <span>{t.typographySettings}</span>
      </GlassButton>
      <GlassPopover
        open={open}
        onClose={() => setOpen(false)}
        anchor={triggerEl}
        ariaLabel={t.typographySettings}
        className="w-[min(18rem,calc(100vw-1.5rem))] p-4"
      >
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--label-2)]">{t.bodyFontSize}</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={12}
                max={28}
                value={fontSize}
                onChange={event => setFontSize(Number(event.target.value))}
                className="w-full accent-[var(--label)]"
              />
              <output className="w-10 text-right text-xs font-semibold tabular-nums text-[var(--label)]">{fontSize}px</output>
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--label-2)]">{t.rubyFontSize}</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={8}
                max={18}
                value={rubyFontSize}
                onChange={event => setRubyFontSize(Number(event.target.value))}
                className="w-full accent-[var(--label)]"
              />
              <output className="w-10 text-right text-xs font-semibold tabular-nums text-[var(--label)]">{rubyFontSize}px</output>
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--label-2)]">{t.lineSpacing}</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1.2}
                max={3}
                step={0.1}
                value={lineSpacing}
                onChange={event => setLineSpacing(Number(event.target.value))}
                className="w-full accent-[var(--label)]"
              />
              <output className="w-10 text-right text-xs font-semibold tabular-nums text-[var(--label)]">{lineSpacing.toFixed(1)}x</output>
            </div>
          </label>

          <div className="grid gap-1.5" data-testid="ruby-color-picker">
            <span className="text-xs font-medium text-[var(--label-2)]">{t.rubyColorLabel}</span>
            <div className="flex items-center gap-2" role="group" aria-label={t.rubyColorLabel}>
              {rubyColors.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setRubyColor(color.value)}
                  aria-label={color.label}
                  aria-pressed={rubyColor === color.value}
                  className={`h-6 w-6 rounded-full border border-[var(--sep)] transition-transform hover:scale-105 ${
                    rubyColor === color.value ? 'ring-2 ring-[var(--label)] ring-offset-2 ring-offset-[var(--surface)]' : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-[color:var(--sep)] pt-3 text-right">
            <button
              type="button"
              onClick={() => {
                setFontSize(16);
                setRubyFontSize(11);
                setLineSpacing(2);
                setRubyColor('var(--ruby)');
              }}
              className="btn btn-plain h-8 px-3 text-xs"
            >
              {t.resetTypographyDefaults}
            </button>
          </div>
        </div>
      </GlassPopover>
    </>
  );
}

export default TypographyPopover;
