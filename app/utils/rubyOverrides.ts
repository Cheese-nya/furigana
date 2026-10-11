import { formatRuby, KANJI_REGEX, katakanaToHiragana, type RubyType, type ScriptLine, type Token } from './furigana';

// Anchored to the exact line and character range: the same word can have different
// readings elsewhere. A changed line must be checked again, rather than guessed.
export interface RubyOverride {
  line: string;
  start: number;
  surface: string;
  reading: string;
  type: RubyType;
}

export function upsertRubyOverride(entries: RubyOverride[], entry: RubyOverride): RubyOverride[] {
  const end = entry.start + entry.surface.length;
  return [...entries.filter(value => value.line !== entry.line ||
    value.start + value.surface.length <= entry.start || value.start >= end), entry];
}

export function applyRubyOverrides(line: ScriptLine, overrides: RubyOverride[], type: RubyType): ScriptLine {
  let tokens = line.tokens;
  for (const entry of overrides.filter(value => value.line === line.cleanText).sort((a, b) => a.start - b.start)) {
    const end = entry.start + entry.surface.length;
    if (!entry.surface || line.cleanText.slice(entry.start, end) !== entry.surface) continue;
    const replacement: Token[] = [];
    let offset = 0;
    let inserted = false;
    for (const token of tokens) {
      const tokenEnd = offset + token.surface.length;
      if (tokenEnd <= entry.start || offset >= end) {
        replacement.push(token);
      } else {
        if (offset < entry.start) {
          const surface = token.surface.slice(0, entry.start - offset);
          replacement.push({ surface, hasKanji: KANJI_REGEX.test(surface) });
        }
        if (!inserted) {
          replacement.push({ surface: entry.surface, hasKanji: KANJI_REGEX.test(entry.surface),
            ruby: entry.reading ? (entry.type === 'romaji' ? entry.reading : formatRuby(katakanaToHiragana(entry.reading), type)) : undefined });
          inserted = true;
        }
        if (tokenEnd > end) {
          const surface = token.surface.slice(end - offset);
          replacement.push({ surface, hasKanji: KANJI_REGEX.test(surface) });
        }
      }
      offset = tokenEnd;
    }
    tokens = replacement;
  }
  return { ...line, tokens };
}

export function validateRubyOverrides(value: unknown): RubyOverride[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is RubyOverride => {
    if (typeof entry !== 'object' || entry === null) return false;
    const item = entry as Partial<RubyOverride>;
    return typeof item.line === 'string' && Number.isInteger(item.start) && (item.start ?? -1) >= 0 &&
      typeof item.surface === 'string' && item.surface.length > 0 && typeof item.reading === 'string' &&
      ['hiragana', 'katakana', 'romaji'].includes(item.type || '') &&
      item.line.slice(item.start, (item.start ?? 0) + item.surface.length) === item.surface;
  });
}
