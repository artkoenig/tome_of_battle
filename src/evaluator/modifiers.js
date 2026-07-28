/**
 * Modifikator-Schicht (`docs/evaluator-architecture.md` §3.4/§4.6).
 *
 * Pro Knoten werden seine **Bedingungen** (bool) und **Wiederholungen** (Anzahl)
 * ueber das Query-Primitiv ausgewertet und dann die Modifikatoren **strikt in
 * Dokumentreihenfolge** auf eine frische Kopie der Basiswerte angewendet. Ein
 * Modifikator feuert nur, wenn **alle** seine Bedingungen **und alle** seine
 * Bedingungsgruppen halten; seine Wirkung wird mit dem Produkt der
 * Wiederholungszahlen multipliziert. Eine Wiederholungszahl 0 laesst den
 * Modifikator inaktiv.
 *
 * **Gruppen.** Eine **Bedingungsgruppe** (`and`/`or`) verknuepft Bedingungen und
 * weitere Untergruppen rekursiv zu einem Wahrheitswert. Eine **Modifikatorgruppe**
 * buendelt Modifikatoren unter einer gemeinsamen Gruppen-Bedingung: haelt sie,
 * greifen alle enthaltenen Modifikatoren gemeinsam (jeder weiterhin unter seinen
 * eigenen Bedingungen), sonst gemeinsam keiner.
 *
 * ── Traeger: Knoten *und* Info-Elemente ──────────────────────────────────────
 * Ein Modifikator wirkt auf seinen **Traeger** — die Definition, an der er haengt.
 * Das ist der Knoten selbst oder eines seiner Info-Elemente (Profil, Regel,
 * Info-Gruppe, Info-Verweis), denn die `EntryBase` der BattleScribe-XSD gibt allen
 * dieselben `modifiers`. Fachlich ist das der Normalfall und keine Ausnahme: in
 * den Katalogdaten haengt **jeder** Charakteristik-Modifikator an einem Profil oder
 * Info-Verweis, und ein `name`-Modifikator an einem Info-Verweis meint dessen
 * Anzeigenamen, nicht den der Einheit. Ausgewertet werden die Bedingungen dabei
 * immer im Query-Kontext des **tragenden Knotens** — nur er hat eine Position im
 * Auswertungsbaum.
 *
 * ── Zwei-Ebenen-Registry statt Fallunterscheidung ────────────────────────────
 * Bedingungs- und Modifikator-Auswertung liegen als Registry vor: die eine bildet
 * `ConditionKind`→Wahrheitswert ({@link COMPARATORS}), die andere
 * `ModifierKind`→(`ModifierTargetKind`→Effekt) ({@link MODIFIER_HANDLERS}). Damit
 * ist eine gueltige Paarung ein Tabelleneintrag und eine ungueltige schlicht sein
 * Fehlen — gemeldet als Diagnose, nie still verschluckt. Ein
 * Zwei-Wege-Vollstaendigkeitstest (`enumHandlerCoverage.test.js`) haelt beide
 * Registries mit der SSOT ehrlich.
 *
 * ── Grenzwerte entstehen als Kette ───────────────────────────────────────────
 * Ein Modifikator auf eine **Grenze** schreibt nicht nur den neuen Zahlwert,
 * sondern einen **Schritt seiner Herleitungskette**: Art, roher Wert,
 * Wiederholungsfaktor, Zwischenwert, ob er bedingt war und — wenn ja — der
 * **Zeuge**, also die benennbare Auswahl, deren Vorhandensein die Bedingung hat
 * halten lassen (ADR-0027). Der Zeuge wird **hier** festgehalten, waehrend der
 * Query-Kontext lebt; aus dem Endzustand liesse er sich nur durch eine zweite
 * Rechenstelle rekonstruieren (ADR-0034).
 *
 * **Ein Durchlauf, zwei Aufrufer.** Die Konvergenzschleife selbst liegt in
 * `fixpoint.js`, nicht hier. Diese Datei kennt nur den **knotenmengen-bezogenen
 * Einstieg** {@link applyModifiersOfNodes} — „wende die Modifikatoren dieser Knoten
 * gegen diesen Index auf diesen Zustand an" —, den die Fixpunktschleife je Runde mit
 * den iterierten Knoten und der Nach-Durchlauf einmal mit den synthetischen Ankern
 * ruft. {@link applyAllModifiers} ist die geschlossene Sicht darauf: ganzer Baum,
 * frische Basiskopie (`docs/evaluator-architecture.md` §4.6, Schlussbemerkung).
 */

