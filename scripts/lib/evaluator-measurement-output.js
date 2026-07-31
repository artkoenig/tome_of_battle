/**
 * Die **Ausgabe** der Aufwandsmessung: ein Fall, seine Abschnitte, sein Urteil
 * gegen die vorab festgelegten Schwellen.
 *
 * Eigenes Modul, weil zwei Messlaeufe dieselbe Darstellung brauchen — der in Node
 * (jsdom als XML-Leser) und der im echten Browser (nativer `DOMParser`). Der
 * Browser-Lauf stellt beide **nebeneinander**, deshalb nimmt {@link printCase}
 * nicht eine, sondern eine geordnete Liste benannter Messreihen entgegen; ein
 * einzelner Lauf ist der Sonderfall mit genau einer Spalte.
 *
 * Kein Produktivcode: nichts unter `src/` importiert dieses Modul.
 */

// Beide Namen kommen aus der Fassade: die Abschnitte, die die Engine ausweist,
// und die Diagnose-Arten, die ihr Bericht traegt. Die Ausgabe benennt damit, was
// sie liest, statt es zu kennen (Issue 0138).
import { DiagnosticKind, MeasuredPhase } from '../../src/evaluator/evaluator.js';
import {
  INTERACTIVE_BUDGET_MS,
  TWO_STAGE_PREPARATION_SHARE,
  assessThresholds,
} from './evaluator-measurement.js';

/** Klartext-Bezeichnung je gemessenem Abschnitt, in der Reihenfolge der Auswertung. */
const PHASE_LABELS = Object.freeze([
  [MeasuredPhase.PREPARATION, 'Vorbereitung des Datensatzes'],
  [MeasuredPhase.ITERATED_EVALUATION, 'Iterierte Auswertung'],
  [MeasuredPhase.POST_PASS, 'Nach-Durchlauf'],
  [MeasuredPhase.CONSTRAINTS_AND_REPORT, 'Grenzen und Bericht'],
]);

/** Spaltenbreiten der Tabelle — eine Stelle, an der sich die Ausrichtung aendert. */
const LABEL_WIDTH = 32;
const VALUE_WIDTH = 20;

/** Formatiert eine Dauer auf zehntel Millisekunden. */
function formatMs(durationMs) {
  return `${durationMs.toFixed(1)} ms`;
}

/** Formatiert einen Anteil als Prozentwert. */
function formatShare(share) {
  return `${(share * 100).toFixed(1)} %`;
}

/** Eine Tabellenzeile: Bezeichnung und je Messreihe ein Wert. */
function row(label, values) {
  return `    ${label.padEnd(LABEL_WIDTH)}${values.map(value => String(value).padStart(VALUE_WIDTH)).join('')}`;
}

/**
 * Der Ausgang der Fixpunktschleife im Klartext — die drei Faelle, die die Schleife
 * unterscheidet: Konvergenz, Oszillation (mit Zykluslaenge) und erschoepftes
 * Rundenbudget.
 */
function formatFixpoint({ rounds, converged, nonConvergence }) {
  if (converged) return `konvergiert nach ${rounds} Runde(n)`;
  if (nonConvergence?.kind === DiagnosticKind.OSCILLATION) {
    return `Oszillation nach ${rounds} Runden (Zykluslaenge ${nonConvergence.cycleLength})`;
  }
  return `Rundenbudget erschoepft (${rounds} Runden, ohne dass ein Zustand wiederkehrte)`;
}

/**
 * Die Knoten nach ihrer **Ankerart**, als eine Zeile — in der festen Reihenfolge
 * der Aufzaehlung, damit zwei Laeufe Zeile fuer Zeile vergleichbar sind. Genau
 * diese Aufschluesselung macht den Zuwachs des Angebots gegenueber der Grundlinie
 * sichtbar.
 */
function formatAnchorKindBreakdown(byAnchorKind) {
  return Object.entries(byAnchorKind)
    .map(([kind, count]) => `${kind}=${count}`)
    .join(', ');
}

/**
 * Sichert, dass alle Messreihen eines Falls dasselbe *Ergebnis* hatten. Die
 * Auswertung ist eine reine Funktion — laufen Knotenzahl oder Fixpunktausgang
 * zwischen zwei Laufzeitumgebungen auseinander, ist das ein Befund und keine
 * Messstreuung, und die Zahlen daneben waeren nicht mehr vergleichbar.
 */
