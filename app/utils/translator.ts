/**
 * China-accessible AI & Neural Machine Translation & Furigana Annotation Engine
 * Supports:
 * 1. Domestic free direct engines (Youdao / Google GTX mirror / Offline Rule Engine)
 * 2. Domestic LLMs (DeepSeek / SiliconFlow 硅基流动 / 豆包 / 智谱 GLM / Custom OpenAI Compatible API)
 */

import { Token, kanaToRomaji } from './furigana';

export interface TranslationConfig {
  engine: 'auto_cn' | 'deepseek' | 'siliconflow' | 'custom_ai';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

const COMMON_JAPANESE_PHRASES: Record<string, string> = {
  'こんにちは': '你好！',
  'おはよう': '早上好！',
  'こんばんは': '晚上好！',
  'ありがとう': '非常感谢！',
  'ありがと': '谢谢啦！',
  'さようなら': '再见！',
  'すみません': '不好意思 / 对不起。',
  'ごめんなさい': '对不起。',
  'はじめまして': '初次见面，请多关照。',
  'よろしく': '请多关照。',
  '大丈夫': '没关系 / 没事。',
  '本当': '真的吗？',
  '嘘': '骗人的吧！',
  'なに': '什么？',
  'なにこれ': '这是什么？',
  'すごい': '太厉害了！',
  'やばい': '糟糕 / 不妙！',
  'たすけて': '救救我！',
  'がんばれ': '加油！',
  'あいしてる': '我爱你。',
  '好き': '喜欢。',
  '嫌い': '讨厌。',
  '理解した': '明白了。',
  '了解': '收到 / 了解。',
};

/**
 * Parse AI returned string in `漢字(かな)` format into structured Token[] array
 */
export function parseRubyFormattedString(
  text: string,
  rubyType: 'hiragana' | 'katakana' | 'romaji' = 'hiragana'
): Token[] {
  const regex = /([\u4E00-\u9FFF\u3400-\u4DBF]+)\(([^)]+)\)|([^\u4E00-\u9FFF\u3400-\u4DBF()]+)/g;
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[2]) {
      let reading = match[2].trim();
      if (rubyType === 'katakana') {
        reading = reading.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
      } else if (rubyType === 'romaji') {
        reading = kanaToRomaji(reading);
      }
      tokens.push({ surface: match[1], ruby: reading, hasKanji: true });
    } else if (match[3]) {
      tokens.push({ surface: match[3], hasKanji: false });
    }
  }

  return tokens;
}

/**
 * High-Precision AI Furigana Annotation Engine
 * Uses LLMs (DeepSeek, SiliconFlow, Zhipu, Doubao) to generate context-aware readings for all Japanese Kanji
 */
export async function annotateLineWithAI(
  text: string,
  config: TranslationConfig,
  rubyType: 'hiragana' | 'katakana' | 'romaji' = 'hiragana'
): Promise<Token[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  
  const cacheKey = `ai_anno_v2_${config.engine}_${rubyType}_${trimmed}`;
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
  }

  // LLM Mode (DeepSeek, SiliconFlow, Custom AI)
  if ((config.engine === 'deepseek' || config.engine === 'siliconflow' || config.engine === 'custom_ai') && config.apiKey) {
    try {
      let defaultUrl = 'https://api.deepseek.com/v1';
      let defaultModel = 'deepseek-chat';
      if (config.engine === 'siliconflow') {
        defaultUrl = 'https://api.siliconflow.cn/v1';
        defaultModel = 'deepseek-ai/DeepSeek-V3';
      }
      const baseUrl = config.baseUrl || defaultUrl;
      const model = config.model || defaultModel;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey.trim()}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `你是一个专业的日语配音台本假名注音专家。请为输入的日语句子中的汉字标注准确的平假名。
输出格式要求：将每个汉字或汉字词组后面用括号跟上其准确的平假名读音，如："山田(やまだ)先生(せんせい)：みなさん、今日(きょう)の日本語(にほんご)台本(だいほん)へようこそ。"
非汉字部分（平假名、片假名、标点）保持原样，不要额外标注。只返回注音后的文本，严禁包含任何说明或Markdown代码块。`
            },
            { role: 'user', content: trimmed }
          ],
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          const tokens = parseRubyFormattedString(content, rubyType);
          if (tokens.length > 0) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(cacheKey, JSON.stringify(tokens));
            }
            return tokens;
          }
        }
      }
    } catch (e) {
      console.error('AI Furigana annotation error:', e);
    }
  }

  return null;
}

/**
 * Perform translation accessible in mainland China
 */
export async function translateTextCN(
  text: string,
  config: TranslationConfig = { engine: 'auto_cn' }
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const cacheKey = `ai_trans_v2_${config.engine}_${trimmed}`;
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
  }
  if (!trimmed) return '';

  // Parse speaker role prefix if present (e.g. "佐藤：こんにちは")
  const colonIndex = trimmed.search(/[:：]/);
  let speaker = '';
  let speech = trimmed;
  if (colonIndex !== -1) {
    speaker = trimmed.slice(0, colonIndex);
    speech = trimmed.slice(colonIndex + 1).trim();
  }

  if (!speech) return trimmed;

  let translatedSpeech = '';

  // Option A: LLM Translation (DeepSeek, SiliconFlow, Custom OpenAI compatible)
  if ((config.engine === 'deepseek' || config.engine === 'siliconflow' || config.engine === 'custom_ai') && config.apiKey) {
    try {
      let defaultUrl = 'https://api.deepseek.com/v1';
      let defaultModel = 'deepseek-chat';

      if (config.engine === 'siliconflow') {
        defaultUrl = 'https://api.siliconflow.cn/v1';
        defaultModel = 'deepseek-ai/DeepSeek-V3';
      }

      const baseUrl = config.baseUrl || defaultUrl;
      const model = config.model || defaultModel;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey.trim()}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的日中配音台本翻译员。请将输入的日语直接翻译为自然流畅的中文。只输出翻译后的中文文本，严禁包含任何解释说明。'
            },
            { role: 'user', content: speech }
          ],
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
          translatedSpeech = data.choices[0].message.content.trim();
        }
      }
    } catch (e) {
      console.error('LLM Translation error, falling back:', e);
    }
  }

  // Option B: Domestic Free Engine / Phrasebook
  if (!translatedSpeech) {
    if (COMMON_JAPANESE_PHRASES[speech]) {
      translatedSpeech = COMMON_JAPANESE_PHRASES[speech];
    } else {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=zh-CN&dt=t&q=${encodeURIComponent(speech)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data[0]) {
            translatedSpeech = data[0].map((item: any) => item[0]).join('');
          }
        }
      } catch (e) {
        translatedSpeech = speech;
      }
    }
  }

  const finalResult = speaker ? `${speaker}: ${translatedSpeech}` : translatedSpeech;
  if (typeof window !== 'undefined') {
    localStorage.setItem(cacheKey, finalResult);
  }
  return finalResult;
}
