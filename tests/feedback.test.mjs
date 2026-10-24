import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const {
  FEEDBACK_LAST_KEY,
  FEEDBACK_CLIENT_ID_KEY,
  getClientId,
  MAX_FEEDBACK_BYTES,
  validateFeedback,
  buildFeedbackPayload,
  submitFeedback,
} = loadTypescript('../app/utils/feedback.ts');

function makeReport(entryCount = 2, msgLen = 20, nativeLog = undefined) {
  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    entries.push({
      t: 1000 + i,
      level: 'info',
      source: 'test',
      message: `entry-${i}-${'a'.repeat(msgLen)}`,
    });
  }
  const report = {
    app: 'uku-furigana',
    version: '1.2.1',
    platform: 'web',
    distribution: 'website',
    device: {
      platform: 'web',
      userAgent: 'TestAgent',
      screen: '1280x720@1',
      language: 'zh-CN',
      theme: 'light',
      online: true,
    },
    entries,
  };
  if (nativeLog !== undefined) {
    report.nativeLog = nativeLog;
  }
  return report;
}

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

test('validateFeedback checks required fields, lengths, log requirement, and 60KB size limit', () => {
  const report = makeReport(2, 10);

  assert.equal(
    validateFeedback({
      kind: 'log',
      includeLog: true,
      log: report,
    }),
    null,
  );

  assert.equal(
    validateFeedback({
      kind: 'text',
      title: 'Export DOCX failed',
      message: 'Clicked export and nothing happened',
      contact: 'qq:123456',
      includeLog: false,
    }),
    null,
  );

  // text requires title 1..80
  assert.equal(validateFeedback({ kind: 'text', includeLog: false }), 'invalid');
  assert.equal(validateFeedback({ kind: 'text', title: '   ', includeLog: false }), 'invalid');
  assert.equal(validateFeedback({ kind: 'text', title: 'x'.repeat(81), includeLog: false }), 'invalid');

  // message <= 4000, contact <= 80
  assert.equal(
    validateFeedback({ kind: 'text', title: 'ok', message: 'm'.repeat(4001), includeLog: false }),
    'invalid',
  );
  assert.equal(
    validateFeedback({ kind: 'text', title: 'ok', contact: 'c'.repeat(81), includeLog: false }),
    'invalid',
  );

  // includeLog: true requires log
  assert.equal(validateFeedback({ kind: 'log', includeLog: true }), 'invalid');

  // > 60KB returns too-large
  const hugeReport = makeReport(1, 10, 'n'.repeat(62_000));
  assert.equal(
    validateFeedback({ kind: 'log', includeLog: true, log: hugeReport }),
    'too-large',
  );
});

test('buildFeedbackPayload trims fields, omits blank strings, and drops oldest entries from head to fit 60KB', () => {
  const trimmed = buildFeedbackPayload({
    kind: 'text',
    title: '  Title with spaces  ',
    message: '   ',
    contact: '  user@example.com ',
    includeLog: false,
  });

  assert.equal(trimmed.title, 'Title with spaces');
  assert.equal('message' in trimmed, false);
  assert.equal(trimmed.contact, 'user@example.com');
  assert.equal('log' in trimmed, false);

  const bigReport = makeReport(200, 400);
  const originalLength = bigReport.entries.length;
  const payload = buildFeedbackPayload(
    { kind: 'log', message: '  crash report  ', includeLog: true },
    bigReport,
  );

  // Original report is not mutated
  assert.equal(bigReport.entries.length, originalLength);
  assert.ok(payload.log.entries.length < originalLength);
  assert.ok(payload.log.entries.length > 0);
  // Oldest entries were dropped from the head; newest entry is preserved at the tail
  assert.match(payload.log.entries.at(-1).message, /^entry-199-/);
  assert.ok(new TextEncoder().encode(JSON.stringify(payload)).byteLength <= MAX_FEEDBACK_BYTES);
  assert.equal(validateFeedback(payload), null);
});

test('submitFeedback maps HTTP status codes and network errors accurately', async () => {
  const payload = buildFeedbackPayload({
    kind: 'text',
    title: 'Valid issue',
    includeLog: false,
  });

  const checkStatus = async (status, body, expected) => {
    const res = await submitFeedback(payload, {
      storage: createFakeStorage(),
      fetch: async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }),
    });
    assert.deepEqual(res, expected);
  };

  await checkStatus(
    200,
    { ok: true, number: 88, url: 'https://github.com/Cheese-nya/uku-furigana/issues/88' },
    { ok: true, number: 88, url: 'https://github.com/Cheese-nya/uku-furigana/issues/88' },
  );
  await checkStatus(429, {}, { ok: false, error: 'rate-limited' });
  await checkStatus(413, {}, { ok: false, error: 'too-large' });
  await checkStatus(400, {}, { ok: false, error: 'invalid' });
  await checkStatus(502, {}, { ok: false, error: 'server' });

  const netErr = await submitFeedback(payload, {
    storage: createFakeStorage(),
    fetch: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  assert.deepEqual(netErr, { ok: false, error: 'network' });
});

test('submitFeedback enforces 30-second client cooldown via uku.feedback.last', async () => {
  const storage = createFakeStorage();
  let now = 1_000_000;
  let fetchCalls = 0;

  const payload = buildFeedbackPayload({
    kind: 'text',
    title: 'Cooldown test',
    includeLog: false,
  });

  const fakeFetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, number: fetchCalls, url: `https://example.com/${fetchCalls}` }),
    };
  };

  const first = await submitFeedback(payload, {
    fetch: fakeFetch,
    now: () => now,
    storage,
  });
  assert.equal(first.ok, true);
  assert.equal(fetchCalls, 1);
  assert.equal(storage.getItem(FEEDBACK_LAST_KEY), '1000000');

  // 15s later: blocked by client cooldown without hitting network
  now += 15_000;
  const second = await submitFeedback(payload, {
    fetch: fakeFetch,
    now: () => now,
    storage,
  });
  assert.deepEqual(second, { ok: false, error: 'rate-limited' });
  assert.equal(fetchCalls, 1);

  // 30s after first submission: allowed again
  now += 15_000;
  const third = await submitFeedback(payload, {
    fetch: fakeFetch,
    now: () => now,
    storage,
  });
  assert.equal(third.ok, true);
  assert.equal(fetchCalls, 2);
});

test('submitFeedback aborts and returns network error on timeout', async () => {
  const payload = buildFeedbackPayload({
    kind: 'text',
    title: 'Timeout test',
    includeLog: false,
  });

  let capturedSignal = null;
  const neverFetch = (_url, init) => {
    capturedSignal = init?.signal;
    return new Promise(() => {});
  };

  const result = await submitFeedback(payload, {
    fetch: neverFetch,
    storage: createFakeStorage(),
    timeoutMs: 20,
  });

  assert.deepEqual(result, { ok: false, error: 'network' });
  assert.equal(capturedSignal?.aborted, true);
});

test('the relay rate-limits on a persisted random client id, not an IP', async () => {
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const first = getClientId(storage);
  assert.match(first, /^[A-Za-z0-9-]{16,64}$/);
  assert.equal(getClientId(storage), first);
  assert.equal(store.get(FEEDBACK_CLIENT_ID_KEY), first);

  let sent;
  const fetch = async (_url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ ok: true, number: 7, url: 'https://x/7' }) }; };
  const result = await submitFeedback({ kind: 'text', title: 't', message: 'm', includeLog: false }, { fetch, storage, now: () => 1e12 });
  assert.equal(result.ok, true);
  assert.equal(sent.clientId, first);
});
