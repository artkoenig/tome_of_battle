/**
 * Das Query-Primitiv (`docs/evaluator-architecture.md` §4.5) — die **eine**
 * Stelle, die Bezugsrahmen, Ziele, Flags und Felder versteht. Grenze, Bedingung
 * und Wiederholung rufen ausschliesslich diese Funktion; sie ist die alleinige
 * Zaehlstelle der Engine.
 *
 * Umfang ab Issue 03: alle Bezugsrahmen (roster/force/parent/self sowie
 * Eintrags- und Kategorie-IDs) und alle Flags (`shared`,
 * `includeChildSelections`, `includeChildForces`) — auch in Kombination. Die
 * Domaenenregel „Kategorie-Ziel armeeweit, Eintrags-Ziel pro Kontingent"
 * (BSData §7.7) sitzt an genau dieser Stelle. Seit Issue 086 zaehlt auch
 * `scope="unit"` dazu: der Rahmen ist die umschliessende Einheit — der naechste
 * Vorfahre (den Knoten eingeschlossen) mit rohem `type="unit"`.
 *
 * Drei Rahmen sind **keine Zaehlrahmen** und werden deshalb vor jeder Rahmen- und
 * Indexarbeit beantwortet: das Feld `limit::<costTypeId>` liest die eingestellte
 * Kostengrenze aus dem Budget und beantwortet `scope="roster"` wie
 * `scope="force"` mit derselben Zahl ({@link resolveLimitValue}, Issue 0147),
 * `scope="primary-catalogue"` prueft die Identitaet des Armeebuchs, aus dem das
 * umschliessende Kontingent stammt ({@link resolvePrimaryCatalogue}, Issue 077),
 * und `scope="ancestor"` prueft die Mitgliedschaft eines Ziels in der strikten
 * Vorfahrenkette der tragenden Auswahl ({@link resolveAncestor}, Issue 086).
 */

import {
  CountedFieldKind,
  ScopeKeyword,
  DefinitionKind,
  DiagnosticKind,
  BudgetLimitUnresolvedReason,
  UNRESOLVED_BUDGET,
  normalizeFlags,
  scopeKey,
  diagnostic,
} from './model.js';
import { frameKeyOf } from './evalTree.js';
import { forceCatalogueIdOf } from './catalogSet.js';
import { targetsOf } from './countIndex.js';
import { EMPTY_ROSTER_BUDGET } from './rosterBudget.js';

/** Der leere Herkunftsindex der Kontingente — geteilt, weil nur gelesen. */
const EMPTY_PRIMARY_CATALOGUE_INDEX = new Map();

/**
 * Der leere Effektiv-Zustand — geteilt, weil nur gelesen. Ohne mitgegebene
 * Effektiv-Werte traegt kein Knoten Kategorien; die Vorfahrenpruefung des
 * Bezugsrahmens `ancestor` trifft dann nur noch ueber Definitions-Id,
 * Link-Ziel-Id und rohen Typ.
 */
const EMPTY_EFFECTIVE = Object.freeze({ categoryIdsOf: () => [] });

/**
 * Der rohe Eintragstyp, an dem eine Auswahl als **Einheit** erkennbar ist
 * (`type="unit"`, BSData §7.1) — dasselbe Typ-Schluesselwort, unter dem der
 * Zaehlindex Eintraege zaehlbar fuehrt ({@link targetsOf}).
 */
const UNIT_TYPE = 'unit';

/**
 * Buendelt den Auswertungs-Kontext einer Query
 * (`docs/evaluator-architecture.md` §4.5, `QueryContext`).
 *
 * @param {object} parts
 * @param {object} parts.node          die Bezugsinstanz, relativ zu der der Scope aufloest.
 * @param {object} parts.root          die Wurzel des Evaluationsbaums (der ROSTER-Rahmen).
 * @param {{ get: Function }} parts.index  der Zaehlindex.
 * @param {Set<string>} [parts.categoryIds]  die bekannten Kategorie-IDs (Ziel-Typ-Regel).
 * @param {object[]} parts.diagnostics  Sammelliste fuer Auswertungsprobleme.
 * @param {import('./rosterBudget.js').RosterBudget} [parts.budget]  die
 *   eingestellten Roster-Kostengrenzen (`RosterBudget`). In diesem Slice nur
 *   durchgereicht — die Feldauflösung (`limit::<id>`) liest es erst im
 *   Folge-Slice; fehlt es, gilt das leere Budget.
 * @param {Map<string, string>} [parts.primaryCatalogueByForceDefId]  der
 *   Herkunftsindex der Kontingente (`catalogSet.js`): je Kontingent-Definition
 *   das Armeebuch, das sie deklariert. Er ist die **erste** Quelle des
 *   Bezugsrahmens `primary-catalogue`; wo er schweigt, springt die
 *   Armeebuch-Angabe des Rosters am Kontingent-Knoten ein (Issue 0140). Fehlt
 *   er, gilt die leere Zuordnung; ohne beide bleibt eine solche Query
 *   fail-closed unaufgeloest.
 * @param {import('./effectiveState.js').EffectiveState} [parts.effective]  die
 *   Effektiv-Werte der Knoten. Der Bezugsrahmen `ancestor` liest daraus die
 *   **effektiven** Kategorien der Vorfahren (Issue 086 — alle realen Vorkommen
 *   benennen Kategorie-Ids); fehlen sie, gilt der leere Zustand
 *   ({@link EMPTY_EFFECTIVE}).
 */
