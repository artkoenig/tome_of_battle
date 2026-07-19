import { findEntryInSystem, resolveEntry } from './catalogResolver.js';

/**
 * Klassifikationsmerkmal für den in CONTEXT.md definierten Begriff
 * „Listenkonfiguration": ein listenweiter Battlescribe-Schalter (z. B. „Allow
 * experimental rules?"), der keine spielbare Einheit ist und deshalb aus der
 * Spieleansicht herausfällt.
 *
 * Eine Selection ist genau dann eine Listenkonfiguration, wenn alle drei
 * Bedingungen zutreffen:
 *   1. ihr aufgelöster Eintragstyp ist `upgrade`,
 *   2. ihr gesamter Teilbaum (Eintrag + alle geschachtelten selectionEntries-
 *      Kinder) ist durchgehend profil- und kostenlos, und
 *   3. sie hängt direkt an der Armeeliste (Top-Level-Selection einer Force,
 *      nicht verschachtelt unter einer Einheit).
 *
 * Das Merkmal ist datengetrieben und generisch: es kodiert keine Kategorie-/
 * Katalog-/Fraktions-Spezifika (ADR-0003) und gilt daher für jede
 * Battlescribe-Datenquelle, auch für solche ohne Listenkonfigurationen.
 */

// BattleScribe lässt das `type`-Attribut eines selectionEntry weg, wenn der Typ
// `upgrade` ist — der Default entspricht `upgrade` (vgl. profileCollector.js).
const DEFAULT_ENTRY_TYPE = 'upgrade';

function resolveSelectionEntry(system, selection, catalogueId) {
  const entryId = selection?.entryLinkId || selection?.selectionEntryId;
  if (!entryId) return null;
  const rawEntry = findEntryInSystem(system, entryId, catalogueId);
  return rawEntry ? resolveEntry(system, rawEntry, catalogueId) : null;
}

function resolvedEntryType(resolvedEntry) {
  return resolvedEntry.type || DEFAULT_ENTRY_TYPE;
}

// Ein Eintrag trägt ein Profil, wenn er ein aufgelöstes Profil hat ODER auf eines
// verweist (infoLink type="profile"). Der Verweis zählt auch dann, wenn das
// Ziel-Profil in der geladenen Datenquelle (noch) nicht auflösbar ist — sonst
// würde ein profiltragender Upgrade-Eintrag fälschlich als inert klassifiziert.
function carriesProfile(resolvedEntry) {
  if ((resolvedEntry.profiles?.length || 0) > 0) return true;
  return (resolvedEntry.infoLinks || []).some(link => link.type === 'profile');
}

function carriesCost(resolvedEntry) {
  return (resolvedEntry.costs || []).some(cost => cost.value > 0);
}

// Alle eintragsartigen Kinder des aufgelösten Eintrags, deren eigener Teilbaum
// ebenfalls inert sein muss: inline selectionEntries, verlinkte Einträge und die
// in selectionEntryGroups gruppierten Einträge (rekursiv geglättet, damit ein in
// einer Gruppe verstecktes Profil den gesamten Eintrag disqualifiziert).
function collectChildEntries(entry) {
  const groupedChildren = (entry.selectionEntryGroups || []).flatMap(collectChildEntries);
  return [
    ...(entry.selectionEntries || []),
    ...(entry.entryLinks || []),
    ...groupedChildren
  ];
}

function isSubtreeProfileAndCostFree(system, resolvedEntry, catalogueId, visitedEntryIds) {
  if (!resolvedEntry) return true;
  if (resolvedEntry.id) {
    if (visitedEntryIds.has(resolvedEntry.id)) return true;
    visitedEntryIds.add(resolvedEntry.id);
  }

  if (carriesProfile(resolvedEntry) || carriesCost(resolvedEntry)) return false;

  return collectChildEntries(resolvedEntry).every(child => {
    const resolvedChild = resolveEntry(system, child, catalogueId);
    return isSubtreeProfileAndCostFree(system, resolvedChild, catalogueId, visitedEntryIds);
  });
}

// Eine Selection hängt direkt an der Armeeliste, wenn sie ein unmittelbares
// Element der Force-Selection-Liste ist — nicht unter einer anderen Selection
// (z. B. einer Einheit) verschachtelt.
function isTopLevelForceSelection(force, selection) {
  return (force?.selections || []).some(candidate => candidate.id === selection.id);
}

export function isListConfiguration({ system, force, selection, catalogueId = null }) {
  if (!system || !force || !selection) return false;
  if (!isTopLevelForceSelection(force, selection)) return false;

  const resolvedEntry = resolveSelectionEntry(system, selection, catalogueId);
  if (!resolvedEntry) return false;
  if (resolvedEntryType(resolvedEntry) !== DEFAULT_ENTRY_TYPE) return false;

  return isSubtreeProfileAndCostFree(system, resolvedEntry, catalogueId, new Set());
}
