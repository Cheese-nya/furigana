import type { KuromojiToken } from './kuromojiEngine';

// Small offline pronunciation lexicon for numbers + counters. Morphological
// dictionaries often return イチ + ハツ rather than the spoken イッパツ.
const COUNTERS: Record<string, string[]> = {
  '発': ['じゅっぱつ', 'いっぱつ', 'にはつ', 'さんぱつ', 'よんはつ', 'ごはつ', 'ろっぱつ', 'ななはつ', 'はっぱつ', 'きゅうはつ'],
  '本': ['じゅっぽん', 'いっぽん', 'にほん', 'さんぼん', 'よんほん', 'ごほん', 'ろっぽん', 'ななほん', 'はっぽん', 'きゅうほん'],
  '杯': ['じゅっぱい', 'いっぱい', 'にはい', 'さんばい', 'よんはい', 'ごはい', 'ろっぱい', 'ななはい', 'はっぱい', 'きゅうはい'],
  '匹': ['じゅっぴき', 'いっぴき', 'にひき', 'さんびき', 'よんひき', 'ごひき', 'ろっぴき', 'ななひき', 'はっぴき', 'きゅうひき'],
  '回': ['じゅっかい', 'いっかい', 'にかい', 'さんかい', 'よんかい', 'ごかい', 'ろっかい', 'ななかい', 'はっかい', 'きゅうかい'],
  '個': ['じゅっこ', 'いっこ', 'にこ', 'さんこ', 'よんこ', 'ごこ', 'ろっこ', 'ななこ', 'はっこ', 'きゅうこ'],
  '冊': ['じゅっさつ', 'いっさつ', 'にさつ', 'さんさつ', 'よんさつ', 'ごさつ', 'ろくさつ', 'ななさつ', 'はっさつ', 'きゅうさつ'],
};
const DIGITS = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const KANJI_DIGITS = '〇一二三四五六七八九';
const NUMBER_CHAR = /^[0-9０-９〇零一二三四五六七八九十百千万億兆]+$/u;

function parseNumber(surface: string): number | null {
  const normalized = surface.normalize('NFKC');
  if (/^[1-9][0-9]?$/.test(normalized)) return Number(normalized);
  const match = normalized.match(/^([一二三四五六七八九])?十([一二三四五六七八九])?$/u);
  if (match) return (match[1] ? KANJI_DIGITS.indexOf(match[1]) : 1) * 10 + (match[2] ? KANJI_DIGITS.indexOf(match[2]) : 0);
  if (/^[一二三四五六七八九]$/u.test(normalized)) return KANJI_DIGITS.indexOf(normalized);
  return null;
}

export function counterReading(number: string, counter: string): string | null {
  const endings = COUNTERS[counter];
  const value = parseNumber(number);
  if (!endings || value === null) return null;
  if (value < 10) return endings[value];
  const tens = Math.floor(value / 10);
  const units = value % 10;
  const prefix = tens === 1 ? '' : DIGITS[tens];
  return units === 0 ? prefix + endings[0] : prefix + 'じゅう' + endings[units];
}

export function findCounterCompound(tokens: KuromojiToken[], index: number): { length: number; surface: string; reading: string } | null {
  // Never repair just the tail of a larger number or an identifier.
  if (NUMBER_CHAR.test(tokens[index - 1]?.surface_form || '')) return null;
  let number = '';
  let end = index;
  while (end < tokens.length && NUMBER_CHAR.test(tokens[end].surface_form)) {
    if (tokens[end].pos_detail_1 !== '数') return null;
    number += tokens[end].surface_form;
    end++;
  }
  if (end === index || !tokens[end]) return null;
  const counter = tokens[end].surface_form;
  // Check POS as well as surface: 本 can be a book noun outside a count.
  if (tokens[end].pos_detail_1 !== '接尾') return null;
  const reading = counterReading(number, counter);
  return reading ? { length: end - index + 1, surface: number + counter, reading } : null;
}
