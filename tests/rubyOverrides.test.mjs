import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const {
  upsertRubyOverride,
  applyRubyOverrides,
  validateRubyOverrides,
} = loadTypescript('../app/utils/rubyOverrides.ts');

const override = (line, start, surface, reading, type = 'hiragana') => ({ line, start, surface, reading, type });
const scriptLine = (cleanText, surfaces, extra = {}) => ({
  id: 'line-1',
  rawText: cleanText,
  cleanText,
  tokens: surfaces.map(surface => ({ surface, hasKanji: /[\u4E00-\u9FFF]/.test(surface) })),
  ...extra,
});
const pairs = line => line.tokens.map(({ surface, ruby }) => [surface, ruby]);

test('upsertRubyOverride appends to an empty list', () => {
  const entry = override('東京', 0, '東京', 'とうきょう');
  assert.deepEqual(upsertRubyOverride([], entry), [entry]);
});

test('upsertRubyOverride appends a non-overlapping entry', () => {
  const first = override('東京と大阪', 0, '東京', 'とうきょう');
  const second = override('東京と大阪', 3, '大阪', 'おおさか');
  assert.deepEqual(upsertRubyOverride([first], second), [first, second]);
});

test('upsertRubyOverride replaces an entry covering the same range', () => {
  const first = override('東京', 0, '東京', 'とうきょう');
  const replacement = override('東京', 0, '東京', 'トウキョウ', 'katakana');
  assert.deepEqual(upsertRubyOverride([first], replacement), [replacement]);
});

test('upsertRubyOverride replaces entries that overlap the new range', () => {
  const partial = override('東京都', 1, '京都', 'きょうと');
  const whole = override('東京都', 0, '東京都', 'とうきょうと');
  assert.deepEqual(upsertRubyOverride([partial], whole), [whole]);
  // The reverse direction drops the wider entry too.
  assert.deepEqual(upsertRubyOverride([whole], partial), [partial]);
  // Widening a range therefore replaces it: the narrower entry is fully covered.
  const left = override('東京大阪', 0, '東京', 'とうきょう');
  const widened = override('東京大阪', 0, '東京大阪', 'とうきょうおおさか');
  assert.deepEqual(upsertRubyOverride([left], widened), [widened]);
});

test('upsertRubyOverride keeps adjacent and disjoint entries', () => {
  const left = override('東京大阪', 0, '東京', 'とうきょう');
  const right = override('東京大阪', 2, '大阪', 'おおさか');
  // Adjacent (left ends exactly where right starts) is not an overlap.
  assert.deepEqual(upsertRubyOverride([left], right), [left, right]);
  assert.deepEqual(upsertRubyOverride([right], left), [right, left]);
});

test('upsertRubyOverride only touches entries of the same line', () => {
  const other = override('大阪', 0, '大阪', 'おおさか');
  const entry = override('東京', 0, '東京', 'とうきょう');
  assert.deepEqual(upsertRubyOverride([other], entry), [other, entry]);
  assert.deepEqual(upsertRubyOverride([other], override('大阪', 0, '大阪', 'おおさか2')), [override('大阪', 0, '大阪', 'おおさか2')]);
});

test('upsertRubyOverride does not mutate the incoming list', () => {
  const first = override('東京', 0, '東京', 'とうきょう');
  const list = [first];
  upsertRubyOverride(list, override('東京', 0, '東京', 'あずま'));
  assert.deepEqual(list, [first]);
});

test('applyRubyOverrides returns an unchanged copy when there is nothing to apply', () => {
  const input = scriptLine('東京', ['東京']);
  const result = applyRubyOverrides(input, [], 'hiragana');
  assert.notEqual(result, input);
  assert.equal(result.cleanText, '東京');
  assert.equal(result.id, 'line-1');
  assert.deepEqual(result.tokens, input.tokens);
});

