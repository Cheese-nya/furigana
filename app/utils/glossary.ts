import type { ProperNounEntry } from './correctionDatabase';
import type { RubyType, ScriptLine } from './furigana';
import { applyRubyOverrides, type RubyOverride } from './rubyOverrides';

/** Literal longest-match first; explicit source/manual readings are applied later. */
export function glossaryOverrides(text: string, entries: ProperNounEntry[]): RubyOverride[] {
  const sorted = [...entries].sort((a, b) => b.surface.length - a.surface.length);
  const overrides: RubyOverride[] = [];
  for (let offset = 0; offset < text.length;) {
    const entry = sorted.find(value => value.surface && text.startsWith(value.surface, offset));
    if (entry) {
      overrides.push({ line: text, start: offset, surface: entry.surface, reading: entry.reading, type: entry.type });
      offset += entry.surface.length;
    } else offset++;
  }
  return overrides;
}

export function applyGlossary(line: ScriptLine, entries: ProperNounEntry[], type: RubyType): ScriptLine {
  return applyRubyOverrides(line, glossaryOverrides(line.cleanText, entries), type, 'glossary');
}
