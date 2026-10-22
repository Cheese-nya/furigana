import { deleteLearnedReading, setScriptOverrides, type CorrectionDatabaseV2, type LearnedReading } from './correctionDatabase';
import { readingContext } from './review';

/**
 * 「恢复自动」 for the range [start, end) of `line`: drop this script's manual corrections that cover
 * the range, and every reading this script learned for an occurrence overlapping it in the same
 * context. Otherwise the learned reading would take over again as soon as the correction is gone.
 * Proper-noun glossary entries and imported (source) readings are left alone. Saving an empty
 * custom reading is a different action: an explicit "no ruby" correction.
 */
export function restoreAutomaticReading(database: CorrectionDatabaseV2, scriptId: string, line: string, start: number, end: number): CorrectionDatabaseV2 {
  const script = database.scripts[scriptId];
  if (!script) return database;
  const overlaps = (from: number, length: number) => from < end && start < from + length;
  const overrides = script.overrides.filter(entry => entry.line !== line || !overlaps(entry.start, entry.surface.length));
  let updated = overrides.length === script.overrides.length ? database : setScriptOverrides(database, scriptId, overrides);
  const taughtHere = (entry: LearnedReading) => {
    for (let at = line.indexOf(entry.surface); at >= 0; at = line.indexOf(entry.surface, at + 1)) {
      if (!overlaps(at, entry.surface.length)) continue;
      const context = readingContext(line, at, entry.surface.length);
      if (context.before === entry.before && context.after === entry.after) return true;
    }
    return false;
  };
  // Delete from the end so the remaining indexes stay valid.
  for (let index = script.learned.length - 1; index >= 0; index--) {
    if (taughtHere(script.learned[index])) updated = deleteLearnedReading(updated, scriptId, index);
  }
  return updated;
}
