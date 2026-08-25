import { validateFilesAgainstSchema, SCHEMA_KIND } from './schemaValidator';

/**
 * The import schema advisory (ADR 0016, Revision 2026-07-18). Every imported
 * `.gst`/`.cat` is validated against the vendored XSD, but a schema violation does
 * *not* abort the import: the data is parsed and stored anyway, and the locatable
 * violations (file + line) are returned so callers can surface them as a
 * non-blocking warning. This governs both the manual file import and the runtime
 * community-fork fetch (ADR 0014).
 *
 * The advisory replaces the original hard-gate: an empirical check found that real,
 * working catalogs violate the strict `xs:sequence` ordering of the official XSD,
 * so rejecting them would be stricter than the real BSData ecosystem (`wham publish`)
 * and would break functioning data. It reports *structural* deviations only;
 * roster-construction constraints ("allow beats forbid") are a different layer and
 * unaffected.
 */

const UNKNOWN_LINE_TEXT = 'unbekannt';

/**
 * A non-blocking schema advisory for a single imported file. Carries the offending
 * file name and the locatable violations so callers can present them; its `message`
 * is a ready-to-show German summary pointing at the file and the first violation and
 * making clear the import was continued.
 */
export class SchemaValidationWarning {
  /**
   * @param {string} fileName - The name of the file that failed validation.
   * @param {Array<{ line: number|null, column: number|null, message: string }>} errors
   */
  constructor(fileName, errors) {
    this.fileName = fileName;
    this.errors = errors;
    this.message = buildUserMessage(fileName, errors);
  }
}

function buildUserMessage(fileName, errors) {
  const firstError = errors[0];
  const location = firstError?.line != null ? `Zeile ${firstError.line}` : UNKNOWN_LINE_TEXT;
  const detail = firstError?.message ?? 'Unbekannter Schemafehler.';
  return (
    `Die Datei „${fileName}" entspricht nicht vollständig dem BattleScribe-Schema (v2.03); ` +
    `der Import wurde dennoch fortgesetzt. ${errors.length} Schemaverstoß/-verstöße gefunden. ` +
    `Erster Verstoß (${location}): ${detail}`
  );
}

function toWarning({ file, errors }) {
  return new SchemaValidationWarning(file.name, errors);
}

/**
 * Advisory schema check for a set of raw import files: validates every game system as
 * a `gameSystem` document and every catalogue as a `catalogue` document. Never throws
 * on a schema violation and never blocks the import — it resolves with one
 * {@link SchemaValidationWarning} per non-conforming file (empty when everything
 * conforms), so the caller parses/stores the data regardless and surfaces the
 * warnings to the user.
 *
 * Each kind is validated in a single xmllint invocation (compiling the schema once and
 * reusing it across all files of that kind), and the two kinds run concurrently. This
 * keeps a multi-file import off the strictly-sequential, cold-per-file path without
 * changing the advisory outcome: the warnings — one per non-conforming file, game
 * systems before catalogues, in input order — are identical to a per-file check.
 *
 * @param {Array<{ name: string, content: string }>} gstFiles
 * @param {Array<{ name: string, content: string }>} catFiles
 * @returns {Promise<Array<SchemaValidationWarning>>}
 */
export async function collectSchemaWarnings(gstFiles, catFiles) {
  const [gstResults, catResults] = await Promise.all([
    validateFilesAgainstSchema(gstFiles ?? [], SCHEMA_KIND.GAME_SYSTEM),
    validateFilesAgainstSchema(catFiles ?? [], SCHEMA_KIND.CATALOGUE),
  ]);
  return [...gstResults, ...catResults].map(toWarning);
}
