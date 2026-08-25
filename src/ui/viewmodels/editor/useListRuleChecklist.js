import { useMemo } from 'react';

import { unitsOfForce } from '../../../contexts/armylist/model';
import { capabilityEntryOf } from '../capabilityEntries';
import { EMPTY_SLOT_INDEX, resolveListRuleGroupFromReport } from '../../../contexts/ruleengine/readmodel/index.js';
import { useRosterReport, useRosterCommands } from '../rosterContexts';
import { upgradeDetailElementsOf } from './upgradeDetailElements.js';

/**
 * Die **Ankreuzliste der Listenregeln** einer Kategorie (Issue 0164).
 *
 * Der Bericht sagt, welche Regeln die Kategorie unter diesem Kontingent
 * anbietet und welche davon angehakt sind (`listRuleGroups.js`, Issue 0156);
 * hier wird daraus die Zeilenliste, die `ListRuleChecklist` nur noch abbildet:
 * je Zeile Name, Zustand, Sperre und die beiden Schreib-Aktionen.
 *
 * Die Sperre einer eindeutigen Pflicht-Listenregel folgt ihrer **Präsenz**
 * (Issue 0140, Kriterium 4): gesperrt ist sie nur, solange sie tatsächlich im
 * Roster steht. Fehlt sie, bleibt die Zeile ankreuzbar, damit der sonst
 * blockierende Fehler von Hand behebbar ist. Der Pflicht-Hinweis hängt nicht an
 * der Sperre und erscheint in beiden Zuständen.
 *
 * Der Detailblock einer Pflichtzeile (`detailElements`) entsteht hier, aus der
 * Info-Projektion ihres Slots (`capability.infoElements`, ADR-0034); die
 * Komponente rendert die fertige Liste, weil `upgradeDetails.jsx` JSX
 * zurückgibt und ein ViewModel es nicht importieren darf.
 *
 * @param {{ forceId: string|null, forcePath: string|null, categoryId: string }} params
 * @returns {{ rows: Array<Object>, isListRuleGroup: boolean, system: Object|null }}
 */
export function useListRuleChecklist({ forceId = null, forcePath = null, categoryId }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { addUnit, removeUnit } = useRosterCommands();
  const slots = report?.slots ?? EMPTY_SLOT_INDEX;
  const force = useMemo(
    () => roster?.forces?.find(candidate => candidate.id === forceId) ?? null,
    [roster, forceId]
  );

  const { isListRuleGroup, states } = useMemo(() => {
    const selectionByPath = new Map();
    for (const selection of unitsOfForce(force)) {
      const path = slots.pathOfSelection(selection.id);
      if (path !== undefined) selectionByPath.set(path, selection);
    }
    return resolveListRuleGroupFromReport(slots, forcePath, categoryId, {
      selectionByPath,
      entryOf: (capability) => capabilityEntryOf(system, capability, activeCatalogue?.id),
      detailsOf: (capability) => upgradeDetailElementsOf(capability),
    });
  }, [force, slots, forcePath, categoryId, system, activeCatalogue]);

  const rows = useMemo(() => states.map(state => {
    const isLocked = state.mandatory && state.checked;
    return {
      key: state.resolvedId,
      resolvedId: state.resolvedId,
      name: state.name,
      entry: state.entry,
      selection: state.selection,
      checked: state.checked,
      isBinary: state.isBinary,
      isContainer: state.isContainer,
      mandatory: state.mandatory,
      isLocked,
      // Eine Behälter-Zeile zeigt ihre Unteroptionen erst, wenn sie angehakt ist
      // und im Roster tatsächlich eine Auswahl dazu steht.
      hasSubOptions: state.checked && state.isContainer && !!state.selection,
      // Der Detailblock einer Pflichtzeile — die Komponente rendert ihn.
      detailElements: state.mandatory ? state.details : null,
      toggle: (nextChecked) => {
        // Der disabled-Zustand der Checkbox verhindert das Abwählen einer
        // präsenten Pflichtregel schon auf DOM-Ebene; dieser Guard hält die
        // Regel auch gegen einen programmatischen Aufruf ein.
        if (isLocked) return;
        if (nextChecked) {
          addUnit(state.entry, categoryId, forceId);
        } else if (state.selection) {
          removeUnit(state.selection.id);
        }
      },
    };
  }), [states, system, activeCatalogue, addUnit, removeUnit, categoryId, forceId]);

  return { rows, isListRuleGroup, system };
}
