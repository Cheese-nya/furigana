import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const {
  AUTO_CHECK_INTERVAL_MS,
  compareVersions,
  selectAsset,
  fetchLatestRelease,
  shouldAutoCheck,
  createAndroidDriver,
  createDesktopDriver,
  createManualDriver,
  pickDriver,
  createUpdateController,
} = loadTypescript('../app/utils/updater.ts');

const { clearEntries, getEntries } = loadTypescript('../app/utils/appLog.ts');

function createFakeStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
  };
}

const SAMPLE_APK_HASH = 'a'.repeat(64);
const SAMPLE_EXE_HASH = 'b'.repeat(64);

const SAMPLE_RELEASE = {
  version: '1.3.0',
  tag: 'v1.3.0',
  notes: 'Release 1.3.0 notes',
  assets: [
    {
      name: 'Uku-Furigana-v1.3.0.apk',
      size: 12_345_678,
      url: 'https://github.com/Cheese-nya/uku-furigana/releases/download/v1.3.0/Uku-Furigana-v1.3.0.apk',
      mirrorUrl: 'https://uku.saiaino.xyz/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0.apk',
      sha256: SAMPLE_APK_HASH,
    },
    {
      name: 'Uku-Furigana-v1.3.0-windows.exe',
      size: 45_678_901,
      url: 'https://github.com/Cheese-nya/uku-furigana/releases/download/v1.3.0/Uku-Furigana-v1.3.0-windows.exe',
      mirrorUrl: 'https://uku.saiaino.xyz/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0-windows.exe',
      sha256: SAMPLE_EXE_HASH,
    },
  ],
};

test('compareVersions compares dotted numeric segments with optional v prefix and fallbacks', () => {
  assert.equal(compareVersions('1.2.1', '1.2.1'), 0);
  assert.equal(compareVersions('v1.3.0', '1.2.9'), 1);
  assert.equal(compareVersions('1.2.1', 'V1.2.2'), -1);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.equal(compareVersions('1.2.alpha', '1.2.0'), 0);
  assert.equal(compareVersions('2.0', '1.9.9'), 1);
  assert.equal(compareVersions('0.9.9', '1.0.0'), -1);
});

test('selectAsset picks .apk for android, -windows.exe for desktop, and undefined otherwise', () => {
  assert.equal(selectAsset(SAMPLE_RELEASE, 'android')?.name, 'Uku-Furigana-v1.3.0.apk');
  assert.equal(selectAsset(SAMPLE_RELEASE, 'desktop')?.name, 'Uku-Furigana-v1.3.0-windows.exe');
  assert.equal(selectAsset(SAMPLE_RELEASE, 'ios'), undefined);
  assert.equal(selectAsset(SAMPLE_RELEASE, 'web'), undefined);
});

