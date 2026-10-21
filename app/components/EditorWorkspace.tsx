'use client';

import React, { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { TypographyPopover } from './TypographyPopover';
import type { EditingTokenState } from './RubyCorrectionModal';
import {
  neuCard,
  neuInset,
  neuButton,
  neuPrimaryButton,
  neuInput,
  neuBadge,
  glassPillGroupClass,
  glassPillActiveClass,
  glassPillInactiveClass,
} from './uiTokens';
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
  // Ruby mode, typography & preview view preferences
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
  // Script document & correction records
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
  // Library link
  editorBook: BookItem | null;
  setEditorBookId: Setter<string | null>;
  setLibraryToast: Setter<string | null>;
  handleSaveToLibrary: () => Promise<void>;
  handleOpenInReader: () => Promise<void>;
  // File / Pixiv import
  editorFileInputRef: RefObject<HTMLInputElement | null>;
  handleEditorFileImport: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isImporting: boolean;
  importError: string;
  showImportMenu: boolean;
  setShowImportMenu: Setter<boolean>;
  editorPixivUrl: string;
  setEditorPixivUrl: Setter<string>;
  isPixivImporting: boolean;
  handleImportPixivNovel: (urlOrId: string) => Promise<void>;
  // Export
  exportFormat: ExportFormat;
  setExportFormat: Setter<ExportFormat>;
  isExporting: boolean;
  handleExport: (format: ExportFormat) => Promise<void>;
  // Dictionary, annotation & proofreading
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
  /** Called with two arguments, so the page-side defaults (current annotated lines) apply. */
  openTokenEditor: (lineId: string, tokenIndex: number) => void;
  previewPage: number;
  setPreviewPage: Setter<number>;
}

