'use client';

import React, { type Dispatch, type RefObject, type SetStateAction, useRef, useState } from 'react';
import { TypographyPopover } from './TypographyPopover';
import type { EditingTokenState } from './RubyCorrectionModal';
import { GlassButton, GlassCapsule } from './glass/GlassButton';
import { GlassPopover, PopoverItem } from './glass/GlassPopover';
import { LiquidSelector } from './glass/LiquidSelector';
import {
  IconBookmark,
  IconCheck,
  IconClose,
  IconDictionary,
  IconImport,
  IconMore,
  IconRead,
  IconRefresh,
  IconShare,
  IconWarning,
} from './glass/icons';
import type { ScriptLine } from '../utils/furigana';
import type { EngineState } from '../utils/annotationClient';
import type { RubyOverride } from '../utils/rubyOverrides';
import type { SrtCue } from '../utils/srt';
import { fingerprintText, setScriptOverrides, type CorrectionDatabaseV2, type LearnedReading, type ProperNounEntry } from '../utils/correctionDatabase';
import type { BookItem } from '../utils/libraryDatabase';
import type { Translations } from '../utils/i18n';

type Setter<T> = Dispatch<SetStateAction<T>>;
type RubyMode = 'hiragana' | 'katakana' | 'romaji';
type ExportFormat = 'docx' | 'srt' | 'txt';

const PREVIEW_FONT_STACK = {
  sans: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
  serif: '"Yu Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Source Han Serif", serif',
} as const;

/** All Editor-tab state lives in app/page.tsx (so it survives tab switches); this view only renders it. */
export interface EditorWorkspaceProps {
  t: Translations;
  rubyType: RubyMode;
  setRubyType: Setter<RubyMode>;
  setEditingToken: Setter<EditingTokenState | null>;
  fontSize: number;
  setFontSize: Setter<number>;
  rubyFontSize: number;
  setRubyFontSize: Setter<number>;
  lineSpacing: number;
  setLineSpacing: Setter<number>;
  rubyColor: string;
  setRubyColor: Setter<string>;
  previewWritingMode: 'horizontal' | 'vertical';
  setPreviewWritingMode: Setter<'horizontal' | 'vertical'>;
  previewFontFamily: 'sans' | 'serif';
  setPreviewFontFamily: Setter<'sans' | 'serif'>;
  mobileEditorPane: 'split' | 'input' | 'preview';
  setMobileEditorPane: Setter<'split' | 'input' | 'preview'>;
  docTitle: string;
  setDocTitle: Setter<string>;
  rawText: string;
  setRawText: Setter<string>;
  setSourceOverrides: Setter<RubyOverride[]>;
  setSrtCues: Setter<SrtCue[]>;
  documentId: string;
  setDocumentId: Setter<string>;
  setDatabase: Setter<CorrectionDatabaseV2>;
  correctionsReady: boolean;
  correctionError: string;
  glossaryEntries: ProperNounEntry[];
  learnedReadings: LearnedReading[];
  documentCorrections: RubyOverride[];
  advanceControllerRef: RefObject<AbortController | null>;
  setIsGlossaryOpen: Setter<boolean>;
  setIsLearnedModalOpen: Setter<boolean>;
  editorBook: BookItem | null;
  setEditorBookId: Setter<string | null>;
  setLibraryToast: Setter<string | null>;
  handleSaveToLibrary: () => Promise<void>;
  handleOpenInReader: () => Promise<void>;
  editorFileInputRef: RefObject<HTMLInputElement | null>;
  handleEditorFileImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isImporting: boolean;
  importError: string;
  showImportMenu: boolean;
  setShowImportMenu: Setter<boolean>;
  editorPixivUrl: string;
  setEditorPixivUrl: Setter<string>;
  isPixivImporting: boolean;
  handleImportPixivNovel: (urlOrId: string) => Promise<void>;
  exportFormat: ExportFormat;
  setExportFormat: Setter<ExportFormat>;
  isExporting: boolean;
  handleExport: (format: ExportFormat) => Promise<void>;
  dictionaryStatus: EngineState['status'];
  isKuromojiLoading: boolean;
  runDependencyRepair: () => Promise<void>;
  engine: EngineState;
  annotatedLines: ScriptLine[];
  isAnnotating: boolean;
  annotationProgress: number;
  annotationError: string;
  reviewCount: number;
  jumpToNextReview: () => void;
  reviewError: string;
  openTokenEditor: (lineId: string, tokenIndex: number) => void;
  previewPage: number;
  setPreviewPage: Setter<number>;
}

