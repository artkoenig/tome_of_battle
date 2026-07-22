/**
 * Klassifikation: Ist eine (Wurzel-)Selektion eine *Listenregel* — eine
 * listenweite Einstellung — statt einer aushebbaren Einheit?
 *
 * Battlescribe-Einträge tragen einen `type` (`unit | model | upgrade`). Einheiten
 * und Modelle sind kampffeldrelevante Entitäten; ein auf Force-Wurzel-Ebene
 * eingebundener `upgrade`-Eintrag (z. B. „Allow experimental rules?",
 * „Campaign/Scenario rules") ist dagegen eine listenweite Konfiguration — eine
 * Listenregel. Die Unterscheidung folgt damit ausschließlich den Katalogdaten und
 * nie einem hartkodierten Kategorienamen (ADR 0003).
 */
import { findEntryInSystem, resolveEntry } from './catalogResolver.js';

/**
 * @typedef {Object} RosterForceContext Roster-/Force-Umfeld einer Kategorie-Auswertung.
 * @property {import('../types.js').Roster} [roster]
 * @property {import('../types.js').Force} [force]
 */
import { collectPrimaryCategoryEntries } from './entryVisibility.js';
import { getEffectiveModifiers, getModifiedConstraintValue } from './modifierEvaluator.js';
import { ConstraintKind, SelectionEntryKind } from '../parser/schema/battlescribeSchema.generated.js';
import { ConstraintScope } from './battlescribeConstants.js';

/**
 * True, wenn ein aufgelöster Entry-Typ eine Listenregel bezeichnet. Nur der
 * `upgrade`-Typ zählt als Listenregel; `unit` und `model` sind kampffeldrelevante
 * Einheiten. Ein unbekannter/fehlender Typ gilt bewusst *nicht* als Listenregel,
 * damit im Zweifel nichts fälschlich als Einstellung behandelt (und ausgeblendet)
 * wird.
 */
export function isListRuleEntryKind(entryKind) {
  return entryKind === SelectionEntryKind.UPGRADE;
}

/**
 * True, wenn die gegebene Selektion eine Listenregel ist. Löst dazu den
 * Katalog-Eintrag der Selektion auf und prüft dessen `type`. Ohne auflösbaren
 * Eintrag wird konservativ `false` zurückgegeben.
 */
export function isListRuleSelection(system, selection, catalogueId = null) {
  if (!selection) return false;
  const entryId = selection.entryLinkId || selection.selectionEntryId;
  if (!entryId) return false;
  const entry = findEntryInSystem(system, entryId, catalogueId);
  const resolved = resolveEntry(system, entry, catalogueId);
  return isListRuleEntryKind(resolved?.type);
}

/**
 * Einmalige Aufzählung der *primären* Katalog-Einträge einer Kategorie: liefert
 * die Gesamtzahl sowie die Teilmenge der Listenregel-Einträge. Sowohl die
 * Gruppen-Klassifikation als auch die Ankreuzlisten-Zustände lassen sich so aus
 * **einem** Katalog-Durchlauf ableiten, statt `collectPrimaryCategoryEntries`
 * mehrfach zu durchlaufen.
 * @param {object} system
 * @param {object} catalogue
 * @param {string} categoryId
 * @param {RosterForceContext} [context]
 */
function enumeratePrimaryEntries(system, catalogue, categoryId, { roster, force } = {}) {
  let total = 0;
  const ruleEntries = [];
  for (const item of collectPrimaryCategoryEntries(system, catalogue, categoryId, { roster, force })) {
    total += 1;
    if (isListRuleEntryKind(item.resolved.type)) ruleEntries.push(item);
  }
  return { total, ruleEntries };
}

/** Die id, unter der eine Selektion ihren Katalog-Eintrag referenziert. */
function selectionEntryRef(selection) {
  return selection.entryLinkId || selection.selectionEntryId;
}

/**
 * True, wenn eine Listenregel ein reiner **binärer Schalter** ist (an/aus per
 * Ankreuzfeld). Datengetrieben (ADR 0003): binär, solange der Eintrag keine echte
 * Mengen-Beschränkung `max > 1` trägt. Ein Wurzel-Tor mit `max > 1` (bislang
 * nirgends belegt) gilt als nicht-binär und fällt in der Oberfläche auf den
 * Mengen-Adder zurück. Ausgewertet wird die statische roster-/force-weite
 * `max`-Beschränkung; ein fehlender oder negativer Wert bedeutet „unbeschränkt
 * binär".
 */
function isBinaryListRule(resolved) {
  const maxConstraint = (resolved?.constraints || []).find(
    (c) => c.type === ConstraintKind.MAX && (!c.scope || c.scope === ConstraintScope.ROSTER || c.scope === ConstraintScope.FORCE)
  );
  if (!maxConstraint) return true;
  // Der effektive (modifier-angepasste) Max-Wert entscheidet, nicht der rohe Katalogwert:
  // ein Modifier, der die Obergrenze verändert, wirkt damit auch auf die Schalter-vs-Adder-
  // Klassifikation. Ohne Roster-Kontext greifen hier nur unbedingte Modifier.
  const effectiveMax = getModifiedConstraintValue(maxConstraint, getEffectiveModifiers(resolved), {});
  return effectiveMax === undefined || effectiveMax === null || effectiveMax < 0 || effectiveMax <= 1;
}

