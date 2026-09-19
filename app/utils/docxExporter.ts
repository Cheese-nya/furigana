// app/utils/docxExporter.ts
/**
 * 生成真正的 Word (.docx) 文件，含原生 Word Ruby (假名标注在汉字正上方)
 * Uses native OpenXML <w:ruby> elements so MS Word & WPS render furigana directly ABOVE kanji.
 */

import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Packer,
  BorderStyle,
  XmlComponent,
} from 'docx';
import type { ScriptLine } from './furigana';

class ElementComponent extends XmlComponent {
  constructor(name: string) {
    super(name);
  }
}

/**
 * OpenXML Native Word Ruby Element (<w:ruby>)
 * Renders Phonetic Guide / Furigana directly ABOVE the base text in Word & WPS.
 */
class RubyElement extends XmlComponent {
  constructor(baseText: string, rubyText: string, baseSize = 24, rubySize = 12) {
    super('w:ruby');

    // w:rubyPr (Properties)
    const rubyPr = new ElementComponent('w:rubyPr');
    const rubyAlign = new ElementComponent('w:rubyAlign');
    (rubyAlign as any).root.push({ _attr: { 'w:val': 'distributeSpace' } });
    const hps = new ElementComponent('w:hps');
    (hps as any).root.push({ _attr: { 'w:val': String(rubySize) } });
    const hpsRaise = new ElementComponent('w:hpsRaise');
    (hpsRaise as any).root.push({ _attr: { 'w:val': '18' } });
    const hpsBaseText = new ElementComponent('w:hpsBaseText');
    (hpsBaseText as any).root.push({ _attr: { 'w:val': String(baseSize) } });
    const lid = new ElementComponent('w:lid');
    (lid as any).root.push({ _attr: { 'w:val': 'ja-JP' } });

    (rubyPr as any).root.push(rubyAlign, hps, hpsRaise, hpsBaseText, lid);

    // w:rt (Ruby Text - Furigana positioned directly ABOVE kanji)
    const rt = new ElementComponent('w:rt');
    const rtRun = new TextRun({
      text: rubyText,
      size: rubySize,
      color: '2563EB', // Blue furigana on top
      font: 'Yu Gothic',
    });
    (rt as any).root.push(rtRun);

    // w:rubyBase (Base Kanji Text)
    const rubyBase = new ElementComponent('w:rubyBase');
    const baseRun = new TextRun({
      text: baseText,
      size: baseSize, // 12pt = 小四
      font: 'Yu Gothic',
      color: '1A1A1A',
    });
    (rubyBase as any).root.push(baseRun);

    (this as any).root.push(rubyPr, rt, rubyBase);
  }
}

export interface DocxExportOptions {
  title?: string;        // Document title (defaults to text name or '日语假名配音台本')
  baseFontSize?: number; // in px (e.g. 16)
  rubyFontSize?: number; // in px (e.g. 10)
  lineSpacing?: number;  // e.g. 1.8
}

/**
 * Build a real .docx Blob with native Word Ruby annotations (Furigana directly ABOVE Kanji),
 * respecting customizable line spacing and furigana font size options.
 */
export async function buildDocxBlob(lines: ScriptLine[], options?: DocxExportOptions): Promise<Blob> {
  const children: Paragraph[] = [];

  const baseSizeHalfPts = Math.round((options?.baseFontSize || 16) * 1.5);
  const rubySizeHalfPts = Math.round((options?.rubyFontSize || 10) * 1.5);
  const lineSpacingVal = Math.round((options?.lineSpacing || 1.8) * 240);

  const docTitle = options?.title?.trim() || '日语假名配音台本';

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: docTitle,
          bold: true,
          size: 36, // 18pt
          font: 'Yu Gothic',
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Furigana Dubbing Studio 自动注音导出',
          color: '666666',
          size: 20, // 10pt
          font: 'Yu Gothic',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Horizontal rule
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '' })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      },
      spacing: { after: 300 },
    })
  );

  // Process each script line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const paragraphChildren: (TextRun | RubyElement)[] = [];

    // Speaker prefix (bold)
    if (line.speaker) {
      paragraphChildren.push(
        new TextRun({
          text: `${line.speaker}：`,
          bold: true,
          size: baseSizeHalfPts,
          font: 'Yu Gothic',
          color: '333333',
        })
      );
    }

    // Render tokens with native Word Ruby elements (<w:ruby>)
    for (const token of line.tokens) {
      if (token.ruby) {
        // Kanji with furigana directly ABOVE it!
        paragraphChildren.push(
          new RubyElement(token.surface, token.ruby, baseSizeHalfPts, rubySizeHalfPts)
        );
      } else {
        // Normal text without furigana
        paragraphChildren.push(
          new TextRun({
            text: token.surface,
            size: baseSizeHalfPts,
            font: 'Yu Gothic',
            color: '1A1A1A',
          })
        );
      }
    }

    children.push(
      new Paragraph({
        children: paragraphChildren,
        spacing: { after: 120, line: lineSpacingVal },
      })
    );


  }

  // Footer
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '' })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      },
      spacing: { before: 400, after: 200 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '由 Furigana Dubbing Studio 自动生成 • チーズ@beimisama',
          color: '999999',
          size: 16,
          font: 'Yu Gothic',
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
