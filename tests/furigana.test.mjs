import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';
const { annotateLine, parseCompoundToTokens, kanaToRomaji } = loadTypescript('../app/utils/furigana.ts');
const { initKuromoji } = loadTypescript('../app/utils/kuromojiEngine.ts');

// Kuromoji's Node loader takes a filesystem path, while the app uses /dict.
before(async () => {
  globalThis.window = { location: { protocol: 'file:' } };
  const kuromoji = loadTypescript('../app/utils/kuromojiEngine.ts');
  const kuromojiPackage = await import('kuromoji');
  const original = kuromojiPackage.default.builder;
  kuromojiPackage.default.builder = options => original({ ...options, dicPath: new URL('../public/dict/', import.meta.url).pathname });
  await initKuromoji();
  delete globalThis.window;
  assert.ok(kuromoji.isKuromojiReady());
});

const readingOf = text => annotateLine(text).tokens.map(token => token.ruby || token.surface).join('');

for (const [text, reading] of [
  ['二人で行っておいで', 'ふたりでいっておいで'],
  ['一人で過ごす一日は', 'ひとりですごすいちにちは'],
  ['2人きり', 'ふたりきり'],
  ['１人と２人', 'ひとりとふたり'],
  ['四人で', 'よにんで'],
  ['十二人で', 'じゅうににんで'],
  ['十一人で', 'じゅういちにんで'],
  ['一人称', 'いちにんしょう'],
  ['会議を行った', 'かいぎをおこなった'],
  ['試験を行っている', 'しけんをおこなっている'],
  ['学校に行った', 'がっこうにいった'],
  ['辛いことをしないで', 'つらいことをしないで'],
  ['カレーが辛い', 'カレーがからい'],
  ['一発だけ', 'いっぱつだけ'],
  ['一発目', 'いっぱつめ'],
  ['三発と六発と八発', 'さんぱつとろっぱつとはっぱつ'],
  ['十一発と二十発と二十一発', 'じゅういっぱつとにじゅっぱつとにじゅういっぱつ'],
  ['１発と21発', 'いっぱつとにじゅういっぱつ'],
  ['一本と三本と六本', 'いっぽんとさんぼんとろっぽん'],
  ['一杯と三杯', 'いっぱいとさんばい'],
  ['一匹と三匹', 'いっぴきとさんびき'],
  ['一回と一個と一冊', 'いっかいといっこといっさつ'],
  ['その風は冷たい。', 'そのかぜはつめたい。'],
  ['風に吹かれる。', 'かぜにふかれる。'],
  ['こんな風に話す。', 'こんなふうにはなす。'],
  ['辛いラーメンを食べたが、失恋は辛い。', 'からいラーメンをたべたが、しつれんはつらい。'],
  ['辛いラーメンを食べたが失恋は辛い。', 'からいラーメンをたべたがしつれんはつらい。'],
  ['失恋は辛いが、カレーは辛い。', 'しつれんはつらいが、カレーはからい。'],
  ['三分待つ', 'さんぷんまつ'], ['一階に行く', 'いっかいにいく'],
  ['三階と四分', 'さんがいとよんぷん'],
  ['百本と三百本と六百本', 'ひゃっぽんとさんびゃっぽんとろっぴゃっぽん'],
  ['３００本と千本', 'さんびゃっぽんとせんぼん'],
]) {
  test(`offline reading: ${text}`, () => {
    assert.equal(readingOf(text), reading);
    assert.equal(annotateLine(text).tokens.map(token => token.surface).join(''), text);
  });
}

test('romaji handles digraphs, gemination, syllabic n and long vowels', () => {
  for (const [kana, expected] of [
    ['きょう', 'kyou'], ['がっこう', 'gakkou'], ['しゃしん', 'shashin'],
    ['しんよう', "shin'you"], ['ほんや', "hon'ya"], ['かんい', "kan'i"],
    ['まっちゃ', 'matcha'], ['いっしょ', 'issho'], ['しんぶん', 'shinbun'],
    ['スーパー', 'suupaa'], ['パーティー', 'paatii'], ['ヴァイオリン', 'vaiorin'],
    ['あっ！', 'axtsu！'], ['ABC 123', 'ABC 123'],
  ]) assert.equal(kanaToRomaji(kana), expected, kana);
  assert.equal(annotateLine('学校と写真', 'romaji').tokens.map(t => t.ruby || t.surface).join(''), 'gakkouとshashin');
});

test('okurigana alignment preserves kana and whole kanji groups', () => {
  assert.deepEqual(parseCompoundToTokens('取り戻し', 'とりもどし').map(({ surface, ruby }) => [surface, ruby]), [
    ['取', 'と'], ['り', undefined], ['戻', 'もど'], ['し', undefined],
  ]);
  assert.deepEqual(parseCompoundToTokens('二人', 'ふたり').map(({ surface, ruby }) => [surface, ruby]), [['二人', 'ふたり']]);
  assert.equal(parseCompoundToTokens('声優', 'せいゆう').length, 1);
});

test('candidate readings are formatted and stripped to the annotated kanji', () => {
  const token = parseCompoundToTokens('辛い', 'つらい', 'katakana', ['つらい', 'からい'])[0];
  assert.deepEqual(token.alternatives, ['ツラ', 'カラ']);
  assert.equal(token.ruby, 'ツラ');
});
