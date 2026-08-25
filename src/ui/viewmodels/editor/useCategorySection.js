import { useMemo } from 'react';

import { unitsOfForce } from '../../../contexts/armylist/model';
import { resolveListRuleGroupFromReport, isBlockingViolation, EMPTY_SLOT_INDEX } from '../../../contexts/ruleengine/readmodel/index.js';
import { capabilityEntryOf } from '../capabilityEntries';
import { useRosterReport } from '../rosterContexts';

/**
 * Eine **Kategorie-Sektion** eines Kontingents (Issue 0164): ob sie überhaupt
 * erscheint, wie sie heißt, ob sie eine Ankreuzliste statt einer Einheiten-Liste
 * ist, welchen Zähl-Chip sie trägt und welche Auswahlen darunter stehen.
 *
 * **Sichtbarkeit** — die Regel, an der eine handgebaute `capabilities`-Map am
 * ehesten scheitert, sind zwei Antworten des Berichts, beide an den Slots des
 * Kontingents:
 *
 * 1. `isHidden` des Kategorie-Ankers: ausgeblendet **und** nichts ausgewählt →
 *    keine Sektion. Der Anker führt den **effektiven** Zustand (statisches
 *    Attribut plus greifende `field="hidden"`-Modifikatoren, Issue 0156) — die
 *    Oberfläche wertet den Katalog dafür nicht ein zweites Mal aus.
 * 2. Ob irgendein `occupied`/`offerAnchor`/`mandatoryPhantom`-Slot des
 *    Kontingents diese Kategorie als **effektive** Primärkategorie führt
 *    (`primaryCategoryId`, ADR 0003 §4): keiner und nichts ausgewählt → die
 *    Kategorie ist ein reines Regel-Schlagwort (etwa „Charaktermodelle") und
 *    bekommt keine Sektion.
 *
 * Steht dagegen etwas in der Kategorie, erscheint sie in beiden Fällen — der
 * Nutzer bekommt seine eigenen Daten nie verborgen. Eine leere, aber angebotene
 * Kategorie bleibt bewusst sichtbar: mobil ist ihr Hinzufüger der einzige Weg,
 * eine Einheit dieser Kategorie aufzunehmen.
 *
 * @param {{ force: Object, forcePath: string|null, categoryLink: Object }} params
 * @returns {{ isVisible: boolean, categoryId: string, categoryName: string,
 *   selections: Array<Object>, isListRuleGroup: boolean,
 *   badge: { count: number, min: number|null, max: number|null, hasErrors: boolean } }}
 */
export function useCategorySection({ force, forcePath = null, categoryLink }) {
  const { report, system, activeCatalogue } = useRosterReport();
  const slots = report?.slots ?? EMPTY_SLOT_INDEX;
  const categoryId = categoryLink?.targetId ?? null;

  return useMemo(() => {
    // Der Kategorie-Anker dieses Kontingents (Issue 0121, Task 7): der Evaluator
    // verankert eine Kategorie an einem Slot mit `anchorKind: 'categoryAnchor'`,
    // dessen `defId` der `categoryLink` (verlinkter Fall) oder die Kategorie
    // selbst ist (unverlinkter Fall, `report.js`-Ankervertrag).
    const categoryAnchor = slots.findCategoryAnchorSlot(forcePath, categoryId)
      ?? slots.findCategoryAnchorSlot(forcePath, categoryLink?.id);
    const isHidden = categoryAnchor?.isHidden === true;
    const selections = unitsOfForce(force).filter(s => s.category === categoryId);

    const selectionByPath = new Map();
    for (const selection of unitsOfForce(force)) {
      const path = slots.pathOfSelection(selection.id);
      if (path !== undefined) selectionByPath.set(path, selection);
    }
    const { isListRuleGroup } = resolveListRuleGroupFromReport(
      slots, forcePath, categoryId, {
        selectionByPath,
        entryOf: (capability) => capabilityEntryOf(system, capability, activeCatalogue?.id),
      }
    );

    const isPrimaryForAnyEntry = slots.hasUnitSlotsInCategory(forcePath, categoryId);
    // Ausgeblendeter Anker ohne Auswahlen, oder gar kein Einheiten-Slot in der
    // Kategorie und ebenfalls nichts ausgewählt: keine Sektion.
    const isVisible = !(isHidden && selections.length === 0)
      && !(selections.length === 0 && !isPrimaryForAnyEntry);

    const categoryDefinition = system?.categoryEntries?.find(ce => ce.id === categoryId);
    const categoryName = categoryDefinition ? categoryDefinition.name : categoryLink?.name;

    // Blockierende Verletzungen dieser Kategorie hängen am selben Anker.
    const categoryViolations = (report?.violations ?? []).filter(violation =>
      isBlockingViolation(violation)
      && violation.anchor?.anchorKind === 'categoryAnchor'
      && (violation.anchor.defId === categoryId || violation.anchor.defId === categoryLink?.id));

    return {
      isVisible,
      categoryId,
      categoryName,
      selections,
      isListRuleGroup,
      badge: {
        count: categoryAnchor?.current ?? 0,
        min: categoryAnchor?.effectiveMin ?? null,
        max: categoryAnchor?.effectiveMax ?? null,
        hasErrors: categoryViolations.length > 0,
      },
    };
  }, [report, slots, forcePath, categoryId, categoryLink, force, system, activeCatalogue]);
}
