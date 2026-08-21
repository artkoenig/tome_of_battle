import { useMemo } from 'react';

import { isBlockingViolation, hasBlockingViolations, countBlockingViolations } from '../../../domain/evaluation/violationStats';
import { extraResourceTotalsOf } from '../../../domain/evaluation/costDisplays';
import { useRosterReport } from '../rosterContexts';

/**
 * Der **Lagerbericht** des Editors (Issue 0164): Gesamtstatus der Liste, die
 * blockierenden Verletzungen des Evaluator-Berichts, die rein informativen
 * Hinweise des Katalogautors (warning/info) und die zusätzlichen
 * Ressourcen-Summen.
 *
 * Blockierend — und damit „Spielen gesperrt" — ist allein severity `error`
 * (`violationStats.js`). Dazu kommt der eine Datensatz-Befund, den der Nutzer
 * handhaben kann: eine Auswahl, deren Definition der Katalog nicht mehr kennt.
 * Sie ist keine Regelverletzung, sondern eine Diagnose — ohne Meldung
 * verschwände sie stumm aus der Bewertung (`unresolvedSelections`).
 *
 * @returns {{ isRosterValid: boolean, blockingCount: number,
 *   blockingViolations: Array<Object>, advisoryViolations: Array<Object>,
 *   unresolvedSelections: Array<Object>, extraResources: Array<Object> }}
 */
export function useValidationPanel() {
  const { report, roster } = useRosterReport();

  return useMemo(() => {
    // Bewusst ohne Rueckfall: eine fehlende Verletzungsliste ist ein kaputter
    // Bericht, kein leerer — sie faellt hier laut auf, statt still als „alles in
    // Ordnung" zu erscheinen (`RosterEditor.test.jsx` haelt den Fall fest).
    const violations = report.violations;
    const unresolvedSelections = report?.unresolvedSelections ?? [];
    return {
      blockingViolations: violations.filter(isBlockingViolation),
      advisoryViolations: violations.filter(violation => !isBlockingViolation(violation)),
      blockingCount: countBlockingViolations(violations),
      isRosterValid: !hasBlockingViolations(violations) && unresolvedSelections.length === 0,
      unresolvedSelections,
      extraResources: extraResourceTotalsOf(
        report?.costTotals, report?.description?.costTypes, roster?.costLimitType),
    };
  }, [report, roster]);
}
