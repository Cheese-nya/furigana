import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const manifestSource = readFileSync(
  fileURLToPath(new URL('../android/AndroidManifest.xml', import.meta.url)),
  'utf8',
);

const mainActivitySource = readFileSync(
  fileURLToPath(new URL('../android/src/com/cheese/furiganastudio/MainActivity.java', import.meta.url)),
  'utf8',
);

// onPermissionRequest 的方法体：从方法签名到 WebChromeClient 中下一个 @Override。
const permissionRequestBlock = (() => {
  const start = mainActivitySource.indexOf('public void onPermissionRequest');
  assert.notEqual(start, -1, 'MainActivity must override onPermissionRequest');
  const nextOverride = mainActivitySource.indexOf('@Override', start);
  return mainActivitySource.slice(start, nextOverride === -1 ? undefined : nextOverride);
})();

test('Android 清单不再声明麦克风 / 音频设置权限', () => {
  for (const forbidden of [
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.CAMERA',
  ]) {
    assert.equal(
      manifestSource.includes(forbidden),
      false,
      `AndroidManifest.xml 不应声明 ${forbidden}（朗读功能已移除，应用无麦克风 / 摄像头用途）`,
    );
  }
});

test('Android 清单保留网络权限', () => {
  assert.ok(
    manifestSource.includes('<uses-permission android:name="android.permission.INTERNET" />'),
    'AndroidManifest.xml 必须保留 INTERNET 权限',
  );
  assert.ok(
    manifestSource.includes('<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />'),
    'AndroidManifest.xml 必须保留 ACCESS_NETWORK_STATE 权限',
  );
});

test('onPermissionRequest 拒绝网页发起的所有权限请求', () => {
  assert.equal(
    permissionRequestBlock.includes('grant('),
    false,
    'onPermissionRequest 不得调用 request.grant(...) 一律放行网页权限请求',
  );
  assert.ok(
    permissionRequestBlock.includes('request.deny()'),
    'onPermissionRequest 必须调用 request.deny()',
  );
});
