import { APP_VERSION, DISTRIBUTION, getPlatform } from './appInfo';
import type {
  AndroidUpdateBridge,
  DesktopUpdateApi,
  DeviceInfo,
  DiagnosticReport,
  LogEntry,
  LogLevel,
} from './updateTypes';

export const LOG_STORAGE_KEY = 'uku.log.v1';
const MAX_BUFFER_ENTRIES = 500;
const MAX_PERSIST_ENTRIES = 200;
const PERSIST_THROTTLE_MS = 2000;

const CJK_RUN_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{6,}/g;
const UNIX_USER_PATH_RE = /\/(home|Users)\/[^/\\\s]+\//g;
const WIN_USER_PATH_RE = /([A-Za-z]:\\Users\\)[^/\\\s]+\\/g;

const entries: LogEntry[] = [];
let lastPersistAt = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const installedWindows = new WeakSet<object>();

interface LogWindow {
  localStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  navigator?: { userAgent?: string; language?: string; onLine?: boolean };
  document?: {
    documentElement?: {
      getAttribute?: (name: string) => string | null;
      dataset?: { theme?: string };
      classList?: { contains?: (token: string) => boolean };
    };
  };
  innerWidth?: number;
  innerHeight?: number;
  devicePixelRatio?: number;
  matchMedia?: (query: string) => { matches?: boolean } | null | undefined;
  addEventListener?: (type: string, listener: (ev: unknown) => void) => void;
  AndroidBridge?: Partial<AndroidUpdateBridge>;
  pywebview?: { api?: Partial<DesktopUpdateApi> };
}

function getLocalStorage(win?: LogWindow): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    if (win?.localStorage) return win.localStorage;
  } catch {}
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {}
  try {
    if (typeof window !== 'undefined' && (window as unknown as LogWindow).localStorage) {
      return (window as unknown as LogWindow).localStorage;
    }
  } catch {}
  return undefined;
}

export function redactText(text: string, max = 500): string {
  const raw = typeof text === 'string' ? text : String(text ?? '');
  let out = raw
    .replace(UNIX_USER_PATH_RE, '/$1/<user>/')
    .replace(WIN_USER_PATH_RE, '$1<user>\\')
    .replace(CJK_RUN_RE, '[文本已隐去]');
  if (out.length > max) {
    out = `${out.slice(0, max)}…`;
  }
  return out;
}

function writeToStorage(): void {
  try {
    const storage = getLocalStorage();
    if (!storage) return;
    const recent = entries.slice(-MAX_PERSIST_ENTRIES);
    storage.setItem(LOG_STORAGE_KEY, JSON.stringify(recent));
    lastPersistAt = Date.now();
  } catch {
    // Ignore storage failures
  }
}

function schedulePersist(): void {
  const now = Date.now();
  const elapsed = now - lastPersistAt;
  if (lastPersistAt === 0 || elapsed >= PERSIST_THROTTLE_MS) {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    writeToStorage();
  } else if (persistTimer === null) {
    const delay = Math.max(0, PERSIST_THROTTLE_MS - elapsed);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      writeToStorage();
    }, delay);
    if (typeof persistTimer === 'object' && persistTimer !== null && 'unref' in persistTimer) {
      (persistTimer as { unref?: () => void }).unref?.();
    }
  }
}

export function logEvent(level: LogLevel, source: string, message: string): LogEntry {
  const entry: LogEntry = {
    t: Date.now(),
    level,
    source: String(source || 'app'),
    message: redactText(message),
  };
  entries.push(entry);
  if (entries.length > MAX_BUFFER_ENTRIES) {
    entries.splice(0, entries.length - MAX_BUFFER_ENTRIES);
  }
  schedulePersist();
  return entry;
}

export function getEntries(): LogEntry[] {
  return entries.map(e => ({ ...e }));
}

