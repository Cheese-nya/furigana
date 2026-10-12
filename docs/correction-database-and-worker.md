# 校对存储 v2 与异步注音

## 台本身份

台本的持久化 ID 为 `script:<UUID>`，与可编辑标题分离。标题变化、当前编辑会话中的正文变化均不改变 ID。正文保存完整 SHA-256 指纹，保留已编辑版本的指纹；重新导入和批量处理通过指纹寻找已有台本。

指纹只统一 CRLF/CR 为 LF，不删除空格、空行或 Unicode 差异，避免把字符范围不同的台本误认成同一份。完全相同正文即使文件名不同也复用校对；同名不同正文创建独立台本。外部修改后的文件若没有已知指纹，创建新台本，不自动按标题套用 v2 校对。

单处校对仍以完整原文行、起点和文字范围精确匹配。编辑其他行不会影响它；修改该行后暂不应用旧校对，不进行模糊迁移。同一台本中完全相同的重复行仍共享行级覆盖，这是沿用 v1 的范围语义。

## 存储与迁移

数据库根结构为 `{ version: 2, glossary, scripts }`。每份台本保存 `scriptId`、`title`、`fingerprints`、`updatedAt` 和 `overrides`。词典条目保存 `surface`、`reading`、`type` 和 `createdAt`。

- 浏览器：读取 `furigana-corrections-v2`；不存在时迁移 `furigana-corrections-v1`。v1 键原样保留，v2 写入单独的键。
- 桌面：读取 `corrections-v2.json`；不存在时读取旧 `corrections.json` 并交由前端迁移。v2 使用独立文件、锁、临时文件、flush/fsync 和原子替换。旧文件不变，旧版应用继续读写旧文件。
- 旧记录保留为 `legacy:<标题>`。首次导入同标题且至少存在一条相同原文行时，复制完整覆盖并记录 `adoptedBy`；后续同名不同正文不会再次继承。旧源记录保留，不删掉无法应用的覆盖。
- v2 结构、词典或校对条目损坏，以及未知版本，均报错并停止正常加载/自动保存。不会用空数据库覆盖失败数据。没有有效旧台本身份的情况下，首次绑定无法证明是原文件，仍应人工核对。
- 写入按请求顺序串行执行，避免桌面桥接的旧保存请求晚完成而覆盖新版本。浏览器多标签页同时编辑同一数据库仍采用最后写入结果，不提供跨标签页合并。

桌面 v2 需要新版启动器的 `load_correction_database` / `save_correction_database` API。更新前端而保留旧启动器会提示升级，不自动转用易受端口影响的 localStorage。

## 专名词典

使用字面值精确匹配，从左到右优先匹配最长词，可跨自动分词边界；正则元字符不具有特殊意义。适合人物名、地名和作品专名。词典是全局的，加入前应确认所有同名文字都适用。

覆盖优先级：单处人工校对 > Word 原注音 > 全局专名词典 > 自动词典/规则。主动不注音是显式人工覆盖，保留来源且不计入缺失读音。覆盖切开自动词组时，无法可靠保留读音的残片会标记待复核。

词典管理支持搜索、添加、修改、删除，以及 JSON 导入导出。导入逐项校验，遇到错误整体拒绝；同名冲突保留当前词典定义。导出格式为 `{ kind: 'furigana-glossary', version: 1, entries }`。罗马音条目在其他模式也按原样显示，假名条目按当前注音模式转换。

## Worker 与预览

页面向 Worker 发送 `INIT`（词典路径）、`ANNOTATE`（任务 ID、正文、模式、覆盖和词典）和 `CANCEL`。Worker 回传 `READY`、`CHUNK`、`COMPLETE` 或 `ERROR`。

每块最多 50 行，块间让出事件循环，使取消消息能被处理。缓存最多 12,000 个原文行的基础平假名读音，模式转换和覆盖不会改动缓存。页面输入防抖 120ms；文本或配置变化即取消旧任务，过期响应不会进入新预览。批量文件使用同一服务请求完整结果，单文件导出在当前预览未完成或失败时禁用。

Kuromoji 的 doublearray 旧依赖在浏览器分支访问 `window`；Worker 在动态加载该依赖前提供仅限自身的全局别名。词典使用同源的绝对路径，兼容本地 HTTP 桌面程序和子目录部署，不向外部服务请求注音。

Worker 构造/运行失败或启动超时后，页面明确显示分块兼容模式。兼容模式尝试加载完整词典并使用相同的计算与覆盖流程；词典加载失败则显示基础词表降级状态，可重新加载。兼容模式仍会占用主线程，长行和大文件的首次处理也不保证固定帧率。

预览每页渲染最多 200 行，可前后翻页，待复核定位自动跳到目标页。导出采用所有行，分页不会截断输出。

## 验证

基础回归：

```bash
npm test
python -m unittest discover -s tests -p 'test_*.py'
npx tsc --noEmit
npm run build
```

可选 Chromium 端到端验证针对 `out/` 静态产物，测试内容包括完整词典 Worker、v1 迁移、改名后重载、同名隔离、专名词典增改删/导入导出、覆盖优先级、7,491 行的任务取消和完整分页，以及禁用 Worker 时的兼容模式。

```bash
# 不添加到项目依赖，安装到独立临时目录。
npm install --prefix /tmp/furigana-browser-qa playwright --no-audit --no-fund
/tmp/furigana-browser-qa/node_modules/.bin/playwright install chromium
npm run build
python -m http.server 8765 --bind 127.0.0.1 --directory out
# 在另一终端运行：
PLAYWRIGHT_MODULE=/tmp/furigana-browser-qa/node_modules/playwright/index.mjs node tools/check-browser.mjs
```

已有 Playwright 安装时可直接运行 `node tools/check-browser.mjs`。`FURIGANA_TEST_URL` 可指定其他本地地址；每次验证使用独立浏览器上下文，不修改日常浏览器的校对数据。测试将保存对话框切换为浏览器下载路径；Windows WebView2 的原生对话框仍需在 Windows 构建机验证。

本次 Linux Chromium 实测 7,491 行合成台本完整注音、导入与首屏渲染约 1.3 秒，无页面异常。耗时依赖机器、行长度和缓存状态，不代表固定帧率或所有真实台本的速度。
