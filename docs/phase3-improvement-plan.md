# Phase 3 — 统筹改进计划（Leader: Claude）

> 基线快照：`refs/baselines/pre-goal`（132/132 测试通过，tsc / eslint 干净）
> 所有 worker 必须先阅读 `docs/worker-shared-context.md` 第 1 节的「测试契约」，不得破坏既有 data-testid / class 断言。
> 每个 worker 只能修改自己「拥有」的文件；完成后必须运行 `npm test`、`npx tsc --noEmit`、`npx eslint app` 并全部通过。
> 禁止：git commit / push、修改他人文件、删除测试、引入 emoji、新增 npm 依赖。

## 审计发现

| # | 级别 | 问题 | 位置 |
|---|------|------|------|
| 1 | P0 | 阅读器：`line.speaker` 存在时说话人 chip 与正文开头重复显示（"生徒A" chip + "生徒A：…"） | `ReaderPanel.tsx` ~L1111-1140 |
| 2 | P0 | 阅读器/工作台：`.ruby-interactive-token { padding: 0 2px }` 使每个词之间出现可见空隙（「約 束」「教 室」） | `globals.css` L217 |
| 3 | P1 | 顶栏在 768–1100px 宽度下品牌版本号与导航胶囊重叠，状态胶囊文字被截断 | `page.tsx` header |
| 4 | P1 | 主题切换逻辑在 `page.tsx` 中重复 3 份（初始化 effect / darkMode effect / toggle） | `page.tsx` L133-208 |
| 5 | P1 | `page.tsx` 2100 行单体组件（82 个 hooks），头部与工作台难以维护 | `page.tsx` |
| 6 | P2 | 数十处 `locale === 'zh-CN' ? '…' : '…'` 硬编码绕过 i18n；`LibraryPanel` 用 `isZh` 推断语言 | `page.tsx`, `LibraryPanel.tsx` |
| 7 | P2 | 移动端工作台工具栏纵向占满一屏（导出/排版/词典分 4 行） | `page.tsx` |
| 8 | P2 | `pixivImporter` / `glossary` / `rubyOverrides` 无单元测试 | `tests/` |

## 任务分配（文件所有权互斥）

### Task A — Argon-1（`agy --model gemini-4-argon-high`）：主壳层重构 + 响应式顶栏 + i18n 收口
拥有：`app/page.tsx`, `app/utils/i18n.ts`, 新建 `app/hooks/useThemeMode.ts`, 新建 `app/components/AppHeader.tsx`, `app/components/LibraryPanel.tsx`（仅限 isZh 排序标签改为 i18n）
1. 新建 `useThemeMode()` hook：统一 localStorage 读写、`<html>` class/data-theme、`--bg-primary`、theme-color meta、iOS `webkit.messageHandlers.furiganaTheme` 与 `AndroidBridge.syncTheme` 原生桥同步；`page.tsx` 中三份重复代码全部删除改用 hook。
2. 把 `<header>` 抽取为 `AppHeader.tsx`（props 传入 tabs、locale、darkMode 等）。保留 `data-testid="dark-mode-toggle"` 及 `☼`、`/`、`☾` 字符（测试契约）。
3. 响应式修复：`md`–`xl` 宽度下不得重叠或截断——版本号 `< lg` 隐藏；引擎状态胶囊 `< xl` 只显示状态圆点（保留 title/aria-label 提示全文）；导航胶囊居中且不与品牌区重叠。
4. 把 `page.tsx` 中所有 `locale === 'zh-CN' ? 'X' : 'Y'` UI 文案迁移为 `i18n.ts` 中的新 key（zh-CN 与 en 两份都要补齐）；`LibraryPanel` 的 `isZh` 排序标签改为新 i18n key `librarySortRecent / librarySortUpdated / librarySortTitle`。
5. 移动端（< 768px）工作台工具栏压缩：读音格式分段控件与「排版设置 / 专名词典」同一行；「存入台本库 / 在阅读器打开」与导出组合并为一行可横向滚动（`overflow-x-auto`，隐藏滚动条）。