import {
  ConditionKind,
  ConditionGroupKind,
  CountedFieldKind,
  ModifierKind,
  ModifierTargetKind,
  DiagnosticKind,
  UNRESOLVED_BUDGET,
  UNLIMITED,
  unlimitedFromSentinel,
  diagnostic,
} from './model.js';
import { allNodes, infoCarriersOf } from './evalTree.js';
import { query, createQueryContext } from './query.js';
import { createBaseEffectiveState } from './effectiveState.js';

/** Ein Modifikator ohne Wiederholungen wirkt genau einmal. */
const SINGLE_APPLICATION = 1;

/** Der `value`-Text, den ein boolesches Ziel (`hidden`) als "wahr" liest. */
const BOOLEAN_TRUE = 'true';

/** Ohne `join`-Attribut werden Texte ohne Trennzeichen aneinandergefuegt. */
const NO_JOIN = '';

/**
 * Das **Gate** eines Modifikators: ob er unter einer Bedingung stand und welche
 * Bedingungen und Bedingungsgruppen das waren. Es waechst beim Abstieg in eine
 * Modifikatorgruppe, weil deren Bedingung fuer alle enthaltenen Modifikatoren
 * mitgilt.
 */
const UNCONDITIONAL_GATE = Object.freeze({
  isConditional: false,
  conditions: Object.freeze([]),
  conditionGroups: Object.freeze([]),
});

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
 * Die Wiederholungszahl einer Wiederholung: wie oft die Schrittweite `perValue`
 * im Ist-Wert steckt, mal `repeats` (die Anwendungen je Schritt). Der Quotient
 * wird abgerundet, mit `roundUp` aufgerundet (Catalogue.xsd:541-548). Ein
 * `perValue` von 0 gaebe eine Division durch null und gilt als inaktiv (0).
 */
