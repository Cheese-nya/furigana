'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { GlossaryModal } from './components/GlossaryModal';
import { DependencyModal } from './components/DependencyModal';
import { ExportProgressModal } from './components/ExportProgressModal';
import { BatchDoneModal } from './components/BatchDoneModal';
import { LearnedReadingsModal } from './components/LearnedReadingsModal';
import { RubyCorrectionModal, type EditingTokenState } from './components/RubyCorrectionModal';
import { BatchProcessingPanel, type BatchFileItem } from './components/BatchProcessingPanel';
import {
  neuCard,
  neuButton,
  neuButtonActive,
  neuInput,
  neuBadge,
} from './components/uiTokens';
import type { ScriptLine } from './utils/furigana';
import { useFuriganaWorker } from './hooks/useFuriganaWorker';
import { generateSRT, parseSRT, type SrtCue } from './utils/srt';

import { importDocx } from './utils/docxImporter';
import { upsertRubyOverride, type RubyOverride } from './utils/rubyOverrides';
import { loadCorrections, saveCorrections } from './utils/correctionStorage';
import { emptyDatabase, fingerprintText, resolveScript, updateScript, setScriptOverrides, learnReading, deleteLearnedReading, type CorrectionDatabaseV2 } from './utils/correctionDatabase';
import { selectReviewWord, makeLearnedReading } from './utils/review';
import { buildDocxBlob } from './utils/docxExporter';
import { saveBlob } from './utils/fileSave';
import { translations, type Locale } from './utils/i18n';