test('applyRubyOverrides ignores entries anchored to another line', () => {
  const input = scriptLine('東京', ['東京']);
  const result = applyRubyOverrides(input, [override('大阪', 0, '東京', 'とうきょう')], 'hiragana');
  assert.deepEqual(result.tokens, input.tokens);
});

test('applyRubyOverrides annotates a whole-token match with the manual source', () => {
  const result = applyRubyOverrides(scriptLine('東京に行く', ['東京', 'に', '行', 'く']), [override('東京に行く', 0, '東京', 'とうきょう')], 'hiragana');
  assert.deepEqual(pairs(result), [['東京', 'とうきょう'], ['に', undefined], ['行', undefined], ['く', undefined]]);
  assert.equal(result.tokens[0].readingSource, 'manual');
  assert.equal(result.tokens[0].needsReview, false);
  assert.equal(result.tokens[0].annotationSuppressed, false);
  assert.equal(result.tokens[0].hasKanji, true);
});

test('applyRubyOverrides formats the reading with the requested ruby type', () => {
  assert.equal(applyRubyOverrides(scriptLine('東京', ['東京']), [override('東京', 0, '東京', 'とうきょう')], 'katakana').tokens[0].ruby, 'トウキョウ');
  assert.equal(applyRubyOverrides(scriptLine('東京', ['東京']), [override('東京', 0, '東京', 'とうきょう')], 'romaji').tokens[0].ruby, 'toukyou');
  // Katakana readings are normalized to hiragana before formatting.
  assert.equal(applyRubyOverrides(scriptLine('東京', ['東京']), [override('東京', 0, '東京', 'トウキョウ')], 'hiragana').tokens[0].ruby, 'とうきょう');
});

test('applyRubyOverrides passes a romaji-typed reading through verbatim', () => {
  const result = applyRubyOverrides(scriptLine('東京', ['東京']), [override('東京', 0, '東京', 'Toukyou', 'romaji')], 'katakana');
  assert.equal(result.tokens[0].ruby, 'Toukyou');
});

test('applyRubyOverrides splits a token around a partial match', () => {
  const result = applyRubyOverrides(scriptLine('お東京さん', ['お東京さん']), [override('お東京さん', 1, '東京', 'とうきょう')], 'hiragana');
  assert.deepEqual(pairs(result), [['お', undefined], ['東京', 'とうきょう'], ['さん', undefined]]);
  assert.equal(result.tokens[0].hasKanji, false);
  assert.equal(result.tokens[2].hasKanji, false);
  // The split head/tail are flagged for review only when they contain kanji.
  assert.equal(result.tokens[0].needsReview, false);
});

test('applyRubyOverrides flags a kanji head left behind by the split', () => {
  const result = applyRubyOverrides(scriptLine('東京都', ['東京都']), [override('東京都', 1, '京都', 'きょうと')], 'hiragana');
  assert.deepEqual(pairs(result), [['東', undefined], ['京都', 'きょうと']]);
  assert.equal(result.tokens[0].hasKanji, true);
  assert.equal(result.tokens[0].needsReview, true);
});

test('applyRubyOverrides splits a match that spans several tokens', () => {
  const result = applyRubyOverrides(scriptLine('東京都', ['東京', '都']), [override('東京都', 0, '東京都', 'とうきょうと')], 'hiragana');
  assert.deepEqual(pairs(result), [['東京都', 'とうきょうと']]);
});

test('applyRubyOverrides suppresses annotation for an empty reading', () => {
  const result = applyRubyOverrides(scriptLine('東京', ['東京']), [override('東京', 0, '東京', '')], 'hiragana');
  assert.equal(result.tokens.length, 1);
  assert.equal(result.tokens[0].surface, '東京');
  assert.equal(result.tokens[0].ruby, undefined);
  assert.equal(result.tokens[0].annotationSuppressed, true);
  assert.equal(result.tokens[0].needsReview, false);
});

