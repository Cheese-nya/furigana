import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const path = relativePath => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
const read = relativePath => readFileSync(path(relativePath), 'utf8');
const pngSize = relativePath => {
  const bytes = readFileSync(path(relativePath));
  assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${relativePath} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

test('launcher icons exist at every density with the expected pixel size', () => {
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(sizes)) {
    assert.deepEqual(pngSize(`android/res/mipmap-${density}/ic_launcher.png`), { width: size, height: size }, density);
  }
});

test('the adaptive icon (Android 8+) has a 108dp foreground and a background colour', () => {
  assert.deepEqual(pngSize('android/res/mipmap-xxxhdpi/ic_launcher_foreground.png'), { width: 432, height: 432 });
  const xml = read('android/res/mipmap-anydpi-v26/ic_launcher.xml');
  assert.match(xml, /<background android:drawable="@color\/ic_launcher_background"/);
  assert.match(xml, /<foreground android:drawable="@mipmap\/ic_launcher_foreground"/);
  assert.match(read('android/res/values/ic_launcher_background.xml'), /name="ic_launcher_background"/);
  assert.match(read('android/AndroidManifest.xml'), /android:icon="@mipmap\/ic_launcher"/);
});

test('the APK build never regenerates the icon or falls back to a promo image', () => {
  // A previous build used PIL and silently copied public/promo-1x1.png when PIL was missing (as on CI).
  const script = read('scripts/build-apk.sh');
  assert.doesNotMatch(script, /promo-1x1/);
  assert.doesNotMatch(script, /PIL/);
  assert.doesNotMatch(script, /ic_launcher\.png/);
});