export default function DubbingStudioApp() {
  // Locale State
  const [locale, setLocale] = useState<Locale>('zh-CN');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('furigana_locale') as Locale | null;
      if (saved === 'zh-CN' || saved === 'en') {
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBatchDoneModalOpen, setIsBatchDoneModalOpen] = useState(false);
  const [batchDoneResults, setBatchDoneResults] = useState<{ total: number; success: number; failed: number; cancelled: number; filenames: string[] }>({ total: 0, success: 0, failed: 0, cancelled: 0, filenames: [] });
  const [activeTab, setActiveTab] = useState<'editor' | 'batch_files' | 'deps'>('editor');

  // Options
  const [rubyType, setRubyType] = useState<'hiragana' | 'katakana' | 'romaji'>('hiragana');
  const [fontSize, setFontSize] = useState<number>(16); // 默认小四 (16px)
  const [rubyFontSize, setRubyFontSize] = useState<number>(10); // 假名字号 (10px)
  const [lineSpacing, setLineSpacing] = useState<number>(1.8);  // 行距 (1.8x)

  // Editor Input & Document Title State
  const [docTitle, setDocTitle] = useState<string>('日语假名配音台本');
  const [rawText, setRawText] = useState<string>(
    `山田先生：みなさん、こんにちは！今日の日本語アフレコ台本へようこそ。\n佐藤：先生、この漢字の読み方は何ですか？\n山田先生：これは「未来」と「希望」です。\n鈴木：声優の配音練習を始めましょう！`
  );
  const [sourceOverrides, setSourceOverrides] = useState<RubyOverride[]>([]);
  const [srtCues, setSrtCues] = useState<SrtCue[]>([]);
  const [database, setDatabase] = useState<CorrectionDatabaseV2>(emptyDatabase);
  const databaseRef = useRef(database);
  useEffect(() => { databaseRef.current = database; }, [database]);
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
  const missingReadings = annotatedLines.reduce((sum, line) => sum + line.tokens.filter(token => token.hasKanji && !token.ruby && !token.annotationSuppressed).length, 0);

  // File import ref for Editor
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  // Interactive Click-to-Edit Ruby State
  const [editingToken, setEditingToken] = useState<EditingTokenState | null>(null);
  const reviewCursorRef = useRef(0);
  const [previewPage, setPreviewPage] = useState(0);
  const previewStart = Math.min(previewPage * 200, Math.max(0, Math.floor((annotatedLines.length - 1) / 200) * 200));
  const [customRubyInput, setCustomRubyInput] = useState<string>('');
  const [correctionScope, setCorrectionScope] = useState<'occurrence' | 'glossary'>('occurrence');
  const [isAdvancingReview, setIsAdvancingReview] = useState(false);
  const [isLearnedModalOpen, setIsLearnedModalOpen] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Batch File Processing State
  const [batchFiles, setBatchFiles] = useState<BatchFileItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchTargetFormat, setBatchTargetFormat] = useState<'docx' | 'srt' | 'txt'>('docx');
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const removeTokenRuby = () => updateTokenRuby('');
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
    { name: `Kuromoji ${locale === 'zh-CN' ? '离线词典' : 'Offline Lexicon'}`, status: dictionaryStatus === 'loading' ? 'repairing' : dictionaryStatus === 'ready' ? 'ready' : 'error', desc: dictionaryError || dictionaryLabel },
    { name: locale === 'zh-CN' ? '校对记录存储' : 'Correction Storage', status: correctionError ? 'error' : correctionsReady ? 'ready' : 'repairing', desc: correctionError || (correctionsReady ? (locale === 'zh-CN' ? '校对记录已读取；修改后自动保存' : 'Corrections loaded; automatically saved on edit') : t.readingRecordsLoading) },
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
      const safeTitle = docTitle.trim() || '日语假名配音台本';
      const filename = `${safeTitle}.${format}`;
      let blob: Blob;

      if (format === 'docx') {
        setExportProgress(50);
        blob = await buildDocxBlob(annotatedLines, { title: safeTitle, baseFontSize: fontSize, rubyFontSize, lineSpacing });
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
      return lines.map(l => {
        return l.tokens.map(t => t.ruby ? `${t.surface}(${t.ruby})` : t.surface).join('');
      }).join('\n\n');
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
        const text = await file.text();
        if (file.name.toLowerCase().endsWith('.srt')) {
          const parsed = parseSRT(text);
          if (!parsed.cues.length) throw new Error('未找到有效的 SRT 时间轴');
          content = parsed.text;
          importedCues = parsed.cues;
        } else {
          content = text;
        }
      }
      const fingerprint = await fingerprintText(content);
      if (request !== importSequenceRef.current) return;
      // Reconcile with current state; metadata saves may finish while DOCX parses.
      const resolved = resolveScript(databaseRef.current, baseName, content, fingerprint);
      setDatabase(resolved.database);
      setDocumentId(resolved.scriptId);
      setEditingToken(null);
      setSourceOverrides(importedRuby);
      setSrtCues(importedCues);
      setDocTitle(baseName);
      setRawText(content);
    } catch (err) {
      if (request === importSequenceRef.current) setImportError(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (request === importSequenceRef.current) { setIsImporting(false); input.value = ''; }
    }
  };

  // File Upload Handlers for Batch Page
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFilesToQueue(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      addFilesToQueue(files);
    }
  };

  const addFilesToQueue = (files: File[]) => {
    const validExts = ['.txt', '.srt', '.docx'];
    const newItems: BatchFileItem[] = files
      .filter(f => validExts.some(ext => f.name.toLowerCase().endsWith(ext)))
      .map(f => ({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        size: f.size,
        status: 'pending',
        progress: 0,
      }));

    setBatchFiles(prev => [...prev, ...newItems]);
  };

  const removeBatchFile = (id: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearBatchFiles = () => {
    setBatchFiles([]);
  };

  // Execute Batch Processing on Queue
  const processBatchQueue = async () => {
    if (batchFiles.length === 0 || isBatchProcessing || isKuromojiLoading || !correctionsReady) return;
    setIsBatchProcessing(true);
    let successCount = 0;
    let failCount = 0;
    let cancelCount = 0;
    const exportedNames: string[] = [];
    let batchDatabase = database;

    for (let i = 0; i < batchFiles.length; i++) {
      const item = batchFiles[i];

      setBatchFiles(prev =>
        prev.map(f => f.id === item.id ? { ...f, status: 'processing', progress: 30, error: undefined } : f)
      );

      try {
        let textContent = '';
        let importedOverrides: RubyOverride[] = [];
        let importedCues: SrtCue[] = [];
        if (item.name.toLowerCase().endsWith('.docx')) {
          const arrayBuffer = await item.file.arrayBuffer();
          const imported = await importDocx(arrayBuffer);
          textContent = imported.text;
          importedOverrides = imported.overrides;
        } else {
          const original = await item.file.text();
          if (item.name.toLowerCase().endsWith('.srt')) {
            const parsed = parseSRT(original);
            if (!parsed.cues.length) throw new Error('未找到有效的 SRT 时间轴');
            textContent = parsed.text;
            importedCues = parsed.cues;
          } else textContent = original;
        }
        const itemTitle = item.name.replace(/\.[^/.]+$/, "") || '日语假名配音台本';
        const fingerprint = await fingerprintText(textContent);
        const resolved = resolveScript(batchDatabase, itemTitle, textContent, fingerprint);
        batchDatabase = resolved.database;
        setDatabase(previous => resolveScript(previous, itemTitle, textContent, fingerprint, resolved.scriptId).database);
        const parsedLines = await annotate({ text: textContent, rubyType, glossary: glossaryEntries,
          sourceOverrides: importedOverrides, overrides: batchDatabase.scripts[resolved.scriptId].overrides,
          learned: batchDatabase.scripts[resolved.scriptId]?.learned || [] });

        // Generate output based on target format
        let outputBlob: Blob;
        if (batchTargetFormat === 'docx') {
          outputBlob = await buildDocxBlob(parsedLines, { title: itemTitle, baseFontSize: fontSize, rubyFontSize, lineSpacing });
        } else {
          const textOutput = batchTargetFormat === 'srt' ? generateSRT(parsedLines, importedCues) : generateTextContent(parsedLines, 'txt');
          const mime = batchTargetFormat === 'srt' ? 'application/x-subrip' : 'text/plain';
          outputBlob = new Blob([textOutput], { type: mime });
        }

        setBatchFiles(prev =>
          prev.map(f => f.id === item.id ? { ...f, progress: 80 } : f)
        );

        await new Promise(r => setTimeout(r, 200));

        const outExt = batchTargetFormat;
        const outName = `${itemTitle}_dubbing.${outExt}`;
        const saveRes = await saveBlob(outputBlob, outName);

        if (saveRes.success) {
          setBatchFiles(prev =>
            prev.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100, lineCount: parsedLines.length } : f)
          );
          exportedNames.push(saveRes.path || outName);
          successCount++;
        } else {
          cancelCount++;
          setBatchFiles(prev =>
            prev.map(f => f.id === item.id ? { ...f, status: 'pending', progress: 0 } : f)
          );
        }
      } catch (err) {
        setBatchFiles(prev =>
          prev.map(f => f.id === item.id ? { ...f, status: 'error', progress: 0, error: err instanceof Error ? err.message : String(err) } : f)
        );
        failCount++;
      }
    }

    setIsBatchProcessing(false);

    // Show completion notification
    setBatchDoneResults({
      total: batchFiles.length,
      success: successCount,
      failed: failCount,
      cancelled: cancelCount,
      filenames: exportedNames,
    });
    setIsBatchDoneModalOpen(true);
  };

  // Sidebar navigation items
  const sidebarItems = [
    {
      label: t.sidebarEditor,
      href: '#editor',
      active: activeTab === 'editor',
      onClick: () => setActiveTab('editor'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6v14h12v-5m-1.414-9.414L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      label: t.sidebarBatch,
      href: '#batch',
      active: activeTab === 'batch_files',
      onClick: () => setActiveTab('batch_files'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1h16v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      label: t.sidebarDeps,
      href: '#deps',
      active: false,
      onClick: () => setIsDepModalOpen(true),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

  return (
    <main className="relative min-h-screen bg-zinc-50/60 text-zinc-900 pb-12">
      {/* Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        items={sidebarItems}
        title={t.sidebarTitle}
        locale={locale}
        onLocaleChange={handleLocaleChange}
        t={t}
      />

      <div className="min-h-screen flex flex-col max-w-7xl mx-auto px-4 md:px-6 pt-5">
        {/* Navbar */}
        <nav className={`${neuCard} px-5 py-3.5 flex items-center justify-between mb-6`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`${neuButton} px-2.5 py-2 flex items-center justify-center`}
              aria-label={t.openSidebar}
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <img src="./logo.png" alt="Logo" className="w-8 h-8 rounded-lg border border-zinc-200/80 object-cover" />
              <span className="font-semibold text-lg md:text-xl tracking-tight text-zinc-900">
                Furigana Dubbing Studio
              </span>
              <span className={neuBadge}>
                {t.scriptMode}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setActiveTab('editor')}
              className={`${activeTab === 'editor' ? neuButtonActive : neuButton} px-3.5 py-1.5 text-xs`}
            >
              {t.editorTab}
            </button>
            <button
              onClick={() => setActiveTab('batch_files')}
              className={`${activeTab === 'batch_files' ? neuButtonActive : neuButton} px-3.5 py-1.5 text-xs`}
            >
              {t.batchTab}
            </button>
          </div>
        </nav>

        {/* PAGE VIEW 1: EDITOR PAGE */}
        {activeTab === 'editor' && (
          <section className="flex-1 flex flex-col gap-6">
            {/* Banner Section */}
            <div className={`${neuCard} p-6 md:p-8 flex flex-col items-center justify-center text-center`}>
              <h1 className="font-semibold text-2xl md:text-3xl tracking-tight mb-2 text-zinc-900">
                {t.bannerTitle}
              </h1>
              <p className="text-xs md:text-sm text-zinc-500 max-w-xl">
                {t.bannerSubtitle}
              </p>
            </div>

            {/* Options Bar */}
            <div className={`${neuCard} p-4 md:p-5 flex flex-wrap items-center justify-between gap-4`}>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <span className="font-medium text-xs text-zinc-600">{t.rubyModeLabel}</span>
                <button type="button" disabled={!correctionsReady} className={`${neuButton} px-3 py-1.5 text-xs disabled:opacity-50`} onClick={() => { advanceControllerRef.current?.abort(); setIsGlossaryOpen(true); }}>
                  {t.properNounGlossary} ({glossaryEntries.length})
                </button>
                <div className="flex items-center gap-1.5">
                  {(['hiragana', 'katakana', 'romaji'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => { setEditingToken(null); setRubyType(type); }}
                      className={`${rubyType === type ? neuButtonActive : neuButton} px-3 py-1.5 text-xs`}
                    >
                      {type === 'hiragana' ? t.hiragana : type === 'katakana' ? t.katakana : t.romaji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors">{t.typographySettings}</summary>
                  <div className="absolute right-0 top-full z-10 mt-2 grid min-w-64 gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-xs text-zinc-700">{t.bodyFontSize}</span>
                  <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50/50">
                    <button
                      onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                      className="px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-2.5 py-1 font-medium text-xs text-center text-zinc-900 min-w-[48px]">
                      {fontSize}px
                    </span>
                    <button
                      onClick={() => setFontSize(Math.min(28, fontSize + 2))}
                      className="px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-xs text-zinc-700">{t.rubyFontSize}</span>
                  <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50/50">
                    <button
                      onClick={() => setRubyFontSize(Math.max(8, rubyFontSize - 1))}
                      className="px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-2.5 py-1 font-medium text-xs text-center text-zinc-900 min-w-[48px]">
                      {rubyFontSize}px
                    </span>
                    <button
                      onClick={() => setRubyFontSize(Math.min(18, rubyFontSize + 1))}
                      className="px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-xs text-zinc-700">{t.lineSpacing}</span>
                  <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50/50">
                    <button
                      onClick={() => setLineSpacing(Number(Math.max(1.2, lineSpacing - 0.2).toFixed(1)))}
                      className="px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-2.5 py-1 font-medium text-xs text-center text-zinc-900 min-w-[48px]">
                      {lineSpacing}x
                    </span>
                    <button
                      onClick={() => setLineSpacing(Number(Math.min(3.0, lineSpacing + 0.2).toFixed(1)))}
                      className="px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                  </div>
                </details>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${dictionaryStatus === 'degraded' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'} px-2.5 py-1 rounded-full font-medium border flex items-center gap-1`}>
                    {dictionaryLabel}
                  </span>
                </div>
              </div>
            </div>

            {dictionaryStatus === 'degraded' && <p role="alert" className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {t.dictErrorAlert}
              <button type="button" onClick={runDependencyRepair} className="ml-2 underline font-semibold">{t.reloadDict}</button>
            </p>}
            {isImporting && <p role="status" className="text-xs text-zinc-500">{t.readingScriptProgress}</p>}
            {importError && <p role="alert" className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{importError}</p>}

            {/* Workspace Dual Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Input Text Editor */}
              <div className={`${neuCard} flex flex-col p-5`}>
                <div className="pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <span className="font-medium text-xs text-zinc-700 flex-shrink-0">
                      {t.scriptTitleLabel}
                    </span>
                    <input
                      type="text"
                      value={docTitle}
                      disabled={!correctionsReady || isImporting}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder={t.scriptTitlePlaceholder}
                      className={`${neuInput} px-3 py-1.5 text-xs font-medium text-zinc-900 w-full max-w-[280px]`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={editorFileInputRef}
                      onChange={handleEditorFileImport}
                      accept=".txt,.srt,.docx"
                      className="hidden"
                    />
                    <button
                      disabled={!correctionsReady || isImporting}
                      onClick={() => editorFileInputRef.current?.click()}
                      className={`${neuButton} px-3 py-1.5 text-xs font-medium text-blue-700 flex items-center gap-1`}
                      title={t.importTextTitle}
                    >
                      {t.importTextButton}
                    </button>
                    <button
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
                        setDocTitle(locale === 'zh-CN' ? '日语假名配音台本' : 'Japanese Furigana Script');
                      }}
                      className={`${neuButton} px-3 py-1.5 text-xs text-zinc-600`}
                    >
                      {t.clearButton}
                    </button>
                  </div>
                </div>
                <textarea
                  value={rawText}
                  disabled={!correctionsReady || isImporting}
                  onChange={(e) => { setEditingToken(null); setRawText(e.target.value); }}
                  placeholder={t.inputPlaceholder}
                  className={`${neuInput} w-full h-[min(58vh,680px)] min-h-[280px] p-4 resize-y leading-relaxed`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
                />
              </div>

              {/* Right: Live Preview */}
              <div className={`${neuCard} flex flex-col p-5`}>
                <div className="pb-3 flex items-center justify-between border-b border-zinc-100 mb-3">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-semibold text-sm text-zinc-900 flex items-center gap-1.5">
                      <span>👀</span> {t.previewTitle}
                    </h3>
                    {isKuromojiLoading && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                        {t.dictLoading}
                      </span>
                    )}
                  </div>
                  <span className={neuBadge}>
                    {annotatedLines.length} {t.linesCount}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mb-2">{t.previewTip}</p>
                <div role="status" aria-live="polite" className="mb-2.5 text-xs text-zinc-600">
                  {isAnnotating ? `${t.annotatingProgress} ${annotationProgress}% · ${annotatedLines.length} ${t.linesCount}` : t.annotationComplete}
                  {engine.mode === 'fallback' && ` · ${t.fallbackModeNote}`}
                  {isAnnotating && <progress aria-label="annotation-progress" className="mt-1 w-full" value={annotationProgress} max={100} />}
                </div>
                {annotationError && <p role="alert" className="mb-2.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{t.annotationFailed}{annotationError}</p>}
                {reviewError && <p role="alert" className="mb-2.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{t.reviewFailed}{reviewError}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 mb-3 pb-2 border-b border-zinc-100">
                  <div className="flex flex-wrap gap-x-3 gap-y-1" aria-label="annotation-stats">
                    <span>{t.autoSource} {annotatedLines.flatMap(line => line.tokens).filter(token => token.hasKanji && token.readingSource === 'automatic').length}</span>
                    <span>{t.glossarySource} {annotatedLines.flatMap(line => line.tokens).filter(token => token.hasKanji && token.readingSource === 'glossary').length}</span>
                    <span>{t.learnedSource} {annotatedLines.flatMap(line => line.tokens).filter(token => token.hasKanji && token.readingSource === 'learned').length}</span>
                    <span>{t.originalSource} {annotatedLines.flatMap(line => line.tokens).filter(token => token.hasKanji && token.readingSource === 'source').length}</span>
                    <span>{t.manualSource} {annotatedLines.flatMap(line => line.tokens).filter(token => token.hasKanji && token.readingSource === 'manual').length}</span>
                    <button type="button" disabled={!reviewCount || isAnnotating} onClick={jumpToNextReview} className="font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 disabled:opacity-50">
                      {t.needsReviewBadge} {reviewCount} · {locale === 'zh-CN' ? '下一处' : 'Next'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {!correctionsReady && <span>{t.readingRecordsLoading}</span>}
                    {learnedReadings.length > 0 && (
                      <button type="button" className="underline text-blue-700 hover:text-blue-800" onClick={() => setIsLearnedModalOpen(true)}>
                        {t.learnedContextsBadge} ({learnedReadings.length})
                      </button>
                    )}
                    {documentCorrections.length > 0 && <button type="button" className="underline text-zinc-600 hover:text-zinc-900" onClick={() => {
                      setDatabase(previous => setScriptOverrides(previous, documentId, []));
                      setEditingToken(null);
                    }}>{t.resetScriptCorrections}</button>}
                  </div>
                </div>
                {correctionError && <p role="alert" className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3">{correctionError}</p>}
                {missingReadings > 0 && <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">{missingReadings} {t.missingReadingsAlert}</p>}
                {annotatedLines.some(line => line.tokens.some(token => token.annotationSuppressed)) && <p className="text-xs text-zinc-500 mb-3">{t.suppressedReadingsNote}</p>}
                {annotatedLines.length > 200 && <div className="mb-3 flex items-center justify-between gap-3 text-xs text-zinc-600">
                  <button type="button" disabled={previewStart === 0} className="underline disabled:opacity-40" onClick={() => setPreviewPage(Math.max(0, previewStart / 200 - 1))}>{t.prevPage}</button>
                  <span>{t.previewPageInfo} {previewStart + 1}–{Math.min(previewStart + 200, annotatedLines.length)} {t.linesCount}，{locale === 'zh-CN' ? '共' : 'total'} {annotatedLines.length} {t.linesCount}</span>
                  <button type="button" disabled={previewStart + 200 >= annotatedLines.length} className="underline disabled:opacity-40" onClick={() => setPreviewPage(previewStart / 200 + 1)}>{t.nextPage}</button>
                </div>}
                <div lang="ja" className={`${neuInput} w-full h-[min(58vh,680px)] min-h-[280px] p-5 overflow-y-auto`}>
                  {annotatedLines.slice(previewStart, previewStart + 200).map((line) => (
                    <div key={line.id} className="border-b border-zinc-100 pb-2.5 mb-3 last:border-0 last:mb-0">
                      <div className="script-line text-zinc-900 font-medium" style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}>
                        {line.speaker && <span className="text-zinc-500 mr-1">{line.speaker}：</span>}
                        {line.tokens.length === 0 && <br />}
                        {line.tokens.map((tItem, tidx) => {
                          const TokenElement = tItem.ruby ? 'ruby' : 'span';
                          return (
                            <TokenElement
                              key={tidx}
                              id={tItem.hasKanji ? `ruby-token-${line.id}-${tidx}` : undefined}
                              onClick={() => { if (!isAnnotating) openTokenEditor(line.id, tidx); }}
                              className={tItem.hasKanji ? `cursor-pointer hover:bg-blue-50 hover:text-blue-900 rounded-sm px-0.5 transition-colors group relative ${tItem.needsReview ? 'decoration-amber-500 underline decoration-dotted underline-offset-4' : ''}` : ''}
                              tabIndex={tItem.hasKanji ? 0 : undefined}
                              role={tItem.hasKanji ? 'button' : undefined}
                              onKeyDown={(event) => {
                                if (tItem.hasKanji && (event.key === 'Enter' || event.key === ' ')) {
                                  event.preventDefault();
                                  event.currentTarget.click();
                                }
                              }}
                              title={tItem.hasKanji ? `${tItem.annotationSuppressed ? (locale === 'zh-CN' ? '主动不注音' : 'No Ruby') : tItem.readingSource === 'source' ? t.originalSource : tItem.readingSource === 'manual' ? t.manualSource : tItem.readingSource === 'glossary' ? t.glossarySource : t.autoSource}${tItem.needsReview ? ` · ${t.needsReviewBadge}` : ''}` : undefined}
                            >
                              {tItem.surface}
                              {tItem.ruby && (
                                <rt className="text-blue-600 select-none group-hover:text-blue-700 font-semibold" style={{ fontSize: `${rubyFontSize}px` }}>
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
            </div>

            {/* Quick Export Bar */}
            <div className={`${neuCard} p-5 flex flex-col md:flex-row items-center justify-between gap-4`}>
              <div>
                <h4 className="font-semibold text-sm text-zinc-900 mb-0.5">{t.singleExportTitle}</h4>
                <p className="text-xs text-zinc-500">{t.singleExportDesc.replace('{title}', docTitle)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button disabled={isExporting || isKuromojiLoading || isAnnotating || !!annotationError || !correctionsReady} onClick={() => handleExport('txt')} className={`${neuButton} px-3.5 py-2 text-xs`}>{t.exportTxt}</button>
                <button disabled={isExporting || isKuromojiLoading || isAnnotating || !!annotationError || !correctionsReady} onClick={() => handleExport('srt')} className={`${neuButton} px-3.5 py-2 text-xs`}>{t.exportSrt}</button>
                <button disabled={isExporting || isKuromojiLoading || isAnnotating || !!annotationError || !correctionsReady} onClick={() => handleExport('docx')} className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-xs">{t.exportDocx}</button>
              </div>
            </div>
          </section>
        )}

        {/* PAGE VIEW 2: DEDICATED BATCH FILE PROCESSING PAGE */}
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
        removeTokenRuby={removeTokenRuby}
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
    </main>
  );
}
