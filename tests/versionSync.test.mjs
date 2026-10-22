import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// package.json 是唯一的版本来源；各平台工程里的版本号必须与它一致。
const read = relativePath => readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');

const version = JSON.parse(read('package.json')).version;

test('package-lock.json root matches package.json', () => {
  const lock = JSON.parse(read('package-lock.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
});

test('Android versionName matches package.json', () => {
  const match = read('android/AndroidManifest.xml').match(/android:versionName="([^"]+)"/);
  assert.ok(match, 'AndroidManifest.xml must declare android:versionName');
  assert.equal(match[1], version);
});

test('every iOS MARKETING_VERSION matches package.json', () => {
  const versions = [...read('ios/App/App.xcodeproj/project.pbxproj').matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1]);
  assert.ok(versions.length > 0, 'project.pbxproj must declare MARKETING_VERSION');
  for (const v of versions) assert.equal(v, version);
});
