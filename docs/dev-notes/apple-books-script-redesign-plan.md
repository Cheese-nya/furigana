# Furigana Dubbing Studio — Apple Books & Apple HIG Overhaul Plan

## 1. Design Philosophy & Apple HIG Foundation (via `open-design` Apple Spec)
- **Surface Triad**: Pale Apple Gray (`#f5f5f7`) stage background, Pure White (`#ffffff`) elevated cards/canvases, and Near-Black Ink (`#1d1d1f`) primary typography with Secondary Neutral Gray (`#6e6e73`) metadata and Soft Border Gray (`#d2d2d7` / `rgba(0,0,0,0.08)`).
- **Zero Emoji Chrome**: Functional navigation tabs, toolbars, and action buttons must NEVER use emojis. Use crisp monoline SF-style SVG icons (`strokeWidth={1.75}`) and Apple capsule/segmented geometry (`rounded-full` / `rounded-xl`).
- **Tactile Bookshelf Realism (`Books.app`)**: Scripts in `台本库` are presented on an Apple Books bookshelf with vertical book covers (`aspect-[3/4.2]`) facing the user, realistic left-hinge spine crease lighting, multi-page right edge depth, signature color-band + typographic cover packaging for scripts without custom cover images, and spring-physics hover elevation (`-translate-y-2.5 scale-[1.03]`).
- **Distraction-Free Script Reader**: Tailored strictly for voice-acting scripts (`台本`). Wide horizontal canvas (`max-w-5xl xl:max-w-6xl`), authentic Japanese vertical typesetting (`縦書き` / `writing-mode: vertical-rl`), default Gothic font (`ゴシック体`), translucent warm yellow word-hover glow (`rgba(253, 224, 71, 0.32)`), and zero TTS or chapter-splitting clutter.

---

## 2. Requirement-by-Requirement Implementation Map

### Phase 1: Core Data, Watermark/Suffix Cleanup & One-Click Batch Saving
1. **Remove Export Watermark & Clean Legacy Scripts (`app/utils/docxExporter.ts`, `app/utils/docxImporter.ts`, `app/utils/libraryDatabase.ts`)**:
   - In `app/utils/docxExporter.ts`:
     - Remove the bottom footer horizontal rule and watermark paragraph (`由 Furigana Dubbing Studio 自动生成 • チーズ@beimisama`).
     - Remove the header subtitle paragraph (`Furigana Dubbing Studio 自动注音导出`) so exported `.docx` files contain only the document title and script lines.
   - In `app/utils/docxImporter.ts`:
     - Export `stripExportWatermark(text: string): string` and `cleanScriptTitle(title: string): string`.
     - `stripExportWatermark` removes any lines matching `/^(?:由\s*Furigana Dubbing Studio\s*自动生成.*|Furigana Dubbing Studio\s*自动注音导出)\s*$/u` and trims redundant leading/trailing blank lines left by exported separators.
     - `cleanScriptTitle` strips trailing `_dubbing` (case-insensitive, e.g., `foo_dubbing` -> `foo`) and trims whitespace.
     - `parseDocxXml` filters out paragraphs matching the watermark/subtitle before joining paragraphs and computing overrides.
   - In `app/utils/libraryDatabase.ts`:
     - **Single-Script Chapter Model**: Update `extractChapters(text: string, fallbackTitle = '全文')` so it **never** splits scripts into multiple chapters. Always return a single chapter covering the entire script:
       `[{ id: 'chapter:1', title: cleanScriptTitle(fallbackTitle) || '全文', startLine: 0, endLine: Math.max(0, lines.length - 1) }]`.
     - **Automatic Migration of Stored Scripts**: In `upsertBook` and `validateBook`, automatically apply `cleanScriptTitle(title)`, `stripExportWatermark(content)`, and single-chapter normalization (`chapters: extractChapters(cleanContent, cleanTitle)`, clamping `readingProgress.chapterIndex` to `0`). This cleans all existing user scripts in `localStorage` / `IndexedDB` on load.