### Task B — Argon-2（`agy --model gemini-4-argon-high`）：阅读器排版缺陷
拥有：`app/components/ReaderPanel.tsx`, `app/globals.css`, `tests/readerPanel.test.mjs`（只可追加用例）
1. 修复说话人重复：当 `line.speaker` 已存在时，也要跳过正文开头与说话人相同的 token 以及紧随其后的「：」/「:」分隔符；无说话人时行为不变。
2. 修复 token 间隙：`.ruby-interactive-token` 去掉水平 padding，改用 `box-shadow`（如 `0 0 0 2px <同色>`）或负 margin 实现悬停高亮外扩，保证相邻 token 之间零空隙、`<rt>` 不被遮挡；工作台预览同样受益。
3. 在 `tests/readerPanel.test.mjs` 追加断言：`.ruby-interactive-token` 规则不含 `padding: 0 2px`；ReaderPanel 源码包含对 `line.speaker` 的正文去重逻辑。

### Task C — free-ds（`pi --model group/free-ds`）：补齐单元测试
拥有：新建 `tests/pixivImporter.test.mjs`, `tests/glossary.test.mjs`, `tests/rubyOverrides.test.mjs`
- 参照 `tests/loadTypescript.mjs` 和现有测试的加载方式，为 `app/utils/pixivImporter.ts`、`app/utils/glossary.ts`、`app/utils/rubyOverrides.ts` 的每个导出函数写测试（正常路径 + 边界：空输入、非法 ID、URL 变体、[[rb:]] / [chapter:] 等 Pixiv 标记）。
- **不得修改 `app/` 下任何源码**；若发现源码 bug，用 `test.todo` 标注并在最终回复中列出。

## 验收（Leader）
- diff 审查（对比 `refs/baselines/pre-goal`）、`npm test` / tsc / eslint、浏览器桌面 + 移动 + 暗色截图核对。
- 构建：`NEXT_EXPORT=true` 静态导出 → `scripts/build-apk.sh`（本机）→ `scripts/build-ios-hackintosh.sh`（黑苹果 Xcode 26.5）。

## 验收记录（2026-10-21）

| 任务 | 执行者 | 结果 |
|------|--------|------|
| Task B 阅读器缺陷 | agy Argon-2 | ✅ 通过。说话人去重正确；但 token 空隙的真正根因是 Chrome 默认 `ruby-align: space-around` 把宽读音下的复合词基字撑开——Leader 追加全局 `ruby { ruby-align: center; }` 及回归测试后修复。 |
| Task A 壳层重构 | agy Argon-1 | ⚠️ 部分完成后两次卡死/超时（25 min 无产出）。Worker 完成：`useThemeMode`、`AppHeader`（响应式断点）、i18n key 定义、LibraryPanel 排序标签。Leader 接手完成：header 替换为 `<AppHeader/>`、`useThemeMode` 改为 `useSyncExternalStore`（修复 SSR 水合不一致）、剩余 12 处内联文案迁移至 i18n、移动端工具栏单行横滑 + 导出按钮前置、测试源码路径改为读取 AppHeader/useThemeMode。 |
| Task C 单元测试 | pi free-ds | ✅ 通过。改用 `pi -na --tools read,write,edit`（无 bash）后不再被拦截。新增 72 个用例；暴露 2 个真实源码 bug，Leader 已修：`[[rb:漢字 > ]]` 空读音输出「漢字()」→ 现仅保留基字；AJAX 级联中 Pixiv 返回的错误说明（如「作品已删除」）被后一端点的通用错误覆盖 → 现优先抛出。2 条 `test.todo`（重叠 override 丢失前一条读音，仅损坏导入数据可触发）留待后续。 |
| Task D 抽取排版弹层 | agy Argon（限时 20 min，给定行号） | ✅ 通过。`TypographyPopover.tsx` 与原 JSX 规范化比对完全一致；tsc / eslint 干净。 |

第一轮：`npm test` 134/134，`tsc` / `eslint` 无错误；浏览器核对 900px 顶栏无重叠、375px 工具栏 3 行且导出可见、暗色模式刷新后保持且无水合告警。

### Task D — Argon（`agy`，限时 20 分钟）：抽取排版设置弹层
拥有：`app/page.tsx`（仅限第 1151–1261 行「Streamlined Typography Popover」块）、新建 `app/components/TypographyPopover.tsx`
- 把该块原样抽成 `TypographyPopover` 组件，所需 state/setter 通过 props 传入（类型显式声明），`page.tsx` 中替换为 `<TypographyPopover … />`；视觉与行为完全不变，保留所有 className / data-testid。
- 不改其它任何文件；不运行 next build / dev server。

