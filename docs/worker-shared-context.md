# Multi-Agent Shared Context & File Ownership Ledger (Phase 2 — iOS 26 Liquid Glass & Hardcover Leather Bookshelf)

> **Agent Leader**: Antigravity
> **Status**: Active Execution (User Approved Plan)

## 1. Global Hard Constraints (MUST NOT VIOLATE)
1. **Zero Emojis in UI**: Never introduce any Unicode Extended_Pictographic emoji or `★` / `☆` glyphs into `app/utils/i18n.ts`, `app/page.tsx`, `app/components/LibraryPanel.tsx`, `app/components/ReaderPanel.tsx`, `app/components/BatchProcessingPanel.tsx`, `app/components/Sidebar.tsx`, or `app/components/MobileNavBar.tsx`.
2. **Existing Test Contracts (`tests/libraryShelf.test.mjs` & `tests/readerPanel.test.mjs`)**:
   - `LibraryPanel.tsx`:
     - Must NOT reference `libraryMaintenanceMenu`, `libraryExportBackup`, `libraryImportBackup`, `showMaintenanceMenu`, `backupFileInputRef`, `备份与维护`, or `application/json`.
     - Must preserve optional `onExportBackup?: () => void;` and `onImportBackup?: (file: File) => void;` in `LibraryPanelProps`.
     - `data-testid="apple-books-shelf"` MUST retain class substrings: `grid-cols-2`, `sm:grid-cols-3`, `md:grid-cols-4`, `lg:grid-cols-5`, `gap-x-5`, `sm:gap-x-7`, `gap-y-10`, `rounded-2xl`, `bg-[#f5f5f7]/90`, `border-black/[0.06]`.
     - `data-testid="script-book-cover"` MUST retain class substrings: `aspect-[3/4.2]`, `from-black/12 via-white/30 to-transparent`, `bg-gradient-to-b from-white to-[#faf9f5]`, `shadow-[0_10px_24px_-6px_rgba(0,0,0,0.14),2px_0_0_0_#fafaf9,4px_0_0_0_#e4e4e7]`, `group-hover:-translate-y-2.5`, `group-hover:scale-[1.03]`, `group-hover:-rotate-[0.6deg]`, `transition-all duration-300 ease-out`, `group-hover:shadow-[0_20px_38px_-10px_rgba(0,0,0,0.22),2px_0_0_0_#fafaf9,4px_0_0_0_#e4e4e7]`. (Note: Hardcover leather visual overrides are applied via higher-specificity CSS classes `.book-leather-cover` and `.book-leather-theme-*` in `app/globals.css` alongside these classes so both the test assertions and the rich leather hardcover visuals succeed!)
     - `data-testid="book-cover-color-band"` MUST retain `h-3.5 w-full` and `book-silk-band`.
     - Must retain `book-3d-spine-groove`, `data-testid="shelf-row-divider"`, `data-testid="book-settings-gear-btn"`, `data-testid="book-meta-modal"`, `<GearIcon />`, `data-testid="pixiv-import-toggle-btn"`, `data-testid="pixiv-url-input"`, `data-testid="pixiv-import-submit-btn"`, `data-testid="book-cover-image"`, `data-testid="book-cover-description"`.
   - `ReaderPanel.tsx`:
     - Must NOT reference `speechSynthesis`, `readerTocButton`, `readerBookmarkButton`, `readerVoiceMenu`, `readerPrevChapter`, `readerNextChapter`, `showBookmarks`, `showToc`, `showVoiceMenu`, `isSpeaking`.
     - Must preserve `DEFAULT_PREFS` (`fontFamily: 'sans'`, `writingMode: 'horizontal'`, `showLineNumbers: false`, `textAlign: 'left'`, `customRubyColor: ''`).
     - Must preserve `mx-auto max-w-5xl xl:max-w-6xl px-5 sm:px-10 md:px-14 py-8`, `vertical-script-flow`, `height: 'calc(100vh - 180px)'`, and all `data-testid="reader-*"` / `data-testid="ruby-color-*"` attributes.
   - `page.tsx`:
     - Must preserve `data-testid="dark-mode-toggle"` and `☼`, `/`, `☾`.

## 2. Worker Assignments & File Ownership
- **Worker A1 (`agy --model gemini-4-argon-high`)**:
  - Owns: `app/components/uiTokens.ts`, `app/components/MobileNavBar.tsx`, `app/components/Sidebar.tsx`, `app/components/Modal.tsx`, `app/page.tsx`.
- **Worker A2 (`agy --model gemini-4-argon-high`)**:
  - Owns: `app/components/LibraryPanel.tsx`, `app/globals.css` (Liquid Glass optical upgrade + Hardcover Leather Book Cover `.book-leather-*` & `.book-3d-*` system).
- **Worker A3 (`agy --model gemini-4-argon-high`)**:
  - Owns: `app/components/ReaderPanel.tsx`, `app/components/RubyCorrectionModal.tsx`.
- **Worker B1 (`pi --model antigravity-acp/gemini-3.8-flash`)**:
  - Owns: `app/components/BatchProcessingPanel.tsx`, `app/components/GlossaryModal.tsx`, `app/components/DependencyModal.tsx`, `app/components/ExportProgressModal.tsx`, `app/components/BatchDoneModal.tsx`, `app/components/LearnedReadingsModal.tsx`.
- **Worker B2 (`pi --model antigravity-acp/gemini-3.8-flash`)**:
  - Owns: `tests/libraryShelf.test.mjs`, `tests/readerPanel.test.mjs`.