export function clearEntries(): void {
  entries.length = 0;
  lastPersistAt = 0;
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

function formatLogArg(arg: unknown): string {
  if (arg instanceof Error) {
    return arg.stack || arg.message || String(arg);
  }
  if (arg && typeof arg === 'object') {
    const maybeErr = arg as { stack?: unknown; message?: unknown };
    if (typeof maybeErr.stack === 'string' && maybeErr.stack) return maybeErr.stack;
    if (typeof maybeErr.message === 'string' && maybeErr.message) return maybeErr.message;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function formatLogArgs(args: unknown[]): string {
  return args.map(formatLogArg).join(' ');
}

function restorePersistedEntries(win?: LogWindow): void {
  try {
    const storage = getLocalStorage(win);
    if (!storage) return;
    const raw = storage.getItem(LOG_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const valid: LogEntry[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.t === 'number' &&
        (item.level === 'error' || item.level === 'warn' || item.level === 'info') &&
        typeof item.source === 'string' &&
        typeof item.message === 'string'
      ) {
        valid.push({
          t: item.t,
          level: item.level,
          source: item.source,
          message: redactText(item.message),
        });
      }
    }
    if (valid.length > 0) {
      const combined = [...valid, ...entries].slice(-MAX_BUFFER_ENTRIES);
      entries.length = 0;
      entries.push(...combined);
    }
  } catch {
    // Ignore corrupt or inaccessible storage
  }
}

export function installGlobalLogging(): void {
  if (typeof window === 'undefined' || !window) return;
  const win = window as unknown as LogWindow & object;
  if (installedWindows.has(win)) return;
  installedWindows.add(win);

  restorePersistedEntries(win);

  let inHook = false;
  const origError = console.error;
  const origWarn = console.warn;

  if (typeof origError === 'function' && !(origError as unknown as { __ukuWrapped?: boolean }).__ukuWrapped) {
    const wrappedError = (...args: unknown[]) => {
      try {
        origError.apply(console, args);
      } finally {
        if (!inHook) {
          inHook = true;
          try {
            logEvent('error', 'console', formatLogArgs(args));
          } finally {
            inHook = false;
          }
        }
      }
    };
    (wrappedError as unknown as { __ukuWrapped?: boolean }).__ukuWrapped = true;
    console.error = wrappedError;
  }

  if (typeof origWarn === 'function' && !(origWarn as unknown as { __ukuWrapped?: boolean }).__ukuWrapped) {
    const wrappedWarn = (...args: unknown[]) => {
      try {
        origWarn.apply(console, args);
      } finally {
        if (!inHook) {
          inHook = true;
          try {
            logEvent('warn', 'console', formatLogArgs(args));
          } finally {
            inHook = false;
          }
        }
      }
    };
    (wrappedWarn as unknown as { __ukuWrapped?: boolean }).__ukuWrapped = true;
    console.warn = wrappedWarn;
  }

  if (typeof win.addEventListener === 'function') {
    win.addEventListener('error', (ev: unknown) => {
      const errEv = ev as { error?: unknown; message?: unknown } | undefined;
      const detail = errEv?.error ?? errEv?.message ?? ev;
      logEvent('error', 'window', formatLogArg(detail));
    });

    win.addEventListener('unhandledrejection', (ev: unknown) => {
      const rejEv = ev as { reason?: unknown } | undefined;
      const reason = rejEv && typeof rejEv === 'object' && 'reason' in rejEv ? rejEv.reason : ev;
      logEvent('error', 'window', formatLogArg(reason));
    });
  }

  logEvent('info', 'app', `app start v${APP_VERSION}`);
}

export function collectDeviceInfo(targetWin?: unknown): DeviceInfo {
  try {
    const win = (
      targetWin !== undefined
        ? targetWin
        : typeof window !== 'undefined'
          ? window
          : undefined
    ) as LogWindow | undefined;
    const nav = win?.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    const doc = win?.document ?? (typeof document !== 'undefined' ? (document as unknown as LogWindow['document']) : undefined);

    const platform = getPlatform(win as Parameters<typeof getPlatform>[0]);
    const userAgent = typeof nav?.userAgent === 'string' ? nav.userAgent : '';
    const w = typeof win?.innerWidth === 'number' ? win.innerWidth : 0;
    const h = typeof win?.innerHeight === 'number' ? win.innerHeight : 0;
    const dpr = typeof win?.devicePixelRatio === 'number' ? win.devicePixelRatio : 1;
    const screen = `${w}x${h}@${dpr}`;
    const language = typeof nav?.language === 'string' ? nav.language : '';

    let theme: 'light' | 'dark' = 'light';
    const dataTheme =
      doc?.documentElement?.getAttribute?.('data-theme') ?? doc?.documentElement?.dataset?.theme;
    if (dataTheme === 'dark') {
      theme = 'dark';
    } else if (dataTheme === 'light') {
      theme = 'light';
    } else if (doc?.documentElement?.classList?.contains?.('dark')) {
      theme = 'dark';
    } else if (win?.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
      theme = 'dark';
    }

    const online = typeof nav?.onLine === 'boolean' ? nav.onLine : true;

    return {
      platform,
      userAgent,
      screen,
      language,
      theme,
      online,
    };
  } catch {
    return {
      platform: 'web',
      userAgent: '',
      screen: '0x0@1',
      language: '',
      theme: 'light',
      online: true,
    };
  }
}

export interface BuildReportDeps {
  window?: unknown;
  now?: () => number;
}

export async function buildReport(deps?: BuildReportDeps): Promise<DiagnosticReport> {
  const win = (
    deps && 'window' in deps
      ? deps.window
      : typeof window !== 'undefined'
        ? window
        : undefined
  ) as LogWindow | undefined;

  const platform = getPlatform(win as Parameters<typeof getPlatform>[0]);
  const device = collectDeviceInfo(win);
  let nativeLog: string | undefined;

  if (platform === 'android' && typeof win?.AndroidBridge?.getNativeLog === 'function') {
    try {
      const raw = win.AndroidBridge.getNativeLog();
      if (typeof raw === 'string' && raw.length > 0) {
        nativeLog = redactText(raw, 64000);
      }
    } catch {
      // Ignore native log errors
    }
  } else if (platform === 'desktop' && typeof win?.pywebview?.api?.get_log === 'function') {
    try {
      const raw = await win.pywebview.api.get_log();
      if (typeof raw === 'string' && raw.length > 0) {
        nativeLog = redactText(raw, 64000);
      }
    } catch {
      // Ignore native log errors
    }
  }

  const report: DiagnosticReport = {
    app: 'uku-furigana',
    version: APP_VERSION,
    platform,
    distribution: DISTRIBUTION,
    device,
    entries: getEntries(),
  };

  if (nativeLog !== undefined) {
    report.nativeLog = nativeLog;
  }

  return report;
}
