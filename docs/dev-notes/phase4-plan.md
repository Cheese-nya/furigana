# Phase 4 — 收尾计划（Leader: Claude）

> 起点：Phase 3 全部验收（211 测试：210 通过 / 1 todo；tsc / eslint 干净）。
> 新增 worker：**Opus 5.5**（Claude Code 子代理，`model: opus`，可运行测试），承担难任务；pi free-ds 承担小而明确的任务。
> 所有 worker 在同一工作区并行，**文件所有权互斥**；不得 git commit / push、不得新增依赖、不得引入 emoji、不得放宽既有测试断言。

## 剩余问题

| # | 问题 | 处理 |
|---|------|------|
| 1 | `app/page.tsx` 仍 1767 行：工作台视图 ~500 行、批处理逻辑 ~220 行、书库联动 ~230 行都在一个组件里 | G1 |
| 2 | 主流程只做过轻量检查，缺少用真实 Kuromoji 词典跑通「导入 → 注音 → 导出」的端到端测试 | G2 + Leader 浏览器 E2E |
| 3 | 重叠 override 使前一条读音丢失（`tests/rubyOverrides.test.mjs` 中唯一的 todo） | G3 |
| 4 | 原生端只验证过「能编译」，没在设备/模拟器里实际运行 | Leader：iOS 模拟器安装运行截图；APK 签名与清单校验 |

## 任务

### G1 — Opus 5.5：拆分 `app/page.tsx`
拥有：`app/page.tsx`、新建 `app/components/EditorWorkspace.tsx`（可再拆子组件）、新建 `app/hooks/useBatchProcessing.ts`、新建 `app/hooks/useLibraryController.ts`、以及**读取 page.tsx 源码做断言**的测试文件中对应断言的读取路径。
- 工作台视图 JSX（`{activeTab === 'editor' && (` 块）→ `EditorWorkspace`；批处理 state + `handleFileSelect / handleDrop / addFilesToQueue / processBatchQueue …` → `useBatchProcessing`；书库联动（`upsertEditorIntoLibrary … handleRemoveBookmark`）→ `useLibraryController`。
- 行为、DOM、className、data-testid 完全不变；目标 `page.tsx` ≤ 700 行。
- 测试中读取 page.tsx 源码的断言，改为读取「page.tsx + 新文件」拼接后的源码，语义不得放宽。
- 不改 `app/utils/**`（属 G2/G3）。

### G2 — Opus 5.5：端到端流程测试 + 修复工具层 bug
拥有：`app/utils/**`（**除** `rubyOverrides.ts`）、新建 `tests/e2ePipeline.test.mjs` 等新测试文件。
- 在 node 中用 `public/dict` 的真实 Kuromoji 词典，对内置示例台本跑完整管线：注音 → 校对覆盖 → 专名词典 → 导出 TXT / SRT / DOCX → 再导入，断言读音（如 山田先生→やまだせんせい、約束→やくそく、一本→いっぽん、三分→さんぷん）与覆盖在往返后保留。
- 覆盖 VTT 导入、批量 ZIP 打包（`buildBatchZipBlob` 解包校验文件名与内容）、书库 JSON 备份导出 → 导入往返。
- 发现的工具层 bug 直接修复并配测试；无法修或属设计取舍的，在汇报中列出。

### G3 — pi free-ds：重叠 override
拥有：`app/utils/rubyOverrides.ts`、`tests/rubyOverrides.test.mjs`
- `validateRubyOverrides`：同一行内与**已保留条目**区间重叠的后续条目丢弃（保留先出现者），与 `upsertRubyOverride` 不允许重叠的不变量一致。
- 把唯一的 `test.todo('suspected bug: overlapping stored entries…')` 换成真实测试：重叠输入经 validate 后只剩不重叠条目，再 apply 时先前条目的读音不丢失。

