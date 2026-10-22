import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('../app/components/LibraryPanel.tsx', import.meta.url)),
  'utf8',
);

test('备份与维护 UI 已从台本库彻底移除，但兼容 props 仍保留', () => {
  assert.equal(source.includes('libraryMaintenanceMenu'), false, 'must not reference t.libraryMaintenanceMenu');
  assert.equal(source.includes('libraryExportBackup'), false, 'must not reference t.libraryExportBackup');
  assert.equal(source.includes('libraryImportBackup'), false, 'must not reference t.libraryImportBackup');
  assert.equal(source.includes('showMaintenanceMenu'), false, 'showMaintenanceMenu state must be removed');
  assert.equal(source.includes('backupFileInputRef'), false, 'backupFileInputRef must be removed');
  assert.equal(source.includes('备份与维护'), false, 'no hard-coded maintenance label may remain');
  // Compatibility props stay optional so app/page.tsx keeps compiling untouched.
  assert.match(source, /onExportBackup\?:\s*\(\)\s*=>\s*void/, 'onExportBackup must stay optional');
  assert.match(source, /onImportBackup\?:\s*\(file:\s*File\)\s*=>\s*void\s*\|\s*Promise<unknown>/, 'onImportBackup must stay optional');
  // No leftover backup import file input.
  assert.equal(source.includes('application/json'), false, 'backup JSON file input must be removed');
});

test('台本库渲染 Apple Books 3D 书架网格容器', () => {
  assert.ok(source.includes('data-testid="apple-books-shelf"'), 'apple-books-shelf testid required');
  const shelf = source.slice(source.indexOf('data-testid="apple-books-shelf"'));
  const shelfTag = shelf.slice(0, shelf.indexOf('>'));
  for (const cls of [
    'grid-cols-2',
    'sm:grid-cols-3',
    'md:grid-cols-4',
    'lg:grid-cols-5',
    'gap-x-5',
    'sm:gap-x-7',
    'gap-y-10',
    'rounded-2xl',
    'bg-[#f5f5f7]/90',
    'border-black/[0.06]',
  ]) {
    assert.ok(shelfTag.includes(cls), `shelf container must include ${cls}`);
  }
});

test('每本台本渲染为竖版 3D 书封，含颜色书脊带与纸页边缘', () => {
  assert.ok(source.includes('data-testid="script-book-cover"'), 'script-book-cover testid required');
  assert.ok(source.includes('data-testid="book-cover-color-band"'), 'book-cover-color-band testid required');
  assert.ok(source.includes('aspect-[3/4.2]'), 'book cover must use aspect-[3/4.2]');
  assert.ok(source.includes('h-3.5 w-full'), 'color band must be h-3.5 w-full');
  assert.ok(source.includes('from-black/12 via-white/30 to-transparent'), 'left spine crease gradient required');
  assert.ok(source.includes('bg-gradient-to-b from-white to-[#faf9f5]'), 'warm paper cover body required');
  assert.ok(source.includes('shadow-[0_10px_24px_-6px_rgba(0,0,0,0.14),2px_0_0_0_#fafaf9,4px_0_0_0_#e4e4e7]'), 'paper page edge shadow required');
  // Bookshelf ledge shadow under each cover.
  assert.ok(source.includes('h-2.5 mx-1 mt-2 rounded-full bg-gradient-to-b from-black/[0.08] to-transparent blur-[1px]'), 'ledge shadow required');
  // All five script cover themes must map to gradients.
  for (const theme of ['indigo', 'emerald', 'amber', 'rose', 'slate']) {
    assert.match(source, new RegExp(`${theme}:\\s*'bg-gradient-to-r`), `coverTheme ${theme} must map to a gradient band`);
  }
});

test('书封含标题、格式徽章、收藏星标、阅读进度与快捷操作', () => {
  assert.ok(source.includes('line-clamp-3 font-semibold text-sm sm:text-base text-[#1d1d1f] tracking-tight leading-snug'), 'prominent script title typography required');
  assert.ok(source.includes('book.format.toUpperCase()'), 'format badge (TXT/SRT/DOCX) required');
  assert.ok(source.includes('role="progressbar"'), 'reading progress bar required');
  assert.ok(source.includes('h-1 overflow-hidden rounded-full'), 'progress bar must be h-1 rounded-full');
  assert.ok(source.includes('onOpenInReader(book)'), 'cover must open script in reader');
  assert.ok(source.includes('onOpenInEditor(book)'), 'quick action must edit in studio');
  assert.ok(source.includes('onDeleteBook(book.bookId)'), 'quick action must delete book');
  assert.ok(source.includes('confirmDeleteId'), 'two-step delete confirmation state required');
  assert.ok(source.includes('event.stopPropagation()'), 'quick actions must stopPropagation');
});