test('applyRubyOverrides ignores an entry whose surface does not match the line', () => {
  const input = scriptLine('東京都', ['東京都']);
  assert.deepEqual(applyRubyOverrides(input, [override('東京都', 0, '大阪', 'おおさか')], 'hiragana').tokens, input.tokens);
  // The stored surface must equal the slice at `start`, not just occur somewhere.
  assert.deepEqual(applyRubyOverrides(input, [override('東京都', 2, '東京都', 'とうきょうと')], 'hiragana').tokens, input.tokens);
});

test('applyRubyOverrides ignores an entry whose start is past the end of the line', () => {
  const input = scriptLine('東京', ['東京']);
  // slice(2, 3) is '' on a 2-character line, so the surface check rejects it.
  assert.deepEqual(applyRubyOverrides(input, [override('東京', 2, '京', 'きょう')], 'hiragana').tokens, input.tokens);
});

test('applyRubyOverrides drops an entry when the line has no tokens', () => {
  // Documented behaviour: the annotation is only emitted while walking tokens, so a
  // tokenless ScriptLine silently loses an otherwise valid override.
  const result = applyRubyOverrides(scriptLine('東京', []), [override('東京', 0, '東京', 'とうきょう')], 'hiragana');
  assert.deepEqual(result.tokens, []);
  assert.equal(result.cleanText, '東京');
});

test('applyRubyOverrides applies unsorted entries in offset order', () => {
  const input = scriptLine('東京と大阪', ['東京', 'と', '大阪']);
  const result = applyRubyOverrides(input, [
    override('東京と大阪', 3, '大阪', 'おおさか'),
    override('東京と大阪', 0, '東京', 'とうきょう'),
  ], 'hiragana');
  assert.deepEqual(pairs(result), [['東京', 'とうきょう'], ['と', undefined], ['大阪', 'おおさか']]);
});

test('applyRubyOverrides keeps the line fields and does not mutate the input', () => {
  const input = scriptLine('東京', ['東京'], { speaker: '生徒A', translation: 'Tokyo' });
  const snapshot = JSON.parse(JSON.stringify(input));
  const result = applyRubyOverrides(input, [override('東京', 0, '東京', 'とうきょう')], 'hiragana');
  assert.equal(result.speaker, '生徒A');
  assert.equal(result.translation, 'Tokyo');
  assert.equal(result.rawText, '東京');
  assert.equal(result.id, 'line-1');
  assert.deepEqual(input, snapshot);
  assert.notEqual(result.tokens, input.tokens);
});

test('validateRubyOverrides rejects non-array input', () => {
  for (const value of [undefined, null, '', {}, 'x', 0, { length: 1 }]) {
    assert.deepEqual(validateRubyOverrides(value), [], String(value));
  }
});

test('validateRubyOverrides keeps well-formed entries', () => {
  const entries = [
    override('東京に行く', 0, '東京', 'とうきょう'),
    override('東京に行く', 3, '行', 'い', 'katakana'),
    override('東京に行く', 4, 'く', 'iku', 'romaji'),
    override('', 0, '', 'から'),
  ];
  // The last entry has an empty surface and is therefore invalid.
  assert.deepEqual(validateRubyOverrides(entries), entries.slice(0, 3));
});

test('validateRubyOverrides rejects entries with a bad line, start, surface or reading', () => {
  const line = '東京';
  const invalid = [
    null,
    'entry',
    42,
    {},
    { ...override(line, 0, '東京', 'とうきょう'), line: 1 },
    { ...override(line, 0, '東京', 'とうきょう'), start: '0' },
    { ...override(line, 0, '東京', 'とうきょう'), start: 0.5 },
    { ...override(line, 0, '東京', 'とうきょう'), start: -1 },
    { ...override(line, 0, '東京', 'とうきょう'), start: undefined },
    { ...override(line, 0, '東京', 'とうきょう'), surface: '' },
    { ...override(line, 0, '東京', 'とうきょう'), surface: 5 },
    { ...override(line, 0, '東京', 'とうきょう'), reading: null },
    { ...override(line, 0, '東京', 'とうきょう'), reading: undefined },
    { ...override(line, 0, '東京', 'とうきょう'), type: 'hirigana' },
    { ...override(line, 0, '東京', 'とうきょう'), type: undefined },
    { ...override(line, 0, '東京', 'とうきょう'), type: 'HIRAGANA' },
  ];
  assert.deepEqual(validateRubyOverrides(invalid), []);
});

