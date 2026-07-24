/**
 * Fassade der zweiten, raeumlich getrennten Auswertungs-Engine (ADR-0030).
 *
 * Dies ist die **einzige** legale Aussenschnittstelle des `src/evaluator/`-
 * Moduls — analog zur Solver-Fassade `src/solver/validator.js` aus ADR-0023,
 * hier auf die Reinraum-Engine gespiegelt. Der Zugriff von aussen nur ueber
 * diese Datei und die harte Import-Trennung zu `src/solver/` (in beide
 * Richtungen) sind maschinell durchgesetzt (`.oxlintrc.json`,
 * `.dependency-cruiser.cjs`).
 *
 * Die Auswertung ist eine reine Funktion `evaluate(katalog, roster) → Bericht`
 * ohne Seiteneffekte: kein App-Zustand, keine UI, kein IndexedDB
 * (`docs/evaluator-architecture.md` §2, Leitprinzip 1).
 */

import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { evaluateConstraints } from './constraints.js';
import { buildReport } from './report.js';

/**
 * Wertet ein Roster gegen einen Katalog aus und liefert den Bericht.
 *
 * @param {string} catalogXml  Entpacktes `.cat`/`.gst`-XML des Katalogs.
 * @param {{ forces?: Array<{ defId: string, count: number, children?: object[] }> }} roster
 *   Instanzbaum des Rosters.
 * @returns {{ violations: object[], diagnostics: object[] }} Der Bericht.
 */
export function evaluate(catalogXml, roster) {
  const catalogue = parseCatalogue(catalogXml);
  const resolved = resolveCatalogue(catalogue);
  const { root, diagnostics: joinDiagnostics } = buildEvalTree(resolved, roster);
  const index = buildIndex(root);

  const constraintDiagnostics = [];
  const results = evaluateConstraints(root, index, resolved.categoryIds, constraintDiagnostics);

  const diagnostics = [
    ...catalogue.diagnostics,
    ...resolved.diagnostics,
    ...joinDiagnostics,
    ...constraintDiagnostics,
  ];
  return buildReport(results, diagnostics);
}
