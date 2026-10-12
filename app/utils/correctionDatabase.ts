import type { RubyType } from './furigana';
import { validateRubyOverrides, type RubyOverride } from './rubyOverrides';

export interface ProperNounEntry {
  surface: string;
  reading: string;
  type: RubyType;
  createdAt: number;
}

export interface LearnedReading {
  surface: string;
  reading: string;
  alternatives: string[];
  type: RubyType;
  before: string;
  after: string;
  createdAt: number;
}

export interface ScriptCorrectionEntry {
  scriptId: string;
  title: string;
  // Keep previous fingerprints so re-importing an earlier revision retains identity.
  fingerprints: string[];
  updatedAt: number;
  overrides: RubyOverride[];
  learned: LearnedReading[];
  legacy?: boolean;
  adoptedBy?: string;
}

export interface CorrectionDatabaseV2 {
  version: 2;
  glossary: Record<string, ProperNounEntry>;
  scripts: Record<string, ScriptCorrectionEntry>;
}

export function emptyDatabase(): CorrectionDatabaseV2 {
  return { version: 2, glossary: {}, scripts: {} };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validOverrides(value: unknown): RubyOverride[] {
  const entries = validateRubyOverrides(value);
  if (!Array.isArray(value) || entries.length !== value.length) throw new Error('校对记录格式损坏，原数据已保留');
  return entries;
}

function validateLearned(value: unknown): LearnedReading[] {
  if (!Array.isArray(value)) throw new Error('学习读音格式无效');
  return value.filter((item): item is LearnedReading => {
    if (!object(item) || typeof item.surface !== 'string' || !item.surface || typeof item.reading !== 'string' || !item.reading ||
      !Array.isArray(item.alternatives) || !item.alternatives.every(value => typeof value === 'string') ||
      typeof item.before !== 'string' || typeof item.after !== 'string' ||
      !['hiragana', 'katakana', 'romaji'].includes(String(item.type)) || !Number.isFinite(item.createdAt)) {
      throw new Error('学习读音条目无效');
    }
    return true;
  });
}

export function validateGlossary(value: unknown): Record<string, ProperNounEntry> {
  if (!object(value)) throw new Error('专名词典格式无效');
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (!object(item) || typeof item.surface !== 'string' || !item.surface.trim() || item.surface.includes('\n') ||
      key !== item.surface || typeof item.reading !== 'string' || !item.reading.trim() || item.reading.includes('\n') ||
      !['hiragana', 'katakana', 'romaji'].includes(String(item.type)) || !Number.isFinite(item.createdAt)) {
      throw new Error(`专名词典条目无效：${key}`);
    }
    return [key, { surface: item.surface, reading: item.reading, type: item.type as RubyType, createdAt: item.createdAt as number }];
  }));
}

/** Strict validation: never turn an unreadable database into an empty writable one. */
export function migrateDatabase(value: unknown): CorrectionDatabaseV2 {
  if (!object(value)) throw new Error('校对数据库格式无效');
  if (value.version === 2) {
    if (!object(value.scripts)) throw new Error('台本校对格式无效');
    const scripts = Object.fromEntries(Object.entries(value.scripts).map(([id, item]) => {
      if (!object(item) || item.scriptId !== id || typeof item.title !== 'string' ||
        !Array.isArray(item.fingerprints) || !item.fingerprints.every(fp => typeof fp === 'string' && /^sha256:[a-f0-9]{64}$/.test(fp)) ||
        !Number.isFinite(item.updatedAt) || (item.legacy !== undefined && typeof item.legacy !== 'boolean') ||
        (item.adoptedBy !== undefined && typeof item.adoptedBy !== 'string')) throw new Error(`台本记录无效：${id}`);
      return [id, { scriptId: id, title: item.title, fingerprints: item.fingerprints as string[],
        updatedAt: item.updatedAt as number, overrides: validOverrides(item.overrides), learned: validateLearned(item.learned || []),
        ...(item.legacy ? { legacy: true } : {}), ...(item.adoptedBy ? { adoptedBy: item.adoptedBy as string } : {}) }];
    }));
    return { version: 2, glossary: validateGlossary(value.glossary), scripts };
  }
  // v1 keys are arbitrary titles, including the literal title "version".
  if (typeof value.version === 'number' && value.version !== 1) throw new Error(`不支持校对数据库版本：${String(value.version)}`);
  const library = value.version === 1 ? value.scripts : value;
  if (!object(library)) throw new Error('旧版校对格式无效');
  const scripts = Object.fromEntries(Object.entries(library).map(([title, entries]) => {
    const id = `legacy:${title}`;
    return [id, { scriptId: id, title, fingerprints: [], updatedAt: 0, overrides: validOverrides(entries), learned: [], legacy: true }];
  }));
  return { version: 2, glossary: {}, scripts };
}

