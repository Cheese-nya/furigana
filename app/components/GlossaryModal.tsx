'use client';

import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { validateGlossary, type ProperNounEntry } from '../utils/correctionDatabase';
import { saveBlob } from '../utils/fileSave';
import type { RubyType } from '../utils/furigana';

interface Props {
  isOpen: boolean;
  onClose(): void;
  entries: Record<string, ProperNounEntry>;
  onChange(entries: Record<string, ProperNounEntry>): void;
}

export function GlossaryModal({ isOpen, onClose, entries, onChange }: Props) {
  const [surface, setSurface] = useState('');
  const [reading, setReading] = useState('');
  const [type, setType] = useState<RubyType>('hiragana');
  const [editingSurface, setEditingSurface] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const visible = Object.values(entries).filter(entry => entry.surface.includes(search) || entry.reading.includes(search))
    .sort((a, b) => a.surface.localeCompare(b.surface, 'ja'));

  const reset = () => { setSurface(''); setReading(''); setEditingSurface(null); };
  const saveEntry = () => {
    const word = surface.trim();
    const kana = reading.trim();
    try {
      const next = { ...entries };
      if (editingSurface && editingSurface !== word) delete next[editingSurface];
      next[word] = { surface: word, reading: kana, type, createdAt: entries[editingSurface || word]?.createdAt || Date.now() };
      validateGlossary(next);
      onChange(next);
      reset();
      setError('');
      setMessage('词典已更新，将应用于所有台本。');
    } catch (cause) { setError(String(cause)); }
  };

  const importFile = async (file: File) => {
    try {
      const value = JSON.parse(await file.text());
      if (value.version !== 1 || value.kind !== 'furigana-glossary') throw new Error('请导入本工具导出的专名词典 JSON');
      const imported = validateGlossary(value.entries);
      // Keep existing definitions on conflict. User can edit them explicitly afterwards.
      onChange({ ...imported, ...entries });
      setError('');
      setMessage(`导入 ${Object.keys(imported).length} 个条目；同名条目保留当前读音。`);
    } catch (cause) { setError(`导入失败：${String(cause)}`); }
  };

  const exportFile = async () => {
    setSaving(true);
    try {
      const content = JSON.stringify({ kind: 'furigana-glossary', version: 1, entries }, null, 2);
      const result = await saveBlob(new Blob([content], { type: 'application/json' }), '专名词典.json');
      setMessage(result.success ? result.downloadStarted ? '词典已交给浏览器下载。' : '词典已导出。' : '已取消导出。');
      setError('');
    } catch (cause) { setError(`导出失败：${String(cause)}`); }
    finally { setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={onClose} title="专名词典" maxWidth="lg">
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 leading-relaxed">人名、地名和作品专名在所有台本中复用。按原文精确匹配，长词优先；Word 原注音和单处人工校对优先于词典。</p>
      <div className="flex flex-wrap gap-2.5">
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = '';
        }} />
        <button className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors shadow-xs" onClick={() => inputRef.current?.click()}>导入词典</button>
        <button className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-50 transition-colors shadow-xs" disabled={saving} onClick={exportFile}>导出词典</button>
      </div>
      <fieldset className="grid gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4">
        <legend className="text-sm font-semibold text-zinc-900 px-1">{editingSurface ? '编辑条目' : '添加条目'}</legend>
        <label className="grid gap-1.5 text-xs font-medium text-zinc-700">原文<input aria-label="词典原文" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-xs" value={surface} onChange={e => setSurface(e.target.value)} placeholder="例如：小日向" /></label>
        <label className="grid gap-1.5 text-xs font-medium text-zinc-700">读音<input aria-label="词典读音" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-xs" value={reading} onChange={e => setReading(e.target.value)} placeholder="例如：こひなた" /></label>
        <label className="grid gap-1.5 text-xs font-medium text-zinc-700">读音格式<select aria-label="词典读音格式" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-xs" value={type} onChange={e => setType(e.target.value as RubyType)}>
          <option value="hiragana">平假名</option><option value="katakana">片假名</option><option value="romaji">罗马音（其他模式也保留原样）</option>
        </select></label>
        <div className="flex gap-2.5 pt-1">
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-xs" disabled={!surface.trim() || !reading.trim()} onClick={saveEntry}>保存条目</button>
          {editingSurface && <button className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-xs" onClick={reset}>取消编辑</button>}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-xs font-medium text-zinc-700">查找条目<input className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder="按原文或读音搜索" /></label>
      <p className="text-xs text-zinc-500">共 {Object.keys(entries).length} 个条目，当前匹配 {visible.length} 个。</p>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {visible.map(entry => <li key={entry.surface} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 hover:border-zinc-300 transition-colors shadow-xs">
          <div lang="ja"><strong className="text-zinc-900 font-semibold">{entry.surface}</strong><span className="ml-3 text-blue-600 font-medium">{entry.reading}</span></div>
          <div className="flex shrink-0 gap-2 text-xs">
            <button aria-label={`编辑 ${entry.surface}`} className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-xs" onClick={() => { setSurface(entry.surface); setReading(entry.reading); setType(entry.type); setEditingSurface(entry.surface); }}>编辑</button>
            <button aria-label={`删除 ${entry.surface}`} className="rounded-md border border-red-200 bg-red-50/60 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100/70 hover:text-red-700 transition-colors" onClick={() => {
              const next = { ...entries }; delete next[entry.surface]; onChange(next);
              if (editingSurface === entry.surface) reset();
            }}>删除</button>
          </div>
        </li>)}
      </ul>
      {error && <p role="alert" className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {message && <p role="status" className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{message}</p>}
    </div>
  </Modal>;
}
