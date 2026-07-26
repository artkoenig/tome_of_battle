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
 * Kategorien ({@link countRelevantEqual}) — nicht mehr, ist der Fixpunkt
 * erreicht.
 *
 * Eine **harte Rundenobergrenze** begrenzt die Schleife. Wird sie ohne
 * Konvergenz erreicht (pathologische, oszillierende Kataloge, §5 Risiko 3), gilt
 * der Stand der **letzten** Runde und der Bericht erhaelt eine
 * Nichtkonvergenz-Diagnose — stilles Falschrechnen ist ausgeschlossen (A3). Die
 * Schleife wirft nie und terminiert immer.
 */

import { buildIndex } from './countIndex.js';
import { applyAllModifiers } from './modifiers.js';
import { createBaseEffectiveState, countRelevantEqual } from './effectiveState.js';
import { DiagnosticKind, diagnostic } from './model.js';

/**
 * Harte Obergrenze der Fixpunktrunden (`docs/evaluator-architecture.md` §4.2,
 * `MAX_FIXPOINT_ROUNDS`). Nach so vielen Runden ohne stabile zaehlrelevante Werte
 * gilt der Katalog als nicht konvergierend.
 */
export const MAX_FIXPOINT_ROUNDS = 5;

/**
 * Iteriert die Modifikator-Anwendung bis zum Fixpunkt oder bis zur harten
 * Rundenobergrenze und liefert den konvergierten (bzw. letzten) Effektiv-Zustand.
 *
 * Jede Runde startet von einer frischen Basiskopie (in `applyAllModifiers`), sodass
 * `ADD`/`MULTIPLY` nicht ueber Runden kumulieren. Nur die Modifikator-Diagnosen der
 * **letzten** Runde werden weitergereicht — jede Runde erzeugt aus demselben
 * Ausgangszustand dieselben Diagnosen, sodass die Sammlung nicht ueber Runden
 * dupliziert.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel des Query-Primitivs).
 * @param {import('./rosterBudget.js').RosterBudget} [budget]  die eingestellten
 *   Roster-Kostengrenzen (`RosterBudget`), durch die Modifikator-Anwendung an den
 *   Query-Kontext durchgereicht.
 * @returns {{ effective: import('./effectiveState.js').EffectiveState, diagnostics: object[], rounds: number, converged: boolean }}
 *   der Effektiv-Zustand des Fixpunkts (oder der letzten Runde) samt Diagnosen sowie
 *   dem **Ausgang der Schleife**: die Zahl der tatsaechlich durchlaufenen Runden und
 *   ob sie konvergiert ist. Bei ausbleibender Konvergenz enthaelt `diagnostics`
 *   zusaetzlich eine `NO_CONVERGENCE`-Diagnose.
 *
 *   Den Ausgang meldet die Schleife selbst, weil nur sie ihn kennt: er laesst sich
 *   aus dem Endzustand nicht rekonstruieren. Das Messverfahren
 *   (`scripts/measure-evaluator.js`) weist ihn aus, damit ein Laufzeit-Ausreisser
 *   einer Rundenzahl zuzuordnen ist statt unerklaert zu bleiben.
 */
export function evaluateToFixpoint(root, categoryIds, budget) {
  let effective = createBaseEffectiveState(root);
  let modifierDiagnostics = [];
  let converged = false;
  let rounds = 0;

  for (let round = 0; round < MAX_FIXPOINT_ROUNDS; round++) {
    rounds = round + 1;
    const index = buildIndex(root, effective);
    modifierDiagnostics = [];
    const next = applyAllModifiers(root, index, categoryIds, modifierDiagnostics, budget);
    const reachedFixpoint = countRelevantEqual(effective, next);
    effective = next; // stets fortschreiben: bei Nichtkonvergenz gilt die letzte Runde.
    if (reachedFixpoint) {
      converged = true;
      break;
    }
  }

  const diagnostics = [...modifierDiagnostics];
  if (!converged) {
    diagnostics.push(diagnostic(DiagnosticKind.NO_CONVERGENCE, { rounds }));
  }
  return { effective, diagnostics, rounds, converged };
}
