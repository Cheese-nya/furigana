import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadTypescript } from './loadTypescript.mjs';
const { saveBlob } = loadTypescript('../app/utils/fileSave.ts');
const originalWindow = globalThis.window;
const originalReader = globalThis.FileReader;
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalReader === undefined) delete globalThis.FileReader;
  else globalThis.FileReader = originalReader;
});

function nativeSave(result) {
  globalThis.FileReader = class {
    readAsDataURL() { this.result = 'data:text/plain;base64,44GC'; this.onload(); }
  };
  globalThis.window = { pywebview: { api: { save_file: async () => result } },
    showSaveFilePicker: () => assert.fail('must not fall through to another save method') };
}

test('native cancellation remains cancellation; write failures are reported', async () => {
  nativeSave({ success: false, error: 'Cancelled' });
  assert.deepEqual(await saveBlob(new Blob(['あ']), '台本.txt'), { success: false });
  nativeSave({ success: false, error: 'Disk full' });
  await assert.rejects(saveBlob(new Blob(['あ']), '台本.txt'), /Disk full/);
  nativeSave({ success: true, path: '台本.txt' });
  assert.deepEqual(await saveBlob(new Blob(['あ']), '台本.txt'), { success: true, path: '台本.txt' });
});

test('browser picker cancellation differs from a failed write', async () => {
  globalThis.window = { showSaveFilePicker: async () => { throw new DOMException('cancel', 'AbortError'); } };
  assert.deepEqual(await saveBlob(new Blob(), '台本.txt'), { success: false });
  globalThis.window = { showSaveFilePicker: async () => ({ createWritable: async () => ({
    write: async () => { throw new Error('Permission denied'); }, close: async () => {},
  }) }) };
  await assert.rejects(saveBlob(new Blob(), '台本.txt'), /Permission denied/);
});

test('browser save only completes after closing the file', async () => {
  const operations = [];
  const blob = new Blob(['あ']);
  globalThis.window = { showSaveFilePicker: async () => ({ name: '台本.txt', createWritable: async () => ({
    write: async value => { assert.equal(value, blob); operations.push('write'); },
    close: async () => { operations.push('close'); },
  }) }) };
  assert.deepEqual(await saveBlob(blob, '台本.txt'), { success: true, path: '台本.txt' });
  assert.deepEqual(operations, ['write', 'close']);
});
