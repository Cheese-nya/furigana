'use client';

import React from 'react';
import { Modal } from './Modal';
import type { ScriptLine } from '../utils/furigana';
import type { Translations } from '../utils/i18n';

export interface EditingTokenState {
  lineId: string;
  tokenIndex: number;
  tokenEndIndex: number;
  surface: string;
  currentRuby: string;
  alternatives: string[];
}

interface RubyCorrectionModalProps {
  editingToken: EditingTokenState | null;
  onClose: () => void;
  annotatedLines: ScriptLine[];
  rubyFontSize: number;
  customRubyInput: string;
  setCustomRubyInput: (value: string) => void;
  resizeRubyRange: (startIndex: number, endIndex: number) => void;
  correctionScope: 'occurrence' | 'glossary';
  setCorrectionScope: (scope: 'occurrence' | 'glossary') => void;
  rubyCompositionRef: React.MutableRefObject<boolean>;
  saveTokenRuby: () => void;
  /** Drop the corrections (and learned readings) behind this range so the automatic reading returns. */
  restoreAutomaticRuby: () => void;
  saveAndOpenNextReview: () => void;
  isAdvancingReview: boolean;
  t: Translations;
}

export function RubyCorrectionModal({
  editingToken,
  onClose,
  annotatedLines,
  rubyFontSize,
  customRubyInput,
  setCustomRubyInput,
  resizeRubyRange,
  correctionScope,
  setCorrectionScope,
  rubyCompositionRef,
  saveTokenRuby,
  restoreAutomaticRuby,
  saveAndOpenNextReview,
  isAdvancingReview,
  t,
}: RubyCorrectionModalProps) {
  const isZh = t.clearRubyButton?.includes('清除') || t.save === '保存';
  const labelRestoreAuto = isZh ? '恢复自动' : 'Restore auto';
  const labelOnlyThisLine = isZh ? '仅此行' : 'Only this line';
  const labelApplyAll = isZh ? '应用到所有行' : 'Apply to all lines';

  return (
    <Modal
      isOpen={!!editingToken}
      onClose={onClose}
      title={t.rubyModalTitle}
    >
      {editingToken && (
        <div className="space-y-4" data-correction-scope={correctionScope}>
          {/* Target Kanji & Ruby Preview Header Card */}
          <div
            data-testid="ruby-modal-header-card"
            className="flex items-center justify-between bg-white/75 backdrop-blur-xl border border-white/80 dark:bg-white/[0.06] dark:border-white/10 dark:text-slate-100 p-4 rounded-2xl shadow-[0_8px_24px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">{t.currentCharLabel}</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{editingToken.surface}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">{t.currentRubyLabel}</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{editingToken.currentRuby || t.noRuby}</div>
            </div>
          </div>

          {/* Context Sentence */}
          {(() => {
            const line = annotatedLines.find(l => l.id === editingToken.lineId);
            if (!line) return null;
            const start = line.tokens.slice(0, editingToken.tokenIndex).reduce((sum, t) => sum + t.surface.length, 0);
            const before = line.cleanText.slice(Math.max(0, start - 24), start);
            const after = line.cleanText.slice(start + editingToken.surface.length, start + editingToken.surface.length + 24);
            return (
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-white/65 backdrop-blur-xl border border-white/75 dark:bg-white/[0.05] dark:border-white/10 p-3.5 rounded-2xl leading-relaxed shadow-2xs">
                <span className="text-slate-400 dark:text-slate-400 font-medium mr-1.5">{t.contextSentenceLabel}</span>
                <span>{before}</span>
                <span className="bg-amber-100/90 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200 font-bold px-1.5 py-0.5 rounded-md mx-0.5 border border-amber-200 dark:border-amber-400/35 shadow-2xs">
                  {editingToken.surface}
                </span>
                <span>{after}</span>
              </div>
            );
          })()}

          {/* Range Adjustment & Live Preview */}
          <div className="bg-white/65 backdrop-blur-xl border border-white/75 dark:bg-white/[0.05] dark:border-white/10 p-3.5 sm:p-4 rounded-2xl shadow-2xs space-y-2.5">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.rubyRangeLabel}</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={editingToken.tokenIndex === 0}
                onClick={() => resizeRubyRange(editingToken.tokenIndex - 1, editingToken.tokenEndIndex)}
                className="lg-pill-interactive liquid-glass-btn inline-flex min-h-10 sm:min-h-9 flex-1 sm:flex-none items-center justify-center px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full disabled:opacity-40 active:scale-[0.98] transition-all"
              >{t.extendLeft}</button>
              <button
                type="button"
                disabled={editingToken.tokenEndIndex >= (annotatedLines.find(line => line.id === editingToken.lineId)?.tokens.length || 0) - 1}
                onClick={() => resizeRubyRange(editingToken.tokenIndex, editingToken.tokenEndIndex + 1)}
                className="lg-pill-interactive liquid-glass-btn inline-flex min-h-10 sm:min-h-9 flex-1 sm:flex-none items-center justify-center px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full disabled:opacity-40 active:scale-[0.98] transition-all"
              >{t.extendRight}</button>
              <button
                type="button"
                disabled={editingToken.tokenIndex === editingToken.tokenEndIndex}
                onClick={() => resizeRubyRange(editingToken.tokenIndex, editingToken.tokenEndIndex - 1)}
                className="lg-pill-interactive liquid-glass-btn inline-flex min-h-10 sm:min-h-9 flex-1 sm:flex-none items-center justify-center px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full disabled:opacity-40 active:scale-[0.98] transition-all"
              >{t.shrinkRange}</button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-400">{t.rubyRangeTip}</p>
            <div
              lang="ja"
              className="script-line text-center py-3 px-4 rounded-xl bg-white/60 dark:bg-black/25 border border-slate-200/60 dark:border-white/10 text-2xl text-slate-900 dark:text-slate-100"
            >
              <ruby>{editingToken.surface}<rt style={{ fontSize: `${rubyFontSize}px` }}>{customRubyInput || '\u00a0'}</rt></ruby>
            </div>
          </div>

          {/* Frequent Candidates */}
          {editingToken.alternatives && editingToken.alternatives.length > 0 && (
            <div className="bg-white/70 backdrop-blur-xl border border-white/75 dark:bg-white/[0.05] dark:border-white/10 p-3.5 sm:p-4 rounded-2xl shadow-2xs space-y-2.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.frequentCandidates}</div>
              <div className="flex flex-wrap gap-2">
                {editingToken.alternatives.map((alt, aidx) => (
                  <button
                    key={aidx}
                    type="button"
                    aria-pressed={customRubyInput === alt}
                    onClick={() => setCustomRubyInput(alt)}
                    className={`${
                      customRubyInput === alt
                        ? 'liquid-glass-btn-primary text-white shadow-sm'
                        : 'liquid-glass-btn text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
                    } lg-pill-interactive inline-flex min-h-9 items-center justify-center px-4 py-1.5 text-xs font-medium rounded-full transition-all active:scale-[0.97]`}
                  >
                    {alt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t.customRubyInputLabel}
            </label>
            <input
              type="text"
              value={customRubyInput}
              onChange={(e) => setCustomRubyInput(e.target.value)}
              placeholder={t.customRubyInputPlaceholder}
              className="liquid-glass-inset w-full min-h-11 px-4 py-2.5 text-sm rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              autoFocus
              onCompositionStart={() => { rubyCompositionRef.current = true; }}
              onCompositionEnd={() => { rubyCompositionRef.current = false; }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !rubyCompositionRef.current && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                  e.preventDefault();
                  saveTokenRuby();
                }
              }}
            />
          </div>

          {/* Action Bar with Clean Liquid Glass Hierarchy */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-3.5 border-t border-slate-200/70 dark:border-white/10">
            {/* Subtle Ghost Button for Restore Auto */}
            <button
              type="button"
              onClick={restoreAutomaticRuby}
              className="lg-pill-interactive inline-flex min-h-9 items-center justify-center text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-1.5 rounded-full hover:bg-rose-50/70 dark:hover:bg-rose-500/10 transition-colors font-medium"
            >
              {labelRestoreAuto}
            </button>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="lg-pill-interactive liquid-glass-btn inline-flex min-h-10 items-center justify-center px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 rounded-full"
              >
                {t.cancel}
              </button>

              {/* Secondary Glass Pill for "Only this line" */}
              <button
                type="button"
                onClick={() => {
                  setCorrectionScope('occurrence');
                  saveTokenRuby();
                }}
                className="lg-pill-interactive liquid-glass-btn inline-flex min-h-10 items-center justify-center px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-full shadow-xs"
              >
                {labelOnlyThisLine}
              </button>

              {/* Primary Indigo Glass CTA for "Apply to all lines" */}
              <button
                type="button"
                onClick={() => {
                  setCorrectionScope('glossary');
                  saveTokenRuby();
                }}
                className="lg-pill-interactive lg-btn-prominent liquid-glass-btn-primary inline-flex min-h-10 items-center justify-center px-4 py-2 text-xs font-semibold text-white rounded-full shadow-sm"
              >
                {labelApplyAll}
              </button>

              {/* Optional Next Review Button */}
              {saveAndOpenNextReview && (
                <button
                  type="button"
                  onClick={saveAndOpenNextReview}
                  disabled={isAdvancingReview}
                  className="lg-pill-interactive liquid-glass-btn inline-flex min-h-10 items-center justify-center px-4 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 rounded-full shadow-xs disabled:opacity-50"
                >
                  {t.saveAndNextButton}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
