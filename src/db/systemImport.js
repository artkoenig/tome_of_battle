import { processImportedData } from '../parser/xmlParser';
import { collectSchemaWarnings } from '../parser/importSchemaGate';
import { findMissingLibraryDependencies } from '../parser/libraryDependencies';
import { deleteSystem, saveSystem } from './database';

/**
 * The outcome of an attempted import. `IMPORTED` carries the freshly stored system;
 * `MISSING_LIBRARY_DEPENDENCIES` carries the dependencies that made the import abort
 * before anything was written, so the caller can name them to the user.
 */
export const SYSTEM_IMPORT_STATUS = Object.freeze({
  IMPORTED: 'imported',
  MISSING_LIBRARY_DEPENDENCIES: 'missing-library-dependencies',
});

// Advisory schema warnings are logged to the console rather than shown in the UI
// (ADR 0016, Revision 2026-07-18): rendering them in the Importer caused a visible
// flash on first import, between the loading overlay and the Heerlager view. This
// mirrors the console-only pattern in `updateSystemFromCatalogIndex`.
function logSchemaWarnings(warnings) {
  if (warnings.length === 0) return;
  console.warn(
    'Schema advisory for imported game data:',
    warnings.map((warning) => warning.message)
  );
}

/**
 * Completes an import for both import paths — the pre-bundled fork download and the
 * uploaded archive — from the point where the raw XML files are in hand: schema advisory,
 * parsing, the library-dependency guard, attaching the raw XMLs and persisting the system.
 * Keeping this in one place is what makes the guard apply to an uploaded archive as well,
 * not only to a bundle selection.
 *
 * The system is replaced rather than merged (delete before save), so a re-import never
 * leaves catalogues of a previous import behind. Nothing is written when the guard trips.
 *
 * @param {object} params
 * @param {{ name: string, content: string }[]} params.gstFiles the game system's raw XML.
 * @param {{ name: string, content: string }[]} params.catFiles the catalogues' raw XML.
 * @param {import('../parser/libraryDependencies').CatalogueDirectory} params.catalogueDirectory
 *   decides which unresolved catalogueLink targets the user could still add.
 * @param {(gstFiles: object[], catFiles: object[]) => Promise<object[]>} [params.collectWarnings]
 *   injected schema advisory collector; defaults to the real one.
 * @returns {Promise<{ status: string, system?: object, failedCatalogues?:
 *   import('../parser/xmlParser').CatalogueParseFailure[], missingDependencies?: object[] }>}
 *   An `IMPORTED` result carries the catalogues that failed to parse, so the caller can
 *   name them rather than confirming a completeness the stored system does not have.
 * @throws whatever parsing or persistence throws — the caller phrases the failure.
 */
export async function completeSystemImport({
  gstFiles,
  catFiles,
  catalogueDirectory,
  collectWarnings = collectSchemaWarnings,
}) {
  logSchemaWarnings(await collectWarnings(gstFiles, catFiles));

  const { system, failedCatalogues } = processImportedData(gstFiles, catFiles);

  const missingDependencies = findMissingLibraryDependencies(system.catalogues, catalogueDirectory);
  if (missingDependencies.length > 0) {
    return { status: SYSTEM_IMPORT_STATUS.MISSING_LIBRARY_DEPENDENCIES, missingDependencies };
  }

  system.rawXmls = { gst: gstFiles, cat: catFiles };

  await deleteSystem(system.id);
  await saveSystem(system);

  return { status: SYSTEM_IMPORT_STATUS.IMPORTED, system, failedCatalogues };
}