test('书封指针悬停弹簧升起动画（Apple Books 手感）', () => {
  for (const cls of [
    'group-hover:-translate-y-2.5',
    'group-hover:scale-[1.03]',
    'group-hover:-rotate-[0.6deg]',
    'transition-all duration-300 ease-out',
    'group-hover:shadow-[0_20px_38px_-10px_rgba(0,0,0,0.22),2px_0_0_0_#fafaf9,4px_0_0_0_#e4e4e7]',
  ]) {
    assert.ok(source.includes(cls), `book cover must include ${cls}`);
  }
});

test('LibraryPanel.tsx 不含任何 Extended_Pictographic emoji', () => {
  const emojis = [...source.matchAll(/\p{Extended_Pictographic}/gu)].map(match => match[0]);
  assert.deepEqual(emojis, [], `expected zero emojis, found: ${emojis.join(' ')}`);
  // Star / arrow glyphs must be replaced by monoline SVG icons too.
  assert.equal(source.includes('★'), false, 'no star glyph; use SVG star');
  assert.equal(source.includes('☆'), false, 'no outline star glyph; use SVG star');
});

const pageSource = `${readFileSync(
  fileURLToPath(new URL('../app/page.tsx', import.meta.url)),
  'utf8',
)}\n${readFileSync(
  fileURLToPath(new URL('../app/components/SettingsMenu.tsx', import.meta.url)),
  'utf8',
)}`;

test('书封悬停渲染第4个圆形操作按钮（齿轮图标）与书籍元数据编辑模态框', () => {
  assert.ok(source.includes('data-testid="book-settings-gear-btn"'), 'book-settings-gear-btn required');
  assert.ok(source.includes('data-testid="book-meta-modal"'), 'book-meta-modal required');
  assert.ok(source.includes('<GearIcon />'), 'GearIcon required in gear button');
});

test('台本库渲染 Pixiv URL 导入控件、封面艺术画与故事简介', () => {
  assert.ok(source.includes('data-testid="pixiv-import-toggle-btn"'), 'pixiv-import-toggle-btn required');
  assert.ok(source.includes('data-testid="pixiv-url-input"'), 'pixiv-url-input required');
  assert.ok(source.includes('data-testid="pixiv-import-submit-btn"'), 'pixiv-import-submit-btn required');
  assert.ok(source.includes('data-testid="book-cover-image"'), 'book-cover-image required');
  assert.ok(source.includes('data-testid="book-cover-description"'), 'book-cover-description required');
});

test('设置菜单包含浅色/深色外观切换（日月图标）', () => {
  assert.ok(pageSource.includes('testId="dark-mode-toggle"'), 'dark-mode-toggle required');
  assert.ok(pageSource.includes('<IconSun'), 'sun icon required');
  assert.ok(pageSource.includes('<IconMoon'), 'moon icon required');
});

const cssSource = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8',
);

test('台本库具备丝绸顶部色带、3D 实体书脊压痕、每行分隔线与深色模式默认书皮适配', () => {
  assert.ok(source.includes('book-silk-band'), 'LibraryPanel must apply book-silk-band to top color band');
  assert.ok(source.includes('book-3d-spine-groove'), 'LibraryPanel must apply book-3d-spine-groove to left spine');
  assert.ok(source.includes('data-testid="shelf-row-divider"'), 'LibraryPanel must render shelf-row-divider between rows');
  assert.ok(cssSource.includes('.book-silk-band'), 'globals.css must define .book-silk-band silk texture');
  assert.ok(cssSource.includes('.book-3d-spine-groove'), 'globals.css must define .book-3d-spine-groove 3D spine');
  assert.ok(cssSource.includes('.dark [data-testid="script-book-cover"]'), 'globals.css must style dark-mode default book covers');
});

test('精装皮质书皮包含全粒面皮革纹理层、烫金压凹内框、135度漫反射光泽与五色染色皮革样式', () => {
  assert.ok(source.includes('book-leather-cover'), 'LibraryPanel must apply book-leather-cover');
  assert.ok(source.includes('data-testid="book-leather-grain"'), 'LibraryPanel must render book-leather-grain layer');
  assert.ok(source.includes('data-testid="book-leather-sheen"'), 'LibraryPanel must render book-leather-sheen layer');
  assert.ok(source.includes('data-testid="book-leather-frame"'), 'LibraryPanel must render book-leather-frame layer');
  assert.ok(source.includes('data-leather-theme={book.coverTheme}'), 'LibraryPanel must attach data-leather-theme attribute');

  assert.ok(cssSource.includes('.book-leather-cover'), 'globals.css must define .book-leather-cover');
  assert.ok(cssSource.includes('.book-leather-grain'), 'globals.css must define .book-leather-grain');
  assert.ok(cssSource.includes('.book-leather-frame'), 'globals.css must define .book-leather-frame');
  assert.ok(cssSource.includes('.book-leather-sheen'), 'globals.css must define .book-leather-sheen');
  for (const theme of ['indigo', 'emerald', 'amber', 'rose', 'slate']) {
    assert.ok(cssSource.includes(`.book-leather-${theme}`), `globals.css must define .book-leather-${theme}`);
  }
});

