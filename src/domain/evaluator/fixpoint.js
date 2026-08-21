/**
 * Fixpunktschleife (`docs/evaluator-architecture.md` §3.5/§4.2, Kernentscheidung
 * von ADR-0030 gegenueber ADR-0029, das den Fixpunkt bewusst wegliess).
 *
 * Modifikatoren haengen von Zaehlungen ab, Zaehlungen von effektiven
 * Kosten/Kategorien: potenzielle Zyklen zwischen Zaehlen und Modifizieren
 * (Annahme A2). Deshalb wird **iterativ bis zur Konvergenz** ausgewertet. Jede
 * Runde baut den Zaehlindex aus dem aktuellen Effektiv-Zustand und wendet die
 * Modifikatoren auf eine **frische Basiskopie** an (nie kumulativ ueber Runden,
 * §4.6). Aendern sich die zaehlrelevanten Teile — effektive Kosten und
 * Kategorien — nicht mehr, ist der Fixpunkt erreicht.
 *
 * ── Iteriert wird nur ueber reale Knoten ─────────────────────────────────────
 * Die Schleife laeuft ueber die **iterierten** Knoten ({@link realNodes}), nicht
 * ueber alle. Ein synthetischer Anker traegt keine Instanz, geht in keinen
 * Zaehlschluessel ein und kann den ausgewerteten Zustand deshalb nicht veraendern;
 * ihn mitzuiterieren berechnete in jeder Runde dasselbe Ergebnis neu. Seine
 * effektiven Werte bestimmt darum **ein** Durchlauf nach der Konvergenz
 * ({@link applyAnchorPostPass}).
 *
 * Das ist exakt und keine Naeherung: konvergiert die Schleife, sind die
 * zaehlrelevanten Werte der realen Knoten stabil, also ist der finale Index
 * inhaltsgleich mit dem, den die letzte Runde benutzt hat — die Anker sehen
 * denselben Bestand wie zuvor. Sie traegt die Invariante *ein synthetischer Anker
 * geht nie in den Zaehlindex ein*, die die Index-Schicht als Modultest festhaelt
 * (`countIndex.syntheticAnchors.test.js`).
 *
 * ── Zwei getrennte Befunde statt einer Meldung ───────────────────────────────
 * Eine **harte Rundenobergrenze** begrenzt die Schleife. Wird sie ohne Konvergenz
 * erreicht, gilt der Stand der **letzten** Runde und der Bericht erhaelt einen von
 * zwei Befunden — stilles Falschrechnen ist ausgeschlossen (A3):
 *
 * - {@link DiagnosticKind.OSCILLATION}: ein zaehlrelevanter Zustand kehrt wieder;
 *   der Katalog schwingt. Die Meldung traegt die **Zykluslaenge**.
 * - {@link DiagnosticKind.ROUND_BUDGET_EXHAUSTED}: die Obergrenze ist erreicht,
 *   ohne dass sich ein Zustand wiederholt haette — dieser Katalog *koennte* mit
 *   mehr Runden noch konvergieren.
 *
 * Eine erkannte Oszillation bricht die Schleife **nicht** vorzeitig ab: der
 * Bericht soll denselben Stand tragen wie ohne die Erkennung, naemlich den der
 * letzten Runde. Die Erkennung sagt, *warum* er wackelt, sie waehlt ihn nicht aus.
 *
 * Zusaetzlich liefert die Schleife die Knoten, deren zaehlrelevante Werte zwischen
 * den beiden verglichenen Staenden abwichen. Ihr Faehigkeitsdatensatz traegt
 * daraufhin „Wert nicht stabil" (`report.js`) — damit die Unsicherheit am
 * betroffenen Slot steht und nicht nur in einer globalen Liste am Rand.
 *
 * Die Schleife wirft nie und terminiert immer.
 */