function repeatCount(ctx, repeat) {
  if (repeat.perValue === 0) return 0;
  const actual = query(ctx, repeat.field, repeat.scope, repeat.targetChildId, repeat.flags);
  // Unaufloesbares Budget-Feld: keine Wiederholung (fail-closed, Diagnose aus `query`).
  if (actual === UNRESOLVED_BUDGET) return 0;
  const quotient = actual / repeat.perValue;
  const steps = repeat.roundUp ? Math.ceil(quotient) : Math.floor(quotient);
  return steps * repeat.repeats;
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

// ── Zeuge einer erfuellten Bedingung (ADR-0027) ───────────────────────────────

/**
 * Der **Zeuge** einer Bedingung: die benennbare Auswahl, deren Vorhandensein sie
 * hat halten lassen — `null`, wenn es keine gibt.
 *
 * Zwei Voraussetzungen, beide bewusst eng (ADR-0027, „Ehrlichkeit vor
 * Vollstaendigkeit"): die Bedingung muss auf eine **benennbare Auswahl** zielen
 * (der Resolver haelt sie als `condition.witnessDefinition` fest; eine Kostenschwelle
 * oder ein Kategorie-Ziel hat keine), und diese Auswahl muss im Rahmen der Bedingung
 * **tatsaechlich gezaehlt** worden sein. Eine Bedingung, die gerade wegen der
 * *Abwesenheit* einer Auswahl haelt, erzeugt keinen Zeugen.
 *
 * Der Name ist der **Katalogname der Definition**, nicht der effektive Name einer
 * Instanz: die Bedingung benennt eine Definition, und bei mehreren gezaehlten
 * Instanzen gaebe es keinen eindeutigen effektiven Namen. Lieber die belegbare
 * Angabe als eine willkuerlich ausgewaehlte.
 */
function witnessOfCondition(ctx, condition) {
  const definition = condition.witnessDefinition ?? null;
  if (definition === null) return null;
  if (condition.field.kind !== CountedFieldKind.SELECTION_COUNT) return null;
  // Die Zaehlung wurde fuer die Feuer-Entscheidung bereits ausgewertet; hier wird
  // sie allein zum Nachweis der Anwesenheit erneut gelesen. Ihre Diagnosen sind
  // dabei schon gemeldet, deshalb laeuft sie gegen eine Wegwerf-Sammelliste —
  // sonst erschiene dieselbe Meldung doppelt.
  const counted = query({ ...ctx, diagnostics: [] }, condition.field, condition.scope, condition.targetChildId, condition.flags);
  if (counted === UNRESOLVED_BUDGET || counted <= 0) return null;
  return Object.freeze({ defId: definition.id, name: definition.name ?? definition.resolved?.name ?? null });
}

/**
 * Die **gehaltenen** Bedingungen einer Bedingungsgruppe, rekursiv ueber ihre
 * Untergruppen, in Dokumentreihenfolge. Eine Gruppe, die nicht haelt, hat zum
 * Feuern nichts beigetragen und entfaellt samt Inhalt; dasselbe gilt fuer jede
 * einzelne nicht gehaltene Bedingung — relevant nur in einer `or`-Gruppe, denn
 * in einer gehaltenen `and`-Gruppe halten ohnehin alle Mitglieder. So kann nie
 * eine Auswahl zum Zeugen werden, die zwar anwesend ist, deren Zweig aber gar
 * nicht gehalten hat (ADR-0027, „Ehrlichkeit vor Vollstaendigkeit").
 */
function* heldConditionsOf(ctx, group) {
  if (!conditionGroupHolds(ctx, group)) return;
  for (const condition of group.conditions) {
    if (conditionHolds(ctx, condition)) yield condition;
  }
  for (const subGroup of group.groups) {
    yield* heldConditionsOf(ctx, subGroup);
  }
}

/**
 * Der erste benennbare Zeuge unter den Bedingungen, die den Modifikator haben
 * feuern lassen: zuerst die direkten Bedingungen, danach die gehaltenen
 * Bedingungen aus den Bedingungsgruppen (beliebige Tiefe, Dokumentreihenfolge).
 * Die Gruppen-Neuauswertung laeuft gegen eine Wegwerf-Sammelliste — ihre
 * Diagnosen sind bei der Feuer-Entscheidung bereits gemeldet.
 */
function witnessOf(ctx, conditions, conditionGroups) {
  for (const condition of conditions) {
    const witness = witnessOfCondition(ctx, condition);
    if (witness !== null) return witness;
  }
  const silentCtx = { ...ctx, diagnostics: [] };
  for (const group of conditionGroups) {
    for (const condition of heldConditionsOf(silentCtx, group)) {
      const witness = witnessOfCondition(ctx, condition);
      if (witness !== null) return witness;
    }
  }
  return null;
}

// ── Zugriffspfade je Ziel: was ein Handler liest und schreibt ─────────────────

/** Kosten des Knotens (Kostenart per ID). */
const COST_ACCESS = Object.freeze({
  read: application => application.state.currentCost(application.node, application.target.id),
  write: (application, value) => application.state.writeCost(application.node, application.target.id, value),
});

/**
 * Grenzwert des Knotens (Grenze per ID). Der Schreibpfad legt zugleich den
 * **Kettenschritt** an — den Wert ohne seinen Schritt zu setzen ist gar nicht
 * moeglich, sodass Wert und Herleitung nicht auseinanderlaufen koennen.
 */
const LIMIT_ACCESS = Object.freeze({
  read: application => application.state.currentLimitValue(application.node, application.target.id),
  write: (application, value) => application.state.writeLimitValue(application.node, application.target.id, value, {
    kind: application.kind,
    rawValue: application.rawValue,
    times: application.times,
    isConditional: application.isConditional,
    witness: application.witness,
  }),
});

/** Merkmalswert am Traeger (Charakteristik-Typ per ID). */
const CHARACTERISTIC_ACCESS = Object.freeze({
  read: application => application.state.characteristicValue(application.node, application.carrier, application.target.id),
  write: (application, value) =>
    application.state.writeCharacteristic(application.node, application.carrier, application.target.id, value),
});

/** Anzeigename des Traegers. */
const NAME_ACCESS = Object.freeze({
  read: application => application.state.nameOf(application.node, application.carrier),
  write: (application, value) => application.state.writeName(application.node, application.carrier, value),
});

// ── Handler-Fabriken: eine Wirkung, beliebige Zugriffspfade ───────────────────

/** Meldet einen Wert, mit dem die Modifikator-Art nicht rechnen kann (nie still verschluckt). */
function reportNonNumeric(application, value) {
  application.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, {
    kind: application.kind,
    targetKind: application.target.kind,
    targetId: application.target.id,
    value,
  }));
}

