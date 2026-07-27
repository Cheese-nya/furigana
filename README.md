<div align="center">

  <img src="public/logo.png" alt="Furigana Dubbing Studio Logo" width="120" height="120" style="border-radius: 24px;" />

  # 🎌 Furigana Dubbing Studio (假名标注工具)

  **基于新拟物派 (Neumorphism) 设计系统的专业级日语假名注音与配音台本处理系统**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Next.js](https://img.shields.io/badge/Framework-Next.js_16-black?logo=next.js)](https://nextjs.org/)
  [![TailwindCSS](https://img.shields.io/badge/Style-Tailwind_v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
  [![Python](https://img.shields.io/badge/Desktop-PyWebView_&_PyInstaller-3776ab?logo=python)](https://python.org/)

</div>

---

## 📖 项目简介 (Introduction)

**Furigana Dubbing Studio** 是一款专为声优配音、日语学习者、字幕组与台本编辑设计的现代化日语假名注音与台本导出工具。

本工具采用了极其精致的 **新拟物派 (Neumorphism)** 视觉语言，通过完美的极性双重阴影（亮/暗）打造凸起与凹陷的柔和立体触感，提供流畅无缝的在线编辑与桌面本地应用体验。

---

## ✨ 核心特性 (Features)

- 🎙️ **台本在线编辑器**
  - 支持智能假名注音（平假名 / 片假名 / 罗马音一键切换）。
  - 内置 AI 双语翻译实时预览。
  - 动态字号调节（默认小四 16px 规范）。
- 📁 **批量文件处理中心**
  - 支持拖拽上传与批量解析 `.txt` / `.srt` 台本文件。
  - 自动化并行注音并一键批量导出。
- 📄 **多格式专业导出**
  - **Word (`.docx`)**：完美兼容 Microsoft Word 原生 Ruby 节点格式。
  - **字幕 (`.srt`)**：带假名注音的声优练习字幕。
  - **纯文本 (`.txt`)**：干净的纯文本台本。
- 🛠️ **依赖诊断与一键修复**
  - 内置 MeCab (Fugashi)、UniDic Lite 词典及导出组件健康度检查与自动修复。
- 💻 **跨平台桌面端集成**
  - 基于 `PyWebView` 独立原生窗口打包，无需依赖系统外部浏览器，支持一键双击无缝运行。

---

## 🎨 设计系统 (Design System)

本项目严格遵循 **Neumorphism (新拟物派)** 规范：
- **同色系底色**：基于统一柔和浅灰 `#e0e5ec`，无任何高对比度纯白/纯黑色块。
- **双重极性阴影**：
  - 凸起元素（卡片/按钮）：`shadow-[6px_6px_12px_#b8bcc2,-6px_-6px_12px_#ffffff]`
  - 沉降/内凹元素（输入框/激活态）：`shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff]`
- **零显性边框**：摒弃粗边框，纯靠光影重塑层次。

---

## 🛠️ 技术栈 (Tech Stack)

* **前端框架**：[Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/)
* **样式引擎**：[Tailwind CSS v4](https://tailwindcss.com/) (Vanilla Tailwind CSS)
* **桌面端封装**：[Python 3](https://python.org/) + [PyWebView](https://pywebview.flowrl.com/) + [PyInstaller](https://pyinstaller.org/)
* **图标资源**：FontAwesome / Heroicons / 自定义矢量 SVG

---

## 🚀 快速上手 (Quick Start)

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/furigana-dubbing-studio.git
cd furigana-dubbing-studio
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

### 4. 静态导出与打包 EXE

确保本地已安装 Python 3 及相关依赖：
```bash
pip install pywebview pyinstaller
```

执行一键打包命令：
```bash
npm run package:exe
```
打包完成后将在项目根目录下生成可直接双击运行的 **`FuriganaDubbingStudio.exe`**。

---

## 📁 目录结构 (Project Structure)

```text
liquid-glass/
├── app/
│   ├── components/       # 核心 Neumorphism 组件 (Sidebar, Modal, Dropdown, Tooltip)
│   ├── utils/            # 假名分词与 SRT/Word 导出解析器
│   ├── globals.css       # 核心 Design System CSS 变量与阴影 Token
│   ├── layout.tsx        # 根布局容器
│   └── page.tsx          # 假名标注工具主业务页面
├── public/               # 静态资源 (Logo, 二维码, 打赏图标)
├── desktop_runner.py     # PyWebView 桌面端启动内核
├── make_proper_ico.py    # Windows 多分辨率 ICO 图标生成器
├── package.json          # npm 脚本与依赖清单
├── LICENSE               # MIT 开源协议
└── README.md             # 项目说明文档
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
