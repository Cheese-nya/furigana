import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Module from 'node:module';
import { performance } from 'node:perf_hooks';
import { DOMParser } from '@xmldom/xmldom';
import ts from 'typescript';
import { loadTypescript } from '../tests/loadTypescript.mjs';

const directory = process.argv[2];
if (!directory) throw new Error('Usage: node tools/audit-scripts.mjs <script-directory> [output.json] [baseline.ts] [native-comparison.json] [corpus-export.json]');
globalThis.DOMParser = DOMParser;
const { importDocx } = loadTypescript('../app/utils/docxImporter.ts');
const current = loadTypescript('../app/utils/furigana.ts');
const { initKuromoji } = loadTypescript('../app/utils/kuromojiEngine.ts');
const kuromoji = (await import('kuromoji')).default;
const original = kuromoji.builder;
kuromoji.builder = options => original({ ...options, dicPath: path.resolve('public/dict') });
globalThis.window = { location: { protocol: 'file:' } };
await initKuromoji();
delete globalThis.window;
const engines = { current: current.annotateLine };
if (process.argv[4] && process.argv[4] !== '-') {
  const filename = path.resolve('app/utils/baseline.ts');
  const baseline = new Module(filename);
  baseline.filename = filename;
  baseline.paths = Module._nodeModulePaths(path.dirname(filename));
  baseline._compile(ts.transpileModule(await readFile(process.argv[4], 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  engines.baseline = baseline.exports.annotateLine;
}
const native = process.argv[5] && process.argv[5] !== '-' ? JSON.parse(await readFile(process.argv[5], 'utf8')) : {};
const results = {};
const documents = [];
const corpus = [];
for (const filename of (await readdir(directory)).filter(name => name.endsWith('.docx')).sort()) {
  const bytes = await readFile(path.join(directory, filename));
  const imported = await importDocx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  // Our own earlier exports are useful for text preservation and load testing,
  // but their machine-generated readings are not an independent reference.
  corpus.push({ name: filename, ...imported });
  const generated = imported.text.includes('Furigana Dubbing Studio 自动注音导出');
  const lines = imported.text.split('\n');
  documents.push({ name: filename, lines: lines.length, characters: imported.text.length, sourceRubies: imported.overrides.length, generated });
  const names = [...Object.keys(engines), ...Object.keys(native[filename] || {})];
  for (const name of names) {
    const stats = results[name] ||= { lines: 0, bodyMismatches: 0, kanjiWithoutReading: 0, referenceSpans: 0, comparable: 0, matched: 0, milliseconds: 0, examples: [] };
    const start = performance.now();
    for (let index = 0; index < lines.length; index++) {
      const text = lines[index];
      const tokens = engines[name] ? engines[name](text).tokens :
        (native[filename][name][index] || []).flatMap(token => current.parseCompoundToTokens(token.surface, /[\u3040-\u30FF]/u.test(token.reading || '') ? token.reading : ''));
      stats.lines++;
      if (tokens.map(token => token.surface).join('') !== text) stats.bodyMismatches++;
      stats.kanjiWithoutReading += tokens.filter(token => current.KANJI_REGEX.test(token.surface) && !token.ruby).length;
      if (generated) continue;
      for (const entry of imported.overrides.filter(value => value.line === text)) {
        stats.referenceSpans++;
        const end = entry.start + entry.surface.length;
        let offset = 0;
        let complete = true;
        let reading = '';
        for (const token of tokens) {
          const tokenEnd = offset + token.surface.length;
          if (tokenEnd > entry.start && offset < end) {
            if (offset < entry.start || tokenEnd > end) {
              if (token.ruby) complete = false;
              else reading += token.surface.slice(Math.max(0, entry.start - offset), end - offset);
            } else reading += token.ruby || token.surface;
          }
          offset = tokenEnd;
        }
        if (!complete) continue;
        stats.comparable++;
        if (current.katakanaToHiragana(reading) === current.katakanaToHiragana(entry.reading)) stats.matched++;
        else if (stats.examples.length < 12) stats.examples.push({ document: filename, base: entry.surface, expected: entry.reading, actual: reading });
      }
    }
    stats.milliseconds += performance.now() - start;
  }
}
const report = { documents, results, note: 'Reference agreement is not overall accuracy. Generated exports are excluded from references. Overlapping tokenizer spans are counted as non-comparable. Native timing includes alignment only, not tokenizer runtime.' };
const json = JSON.stringify(report, null, 2);
if (process.argv[3]) await writeFile(process.argv[3], json);
if (process.argv[6]) await writeFile(process.argv[6], JSON.stringify(corpus));
console.log(JSON.stringify({ documents: documents.length, characters: documents.reduce((sum, value) => sum + value.characters, 0), results }, null, 2));
