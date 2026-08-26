/**
 * React-Hook `useEvaluation` (Issue 0121, Tasks 3 und 17): der Rand, ueber den
 * der Editor und der Spielmodus die App-Auswertung beziehen.
 *
 * Der Hook **rechnet nichts selbst**. Er ruft `evaluateAppRoster(system,
 * roster)` — die eine App-Auswertung aus `evaluationCache.js` — und memoisiert
 * deren Ergebnis je Objektidentitaet der beiden Eingaben. Genau darin liegt der
 * Zweck: solange Hook und Direktaufruf Adapter, `evaluate` und die
 * Pfadkorrektur je fuer sich zusammensetzten, konnte eine Korrektur an einem
 * Rand landen und am anderen fehlen (Befund F1 der Pruefrunde 3). Eine Naht,
 * die es nur einmal gibt, kann nicht auseinander laufen.
 *
 * Ergebnis (Form und Leerfaelle: siehe `AppEvaluation` in
 * `evaluationCache.js`): `{ violations, slots, description, costTotals,
 * diagnostics }` — die Slot-Seite ist seit Issue 0170 **ein** Wertobjekt
 * (`SlotIndex`), nicht mehr drei einzelne Felder.
 *
 * Memoisierung (Kriterium 8 des Issues, verschaerft in Task 7):
 * - `prepareDataset` und `describeDataset` laufen hoechstens einmal je
 *   Datensatz — **global geteilt** ueber alle Hook-Instanzen und alle
 *   Direktaufrufe (die WeakMaps in `evaluationCache.js`); erst ein neues
 *   System-Objekt loest eine neue Vorbereitung aus.
 * - Adapter und `evaluate` laufen je Roster-Objektidentitaet (und erneut, wenn
 *   das System-Objekt wechselt) — dafuer sorgt das `useMemo` hier.
 *
 * Der Hook ist rein ableitend: kein DB-Zugriff, kein Kontext, keine Effekte.
 * Die Auswertung laeuft synchron im Render — der Vertrag der Tests verlangt ein
 * synchrones Ergebnis im ersten Render; die Entkopplung des teuren Vorlaufs
 * (0,5–1,5 s bei echten Katalogen) ist Sache der aufrufenden UI.
 *
 * Leere Eingaben (system null/undefined, `rawXmls` fehlt oder ohne `.gst`,
 * roster null/undefined) ergeben ohne Throw das **referenzstabile**
 * Leer-Ergebnis der App-Auswertung: `violations: []`, leere Maps,
 * `description: null`, `costTotals: {}`.
 */

import { useMemo } from 'react';
import { evaluateAppRoster } from '../acl/evaluationCache.js';

/**
 * Wertet ein App-Roster gegen die Katalogdaten seines Systems aus.
 *
 * @param {{ rawXmls?: { gst: Array<{ name: string, content: string }>, cat: Array<{ name: string, content: string }> } } | null | undefined} system
 *   Das App-System-Objekt mit den rohen XMLs; `null`/`undefined` oder ohne
 *   (vollstaendiges) `rawXmls` → Leer-Ergebnis.
 * @param {import('../../../shared/rostermodel/types.js').Roster | null | undefined} roster
 *   Das App-Roster; `null`/`undefined` → Leer-Ergebnis.
 * @returns {import('../acl/evaluationCache.js').AppEvaluation}
 */
export function useEvaluation(system, roster) {
  return useMemo(() => evaluateAppRoster(system, roster), [system, roster]);
}
