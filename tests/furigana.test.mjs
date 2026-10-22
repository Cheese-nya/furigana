import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';
const { annotateLine, parseCompoundToTokens, kanaToRomaji } = loadTypescript('../app/utils/furigana.ts');
const { initKuromoji } = loadTypescript('../app/utils/kuromojiEngine.ts');
const { collectReviewGroups } = loadTypescript('../app/utils/review.ts');

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
  // Counter gaps of the real dictionary (phase 4, G6).
  ['四時と九時', 'よじとくじ'], ['十四時と二十四時', 'じゅうよじとにじゅうよじ'], ['四時半に', 'よじはんに'],
  ['七時と十時', 'しちじとじゅうじ'],
  // Remaining gaps listed after G6.
  ['十七時に八軒', 'じゅうしちじにはっけん'], ['十点と十歩', 'じゅってんとじゅっぽ'], ['十七日', 'じゅうしちにち'],
  ['四時間と二時間', 'よじかんとにじかん'], ['一日中ずっと', 'いちにちじゅうずっと'], ['一通り読む', 'ひととおりよむ'],
  ['3月と１２月', 'さんがつとじゅうにがつ'],
  ['一歳と八歳と十歳', 'いっさいとはっさいとじゅっさい'], ['二十歳になった', 'はたちになった'], ['二十一歳', 'にじゅういっさい'],
  ['二日と三日と四日', 'ふつかとみっかとよっか'], ['五日と六日と七日', 'いつかとむいかとなのか'],
  ['八日、九日、十日', 'ようか、ここのか、とおか'], ['十四日と二十日と二十四日', 'じゅうよっかとはつかとにじゅうよっか'],
  ['４日と2日', 'よっかとふつか'], ['三日間', 'みっかかん'], ['十一日と三十日', 'じゅういちにちとさんじゅうにち'],
  ['一週間', 'いっしゅうかん'], ['一軒と一歩', 'いっけんといっぽ'], ['一件と一点', 'いっけんといってん'],
  ['一着と一通と一頭', 'いっちゃくといっつうといっとう'], ['十一軒と二十一点', 'じゅういっけんとにじゅういってん'],
  ['三軒と三足', 'さんげんとさんぞく'], ['何軒ある？', 'なんげんある？'], ['何足', 'なんぞく'],
]) {
  test(`offline reading: ${text}`, () => {
    assert.equal(readingOf(text), reading);
    assert.equal(annotateLine(text).tokens.map(token => token.surface).join(''), text);
  });
}

test('一日 keeps the dictionary reading いちにち but stays in review with ついたち', () => {
  for (const text of ['一日', '4月1日', '一日は休み']) {
    const line = annotateLine(text);
    const day = line.tokens.find(token => /^[一1]日$/.test(token.surface));
    assert.ok(day, text);
    assert.deepEqual([day.ruby, day.needsReview, day.word.alternatives], ['いちにち', true, ['いちにち', 'ついたち']], text);
    const groups = collectReviewGroups([line]).filter(group => group.surface === day.surface);
    assert.deepEqual(groups.map(group => [group.currentRuby, group.alternatives]), [['いちにち', ['いちにち', 'ついたち']]], text);
  }
  // Certain counts never enter the review queue.
  for (const text of ['十一日', '二日', '四時', '一歳', '一週間', '三軒', '一日間']) {
    assert.deepEqual(collectReviewGroups([annotateLine(text)]).map(group => group.surface), [], text);
  }
});

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
