# Bug 反馈与在线更新 实施方案

状态：客户端、Android、桌面端、中转服务代码已实现并通过测试（2026-10-24）；**中转服务尚未部署**，Android/Windows 的真机更新流程尚未端到端验证。Leader：Claude（只做接口定义、评审、整合、测试）；实现由 agy（gemini-4-argon-high）workers 完成，不使用 Claude 子代理。

## 已确认的决策

| 项 | 决定 |
| --- | --- |
| 反馈中转 | 自己的服务器 `huawei`（Debian 12，nginx，Python 3.11，**无 Node**，内存 800 MB），挂在已有的 `https://uku.saiaino.xyz` 下，新增 `/api/feedback`、`/api/update/*`，由 `127.0.0.1` 上的 Python 标准库小服务处理 |
| 日志内容 | 只含技术信息，**不含台本文字**；提交前给用户预览并确认；服务端二次脱敏 |
| 更新范围 | Android + Windows 自动检查、后台下载；iOS / 网页版只显示小黄点并跳转 Releases |
| 下载源 | 先直连 GitHub，失败再走中转服务器镜像；一律校验 `SHA256SUMS.txt` |
| 桌面入口 | 复用同一份菜单，放在侧边栏设置菜单里，小黄点标在侧边栏齿轮上 |
| 商店版 | 预留 `NEXT_PUBLIC_DISTRIBUTION=website\|play\|appstore`，非 `website` 时隐藏「检查更新」（商店不允许自更新） |

## 用户可见行为

左上角 ⋮ 菜单（桌面为侧边栏设置菜单）新增一组「反馈与更新」：

1. **上传报错日志**：弹出反馈面板，预览将发送的技术日志，勾选同意后一键发送，成功后显示 issue 编号与链接。无需登录 GitHub。
2. **提交问题**：同一面板，多一个标题/描述输入框和可选联系方式（QQ/邮箱，选填）；可勾选是否附带日志。
3. **加入 QQ 群 1040467160**：点击复制群号；Android 同时尝试拉起 QQ 的加群页，失败则只提示已复制。
4. **检查更新**：显示当前状态——已是最新 / 发现 vX.Y.Z（后台下载中 NN%）/ 已下载，点击安装 / 失败可重试。

**小黄点**：有可用更新（下载中或已下载）时，标在 ⋮ 按钮右上角（桌面为侧边栏齿轮）；菜单里「检查更新」那一行也带点。更新被安装或用户忽略该版本后消失。

**自动检查**：启动后延迟 5 秒检查，之后至少间隔 6 小时；每次启动只检查一次；Android 仅在非计费网络（Wi-Fi）下自动下载，移动网络下只提示、点击后才下载；失败静默，仅写入日志。

## 架构

```
App ──(1) GitHub API / Releases 直连 ───────────────┐
 │                                                   ▼
 └─(2) 直连失败 → https://uku.saiaino.xyz/api/* ──→ relay（Python）──→ GitHub API / Releases / Issues
```

### 中转服务 `server/relay/`

仅用 Python 标准库（`http.server` + `urllib`），监听 `127.0.0.1:8787`，由 nginx 反代；systemd 单元运行，内存目标 < 40 MB。

- `POST /api/feedback`
  - 请求 JSON：`{ kind: "log" | "text", title?, message?, contact?, includeLog, log: { app, version, platform, device, entries[] } }`，请求体 ≤ 64 KB。
  - 服务端：校验字段与长度；再次脱敏（连续 ≥ 6 个汉字/假名替换为 `[文本已隐去]`，去除疑似 token/本机路径/邮箱以外的联系方式字段）；按 IP 限流（每小时 5 条、每天 20 条）；用 GitHub token 在 `Cheese-nya/uku-furigana` 创建 issue，标签 `from-app` + `bug`/`feedback`；日志放在 `<details>` 折叠块里；返回 `{ ok, number, url }`。
  - 日志超过 issue 正文上限时截断并注明。
- `GET /api/update/latest`：代理 GitHub `releases/latest`（内存缓存 10 分钟），只回传 App 需要的字段：`{ version, tag, notes, assets: [{ name, size, url, mirrorUrl }], sums: { name: sha256 } }`（`sums` 由服务端解析 `SHA256SUMS.txt`）。
- `GET /api/update/dl/<tag>/<asset>`：镜像下载。资产名只允许匹配 `Uku-Furigana-v*.apk` / `*-windows.exe`；流式转发，磁盘缓存最近 2 个文件（`/var/cache/uku-relay`），支持 `Range`。
- **GitHub token**：用户自己创建细粒度 PAT（仅限该仓库，权限仅 *Issues: Read and write*），自己写入服务器 `/etc/uku-relay.env`（权限 600）。Claude 不接触、不经手 token。
- nginx 片段加到 `uku.saiaino.xyz` 的 server 块，`/api/feedback` 与 `/api/update/` 反代，`/api/hit`（已有统计）保持不变；放行 CORS（Android WebView 的源是 `https://localhost`）。