import { buildIndex } from './countIndex.js';
import { applyModifiersOfNodes } from './modifiers.js';
import { realNodes, syntheticNodes } from './evalTree.js';
import {
  createBaseEffectiveState,
  countRelevantFingerprint,
  countRelevantDifferences,
} from './effectiveState.js';
import { DiagnosticKind, diagnostic } from './model.js';

/**
 * Harte Obergrenze der Fixpunktrunden (`docs/evaluator-architecture.md` §4.2,
 * `MAX_FIXPOINT_ROUNDS`). Nach so vielen Runden ohne stabile zaehlrelevante Werte
 * gilt der Katalog als nicht konvergierend.
 */
export const MAX_FIXPOINT_ROUNDS = 5;

/** Die Runde des Ausgangszustands, gegen den die erste Runde verglichen wird. */
const INITIAL_ROUND = 0;

/**
 * Iteriert die Modifikator-Anwendung ueber die **realen** Knoten bis zum Fixpunkt
 * oder bis zur harten Rundenobergrenze und liefert den konvergierten (bzw.
 * letzten) Effektiv-Zustand.
 *
 * Jede Runde startet von einer frischen Basiskopie, sodass `ADD`/`MULTIPLY` nicht
 * ueber Runden kumulieren. Nur die Modifikator-Diagnosen der **letzten** Runde
 * werden weitergereicht — jede Runde erzeugt aus demselben Ausgangszustand
 * dieselben Diagnosen, sodass die Sammlung nicht ueber Runden dupliziert.
 *
 * Die synthetischen Anker sind hier ausgenommen; ihre Werte setzt
 * {@link applyAnchorPostPass} anschliessend in einem Durchlauf.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel des Query-Primitivs).
 * @param {import('./rosterBudget.js').RosterBudget} [budget]  die eingestellten
 *   Roster-Kostengrenzen (`RosterBudget`), durch die Modifikator-Anwendung an den
 *   Query-Kontext durchgereicht.
 * @param {Map<string, string>} [primaryCatalogueByForceDefId]  der Herkunftsindex
 *   der Kontingente (Bezugsrahmen `primary-catalogue`), ebenso durchgereicht.
 * @returns {{ effective: import('./effectiveState.js').EffectiveState, diagnostics: object[], rounds: number, converged: boolean, unstableNodes: Set<object> }}
 *   der Effektiv-Zustand des Fixpunkts (oder der letzten Runde) samt Diagnosen, dem
 *   **Ausgang der Schleife** (Zahl der durchlaufenen Runden, ob sie konvergiert ist)
 *   und der Menge der Knoten, deren zaehlrelevante Werte nicht zur Ruhe kamen. Bei
 *   Konvergenz ist diese Menge leer.
 *
 *   Den Ausgang meldet die Schleife selbst, weil nur sie ihn kennt: er laesst sich
 *   aus dem Endzustand nicht rekonstruieren. Das Messverfahren
 *   (`scripts/measure-evaluator.js`) weist ihn aus, damit ein Laufzeit-Ausreisser
 *   einer Rundenzahl zuzuordnen ist statt unerklaert zu bleiben.
 */
