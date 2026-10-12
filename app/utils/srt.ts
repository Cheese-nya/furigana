import type { ScriptLine } from './furigana';

export interface SrtCue {
  index: string;
  start: string;
  end: string;
  lines: string[];
}

export interface ParsedSrt {
  text: string;
  cues: SrtCue[];
}

const TIMING = /^\s*(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})(?:\s+.*)?$/;

export function parseSRT(source: string): ParsedSrt {
  const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const rows = block.split('\n');
    const timingIndex = rows.findIndex(row => TIMING.test(row));
    if (timingIndex < 0) continue;
    const match = rows[timingIndex].match(TIMING);
    if (!match) continue;
    const content = rows.slice(timingIndex + 1);
    if (!content.length) continue;
    cues.push({ index: rows.slice(0, timingIndex).join(' ') || String(cues.length + 1), start: match[1], end: match[2], lines: content });
  }
  return { cues, text: cues.map(cue => cue.lines.join('\n')).join('\n') };
}

function annotatedText(line: ScriptLine): string {
  return line.tokens.map(token => token.ruby ? `${token.surface}(${token.ruby})` : token.surface).join('');
}

/** Preserve imported cue timing and grouping when the user has not changed the cue layout. */
export function generateSRT(lines: ScriptLine[], cues?: SrtCue[]): string {
  const cueLineCount = cues?.reduce((total, cue) => total + cue.lines.length, 0) || 0;
  if (cues?.length && cueLineCount === lines.length) {
    let lineIndex = 0;
    return cues.map(cue => {
      const content = cue.lines.map(() => annotatedText(lines[lineIndex++] || { tokens: [], cleanText: '', id: '' })).join('\n');
      return `${cue.index}\n${cue.start} --> ${cue.end}\n${content}`;
    }).join('\n\n') + '\n';
  }
  return lines.map((line, index) => {
    const startTime = formatSRTTime(index * 4);
    const endTime = formatSRTTime(index * 4 + 3);
    return `${index + 1}\n${startTime} --> ${endTime}\n${annotatedText(line)}\n`;
  }).join('\n');
}

function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs},000`;
}
