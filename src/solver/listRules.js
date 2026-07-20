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
import { isEntryPrimaryInCategory, isSelectionEntryHidden } from './entryVisibility.js';
import { findForceEntryById } from './forceEntries.js';
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

/** Die id, unter der eine (materialisierte) Selektion ihren Katalog-Eintrag referenziert. */
function selectionEntryRef(selection) {
  return selection.entryLinkId || selection.selectionEntryId;
}

/**
 * Zählt die Katalog-Einträge einer Force auf, die Listenregeln sind — d. h. in
 * einem ihrer categoryLinks primär und vom `type` `upgrade`. Jeder Eintrag wird
 * mit der categoryLink-`targetId` gepaart, unter der er primär ist, damit die
 * daraus erzeugte Selektion unter dem richtigen Hauptknoten gruppiert. Spiegelt
 * die Aufzählung des CategoryUnitAdder (ADR 0003 §4: effektive Primärkategorie).
 */
function collectListRuleEntryDefs(system, catalogue, forceDef, roster, force) {
  const found = [];
  if (!system || !catalogue || !forceDef) return found;

  const pools = [
    ...(catalogue.selectionEntries || []),
    ...(catalogue.entryLinks || []),
    ...(catalogue.sharedSelectionEntries || []),
  ];
  const seenResolvedIds = new Set();

  for (const link of forceDef.categoryLinks || []) {
    const categoryId = link.targetId;
    for (const entry of pools) {
      const resolved = resolveEntry(system, entry);
      if (!resolved || !isListRuleEntryKind(resolved.type)) continue;
      if (!isEntryPrimaryInCategory(entry, categoryId, { system, roster, selectionCounts: {}, force })) continue;
      if (isSelectionEntryHidden(entry, system, roster, {}, null, force)) continue;
      if (seenResolvedIds.has(resolved.id)) continue;
      seenResolvedIds.add(resolved.id);
      found.push({ entry, categoryId });
    }
  }
  return found;
}

/**
 * Materialisiert fehlende Listenregeln: sorgt dafür, dass jede Listenregel-Kette
 * einer Force dauerhaft als Selektion vorhanden ist — Listenregeln sind
 * listenweite Einstellungen, keine vom Nutzer hinzugefügten/entfernten Einheiten.
 * `buildSelection(entry, categoryId)` erzeugt die Selektion (wie beim manuellen
 * Hinzufügen). Idempotent: bereits vorhandene Regeln werden nicht dupliziert.
 * Gibt ein neues Roster-Objekt zurück, wenn etwas ergänzt wurde, sonst `null`.
 */
export function materializeListRules(roster, system, buildSelection) {
  if (!roster || !system || !Array.isArray(roster.forces)) return null;

  let changed = false;
  const forces = roster.forces.map((force) => {
    const forceDef = findForceEntryById(system, force.forceEntryId);
    const catalogueId = force.catalogueId || roster.catalogueId;
    const catalogue = system.catalogues?.find((c) => c.id === catalogueId);
    const defs = collectListRuleEntryDefs(system, catalogue, forceDef, roster, force);
    if (defs.length === 0) return force;

    const existing = force.selections || [];
    const presentRefs = new Set(existing.map(selectionEntryRef));

    const additions = [];
    for (const { entry, categoryId } of defs) {
      if (presentRefs.has(entry.id)) continue;
      const selection = buildSelection(entry, categoryId);
      if (selection) additions.push(selection);
    }
    if (additions.length === 0) return force;

    changed = true;
    return { ...force, selections: [...existing, ...additions] };
  });

  return changed ? { ...roster, forces } : null;
}
