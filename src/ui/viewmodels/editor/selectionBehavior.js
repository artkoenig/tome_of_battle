import '../../../shared/types.js';

/**
 * UI-Verhaltensmodell je Option/Gruppe (ADR 0029, L5; ADR 0022; ADR-0037).
 *
 * Liegt in der Oberflächen-Schicht, weil es genau dort gebraucht wird: es
 * klassifiziert **Anzeige**-Verhalten aus den Werten, die der Bericht schon
 * gemessen hat. Die Katalog-Lesungen derselben Fragen leben nur noch einmal,
 * im Bericht (`src/domain/evaluator/groupBehavior.js`, ADR-0034).
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

