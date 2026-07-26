/**
 * Modifikator-Schicht (`docs/evaluator-architecture.md` §3.4/§4.6).
 *
 * Pro Knoten werden seine **Bedingungen** (bool) und **Wiederholungen** (Anzahl)
 * ueber das Query-Primitiv (Slice 03) ausgewertet und dann die Modifikatoren
 * **strikt in Dokumentreihenfolge** auf eine frische Kopie der Basiswerte
 * angewendet. Ein Modifikator feuert nur, wenn **alle** seine Bedingungen **und
 * alle seine Bedingungsgruppen** halten; seine Wirkung wird mit dem Produkt der
 * Wiederholungszahlen multipliziert. Eine Wiederholungszahl 0 laesst den
 * Modifikator inaktiv.
 *
 * **Gruppen (Slice 02).** Eine **Bedingungsgruppe** (`and`/`or`) verknuepft
 * Bedingungen und weitere Untergruppen rekursiv zu einem Wahrheitswert. Eine
 * **Modifikatorgruppe** buendelt Modifikatoren unter einer gemeinsamen
 * Gruppen-Bedingung: haelt sie, greifen alle enthaltenen Modifikatoren gemeinsam
 * (jeder weiterhin unter seinen eigenen Bedingungen), sonst gemeinsam keiner.
 *
 * Bedingung und Modifikator tragen ihre Art an den **kanonischen** BattleScribe-
 * SSOT-Enums: `condition.type` ({@link ConditionKind}) und `modifier.kind`
 * ({@link ModifierKind}). Beide Auswertungen liegen als **Handler-Registry** vor —
 * die eine bildet `ConditionKind`→Wahrheitswert ({@link COMPARATORS}), die andere
 * `ModifierKind`→Effekt ({@link MODIFIER_HANDLERS}). Ein Zwei-Wege-Vollstaendigkeits-
 * test (`enumHandlerCoverage.test.js`) haelt beide Registries mit der SSOT ehrlich.
 * Das aufgeloeste Ziel jedes Modifikators kommt als `TargetDescriptor` aus dem
 * Resolver (`modifier.target`).
 *
 * **Umfang dieser Scheibe: genau ein Durchlauf.** Die Fixpunktschleife (Slice 05)
 * ist bewusst nicht Teil dieser Datei. `applyAllModifiers` erzeugt bei jedem Aufruf
 * eine frische Basiskopie und ist deshalb ohne Umbau in eine Konvergenzschleife
 * einzuwickeln (`docs/evaluator-architecture.md` §4.6, Schlussbemerkung).
 */

import {
  ConditionKind,
  ConditionGroupKind,
  ModifierKind,
  ModifierTargetKind,
  DiagnosticKind,
  UNRESOLVED_BUDGET,
  diagnostic,
} from './model.js';
import { allNodes } from './evalTree.js';
import { query, createQueryContext } from './query.js';
import { createBaseEffectiveState } from './effectiveState.js';

/** Ein Modifikator ohne Wiederholungen wirkt genau einmal. */
const SINGLE_APPLICATION = 1;

/** Der `value`-Text, den ein boolesches Ziel (`hidden`) als "wahr" liest. */
const BOOLEAN_TRUE = 'true';

/**
 * Registry `ConditionKind → Vergleichspraedikat` (`docs/evaluator-architecture.md`
 * §4.1). Jeder SSOT-Wert hat genau einen Eintrag; `instanceOf`/`notInstanceOf`
 * sind Mitgliedschafts-Praedikate ueber der gezaehlten Zielanzahl (`actual`), der
 * `value` ist dort **nicht** schwellwertig (belegte Form: `notInstanceOf value="1"`).
 */
export const COMPARATORS = Object.freeze({
  [ConditionKind.LESS_THAN]: (actual, expected) => actual < expected,
  [ConditionKind.GREATER_THAN]: (actual, expected) => actual > expected,
  [ConditionKind.EQUAL_TO]: (actual, expected) => actual === expected,
  [ConditionKind.NOT_EQUAL_TO]: (actual, expected) => actual !== expected,
  [ConditionKind.AT_LEAST]: (actual, expected) => actual >= expected,
  [ConditionKind.AT_MOST]: (actual, expected) => actual <= expected,
  [ConditionKind.INSTANCE_OF]: actual => actual > 0,
  [ConditionKind.NOT_INSTANCE_OF]: actual => actual === 0,
});

