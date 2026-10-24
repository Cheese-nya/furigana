import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const { getPlatform } = loadTypescript('../app/utils/appInfo.ts');

test('the platform is known before pywebview has attached, from the desktop=1 launch URL', () => {
  assert.equal(getPlatform({ location: { search: '?desktop=1' } }), 'desktop');
  assert.equal(getPlatform({ location: { search: '?x=1&desktop=1' } }), 'desktop');
  assert.equal(getPlatform({ pywebview: {} }), 'desktop');
  assert.equal(getPlatform({ location: { search: '?desktop=10' } }), 'web');
  assert.equal(getPlatform({ location: { search: '' } }), 'web');
  assert.equal(getPlatform({ AndroidBridge: {}, location: { search: '?desktop=1' } }), 'android');
  assert.equal(getPlatform(undefined), 'web');
});
