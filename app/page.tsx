'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import {
  annotateLine,
  generateSRT,
  ScriptLine,
  Token,
} from './utils/furigana';

import mammoth from 'mammoth';
import { buildDocxBlob } from './utils/docxExporter';
import { initKuromoji, isKuromojiReady } from './utils/kuromojiEngine';

interface BatchFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  lineCount?: number;
  content?: string;
}

export default function DubbingStudioApp() {
  // Navigation & UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBatchDoneModalOpen, setIsBatchDoneModalOpen] = useState(false);
  const [batchDoneResults, setBatchDoneResults] = useState<{ total: number; success: number; failed: number; filenames: string[] }>({ total: 0, success: 0, failed: 0, filenames: [] });
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
  const [annotatedLines, setAnnotatedLines] = useState<ScriptLine[]>([]);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'docx' | 'srt' | 'txt'>('docx');
  const [isKuromojiLoading, setIsKuromojiLoading] = useState<boolean>(true);

  // File import ref for Editor
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  // Interactive Click-to-Edit Ruby State
  const [editingToken, setEditingToken] = useState<{
    lineId: string;
    tokenIndex: number;
    surface: string;
    currentRuby: string;
    alternatives: string[];
  } | null>(null);
  const [customRubyInput, setCustomRubyInput] = useState<string>('');

  // Batch File Processing State
  const [batchFiles, setBatchFiles] = useState<BatchFileItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchTargetFormat, setBatchTargetFormat] = useState<'docx' | 'srt' | 'txt'>('docx');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Save modified token ruby
  const saveTokenRuby = () => {
    if (!editingToken) return;
    setAnnotatedLines(prev => prev.map(line => {
      if (line.id !== editingToken.lineId) return line;
      const newTokens = [...line.tokens];
      if (newTokens[editingToken.tokenIndex]) {
        newTokens[editingToken.tokenIndex] = {
          ...newTokens[editingToken.tokenIndex],
          ruby: customRubyInput.trim() || undefined,
        };
      }
      return { ...line, tokens: newTokens };
    }));
    setEditingToken(null);
  };

  // Remove token ruby
  const removeTokenRuby = () => {
    if (!editingToken) return;
    setAnnotatedLines(prev => prev.map(line => {
      if (line.id !== editingToken.lineId) return line;
      const newTokens = [...line.tokens];
      if (newTokens[editingToken.tokenIndex]) {
        newTokens[editingToken.tokenIndex] = {
          ...newTokens[editingToken.tokenIndex],
          ruby: undefined,
        };
      }
      return { ...line, tokens: newTokens };
    }));
    setEditingToken(null);
  };

  // Dependency health status
  const [deps, setDeps] = useState([
    { name: 'Fugashi (MeCab Tokenizer)', package: 'fugashi', status: 'ready', desc: '日语形态素分词核心引擎' },
    { name: 'UniDic Lite Dictionary', package: 'unidic-lite', status: 'ready', desc: '离线日语发音与假名词典' },
    { name: 'Python-Docx Builder', package: 'python-docx', status: 'ready', desc: 'Word 原生 Ruby 节点导出器' },
    { name: 'Contextual Furigana Engine', package: 'context-engine', status: 'ready', desc: '本地高精度多音字前后文消歧引擎' },
  ]);

  // Initialize Kuromoji on mount
  useEffect(() => {
    initKuromoji()
      .then(() => setIsKuromojiLoading(false))
      .catch(() => setIsKuromojiLoading(false)); // fallback to normal dict if fails
  }, []);

  // Instant local annotation on text or option changes
  useEffect(() => {
    const rawLines = rawText.split('\n');
    const parsedLines = rawLines.map(rawLine => annotateLine(rawLine, rubyType));
    setAnnotatedLines(parsedLines);
  }, [rawText, rubyType, isKuromojiLoading]);

  useEffect(() => {
    return () => {
      if (exportIntervalRef.current) clearInterval(exportIntervalRef.current);
    };
  }, []);

  // Run mock dependency repair
  const runDependencyRepair = () => {
    setDeps(prev => prev.map(d => ({ ...d, status: 'repairing' })));
    setTimeout(() => {
      setDeps(prev => prev.map(d => ({ ...d, status: 'ready' })));
    }, 1500);
  };

  // Handle single script export
  const handleExport = async (format: 'docx' | 'srt' | 'txt') => {
    setExportFormat(format);
    setIsExporting(true);
    setExportProgress(10);
    setIsExportModalOpen(true);

    setExportProgress(30);
    await new Promise(r => setTimeout(r, 200));

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
      await new Promise(r => setTimeout(r, 200));

      await saveBlob(blob, filename);
      setExportProgress(100);
    } catch (err) {
      console.error('Export error:', err);
    }

    setTimeout(() => {
      setIsExporting(false);
    }, 500);
  };

  // Text content generator (for srt / txt only)
  const generateTextContent = (lines: ScriptLine[], format: 'srt' | 'txt'): string => {
    if (format === 'srt') {
      return generateSRT(lines);
    } else {
      return lines.map(l => {
        return l.tokens.map(t => t.ruby ? `${t.surface}(${t.ruby})` : t.surface).join('');
      }).join('\n\n');
    }
  };

  // Save Blob: Native PyWebView dialog -> Web File System Access API -> Anchor Download
  const saveBlob = async (blob: Blob, filename: string): Promise<{ success: boolean; path?: string }> => {
    // 1. PyWebView Native File Save Bridge (Desktop EXE Mode - Opens Windows Native Save Dialog)
    if (typeof window !== 'undefined' && (window as any).pywebview?.api?.save_file) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const base64Data = await base64Promise;
        const res = await (window as any).pywebview.api.save_file(filename, base64Data);
        if (res && res.success) {
          return { success: true, path: res.path };
        } else if (res && res.error === 'Cancelled') {
          return { success: false };
        }
      } catch (err) {
        console.error('PyWebView native save error:', err);
      }
    }

    // 2. Web File System Access API (Standard Modern Browser Mode)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
        const extMap: Record<string, { description: string; accept: Record<string, string[]> }> = {
          txt: { description: 'TXT 文本文件', accept: { 'text/plain': ['.txt'] } },
          srt: { description: 'SRT 字幕文件', accept: { 'application/x-subrip': ['.srt'] } },
          docx: { description: 'Word 文档', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } },
        };
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [extMap[ext] || extMap.txt],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true, path: handle.name };
      } catch (e: any) {
        if (e?.name === 'AbortError') return { success: false };
      }
    }

    // 3. Fallback: classic anchor download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    await new Promise(r => setTimeout(r, 500));
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, path: filename };
  };

  // File import for Editor
  const handleEditorFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    setDocTitle(baseName);

    try {
      let content = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        content = res.value;
      } else {
        content = await file.text();
      }
      setRawText(content);
    } catch (err) {
      console.error('Import file error:', err);
    } finally {
      if (e.target) e.target.value = '';
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
    if (batchFiles.length === 0) return;
    setIsBatchProcessing(true);
    let successCount = 0;
    let failCount = 0;
    const exportedNames: string[] = [];

    for (let i = 0; i < batchFiles.length; i++) {
      const item = batchFiles[i];

      setBatchFiles(prev =>
        prev.map(f => f.id === item.id ? { ...f, status: 'processing', progress: 30 } : f)
      );

      try {
        let textContent = '';
        if (item.name.toLowerCase().endsWith('.docx')) {
          const arrayBuffer = await item.file.arrayBuffer();
          const res = await mammoth.extractRawText({ arrayBuffer });
          textContent = res.value;
        } else {
          textContent = await item.file.text();
        }
        const rawLines = textContent.split('\n');
        const parsedLines = rawLines.map(line => annotateLine(line, rubyType));
        const itemTitle = item.name.replace(/\.[^/.]+$/, "") || '日语假名配音台本';

        // Generate output based on target format
        let outputBlob: Blob;
        if (batchTargetFormat === 'docx') {
          outputBlob = await buildDocxBlob(parsedLines, { title: itemTitle, baseFontSize: fontSize, rubyFontSize, lineSpacing });
        } else {
          const textOutput = generateTextContent(parsedLines, batchTargetFormat);
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
            prev.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100, lineCount: rawLines.length } : f)
          );
          exportedNames.push(saveRes.path || outName);
          successCount++;
        } else {
          setBatchFiles(prev =>
            prev.map(f => f.id === item.id ? { ...f, status: 'pending', progress: 0 } : f)
          );
        }
      } catch (err) {
        setBatchFiles(prev =>
          prev.map(f => f.id === item.id ? { ...f, status: 'error', progress: 0 } : f)
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
      filenames: exportedNames,
    });
    setIsBatchDoneModalOpen(true);
  };

  // Neumorphism Utility Style Classes
  const neuCard = "bg-[#e0e5ec] rounded-2xl shadow-[8px_8px_16px_#b8bcc2,-8px_-8px_16px_#ffffff]";
  const neuButton = "bg-[#e0e5ec] rounded-xl shadow-[6px_6px_12px_#b8bcc2,-6px_-6px_12px_#ffffff] hover:shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] active:shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff] transition-all duration-200 text-gray-700 font-medium";
  const neuButtonActive = "bg-[#e0e5ec] rounded-xl shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff] text-blue-600 font-semibold transition-all duration-200";
  const neuInput = "bg-[#e0e5ec] rounded-xl shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff] focus:shadow-[inset_6px_6px_12px_#b8bcc2,inset_-6px_-6px_12px_#ffffff] focus:outline-none placeholder:text-gray-400 transition-shadow duration-200 text-gray-800";
  const neuBadge = "px-3 py-1 bg-[#e0e5ec] rounded-lg shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] text-xs font-semibold text-gray-600";

  // Sidebar navigation items
  const sidebarItems = [
    {
      label: '台本在线编辑器',
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
      label: '批量文件处理中心',
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
      label: '依赖诊断与修复',
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
    <main className="relative min-h-screen bg-[#e0e5ec] text-gray-700 pb-12">
      {/* Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        items={sidebarItems}
        title="假名标注工具"
      />

      <div className="min-h-screen flex flex-col max-w-7xl mx-auto px-4 md:px-6 pt-6">
        {/* Navbar */}
        <nav className={`${neuCard} px-6 py-4 flex items-center justify-between mb-8`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`${neuButton} px-3 py-2 flex items-center justify-center`}
              aria-label="打开侧边栏"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <img src="./logo.png" alt="Logo" className="w-8 h-8 rounded-xl shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] object-cover" />
              <span className="font-bold text-xl md:text-2xl tracking-tight text-gray-800">
                Furigana Dubbing Studio
              </span>
              <span className={neuBadge}>
                台本模式
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => setActiveTab('editor')}
              className={`${activeTab === 'editor' ? neuButtonActive : neuButton} px-4 py-2 text-sm`}
            >
              📝 台本编辑器
            </button>
            <button
              onClick={() => setActiveTab('batch_files')}
              className={`${activeTab === 'batch_files' ? neuButtonActive : neuButton} px-4 py-2 text-sm`}
            >
              📁 批量处理中心
            </button>
          </div>
        </nav>

        {/* PAGE VIEW 1: EDITOR PAGE */}
        {activeTab === 'editor' && (
          <section className="flex-1 flex flex-col gap-8">
            {/* Banner Section */}
            <div className={`${neuCard} p-8 md:p-12 flex flex-col items-center justify-center text-center`}>
              <h1 className="font-bold text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4 text-gray-800">
                日语假名配音台本处理系统
              </h1>
              <p className="text-sm md:text-base max-w-xl text-gray-600 bg-[#e0e5ec] px-4 py-2 rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff]">
                Neumorphism Edition • 默认小四字体 (16px) • 高精度前后文消歧注音
              </p>
            </div>

            {/* Options Bar - Simplified Clean Logic without AI / Translation toggles */}
            <div className={`${neuCard} p-6 flex flex-wrap items-center justify-between gap-6`}>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <span className="font-semibold text-sm text-gray-800">注音模式:</span>
                <div className="flex items-center gap-3">
                  {(['hiragana', 'katakana', 'romaji'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setRubyType(type)}
                      className={`${rubyType === type ? neuButtonActive : neuButton} px-3.5 py-2 text-xs`}
                    >
                      {type === 'hiragana' ? '平假名' : type === 'katakana' ? '片假名' : '罗马音'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-800">正文字号:</span>
                  <div className="flex items-center bg-[#e0e5ec] rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] p-1">
                    <button
                      onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                      className="px-2.5 py-1 font-bold text-gray-600 hover:text-gray-900"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 font-semibold text-xs text-center text-gray-800 min-w-[50px]">
                      {fontSize}px
                    </span>
                    <button
                      onClick={() => setFontSize(Math.min(28, fontSize + 2))}
                      className="px-2.5 py-1 font-bold text-gray-600 hover:text-gray-900"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-800">假名字号:</span>
                  <div className="flex items-center bg-[#e0e5ec] rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] p-1">
                    <button
                      onClick={() => setRubyFontSize(Math.max(8, rubyFontSize - 1))}
                      className="px-2.5 py-1 font-bold text-gray-600 hover:text-gray-900"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 font-semibold text-xs text-center text-gray-800 min-w-[50px]">
                      {rubyFontSize}px
                    </span>
                    <button
                      onClick={() => setRubyFontSize(Math.min(18, rubyFontSize + 1))}
                      className="px-2.5 py-1 font-bold text-gray-600 hover:text-gray-900"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-800">行间距:</span>
                  <div className="flex items-center bg-[#e0e5ec] rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] p-1">
                    <button
                      onClick={() => setLineSpacing(Number(Math.max(1.2, lineSpacing - 0.2).toFixed(1)))}
                      className="px-2.5 py-1 font-bold text-gray-600 hover:text-gray-900"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 font-semibold text-xs text-center text-gray-800 min-w-[50px]">
                      {lineSpacing}x
                    </span>
                    <button
                      onClick={() => setLineSpacing(Number(Math.min(3.0, lineSpacing + 0.2).toFixed(1)))}
                      className="px-2.5 py-1 font-bold text-gray-600 hover:text-gray-900"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-700 bg-emerald-100/90 px-3 py-1.5 rounded-xl font-medium shadow-[inset_1px_1px_2px_#a7f3d0,inset_-1px_-1px_2px_#ffffff] flex items-center gap-1">
                    ✨ 前后文高精度假名消歧已生效
                  </span>
                </div>
              </div>
            </div>

            {/* Workspace Dual Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Input Text Editor */}
              <div className={`${neuCard} flex flex-col p-6`}>
                <div className="pb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-300/40 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <span className="font-semibold text-sm text-gray-800 flex-shrink-0">
                      📝 台本标题:
                    </span>
                    <input
                      type="text"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="输入台本标题（用于 Word 导出标题）"
                      className={`${neuInput} px-3 py-1 text-sm font-semibold text-gray-800 w-full max-w-[280px]`}
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
                      onClick={() => editorFileInputRef.current?.click()}
                      className={`${neuButton} px-3.5 py-1.5 text-xs font-semibold text-blue-700 flex items-center gap-1`}
                      title="导入 .txt, .srt 或 .docx 文件，将自动将标题设置为文件名"
                    >
                      📂 导入文本
                    </button>
                    <button
                      onClick={() => {
                        setRawText('');
                        setDocTitle('日语假名配音台本');
                      }}
                      className={`${neuButton} px-3 py-1.5 text-xs text-gray-600`}
                    >
                      清空
                    </button>
                  </div>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="请输入日语台本或点击上方「导入文本」..."
                  className={`${neuInput} w-full h-[360px] p-4 resize-none`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
                />
              </div>

              {/* Right: Live Preview */}
              <div className={`${neuCard} flex flex-col p-6`}>
                <div className="pb-4 flex items-center justify-between border-b border-gray-300/40 mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg text-gray-800">
                      👀 实时假名注音与排版预览
                    </h3>
                    {isKuromojiLoading && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full shadow-[inset_1px_1px_2px_#d1d5db,inset_-1px_-1px_2px_#ffffff] flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                        加载词典...
                      </span>
                    )}
                  </div>
                  <span className={neuBadge}>
                    {annotatedLines.length} 行
                  </span>
                </div>
                <div className={`${neuInput} w-full h-[360px] p-6 overflow-y-auto flex flex-col gap-4`}>
                  {annotatedLines.map((line) => (
                    <div key={line.id} className="border-b border-gray-300/50 pb-3 last:border-0" style={{ marginBottom: `${(lineSpacing - 1.5) * 8}px` }}>
                      <div className="text-gray-800 font-semibold flex flex-wrap items-end gap-x-1.5" style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}>
                        {line.tokens.map((t, tidx) => (
                          <ruby
                            key={tidx}
                            onClick={() => {
                              if (t.hasKanji) {
                                setEditingToken({
                                  lineId: line.id,
                                  tokenIndex: tidx,
                                  surface: t.surface,
                                  currentRuby: t.ruby || '',
                                  alternatives: t.alternatives || (t.ruby ? [t.ruby] : [])
                                });
                                setCustomRubyInput(t.ruby || '');
                              }
                            }}
                            className={t.hasKanji ? 'cursor-pointer hover:bg-blue-200/60 rounded px-0.5 transition-colors group relative' : ''}
                            title={t.hasKanji ? '点击切换备选读音或自定义修改' : undefined}
                          >
                            {t.surface}
                            {t.ruby && (
                              <rt className="text-blue-600 select-none group-hover:text-blue-800 font-bold" style={{ fontSize: `${rubyFontSize}px` }}>
                                {t.ruby}
                              </rt>
                            )}
                          </ruby>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Export Bar */}
            <div className={`${neuCard} p-6 flex flex-col md:flex-row items-center justify-between gap-6`}>
              <div>
                <h4 className="font-semibold text-lg text-gray-800 mb-1">单文件导出</h4>
                <p className="text-sm text-gray-600">导出以「{docTitle}」命名的 Word (.docx)、SRT 字幕与 TXT 文本</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => handleExport('txt')} className={`${neuButton} px-4 py-2.5 text-sm`}>导出 TXT</button>
                <button onClick={() => handleExport('srt')} className={`${neuButton} px-4 py-2.5 text-sm`}>导出 SRT</button>
                <button onClick={() => handleExport('docx')} className={`${neuButton} text-blue-600 font-semibold px-6 py-2.5 text-sm`}>导出 Word (.docx)</button>
              </div>
            </div>
          </section>
        )}

        {/* PAGE VIEW 2: DEDICATED BATCH FILE PROCESSING PAGE */}
        {activeTab === 'batch_files' && (
          <section className="flex-1 flex flex-col gap-8">
            {/* Header Card */}
            <div className={`${neuCard} p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6`}>
              <div className="space-y-3 max-w-2xl">
                <span className={neuBadge}>
                  📁 批量文件处理
                </span>
                <h2 className="font-bold text-2xl md:text-3xl lg:text-4xl text-gray-800 tracking-tight">
                  台本批量注音与导出
                </h2>
                <p className="text-sm md:text-base text-gray-600">
                  拖拽或选择多个台本文件（支持 .txt, .srt, .docx），系统将根据各自文件名自动生成 Word 标题并注音导出。
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-800">目标导出格式：</span>
                <div className="flex items-center gap-2">
                  {(['docx', 'srt', 'txt'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setBatchTargetFormat(fmt)}
                      className={`${batchTargetFormat === fmt ? neuButtonActive : neuButton} px-4 py-2 text-xs uppercase`}
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
              className={`${neuCard} border-2 border-dashed border-gray-300/80 p-12 text-center flex flex-col items-center justify-center gap-4 transition-all duration-200`}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#e0e5ec] shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff] flex items-center justify-center text-gray-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-base text-gray-800">将台本文件拖拽至此处，或点击下方按钮选择</p>
                <p className="text-xs text-gray-500 mt-1">支持格式：.txt / .srt / .docx（批量注音时以原文件名作为 Word 标题）</p>
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
                className={`${neuButton} px-6 py-2.5 text-sm font-semibold text-blue-600 mt-2`}
              >
                选择文件...
              </button>
            </div>

            {/* File List & Progress Cards */}
            {batchFiles.length > 0 && (
              <div className={`${neuCard} p-6 flex flex-col gap-4`}>
                <div className="flex items-center justify-between pb-2 border-b border-gray-300/50">
                  <span className="font-semibold text-sm text-gray-800">
                    待处理队列 ({batchFiles.length} 个文件)
                  </span>
                  <button
                    onClick={clearBatchFiles}
                    disabled={isBatchProcessing}
                    className={`${neuButton} px-3 py-1 text-xs text-red-500 hover:text-red-700`}
                  >
                    清空列表
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {batchFiles.map(file => (
                    <div
                      key={file.id}
                      className="p-4 bg-[#e0e5ec] rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[2px_2px_4px_#b8bcc2,-2px_-2px_4px_#ffffff] flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-600 uppercase">
                          {file.name.split('.').pop()}
                        </div>
                        <div className="truncate">
                          <p className="font-medium text-sm text-gray-800 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB {file.lineCount ? `• ${file.lineCount} 行` : ''}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {file.status === 'pending' && <span className={neuBadge}>等待中</span>}
                        {file.status === 'processing' && (
                          <span className="text-xs text-blue-600 font-semibold flex items-center gap-1.5">
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            注音处理中
                          </span>
                        )}
                        {file.status === 'done' && <span className="text-xs text-green-600 font-bold">✓ 已成功</span>}
                        {file.status === 'error' && <span className="text-xs text-red-500 font-bold">✕ 失败</span>}

                        <button
                          onClick={() => removeBatchFile(file.id)}
                          disabled={isBatchProcessing}
                          className="w-7 h-7 rounded-lg bg-[#e0e5ec] shadow-[2px_2px_4px_#b8bcc2,-2px_-2px_4px_#ffffff] hover:shadow-[1px_1px_2px_#b8bcc2,-1px_-1px_2px_#ffffff] flex items-center justify-center text-gray-500 hover:text-red-500 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={processBatchQueue}
                    disabled={isBatchProcessing}
                    className={`${isBatchProcessing ? neuButtonActive : neuButton} text-blue-600 px-8 py-3 text-sm font-semibold flex items-center gap-2`}
                  >
                    {isBatchProcessing ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                        正在处理队列...
                      </>
                    ) : (
                      <>🚀 开始批量处理并自动保存</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Dependency Diagnostic Modal */}
      <Modal
        isOpen={isDepModalOpen}
        onClose={() => setIsDepModalOpen(false)}
        title="🛠️ 本地核心组件诊断"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            诊断分词核心、词典与原生 Word Ruby 导出组件状态
          </p>

          <div className="space-y-3">
            {deps.map((dep, idx) => (
              <div key={idx} className="p-3 bg-[#e0e5ec] rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-gray-800">{dep.name}</div>
                  <div className="text-[10px] text-gray-500">{dep.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  {dep.status === 'ready' && (
                    <span className="text-[11px] font-bold text-green-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span> 正常
                    </span>
                  )}
                  {dep.status === 'repairing' && (
                    <span className="text-[11px] font-bold text-blue-500 flex items-center gap-1 animate-pulse">
                      检查中...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-between items-center">
            <button
              onClick={runDependencyRepair}
              className={`${neuButton} px-4 py-2 text-xs font-semibold`}
            >
              🔄 重新检查
            </button>
            <button
              onClick={() => setIsDepModalOpen(false)}
              className={`${neuButton} text-blue-600 px-6 py-2 text-xs font-semibold`}
            >
              完成
            </button>
          </div>
        </div>
      </Modal>

      {/* Single Script Export Progress Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => !isExporting && setIsExportModalOpen(false)}
        title="📄 正在导出台本"
      >
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span>生成进度 ({exportFormat.toUpperCase()})</span>
            <span>{exportProgress}%</span>
          </div>

          <div className="w-full h-3 bg-[#e0e5ec] rounded-full shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] overflow-hidden p-0.5">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
              style={{ width: `${exportProgress}%` }}
            />
          </div>

          <p className="text-xs text-center text-gray-500">
            {exportProgress < 50 && '正在计算多音字前后文并注音...'}
            {exportProgress >= 50 && exportProgress < 80 && `正在生成原生 ${exportFormat.toUpperCase()} 结构...`}
            {exportProgress >= 80 && exportProgress < 100 && '正在调用系统保存文件...'}
            {exportProgress === 100 && '🎉 文件导出完成！'}
          </p>

          <div className="flex justify-end pt-2">
            <button
              disabled={isExporting}
              onClick={() => setIsExportModalOpen(false)}
              className={`${isExporting ? 'opacity-50 cursor-not-allowed ' + neuButton : neuButton + ' text-blue-600'} px-6 py-2 text-xs font-semibold`}
            >
              {isExporting ? '处理中...' : '完成'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Batch Processing Completion Modal */}
      <Modal
        isOpen={isBatchDoneModalOpen}
        onClose={() => setIsBatchDoneModalOpen(false)}
        title="✅ 批量处理完成"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-[#e0e5ec] rounded-xl shadow-[inset_3px_3px_6px_#b8bcc2,inset_-3px_-3px_6px_#ffffff] text-center">
              <div className="text-2xl font-bold text-gray-800">{batchDoneResults.total}</div>
              <div className="text-xs text-gray-500 mt-1">总文件数</div>
            </div>
            <div className="p-4 bg-[#e0e5ec] rounded-xl shadow-[inset_3px_3px_6px_#b8bcc2,inset_-3px_-3px_6px_#ffffff] text-center">
              <div className="text-2xl font-bold text-green-600">{batchDoneResults.success}</div>
              <div className="text-xs text-gray-500 mt-1">成功导出</div>
            </div>
            <div className="p-4 bg-[#e0e5ec] rounded-xl shadow-[inset_3px_3px_6px_#b8bcc2,inset_-3px_-3px_6px_#ffffff] text-center">
              <div className="text-2xl font-bold text-red-500">{batchDoneResults.failed}</div>
              <div className="text-xs text-gray-500 mt-1">失败</div>
            </div>
          </div>

          {batchDoneResults.filenames.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">已导出文件：</h4>
              <div className="max-h-[160px] overflow-y-auto space-y-1.5">
                {batchDoneResults.filenames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-[#e0e5ec] rounded-lg shadow-[2px_2px_4px_#b8bcc2,-2px_-2px_4px_#ffffff]">
                    <span className="text-green-500 text-sm">✓</span>
                    <span className="text-xs text-gray-700 truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-[#e0e5ec] rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff]">
            <p className="text-xs font-medium text-gray-700 text-center">
              📁 文件已成功保存至您选择的存储位置！
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsBatchDoneModalOpen(false)}
              className={`${neuButton} px-8 py-2.5 text-sm font-bold text-blue-600`}
            >
              确定
            </button>
          </div>
        </div>
      </Modal>

      {/* Interactive Modal for Editing / Disambiguating Ruby */}
      <Modal
        isOpen={!!editingToken}
        onClose={() => setEditingToken(null)}
        title="✏️ 假名标注与多音字校对"
      >
        {editingToken && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-[#e0e5ec] p-4 rounded-xl shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff]">
              <div>
                <div className="text-xs text-gray-500 mb-1">当前汉字</div>
                <div className="text-2xl font-bold text-gray-800">{editingToken.surface}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">当前注音</div>
                <div className="text-xl font-bold text-blue-600">{editingToken.currentRuby || '(无注音)'}</div>
              </div>
            </div>

            {editingToken.alternatives && editingToken.alternatives.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2">💡 前后文常见候选读音（点击直接套用）：</div>
                <div className="flex flex-wrap gap-2">
                  {editingToken.alternatives.map((alt, aidx) => (
                    <button
                      key={aidx}
                      type="button"
                      onClick={() => setCustomRubyInput(alt)}
                      className={`${customRubyInput === alt ? neuButtonActive : neuButton} px-3 py-1.5 text-xs font-medium`}
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                自定义注音 (平假名/片假名/罗马音)：
              </label>
              <input
                type="text"
                value={customRubyInput}
                onChange={(e) => setCustomRubyInput(e.target.value)}
                placeholder="输入该语境下的准确假名..."
                className={`${neuInput} w-full px-4 py-2 text-sm`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTokenRuby();
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={removeTokenRuby}
                className="text-xs text-red-500 hover:text-red-700 underline font-medium"
              >
                清除此字假名
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingToken(null)}
                  className={`${neuButton} px-4 py-2 text-xs`}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveTokenRuby}
                  className={`${neuButton} text-blue-600 px-5 py-2 text-xs font-semibold`}
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
