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
import { collectPrimaryCategoryEntries } from './entryVisibility.js';
import { SelectionEntryKind } from '../parser/schema/battlescribeSchema.generated.js';

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
 * True, wenn `categoryId` eine *Listenregel-Kategorie* ist: sie hat mindestens
 * einen primären Katalog-Eintrag und **alle** ihre primären Einträge sind
 * Listenregeln. Damit lässt sich die Gruppe schon vor der Materialisierung (leere
 * `selections` beim ersten Render) als Listenregel-Gruppe erkennen — so blitzt
 * kein „+"-Adder auf, ehe die Regeln gesät sind. Eine gemischte Kategorie (auch
 * echte Einheiten) gilt bewusst nicht als Listenregel-Kategorie.
 */
export function isListRuleCategory(system, catalogue, categoryId, { roster, force } = {}) {
  const entries = collectPrimaryCategoryEntries(system, catalogue, categoryId, { roster, force });
  return entries.length > 0 && entries.every(({ resolved }) => isListRuleEntryKind(resolved.type));
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
    (c) => c.type === 'max' && (!c.scope || c.scope === 'roster' || c.scope === 'force')
  );
  if (!maxConstraint) return true;
  const { value } = maxConstraint;
  return value === undefined || value === null || value < 0 || value <= 1;
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
 * Zählt die Listenregeln einer Kategorie datengetrieben auf und paart jede mit
 * ihrem Präsenz-/Schalter-Zustand — die Grundlage der Ankreuzliste. Aufgezählt
 * werden **alle** primären Listenregel-Einträge der Kategorie (ob im Roster
 * präsent oder nicht) über dieselbe Enumeration wie der „+"-Adder (ADR 0003 §4);
 * `checked` leitet sich rein aus der Roster-Präsenz ab (kein gespeicherter
 * Zustand). Dedupliziert per aufgelöster Entry-ID.
 *
 * @returns {ListRuleState[]}
 */
export function collectListRuleStates(system, catalogue, categoryId, { roster, force } = {}) {
  const catalogueId = force?.catalogueId || roster?.catalogueId;
  const selections = force?.selections || [];
  const seenResolvedIds = new Set();
  const states = [];

  for (const { entry, resolved } of collectPrimaryCategoryEntries(system, catalogue, categoryId, { roster, force })) {
    if (!isListRuleEntryKind(resolved.type)) continue;
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
