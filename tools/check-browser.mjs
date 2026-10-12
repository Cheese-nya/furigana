import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Optional QA dependency; production builds and npm test do not need Playwright.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
const origin = process.env.FURIGANA_TEST_URL || 'http://127.0.0.1:8765/';
const checks = [];
const errors = [];
const ready = async page => {
  await page.waitForFunction(() => !document.querySelector('textarea')?.disabled);
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(el => el.textContent.includes('注音已完成')) && document.querySelectorAll('rt').length > 0, null, { timeout: 30000 });
};
const importText = async (page, name, text) => {
  await page.locator('input[type=file]').first().setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await page.waitForFunction(expected => document.querySelector('textarea')?.value === expected, text);
  await ready(page);
};
const previewReadings = page => page.locator('div[lang=ja] rt').allTextContents();
const context = await browser.newContext({ acceptDownloads: true });
await context.addInitScript(() => {
  window.showSaveFilePicker = undefined;
  window.annotationMessages = [];
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => window.annotationMessages.push({ direction: 'in', type: event.data.type, taskId: event.data.taskId }));
    }
    postMessage(message, ...args) {
      window.annotationMessages.push({ direction: 'out', type: message.type, taskId: message.taskId,
        lineCount: message.input?.text.split('\n').length });
      return super.postMessage(message, ...args);
    }
  };
});
const page = await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
const legacy = { 台本: [{ line:'二人で',start:0,surface:'二人',reading:'にひと',type:'hiragana' }] };
await page.goto(origin);
await page.evaluate(value => { localStorage.clear(); localStorage.setItem('furigana-corrections-v1',JSON.stringify(value)); },legacy);
await page.reload(); await ready(page);
assert.equal(page.workers().length,1);
assert.ok((await page.locator('body').innerText()).includes('离线词典与上下文规则已启用'));
checks.push('static Worker initializes full dictionary');
await importText(page,'台本.txt','二人で');
assert.ok((await previewReadings(page)).includes('にひと'));
await page.locator('input[placeholder="输入台本标题（用于 Word 导出标题）"]').fill('改名');
await page.waitForTimeout(800);
await page.reload(); await ready(page);
await importText(page,'任意名字.txt','二人で');
assert.ok((await previewReadings(page)).includes('にひと'));
await importText(page,'台本.txt','二人で\n学校へ');
assert.ok((await previewReadings(page)).includes('ふたり'));
assert.ok(!(await previewReadings(page)).includes('にひと'));
assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('furigana-corrections-v1'))),legacy);
checks.push('legacy migration, title change/reload/reimport and same-title isolation');
await page.getByRole('button',{name:/^专名词典 \(/}).click();
await page.getByRole('textbox',{name:'词典原文',exact:true}).fill('小日向');
await page.getByRole('textbox',{name:'词典读音',exact:true}).fill('こひなた');
await page.getByRole('button',{name:'保存条目',exact:true}).click();
await page.getByRole('button',{name:'编辑 小日向',exact:true}).click();
await page.getByRole('textbox',{name:'词典读音',exact:true}).fill('こひな');
await page.getByRole('button',{name:'保存条目',exact:true}).click();
await page.getByRole('button',{name:'编辑 小日向',exact:true}).click();
await page.getByRole('textbox',{name:'词典读音',exact:true}).fill('こひなた');
await page.getByRole('button',{name:'保存条目',exact:true}).click();
const downloadEvent = page.waitForEvent('download');
await page.getByRole('button',{name:'导出词典',exact:true}).click();
const download=await downloadEvent;
assert.equal(download.suggestedFilename(),'专名词典.json');
await page.locator('[role=dialog]').getByRole('button',{name:'关闭',exact:true}).click();
await importText(page,'专名台本.txt','小日向と小日向');
assert.deepEqual(await previewReadings(page),['こひなた','こひなた']);
await page.getByRole('button',{name:'片假名',exact:true}).click(); await ready(page);
assert.deepEqual(await previewReadings(page),['コヒナタ','コヒナタ']);
await page.getByRole('button',{name:'平假名',exact:true}).click(); await ready(page);
checks.push('glossary add/edit/export, repeated matches and mode conversion');
await page.locator('#ruby-token-0-0').click();
const dialog=page.locator('[role=dialog]');
await dialog.locator('input[type=text]').fill('ひなた');
await dialog.getByRole('button',{name:'保存修改',exact:true}).click(); await ready(page);
assert.deepEqual(await previewReadings(page),['ひなた','こひなた']);
checks.push('single occurrence manual correction outranks glossary');
await importText(page, '连续复核.txt', '風は冷たい。辛い。');
await page.getByRole('button', { name: /待复核 .*下一处/ }).click();
const currentSurface = await dialog.locator('.text-2xl.font-bold').innerText();
await dialog.getByRole('button', { name: '保存并下一处', exact: true }).click();
await page.waitForFunction(previous => {
  const selected = document.querySelector('[role=dialog] .text-2xl.font-bold');
  return selected && selected.textContent !== previous;
}, currentSurface);
await dialog.getByRole('button', { name: '取消', exact: true }).click();
await ready(page);
checks.push('save and next opens a different remaining review target');
await importText(page, '词典范围.txt', '山田と山田');
await page.locator('#ruby-token-0-0').click();
await dialog.locator('input[type=text]').fill('やまちゃん');
await dialog.getByRole('checkbox').check();
await dialog.getByRole('button', { name: '保存修改', exact: true }).click();
await ready(page);
assert.deepEqual(await previewReadings(page), ['やまちゃん', 'やまちゃん']);
checks.push('correction scope adds a global glossary entry and applies to repeated words');
await page.locator('textarea').evaluate((element, text) => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, text);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}, Array.from({length:7491},(_,i)=>`学校へ ${i}`).join('\n'));
await page.waitForFunction(() => window.annotationMessages.some(message => message.type === 'ANNOTATE' && message.lineCount === 7491));
await page.locator('textarea').fill('小日向は学校へ行く。'); await ready(page);
assert.ok(await page.evaluate(() => window.annotationMessages.some(message => message.type === 'CANCEL')));
await page.waitForTimeout(400);
assert.equal(await page.locator('textarea').inputValue(),'小日向は学校へ行く。');
assert.ok((await page.locator('div[lang=ja]').first().innerText()).includes('小日向'));
assert.ok(!(await page.locator('div[lang=ja]').first().innerText()).includes('学校へ 100'));
checks.push('superseded long task cannot overwrite new text');
await page.waitForTimeout(600);
await page.reload(); await ready(page);
await importText(page,'专名台本2.txt','小日向');
assert.deepEqual(await previewReadings(page),['こひなた']);
checks.push('glossary persists across reload and new scripts');
await page.getByRole('button', { name: /^专名词典 \(/ }).click();
await page.getByRole('button', { name: '删除 小日向', exact: true }).click();
await page.locator('[role=dialog]').locator('input[type=file]').setInputFiles({ name: 'glossary.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ kind: 'furigana-glossary', version: 1,
  entries: { 小日向: { surface: '小日向', reading: 'こひなた', type: 'hiragana', createdAt: 1 } } })) });
