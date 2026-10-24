import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from './loadTypescript.mjs';

const { registerBackHandler, setNavigationBack, handleBack, installBackBridge } = loadTypescript('../app/utils/backStack.ts');

beforeEach(() => setNavigationBack(null));

test('overlays are closed newest-first before any screen navigation happens', () => {
  const calls = [];
  setNavigationBack(() => { calls.push('navigate'); return true; });
  const offSheet = registerBackHandler(() => calls.push('sheet'));
  const offPopover = registerBackHandler(() => calls.push('popover'));
  assert.equal(handleBack(), true);
  assert.deepEqual(calls, ['popover']);
  offPopover();
  assert.equal(handleBack(), true);
  assert.deepEqual(calls, ['popover', 'sheet']);
  offSheet();
  assert.equal(handleBack(), true);
  assert.deepEqual(calls, ['popover', 'sheet', 'navigate']);
});

test('with nothing to close or go back to, handleBack is false so the shell can exit', () => {
  assert.equal(handleBack(), false);
  setNavigationBack(() => false);
  assert.equal(handleBack(), false);
});

test('an unregistered handler is not called, and unregistering twice is harmless', () => {
  let called = 0;
  const off = registerBackHandler(() => { called += 1; });
  off();
  off();
  assert.equal(handleBack(), false);
  assert.equal(called, 0);
});

test('the bridge exposes handleBack to the Android shell and removes only its own hook', () => {
  const target = {};
  const remove = installBackBridge(target);
  assert.equal(target.__ukuBack(), false);
  setNavigationBack(() => true);
  assert.equal(target.__ukuBack(), true);
  remove();
  assert.equal('__ukuBack' in target, false);
  const other = () => true;
  target.__ukuBack = other;
  remove();
  assert.equal(target.__ukuBack, other);
});

test('MainActivity asks the page before leaving the app on back', () => {
  const source = readFileSync(fileURLToPath(new URL('../android/src/com/cheese/uku/MainActivity.java', import.meta.url)), 'utf8');
  assert.match(source, /window\.__ukuBack/);
  assert.match(source, /MainActivity\.super\.onBackPressed\(\)/);
});
