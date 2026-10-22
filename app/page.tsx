'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { SettingsMenu } from './components/SettingsMenu';
import { MobileNavBar, type AppTab } from './components/MobileNavBar';
import { LibraryPanel } from './components/LibraryPanel';
import { ReaderPanel } from './components/ReaderPanel';
import { GlossaryModal } from './components/GlossaryModal';
import { DependencyModal } from './components/DependencyModal';
import { ExportProgressModal } from './components/ExportProgressModal';
import { BatchDoneModal } from './components/BatchDoneModal';
import { LearnedReadingsModal } from './components/LearnedReadingsModal';
import { RubyCorrectionModal, type EditingTokenState } from './components/RubyCorrectionModal';
import { BatchProcessingPanel } from './components/BatchProcessingPanel';
import { EditorWorkspace } from './components/EditorWorkspace';
import type { ScriptLine } from './utils/furigana';
import { useFuriganaWorker } from './hooks/useFuriganaWorker';
import { useThemeMode } from './hooks/useThemeMode';
import { useLibraryController } from './hooks/useLibraryController';
import { useBatchProcessing } from './hooks/useBatchProcessing';
import { generateSRT, generateTXT, type SrtCue } from './utils/srt';
import { importTextScript, scriptSourceFormat } from './utils/inlineRuby';
import { restoreAutomaticReading } from './utils/restoreReading';

import { cleanScriptTitle, importDocx } from './utils/docxImporter';
import { upsertRubyOverride, type RubyOverride } from './utils/rubyOverrides';
import { loadCorrections, saveCorrections } from './utils/correctionStorage';
import { emptyDatabase, fingerprintText, resolveScript, updateScript, setScriptOverrides, learnReading, deleteLearnedReading, type CorrectionDatabaseV2 } from './utils/correctionDatabase';
import { selectReviewWord, makeLearnedReading } from './utils/review';
import { buildDocxBlob } from './utils/docxExporter';
import { saveBlob } from './utils/fileSave';
import { translations, type Locale } from './utils/i18n';

