import BrowserDictionaryLoader from 'kuromoji/src/loader/BrowserDictionaryLoader';

type LoadCallback = (err: unknown, buffer: ArrayBuffer | null) => void;

/**
 * Stock kuromoji fires all twelve dictionary downloads at once and inflates each
 * with zlibjs, which grows its output buffer by doubling. The dictionary is ~100 MB
 * once inflated, so the stock path peaks at several times that, which is enough to
 * get the WebView renderer killed on memory-constrained phones.
 *
 * This replaces the browser loader with one that loads a file at a time and
 * inflates with the native DecompressionStream straight into a buffer sized from
 * the gzip trailer (ISIZE), so peak memory is roughly the final dictionary.
 * Anything unsupported or failing falls back to the stock loader for that file.
 */
const proto = BrowserDictionaryLoader.prototype as { loadArrayBuffer: (url: string, callback: LoadCallback) => void };
const stockLoad = proto.loadArrayBuffer;

let queue: Promise<unknown> = Promise.resolve();

const canStream = () =>
  typeof DecompressionStream === 'function' &&
  typeof fetch === 'function' &&
  /^https?:$/.test(globalThis.location?.protocol ?? '');

async function inflate(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const blob = await response.blob();
  if (blob.size < 18) throw new Error('not a gzip stream');
  const size = new DataView(await blob.slice(-4).arrayBuffer()).getUint32(0, true);
  const out = new Uint8Array(size);
  const reader = blob.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let offset = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.length > size) throw new Error('gzip size mismatch');
    out.set(value, offset);
    offset += value.length;
  }
  if (offset !== size) throw new Error('gzip size mismatch');
  return out.buffer;
}

function stock(this: unknown, url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    stockLoad.call(this, url, (err, buffer) => (err || !buffer ? reject(err ?? new Error('empty dictionary file')) : resolve(buffer)));
  });
}

proto.loadArrayBuffer = function (this: unknown, url: string, callback: LoadCallback) {
  const run = async () => {
    if (canStream()) {
      try {
        return await inflate(url);
      } catch (error) {
        console.warn('Streaming dictionary load failed, using stock loader:', url, error);
      }
    }
    return stock.call(this, url);
  };
  queue = queue
    .then(run)
    .then(buffer => callback(null, buffer), err => callback(err, null))
    .catch(() => undefined);
};