export function evaluateToFixpoint(root, categoryIds, budget, primaryCatalogueByForceDefId) {
  const iteratedNodes = [...realNodes(root)];
  let effective = createBaseEffectiveState(root);
  let modifierDiagnostics = [];
  let unstableNodes = new Set();
  let converged = false;
  let cycleLength = null;
  let rounds = 0;

  // Die Runde, in der ein zaehlrelevanter Zustand **zuerst** gesehen wurde. Kehrt
  // sein Fingerabdruck wieder, ist der Abstand der beiden Vorkommen die
  // Zykluslaenge; deshalb wird ein bekannter Fingerabdruck nie ueberschrieben.
  const firstRoundOfFingerprint = new Map([
    [countRelevantFingerprint(effective, iteratedNodes), INITIAL_ROUND],
  ]);

  for (let round = INITIAL_ROUND + 1; round <= MAX_FIXPOINT_ROUNDS; round++) {
    rounds = round;
    const index = buildIndex(root, effective);
    modifierDiagnostics = [];
    const next = createBaseEffectiveState(root);
    applyModifiersOfNodes(iteratedNodes, next, {
      root,
      index,
      categoryIds,
      diagnostics: modifierDiagnostics,
      budget,
      primaryCatalogueByForceDefId,
    });

    unstableNodes = countRelevantDifferences(effective, next, iteratedNodes);
    const fingerprint = countRelevantFingerprint(next, iteratedNodes);
    effective = next; // stets fortschreiben: bei Nichtkonvergenz gilt die letzte Runde.

    if (unstableNodes.size === 0) {
      converged = true;
      break;
    }
    const firstRound = firstRoundOfFingerprint.get(fingerprint);
    if (firstRound === undefined) {
      firstRoundOfFingerprint.set(fingerprint, round);
    } else if (cycleLength === null) {
      cycleLength = round - firstRound;
    }
  }

  const diagnostics = [...modifierDiagnostics];
  if (!converged) {
    diagnostics.push(
      cycleLength === null
        ? diagnostic(DiagnosticKind.ROUND_BUDGET_EXHAUSTED, { rounds })
        : diagnostic(DiagnosticKind.OSCILLATION, { rounds, cycleLength }),
    );
  }
  return { effective, diagnostics, rounds, converged, unstableNodes };
}

/**
 * Der einmalige **Nach-Durchlauf**: setzt die effektiven Werte aller synthetischen
 * Anker aus dem konvergierten Stand — der aus Baumphase 1 (Pflicht-Phantome,
 * Kategorie- und Gruppen-Anker) ebenso wie der **Angebots-Anker** aus Baumphase 2,
 * die der Aufrufer zuvor angehaengt hat (`offer.js`, ADR-0035).
 *
 * Er ist nicht optional — die Grenzen-Schicht liest den Grenzwert eines Ankers aus
 * der Effektiv-Werte-Ebene, die Berichtsschicht seine Sichtbarkeit und seine
 * bedingten Hinweise. Ohne diesen Durchlauf truege ein Anker ein
 * modifikator-blindes Hoechstmass, waere nie versteckt und haette keine Hinweise.
 *
 * Rueckwirkungsfrei ist er aus drei Gruenden, die gemeinsam strukturell wirken
 * statt nur zugesichert zu sein (`design.md`):
 *
 * 1. der Zaehlindex ist zu diesem Zeitpunkt fertig; der Durchlauf liest ihn und
 *    schreibt nie hinein, und er wird danach nicht erneut gebaut;
 * 2. geschrieben wird ausschliesslich unter den Anker-Knoten — der Zustand
 *    schluesselt nach Knoten-Objekt, ein Anker kann keinen Wert eines realen
 *    Knotens ueberschreiben;
 * 3. der Baum wird dabei nicht veraendert; Reihenfolge und Elternschaft der
 *    vorhandenen Knoten und damit alle Slot-Pfade bleiben stabil.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: Function }} index  der finale Zaehlindex aus dem konvergierten Stand.
 * @param {import('./effectiveState.js').EffectiveState} effective  der konvergierte
 *   Zustand; er wird um die Werte der Anker **ergaenzt**, vorhandene Werte bleiben unberuehrt.
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel des Query-Primitivs).
 * @param {import('./rosterBudget.js').RosterBudget} [budget]  die eingestellten Roster-Kostengrenzen.
 * @param {Map<string, string>} [primaryCatalogueByForceDefId]  der Herkunftsindex
 *   der Kontingente (Bezugsrahmen `primary-catalogue`).
 * @returns {object[]} die Modifikator-Diagnosen der Anker (nie still verschluckt).
 */
export function applyAnchorPostPass(root, index, effective, categoryIds, budget, primaryCatalogueByForceDefId) {
  const diagnostics = [];
  applyModifiersOfNodes(syntheticNodes(root), effective, {
    root,
    index,
    categoryIds,
    diagnostics,
    budget,
    primaryCatalogueByForceDefId,
  });
  return diagnostics;
}