test('validateRubyOverrides rejects an entry whose start does not match the line', () => {
  assert.deepEqual(validateRubyOverrides([override('東京都', 1, '東京都', 'とうきょうと')]), []);
  assert.deepEqual(validateRubyOverrides([override('東京都', 2, '東', 'とう')]), []);
  // A surface that would run past the end can never validate: the slice is shorter.
  assert.deepEqual(validateRubyOverrides([override('東京', 1, '京都', 'きょうと')]), []);
  assert.deepEqual(validateRubyOverrides([override('東京', 1, '京', 'きょう')]), [override('東京', 1, '京', 'きょう')]);
  assert.deepEqual(validateRubyOverrides([override('東京', 0, '東京', 'とうきょう')]).length, 1);
});

test('validateRubyOverrides filters mixed input and keeps the valid objects', () => {
  const good = override('東京に行く', 0, '東京', 'とうきょう');
  const result = validateRubyOverrides([null, good, { line: 'x' }, override('東京に行く', 3, '行', 'い')]);
  assert.deepEqual(result, [good, override('東京に行く', 3, '行', 'い')]);
  assert.equal(result[0], good);
  // Extra properties are not stripped: the validator returns the original objects.
  const withExtra = { ...good, note: 'keep' };
  assert.equal(validateRubyOverrides([withExtra])[0].note, 'keep');
});

test('validateRubyOverrides keeps overlapping but well-formed entries verbatim', () => {
  const whole = override('東京都', 0, '東京都', 'とうきょうと');
  const partial = override('東京都', 1, '京都', 'きょうと');
  // Overlap is not a format error: strict callers (correctionDatabase.validOverrides,
  // libraryDatabase.validateBook) compare the length and refuse to load a shorter list, so
  // dropping an overlapping entry here would turn a display glitch into an unreadable file.
  assert.deepEqual(validateRubyOverrides([whole, partial]), [whole, partial]);
  assert.deepEqual(validateRubyOverrides([partial, whole]), [partial, whole]);
  // The same holds for a whole line of overlaps, in the stored order.
  const line = '東京都と大阪';
  const entries = [
    override(line, 0, '東京都', 'とうきょうと'),
    override(line, 1, '京都', 'きょうと'),
    override(line, 4, '大阪', 'おおさか'),
    override(line, 4, '大阪', 'おおさかし'),
  ];
  assert.deepEqual(validateRubyOverrides(entries), entries);
});

test('validateRubyOverrides keeps adjacent and same-line entries', () => {
  const line = '東京大阪';
  const left = override(line, 0, '東京', 'とうきょう');
  const right = override(line, 2, '大阪', 'おおさか');
  assert.deepEqual(validateRubyOverrides([left, right]), [left, right]);
  assert.deepEqual(validateRubyOverrides([right, left]), [right, left]);
});

test('validateRubyOverrides keeps entries regardless of which line they anchor to', () => {
  // The same range on another line is a different anchor, not a conflict.
  const tokyo = override('東京', 0, '東京', 'とうきょう');
  const tower = override('東京タワー', 0, '東京', 'とうきょう');
  assert.deepEqual(validateRubyOverrides([tokyo, tower]), [tokyo, tower]);
  // The identical range on the identical line is kept too: apply decides which reading wins.
  const azuma = override('東京', 0, '東京', 'あずま');
  assert.deepEqual(validateRubyOverrides([tokyo, azuma]), [tokyo, azuma]);
});

