// liquid-glass/app/utils/furigana.ts
/**
 * Japanese Furigana & Dubbing Script Processing Engine
 * High-performance browser-side Kana tokenizer & Furigana generator
 */

import { getTokenizer, isKuromojiReady } from './kuromojiEngine';

export interface Token {
  surface: string;
  ruby?: string;
  hasKanji: boolean;
}

export interface ScriptLine {
  id: string;
  speaker?: string;
  rawText: string;
  cleanText: string;
  tokens: Token[];
  translation?: string;
}

// Kanji Unicode Range Test
export const KANJI_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF]/;

// High-Priority Japanese Grammar & Okurigana Patterns (Overrides naive dictionary lookups)
const GRAMMAR_PATTERNS: Record<string, string> = {
  '大好きな': 'だいすきな',
  '大好きだ': 'だいすきだ',
  '大好き': 'だいすき',
  '大嫌い': 'だいきらい',
  '大部分': 'だいぶぶん',
  '大丈夫': 'だいじょうぶ',
  '大変': 'たいへん',
  '大切': 'たいせつ',
  '大事': 'だいじ',
  '匂い': 'におい',
  '匂う': 'におう',
  '匂っ': 'におっ',
  'そんな風に': 'そんなふうに',
  'こんな風に': 'こんなふうに',
  'あんな風に': 'あんなふうに',
  'どんな風に': 'どんなふうに',
  'そんな風': 'そんなふう',
  'こんな風': 'こんなふう',
  'あんな風': 'あんなふう',
  'どんな風': 'どんなふう',
  '風に': 'ふうに',
  '和風': 'わふう',
  '洋風': 'ようふう',
  '台風': 'たいふう',
  '風潮': 'ふうちょう',
  '読み方': 'よみかた',
  '書き方': 'かきかた',
  '考え方': 'かんがえかた',
  '話し方': 'はなしかた',
  '使い方': 'つかいかた',
  '仕方': 'しかた',
  '思った': 'おもった',
  '思って': 'おもって',
  '思い': 'おもい',
  '思わ': 'おもわ',
  '思う': 'おもう',
  '思っ': 'おもっ',
  '言った': 'いった',
  '言って': 'いって',
  '言わ': 'いわ',
  '言う': 'いう',
  '言っ': 'いっ',
  '行った': 'いった',
  '行って': 'いって',
  '行っ': 'いっ',
  '行う': 'おこなう',
  '行い': 'おこない',
  '聞いて': 'きいて',
  '聞いた': 'きいた',
  '見つけた': 'みつけた',
  '見つけて': 'みつけて',
  '久しぶり': 'ひさしぶり',
};

