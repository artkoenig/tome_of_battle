import { isEntryScope } from './battlescribeConstants.js';
import '../types.js';

/**
 * UI-Verhaltensmodell je Option/Gruppe (ADR 0029, L5; ADR 0022).
 *
 * Der Aushebe-Dialog leitet seine Verfügbarkeit bereits aus dem Validator ab
 * (`getEntryAddAvailability`). Dieses Modul weitet dasselbe Prinzip auf die
 * übrigen Constraint-Entscheidungen der Oberfläche aus: Options-Gruppe,
 * Auswahl-Konfigurator und Autofill-Vorschläge treffen **keine** Constraint-
 * Entscheidung mehr selbst (Mehrfachauswahl-vs-Radiobutton, „Pflicht", „binär",
 * „wie viele noch erlaubt", Gruppen-Fehler), sondern rendern nur noch das hier
 * abgeleitete Modell.
 *
 * Die Funktionen sind **rein**: sie bekommen die bereits über die Query-Engine
 * gemessenen Werte (effektive Grenzen, Zähl-/Kostensummen) als Parameter und
 * entscheiden allein daraus. Der Schwellenwert bleibt `getModifiedConstraintValue`
 * die einzige Quelle (ADR 0029, L3) — dieses Modul misst nichts selbst nach,
 * sondern trifft die Entscheidung an genau einer Stelle für alle Oberflächen.
 */

/**
 * Anwendbarkeit einer eintragsbezogenen Grenze auf die aktuelle Einheit — die
 * einzige Stelle dieser Prüfung (vormals ~4× in OptionGroup/SelectionConfigurator/
 * AutoFillSuggestions ausgeschrieben und dadurch driftgefährdet).
 *
 * Eine Grenze ohne `scope` oder mit einem Bezugsrahmen-Scope (`parent`/`force`/
 * `roster`) gilt unverändert. Eine eintrags-/kategoriebezogen gescopte Grenze gilt
 * nur, wenn ihr Scope die tragende Einheit selbst (Link- oder Ziel-ID) oder eine
 * ihrer Kategorien benennt (ADR 0003 §4: Vergleich gegen aufgelöste Ziel-IDs).
 *
 * @param {Object[]|undefined|null} constraints  die (roh gefilterten) Grenzen.
 * @param {Object|null|undefined} unitResolved    die aufgelöste tragende Einheit.
 * @returns {Object[]} die auf die Einheit anwendbaren Grenzen.
 */
