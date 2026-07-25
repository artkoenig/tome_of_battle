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
 * Die Auswertung ist eine reine Funktion `evaluate(datensatz, roster) → Bericht`
 * ohne Seiteneffekte: kein App-Zustand, keine UI, kein IndexedDB
 * (`docs/evaluator-architecture.md` §2, Leitprinzip 1).
 *
 * Der Datensatz trennt die **einzelne** Spielsystemdatei (`.gst`) strukturell von
 * der **Liste** der Armee-Kataloge (`.cat`) — `{ gameSystem, catalogues }`
 * (ADR-0032). Die deterministische kataloguebergreifende Verarbeitungsreihenfolge
 * (Spielsystem zuerst, dann die Kataloge in Aufruf-Reihenfolge) leitet die Engine
 * selbst ab; sie ist **keine** positionsabhaengige Aufrufer-Konvention.
 */

import { parseCatalogue } from './catalogReader.js';
import { mergeCatalogues } from './catalogSet.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { evaluateToFixpoint } from './fixpoint.js';
import { evaluateConstraints } from './constraints.js';
import { evaluateRosterBudget } from './budget.js';
import { buildReport } from './report.js';
import { createRosterBudget } from './rosterBudget.js';
import { DiagnosticKind, diagnostic } from './model.js';

/**
 * Prueft die Kohaerenz des Datensatzes und meldet sie als Diagnose statt einer
 * stillen Teil-Auswertung (ADR-0032, Entscheidung 3):
 *
 * - **`GAMESYSTEM_MISMATCH`**: ein Katalog nennt eine `gameSystemId`, die nicht zur
 *   mitgegebenen `.gst` passt.
 * - **`MISSING_CATALOGUE_DEPENDENCY`**: ein Katalog deklariert per `catalogueLink`
 *   eine Abhaengigkeit auf einen Katalog, der nicht mitgegeben wurde.
 *
 * Ohne mitgegebenes Spielsystem entfaellt die `gameSystemId`-Pruefung (ein
 * synthetischer Einzelkatalog ohne `.gst`).
 */
function checkDatasetCoherence(gameSystemDoc, catalogueDocs, diagnostics) {
  const providedCatalogueIds = new Set(catalogueDocs.map(doc => doc.id));
  for (const catalogue of catalogueDocs) {
    if (gameSystemDoc !== null && catalogue.gameSystemId !== null && catalogue.gameSystemId !== gameSystemDoc.id) {
      diagnostics.push(diagnostic(DiagnosticKind.GAMESYSTEM_MISMATCH, {
        catalogueId: catalogue.id,
        gameSystemId: catalogue.gameSystemId,
        expected: gameSystemDoc.id,
      }));
    }
    for (const link of catalogue.catalogueLinks ?? []) {
      if (!providedCatalogueIds.has(link.targetId)) {
        diagnostics.push(diagnostic(DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY, {
          catalogueId: catalogue.id,
          targetId: link.targetId,
          name: link.name,
        }));
      }
    }
  }
}

/**
 * Wertet ein Roster gegen einen Datensatz aus und liefert den Bericht.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset
 *   Der Datensatz: die optionale Spielsystemdatei (`.gst`-XML) und die geordnete
 *   Liste der Armee-Kataloge (`.cat`-XML). Ein einzelner synthetischer Katalog wird
 *   als `{ catalogues: [xml] }` uebergeben.
 * @param {{ forces?: Array<{ defId: string, count: number, children?: object[] }>, costLimits?: Array<{ costTypeId: string, value: number }> }} roster
 *   Das vollstaendige, aus `.ros` geparste Roster: der Instanzbaum (`forces`)
 *   **und** die eingestellten Kostengrenzen je Kostenart (`costLimits`, die
 *   Zuordnung Kostenart → Grenzwert, analog `<costLimits>`). Fehlt `costLimits`,
 *   ist das Budget leer — verhaltensgleich zu einem Roster ohne Kostengrenzen.
 * @returns {{ violations: object[], capabilities: Map<string, object>, diagnostics: object[] }}
 *   Der Bericht: Verletzungen, Faehigkeitsdatensaetze je Slot und Diagnosen.
 */
export function evaluate(dataset, roster) {
  const { gameSystem, catalogues = [] } = dataset;

  // Die eingestellten Kostengrenzen des Rosters einmalig als unveraenderliches
  // Budget-Wert-Objekt (SSOT) buendeln und bis in die Query-Kontexte durchreichen.
  // Ausgewertet wird das Budget erst in den Folge-Slices; hier reicht die Fassade
  // es nur verlustfrei durch (leere Grenzen ⇒ unveraendertes Ergebnis).
  const budget = createRosterBudget(roster.costLimits);

  // Deterministische kataloguebergreifende Reihenfolge: Spielsystem zuerst, dann
  // die Kataloge in Aufruf-Reihenfolge (ADR-0032 Entscheidung 1 — die Reihenfolge
  // ist engine-, nicht aufrufer-bestimmt).
  const gameSystemDoc = gameSystem !== undefined ? parseCatalogue(gameSystem) : null;
  const catalogueDocs = catalogues.map(parseCatalogue);
  const documents = gameSystemDoc !== null ? [gameSystemDoc, ...catalogueDocs] : catalogueDocs;

  const coherenceDiagnostics = [];
  checkDatasetCoherence(gameSystemDoc, catalogueDocs, coherenceDiagnostics);

  const merged = mergeCatalogues(documents);
  const resolved = resolveCatalogue(merged);
  const { root, diagnostics: joinDiagnostics } = buildEvalTree(resolved, roster);

  // Fixpunktschleife (Slice 05): Weil Zaehlen von effektiven Werten abhaengt und
  // Modifikatoren von Zaehlungen, wird iterativ bis zur Konvergenz ausgewertet —
  // jede Runde von einer frischen Basiskopie, mit harter Rundenobergrenze und
  // Nichtkonvergenz-Diagnose (docs/evaluator-architecture.md §3.5/§4.2).
  const { effective, diagnostics: fixpointDiagnostics } = evaluateToFixpoint(root, resolved.categoryIds, budget);

  // Finaler, konsistenter Index aus dem konvergierten (bzw. letzten) Stand.
  const index = buildIndex(root, effective);
  const constraintDiagnostics = [];
  const results = evaluateConstraints(root, index, effective, resolved.categoryIds, constraintDiagnostics, budget);

  // Engine-allgemeine Regel „Armee zu teuer": je eingestellter Kostengrenze die am
  // ROSTER-Rahmen verplante Summe (aus dem schon gebauten Zaehlindex) gegen ihre
  // Grenze. Ueberschreitungen fliessen als roster-weite Budget-Verletzungen in
  // dieselbe eine `violations`-Liste des Berichts.
  const budgetViolations = evaluateRosterBudget(index, budget);

  const diagnostics = [
    ...merged.diagnostics,
    ...coherenceDiagnostics,
    ...resolved.diagnostics,
    ...joinDiagnostics,
    ...fixpointDiagnostics,
    ...constraintDiagnostics,
  ];
  return buildReport(root, effective, results, diagnostics, budgetViolations);
}
