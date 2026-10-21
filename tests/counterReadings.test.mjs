import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';
const { counterReading, findCounterCompound } = loadTypescript('../app/utils/counterReadings.ts');

test('counter lexicon handles phonetic changes and complete tens', () => {
  for (const [number, counter, expected] of [
    ['一', '発', 'いっぱつ'], ['三', '発', 'さんぱつ'], ['六', '発', 'ろっぱつ'],
    ['十一', '発', 'じゅういっぱつ'], ['二十一', '発', 'にじゅういっぱつ'],
    ['二十', '発', 'にじゅっぱつ'], ['99', '発', 'きゅうじゅうきゅうはつ'],
    ['一', '本', 'いっぽん'], ['三', '本', 'さんぼん'], ['六', '本', 'ろっぽん'],
    ['一', '杯', 'いっぱい'], ['三', '杯', 'さんばい'], ['八', '匹', 'はっぴき'],
    ['１', '発', 'いっぱつ'], ['２１', '発', 'にじゅういっぱつ'],
    ['一', '階', 'いっかい'], ['三', '階', 'さんがい'], ['三', '分', 'さんぷん'],
    ['四', '分', 'よんぷん'], ['十', '分', 'じゅっぷん'],
    ['百', '本', 'ひゃっぽん'], ['三百', '本', 'さんびゃっぽん'], ['六百', '本', 'ろっぴゃっぽん'],
    ['八百', '杯', 'はっぴゃっぱい'], ['300', '本', 'さんびゃっぽん'],
    ['百一', '発', 'ひゃくいっぱつ'], ['101', '発', 'ひゃくいっぱつ'],
    ['三百二十', '本', 'さんびゃくにじゅっぽん'], ['千', '本', 'せんぼん'],
    ['三千', '匹', 'さんぜんびき'], ['八千', '階', 'はっせんがい'],
    ['千百', '冊', 'せんひゃくさつ'], ['9999', '本', 'きゅうせんきゅうひゃくきゅうじゅうきゅうほん'],
  ]) assert.equal(counterReading(number, counter), expected);
});

test('unsupported larger or invalid numbers are left to the tokenizer', () => {
  for (const number of ['一万一', '10001', '0', '〇', '一二', '1.1', '零一', '', '百百', '十百', '001']) assert.equal(counterReading(number, '発'), null);
  assert.equal(counterReading('一', '日'), null);
  const numeric = surface_form => ({ surface_form, pos_detail_1: '数' });
  const counter = { surface_form: '発', pos_detail_1: '接尾' };
  assert.equal(findCounterCompound([numeric('一万'), numeric('一'), counter], 0), null);
  assert.equal(findCounterCompound([numeric('一万'), numeric('一'), counter], 1), null);
  assert.equal(findCounterCompound([numeric('一'), { surface_form: '本', pos_detail_1: '一般' }], 0), null);
});

test('partial counter rows fix only the readings the dictionary gets wrong', () => {
  for (const [number, counter, expected] of [
    ['四', '時', 'よじ'], ['九', '時', 'くじ'], ['十四', '時', 'じゅうよじ'], ['二十四', '時', 'にじゅうよじ'], ['19', '時', 'じゅうくじ'],
    ['四', '時半', 'よじはん'], ['九', '時半', 'くじはん'],
    ['一', '歳', 'いっさい'], ['八', '歳', 'はっさい'], ['十', '歳', 'じゅっさい'], ['二十', '歳', 'はたち'], ['20', '歳', 'はたち'],
    ['二十一', '歳', 'にじゅういっさい'], ['十八', '歳', 'じゅうはっさい'], ['三十', '歳', 'さんじゅっさい'],
    ['二', '日', 'ふつか'], ['三', '日', 'みっか'], ['四', '日', 'よっか'], ['五', '日', 'いつか'], ['六', '日', 'むいか'],
    ['七', '日', 'なのか'], ['八', '日', 'ようか'], ['九', '日', 'ここのか'], ['十', '日', 'とおか'],
    ['十四', '日', 'じゅうよっか'], ['二十', '日', 'はつか'], ['二十四', '日', 'にじゅうよっか'], ['４', '日', 'よっか'],
    ['三', '日間', 'みっかかん'], ['十', '日間', 'とおかかん'],
    ['一', '週間', 'いっしゅうかん'], ['一', '軒', 'いっけん'], ['一', '歩', 'いっぽ'], ['一', '件', 'いっけん'],
    ['一', '点', 'いってん'], ['一', '着', 'いっちゃく'], ['一', '通', 'いっつう'], ['一', '頭', 'いっとう'],
    ['十一', '軒', 'じゅういっけん'], ['二十一', '点', 'にじゅういってん'], ['百一', '歩', 'ひゃくいっぽ'],
    ['三', '軒', 'さんげん'], ['三', '足', 'さんぞく'],
  ]) assert.equal(counterReading(number, counter), expected, number + counter);
  // Digits outside a partial row, the other days of the month, and round hundreds stay with the dictionary.
  for (const [number, counter] of [
    ['七', '時'], ['十', '時'], ['三', '歳'], ['百', '歳'], ['十一', '日'], ['三十', '日'], ['百十四', '日'],
    ['一', '日間'], ['六', '軒'], ['十', '点'], ['一', '足'], ['百', '軒'], ['千', '歩'],
  ]) assert.equal(counterReading(number, counter), null, number + counter);
});

test('counts with two common readings keep the dictionary reading and offer the other', () => {
  const numeric = surface_form => ({ surface_form, pos_detail_1: '数' });
  const suffix = surface_form => ({ surface_form, pos_detail_1: '接尾' });
  for (const number of ['一', '1', '１']) {
    assert.deepEqual(findCounterCompound([numeric(number), suffix('日')], 0),
      { length: 2, surface: `${number}日`, reading: 'いちにち', alternatives: ['いちにち', 'ついたち'] });
  }
  // 十一日 and 一日間 are not ambiguous.
  assert.equal(findCounterCompound([numeric('十'), numeric('一'), suffix('日')], 0), null);
  assert.equal(findCounterCompound([numeric('十'), numeric('一'), suffix('日')], 1), null);
  assert.equal(findCounterCompound([numeric('一'), suffix('日間')], 0), null);
  assert.deepEqual(findCounterCompound([numeric('二'), suffix('日')], 0), { length: 2, surface: '二日', reading: 'ふつか' });
});

test('何 follows the 三 form only where that form is known', () => {
  const nan = { surface_form: '何', pos_detail_1: '数' };
  const suffix = surface_form => ({ surface_form, pos_detail_1: '接尾' });
  assert.deepEqual(findCounterCompound([nan, suffix('軒')], 0), { length: 2, surface: '何軒', reading: 'なんげん' });
  assert.deepEqual(findCounterCompound([nan, suffix('足')], 0), { length: 2, surface: '何足', reading: 'なんぞく' });
  for (const counter of ['時', '歳', '日', '週間', '点']) assert.equal(findCounterCompound([nan, suffix(counter)], 0), null, counter);
});