export function EditorWorkspace(props: EditorWorkspaceProps) {
  const { t, dictionaryStatus, runDependencyRepair, isImporting, importError, mobileEditorPane, setMobileEditorPane } = props;
  return (
    <section className="relative flex min-w-0 flex-1 flex-col gap-3 pb-5 md:gap-4">
      <div className="scroll-edge pointer-events-none sticky top-0 z-10 -mx-1 -mb-[70px] h-[70px] shrink-0" aria-hidden />
      <EditorCommandBar {...props} />

      <div>
        <h1 className="mb-3 block text-[34px] font-bold tracking-[-0.02em] text-[var(--label)] md:hidden">工作台</h1>
        <div className="mb-3 flex md:hidden">
          <LiquidSelector
            variant="solid"
            ariaLabel={t.mobileViewModeLabel}
            value={mobileEditorPane}
            onChange={setMobileEditorPane}
            options={[
              { value: 'split', label: t.mobileViewSplit, className: 'px-3 text-xs whitespace-nowrap' },
              { value: 'input', label: t.mobileViewInputOnly, className: 'px-3 text-xs whitespace-nowrap' },
              { value: 'preview', label: t.mobileViewPreviewOnly, className: 'px-3 text-xs whitespace-nowrap' },
            ]}
          />
        </div>

        {dictionaryStatus === 'degraded' && (
          <p role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-[14px] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--danger)]">
            <span>{t.dictErrorAlert}</span>
            <button type="button" onClick={() => { void runDependencyRepair(); }} className="btn btn-plain h-8 px-3 text-xs text-[var(--danger)]">{t.reloadDict}</button>
          </p>
        )}
        {isImporting && <p role="status" className="mb-3 text-xs text-[var(--label-2)]">{t.readingScriptProgress}</p>}
        {importError && <p role="alert" className="mb-3 rounded-[14px] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--danger)]">{importError}</p>}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          <EditorInputPane {...props} />
          <EditorPreviewPane {...props} />
        </div>
      </div>
    </section>
  );
}

