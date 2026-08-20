import { useMemo } from 'react';
import { childSelectionsOf, groupProfilesByType } from '../../roster';
import { isIndependentSubUnitSlot } from '../../evaluation/slotLookups';
import { useRosterCommands, useRosterReport } from '../rosterContexts';

/**
 * ViewModel der Einheitenkarte (ADR-0038).
 *
 * Die Karte reicht nichts mehr durch: Name, Punkte, Profil-Tabellen,
 * Verletzungen, eigenständige Untereinheiten und die beiden Kommandos
 * (Löschen/Kopieren) entstehen hier aus dem Bericht und den Kommandos der
 * beiden Roster-Kontexte. In dieses ViewModel ist auch die frühere
 * `editor/unitCardValidation.js` aufgegangen — die Zuordnung Verletzung →
 * Karte ist eine Ableitung der Karte und gehört zu ihrem Modell.
 */

/**
 * Die Ids aller Selections, die die Karte der übergebenen Selection
 * repräsentiert: die Selection selbst samt Teilbaum, ohne die Teilbäume der
 * direkten Kinder mit eigener Karte.
 *
 * Welches Kind eine eigene Karte bekommt, sagt der Bericht
 * (`capability.isIndependentSubUnit`, Issue 0156) — die Karte löst dafür keinen
 * Katalog-Eintrag mehr auf.
 * @param {import('../../types.js').Selection} selection Wurzel der Karte
 * @param {Map<string, object>|null|undefined} capabilities Slot-Map des Berichts
 * @param {Map<string, string>|null|undefined} pathBySelectionId App-Selection-UUID → Slot-Pfad
 * @returns {Set<string>}
 */
export function collectCardSelectionIds(selection, capabilities, pathBySelectionId) {
  const cardSelectionIds = new Set();
  const addSubtree = (node) => {
    cardSelectionIds.add(node.id);
    childSelectionsOf(node).forEach(addSubtree);
  };
  cardSelectionIds.add(selection.id);
  childSelectionsOf(selection)
    .filter(child => !isIndependentSubUnitSlot(capabilities, pathBySelectionId, child))
    .forEach(addSubtree);
  return cardSelectionIds;
}

/**
 * Die Verletzungen des Evaluator-Berichts, die auf der Karte der übergebenen
 * Selection erscheinen: die, deren `anchor.path` der Slot-Pfad einer Selection
 * des Kartenteilbaums ist. Verletzungen ohne Selection-Anker (Roster-,
 * Kontingent- oder Kategorie-Ebene, synthetische Anker) und missgebildete
 * Einträge fallen heraus.
 * @param {object[]|null|undefined} violations Verletzungen der Evaluator-Fassade
 * @param {Map<string, string>|null|undefined} pathBySelectionId App-Selection-UUID → Slot-Pfad
 * @param {import('../../types.js').Selection} selection Wurzel der Karte
 * @param {Map<string, object>|null|undefined} capabilities Slot-Map des Berichts
 * @returns {object[]}
 */
export function selectionViolationsForCard(violations, pathBySelectionId, selection, capabilities) {
  if (!pathBySelectionId) return [];
  const cardSelectionIds = collectCardSelectionIds(selection, capabilities, pathBySelectionId);
  const cardPaths = new Set();
  for (const selectionId of cardSelectionIds) {
    const path = pathBySelectionId.get(selectionId);
    if (path !== undefined) cardPaths.add(path);
  }
  return (violations ?? []).filter(violation => cardPaths.has(violation?.anchor?.path));
}

/**
 * Die Selection, unter der `childId` im Roster hängt — `null` für eine
 * Wurzel-Auswahl eines Kontingents.
 *
 * Eine Untereinheiten-Karte löscht sich über ihren Träger
 * (`subSelectionOperations.removeInstance(trägerId, eigeneId)`). Die Karte
 * bekommt diesen Träger nicht mehr als Prop gereicht; sie findet ihn im Roster
 * des Kontexts.
 * @param {import('../../types.js').Roster|null|undefined} roster
 * @param {string} childId
 * @returns {string|null}
 */
export function parentSelectionIdOf(roster, childId) {
  const walk = (node) => {
    for (const child of childSelectionsOf(node)) {
      if (child.id === childId) return node.id;
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const force of roster?.forces ?? []) {
    for (const rootSelection of force.selections ?? []) {
      if (rootSelection.id === childId) return null;
      const found = walk(rootSelection);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @param {{ selection: import('../../types.js').Selection, isSubUnit?: boolean }} args
 * @returns {Object} die Anzeigewerte und Kommandos einer Einheitenkarte
 */
export function useUnitCard({ selection, isSubUnit = false }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { removeUnit, copyUnit, subSelectionOperations } = useRosterCommands();
  const { capabilities, pathBySelectionId, violations } = report;

  return useMemo(() => {
    // Der Fähigkeitsdatensatz des Slots dieser Auswahl (ADR-0034): Kosten
    // (`totalCosts`), Name und Profil-Sektion (`infoElements`) kommen aus dem
    // Bericht, aufgelöst über die Zuordnung Selection-UUID → Slot-Pfad.
    const capability = capabilities?.get(pathBySelectionId?.get(selection.id));
    const profileElements = (capability?.infoElements ?? []).filter(element => element.kind === 'profile');
    const parentSelectionId = isSubUnit ? parentSelectionIdOf(roster, selection.id) : null;
    const cardViolations = selectionViolationsForCard(violations, pathBySelectionId, selection, capabilities);

    return {
      capability,
      system,
      activeCatalogueId: activeCatalogue?.id ?? null,
      // Der effektive Name kommt aus dem Slot des Berichts; ohne Slot bleibt der
      // gespeicherte Selektionsname stehen.
      name: capability?.name ?? selection.name,
      count: selection.number ?? 1,
      points: capability?.totalCosts?.[roster?.costLimitType] ?? 0,
      // Mini-Profil aus der Info-Projektion des Berichts, gruppiert nach
      // Profiltyp (Statblock zuerst, weitere Typen als eigene Tabelle).
      profileGroups: groupProfilesByType(profileElements),
      violations: cardViolations,
      hasError: cardViolations.length > 0,
      subUnits: (selection.selections || []).filter(
        subSel => isIndependentSubUnitSlot(capabilities, pathBySelectionId, subSel)
      ),
      // Eine Untereinheit löscht sich über ihren Träger, eine Einheit über das
      // Roster-Kommando; kopieren kann nur eine Einheit.
      remove: () => {
        if (isSubUnit) subSelectionOperations.removeInstance(parentSelectionId, selection.id);
        else removeUnit(selection.id);
      },
      copy: isSubUnit ? null : () => copyUnit(selection.id),
    };
  }, [
    selection, isSubUnit, roster, system, activeCatalogue,
    capabilities, pathBySelectionId, violations,
    removeUnit, copyUnit, subSelectionOperations,
  ]);
}