export function createQueryContext({ node, root, index, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId, effective }) {
  return {
    node,
    root,
    index,
    categoryIds: categoryIds ?? new Set(),
    diagnostics,
    budget: budget ?? EMPTY_ROSTER_BUDGET,
    primaryCatalogueByForceDefId: primaryCatalogueByForceDefId ?? EMPTY_PRIMARY_CATALOGUE_INDEX,
    effective: effective ?? EMPTY_EFFECTIVE,
  };
}

/** True, wenn die Ziel-ID eine Kategorie benennt (statt eines Eintrags). */
function isCategoryTarget(targetId, categoryIds) {
  return targetId !== null && targetId !== undefined && categoryIds.has(targetId);
}

/** Der naechste Vorfahre (den Knoten eingeschlossen), dessen Definition `id` traegt. */
function nearestAncestorWithDefId(node, id) {
  for (let current = node; current !== null && !current.isRoot; current = current.parent) {
    if (current.def?.id === id) return current;
  }
  return null;
}

/**
 * True, wenn die Definition eines Knotens rohen `type="unit"` traegt. Ein
 * `entryLink` traegt selbst kein solches Attribut — bei ihm zaehlt der rohe Typ
 * seines transitiv aufgeloesten Ziels, dieselbe Erb-Regel, mit der der
 * Zaehlindex Typ-Schluesselwoerter fuehrt ({@link targetsOf}, Issue 078/086).
 */
function isUnitDefinition(def) {
  if (def?.type === UNIT_TYPE) return true;
  return def?.kind === DefinitionKind.ENTRY_LINK && def.resolved?.type === UNIT_TYPE;
}

/**
 * Die **umschliessende Einheit** (`scope="unit"`, Issue 086): der naechste
 * Vorfahre — den Knoten selbst eingeschlossen — mit rohem `type="unit"`.
 * `null`, wenn keiner der Vorfahren eine Einheit ist; die Query bleibt dann
 * fail-closed unaufgeloest statt still zu raten.
 */
function nearestUnitAncestor(node) {
  for (let current = node; current !== null && !current.isRoot; current = current.parent) {
    if (isUnitDefinition(current.def)) return current;
  }
  return null;
}

/**
 * Der naechste Vorfahre (den Knoten eingeschlossen), dessen **effektive**
 * Kategorien `categoryId` enthalten (Issue 0146).
 *
 * Der Gegenpart zu {@link nearestAncestorWithDefId} fuer den zweiten ID-Fall:
 * eine Kategorie-ID als **Bezugsrahmen** benennt — wie jede andere ID — einen
 * *Vorfahren*, nicht die Wurzel (BSData-Wiki, *Data structure overview*,
 * Abschnitt *Constraint*: `Scope` ist „one of `parent|roster|force|primary
 * category` **or any type of ancestor identifier**", und er entscheidet, „which
 * entity should sum up all `field`'s values of descendant selections").
 * Gelesen werden die **effektiven** Kategorien, nicht die Basis-Kategorien: die
 * Kataloge setzen die Bloodline-Kategorien eines Charakters per
 * `add category`-Modifikator (Definitive Edition, `Vampire Counts`), und genau
 * diese Zuordnung ist gemeint.
 *
 * @returns {object|null} der Rahmenknoten, oder `null`, wenn kein Vorfahre die
 *   Kategorie traegt (die Query bleibt dann fail-closed unaufgeloest).
 */
