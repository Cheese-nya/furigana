import { waitForPywebviewApi } from './pywebviewReady';
import { createStarterBooks, emptyLibraryDatabase, validateLibraryDatabase, type LibraryDatabaseV1 } from './libraryDatabase';

const STORAGE_KEY = 'furigana-library-v1';
const DB_NAME = 'furigana-library-db';
const STORE_NAME = 'library';
const RECORD_KEY = 'database';

interface LibraryApi {
  load_library_database(): Promise<unknown>;
  save_library_database(data: LibraryDatabaseV1): Promise<{ success: boolean; error?: string }>;
}

interface IndexedDbFactory {
  open(name: string, version?: number): IDBOpenDBRequest;
}

function nativeApi(): Partial<LibraryApi> | undefined {
  return (globalThis as { window?: { pywebview?: { api?: Partial<LibraryApi> } } }).window?.pywebview?.api;
}

async function readyApi(): Promise<Partial<LibraryApi> | undefined> {
  const browser = (globalThis as { window?: Window & { pywebview?: { api?: Partial<LibraryApi> } } }).window;
  if (!browser) return undefined;
  if (new URLSearchParams(browser.location.search).get('desktop') === '1') {
    const usable = () => { const api = nativeApi(); return !!api && !!api.load_library_database && !!api.save_library_database; };
    await waitForPywebviewApi(browser, usable);
  }
  const api = nativeApi();
  if (api && (!api.load_library_database || !api.save_library_database)) throw new Error('请更新桌面程序以使用书库存储');
  return api?.load_library_database && api.save_library_database ? api : undefined;
}

function indexedDb(): IndexedDbFactory | undefined {
  const factory = (globalThis as { indexedDB?: IndexedDbFactory }).indexedDB;
  return factory && typeof factory.open === 'function' ? factory : undefined;
}

function openLibraryDb(): Promise<IDBDatabase> {
  const factory = indexedDb();
  if (!factory) return Promise.reject(new Error('IndexedDB 不可用'));
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('书库数据库打开失败'));
  });
}

async function idbGet(): Promise<unknown | undefined> {
  if (!indexedDb()) return undefined;
  const db = await openLibraryDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('书库读取失败'));
    });
  } finally {
    db.close();
  }
}

async function idbSet(data: LibraryDatabaseV1): Promise<void> {
  if (!indexedDb()) return;
  const db = await openLibraryDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(data, RECORD_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('书库写入失败'));
    });
  } finally {
    db.close();
  }
}

function readLocal(): string | null {
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  return storage ? storage.getItem(STORAGE_KEY) : null;
}

function writeLocal(raw: string): void {
  (globalThis as { localStorage?: Storage }).localStorage?.setItem(STORAGE_KEY, raw);
}

async function persist(data: LibraryDatabaseV1): Promise<void> {
  const api = await readyApi();
  if (api?.save_library_database) {
    const result = await api.save_library_database(data);
    if (!result.success) throw new Error(result.error || '书库保存失败');
    return;
  }
  const raw = JSON.stringify(data);
  if (indexedDb()) await idbSet(data);
  writeLocal(raw);
}

let saveQueue: Promise<void> = Promise.resolve();

export async function loadLibrary(): Promise<LibraryDatabaseV1> {
  const api = await readyApi();
  if (api?.load_library_database) {
    const loaded = await api.load_library_database();
    if (loaded == null || loaded === '') {
      const starter = await createStarterBooks();
      await persist(validateLibraryDatabase(starter));
      return starter;
    }
    return validateLibraryDatabase(loaded);
  }
  const stored = indexedDb() ? await idbGet() : undefined;
  if (stored != null) return validateLibraryDatabase(stored);
  const raw = readLocal();
  if (raw != null && raw !== '') {
    const parsed = validateLibraryDatabase(JSON.parse(raw));
    if (indexedDb()) await idbSet(parsed);
    return parsed;
  }
  const starter = await createStarterBooks();
  await persist(validateLibraryDatabase(starter));
  return starter;
}

export function saveLibrary(data: LibraryDatabaseV1): Promise<void> {
  let snapshot: LibraryDatabaseV1;
  try { snapshot = validateLibraryDatabase(data); }
  catch (error) { return Promise.reject(error); }
  const save = () => persist(snapshot);
  const pending = saveQueue.then(save, save);
  saveQueue = pending.catch(() => {});
  return pending;
}

/** Resilient loader: never throws. Falls back to fresh starter books, then an empty library. */
export async function loadLibraryWithFallback(): Promise<LibraryDatabaseV1> {
  try {
    return await loadLibrary();
  } catch (error) {
    console.error('[library] failed to load, using starter books', error);
    try {
      return await createStarterBooks();
    } catch {
      return emptyLibraryDatabase();
    }
  }
}

/** Resilient saver: logs failures instead of breaking the UI flow. Returns whether the write succeeded. */
export async function saveLibraryWithFallback(data: LibraryDatabaseV1): Promise<boolean> {
  try {
    await saveLibrary(data);
    return true;
  } catch (error) {
    console.error('[library] failed to save', error);
    return false;
  }
}