/**
 * Vergleicht den gezaehlten Ist-Wert mit dem Sollwert einer Bedingung. Ein
 * unbekannter `type` erzeugt eine Diagnose und gilt als **nicht erfuellt** — nie
 * still verschluckt (`docs/evaluator-architecture.md` §5, Risiko 4).
 */
function compare(type, actual, expected, diagnostics) {
  const comparator = COMPARATORS[type];
  if (comparator === undefined) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_COMPARATOR, { type }));
    return false;
  }
  return comparator(actual, expected);
}

/**
 * Wertet eine einzelne Bedingung ueber das Query-Primitiv aus. Ein unaufloesbares
 * Budget-Feld ({@link UNRESOLVED_BUDGET}, Diagnose bereits von `query` gemeldet)
 * laesst die Bedingung **nicht** halten — der Modifikator feuert dann fail-closed
 * nicht, statt mit einem erfundenen Wert zu vergleichen (`design.md`).
 */
function conditionHolds(ctx, condition) {
  const actual = query(ctx, condition.field, condition.scope, condition.targetChildId, condition.flags);
  if (actual === UNRESOLVED_BUDGET) return false;
  return compare(condition.type, actual, condition.value, ctx.diagnostics);
}

/**
 * Die Wiederholungszahl einer Wiederholung: `floor(Ist-Wert / perValue)`
 * (Konvention: abrunden; 0 = Modifikator inaktiv). Ein `perValue` von 0 gaebe
 * eine Division durch null und gilt als inaktiv (0).
 */
function repeatCount(ctx, repeat) {
  if (repeat.perValue === 0) return 0;
  const actual = query(ctx, repeat.field, repeat.scope, repeat.targetChildId, repeat.flags);
  // Unaufloesbares Budget-Feld: keine Wiederholung (fail-closed, Diagnose aus `query`).
  if (actual === UNRESOLVED_BUDGET) return 0;
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

/**
 * Wertet eine Bedingungsgruppe **rekursiv** zu einem Wahrheitswert aus: eine
 * `and`-Gruppe haelt genau dann, wenn **alle** ihre Bedingungen und Untergruppen
 * halten; eine `or`-Gruppe genau dann, wenn **mindestens eine** haelt. Die
 * Untergruppen werden ueber dieselbe Funktion aufgeloest — beliebige
 * Verschachtelungstiefe (`design.md`, Kontrakt `ConditionGroupDef`).
 */
function conditionGroupHolds(ctx, group) {
  const memberHolds = [
    ...group.conditions.map(condition => () => conditionHolds(ctx, condition)),
    ...group.groups.map(subGroup => () => conditionGroupHolds(ctx, subGroup)),
  ];
  return group.type === ConditionGroupKind.AND
    ? memberHolds.every(holds => holds())
    : memberHolds.some(holds => holds());
}

/**
 * True, wenn **alle** direkten Bedingungen **und alle** Bedingungsgruppen halten
 * (beide leer ⇒ true). Das ist die gemeinsame Feuer-Bedingung eines Modifikators
 * wie einer Modifikatorgruppe (`design.md`, `ModifierDef`/`ModifierGroupDef`).
 */
function conditionsAndGroupsHold(ctx, conditions, conditionGroups) {
  return conditions.every(condition => conditionHolds(ctx, condition))
    && conditionGroups.every(group => conditionGroupHolds(ctx, group));
}

/** Meldet eine ungueltige Kind/Ziel-Paarung als Diagnose (nie still verschluckt). */
function reportInvalidPairing(kind, target, diagnostics) {
  diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, { modifierKind: kind, targetKind: target.kind }));
}

/**
 * Baut einen numerischen Handler: er parst den rohen `value`, wendet `combine`
 * auf den aktuellen effektiven Wert an und schreibt das Ergebnis in Kosten oder
 * Grenzwert. Ein nicht-numerischer `value` oder ein nicht-numerisches Ziel
 * (Kategorie/Sichtbarkeit/Hinweis) ist eine ungueltige Paarung — Diagnose.
 */