export default function DubbingStudioApp() {
  // Locale & Theme State
  const [locale, setLocale] = useState<Locale>('zh-CN');
  const { darkMode, setDarkMode } = useThemeMode();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('furigana_locale') as Locale | null;
      if (saved === 'zh-CN' || saved === 'en') {
        // Post-mount restore keeps the static-export prerender (default locale) hydration-safe.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocale(saved);
      }
    } catch {}
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    try {
      localStorage.setItem('furigana_locale', newLocale);
    } catch {}
  };

  const t = translations[locale];

  // Navigation & UI states
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('editor');
  useEffect(() => {
    try {
      const hashTab = window.location.hash.replace(/^#/, '');
      const savedTab = hashTab || localStorage.getItem('furigana_active_tab');
      if (savedTab === 'editor' || savedTab === 'library' || savedTab === 'reader' || savedTab === 'batch_files') {
        // Same post-mount, hydration-safe restore as the locale above.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(savedTab);
      }
    } catch {}
  }, []);
  // Phone portrait-only web orientation lock (best effort; browsers may reject without fullscreen).
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const orientationLock = screen?.orientation as unknown as { lock?: (orientation: string) => Promise<void> } | undefined;
    orientationLock?.lock?.('portrait')?.catch(() => {});
  }, []);

  // Options
  const [rubyType, setRubyType] = useState<'hiragana' | 'katakana' | 'romaji'>('hiragana');
  const [fontSize, setFontSize] = useState<number>(16); // 默认小四 (16px)
  const [rubyFontSize, setRubyFontSize] = useState<number>(10); // 假名字号 (10px)
  const [lineSpacing, setLineSpacing] = useState<number>(1.8);  // 行距 (1.8x)
  const [rubyColor, setRubyColor] = useState<string>('#8a8a8e'); // 振假名颜色（中性灰）
  const [previewWritingMode, setPreviewWritingMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [mobileEditorPane, setMobileEditorPane] = useState<'split' | 'input' | 'preview'>('split');
  const [previewFontFamily, setPreviewFontFamily] = useState<'sans' | 'serif'>('sans');

  // Editor Input & Document Title State
  const [docTitle, setDocTitle] = useState<string>('日语假名配音台本');
  const [rawText, setRawText] = useState<string>(
    `山田先生：みなさん、こんにちは！今日の日本語アフレコ台本へようこそ。\n佐藤：先生、この漢字の読み方は何ですか？\n山田先生：これは「未来」と「希望」です。\n鈴木：声優の配音練習を始めましょう！`
  );
  const [sourceOverrides, setSourceOverrides] = useState<RubyOverride[]>([]);
  const [srtCues, setSrtCues] = useState<SrtCue[]>([]);
  const [database, setDatabase] = useState<CorrectionDatabaseV2>(emptyDatabase);
  const databaseRef = useRef(database);
  const [documentId, setDocumentId] = useState('');
  const [storageRetry, setStorageRetry] = useState(0);
  const initialDocumentRef = useRef({ title: docTitle, text: rawText });
  const [correctionsReady, setCorrectionsReady] = useState(false);
  const [correctionError, setCorrectionError] = useState('');
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'docx' | 'srt' | 'txt'>('docx');

  const [exportOutcome, setExportOutcome] = useState<'processing' | 'saved' | 'download' | 'cancelled' | 'error'>('processing');
  const [exportError, setExportError] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const importSequenceRef = useRef(0);
  const [editingToken, setEditingToken] = useState<EditingTokenState | null>(null);

  // Built-in library state + integration. Called here so its effects keep their original
  // position (after the tab/orientation effects, before the correction-database effects).
  const {
    libraryDb, setLibraryDb, libraryDbRef, activeBookId, activeBook, editorBook, setEditorBookId, markEditorSource, libraryBooks,
    libraryToast, setLibraryToast, showImportMenu, setShowImportMenu, editorPixivUrl, setEditorPixivUrl, isPixivImporting,
    loadBookIntoWorkspace, handleSaveToLibrary, handleOpenInReader, importLibraryFiles, createOrUpdateBook,
    exportLibraryJson, importLibraryJson, restoreStarterBooks, handleToggleFavorite, handleUpdateBookMetadata,
    handleImportPixivNovel, handleDeleteBook, handleReaderProgress, handleAddBookmark, handleRemoveBookmark,
  } = useLibraryController({
    t, rubyType, docTitle, rawText, sourceOverrides, srtCues, documentId, databaseRef, setDatabase, setDocumentId,
    setDocTitle, setRawText, setSourceOverrides, setSrtCues, setEditingToken, setActiveTab, setImportError,
  });
  useEffect(() => { databaseRef.current = database; }, [database]);

  const learnedReadings = useMemo(() => database.scripts[documentId]?.learned || [], [database.scripts, documentId]);
  const documentCorrections = useMemo(() => database.scripts[documentId]?.overrides || [], [database.scripts, documentId]);
  const glossaryEntries = useMemo(() => Object.values(database.glossary), [database.glossary]);
  const annotationInput = useMemo(() => ({ text: rawText, rubyType, glossary: glossaryEntries, sourceOverrides, overrides: documentCorrections, learned: learnedReadings }),
    [rawText, rubyType, glossaryEntries, sourceOverrides, documentCorrections, learnedReadings]);
  const { lines: annotatedLines, busy: isAnnotating, engine, progress: annotationProgress, error: annotationError,
    annotate, retry: retryEngine } = useFuriganaWorker(annotationInput);
  const dictionaryStatus = engine.status;
  const dictionaryError = engine.error || '';
  const isKuromojiLoading = dictionaryStatus === 'loading';

  const reviewTargets = annotatedLines.flatMap(line => {
    const targets: Array<{ lineId: string; tokenIndex: number; endIndex: number; token: typeof line.tokens[number]; surface: string; reading: string; alternatives: string[]; context: string }> = [];
    line.tokens.forEach((token, tokenIndex) => {
      if (!token.hasKanji || !token.needsReview || !token.word) return;
      const word = token.word;
      const previous = targets[targets.length - 1];
      if (previous && previous.surface === word.surface && previous.endIndex + 1 === tokenIndex) {
        previous.endIndex = tokenIndex;
        return;
      }
      const start = Math.max(0, tokenIndex - 12);
      targets.push({ lineId: line.id, tokenIndex, endIndex: tokenIndex, token, surface: word.surface,
        reading: word.reading, alternatives: word.alternatives, context: line.cleanText.slice(start, start + word.surface.length + 24) });
    });
    return targets;
  });
  const reviewCount = reviewTargets.length;
  const libraryBookCount = Object.keys(libraryDb.books).length;

  // File import ref for Editor
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  // Interactive Click-to-Edit Ruby State
  const reviewCursorRef = useRef(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [customRubyInput, setCustomRubyInput] = useState<string>('');
  const [correctionScope, setCorrectionScope] = useState<'occurrence' | 'glossary'>('occurrence');
  const [isAdvancingReview, setIsAdvancingReview] = useState(false);
  const [isLearnedModalOpen, setIsLearnedModalOpen] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const rubyCompositionRef = useRef(false);
  const advanceControllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => { advanceControllerRef.current?.abort(); }, [rawText, rubyType, documentId]);

  const updateTokenRuby = (reading: string) => {
    if (!editingToken || isAnnotating || !correctionsReady) return;
    const line = annotatedLines.find(value => value.id === editingToken.lineId);
    if (!line) return;
    const start = line.tokens.slice(0, editingToken.tokenIndex).reduce((sum, token) => sum + token.surface.length, 0);
    const entry: RubyOverride = { line: line.cleanText, start, surface: editingToken.surface, reading, type: rubyType };
    const selection = selectReviewWord(line, editingToken.tokenIndex);
    const learned = makeLearnedReading(selection, reading, rubyType);
    setDatabase(previous => {
      let updated = setScriptOverrides(previous, documentId, upsertRubyOverride(previous.scripts[documentId]?.overrides || [], entry));
      if (reading) {
        updated = learnReading(updated, documentId, learned);
      }
      if (correctionScope === 'glossary' && reading) {
        updated = { ...updated, glossary: { ...updated.glossary,
          [entry.surface]: { surface: entry.surface, reading, type: rubyType, createdAt: previous.glossary[entry.surface]?.createdAt || Date.now() } } };
      }
      return updated;
    });
    setEditingToken(null);
  };

  const openTokenEditor = (lineId: string, tokenIndex: number, lines = annotatedLines, endIndex = tokenIndex) => {
    const line = lines.find(value => value.id === lineId);
    const token = line?.tokens[tokenIndex];
    if (!line || !token?.hasKanji || !correctionsReady || isAdvancingReview) return;
    setCorrectionScope('occurrence');
    setReviewError('');
    rubyCompositionRef.current = false;
    setPreviewPage(Math.floor(Number(lineId) / 200));
    const selection = selectReviewWord(line, tokenIndex);
    const end = endIndex !== tokenIndex ? endIndex : selection.tokenEndIndex;
    const selected = line.tokens.slice(selection.tokenIndex, end + 1);
    const surface = selected.map(value => value.surface).join('');
    const currentRuby = selected.length === 1 ? (selected[0].ruby || '') : selection.currentRuby;
    setEditingToken({ lineId, tokenIndex: selection.tokenIndex, tokenEndIndex: end, surface,
      currentRuby, alternatives: selection.alternatives || (token.ruby ? [token.ruby] : []) });
    setCustomRubyInput(currentRuby);
    requestAnimationFrame(() => {
      document.getElementById(`ruby-token-${lineId}-${selection.tokenIndex}`)?.scrollIntoView({ block: 'nearest' });
    });
  };

  const saveTokenRuby = () => updateTokenRuby(customRubyInput.trim());
  const saveAndOpenNextReview = async () => {
    if (!editingToken || isAdvancingReview) return;
    const line = annotatedLines.find(value => value.id === editingToken.lineId);
    if (!line) return;
    const start = line.tokens.slice(0, editingToken.tokenIndex).reduce((sum, token) => sum + token.surface.length, 0);
    const entry: RubyOverride = { line: line.cleanText, start, surface: editingToken.surface, reading: customRubyInput.trim(), type: rubyType };
    const overrides = upsertRubyOverride(documentCorrections, entry);
    const glossary = correctionScope === 'glossary' && entry.reading ? [...glossaryEntries.filter(value => value.surface !== entry.surface),
      { surface: entry.surface, reading: entry.reading, type: rubyType, createdAt: Date.now() }] : glossaryEntries;
    const selection = selectReviewWord(line, editingToken.tokenIndex);
    const learnedEntry = makeLearnedReading(selection, entry.reading, rubyType);
    const learned = entry.reading ? [...learnedReadings.filter(l => !(l.surface === learnedEntry.surface && l.before === learnedEntry.before && l.after === learnedEntry.after)), learnedEntry] : learnedReadings;
    updateTokenRuby(entry.reading);
    setIsAdvancingReview(true);
    const controller = new AbortController();
    advanceControllerRef.current?.abort();
    advanceControllerRef.current = controller;
    try {
      const lines = await annotate({ ...annotationInput, overrides, glossary, learned }, controller.signal);
      if (controller.signal.aborted) return;
      const candidates = lines.flatMap(value => {
        let offset = 0;
        return value.tokens.flatMap((token, tokenIndex) => {
          const position = offset; offset += token.surface.length;
          return token.hasKanji && token.needsReview ? [{ lineId: value.id, tokenIndex, position }] : [];
        });
      });
      const next = candidates.find(value => Number(value.lineId) > Number(line.id) ||
        (value.lineId === line.id && value.position >= start + entry.surface.length)) || candidates[0];
      if (next) openTokenEditor(next.lineId, next.tokenIndex, lines);
    } catch (error) {
      if (!controller.signal.aborted) setReviewError(`继续校对失败：${String(error)}`);
    } finally { setIsAdvancingReview(false); }
  };
  // 「恢复自动」 removes the corrections behind the range (and what they taught) so the automatic
  // reading really returns; an empty saved reading stays the explicit "no ruby" correction.
  const restoreAutomaticRuby = () => {
    if (!editingToken || isAnnotating || !correctionsReady) return;
    const line = annotatedLines.find(value => value.id === editingToken.lineId);
    if (!line) return;
    const start = line.tokens.slice(0, editingToken.tokenIndex).reduce((sum, token) => sum + token.surface.length, 0);
    setDatabase(previous => restoreAutomaticReading(previous, documentId, line.cleanText, start, start + editingToken.surface.length));
    setEditingToken(null);
  };
  const jumpToNextReview = () => {
    if (!reviewTargets.length || isAnnotating) return;
    const target = reviewTargets[reviewCursorRef.current % reviewTargets.length];
    reviewCursorRef.current++;
    openTokenEditor(target.lineId, target.tokenIndex, annotatedLines, target.endIndex);
  };

  const resizeRubyRange = (start: number, end: number) => {
    if (!editingToken) return;
    const line = annotatedLines.find(line => line.id === editingToken.lineId);
    if (!line) return;
    const selected = line.tokens.slice(start, end + 1);
    const reading = selected.map(token => token.ruby || token.surface).join('');
    setEditingToken({
      ...editingToken,
      tokenIndex: start,
      tokenEndIndex: end,
      surface: selected.map(token => token.surface).join(''),
      currentRuby: reading,
      alternatives: selected.length === 1 ? selected[0].alternatives || [] : [],
    });
    setCustomRubyInput(reading);
  };

  const dictionaryLabel = dictionaryStatus === 'loading' ? t.dictLoading :
    dictionaryStatus === 'ready' ? t.dictReady : t.dictDegraded;
  const deps = [
    { name: t.depKuromojiName, status: dictionaryStatus === 'loading' ? 'repairing' : dictionaryStatus === 'ready' ? 'ready' : 'error', desc: dictionaryError || dictionaryLabel },
    { name: t.depCorrectionStorageName, status: correctionError ? 'error' : correctionsReady ? 'ready' : 'repairing', desc: correctionError || (correctionsReady ? t.depCorrectionStorageReadyDesc : t.readingRecordsLoading) },
  ];

  useEffect(() => {
    let active = true;
    const initial = initialDocumentRef.current;
    Promise.all([loadCorrections(), fingerprintText(initial.text)]).then(([data, fingerprint]) => {
      if (!active) return;
      const resolved = resolveScript(data, initial.title, initial.text, fingerprint);
      setDatabase(resolved.database);
      setDocumentId(resolved.scriptId);
      setCorrectionError('');
      setCorrectionsReady(true);
    }).catch(error => {
      if (active) setCorrectionError(`校对记录读取失败：${String(error)}`);
    });
    return () => { active = false; };
  }, [storageRetry]);

  useEffect(() => {
    if (!correctionsReady || !documentId) return;
    let active = true;
    const timer = setTimeout(() => {
      fingerprintText(rawText).then(fingerprint => {
        if (active) setDatabase(previous => updateScript(previous, documentId, docTitle, fingerprint));
      }).catch(error => { if (active) setCorrectionError(`台本指纹更新失败：${String(error)}`); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [rawText, docTitle, documentId, correctionsReady]);

  useEffect(() => {
    if (!correctionsReady) return;
    let active = true;
    const timer = setTimeout(() => {
      saveCorrections(database).then(() => { if (active) setCorrectionError(''); })
        .catch(error => { if (active) setCorrectionError(`校对记录保存失败：${String(error)}`); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [database, correctionsReady]);

  const runDependencyRepair = async () => {
    retryEngine();
    await Promise.all([
      correctionsReady ? saveCorrections(database).then(() => setCorrectionError(''))
        .catch(error => setCorrectionError(`校对记录保存失败：${String(error)}`)) :
        Promise.resolve().then(() => setStorageRetry(value => value + 1)),
    ]);
  };

  // Handle single script export
  const handleExport = async (format: 'docx' | 'srt' | 'txt') => {
    if (isExporting || isKuromojiLoading || isAnnotating || annotationError || !correctionsReady) return;
    setExportFormat(format);
    setIsExporting(true);
    setExportOutcome('processing');
    setExportError('');
    setExportProgress(10);
    setIsExportModalOpen(true);

    try {
      const safeName = cleanScriptTitle(docTitle) || 'japanese_script';
      const filename = `${safeName}.${format}`;
      let blob: Blob;

      if (format === 'docx') {
        setExportProgress(50);
        blob = await buildDocxBlob(annotatedLines, { title: safeName, baseFontSize: fontSize, rubyFontSize, lineSpacing });
      } else {
        const content = generateTextContent(annotatedLines, format);
        const mime = format === 'srt' ? 'application/x-subrip' : 'text/plain';
        blob = new Blob([content], { type: mime });
      }

      setExportProgress(80);
      const result = await saveBlob(blob, filename);
      if (result.success) {
        setExportProgress(100);
        setExportOutcome(result.downloadStarted ? 'download' : 'saved');
      } else {
        setExportOutcome('cancelled');
      }
    } catch (err) {
      setExportOutcome('error');
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  // Text content generator (for srt / txt only)
  const generateTextContent = (lines: ScriptLine[], format: 'srt' | 'txt', preserveSrtCues = true): string => {
    if (format === 'srt') {
      return generateSRT(lines, preserveSrtCues && srtCues.reduce((sum, cue) => sum + cue.lines.length, 0) === lines.length ? srtCues : undefined);
    } else {
      return generateTXT(lines);
    }
  };

  // File import for Editor
  const handleEditorFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !correctionsReady) return;
    const input = e.target;
    const request = ++importSequenceRef.current;
    setIsImporting(true);
    advanceControllerRef.current?.abort();
    const file = e.target.files[0];
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    setImportError('');

    try {
      let content = '';
      let importedRuby: RubyOverride[] = [];
      let importedCues: SrtCue[] = [];
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const imported = await importDocx(arrayBuffer);
        content = imported.text;
        importedRuby = imported.overrides;
      } else {
        // Inline 漢字(かな) readings from an earlier TXT/SRT export come back as source overrides.
        const imported = importTextScript(file.name, await file.text());
        if (file.name.toLowerCase().endsWith('.srt') && !imported.cues.length) throw new Error('未找到有效的 SRT 时间轴');
        content = imported.text;
        importedRuby = imported.overrides;
        importedCues = imported.cues;
      }
      const fingerprint = await fingerprintText(content);
      if (request !== importSequenceRef.current) return;
      // Reconcile with current state; metadata saves may finish while DOCX parses.
      const resolved = resolveScript(databaseRef.current, baseName, content, fingerprint);
      setDatabase(resolved.database);
      setDocumentId(resolved.scriptId);
      markEditorSource(resolved.scriptId, scriptSourceFormat(file.name));
      setEditingToken(null);
      setSourceOverrides(importedRuby);
      setSrtCues(importedCues);
      setDocTitle(baseName);
      setRawText(content);
      // An imported file is a fresh script: unlink it from the previous library book so
      // "Save to Library" creates a new book instead of overwriting the linked one.
      setEditorBookId(null);
    } catch (err) {
      if (request === importSequenceRef.current) setImportError(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (request === importSequenceRef.current) { setIsImporting(false); input.value = ''; }
    }
  };

  /** Reader token clicks reuse the Editor correction modal, keyed by the annotated line id. */
  const handleTokenClick = (lineIndex: number, tokenIndex: number) => {
    const line = annotatedLines[lineIndex];
    if (!line) return;
    openTokenEditor(line.id, tokenIndex, annotatedLines);
  };

  // Batch page queue (state, file intake and processing).
  const {
    batchFiles, isBatchProcessing, batchTargetFormat, setBatchTargetFormat, batchSaveMode, setBatchSaveMode,
    alsoSaveToLibrary, setAlsoSaveToLibrary, fileInputRef, handleFileSelect, handleDrop, removeBatchFile,
    clearBatchFiles, processBatchQueue, isBatchDoneModalOpen, setIsBatchDoneModalOpen, batchDoneResults,
  } = useBatchProcessing({
    t, database, setDatabase, libraryDbRef, setLibraryDb, annotate, rubyType, glossaryEntries,
    fontSize, rubyFontSize, lineSpacing, generateTextContent, isKuromojiLoading, correctionsReady,
  });

  /**
   * Unified tab switcher used by the Sidebar, desktop Navbar and MobileNavBar.
   * Clicking the Reader tab from any navigation surface immediately loads the active
   * book's saved content, so a scratch script from the Editor never leaks under the
   * active book's title in the Reader.
   */
  const handleSelectTab = (nextTab: AppTab) => {
    if (nextTab === 'reader') {
      const book = activeBook;
      if (book && rawText !== book.content) {
        loadBookIntoWorkspace(book, 'reader');
        return;
      }
    }
    setActiveTab(nextTab);
  };

  // Sidebar navigation items
  const renderSettings = (anchor: HTMLElement | null, open: boolean, close: () => void) => (
    <SettingsMenu
      open={open}
      onClose={close}
      anchor={anchor}
      locale={locale}
      onLocaleChange={handleLocaleChange}
      darkMode={darkMode}
      onDarkModeChange={setDarkMode}
      dictionaryStatus={dictionaryStatus}
      dictionaryLabel={dictionaryLabel}
      onOpenDepModal={() => setIsDepModalOpen(true)}
      onReloadDict={runDependencyRepair}
      t={t}
    />
  );

  return (
    <main className="relative min-h-screen text-[var(--label)] pb-28 md:pb-12 [@media(max-height:520px)_and_(orientation:landscape)]:pb-20 transition-colors">
      {libraryToast && (
        <div role="status" className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_-8px_rgba(15,23,42,0.35)] border border-white/20">
          {libraryToast}
        </div>
      )}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        libraryBookCount={libraryBookCount}
        batchCount={batchFiles.length}
        renderSettings={renderSettings}
        t={t}
      />

      <div className="min-h-screen flex flex-col max-w-7xl mx-auto px-3 sm:px-4 md:pl-[244px] md:pr-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[max(1rem,env(safe-area-inset-top))] md:pt-[max(10px,env(safe-area-inset-top))]">
        {/* PAGE VIEW 1: EDITOR PAGE */}
        {activeTab === 'editor' && (
          <EditorWorkspace
            t={t}
            rubyType={rubyType} setRubyType={setRubyType} setEditingToken={setEditingToken}
            fontSize={fontSize} setFontSize={setFontSize} rubyFontSize={rubyFontSize} setRubyFontSize={setRubyFontSize}
            lineSpacing={lineSpacing} setLineSpacing={setLineSpacing} rubyColor={rubyColor} setRubyColor={setRubyColor}
            previewWritingMode={previewWritingMode} setPreviewWritingMode={setPreviewWritingMode}
            previewFontFamily={previewFontFamily} setPreviewFontFamily={setPreviewFontFamily}
            mobileEditorPane={mobileEditorPane} setMobileEditorPane={setMobileEditorPane}
            docTitle={docTitle} setDocTitle={setDocTitle} rawText={rawText} setRawText={setRawText}
            setSourceOverrides={setSourceOverrides} setSrtCues={setSrtCues}
            documentId={documentId} setDocumentId={setDocumentId} setDatabase={setDatabase}
            correctionsReady={correctionsReady} correctionError={correctionError} glossaryEntries={glossaryEntries}
            learnedReadings={learnedReadings} documentCorrections={documentCorrections}
            advanceControllerRef={advanceControllerRef} setIsGlossaryOpen={setIsGlossaryOpen}
            setIsLearnedModalOpen={setIsLearnedModalOpen}
            editorBook={editorBook} setEditorBookId={setEditorBookId} setLibraryToast={setLibraryToast}
            handleSaveToLibrary={handleSaveToLibrary} handleOpenInReader={handleOpenInReader}
            editorFileInputRef={editorFileInputRef} handleEditorFileImport={handleEditorFileImport}
            isImporting={isImporting} importError={importError}
            showImportMenu={showImportMenu} setShowImportMenu={setShowImportMenu}
            editorPixivUrl={editorPixivUrl} setEditorPixivUrl={setEditorPixivUrl}
            isPixivImporting={isPixivImporting} handleImportPixivNovel={handleImportPixivNovel}
            exportFormat={exportFormat} setExportFormat={setExportFormat} isExporting={isExporting} handleExport={handleExport}
            dictionaryStatus={dictionaryStatus} isKuromojiLoading={isKuromojiLoading} runDependencyRepair={runDependencyRepair}
            engine={engine} annotatedLines={annotatedLines} isAnnotating={isAnnotating}
            annotationProgress={annotationProgress} annotationError={annotationError}
            reviewCount={reviewCount} jumpToNextReview={jumpToNextReview} reviewError={reviewError}
            openTokenEditor={openTokenEditor} previewPage={previewPage} setPreviewPage={setPreviewPage}
          />
        )}

        {/* PAGE VIEW 2: BUILT-IN LIBRARY */}
        {activeTab === 'library' && (
          <LibraryPanel
            t={t}
            books={libraryBooks}
            activeBookId={activeBookId}
            onOpenInReader={book => loadBookIntoWorkspace(book, 'reader')}
            onOpenInEditor={book => loadBookIntoWorkspace(book, 'editor')}
            onImportFiles={importLibraryFiles}
            onImportPixivNovel={handleImportPixivNovel}
            onCreateOrUpdateBook={input => { void createOrUpdateBook(input); }}
            onUpdateBookMetadata={handleUpdateBookMetadata}
            onToggleFavorite={handleToggleFavorite}
            onDeleteBook={handleDeleteBook}
            onExportBackup={() => { void exportLibraryJson(); }}
            onImportBackup={file => { void importLibraryJson(file); }}
            onResetStarterBooks={() => { void restoreStarterBooks(); }}
          />
        )}

        {/* PAGE VIEW 3: IMMERSIVE FURIGANA READER */}
        {activeTab === 'reader' && (
          <ReaderPanel
            t={t}
            book={activeBook}
            annotatedLines={annotatedLines}
            isProcessing={isAnnotating}
            darkMode={darkMode}
            rubyType={rubyType}
            onRubyTypeChange={setRubyType}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            rubyFontSize={rubyFontSize}
            onRubyFontSizeChange={setRubyFontSize}
            lineSpacing={lineSpacing}
            onLineSpacingChange={setLineSpacing}
            onTokenClick={handleTokenClick}
            onUpdateProgress={handleReaderProgress}
            onAddBookmark={handleAddBookmark}
            onRemoveBookmark={handleRemoveBookmark}
            onGoToLibrary={() => setActiveTab('library')}
            onGoToEditor={book => { if (book) loadBookIntoWorkspace(book, 'editor'); else setActiveTab('editor'); }}
          />
        )}

        {/* PAGE VIEW 4: DEDICATED BATCH FILE PROCESSING PAGE */}
        {activeTab === 'batch_files' && (
          <BatchProcessingPanel
            batchTargetFormat={batchTargetFormat}
            setBatchTargetFormat={setBatchTargetFormat}
            handleDrop={handleDrop}
            handleFileSelect={handleFileSelect}
            fileInputRef={fileInputRef}
            batchFiles={batchFiles}
            clearBatchFiles={clearBatchFiles}
            removeBatchFile={removeBatchFile}
            processBatchQueue={processBatchQueue}
            isBatchProcessing={isBatchProcessing}
            isKuromojiLoading={isKuromojiLoading}
            correctionsReady={correctionsReady}
            batchSaveMode={batchSaveMode}
            setBatchSaveMode={setBatchSaveMode}
            alsoSaveToLibrary={alsoSaveToLibrary}
            setAlsoSaveToLibrary={setAlsoSaveToLibrary}
            t={t}
          />
        )}
      </div>

      <GlossaryModal isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} entries={database.glossary}
        onChange={glossary => { setEditingToken(null); setDatabase(previous => ({ ...previous, glossary })); }}
        t={t}
      />

      {/* Dependency Diagnostic Modal */}
      <DependencyModal
        isOpen={isDepModalOpen}
        onClose={() => setIsDepModalOpen(false)}
        deps={deps}
        runDependencyRepair={runDependencyRepair}
        isKuromojiLoading={isKuromojiLoading}
        t={t}
      />

      {/* Single Script Export Progress Modal */}
      <ExportProgressModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        isExporting={isExporting}
        exportFormat={exportFormat}
        exportProgress={exportProgress}
        exportOutcome={exportOutcome}
        exportError={exportError}
        t={t}
      />

      {/* Batch Processing Completion Modal */}
      <BatchDoneModal
        isOpen={isBatchDoneModalOpen}
        onClose={() => setIsBatchDoneModalOpen(false)}
        results={batchDoneResults}
        t={t}
      />

      {/* Interactive Modal for Editing / Disambiguating Ruby */}
      <RubyCorrectionModal
        editingToken={editingToken}
        onClose={() => setEditingToken(null)}
        annotatedLines={annotatedLines}
        rubyFontSize={rubyFontSize}
        customRubyInput={customRubyInput}
        setCustomRubyInput={setCustomRubyInput}
        resizeRubyRange={resizeRubyRange}
        correctionScope={correctionScope}
        setCorrectionScope={setCorrectionScope}
        rubyCompositionRef={rubyCompositionRef}
        saveTokenRuby={saveTokenRuby}
        restoreAutomaticRuby={restoreAutomaticRuby}
        saveAndOpenNextReview={saveAndOpenNextReview}
        isAdvancingReview={isAdvancingReview}
        t={t}
      />

      {/* Modal for viewing and deleting learned readings */}
      <LearnedReadingsModal
        isOpen={isLearnedModalOpen}
        onClose={() => setIsLearnedModalOpen(false)}
        learnedReadings={learnedReadings}
        onDeleteLearnedReading={idx => setDatabase(prev => deleteLearnedReading(prev, documentId, idx))}
        t={t}
      />

      {/* Mobile bottom navigation */}
      <MobileNavBar
        activeTab={activeTab}
        onChange={handleSelectTab}
        bookCount={Object.keys(libraryDb.books).length}
        renderSettings={renderSettings}
        t={t}
      />
    </main>
  );
}
