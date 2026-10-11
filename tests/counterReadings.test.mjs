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
  ]) assert.equal(counterReading(number, counter), expected);
});

test('unsupported larger or invalid numbers are left to the tokenizer', () => {
  for (const number of ['百一', '101', '0', '〇', '一二', '1.1', '零一']) assert.equal(counterReading(number, '発'), null);
  assert.equal(counterReading('一', '日'), null);
  const numeric = surface_form => ({ surface_form, pos_detail_1: '数' });
  const counter = { surface_form: '発', pos_detail_1: '接尾' };
  assert.equal(findCounterCompound([numeric('百'), numeric('一'), counter], 0), null);
  assert.equal(findCounterCompound([numeric('百'), numeric('一'), counter], 1), null);
  assert.equal(findCounterCompound([numeric('一'), { surface_form: '本', pos_detail_1: '一般' }], 0), null);
});
