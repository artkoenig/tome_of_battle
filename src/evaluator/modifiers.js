/**
 * Modifikator-Schicht (`docs/evaluator-architecture.md` §3.4/§4.6).
 *
 * Pro Knoten werden seine **Bedingungen** (bool) und **Wiederholungen** (Anzahl)
 * ueber das Query-Primitiv (Slice 03) ausgewertet und dann die Modifikatoren
 * **strikt in Dokumentreihenfolge** auf eine frische Kopie der Basiswerte
 * angewendet. Ein Modifikator feuert nur, wenn **alle** seine Bedingungen halten;
 * seine Wirkung wird mit dem Produkt der Wiederholungszahlen multipliziert. Eine
 * Wiederholungszahl 0 laesst den Modifikator inaktiv.
 *
 * **Umfang dieser Scheibe: genau ein Durchlauf.** Die Fixpunktschleife (Slice 05)
 * ist bewusst nicht Teil dieser Datei. `applyAllModifiers` erzeugt bei jedem Aufruf
 * eine frische Basiskopie und ist deshalb ohne Umbau in eine Konvergenzschleife
 * einzuwickeln (`docs/evaluator-architecture.md` §4.6, Schlussbemerkung).
 */

import {
  CompareOp,
  ModifierOperation,
  ModifierTargetKind,
  DiagnosticKind,
  diagnostic,
} from './model.js';
import { allNodes } from './evalTree.js';
import { query, createQueryContext } from './query.js';
import { createBaseEffectiveState } from './effectiveState.js';

/** Ein Modifikator ohne Wiederholungen wirkt genau einmal. */
const SINGLE_APPLICATION = 1;

/**
 * Vergleicht den gezaehlten Ist-Wert mit dem Sollwert einer Bedingung. Ein
 * unbekannter Operator erzeugt eine Diagnose und gilt als **nicht erfuellt** —
 * nie still verschluckt (`docs/evaluator-architecture.md` §5, Risiko 4).
 */
function compare(op, actual, expected, diagnostics) {
  switch (op) {
    case CompareOp.LESS:
      return actual < expected;
    case CompareOp.GREATER:
      return actual > expected;
    case CompareOp.EQUAL:
      return actual === expected;
    case CompareOp.AT_LEAST:
      return actual >= expected;
    case CompareOp.AT_MOST:
      return actual <= expected;
    default:
      diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_COMPARATOR, { op }));
      return false;
  }
}

/** Wertet eine einzelne Bedingung ueber das Query-Primitiv aus. */
function conditionHolds(ctx, condition) {
  const actual = query(ctx, condition.field, condition.scope, condition.targetChildId, condition.flags);
  return compare(condition.op, actual, condition.value, ctx.diagnostics);
}

/**
 * Die Wiederholungszahl einer Wiederholung: `floor(Ist-Wert / perValue)`
 * (Konvention: abrunden; 0 = Modifikator inaktiv). Ein `perValue` von 0 gaebe
 * eine Division durch null und gilt als inaktiv (0).
 */
function repeatCount(ctx, repeat) {
  if (repeat.perValue === 0) return 0;
  const actual = query(ctx, repeat.field, repeat.scope, repeat.targetChildId, repeat.flags);
  return Math.floor(actual / repeat.perValue);
}

/**
 * Der Wiederholungsfaktor eines Modifikators: 1 ohne Wiederholungen, sonst das
 * **Produkt** der einzelnen Wiederholungszahlen (eine 0 macht das Produkt 0 und
 * damit den Modifikator inaktiv).
 */
function modifierTimes(ctx, modifier) {
  if (modifier.repeats.length === 0) return SINGLE_APPLICATION;
  let product = SINGLE_APPLICATION;
  for (const repeat of modifier.repeats) {
    product *= repeatCount(ctx, repeat);
  }
  return product;
}

/** True, wenn **alle** Bedingungen eines Modifikators halten (leer ⇒ true). */
function allConditionsHold(ctx, modifier) {
  return modifier.conditions.every(condition => conditionHolds(ctx, condition));
}

/**
 * Berechnet den neuen numerischen Wert (Kosten/Grenzwert) einer Operation.
 * `SET` ignoriert den Wiederholungsfaktor; `ADD` addiert `value·times`,
 * `MULTIPLY` multipliziert mit `value^times`.
 */
function computeNumeric(current, operation, value, times) {
  switch (operation) {
    case ModifierOperation.SET:
      return value;
    case ModifierOperation.ADD:
      return current + value * times;
    case ModifierOperation.MULTIPLY:
      return current * value ** times;
    default:
      return current;
  }
}

/**
 * Wendet einen feuernden Modifikator mit gegebenem Wiederholungsfaktor auf die
 * effektive Kopie an. Ein Faktor 0 laesst alles unveraendert (inaktiv).
 */
function applyOperation(state, node, modifier, times, diagnostics) {
  if (times === 0) return;
  const { target, operation, value } = modifier;
  switch (target.kind) {
    case ModifierTargetKind.COST:
      state.writeCost(node, target.id, computeNumeric(state.currentCost(node, target.id), operation, value, times));
      return;
    case ModifierTargetKind.LIMIT:
      state.writeLimitValue(node, target.id, computeNumeric(state.currentLimitValue(node, target.id), operation, value, times));
      return;
    case ModifierTargetKind.CATEGORY:
      if (value) state.addCategory(node, target.id);
      else state.removeCategory(node, target.id);
      return;
    case ModifierTargetKind.HIDDEN:
      state.setHidden(node, Boolean(value));
      return;
    case ModifierTargetKind.NOTE:
      state.appendNote(node, value);
      return;
    default:
      diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, { target }));
  }
}

/**
 * Wendet **einen** Durchlauf aller Modifikatoren des Baums an und liefert die
 * effektiven Werte. Die Kopie startet immer frisch von den Basiswerten, sodass
 * ein erneuter Aufruf von den Basiswerten aus dieselben effektiven Werte liefert
 * (keine kumulative Drift innerhalb einer Auswertung).
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: Function }} index  der Zaehlindex, gegen den Bedingungen und Wiederholungen fragen.
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel des Query-Primitivs).
 * @param {object[]} diagnostics  Sammelliste fuer Auswertungsprobleme.
 * @returns {import('./effectiveState.js').EffectiveState}
 */
export function applyAllModifiers(root, index, categoryIds, diagnostics) {
  const state = createBaseEffectiveState(root);
  for (const node of allNodes(root)) {
    const ctx = createQueryContext({ node, root, index, categoryIds, diagnostics });
    for (const modifier of node.def.modifiers ?? []) {
      if (!allConditionsHold(ctx, modifier)) continue;
      applyOperation(state, node, modifier, modifierTimes(ctx, modifier), diagnostics);
    }
  }
  return state;
}
