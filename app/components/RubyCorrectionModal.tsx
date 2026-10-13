'use client';

import React from 'react';
import { Modal } from './Modal';
import { buttonClass, buttonActiveClass, inputClass } from './uiTokens';
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
  removeTokenRuby: () => void;
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
  removeTokenRuby,
  saveAndOpenNextReview,
  isAdvancingReview,
  t,
}: RubyCorrectionModalProps) {
  return (
    <Modal
      isOpen={!!editingToken}
      onClose={onClose}
      title={t.rubyModalTitle}
    >
      {editingToken && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-50/80 border border-zinc-200/80 p-3.5 rounded-xl">
            <div>
              <div className="text-[11px] text-zinc-500 mb-0.5">{t.currentCharLabel}</div>
              <div className="text-2xl font-bold text-zinc-900">{editingToken.surface}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-zinc-500 mb-0.5">{t.currentRubyLabel}</div>
              <div className="text-lg font-bold text-blue-600">{editingToken.currentRuby || t.noRuby}</div>
            </div>
          </div>

          {(() => {
            const line = annotatedLines.find(l => l.id === editingToken.lineId);
            if (!line) return null;
            const start = line.tokens.slice(0, editingToken.tokenIndex).reduce((sum, t) => sum + t.surface.length, 0);
            const before = line.cleanText.slice(Math.max(0, start - 24), start);
            const after = line.cleanText.slice(start + editingToken.surface.length, start + editingToken.surface.length + 24);
            return (
              <div className="text-xs text-zinc-600 bg-zinc-50/70 border border-zinc-200/80 p-3 rounded-lg leading-relaxed">
                <span className="text-zinc-500 font-medium mr-1">{t.contextSentenceLabel}</span>
                <span>{before}</span>
                <span className="bg-amber-100 text-zinc-900 font-bold px-1.5 py-0.5 rounded mx-0.5 border border-amber-200">
                  {editingToken.surface}
                </span>
                <span>{after}</span>
              </div>
            );
          })()}

          <div>
            <div className="text-xs font-medium text-zinc-700 mb-1.5">{t.rubyRangeLabel}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={editingToken.tokenIndex === 0}
                onClick={() => resizeRubyRange(editingToken.tokenIndex - 1, editingToken.tokenEndIndex)}
                className={`${buttonClass} px-3 py-1.5 text-xs disabled:opacity-40`}
              >{t.extendLeft}</button>
              <button
                type="button"
                disabled={editingToken.tokenEndIndex >= (annotatedLines.find(line => line.id === editingToken.lineId)?.tokens.length || 0) - 1}
                onClick={() => resizeRubyRange(editingToken.tokenIndex, editingToken.tokenEndIndex + 1)}
                className={`${buttonClass} px-3 py-1.5 text-xs disabled:opacity-40`}
              >{t.extendRight}</button>
              <button
                type="button"
                disabled={editingToken.tokenIndex === editingToken.tokenEndIndex}
                onClick={() => resizeRubyRange(editingToken.tokenIndex, editingToken.tokenEndIndex - 1)}
                className={`${buttonClass} px-3 py-1.5 text-xs disabled:opacity-40`}
              >{t.shrinkRange}</button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">{t.rubyRangeTip}</p>
            <div lang="ja" className="script-line text-center py-3 text-2xl text-zinc-900">
              <ruby>{editingToken.surface}<rt style={{ fontSize: `${rubyFontSize}px` }}>{customRubyInput || '\u00a0'}</rt></ruby>
            </div>
          </div>

          {editingToken.alternatives && editingToken.alternatives.length > 0 && (
            <div>
              <div className="text-xs font-medium text-zinc-700 mb-1.5">{t.frequentCandidates}</div>
              <div className="flex flex-wrap gap-1.5">
                {editingToken.alternatives.map((alt, aidx) => (
                  <button
                    key={aidx}
                    type="button"
                    onClick={() => setCustomRubyInput(alt)}
                    className={`${customRubyInput === alt ? buttonActiveClass : buttonClass} px-3 py-1 text-xs`}
                  >
                    {alt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2.5 flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
              <input type="checkbox" className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/10" checked={correctionScope === 'glossary'} onChange={event => setCorrectionScope(event.target.checked ? 'glossary' : 'occurrence')} />
              {t.addToGlossaryCheckbox}
            </label>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {t.customRubyInputLabel}
            </label>
            <input
              type="text"
              value={customRubyInput}
              onChange={(e) => setCustomRubyInput(e.target.value)}
              placeholder={t.customRubyInputPlaceholder}
              className={`${inputClass} w-full px-3 py-2 text-sm`}
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

          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={removeTokenRuby}
              className="text-xs text-red-600 hover:text-red-700 underline font-medium"
            >
              {t.clearRubyButton}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`${buttonClass} px-3.5 py-1.5 text-xs`}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={saveTokenRuby}
                className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 shadow-xs transition-colors"
              >
                {t.save}
              </button>
              <button
                type="button"
                onClick={saveAndOpenNextReview}
                disabled={isAdvancingReview}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 shadow-xs transition-colors"
              >
                {t.saveAndNextButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