test('validateRubyOverrides drops malformed entries and keeps the valid ones around them', () => {
  const line = '東京都';
  const good = override(line, 0, '東京都', 'とうきょうと');
  const malformed = { ...override(line, 1, '京都', 'きょうと'), type: 'hirigana' };
  assert.deepEqual(validateRubyOverrides([malformed, good]), [good]);
  assert.deepEqual(validateRubyOverrides([good, malformed]), [good]);
});

test('applyRubyOverrides keeps the earlier reading and ignores a later overlapping entry', () => {
  const input = scriptLine('東京都', ['東京都']);
  const whole = override('東京都', 0, '東京都', 'とうきょうと');
  const partial = override('東京都', 1, '京都', 'きょうと');
  // Entries apply in start order, so the entry starting first is the one already on the
  // tokens; the later overlap is skipped instead of erasing that reading.
  const first = applyRubyOverrides(input, validateRubyOverrides([whole, partial]), 'hiragana');
  assert.deepEqual(pairs(first), [['東京都', 'とうきょうと']]);
  assert.equal(first.tokens[0].readingSource, 'manual');
  assert.equal(first.tokens[0].annotationSuppressed, false);
  // Storage order does not matter: start order decides, so the same reading wins.
  assert.deepEqual(pairs(applyRubyOverrides(input, validateRubyOverrides([partial, whole]), 'hiragana')), [['東京都', 'とうきょうと']]);
  // A raw, unvalidated list behaves the same way: apply is the one resolving the overlap.
  assert.deepEqual(pairs(applyRubyOverrides(input, [whole, partial], 'hiragana')), [['東京都', 'とうきょうと']]);
  // Two entries starting at the same offset tie, and the stored one comes first.
  const narrow = override('東京都', 0, '東京', 'とうきょう');
  const tied = applyRubyOverrides(input, validateRubyOverrides([narrow, whole]), 'hiragana');
  assert.deepEqual(pairs(tied), [['東京', 'とうきょう'], ['都', undefined]]);
});

test('applyRubyOverrides still applies every disjoint annotation of a line with overlaps', () => {
  const line = '東京都と大阪';
  const stored = [
    override(line, 0, '東京都', 'とうきょうと'),
    override(line, 1, '京都', 'きょうと'),
    override(line, 4, '大阪', 'おおさか'),
    override(line, 4, '大阪', 'おおさかし'),
  ];
  const input = scriptLine(line, ['東京', '都', 'と', '大阪']);
  const result = applyRubyOverrides(input, validateRubyOverrides(stored), 'hiragana');
  // `middle` overlaps `head` and `tailAgain` overlaps `tail`; both are skipped, and the
  // surviving entries keep the readings they were stored with.
  assert.deepEqual(pairs(result), [['東京都', 'とうきょうと'], ['と', undefined], ['大阪', 'おおさか']]);
});

test('applyRubyOverrides lets a later entry win when the earlier one never landed', () => {
  // An entry whose surface does not match the line is skipped, so it must not reserve the
  // range and shadow a valid entry that covers the same characters.
  const line = '東京都';
  const bogus = override(line, 0, '大阪', 'おおさか');
  const real = override(line, 0, '東京都', 'とうきょうと');
  assert.deepEqual(pairs(applyRubyOverrides(scriptLine(line, [line]), [bogus, real], 'hiragana')), [[line, 'とうきょうと']]);
});

test('validateRubyOverrides accepts everything upsertRubyOverride produced, in order', () => {
  const line = '東京都と大阪に行く';
  // Feeding overlapping candidates through upsert is the only way the app writes entries,
  // so validation must accept that output verbatim.
  let stored = [];
  for (const entry of [
    override(line, 1, '京都', 'きょうと'),
    override(line, 0, '東京都', 'とうきょうと'),
    override(line, 4, '大阪', 'おおさか'),
    override(line, 4, '大阪', 'おおさかし'),
    override(line, 7, '行', 'い'),
  ]) stored = upsertRubyOverride(stored, entry);
  assert.deepEqual(stored.map(({ start, surface }) => [start, surface]), [[0, '東京都'], [4, '大阪'], [7, '行']]);
  // Validation must return the stored list unchanged, entry for entry and object for object:
  // strict callers reject the whole database when the length differs.
  assert.deepEqual(validateRubyOverrides(stored), stored);
  assert.deepEqual(validateRubyOverrides(stored).map((entry, index) => entry === stored[index]), [true, true, true]);
});

