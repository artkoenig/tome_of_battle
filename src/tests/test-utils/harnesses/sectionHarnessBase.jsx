import React from 'react';

import { RosterProviders, createEmptyRosterReport, createNoopRosterCommands } from '../rosterProviders';

/**
 * Gemeinsame Teile der Prüfstände für die **Sektionsebene** (Issue 0164).
 *
 * Kontingent-Sektion, Kategorie-Sektion, Ankreuzliste, Aushebe-Dialog,
 * Auffüll-Vorschläge, Seitenleiste und Prüf-Panel rechnen seit Issue 0164 in
 * ihrem ViewModel und lesen dafür aus den beiden Kontexten. Die Hüllen nehmen
 * den **alten**, flachen Prop-Satz entgegen und bauen daraus den Bericht, den
 * die ViewModels erwarten — auch die abgeleiteten Angaben: `costTypeLabel`
 * wird zu einer Kostenart-Deklaration im Spielsystem, `remainingPoints` zu
 * Punktgrenze und Kostensumme, `extraResources` zu Kostenarten der
 * Datensatz-Beschreibung.
 *
 * Jede Hülle steht in ihrer **eigenen** Datei: ein Testmodul, das
 * `lucide-react` nur teilweise nachbildet, würde sonst an den Symbolen einer
 * Komponente scheitern, die es gar nicht rendert.
 */

/** Nur die gesetzten Felder — `undefined` würde den Leerbericht überschreiben. */
const definedOnly = (fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

export function withProviders({ report, roster, system, activeCatalogue, commands, children }) {
  return (
    <RosterProviders
      report={createEmptyRosterReport(definedOnly(report))}
      roster={roster ?? null}
      system={system ?? null}
      activeCatalogue={activeCatalogue ?? null}
      commands={createNoopRosterCommands(definedOnly(commands))}
    >
      {children}
    </RosterProviders>
  );
}

/** Ein Spielsystem, dessen Limit-Kostenart `costTypeLabel` heißt. */
export const systemNaming = (system, costLimitType, costTypeLabel) => {
  if (costTypeLabel === undefined || costTypeLabel === null) return system ?? null;
  const typeId = costLimitType ?? system?.costTypes?.[0]?.id ?? 'pts';
  const declared = (system?.costTypes ?? []).filter(type => type.id !== typeId);
  return { ...(system ?? {}), costTypes: [{ id: typeId, name: costTypeLabel }, ...declared] };
};

/** Kostenarten + Summen, die `extraResourceTotalsOf` als Extra-Ressourcen liest. */
export const describeExtras = (extraResources) => {
  const costTypes = (extraResources ?? []).map(res => ({ id: res.id, name: res.name, isHidden: false }));
  const costTotals = Object.fromEntries((extraResources ?? []).map(res => [res.id, res.total]));
  return { costTypes, costTotals };
};

/**
 * Punktgrenze und Kostensumme, aus denen das ViewModel `remainingPoints`
 * wieder ausrechnet (`costLimit - costTotals[costLimitType]`).
 */
export const budgetFor = (roster, remainingPoints) => {
  if (remainingPoints === undefined || remainingPoints === null) return { roster, spent: null };
  const limit = roster?.costLimit || Math.max(remainingPoints, 0) + 100;
  return { roster: { ...(roster ?? {}), costLimit: limit }, spent: limit - remainingPoints };
};

