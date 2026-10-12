<div align="center">

  <img src="public/logo.png" alt="Furigana Dubbing Studio Logo" width="120" height="120" style="border-radius: 24px;" />

  # 🎌 Furigana Dubbing Studio (假名标注工具)

  **基于新拟物派 (Neumorphism) 设计系统的高精度日语上下文假名注音、动态台本标题与多格式配音台本导出系统**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/Version-v1.0.1-emerald.svg)](RELEASE_NOTES.md)
  [![Next.js](https://img.shields.io/badge/Framework-Next.js_16-black?logo=next.js)](https://nextjs.org/)
  [![TailwindCSS](https://img.shields.io/badge/Style-Tailwind_v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
  [![Python](https://img.shields.io/badge/Desktop-PyWebView_&_PyInstaller-3776ab?logo=python)](https://python.org/)

</div>

---

## 📖 项目简介 (Introduction)

**Furigana Dubbing Studio** 是一款专为声优配音、日语学习者、字幕组与台本编辑设计的现代化日语假名注音与台本导出工具。

本工具采用精致的 **新拟物派 (Neumorphism)** 视觉设计，通过极性双重光影（亮/暗）打造凸起与凹陷的柔和立体触感。内核配备**前后文多音字消歧形态素引擎**与**原生 Word Ruby 排版生成器**，提供极速流畅的在线编辑、动态台本命名、交互式校对与一键批量导出体验。

---

## ✨ 核心特性 (Features)

- 🎯 **离线词典与上下文读音规则**
  - 网页及 PyWebView 桌面版使用本地 Kuromoji 词典，结合 `辛い`、`何`、`風`、`行っ` 等上下文规则。歧义、人名、古语仍需要人工校对。
  - **词组与送假名对齐**：保留连续汉字的整体读音，例如 `二人(ふたり)`、`大人(おとな)`；按词中的假名对齐 `取り戻し` 等送假名，不再猜测每个汉字的音节分配。
  - **Word 导入保真**：保留带注音的汉字正文，优先使用原文件读音；兼容标准及旧版段落级 Ruby。

- 📝 **智能动态台本标题联动**
  - **自适应文件名**：导入 `.txt` / `.srt` / `.docx` 文本时，系统自动识别原文件名（如《歪な鳥籠》），导出 Word 时顶部一级大标题自动命名为对应的台本名称。
  - **实时修改**：编辑区顶部常驻台本标题输入框与快速导入按钮，方便随时自定义。

- ⚡ **纯粹极速、零网络依赖**
  - 去除繁琐的网络外部翻译 API 与配置门槛，全部注音与消歧逻辑均在本地毫秒级完成。
  - 界面排版专注纯净，无多余副行干扰，离线断网环境下依然稳定高效。

- ✏️ **交互式点击读音校对**
  - 在实时排版预览区，直接点击汉字即可弹出校对浮窗，选择候选读音或输入自定义读音。
  - **词组整体注音**：例如点击「二」，使用「向右扩展」选中「二人」，输入「ふたり」后保存。假名会居中显示在整个词组上方，Word 导出保留该标注。
  - **稳定台本身份**：校对按持久化台本 ID、完整原文行和字符范围保存，修改标题不会丢失。重新导入和批量处理按正文 SHA-256 指纹找回记录；同名但正文不同的台本分别保存，正文完全一致的文件复用校对。已改动的原文行需要重新检查。
  - **专名词典与语境学习**：
    - 支持人名、地名和作品专名的增删改、搜索、JSON 导入导出；校对时可选择加入词典，跨台本复用。按原文精确匹配、长词优先。
    - **语境智能学习**：确认多音字读音后自动提取短句前后文特征存入台本记录；同一台本处于相同语境的同形词自动套用，无需重复复核，并可在「已学语境」中管理与删除。
    - 优先级顺序：人工精确校对 > Word 原注音 > 语境已学读音 > 专名词典 > 自动消歧引擎。
  - **连续复核与短句对照**：校对弹窗直观显示目标词所在的完整短句并突出高亮；预览区展示读音来源（自动 / 专名 / 语境学习 / 源文件 / 人工确认）；歧义和缺失读音支持「保存并下一处」连续定位。主动清除的注音不计入缺失读音。
  - 浏览器版使用 `furigana-corrections-v2` localStorage；Windows 桌面版写入 `%LOCALAPPDATA%\\FuriganaDubbingStudio\\corrections-v2.json`。旧版 v1 键和 `corrections.json` 原样保留；历史标题记录在首次匹配原文时绑定台本 ID。平假名与片假名校对可随模式转换；直接输入的罗马音按原样保留。
  - **异步注音**：Kuromoji 和规则在本地 Web Worker 中运行，每 50 行更新进度；继续输入会取消旧预览任务，注音模式切换复用基础读音。Worker 不可用时显式显示分块兼容模式。长台本每页预览 200 行，导出使用完整结果。

- 📄 **全格式专业配音台本导出**
  - **Word (`.docx`)**：完美兼容 Microsoft Word 原生 `<w:ruby>` 振假名结构（假名位于汉字正上方），正文字号、假名字号、行间距自由调节。
  - **字幕 (`.srt`)**：导入保留字幕序号、时间轴和多行分组；导出采用括号注音。修改正文时，只有行数仍与原分组一致才保留时间轴；其他情况生成每行固定间隔的时间轴。
  - **纯文本 (`.txt`)**：干净整洁的标注纯文本。

- 📁 **批量文件处理中心**
  - 支持拖拽多文件同时导入，自动化并行队列注音，一键批量生成导出。

- 💻 **独立原生桌面程序**
  - 提供单文件绿色版 `FuriganaDubbingStudio.exe`，免安装任何环境，双击即用。

---

## 🎨 设计系统 (Design System)

本项目严格遵循 **Neumorphism (新拟物派)** 规范：
- **同色系底色**：基于统一柔和浅灰 `#e0e5ec`，无任何高对比度纯白/纯黑色块。
- **双重极性阴影**：
  - 凸起元素（卡片/按钮）：`shadow-[6px_6px_12px_#b8bcc2,-6px_-6px_12px_#ffffff]`
  - 沉降/内凹元素（输入框/激活态）：`shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff]`
- **真实物理反馈**：按钮默认立体凸起，按压时触发下陷，松开平滑回弹。
- **零显性边框**：摒弃生硬边框线条，纯靠自然光影重塑空间层次。

---

## 🛠️ 技术栈 (Tech Stack)

* **前端框架**：[Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/)
* **样式系统**：[Tailwind CSS v4](https://tailwindcss.com/)
* **分词注音**：Kuromoji（网页与 PyWebView 桌面版）；独立旧 Python 界面使用 Fugashi + UniDic Lite
* **Word 导入与导出**：JSZip + 原生 DOMParser 保留原注音；[docx](https://docx.js.org/) 生成标准 Word Ruby
* **桌面端内核**：[Python 3](https://python.org/) + [PyWebView](https://pywebview.flowrl.com/) + [PyInstaller](https://pyinstaller.org/)

---

## 🚀 快速上手 (Quick Start)

### 1. 克隆仓库

```bash
git clone https://github.com/Cheese-nya/furigana.git
cd furigana
```

### 2. 安装依赖

```bash
npm install
```

### 3. 本地开发调试

```bash
npm run dev
```
打开浏览器访问 [http://localhost:3000](http://localhost:3000)。

### 4. 静态导出与打包 Windows EXE

在 Windows 构建机上安装 Node.js、Python 3 和桌面打包依赖：
```bash
npm ci
pip install pywebview pyinstaller
npm run package:exe
```
该命令构建 `out/` 并将页面、词典一起打包，生成根目录下的 **`FuriganaDubbingStudio.exe`**。此桌面版无需 Fugashi、Sudachi 或 UniDic；这些依赖仅用于独立旧 Python 界面或可选对照评估。Windows 使用 PyWebView 的 WebView2 渲染环境。

离线注音、导入与导出不调用外部服务。校对记录保存于用户数据目录，重新打包程序不会覆盖。Linux 环境只能验证网页产物与桌面桥接逻辑，Windows EXE 需要在 Windows 上构建并验证。

### 5. 验证与真实台本评估

```bash
npm test
python -m unittest discover -s tests -p "test_*.py"
node tools/audit-scripts.mjs "台本目录" audit.json
```

评估工具只读原台本，检查正文完整性并对比文件已有注音。详细结果和可选 Sudachi／MeCab 对照流程见 [离线引擎评估报告](docs/offline-engine-evaluation.md)。

新版存储格式、迁移边界及 Worker 验证流程见 [校对存储与异步注音说明](docs/correction-database-and-worker.md)。浏览器回归脚本 `tools/check-browser.mjs` 使用可选 Playwright，验证生产静态产物中的词典加载、数据迁移、词典复用、任务取消和降级；不会把测试依赖打包进桌面程序。

---

## 📁 目录结构 (Project Structure)

```text
furigana/
├── app/
│   ├── components/       # 新拟物核心组件 (Sidebar, Modal, Dropdown 等)
│   ├── utils/            # 假名分词消歧、Word 原生 Ruby 导出器等
│   ├── globals.css       # 核心 Design System CSS 变量与阴影 Token
│   ├── layout.tsx        # 根布局容器
│   └── page.tsx          # 假名配音台本主业务界面
├── public/               # 静态资源 (Logo, 词典文件, 打赏二维码)
├── app_icon.ico          # Windows 原生多分辨率应用程序图标
├── desktop_runner.py     # PyWebView 桌面端启动核心
├── exporter.py           # Python 端多格式导出脚本
├── furigana_engine.py    # Python 端形态素与消歧引擎
├── tools/                # 只读真实台本评估与可选引擎对照
├── RELEASE_NOTES.md      # 版本更新发布说明
├── LICENSE               # MIT 开源协议
└── README.md             # 仓库说明文档
```

---

## ☕ 支持与打赏 (Sponsor)

如果您觉得这个工具有所帮助，欢迎为作者集齐芝士碎片 🧀！

<div align="center">
  <img src="public/reward_qrcode.png" alt="Reward QR Code" width="220" />
  <p><b>チーズ@beimisama</b></p>
</div>

---

## 📄 开源协议 (License)

本项目基于 [MIT License](LICENSE) 协议开源。