/** Workbench (Editor tab): command bar, status alerts, mobile pane switcher and the input / preview panes. */
export function EditorWorkspace(props: EditorWorkspaceProps) {
  const { t, dictionaryStatus, runDependencyRepair, isImporting, importError, mobileEditorPane, setMobileEditorPane, reviewCount } = props;
  return (
    <section className="flex-1 flex flex-col gap-3.5 sm:gap-5">
      {/* Workbench Command Bar — balanced 3-zone Liquid Glass layout */}
      <EditorCommandBar {...props} />

      {dictionaryStatus === 'degraded' && (
        <p role="alert" className="text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50/85 dark:bg-amber-950/60 backdrop-blur-md border border-amber-200/80 dark:border-amber-700/60 rounded-xl p-3">
          {t.dictErrorAlert}
          <button type="button" onClick={runDependencyRepair} className="ml-2 underline font-semibold">{t.reloadDict}</button>
        </p>
      )}
      {isImporting && <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{t.readingScriptProgress}</p>}
      {importError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-300 bg-red-50/85 dark:bg-red-950/60 backdrop-blur-md border border-red-200 dark:border-red-800/60 rounded-xl p-3">{importError}</p>}

      {/* Mobile & Portrait-Tablet iOS 26 Segmented View Mode Bar */}
      <div className="lg:hidden flex items-center justify-between gap-2 px-0.5">
        <span className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
          {t.mobileViewModeLabel}
        </span>
        <div
          className={`inline-flex items-center gap-0.5 p-1 rounded-full ${glassPillGroupClass}`}
          role="group"
          aria-label={t.mobileViewModeLabel}
        >
          <button
            type="button"
            onClick={() => setMobileEditorPane('input')}
            aria-pressed={mobileEditorPane === 'input'}
            className={`px-3 py-1 text-xs ${mobileEditorPane === 'input' ? glassPillActiveClass : glassPillInactiveClass}`}
          >
            {t.mobileViewInputOnly}
          </button>
          <button
            type="button"
            onClick={() => setMobileEditorPane('preview')}
            aria-pressed={mobileEditorPane === 'preview'}
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs ${mobileEditorPane === 'preview' ? glassPillActiveClass : glassPillInactiveClass}`}
          >
            {reviewCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            <span>{t.mobileViewPreviewOnly}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileEditorPane('split')}
            aria-pressed={mobileEditorPane === 'split'}
            className={`px-3 py-1 text-xs ${mobileEditorPane === 'split' ? glassPillActiveClass : glassPillInactiveClass}`}
          >
            {t.mobileViewSplit}
          </button>
        </div>
      </div>

      {/* Workspace Dual Pane */}
      <div className={`grid grid-cols-1 ${mobileEditorPane === 'split' ? 'md:grid-cols-2' : ''} lg:grid-cols-2 gap-4 sm:gap-6`}>
        {/* Left Pane: Source Script Input */}
        <EditorInputPane {...props} />

        {/* Right Pane: Live Furigana Preview & Interactive Proofreading */}
        <EditorPreviewPane {...props} />
      </div>
    </section>
  );
}

/** Balanced 3-zone command bar: ruby mode, proofreading / typography tools, library + export actions. */
function EditorCommandBar({
  t, rubyType, setRubyType, setEditingToken, fontSize, setFontSize, rubyFontSize, setRubyFontSize, lineSpacing,
  setLineSpacing, rubyColor, setRubyColor, correctionsReady, advanceControllerRef, setIsGlossaryOpen, glossaryEntries,
  learnedReadings, setIsLearnedModalOpen, documentCorrections, setDatabase, documentId, handleSaveToLibrary,
  handleOpenInReader, exportFormat, setExportFormat, isExporting, isKuromojiLoading, isAnnotating, annotationError,
  handleExport,
}: EditorWorkspaceProps) {
  return (
    <div className={`${neuCard} px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center`}>
      {/* Left Zone: Ruby Mode segmented capsule */}
      <div className="flex items-center gap-2 lg:justify-self-start">
        <div className={`lg-container inline-flex items-center gap-0.5 ${glassPillGroupClass}`} role="group" aria-label={t.rubyModeLabel}>
          {(['hiragana', 'katakana', 'romaji'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => { setEditingToken(null); setRubyType(type); }}
              aria-pressed={rubyType === type}
              className={`lg-btn px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs ${
                rubyType === type ? glassPillActiveClass : glassPillInactiveClass
              }`}
            >
              {type === 'hiragana' ? t.hiragana : type === 'katakana' ? t.katakana : t.romaji}
            </button>
          ))}
        </div>
      </div>

      {/* Center Zone: proofreading & typography tools */}
      <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-self-center max-sm:w-full max-sm:min-w-0 max-sm:flex-nowrap max-sm:justify-start max-sm:overflow-x-auto max-sm:[&>*]:shrink-0 toolbar-scroll">
        {/* Streamlined Typography Popover (no duplicate writing mode / font family toggles) */}
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

        {/* Glossary Button */}
        <button
          type="button"
          disabled={!correctionsReady}
          className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50`}
          onClick={() => { advanceControllerRef.current?.abort(); setIsGlossaryOpen(true); }}
        >
          <span>{t.properNounGlossary}</span>
          <span className="rounded-full bg-slate-500/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">
            {glossaryEntries.length}
          </span>
        </button>

        {/* Learned Contexts Button (shown when learned rules exist) */}
        {learnedReadings.length > 0 && (
          <button
            type="button"
            onClick={() => setIsLearnedModalOpen(true)}
            className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs inline-flex items-center gap-1.5 text-blue-700 dark:text-indigo-300`}
          >
            <span>{t.learnedContextsBadge}</span>
            <span className="rounded-full bg-blue-500/15 dark:bg-indigo-500/25 px-1.5 py-0.2 text-[10px] font-bold tabular-nums text-blue-700 dark:text-indigo-200">
              {learnedReadings.length}
            </span>
          </button>
        )}

        {/* Conditional reset for this script's manual corrections */}
        {documentCorrections.length > 0 && (
          <button
            type="button"
            data-testid="workbench-reset-corrections-btn"
            onClick={() => {
              setDatabase(previous => setScriptOverrides(previous, documentId, []));
              setEditingToken(null);
            }}
            className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs inline-flex items-center gap-1.5`}
          >
            <span>{t.resetScriptCorrections}</span>
          </button>
        )}
      </div>

      {/* Right Zone: shelf / reader actions + dedicated Export capsule */}
      <div className="flex flex-wrap items-center gap-2 lg:justify-self-end max-sm:w-full max-sm:min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[&>*]:shrink-0 toolbar-scroll">
        <button
          type="button"
          data-testid="workbench-save-to-library-btn"
          onClick={() => { void handleSaveToLibrary(); }}
          className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs inline-flex items-center gap-1.5`}
        >
          <svg className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          <span>{t.saveToLibrary}</span>
        </button>

        <button
          type="button"
          data-testid="workbench-open-in-reader-btn"
          onClick={() => { void handleOpenInReader(); }}
          className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs inline-flex items-center gap-1.5`}
        >
          <svg className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span>{t.openInReader}</span>
        </button>

        {/* Export Capsule: format is a selectable option, export is its own button */}
        <div
          data-testid="workbench-export-capsule"
          className={`lg-container inline-flex items-center gap-1 ${glassPillGroupClass} max-sm:order-first max-sm:shrink-0`}
          role="group"
          aria-label={t.singleExportTitle}
        >
          <span className="pl-2.5 pr-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
            {t.exportButtonLabel}
          </span>
          {(['txt', 'srt', 'docx'] as const).map(fmt => (
            <button
              key={fmt}
              type="button"
              data-testid={`export-format-option-${fmt}`}
              aria-pressed={exportFormat === fmt}
              disabled={isExporting || isKuromojiLoading || isAnnotating || !!annotationError || !correctionsReady}
              onClick={() => setExportFormat(fmt)}
              title={fmt === 'txt' ? t.exportTxt : fmt === 'srt' ? t.exportSrt : t.exportDocx}
              className={`lg-btn px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${
                exportFormat === fmt ? glassPillActiveClass : glassPillInactiveClass
              }`}
            >
              {fmt === 'txt' ? '.TXT' : fmt === 'srt' ? '.SRT' : '.DOCX'}
            </button>
          ))}
          <button
            type="button"
            data-testid="workbench-export-submit-btn"
            disabled={isExporting || isKuromojiLoading || isAnnotating || !!annotationError || !correctionsReady}
            onClick={() => handleExport(exportFormat)}
            title={t.exportButtonLabel}
            className="lg-btn liquid-glass-btn-primary lg-btn-prominent rounded-full px-3.5 py-1 text-xs font-semibold disabled:opacity-40"
          >
            {t.exportButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Left pane: script title, library link chip, file / Pixiv import, clear and the source textarea. */
function EditorInputPane({
  t, mobileEditorPane, editorBook, setEditorBookId, setLibraryToast, docTitle, setDocTitle, correctionsReady, isImporting,
  editorFileInputRef, handleEditorFileImport, isPixivImporting, showImportMenu, setShowImportMenu, rawText, setRawText,
  setDatabase, setDocumentId, setEditingToken, setSourceOverrides, setSrtCues, handleImportPixivNovel, editorPixivUrl,
  setEditorPixivUrl, fontSize, lineSpacing,
}: EditorWorkspaceProps) {
  return (
    <div className={`${neuCard} ${mobileEditorPane === 'preview' ? 'hidden lg:flex' : 'flex'} flex-col p-3.5 sm:p-5`}>
      <div className="pb-2.5 sm:pb-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200/60 dark:border-white/10 mb-2.5 sm:mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <svg className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="font-medium text-xs text-slate-600 dark:text-slate-300 flex-shrink-0">
            {t.scriptTitleLabel}
          </span>
          {editorBook && (
            <span
              title={t.editorLinkedBookTooltip}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-200/90 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75c-1.5-1.5-3.75-2.25-7.5-2.25v13.5c3.75 0 6 .75 7.5 2.25 1.5-1.5 3.75-2.25 7.5-2.25V4.5c-3.75 0-6 .75-7.5 2.25zM12 6.75v13.5" />
              </svg>
              <span className="max-w-[140px] truncate">{editorBook.title}</span>
              <button
                type="button"
                onClick={() => { setEditorBookId(null); setLibraryToast(t.editorUnlinkToast); }}
                aria-label={t.editorUnlinkLabel}
                className="ml-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-emerald-600/70 dark:text-emerald-300/70 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:text-emerald-900 dark:hover:text-emerald-100"
              >
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          <input
            type="text"
            value={docTitle}
            disabled={!correctionsReady || isImporting}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder={t.scriptTitlePlaceholder}
            className={`${neuInput} px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 w-full max-w-[260px]`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <input
            type="file"
            ref={editorFileInputRef}
            onChange={handleEditorFileImport}
            accept=".txt,.srt,.docx"
            className="hidden"
          />
          <button
            type="button"
            disabled={!correctionsReady || isImporting}
            onClick={() => editorFileInputRef.current?.click()}
            className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1`}
            title={t.importTextTitle}
          >
            {t.importTextButton}
          </button>
          <button
            type="button"
            disabled={!correctionsReady || isImporting || isPixivImporting}
            onClick={() => setShowImportMenu(prev => !prev)}
            aria-expanded={showImportMenu}
            data-testid="editor-pixiv-toggle"
            className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1`}
          >
            {t.libPixivImportBtn}
          </button>
          {rawText.trim().length > 0 && (
            <button
              type="button"
              disabled={!correctionsReady || isImporting}
              onClick={async () => {
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
                // A cleared script is no longer the linked book; next "Save to Library"
                // must create a new book instead of overwriting the previous one.
                setEditorBookId(null);
              }}
              className={`${neuButton} px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs text-slate-600 dark:text-slate-300`}
            >
              {t.clearButton}
            </button>
          )}
        </div>
      </div>
      {showImportMenu && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleImportPixivNovel(editorPixivUrl).catch(() => undefined);
          }}
          className="mb-3 flex flex-wrap items-center gap-2 lg-grouped-card rounded-2xl px-3 py-2"
        >
          <input
            type="text"
            value={editorPixivUrl}
            onChange={(e) => setEditorPixivUrl(e.target.value)}
            placeholder={t.libPixivInputPlaceholder}
            disabled={isPixivImporting}
            className={`${neuInput} flex-1 min-w-[200px] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100`}
          />
          <button
            type="submit"
            disabled={isPixivImporting || !editorPixivUrl.trim()}
            className={`${neuPrimaryButton} rounded-full px-3.5 py-1.5 text-xs font-medium disabled:opacity-45`}
          >
            {isPixivImporting ? t.libPixivFetching : t.libPixivFetchBtn}
          </button>
        </form>
      )}
      <textarea
        value={rawText}
        disabled={!correctionsReady || isImporting}
        onChange={(e) => { setEditingToken(null); setRawText(e.target.value); }}
        placeholder={t.inputPlaceholder}
        className={`${neuInset} w-full ${mobileEditorPane === 'split' ? 'h-[32vh] min-h-[180px] md:h-[min(56vh,620px)] lg:h-[min(62vh,700px)] lg:min-h-[300px]' : 'h-[min(56vh,640px)] min-h-[240px] lg:h-[min(62vh,700px)] lg:min-h-[300px]'} [@media(max-height:520px)_and_(orientation:landscape)]:h-[48vh] [@media(max-height:520px)_and_(orientation:landscape)]:min-h-[160px] p-3.5 sm:p-4 resize-y leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none`}
        style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
      />
    </div>
  );
}

