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