test('移动端与桌面端自适应 iOS 26 液态玻璃导航与 Bottom Sheet 模态框', () => {
  const mobileNavSource = readFileSync(
    fileURLToPath(new URL('../app/components/MobileNavBar.tsx', import.meta.url)),
    'utf8',
  );
  const modalSource = readFileSync(
    fileURLToPath(new URL('../app/components/Modal.tsx', import.meta.url)),
    'utf8',
  );

  assert.ok(mobileNavSource.includes('data-testid="mobile-nav-bar"'), 'MobileNavBar must include mobile-nav-bar testid');
  assert.ok(mobileNavSource.includes('className="glass'), 'MobileNavBar must use the glass material');
  assert.ok(mobileNavSource.includes('rounded-full'), 'MobileNavBar must be a floating pill capsule');
  assert.ok(mobileNavSource.includes('safe-area-inset-bottom'), 'MobileNavBar must respect safe-area-inset-bottom');

  assert.ok(modalSource.includes('max-sm:rounded-t-[32px]'), 'Modal must render as bottom sheet on mobile screens');
  assert.ok(modalSource.includes('sm:hidden'), 'Modal must include mobile-only bottom sheet grabber pill');
});

test('批量工作台与二级模态框启用液态玻璃与深色模式适配', () => {
  const batchPanelSource = readFileSync(
    fileURLToPath(new URL('../app/components/BatchProcessingPanel.tsx', import.meta.url)),
    'utf8',
  );
  const exportModalSource = readFileSync(
    fileURLToPath(new URL('../app/components/ExportProgressModal.tsx', import.meta.url)),
    'utf8',
  );

  for (const [label, componentSource] of [
    ['BatchProcessingPanel.tsx', batchPanelSource],
    ['ExportProgressModal.tsx', exportModalSource],
  ]) {
    assert.ok(
      componentSource.includes('liquid-glass-inset') || componentSource.includes('liquid-glass-btn-primary'),
      `${label} must use liquid glass surfaces (liquid-glass-inset / liquid-glass-btn-primary)`,
    );
    const emojis = [...componentSource.matchAll(/\p{Extended_Pictographic}/gu)].map(match => match[0]);
    assert.deepEqual(emojis, [], `${label} expected zero emojis, found: ${emojis.join(' ')}`);
  }
});

test('dark mode adapts book covers, removes white top borders, and eliminates overscroll white edges', () => {
  const globalsSource = readFileSync(
    fileURLToPath(new URL('../app/globals.css', import.meta.url)),
    'utf8',
  );
  const layoutSource = readFileSync(
    fileURLToPath(new URL('../app/layout.tsx', import.meta.url)),
    'utf8',
  );
  const sceneDelegateSource = readFileSync(
    fileURLToPath(new URL('../ios/App/App/SceneDelegate.swift', import.meta.url)),
    'utf8',
  );

  assert.match(globalsSource, /#242a3c/, 'globals.css should define dark plain leather cover top stop (#242a3c)');
  assert.match(globalsSource, /#141824/, 'globals.css should define dark plain leather cover bottom stop (#141824)');
  assert.match(source, /dark:from-\[#242a3c\]/, 'LibraryPanel.tsx should apply dark plain leather gradient to book covers');
  assert.match(source, /dark:border-white\/10/, 'LibraryPanel.tsx should override bright white borders in dark mode');
  assert.match(
    source,
    /dark:shadow-\[inset_0_1px_2px_rgba\(0,0,0,0\.45\)\]/,
    'LibraryPanel.tsx should override bright white inset shadows on top search/control boxes in dark mode',
  );
  assert.match(globalsSource, /overscroll-behavior:\s*none/, 'globals.css should prevent rubber-band white edge exposure');
  assert.doesNotMatch(
    layoutSource,
    /<body[^>]*bg-zinc-50/,
    'app/layout.tsx <body> must not have bg-zinc-50 which triggers translucent dark background override',
  );
  assert.match(
    sceneDelegateSource,
    /underPageBackgroundColor/,
    'SceneDelegate.swift should set WKWebView underPageBackgroundColor to eliminate iOS overscroll white bars',
  );
});


