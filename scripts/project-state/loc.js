/**
 * Reine Ermittlung des Codeumfangs (ohne Dateizugriff, damit sie testbar bleibt).
 * Eingabe ist der bereits eingelesene Produktivcode, Ausgabe die Zeilen je Modul
 * und die Gesamtsumme.
 *
 * "Zeile" meint hier eine Codezeile im Sinne nicht-leerer Zeilen: reine
 * Leerzeilen zaehlen nicht mit, damit der Umfang nicht von der Formatierung
 * abhaengt. Kommentare bleiben absichtlich enthalten -- sie herauszurechnen
 * verlangte ein Lexing des Quelltexts und braechte fuer eine grobe
 * Umfangsschaetzung keinen Gegenwert (KISS).
 *
 * Die Modulzuordnung teilt sich {@link module:project-state/coverage} dieselbe
 * Funktion, damit LOC und Abdeckung dieselben Modulnamen tragen.
 *
 * @module project-state/loc
 */
import { moduleFromPath } from './coverage.js';

/**
 * Zaehlt die Codezeilen eines Quelltexts: alle Zeilen ohne die rein leeren.
 *
 * @param {string} source
 * @returns {number}
 */
export function countCodeLines(source) {
  return (source ?? '').split('\n').filter((line) => line.trim() !== '').length;
}

/**
 * @typedef {object} ModuleLoc
 * @property {string} module     Verzeichnis relativ zur Projektwurzel.
 * @property {number} fileCount
 * @property {number} lines      Codezeilen (ohne Leerzeilen) ueber alle Dateien des Moduls.
 */

/**
 * Verdichtet den Produktivcode zu Codezeilen je Modul und einer Gesamtsumme.
 *
 * @param {ReadonlyArray<{ path: string, source: string }>} files
 * @returns {{ modules: ModuleLoc[], totalLines: number }}  Module absteigend nach Zeilen.
 */
export function aggregateLoc(files) {
  /** @type {Map<string, { fileCount: number, lines: number }>} */
  const byModule = new Map();
  let totalLines = 0;

  for (const { path, source } of files ?? []) {
    const module = moduleFromPath(path);
    const lines = countCodeLines(source);
    totalLines += lines;
    const bucket = byModule.get(module) ?? { fileCount: 0, lines: 0 };
    bucket.fileCount += 1;
    bucket.lines += lines;
    byModule.set(module, bucket);
  }

  const modules = [...byModule.entries()]
    .map(([module, bucket]) => ({ module, fileCount: bucket.fileCount, lines: bucket.lines }))
    .sort((a, b) => b.lines - a.lines || a.module.localeCompare(b.module));

  return { modules, totalLines };
}