第二轮：`npm test` 207 项（205 通过 / 0 失败 / 2 todo），tsc / eslint 无错误。

### Task C 复核更正（2026-10-21 21:20）
- 先前误判 pi 已结束（进程以 `timeout` 包装启动，检测命令未匹配），实际 pi 持续运行至 25 分钟超时（exit 124，无最终汇报），并在 21:10–21:12 重写了三份测试，覆盖了 Leader 的一处修正。
- 二次验收：82 个用例中 1 个断言了旧 bug（`漢字()`）→ 改为断言修复后行为；pi 标注 9 个 todo，逐一复核：
  - 真 bug 已修：URL 中的 Pixiv ID 不校验 4–15 位（`?id=1` 被接受）；原生通道错误被 Web API 错误抢先抛出（与代码注释意图相反）。均补测试。
  - 设计如此（改为注释说明）：同长词典条目按用户顺序、罗马字读音原样透传、拆分 token 头尾标记待复核、无 token 行（注音进行中）、日语无词边界的最长匹配。
  - 保留 1 个 todo：重叠 override 使前一条读音丢失（仅损坏导入数据可触发，低优先级）。
- 结果：`npm test` 210 项（209 通过 / 0 失败 / 1 todo），tsc / eslint 无错误。

### Task A-final — Argon（`agy`，限时 20 分钟）：Task A 收尾自查
Task A 由 Leader 代为补完，按流程需由 worker 对照 Task A 第 1–5 条逐条自查并修补遗漏（仅限 Task A 拥有的文件）：
1. `grep -n "locale === 'zh-CN'" app/page.tsx app/components/*.tsx` 中仍为 UI 文案三元表达式的，迁入 `i18n.ts`（zh-CN 与 en 均补齐）；语言切换按钮自身的「中 / EN」标签除外。
2. 确认 `page.tsx` 不再包含任何主题副作用代码（`theme-color`、`furiganaTheme`、`AndroidBridge` 只应出现在 `useThemeMode.ts`）。
3. 确认 `AppHeader.tsx` 断点：版本号 `hidden lg:inline`、引擎状态文字 `hidden xl:inline`。
4. 不改动测试与其它文件；完成后运行 `npx tsc --noEmit --incremental false` 与 `npx eslint app`，中文汇报每条的检查结论与改动。
- **Task A-final 验收（agy Argon）**：✅ 通过。worker 逐条自查 Task A 第 1–5 条，结论经 Leader 复核属实（Sidebar.tsx:123 为语言按钮激活态样式判断而非文案；主题副作用仅存于 `useThemeMode.ts`；版本号 `hidden lg:inline`、状态文字 `hidden xl:inline`；移动端工具栏横滑 + 导出前置），唯一改动为清理 page.tsx 残留注释。`npm test` 209 通过 / 0 失败 / 1 todo，tsc / eslint 无错误；浏览器复核页面正常、TypographyPopover 可交互（字号 16→18px）。

## Task A 重新委派（2026-10-21 21:45）
Task A 的核心实现此前由 Leader 代写，不符合「worker 实现 → Leader 验收」流程。Leader 版本已存档为 `refs/baselines/leader-taskA`（仅供对比，不提供给 worker），工作区已回退到 Argon-1 卡住时的状态，拆成 4 个有界子任务重新委派。每个子任务只改列出的文件/行段，不 commit，不运行 next build / dev server。

### A-R1 — agy Argon（限时 20 min）：接入 AppHeader
- 拥有：`app/page.tsx` 第 1111–1302 行（内联 `<header>` 块）及顶部 import 段；`tests/readerPanel.test.mjs`、`tests/libraryShelf.test.mjs`、`tests/libraryStorageAndIntegration.test.mjs` 中读取 `page.tsx` 源码做顶栏/主题断言的位置。
- 用 `<AppHeader … />`（`app/components/AppHeader.tsx` 已存在，查看其 props）替换该内联块；删除 page.tsx 因此不再使用的 import。
- 顶栏与主题相关断言（app-brand-title、app-version-badge、v1.2.0、header 内无 setIsSidebarOpen、dark-mode-toggle 与 ☼/☾、X/GitHub 快捷链接、furiganaTheme 通知）改为读取 `AppHeader.tsx` / `useThemeMode.ts`（可与 page.tsx 拼接后断言），断言语义不得放宽。
- 验收：`npm test` 全绿、tsc 0 错误、eslint 0 警告。

