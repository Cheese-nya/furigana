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

- 🎯 **前后文（上下文）高精度假名消歧**
  - **语义感知定音**：基于形态素上下文 Viterbi 最优路径，结合双向滑动窗口语义规则，彻底解决高频同形異音語（如 `辛い(からい/つらい)`、`何(なん/なに)`、`角(かど/つの/かく)`、`風(ふう/かぜ)`、`方(かた/ほう)`、`一日(いちにち/ついたち)` 等）。
  - **熟字训与送假名剥离**：支持 `日本人(にっぽんじん)`、`大人(おとな)`、`山田先生(やまだせんせい)` 完美逐字切分对齐。
  - **双引擎同步**：Web 端 Kuromoji 引擎与 Python 原生端 `fugashi` + `unidic_lite` 同步消歧规则。

- 📝 **智能动态台本标题联动**
  - **自适应文件名**：导入 `.txt` / `.srt` / `.docx` 文本时，系统自动识别原文件名（如《歪な鳥籠》），导出 Word 时顶部一级大标题自动命名为对应的台本名称。
  - **实时修改**：编辑区顶部常驻台本标题输入框与快速导入按钮，方便随时自定义。

- ⚡ **纯粹极速、零网络依赖**
  - 去除繁琐的网络外部翻译 API 与配置门槛，全部注音与消歧逻辑均在本地毫秒级完成。
  - 界面排版专注纯净，无多余副行干扰，离线断网环境下依然稳定高效。

- ✏️ **交互式点击读音校对**
  - 在实时排版预览区，直接点击任意汉字/假名即可弹出校对浮窗，提供该语境下的常见候选读音，亦支持输入自定义声优特殊读音。

- 📄 **全格式专业配音台本导出**
  - **Word (`.docx`)**：完美兼容 Microsoft Word 原生 `<w:ruby>` 振假名结构（假名位于汉字正上方），正文字号、假名字号、行间距自由调节。
  - **字幕 (`.srt`)**：带假名注音的标准配音台本与字幕格式。
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
* **分词注音**：Kuromoji (Web) / Fugashi + UniDic Lite (Python)
* **Word 渲染**：[docx](https://docx.js.org/) (Native Ruby w:ruby generator)
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

确保本地已安装 Python 3 及相关依赖：
```bash
pip install pywebview pyinstaller fugashi unidic-lite python-docx
```

执行打包命令：
```bash
npm run build
python -m PyInstaller --noconfirm FuriganaDubbingStudio.spec
```
编译完成后将在根目录下生成可直接双击运行的 **`FuriganaDubbingStudio.exe`**。

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
├── FuriganaDubbingStudio.spec # PyInstaller 打包描述文件
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
