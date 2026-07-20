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

/** Die id, unter der eine (materialisierte) Selektion ihren Katalog-Eintrag referenziert. */
function selectionEntryRef(selection) {
  return selection.entryLinkId || selection.selectionEntryId;
}

/**
 * Zählt die Katalog-Einträge einer Force auf, die Listenregeln sind — in einem
 * ihrer categoryLinks primär und vom `type` `upgrade`. Jeder Eintrag wird mit der
 * categoryLink-`targetId` (Gruppierung) und seiner aufgelösten Entry-ID (Abgleich)
 * gepaart. Nutzt dieselbe Aufzählung wie der „+"-Adder (ADR 0003 §4).
 */
function collectListRuleEntryDefs(system, catalogue, forceDef, roster, force) {
  const found = [];
  if (!forceDef) return found;
  const seenResolvedIds = new Set();

  for (const link of forceDef.categoryLinks || []) {
    const categoryId = link.targetId;
    for (const { entry, resolved } of collectPrimaryCategoryEntries(system, catalogue, categoryId, { roster, force })) {
      if (!isListRuleEntryKind(resolved.type)) continue;
      if (seenResolvedIds.has(resolved.id)) continue;
      seenResolvedIds.add(resolved.id);
      found.push({ entry, categoryId, resolvedId: resolved.id });
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
    // Abgleich über die *aufgelöste* Entry-ID, damit auch importierte Roster, die
    // eine Regel über eine andere Link-/Entry-Repräsentation referenzieren, als
    // vorhanden erkannt werden (keine Dubletten).
    const presentResolvedIds = new Set();
    for (const sel of existing) {
      const ref = selectionEntryRef(sel);
      if (!ref) continue;
      const resolved = resolveEntry(system, findEntryInSystem(system, ref, catalogueId), catalogueId);
      if (resolved?.id) presentResolvedIds.add(resolved.id);
    }

    const additions = [];
    for (const { entry, categoryId, resolvedId } of defs) {
      if (presentResolvedIds.has(resolvedId)) continue;
      const selection = buildSelection(entry, categoryId);
      if (selection) additions.push(selection);
    }
    if (additions.length === 0) return force;

    changed = true;
    return { ...force, selections: [...existing, ...additions] };
  });

  return changed ? { ...roster, forces } : null;
}
