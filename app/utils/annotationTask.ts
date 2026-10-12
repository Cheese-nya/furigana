import { annotateLine, formatRuby, type RubyType, type ScriptLine } from './furigana';
import { applyRubyOverrides, type RubyOverride } from './rubyOverrides';
import { applyGlossary } from './glossary';
import type { LearnedReading, ProperNounEntry } from './correctionDatabase';
import { learnedOverrides } from './review';

export interface AnnotationInput {
  text: string;
  rubyType: RubyType;
  glossary: ProperNounEntry[];
  sourceOverrides: RubyOverride[];
  overrides: RubyOverride[];
  learned?: LearnedReading[];
}

export interface AnnotationChunk { offset: number; lines: ScriptLine[]; total: number }

export const yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function groupOverrides(entries: RubyOverride[]) {
  const grouped = new Map<string, RubyOverride[]>();
  for (const entry of entries) grouped.set(entry.line, [...(grouped.get(entry.line) || []), entry]);
  return grouped;
}

function applyLearned(line: ScriptLine, entries: LearnedReading[] = [], type: RubyType): ScriptLine {
  if (!entries || !entries.length) return line;
  const overrides = learnedOverrides(line, entries, type);
  return applyRubyOverrides(line, overrides, type, 'learned');
}

/** Own one cache per execution environment; cache canonical readings, never overlays. */
export function createAnnotator() {
  const cache = new Map<string, ScriptLine>();
  return {
    clear: () => cache.clear(),
    async run(input: AnnotationInput, cancelled: () => boolean, onChunk: (chunk: AnnotationChunk) => void): Promise<void> {
      const texts = input.text.split('\n');
      const source = groupOverrides(input.sourceOverrides);
      const overrides = groupOverrides(input.overrides);
      for (let offset = 0; offset < texts.length; offset += 50) {
        if (cancelled()) throw new DOMException('注音任务已取消', 'AbortError');
        const lines = texts.slice(offset, offset + 50).map((text, index) => {
          let canonical = cache.get(text);
          if (!canonical) {
            canonical = annotateLine(text, 'hiragana');
            cache.set(text, canonical);
            if (cache.size > 12000) cache.delete(cache.keys().next().value!);
          }
          const line: ScriptLine = { ...canonical, id: String(offset + index), tokens: canonical.tokens.map(token => ({ ...token,
            ...(token.ruby ? { ruby: formatRuby(token.ruby, input.rubyType) } : {}),
            ...(token.alternatives ? { alternatives: token.alternatives.map(value => formatRuby(value, input.rubyType)) } : {}),
          })) };
          return applyRubyOverrides(applyRubyOverrides(applyLearned(applyGlossary(line, input.glossary, input.rubyType), input.learned, input.rubyType),
            source.get(text) || [], input.rubyType, 'source'), overrides.get(text) || [], input.rubyType, 'manual');
        });
        onChunk({ offset, lines, total: texts.length });
        // Give CANCEL/ANNOTATE messages an opportunity to run between chunks.
        await yieldTask();
      }
      if (cancelled()) throw new DOMException('注音任务已取消', 'AbortError');
    },
  };
}