/** Der rohe `value` als Zahl, oder `null` samt Diagnose. */
function numericOperandOf(application) {
  const operand = Number.parseFloat(application.rawValue);
  if (Number.isNaN(operand)) {
    reportNonNumeric(application, application.rawValue);
    return null;
  }
  return operand;
}

/**
 * Baut einen **numerischen** Handler: er parst den rohen `value`, verknuepft ihn
 * ueber `combine` mit dem aktuellen effektiven Wert und schreibt das Ergebnis
 * ueber den Zugriffspfad des Ziels zurueck. Weder ein nicht-numerischer `value`
 * noch ein nicht-numerischer Ist-Wert wird still uebergangen.
 */
function numericHandler(combine, access, toStored = value => value) {
  return application => {
    const operand = numericOperandOf(application);
    if (operand === null) return;
    const current = Number.parseFloat(access.read(application));
    if (Number.isNaN(current)) {
      reportNonNumeric(application, access.read(application));
      return;
    }
    access.write(application, toStored(combine(current, operand, application.times)));
  };
}

/** Baut einen Handler, der den rohen `value` als Text setzt (Namen, Merkmalswerte). */
function textSetHandler(access) {
  return application => access.write(application, application.rawValue);
}

/**
 * Baut einen Handler, der den rohen `value` mit dem vorhandenen Text verbindet —
 * getrennt durch das `join`-Attribut des Modifikators (vendored, ADR-0016). Gibt es
 * noch keinen Text, steht der neue allein: ein fuehrendes Trennzeichen waere ein
 * Darstellungsfehler, kein Katalogwille.
 */
function textJoinHandler(access, order) {
  return application => {
    const current = access.read(application);
    const separator = application.join ?? NO_JOIN;
    const hasText = current !== null && current !== undefined && current !== '';
    access.write(application, hasText ? order(current, separator, application.rawValue) : application.rawValue);
  };
}

/** Setzt die Sichtbarkeit des Traegers (`field="hidden"`). */
function hiddenHandler(application) {
  application.state.setHidden(application.node, application.carrier, application.rawValue === BOOLEAN_TRUE);
}

/** Haengt eine Autor-Meldung mit dem Schweregrad ihres Ziels an den Knoten an. */
function messageHandler(application) {
  application.state.appendAuthorMessage(application.node, application.target.id, application.rawValue);
}

/** Baut einen Kategorie-Handler: die Kategorie-ID steht im rohen `value`. */
function categoryHandler(mutate) {
  return application => mutate(application.state, application.node, application.rawValue);
}

const setValue = (current, operand) => operand;
// Der Wert eines `set` auf eine **Grenze** ist ein hingeschriebener Katalogwert:
// nur dort (und am Roh-`value` einer Grenze, Katalog-Leser) gilt der
// Sentinel „unbegrenzt" (Issue 079). Errechnete Werte der uebrigen Arten
// (increment/decrement/multiply) werden nie gedeutet — ein rechnerisch
// negatives Ergebnis bleibt eine gewoehnliche Zahl.
const setLimitValue = (current, operand) => unlimitedFromSentinel(operand);
const addValue = (current, operand, times) => current + operand * times;
const subtractValue = (current, operand, times) => current - operand * times;
const multiplyValue = (current, operand, times) => current * operand ** times;
// Arithmetik auf einer **unbegrenzten** Grenze laesst sie unbegrenzt (Issue
// 079, Decision). Das steht hier als expliziter Kurzschluss statt als Folge
// der IEEE-Arithmetik auf `UNLIMITED = Infinity`: die traegt zwar increment/
// decrement und die meisten multiply-Faktoren von selbst, kippt aber bei
// `Infinity * 0` in NaN (und bei negativem Faktor in -Infinity) — und ein
// solcher Wert darf nie Grenzwert werden (Review Runde 1, Befund 1).
const limitArithmetic = combine => (current, operand, times) =>
  current === UNLIMITED ? UNLIMITED : combine(current, operand, times);

const asText = value => String(value);

