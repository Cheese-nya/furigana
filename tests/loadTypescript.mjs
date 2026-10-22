import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const requireTs = Module.createRequire(import.meta.url);
requireTs.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};
// Extensionless relative imports in transpiled TS (e.g. `require("./docxImporter")`)
// must resolve to the sibling .ts source under this test loader.
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('.') && parent?.filename?.endsWith('.ts')) {
    try {
      return resolveFilename.call(this, `${request}.ts`, parent, isMain, options);
    } catch {
      // Fall through to Node's resolver for real packages and existing .js files.
    }
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};

export function loadTypescript(relativePath) {
  return requireTs(fileURLToPath(new URL(relativePath, import.meta.url)));
}
