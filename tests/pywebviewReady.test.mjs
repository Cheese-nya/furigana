import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const { waitForPywebviewApi } = loadTypescript('../app/utils/pywebviewReady.ts');

function fakeWindow() {
  const listeners = new Map();
  return {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    fire: name => listeners.get(name)?.(),
    count: () => listeners.size,
  };
}

test('does not wait when the api methods are already there', async () => {
  const win = fakeWindow();
  await waitForPywebviewApi(win, () => true);
  assert.equal(win.count(), 0);
});

test('waits through the empty-api window until pywebviewready', async () => {
  const win = fakeWindow();
  let ready = false;
  const pending = waitForPywebviewApi(win, () => ready, 5000);
  let settled = false;
  pending.then(() => { settled = true; });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(settled, false);
  ready = true;
  win.fire('pywebviewready');
  await pending;
  assert.equal(win.count(), 0);
});

test('gives up after the timeout so an outdated shell still gets its error', async () => {
  const win = fakeWindow();
  await waitForPywebviewApi(win, () => false, 30);
  assert.equal(win.count(), 0);
});
