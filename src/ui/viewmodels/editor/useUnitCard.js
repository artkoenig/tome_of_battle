import { useMemo } from 'react';
import { childSelectionsOf, groupProfilesByType } from '../../../domain/roster';
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

// Darstellung einer Profil-Zelle. Die frühere `components/profileCellClasses.js`
// ist hier aufgegangen: welche Hervorhebung eine geänderte Eigenschaft bekommt,
// ist eine Ableitung der Karte, nicht ihr JSX. `usePlayUnit` liest dieselbe
// Ableitung von hier — die Profil-Tabelle des Editors und die der Spielansicht
// können so nicht auseinanderlaufen, und die Farben bleiben in der Stil-Ebene
// (ADR-0004).
const BASE_PROFILE_CELL_CLASS = 'font-body';

const CLASSES_BY_MODIFICATION_STATE = {
  positive: 'text-success profile-cell--positive',
  negative: 'text-danger profile-cell--negative',
  modified: 'text-gold profile-cell--modified',
};

const numericValueOf = (value) => {
  const match = String(value ?? '').match(/-?\d+/);
  return match ? parseInt(match[0], 10) : null;
};

/**
 * Der Änderungszustand einer Eigenschaft: `null`, wenn der Bericht keinen
 * Ursprungswert kennt oder der Wert unverändert ist.
 * @param {{ value?: string, originalValue?: string }|null|undefined} characteristic
 * @returns {'positive'|'negative'|'modified'|null}
 */
function modificationStateOf(characteristic) {
  if (!characteristic || characteristic.originalValue === undefined) return null;
  if (characteristic.value === characteristic.originalValue) return null;

  const valueNumber = numericValueOf(characteristic.value);
  const originalNumber = numericValueOf(characteristic.originalValue);
  if (valueNumber !== null && originalNumber !== null) {
    if (valueNumber > originalNumber) return 'positive';
    if (valueNumber < originalNumber) return 'negative';
  }
  return 'modified';
}

/**
 * Die Anzeigewerte einer Profil-Zelle: Klassenname und — nur wenn es etwas zu
 * erklären gibt — die Auflistung der Änderungen. `breakdown: null` heißt: kein
 * Tooltip, kein Detail-Blatt.
 * @param {{ value?: string, originalValue?: string, modificationBreakdown?: string[] }|null|undefined} characteristic
 * @returns {{ modificationState: string|null, className: string, breakdown: string[]|null }}
 */
export function profileCellDisplayOf(characteristic) {
  const modificationState = modificationStateOf(characteristic);
  const stateClasses = CLASSES_BY_MODIFICATION_STATE[modificationState];
  const breakdown = characteristic?.modificationBreakdown ?? [];
  return {
    modificationState,
    className: stateClasses ? `${BASE_PROFILE_CELL_CLASS} ${stateClasses}` : BASE_PROFILE_CELL_CLASS,
    breakdown: modificationState && breakdown.length > 0 ? breakdown : null,
  };
}

/**
 * Die Ids aller Selections, die die Karte der übergebenen Selection
 * repräsentiert: die Selection selbst samt Teilbaum, ohne die Teilbäume der
 * direkten Kinder mit eigener Karte.
 *
 * Welches Kind eine eigene Karte bekommt, sagt der Bericht
 * (`capability.isIndependentSubUnit`, Issue 0156) — die Karte löst dafür keinen
 * Katalog-Eintrag mehr auf.
 * @param {import('../../../shared/rostermodel/types.js').Selection} selection Wurzel der Karte
 * @param {import('../../../domain/evaluation/slotIndex.js').SlotIndex} slots Slot-Seite des Berichts
 * @returns {Set<string>}
 */
export function collectCardSelectionIds(selection, slots) {
  const cardSelectionIds = new Set();
  const addSubtree = (node) => {
    cardSelectionIds.add(node.id);
    childSelectionsOf(node).forEach(addSubtree);
  };
  cardSelectionIds.add(selection.id);
  childSelectionsOf(selection)
    .filter(child => !slots.isIndependentSubUnitSlot(child))
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
 * @param {import('../../../domain/evaluation/slotIndex.js').SlotIndex} slots Slot-Seite des Berichts
 * @param {import('../../../shared/rostermodel/types.js').Selection} selection Wurzel der Karte
 * @returns {object[]}
 */
export function selectionViolationsForCard(violations, slots, selection) {
  const cardSelectionIds = collectCardSelectionIds(selection, slots);
  const cardPaths = new Set();
  for (const selectionId of cardSelectionIds) {
    const path = slots.pathOfSelection(selectionId);
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
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} roster
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
 * @param {{ selection: import('../../../shared/rostermodel/types.js').Selection, isSubUnit?: boolean }} args
 * @returns {Object} die Anzeigewerte und Kommandos einer Einheitenkarte
 */
export function useUnitCard({ selection, isSubUnit = false }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { removeUnit, copyUnit, subSelectionOperations } = useRosterCommands();
  const { slots, violations } = report;

  return useMemo(() => {
    // Der Fähigkeitsdatensatz des Slots dieser Auswahl (ADR-0034): Kosten
    // (`totalCosts`), Name und Profil-Sektion (`infoElements`) kommen aus dem
    // Bericht, aufgelöst über die Zuordnung Selection-UUID → Slot-Pfad.
    const capability = slots.slotOfSelection(selection);
    const profileElements = (capability?.infoElements ?? []).filter(element => element.kind === 'profile');
    const parentSelectionId = isSubUnit ? parentSelectionIdOf(roster, selection.id) : null;
    const cardViolations = selectionViolationsForCard(violations, slots, selection);

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
      // Die Zellen-Darstellung reicht das ViewModel als Funktion durch, damit
      // die Karte selbst nichts mehr aus einer Eigenschaft ableitet.
      profileCellOf: profileCellDisplayOf,
      violations: cardViolations,
      hasError: cardViolations.length > 0,
      subUnits: (selection.selections || []).filter(
        subSel => slots.isIndependentSubUnitSlot(subSel)
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
    slots, violations,
    removeUnit, copyUnit, subSelectionOperations,
  ]);
}