### 客户端公共层（leader 先定接口，workers 照接口实现）

`app/utils/` 新增，纯 TS，可在 Node 里测：

- `appInfo.ts`：`getPlatform()` → `'android' | 'desktop' | 'ios' | 'web'`（由 `AndroidBridge` / `pywebview` / Capacitor 判断），`APP_VERSION`（构建时注入，来自 `package.json`），`DISTRIBUTION`。
- `appLog.ts`：环形日志缓冲（500 条，持久化最近 200 条到 localStorage）；挂接 `console.error/warn`、`window.onerror`、`unhandledrejection`、注音引擎状态变化、导出失败；入口统一脱敏（≥ 6 连续汉字/假名 → `[文本已隐去]`，单条截断 500 字）；`buildReport()` 合并 JS 日志、设备信息、原生日志（`AndroidBridge.getNativeLog()` / `pywebview.api.get_log()`）。
- `feedback.ts`：`buildFeedbackPayload()`、`submitFeedback()`（向中转 POST，带超时与错误分类）、客户端限流（同一设备 30 秒内不能重复提交）。
- `updater.ts`：`compareVersions()`、`checkForUpdate()`（GitHub 直连 → 中转回退，8 秒超时）、状态机 `idle → checking → available → downloading → ready → error`，订阅式 `useUpdater()` hook；平台适配层 `UpdateDriver`（Android / 桌面 / 仅提示三种实现）。

接口类型集中放在 `app/utils/updateTypes.ts`（leader 先写，全员依赖）。

### Android 原生（`android/`）

- `AndroidNativeBridge` 新增：`getAppVersion()`、`getNativeLog()`、`startUpdateDownload(json)`、`getUpdateState()`、`installUpdate()`、`cancelUpdateDownload()`。
- 下载：Java 线程 + `HttpURLConnection`，写入 `getExternalFilesDir("updates")`，支持断点续传与 `.part`；先直连、15 秒无进度或失败再切 `mirrorUrl`；完成后校验 SHA256，失败删除并报错；非计费网络检查（`ConnectivityManager`）。
- 安装：`FileProvider` + `ACTION_VIEW`（`application/vnd.android.package-archive`）；未授权「安装未知应用」时先跳转 `ACTION_MANAGE_UNKNOWN_APP_SOURCES` 授权页，授权返回后继续。清单新增 `REQUEST_INSTALL_PACKAGES` 与 `<provider>`、`res/xml/file_paths.xml`（`scripts/build-apk.sh` 需确认资源会被打包）。
- 崩溃线索（为了以后能一眼看出为什么崩）：把 `onRenderProcessGone` 的事件（时间、是否 crash、`rendererPriorityAtExit`）和 API 30+ 的 `ActivityManager.getHistoricalProcessExitReasons`（含 `REASON_LOW_MEMORY` / `REASON_ANR` 等）追加写入 `files/native.log`（上限 64 KB，滚动），供 `getNativeLog()` 读取。
- 新版 APK 签名必须沿用 `~/keys/uku-release.jks`；系统安装器会拒绝不同签名的覆盖安装（旧的泄密 keystore 打的 APK 无法被覆盖更新，用户需卸载重装一次）。

### Windows 桌面（`desktop_runner.py`）

- `Api` 新增：`get_log()`、`update_download(json)`、`update_state()`、`update_apply()`。
- 日志：`logging` 轮转文件写入数据目录 `logs/uku.log`（≤ 512 KB × 2）。
- 下载：后台线程，写 `updates/UkuFurigana-vX.Y.Z.exe.part`，校验 SHA256 后改名；先直连再镜像。
- 应用：`update_apply()` 启动一个脱离的辅助进程（`cmd /c` 批处理或 PowerShell），等待本进程退出 → 把当前 exe 备份为 `.old` → 复制新 exe 覆盖 → 重新启动；启动成功后清理 `.old` 与残留下载。仅对 PyInstaller 打包后的运行（`sys.frozen`）生效，开发模式只提示。
- exe 未做代码签名，SmartScreen 对覆盖后的 exe 可能再次提示，需在 `docs/RELEASING.md` 说明。

### UI（`app/components/`）

- `SettingsMenu.tsx`：在设置项下方新增「反馈与更新」分组（4 项），保持现有 Liquid Glass 样式；新 prop 由 `useUpdater()` 与反馈面板的开关提供。
- `FeedbackModal.tsx`（新）：基于 `Modal.tsx`；两种模式（日志 / 文字）、日志预览折叠框、同意复选框、发送状态与结果。
- 小黄点：`EditorWorkspace.tsx` 的 ⋮ 按钮（行 ~134–143）与 `Sidebar.tsx` 的齿轮按钮（行 ~72）各加一个绝对定位的 8 px 黄色圆点（`--warn` 色 token，需确认现有 token）。
- 文案：`i18n.ts` 中英文两套新增键。
- 接线：`page.tsx`（587 行，仅在 `<SettingsMenu>` 处（行 ~408）传 props）。

