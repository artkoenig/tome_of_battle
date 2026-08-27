import { useCallback, useMemo, useRef, useState } from 'react';
import { findForceEntryById } from '../../contexts/armylist/model';
import { evaluateAppRoster, describeSystem, costLimitLabelOf } from '../../contexts/ruleengine/readmodel/index.js';
import { useTranslation } from '../i18n/useTranslation';
import { EMPTY_ROSTER_FILTER, matchesRosterFilter } from './rosterFilter';

/**
 * ViewModel der Bibliotheks-Hülle (ADR-0038).
 *
 * Die Gruppierung nach Fraktion, die Kartenwerte und der Umbenenn-/Aktions-
 * Zustand entstehen hier. Entscheidend ist die Stelle der Auswertung:
 * `evaluateAppRoster` lief zuvor **innerhalb** der Map-Schleife des Renders und
 * damit bei jedem Tastendruck im Umbenennen-Feld erneut für jede Liste. Hier
 * läuft sie genau einmal je Roster-/System-Stand — ein Render ohne
 * Datenänderung wertet nichts erneut aus, ein Filterwechsel ebenso wenig: die
 * Karten entstehen in einem eigenen Memo **vor** dem Filtern (Issue 0203).
 */

/**
 * Eine Karte je Liste, mit dem Namen der Fraktion, unter der sie steht.
 * Die Gruppierung nach Spielsystem ist mit Issue 0203 entfallen.
 */
function cardsOf(rosters, systems, t) {
  const noFactionLabel = t('dashboard.noFaction');

  return rosters.map(roster => {
    const system = systems.find(s => s.id === roster.systemId);
    const catalogue = system?.catalogues?.find(c => c.id === roster.catalogueId);

    // Kartenkosten aus dem Evaluator-Bericht, das Limit-Label aus der
    // Datensatz-Beschreibung (Issue 0121, Task 7); der Katalog-Vorlauf ist je
    // System-Objekt gecacht (evaluationCache).
    const { costTotals } = evaluateAppRoster(system, roster);
    const forceDef = system ? findForceEntryById(system, roster.forces?.[0]?.forceEntryId) : null;

    return {
      roster,
      factionName: catalogue ? catalogue.name : noFactionLabel,
      currentPoints: costTotals[roster.costLimitType] || 0,
      costLimit: roster.costLimit,
      costTypeLabel: costLimitLabelOf(roster, describeSystem(system)?.costTypes),
      forceName: forceDef ? forceDef.name : null,
    };
  });
}

/**
 * Die passenden Karten, nach Fraktion gruppiert und alphabetisch — die
 * Sammelgruppe „ohne Armeebuch“ steht ans Ende. Eine Fraktion, von der der
 * Filter keine Karte übrig lässt, kommt gar nicht vor.
 */
function groupByFaction(cards, filter, noFactionLabel) {
  /** @type {Array<{factionName: string, cards: object[]}>} */
  const groups = [];
  cards
    .filter(card => matchesRosterFilter(card.roster, filter))
    .forEach(card => {
      const group = groups.find(candidate => candidate.factionName === card.factionName);
      if (group) group.cards.push(card);
      else groups.push({ factionName: card.factionName, cards: [card] });
    });

  return groups.sort((a, b) => {
    if (a.factionName === noFactionLabel) return 1;
    if (b.factionName === noFactionLabel) return -1;
    return a.factionName.localeCompare(b.factionName);
  });
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
 *   filter?: { systemIds: string[], factionIds: string[] },
 * }} args
 */
export function useRosterDashboard({
  rosters = [],
  systems = [],
  onRenameRoster,
  onImportRoster,
  onExportRoster,
  onDeleteRoster,
  filter = EMPTY_ROSTER_FILTER,
} = {}) {
  const { t, language } = useTranslation();
  /** @type {import('react').RefObject<HTMLInputElement|null>} */
  const fileInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);
  const [rosterActionsRosterId, setRosterActionsRosterId] = useState(NO_ROSTER_ACTIONS);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Ein Bericht je Liste, gerechnet wenn sich Listen oder Systeme ändern —
  // nicht bei jedem Render der Hülle und nicht bei einem Filterwechsel.
  const cards = useMemo(
    () => cardsOf(rosters, systems, t),
    [rosters, systems, t, language]
  );

  const factionGroups = useMemo(
    () => groupByFaction(cards, filter, t('dashboard.noFaction')),
    [cards, filter, t, language]
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
    factionGroups,
    // Keine einzige Liste — der Erststart-Zustand. Ein Filter, der nichts
    // trifft, ist etwas anderes und bekommt seine eigene Meldung (AC6).
    isEmpty: rosters.length === 0,
    hasNoMatches: rosters.length > 0 && factionGroups.length === 0,
    isFilterPanelOpen,
    openFilterPanel: useCallback(() => setIsFilterPanelOpen(true), []),
    closeFilterPanel: useCallback(() => setIsFilterPanelOpen(false), []),
    toggleFilterPanel: useCallback(() => setIsFilterPanelOpen(open => !open), []),
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
