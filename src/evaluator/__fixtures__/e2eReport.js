/**
 * Gemeinsame **Bericht-Leser** des manifest-getriebenen E2E-Runners
 * (`e2e.testcatalog.test.js`, ADR-0033): kleine, reine Filter, die aus dem Bericht
 * der Fassade `evaluate` die Verletzungen zu einer Grenz-Id bzw. die Diagnosen zu
 * einer Art (samt optionaler Ziel-Ids) herausziehen. Ausgelagert, damit der Runner
 * diese Lese-Semantik an einer Stelle haelt statt sie je Assertion neu zu erfinden.
 */

/** Alle Verletzungen zu einer Grenz-Id. */
export function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

/** Die (erste) Verletzung zu einer Grenz-Id, oder `undefined`. */
export function violationOf(report, limitId) {
  return violationsOf(report, limitId)[0];
}

/**
 * Alle Diagnosen des Berichts, die auf eine Art (`kind`) und — optional — auf ein
 * konkretes `targetId`/`defId` passen. Ein nicht gesetztes Feld schraenkt nicht ein.
 *
 * @param {{ diagnostics: Array<{ kind: string, targetId?: string, defId?: string }> }} report
 *   Der Bericht der Fassade `evaluate`.
 * @param {string} kind Die gesuchte Diagnose-Art (SSOT-Wert aus `DiagnosticKind`).
 * @param {{ targetId?: string, defId?: string }} [spec] Optionale Ziel-Einschraenkung.
 * @returns {Array<{ kind: string, targetId?: string, defId?: string }>} Die passenden Diagnosen.
 */
export function diagnosticsMatching(report, kind, { targetId, defId } = {}) {
  return report.diagnostics.filter(diagnostic => {
    if (diagnostic.kind !== kind) return false;
    if (targetId !== undefined && diagnostic.targetId !== targetId) return false;
    if (defId !== undefined && diagnostic.defId !== defId) return false;
    return true;
  });
}