function assertSameOutcome(columns) {
  const asKey = ({ summary }) => `${summary.tree.total}/${summary.tree.real}/${summary.fixpoint.rounds}/${summary.fixpoint.converged}`;
  const [first, ...rest] = columns;
  const deviating = rest.find(column => asKey(column) !== asKey(first));
  if (deviating !== undefined) {
    throw new Error(
      `Die Messreihen "${first.label}" und "${deviating.label}" liefern verschiedene Ergebnisse ` +
        `(${asKey(first)} vs. ${asKey(deviating)}). Die Auswertung ist eine reine Funktion — hier stimmt ` +
        'etwas am Messaufbau nicht, und die Zeiten daneben sind nicht vergleichbar.',
    );
  }
}

/**
 * Gibt das Ergebnis eines Falls aus und liefert je Messreihe deren Schwellen-Urteil.
 *
 * @param {{ label: string, source: string, catalogueCount: number }} measurementCase
 * @param {Array<{ label: string, summary: object }>} columns
 *   Die Messreihen desselben Falls, geordnet — bei einem einzelnen Lauf genau eine.
 * @returns {Array<{ label: string, withinInteractiveBudget: boolean, facadeShape: string }>}
 */
export function printCase(measurementCase, columns) {
  assertSameOutcome(columns);
  const [{ summary: reference }] = columns;

  console.log(`\nFall: ${measurementCase.label}`);
  console.log(`  Quelle:    ${measurementCase.source} (${measurementCase.catalogueCount} Katalogdatei(en))`);
  console.log(
    `  Knoten:    ${reference.tree.total} gesamt — ${reference.tree.real} real, ${reference.tree.synthetic} synthetisch` +
      ` (${formatAnchorKindBreakdown(reference.tree.byAnchorKind)})`,
  );
  console.log(`  Fixpunkt:  ${formatFixpoint(reference.fixpoint)}`);
  console.log(`  Dauer (Median ueber ${reference.repetitions} Laeufe):`);
  console.log(row('', columns.map(column => column.label)));
  for (const [phase, label] of PHASE_LABELS) {
    console.log(row(label, columns.map(({ summary }) =>
      `${formatMs(summary.phases[phase])} (${formatShare(summary.phases[phase] / summary.totalMs)})`)));
  }
  console.log(row('Gesamt', columns.map(({ summary }) => formatMs(summary.totalMs))));
  // Was eine Roster-Aenderung im laufenden Betrieb kostet: die Vorbereitung ist
  // dann bereits geschehen und wird wiederverwendet (zweistufige Fassade).
  console.log(row('bei wiederverwendetem Datensatz', columns.map(({ summary }) =>
    formatMs(summary.totalMs - summary.phases[MeasuredPhase.PREPARATION]))));

  return columns.map(({ label, summary }) => {
    const verdict = assessThresholds(summary);
    console.log(
      `  Schwellen (${label}): interaktive Obergrenze ${INTERACTIVE_BUDGET_MS} ms → ` +
        `${verdict.withinInteractiveBudget ? 'eingehalten' : 'GERISSEN'}; Vorbereitungsanteil ` +
        `${formatShare(summary.preparationShare)} (Schwelle: mehr als ${TWO_STAGE_PREPARATION_SHARE * 100} %) → ` +
        `Fassade ${verdict.facadeShape}`,
    );
    return { label, ...verdict };
  });
}

/**
 * Fasst die Urteile aller Faelle zusammen und liefert die Zahl derer, die die
 * interaktive Obergrenze reissen — die einzige Schwelle, die laut PRD ein
 * **blockierender** Befund ist.
 *
 * @param {Array<{ label: string, withinInteractiveBudget: boolean }>} verdicts
 * @returns {number}
 */
export function printThresholdSummary(verdicts) {
  const breaching = verdicts.filter(verdict => !verdict.withinInteractiveBudget);
  console.log('');
  if (breaching.length === 0) {
    console.log(`Alle ${verdicts.length} Messreihen bleiben unter der interaktiven Obergrenze von ${INTERACTIVE_BUDGET_MS} ms.`);
    return 0;
  }
  console.log(
    `BEFUND: ${breaching.length} von ${verdicts.length} Messreihen reissen die interaktive Obergrenze von ` +
      `${INTERACTIVE_BUDGET_MS} ms fuer eine Auswertung **einschliesslich** des Katalog-Vorlaufs. Seit die Fassade ` +
      'zweistufig ist, traegt eine Roster-Aenderung diesen Vorlauf nicht mehr: massgeblich ist dafuer die ' +
      'Zeile "bei wiederverwendetem Datensatz".',
  );
  return breaching.length;
}
