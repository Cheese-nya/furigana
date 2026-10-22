'use client';

import React from 'react';
import { Modal } from './Modal';
import { LiquidSelector } from './glass/LiquidSelector';
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
  restoreAutomaticRuby: () => void;
  saveAndOpenNextReview: () => void;
  isAdvancingReview: boolean;
  t: Translations;
}

export function RubyCorrectionModal({
  editingToken, onClose, annotatedLines, rubyFontSize, customRubyInput,
  setCustomRubyInput, resizeRubyRange, correctionScope, setCorrectionScope,
  rubyCompositionRef, saveTokenRuby, restoreAutomaticRuby, saveAndOpenNextReview,
  isAdvancingReview, t,
}: RubyCorrectionModalProps) {
  const isZh = t.clearRubyButton?.includes('清除') || t.save === '保存';
  const labelRestoreAuto = isZh ? '恢复自动' : 'Restore auto';
  const labelOnlyThisLine = isZh ? '仅此行' : 'Only this line';
  const labelApplyAll = isZh ? '应用到所有行' : 'Apply to all lines';
  const line = editingToken ? annotatedLines.find(item => item.id === editingToken.lineId) : undefined;
  const atFirstToken = editingToken?.tokenIndex === 0;
  const atLastToken = !!editingToken && editingToken.tokenEndIndex >= (line?.tokens.length ?? 1) - 1;
  const singleToken = editingToken?.tokenIndex === editingToken?.tokenEndIndex;

  return (
    <Modal isOpen={!!editingToken} onClose={onClose} title={t.rubyModalTitle}>
      {editingToken && (
        <div className="space-y-4" data-correction-scope={correctionScope}>
          <div data-testid="ruby-modal-header-card" className="text-center">
            <div className="text-xs font-semibold text-[var(--label-2)]">修改读音 · {t.currentRubyLabel}</div>
            <ruby lang="ja" className="my-1 block font-[family-name:var(--font-mincho)] text-[40px] leading-[1.35] text-[var(--label)]">
              {editingToken.surface}<rt className="text-[16px] text-[var(--review)]">{customRubyInput || editingToken.currentRuby || t.noRuby}</rt>
            </ruby>
            <p className="text-xs text-[var(--label-2)]">{t.currentCharLabel}: {editingToken.surface}</p>
          </div>

          {line && (() => {
            const start = line.tokens.slice(0, editingToken.tokenIndex).reduce((sum, token) => sum + token.surface.length, 0);
            const before = line.cleanText.slice(Math.max(0, start - 24), start);
            const after = line.cleanText.slice(start + editingToken.surface.length, start + editingToken.surface.length + 24);
            return <p className="rounded-xl bg-[var(--fill-2)] p-3 text-xs leading-relaxed text-[var(--label-2)]">
              <span>{t.contextSentenceLabel} </span>{before}<strong className="rounded-md bg-[color-mix(in_srgb,var(--review)_14%,transparent)] px-1.5 py-0.5 text-[var(--review)]">{editingToken.surface}</strong>{after}
            </p>;
          })()}

          {editingToken.alternatives.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--label)]">{t.frequentCandidates}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {editingToken.alternatives.map((alternative) => (
                  <button key={alternative} type="button" aria-pressed={customRubyInput === alternative} onClick={() => setCustomRubyInput(alternative)} className={`btn ${customRubyInput === alternative ? 'btn-ink' : ''}`}>
                    {alternative}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="grid gap-2 text-xs font-semibold text-[var(--label)]">
            {t.customRubyInputLabel}
            <input
              type="text" value={customRubyInput} onChange={event => setCustomRubyInput(event.target.value)} placeholder={t.customRubyInputPlaceholder}
              className="liquid-glass-inset h-[42px] w-full rounded-xl bg-[var(--fill-2)] px-3 text-sm text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--fill)]"
              autoFocus onCompositionStart={() => { rubyCompositionRef.current = true; }} onCompositionEnd={() => { rubyCompositionRef.current = false; }}
              onKeyDown={event => {
                if (event.key === 'Enter' && !rubyCompositionRef.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                  event.preventDefault();
                  saveTokenRuby();
                }
              }}
            />
          </label>

          <div className="grid gap-2">
            <p className="text-xs font-semibold text-[var(--label)]">{t.rubyRangeLabel}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={atFirstToken} onClick={() => resizeRubyRange(editingToken.tokenIndex - 1, editingToken.tokenEndIndex)} className="liquid-glass-btn btn">{t.extendLeft}</button>
              <button type="button" disabled={atLastToken} onClick={() => resizeRubyRange(editingToken.tokenIndex, editingToken.tokenEndIndex + 1)} className="liquid-glass-btn btn">{t.extendRight}</button>
              <button type="button" disabled={singleToken} onClick={() => resizeRubyRange(editingToken.tokenIndex, editingToken.tokenEndIndex - 1)} className="liquid-glass-btn btn">{t.shrinkRange}</button>
            </div>
            <p className="text-[11px] text-[var(--label-3)]">{t.rubyRangeTip}</p>
            <ruby lang="ja" className="rounded-xl bg-[var(--fill-2)] p-3 text-center font-[family-name:var(--font-mincho)] text-2xl text-[var(--label)]">
              {editingToken.surface}<rt style={{ fontSize: `${rubyFontSize}px` }} className="text-[var(--review)]">{customRubyInput || '\u00a0'}</rt>
            </ruby>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-semibold text-[var(--label)]">{t.rubyModalTitle}</p>
            <LiquidSelector
              className="w-full [&_[data-opt]]:flex-1"
              variant="solid"
              role="radiogroup"
              ariaLabel={t.rubyModalTitle}
              value={correctionScope}
              onChange={setCorrectionScope}
              options={[{ value: 'occurrence', label: labelOnlyThisLine }, { value: 'glossary', label: labelApplyAll }]}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-[var(--sep)] pt-4">
            <button type="button" onClick={onClose} className="btn h-11 justify-center">{t.cancel}</button>
            <button type="button" onClick={restoreAutomaticRuby} className="btn btn-plain h-11 justify-center">{labelRestoreAuto}</button>
            <button type="button" onClick={saveTokenRuby} className="btn btn-ink h-11 justify-center">{t.save}</button>
            <button type="button" onClick={saveAndOpenNextReview} disabled={isAdvancingReview} className="btn btn-ink h-11 justify-center disabled:opacity-50">{t.saveAndNextButton}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