/** Right pane: live furigana preview with interactive proofreading. */
function EditorPreviewPane({
  t, mobileEditorPane, isKuromojiLoading, previewWritingMode, setPreviewWritingMode, previewFontFamily,
  setPreviewFontFamily, annotatedLines, isAnnotating, annotationProgress, engine, reviewCount, jumpToNextReview,
  documentCorrections, setDatabase, documentId, setEditingToken, correctionsReady, annotationError, reviewError,
  correctionError, previewPage, setPreviewPage, openTokenEditor, fontSize, lineSpacing, rubyFontSize, rubyColor,
}: EditorWorkspaceProps) {
  const previewStart = Math.min(previewPage * 200, Math.max(0, Math.floor((annotatedLines.length - 1) / 200) * 200));
  const missingReadings = annotatedLines.reduce((sum, line) => sum + line.tokens.filter(token => token.hasKanji && !token.ruby && !token.annotationSuppressed).length, 0);
  const totalRubyCount = annotatedLines.reduce((sum, line) => sum + line.tokens.filter(token => token.hasKanji && !!token.ruby).length, 0);
  const manualFixCount = documentCorrections.length;
  return (
    <div className={`${neuCard} ${mobileEditorPane === 'input' ? 'hidden lg:flex' : 'flex'} flex-col p-3.5 sm:p-5`}>
      <div className="pb-2.5 sm:pb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 mb-2.5 sm:mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12S5.25 5.25 12 5.25 21.75 12 21.75 12 18.75 18.75 12 18.75 2.25 12 2.25 12z" />
              <circle cx="12" cy="12" r="2.75" />
            </svg>
            {t.previewTitle}
          </h3>
          {isKuromojiLoading && (
            <span className="text-xs bg-amber-50/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              {t.dictLoading}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`inline-flex items-center gap-0.5 ${glassPillGroupClass}`} role="group" aria-label={t.writingModeLabel}>
            <button
              type="button"
              aria-pressed={previewWritingMode === 'horizontal'}
              onClick={() => setPreviewWritingMode('horizontal')}
              className={`px-2.5 py-1 text-[11px] ${previewWritingMode === 'horizontal' ? glassPillActiveClass : glassPillInactiveClass}`}
            >
              {t.writingModeHorizontal}
            </button>
            <button
              type="button"
              aria-pressed={previewWritingMode === 'vertical'}
              onClick={() => setPreviewWritingMode('vertical')}
              className={`px-2.5 py-1 text-[11px] ${previewWritingMode === 'vertical' ? glassPillActiveClass : glassPillInactiveClass}`}
            >
              {t.writingModeVertical}
            </button>
          </div>
          <div className={`inline-flex items-center gap-0.5 ${glassPillGroupClass}`} role="group" aria-label={t.readerFontFamilyLabel}>
            <button
              type="button"
              aria-pressed={previewFontFamily === 'sans'}
              onClick={() => setPreviewFontFamily('sans')}
              className={`px-2.5 py-1 text-[11px] ${previewFontFamily === 'sans' ? glassPillActiveClass : glassPillInactiveClass}`}
            >
              {t.fontGothic}
            </button>
            <button
              type="button"
              aria-pressed={previewFontFamily === 'serif'}
              onClick={() => setPreviewFontFamily('serif')}
              className={`px-2.5 py-1 text-[11px] ${previewFontFamily === 'serif' ? glassPillActiveClass : glassPillInactiveClass}`}
            >
              {t.fontMincho}
            </button>
          </div>
          <span className={neuBadge}>
            {annotatedLines.length} {t.linesCount}
          </span>
        </div>
      </div>

      {/* Decluttered Interactive Proofreading Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 lg-grouped-card rounded-2xl px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300 mb-3">
        <div role="status" aria-live="polite" className="flex items-center gap-2 min-w-0">
          {isAnnotating ? (
            <span className="font-medium tabular-nums text-blue-700 dark:text-blue-300">
              {t.annotatingProgress} {annotationProgress}% · {annotatedLines.length} {t.linesCount}
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {t.previewTip}
              {engine.mode === 'fallback' ? ` · ${t.fallbackModeNote}` : ''}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="annotation-stats">
          <span className="rounded-full bg-slate-500/10 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
            {t.rubyCountPrefix} {totalRubyCount}
          </span>

          {reviewCount > 0 && (
            <button
              type="button"
              disabled={isAnnotating}
              onClick={jumpToNextReview}
              className="inline-flex items-center gap-1 rounded-full lg-pill-interactive border border-amber-300/90 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/60 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:text-amber-200 hover:bg-amber-100/90 disabled:opacity-50"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>{t.needsReviewBadge} {reviewCount} · {t.nextReviewItem}</span>
            </button>
          )}

          {(manualFixCount > 0 || documentCorrections.length > 0) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 dark:bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-blue-700 dark:text-indigo-200">
              <span>{t.manualSource} {manualFixCount}</span>
              {documentCorrections.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDatabase(previous => setScriptOverrides(previous, documentId, []));
                    setEditingToken(null);
                  }}
                  className="underline hover:text-blue-900 dark:hover:text-white"
                >
                  {t.resetScriptCorrections}
                </button>
              )}
            </span>
          )}

          {!correctionsReady && <span>{t.readingRecordsLoading}</span>}
        </div>
      </div>

      {isAnnotating && <progress aria-label="annotation-progress" className="mb-2.5 w-full h-1.5 rounded-full overflow-hidden" value={annotationProgress} max={100} />}
      {annotationError && <p role="alert" className="mb-2.5 text-xs font-medium text-red-600 dark:text-red-300 bg-red-50/85 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 rounded-xl p-2.5">{t.annotationFailed}{annotationError}</p>}
      {reviewError && <p role="alert" className="mb-2.5 text-xs font-medium text-red-600 dark:text-red-300 bg-red-50/85 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 rounded-xl p-2.5">{t.reviewFailed}{reviewError}</p>}
      {correctionError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-300 bg-red-50/85 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 rounded-xl p-2.5 mb-3">{correctionError}</p>}
      {missingReadings > 0 && <p className="text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50/85 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/60 rounded-xl p-2.5 mb-3">{missingReadings} {t.missingReadingsAlert}</p>}
      {annotatedLines.some(line => line.tokens.some(token => token.annotationSuppressed)) && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.suppressedReadingsNote}</p>}
      {annotatedLines.length > 200 && (
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <button type="button" disabled={previewStart === 0} className="underline disabled:opacity-40" onClick={() => setPreviewPage(Math.max(0, previewStart / 200 - 1))}>{t.prevPage}</button>
          <span>{t.previewPageInfo} {previewStart + 1}–{Math.min(previewStart + 200, annotatedLines.length)} {t.linesCount}，{t.previewTotalPrefix} {annotatedLines.length} {t.linesCount}</span>
          <button type="button" disabled={previewStart + 200 >= annotatedLines.length} className="underline disabled:opacity-40" onClick={() => setPreviewPage(previewStart / 200 + 1)}>{t.nextPage}</button>
        </div>
      )}
      <div
        lang="ja"
        className={`${neuInset} w-full ${mobileEditorPane === 'split' ? 'h-[36vh] min-h-[200px] md:h-[min(56vh,620px)] lg:h-[min(62vh,700px)] lg:min-h-[300px]' : 'h-[min(58vh,660px)] min-h-[260px] lg:h-[min(62vh,700px)] lg:min-h-[300px]'} [@media(max-height:520px)_and_(orientation:landscape)]:h-[48vh] [@media(max-height:520px)_and_(orientation:landscape)]:min-h-[160px] p-3.5 sm:p-5 ${previewWritingMode === 'vertical' ? 'vertical-script-flow' : 'overflow-y-auto'}`}
        style={{ fontFamily: PREVIEW_FONT_STACK[previewFontFamily] }}
      >
        {annotatedLines.slice(previewStart, previewStart + 200).map((line) => (
          <div key={line.id} className="border-b border-slate-200/50 dark:border-white/10 pb-2.5 mb-3 last:border-0 last:mb-0">
            <div className="script-line text-slate-900 dark:text-slate-100 font-medium" style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}>
              {line.speaker && <span className="text-slate-500 dark:text-slate-400 mr-1">{line.speaker}：</span>}
              {line.tokens.length === 0 && <br />}
              {line.tokens.map((tItem, tidx) => {
                const TokenElement = tItem.ruby ? 'ruby' : 'span';
                return (
                  <TokenElement
                    key={tidx}
                    id={tItem.hasKanji ? `ruby-token-${line.id}-${tidx}` : undefined}
                    onClick={() => { if (!isAnnotating) openTokenEditor(line.id, tidx); }}
                    className={tItem.hasKanji ? `ruby-interactive-token cursor-pointer group relative ${tItem.needsReview ? 'decoration-amber-500 underline decoration-dotted underline-offset-4' : ''}` : ''}
                    tabIndex={tItem.hasKanji ? 0 : undefined}
                    role={tItem.hasKanji ? 'button' : undefined}
                    onKeyDown={(event) => {
                      if (tItem.hasKanji && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        event.currentTarget.click();
                      }
                    }}
                    title={tItem.hasKanji ? `${tItem.annotationSuppressed ? t.suppressedRubyTitle : tItem.readingSource === 'source' ? t.originalSource : tItem.readingSource === 'manual' ? t.manualSource : tItem.readingSource === 'glossary' ? t.glossarySource : t.autoSource}${tItem.needsReview ? ` · ${t.needsReviewBadge}` : ''}` : undefined}
                  >
                    {tItem.surface}
                    {tItem.ruby && (
                      <rt className="select-none font-semibold transition-opacity group-hover:opacity-80" style={{ fontSize: `${rubyFontSize}px`, color: rubyColor }}>
                        {tItem.ruby}
                      </rt>
                    )}
                  </TokenElement>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
