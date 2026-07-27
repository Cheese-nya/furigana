// liquid-glass/app/utils/furigana.ts
/**
 * Japanese Furigana & Dubbing Script Processing Engine
 * High-performance browser-side Kana tokenizer & Furigana generator
 */

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

// Common Japanese Dubbing Kanji Dictionary (for offline high-speed client tokenizer)
const KANJI_READINGS: Record<string, string> = {
  '私': 'わたし', '僕': 'ぼく', '俺': 'おれ', '君': 'きみ', '人': 'ひと',
  '今日': 'きょう', '明日': 'あした', '昨日': 'きのう', '今': 'いま',
  '日本': 'にほん', '日本語': 'にほんご', '世界': 'せかい', '学校': 'がっこう',
  '先生': 'せんせい', '学生': 'がくせい', '友達': 'ともだち', '声優': 'せいゆう',
  '台本': 'だいほん', '字幕': 'じまく', '吹替': 'ふきかえ', '役割': 'やくわり',
  '時間': 'じかん', '心': 'こころ', '愛': 'あい', '光': 'ひかり', '空': 'そら',
  '海': 'うみ', '風': 'かぜ', '雨': 'あめ', '花': 'はな', '夢': 'ゆめ',
  '声': 'こえ', '物語': 'ものがたり', '奇跡': 'きせき', '未来': 'みらい',
  '希望': 'きぼう', '絶望': 'ぜつぼう', '真実': 'しんじつ', '嘘': 'うそ',
  '約束': 'やくそく', '冒険': 'ぼうけん', '戦い': 'たたかい', '勝利': 'しょうり',
  '仲間': 'なかま', '絆': 'きずな', '感情': 'かんじょう', '記憶': 'きおく',
  '言葉': 'ことば', '運命': 'うんめい', '地球': 'ちきゅう', '宇宙': 'うちゅう',
  '星': 'ほし', '太陽': 'たいよう', '月': 'つき', '夜': 'よる', '朝': 'あさ',
  '昼': 'ひる', '季節': 'きせつ', '春': 'はる', '夏': 'なつ', '秋': 'あき',
  '冬': 'ふゆ', '桜': 'さくら', '雪': 'ゆき', '神': 'かみ', '悪魔': 'あくま',
  '勇者': 'ゆうしゃ', '魔王': 'まおう', '魔法': 'まほう', '科学': 'かがく',
  '技術': 'ぎじゅつ', '力': 'ちから', '能力': 'のうりょく', '限界': 'げんかい'
};

// Convert Katakana to Hiragana

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

/**
 * Tokenizes Japanese text line into tokens with Kanji readings, keeping original text intact
 */
export function annotateLine(
  rawLine: string,
  rubyType: 'hiragana' | 'katakana' | 'romaji' = 'hiragana'
): ScriptLine {
  const content = rawLine;
  const tokens: Token[] = [];
  let currentWord = '';

  // Greedy match Kanji words or fallback character-by-character
  for (let i = 0; i < content.length; i++) {
    let matched = false;
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
        let fallbackRuby = 'かな';
        if (rubyType === 'katakana') fallbackRuby = 'カナ';
        else if (rubyType === 'romaji') fallbackRuby = 'kana';
        tokens.push({ surface: char, ruby: fallbackRuby, hasKanji: true });
      } else {
        currentWord += char;
      }
    }
  }

  if (currentWord) {
    tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
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
