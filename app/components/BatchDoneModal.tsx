'use client';

import React from 'react';
import { Modal } from './Modal';
import type { Translations } from '../utils/i18n';

export interface BatchDoneResults {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  filenames: string[];
}

interface BatchDoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: BatchDoneResults;
  t: Translations;
}

export function BatchDoneModal({
  isOpen,
  onClose,
  results,
  t,
}: BatchDoneModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.batchDoneTitle}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 tabular-nums">
          <div className="lg-grouped-card p-4 rounded-2xl text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{results.total}</div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{t.totalFiles}</div>
          </div>
          <div className="lg-grouped-card p-4 rounded-2xl text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{results.success}</div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{t.successExport}</div>
          </div>
          <div className="lg-grouped-card p-4 rounded-2xl text-center">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{results.failed}</div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{t.failed}</div>
          </div>
          <div className="lg-grouped-card p-4 rounded-2xl text-center">
            <div className="text-2xl font-bold text-slate-400 dark:text-slate-500">{results.cancelled}</div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{t.cancelledSave}</div>
          </div>
        </div>

        {results.filenames.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t.exportedFilesLabel}</h4>
            <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
              {results.filenames.map((name, idx) => (
                <div key={idx} className="lg-grouped-card flex items-center gap-2 px-3 py-2 rounded-xl">
                  <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-slate-800 dark:text-slate-200 truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="lg-grouped-card p-3 rounded-2xl">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center tabular-nums">
            {t.batchDoneNotice.replace('{count}', String(results.success))}
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200/60 dark:border-white/10">
          <button
            onClick={onClose}
            className="lg-pill-interactive lg-btn-prominent liquid-glass-btn-primary px-6 py-2.5 min-h-[38px] text-xs font-semibold text-white rounded-full shadow-sm hover:shadow transition-all"
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </Modal>
  );
}
