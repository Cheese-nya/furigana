import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const { lineProgressPercent } = loadTypescript('../app/utils/libraryDatabase.ts');

test('reading progress follows the line the reader is on, not the chapter count', () => {
  assert.equal(lineProgressPercent(0, 200), 0);
  assert.equal(lineProgressPercent(100, 201), 50);
  assert.equal(lineProgressPercent(199, 200), 100);
  assert.equal(lineProgressPercent(50, 101), 50);
});

test('progress stays within 0-100 and survives degenerate input', () => {
  assert.equal(lineProgressPercent(500, 200), 100);
  assert.equal(lineProgressPercent(-3, 200), 0);
  assert.equal(lineProgressPercent(0, 1), 100);
  assert.equal(lineProgressPercent(0, 0), 0);
  assert.equal(lineProgressPercent(Number.NaN, 10), 0);
});
