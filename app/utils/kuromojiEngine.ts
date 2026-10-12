import kuromoji from 'kuromoji';

export interface KuromojiToken {
  word_id: number;
  word_type: string;
  word_position: number;
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  conjugated_type: string;
  conjugated_form: string;
  basic_form: string;
  reading?: string;
  pronunciation?: string;
}

let tokenizer: { tokenize(text: string): KuromojiToken[] } | null = null;
let initPromise: Promise<void> | null = null;

export const initKuromoji = async (dictionaryPath?: string): Promise<void> => {
  if (tokenizer) return;
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    // Determine the dictionary path based on window.location if in browser
    let dictPath = '/dict';
    if (typeof window !== 'undefined') {
       const isDesktopExe = window.location.protocol === 'file:';
       // In PyWebView Desktop mode, we might need a relative or specific path
       // In NextJS dev/export mode, /dict is in the public root.
       if (isDesktopExe) {
          dictPath = './dict';
       } else {
          // ensure trailing slash is not an issue
          dictPath = window.location.pathname.replace(/\/$/, '') + '/dict';
          // if we are at root, dictPath becomes /dict
          if (dictPath === '/dict' && !window.location.pathname.startsWith('/dict')) {
              dictPath = '/dict';
          }
       }
    }

    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      initPromise = null;
      reject(new Error('离线词典加载超时，请重试'));
    }, 15000);
    kuromoji.builder({ dicPath: dictionaryPath || dictPath }).build((err, _tokenizer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (err) {
        console.error('Kuromoji initialization failed:', err);
        initPromise = null;
        reject(err);
        return;
      }
      tokenizer = _tokenizer;
      resolve();
    });
  });

  return initPromise;
};

export const getTokenizer = () => {
  if (!tokenizer) throw new Error('Kuromoji is not initialized');
  return tokenizer;
};

export const isKuromojiReady = () => !!tokenizer;