### Leader 验收
- 每个 worker 的 diff 审查 + `npm test` / tsc / eslint。
- 浏览器 E2E：工作台注音与点按校对、导出（拦截 Blob 校验内容）、存入台本库 → 阅读器、批处理（注入文件）、书库元数据编辑、暗色 / 中英切换、手机宽度。
- 原生：iOS 模拟器（黑苹果 iPhone 17 Pro）安装 Release 构建并截图；APK `apksigner verify` + 清单检查；`desktop_runner.py` 的 Python 测试。

### G4 — pi free-ds：Android 去除无用的麦克风权限（Leader 验收 APK 时发现）
拥有：`android/AndroidManifest.xml`、`android/src/com/cheese/furiganastudio/MainActivity.java`（仅 `onPermissionRequest`）、新建 `tests/androidManifest.test.mjs`
- 朗读（TTS）功能已移除，应用无任何麦克风 / 摄像头用途，但清单仍声明 `RECORD_AUDIO`、`MODIFY_AUDIO_SETTINGS`，且 `WebChromeClient.onPermissionRequest` 对网页的**任何**权限请求一律 `grant`——隐私风险，上架审核也会被标记。
- 删除这两条 `uses-permission`（保留 INTERNET、ACCESS_NETWORK_STATE）；`onPermissionRequest` 改为 `request.deny()`。
- 新建测试读取两份源码断言：清单不含 RECORD_AUDIO / MODIFY_AUDIO_SETTINGS 且仍含 INTERNET；MainActivity 中 `onPermissionRequest` 不再调用 `grant(`。不改其它文件（`tests/readerPanel.test.mjs` 对 MainActivity 的其它断言必须继续成立）。

### G3 验收：❌ 退回返工（G3b）
pi 的实现让 `validateRubyOverrides` 丢弃重叠条目。但严格调用方 `correctionDatabase.validOverrides` 与 `libraryDatabase.validateBook` 以「校验后条数 ≠ 原条数」判定损坏并抛错——已存有重叠数据的用户，整个校对库会报「校对记录格式损坏」而不可用（此前只是显示时丢一条读音）。修复反而把轻微显示问题升级为加载失败。

**G3b 要求**（仍只改 `app/utils/rubyOverrides.ts`、`tests/rubyOverrides.test.mjs`）：
- `validateRubyOverrides` 恢复为**只过滤格式不合法的条目**（不再因重叠丢弃），保证严格调用方行为与原来一致；可保留 `rangesOverlap` / `isRubyOverride` 辅助函数。
- 在 `applyRubyOverrides` 中解决重叠：按 `start` 升序应用时，跳过与**本次已应用条目**区间重叠的后续条目（先出现者胜），使先前读音不丢失。
- 测试：删掉「validate 丢弃重叠」相关断言，改为断言 (1) validate 对重叠但格式合法的输入原样保留；(2) apply 重叠输入时先前条目读音保留、后续重叠条目被忽略；(3) upsert 产物被 validate 原样接受。

## 验收记录
- **G1（Opus）✅**：page.tsx 1767 → 684 行；新增 EditorWorkspace.tsx(654) / useLibraryController.ts(411) / useBatchProcessing.ts(260) / sidebarNavItems.tsx(70)。测试只改读取路径且更严。两处 `eslint-disable set-state-in-effect` 为 locale / activeTab 的挂载后恢复（静态导出水合安全的标准做法）——接受。浏览器 E2E 在重构后代码上跑通：注音、点按校对（台本→てすと）、TXT/DOCX 导出（Blob 内容含校对结果、DOCX 为合法 zip）、存入台本库（3→4）→ 阅读器读到校对、批处理两文件（直接下载、无 `_dubbing`、同步入库）、两步确认删除。
- **G2（Opus）✅**：+36 端到端测试（真实词典）；修 7 个工具层 bug（何+量词、辛い语境回退整句、DOCX 标题书签防往返重复、SRT 尾随空行、VTT 解析、TXT 生成可测）。253 测试：252 通过 / 1 todo。
- **G3（pi）❌ 退回**（见上），G3b / G4 进行中。

