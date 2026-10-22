<div align="center">

  <img src="public/logo.png" alt="Furigana Dubbing Studio Logo" width="100" height="100" style="border-radius: 20px;" />

  # Furigana Dubbing Studio

  An offline Japanese furigana (ruby) annotation and typesetting tool tailored for Japanese learners.  
  Eliminates homograph misreadings, counter sound changes, compound word splits, and Word ruby misalignment.

  <p>
    <b>English</b> • <a href="README.md">简体中文</a>
  </p>

  [![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-orange.svg)](LICENSE)
  [![Version](https://img.shields.io/github/package-json/v/Cheese-nya/furigana?label=Version&color=10b981)](RELEASE_NOTES.md)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
  [![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
  [![Desktop](https://img.shields.io/badge/Desktop-Windows_EXE-3776ab?logo=windows)](https://github.com/Cheese-nya/furigana)

</div>

---

## Problems Solved

Generic dictionary lookup tools often produce incorrect furigana when encountering contextual ambiguities:

| Category | Typical Error | How This Tool Handles It |
| :--- | :--- | :--- |
| **Homographs (多音字)** | Misidentifies `辛い` (spicy vs. painful) | Analyzes particles and context to distinguish `からい` from `つらい`; resolves `何` (`なに`/`なん`) and `風` (`かぜ`/`ふう`) identically |
| **Counter Sound Changes (量词音变)** | `一発` / `一本` rendered as *ichihatsu* / *ichihon* | Applies counter phonological rules to output correct gemination and rendaku: `いっぱつ`, `いっぽん`, `三分 (さんぷん)`, etc. |
| **Jukujikun & Compounds (熟字訓)** | `二人` split into `二(に)人(にん)` | Recognizes whole compounds as units (`二人` → `ふたり`, `大人` → `おとな`); accurately aligns okurigana in compound verbs (`取り戻し`) |
| **Print & Export Alignment** | Ruby drops into raw brackets or misaligns in Word | Generates native Word `<w:ruby>` XML tags centered directly above kanji; customizable font sizes and line spacing |

Runs 100% locally in the browser and desktop runner. Zero network dependencies, zero telemetry.

---

## Screenshots

### Main Workbench
Paste source text on the left, preview annotated furigana on the right in real time. Switch between Hiragana, Katakana, and Romaji with pagination for long texts.

<p align="center">
  <img src="docs/images/workbench-preview.png" alt="Workbench" width="850" />
</p>

### Interactive Correction & Compound Word Selection
Click any kanji to view reading candidates and surrounding clause context. Expand selection to the right to annotate compound phrases (e.g. extending `二` to `二人` for `ふたり`). Confirmed readings can be automatically learned for identical contexts across the document.

<p align="center">
  <img src="docs/images/reading-correction.png" alt="Correction modal" width="850" />
</p>

### Proper Noun Glossary
Manage custom names, fictional terms, and irregular readings. Longest-match matching takes priority over dictionary entries. Supports JSON import and export.

<p align="center">
  <img src="docs/images/glossary-manager.png" alt="Glossary manager" width="850" />
</p>

### Batch File Processing
Drop multiple `.txt`, `.srt`, or `.docx` files into the queue. Automatically extracts titles from filenames, annotates in parallel, and exports in batch.

<p align="center">
  <img src="docs/images/batch-processing.png" alt="Batch processing" width="850" />
</p>

---

## Feature Overview

- **Context-Aware Morphological Engine**: Powered by offline Kuromoji with custom disambiguation heuristics and counter lexicon rules.
- **Three Notation Modes**: Hiragana (learners), Katakana (advanced/loanwords), Romaji (pronunciation guide).
- **Asynchronous Web Worker**: Offloads tokenization and rule evaluation to a background thread to prevent UI freezing during typing; features debounced cancellation and incremental progress updates.
- **Interactive Review & Correction**:
  - Click any token to inspect and adjust readings against sentence context.
  - Rightward token expansion for multi-character compound ruby.
  - Contextual memory: applies corrections across identical syntactic contexts in the same document.
  - Strict priority order: Manual correction > Source Word ruby > Learned context > Glossary > Morphological engine.
- **Multi-Format Import & Export**:
  - **Word (`.docx`)**: Native `<w:ruby>` superscript layout; supports round-trip import preserving existing ruby.
  - **Subtitles (`.srt`)**: Preserves timecodes and multi-line cues; exports annotated subtitles for listening practice.
  - **Plain Text (`.txt`)**: Clean bracketed furigana text.
- **Persistent Storage**: Uses document SHA-256 fingerprint indexing so corrections persist across renames and re-imports.

---

## Quick Start

### Installation & Development

```bash
git clone https://github.com/Cheese-nya/furigana.git
cd furigana
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### Run Tests

```bash
npm test
```

### Build Standalone Windows EXE

On a Windows build machine:

```bash
pip install pywebview pyinstaller
npm run package:exe
```

Outputs a self-contained portable executable `FuriganaDubbingStudio.exe` in the project root.

---

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS v4
- **Morphological Engine**: Kuromoji.js (Web Worker offline execution)
- **Document Processing**: docx, JSZip, xmldom
- **Desktop Wrapper**: PyWebView (WebView2) + PyInstaller

---

## Project Structure

```text
furigana/
├── app/
│   ├── components/      # UI components (Sidebar, Modal, GlossaryModal, etc.)
│   ├── utils/           # Tokenizer engine, disambiguation rules, docx/srt parsers
│   ├── workers/         # Dedicated Web Worker
│   └── page.tsx         # Main page & batch workbench
├── docs/images/         # Screenshots and documentation assets
├── public/dict/         # Offline morphological dictionary data
├── tests/               # Automated unit test suite
└── desktop_runner.py    # Desktop runner bridge
```

---

## License

- **Source code**: commits after v1.2.0 are licensed under [PolyForm Noncommercial 1.0.0](LICENSE). Personal, educational, research, and other **noncommercial** use, modification, and distribution are permitted; **commercial use is not**. Contact the author for a commercial license.
- **Earlier releases**: v1.2.0 (commit `6b3804a`) and earlier were released under the MIT License and remain available under MIT.
- **Name and icons**: not covered by the license; see [TRADEMARKS.md](TRADEMARKS.md).
- **Third-party components**: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **Contributing**: see [CONTRIBUTING.md](CONTRIBUTING.md) and the [CLA](CLA.md).
