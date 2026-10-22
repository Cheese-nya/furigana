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

不配置也能发布，只是 Release 里没有 APK。要配置，在仓库 Settings → Secrets and variables → Actions 添加：

| Secret | 内容 |
| :--- | :--- |
| `ANDROID_KEYSTORE_BASE64` | 正式密钥的 base64：`base64 -w0 ~/keys/uku-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | 密钥库密码（别名固定为 `uku`） |

注意：把签名密钥交给 GitHub 保管，意味着任何能修改工作流并推送标签的人都有机会取走它。
只有你自己有仓库写权限、并开启了分支保护时才适合这样做；否则继续在本机打包（`scripts/build-apk.sh`），
再手动把 APK 上传到 Release。

## 本地打包

```bash
bash scripts/build-web.sh                                         # out/
ANDROID_KEYSTORE=~/keys/uku-release.jks bash scripts/build-apk.sh # UkuFurigana.apk（会提示输入密码）
```