export function filterEntryScopedConstraints(constraints, unitResolved) {
  return (constraints || []).filter(con => {
    if (!con.scope || !isEntryScope(con.scope)) {
      return true;
    }
    return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
           (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
  });
}

/**
 * Verhaltensklasse einer Options-Zeile innerhalb einer Gruppe: Pflicht, Einzelwahl
 * (Radiobutton), binär (Checkbox) oder Mehrfachauswahl (Mengensteller).
 *
 * `isMandatory` bleibt die reine Katalog-Lesart (min===max>0). `isMandatoryMet`
 * sagt daneben, ob an dieser Zeile **keine offene Verpflichtung** aussteht: es
 * ist wahr, solange der Bericht sie nicht als `isMandatoryUnmet` meldet — für
 * eine Zeile ohne Pflicht also trivialerweise wahr. „Genommen und gesperrt"
 * zeigt eine Zeile darum erst, wenn beide zusammen zutreffen
 * (`isMandatory && isMandatoryMet`).
 *
 * Die Quelle dieser Unterscheidung ist der Bericht, nicht der Katalog:
 * BattleScribe erzeugt beim Ausheben, was ein Minimum verlangt, und erzwingt es
 * danach nicht mehr (`docs/battlescribe-data-format.md` §9.1) — ein nach der
 * Erzeugung unerfülltes Minimum ist also eine **offene** Pflicht, keine
 * eingelöste. Die Voreinstellung `false` für `isMandatoryUnmet` hält einen
 * Aufrufer ohne dieses Feld beim bisherigen Verhalten, statt eine Zeile
 * stillschweigend zu entsperren.
 *
 * @param {Object} args
 * @param {number} args.minLimit                    effektives Options-Min (0, wenn keins).
 * @param {number} args.maxLimit                    effektives Options-Max (`Infinity`, wenn keins).
 * @param {boolean} args.hasMaxConstraint           ob überhaupt ein Options-Max existiert.
 * @param {boolean} args.isCollective               kollektive (pro-Modell-)Ausrüstung.
 * @param {boolean} args.isRepeatableByGroupModifier ob ein Gruppen-Modifier diese Zeile wiederholbar macht.
 * @param {boolean} args.groupSingleChoice          ob die Gruppe echte Einzelwahl ist (Max ≤ 1, nicht hebbar).
 * @param {boolean} [args.isMandatoryUnmet]         ob der Bericht die Pflicht als offen meldet.
 * @returns {{isMandatory: boolean, isMandatoryMet: boolean, isRadio: boolean, hasQuantitySignal: boolean, isExplicitlyMulti: boolean, isBinary: boolean}}
 */
export function classifyGroupItem({
  minLimit, maxLimit, hasMaxConstraint, isCollective, isRepeatableByGroupModifier, groupSingleChoice,
  isMandatoryUnmet = false
}) {
  const isMandatory = minLimit > 0 && minLimit === maxLimit;
  const isMandatoryMet = isMandatoryUnmet !== true;
  // Eine wiederholbare Option verhält sich nie als ausschließender Radiobutton, obwohl
  // ihre Gruppe nominell auf max=1 gedeckelt ist (das Cap wird je Kopie gehoben).
  const isRadio = !isRepeatableByGroupModifier && groupSingleChoice;
  // Ein Mengensteller braucht ein positives Mengensignal: ohne explizites Max qualifiziert
  // nur ein echtes Minimum (min>0) oder eine kollektive (pro-Modell-)Ausrüstung; eine bloße
  // optionale Aufwertung ohne min/max ist binär (Checkbox).
  const hasQuantitySignal = minLimit > 0 || isCollective;
  const isExplicitlyMulti = (hasMaxConstraint && maxLimit > 1) ||
    isRepeatableByGroupModifier ||
    (!hasMaxConstraint && !isRadio && hasQuantitySignal);
  const isBinary = !isExplicitlyMulti && ((hasMaxConstraint && maxLimit === 1) || isRadio || !hasMaxConstraint);
  return { isMandatory, isMandatoryMet, isRadio, hasQuantitySignal, isExplicitlyMulti, isBinary };
}

/**
 * Verhaltensklasse einer eigenständigen (gruppenlosen) Options-Zeile im
 * Auswahl-Konfigurator: Pflicht (min>0 und min===max) und binär (max===1).
 *
 * Zur Unterscheidung von `isMandatory` (Katalog-Lesart) und `isMandatoryMet`
 * (eingelöste Pflicht) siehe {@link classifyGroupItem} — beide Pfade lesen
 * dieselbe Regel.
 *
 * @param {Object} args
 * @param {number} args.minLimit  effektives Min (0, wenn keins).
 * @param {number} args.maxLimit  effektives Max (`Infinity`, wenn keins).
 * @param {boolean} [args.isMandatoryUnmet]  ob der Bericht die Pflicht als offen meldet.
 * @returns {{isMandatory: boolean, isMandatoryMet: boolean, isBinary: boolean}}
 */
export function classifyStandaloneOption({ minLimit, maxLimit, isMandatoryUnmet = false }) {
  const isMandatory = minLimit > 0 && minLimit === maxLimit;
  const isMandatoryMet = isMandatoryUnmet !== true;
  const isBinary = maxLimit === 1;
  return { isMandatory, isMandatoryMet, isBinary };
}

/**
 * Ob das Hinzufügen einer weiteren, noch nicht gewählten Option die effektive
 * Gruppen-Zähl-Obergrenze sprengte (senkender Fall / Deaktivierung). Ein Max von 0
 * deaktiviert die Gruppe ganz. Bei einer max-**hebbaren** Gruppe greift die Klammerung
 * bewusst nicht — das aktuelle Max wäre 1, und gerade die koppelnde Option hebt es.
 * Radiobuttons tauschen die aktuelle Wahl (Netto 0) und werden nur bei Max 0 gesperrt.
 *
 * @param {Object} args
 * @param {number} args.effectiveGroupCountMax  effektives Gruppen-Zähl-Max (`Infinity`, wenn keins).
 * @param {number} args.currentCount            aktuell in der Gruppe gewählte Anzahl.
 * @param {boolean} args.isRadio                ob diese Zeile ein Radiobutton ist.
 * @param {number} args.count                   aktuelle Anzahl dieser Option.
 * @param {boolean} args.isGroupMaxRaisable     ob ein Modifier das Gruppen-Max heben kann.
 * @returns {boolean}
 */
export function exceedsGroupCountMax({ effectiveGroupCountMax, currentCount, isRadio, count, isGroupMaxRaisable }) {
  const isCapReached = effectiveGroupCountMax !== Infinity && currentCount >= effectiveGroupCountMax;
  return !isGroupMaxRaisable &&
    (effectiveGroupCountMax === 0 || (!isRadio && count === 0 && isCapReached));
}

/**
 * Ob das Hinzufügen dieser Option das Punkte-Cap der Gruppe sprengte. Ein noch nicht
 * gewählter Radiobutton tauscht die aktuelle Wahl: seine Netto-Punkte sind die Differenz
 * zu den Punkten der bereits gewählten Geschwister-Option.
 *
 * @param {Object} args
 * @param {number} args.maxPointsLimit         das effektive Punkte-Cap (`Infinity`, wenn keins).
 * @param {number} args.activePoints           die aktuell in der Gruppe gebundenen Punkte.
 * @param {number} args.points                 die Punkte dieser Option.
 * @param {boolean} args.isRadio               ob diese Zeile ein Radiobutton ist.
 * @param {number} args.count                  aktuelle Anzahl dieser Option.
 * @param {number|null} [args.selectedSiblingPoints] Punkte der bereits gewählten Geschwister-
 *   Option (nur relevant für einen noch nicht gewählten Radiobutton); sonst `null`.
 * @returns {boolean}
 */
export function wouldExceedGroupPointsLimit({
  maxPointsLimit, activePoints, points, isRadio, count, selectedSiblingPoints = null
}) {
  if (maxPointsLimit === Infinity) return false;
  let pointsDiff = points;
  if (isRadio && count === 0 && selectedSiblingPoints !== null) {
    pointsDiff = points - selectedSiblingPoints;
  }
  return activePoints + pointsDiff > maxPointsLimit;
}

/**
 * Ob eine der (bereits gemessenen) Gruppen-Grenzen aktuell verletzt ist. Nur `max`-Grenzen
 * können einen Gruppen-Fehler auslösen; eine Grenze mit unbegrenztem (negativem) Wert wird
 * übersprungen. Kosten-Grenzen prüfen gegen die gebundenen Punkte, Anzahl-Grenzen gegen die
 * gewählte Anzahl.
 *
 * @param {Array<{finalValue: number, isMax: boolean, measuresCost: boolean, activeCount: number, activePoints: number}>} measuredConstraints
 * @returns {boolean}
 */
export function hasGroupConstraintError(measuredConstraints) {
  return (measuredConstraints || []).some(({ finalValue, isMax, measuresCost, activeCount, activePoints }) => {
    if (finalValue < 0) return false;
    if (!isMax) return false;
    return measuresCost ? activePoints > finalValue : activeCount > finalValue;
  });
}

/**
 * Das effektive Höchst-Kontingent, das Autofill für eine Kandidaten-Option vorschlagen darf:
 * das kleinere von Options- und Gruppen-Max, auf 1 gedeckelt, wenn die Option roster-weit
 * einzigartig ist.
 *
 * @param {Object} args
 * @param {number} args.optionMax        effektives Options-Max (`Infinity`, wenn keins).
 * @param {number} [args.groupMax]       effektives Gruppen-Max (`Infinity`, wenn keins).
 * @param {boolean} args.isRosterUnique  ob die Option roster-weit einzigartig ist.
 * @returns {number}
 */
export function autofillCandidateMax({ optionMax, groupMax = Infinity, isRosterUnique }) {
  let maxLimit = optionMax;
  if (groupMax < maxLimit) maxLimit = groupMax;
  if (isRosterUnique && maxLimit > 1) maxLimit = 1;
  return maxLimit;
}
