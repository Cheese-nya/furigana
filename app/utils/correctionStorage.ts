import { emptyDatabase, migrateDatabase, type CorrectionDatabaseV2 } from './correctionDatabase';

const STORAGE_KEY = 'furigana-corrections-v2';
const LEGACY_KEY = 'furigana-corrections-v1';

interface CorrectionApi {
  load_correction_database(): Promise<unknown>;
  save_correction_database(data: CorrectionDatabaseV2): Promise<{ success: boolean; error?: string }>;
}

function nativeApi(): CorrectionApi | undefined {
  return (window as Window & { pywebview?: { api?: CorrectionApi } }).pywebview?.api;
}

async function readyApi(): Promise<CorrectionApi | undefined> {
  if (new URLSearchParams(window.location.search).get('desktop') === '1' && !nativeApi()) {
    await new Promise<void>(resolve => window.addEventListener('pywebviewready', () => resolve(), { once: true }));
  }
  const api = nativeApi();
  if (api && (!api.load_correction_database || !api.save_correction_database)) throw new Error('请更新桌面程序以使用新版校对存储');
  return api;
}

export async function loadCorrections(): Promise<CorrectionDatabaseV2> {
  const api = await readyApi();
  if (api) return migrateDatabase(await api.load_correction_database());
  const current = localStorage.getItem(STORAGE_KEY);
  if (current !== null) return migrateDatabase(JSON.parse(current));
  const legacy = localStorage.getItem(LEGACY_KEY);
  const database = legacy === null ? emptyDatabase() : migrateDatabase(JSON.parse(legacy));
  // Do not touch v1. Only write a validated migration to a separate key.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  return database;
}

let saveQueue: Promise<void> = Promise.resolve();
export function saveCorrections(data: CorrectionDatabaseV2): Promise<void> {
  let snapshot: CorrectionDatabaseV2;
  try { snapshot = migrateDatabase(data); }
  catch (error) { return Promise.reject(error); }
  const save = async () => {
    const api = await readyApi();
    if (api) {
      const result = await api.save_correction_database(snapshot);
      if (!result.success) throw new Error(result.error || '校对记录保存失败');
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  };
  const pending = saveQueue.then(save, save);
  saveQueue = pending.catch(() => {});
  return pending;
}
