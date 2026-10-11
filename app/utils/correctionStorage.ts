import { validateRubyOverrides, type RubyOverride } from './rubyOverrides';

export type CorrectionLibrary = Record<string, RubyOverride[]>;
const STORAGE_KEY = 'furigana-corrections-v1';

interface CorrectionApi {
  load_corrections(): Promise<unknown>;
  save_corrections(data: CorrectionLibrary): Promise<{ success: boolean; error?: string }>;
}

function nativeApi(): CorrectionApi | undefined {
  return (window as Window & { pywebview?: { api?: CorrectionApi } }).pywebview?.api;
}

function validateLibrary(value: unknown): CorrectionLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entries]) => [key, validateRubyOverrides(entries)]));
}

async function readyApi(): Promise<CorrectionApi | undefined> {
  if (new URLSearchParams(window.location.search).get('desktop') === '1' && !nativeApi()) {
    await new Promise<void>(resolve => window.addEventListener('pywebviewready', () => resolve(), { once: true }));
  }
  return nativeApi();
}

export async function loadCorrections(): Promise<CorrectionLibrary> {
  const api = await readyApi();
  if (api?.load_corrections) return validateLibrary(await api.load_corrections());
  return validateLibrary(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
}

export async function saveCorrections(data: CorrectionLibrary): Promise<void> {
  const api = await readyApi();
  if (api?.save_corrections) {
    const result = await api.save_corrections(data);
    if (!result.success) throw new Error(result.error || 'Failed to save corrections');
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
