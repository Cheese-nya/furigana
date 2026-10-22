'use client';

import React, { useState } from 'react';
import { GlassButton, GlassCapsule } from './glass/GlassButton';
import { GlassPopover, PopoverItem } from './glass/GlassPopover';
import { LiquidSelector } from './glass/LiquidSelector';
import { IconCheck, IconClose, IconDoc, IconImport, IconPlus } from './glass/icons';
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

export function BatchProcessingPanel(props: BatchProcessingPanelProps) {
  const {
    batchTargetFormat, setBatchTargetFormat, handleDrop, handleFileSelect, fileInputRef,
    batchFiles, clearBatchFiles, removeBatchFile, processBatchQueue, isBatchProcessing,
    isKuromojiLoading, correctionsReady, batchSaveMode, setBatchSaveMode, alsoSaveToLibrary,
    setAlsoSaveToLibrary, t, rubyType: controlledRubyType, setRubyType: controlledSetRubyType,
  } = props;
  const [internalRubyType, setInternalRubyType] = useState<'hiragana' | 'katakana' | 'romaji'>('hiragana');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const activeRubyType = controlledRubyType ?? internalRubyType;
  const canProcess = !isBatchProcessing && !isKuromojiLoading && correctionsReady;
  const setRubyType = (type: 'hiragana' | 'katakana' | 'romaji') => controlledSetRubyType ? controlledSetRubyType(type) : setInternalRubyType(type);
  const clearCompletedFiles = () => batchFiles.filter(file => file.status === 'done').forEach(file => removeBatchFile(file.id));
  const hasDoneFiles = batchFiles.some(file => file.status === 'done');
  const handleDownloadZip = () => {
    setBatchSaveMode('zip');
    processBatchQueue();
  };
  const formatOptions: Array<'txt' | 'srt' | 'docx'> = ['txt', 'srt', 'docx'];

  return (
    <section className="flex flex-1 flex-col gap-4 text-[var(--label)]">
      <div className="sticky top-[max(10px,env(safe-area-inset-top))] z-20 -mx-1 flex flex-wrap items-center gap-2 py-1 pointer-events-none">
        <h1 className="w-full text-[34px] font-bold tracking-tight md:hidden">批处理</h1>
        <GlassCapsule className="pointer-events-auto">
          <GlassButton icon aria-label={t.selectFiles} onClick={() => fileInputRef.current?.click()}><IconPlus /></GlassButton>
          <GlassButton onClick={() => fileInputRef.current?.click()}>{t.selectFiles}</GlassButton>
        </GlassCapsule>
        <LiquidSelector
          className="pointer-events-auto"
          variant="glass"
          value={batchTargetFormat}
          onChange={setBatchTargetFormat}
          options={formatOptions.map(value => ({ value, label: value.toUpperCase() }))}
          ariaLabel={t.targetExportFormat}
        />
        <LiquidSelector
          className="pointer-events-auto hidden sm:inline-flex"
          variant="glass"
          value={activeRubyType}
          onChange={setRubyType}
          options={[
            { value: 'hiragana', label: t.hiragana }, { value: 'katakana', label: t.katakana }, { value: 'romaji', label: t.romaji },
          ]}
          ariaLabel={t.readingFormatLabel}
        />
        <GlassCapsule className="pointer-events-auto">
          <GlassButton onClick={event => { setSettingsAnchor(event.currentTarget); setSettingsOpen(true); }}>{t.batchSaveModeLabel}</GlassButton>
        </GlassCapsule>
        <GlassButton variant="prominent" className="pointer-events-auto" disabled={!canProcess} onClick={processBatchQueue}>
          {isBatchProcessing ? t.batchProcessingInProgress : t.startBatchProcessing}
        </GlassButton>
        {batchFiles.length > 0 && <GlassButton variant="glass" className="pointer-events-auto" disabled={!canProcess} onClick={handleDownloadZip}>打包下载 ZIP</GlassButton>}
        {batchFiles.length > 0 && <GlassButton variant="glass" className="pointer-events-auto" disabled={isBatchProcessing} onClick={clearBatchFiles}>{t.clearQueue}</GlassButton>}
      </div>

      <GlassPopover open={settingsOpen} onClose={() => setSettingsOpen(false)} anchor={settingsAnchor} ariaLabel={t.batchSaveModeLabel}>
        <div className="p-2">
          <p className="px-2 pb-2 text-xs font-semibold text-[var(--label-2)]">{t.batchSaveModeLabel}</p>
          <LiquidSelector
            className="w-full [&_[data-opt]]:flex-1"
            variant="solid"
            role="radiogroup"
            value={batchSaveMode}
            onChange={setBatchSaveMode}
            options={[
              { value: 'zip', label: t.batchSaveModeZip }, { value: 'folder', label: t.batchSaveModeFolder }, { value: 'direct', label: t.batchSaveModeDirect },
            ]}
          />
        </div>
        <PopoverItem onClick={() => setAlsoSaveToLibrary(!alsoSaveToLibrary)} detail={alsoSaveToLibrary ? <IconCheck size={14} /> : undefined}>{t.batchAlsoSaveLibrary}</PopoverItem>
      </GlassPopover>

      <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept=".txt,.srt,.docx" className="hidden" />
      <div onDragOver={event => event.preventDefault()} onDrop={handleDrop} className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[var(--sep)] bg-[var(--surface)] p-6 text-center shadow-[var(--card-shadow)]">
        <IconImport size={25} className="text-[var(--label-2)]" />
        <p className="text-sm font-semibold text-[var(--label)]">{t.dragDropPrompt}</p>
        <p className="text-xs text-[var(--label-2)]">{t.dragDropSupport}</p>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn">{t.selectFiles}</button>
      </div>

      {batchFiles.length > 0 && <div className="overflow-hidden rounded-[18px] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--sep)] px-4 py-3">
          <span className="text-sm font-semibold">{t.pendingQueue} ({batchFiles.length})</span>
          <div className="flex gap-2">{hasDoneFiles && <button type="button" disabled={isBatchProcessing} onClick={clearCompletedFiles} className="btn">清空已完成</button>}<button type="button" disabled={isBatchProcessing} onClick={clearBatchFiles} className="btn btn-danger">{t.clearQueue}</button></div>
        </div>
        <ul>
          {batchFiles.map(file => <li key={file.id} className="flex min-h-[62px] items-center gap-3 border-b border-[var(--sep)] px-4 last:border-b-0">
            <IconDoc className="text-[var(--label-2)]" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-[var(--label-2)]">{(file.size / 1024).toFixed(1)} KB{file.lineCount ? ` · ${file.lineCount} ${t.linesCount}` : ''}</p>{file.error && <p role="alert" className="text-xs text-[var(--danger)]">{file.error}</p>}</div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-medium">
              {file.status === 'pending' && <span className="text-[var(--label-3)]">{t.waiting}</span>}
              {file.status === 'processing' && <><span className="h-1 w-[90px] overflow-hidden rounded-full bg-[var(--fill)]"><span className="block h-full rounded-full bg-[var(--label)]" style={{ width: `${file.progress}%` }} /></span><span>{file.progress}%</span></>}
              {file.status === 'done' && <span className="inline-flex items-center gap-1 text-[var(--ok)]"><IconCheck size={16} />{t.success}</span>}
              {file.status === 'error' && <span className="text-[var(--danger)]">{t.failed}</span>}
              <button type="button" disabled={isBatchProcessing} aria-label={`移除 ${file.name}`} onClick={() => removeBatchFile(file.id)} className={`btn h-8 w-8 justify-center !p-0 ${file.status === 'error' ? 'btn-danger' : ''}`}><IconClose size={14} /></button>
            </div>
          </li>)}
        </ul>
      </div>}
    </section>
  );
}