## Leader 在 E2E 中发现的新问题
1. **「恢复自动」实为「不注音」**：`removeTokenRuby = () => updateTokenRuby('')` 写入空读音 override（= 主动不注音），与按钮文案相反；且之前因校对学到的语境读音会在删除 override 后重新生效。（原有 bug）
2. **批处理入库格式取自输出格式**：`.txt` 源文件以 DOCX 输出时，书库标记为 DOCX；而书库自身导入按源格式标记。（原有 bug）

## 第二批任务（Leader 决策已写明）

### G5 — Opus 5.5「导入/编辑链路」
拥有：`app/page.tsx`、`app/components/EditorWorkspace.tsx`、`app/components/RubyCorrectionModal.tsx`、`app/hooks/useLibraryController.ts`、`app/hooks/useBatchProcessing.ts`、`app/utils/srt.ts`、新建 `app/utils/inlineRuby.ts`、对应测试与新测试。
1. **恢复自动**：「恢复自动」应删除覆盖该 token 区间的 override，并删除本台本中**同语境**、由该校对学到的 learned 读音（`deleteLearnedReading` 已存在），使自动读音真正恢复。「主动不注音」仍可通过自定义读音留空保存实现，行为不变。
2. **批处理入库格式**：入库 `format` 按**源文件**判定（.docx→docx、.srt/.vtt→srt、其余→txt），与书库导入一致。
3. **接线 G2 的成果**：`useLibraryController` 中本地 `parseVtt` 改用 `srt.ts` 的 `parseVTT`；`page.tsx` 的 `generateTextContent` 的 txt 分支改用 `generateTXT`，确保输出逐字不变。
4. **TXT/SRT 往返读音翻倍**（G2 遗留 todo）：Leader 决策——只把**半角括号**、内容为**纯假名**、且紧跟在汉字串后的 `漢字(かな)` 识别为本应用导出的内联注音：导入时剥离括号、转成 source override（与 DOCX 导入的 sourceOverrides 同一通道）；全角（）一律保留为正文（舞台指示如 鈴木（くしゃみ））。编辑器导入、书库导入、批处理三条入口都要接上。把 e2e 中对应的 `test.todo` 换成真实测试。

### G6 — Opus 5.5「读音规则 + 书库分类」
拥有：`app/utils/counterReadings.ts`、`app/utils/furigana.ts`、`app/utils/libraryDatabase.ts`、`tests/counterReadings.test.mjs`、`tests/furigana.test.mjs`、`tests/libraryDatabase.test.mjs`、`tests/e2ePipeline.test.mjs` 中读音期望部分。
1. **量词读音补全**（G2 列出的缺口）：時（四時よじ、九時くじ）、歳（一歳いっさい、八歳はっさい、十歳じゅっさい、二十歳はたち）、日（一日ついたち/いちにち 有歧义→保留词典读音并进入复核、二日ふつか…十日とおか、十四日じゅうよっか、二十日はつか、二十四日にじゅうよっか）、一＋(週間/軒/歩/件/点/着/通/頭) 促音化、三軒さんげん、三足さんぞく、何軒なんげん。沿用 counterReadings 现有规则结构，不做无依据的扩张。
2. **书库分类**：Leader 决策——`other`→`script` 的迁移只对**旧版（version 1）数据**执行一次；把书库数据版本升到 2，v2 中用户主动选的 `other` 保持不变；Pixiv 书在 v1 迁移时归 script，此后尊重用户选择。更新 `libraryDatabase.test.mjs:284` 对应用例以表达新语义（旧数据迁移 + 新数据保留），不得删除对旧数据迁移的断言。
- **G3b（pi）✅**：validate 恢复只滤格式非法条目（严格调用方行为不变）；重叠在 `applyRubyOverrides` 中按「先出现者胜」解决，且仅实际落到 token 上的条目才阻挡后续重叠。
- **G4（pi）✅**：清单移除 RECORD_AUDIO / MODIFY_AUDIO_SETTINGS；`onPermissionRequest` 改为 `request.deny()`；新增 androidManifest 测试，readerPanel 对 MainActivity 的既有断言仍通过。
- **G6（Opus）✅**：量词读音按清单补全（時/歳/日/一＋量词促音/三軒/三足/何軒，一日保留词典读音并进入复核 いちにち/ついたち）；顺带 何足なんぞく、四時半よじはん、三日間みっかかん 均为正确读音，接受。书库数据升 v2，`other`→`script` 迁移仅对 v1 执行一次。越界改动 `desktop_runner.py`（接受 v1/v2，否则桌面端写 v2 会全部保存失败）——必要且正确，接受；原生端无版本校验，不受影响。仍错（超出清单，记录待后续）：七時ななじ、八軒はちけん、十点じゅうてん、十歩じゅうほ、十七日、四時間よんじかん、一日中、一通り、八頭、3月。
- **G5（Opus）✅**：302 测试全过 / 0 todo。浏览器复核：台本 だいほん → 校对 てすと（已学语境1）→ 恢复自动 → だいほん，已学语境清空、无残留。批处理入库按源格式；VTT 走 `parseVTT`；TXT 走 `generateTXT`（逐字一致）；`inlineRuby.ts` 接入三条导入入口。G5 的歧义项 1/3/4/5/6 按其实现接受。