### 发布侧

- `release.yml` 不需要改：已产出 `Uku-Furigana-vX.Y.Z.apk`、`-windows.exe` 与 `SHA256SUMS.txt`。更新检查依赖这三个固定文件名，写进 `docs/RELEASING.md` 作为约定。
- `/releases/latest` 自动排除草稿和预发布版本，发布流程不变。

## 任务拆分与分工

| # | 任务 | 文件范围（互不重叠） | 依赖 |
| --- | --- | --- | --- |
| L0 | **Leader**：写 `updateTypes.ts`、`appInfo.ts` 骨架与各任务的精确 brief | `app/utils/updateTypes.ts`、`app/utils/appInfo.ts` | 无 |
| W1 | 中转服务 + nginx 片段 + systemd 单元 + 部署说明 + Python 单测 | `server/relay/**` | L0 |
| W2 | 客户端公共层：`appLog` / `feedback` / `updater` + Node 单测 | `app/utils/appLog.ts`、`feedback.ts`、`updater.ts`、`tests/appLog.test.mjs`、`feedback.test.mjs`、`updater.test.mjs` | L0 |
| W3 | Android 原生：桥接、下载、安装、native.log、清单与 FileProvider | `android/**`、`tests/androidUpdate.test.mjs` | L0 |
| W4 | Windows 桌面：日志、下载、应用更新 + Python 单测 | `desktop_runner.py`、`tests/test_desktop_update.py` | L0 |
| W5 | UI：菜单分组、`FeedbackModal`、小黄点、i18n | `app/components/SettingsMenu.tsx`、`FeedbackModal.tsx`、`i18n.ts` | L0 |
| L1 | **Leader**：`page.tsx` / `EditorWorkspace.tsx` / `Sidebar.tsx` 接线（大文件，agy 易卡住，leader 自己改） | 同左 | W2、W5 |
| L2 | **Leader**：评审每个 worker 的 diff（用 baseline 快照对比）、跑 `npm test` / `tsc` / `lint`、浏览器里实测面板与小黄点、手机尺寸与深色模式 | — | 全部 |
| L3 | 部署中转服务器（**需用户确认后**才执行）、端到端：创建一条真实 issue、对一个测试 Release 跑更新流程 | 服务器 | W1、用户的 PAT |

W1–W5 互相无文件重叠，可并行；每个 brief 附明确文件列表、接口类型、不要运行 node/npm（由 leader 跑测试），并带 `--print-timeout 20m`。

## 验收标准

- `npm test`、`npx tsc --noEmit`、`npm run lint` 全过；新增测试覆盖：版本比较、日志脱敏（含 CJK 长串）、负载构造与限流、更新状态机与回退顺序、Android 源码关键点（权限/Provider/桥接方法）、中转服务的校验与限流、桌面端校验与应用流程。
- 浏览器实测：菜单分组、反馈面板（日志/文字）、预览与同意、发送成功/失败提示、更新各状态、小黄点出现与消失、手机宽度与深色模式。
- 中转端到端：从 App 提交一条反馈，GitHub 上出现带 `from-app` 标签的 issue，且正文不含台本文字。
- 更新端到端：发布一个测试 Release，Android 与 Windows 各完整走一遍「发现 → 下载 → 校验 → 安装/替换」；GitHub 不可达时能走镜像。

## 风险与未决项

- **Android 不能真静默安装**：下载是静默的，安装必须用户点系统确认。
- **Android 覆盖安装依赖签名一致**：必须用 `uku-release.jks` 打的 APK 才能更新到用户手机上。
- **Windows exe 未签名**：自更新后可能再次触发 SmartScreen；校验值取自 GitHub，镜像由用户自己的服务器提供，信任链止于这台服务器。
- **公开仓库的 issue 是公开的**：即使已脱敏，设备型号与错误信息仍会公开，面板里需要明确告知。
- **滥用**：匿名提交可能被刷，靠 IP 限流 + 体积限制 + 标签过滤；必要时服务端加全局日上限。
- **服务器资源**：800 MB 内存、同机还跑着 sing-box；镜像缓存限 2 个文件，relay 限制并发下载数为 2。
- 小黄点用的颜色 token、QQ 加群深链的具体格式，在实现时核对现有 token 与实机效果。

## 实现时的调整

- **限流改按客户端 ID**：服务器上 443 先经 nginx stream 的 SNI 分流再转到 8443，没有传 PROXY 协议，relay 看到的客户端地址永远是 127.0.0.1。因此 `FeedbackPayload` 增加 `clientId`（每个安装一个随机 ID，存 localStorage），relay 按 `clientId` 限流（5/小时、20/天），并增加全局上限（30/小时、200/天）兜底；没有合法 `clientId` 的请求共用同一个额度。
- **GitHub 直连取不到 sums 时回退中转**：浏览器里跨域读取 Release 资产常被 CORS 挡住，`fetchLatestRelease` 会因此经常走中转，这是预期行为。