function EditorCommandBar({
  t, rubyType, setRubyType, setEditingToken, fontSize, setFontSize, rubyFontSize, setRubyFontSize, lineSpacing,
  setLineSpacing, rubyColor, setRubyColor, correctionsReady, advanceControllerRef, setIsGlossaryOpen, glossaryEntries,
  learnedReadings, setIsLearnedModalOpen, documentCorrections, setDatabase, documentId, handleSaveToLibrary,
  handleOpenInReader, exportFormat, setExportFormat, isExporting, isKuromojiLoading, isAnnotating, annotationError,
  handleExport, dictionaryStatus, runDependencyRepair, reviewCount, jumpToNextReview,
}: EditorWorkspaceProps) {
  const disabled = isExporting || isKuromojiLoading || isAnnotating || !!annotationError || !correctionsReady;
  return (
    <div className="pointer-events-none sticky top-[max(10px,env(safe-area-inset-top))] z-20 -mx-2 flex min-w-0 items-center gap-2 overflow-x-auto px-2 py-2 text-sm toolbar-scroll md:-my-2">
      <LiquidSelector
        variant="glass"
        value={rubyType}
        onChange={value => { setEditingToken(null); setRubyType(value); }}
        ariaLabel={t.rubyModeLabel}
        className="pointer-events-auto shrink-0"
        options={[
          { value: 'hiragana', label: t.hiragana, className: 'px-3 text-xs whitespace-nowrap' },
          { value: 'katakana', label: t.katakana, className: 'px-3 text-xs whitespace-nowrap' },
          { value: 'romaji', label: t.romaji, className: 'px-3 text-xs whitespace-nowrap' },
        ]}
      />

      <GlassCapsule className="pointer-events-auto shrink-0">
        <GlassButton disabled={!correctionsReady} onClick={() => { advanceControllerRef.current?.abort(); setIsGlossaryOpen(true); }}>
          <IconDictionary />
          <span>{t.properNounGlossary}</span>
          <span className="text-xs tabular-nums text-[var(--label-2)]">{glossaryEntries.length}</span>
        </GlassButton>
        <TypographyPopover
          fontSize={fontSize}
          setFontSize={setFontSize}
          rubyFontSize={rubyFontSize}
          setRubyFontSize={setRubyFontSize}
          lineSpacing={lineSpacing}
          setLineSpacing={setLineSpacing}
          rubyColor={rubyColor}
          setRubyColor={setRubyColor}
          t={t}
        />
        {learnedReadings.length > 0 && (
          <GlassButton onClick={() => setIsLearnedModalOpen(true)}>
            <IconCheck />
            <span>{t.learnedContextsBadge}</span>
            <span className="text-xs tabular-nums text-[var(--label-2)]">{learnedReadings.length}</span>
          </GlassButton>
        )}
        {documentCorrections.length > 0 && (
          <GlassButton
            data-testid="workbench-reset-corrections-btn"
            onClick={() => {
              setDatabase(previous => setScriptOverrides(previous, documentId, []));
              setEditingToken(null);
            }}
          >
            <IconRefresh />
            <span>{t.resetScriptCorrections}</span>
          </GlassButton>
        )}
      </GlassCapsule>

      <div className="min-w-2 flex-1" />

      {(isKuromojiLoading || dictionaryStatus === 'degraded' || reviewCount > 0) && (
        <GlassCapsule className="pointer-events-auto shrink-0">
          {isKuromojiLoading ? (
            <span className="flex items-center gap-2 px-3 text-xs font-semibold text-[var(--label-2)]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--fill)] border-t-[var(--label)]" />
              {t.dictLoading}
            </span>
          ) : dictionaryStatus === 'degraded' ? (
            <GlassButton onClick={() => { void runDependencyRepair(); }} className="text-[var(--danger)]">
              <IconWarning />
              <span>{t.reloadDict}</span>
            </GlassButton>
          ) : (
            <GlassButton onClick={jumpToNextReview} className="text-[var(--review)]">
              <span className="font-semibold tabular-nums">{t.needsReviewBadge} {reviewCount} · {t.nextReviewItem}</span>
            </GlassButton>
          )}
        </GlassCapsule>
      )}

      <GlassCapsule className="pointer-events-auto shrink-0">
        <GlassButton data-testid="workbench-save-to-library-btn" aria-label={t.saveToLibrary} title={t.saveToLibrary} className="max-2xl:!w-9 max-2xl:!px-0" onClick={() => { void handleSaveToLibrary(); }}>
          <IconBookmark />
          <span className="hidden 2xl:inline">{t.saveToLibrary}</span>
        </GlassButton>
        <GlassButton data-testid="workbench-open-in-reader-btn" aria-label={t.openInReader} title={t.openInReader} className="max-2xl:!w-9 max-2xl:!px-0" onClick={() => { void handleOpenInReader(); }}>
          <IconRead />
          <span className="hidden 2xl:inline">{t.openInReader}</span>
        </GlassButton>
      </GlassCapsule>

      <GlassCapsule data-testid="workbench-export-capsule" className="pointer-events-auto shrink-0">
        <LiquidSelector
          variant="bare"
          value={exportFormat}
          onChange={value => { if (!disabled) setExportFormat(value); }}
          ariaLabel={t.singleExportTitle}
          className="seg"
          options={(['txt', 'srt', 'docx'] as const).map(format => ({
            value: format,
            label: format === 'txt' ? '.TXT' : format === 'srt' ? '.SRT' : '.DOCX',
            testId: `export-format-option-${format}`,
            className: 'h-8 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap disabled:opacity-40',
          }))}
        />
        <GlassButton
          variant="prominent"
          data-testid="workbench-export-submit-btn"
          disabled={disabled}
          onClick={() => { void handleExport(exportFormat); }}
        >
          <IconShare />
          <span>{t.exportButtonLabel}</span>
        </GlassButton>
      </GlassCapsule>
    </div>
  );
}

