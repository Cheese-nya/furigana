'use client';

import React from 'react';
import { Modal } from './Modal';
import type { LearnedReading } from '../utils/correctionDatabase';
import type { Translations } from '../utils/i18n';

interface LearnedReadingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnedReadings: LearnedReading[];
  onDeleteLearnedReading: (index: number) => void;
  t: Translations;
}

export function LearnedReadingsModal({
  isOpen,
  onClose,
  learnedReadings,
  onDeleteLearnedReading,
  t,
}: LearnedReadingsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.learnedModalTitle}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {t.learnedModalDesc}
        </p>
        {learnedReadings.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-medium">{t.noLearnedRecords}</div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1">
            {learnedReadings.map((item, idx) => (
              <div key={`${item.surface}-${item.before}-${item.after}`} className="lg-grouped-card flex items-center justify-between p-3.5 rounded-2xl text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{item.surface}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">→ {item.reading}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">({item.type})</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    {t.contextPrefix}<span>{item.before ? `...${item.before}` : ''}</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold px-1.5 py-0.5 mx-0.5 bg-slate-100/80 dark:bg-white/10 rounded-md">[{item.surface}]</strong>
                    <span>{item.after ? `${item.after}...` : ''}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`${t.delete} ${item.surface}`}
                  onClick={() => onDeleteLearnedReading(idx)}
                  className="lg-pill-interactive rounded-full border border-rose-200/70 dark:border-rose-500/20 bg-rose-50/70 dark:bg-rose-500/10 px-3.5 py-1.5 min-h-[32px] text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors ml-3 flex-shrink-0"
                >
                  {t.delete}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-3 border-t border-slate-200/60 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="lg-pill-interactive lg-btn-prominent liquid-glass-btn-primary px-6 py-2.5 min-h-[38px] text-xs font-semibold text-white rounded-full shadow-sm hover:shadow transition-all"
          >
            {t.done}
          </button>
        </div>
      </div>
    </Modal>
  );
}