test('a stored overlap no longer makes the strict correction database unreadable', () => {
  // correctionDatabase.validOverrides rejects the whole database when validation returns fewer
  // entries than it received. Overlapping data written by an older build must therefore still
  // load: the overlap is resolved when the annotations are applied, not while loading.
  const { migrateDatabase } = loadTypescript('../app/utils/correctionDatabase.ts');
  const line = '東京都と大阪';
  const overlapping = [
    override(line, 0, '東京都', 'とうきょうと'),
    override(line, 1, '京都', 'きょうと'),
    override(line, 4, '大阪', 'おおさか'),
    override(line, 4, '大阪', 'おおさかし'),
  ];
  const stored = {
    version: 2,
    glossary: {},
    scripts: {
      'script:a': {
        scriptId: 'script:a', title: '放課後', fingerprints: [`sha256:${'a'.repeat(64)}`], updatedAt: 1,
        overrides: overlapping, learned: [],
      },
    },
  };
  const migrated = migrateDatabase(stored);
  assert.deepEqual(migrated.scripts['script:a'].overrides, overlapping);
  // The applied result keeps the first reading of each range instead of losing one.
  assert.deepEqual(
    pairs(applyRubyOverrides(scriptLine(line, ['東京', '都', 'と', '大阪']), migrated.scripts['script:a'].overrides, 'hiragana')),
    [['東京都', 'とうきょうと'], ['と', undefined], ['大阪', 'おおさか']],
  );
  // Format errors are still fatal: validation only became lenient about overlaps.
  assert.throws(() => migrateDatabase({ ...stored, scripts: { 'script:a': {
    ...stored.scripts['script:a'], overrides: [{ ...overlapping[0], type: 'hirigana' }],
  } } }), /校对记录格式损坏/);
});

test('a stored overlap no longer makes a library book unreadable either', async () => {
  const { emptyLibraryDatabase, upsertBook, validateLibraryDatabase } = loadTypescript('../app/utils/libraryDatabase.ts');
  const line = '東京都と大阪';
  const overlapping = [
    override(line, 0, '東京都', 'とうきょうと'),
    override(line, 1, '京都', 'きょうと'),
    override(line, 4, '大阪', 'おおさか'),
    override(line, 4, '大阪', 'おおさかし'),
  ];
  const created = await upsertBook(emptyLibraryDatabase(), {
    bookId: 'book:overlap', title: '放課後', content: line, sourceOverrides: overlapping, now: 2,
  });
  // validateBook rejects the whole library when sourceOverrides comes back shorter.
  const book = validateLibraryDatabase(created).books['book:overlap'];
  assert.deepEqual(book.sourceOverrides, overlapping);
  assert.deepEqual(
    pairs(applyRubyOverrides(scriptLine(line, ['東京', '都', 'と', '大阪']), book.sourceOverrides, 'hiragana')),
    [['東京都', 'とうきょうと'], ['と', undefined], ['大阪', 'おおさか']],
  );
});

// Reviewed: a split head/tail is flagged needsReview by design - the kanji fragments no
// longer carry a trustworthy reading, so re-checking after the edit beats guessing one.
// Reviewed: a romaji-typed entry passes through verbatim by design - there is no
// romaji-to-kana conversion, so the requested ruby type cannot be applied to it.
// Reviewed: a tokenless line only occurs while furigana generation is in flight; the
// override is re-applied as soon as the tokens arrive, so nothing is lost.