const appendOrder = (current, separator, value) => `${current}${separator}${value}`;
const prependOrder = (current, separator, value) => `${value}${separator}${current}`;

const addCategory = categoryHandler((state, node, categoryId) => state.addCategory(node, categoryId));
const removeCategory = categoryHandler((state, node, categoryId) => state.removeCategory(node, categoryId));
// Eine Primaerkategorie ist zaehlrelevant eine **Mitgliedschaft**; die Primaer-/
// Sekundaer-Unterscheidung ist reine Anzeige und beeinflusst weder Zaehlung noch
// Grenzen, die diese Engine auswertet. `set-primary` sichert daher die
// Mitgliedschaft, `unset-primary` laesst die Mitgliedschaft (und damit alles
// Zaehlrelevante) unberuehrt.
const setPrimaryCategory = categoryHandler((state, node, categoryId) => state.addCategory(node, categoryId));
const unsetPrimaryCategory = categoryHandler(() => {});

/**
 * Registry `ModifierKind → (ModifierTargetKind → Effekt)`
 * (`docs/evaluator-architecture.md` §4.1/§4.6). Jeder SSOT-Wert hat genau einen
 * Eintrag; die innere Tabelle sagt, auf welche Ziele diese Art wirkt und wie. Eine
 * fehlende Paarung ist damit kein vergessener `else`-Zweig, sondern eine Luecke,
 * die die Anwendung als Diagnose meldet.
 *
 * `set` ist auf einem Merkmal und einem Namen bewusst **kein** Zahl-, sondern ein
 * Textzuweiser: die Katalogdaten setzen damit Werte wie `5+` oder `24"`, die ein
 * Zahl-Parser verstuemmeln wuerde.
 */
export const MODIFIER_HANDLERS = Object.freeze({
  [ModifierKind.SET]: Object.freeze({
    [ModifierTargetKind.COST]: numericHandler(setValue, COST_ACCESS),
    [ModifierTargetKind.LIMIT]: numericHandler(setLimitValue, LIMIT_ACCESS),
    [ModifierTargetKind.HIDDEN]: hiddenHandler,
    [ModifierTargetKind.NAME]: textSetHandler(NAME_ACCESS),
    [ModifierTargetKind.CHARACTERISTIC]: textSetHandler(CHARACTERISTIC_ACCESS),
  }),
  [ModifierKind.INCREMENT]: Object.freeze({
    [ModifierTargetKind.COST]: numericHandler(addValue, COST_ACCESS),
    [ModifierTargetKind.LIMIT]: numericHandler(limitArithmetic(addValue), LIMIT_ACCESS),
    [ModifierTargetKind.CHARACTERISTIC]: numericHandler(addValue, CHARACTERISTIC_ACCESS, asText),
  }),
  [ModifierKind.DECREMENT]: Object.freeze({
    [ModifierTargetKind.COST]: numericHandler(subtractValue, COST_ACCESS),
    [ModifierTargetKind.LIMIT]: numericHandler(limitArithmetic(subtractValue), LIMIT_ACCESS),
    [ModifierTargetKind.CHARACTERISTIC]: numericHandler(subtractValue, CHARACTERISTIC_ACCESS, asText),
  }),
  [ModifierKind.MULTIPLY]: Object.freeze({
    [ModifierTargetKind.COST]: numericHandler(multiplyValue, COST_ACCESS),
    [ModifierTargetKind.LIMIT]: numericHandler(limitArithmetic(multiplyValue), LIMIT_ACCESS),
    [ModifierTargetKind.CHARACTERISTIC]: numericHandler(multiplyValue, CHARACTERISTIC_ACCESS, asText),
  }),
  [ModifierKind.ADD]: Object.freeze({
    [ModifierTargetKind.CATEGORY]: addCategory,
    [ModifierTargetKind.MESSAGE]: messageHandler,
  }),
  [ModifierKind.REMOVE]: Object.freeze({
    [ModifierTargetKind.CATEGORY]: removeCategory,
  }),
  [ModifierKind.SET_PRIMARY]: Object.freeze({
    [ModifierTargetKind.CATEGORY]: setPrimaryCategory,
  }),
  [ModifierKind.UNSET_PRIMARY]: Object.freeze({
    [ModifierTargetKind.CATEGORY]: unsetPrimaryCategory,
  }),
  [ModifierKind.APPEND]: Object.freeze({
    [ModifierTargetKind.NAME]: textJoinHandler(NAME_ACCESS, appendOrder),
    [ModifierTargetKind.CHARACTERISTIC]: textJoinHandler(CHARACTERISTIC_ACCESS, appendOrder),
  }),
  [ModifierKind.PREPEND]: Object.freeze({
    [ModifierTargetKind.NAME]: textJoinHandler(NAME_ACCESS, prependOrder),
    [ModifierTargetKind.CHARACTERISTIC]: textJoinHandler(CHARACTERISTIC_ACCESS, prependOrder),
  }),
});

