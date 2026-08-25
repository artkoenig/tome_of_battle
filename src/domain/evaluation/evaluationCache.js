/**
 * Die **eine** App-Auswertung (Issue 0121, Tasks 7, 17 und 18): jede Stelle der
 * Oberflaeche, die ein App-Roster gegen die Katalogdaten seines Systems
 * bewertet, geht durch {@link evaluateAppRoster} — der `.ros`-Export und das
 * Dashboard direkt, der Editor und der Spielmodus ueber den duennen Hook
 * `useEvaluation`, der nichts weiter tut, als diesen Aufruf zu memoisieren.
 *
 * Der Grund fuer diese eine Naht ist ein Befund: solange Hook und Direktaufruf
 * Adapter, `evaluate` und die Pfadkorrektur je fuer sich zusammensetzten, konnte
 * eine Korrektur an einem Rand landen und am anderen fehlen (F1 der Pruefrunde 3
 * war genau das). Eine Naht, die es nur einmal gibt, kann nicht auseinander
 * laufen.
 *
 * Drei WeakMaps ueber Objektidentitaeten tragen den Cache:
 * - der Bericht selbst haengt am Paar (System, Roster) und wird je Paar genau
 *   einmal gerechnet — auch ueber einen Ansichtswechsel hinweg, der jedes
 *   `useMemo` verwirft (Issue 0168);
 * - der Katalog-Vorlauf (`prepareDataset`) laeuft **genau einmal je
 *   System-Objekt** (Kriterium 8) — ein neues System-Objekt (Neuladen aus der
 *   DB, Katalog-Update) loest genau eine neue Vorbereitung aus;
 * - die Datensatz-Beschreibung (`describeDataset`) haengt allein am
 *   aufbereiteten Datensatz und laeuft deshalb ebenfalls nur einmal je Griff.
 *
 * Beide halten nichts am Leben, was die App nicht ohnehin haelt.
 *
 * Exporte:
 * - `evaluateAppRoster(system, roster)` — die App-Auswertung als reine
 *   Funktion: `{ violations, slots, description, costTotals, diagnostics }`.
 *   Leer-/Fehlfaelle (system
 *   null/undefined/ohne vollstaendiges `rawXmls`, roster null/undefined)
 *   ergeben ohne Throw das referenzstabile Leer-Ergebnis.
 * - `describeSystem(system)` — die Datensatz-Beschreibung ohne Roster
 *   (`describeDataset`); system null oder ohne (vollstaendige) `rawXmls`
 *   (fehlende oder leere `.gst`-Liste) → `null`.
 */

import { prepareDataset, evaluate, describeDataset } from '../evaluator/evaluator.js';
import { toEvaluatorRoster, slotPathsOf } from './rosterAdapter.js';
import { SlotIndex, EMPTY_SLOT_INDEX } from './slotIndex.js';

/**
 * Das Ergebnis der App-Auswertung — die Form, die die ganze Oberflaeche liest.
 *
 * @typedef {Object} AppEvaluation
 * @property {ReadonlyArray<object>} violations  Verletzungen aus dem Bericht der Fassade.
 * @property {import('./slotIndex.js').SlotIndex} slots  Die Slot-Seite des Berichts
 *   als **ein** Wertobjekt (Issue 0170): die Faehigkeitsdatensaetze je Slot-Pfad
 *   und die beiden Pfadzuordnungen, die in sie hineinfuehren, samt der reinen
 *   Lookups darauf. Die drei Strukturen reist niemand mehr einzeln.
 * @property {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] } | null} description
 *   Beschreibung des Datensatzes (`describeDataset`); `null` im Leerfall.
 * @property {Readonly<Record<string, number>>} costTotals  Kostensumme je deklarierter Kostenart.
 * @property {ReadonlyArray<object>} diagnostics  Datensatz-Befunde des Berichts
 *   (z. B. `unresolvedDefinition`), aus denen die Oberflaeche die Meldung fuer
 *   nicht mehr auffindbare Auswahlen ableitet.
 */