function nearestAncestorInCategory(ctx, categoryId) {
  for (let current = ctx.node; current !== null && !current.isRoot; current = current.parent) {
    if (ctx.effective.categoryIdsOf(current).includes(categoryId)) return current;
  }
  return null;
}

/**
 * Loest ein Scope-Schluesselwort **oder** eine ID (Eintrag/Kategorie) in seinen
 * Rahmenknoten auf — der geteilte Fall fuer `shared="true"`. `parent` und
 * `shared="false"` werden vom Aufrufer vorab behandelt und erreichen diese
 * Funktion nicht.
 *
 * @returns {object|null} der Rahmenknoten, oder `null`, wenn der Scope nicht aufloest.
 */
function resolveSharedFrame(ctx, scope) {
  switch (scope) {
    case ScopeKeyword.ROSTER:
      return ctx.root;
    case ScopeKeyword.FORCE:
      return ctx.node.forceRoot; // null, wenn der Knoten ueber keinem Kontingent liegt
    case ScopeKeyword.SELF:
      return ctx.node;
    case ScopeKeyword.UNIT:
      return nearestUnitAncestor(ctx.node);
    default:
      // Beide ID-Faelle benennen einen **Vorfahren**: eine Eintrags-ID den
      // naechsten mit dieser Definitions-ID, eine Kategorie-ID den naechsten,
      // der diese Kategorie effektiv traegt ({@link nearestAncestorInCategory}).
      return isCategoryTarget(scope, ctx.categoryIds)
        ? nearestAncestorInCategory(ctx, scope)
        : nearestAncestorWithDefId(ctx.node, scope);
  }
}

/**
 * Bestimmt den Rahmenknoten einer Query aus Scope und Flags.
 *
 * - `parent` ist bereits an die Bezugsinstanz gebunden und geht **vor** `shared`
 *   (ADR-0003 §4): `shared="false"` schraenkt ihn nicht weiter ein.
 * - `shared="false"` bindet sonst unabhaengig vom Scope an den Teilbaum der
 *   tragenden Instanz (der Knoten selbst).
 * - Bei `shared="true"` bestimmt der Scope den Rahmen. Die **Ziel-Typ-Regel**
 *   (§7.7) gilt ausschliesslich fuer `scope="force"` (ADR-0003, ADR-0029): dort
 *   hebt ein **Kategorie-Ziel** den Rahmen armeeweit auf die Wurzel (eine Kategorie
 *   zaehlt ueber alle Kontingente), ein Eintrags-Ziel bleibt pro Kontingent. Andere
 *   Scopes (`self`, Eintrags-/Kategorie-ID) bleiben an ihrem Rahmen gebunden — ein
 *   Kategorie-Ziel weitet sie nicht auf.
 *
 * @returns {object|null} der Rahmenknoten, oder `null` bei nicht aufloesbarem Scope.
 */
function resolveFrame(ctx, scope, targetId, flags) {
  if (scope === ScopeKeyword.PARENT) return ctx.node.parent;
  if (!flags.shared) return ctx.node;

  const frame = resolveSharedFrame(ctx, scope);
  if (
    scope === ScopeKeyword.FORCE &&
    frame !== null &&
    isCategoryTarget(targetId, ctx.categoryIds)
  ) {
    return ctx.root;
  }
  return frame;
}

/**
 * Loest ein `LIMIT_VALUE(costTypeId)`-Feld aus dem Roster-Budget auf — **nicht**
 * aus dem Zaehlindex.
 *
 * Die eingestellte Grenze steht an **zwei** Rahmen: `roster` und `force`. Ein
 * `.ros` deklariert seine `<costLimits>` nur an der Roster-Wurzel — das Format
 * kennt keine Stelle, an der ein einzelnes Kontingent seine eigene Kostengrenze
 * setzt (BSData §5.6/§7.6) —, also liegt jedes Kontingent in genau einem Roster
 * und traegt dessen eingestellte Grenze. Beide Scopes beantworten deshalb
 * dieselbe Zahl (Issue 0147). Ein Scope ausserhalb dieser beiden wird nicht still
 * umgedeutet, sondern als Diagnose gemeldet.
 *
 * Drei Lagen liefern statt einer Zahl den {@link UNRESOLVED_BUDGET}-Sentinel samt
 * Diagnose — nie eine `0` —, der Konsument feuert dann **fail-closed** nicht
 * (`design.md`, Kontrakt `query.js`):
 *
 * | Lage                                                   | Grund |
 * | ---                                                    | ---   |
 * | Scope ausserhalb von `roster`/`force`                  | `UNSUPPORTED_SCOPE` |
 * | Scope `force`, aber der Knoten liegt ueber keinem Kontingent | `UNRESOLVED_FRAME` |
 * | Kostenart im Budget nicht deklariert (auch `-1`)       | `NOT_BUDGETED` |
 *
 * Die Reihenfolge ist Teil des Kontrakts: der Rahmen wird vor dem Budget geprueft,
 * ein unaufloesbares Kontingent meldet also `UNRESOLVED_FRAME` auch dann, wenn die
 * Kostenart budgetiert waere.
 *
 * @returns {number|typeof UNRESOLVED_BUDGET} der eingestellte Grenzwert, oder der Sentinel.
 */
