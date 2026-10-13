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
        <p className="text-xs text-zinc-500 leading-relaxed">
          {t.learnedModalDesc}
        </p>
        {learnedReadings.length === 0 ? (
          <div className="text-center py-6 text-zinc-400 text-xs">{t.noLearnedRecords}</div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {learnedReadings.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50/70 border border-zinc-200/80 rounded-lg text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 text-sm">{item.surface}</span>
                    <span className="font-medium text-blue-600">→ {item.reading}</span>
                    <span className="text-[10px] text-zinc-400">({item.type})</span>
                  </div>
                  <div className="text-zinc-500 text-[11px]">
                    {t.contextPrefix}<span>{item.before ? `...${item.before}` : ''}</span>
                    <strong className="text-zinc-800 font-semibold">[{item.surface}]</strong>
                    <span>{item.after ? `${item.after}...` : ''}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteLearnedReading(idx)}
                  className="text-red-600 hover:text-red-700 underline text-xs ml-3 flex-shrink-0"
                >
                  {t.delete}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-1 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-xs"
          >
            {t.done}
          </button>
        </div>
      </div>
    </Modal>
  );
}