test('fetchLatestRelease succeeds via GitHub direct, falls back to relay on failure, and throws if both fail', async () => {
  const sumsContent = [
    `${SAMPLE_APK_HASH}  Uku-Furigana-v1.3.0.apk`,
    `${SAMPLE_EXE_HASH} *Uku-Furigana-v1.3.0-windows.exe`,
    `${'c'.repeat(64)}  Uku-Furigana-web-v1.3.0.zip`,
  ].join('\n');

  const directFetch = async url => {
    if (url.includes('api.github.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.3.0',
          body: 'Direct GitHub notes',
          assets: [
            {
              name: 'Uku-Furigana-v1.3.0.apk',
              size: 100,
              browser_download_url: 'https://gh.example/Uku-Furigana-v1.3.0.apk',
            },
            {
              name: 'Uku-Furigana-v1.3.0-windows.exe',
              size: 200,
              browser_download_url: 'https://gh.example/Uku-Furigana-v1.3.0-windows.exe',
            },
            {
              name: 'Uku-Furigana-web-v1.3.0.zip',
              size: 50,
              browser_download_url: 'https://gh.example/Uku-Furigana-web-v1.3.0.zip',
            },
            {
              name: 'SHA256SUMS.txt',
              size: 120,
              browser_download_url: 'https://gh.example/SHA256SUMS.txt',
            },
          ],
        }),
      };
    }
    if (url === 'https://gh.example/SHA256SUMS.txt') {
      return {
        ok: true,
        status: 200,
        text: async () => sumsContent,
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const directResult = await fetchLatestRelease({ fetch: directFetch });
  assert.equal(directResult.version, '1.3.0');
  assert.equal(directResult.tag, 'v1.3.0');
  assert.equal(directResult.notes, 'Direct GitHub notes');
  assert.equal(directResult.assets.length, 2);
  assert.deepEqual(directResult.assets[0], {
    name: 'Uku-Furigana-v1.3.0.apk',
    size: 100,
    url: 'https://gh.example/Uku-Furigana-v1.3.0.apk',
    mirrorUrl: 'https://uku.saiaino.xyz/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0.apk',
    sha256: SAMPLE_APK_HASH,
  });

  // GitHub missing SHA256SUMS.txt -> falls back to relay
  let relayCalled = false;
  const fallbackFetch = async url => {
    if (url.includes('api.github.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.3.0',
          body: 'No sums asset',
          assets: [
            {
              name: 'Uku-Furigana-v1.3.0.apk',
              size: 100,
              browser_download_url: 'https://gh.example/Uku-Furigana-v1.3.0.apk',
            },
          ],
        }),
      };
    }
    if (url.endsWith('/api/update/latest')) {
      relayCalled = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          version: '1.3.0',
          tag: 'v1.3.0',
          notes: 'Relay notes',
          sums: { 'Uku-Furigana-v1.3.0.apk': SAMPLE_APK_HASH },
          assets: [
            {
              name: 'Uku-Furigana-v1.3.0.apk',
              size: 100,
              url: 'https://gh.example/Uku-Furigana-v1.3.0.apk',
              mirrorUrl: 'https://uku.saiaino.xyz/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0.apk',
            },
          ],
        }),
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const relayResult = await fetchLatestRelease({ fetch: fallbackFetch });
  assert.equal(relayCalled, true);
  assert.equal(relayResult.notes, 'Relay notes');
  assert.equal(relayResult.assets[0].sha256, SAMPLE_APK_HASH);

  // Both fail -> throws Error
  await assert.rejects(
    fetchLatestRelease({
      fetch: async () => ({ ok: false, status: 503 }),
    }),
    /Failed to fetch latest release/,
  );
});

test('shouldAutoCheck returns true when null or >= 6 hours elapsed', () => {
  assert.equal(shouldAutoCheck(null, 1000), true);
  assert.equal(shouldAutoCheck(1000, 1000 + AUTO_CHECK_INTERVAL_MS - 1), false);
  assert.equal(shouldAutoCheck(1000, 1000 + AUTO_CHECK_INTERVAL_MS), true);
});

test('pickDriver chooses Android, Desktop, or Manual driver depending on distribution, platform, and bridge', () => {
  const androidWin = {
    AndroidBridge: {
      startUpdateDownload: () => '{"success":true}',
      getUpdateState: () => '{"phase":"idle","progress":0}',
      installUpdate: () => '{"success":true}',
      cancelUpdateDownload: () => '{"success":true}',
    },
  };
  const desktopWin = {
    pywebview: {
      api: {
        update_download: async () => ({ success: true }),
        update_state: async () => ({ phase: 'idle', progress: 0 }),
        update_apply: async () => ({ success: true }),
        update_cancel: async () => ({ success: true }),
      },
    },
  };

  assert.equal(pickDriver({ window: androidWin, distribution: 'website' }).canAutoDownload, true);
  assert.equal(pickDriver({ window: desktopWin, distribution: 'website' }).canAutoDownload, true);
  assert.equal(pickDriver({ window: androidWin, distribution: 'play' }).canAutoDownload, false);
  assert.equal(pickDriver({ window: desktopWin, distribution: 'appstore' }).canAutoDownload, false);
  assert.equal(pickDriver({ window: {}, platform: 'ios', distribution: 'website' }).canAutoDownload, false);
  assert.equal(pickDriver({ window: {}, platform: 'web', distribution: 'website' }).canAutoDownload, false);
  assert.equal(pickDriver({ window: { AndroidBridge: {} }, platform: 'android' }).canAutoDownload, false);
});

