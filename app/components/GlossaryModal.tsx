'use client';

import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { validateGlossary, type ProperNounEntry } from '../utils/correctionDatabase';
import { saveBlob } from '../utils/fileSave';
import type { RubyType } from '../utils/furigana';
import type { Translations } from '../utils/i18n';

interface Props {
  isOpen: boolean;
  onClose(): void;
  entries: Record<string, ProperNounEntry>;
  onChange(entries: Record<string, ProperNounEntry>): void;
  t: Translations;
}

export function GlossaryModal({ isOpen, onClose, entries, onChange, t }: Props) {
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
      setMessage(t.glossaryUpdatedNotice);
    } catch (cause) { setError(String(cause)); }
  };

  const importFile = async (file: File) => {
    try {
      const value = JSON.parse(await file.text());
      if (value.version !== 1 || value.kind !== 'furigana-glossary') throw new Error(t.glossaryImportInvalid);
      const imported = validateGlossary(value.entries);
      // Keep existing definitions on conflict. User can edit them explicitly afterwards.
      onChange({ ...imported, ...entries });
      setError('');
      setMessage(t.glossaryImportSuccess.replace('{count}', String(Object.keys(imported).length)));
    } catch (cause) { setError(`${t.glossaryImportFailed}${String(cause)}`); }
  };

  const exportFile = async () => {
    setSaving(true);
    try {
      const content = JSON.stringify({ kind: 'furigana-glossary', version: 1, entries }, null, 2);
      const result = await saveBlob(new Blob([content], { type: 'application/json' }), 'proper-nouns.json');
      setMessage(result.success ? (result.downloadStarted ? t.downloadHandedOver : t.glossaryExportSuccess) : t.glossaryExportCancelled);
      setError('');
    } catch (cause) { setError(`${t.glossaryExportFailed}${String(cause)}`); }
    finally { setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={onClose} title={t.glossaryModalTitle} maxWidth="lg">
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.glossaryModalDesc}</p>
      <div className="flex flex-wrap gap-2.5">
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = '';
        }} />
        <button className="lg-pill-interactive liquid-glass-btn px-4 py-2.5 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full shadow-xs inline-flex items-center gap-1.5 hover:text-slate-950 dark:hover:text-white transition-all" onClick={() => inputRef.current?.click()}>
          <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {t.importGlossaryButton}
        </button>
        <button className="lg-pill-interactive liquid-glass-btn px-4 py-2.5 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full shadow-xs inline-flex items-center gap-1.5 hover:text-slate-950 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all" disabled={saving} onClick={exportFile}>
          <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t.exportGlossaryButton}
        </button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); saveEntry(); }}>
        <fieldset className="lg-grouped-card grid gap-3.5 rounded-2xl p-4">
          <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100 px-1">{editingSurface ? t.editEntryLegend : t.addEntryLegend}</legend>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{t.sourceTextLabel}<input aria-label={t.sourceTextLabel} className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#111422]/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500/70 transition-all shadow-xs" value={surface} onChange={e => setSurface(e.target.value)} placeholder={t.sourceTextPlaceholder} /></label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{t.readingLabel}<input aria-label={t.readingLabel} className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#111422]/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500/70 transition-all shadow-xs" value={reading} onChange={e => setReading(e.target.value)} placeholder={t.readingPlaceholder} /></label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{t.readingFormatLabel}<select aria-label={t.readingFormatLabel} className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#111422]/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500/70 transition-all shadow-xs" value={type} onChange={e => setType(e.target.value as RubyType)}>
            <option value="hiragana">{t.hiragana}</option><option value="katakana">{t.katakana}</option><option value="romaji">{t.romajiFormatOption}</option>
          </select></label>
          <div className="flex gap-2.5 pt-1">
            <button type="submit" className="lg-pill-interactive lg-btn-prominent liquid-glass-btn-primary px-5 py-2.5 min-h-[38px] text-xs font-semibold text-white rounded-full shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all" disabled={!surface.trim() || !reading.trim()}>{t.saveEntryButton}</button>
            {editingSurface && <button type="button" className="lg-pill-interactive liquid-glass-btn px-4 py-2.5 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full shadow-xs hover:text-slate-950 dark:hover:text-white transition-all" onClick={reset}>{t.cancelEditButton}</button>}
          </div>
        </fieldset>
      </form>
      <label className="grid gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{t.searchEntryLabel}<input className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#111422]/90 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500/70 transition-all shadow-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchEntryPlaceholder} /></label>
      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{t.entryCountSummary.replace('{total}', String(Object.keys(entries).length)).replace('{visible}', String(visible.length))}</p>
      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {visible.map(entry => <li key={entry.surface} className="lg-grouped-card flex items-center justify-between gap-3 rounded-2xl p-3.5 hover:border-slate-300/80 dark:hover:border-white/20 transition-colors">
          <div lang="ja"><strong className="text-slate-900 dark:text-slate-100 font-semibold">{entry.surface}</strong><span className="ml-3 text-indigo-600 dark:text-indigo-400 font-semibold">{entry.reading}</span></div>
          <div className="flex shrink-0 gap-2 text-xs">
            <button aria-label={`${t.editButton} ${entry.surface}`} className="lg-pill-interactive liquid-glass-btn px-3.5 py-1.5 min-h-[32px] text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full shadow-2xs hover:text-slate-950 dark:hover:text-white transition-all" onClick={() => { setSurface(entry.surface); setReading(entry.reading); setType(entry.type); setEditingSurface(entry.surface); }}>{t.editButton}</button>
            <button aria-label={`${t.deleteButton} ${entry.surface}`} className="lg-pill-interactive rounded-full border border-rose-200/70 dark:border-rose-500/20 bg-rose-50/70 dark:bg-rose-500/10 px-3.5 py-1.5 min-h-[32px] text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors" onClick={() => {
              const next = { ...entries }; delete next[entry.surface]; onChange(next);
              if (editingSurface === entry.surface) reset();
            }}>{t.deleteButton}</button>
          </div>
        </li>)}
      </ul>
      {error && <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-500/15 border border-rose-200/80 dark:border-rose-500/30 rounded-xl p-3">{error}</p>}
      {message && <p role="status" className="text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 rounded-xl p-3">{message}</p>}
    </div>
  </Modal>;
}