### A-R2 — agy Argon（限时 20 min，可与 A-R1 并行）：主题 hook 水合安全
- 拥有：`app/hooks/useThemeMode.ts`。
- 当前惰性 `useState` 初始化直接读 localStorage，静态导出预渲染为亮色时，保存了暗色的用户首屏会水合不一致。改为水合安全的实现（推荐 `useSyncExternalStore`，server snapshot 为 `false`），对外 API（`darkMode`、`setDarkMode`、`toggleDarkMode`、`syncThemeSideEffects` 及常量导出）保持不变；首屏应用副作用时不应重复写 localStorage。
- 验收：tsc / eslint 干净。

### A-R3 — pi free-ds（A-R1 完成后）：剩余文案迁入 i18n
- 拥有：`app/page.tsx` 中 10 处 `locale === 'zh-CN' ? 'X' : 'Y'`（约第 1464–1783 行，用 grep 定位）。
- 全部改为 `i18n.ts` 中已存在的 key：rubyColorLabel 以外，本次涉及 mobileViewModeLabel / mobileViewInputOnly / mobileViewPreviewOnly / mobileViewSplit / defaultScriptTitle / rubyCountPrefix / nextReviewItem / previewTotalPrefix / suppressedRubyTitle（先读 i18n.ts 核对 key 名与中英文值一致）。不得新增或修改 i18n.ts。

### A-R4 — pi free-ds（A-R3 完成后）：移动端工作台工具栏压缩
- 拥有：`app/page.tsx` 工作台命令栏的 Center Zone（约 1328 行）与 Right Zone（约 1386 行）容器 className、导出胶囊（`data-testid="workbench-export-capsule"`）className；`app/globals.css` 末尾追加。
- `< sm` 时：Center Zone 与 Right Zone 各自单行、可横向滚动且隐藏滚动条（新增 `.toolbar-scroll` 工具类写在 globals.css），子项不收缩；导出胶囊在手机上排到 Right Zone 最前，保证「导出」按钮无需滚动即可见。`sm` 及以上布局保持不变。

### Task A 重新委派验收结果
| 子任务 | Worker | 结果 |
|---|---|---|
| A-R1 接入 AppHeader + 测试改读 | agy Argon | ✅ 通过；测试比 Leader 参考版更严（新增 `<AppHeader` 渲染断言、AppHeader 非 sticky 断言） |
| A-R2 主题 hook 水合安全 | agy Argon | ✅ 通过；`useSyncExternalStore` + 跨标签页 `storage` 事件 + 内存兜底，首屏不重复写 localStorage |
| A-R3 剩余 10 处文案迁入 i18n | pi free-ds | ✅ 通过；与参考版逐字一致 |
| A-R4 移动端工具栏压缩 | pi free-ds | ✅ 通过；等价于参考版并多加 `min-w-0` 防撑宽 |

复核：`npm test` 209 通过 / 0 失败 / 1 todo，tsc / eslint 无错误。浏览器：375px 工具栏 3 行、导出按钮免滚动可见（right=247 < 375）、整页无横向滚动；900px 顶栏无重叠；暗色刷新后保持（`aria-pressed=true`）且无水合告警。Task A 现已全部由 worker 实现、Leader 验收。

## 修复任务重新委派（2026-10-21 22:00）
此前 Leader 直接修改了 `pixivImporter.ts`、`globals.css`（ruby-align）、`build-ios-hackintosh.sh` 并改写了测试，违反「worker 实现 → Leader 验收」。上述改动已全部回退到 worker 产出状态，Leader 只保留**分诊结论**，实现交给 worker。三个任务文件互不重叠，可并行。