test('Android, Desktop, and Manual drivers round-trip bridge calls and handle errors', async () => {
  const calls = [];
  let nextStateRaw = '{"phase":"downloading","progress":0.42,"version":"1.3.0"}';

  const androidBridge = {
    startUpdateDownload(jsonStr) {
      calls.push(['start', JSON.parse(jsonStr)]);
      return '{"success":true}';
    },
    getUpdateState() {
      return nextStateRaw;
    },
    installUpdate() {
      calls.push(['install']);
      return '{"success":true}';
    },
    cancelUpdateDownload() {
      calls.push(['cancel']);
      return '{"success":true}';
    },
  };

  const androidDriver = createAndroidDriver(androidBridge, { wifiOnly: true });
  await androidDriver.start(SAMPLE_RELEASE, SAMPLE_RELEASE.assets[0]);
  assert.deepEqual(calls[0], [
    'start',
    {
      version: '1.3.0',
      url: SAMPLE_RELEASE.assets[0].url,
      mirrorUrl: SAMPLE_RELEASE.assets[0].mirrorUrl,
      sha256: SAMPLE_APK_HASH,
      size: 12_345_678,
      wifiOnly: true,
    },
  ]);

  assert.deepEqual(await androidDriver.poll(), {
    phase: 'downloading',
    progress: 0.42,
    version: '1.3.0',
    error: undefined,
  });

  nextStateRaw = 'not-valid-json';
  const badPoll = await androidDriver.poll();
  assert.equal(badPoll.phase, 'error');

  await androidDriver.apply();
  await androidDriver.cancel();
  assert.deepEqual(calls.slice(1), [['install'], ['cancel']]);

  // Desktop driver
  const desktopCalls = [];
  const desktopApi = {
    async update_download(args) {
      desktopCalls.push(['download', args]);
      return { success: true };
    },
    async update_state() {
      return { phase: 'ready', progress: 1, version: '1.3.0' };
    },
    async update_apply() {
      desktopCalls.push(['apply']);
      return { success: true };
    },
    async update_cancel() {
      desktopCalls.push(['cancel']);
      return { success: true };
    },
  };

  const desktopDriver = createDesktopDriver(desktopApi);
  await desktopDriver.start(SAMPLE_RELEASE, SAMPLE_RELEASE.assets[1]);
  assert.equal(desktopCalls[0][0], 'download');
  assert.equal(desktopCalls[0][1].version, '1.3.0');
  assert.equal(desktopCalls[0][1].sha256, SAMPLE_EXE_HASH);
  assert.deepEqual(await desktopDriver.poll(), {
    phase: 'ready',
    progress: 1,
    version: '1.3.0',
    error: undefined,
  });
  await desktopDriver.apply();
  await desktopDriver.cancel();
  assert.deepEqual(desktopCalls.slice(1), [['apply'], ['cancel']]);

  // Manual driver
  const manual = createManualDriver();
  assert.equal(manual.canAutoDownload, false);
  await assert.rejects(manual.start(SAMPLE_RELEASE, SAMPLE_RELEASE.assets[0]), /manual only/);
  await assert.rejects(manual.poll(), /manual only/);
  await assert.rejects(manual.apply(), /manual only/);
  await assert.rejects(manual.cancel(), /manual only/);
});