function EditorInputPane({
  t, mobileEditorPane, editorBook, setEditorBookId, setLibraryToast, docTitle, setDocTitle, correctionsReady, isImporting,
  editorFileInputRef, handleEditorFileImport, isPixivImporting, showImportMenu, setShowImportMenu, rawText, setRawText,
  setDatabase, setDocumentId, setEditingToken, setSourceOverrides, setSrtCues, handleImportPixivNovel, editorPixivUrl,
  setEditorPixivUrl, fontSize, lineSpacing,
}: EditorWorkspaceProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<HTMLButtonElement | null>(null);
  const lineCount = rawText ? rawText.split(/\r?\n/).length : 0;
  const characterCount = Array.from(rawText).length;
  const clearScript = async () => {
    const id = `script:${crypto.randomUUID()}`;
    const fingerprint = await fingerprintText('');
    setDatabase(previous => ({ ...previous, scripts: { ...previous.scripts,
      [id]: { scriptId: id, title: '脚本台本', fingerprints: [fingerprint], updatedAt: Date.now(), overrides: [], learned: [] } } }));
    setDocumentId(id);
    setEditingToken(null);
    setRawText('');
    setSourceOverrides([]);
    setSrtCues([]);
    setDocTitle(t.defaultScriptTitle);
    setEditorBookId(null);
  };

  return (
    <div className={`${mobileEditorPane === 'preview' ? 'hidden lg:flex' : 'flex'} min-h-[500px] flex-col overflow-hidden rounded-[18px] bg-[var(--surface)] shadow-[var(--card-shadow)]`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4">
        <span className="text-xs font-semibold tracking-[0.02em] text-[var(--label-2)]">原文</span>
        <span className="text-xs tabular-nums text-[var(--label-3)]">{lineCount} {t.linesCount} · {characterCount}</span>
        {editorBook && (
          <span title={t.editorLinkedBookTooltip} className="flex min-w-0 items-center gap-1 text-xs text-[var(--ok)]">
            <IconRead size={14} />
            <span className="max-w-32 truncate">{editorBook.title}</span>
            <button type="button" onClick={() => { setEditorBookId(null); setLibraryToast(t.editorUnlinkToast); }} aria-label={t.editorUnlinkLabel} className="rounded-full p-0.5 hover:bg-[var(--fill)]">
              <IconClose size={12} />
            </button>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <input type="file" ref={editorFileInputRef} onChange={handleEditorFileImport} accept=".txt,.srt,.docx" className="hidden" />
          <button type="button" disabled={!correctionsReady || isImporting} onClick={() => editorFileInputRef.current?.click()} className="btn btn-plain h-8 px-3 text-xs" title={t.importTextTitle}>
            <IconImport size={15} />
            {t.importTextButton}
          </button>
          <button
            type="button"
            data-testid="editor-pixiv-toggle"
            disabled={!correctionsReady || isImporting || isPixivImporting}
            onClick={() => setShowImportMenu(previous => !previous)}
            aria-expanded={showImportMenu}
            className="btn btn-plain h-8 px-3 text-xs"
          >
            {t.libPixivImportBtn}
          </button>
          <button
            ref={setMoreAnchor}
            type="button"
            disabled={!correctionsReady || isImporting}
            onClick={() => setMoreOpen(previous => !previous)}
            aria-label={t.clearButton}
            aria-expanded={moreOpen}
            className="btn btn-plain h-8 w-8 justify-center p-0"
          >
            <IconMore size={17} />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={docTitle}
        disabled={!correctionsReady || isImporting}
        onChange={event => setDocTitle(event.target.value)}
        placeholder={t.scriptTitlePlaceholder}
        className="w-full border-0 bg-transparent px-5 pb-2 pt-1 text-[22px] font-bold tracking-[-0.01em] text-[var(--label)] outline-none placeholder:text-[var(--label-3)] disabled:opacity-50"
      />

      {showImportMenu && (
        <form
          onSubmit={event => {
            event.preventDefault();
            void handleImportPixivNovel(editorPixivUrl).catch(() => undefined);
          }}
          className="mx-5 mb-2 flex flex-wrap items-center gap-2 rounded-[14px] bg-[var(--surface-2)] p-2.5"
        >
          <input
            type="text"
            value={editorPixivUrl}
            onChange={event => setEditorPixivUrl(event.target.value)}
            placeholder={t.libPixivInputPlaceholder}
            disabled={isPixivImporting}
            className="min-w-[180px] flex-1 border-0 bg-transparent px-2 py-1 text-sm text-[var(--label)] outline-none placeholder:text-[var(--label-3)]"
          />
          <button type="submit" disabled={isPixivImporting || !editorPixivUrl.trim()} className="btn btn-ink h-8 px-3 text-xs disabled:opacity-45">
            {isPixivImporting ? t.libPixivFetching : t.libPixivFetchBtn}
          </button>
        </form>
      )}

      <textarea
        value={rawText}
        disabled={!correctionsReady || isImporting}
        onChange={event => { setEditingToken(null); setRawText(event.target.value); }}
        placeholder={t.inputPlaceholder}
        className={`${mobileEditorPane === 'split' ? 'min-h-[260px] lg:min-h-[520px]' : 'min-h-[420px] lg:min-h-[520px]'} flex-1 resize-y border-0 bg-transparent px-5 pb-5 pt-1 text-[16px] leading-[1.95] text-[var(--label)] outline-none placeholder:text-[var(--label-3)] disabled:opacity-50`}
        style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
      />

      <GlassPopover open={moreOpen} onClose={() => setMoreOpen(false)} anchor={moreAnchor} ariaLabel={t.clearButton}>
        {rawText.trim().length > 0 && (
          <PopoverItem
            icon={<IconClose />}
            onClick={() => { void clearScript(); setMoreOpen(false); }}
          >
            {t.clearButton}
          </PopoverItem>
        )}
      </GlassPopover>
    </div>
  );
}

function EditorPreviewPane({
  t, mobileEditorPane, isKuromojiLoading, previewWritingMode, setPreviewWritingMode, previewFontFamily,
  setPreviewFontFamily, annotatedLines, isAnnotating, annotationProgress, engine, reviewCount, jumpToNextReview,
  documentCorrections, setDatabase, documentId, setEditingToken, correctionsReady, annotationError, reviewError,
  correctionError, previewPage, setPreviewPage, openTokenEditor, fontSize, lineSpacing, rubyFontSize, rubyColor,
  runDependencyRepair,
}: EditorWorkspaceProps) {
  const previewStart = Math.min(previewPage * 200, Math.max(0, Math.floor((annotatedLines.length - 1) / 200) * 200));
  const missingTargets = annotatedLines.flatMap(line => line.tokens.flatMap((token, tokenIndex) =>
    token.hasKanji && !token.ruby && !token.annotationSuppressed ? [{ lineId: line.id, tokenIndex }] : []));
  const missingCursorRef = useRef(0);
  const jumpToNextMissing = () => {
    if (!missingTargets.length || isAnnotating) return;
    const target = missingTargets[missingCursorRef.current % missingTargets.length];
    missingCursorRef.current += 1;
    openTokenEditor(target.lineId, target.tokenIndex);
  };
  const sourceCounts = annotatedLines.reduce(
    (counts, line) => {
      for (const token of line.tokens) {
        if (!token.ruby) continue;
        if (token.readingSource === 'glossary') counts.glossary += 1;
        else if (token.readingSource === 'learned') counts.learned += 1;
        else if (token.readingSource === 'source') counts.source += 1;
        else if (token.readingSource === 'manual') counts.manual += 1;
        else counts.auto += 1;
      }
      return counts;
    },
    { auto: 0, glossary: 0, learned: 0, source: 0, manual: 0 },
  );
  const hasError = Boolean(annotationError || reviewError || correctionError);

  return (
    <div className={`${mobileEditorPane === 'input' ? 'hidden lg:flex' : 'flex'} min-h-[500px] flex-col overflow-hidden rounded-[18px] bg-[var(--surface)] shadow-[var(--card-shadow)]`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.02em] text-[var(--label-2)]">{t.previewTitle}</div>
          <div className="mt-0.5 text-xs text-[var(--label-3)]">{t.previewTip}{engine.mode === 'fallback' ? ` · ${t.fallbackModeNote}` : ''}</div>
        </div>
        <div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto">
          <LiquidSelector
            variant="solid"
            ariaLabel={t.writingModeLabel}
            value={previewWritingMode}
            onChange={setPreviewWritingMode}
            options={[
              { value: 'horizontal', label: t.writingModeHorizontal, className: 'h-7 px-2 text-[11px] whitespace-nowrap' },
              { value: 'vertical', label: t.writingModeVertical, className: 'h-7 px-2 text-[11px] whitespace-nowrap' },
            ]}
          />
          <LiquidSelector
            variant="solid"
            ariaLabel={t.readerFontFamilyLabel}
            value={previewFontFamily}
            onChange={setPreviewFontFamily}
            options={[
              { value: 'sans', label: t.fontGothic, className: 'h-7 px-2 text-[11px] whitespace-nowrap' },
              { value: 'serif', label: t.fontMincho, className: 'h-7 px-2 text-[11px] whitespace-nowrap' },
            ]}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--sep)] px-5 pb-3 text-xs text-[var(--label-2)]">
        <span>自动 <b className="font-semibold tabular-nums text-[var(--label)]">{sourceCounts.auto}</b></span>
        <span>词典 <b className="font-semibold tabular-nums text-[var(--label)]">{sourceCounts.glossary}</b></span>
        <span>已学 <b className="font-semibold tabular-nums text-[var(--label)]">{sourceCounts.learned}</b></span>
        <span>原文 <b className="font-semibold tabular-nums text-[var(--label)]">{sourceCounts.source}</b></span>
        <span>手动 <b className="font-semibold tabular-nums text-[var(--label)]">{sourceCounts.manual}</b></span>
        {reviewCount > 0 && (
          <button type="button" disabled={isAnnotating} onClick={jumpToNextReview} className="ml-auto text-xs font-semibold tabular-nums text-[var(--review)] disabled:opacity-50">
            {t.needsReviewBadge} {reviewCount} · {t.nextReviewItem}
          </button>
        )}
      </div>

      <div className="px-5 pt-3">
        {isKuromojiLoading && <p role="status" className="mb-3 text-xs text-[var(--label-2)]">{t.dictLoading}</p>}
        {isAnnotating && <progress aria-label="annotation-progress" className="mb-3 h-1.5 w-full overflow-hidden rounded-full accent-[var(--label)]" value={annotationProgress} max={100} />}
        {hasError && (
          <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-[14px] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 text-xs font-medium text-[var(--danger)]">
            <span>{annotationError ? `${t.annotationFailed}${annotationError}` : reviewError ? `${t.reviewFailed}${reviewError}` : correctionError}</span>
            <button type="button" onClick={() => { void runDependencyRepair(); }} className="btn btn-plain h-8 px-3 text-xs text-[var(--danger)]">{t.reloadDict}</button>
          </div>
        )}
        {missingTargets.length > 0 && (
          <button type="button" disabled={isAnnotating} onClick={jumpToNextMissing} className="mb-3 text-left text-xs font-medium text-[var(--review)] disabled:opacity-50">
            {missingTargets.length} {t.missingReadingsAlert}
          </button>
        )}
        {annotatedLines.some(line => line.tokens.some(token => token.annotationSuppressed)) && <p className="mb-3 text-xs text-[var(--label-2)]">{t.suppressedReadingsNote}</p>}
        {annotatedLines.length > 200 && (
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[var(--label-2)]">
            <button type="button" disabled={previewStart === 0} className="btn btn-plain h-8 px-3 text-xs disabled:opacity-40" onClick={() => setPreviewPage(Math.max(0, previewStart / 200 - 1))}>{t.prevPage}</button>
            <span className="text-center tabular-nums">{t.previewPageInfo} {previewStart + 1}–{Math.min(previewStart + 200, annotatedLines.length)} {t.linesCount}，{t.previewTotalPrefix} {annotatedLines.length} {t.linesCount}</span>
            <button type="button" disabled={previewStart + 200 >= annotatedLines.length} className="btn btn-plain h-8 px-3 text-xs disabled:opacity-40" onClick={() => setPreviewPage(previewStart / 200 + 1)}>{t.nextPage}</button>
          </div>
        )}
      </div>

      <div
        lang="ja"
        className={`${mobileEditorPane === 'split' ? 'min-h-[280px] lg:min-h-[500px]' : 'min-h-[420px] lg:min-h-[500px]'} flex-1 overflow-auto px-5 pb-5 pt-1 ${previewWritingMode === 'vertical' ? 'vertical-script-flow' : ''}`}
        style={{ fontFamily: PREVIEW_FONT_STACK[previewFontFamily] }}
      >
        {isAnnotating ? (
          <div className="space-y-6 pt-4" aria-label={t.annotatingProgress}>
            {[72, 93, 61, 84, 47].map((width, index) => <div key={index} className="h-4 animate-pulse rounded-full bg-[var(--fill)]" style={{ width: `${width}%` }} />)}
          </div>
        ) : (
          annotatedLines.slice(previewStart, previewStart + 200).map(line => (
            <div key={line.id} className="border-b border-[color:var(--sep)] py-3 last:border-0">
              <div className="script-line text-[17px] leading-[2.25] text-[var(--label)]" style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}>
                {line.speaker && <span className="mr-1 font-semibold text-[var(--label-2)]">{line.speaker}：</span>}
                {line.tokens.length === 0 && <br />}
                {line.tokens.map((token, tokenIndex) => {
                  const TokenElement = token.ruby ? 'ruby' : 'span';
                  const sourceClass = token.readingSource === 'manual' ? '[&>rt]:text-[var(--ok)]' : '';
                  return (
                    <TokenElement
                      key={tokenIndex}
                      id={token.hasKanji ? `ruby-token-${line.id}-${tokenIndex}` : undefined}
                      onClick={() => { if (!isAnnotating) openTokenEditor(line.id, tokenIndex); }}
                      className={token.hasKanji ? `cursor-pointer rounded-sm hover:bg-[var(--fill-2)] ${token.needsReview ? 'decoration-[var(--review)] underline decoration-dotted decoration-2 underline-offset-[5px] [&>rt]:text-[var(--review)]' : ''} ${sourceClass}` : ''}
                      tabIndex={token.hasKanji ? 0 : undefined}
                      role={token.hasKanji ? 'button' : undefined}
                      onKeyDown={event => {
                        if (token.hasKanji && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          event.currentTarget.click();
                        }
                      }}
                      title={token.hasKanji ? `${token.annotationSuppressed ? t.suppressedRubyTitle : token.readingSource === 'source' ? t.originalSource : token.readingSource === 'manual' ? t.manualSource : token.readingSource === 'glossary' ? t.glossarySource : t.autoSource}${token.needsReview ? ` · ${t.needsReviewBadge}` : ''}` : undefined}
                    >
                      {token.surface}
                      {token.ruby && <rt className="select-none font-medium text-[var(--ruby)]" style={{ fontSize: `${rubyFontSize}px`, color: token.needsReview ? 'var(--review)' : token.readingSource === 'manual' ? 'var(--ok)' : rubyColor }}>{token.ruby}</rt>}
                    </TokenElement>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {!correctionsReady && <div className="border-t border-[color:var(--sep)] px-5 py-2 text-xs text-[var(--label-2)]">{t.readingRecordsLoading}</div>}
      {documentCorrections.length > 0 && (
        <div className="border-t border-[color:var(--sep)] px-5 py-2 text-xs text-[var(--label-2)]">
          {t.manualSource} <span className="tabular-nums">{documentCorrections.length}</span>{' '}
          <button type="button" onClick={() => { setDatabase(previous => setScriptOverrides(previous, documentId, [])); setEditingToken(null); }} className="ml-1 text-[var(--label)] underline">{t.resetScriptCorrections}</button>
        </div>
      )}
    </div>
  );
}
