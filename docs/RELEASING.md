# 发布流程 / Releasing

## 一次发布

1. 同步版本号（必须一致，`tests/versionSync.test.mjs` 会检查）：
   - `package.json` 与 `package-lock.json` 的 `version`
   - `android/AndroidManifest.xml` 的 `versionName`，并把 `versionCode` 加 1
   - `ios/App/App.xcodeproj/project.pbxproj` 的 `MARKETING_VERSION`（以及构建号）
2. 更新 `RELEASE_NOTES.md`，合并到 `main`。
3. 打标签并推送：
   ```bash
   git tag v1.3.0 && git push origin v1.3.0
   ```
4. GitHub Actions（`.github/workflows/release.yml`）会运行测试、构建，并把文件发布到 Releases：
   - `Uku-Furigana-vX.Y.Z-windows.exe`：Windows 桌面版（由 GitHub 的 Windows 云端机器构建，**未做代码签名**，首次运行可能出现 SmartScreen 提示）
   - `Uku-Furigana-web-vX.Y.Z.zip`：静态网页包
   - `Uku-Furigana-vX.Y.Z.apk`：已签名 APK（需要下面的两个 Secret）
   - `SHA256SUMS.txt`：校验值

标签必须和 `package.json` 的版本一致（`v1.3.0` ↔ `1.3.0`），否则发布会在第一步失败。

## 官网下载链接

不需要存放文件，直接指向最新版本：

```
https://github.com/Cheese-nya/uku-furigana/releases/latest/download/<文件名>
```

文件名里带版本号，所以按钮最好链接到 Releases 页面：
`https://github.com/Cheese-nya/uku-furigana/releases/latest`。

## 让 Actions 签名 APK（可选）

不配置也能发布，只是 Release 里没有 APK。发布任务运行在名为 `release` 的 Environment 里，签名用的 Secret 也放在这个环境中（而不是仓库级别）。

1. 仓库 Settings → Environments → New environment，名字填 `release`：
   - 勾选 **Required reviewers**，选自己：每次发布都要手动批准，工作流才能读取密钥。
   - **Deployment branches and tags** 选 *Selected branches and tags*，只允许 `v*`。
2. 在自己的终端里存入 Secret（密码要用键盘输入，不要经过聊天或脚本）：
   ```bash
   base64 -w0 ~/keys/uku-release.jks | gh secret set ANDROID_KEYSTORE_BASE64 --env release --repo Cheese-nya/uku-furigana
   gh secret set ANDROID_KEYSTORE_PASSWORD --env release --repo Cheese-nya/uku-furigana
   ```
   密钥别名固定为 `uku`。

没有配置这两个 Secret 时，Release 只含网页包。想完全避免把密钥交给 GitHub，可以改在本机打包（`scripts/build-apk.sh`），再手动把 APK 上传到 Release。

## 本地打包

```bash
npm run build:web                                         # out/
pip install -r requirements-desktop.txt && npm run package:exe   # Windows 上生成 UkuFurigana.exe
ANDROID_KEYSTORE=~/keys/uku-release.jks bash scripts/build-apk.sh # UkuFurigana.apk（会提示输入密码）
```
