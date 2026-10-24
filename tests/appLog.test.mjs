import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const {
  LOG_STORAGE_KEY,
  redactText,
  logEvent,
  getEntries,
  clearEntries,
  installGlobalLogging,
  collectDeviceInfo,
  buildReport,
} = loadTypescript('../app/utils/appLog.ts');

const originalWindow = globalThis.window;
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalDateNow = Date.now;

function createFakeStorage() {
  const store = new Map();
  let setCalls = 0;
  return {
    store,
    get setCalls() {
      return setCalls;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      setCalls += 1;
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

afterEach(() => {
  clearEntries();
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  Date.now = originalDateNow;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test('redactText keeps 5 CJK/kana chars and redacts 6 or more consecutive CJK/kana chars', () => {
  assert.equal(redactText('あいうえお'), 'あいうえお');
  assert.equal(redactText('あいうえおか'), '[文本已隐去]');
  assert.equal(redactText('漢字テスト'), '漢字テスト');
  assert.equal(redactText('漢字テストあ'), '[文本已隐去]');
  assert.equal(
    redactText('Parse error near むかしむかしあるところに at line 3 (ok: 台本テスト)'),
    'Parse error near [文本已隐去] at line 3 (ok: 台本テスト)',
  );
});

test('redactText masks usernames in Linux, macOS, and Windows paths', () => {
  assert.equal(
    redactText('File not found: /home/cheese/project/furigana/out/index.html'),
    'File not found: /home/<user>/project/furigana/out/index.html',
  );
  assert.equal(
    redactText('Loaded from /Users/sakura/Documents/script.docx'),
    'Loaded from /Users/<user>/Documents/script.docx',
  );
  assert.equal(
    redactText('Traceback in C:\\Users\\Alice\\AppData\\Local\\Uku\\uku.log'),
    'Traceback in C:\\Users\\<user>\\AppData\\Local\\Uku\\uku.log',
  );
});

test('redactText truncates strings exceeding max and appends an ellipsis', () => {
  assert.equal(redactText('12345', 5), '12345');
  assert.equal(redactText('123456', 5), '12345…');
  const longText = 'x'.repeat(520);
  const redacted = redactText(longText);
  assert.equal(redacted.length, 501);
  assert.equal(redacted, `${'x'.repeat(500)}…`);
});

test('logEvent caps ring buffer at 500 entries and getEntries returns a defensive copy', () => {
  for (let i = 0; i < 510; i++) {
    logEvent('info', 'engine', `step-${i}`);
  }
  const entries = getEntries();
  assert.equal(entries.length, 500);
  assert.equal(entries[0].message, 'step-10');
  assert.equal(entries[499].message, 'step-509');

  entries[0].message = 'mutated';
  assert.equal(getEntries()[0].message, 'step-10');
});

test('logEvent throttles localStorage persistence to 2s (max 200 items) and installGlobalLogging restores them', () => {
  const storage = createFakeStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });

  let now = 100_000;
  Date.now = () => now;

  logEvent('info', 'init', 'msg-0');
  assert.equal(storage.setCalls, 1);

  // Within 2 seconds: throttled, no immediate write
  now += 500;
  logEvent('info', 'init', 'msg-1');
  assert.equal(storage.setCalls, 1);

  // Log 205 more entries, advancing past the 2-second throttle at the end
  for (let i = 2; i < 205; i++) {
    logEvent('info', 'init', `msg-${i}`);
  }
  now += 2500;
  logEvent('warn', 'init', 'msg-205');
  assert.equal(storage.setCalls, 2);

  const persisted = JSON.parse(storage.getItem(LOG_STORAGE_KEY));
  assert.equal(persisted.length, 200);
  assert.equal(persisted[0].message, 'msg-6');
  assert.equal(persisted[199].message, 'msg-205');

  // Clear in-memory entries and restore via installGlobalLogging
  clearEntries();
  assert.equal(getEntries().length, 0);

  const listeners = {};
  const forwardedErrors = [];
  const forwardedWarns = [];
  console.error = (...args) => forwardedErrors.push(args);
  console.warn = (...args) => forwardedWarns.push(args);

  globalThis.window = {
    localStorage: storage,
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };

  installGlobalLogging();
  // Calling a second time on the same window is a no-op
  installGlobalLogging();

  const restored = getEntries();
  assert.equal(restored.length, 201);
  assert.equal(restored[0].message, 'msg-6');
  assert.equal(restored[199].message, 'msg-205');
  assert.equal(restored[200].level, 'info');
  assert.match(restored[200].message, /^app start v/);

  console.error('Console failure', new Error('boom from /home/bob/index.js'));
  console.warn('Console warning', { code: 123, text: 'あいうえおかき' });
  listeners.error({ error: new Error('Uncaught window error') });
  listeners.unhandledrejection({ reason: 'Rejected promise 漢字かなカナ六文字' });

  assert.equal(forwardedErrors.length, 1);
  assert.equal(forwardedWarns.length, 1);

  const tail = getEntries().slice(-4);
  assert.equal(tail[0].source, 'console');
  assert.equal(tail[0].level, 'error');
  assert.match(tail[0].message, /\/home\/<user>\/index\.js/);

  assert.equal(tail[1].source, 'console');
  assert.equal(tail[1].level, 'warn');
  assert.match(tail[1].message, /\[文本已隐去\]/);

  assert.equal(tail[2].source, 'window');
  assert.equal(tail[2].level, 'error');
  assert.match(tail[2].message, /Uncaught window error/);

  assert.equal(tail[3].source, 'window');
  assert.equal(tail[3].level, 'error');
  assert.match(tail[3].message, /Rejected promise \[文本已隐去\]/);
});

test('buildReport gathers device info and redacts nativeLog across android, desktop, and web', async () => {
  logEvent('info', 'engine', 'kuromoji ready');

  const androidWin = {
    AndroidBridge: {
      getNativeLog: () => 'RenderGone at /home/u0_a123/cache: テストデータ文字列',
    },
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2.6,
    navigator: { userAgent: 'AndroidWebView', language: 'zh-CN', onLine: true },
    document: {
      documentElement: {
        getAttribute: name => (name === 'data-theme' ? 'dark' : null),
      },
    },
  };

  const androidReport = await buildReport({ window: androidWin });
  assert.equal(androidReport.app, 'uku-furigana');
  assert.equal(androidReport.platform, 'android');
  assert.equal(androidReport.device.screen, '412x915@2.6');
  assert.equal(androidReport.device.theme, 'dark');
  assert.equal(androidReport.nativeLog, 'RenderGone at /home/<user>/cache: [文本已隐去]');
  assert.equal(androidReport.entries.length, 1);

  const desktopWin = {
    pywebview: {
      api: {
        get_log: async () => 'ERROR C:\\Users\\Player\\AppData\\uku.log 漢字ひらがなカタカナ',
      },
    },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1.5,
    navigator: { userAgent: 'pywebview', language: 'en-US', onLine: false },
    matchMedia: query => ({ matches: query === '(prefers-color-scheme: dark)' }),
  };

  const desktopReport = await buildReport({ window: desktopWin });
  assert.equal(desktopReport.platform, 'desktop');
  assert.equal(desktopReport.device.screen, '1280x800@1.5');
  assert.equal(desktopReport.device.theme, 'dark');
  assert.equal(desktopReport.device.online, false);
  assert.equal(desktopReport.nativeLog, 'ERROR C:\\Users\\<user>\\AppData\\uku.log [文本已隐去]');

  const webWin = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    navigator: { userAgent: 'Mozilla/5.0', language: 'ja-JP', onLine: true },
  };
  const webReport = await buildReport({ window: webWin });
  assert.equal(webReport.platform, 'web');
  assert.equal(webReport.nativeLog, undefined);
  assert.equal(collectDeviceInfo(undefined).platform, 'web');
});
