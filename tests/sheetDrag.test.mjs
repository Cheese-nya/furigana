import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';

const { dragOffset, shouldDismiss, dragProgress } = loadTypescript('../app/utils/sheetDrag.ts');

test('the sheet follows the finger down and resists being pulled up', () => {
  assert.equal(dragOffset(0), 0);
  assert.equal(dragOffset(120), 120);
  assert.ok(dragOffset(-10) < 0 && dragOffset(-10) > -28);
  assert.equal(dragOffset(-100000), -28);
  assert.equal(dragOffset(Number.NaN), 0);
});

test('a long drag closes the sheet, a short one springs back', () => {
  assert.equal(shouldDismiss({ offset: 200, velocity: 0, height: 600 }), true);
  assert.equal(shouldDismiss({ offset: 60, velocity: 0, height: 600 }), false);
  // never asks for more than 160px, however tall the sheet is
  assert.equal(shouldDismiss({ offset: 160, velocity: 0, height: 2000 }), true);
  // small sheets still need a minimum drag
  assert.equal(shouldDismiss({ offset: 50, velocity: 0, height: 120 }), false);
});

test('a quick downward flick closes it even after a short distance, an upward one never does', () => {
  assert.equal(shouldDismiss({ offset: 40, velocity: 0.8, height: 600 }), true);
  assert.equal(shouldDismiss({ offset: 10, velocity: 0.8, height: 600 }), false);
  assert.equal(shouldDismiss({ offset: -20, velocity: 2, height: 600 }), false);
  assert.equal(shouldDismiss({ offset: 0, velocity: 2, height: 600 }), false);
});

test('backdrop progress is clamped to 0..1', () => {
  assert.equal(dragProgress(0, 600), 0);
  assert.equal(dragProgress(300, 600), 0.5);
  assert.equal(dragProgress(900, 600), 1);
  assert.equal(dragProgress(-5, 600), 0);
  assert.equal(dragProgress(5, 0), 0);
});
