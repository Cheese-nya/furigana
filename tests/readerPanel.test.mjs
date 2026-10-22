import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('../app/components/ReaderPanel.tsx', import.meta.url)),
  'utf8',
);

// app/page.tsx was split: its Editor view, sidebar items, library and batch logic now live in
// these files, so page-level source assertions read them all together.
const readPageSplitSource = () => [
  '../app/page.tsx',
  '../app/components/EditorWorkspace.tsx',
  '../app/components/Sidebar.tsx',
  '../app/hooks/useLibraryController.ts',
  '../app/hooks/useBatchProcessing.ts',
].map(path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')).join('\n');

test('ReaderPanel 彻底移除 TTS / 语音合成系统', () => {
  for (const forbidden of [
    'speechSynthesis',
    'SpeechSynthesisUtterance',
    'speakingLine',
    'speechRate',
    'speakFrom',
    'speakLine',
    'stopSpeech',
    'SpeakerIcon',
    'readerTtsPlayChapter',
    'readerTtsStop',
    'readerTtsSpeed',
  ]) {
    assert.equal(source.includes(forbidden), false, `不应出现 ${forbidden}`);
  }
});

test('ReaderPanel 移除章节目录、书签抽屉与上一章/下一章页脚', () => {
  for (const forbidden of [
    'readerTocButton',
    'readerBookmarksButton',
    'readerPrevChapter',
    'readerNextChapter',
    'readerNoBookmarks',
  ]) {
    assert.equal(source.includes(forbidden), false, `不应出现 ${forbidden}`);
  }
  // Bookmark props stay optional so app/page.tsx still compiles.
  assert.match(source, /onAddBookmark\?: \(lineIndex: number, label\?: string\) => void;/);
  assert.match(source, /onRemoveBookmark\?: \(bookmarkId: string\) => void;/);
});

test('默认正文字体为ゴシック体（sans）', () => {
  assert.match(source, /const DEFAULT_PREFS: ReaderPrefs = \{[\s\S]*?fontFamily: 'sans',[\s\S]*?\};/);
  assert.match(source, /export type ReaderFontFamily = 'sans' \| 'serif';/);
  const popover = source.slice(source.indexOf("fontFamily === 'sans'"), source.indexOf("fontFamily === 'serif'") + 400);
  assert.match(popover, /t\.fontGothic/);
  assert.match(source.slice(source.indexOf("fontFamily === 'serif'")), /t\.fontMincho/);
});

test('排版设置持久化于 furigana_reader_prefs_v2', () => {
  assert.match(source, /const PREFS_KEY = 'furigana_reader_prefs_v2';/);
  assert.match(source, /window\.localStorage\.setItem\(\s*PREFS_KEY[\s\S]*writingMode/);
});

test('支持 writingMode horizontal / vertical 切换', () => {
  assert.match(source, /type ReaderWritingMode = 'horizontal' \| 'vertical';/);
  assert.match(source, /writingMode: 'horizontal'/);
  assert.match(source, /data-testid="reader-writing-mode-toggle"/);
  assert.match(source, /setWritingMode\('vertical'\)/);
  assert.match(source, /setWritingMode\('horizontal'\)/);
  assert.match(source, /t\.writingModeHorizontal/);
  assert.match(source, /t\.writingModeVertical/);
});

test('竖向排版应用 vertical-script-flow 与 data-writing-mode', () => {
  assert.match(source, /vertical-script-flow/);
  assert.match(source, /data-testid="reader-script-canvas"/);
  assert.match(source, /data-writing-mode=\{writingMode\}/);
  assert.match(source, /height: 'calc\(100vh - 180px\)'/);
});

test('横向排版使用 34em 阅读栏宽', () => {
  assert.match(source, /max-w-\[34em\]/);
});

test('交互词组使用 ruby-interactive-token 柔和暖黄辉光', () => {
  assert.match(source, /ruby-interactive-token/);
  assert.equal(source.includes('hover:bg-current/10'), false);
});

test('连续整篇渲染（全文）而非分章视图', () => {
  assert.match(source, /全文/);
  assert.equal(source.includes('chapterCursor'), false);
});

test('零 Emoji（仅使用单线条 SVG 图标）', () => {
  const emojis = source.match(/\p{Extended_Pictographic}/gu) ?? [];
  assert.deepEqual(emojis, [], `发现 Emoji: ${emojis.join(' ')}`);
});

test('DEFAULT_PREFS 包含行号隐藏、左对齐与空自定义注音颜色默认设置', () => {
  assert.match(
    source,
    /const DEFAULT_PREFS: ReaderPrefs = \{[\s\S]*?showLineNumbers:\s*false,[\s\S]*?textAlign:\s*'left',[\s\S]*?customRubyColor:\s*'',[\s\S]*?\};/,
  );
});

test('ReaderPanel 包含行号切换、水平对齐切换与注音颜色选择器控件', () => {
  assert.ok(source.includes('data-testid="reader-line-numbers-hide-btn"'), 'reader-line-numbers-hide-btn required');
  assert.ok(source.includes('data-testid="reader-line-numbers-show-btn"'), 'reader-line-numbers-show-btn required');
  assert.ok(source.includes('data-testid="reader-align-left-btn"'), 'reader-align-left-btn required');
  assert.ok(source.includes('data-testid="reader-align-center-btn"'), 'reader-align-center-btn required');
  assert.ok(source.includes('data-testid="ruby-color-picker"'), 'ruby-color-picker required');
  assert.ok(source.includes('data-testid={`ruby-color-swatch-${color}`}'), 'ruby-color-swatch- required');
});

test('ReaderPanel Aa 外观面板支持手机端底部浮层与桌面端弹出层及振假名校正液态玻璃卡片', () => {
  const rubyModalSource = readFileSync(
    fileURLToPath(new URL('../app/components/RubyCorrectionModal.tsx', import.meta.url)),
    'utf8',
  );
  assert.ok(source.includes('<GlassPopover'), 'ReaderPanel Aa panel must be a glass popover');
  assert.ok(source.includes('CANVAS_PAPER_CLASS'), 'ReaderPanel must define CANVAS_PAPER_CLASS');

  assert.ok(rubyModalSource.includes('liquid-glass-btn'), 'RubyCorrectionModal must use liquid-glass-btn');
  assert.ok(rubyModalSource.includes('liquid-glass-inset'), 'RubyCorrectionModal must use liquid-glass-inset');
  const emojis = rubyModalSource.match(/\p{Extended_Pictographic}/gu) ?? [];
  assert.deepEqual(emojis, [], `RubyCorrectionModal 发现 Emoji: ${emojis.join(' ')}`);
});

test('阅读器没有吸顶顶栏（沉浸式）', () => {
  assert.equal(source.includes('sticky top-0'), false, 'ReaderPanel must not have a sticky top header');
});

test('阅读器：底部玻璃胶囊下滑隐藏、上滑/点按出现，隐藏时显示底部进度线', () => {
  assert.ok(source.includes('data-testid="reader-fullscreen-btn"'), 'reader-fullscreen-btn required');
  assert.ok(source.includes('data-testid="reader-exit-fullscreen-btn"'), 'reader-exit-fullscreen-btn required');
  assert.equal(source.includes('reader-corner-top-left'), false, 'four-corner HUD must be gone');
  assert.ok(source.includes('handleCanvasClick'), 'tap handler required');
  assert.ok(source.includes('setHudVisible(prev => !prev)'), 'tap toggles the capsule');
  assert.ok(/travel\s*>\s*24/.test(source) && /travel\s*<\s*-12/.test(source), 'hide/show by distance travelled in one direction');
  assert.ok(source.includes('bottom-1 left-[22px] right-[22px]'), 'bottom progress line required');
  assert.ok(source.includes('useGlass'), 'capsule uses the refracting glass material');
});

test('阅读器内对待复核假名不进行标黄和虚线装饰', () => {
  assert.equal(source.includes('RUBY_REVIEW'), false, 'ReaderPanel must not use RUBY_REVIEW yellow highlight');
  assert.equal(
    source.includes('decoration-amber-500'),
    false,
    'ReaderPanel must not render dotted amber underline on needsReview tokens',
  );
  assert.ok(
    source.includes('const emphasized = authoritative;'),
    'ReaderPanel should only emphasize authoritative tokens, not needsReview tokens',
  );
});

test('阅读器全屏二级菜单 (Aa / 搜索) 包含滚动穿透锁定与主题背景同步防黑边', () => {
  assert.ok(source.includes('CANVAS_BG'), 'ReaderPanel must define CANVAS_BG map for root background sync');
  assert.ok(source.includes('overscroll-contain'), 'reader-active-drawer must include overscroll-contain');
  assert.ok(source.includes('reader-drawer-scroll-lock'), 'reader-active-drawer must include reader-drawer-scroll-lock');
  assert.ok(
    source.includes("overscrollBehavior: 'contain'"),
    'reader-active-drawer must set inline overscrollBehavior: contain',
  );
});

test('v1.2.0 顶部栏重排、工作台三区均衡布局与可切换格式+独立导出按钮胶囊、iPhone竖屏锁定与纤薄底部Dock', () => {
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  );
  const pageSource = readFileSync(
    fileURLToPath(new URL('../app/page.tsx', import.meta.url)),
    'utf8',
  );
  const sidebarSource = readFileSync(
    fileURLToPath(new URL('../app/components/Sidebar.tsx', import.meta.url)),
    'utf8',
  );
  const settingsSource = readFileSync(
    fileURLToPath(new URL('../app/components/SettingsMenu.tsx', import.meta.url)),
    'utf8',
  );
  const shellHeaderSource = `${pageSource}\n${sidebarSource}\n${settingsSource}`;
  const mobileNavSource = readFileSync(
    fileURLToPath(new URL('../app/components/MobileNavBar.tsx', import.meta.url)),
    'utf8',
  );
  const infoPlist = readFileSync(
    fileURLToPath(new URL('../ios/App/App/Info.plist', import.meta.url)),
    'utf8',
  );
  const sceneDelegate = readFileSync(
    fileURLToPath(new URL('../ios/App/App/SceneDelegate.swift', import.meta.url)),
    'utf8',
  );

  // 1. Version v1.2.0 and brand title Furigana
  assert.equal(pkg.version, '1.2.0', 'package.json version must be 1.2.0');
  assert.ok(pageSource.includes('<Sidebar'), 'page.tsx must render the glass Sidebar');
  assert.ok(pageSource.includes('<SettingsMenu'), 'page.tsx must render SettingsMenu');
  assert.ok(shellHeaderSource.includes('data-testid="app-brand-title"'), 'app-brand-title required');
  assert.ok(shellHeaderSource.includes('data-testid="app-version-badge"'), 'app-version-badge required');
  assert.ok(shellHeaderSource.includes('v1.2.0'), 'settings menu must display v1.2.0');
  assert.equal(pageSource.includes('setIsSidebarOpen'), false, 'the hamburger drawer must be gone');

  // 2. Workbench 3-zone balanced layout & Export capsule with selectable format + standalone Export button
  const workbenchSource = readPageSplitSource();
  assert.ok(workbenchSource.includes('data-testid="workbench-export-capsule"'), 'workbench-export-capsule required');
  assert.ok(workbenchSource.includes('export-format-option-'), 'selectable export format options required');
  assert.ok(workbenchSource.includes('data-testid="workbench-export-submit-btn"'), 'standalone export button required');
  assert.ok(workbenchSource.includes('handleExport(exportFormat)'), 'standalone export button must trigger handleExport(exportFormat)');

  // 3. Liquid Glass v2 tab bar: 52px glass capsule with a liquid selector
  assert.ok(mobileNavSource.includes('h-[52px]'), 'MobileNavBar must be the 52px tab bar');
  assert.ok(mobileNavSource.includes('className="glass'), 'MobileNavBar must use the glass material');
  assert.ok(mobileNavSource.includes('<LiquidSelector'), 'MobileNavBar tabs must use LiquidSelector');

  // 4. iPhone portrait-only orientation lock
  const iphoneOrientationBlock = infoPlist.slice(
    infoPlist.indexOf('<key>UISupportedInterfaceOrientations</key>'),
    infoPlist.indexOf('<key>UISupportedInterfaceOrientations~ipad</key>'),
  );
  assert.ok(
    iphoneOrientationBlock.includes('<string>UIInterfaceOrientationPortrait</string>'),
    'iPhone must support Portrait',
  );
  assert.equal(
    iphoneOrientationBlock.includes('UIInterfaceOrientationLandscapeLeft'),
    false,
    'iPhone must not support LandscapeLeft by default',
  );
  assert.equal(
    iphoneOrientationBlock.includes('UIInterfaceOrientationLandscapeRight'),
    false,
    'iPhone must not support LandscapeRight by default',
  );
  assert.ok(
    sceneDelegate.includes('supportedInterfaceOrientations'),
    'SceneDelegate FuriganaBridgeViewController must override supportedInterfaceOrientations',
  );
});

test('上下滑动到底防黑条：Web/iOS/Android 全链路同步画布底色并禁用原生外层回弹与安全区内边距错位', () => {
  const pageSource = readFileSync(
    fileURLToPath(new URL('../app/page.tsx', import.meta.url)),
    'utf8',
  );
  const themeHookSource = readFileSync(
    fileURLToPath(new URL('../app/hooks/useThemeMode.ts', import.meta.url)),
    'utf8',
  );
  const pageAndThemeSource = `${pageSource}\n${themeHookSource}`;
  const capacitorConfigSource = readFileSync(
    fileURLToPath(new URL('../capacitor.config.ts', import.meta.url)),
    'utf8',
  );
  // Generated by `cap sync` and git-ignored, so a fresh clone does not have it yet.
  const iosCapConfigPath = fileURLToPath(new URL('../ios/App/App/capacitor.config.json', import.meta.url));
  const iosCapConfig = existsSync(iosCapConfigPath) ? JSON.parse(readFileSync(iosCapConfigPath, 'utf8')) : null;
  const sceneDelegate = readFileSync(
    fileURLToPath(new URL('../ios/App/App/SceneDelegate.swift', import.meta.url)),
    'utf8',
  );
  const mainActivity = readFileSync(
    fileURLToPath(new URL('../android/src/com/cheese/furiganastudio/MainActivity.java', import.meta.url)),
    'utf8',
  );

  // 1. ReaderPanel cleanup restores background based on current darkMode rather than stale previousRootBackground
  assert.equal(
    source.includes('previousRootBackground'),
    false,
    'ReaderPanel must not restore stale previousRootBackground which leaves #000000 black after theme switch',
  );
  assert.ok(
    source.includes("const restoreBg = darkMode ? '#000000' : '#F2F2F7'"),
    'ReaderPanel cleanup must restore background from current darkMode',
  );
  assert.ok(
    source.includes("setProperty('--bg-primary', canvasBackground)"),
    'ReaderPanel must sync --bg-primary so body::before matches reader canvas',
  );

  // 2. iOS Capacitor configures backgroundColor & disables outer UIScrollView bounce and syncs furiganaTheme
  assert.ok(
    capacitorConfigSource.includes("backgroundColor: '#F2F2F7'"),
    'capacitor.config.ts must set ios.backgroundColor to #F2F2F7',
  );
  if (iosCapConfig) {
    assert.equal(
      iosCapConfig.ios?.backgroundColor,
      '#F2F2F7',
      'ios/App/App/capacitor.config.json must set ios.backgroundColor to #F2F2F7 (re-run cap sync)',
    );
  }
  assert.ok(
    sceneDelegate.includes('capacitorDidLoad'),
    'SceneDelegate must override capacitorDidLoad to re-apply background after CAPBridgeViewController.prepareWebView',
  );
  assert.ok(
    sceneDelegate.includes('webView.scrollView.bounces = false'),
    'SceneDelegate must disable outer WKWebView scrollView bounce',
  );
  assert.ok(
    sceneDelegate.includes('furiganaTheme'),
    'SceneDelegate must register furiganaTheme WKScriptMessageHandler to sync native window/underPage color',
  );
  assert.ok(
    pageAndThemeSource.includes('furiganaTheme'),
    'app/page.tsx / useThemeMode.ts must notify native furiganaTheme handler when theme changes',
  );

  // 3. Android MainActivity disables WebView overscroll and syncs status/navigation bar color
  assert.ok(
    mainActivity.includes('OVER_SCROLL_NEVER'),
    'Android MainActivity must disable WebView overscroll glow',
  );
  assert.ok(
    mainActivity.includes('syncTheme'),
    'Android MainActivity must expose syncTheme on AndroidBridge',
  );
});

test('阅读器排版缺陷修复：.ruby-interactive-token 零水平内边距且 line.speaker 正文开头去重', () => {
  const globalsCss = readFileSync(
    fileURLToPath(new URL('../app/globals.css', import.meta.url)),
    'utf8',
  );

  const tokenRuleMatch = globalsCss.match(/\.ruby-interactive-token\s*\{[^}]*\}/);
  assert.ok(tokenRuleMatch, '.ruby-interactive-token rule must exist in app/globals.css');
  assert.equal(
    tokenRuleMatch[0].includes('padding: 0 2px'),
    false,
    '.ruby-interactive-token must not include horizontal padding: 0 2px that creates gaps between tokens',
  );

  const tokenHoverMatch = globalsCss.match(/\.ruby-interactive-token:hover\s*\{[^}]*\}/);
  assert.ok(tokenHoverMatch, '.ruby-interactive-token:hover rule must exist in app/globals.css');
  assert.ok(
    tokenHoverMatch[0].includes('0 0 0 2px'),
    '.ruby-interactive-token:hover must use box-shadow spread instead of layout padding',
  );

  assert.equal(
    source.includes('const speakerMatch = line.speaker ? null :'),
    false,
    'ReaderPanel must not disable speaker deduplication when line.speaker is present',
  );
  assert.ok(
    source.includes('const speaker = line.speaker || speakerMatch?.[1];'),
    'ReaderPanel must resolve speaker from line.speaker or SPEAKER regex match',
  );
  assert.ok(
    source.includes('joinedSurface.startsWith(speaker)') && source.includes('remainingSpeakerChars'),
    'ReaderPanel must deduplicate leading speaker tokens and following colon delimiter from body text',
  );
});

test('复合词基字不被宽读音撑开：globals.css 全局设置 ruby-align: center', () => {
  const globalsCss = readFileSync(
    fileURLToPath(new URL('../app/globals.css', import.meta.url)),
    'utf8',
  );

  // Chrome 默认 `space-around` 会在读音比基字宽时把「約束」「教室」撑成「約 束」「教 室」。
  const rubyAlignMatches = globalsCss.match(/^ruby\s*\{[^}]*ruby-align:\s*center;[^}]*\}/gm) ?? [];
  assert.equal(
    rubyAlignMatches.length > 0,
    true,
    'app/globals.css must declare a global `ruby { ruby-align: center; }` rule',
  );
  assert.equal(
    globalsCss.includes('ruby-align: space-around'),
    false,
    'app/globals.css must not opt back into space-around ruby alignment',
  );

  // 阅读器画布与工作台预览共用同一条全局规则，无需在 .script-line 之外重复声明。
  assert.ok(
    globalsCss.includes('.script-line ruby'),
    'app/globals.css must keep the scoped .script-line ruby rule',
  );
});
