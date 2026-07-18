import { validateXML } from 'xmllint-wasm';
import vendoredCatalogueXsd from './schema/Catalogue.xsd?raw';

/**
 * Structural validation of BattleScribe XML against the vendored, version-pinned
 * `Catalogue.xsd` (v2.03, see ADR 0016). This is the import schema advisory's core
 * seam: it answers "is this document structurally valid?" — not whether the data is
 * semantically buildable (roster-construction constraints are a different layer).
 * The result is advisory only (ADR 0016, Revision 2026-07-18): a failure is
 * reported but never aborts the import.
 */

/**
 * The three BattleScribe document kinds. The single vendored XSD serves all three
 * via a namespace swap (see the schema's own header comment); the kind selects which
 * target namespace the schema is validated under.
 */
export const SCHEMA_KIND = Object.freeze({
  CATALOGUE: 'catalogue',
  GAME_SYSTEM: 'gameSystem',
  ROSTER: 'roster',
});

// The vendored XSD is authored for the catalogue namespace. Its two namespace-bearing
// attributes (`xmlns:tns` and `targetNamespace`) are swapped to the requested kind's
// namespace so the same file can validate game systems and rosters too.
const CATALOGUE_NAMESPACE = 'http://www.battlescribe.net/schema/catalogueSchema';

const NAMESPACE_BY_KIND = Object.freeze({
  [SCHEMA_KIND.CATALOGUE]: CATALOGUE_NAMESPACE,
  [SCHEMA_KIND.GAME_SYSTEM]: 'http://www.battlescribe.net/schema/gameSystemSchema',
  [SCHEMA_KIND.ROSTER]: 'http://www.battlescribe.net/schema/rosterSchema',
});

/**
 * Produces the XSD text for a given target namespace by swapping the vendored
 * catalogue namespace on the two namespace-bearing attributes only. The vendored
 * file itself is never mutated (its sha256 is pinned in PROVENANCE.md) — this returns
 * a new string.
 */
function schemaTextForNamespace(targetNamespace) {
  if (targetNamespace === CATALOGUE_NAMESPACE) {
    return vendoredCatalogueXsd;
  }
  return vendoredCatalogueXsd
    .replace(
      `xmlns:tns="${CATALOGUE_NAMESPACE}"`,
      `xmlns:tns="${targetNamespace}"`
    )
    .replace(
      `targetNamespace="${CATALOGUE_NAMESPACE}"`,
      `targetNamespace="${targetNamespace}"`
    );
}

/**
 * Maps a libxml2 validation error to the seam's locatable-error shape. libxml2's
 * schema validation reports the line only; the column is not emitted, so it is
 * surfaced as null rather than a misleading guess.
 */
function toLocatableError(validationError) {
  return {
    line: validationError.loc?.lineNumber ?? null,
    column: null,
    message: validationError.message,
  };
}

/**
 * Resolves the target namespace for a document kind, rejecting unknown kinds. The
 * single source of truth for the kind → namespace mapping used by both the
 * single-document and multi-document entry points.
 *
 * @throws {Error} If `kind` is not one of the known schema kinds.
 */
function resolveTargetNamespace(kind) {
  const targetNamespace = NAMESPACE_BY_KIND[kind];
  if (!targetNamespace) {
    const knownKinds = Object.values(SCHEMA_KIND).join(', ');
    throw new Error(
      `Unknown schema kind "${kind}". Expected one of: ${knownKinds}.`
    );
  }
  return targetNamespace;
}

/**
 * Validates BattleScribe XML text against the vendored XSD for the given document
 * kind.
 *
 * @param {string} xmlText - The raw XML document text.
 * @param {typeof SCHEMA_KIND[keyof typeof SCHEMA_KIND]} kind - Which document kind to
 *   validate as; selects the target namespace.
 * @returns {Promise<{ valid: boolean, errors: Array<{ line: number|null, column: number|null, message: string }> }>}
 * @throws {Error} If `kind` is not one of the known schema kinds.
 */
export async function validateAgainstSchema(xmlText, kind) {
  const targetNamespace = resolveTargetNamespace(kind);

  const result = await validateXML({
    xml: [{ fileName: `${kind}.xml`, contents: xmlText }],
    schema: [schemaTextForNamespace(targetNamespace)],
  });

  return {
    valid: result.valid,
    errors: result.errors.map(toLocatableError),
  };
}

// A per-file identifier handed to xmllint as the document's file name. libxml echoes
// it back on every error location (`loc.fileName`), which is how a batch run's errors
// are attributed to the right file. It is derived from the file's index — not its real
// name — so it can never collide, never start with a dash (which xmllint would read as
// a CLI option), and never contain a colon (which the library's error parser splits on).
function validationIdForIndex(index) {
  return `doc-${index}.xml`;
}

/**
 * Groups a batch run's raw libxml errors by the document they belong to, keyed by the
 * per-file validation id (`loc.fileName`). Errors without a location are dropped: in a
 * multi-document run libxml emits a locationless "&lt;file&gt; fails to validate" summary
 * line per invalid file, which is noise rather than a distinct violation — exactly the
 * line the single-document path also discards.
 */
function groupLocatableErrorsByValidationId(rawErrors) {
  const errorsByValidationId = new Map();
  for (const rawError of rawErrors) {
    const validationId = rawError.loc?.fileName;
    if (validationId == null) continue;
    const existing = errorsByValidationId.get(validationId);
    if (existing) {
      existing.push(rawError);
    } else {
      errorsByValidationId.set(validationId, [rawError]);
    }
  }
  return errorsByValidationId;
}

/**
 * Validates many documents of a single kind against the vendored XSD in one xmllint
 * invocation. The schema is compiled once and reused across every document, and only a
 * single WebAssembly worker is spun up — far cheaper than one cold-start validation per
 * file. The result is advisory only (ADR 0016): non-conforming documents are reported,
 * never rejected.
 *
 * Only documents that produced at least one locatable schema violation are returned,
 * each with its errors in the seam's locatable-error shape and its position in the
 * returned array following the input order. Documents that conform yield nothing. This
 * reproduces the single-document path's output exactly, per document.
 *
 * @param {Array<{ name: string, content: string }>} files
 * @param {typeof SCHEMA_KIND[keyof typeof SCHEMA_KIND]} kind - Which document kind to
 *   validate every file as; selects the target namespace.
 * @returns {Promise<Array<{ file: { name: string, content: string }, errors: Array<{ line: number|null, column: number|null, message: string }> }>>}
 * @throws {Error} If `kind` is not one of the known schema kinds.
 */
export async function validateFilesAgainstSchema(files, kind) {
  const targetNamespace = resolveTargetNamespace(kind);
  if (files.length === 0) return [];

  const identifiedFiles = files.map((file, index) => ({
    file,
    validationId: validationIdForIndex(index),
  }));

  const result = await validateXML({
    xml: identifiedFiles.map(({ file, validationId }) => ({
      fileName: validationId,
      contents: file.content,
    })),
    schema: [schemaTextForNamespace(targetNamespace)],
  });

  const errorsByValidationId = groupLocatableErrorsByValidationId(result.errors);

  return identifiedFiles
    .map(({ file, validationId }) => ({
      file,
      errors: (errorsByValidationId.get(validationId) ?? []).map(toLocatableError),
    }))
    .filter(({ errors }) => errors.length > 0);
}
