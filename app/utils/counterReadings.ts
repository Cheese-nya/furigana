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
  '階': ['じゅっかい', 'いっかい', 'にかい', 'さんがい', 'よんかい', 'ごかい', 'ろっかい', 'ななかい', 'はっかい', 'きゅうかい'],
  '分': ['じゅっぷん', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん'],
};
const DIGITS = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const KANJI_DIGITS = '〇一二三四五六七八九';
const NUMBER_CHAR = /^[0-9０-９〇零一二三四五六七八九十百千万億兆]+$/u;

function parseNumber(surface: string): number | null {
  const normalized = surface.normalize('NFKC');
  if (/^[1-9][0-9]{0,3}$/.test(normalized)) return Number(normalized);
  // Canonical unit notation, up to 9999; leave digit strings and larger values
  // to the dictionary instead of partially repairing the end of a number.
  const match = normalized.match(/^(?:([一二三四五六七八九]?)千)?(?:([一二三四五六七八九]?)百)?(?:([一二三四五六七八九]?)十)?([一二三四五六七八九])?$/u);
  if (!match || !normalized) return null;
  return [1000, 100, 10, 1].reduce((value, unit, index) => {
    const digit = match[index + 1];
    if (digit === undefined) return value;
    return value + (digit === '' ? 1 : KANJI_DIGITS.indexOf(digit)) * unit;
  }, 0) || null;
}

export function counterReading(number: string, counter: string): string | null {
  const endings = COUNTERS[counter];
  const value = parseNumber(number);
  if (!endings || value === null) return null;
  const thousands = Math.floor(value / 1000);
  const hundreds = Math.floor(value % 1000 / 100);
  const remainder = value % 100;
  const thousandReading = thousands === 0 ? '' : thousands === 1 ? 'せん' :
    thousands === 3 ? 'さんぜん' : thousands === 8 ? 'はっせん' : DIGITS[thousands] + 'せん';
  const hundredReading = hundreds === 0 ? '' : hundreds === 1 ? 'ひゃく' :
    hundreds === 3 ? 'さんびゃく' : hundreds === 6 ? 'ろっぴゃく' :
    hundreds === 8 ? 'はっぴゃく' : DIGITS[hundreds] + 'ひゃく';
  const prefix = thousandReading + hundredReading;
  if (remainder > 0) {
    if (remainder < 10) return prefix + endings[remainder];
    const tens = Math.floor(remainder / 10);
    const units = remainder % 10;
    const tensPrefix = tens === 1 ? '' : DIGITS[tens];
    return prefix + tensPrefix + (units === 0 ? endings[0] : 'じゅう' + endings[units]);
  }
  if (hundreds > 0) {
    if (counter === '冊') return prefix + 'さつ';
    return prefix.slice(0, -1) + 'っ' + endings[1].slice(2);
  }
  const thousandEndings: Record<string, string> = {
    '発': 'ぱつ', '本': 'ぼん', '杯': 'ばい', '匹': 'びき', '回': 'かい',
    '個': 'こ', '冊': 'さつ', '階': 'がい', '分': 'ぷん',
  };
  return prefix + thousandEndings[counter];
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
