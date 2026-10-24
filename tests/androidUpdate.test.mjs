import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const manifestSource = readFileSync(
  fileURLToPath(new URL('../android/AndroidManifest.xml', import.meta.url)),
  'utf8',
);

const mainActivitySource = readFileSync(
  fileURLToPath(new URL('../android/src/com/cheese/uku/MainActivity.java', import.meta.url)),
  'utf8',
);

const updateManagerSource = readFileSync(
  fileURLToPath(new URL('../android/src/com/cheese/uku/UpdateManager.java', import.meta.url)),
  'utf8',
);

const providerSource = readFileSync(
  fileURLToPath(new URL('../android/src/com/cheese/uku/UpdateApkProvider.java', import.meta.url)),
  'utf8',
);

test('AndroidManifest.xml 声明 REQUEST_INSTALL_PACKAGES 与 UpdateApkProvider', () => {
  assert.match(
    manifestSource,
    /<uses-permission\s+android:name="android\.permission\.REQUEST_INSTALL_PACKAGES"\s*\/>/,
    '必须声明 REQUEST_INSTALL_PACKAGES 权限',
  );
  assert.match(
    manifestSource,
    /<provider[\s\S]*?android:name="\.UpdateApkProvider"[\s\S]*?\/>/,
    '必须声明 .UpdateApkProvider',
  );
  assert.match(
    manifestSource,
    /<provider[\s\S]*?android:authorities="com\.cheese\.uku\.updates"[\s\S]*?\/>/,
    'UpdateApkProvider authorities 必须为 com.cheese.uku.updates',
  );
  assert.match(
    manifestSource,
    /<provider[\s\S]*?android:exported="false"[\s\S]*?\/>/,
    'UpdateApkProvider 必须设置 android:exported="false"',
  );
  assert.match(
    manifestSource,
    /<provider[\s\S]*?android:grantUriPermissions="true"[\s\S]*?\/>/,
    'UpdateApkProvider 必须设置 android:grantUriPermissions="true"',
  );
});

