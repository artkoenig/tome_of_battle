import { useMemo } from 'react';
import { resolveCostLimitTypeId, resolveCostLimitLabel } from '../../../domain/roster';
import { useRosterCommands, useRosterReport } from '../rosterContexts';
import { buildSections } from './configuratorSections.js';
import { findSelectionById } from './optionRowDerivations.js';

/**
 * ViewModel des Auswahl-Konfigurators (ADR-0038; ADR-0035/0036).
 *
 * Die Gruppen-/Optionsliste entsteht aus den **Slots des Evaluator-Berichts**
 * unterhalb des Slot-Pfads der Selection (`slots.pathOfSelection` →
 * `slots.slotAt`). Der Aufbau des Abschnittsbaums liegt in
 * `configuratorSections.js`, das Zeilenmodell einer gruppenlosen Zeile in
 * `standaloneRow.js`, die geteilten Zeilen-Ableitungen in
 * `optionRowDerivations.js` und die Budget-Texte in `costBudgets.js`. Hier
 * bleibt, was den Hook ausmacht: die Kontexte, der Rahmen der Selection und die
 * Abschnitte einer belegten Zeile.
 *
 * In dieses ViewModel ist `editor/optionNesting.js` aufgegangen — die Zuordnung
 * Zeile → Roster-Selektion ist eine Ableitung des Konfigurators.
 *
 * @param {{ selection: import('../../../shared/rostermodel/types.js').Selection }} args
 * @returns {{ sections: object[], sectionsForRow: (rowSelectionId: string|null) => object[],
 *   system: Object|null, costTypeLabel: string }}
 */
export function useSelectionConfigurator({ selection }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { subSelectionOperations } = useRosterCommands();
  const { slots } = report;
  const activeCatalogueId = activeCatalogue?.id ?? null;

  return useMemo(() => {
    const costTypeLabel = resolveCostLimitLabel(roster, system);
    const context = {
      slots,
      system,
      activeCatalogueId,
      costTypeId: resolveCostLimitTypeId(roster, system),
      costTypeLabel,
      subSelectionOperations,
    };

    const selectionPath = slots.pathOfSelection(selection.id);
    const sections = selectionPath === undefined ? [] : buildSections(selection, selectionPath, context);

    /**
     * Die Abschnitte einer belegten Zeilen-Auswahl (die Auswahl ist selbst ein
     * Rahmen). Leer, solange die Zeile nicht gewählt ist oder ihr Rahmen keine
     * Abschnitte hat.
     */
    const sectionsForRow = (rowSelectionId) => {
      if (!rowSelectionId) return [];
      const childPath = slots.pathOfSelection(rowSelectionId);
      if (childPath === undefined) return [];
      const childSelection = findSelectionById(selection, rowSelectionId);
      if (!childSelection) return [];
      return buildSections(childSelection, childPath, context);
    };

    return { sections, sectionsForRow, system, costTypeLabel };
  }, [
    selection, roster, system, activeCatalogueId,
    slots, subSelectionOperations,
  ]);
}