/** True, wenn der aufgelöste Eintrag konfigurierbare Unteroptionen trägt (Behälter-Regel). */
function isContainerListRule(resolved) {
  if (!resolved) return false;
  return (
    (resolved.selectionEntries?.length > 0) ||
    (resolved.entryLinks?.length > 0) ||
    (resolved.selectionEntryGroups?.length > 0)
  );
}

/**
 * Findet die vorhandene Selektion einer Force, die auf die aufgelöste Entry-ID
 * `resolvedId` verweist. Abgleich über die *aufgelöste* ID, damit auch importierte
 * Roster, die eine Regel über eine andere Link-/Entry-Repräsentation referenzieren,
 * als präsent erkannt werden.
 */
function findPresentSelection(system, selections, resolvedId, catalogueId) {
  for (const sel of selections || []) {
    const ref = selectionEntryRef(sel);
    if (!ref) continue;
    const resolved = resolveEntry(system, findEntryInSystem(system, ref, catalogueId), catalogueId);
    if (resolved?.id === resolvedId) return sel;
  }
  return null;
}

/**
 * @typedef {Object} ListRuleState Zustand einer einzelnen Listenregel für die
 *   Ankreuzliste.
 * @property {Object} entry       der Katalog-Eintrag/-Link der Regel.
 * @property {string} name        der Anzeigename der Regel (aus dem aufgelösten Eintrag).
 * @property {string} categoryId  die (Gruppierungs-)Kategorie der Regel.
 * @property {string} resolvedId  die aufgelöste Entry-ID (stabiler Abgleich).
 * @property {boolean} checked    true ⇔ die Regel ist im Roster präsent.
 * @property {?Object} selection  die präsente Roster-Selektion (falls `checked`).
 * @property {boolean} isBinary   true ⇔ reiner Schalter (Ankreuzfeld), sonst Mengen-Adder.
 * @property {boolean} isContainer true ⇔ die Regel trägt konfigurierbare Unteroptionen.
 */

/**
 * Baut aus den bereits aufgezählten Listenregel-Einträgen die
 * {@link ListRuleState}s. Dedupliziert per aufgelöster Entry-ID; `checked` leitet
 * sich rein aus der Roster-Präsenz ab (kein gespeicherter Zustand).
 */
function buildListRuleStates(system, ruleEntries, selections, catalogueId, categoryId) {
  const seenResolvedIds = new Set();
  const states = [];
  for (const { entry, resolved } of ruleEntries) {
    if (seenResolvedIds.has(resolved.id)) continue;
    seenResolvedIds.add(resolved.id);

    const selection = findPresentSelection(system, selections, resolved.id, catalogueId);
    states.push({
      entry,
      name: resolved.name,
      categoryId,
      resolvedId: resolved.id,
      checked: !!selection,
      selection: selection || null,
      isBinary: isBinaryListRule(resolved),
      isContainer: isContainerListRule(resolved),
    });
  }
  return states;
}

/**
 * Klassifiziert eine Kategorie-Gruppe **und** liefert – in einem einzigen
 * Katalog-Durchlauf – die Ankreuzlisten-Zustände. Der Editor fragt genau diese
 * eine Funktion, statt im JSX über Solver-Interna zu verzweigen, und reicht die
 * `states` an die `ListRuleChecklist` weiter (so wird die Kategorie nur einmal
 * traversiert, kein doppeltes `collectPrimaryCategoryEntries`).
 *
 * `isListRuleGroup`: Sind bereits Selektionen in der Kategorie präsent, wird nach
 * ihnen geurteilt (sind alle Listenregeln?); ist die Kategorie (noch) leer, nach
 * ihren Katalog-Einträgen (sind alle primären Einträge Listenregeln?). Eine
 * gemischte Kategorie gilt bewusst nicht als Listenregel-Gruppe. `states` wird nur
 * für eine echte Listenregel-Gruppe befüllt, sonst leer.
 *
 * @param {object} system
 * @param {object} catalogue
 * @param {string} categoryId
 * @param {RosterForceContext} [context]
 * @returns {{ isListRuleGroup: boolean, states: ListRuleState[] }}
 */
export function resolveListRuleGroup(system, catalogue, categoryId, { roster, force } = {}) {
  const catalogueId = force?.catalogueId || roster?.catalogueId;
  const allSelections = force?.selections || [];
  const categorySelections = allSelections.filter((s) => s.category === categoryId);
  const { total, ruleEntries } = enumeratePrimaryEntries(system, catalogue, categoryId, { roster, force });

  const isListRuleGroup = categorySelections.length > 0
    ? categorySelections.every((s) => isListRuleSelection(system, s, catalogueId))
    : total > 0 && ruleEntries.length === total;

  const states = isListRuleGroup
    ? buildListRuleStates(system, ruleEntries, allSelections, catalogueId, categoryId)
    : [];

  return { isListRuleGroup, states };
}