test('AndroidNativeBridge 暴露所有更新与反馈桥接方法并带 @JavascriptInterface', () => {
  const bridgeStart = mainActivitySource.indexOf('public class AndroidNativeBridge');
  assert.notEqual(bridgeStart, -1, 'MainActivity 必须包含 AndroidNativeBridge');
  const bridgeSource = mainActivitySource.slice(bridgeStart);

  const requiredMethods = [
    /(@JavascriptInterface\s+public\s+String\s+getAppVersion\s*\(\s*\))/,
    /(@JavascriptInterface\s+public\s+String\s+getNativeLog\s*\(\s*\))/,
    /(@JavascriptInterface\s+public\s+String\s+startUpdateDownload\s*\(\s*String\s+\w+\s*\))/,
    /(@JavascriptInterface\s+public\s+String\s+getUpdateState\s*\(\s*\))/,
    /(@JavascriptInterface\s+public\s+String\s+installUpdate\s*\(\s*\))/,
    /(@JavascriptInterface\s+public\s+String\s+cancelUpdateDownload\s*\(\s*\))/,
    /(@JavascriptInterface\s+public\s+String\s+openQqGroup\s*\(\s*String\s+\w+\s*\))/,
  ];

  for (const pattern of requiredMethods) {
    assert.match(bridgeSource, pattern, `AndroidNativeBridge 缺少桥接方法: ${pattern}`);
  }

  assert.match(
    bridgeSource,
    /mqqapi:\/\/card\/show_pslcard\?src_type=internal&version=1&uin=/,
    'openQqGroup 必须使用 mqqapi://card/show_pslcard 深链',
  );
  assert.match(
    bridgeSource,
    /\^\\\\d\{5,12\}\$/,
    'openQqGroup 必须校验 uin 为 5-12 位纯数字',
  );
  assert.match(
    bridgeSource,
    /catch\s*\(\s*ActivityNotFoundException/,
    'openQqGroup 必须捕获 ActivityNotFoundException 并返回 {"success":false}',
  );
});

test('UpdateManager 校验 HTTPS、重定向、计费网络、SHA-256、包签名信息与安装权限', () => {
  assert.match(
    updateManagerSource,
    /startsWith\("https:\/\/"\)/,
    'UpdateManager 必须强制检查 https:// 前缀',
  );
  assert.match(
    updateManagerSource,
    /"https"\.equalsIgnoreCase\(/,
    'UpdateManager 必须校验 URL 协议为 https',
  );
  assert.match(
    updateManagerSource,
    /setInstanceFollowRedirects\(false\)/,
    'UpdateManager 必须手动处理重定向以校验每一跳协议',
  );
  assert.match(
    updateManagerSource,
    /MAX_REDIRECTS\s*=\s*5/,
    'UpdateManager 重定向最多允许 5 跳',
  );
  assert.match(
    updateManagerSource,
    /isActiveNetworkMetered\(\)/,
    'UpdateManager 必须检查计费网络 isActiveNetworkMetered()',
  );
  assert.match(
    updateManagerSource,
    /"metered-network"/,
    'wifiOnly 在计费网络下必须报错 metered-network',
  );
  assert.match(
    updateManagerSource,
    /MessageDigest\.getInstance\("SHA-256"\)/,
    'UpdateManager 必须计算 SHA-256 校验和',
  );
  assert.match(
    updateManagerSource,
    /"checksum-mismatch"/,
    'SHA-256 不一致时必须报错 checksum-mismatch',
  );
  assert.match(
    updateManagerSource,
    /getPackageArchiveInfo\(/,
    'UpdateManager 必须调用 getPackageArchiveInfo 校验 APK 包信息',
  );
  assert.match(
    updateManagerSource,
    /"invalid-package"/,
    'APK 包名或 versionCode 不合法时必须报错 invalid-package',
  );
  assert.match(
    updateManagerSource,
    /canRequestPackageInstalls\(\)/,
    'installUpdate 必须检查 canRequestPackageInstalls()',
  );
  assert.match(
    updateManagerSource,
    /ACTION_MANAGE_UNKNOWN_APP_SOURCES/,
    '未授权未知来源安装时必须跳转 ACTION_MANAGE_UNKNOWN_APP_SOURCES',
  );
  assert.match(
    updateManagerSource,
    /need-install-permission/,
    '未授权未知来源安装时必须返回 need-install-permission',
  );
  assert.match(
    updateManagerSource,
    /FLAG_GRANT_READ_URI_PERMISSION/,
    '启动安装器必须携带 FLAG_GRANT_READ_URI_PERMISSION',
  );
});

test('UpdateApkProvider 实现文件名白名单、canonical path 防目录穿越与只读访问', () => {
  assert.match(
    providerSource,
    /com\.cheese\.uku\.updates/,
    'UpdateApkProvider 必须绑定 com.cheese.uku.updates authority',
  );
  assert.match(
    providerSource,
    /\^Uku-Furigana-v\[0-9\.\]\+\\\\\.apk\$/,
    'UpdateApkProvider 必须校验文件名白名单 ^Uku-Furigana-v[0-9.]+\\.apk$',
  );
  assert.match(
    providerSource,
    /getCanonicalPath\(\)/,
    'UpdateApkProvider 必须使用 getCanonicalPath() 防止目录穿越',
  );
  assert.match(
    providerSource,
    /ParcelFileDescriptor\.MODE_READ_ONLY/,
    'UpdateApkProvider openFile 必须以只读模式打开',
  );
  assert.match(
    providerSource,
    /OpenableColumns\.DISPLAY_NAME/,
    'UpdateApkProvider query 必须支持 OpenableColumns.DISPLAY_NAME',
  );
  assert.match(
    providerSource,
    /OpenableColumns\.SIZE/,
    'UpdateApkProvider query 必须支持 OpenableColumns.SIZE',
  );
  assert.match(
    providerSource,
    /application\/vnd\.android\.package-archive/,
    'UpdateApkProvider getType 必须返回 APK MIME 类型',
  );
  assert.match(
    providerSource,
    /UnsupportedOperationException/,
    'UpdateApkProvider insert/update/delete 必须抛出 UnsupportedOperationException',
  );
});

test('MainActivity 记录崩溃线索到 native.log，含 64KB 上限与 API 30 守卫', () => {
  assert.match(
    mainActivitySource,
    /64\s*\*\s*1024/,
    'native.log 必须设置 64KB 上限',
  );
  assert.match(
    mainActivitySource,
    /32\s*\*\s*1024/,
    'native.log 超出上限时必须保留尾部 32KB',
  );
  assert.match(
    mainActivitySource,
    /synchronized\s*\(\s*LOG_LOCK\s*\)/,
    'native.log 读写必须使用 synchronized 保护',
  );
  assert.match(
    mainActivitySource,
    /renderer-gone didCrash=/,
    'onRenderProcessGone 必须追加 renderer-gone 日志到 native.log',
  );
  assert.match(
    mainActivitySource,
    /rendererPriorityAtExit\(\)/,
    'onRenderProcessGone 必须记录 detail.rendererPriorityAtExit()',
  );
  assert.match(
    mainActivitySource,
    /Build\.VERSION\.SDK_INT\s*>=\s*(30|Build\.VERSION_CODES\.R)[\s\S]*?getHistoricalProcessExitReasons\(/,
    'getHistoricalProcessExitReasons 必须有 Build.VERSION.SDK_INT >= 30 守卫',
  );
});

test('plain http is only accepted for the emulator host and only in a debuggable build', () => {
  const source = readFileSync(fileURLToPath(new URL('../android/src/com/cheese/uku/UpdateManager.java', import.meta.url)), 'utf8');
  assert.match(source, /FLAG_DEBUGGABLE/);
  assert.match(source, /startsWith\("http:\/\/10\.0\.2\.2:"\)/);
  assert.doesNotMatch(source, /startsWith\("http:\/\/"\)/);
});