await page.waitForFunction(() => document.querySelector('[role=dialog]')?.innerText.includes('导入 1 个条目'));
await page.locator('[role=dialog]').getByRole('button', { name: '关闭', exact: true }).click();
await ready(page);
assert.deepEqual(await previewReadings(page), ['こひなた']);
checks.push('glossary delete and JSON import restore readings');
const longText = Array.from({ length: 7491 }, (_, i) => `学校へ ${i}`).join('\n');
const start = performance.now();
await importText(page, 'long.txt', longText);
const elapsedMs = Math.round(performance.now() - start);
assert.equal(await page.locator('.script-line').count(), 200);
assert.ok((await page.locator('body').innerText()).includes('共 7491 行'));
await page.getByRole('button', { name: '下一页', exact: true }).click();
assert.ok((await page.locator('body').innerText()).includes('第 201–400 行'));
checks.push(`7491 complete annotated lines, 200-line preview pages (${elapsedMs} ms including import/render)`);
const fullDownloadEvent = page.waitForEvent('download');
await page.getByRole('button', { name: '导出 TXT', exact: true }).click();
const fullDownload = await fullDownloadEvent;
const exported = await readFile(await fullDownload.path(), 'utf8');
assert.equal(exported.split('\n\n').length, 7491);
assert.ok(exported.endsWith('学校(がっこう)へ 7490'));
await page.locator('[role=dialog]').getByRole('button', { name: '完成', exact: true }).click();
checks.push('long TXT export includes all 7491 lines, beyond the preview page');
await page.getByRole('button', { name: /批量处理中心/, exact: false }).last().click();
await page.locator('input[type=file][multiple]').setInputFiles({ name: '字幕.srt', mimeType: 'application/x-subrip',
  buffer: Buffer.from('7\n00:01:02,100 --> 00:01:04,500\n小日向\n学校へ\n') });
await page.getByRole('button', { name: '.srt', exact: true }).click();
const batchDownloadEvent = page.waitForEvent('download');
await page.getByRole('button', { name: /开始批量处理并自动保存/ }).click();
const batchDownload = await batchDownloadEvent;
const batchOutput = await readFile(await batchDownload.path(), 'utf8');
assert.match(batchOutput, /^7\n00:01:02,100 --> 00:01:04,500\n小日向\(こひなた\)\n学校\(がっこう\)へ/);
checks.push('batch SRT uses its own cue timing and global glossary');
// Worker constructor unavailable: explicit fallback, same readings.
const fallbackContext=await browser.newContext();
await fallbackContext.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('Worker disabled for test');}};});
const fallback=await fallbackContext.newPage();
fallback.on('pageerror',e=>errors.push(e.message));
await fallback.goto(origin); await ready(fallback);
assert.ok((await fallback.locator('body').innerText()).includes('分块兼容模式'));
assert.ok((await fallback.locator('body').innerText()).includes('离线词典与上下文规则已启用'));
checks.push('Worker unavailable falls back to chunked full-dictionary annotation');
const corruptContext = await browser.newContext();
await corruptContext.addInitScript(() => localStorage.setItem('furigana-corrections-v2', '{broken'));
const corrupt = await corruptContext.newPage();
await corrupt.goto(origin);
await corrupt.waitForFunction(() => [...document.querySelectorAll('[role=alert]')].some(el => el.textContent.includes('校对记录读取失败')));
assert.equal(await corrupt.locator('textarea').isDisabled(), true);
assert.equal(await corrupt.evaluate(() => localStorage.getItem('furigana-corrections-v2')), '{broken');
checks.push('corrupt v2 remains untouched and disables editing');
const degradedContext = await browser.newContext();
await degradedContext.route('**/dict/**', route => route.fulfill({ status: 404, body: 'missing' }));
const degraded = await degradedContext.newPage();
await degraded.goto(origin); await ready(degraded);
assert.ok((await degraded.locator('body').innerText()).includes('词典加载失败，正在使用基础词表'));
assert.ok(!(await degraded.locator('body').innerText()).includes('离线词典与上下文规则已启用'));
checks.push('missing dictionary is visibly degraded, never reported ready');
assert.deepEqual(errors,[]);
console.log(JSON.stringify({ checks, pageErrors: errors },null,2));
} finally {
  await browser.close();
}