### F1 — pi free-ds：修复 pixivImporter 的 3 个真 bug（Leader 分诊确认）
拥有：`app/utils/pixivImporter.ts`、`tests/pixivImporter.test.mjs`
1. `cleanPixivContent`：`[[rb:漢字 > ]]`（读音为空白）当前输出「漢字()」→ 应只输出基字「漢字」且不产生 override。
2. `extractPixivNovelId`：URL 中的 `?id=` / `&id=` / `id=` / `/novels/` 形式也必须满足 4–15 位数字（与纯数字 ID 规则一致，用 `(?!\d)` 防止截断更长的数字）；`?id=1`、16 位 ID 返回 `null`。
3. `fetchPixivNovel`：
   a. 原生桥失败时，最终错误应**优先**抛原生桥原因（与代码注释「Keep its error…」一致），其次才是 `/api/pixiv` 的错误。
   b. AJAX 级联中，若某端点返回 Pixiv 自带的 `message`（如「作品已删除」），而后续端点只得到通用失败，最终应抛该 `message`（在原生/API 错误之后、`lastError` 之前）。
- 同步更新测试：把断言旧行为的用例（`emits empty parentheses…`、`id= has no length restriction`、`reports the web API error before the native one`）改为断言新行为，并新增 3b 的用例；删除对应的 3 个 `test.todo`。

### F2 — pi free-ds：按分诊结论处理 glossary / rubyOverrides 的 todo
拥有：`tests/glossary.test.mjs`、`tests/rubyOverrides.test.mjs`（不改源码）
Leader 分诊：以下均为**设计如此**，把对应 `test.todo` 替换为一行 `// Reviewed: <原因>` 注释：
- glossary 无词边界检查 → 日语无分词边界，字面最长匹配是既定规则。
- 罗马字条目不跟随请求的 ruby 类型（glossary 与 rubyOverrides 各一条）→ 无罗马字→假名转换，原样透传是既定行为。
- 拆分已有 ruby 的 token 时头尾丢读音 → 头尾被标记 `needsReview`，「改动后重新检查而非猜测」是既定设计。
- 无 token 的行丢弃 override → 仅在注音进行中出现，token 到达后会重新应用。
保留 1 条真实低优先级 todo：「overlapping stored entries make the earlier annotation disappear」。

### F3 — pi free-ds：阅读器复合词基字被撑开 + iOS 构建脚本单向同步
拥有：`app/globals.css`、`tests/readerPanel.test.mjs`（仅追加）、`scripts/build-ios-hackintosh.sh`
1. Leader 在浏览器中复现：读音比基字宽时，Chrome 默认 `ruby-align: space-around` 把「約束」「教室」撑成「約 束」「教 室」；在页面注入 `ruby{ruby-align:center}` 后恢复紧密。请在 `globals.css` 中加入全局 `ruby { ruby-align: center; }`（附简短注释），并在 `tests/readerPanel.test.mjs` 末尾追加回归测试断言该规则存在。
2. 用户确认「本地才是最新的」：`build-ios-hackintosh.sh` 末尾把黑苹果 `ios/App/` rsync 回本地会覆盖本地较新文件。改为默认不回传，仅当 `SYNC_BACK=1` 时执行原 rsync（加注释说明原因）。

### 修复任务验收结果
| 任务 | Worker | 结果 |
|---|---|---|
| F1 pixivImporter 3 个 bug | pi free-ds | ✅ 通过。ID 规则抽成 4 个常量正则统一 4–15 位 + `(?!\d)`；空读音只留基字；错误优先级：原生桥 → /api/pixiv → Pixiv 级联 message → lastError。测试改为断言新行为并新增用例，3 个 todo 已删除。 |
| F2 todo 分诊落地 | pi free-ds | ✅ 通过。5 条设计如此的 todo 改为 `// Reviewed:` 注释，保留 1 条重叠 override 真 todo。 |
| F3 ruby-align + 单向同步 | pi free-ds | ✅ 通过。全局 `ruby { ruby-align: center; }` + 回归测试；构建脚本回传改为 `SYNC_BACK=1` 才执行（bash -n 语法通过）。 |

复核：`npm test` 211 项（210 通过 / 0 失败 / 1 todo），tsc / eslint 无错误；浏览器阅读器中「約束」computed `ruby-align: center`、基字紧密、说话人无重复。**至此本轮所有代码改动均由 worker 实现、Leader 分诊与验收。**