/**
 * Wendet einen feuernden Modifikator mit gegebenem Wiederholungsfaktor auf die
 * effektive Kopie an. Ein baumelndes oder nicht deutbares Ziel (`target === null`,
 * im Resolver bereits als Diagnose gemeldet) wird stumm uebersprungen; eine
 * ungueltige Art/Ziel-Paarung wird hier gemeldet.
 */
function applyOperation(scope, modifier, times, isConditional, witness) {
  const diagnostics = scope.ctx.diagnostics;
  const handlersByTarget = MODIFIER_HANDLERS[modifier.kind];
  if (handlersByTarget === undefined) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, { kind: modifier.kind }));
    return;
  }
  const handler = handlersByTarget[modifier.target.kind];
  if (handler === undefined) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, {
      modifierKind: modifier.kind,
      targetKind: modifier.target.kind,
    }));
    return;
  }
  handler({
    state: scope.state,
    node: scope.node,
    carrier: scope.carrier,
    target: modifier.target,
    kind: modifier.kind,
    rawValue: modifier.value,
    join: modifier.join,
    times,
    isConditional,
    witness,
    diagnostics,
  });
}

/**
 * Wendet **einen** Modifikator an, wenn alle seine Bedingungen und
 * Bedingungsgruppen halten. Die Wirkung wird mit seinem Wiederholungsfaktor
 * multipliziert; ein Faktor 0 laesst alles unveraendert (inaktiv).
 *
 * Zielt der Modifikator auf eine **Grenze** und stand er unter einer Bedingung,
 * wird zusaetzlich sein Zeuge bestimmt — nur dann, denn nur der Grenzwert traegt
 * eine Herleitungskette (`design.md`: „Nur fuer Grenzwerte, nicht fuer Kosten,
 * Kategorien oder Namen").
 */
function applyModifier(scope, modifier, gate) {
  const conditionGroups = modifier.conditionGroups ?? [];
  if (!conditionsAndGroupsHold(scope.ctx, modifier.conditions, conditionGroups)) return;
  const times = modifierTimes(scope.ctx, modifier);
  if (times === 0 || modifier.target === null) return;

  const isConditional = gate.isConditional || modifier.conditions.length > 0 || conditionGroups.length > 0;
  const tracksWitness = isConditional && modifier.target.kind === ModifierTargetKind.LIMIT;
  const witness = tracksWitness
    ? witnessOf(
        scope.ctx,
        [...modifier.conditions, ...gate.conditions],
        [...conditionGroups, ...gate.conditionGroups],
      )
    : null;
  applyOperation(scope, modifier, times, isConditional, witness);
}

