'use client';

import React from 'react';
import type { Translations } from '../utils/i18n';
import { neuButton, glassPillGroupClass } from './uiTokens';

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
  return (
    <details className="relative group">
      <summary className={`${neuButton} cursor-pointer list-none px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs inline-flex items-center gap-1.5`}>
        <span className="font-serif font-semibold text-slate-700 dark:text-slate-200">Aa</span>
        <span>{t.typographySettings}</span>
      </summary>
      <div className="max-sm:fixed max-sm:inset-x-3 max-sm:top-20 sm:absolute sm:left-0 sm:top-full z-30 mt-2 grid sm:min-w-72 gap-3.5 p-4 rounded-[24px] lg-sheet">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-xs text-slate-700 dark:text-slate-200">{t.bodyFontSize}</span>
          <div className={`inline-flex items-center ${glassPillGroupClass}`}>
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="px-2.5 py-1 rounded-full lg-pill-interactive text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              -
            </button>
            <span className="px-2.5 py-1 font-semibold tabular-nums text-xs text-center text-slate-900 dark:text-slate-100 min-w-[48px]">
              {fontSize}px
            </span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(28, fontSize + 2))}
              className="px-2.5 py-1 rounded-full lg-pill-interactive text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-xs text-slate-700 dark:text-slate-200">{t.rubyFontSize}</span>
          <div className={`inline-flex items-center ${glassPillGroupClass}`}>
            <button
              type="button"
              onClick={() => setRubyFontSize(Math.max(8, rubyFontSize - 1))}
              className="px-2.5 py-1 rounded-full lg-pill-interactive text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              -
            </button>
            <span className="px-2.5 py-1 font-semibold tabular-nums text-xs text-center text-slate-900 dark:text-slate-100 min-w-[48px]">
              {rubyFontSize}px
            </span>
            <button
              type="button"
              onClick={() => setRubyFontSize(Math.min(18, rubyFontSize + 1))}
              className="px-2.5 py-1 rounded-full lg-pill-interactive text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-xs text-slate-700 dark:text-slate-200">{t.lineSpacing}</span>
          <div className={`inline-flex items-center ${glassPillGroupClass}`}>
            <button
              type="button"
              onClick={() => setLineSpacing(Number(Math.max(1.2, lineSpacing - 0.2).toFixed(1)))}
              className="px-2.5 py-1 rounded-full lg-pill-interactive text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              -
            </button>
            <span className="px-2.5 py-1 font-semibold tabular-nums text-xs text-center text-slate-900 dark:text-slate-100 min-w-[48px]">
              {lineSpacing}x
            </span>
            <button
              type="button"
              onClick={() => setLineSpacing(Number(Math.min(3.0, lineSpacing + 0.2).toFixed(1)))}
              className="px-2.5 py-1 rounded-full lg-pill-interactive text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-xs text-slate-700 dark:text-slate-200">{t.rubyColorLabel}</span>
          <div className="flex items-center gap-1.5">
            {(['#2563eb', '#4f46e5', '#0f766e', '#be185d', '#475569'] as const).map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setRubyColor(color)}
                aria-label={color}
                className={`h-5 w-5 rounded-full border lg-pill-interactive ${
                  rubyColor === color ? 'scale-110 ring-2 ring-blue-500/40 border-white' : 'border-black/10 dark:border-white/20 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setFontSize(16);
              setRubyFontSize(11);
              setLineSpacing(2.0);
              setRubyColor('#2563eb');
            }}
            className="px-2.5 py-1 rounded-full lg-pill-interactive text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {t.resetTypographyDefaults}
          </button>
        </div>
      </div>
    </details>
  );
}

export default TypographyPopover;
