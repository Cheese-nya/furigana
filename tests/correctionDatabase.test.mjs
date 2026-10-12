import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';
const { emptyDatabase, migrateDatabase, fingerprintText, resolveScript, updateScript, setScriptOverrides, learnReading, deleteLearnedReading } = loadTypescript('../app/utils/correctionDatabase.ts');
const entry = { line: '二人で', start: 0, surface: '二人', reading: 'ふたり', type: 'hiragana' };

test('legacy records migrate without changing entries and migration is idempotent', () => {
  const v1 = { 同名: [entry], 空台本: [] };
  const v2 = migrateDatabase(v1);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.scripts['legacy:同名'].overrides, [entry]);
  assert.deepEqual(v2.scripts['legacy:空台本'].overrides, []);
  assert.deepEqual(migrateDatabase(v2), v2);
  assert.deepEqual(v1, { 同名: [entry], 空台本: [] });
  assert.deepEqual(migrateDatabase({ version: [entry] }).scripts['legacy:version'].overrides, [entry]);
  assert.throws(() => migrateDatabase({ version: 9 }), /不支持/);
  assert.throws(() => migrateDatabase({ bad: [null] }), /损坏/);
});

test('UUID identity survives title changes, edits and re-importing older revisions', async () => {
  const a = await fingerprintText('二人で');
  const b = await fingerprintText('二人で\n学校へ');
  const first = resolveScript(emptyDatabase(), '原标题', '二人で', a, 'script:a');
  const corrected = setScriptOverrides(first.database, first.scriptId, [entry]);
  const edited = updateScript(corrected, first.scriptId, '改名', b);
  assert.deepEqual(edited.scripts['script:a'].overrides, [entry]);
  assert.equal(resolveScript(edited, '重命名', '二人で', a).scriptId, 'script:a');
  assert.equal(resolveScript(edited, '改名', '二人で\n学校へ', b).scriptId, 'script:a');
  assert.equal(await fingerprintText('二人で\r\n学校へ'), b);
  assert.notEqual(await fingerprintText(' 二人で'), a);
});

test('different content with the same title does not share corrections; legacy title binds once', async () => {
  const a = await fingerprintText('二人で');
  const b = await fingerprintText('二人で\n別の内容');
  const migrated = migrateDatabase({ 同名: [entry] });
  const first = resolveScript(migrated, '同名', '二人で', a, 'script:a');
  const second = resolveScript(first.database, '同名', '二人で\n別の内容', b, 'script:b');
  assert.deepEqual(first.database.scripts['script:a'].overrides, [entry]);
  assert.deepEqual(second.database.scripts['script:b'].overrides, []);
  assert.deepEqual(second.database.scripts['legacy:同名'].overrides, [entry]);
  assert.equal(second.database.scripts['legacy:同名'].adoptedBy, 'script:a');
});

test('browser storage keeps v1 intact and refuses corrupt v2 instead of falling back', async () => {
  const { loadCorrections, saveCorrections } = loadTypescript('../app/utils/correctionStorage.ts');
  const records = new Map([['furigana-corrections-v1', JSON.stringify({ 同名: [entry] })]]);
  const legacy = records.get('furigana-corrections-v1');
  globalThis.window = { location: { search: '' } };
  globalThis.localStorage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  try {
    const database = await loadCorrections();
    await saveCorrections(database);
    await assert.rejects(saveCorrections({ version: 99 }), /不支持/);
    assert.equal(records.get('furigana-corrections-v1'), legacy);
    assert.equal(JSON.parse(records.get('furigana-corrections-v2')).version, 2);
    records.set('furigana-corrections-v2', '{broken');
    await assert.rejects(loadCorrections());
    assert.equal(records.get('furigana-corrections-v2'), '{broken');
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
  }
});

test('learned readings can be added, deduplicated by context, and deleted', () => {
  const db = resolveScript(emptyDatabase(), '测试', '辛いラーメンを食べた', 'sha256:111', 'script:t').database;
  const l1 = { surface: '辛い', reading: 'からい', alternatives: ['からい', 'つらい'], type: 'hiragana', before: '', after: 'ラーメン', createdAt: 1 };
  const l2 = { surface: '辛い', reading: 'つらい', alternatives: ['からい', 'つらい'], type: 'hiragana', before: '失恋は', after: 'ことだ', createdAt: 2 };
  const updated1 = learnReading(db, 'script:t', l1);
  assert.equal(updated1.scripts['script:t'].learned.length, 1);
  // Re-learning same context updates reading
  const updated2 = learnReading(updated1, 'script:t', { ...l1, reading: 'から～い' });
  assert.equal(updated2.scripts['script:t'].learned.length, 1);
  assert.equal(updated2.scripts['script:t'].learned[0].reading, 'から～い');
  // Different context adds new entry
  const updated3 = learnReading(updated2, 'script:t', l2);
  assert.equal(updated3.scripts['script:t'].learned.length, 2);
  // Delete by index
  const deleted = deleteLearnedReading(updated3, 'script:t', 0);
  assert.equal(deleted.scripts['script:t'].learned.length, 1);
  assert.equal(deleted.scripts['script:t'].learned[0].reading, 'つらい');
});