function resolveLimitValue(ctx, field, scope) {
  const { costTypeId } = field;
  if (scope !== ScopeKeyword.ROSTER && scope !== ScopeKeyword.FORCE) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_BUDGET_LIMIT, {
      costTypeId,
      reason: BudgetLimitUnresolvedReason.UNSUPPORTED_SCOPE,
      scope,
    }));
    return UNRESOLVED_BUDGET;
  }
  // Der Force-Rahmen liest nichts am Kontingent-Knoten; er muss nur **existieren**,
  // damit die Frage „die Grenze dieses Kontingents" ueberhaupt einen Bezug hat.
  if (scope === ScopeKeyword.FORCE && !ctx.node.forceRoot) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_BUDGET_LIMIT, {
      costTypeId,
      reason: BudgetLimitUnresolvedReason.UNRESOLVED_FRAME,
      scope,
    }));
    return UNRESOLVED_BUDGET;
  }
  const bound = ctx.budget.get(costTypeId);
  if (bound === undefined) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_BUDGET_LIMIT, {
      costTypeId,
      reason: BudgetLimitUnresolvedReason.NOT_BUDGETED,
    }));
    return UNRESOLVED_BUDGET;
  }
  return bound;
}

/**
 * Beantwortet den Bezugsrahmen `primary-catalogue`: **ist das Armeebuch des
 * umschliessenden Kontingents das in `targetId` genannte?** (Issue 077, Kriterium
 * 1 — aus den Katalogdaten belegt: alle 27 Vorkommen tragen eine Katalog-Wurzel-Id
 * in `childId`.)
 *
 * Er ist **kein Zaehlrahmen**, sondern eine Identitaetspruefung: ein Katalog ist
 * kein Knoten des Instanzbaums, `scopeKey(frameKey, targetId)` faende ihn also
 * nie. Deshalb steht er — wie `limit::<id>` — **vor** jeder Rahmen- und Indexarbeit
 * und damit **unabhaengig von `shared`**: ein Katalog wird durch `shared="false"`
 * nicht enger.
 *
 * Der Antwortvertrag (Issue 077, Abschnitt „Plan"):
 *
 * | Lage                                                       | Ergebnis |
 * | ---                                                        | ---      |
 * | `targetId` ist die Katalog-Id des Kontingents              | 1        |
 * | `targetId` ist eine andere Katalog-Id                      | 0        |
 * | `targetId === null` (Prozent-Nenner „alles im Rahmen")     | 1 — der Rahmen hat genau **einen** Katalog |
 * | kein umschliessendes Kontingent, oder sein Armeebuch ist unbekannt | 0 **mit** `unresolvedScope` |
 * | ein anderes Feld als `SELECTION_COUNT`                     | `unsupportedField` |
 *
 * Welches Armeebuch das umschliessende Kontingent hat, beantwortet dieselbe
 * eine Stelle wie fuer Pflicht und Angebot ({@link forceCatalogueIdOf}, Issue
 * 0140): zuerst der **Herkunftsindex** aus den Katalogdaten, und nur wo der
 * schweigt die **Angabe des Rosters** am Kontingent-Knoten. Ein in der
 * Spielsystemdatei deklariertes Kontingent loest damit auf, sobald das Roster
 * sein Armeebuch nennt; nennt es keines, bleibt es beim fail-closed
 * `unresolvedScope`. Ein Roster, das dem Index widerspricht, aendert dagegen
 * nichts — die Definition entscheidet.
 *
 * Eine Katalog-Id, die in diesem Datensatz gar nicht geladen ist (in den
 * Fixture-Daten kommt das vor), ist als **`targetId`** ein schlichter
 * Nicht-Treffer und kein Datenfehler: die Regel fragt nach der Identitaet des
 * Armeebuchs, nicht nach seiner Anwesenheit.
 *
 * @returns {number} 0 oder 1.
 */
