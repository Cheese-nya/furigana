import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { loadTypescript } from './loadTypescript.mjs';
const { parseDocxXml } = loadTypescript('../app/utils/docxImporter.ts');
const { applyRubyOverrides, upsertRubyOverride, validateRubyOverrides } = loadTypescript('../app/utils/rubyOverrides.ts');
globalThis.DOMParser = DOMParser;
const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const ruby = '<w:ruby><w:rt><w:r><w:t>フタリ</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>二人</w:t></w:r></w:rubyBase></w:ruby>';

for (const wrapped of [ruby, `<w:r>${ruby}</w:r>`]) {
  test(`import preserves Japanese body and ruby (${wrapped.startsWith('<w:r>') ? 'standard' : 'legacy'})`, () => {
    const result = parseDocxXml(`<w:document xmlns:w="${ns}"><w:body><w:p><w:r><w:t>前</w:t><w:br/></w:r>${wrapped}<w:r><w:t>で</w:t><w:tab/><w:t>行く</w:t></w:r></w:p><w:p/><w:tbl><w:tr><w:tc><w:p><w:r><w:t>後</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`);
    assert.equal(result.text, '前\n二人で\t行く\n\n後');
    assert.deepEqual(result.overrides, [{ start: 0, surface: '二人', reading: 'ふたり', line: '二人で\t行く', type: 'hiragana' }]);
  });
}

test('manual corrections override source ruby and survive annotation mode changes', () => {
  const line = { id: '1', rawText: '二人で', cleanText: '二人で', tokens: [{ surface: '二', ruby: 'に', hasKanji: true }, { surface: '人', ruby: 'にん', hasKanji: true }, { surface: 'で', hasKanji: false }] };
  const entry = { line: line.cleanText, start: 0, surface: '二人', reading: 'ふたり', type: 'hiragana' };
  const entries = upsertRubyOverride([{ ...entry, surface: '二', reading: 'に' }], entry);
  assert.equal(entries.length, 1);
  const result = applyRubyOverrides(line, entries, 'katakana');
  assert.equal(result.tokens[0].surface, '二人');
  assert.equal(result.tokens[0].ruby, 'フタリ');
  assert.equal(result.tokens.map(token => token.surface).join(''), line.cleanText);
  const cleared = applyRubyOverrides(result, [{ ...entry, reading: '' }], 'hiragana');
  assert.equal(cleared.tokens[0].ruby, undefined);
  assert.equal(applyRubyOverrides({ ...line, cleanText: '二人と' }, entries, 'hiragana').tokens[0].ruby, 'に');
  assert.deepEqual(validateRubyOverrides([{ ...entry, start: -1 }, null, entry]), [entry]);
});
