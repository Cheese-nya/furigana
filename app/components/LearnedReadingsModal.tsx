'use client';

import React from 'react';
import { Modal } from './Modal';
import { IconBooks } from './glass/icons';
import type { LearnedReading } from '../utils/correctionDatabase';
import type { Translations } from '../utils/i18n';

interface LearnedReadingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnedReadings: LearnedReading[];
  onDeleteLearnedReading: (index: number) => void;
  t: Translations;
}

export function LearnedReadingsModal({ isOpen, onClose, learnedReadings, onDeleteLearnedReading, t }: LearnedReadingsModalProps) {
  return <Modal isOpen={isOpen} onClose={onClose} title={t.learnedModalTitle}>
    <div className="space-y-4"><p className="text-xs leading-relaxed text-[var(--label-2)]">{t.learnedModalDesc}</p>
      {learnedReadings.length === 0 ? <div className="grid place-items-center gap-2 py-8 text-center text-xs font-medium text-[var(--label-2)]"><IconBooks size={28} className="text-[var(--label-3)]" />{t.noLearnedRecords}</div> : <ul className="max-h-[320px] overflow-y-auto rounded-[18px] bg-[var(--surface)] shadow-[var(--card-shadow)]">{learnedReadings.map((item, index) => <li key={`${item.surface}-${item.before}-${item.after}`} className="flex items-center justify-between gap-3 border-b border-[var(--sep)] p-3 text-xs last:border-b-0"><div className="min-w-0 space-y-1"><div className="flex items-center gap-2"><span className="text-sm font-bold text-[var(--label)]">{item.surface}</span><span className="font-semibold text-[var(--ruby)]">→ {item.reading}</span><span className="text-[10px] uppercase tracking-wider text-[var(--label-3)]">({item.type})</span></div><p className="leading-relaxed text-[var(--label-2)]">{t.contextPrefix}{item.before ? `...${item.before}` : ''}<strong className="mx-0.5 rounded-md bg-[var(--fill)] px-1.5 py-0.5 text-[var(--label)]">[{item.surface}]</strong>{item.after ? `${item.after}...` : ''}</p></div><button type="button" aria-label={`${t.delete} ${item.surface}`} onClick={() => onDeleteLearnedReading(index)} className="btn btn-danger shrink-0">{t.delete}</button></li>)}</ul>}
      <div className="flex justify-end border-t border-[var(--sep)] pt-4"><button type="button" onClick={onClose} className="btn btn-ink h-11">{t.done}</button></div>
    </div>
  </Modal>;
}
