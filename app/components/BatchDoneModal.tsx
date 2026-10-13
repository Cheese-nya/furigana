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
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-lg text-center">
            <div className="text-2xl font-bold text-zinc-900">{results.total}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{t.totalFiles}</div>
          </div>
          <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-lg text-center">
            <div className="text-2xl font-bold text-emerald-600">{results.success}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{t.successExport}</div>
          </div>
          <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">{results.failed}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{t.failed}</div>
          </div>
          <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-lg text-center">
            <div className="text-2xl font-bold text-zinc-500">{results.cancelled}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{t.cancelledSave}</div>
          </div>
        </div>

        {results.filenames.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-zinc-700 mb-1.5">{t.exportedFilesLabel}</h4>
            <div className="max-h-[160px] overflow-y-auto space-y-1">
              {results.filenames.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200/70 rounded-md">
                  <span className="text-emerald-600 text-xs font-bold">✓</span>
                  <span className="text-xs text-zinc-800 truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-2.5 bg-zinc-50 border border-zinc-200/80 rounded-lg">
          <p className="text-xs font-medium text-zinc-600 text-center">
            {t.batchDoneNotice.replace('{count}', String(results.success))}
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-6 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-xs"
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </Modal>
  );
}
