import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

// Load the browser-side TypeScript exporter without a browser or Next server.
const filename = fileURLToPath(new URL('../app/utils/docxExporter.ts', import.meta.url));
const exporter = new Module(filename);
exporter.filename = filename;
exporter.paths = Module._nodeModulePaths(fileURLToPath(new URL('..', import.meta.url)));
exporter._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { buildDocxBlob } = exporter.exports;
const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const elements = (node, name) => Array.from(node.getElementsByTagNameNS(namespace, name));

for (const options of [undefined, { baseFontSize: 24, rubyFontSize: 14, lineSpacing: 2.4 }]) {
  test(`Word export retains annotated Japanese text with valid run nesting (${JSON.stringify(options)})`, async () => {
    const tokens = [
      { surface: '私', ruby: 'わたし', hasKanji: true },
      { surface: 'はペッパピッグ。', hasKanji: false },
      { surface: '二人', ruby: 'ふたり', hasKanji: true },
      { surface: 'で', hasKanji: false },
      { surface: '行', ruby: 'い', hasKanji: true },
      { surface: 'っておいで', hasKanji: false },
    ];
    const line = { id: 'example', rawText: '', cleanText: '', tokens };
    const blob = await buildDocxBlob([line, { ...line, id: 'blank', tokens: [] }], options);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'), 'text/xml');
    const rubies = elements(xml, 'ruby');
    assert.equal(rubies.length, 3);
    for (const ruby of rubies) {
      assert.equal(ruby.parentNode.localName, 'r', 'ruby must be run content for WPS');
      assert.equal(ruby.parentNode.parentNode.localName, 'p');
      assert.equal(elements(ruby, 'rubyAlign')[0].getAttributeNS(namespace, 'val'), 'center');
      assert.equal(elements(ruby, 'hpsBaseText')[0].getAttributeNS(namespace, 'val'), String(Math.round((options?.baseFontSize || 16) * 1.5)));
      assert.equal(elements(ruby, 'hps')[0].getAttributeNS(namespace, 'val'), String(Math.round((options?.rubyFontSize || 10) * 1.5)));
      assert.equal(elements(ruby, 'rubyBase').length, 1);
      assert.equal(elements(ruby, 'rt').length, 1);
    }
    const paragraph = rubies[0].parentNode.parentNode;
    const bodyText = elements(paragraph, 't').filter(node => {
      for (let parent = node.parentNode; parent !== paragraph; parent = parent.parentNode) {
        if (parent.localName === 'rt') return false;
      }
      return true;
    }).map(node => node.textContent).join('');
    assert.equal(bodyText, tokens.map(token => token.surface).join(''));
    assert.equal(elements(rubies[1], 'rubyBase')[0].textContent, '二人');
    assert.equal(elements(rubies[1], 'rt')[0].textContent, 'ふたり');
    assert.equal(elements(paragraph, 'spacing')[0].getAttributeNS(namespace, 'line'), String(Math.round((options?.lineSpacing || 1.8) * 240)));
  });
}