function resolvePrimaryCatalogue(ctx, field, targetId) {
  if (field.kind !== CountedFieldKind.SELECTION_COUNT) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
    return 0;
  }
  const { forceRoot } = ctx.node;
  const catalogueId = forceRoot === null || forceRoot === undefined
    ? undefined
    : forceCatalogueIdOf(forceRoot, ctx.primaryCatalogueByForceDefId);
  if (catalogueId === undefined) {
    // Fail-closed statt stiller Falschauskunft: ohne umschliessendes Kontingent
    // (etwa an der Wurzel) oder wenn weder das Roster noch die Katalogdaten ein
    // Armeebuch nennen — z. B. ein Kontingent aus der `.gst` in einem Roster
    // ohne Armeebuch-Angabe — gibt es kein Armeebuch zu vergleichen.
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_SCOPE, {
      scope: ScopeKeyword.PRIMARY_CATALOGUE,
      targetId,
    }));
    return 0;
  }
  if (targetId === null || targetId === undefined) return 1;
  return targetId === catalogueId ? 1 : 0;
}

/**
 * Beantwortet den Bezugsrahmen `ancestor`: **loest ein Vorfahre der tragenden
 * Auswahl auf `targetId` auf?** (Issue 086, Kriterium 2 — aus den Katalogdaten
 * belegt: alle 10 Fixture-Vorkommen sind `instanceOf`-Conditions, und jede
 * `childId` benennt eine Kategorie-Id.)
 *
 * Er ist **kein Zaehlrahmen**, sondern — wie `primary-catalogue` — eine
 * Mitgliedschaftspruefung: gefragt ist die gesamte **strikte** Vorfahrenkette
 * (Kontingente eingeschlossen, die definitionslose Wurzel und der Knoten selbst
 * ausgenommen), kein einzelner Rahmenknoten, den `scopeKey(frameKey, targetId)`
 * je faende. Deshalb steht er **vor** jeder Rahmen- und Indexarbeit und
 * **unabhaengig von den Flags**: eine Vorfahrenkette wird durch eine Instanz
 * nicht enger.
 *
 * Ergebnis ist die Zahl der passenden Vorfahren; ein Vorfahre passt, wenn
 * `targetId` unter den Zielen liegt, unter denen ihn auch der Zaehlindex
 * zaehlbar fuehrt ({@link targetsOf}: Definitions-Id, Link-Ziel-Id, effektive
 * Kategorien, roher Typ). `targetId === null` (Prozent-Nenner „alles im
 * Rahmen") zaehlt jeden Vorfahren. Nur `field="selections"` ist gueltig;
 * anderes Feld → `unsupportedField` (wie `primary-catalogue`).
 *
 * @returns {number} die Zahl der passenden strikten Vorfahren.
 */
function resolveAncestor(ctx, field, targetId) {
  if (field.kind !== CountedFieldKind.SELECTION_COUNT) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
    return 0;
  }
  let matches = 0;
  for (let ancestor = ctx.node.parent; ancestor !== null && !ancestor.isRoot; ancestor = ancestor.parent) {
    if (
      targetId === null || targetId === undefined ||
      targetsOf(ancestor, ctx.effective).includes(targetId)
    ) {
      matches += 1;
    }
  }
  return matches;
}

/**
 * Zaehlt `field` im Rahmen `scope`, gefiltert auf `targetId`, unter `flags` — oder
 * liest, fuer ein `LIMIT_VALUE`-Feld, die eingestellte Grenze aus dem Budget.
 *
 * @param {object} ctx  aus {@link createQueryContext} (traegt `node`, `root`, `index`, `categoryIds`, `diagnostics`, `budget`, `primaryCatalogueByForceDefId`, `effective`).
 * @param {{ kind: string, costTypeId?: string }} field  aus `SELECTION_COUNT` / `costSumField` / `limitValueField`.
 * @param {string} scope  ein `ScopeKeyword` oder eine Eintrags-/Kategorie-ID.
 * @param {string|null} targetId  Ziel-ID oder `null` fuer "alles im Rahmen".
 * @param {{ shared?: boolean, includeChildSelections?: boolean, includeChildForces?: boolean, includeClimbedCosts?: boolean }} [flags]
 *   Die drei Battlescribe-Flags, dazu das engine-eigene Gate
 *   `includeClimbedCosts` fuer die unter die Traeger-Id **aufgestiegenen**
 *   Nachfahren-Kosten (Issue 0113): ohne Angabe folgt es
 *   `includeChildSelections`. Die Constraint-Schicht setzt es getrennt, wenn
 *   sie die Schachtelungs-Flags fuer die Vorkommens-Zaehlung anhebt
 *   (`countingFlagsOf`), die Nachfahren-Kosten aber beim hingeschriebenen
 *   Flag bleiben muessen (§7.6 „just scope's field", Issue 091).
 * @returns {number|typeof UNRESOLVED_BUDGET} die Zaehlung/Grenze, oder der
 *   Budget-Sentinel bei einem unaufloesbaren `LIMIT_VALUE`-Feld.
 */
