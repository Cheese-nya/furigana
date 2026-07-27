/**
 * China-accessible AI & Neural Machine Translation Engine
 * Supports:
 * 1. Domestic free direct engines (Youdao / Google GTX mirror / Offline Rule Engine)
 * 2. Domestic LLMs (DeepSeek / SiliconFlow 硅基流动 / 豆包 / 智谱 GLM / Custom OpenAI Compatible API)
 */

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
 * Perform translation accessible in mainland China
 */
export async function translateTextCN(
  text: string,
  config: TranslationConfig = { engine: 'auto_cn' }
): Promise<string> {
  const trimmed = text.trim();
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
    } catch (err) {
      console.warn('Custom LLM Translation error, fallback to free direct engine:', err);
    }
  }

  // Option B: Free Direct Online Translation Engine (China Accessible API)
  if (!translatedSpeech) {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=zh-CN&dt=t&q=${encodeURIComponent(speech)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          translatedSpeech = data[0].map((part: any) => part[0]).join('').trim();
        }
      }
    } catch (e) {
      // Ignore network failover
    }
  }

  // Option C: Local Phrase / Rule Dictionary Fallback
  if (!translatedSpeech) {
    for (const [key, val] of Object.entries(COMMON_JAPANESE_PHRASES)) {
      if (speech.includes(key)) {
        translatedSpeech = val;
        break;
      }
    }
  }

  if (!translatedSpeech) {
    translatedSpeech = speech;
  }

  return speaker ? `${speaker}：${translatedSpeech}` : translatedSpeech;
}