function numericHandler(combine) {
  return (state, node, target, rawValue, times, diagnostics) => {
    const value = Number.parseFloat(rawValue);
    if (Number.isNaN(value)) {
      diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, { targetId: target.id, value: rawValue }));
      return;
    }
    if (target.kind === ModifierTargetKind.COST) {
      state.writeCost(node, target.id, combine(state.currentCost(node, target.id), value, times));
    } else if (target.kind === ModifierTargetKind.LIMIT) {
      state.writeLimitValue(node, target.id, combine(state.currentLimitValue(node, target.id), value, times));
    } else {
      reportInvalidPairing('numeric', target, diagnostics);
    }
  };
}

const setNumeric = numericHandler((current, value) => value);
const addValue = numericHandler((current, value, times) => current + value * times);
const subtractValue = numericHandler((current, value, times) => current - value * times);
const multiplyValue = numericHandler((current, value, times) => current * value ** times);

/** `set` schaltet die Sichtbarkeit (`field="hidden"`) oder setzt einen numerischen Wert. */
function setHandler(state, node, target, rawValue, times, diagnostics) {
  if (target.kind === ModifierTargetKind.HIDDEN) {
    state.setHidden(node, rawValue === BOOLEAN_TRUE);
    return;
  }
  setNumeric(state, node, target, rawValue, times, diagnostics);
}

/** Baut einen Kategorie-Handler: die Kategorie-ID steht im rohen `value`. */
function categoryHandler(mutate) {
  return (state, node, target, rawValue, times, diagnostics) => {
    if (target.kind !== ModifierTargetKind.CATEGORY) {
      reportInvalidPairing('category', target, diagnostics);
      return;
    }
    mutate(state, node, rawValue);
  };
}

const addCategory = categoryHandler((state, node, categoryId) => state.addCategory(node, categoryId));
const removeCategory = categoryHandler((state, node, categoryId) => state.removeCategory(node, categoryId));
// Eine Primaerkategorie ist zaehlrelevant eine **Mitgliedschaft**; die Primaer-/
// Sekundaer-Unterscheidung ist reine Anzeige und beeinflusst weder Zaehlung noch
// Grenzen, die diese Engine auswertet. `set-primary` sichert daher die
// Mitgliedschaft, `unset-primary` laesst die Mitgliedschaft (und damit alles
// Zaehlrelevante) unberuehrt.
const setPrimaryCategory = categoryHandler((state, node, categoryId) => state.addCategory(node, categoryId));
const unsetPrimaryCategory = categoryHandler(() => {});

/** Haengt einen Hinweistext an. Ordnung (append vs prepend) ist reine Anzeige. */
function noteHandler(state, node, target, rawValue, times, diagnostics) {
  if (target.kind !== ModifierTargetKind.NOTE) {
    reportInvalidPairing('note', target, diagnostics);
    return;
  }
  state.appendNote(node, rawValue);
}

/**
 * Registry `ModifierKind → Effekt` (`docs/evaluator-architecture.md` §4.1/§4.6).
 * Jeder SSOT-Wert hat genau einen Handler; ein Handler bildet die Modifikator-Art
 * auf ihre Wirkung am {@link ModifierTargetKind aufgeloesten Ziel} ab. Der
 * Zwei-Wege-Vollstaendigkeitstest sichert die Deckungsgleichheit mit der SSOT.
 */
export const MODIFIER_HANDLERS = Object.freeze({
  [ModifierKind.SET]: setHandler,
  [ModifierKind.INCREMENT]: addValue,
  [ModifierKind.DECREMENT]: subtractValue,
  [ModifierKind.MULTIPLY]: multiplyValue,
  [ModifierKind.ADD]: addCategory,
  [ModifierKind.REMOVE]: removeCategory,
  [ModifierKind.SET_PRIMARY]: setPrimaryCategory,
  [ModifierKind.UNSET_PRIMARY]: unsetPrimaryCategory,
  [ModifierKind.APPEND]: noteHandler,
  [ModifierKind.PREPEND]: noteHandler,
});

/**
 * Wendet einen feuernden Modifikator mit gegebenem Wiederholungsfaktor auf die
 * effektive Kopie an. Ein Faktor 0 laesst alles unveraendert (inaktiv); ein
 * baumelndes Ziel (`target === null`, im Resolver bereits als Diagnose gemeldet)
 * wird stumm uebersprungen.
 */
