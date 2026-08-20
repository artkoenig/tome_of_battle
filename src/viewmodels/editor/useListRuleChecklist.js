import { useMemo } from 'react';

import { childSelectionsOf, findEntryInSystem, resolveEntry } from '../../roster';
import { resolveListRuleGroupFromReport } from '../../evaluation/listRuleGroups';
import { useRosterReport, useRosterCommands } from '../rosterContexts';

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
 * Der aufgelöste Katalog-Eintrag einer Pflichtzeile (`resolvedEntry`) geht
 * roh nach draußen: den Detailblock daraus baut die Komponente, weil
 * `upgradeDetails.jsx` JSX zurückgibt und ein ViewModel es nicht importieren darf.
 *
 * @param {{ forceId: string|null, forcePath: string|null, categoryId: string }} params
 * @returns {{ rows: Array<Object>, isListRuleGroup: boolean, system: Object|null }}
 */
export function useListRuleChecklist({ forceId = null, forcePath = null, categoryId }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { addUnit, removeUnit } = useRosterCommands();
  const capabilities = report?.capabilities;
  const pathBySelectionId = report?.pathBySelectionId;
  const force = useMemo(
    () => roster?.forces?.find(candidate => candidate.id === forceId) ?? null,
    [roster, forceId]
  );

  const { isListRuleGroup, states } = useMemo(() => {
    const selectionByPath = new Map();
    for (const selection of childSelectionsOf(force)) {
      const path = pathBySelectionId?.get(selection.id);
      if (path !== undefined) selectionByPath.set(path, selection);
    }
    return resolveListRuleGroupFromReport(capabilities, forcePath, categoryId, {
      selectionByPath,
      entryOf: (capability) => findEntryInSystem(system, capability.defId, activeCatalogue?.id)
        ?? { id: capability.defId, name: capability.name },
    });
  }, [force, pathBySelectionId, capabilities, forcePath, categoryId, system, activeCatalogue]);

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
      resolvedEntry: state.mandatory ? resolveEntry(system, state.entry, activeCatalogue?.id) : null,
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