// Comprehensive Common Japanese & Dubbing Script Kanji Dictionary
const KANJI_READINGS: Record<string, string> = {
  // Vocabulary & Compounds
  '日本語': 'にほんご', '日本': 'にほん', '世界': 'せかい', '学校': 'がっこう',
  '先生': 'せんせい', '学生': 'がくせい', '友達': 'ともだち', '声優': 'せいゆう',
  '台本': 'だいほん', '字幕': 'じまく', '吹替': 'ふきかえ', '役割': 'やくわり',
  '時間': 'じかん', '心': 'こころ', '愛': 'あい', '光': 'ひかり', '空': 'そら',
  '海': 'うみ', '風': 'かぜ', '雨': 'あめ', '花': 'はな', '夢': 'ゆめ',
  '声': 'こえ', '物語': 'ものがたり', '奇跡': 'きせき', '未来': 'みらい',
  '希望': 'きぼう', '絶望': 'ぜつぼう', '真実': 'しんじつ', '嘘': 'うそ',
  '約束': 'やくそく', '冒険': 'ぼうけん', '戦い': 'たたかい', '勝利': 'しょうり',
  '仲間': 'なかま', '絆': 'きずな', '感情': 'かんじょう', '記憶': 'きおく',
  '言葉': 'ことば', '運命': 'うんめい', '地球': 'ちきゅう', '宇宙': 'うちゅう',
  '星': 'ほし', '太陽': 'たいよう', '月': 'つき', '朝': 'あさ',
  '昼': 'ひる', '季節': 'きせつ', '春': 'はる', '夏': 'なつ', '秋': 'あき',
  '冬': 'ふゆ', '桜': 'さくら', '雪': 'ゆき', '神': 'かみ', '悪魔': 'あくま',
  '勇者': 'ゆうしゃ', '魔王': 'まおう', '魔法': 'まほう', '科学': 'かがく',
  '技術': 'ぎじゅつ', '力': 'ちから', '能力': 'のうりょく', '限界': 'げんかい',
  '今日': 'きょう', '明日': 'あした', '昨日': 'きのう', '今度': 'こんど',
  '配音': 'はいおん', '練習': 'れんしゅう', '仮名': 'かな', '假名': 'かな',
  '注音': 'ちゅうおん', '版本': 'はんほん', '配音台本': 'はいおんだいほん',
  '日文': 'にちぶん', '脚本': 'きゃくほん', '音响': 'おんきょう', '音響': 'おんきょう',

  // Pronouns & Names
  '私': 'わたし', '僕': 'ぼく', '俺': 'おれ', '君': 'きみ', '人': 'ひと',
  '山田': 'やまだ', '佐藤': 'さとう', '鈴木': 'すずき', '田中': 'たなか',
  '高橋': 'たかはし', '渡辺': 'わたなべ', '伊藤': 'いとう', '中村': 'なかむら',

  // Common Single Kanji
  '大': 'だい', '好': 'す', '匂': 'にお', '夜': 'よる', '狐': 'きつね',
  '久': 'ひさ', '今': 'いま', '何': 'なに', '誰': 'だれ', '行': 'い',
  '来': 'き', '食': 'た', '飲': 'の', '見': 'み', '聞': 'き',
  '話': 'はな', '書': 'か', '読': 'よ', '買': 'か', '売': 'う',
  '歩': 'ある', '走': 'はし', '泳': 'およ', '飛': 'と', '乗': 'の',
  '降': 'お', '起': 'お', '寝': 'ね', '始': 'はじ', '終': 'おわ',
  '勝': 'か', '負': 'ま', '助': 'たす', '守': 'まも', '壊': 'こわ',
  '作': 'つく', '使': 'つか', '休': 'やす', '働': 'はたら', '学': 'まな',
  '教': 'おし', '知': 'し', '考': 'かんが', '思': 'おも', '信': 'しん',
  '願': 'ねが', '祈': 'いの', '笑': 'わら', '泣': 'な', '怒': 'おこ',
  '恐': 'おそ', '驚': 'おどろ', '迷': 'まよ', '探': 'さが', '忘': 'わす',
  '覚': 'おぼ', '届': 'とど', '送': 'おく', '受': 'う', '渡': 'わた',
  '止': 'と', '动': 'うご', '動': 'うご', '变': 'か', '変': 'か',
  '開': 'あ', '閉': 'し', '小': 'ちい', '高': 'たか', '低': 'ひく',
  '新': 'あたら', '古': 'ふる', '長': 'なが', '短': 'みじか', '重': 'おも',
  '軽': 'かる', '強': 'つよ', '弱': 'よわ', '早': 'はや', '遅': 'おそ',
  '多': 'おお', '少': 'すく', '嫌': 'きら', '白': 'しろ', '黒': 'くろ',
  '赤': 'あか', '青': 'あお', '黄': 'き', '緑': 'みどり', '日': 'ひ',
  '火': 'ひ', '水': 'みず', '木': 'き', '金': 'かね', '土': 'つち',
  '男': 'おとこ', '女': 'おんな', '父': 'ちち', '母': 'はは', '兄': 'あに',
  '弟': 'おとうと', '姉': 'あね', '妹': 'いもうと', '家': 'いえ', '国': 'くに',
  '町': 'まち', '道': 'みち', '車': 'くるま', '船': 'ふね', '前': 'まえ',
  '後': 'うしろ', '上': 'うえ', '下': 'した', '中': 'なか', '外': 'そと',
  '右': 'みぎ', '左': 'ひだり', '東': 'ひがし', '西': 'にし', '南': 'みなみ',
  '北': 'きた'
};

