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
 * Daneben beantwortet die Fassade die Fragen, die sich **ohne Roster** stellen —
 * `describeDataset(datensatz) → Beschreibung` (ADR-0034). Beide Wege teilen
 * denselben rosterunabhaengigen Katalog-Vorlauf
 * ({@link ./datasetPreparation.js prepareDataset}), sodass es keine zweite
 * Lesart derselben Katalogdaten gibt.
 *
 * Der Datensatz trennt die **einzelne** Spielsystemdatei (`.gst`) strukturell von
 * der **Liste** der Armee-Kataloge (`.cat`) — `{ gameSystem, catalogues }`
 * (ADR-0032). Die deterministische kataloguebergreifende Verarbeitungsreihenfolge
 * (Spielsystem zuerst, dann die Kataloge in Aufruf-Reihenfolge) leitet die Engine
 * selbst ab; sie ist **keine** positionsabhaengige Aufrufer-Konvention.
 */

import { prepareDataset } from './datasetPreparation.js';
import { buildDatasetDescription } from './datasetDescription.js';
import { buildEvalTree } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';
import { extendBaseEffectiveState } from './effectiveState.js';
import { buildIndex } from './countIndex.js';
import { evaluateToFixpoint, applyAnchorPostPass } from './fixpoint.js';
import { evaluateConstraints } from './constraints.js';
import { evaluateRosterBudget } from './budget.js';
import { buildReport } from './report.js';
import { createRosterBudget } from './rosterBudget.js';

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
 *   Der Bericht: Verletzungen, Faehigkeitsdatensaetze je Slot und Diagnosen. Ein
 *   Slot ist **jede Stelle, an der eine Auswahl stehen kann** — auch eine noch
 *   nicht gewaehlte (ADR-0035); die Verletzungsliste bleibt davon unberuehrt.
 */
export function evaluate(dataset, roster) {
  // Die eingestellten Kostengrenzen des Rosters einmalig als unveraenderliches
  // Budget-Wert-Objekt (SSOT) buendeln und bis in die Query-Kontexte durchreichen.
  // Ausgewertet wird das Budget erst in den Folge-Slices; hier reicht die Fassade
  // es nur verlustfrei durch (leere Grenzen ⇒ unveraendertes Ergebnis).
  const budget = createRosterBudget(roster.costLimits);

  // Rosterunabhaengiger Katalog-Vorlauf (lesen → zusammenfuehren → aufloesen) als
  // eigener, benannter Schritt — dieselbe Implementierung, die auch
  // {@link describeDataset} benutzt.
  const { resolved, diagnostics: datasetDiagnostics } = prepareDataset(dataset);

  const { root, diagnostics: joinDiagnostics } = buildEvalTree(resolved, roster);

  // Fixpunktschleife: Weil Zaehlen von effektiven Werten abhaengt und Modifikatoren
  // von Zaehlungen, wird iterativ bis zur Konvergenz ausgewertet — jede Runde von
  // einer frischen Basiskopie, mit harter Rundenobergrenze und getrennten Befunden
  // fuer Oszillation und erschoepftes Rundenbudget (§3.5/§4.2). Iteriert wird nur
  // ueber die **realen** Knoten: nur sie gehen in die Zaehlung ein.
  const { effective, diagnostics: fixpointDiagnostics, unstableNodes } =
    evaluateToFixpoint(root, resolved.categoryIds, budget);

  // Finaler, konsistenter Index aus dem konvergierten (bzw. letzten) Stand.
  const index = buildIndex(root, effective);

  // Baumphase 2: die **Angebots-Anker** fuer jede im Bezugsrahmen waehlbare
  // Definition (ADR-0035), angehaengt als Blaetter hinter allen bestehenden
  // Kindern — die Pfade vorhandener Slots bleiben damit unveraendert. Sie
  // entstehen erst hier, weil sie in keinen Zaehlschluessel eingehen und den
  // ausgewerteten Stand deshalb nicht veraendern koennen. Ihre Basiswerte werden
  // in den konvergierten Zustand nachgetragen, damit ihre Grenzen vom Katalogwert
  // aus fortgeschrieben werden und nicht von 0.
  const offerAnchors = attachOfferAnchors(root, resolved);
  extendBaseEffectiveState(effective, offerAnchors);

  // Nach-Durchlauf: die synthetischen Anker — die aus Phase 1 wie die eben
  // angehaengten — bekommen ihre effektiven Werte in **einem** Durchlauf gegen
  // diesen finalen Index. Sie zaehlen nie mit, koennen also nicht zurueckwirken —
  // der Index wird danach nicht erneut gebaut.
  const postPassDiagnostics = applyAnchorPostPass(root, index, effective, resolved.categoryIds, budget);

  const constraintDiagnostics = [];
  const results = evaluateConstraints(root, index, effective, resolved.categoryIds, constraintDiagnostics, budget);

  // Engine-allgemeine Regel „Armee zu teuer": je eingestellter Kostengrenze die am
  // ROSTER-Rahmen verplante Summe (aus dem schon gebauten Zaehlindex) gegen ihre
  // Grenze. Ueberschreitungen fliessen als roster-weite Budget-Verletzungen in
  // dieselbe eine `violations`-Liste des Berichts.
  const budgetViolations = evaluateRosterBudget(index, budget);

  const diagnostics = [
    ...datasetDiagnostics,
    ...joinDiagnostics,
    ...fixpointDiagnostics,
    ...postPassDiagnostics,
    ...constraintDiagnostics,
  ];

  // `profileTypes` liefert die Klartext-Namen von Profiltyp und Charakteristik-Typ
  // fuer die Info-Projektion je Slot — die Deklarationen des Datensatzes sind ihre
  // einzige Quelle (`infoProjection.js`).
  return buildReport(root, effective, results, diagnostics, {
    budgetViolations,
    unstableNodes,
    profileTypes: resolved.profileTypes,
  });
}

/**
 * Beschreibt einen Datensatz **ohne Roster**: welche Kostenarten er mit welchem
 * Klartext-Namen kennt, welche Kataloge spielbar und welche reine Bibliotheken
 * sind, und welche Kontingente sich anlegen lassen (ADR-0034).
 *
 * Diese Fragen stellen sich, *bevor* ein Roster existiert — es gibt fuer sie also
 * weder Slot noch Faehigkeitsdatensatz. Weil ihre Antwort in den Katalogdaten
 * steht, beantwortet sie die Engine. Sie zaehlt dabei nichts und wertet keine
 * Grenze aus; wer eine Aussage ueber einen konkreten Bestand braucht, wertet mit
 * {@link evaluate} aus.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset
 *   Derselbe Datensatz wie bei {@link evaluate}: die optionale Spielsystemdatei
 *   (`.gst`-XML) und die geordnete Liste der Armee-Kataloge (`.cat`-XML).
 * @returns {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] }}
 *   Die Beschreibung samt der Diagnosen des Katalog-Vorlaufs — ein Katalogfehler
 *   (fehlende Abhaengigkeit, nicht passendes Spielsystem, doppelte oder baumelnde
 *   Verweise) wird auch ohne Roster sichtbar und nie still verschluckt.
 */
export function describeDataset(dataset) {
  return buildDatasetDescription(prepareDataset(dataset));
}
