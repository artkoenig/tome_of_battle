import { EntryLinkKind } from '../../data/parser/schema/battlescribeSchema.generated.js';
import { findMemberDefById } from './selectionMembers.js';
import '../../shared/types.js';

/**
 * Reine, geteilte Selektions-Fabrik: erzeugt aus einem Katalog-Eintrag/-Link einen
 * vollständigen Selektions-Knoten und legt die **Pflicht-Mitglieder** darunter an,
 * rekursiv — identisch zum echten Ausheben.
 *
 * Welche Mitglieder das sind, sagt seit Issue 0157 der **Bericht**
 * (`capability.raiseMembers`, ADR-0034), nicht ein zweites Lesen der
 * Katalog-Constraints: je Pflicht-Kind seine Id, seine effektive Anzahl (nach
 * allen Modifikatoren, im Rahmen des Kontingents, in dem ausgehoben wird) und
 * dessen eigene Pflicht-Mitglieder. Diese Schicht **löst** die genannten Ids nur
 * noch gegen den Katalog auf; sie entscheidet nichts mehr über die Verpflichtung.
 * Preis und angelegter Baum stammen damit aus einer Quelle (AC3): der Bericht
 * rechnet beide in einem Durchlauf (`costProjection.js`).
 *
 * Abhängigkeiten werden injiziert (Dependency Injection, kein Closure über Hook-State):
 * @param {Object} args
 * @param {Object} args.system                     das Spielsystem.
 * @param {(system: Object, entry: Object, catalogueId: string|null) => Object} args.resolveEntry
 *   Auflöser für Links/Einträge.
 * @param {Object} args.entry                       der (unaufgelöste) Katalog-Eintrag/Link.
 * @param {string|null} args.catalogueId            der Katalog, aus dem `entry` stammt. Pflicht-
 *   Kontext: bei mehreren gleichzeitig geladenen Katalogen (ADR-0018) ist eine Eintrags-Id
 *   nur innerhalb ihres Katalogs eindeutig.
 * @param {string|null} [args.categoryId]           Kategorie der Top-Selektion (Kinder erben keine).
 * @param {ReadonlyArray<{ defId: string, targetDefId?: string|null, count: number, members?: ReadonlyArray<object> }>} [args.mandatoryMembers]
 *   die Pflicht-Mitglieder dieses Slots aus dem Bericht. Ohne sie entsteht der
 *   Knoten allein — der Bericht kennt dann keinen Slot für diese Stelle, und wo
 *   er keine Pflicht sieht, legt die Fabrik auch keine an.
 * @returns {import('../../shared/types.js').Selection|null}  der Knoten, oder null bei unauflösbarem Eintrag.
 */
export function createSelectionFromDef({ system, resolveEntry, catalogueId, entry, categoryId = null, mandatoryMembers = [] }) {
  const resolved = resolveEntry(system, entry, catalogueId);
  if (!resolved) return null;

  const selection = {
    id: crypto.randomUUID(),
    entryLinkId: entry.targetId ? entry.id : null,
    selectionEntryId: entry.targetId ? null : entry.id,
    name: resolved.name,
    number: 1,
    category: categoryId,
    collective: resolved.collective || entry.collective || false,
    selections: []
  };

  /** Die Gruppe hinter einem Gruppen-Verweis — für sie ist der Verweis durchlässig. */
  const resolveGroupDef = (member) =>
    member?.type === EntryLinkKind.SELECTION_ENTRY_GROUP
      ? resolveEntry(system, member, catalogueId)
      : null;

  (mandatoryMembers || []).forEach(member => {
    const childEntry = findMemberDefById(resolved, member.defId, resolveGroupDef, member.targetDefId ?? null)
      ?? findMemberDefById(entry, member.defId, resolveGroupDef, member.targetDefId ?? null);
    if (!childEntry) return;

    const childSelection = createSelectionFromDef({
      system, resolveEntry, catalogueId, entry: childEntry, mandatoryMembers: member.members
    });
    if (!childSelection) return;

    childSelection.number = member.count;
    selection.selections.push(childSelection);
  });

  return selection;
}
