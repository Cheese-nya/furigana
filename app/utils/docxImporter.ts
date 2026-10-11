import JSZip from 'jszip';
import { katakanaToHiragana } from './furigana';
import type { RubyOverride } from './rubyOverrides';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface ImportedScript {
  text: string;
  overrides: RubyOverride[];
}

/** Read body text and phonetic guides, including legacy paragraph-level ruby.
 * Ruby base text belongs to the script; ruby readings must never be duplicated
 * into the body text. DOMParser is native in the browser and Windows WebView2.
 */
export async function importDocx(arrayBuffer: ArrayBuffer): Promise<ImportedScript> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('Word document.xml is missing');
  return parseDocxXml(await file.async('string'));
}

export function parseDocxXml(source: string): ImportedScript {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid Word XML');
  const body = doc.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) throw new Error('Word document body is missing');
  const paragraphs: string[] = [];
  const overrides: RubyOverride[] = [];
  for (const paragraph of Array.from(body.getElementsByTagNameNS(WORD_NS, 'p'))) {
    let text = '';
    const rubies: { start: number; surface: string; reading: string }[] = [];
    const plainText = (node: Element): string => Array.from(node.getElementsByTagNameNS(WORD_NS, 't')).map(value => value.textContent || '').join('');
    const walk = (node: Element) => {
      if (node.namespaceURI !== WORD_NS) {
        for (const child of Array.from(node.childNodes)) if (child.nodeType === 1) walk(child as Element);
        return;
      }
      if (node.localName === 'ruby') {
        const base = node.getElementsByTagNameNS(WORD_NS, 'rubyBase')[0];
        const rt = node.getElementsByTagNameNS(WORD_NS, 'rt')[0];
        const surface = base ? plainText(base) : '';
        if (surface && rt) rubies.push({ start: text.length, surface, reading: katakanaToHiragana(plainText(rt)) });
        text += surface;
        return;
      }
      if (node.localName === 't') { text += node.textContent || ''; return; }
      if (node.localName === 'tab') { text += '\t'; return; }
      if (node.localName === 'br' || node.localName === 'cr') { text += '\n'; return; }
      if (['rt', 'del', 'pPr', 'rPr'].includes(node.localName)) return;
      if (node !== paragraph && node.localName === 'p') return;
      for (const child of Array.from(node.childNodes)) if (child.nodeType === 1) walk(child as Element);
    };
    walk(paragraph);
    paragraphs.push(text);
    for (const ruby of rubies) {
      const before = text.slice(0, ruby.start);
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineEnd = text.indexOf('\n', ruby.start);
      overrides.push({ ...ruby, line: text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd),
        start: ruby.start - lineStart, type: 'hiragana' });
    }
  }
  return { text: paragraphs.join('\n'), overrides };
}
