import { useCallback, useMemo, useRef, useState } from 'react';
import { findForceEntryById } from '../../domain/roster';
import { evaluateAppRoster, describeSystem, costLimitLabelOf } from '../../contexts/ruleengine/readmodel/index.js';
import { useTranslation } from '../i18n/useTranslation';

/**
 * ViewModel der Bibliotheks-Hülle (ADR-0038).
 *
 * Die Gruppierung nach Spielsystem und Armeebuch, die Kartenwerte und der
 * Umbenenn-/Aktions-Zustand entstehen hier. Entscheidend ist die Stelle der
 * Auswertung: `evaluateAppRoster` lief zuvor **innerhalb** der Map-Schleife des
 * Renders und damit bei jedem Tastendruck im Umbenennen-Feld erneut für jede
 * Liste. Hier läuft sie genau einmal je Roster-/System-Stand — ein Render ohne
 * Datenänderung wertet nichts erneut aus.
 */

/**
 * Die Karten der Bibliothek, gruppiert nach Spielsystem und Armeebuch, je
 * Ebene alphabetisch — die Sammelgruppen „unbekannt“ und „ohne Armeebuch“
 * stehen ans Ende.
 */
function groupCards(rosters, systems, t) {
  const unknownSystemLabel = t('dashboard.unknownSystem');
  const noFactionLabel = t('dashboard.noFaction');

  const bySystemAndFaction = new Map();
  rosters.forEach(roster => {
    const system = systems.find(s => s.id === roster.systemId);
    const systemName = system ? system.name : unknownSystemLabel;
    const catalogue = system?.catalogues?.find(c => c.id === roster.catalogueId);
    const factionName = catalogue ? catalogue.name : noFactionLabel;

    // Kartenkosten aus dem Evaluator-Bericht, das Limit-Label aus der
    // Datensatz-Beschreibung (Issue 0121, Task 7); der Katalog-Vorlauf ist je
    // System-Objekt gecacht (evaluationCache).
    const { costTotals } = evaluateAppRoster(system, roster);
    const forceDef = system ? findForceEntryById(system, roster.forces?.[0]?.forceEntryId) : null;

    const card = {
      roster,
      currentPoints: costTotals[roster.costLimitType] || 0,
      costLimit: roster.costLimit,
      costTypeLabel: costLimitLabelOf(roster, describeSystem(system)?.costTypes),
      forceName: forceDef ? forceDef.name : null,
    };

    if (!bySystemAndFaction.has(systemName)) bySystemAndFaction.set(systemName, new Map());
    const factions = bySystemAndFaction.get(systemName);
    if (!factions.has(factionName)) factions.set(factionName, []);
    factions.get(factionName).push(card);
  });

  const sortedNames = (names, lastName) => [...names].sort((a, b) => {
    if (a === lastName) return 1;
    if (b === lastName) return -1;
    return a.localeCompare(b);
  });

  return sortedNames(bySystemAndFaction.keys(), unknownSystemLabel).map(systemName => ({
    systemName,
    factions: sortedNames(bySystemAndFaction.get(systemName).keys(), noFactionLabel).map(factionName => ({
      factionName,
      cards: bySystemAndFaction.get(systemName).get(factionName),
    })),
  }));
}

/**
 * Kein Aktions-Blatt offen. Als Literal im `useState` faellt `null` auf den Typ `null`.
 *
 * @type {string|null}
 */
const NO_ROSTER_ACTIONS = null;

/**
 * @param {{
 *   rosters?: object[],
 *   systems?: object[],
 *   onRenameRoster?: (roster: object, name: string) => void,
 *   onImportRoster?: (file: File) => void,
 *   onExportRoster?: (roster: object) => void,
 *   onDeleteRoster?: (rosterId: string, event: object) => void,
 * }} args
 */
export function useRosterDashboard({
  rosters = [],
  systems = [],
  onRenameRoster,
  onImportRoster,
  onExportRoster,
  onDeleteRoster,
} = {}) {
  const { t, language } = useTranslation();
  /** @type {import('react').RefObject<HTMLInputElement|null>} */
  const fileInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);
  const [rosterActionsRosterId, setRosterActionsRosterId] = useState(NO_ROSTER_ACTIONS);

  // Ein Bericht je Liste, gerechnet wenn sich Listen oder Systeme ändern —
  // nicht bei jedem Render der Hülle.
  const systemGroups = useMemo(
    () => groupCards(rosters, systems, t),
    [rosters, systems, t, language]
  );

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const pickImportFile = useCallback((event) => {
    const file = event.target.files?.[0];
    if (file && onImportRoster) onImportRoster(file);
    event.target.value = '';
  }, [onImportRoster]);

  const startEditing = useCallback((roster, event) => {
    event.stopPropagation();
    setEditName(roster.name);
    setEditingId(roster.id);
  }, []);

  const finishEditing = useCallback((roster) => {
    onRenameRoster?.(roster, editName);
    setEditingId(null);
  }, [onRenameRoster, editName]);

  const handleTitleKeyDown = useCallback((event, roster) => {
    if (event.key === 'Enter') finishEditing(roster);
    else if (event.key === 'Escape') setEditingId(null);
  }, [finishEditing]);

  const exportFromSheet = useCallback(() => {
    const roster = rosters.find(r => r.id === rosterActionsRosterId);
    if (roster) onExportRoster?.(roster);
    setRosterActionsRosterId(null);
  }, [rosters, rosterActionsRosterId, onExportRoster]);

  const deleteFromSheet = useCallback(() => {
    const id = rosterActionsRosterId;
    setRosterActionsRosterId(null);
    if (id === null) return;
    onDeleteRoster?.(id, { stopPropagation() {} });
  }, [rosterActionsRosterId, onDeleteRoster]);

  return {
    systemGroups,
    isEmpty: rosters.length === 0,
    fileInputRef,
    openFilePicker,
    pickImportFile,
    editingId,
    editName,
    setEditName,
    startEditing,
    finishEditing,
    handleTitleKeyDown,
    isActionsSheetOpen,
    openActionsSheet: useCallback(() => setIsActionsSheetOpen(true), []),
    closeActionsSheet: useCallback(() => setIsActionsSheetOpen(false), []),
    rosterActionsRosterId,
    isRosterActionsSheetOpen: rosterActionsRosterId !== null,
    openRosterActions: useCallback((rosterId) => setRosterActionsRosterId(rosterId), []),
    closeRosterActions: useCallback(() => setRosterActionsRosterId(null), []),
    exportFromSheet,
    deleteFromSheet,
  };
}
