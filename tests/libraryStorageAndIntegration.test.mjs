import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from './loadTypescript.mjs';

const { loadLibraryWithFallback, saveLibraryWithFallback } = loadTypescript('../app/utils/libraryStorage.ts');
const { upsertBook } = loadTypescript('../app/utils/libraryDatabase.ts');

const STORAGE_KEY = 'furigana-library-v1';

/** Minimal DOM shims: window, localStorage and IndexedDB (queueMicrotask async). */
function installBrowserShims() {
  const records = new Map(); // localStorage records
  const idb = new Map(); // IndexedDB record store
  globalThis.window = { location: { search: '' } };
  globalThis.localStorage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  globalThis.indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: () => true },
          transaction() {
            return { objectStore: () => ({
              get() { const get = {}; queueMicrotask(() => { get.result = idb.get('database'); get.onsuccess?.(); }); return get; },
              put(value) { idb.set('database', value); const put = {}; queueMicrotask(() => put.onsuccess?.()); return put; },
            }) };
          },
          close() {},
        };
        request.onsuccess?.();
      });
      return request;
    },
  };
  return {
    records,
    idb,
    cleanup() {
      delete globalThis.window;
      delete globalThis.localStorage;
      delete globalThis.indexedDB;
    },
  };
}

test('loadLibraryWithFallback seeds starter books into localStorage on first run', async () => {
  const shims = installBrowserShims();
  try {
    assert.equal(shims.records.get(STORAGE_KEY), undefined);
    const db = await loadLibraryWithFallback();
    const raw = shims.records.get(STORAGE_KEY);
    assert.ok(raw, 'starter books must be persisted to localStorage');
    const persisted = JSON.parse(raw);
    assert.equal(persisted.version, 2);
    assert.equal(persisted.books['book:starter-dubbing'].category, 'script');
    assert.equal(Object.keys(db.books).length, 3);
    assert.deepEqual(Object.keys(db.books).sort(), ['book:starter-dubbing', 'book:starter-miyazawa', 'book:starter-soseki']);
  } finally {
    shims.cleanup();
  }
});

test('loadLibraryWithFallback prefers the desktop pywebview API', async () => {
  const shims = installBrowserShims();
  const desktop = new Map();
  globalThis.window.pywebview = { api: {
    async load_library_database() { return desktop.get('db') ?? null; },
    async save_library_database(data) { desktop.set('db', data); return { success: true }; },
  } };
  try {
    const seeded = await loadLibraryWithFallback();
    // On first desktop run the loader seeds starter books back via save_library_database.
    assert.ok(desktop.get('db'), 'first desktop load must persist starter books through the API');
    assert.equal(desktop.get('db').books['book:starter-dubbing'].category, 'script');
    assert.equal(seeded.books['book:starter-soseki'].author, '夏目漱石');
    assert.equal(shims.records.size, 0, 'desktop mode must not fall back to localStorage');

    const custom = await upsertBook(seeded, { bookId: 'book:custom', title: '桌面保存测试', content: '本文', now: 5 });
    assert.equal(await saveLibraryWithFallback(custom), true);
    assert.equal(desktop.get('db').books['book:custom'].title, '桌面保存测试');

    const reloaded = await loadLibraryWithFallback();
    assert.equal(reloaded.books['book:custom'].bookId, 'book:custom');
  } finally {
    shims.cleanup();
  }
});

test('loadLibraryWithFallback recovers starter books when localStorage JSON is corrupt', async () => {
  const shims = installBrowserShims();
  try {
    shims.records.set(STORAGE_KEY, '{not valid jsonizm!!');
    // Corrupt JSON must never crash the app: fall back to starter books and keep the UI usable.
    const db = await loadLibraryWithFallback();
    assert.equal(Object.keys(db.books).length, 3);
    assert.ok(db.books['book:starter-dubbing'].content.length > 0);
    assert.ok(db.books['book:starter-miyazawa'].content.length > 0);
  } finally {
    shims.cleanup();
  }
});

test('loadLibraryWithFallback round-trips custom data through saveLibraryWithFallback', async () => {
  const shims = installBrowserShims();
  try {
    const seeded = await loadLibraryWithFallback();
    const custom = await upsertBook(seeded, { bookId: 'book:roundtrip', title: '往返测试', content: '本文', now: 7 });
    shims.records.clear();
    shims.idb.clear();
    assert.equal(await saveLibraryWithFallback(custom), true);
    const reloaded = await loadLibraryWithFallback();
    assert.equal(reloaded.books['book:roundtrip'].title, '往返测试');
  } finally {
    shims.cleanup();
  }
});

test('saveLibraryWithFallback returns false without throwing on write failure', async () => {
  const shims = installBrowserShims();
  globalThis.window.pywebview = { api: {
    async load_library_database() { return null; },
    async save_library_database() { return { success: false, error: '桌面写入失败' }; },
  } };
  try {
    const data = await loadLibraryWithFallback();
    assert.equal(await saveLibraryWithFallback(data), false);
  } finally {
    shims.cleanup();
  }
});

test('manifest.json declares standalone display, relative start_url and valid icons', () => {
  const manifestPath = fileURLToPath(new URL('../public/manifest.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest must list icons');
  for (const icon of manifest.icons) {
    assert.match(icon.src, /\.(png|jpg|jpeg|webp|svg)$/);
    assert.match(icon.sizes, /^\d+x\d+$/);
    assert.ok(typeof icon.type === 'string' && icon.type.startsWith('image/'), 'icon must declare an image MIME type');
  }
  assert.ok(manifest.icons.some(icon => parseInt(icon.sizes, 10) >= 192), 'manifest must include a 192px+ icon');
});

test('Settings menu has no external links (removed with the mockup rebuild)', () => {
  const settings = readFileSync(fileURLToPath(new URL('../app/components/SettingsMenu.tsx', import.meta.url)), 'utf8');
  assert.equal(/<a\s/.test(settings), false);
});