/** Die Diagnose "diese Definition kennt der Datensatz nicht" (`evalTree.js`). */
const UNRESOLVED_DEFINITION = 'unresolvedDefinition';

/** Aufbereiteter Datensatz je System-Objektidentitaet (genau ein Vorlauf). */
const preparedBySystem = new WeakMap();

/** Datensatz-Beschreibung je aufbereitetem Datensatz (genau ein Lauf). */
const describedByDataset = new WeakMap();

/**
 * Der Bericht je Paar (System-Objekt, Roster-Objekt) — genau **eine**
 * Auswertung je Paar, ueber alle Aufrufer und alle Hook-Instanzen hinweg
 * (Issue 0168). `useEvaluation` memoisiert nur innerhalb einer Montierung; ein
 * Ansichtswechsel wirft dieses `useMemo` weg, und ohne diese Ebene wertete die
 * naechste Ansicht dasselbe unveraenderte Roster erneut aus und lieferte einen
 * neuen Bericht — jede nachgelagerte Ableitung ueber Objektidentitaet rechnete
 * mit.
 *
 * Aeussere Map ueber die System-Identitaet, innere ueber die Roster-Identitaet,
 * beide schwach: eine Bearbeitung erzeugt ein neues Roster-Objekt, und der
 * Eintrag des alten faellt mit ihm weg.
 *
 * @type {WeakMap<object, WeakMap<object, AppEvaluation>>}
 */
const reportsBySystemAndRoster = new WeakMap();

/**
 * Das eine, eingefrorene Leer-Ergebnis der App-Auswertung: referenzstabil ueber
 * alle Aufrufe und alle Hook-Instanzen hinweg.
 *
 * @type {AppEvaluation}
 */
const EMPTY_RESULT = Object.freeze({
  violations: Object.freeze([]),
  slots: EMPTY_SLOT_INDEX,
  description: null,
  costTotals: Object.freeze({}),
  diagnostics: Object.freeze([]),
});

/**
 * Der aufbereitete Datensatz eines System-Objekts — hoechstens ein
 * `prepareDataset`-Lauf je Objektidentitaet. Ein System ohne `rawXmls`
 * (Start-Migration noch nicht gelaufen) oder ohne `.gst`-Datei hat keinen
 * Datensatz → `null`.
 *
 * @param {{ rawXmls?: { gst: Array<{ content: string }>, cat?: Array<{ content: string }> } } | null | undefined} system
 * @returns {object|null} der undurchsichtige Griff der Evaluator-Fassade.
 */
function preparedDatasetOf(system) {
  const rawXmls = system?.rawXmls;
  if (!system || !rawXmls) return null;
  const gameSystem = rawXmls.gst?.[0]?.content;
  if (gameSystem === undefined) return null;
  let prepared = preparedBySystem.get(system);
  if (prepared === undefined) {
    prepared = prepareDataset({
      gameSystem,
      catalogues: (rawXmls.cat ?? []).map(file => file.content),
    });
    preparedBySystem.set(system, prepared);
  }
  return prepared;
}

/**
 * Wertet ein App-Roster gegen die Katalogdaten seines Systems aus — die eine
 * App-Auswertung, als reine Funktion ohne React. `useEvaluation` ruft genau
 * diese Funktion auf und memoisiert nur ihr Ergebnis; wer ausserhalb von React
 * steht (`.ros`-Export, Dashboard), ruft sie direkt. Beide Wege sehen deshalb
 * dieselben Pfade, dieselben Verletzungen, dieselben Kosten.
 *
 * @param {object|null|undefined} system  App-System-Objekt mit `rawXmls`.
 * @param {import('../../domain/types.js').Roster|null|undefined} roster  das App-Roster.
 * @returns {AppEvaluation}
 */
