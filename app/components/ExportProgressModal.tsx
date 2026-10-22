'use client';

import React from 'react';
import { Modal } from './Modal';
import type { Translations } from '../utils/i18n';

interface ExportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  isExporting: boolean;
  exportFormat: 'docx' | 'srt' | 'txt';
  exportProgress: number;
  exportOutcome: 'processing' | 'saved' | 'download' | 'cancelled' | 'error';
  exportError: string;
  t: Translations;
}

export function ExportProgressModal({
  isOpen,
  onClose,
  isExporting,
  exportFormat,
  exportProgress,
  exportOutcome,
  exportError,
  t,
}: ExportProgressModalProps) {
  const getModalTitle = () => {
    switch (exportOutcome) {
      case 'processing':
        return t.exportModalProcessing;
      case 'cancelled':
        return t.exportModalCancelled;
      case 'error':
        return t.exportModalFailed;
      case 'download':
        return t.exportModalDownload;
      default:
        return t.exportModalDone;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isExporting && onClose()}
      title={getModalTitle()}
    >
      <div className="space-y-5 py-2">
        <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
          <span>{t.generatingProgress} ({exportFormat.toUpperCase()})</span>
          <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{exportProgress}%</span>
        </div>

        <div className="w-full h-2.5 rounded-full overflow-hidden liquid-glass-inset p-0.5 border border-white/80 dark:border-white/10 bg-slate-200/50 dark:bg-white/5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              exportOutcome === 'error'
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]'
            }`}
            style={{ width: `${exportProgress}%` }}
          />
        </div>

        <p
          role={exportOutcome === 'error' ? 'alert' : 'status'}
          className={`text-xs text-center leading-relaxed ${
            exportOutcome === 'error'
              ? 'text-rose-600 dark:text-rose-400 font-medium'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {exportOutcome === 'processing' && (exportProgress < 80 ? t.generatingFile.replace('{format}', exportFormat.toUpperCase()) : t.waitingForSave)}
          {exportOutcome === 'saved' && t.fileSaved}
          {exportOutcome === 'download' && t.downloadHandedOver}
          {exportOutcome === 'cancelled' && t.saveCancelled}
          {exportOutcome === 'error' && `${t.exportModalFailed}: ${exportError}`}
        </p>

        <div className="flex justify-end pt-2 border-t border-slate-200/60 dark:border-white/10">
          <button
            disabled={isExporting}
            onClick={onClose}
            className="lg-pill-interactive lg-btn-prominent liquid-glass-btn-primary px-6 py-2.5 min-h-[38px] text-xs font-semibold text-white rounded-full shadow-sm disabled:opacity-50 transition-all hover:shadow"
          >
            {isExporting ? t.processing : t.done}
          </button>
        </div>
      </div>
    </Modal>
  );
}
