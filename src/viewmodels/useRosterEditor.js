import { useCallback, useMemo, useState } from 'react';
import { saveRoster } from '../services/rosterStore';
import { resolveCostLimitLabel } from '../roster';
import { useRuleUrl } from '../hooks/useRuleUrl';
import { useRosterState } from './useRosterState';

/**
 * ViewModel der Editor-Hülle (ADR-0038).
 *
 * Der Bildschirm hält danach keinen abgeleiteten Wert mehr: der Zustandsknoten
 * (`useRosterState`), der aktive Katalog, die Kosten-Anzeigen, der
 * Ausklapp-Zustand der Listenregel-Gruppen, der Regel-Dialog und die beiden
 * Kommandos der Kopfzeile entstehen hier.
 */

const ruleGroupKeyOf = (forceId, categoryId) => `${forceId}:${categoryId}`;

/**
 * @param {{
 *   system: object|null,
 *   initialRoster: object,
 *   onPlay: (roster: object) => void,
 *   onExportRoster?: (roster: object) => void,
 *   onReportError?: (message: string) => void,
 *   isFreshRoster?: boolean,
 * }} args
 */
export function useRosterEditor({ system, initialRoster, onPlay, onExportRoster, onReportError, isFreshRoster }) {
  const {
    roster,
    report,
    selectedRosterSelection,
    setSelectedRosterSelection,
    commands,
    canUndo,
    canRedo,
  } = useRosterState(initialRoster, system, saveRoster, onReportError, isFreshRoster);

  // Listenregel-Gruppen sind ausklappbar und **standardmäßig eingeklappt**. Wir
  // verfolgen daher die (pro force+Kategorie) ausdrücklich AUSGEKLAPPTEN
  // Gruppen; ein leeres Set bedeutet: alle eingeklappt.
  const [expandedRuleGroups, setExpandedRuleGroups] = useState(() => new Set());
  const [activeRuleDialog, setActiveRuleDialog] = useState(null);

  const isRuleGroupExpanded = useCallback(
    (forceId, categoryId) => expandedRuleGroups.has(ruleGroupKeyOf(forceId, categoryId)),
    [expandedRuleGroups]
  );
  const toggleRuleGroup = useCallback((forceId, categoryId) => {
    const groupKey = ruleGroupKeyOf(forceId, categoryId);
    setExpandedRuleGroups(previous => {
      const next = new Set(previous);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  }, []);

  // Ein Bündel statt zweier Props: die Sektion reicht es unverändert an ihre
  // Kategorie-Gruppen weiter und wertet es selbst nie aus.
  const ruleGroups = useMemo(
    () => ({ isExpanded: isRuleGroupExpanded, onToggle: toggleRuleGroup }),
    [isRuleGroupExpanded, toggleRuleGroup]
  );

  const resolveRuleUrl = useRuleUrl();

  // Die URL wird beim Öffnen festgehalten statt bei jedem Render neu aufgelöst:
  // ein bereits offener Dialog bleibt so stehen, wenn die Einstellung wechselt.
  const showRule = useCallback((ruleName) => {
    const url = resolveRuleUrl(ruleName);
    if (!url) return;
    setActiveRuleDialog({ ruleName, url });
  }, [resolveRuleUrl]);

  const closeRuleDialog = useCallback(() => setActiveRuleDialog(null), []);

  const playRoster = useCallback(() => onPlay(roster), [onPlay, roster]);
  const exportRoster = useCallback(() => onExportRoster?.(roster), [onExportRoster, roster]);

  const derived = useMemo(() => {
    const costTypeLabel = resolveCostLimitLabel(roster, system);
    return {
      // Der aktive Katalog ist eine Ableitung aus System und Roster, kein
      // nachgezogener Zustand: er steht damit schon im ersten Render.
      activeCatalogue: system?.catalogues?.find(c => c.id === roster?.catalogueId) ?? null,
      costTypeLabel,
      // Kosten-Anzeigen aus dem Bericht (Issue 0121, Task 7): der Ist-Stand ist
      // die roster-weite Kostensumme der Limit-Kostenart.
      currentPoints: report.costTotals[roster.costLimitType] || 0,
      limitPoints: roster.costLimit || 0,
      // Der Slot-Pfad eines Kontingents kommt aus der Zuordnung des Berichts,
      // nie aus dem Schleifenindex (Issue 0164, Task 21).
      forces: roster.forces.map(force => ({
        force,
        forcePath: report.slots.pathOfForce(force.id),
      })),
    };
  }, [roster, system, report]);

  // Was der Karte bleibt, seit ihr ViewModel den Bericht selbst liest: der
  // Auswahl-Zustand der Oberfläche und der Regel-Kanal.
  const unitCardContext = useMemo(() => ({
    selectedRosterSelection,
    setSelectedRosterSelection,
    costTypeLabel: derived.costTypeLabel,
    onShowRule: showRule,
  }), [selectedRosterSelection, setSelectedRosterSelection, derived.costTypeLabel, showRule]);

  return {
    roster,
    report,
    system,
    commands,
    undo: commands.undo,
    redo: commands.redo,
    canUndo,
    canRedo,
    ...derived,
    ruleGroups,
    unitCardContext,
    activeRuleDialog,
    showRule,
    closeRuleDialog,
    playRoster,
    exportRoster,
  };
}