export function evaluateAppRoster(system, roster) {
  const prepared = preparedDatasetOf(system);
  if (prepared === null || roster === null || roster === undefined) return EMPTY_RESULT;

  let byRoster = reportsBySystemAndRoster.get(system);
  if (byRoster === undefined) {
    byRoster = new WeakMap();
    reportsBySystemAndRoster.set(system, byRoster);
  }
  const cached = byRoster.get(roster);
  if (cached !== undefined) return cached;

  const { evalRoster, pathBySelectionId, pathByForceId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  const paths = correctedPathsOf(roster, { pathBySelectionId, pathByForceId }, report.diagnostics);
  const evaluation = {
    violations: report.violations,
    slots: SlotIndex.fromReport(report, paths),
    description: descriptionOf(prepared),
    costTotals: report.costTotals,
    diagnostics: report.diagnostics,
  };
  byRoster.set(roster, evaluation);
  return evaluation;
}

/**
 * Die Slot-Pfade, korrigiert um die Definitionen, die der Datensatz nicht kennt.
 *
 * Der Adapter zaehlt die Kind-Indizes der Roster-Eingabe durch; die Engine
 * haengt eine Instanz, deren `defId` nicht aufloest, **nicht** in den Baum
 * (Diagnose `unresolvedDefinition`) — samt ihrem ganzen Teilbaum. Ohne
 * Korrektur ruecken dadurch alle nachfolgenden Geschwister eine Position vor,
 * und jede Auswahl hinter der verlorenen zeigte Namen, Kosten und
 * Verfuegbarkeit ihres Nachbarn (Befund B2 der Pruefrunde 2); ein Kontingent
 * hinter einem verlorenen zeigte auf fremde Slots und damit auf gar keine
 * Angebote. Hier — wo Roster **und** Bericht vorliegen — werden die Zuordnungen
 * deshalb ohne diese Definitionen neu gebaut; die unaufloesbare Auswahl (bzw.
 * das unaufloesbare Kontingent) selbst bekommt gar keinen Pfad, weil die Engine
 * fuer sie keinen Slot fuehrt.
 *
 * Ohne Diagnose bleiben die schon gebauten Zuordnungen unveraendert — der
 * Normalfall kostet nichts.
 *
 * @param {import('../../domain/types.js').Roster} roster
 * @param {{ pathBySelectionId: Map<string, string>, pathByForceId: Map<string, string> }} naivePaths
 * @param {ReadonlyArray<object>|undefined} diagnostics
 * @returns {{ pathBySelectionId: Map<string, string>, pathByForceId: Map<string, string> }}
 */
function correctedPathsOf(roster, naivePaths, diagnostics) {
  /** @type {Set<string>} */
  const unresolvedDefIds = new Set();
  for (const entry of diagnostics ?? []) {
    if (entry?.kind === UNRESOLVED_DEFINITION) unresolvedDefIds.add(entry.defId);
  }
  return unresolvedDefIds.size === 0 ? naivePaths : slotPathsOf(roster, unresolvedDefIds);
}

/**
 * Die Datensatz-Beschreibung eines aufbereiteten Datensatzes — hoechstens ein
 * `describeDataset`-Lauf je Griff.
 *
 * @param {object} prepared
 * @returns {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] }}
 */
function descriptionOf(prepared) {
  let description = describedByDataset.get(prepared);
  if (description === undefined) {
    description = describeDataset(prepared);
    describedByDataset.set(prepared, description);
  }
  return description;
}

/**
 * Die Datensatz-Beschreibung eines Systems **ohne Roster** (ADR-0034):
 * Kostenarten, spielbare gegenueber Bibliotheks-Katalogen, anlegbare
 * Kontingente — aus demselben einen Katalog-Vorlauf wie die Auswertung.
 *
 * @param {object|null|undefined} system  App-System-Objekt mit `rawXmls`.
 * @returns {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] } | null}
 *   `null`, wenn das System keinen Datensatz hat (kein `rawXmls`, leere
 *   `.gst`-Liste).
 */
export function describeSystem(system) {
  const prepared = preparedDatasetOf(system);
  return prepared === null ? null : descriptionOf(prepared);
}