function applyOperation(state, node, modifier, times, diagnostics) {
  if (times === 0 || modifier.target === null) return;
  const handler = MODIFIER_HANDLERS[modifier.kind];
  if (handler === undefined) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, { kind: modifier.kind }));
    return;
  }
  handler(state, node, modifier.target, modifier.value, times, diagnostics);
}

/**
 * Wendet **einen** Modifikator an, wenn alle seine Bedingungen und
 * Bedingungsgruppen halten. Die Wirkung wird mit seinem Wiederholungsfaktor
 * multipliziert.
 */
function applyModifier(ctx, state, node, modifier, diagnostics) {
  if (!conditionsAndGroupsHold(ctx, modifier.conditions, modifier.conditionGroups ?? [])) return;
  applyOperation(state, node, modifier, modifierTimes(ctx, modifier), diagnostics);
}

/**
 * Wendet eine **Modifikatorgruppe** **rekursiv** an: haelt ihre gemeinsame
 * Gruppen-Bedingung, greifen alle enthaltenen Modifikatoren gemeinsam — jeder
 * weiterhin unter seinen *eigenen* Bedingungen — und ihre verschachtelten
 * Untergruppen werden weiter ausgewertet; haelt sie nicht, entfaellt die Gruppe
 * samt Untergruppen gemeinsam. Weil die Untergruppen nur im gehaltenen Zweig
 * ausgewertet werden, ist das **effektive Gate einer inneren Gruppe** genau
 * `AND(Eltern-Gate, eigenes Gate)` — beliebige Tiefe, gespiegelt an der
 * rekursiven Bedingungsgruppen-Auswertung ({@link conditionGroupHolds},
 * `design.md`, Kontrakt `ModifierGroupDef`).
 */
function applyModifierGroup(ctx, state, node, group, diagnostics) {
  if (!conditionsAndGroupsHold(ctx, group.conditions, group.conditionGroups)) return;
  for (const modifier of group.modifiers) {
    applyModifier(ctx, state, node, modifier, diagnostics);
  }
  for (const nestedGroup of group.modifierGroups ?? []) {
    applyModifierGroup(ctx, state, node, nestedGroup, diagnostics);
  }
}

/**
 * Wendet **einen** Durchlauf aller Modifikatoren des Baums an und liefert die
 * effektiven Werte. Je Knoten greifen zuerst seine eigenstaendigen Modifikatoren
 * (in Dokumentreihenfolge), dann seine Modifikatorgruppen. Die Kopie startet immer
 * frisch von den Basiswerten, sodass ein erneuter Aufruf von den Basiswerten aus
 * dieselben effektiven Werte liefert (keine kumulative Drift innerhalb einer
 * Auswertung).
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: Function }} index  der Zaehlindex, gegen den Bedingungen und Wiederholungen fragen.
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel des Query-Primitivs).
 * @param {object[]} diagnostics  Sammelliste fuer Auswertungsprobleme.
 * @param {import('./rosterBudget.js').RosterBudget} [budget]  die eingestellten
 *   Roster-Kostengrenzen (`RosterBudget`), an den Query-Kontext durchgereicht.
 * @returns {import('./effectiveState.js').EffectiveState}
 */
export function applyAllModifiers(root, index, categoryIds, diagnostics, budget) {
  const state = createBaseEffectiveState(root);
  for (const node of allNodes(root)) {
    const ctx = createQueryContext({ node, root, index, categoryIds, diagnostics, budget });
    const targetModifiers = (node.def.kind === 'entryLink' && node.def.resolved?.modifiers) ? node.def.resolved.modifiers : [];
    const linkModifiers = node.def.modifiers ?? [];
    for (const modifier of [...targetModifiers, ...linkModifiers]) {
      applyModifier(ctx, state, node, modifier, diagnostics);
    }
    const targetGroups = (node.def.kind === 'entryLink' && node.def.resolved?.modifierGroups) ? node.def.resolved.modifierGroups : [];
    const linkGroups = node.def.modifierGroups ?? [];
    for (const group of [...targetGroups, ...linkGroups]) {
      applyModifierGroup(ctx, state, node, group, diagnostics);
    }
  }
  return state;
}