// Simple Kana to Romaji converter
const ROMAJI_MAP: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'o', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'っ': 'tsu', 'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ー': '-'
};

export function kanaToRomaji(hiraText: string): string {
  let res = '';
  for (const char of hiraText) {
    res += ROMAJI_MAP[char] || char;
  }
  return res;
}

export function katakanaToHiragana(kataText: string): string {
  return kataText.replace(/[\u30A1-\u30F6]/g, match => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

/**
 * Break down a phrase like "大好きな" with reading "だいすきな" into exact tokens:
 * "大" (ruby: "だい"), "好" (ruby: "す"), "きな" (no ruby)
 */
export function parseCompoundToTokens(
  phrase: string,
  reading: string,
  rubyType: 'hiragana' | 'katakana' | 'romaji' = 'hiragana'
): Token[] {
  if (!KANJI_REGEX.test(phrase)) {
    return [{ surface: phrase, hasKanji: false }];
  }

  let prefixKanaLen = 0;
  while (prefixKanaLen < phrase.length && !KANJI_REGEX.test(phrase[prefixKanaLen])) {
    prefixKanaLen++;
  }

  let suffixKanaLen = 0;
  while (
    suffixKanaLen < phrase.length - prefixKanaLen &&
    !KANJI_REGEX.test(phrase[phrase.length - 1 - suffixKanaLen])
  ) {
    suffixKanaLen++;
  }

  const prefixKana = phrase.slice(0, prefixKanaLen);
  const kanjiPart = phrase.slice(prefixKanaLen, phrase.length - suffixKanaLen);
  const suffixKana = phrase.slice(phrase.length - suffixKanaLen);

  let kanjiReading = reading;
  if (prefixKana && reading.startsWith(prefixKana)) {
    kanjiReading = kanjiReading.slice(prefixKana.length);
  }
  if (suffixKana && kanjiReading.endsWith(suffixKana)) {
    kanjiReading = kanjiReading.slice(0, kanjiReading.length - suffixKana.length);
  }

  const tokens: Token[] = [];
  if (prefixKana) tokens.push({ surface: prefixKana, hasKanji: false });

  if (kanjiPart) {
    // If kanjiPart consists of multiple kanji (e.g. "大好"), try per-kanji splitting
    if (kanjiPart.length > 1) {
      let remainingReading = kanjiReading;
      let splitSuccess = true;
      let subTokens: Token[] = [];

      for (let k = 0; k < kanjiPart.length; k++) {
        const char = kanjiPart[k];
        const singleRead = KANJI_READINGS[char];
        if (singleRead && remainingReading.startsWith(singleRead)) {
          let finalRead = singleRead;
          if (rubyType === 'katakana') {
            finalRead = finalRead.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
          } else if (rubyType === 'romaji') {
            finalRead = kanaToRomaji(finalRead);
          }
          subTokens.push({ surface: char, ruby: finalRead, hasKanji: true });
          remainingReading = remainingReading.slice(singleRead.length);
        } else {
          splitSuccess = false;
          break;
        }
      }

      if (splitSuccess && remainingReading.length === 0) {
        tokens.push(...subTokens);
      } else {
        let finalRead = kanjiReading;
        if (rubyType === 'katakana') {
          finalRead = finalRead.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
        } else if (rubyType === 'romaji') {
          finalRead = kanaToRomaji(finalRead);
        }
        tokens.push({ surface: kanjiPart, ruby: finalRead, hasKanji: true });
      }
    } else {
      let finalRead = kanjiReading;
      if (rubyType === 'katakana') {
        finalRead = finalRead.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
      } else if (rubyType === 'romaji') {
        finalRead = kanaToRomaji(finalRead);
      }
      tokens.push({ surface: kanjiPart, ruby: finalRead, hasKanji: true });
    }
  }

  if (suffixKana) tokens.push({ surface: suffixKana, hasKanji: false });

  return tokens;
}

/**
 * Tokenizes Japanese text line into tokens with Kanji readings, keeping original text intact
 */
export function annotateLine(
  rawLine: string,
  rubyType: 'hiragana' | 'katakana' | 'romaji' = 'hiragana'
): ScriptLine {
  const content = rawLine;
  const tokens: Token[] = [];

  // 1. If Kuromoji is ready, use it for base tokenization
  if (isKuromojiReady()) {
    const tokenizer = getTokenizer();
    const kuromojiTokens = tokenizer.tokenize(content);
    
    // Convert Kuromoji tokens to our Token format
    for (const kt of kuromojiTokens) {
      if (!KANJI_REGEX.test(kt.surface_form)) {
        tokens.push({ surface: kt.surface_form, hasKanji: false });
        continue;
      }
      
      // If it has kanji, try our GRAMMAR_PATTERNS or KANJI_READINGS first for dubbing overrides
      const overrideRead = GRAMMAR_PATTERNS[kt.surface_form] || KANJI_READINGS[kt.surface_form];
      let reading = overrideRead || (kt.reading ? katakanaToHiragana(kt.reading) : '');
      
      if (reading) {
        // Run it through our compound parser for perfect visual splitting (e.g. 送り仮名)
        const subTokens = parseCompoundToTokens(kt.surface_form, reading, rubyType);
        tokens.push(...subTokens);
      } else {
        tokens.push({ surface: kt.surface_form, hasKanji: true });
      }
    }
  } else {
    // 2. Fallback to our existing greedy regex dictionary parser if Kuromoji isn't loaded
    let currentWord = '';
    for (let i = 0; i < content.length; i++) {
      let matched = false;

      for (let len = 6; len >= 2; len--) {
        if (i + len <= content.length) {
          const sub = content.slice(i, i + len);
          if (GRAMMAR_PATTERNS[sub]) {
            if (currentWord) {
              tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
              currentWord = '';
            }
            const subTokens = parseCompoundToTokens(sub, GRAMMAR_PATTERNS[sub], rubyType);
            tokens.push(...subTokens);
            i += len - 1;
            matched = true;
            break;
          }
        }
      }

      if (matched) continue;

      for (let len = 4; len >= 1; len--) {
        if (i + len <= content.length) {
          const sub = content.slice(i, i + len);
          if (KANJI_READINGS[sub]) {
            if (currentWord) {
              tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
              currentWord = '';
            }
            let reading = KANJI_READINGS[sub];
            if (rubyType === 'katakana') {
              reading = reading.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
            } else if (rubyType === 'romaji') {
              reading = kanaToRomaji(reading);
            }
            tokens.push({ surface: sub, ruby: reading, hasKanji: true });
            i += len - 1;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        const char = content[i];
        if (KANJI_REGEX.test(char)) {
          if (currentWord) {
            tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
            currentWord = '';
          }
          const singleReading = KANJI_READINGS[char];
          if (singleReading) {
            let reading = singleReading;
            if (rubyType === 'katakana') {
              reading = reading.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
            } else if (rubyType === 'romaji') {
              reading = kanaToRomaji(reading);
            }
            tokens.push({ surface: char, ruby: reading, hasKanji: true });
          } else {
            tokens.push({ surface: char, hasKanji: true });
          }
        } else {
          currentWord += char;
        }
      }
    }

    if (currentWord) {
      tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
    }
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    rawText: rawLine,
    cleanText: content,
    tokens,
  };
}

/**
 * Generate SRT format string from script lines
 */
export function generateSRT(lines: ScriptLine[]): string {
  return lines
    .map((line, index) => {
      const startTime = formatSRTTime(index * 4);
      const endTime = formatSRTTime(index * 4 + 3);
      return `${index + 1}\n${startTime} --> ${endTime}\n${line.cleanText}\n`;
    })
    .join('\n');
}

function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs},000`;
}
