'use client';

import React, { useState } from 'react';
import { badgeClass } from './uiTokens';
import type { Translations } from '../utils/i18n';
import type { BatchSaveMode } from '../utils/fileSave';

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
  batchSaveMode: BatchSaveMode;
  setBatchSaveMode: (mode: BatchSaveMode) => void;
  alsoSaveToLibrary: boolean;
  setAlsoSaveToLibrary: (val: boolean) => void;
  t: Translations;
  rubyType?: 'hiragana' | 'katakana' | 'romaji';
  setRubyType?: (type: 'hiragana' | 'katakana' | 'romaji') => void;
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
  batchSaveMode,
  setBatchSaveMode,
  alsoSaveToLibrary,
  setAlsoSaveToLibrary,
  t,
  rubyType: controlledRubyType,
  setRubyType: controlledSetRubyType,
}: BatchProcessingPanelProps) {
  const [internalRubyType, setInternalRubyType] = useState<'hiragana' | 'katakana' | 'romaji'>('hiragana');
  const activeRubyType = controlledRubyType ?? internalRubyType;
  const handleRubyTypeChange = (type: 'hiragana' | 'katakana' | 'romaji') => {
    if (controlledSetRubyType) {
      controlledSetRubyType(type);
    } else {
      setInternalRubyType(type);
    }
  };

  const saveModes: Array<{ id: BatchSaveMode; label: string }> = [
    { id: 'zip', label: t.batchSaveModeZip },
    { id: 'folder', label: t.batchSaveModeFolder },
    { id: 'direct', label: t.batchSaveModeDirect },
  ];

  const rubyOptions: Array<{ id: 'hiragana' | 'katakana' | 'romaji'; label: string }> = [
    { id: 'hiragana', label: t.hiragana },
    { id: 'katakana', label: t.katakana },
    { id: 'romaji', label: t.romaji },
  ];

  const formatOptions: Array<'txt' | 'srt' | 'docx'> = ['txt', 'srt', 'docx'];

  const hasDoneFiles = batchFiles.some(f => f.status === 'done');
  const clearCompletedFiles = () => {
    batchFiles.filter(f => f.status === 'done').forEach(f => removeBatchFile(f.id));
  };

  const handleDownloadZip = () => {
    setBatchSaveMode('zip');
    processBatchQueue();
  };

  return (
    <section className="flex-1 flex flex-col gap-6">
      {/* Header & Settings Surface */}
      <div className="lg-container backdrop-blur-2xl bg-white/75 dark:bg-[#121624]/80 border border-white/70 dark:border-white/10 rounded-3xl shadow-[0_12px_36px_-10px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none p-5 sm:p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className={`${badgeClass} inline-flex items-center gap-1.5`}>
              <svg className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A1.5 1.5 0 014.5 6h4.379a1.5 1.5 0 011.06.44l1.122 1.12a1.5 1.5 0 001.06.44H19.5A1.5 1.5 0 0121 9.5v8.25a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.75V7.5z" />
              </svg>
              {t.batchTab}
            </span>
            <h2 className="font-semibold text-xl md:text-2xl text-slate-900 dark:text-slate-100 tracking-tight">
              {t.batchTitle}
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.batchDesc}
            </p>
          </div>
        </div>

        {/* 1-Click Liquid Glass Segmented Pill Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 dark:border-white/10">
          {/* Target Format Pills */}
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-xs text-slate-700 dark:text-slate-300">{t.targetExportFormat}</span>
            <div className="lg-container inline-flex items-center gap-1 self-start rounded-full bg-slate-200/50 dark:bg-[#0b0e17]/85 backdrop-blur-md border border-white/60 dark:border-white/10 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
              {formatOptions.map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setBatchTargetFormat(fmt)}
                  className={`lg-pill-interactive rounded-full px-4 py-1.5 text-xs font-medium uppercase transition-all duration-150 ${
                    batchTargetFormat === fmt
                      ? 'bg-white dark:bg-indigo-500/30 text-indigo-950 dark:text-indigo-100 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Ruby Type Pills */}
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-xs text-slate-700 dark:text-slate-300">{t.readingFormatLabel}</span>
            <div className="lg-container inline-flex items-center gap-1 self-start rounded-full bg-slate-200/50 dark:bg-[#0b0e17]/85 backdrop-blur-md border border-white/60 dark:border-white/10 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
              {rubyOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRubyTypeChange(opt.id)}
                  className={`lg-pill-interactive rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
                    activeRubyType === opt.id
                      ? 'bg-white dark:bg-indigo-500/30 text-indigo-950 dark:text-indigo-100 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save Mode & Library Preferences */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200/60 dark:border-white/10">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-xs text-slate-700 dark:text-slate-300">{t.batchSaveModeLabel}</span>
            <div className="lg-container inline-flex max-w-full flex-wrap items-center gap-1 self-start rounded-full bg-slate-200/50 dark:bg-[#0b0e17]/85 backdrop-blur-md border border-white/60 dark:border-white/10 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]" role="radiogroup" aria-label={t.batchSaveModeLabel}>
              {saveModes.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={batchSaveMode === mode.id}
                  onClick={() => setBatchSaveMode(mode.id)}
                  className={`lg-pill-interactive rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                    batchSaveMode === mode.id
                      ? 'bg-white dark:bg-indigo-500/30 text-indigo-950 dark:text-indigo-100 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-2.5 self-start sm:self-center text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoSaveToLibrary}
              onChange={event => setAlsoSaveToLibrary(event.target.checked)}
              className="h-4 w-4 rounded-md border-slate-300 dark:border-white/20 text-indigo-600 accent-indigo-600"
            />
            {t.batchAlsoSaveLibrary}
          </label>
        </div>
      </div>

      {/* Frosted Glass Drag & Drop Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="backdrop-blur-2xl bg-white/75 dark:bg-[#161a29]/80 border-2 border-dashed border-indigo-200/70 dark:border-indigo-400/30 hover:border-indigo-400/90 dark:hover:border-indigo-400/60 rounded-3xl p-6 sm:p-8 md:p-10 text-center flex flex-col items-center justify-center gap-3.5 transition-all shadow-[0_12px_36px_-10px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none"
      >
        <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-white/10 border border-white/90 dark:border-white/15 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-2xs">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t.dragDropPrompt}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.dragDropSupport}</p>
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
          className="lg-pill-interactive liquid-glass-btn px-5 py-2.5 min-h-[38px] rounded-full text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 shadow-xs hover:text-slate-950 dark:hover:text-white transition-all"
        >
          {t.selectFiles}
        </button>
      </div>

      {/* Decluttered Queue Management & File List: ONLY rendered when batchFiles.length > 0 */}
      {batchFiles.length > 0 && (
        <div className="lg-container backdrop-blur-2xl bg-white/75 dark:bg-[#121624]/80 border border-white/70 dark:border-white/10 rounded-3xl shadow-[0_12px_36px_-10px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none p-5 sm:p-6 flex flex-col gap-4">
          {/* Action Bar Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 tracking-tight tabular-nums">
              {t.pendingQueue} ({batchFiles.length})
            </span>
            <div className="flex items-center gap-3">
              {hasDoneFiles && (
                <button
                  onClick={clearCompletedFiles}
                  disabled={isBatchProcessing}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
                >
                  清空已完成
                </button>
              )}
              <button
                onClick={clearBatchFiles}
                disabled={isBatchProcessing}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium transition-colors"
              >
                {t.clearQueue}
              </button>
            </div>
          </div>

          {/* Queued File Rows */}
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {batchFiles.map(file => (
              <div
                key={file.id}
                className="lg-grouped-card p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors relative overflow-hidden"
              >
                {/* Smooth refraction progress bar if processing */}
                {file.status === 'processing' && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200/60 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-white/10 border border-white/90 dark:border-white/15 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase shadow-2xs">
                    {file.name.split('.').pop()}
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{(file.size / 1024).toFixed(1)} KB {file.lineCount ? `• ${file.lineCount} ${t.linesCount}` : ''}</p>
                    {file.error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 whitespace-normal mt-0.5">{file.error}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0 self-end sm:self-center">
                  {file.status === 'pending' && <span className={badgeClass}>{t.waiting}</span>}
                  {file.status === 'processing' && (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                      {t.processing}
                    </span>
                  )}
                  {file.status === 'done' && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {t.success}
                    </span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-xs text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {t.failed}
                    </span>
                  )}

                  <button
                    onClick={() => removeBatchFile(file.id)}
                    disabled={isBatchProcessing}
                    aria-label={`移除 ${file.name}`}
                    className="lg-pill-interactive w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/60 dark:hover:bg-white/10 flex items-center justify-center text-xs transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Queue Actions Footer */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              onClick={handleDownloadZip}
              disabled={isBatchProcessing || isKuromojiLoading || !correctionsReady}
              className="lg-pill-interactive liquid-glass-btn px-4 py-2.5 min-h-[38px] rounded-full text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white disabled:opacity-50 transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              打包下载 ZIP
            </button>
            <button
              onClick={processBatchQueue}
              disabled={isBatchProcessing || isKuromojiLoading || !correctionsReady}
              className="lg-pill-interactive lg-btn-prominent liquid-glass-btn-primary rounded-full px-6 py-2.5 min-h-[38px] text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-sm w-full sm:w-auto"
            >
              {isBatchProcessing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  {t.batchProcessingInProgress}
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-5.25-5.25M19.5 12l-5.25 5.25" />
                  </svg>
                  {t.startBatchProcessing}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