### G7 — Opus 5.5：内联注音只标汉字部分 + 工作台入库格式
拥有：`app/utils/furigana.ts` 中生成内联文本的函数（若在 srt.ts 则 srt.ts）、`app/utils/srt.ts`、`app/utils/inlineRuby.ts`、`app/page.tsx`、`app/hooks/useLibraryController.ts`、相关测试。
1. Leader 决策（G5 歧义项 2）：TXT/SRT 导出的内联注音改为**只给汉字部分**加注，送假名留在括号外——`辛い(つらい)` → `辛(つら)い`，`読み方(よみかた)` → `読(よ)み方(かた)` 或按 token 读音能可靠拆分的最细粒度；读音无法与送假名可靠对齐时退回整词形式。这样导入端现有规则（半角括号、纯假名、紧跟汉字串）即可无损往返，**不放宽**导入规则。更新导出/往返测试，旧格式的导入兼容保持。
2. 工作台「存入台本库」的 `format` 目前是 `srtCues.length ? 'srt' : 'txt'`，DOCX 打开后入库被标为 txt：记录工作台当前台本的源格式（导入时设定，新建/粘贴为 txt），入库时使用。
- **G7（Opus）✅**：306 测试全过。内联注音只标汉字（`辛(つら)い`、`読(よ)み方(かた)`、`お願(ねが)い`），对齐不唯一或失败时退回整词形式；导入规则未放宽，旧格式仍可导入。浏览器复核：导出 TXT → 工作台重新导入，正文无括号残留、读音落回原汉字、不翻倍。工作台「存入台本库」按源格式（DOCX→docx）。

## Phase 4 最终状态（2026-10-21 23:10）
- `npm test` 306 / 306 通过（0 todo），tsc / eslint 无错误，桌面端 Python 测试 7 / 7。`app/page.tsx` 1767 → 691 行。
- APK：签名校验通过，权限仅 INTERNET / ACCESS_NETWORK_STATE。
- iOS：黑苹果 Xcode 26.5 构建成功（模拟器 + 真机未签名），仅本地 → 黑苹果单向同步；iPhone 17 Pro 模拟器安装运行，旧版 v1 书库数据（含阅读进度）升级后完整保留（`docs/images/phase4/ios-sim-final.png`）。
- 已知遗留（均已记录，非阻塞）：G6 列出的超出清单的少量读音（七時、八軒、十点、四時間 等）、G2 列出的词典本身的误读；内联注音格式的固有限制（G5 歧义项 3）。

## 后续（2026-10-22）
- **G8（agy）✅**：补齐 G6 遗留读音：七時しちじ、八軒はっけん、十点じゅってん、十歩じゅっぽ、十七日じゅうしちにち、四時間よじかん、一日中いちにちじゅう（同时消除一日的复核歧义）、一通りひととおり、3月さんがつ（月 在 1–12 时按助数词处理）。旧测试中「七時→ななじ」改为しちじ。313 测试全过。
- 未改：八頭 在词典中是整词固有名词（やつがしら），无上下文无法可靠判断为はっとう，保留词典读音。
