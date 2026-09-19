// liquid-glass/app/utils/furigana.ts
/**
 * Japanese Furigana & Dubbing Script Processing Engine
 * High-performance browser-side Kana tokenizer & Furigana generator
 * Includes Context-Aware Disambiguation (前後文上下文多音字消歧) & Mora-Aligned Rubies
 */

import { getTokenizer, isKuromojiReady } from './kuromojiEngine';

export interface Token {
  surface: string;
  ruby?: string;
  hasKanji: boolean;
  alternatives?: string[]; // Optional alternative readings for interactive correction
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

// High-Priority Japanese Idioms & Pre-Segmented Patterns
export const GRAMMAR_PATTERNS: Record<string, string> = {
  '一日中': 'いちにちじゅう',
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
  '読み方': 'よみかた',
  '書き方': 'かきかた',
  '考え方': 'かんがえかた',
  '話し方': 'はなしかた',
  '使い方': 'つかいかた',
  '教え方': 'おしえかた',
  '仕方': 'しかた',
  '思った': 'おもった',
  '思って': 'おもって',
  '思い': 'おもい',
  '思わ': 'おもわ',
  '思う': 'おもう',
  '言った': 'いった',
  '言って': 'いって',
  '言わ': 'いわ',
  '言う': 'いう',
  '行った': 'いった',
  '行って': 'いって',
  '行う': 'おこなう',
  '行い': 'おこない',
  '行われる': 'おこなわれる',
  '行なう': 'おこなう',
  '聞いて': 'きいて',
  '聞いた': 'きいた',
  '見つけた': 'みつけた',
  '見つけて': 'みつけて',
  '久しぶり': 'ひさしぶり',
};

// Kanji reading variants for accurate multi-kanji compound mora splitting
export const KANJI_READING_VARIANTS: Record<string, string[]> = {
  '日': ['にち', 'じつ', 'ひ', 'び', 'か'],
  '本': ['ほん', 'ぼん', 'ぽん', 'もと'],
  '語': ['ご', 'かた'],
  '人': ['じん', 'にん', 'ひと', 'びと', 'り'],
  '山': ['さん', 'ざん', 'やま'],
  '田': ['でん', 'た', 'だ'],
  '先': ['せん', 'さき'],
  '生': ['せい', 'しょう', 'なま', 'い', 'う'],
  '学': ['がく', 'がっ', 'まな'],
  '校': ['こう'],
  '声': ['せい', 'しょう', 'こえ', 'ごえ'],
  '優': ['ゆう', 'やさ'],
  '未': ['み', 'いま'],
  '来': ['らい', 'き', 'く', 'こ'],
  '希': ['き', 'け'],
  '望': ['ぼう', 'もう', 'のぞ'],
  '練': ['れん', 'ね'],
  '習': ['しゅう', 'なら'],
  '台': ['だい', 'たい'],
  '配': ['はい', 'ぱい', 'くば'],
  '音': ['おん', 'いん', 'おと', 'ね'],
  '響': ['きょう', 'ひび'],
  '銀': ['ぎん', 'しろがね'],
  '行': ['こう', 'ぎょう', 'あん', 'い', 'ゆ', 'おこな'],
  '道': ['どう', 'とう', 'みち'],
  '食': ['しょく', 'じき', 'た', 'く'],
  '物': ['ぶつ', 'もつ', 'もの'],
  '花': ['か', 'はな', 'ばな'],
  '咲': ['さ'],
  '読': ['どく', 'とう', 'よ'],
  '書': ['しょ', 'か'],
  '話': ['わ', 'はなし', 'はな'],
  '見': ['けん', 'み'],
  '聞': ['ぶん', 'もん', 'き'],
  '牛': ['ぎゅう', 'うし'],
  '曲': ['きょく', 'ま'],
  '字': ['じ', 'あざ'],
  '幕': ['まく', 'ばく'],
  '吹': ['すい', 'ふ'],
  '替': ['たい', 'か'],
  '役': ['やく', 'えき'],
  '割': ['かつ', 'わ', 'わり'],
  '時': ['じ', 'とき', 'どき'],
  '間': ['かん', 'けん', 'あいだ', 'ま'],
  '心': ['しん', 'こころ'],
  '愛': ['あい', 'いと'],
  '光': ['こう', 'ひかり'],
  '空': ['くう', 'そら', 'ぞら', 'から', 'あ'],
  '海': ['かい', 'うみ'],
  '風': ['ふう', 'ふ', 'かぜ', 'かざ'],
  '雨': ['う', 'あめ', 'あま'],
  '夢': ['む', 'ぼう', 'ゆめ'],
  '真': ['しん', 'ま'],
  '実': ['じつ', 'み'],
  '嘘': ['きょ', 'うそ'],
  '約': ['やく'],
  '束': ['そく', 'たば'],
  '勝': ['しょう', 'か'],
  '利': ['り'],
  '仲': ['ちゅう', 'なか'],
  '感': ['かん'],
  '情': ['じょう', 'せい', 'なさ'],
  '記': ['き', 'しる'],
  '憶': ['おく'],
  '言': ['げん', 'ごん', 'こと', 'い'],
  '葉': ['よう', 'は', 'ば'],
  '運': ['うん', 'はこ'],
  '命': ['めい', 'みょう', 'いのち'],
  '地': ['ち', 'じ'],
  '球': ['きゅう', 'たま'],
  '宇': ['う'],
  '宙': ['ちゅう'],
  '星': ['せい', 'しょう', 'ほし', 'ぼし'],
  '太': ['たい', 'た', 'ふと'],
  '陽': ['よう', 'ひ'],
  '月': ['げつ', 'がつ', 'つき'],
  '朝': ['ちょう', 'あさ'],
  '昼': ['ちゅう', 'ひる'],
  '夜': ['や', 'よる', 'よ'],
  '春': ['しゅん', 'はる'],
  '夏': ['か', 'げ', 'なつ'],
  '秋': ['しゅう', 'あき'],
  '冬': ['とう', 'ふゆ'],
  '雪': ['せつ', 'ゆき'],
  '神': ['しん', 'じん', 'かみ', 'がみ'],
  '悪': ['あく', 'お', 'わる'],
  '魔': ['ま'],
  '勇': ['ゆう', 'いさ'],
  '者': ['しゃ', 'もの'],
  '王': ['おう'],
  '法': ['ほう', 'ほっ', 'ぽう'],
  '科': ['か'],
  '技': ['ぎ', 'わざ'],
  '術': ['じゅつ'],
  '力': ['りょく', 'りき', 'ちから'],
  '能': ['のう'],
  '限': ['げん', 'かぎ'],
  '界': ['かい'],
  '私': ['し', 'わたし', 'わたくし'],
  '僕': ['ぼく'],
  '俺': ['おれ'],
  '君': ['くん', 'きみ'],
  '合': ['ごう', 'がっ', 'かっ', 'あ'],
  '手': ['しゅ', 'て', 'で']
};

// Words that should stay intact as compounds (熟字訓 or unified compounds)
export const ATEMI_COMPOUNDS = new Set([
  '今日', '明日', '昨日', '大人', '友達', '久しぶり', '今度', '日曜日'
]);

// Fallback Kanji Dictionary for words Kuromoji doesn't recognize
export const KANJI_READINGS: Record<string, string> = {
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
  '私': 'わたし', '僕': 'ぼく', '俺': 'おれ', '君': 'きみ', '人': 'ひと',
  '山田': 'やまだ', '佐藤': 'さとう', '鈴木': 'すずき', '田中': 'たなか',
  '高橋': 'たかはし', '渡辺': 'わたなべ', '伊藤': 'いとう', '中村': 'なかむら',
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

// Kana to Romaji converter
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
  rubyType: 'hiragana' | 'katakana' | 'romaji' = 'hiragana',
  alternatives?: string[]
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
  if (prefixKana && kanjiReading.startsWith(prefixKana)) {
    kanjiReading = kanjiReading.slice(prefixKana.length);
  }
  if (suffixKana && kanjiReading.endsWith(suffixKana)) {
    kanjiReading = kanjiReading.slice(0, kanjiReading.length - suffixKana.length);
  }

  const tokens: Token[] = [];
  if (prefixKana) tokens.push({ surface: prefixKana, hasKanji: false });

  const formatRuby = (r: string) => {
    if (rubyType === 'katakana') {
      return r.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
    } else if (rubyType === 'romaji') {
      return kanaToRomaji(r);
    }
    return r;
  };

  if (kanjiPart) {
    // Keep unified compounds intact (e.g. 大人, 今日, 明日) or single kanji
    if (ATEMI_COMPOUNDS.has(phrase) || ATEMI_COMPOUNDS.has(kanjiPart) || kanjiPart.length <= 1) {
      tokens.push({
        surface: kanjiPart,
        ruby: formatRuby(kanjiReading),
        hasKanji: true,
        ...(alternatives ? { alternatives } : {})
      });
    } else {
      // Try multi-kanji splitting using KANJI_READING_VARIANTS
      const findSplit = (kIndex: number, curReading: string): Token[] | null => {
        if (kIndex === kanjiPart.length) {
          return curReading.length === 0 ? [] : null;
        }
        const char = kanjiPart[kIndex];
        const variants = KANJI_READING_VARIANTS[char] || [];
        for (const v of variants) {
          if (curReading.startsWith(v)) {
            const rest = findSplit(kIndex + 1, curReading.slice(v.length));
            if (rest !== null) {
              return [{ surface: char, ruby: formatRuby(v), hasKanji: true }, ...rest];
            }
          }
        }
        return null;
      };

      const splitRes = findSplit(0, kanjiReading);
      if (splitRes && splitRes.length === kanjiPart.length) {
        tokens.push(...splitRes);
      } else {
        tokens.push({
          surface: kanjiPart,
          ruby: formatRuby(kanjiReading),
          hasKanji: true,
          ...(alternatives ? { alternatives } : {})
        });
      }
    }
  }

  if (suffixKana) tokens.push({ surface: suffixKana, hasKanji: false });

  return tokens;
}

/**
 * Contextual Disambiguation Engine (前後文上下文消歧引擎)
 * Analyzes surrounding tokens, grammatical markers, and sentence semantics to pick the correct reading for Japanese heteronyms.
 */
export function disambiguateToken(
  kt: any,
  i: number,
  allTokens: any[],
  fullSentence: string
): { reading: string; alternatives?: string[] } {
  const surface = kt.surface_form;
  let reading = kt.reading ? katakanaToHiragana(kt.reading) : (KANJI_READINGS[surface] || '');
  let alternatives: string[] | undefined;

  const prevToken = i > 0 ? allTokens[i - 1] : null;
  const nextToken = i < allTokens.length - 1 ? allTokens[i + 1] : null;

  // 1. 辛い (からい vs つらい)
  if (surface === '辛い') {
    const foodKeywords = /味|料理|食べ|辛い物|塩|ラーメン|甘い|カレー|辛口|唐辛子|麻婆|激辛|舌|酒|スープ|飯|鍋|うどん|肉|野菜|わさび|唐揚げ/;
    const painKeywords = /日々|思い|経験|現実|練習|別れ|人生|仕事|悲しい|泣く|耐える|苦しい|胸が|失恋|孤独|切ない|苦痛/;

    let localContext = '';
    for (let j = Math.max(0, i - 3); j <= Math.min(allTokens.length - 1, i + 3); j++) {
      if (j !== i && allTokens[j]) localContext += allTokens[j].surface_form;
    }

    if (foodKeywords.test(localContext) || foodKeywords.test(fullSentence)) {
      reading = 'からい';
      alternatives = ['からい', 'つらい'];
    } else if (painKeywords.test(localContext) || painKeywords.test(fullSentence)) {
      reading = 'つらい';
      alternatives = ['つらい', 'からい'];
    } else {
      reading = 'からい';
      alternatives = ['からい', 'つらい'];
    }
  }

  // 2. 何 (なん vs なに)
  else if (surface === '何') {
    const nextSurface = nextToken ? nextToken.surface_form : '';
    const isCounter = /^(人|日|回|度|番|年|時|分|秒|個|本|枚|匹|冊|通|台|階|体|点|色|曲|種類)/.test(nextSurface);
    const isNanFollower = /^(で|だ|です|である|だった|だろう|の)/.test(nextSurface);

    if (isCounter || isNanFollower || nextSurface === 'と') {
      reading = 'なん';
      alternatives = ['なん', 'なに'];
    } else {
      reading = 'なに';
      alternatives = ['なに', 'なん'];
    }
  }

  // 3. 角 (かど vs つの vs かく)
  else if (surface === '角') {
    let localContext = '';
    for (let j = Math.max(0, i - 2); j <= Math.min(allTokens.length - 1, i + 2); j++) {
      if (allTokens[j]) localContext += allTokens[j].surface_form;
    }
    const streetKeywords = /曲が|交差点|通り|道|街|右|左/;
    const animalKeywords = /牛|鹿|羊|動物|鬼|生える|折れる/;
    const mathKeywords = /角度|直角|四角|三角|方角|対角|多角/;

    if (streetKeywords.test(localContext)) {
      reading = 'かど';
      alternatives = ['かど', 'つの', 'かく'];
    } else if (animalKeywords.test(localContext)) {
      reading = 'つの';
      alternatives = ['つの', 'かど', 'かく'];
    } else if (mathKeywords.test(localContext)) {
      reading = 'かく';
      alternatives = ['かく', 'かど', 'つの'];
    } else {
      reading = 'かど';
      alternatives = ['かど', 'つの', 'かく'];
    }
  }

  // 4. 風 (ふう vs かぜ)
  else if (surface === '風') {
    const prevSurface = prevToken ? prevToken.surface_form : '';
    const nextSurface = nextToken ? nextToken.surface_form : '';
    const isFuuPrefix = /^(こんな|そんな|あんな|どんな|この|その|あの|和|洋|欧|現代|昔|南国)$/.test(prevSurface);
    const isFuuSuffix = /^(に|だ|です|な|の)$/.test(nextSurface);

    if (isFuuPrefix || isFuuSuffix) {
      reading = 'ふう';
      alternatives = ['ふう', 'かぜ'];
    } else {
      reading = 'かぜ';
      alternatives = ['かぜ', 'ふう'];
    }
  }

  // 5. 方 (かた vs ほう)
  else if (surface === '方') {
    const prevSurface = prevToken ? prevToken.surface_form : '';
    const isVerbStem = prevToken && prevToken.pos === '動詞' && prevToken.conjugated_form && prevToken.conjugated_form.includes('連用形');
    const isHonorific = /^(あの|この|その|どなた)$/.test(prevSurface);

    if (isVerbStem || isHonorific || /^(読み|書き|話し|使い方|考え|教え|行き|作り)$/.test(prevSurface)) {
      reading = 'かた';
      alternatives = ['かた', 'ほう'];
    } else {
      reading = 'ほう';
      alternatives = ['ほう', 'かた'];
    }
  }

  // 6. 一日 (いちにち vs ついたち)
  else if (surface === '一日') {
    const nextSurface = nextToken ? nextToken.surface_form : '';
    if (nextSurface === '中' || fullSentence.includes('一日中') || fullSentence.includes('一日で')) {
      reading = 'いちにち';
      alternatives = ['いちにち', 'ついたち'];
    } else if (nextSurface === 'は' || /月一日/.test(fullSentence)) {
      reading = 'ついたち';
      alternatives = ['ついたち', 'いちにち'];
    } else {
      reading = 'いちにち';
      alternatives = ['いちにち', 'ついたち'];
    }
  }

  // 7. 行く (いく vs ゆく) / 行う (おこなう)
  else if (surface === '行く') {
    reading = 'いく';
    alternatives = ['いく', 'ゆく'];
  } else if (surface === '行う' || surface === '行なう') {
    reading = 'おこなう';
    alternatives = ['おこなう'];
  }

  // 8. 人 (じん vs にん vs ひと) when isolated
  else if (surface === '人') {
    if (prevToken && (prevToken.pos === '名詞' || prevToken.surface_form.endsWith('国') || prevToken.surface_form === '日本')) {
      reading = reading || 'じん';
      alternatives = ['じん', 'にん', 'ひと'];
    } else {
      reading = reading || 'ひと';
      alternatives = ['ひと', 'にん', 'じん'];
    }
  }

  return { reading, alternatives };
}

/**
 * Tokenizes Japanese text line into tokens with Kanji readings, keeping original text intact.
 * Context-aware and mora-aligned.
 */
export function annotateLine(
  rawLine: string,
  rubyType: 'hiragana' | 'katakana' | 'romaji' = 'hiragana'
): ScriptLine {
  const content = rawLine;
  const tokens: Token[] = [];

  // Check for pre-segmented phrases (e.g. 一日中)
  const patternKeys = Object.keys(GRAMMAR_PATTERNS).sort((a, b) => b.length - a.length);

  // 1. If Kuromoji is ready, use it with Contextual Disambiguation
  if (isKuromojiReady()) {
    const tokenizer = getTokenizer();
    const kuromojiTokens = tokenizer.tokenize(content);

    for (let i = 0; i < kuromojiTokens.length; i++) {
      const kt = kuromojiTokens[i];

      if (!KANJI_REGEX.test(kt.surface_form)) {
        tokens.push({ surface: kt.surface_form, hasKanji: false });
        continue;
      }

      // Check if this token matches a high-priority compound grammar pattern
      let reading = GRAMMAR_PATTERNS[kt.surface_form];
      let alternatives: string[] | undefined;

      if (!reading) {
        const disambiguated = disambiguateToken(kt, i, kuromojiTokens, content);
        reading = disambiguated.reading;
        alternatives = disambiguated.alternatives;
      }

      if (reading) {
        const subTokens = parseCompoundToTokens(kt.surface_form, reading, rubyType, alternatives);
        tokens.push(...subTokens);
      } else {
        tokens.push({ surface: kt.surface_form, hasKanji: true });
      }
    }
  } else {
    // 2. Fallback regex tokenizer with Context-Aware rules if Kuromoji isn't loaded
    let currentWord = '';

    for (let i = 0; i < content.length; i++) {
      let matched = false;

      // 2a. Check multi-char grammar idioms
      for (const pat of patternKeys) {
        if (content.startsWith(pat, i)) {
          if (currentWord) {
            tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
            currentWord = '';
          }
          const subTokens = parseCompoundToTokens(pat, GRAMMAR_PATTERNS[pat], rubyType);
          tokens.push(...subTokens);
          i += pat.length - 1;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // 2b. Check vocabulary dictionary
      for (let len = 6; len >= 2; len--) {
        if (i + len <= content.length) {
          const sub = content.slice(i, i + len);
          if (KANJI_READINGS[sub]) {
            if (currentWord) {
              tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
              currentWord = '';
            }
            let reading = KANJI_READINGS[sub];
            const subTokens = parseCompoundToTokens(sub, reading, rubyType);
            tokens.push(...subTokens);
            i += len - 1;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;

      // 2c. Single characters
      const char = content[i];
      if (KANJI_REGEX.test(char)) {
        if (currentWord) {
          tokens.push({ surface: currentWord, hasKanji: KANJI_REGEX.test(currentWord) });
          currentWord = '';
        }

        // Apply contextual rules on single character
        let reading = KANJI_READINGS[char] || '';
        let alternatives: string[] | undefined;

        if (char === '辛' && content.slice(i, i + 2) === '辛い') {
          // Handled by sub check or single
        } else if (char === '何') {
          const nextChar = content[i + 1] || '';
          if (/^(で|だ|で|の|人|時|分|年|回|度|番)/.test(nextChar)) {
            reading = 'なん';
            alternatives = ['なん', 'なに'];
          } else {
            reading = 'なに';
            alternatives = ['なに', 'なん'];
          }
        } else if (char === '角') {
          if (/曲が|道|通り|交差点/.test(content)) {
            reading = 'かど';
            alternatives = ['かど', 'つの', 'かく'];
          } else if (/牛|鹿|羊|動物/.test(content)) {
            reading = 'つの';
            alternatives = ['つの', 'かど', 'かく'];
          }
        }

        if (reading) {
          if (rubyType === 'katakana') {
            reading = reading.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
          } else if (rubyType === 'romaji') {
            reading = kanaToRomaji(reading);
          }
          tokens.push({ surface: char, ruby: reading, hasKanji: true, ...(alternatives ? { alternatives } : {}) });
        } else {
          tokens.push({ surface: char, hasKanji: true });
        }
      } else {
        currentWord += char;
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