/** Das Gate einer Modifikatorgruppe: das des Aufrufers, erweitert um ihre eigenen Bedingungen und Bedingungsgruppen. */
function gateWithin(gate, group) {
  if (group.conditions.length === 0 && group.conditionGroups.length === 0) return gate;
  return {
    isConditional: true,
    conditions: [...gate.conditions, ...group.conditions],
    conditionGroups: [...gate.conditionGroups, ...group.conditionGroups],
  };
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
function applyModifierGroup(scope, group, gate) {
  if (!conditionsAndGroupsHold(scope.ctx, group.conditions, group.conditionGroups)) return;
  const innerGate = gateWithin(gate, group);
  for (const modifier of group.modifiers) {
    applyModifier(scope, modifier, innerGate);
  }
  for (const nestedGroup of group.modifierGroups ?? []) {
    applyModifierGroup(scope, nestedGroup, innerGate);
  }
}

/**
 * Die Modifikatoren (bzw. Modifikatorgruppen) eines Traegers in Wirkreihenfolge:
 * die vom Verweisziel **geerbten** zuerst, danach die **eigenen**, sodass eigene
 * Angaben die geerbten ueberschreiben. Dieselbe Erb-Regel wie bei den Grenzen
 * ({@link limitsOf}) — und sie gilt fuer jeden Verweis, den Info-Verweis
 * eingeschlossen: er ist das Vorkommen des verlinkten Profils an diesem Knoten.
 */
function inheritedThenOwn(subject, listName) {
  return [...(subject.resolved?.[listName] ?? []), ...(subject[listName] ?? [])];
}

/** Wendet alle Modifikatoren **eines** Traegers in Dokumentreihenfolge an. */
function applyCarrierModifiers(scope, subject) {
  for (const modifier of inheritedThenOwn(subject, 'modifiers')) {
    applyModifier(scope, modifier, UNCONDITIONAL_GATE);
  }
  for (const group of inheritedThenOwn(subject, 'modifierGroups')) {
    applyModifierGroup(scope, group, UNCONDITIONAL_GATE);
  }
}

/**
 * Der **Einstieg der Modifikator-Schicht**: wendet alle Modifikatoren einer
 * Knotenmenge gegen einen Zaehlindex auf einen gegebenen Zustand an. Je Knoten
 * greifen zuerst seine eigenen Modifikatoren (in Dokumentreihenfolge), dann die
 * seiner Info-Elemente — jeder mit seinem Traeger, aber alle im Query-Kontext des
 * Knotens.
 *
 * Knotenmenge und Zustand kommen von aussen, weil die Auswertung sie **zweimal
 * verschieden** braucht — und beide Male dieselbe Implementierung benutzen soll
 * (`design.md`, „Angebots-Anker ausserhalb der Fixpunktschleife"):
 *
 * - die Fixpunktschleife ruft ihn je Runde mit den **iterierten** (realen) Knoten
 *   und einer frischen Basiskopie;
 * - der Nach-Durchlauf ruft ihn einmal mit den **synthetischen Ankern** und dem
 *   bereits konvergierten Zustand.
 *
 * Geschrieben wird ausschliesslich unter den Knoten der uebergebenen Menge (der
 * Zustand schluesselt nach Knoten-Objekt), sodass der zweite Aufruf keinen Wert des
 * ersten beruehren kann.
 *
 * @param {Iterable<object>} nodes  die Knoten, deren Modifikatoren angewendet werden.
 * @param {import('./effectiveState.js').EffectiveState} state  der beschriebene Zustand.
 * @param {{ root: object, index: { get: Function }, categoryIds: Set<string>, diagnostics: object[], budget?: import('./rosterBudget.js').RosterBudget }} context
 *   Wurzel (Rahmen-Aufloesung), Zaehlindex, bekannte Kategorie-IDs (Ziel-Typ-Regel
 *   des Query-Primitivs), Sammelliste fuer Auswertungsprobleme und die eingestellten
 *   Roster-Kostengrenzen.
 */
export function applyModifiersOfNodes(nodes, state, { root, index, categoryIds, diagnostics, budget }) {
  for (const node of nodes) {
    const ctx = createQueryContext({ node, root, index, categoryIds, diagnostics, budget });
    applyCarrierModifiers({ ctx, state, node, carrier: node }, node.def);
    for (const carrier of infoCarriersOf(node.def)) {
      applyCarrierModifiers({ ctx, state, node, carrier }, carrier);
    }
  }
}

/**
 * Wendet **einen** Durchlauf aller Modifikatoren des **ganzen** Baums (Anker
 * eingeschlossen) auf eine frische Basiskopie an und liefert die effektiven Werte.
 * Die Kopie startet immer frisch von den Basiswerten, sodass ein erneuter Aufruf
 * von den Basiswerten aus dieselben effektiven Werte liefert (keine kumulative
 * Drift innerhalb einer Auswertung).
 *
 * Das ist die geschlossene Sicht auf {@link applyModifiersOfNodes} — ein Durchlauf
 * ueber den ganzen Baum in einem Aufruf, ohne dass der Aufrufer Knotenmenge und
 * Zustand selbst stellt.
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
  applyModifiersOfNodes(allNodes(root), state, { root, index, categoryIds, diagnostics, budget });
  return state;
}
