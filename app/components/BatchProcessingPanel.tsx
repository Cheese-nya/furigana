'use client';

import React from 'react';
import { cardClass, badgeClass, buttonClass, buttonActiveClass } from './uiTokens';
import type { Translations } from '../utils/i18n';

export interface BatchFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  lineCount?: number;
  content?: string;
  error?: string;
}

interface BatchProcessingPanelProps {
  batchTargetFormat: 'docx' | 'srt' | 'txt';
  setBatchTargetFormat: (format: 'docx' | 'srt' | 'txt') => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  batchFiles: BatchFileItem[];
  clearBatchFiles: () => void;
  removeBatchFile: (id: string) => void;
  processBatchQueue: () => void;
  isBatchProcessing: boolean;
  isKuromojiLoading: boolean;
  correctionsReady: boolean;
  t: Translations;
}

export function BatchProcessingPanel({
  batchTargetFormat,
  setBatchTargetFormat,
  handleDrop,
  handleFileSelect,
  fileInputRef,
  batchFiles,
  clearBatchFiles,
  removeBatchFile,
  processBatchQueue,
  isBatchProcessing,
  isKuromojiLoading,
  correctionsReady,
  t,
}: BatchProcessingPanelProps) {
  return (
    <section className="flex-1 flex flex-col gap-6">
      {/* Header Card */}
      <div className={`${cardClass} p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6`}>
        <div className="space-y-2.5 max-w-2xl">
          <span className={badgeClass}>
            📁 {t.batchTab.replace('📁 ', '')}
          </span>
          <h2 className="font-semibold text-xl md:text-2xl text-zinc-900 tracking-tight">
            {t.batchTitle}
          </h2>
          <p className="text-xs md:text-sm text-zinc-500 leading-relaxed">
            {t.batchDesc}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-xs text-zinc-700">{t.targetExportFormat}</span>
          <div className="flex items-center gap-1.5">
            {(['docx', 'srt', 'txt'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => setBatchTargetFormat(fmt)}
                className={`${batchTargetFormat === fmt ? buttonActiveClass : buttonClass} px-3.5 py-1.5 text-xs uppercase`}
              >
                .{fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`${cardClass} border-2 border-dashed border-zinc-200/90 hover:border-zinc-300 bg-zinc-50/30 p-10 text-center flex flex-col items-center justify-center gap-3.5 transition-colors`}
      >
        <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 shadow-xs">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-sm text-zinc-900">{t.dragDropPrompt}</p>
          <p className="text-xs text-zinc-500 mt-1">{t.dragDropSupport}</p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept=".txt,.srt,.docx"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`${buttonClass} px-5 py-2 text-xs font-medium text-zinc-800 mt-1`}
        >
          {t.selectFiles}
        </button>
      </div>

      {/* File List & Progress Cards */}
      {batchFiles.length > 0 && (
        <div className={`${cardClass} p-5 flex flex-col gap-4`}>
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
            <span className="font-semibold text-xs text-zinc-800">
              {t.pendingQueue} ({batchFiles.length})
            </span>
            <button
              onClick={clearBatchFiles}
              disabled={isBatchProcessing}
              className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              {t.clearQueue}
            </button>
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {batchFiles.map(file => (
              <div
                key={file.id}
                className="p-3 bg-zinc-50/70 border border-zinc-200/70 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-7 h-7 rounded bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-zinc-600 uppercase">
                    {file.name.split('.').pop()}
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-xs text-zinc-900 truncate">{file.name}</p>
                    <p className="text-[11px] text-zinc-500">{(file.size / 1024).toFixed(1)} KB {file.lineCount ? `• ${file.lineCount} ${t.linesCount}` : ''}</p>
                    {file.error && <p role="alert" className="text-xs text-red-600 whitespace-normal">{file.error}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {file.status === 'pending' && <span className={badgeClass}>{t.waiting}</span>}
                  {file.status === 'processing' && (
                    <span className="text-xs text-blue-600 font-semibold flex items-center gap-1.5">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                      {t.processing}
                    </span>
                  )}
                  {file.status === 'done' && <span className="text-xs text-emerald-600 font-semibold">✓ {t.success}</span>}
                  {file.status === 'error' && <span className="text-xs text-red-500 font-semibold">✕ {t.failed}</span>}

                  <button
                    onClick={() => removeBatchFile(file.id)}
                    disabled={isBatchProcessing}
                    className="w-6 h-6 rounded text-zinc-400 hover:text-red-600 hover:bg-zinc-100 flex items-center justify-center text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end">
            <button
              onClick={processBatchQueue}
              disabled={isBatchProcessing || isKuromojiLoading || !correctionsReady}
              className="rounded-lg bg-zinc-900 px-6 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-xs"
            >
              {isBatchProcessing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  {t.batchProcessingInProgress}
                </>
              ) : (
                <>🚀 {t.startBatchProcessing}</>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