2. **One-Click Batch Saving Without Per-File Popups (`app/utils/fileSave.ts`, `app/components/BatchProcessingPanel.tsx`, `app/page.tsx`)**:
   - Remove `_dubbing` from all exported filenames (`${cleanScriptTitle(itemTitle)}.${outExt}`).
   - In `app/utils/fileSave.ts`:
     - Add `SaveOptions { skipFilePicker?: boolean }` to `saveBlob(blob, filename, options)` so batch direct downloads can bypass per-file `showSaveFilePicker`.
     - Add `BatchSaveMode = 'folder' | 'zip' | 'direct'`.
     - Add `pickBatchDirectory(): Promise<FileSystemDirectoryHandle | null>` (wraps `window.showDirectoryPicker({ mode: 'readwrite' })`, returning `null` on `AbortError`).
     - Add `saveBlobToDirectory(dirHandle, blob, filename): Promise<SaveResult>` to write each file directly into the chosen folder without any popup.
     - Add `buildBatchZipBlob(files: Array<{ filename: string; blob: Blob }>): Promise<Blob>` using `JSZip` so all batch outputs can be saved as a single `.zip` archive in one click.
   - In `app/components/BatchProcessingPanel.tsx` & `app/page.tsx`:
     - Provide a clean Apple segmented selector for Batch Save Mode:
       - **合并打包 ZIP（一键保存）** (`'zip'`) — bundles all converted scripts into a single `.zip` and triggers only 1 save action at the end.
       - **选择文件夹直存（免弹窗）** (`'folder'`) — prompts once for a directory right on click via `showDirectoryPicker` and writes every converted file directly into that folder (falls back to `'zip'` if browser doesn't support `showDirectoryPicker`).
       - **浏览器直接下载** (`'direct'`) — downloads files using `saveBlob(..., { skipFilePicker: true })` without invoking `showSaveFilePicker`.
     - Add a checkbox/toggle **"同时存入台本库 (Also save to Script Library)"** (default `true`) so batch-processed scripts are automatically added to `台本库` as well!

### Phase 2: Apple HIG Global Chrome, Zero Emojis, Banner Removal, Yellow Hover Glow & Vertical Preview
1. **Translations & Terminology (`app/utils/i18n.ts`)**:
   - Rename `书库` / `内置书库` -> `台本库` (`Script Library`), `书籍` -> `台本`.
   - Strip ALL emojis (`📝`, `📚`, `📖`, `📁`, `📂`, `👀`, `🚀`, `🛠️`, `🔄`, `✅`, `✏️`) from navigation tabs, buttons, and modal headers.
   - Add i18n keys for writing direction (`writingModeLabel`: `排版方向`, `writingModeHorizontal`: `横向排版 (横書き)`, `writingModeVertical`: `竖向排版 (縦書き)`), batch save modes (`batchSaveModeLabel`, `batchSaveModeZip`, `batchSaveModeFolder`, `batchSaveModeDirect`, `batchSyncToLibrary`), and bookshelf actions.
2. **Editor Cleanup & Typography (`app/page.tsx`, `app/globals.css`)**:
   - **Delete the Hero Banner Card** (`t.bannerTitle` / `t.bannerSubtitle` section) in `app/page.tsx`.
   - **Apple Segmented Navbar**: Replace top navbar tab buttons with an Apple HIG segmented pill bar (`bg-[#f5f5f7] p-1 rounded-full border border-black/[0.06]`) using crisp monoline SVG icons + text labels (no emojis).
   - **Translucent Soft Yellow Hover Glow**:
     - Replace `hover:bg-blue-50 hover:text-blue-900` in `app/page.tsx` and `hover:bg-current/10` in `ReaderPanel.tsx` with `.ruby-interactive-token`:
       - Soft translucent warm yellow highlight (`hover:bg-amber-200/35 focus-visible:bg-amber-200/40 shadow-[0_0_10px_rgba(250,204,21,0.28)]`) that keeps `<rt>` completely unobstructed (`overflow: visible`, `<rt>` outside background fill or transparent).
   - **Default Font = Gothic (`ゴシック体`) & Vertical Writing Mode (`竖向排版`)**:
     - Ensure `.script-line` and Reader default to Gothic (`"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif`).
     - Add Writing Direction (`横排 / 竖排`) and Font Family (`ゴシック体 / 明朝体`) controls to Editor's `排版设置` popover so Editor live preview also supports vertical `vertical-rl` script preview!

### Phase 3: Apple Books (`Books.app`) 3D Script Bookshelf UI (`app/components/LibraryPanel.tsx`)
1. **Remove "Backup & Maintenance (备份与维护)"**:
   - Remove the `备份与维护` dropdown and backup/restore buttons from `LibraryPanel.tsx`.
   - Simplify filter bar to Search + `全部` / `收藏` (and format badges) since all items are scripts (`台本`).
2. **Apple Books 3D Vertical Cover Shelf**:
   - Responsive bookshelf grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10`.
   - Each script renders as a **vertical 3D book cover facing the user (`aspect-[3/4.2]`)**:
     - **Default Packaging (No Custom Cover Image)**:
       - Top color band (`h-[26%]`) in refined book-cloth tones with format pill (`DOCX` / `TXT` / `SRT`) and favorite star button.
       - Warm archival paper lower cover (`bg-[#fbfaf7]`) with vertical/editorial border accent, bold Gothic script title (`line-clamp-3`), author/note label, total line count (`{count} 行`), and slim reading progress bar at the bottom edge.
     - **Optional Custom Cover Image**: Support optional cover image upload/URL in the "New/Edit Script" composer, rendering full-bleed cover art with spine crease when present, or the signature color-band + title cover when absent.
     - **Book Spine Crease & Page Edges**:
       - Left spine hinge lighting gradient (`linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(0,0,0,0.2) 3%, rgba(255,255,255,0.35) 5.5%, transparent 11%)`).
       - Realistic multi-layer paper edge & shelf shadow (`shadow-[0_10px_22px_-6px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.06),inset_-2px_0_0_rgba(255,255,255,0.6)]`).
     - **Interactive Pointer Hover Animation**:
       - Smooth Apple spring lift on pointer hover (`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2.5 hover:scale-[1.03] hover:shadow-[0_22px_38px_-10px_rgba(0,0,0,0.24)]`).
       - Clicking the cover opens the script in the Reader; quick-action pill bar (`阅读` / `编辑` / `删除`) appears cleanly on hover and remains tap-accessible on mobile/Android.
     - **Shelf Ledge Visual**: Subtle Apple Books shelf ledge line/shadow beneath rows.

### Phase 4: Minimalist Script-Only Reader with Wide Layout & Vertical Writing (`app/components/ReaderPanel.tsx`)
1. **Strip All Non-Script / Distracting Features**:
   - Remove all TTS / `window.speechSynthesis` code, state, speed selector, and speaker icons.
   - Remove chapter TOC drawer (`toc`), bookmarks drawer (`bookmarks`), per-line bookmark/TTS gutter buttons, chapter header banner, and bottom chapter pagination footer (`上一章 / 下一章`).
2. **Streamlined Apple Books Top Bar**:
   - Left: Back to `台本库` button + Script Title + total lines badge (`{count} 行`).
   - Center/Right:
     - Quick **Writing Mode Segmented Toggle** (`横排` / `竖排`).
     - **Ruby Visibility Segmented Control** (`全部显示` / `点按显示` / `仅重难点` / `隐藏注音`).
     - **Search Toggle** (`搜索`) & **Typography Settings Popover (`Aa 排版设置`)** & **Edit in Studio (`编辑`)**.
3. **Typography Defaults & Wide / Vertical Script Canvas**:
   - Default `fontFamily` in `loadPrefs()` set to `'sans'` (`ゴシック体`), with option to switch to `'serif'` (`明朝体`).
   - Default `writingMode` in `loadPrefs()` set to `'horizontal'`, with one-click switch to `'vertical'` (`縦書き`).
   - **Horizontal Mode (`writingMode === 'horizontal'`)**:
     - Wide reading canvas: `mx-auto max-w-5xl xl:max-w-6xl px-4 md:px-10` so voice-acting script lines don't wrap prematurely.
   - **Vertical Mode (`writingMode === 'vertical'`)**:
     - Traditional Japanese vertical script layout (`writing-mode: vertical-rl; text-orientation: mixed;`) in a full-width horizontal scroll container (`w-full h-[calc(100vh-170px)] min-h-[520px] overflow-x-auto overflow-y-hidden py-8 px-6 md:px-12`) with right-to-left column flow and vertical `<ruby>` alignment.
   - **Word Hover Highlight**:
     - Uses `.ruby-interactive-token` translucent soft warm yellow glow (`rgba(253, 224, 71, 0.32)`) so top/side furigana `<rt>` is 100% legible and never covered.