export async function fingerprintText(text: string): Promise<string> {
  // Preserve spaces and empty lines; offsets and identical-line matching depend on them.
  const bytes = new TextEncoder().encode(text.replace(/\r\n?/g, '\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function findScript(database: CorrectionDatabaseV2, fingerprint: string): ScriptCorrectionEntry | undefined {
  return Object.values(database.scripts).find(script => !script.legacy && script.fingerprints.includes(fingerprint));
}

export function resolveScript(database: CorrectionDatabaseV2, title: string, text: string, fingerprint: string, id = `script:${crypto.randomUUID()}`) {
  const known = findScript(database, fingerprint);
  if (known) return { database, scriptId: known.scriptId };
  const legacy = Object.values(database.scripts).find(script => script.legacy && !script.adoptedBy && script.title === title &&
    script.overrides.some(entry => text.split('\n').includes(entry.line)));
  const script: ScriptCorrectionEntry = { scriptId: id, title, fingerprints: [fingerprint], updatedAt: Date.now(), overrides: legacy?.overrides || [], learned: legacy?.learned || [] };
  return { scriptId: id, database: { ...database, scripts: { ...database.scripts,
    ...(legacy ? { [legacy.scriptId]: { ...legacy, adoptedBy: id } } : {}), [id]: script } } };
}

export function updateScript(database: CorrectionDatabaseV2, scriptId: string, title: string, fingerprint: string): CorrectionDatabaseV2 {
  const script = database.scripts[scriptId];
  if (!script) return database;
  if (script.title === title && script.fingerprints.includes(fingerprint)) return database;
  return { ...database, scripts: { ...database.scripts, [scriptId]: { ...script, title, updatedAt: Date.now(),
    fingerprints: script.fingerprints.includes(fingerprint) ? script.fingerprints : [...script.fingerprints, fingerprint] } } };
}

export function setScriptOverrides(database: CorrectionDatabaseV2, scriptId: string, overrides: RubyOverride[]): CorrectionDatabaseV2 {
  const script = database.scripts[scriptId];
  if (!script) return database;
  return { ...database, scripts: { ...database.scripts, [scriptId]: { ...script, overrides, updatedAt: Date.now() } } };
}

export function learnReading(database: CorrectionDatabaseV2, scriptId: string, learned: LearnedReading): CorrectionDatabaseV2 {
  const script = database.scripts[scriptId];
  if (!script) return database;
  const same = (value: LearnedReading) => value.surface === learned.surface && value.type === learned.type &&
    value.before === learned.before && value.after === learned.after;
  const learnedList = [...script.learned.filter(value => !same(value)), learned];
  return { ...database, scripts: { ...database.scripts, [scriptId]: { ...script, learned: learnedList, updatedAt: Date.now() } } };
}

export function deleteLearnedReading(database: CorrectionDatabaseV2, scriptId: string, index: number): CorrectionDatabaseV2 {
  const script = database.scripts[scriptId];
  if (!script) return database;
  const learnedList = script.learned.filter((_, i) => i !== index);
  return { ...database, scripts: { ...database.scripts, [scriptId]: { ...script, learned: learnedList, updatedAt: Date.now() } } };
}