test('createUpdateController flows from available -> auto download -> polling -> ready', async () => {
  clearEntries();
  const storage = createFakeStorage();
  const pollResponses = [
    { phase: 'downloading', progress: 0.5, version: '1.3.0' },
    { phase: 'ready', progress: 1, version: '1.3.0' },
  ];
  let pollCount = 0;
  let startedAsset = null;

  const fakeDriver = {
    canAutoDownload: true,
    async start(_rel, asset) {
      startedAsset = asset;
    },
    async poll() {
      const resp = pollResponses[Math.min(pollCount, pollResponses.length - 1)];
      pollCount += 1;
      return resp;
    },
    async apply() {},
    async cancel() {},
  };

  const observedStatuses = [];
  const readyPromise = new Promise(resolve => {
    const ctrl = createUpdateController({
      driver: fakeDriver,
      currentVersion: '1.2.1',
      platform: 'android',
      fetchRelease: async () => SAMPLE_RELEASE,
      storage,
      now: () => 50_000,
      pollMs: 10,
    });

    ctrl.subscribe(st => {
      observedStatuses.push(st.status);
      if (st.status === 'ready') {
        resolve(ctrl);
      }
    });

    void ctrl.check({ auto: true });
  });

  const ctrl = await readyPromise;
  const finalState = ctrl.getState();
  assert.equal(startedAsset?.name, 'Uku-Furigana-v1.3.0.apk');
  assert.equal(finalState.status, 'ready');
  assert.equal(finalState.progress, 1);
  assert.equal(finalState.hasUpdate, true);
  assert.equal(finalState.manualOnly, false);
  assert.ok(observedStatuses.includes('checking'));
  assert.ok(observedStatuses.includes('available'));
  assert.ok(observedStatuses.includes('downloading'));
  assert.equal(observedStatuses.at(-1), 'ready');
  ctrl.dispose();
});

test('createUpdateController handles up-to-date, dismiss, force override, auto throttle, and silent auto errors', async () => {
  clearEntries();
  const storage = createFakeStorage();
  let now = 100_000;
  let fetchCalls = 0;

  // 1. Up-to-date when currentVersion >= latest
  const upToDateCtrl = createUpdateController({
    driver: createManualDriver(),
    currentVersion: '1.3.0',
    platform: 'web',
    fetchRelease: async () => SAMPLE_RELEASE,
    storage,
    now: () => now,
  });
  await upToDateCtrl.check();
  assert.equal(upToDateCtrl.getState().status, 'up-to-date');
  assert.equal(upToDateCtrl.getState().hasUpdate, false);
  upToDateCtrl.dispose();

  // 2. ManualOnly new version -> available without downloading, then dismiss -> up-to-date, then force -> available
  const ctrl = createUpdateController({
    driver: createManualDriver(),
    currentVersion: '1.2.1',
    platform: 'web',
    fetchRelease: async () => {
      fetchCalls += 1;
      return SAMPLE_RELEASE;
    },
    storage: createFakeStorage(),
    now: () => now,
  });

  await ctrl.check({ auto: true });
  assert.equal(fetchCalls, 1);
  assert.equal(ctrl.getState().status, 'available');
  assert.equal(ctrl.getState().manualOnly, true);
  assert.equal(ctrl.getState().hasUpdate, true);

  // Auto-check throttled within 6 hours
  now += 1000;
  await ctrl.check({ auto: true });
  assert.equal(fetchCalls, 1);

  // Dismiss hides update and persists dismissed version
  ctrl.dismiss();
  assert.equal(ctrl.getState().status, 'up-to-date');
  assert.equal(ctrl.getState().hasUpdate, false);

  // Non-force check respects dismissed version
  await ctrl.check();
  assert.equal(ctrl.getState().status, 'up-to-date');
  assert.equal(ctrl.getState().hasUpdate, false);

  // Force check ignores dismissed version
  await ctrl.check({ force: true });
  assert.equal(ctrl.getState().status, 'available');
  assert.equal(ctrl.getState().hasUpdate, true);
  ctrl.dispose();

  // 3. Auto check failure restores previous status silently (logs warning), manual check failure enters error state
  clearEntries();
  const errCtrl = createUpdateController({
    driver: createManualDriver(),
    currentVersion: '1.2.1',
    platform: 'web',
    fetchRelease: async () => {
      throw new Error('Offline');
    },
    storage: createFakeStorage(),
    now: () => now,
  });

  await errCtrl.check({ auto: true });
  assert.equal(errCtrl.getState().status, 'idle');
  assert.equal(errCtrl.getState().hasUpdate, false);
  assert.ok(getEntries().some(e => e.source === 'update' && e.level === 'warn'));

  await errCtrl.check();
  assert.equal(errCtrl.getState().status, 'error');
  assert.match(errCtrl.getState().error ?? '', /Offline/);
  errCtrl.dispose();
});
