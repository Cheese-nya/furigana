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
      <p className="text-sm">人名、地名和作品专名在所有台本中复用。按原文精确匹配，长词优先；Word 原注音和单处人工校对优先于词典。</p>
      <div className="flex flex-wrap gap-3">
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = '';
        }} />
        <button className="rounded-lg bg-white/60 px-3 py-2 text-sm" onClick={() => inputRef.current?.click()}>导入词典</button>
        <button className="rounded-lg bg-white/60 px-3 py-2 text-sm disabled:opacity-50" disabled={saving} onClick={exportFile}>导出词典</button>
      </div>
      <fieldset className="grid gap-3 rounded-xl bg-white/40 p-4">
        <legend className="font-semibold">{editingSurface ? '编辑条目' : '添加条目'}</legend>
        <label className="grid gap-1 text-sm">原文<input aria-label="词典原文" className="rounded-lg bg-white/80 px-3 py-2" value={surface} onChange={e => setSurface(e.target.value)} placeholder="例如：小日向" /></label>
        <label className="grid gap-1 text-sm">读音<input aria-label="词典读音" className="rounded-lg bg-white/80 px-3 py-2" value={reading} onChange={e => setReading(e.target.value)} placeholder="例如：こひなた" /></label>
        <label className="grid gap-1 text-sm">读音格式<select aria-label="词典读音格式" className="rounded-lg bg-white/80 px-3 py-2" value={type} onChange={e => setType(e.target.value as RubyType)}>
          <option value="hiragana">平假名</option><option value="katakana">片假名</option><option value="romaji">罗马音（其他模式也保留原样）</option>
        </select></label>
        <div className="flex gap-3">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={!surface.trim() || !reading.trim()} onClick={saveEntry}>保存条目</button>
          {editingSurface && <button className="px-3 py-2 text-sm" onClick={reset}>取消编辑</button>}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm">查找条目<input className="rounded-lg bg-white/80 px-3 py-2" value={search} onChange={e => setSearch(e.target.value)} placeholder="按原文或读音搜索" /></label>
      <p className="text-xs">共 {Object.keys(entries).length} 个条目，当前匹配 {visible.length} 个。</p>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {visible.map(entry => <li key={entry.surface} className="flex items-center justify-between gap-3 rounded-lg bg-white/40 p-3">
          <div lang="ja"><strong>{entry.surface}</strong><span className="ml-3 text-blue-700">{entry.reading}</span></div>
          <div className="flex shrink-0 gap-3 text-xs">
            <button aria-label={`编辑 ${entry.surface}`} onClick={() => { setSurface(entry.surface); setReading(entry.reading); setType(entry.type); setEditingSurface(entry.surface); }}>编辑</button>
            <button aria-label={`删除 ${entry.surface}`} className="text-red-700" onClick={() => {
              const next = { ...entries }; delete next[entry.surface]; onChange(next);
              if (editingSurface === entry.surface) reset();
            }}>删除</button>
          </div>
        </li>)}
      </ul>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  </Modal>;
}
