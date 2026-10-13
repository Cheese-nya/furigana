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
        <div className="flex items-center justify-between text-xs font-medium text-zinc-700">
          <span>{t.generatingProgress} ({exportFormat.toUpperCase()})</span>
          <span>{exportProgress}%</span>
        </div>

        <div className="w-full h-2 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 rounded-full transition-all duration-300"
            style={{ width: `${exportProgress}%` }}
          />
        </div>

        <p role={exportOutcome === 'error' ? 'alert' : 'status'} className="text-xs text-center text-zinc-600">
          {exportOutcome === 'processing' && (exportProgress < 80 ? t.generatingFile.replace('{format}', exportFormat.toUpperCase()) : t.waitingForSave)}
          {exportOutcome === 'saved' && t.fileSaved}
          {exportOutcome === 'download' && t.downloadHandedOver}
          {exportOutcome === 'cancelled' && t.saveCancelled}
          {exportOutcome === 'error' && `${t.exportModalFailed}: ${exportError}`}
        </p>

        <div className="flex justify-end pt-1">
          <button
            disabled={isExporting}
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            {isExporting ? t.processing : t.done}
          </button>
        </div>
      </div>
    </Modal>
  );
}