export function query(ctx, field, scope, targetId, flags) {
  // Ein `LIMIT_VALUE`-Feld kommt aus dem Budget, nicht aus dem Zaehlindex — daher
  // vor jeder Rahmen-/Index-Arbeit aufloesen. Der Wert haengt an keinem Rahmenknoten
  // und an keinem Flag; `roster` und `force` liefern dieselbe eingestellte Grenze.
  if (field.kind === CountedFieldKind.LIMIT_VALUE) {
    return resolveLimitValue(ctx, field, scope);
  }

  // Der Katalog-Rahmen ist kein Zaehlrahmen, sondern eine Identitaetspruefung —
  // daher ebenfalls vor jeder Rahmen-/Index-Arbeit und unabhaengig von `shared`
  // ({@link resolvePrimaryCatalogue}, Issue 077).
  if (scope === ScopeKeyword.PRIMARY_CATALOGUE) {
    return resolvePrimaryCatalogue(ctx, field, targetId);
  }

  // Auch die Vorfahrenkette ist kein Zaehlrahmen, sondern eine
  // Mitgliedschaftspruefung — vor jeder Rahmen-/Index-Arbeit und unabhaengig
  // von den Flags ({@link resolveAncestor}, Issue 086).
  if (scope === ScopeKeyword.ANCESTOR) {
    return resolveAncestor(ctx, field, targetId);
  }

  const effectiveFlags = normalizeFlags(flags);
  const frame = resolveFrame(ctx, scope, targetId, effectiveFlags);
  if (frame === null || frame === undefined) {
    // Fail-closed: Zaehlwert 0, sichtbar gemacht per Diagnose. Eine Ausnahme
    // fuer den `unit`-Rahmen an **synthetischen** Knoten (Phantome und Anker,
    // Issue 086): ein Angebots-Anker ist eine engine-erfundene Bewertungs-
    // position (ADR-0035, materialisiert auch Verstecktes) — fehlt IHM die
    // umschliessende Einheit, ist das kein Datenproblem, sondern ein Artefakt
    // der Verankerung. Reale Kataloge legen solche Eintraege versteckt auf
    // Armee-Ebene ab und verwenden sie nur via `entryLink` innerhalb von
    // Einheiten; die Diagnose bliebe reines Rauschen (Kriterium 3). An einer
    // **realen** Auswahl ausserhalb jeder Einheit bleibt sie bestehen. Der
    // Zaehlwert ist in beiden Faellen 0 — kein Modifikator feuert.
    if (scope !== ScopeKeyword.UNIT || ctx.node.isPhantom !== true) {
      ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_SCOPE, { scope, targetId }));
    }
    return 0;
  }

  const key = scopeKey(frameKeyOf(frame), targetId);
  // Der Eigenanteil des Rahmenknotens unter dem `null`-Ziel (`childId="any"`
  // oder gar kein `childId`) gehoert nur dann zur Antwort, wenn die Query am
  // Rahmen selbst gestellt wird — `scope="self"` und jedes `shared="false"`,
  // wo {@link resolveFrame} den Rahmen an den fragenden Knoten bindet. Ist der
  // Rahmen ein anderer, stets ein echter Vorfahre, fragt `childId="any"` nach
  // dem, was *im* Rahmen steht, und der Rahmen steht nicht in sich selbst.
  const tally = ctx.index.get(
    key,
    effectiveFlags.includeChildSelections,
    effectiveFlags.includeChildForces,
    flags?.includeClimbedCosts ?? effectiveFlags.includeChildSelections,
    frame === ctx.node,
  );

  if (field.kind === CountedFieldKind.SELECTION_COUNT) {
    return tally.selectionCount;
  }
  if (field.kind === CountedFieldKind.FORCE_COUNT) {
    return tally.forceCount;
  }
  if (field.kind === CountedFieldKind.COST_SUM) {
    return tally.costSums.get(field.costTypeId) ?? 0;
  }
  ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
  return 0;
}
