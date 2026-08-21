import { useCallback, useMemo, useState } from 'react';
import { saveRoster } from '../services/rosterStore';
import { findForceEntryById, childSelectionsOf } from '../roster';
import { slotOfSelection } from '../evaluation/slotLookups';
import { useEvaluation } from '../evaluation/useEvaluation';
import { costLimitTypeIdOf, extraResourceTotalsOf } from '../evaluation/costDisplays';
import usePlayState from '../hooks/usePlayState';
import { useRuleUrl } from '../hooks/useRuleUrl';
import { useTranslation } from '../i18n/useTranslation';
import { t as translate } from '../i18n/i18nStore';

/**
 * ViewModel der Spielmodus-Hülle (ADR-0038).
 *
 * Bericht, Kopfzeile, Extra-Ressourcen, die nach Kategorie gruppierten und nach
 * Kosten sortierten Einheiten, der Wundenzustand, Tooltip, Detail-Blatt und der
 * Regel-Dialog entstehen hier — der Bildschirm ist danach nur noch JSX.
 */

/**
 * Die Einheiten des Spielmodus, gruppiert nach den Kategorien ihres
 * Kontingents und je Gruppe absteigend nach Gesamtkosten sortiert.
 *
 * Listenregeln sind listenweite Einstellungen, keine Einheiten auf dem
 * Schlachtfeld; welche Auswahl eine ist, sagt der Bericht
 * (`capability.isListRule`, Issue 0156).
 */
export function groupedPlaySelections(system, roster, report, t = translate) {
  const { capabilities, description, pathBySelectionId } = report;
  const groups = [];
  const costType = costLimitTypeIdOf(roster, description?.costTypes);

  const totalCostOf = (selection) =>
    capabilities?.get(pathBySelectionId?.get(selection.id))?.totalCosts?.[costType] ?? 0;
  const sortedByCostDescending = (selections) =>
    [...selections].sort((a, b) => totalCostOf(b) - totalCostOf(a));

  const isBattlefieldSelection = (selection) =>
    slotOfSelection(capabilities, pathBySelectionId, selection)?.isListRule !== true;

  (roster?.forces ?? []).forEach(force => {
    const forceDef = findForceEntryById(system, force.forceEntryId);
    const categoryLinks = forceDef?.categoryLinks || [];

    categoryLinks.forEach(link => {
      const selections = childSelectionsOf(force)
        .filter(s => s.category === link.targetId && isBattlefieldSelection(s));
      if (selections.length === 0) return;

      const categoryDef = system?.categoryEntries?.find(entry => entry.id === link.targetId);
      groups.push({
        id: `${force.id}-${link.targetId}`,
        name: categoryDef ? categoryDef.name : link.name || t('play.unknownCategory'),
        selections: sortedByCostDescending(selections),
      });
    });

    const matchedCategoryIds = new Set(categoryLinks.map(link => link.targetId));
    const uncategorized = childSelectionsOf(force)
      .filter(s => !matchedCategoryIds.has(s.category) && isBattlefieldSelection(s));
    if (uncategorized.length > 0) {
      groups.push({
        id: `${force.id}-uncategorized`,
        name: t('play.otherSelections'),
        selections: sortedByCostDescending(uncategorized),
      });
    }
  });

  return groups;
}

const EMPTY_TOOLTIP = { visible: false, x: 0, y: 0, title: '', content: [] };

/**
 * @param {{
 *   system: object|null,
 *   initialRoster: object,
 *   onReportError?: (message: string) => void,
 * }} args
 */
export function usePlayRoster({ system, initialRoster, onReportError }) {
  const { t, language } = useTranslation();
  const [roster, setRoster] = useState(initialRoster);
  const [saveSummaryOpen, setSaveSummaryOpen] = useState(false);
  const [saveSummaryData, setSaveSummaryData] = useState({ title: '', breakdown: [] });
  const [tooltipState, setTooltipState] = useState(EMPTY_TOOLTIP);
  const [activeRuleDialog, setActiveRuleDialog] = useState(null);

  const report = useEvaluation(system, roster);
  const { getUnitCurrentWounds, handleAdjustWound } =
    usePlayState(initialRoster, setRoster, saveRoster, onReportError);

  // Zentraler Auflöser der whfb6-Verknüpfung (ADR-0015): eine URL nur, wenn die
  // Verknüpfung eingeschaltet ist und eine Zuordnung existiert.
  const resolveRuleUrl = useRuleUrl();

  // Die URL wird beim Öffnen festgehalten statt bei jedem Render neu aufgelöst:
  // ein bereits offener Dialog bleibt so stehen, wenn die Einstellung wechselt.
  const showRule = useCallback((ruleName) => {
    const url = resolveRuleUrl(ruleName);
    if (!url) return;
    setActiveRuleDialog({ ruleName, url });
  }, [resolveRuleUrl]);

  const closeRuleDialog = useCallback(() => setActiveRuleDialog(null), []);

  const showTooltip = useCallback((event, title, content) => {
    if (window.innerWidth <= 900 || content.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipState({ visible: true, x: rect.left, y: rect.bottom + 8, title, content });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipState(state => ({ ...state, visible: false }));
  }, []);

  const closeSaveSummary = useCallback(() => setSaveSummaryOpen(false), []);

  const derived = useMemo(() => {
    const activeCatalogue = system?.catalogues?.find(c => c.id === roster?.catalogueId) ?? null;
    const forceDef = findForceEntryById(system, roster?.forces?.[0]?.forceEntryId);
    const forceSuffix = forceDef ? ` (${forceDef.name})` : '';
    return {
      activeCatalogue,
      // Untertitel der Kopfzeile: Systemname, dann — falls ein Katalog aktiv
      // ist — dessen Name samt Kontingent.
      systemLabel: `${system?.name ?? ''} ${activeCatalogue ? '· ' : ''}`,
      catalogueLabel: activeCatalogue ? `${activeCatalogue.name}${forceSuffix}` : '',
      // Die Extra-Ressourcen des Kopfes sind alle Nicht-Limit-Kostenarten mit
      // Summe ≠ 0 (Issue 0121, Task 7).
      extraResources: extraResourceTotalsOf(
        report.costTotals, report.description?.costTypes, roster?.costLimitType),
      groups: groupedPlaySelections(system, roster, report, t),
    };
  }, [system, roster, report, t, language]);

  return {
    roster,
    report,
    costTypes: report.description?.costTypes,
    ...derived,
    getUnitCurrentWounds,
    adjustWound: handleAdjustWound,
    tooltipState,
    showTooltip,
    hideTooltip,
    saveSummaryOpen,
    saveSummaryData,
    // Die Karte füllt das Detail-Blatt selbst; die Hülle rendert es nur.
    setSaveSummaryData,
    setSaveSummaryOpen,
    closeSaveSummary,
    activeRuleDialog,
    showRule,
    closeRuleDialog,
  };
}
