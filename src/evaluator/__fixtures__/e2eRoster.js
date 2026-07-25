/**
 * Kleine, gemeinsame Bausteine der real-daten-getriebenen E2E-Tests
 * (`e2e.*.test.js`, ADR-0032): der Instanzbaum, den die Fassade `evaluate`
 * erwartet, und die Bericht-Leser, die eine Verletzung zu einer Grenz-Id
 * herausfiltern. Ausgelagert, damit die drei Armee-Suiten (Ogre, Orcs & Goblins,
 * Vampire Counts) identische Roster-Semantik teilen statt sie je Datei neu zu
 * erfinden.
 */

/** Eine Auswahl-Instanz gegebener Anzahl mit optionalen Kindern. */
export function selection(defId, count = 1, children = []) {
  return { defId, count, children };
}

/** Ein Kontingent gegebener Definition, das die uebergebenen Auswahlen traegt. */
export function force(defId, children = []) {
  return { defId, count: 1, children };
}

/** Ein Roster aus den uebergebenen Kontingenten. */
export function roster(...forces) {
  return { forces };
}

/** Alle Verletzungen zu einer Grenz-Id. */
export function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

/** Die (erste) Verletzung zu einer Grenz-Id, oder `undefined`. */
export function violationOf(report, limitId) {
  return violationsOf(report, limitId)[0];
}

/** Anzahl der Diagnosen der gegebenen Art im Bericht. */
export function countDiagnostics(report, kind) {
  return report.diagnostics.filter(diagnostic => diagnostic.kind === kind).length;
}
