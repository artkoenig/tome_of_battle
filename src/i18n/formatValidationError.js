// Locale-Schlüssel des Auswahl-Substantivs für Prozent-Meldungen, deren Bezugsgröße
// keine Kostenart ist ("… % der Auswahlen …"). Katalog-abgeleitete Kostenart-Labels
// bleiben unübersetzter Pass-through und kommen stattdessen als `unitLabel`-Parameter.
const SELECTIONS_UNIT_KEY = 'validation.selectionsUnit';

// Überschrift des Ursachen-Blocks und die Vorlage eines einzelnen Listenpunkts
// (ADR 0027). Der Katalogname bleibt Pass-through (ADR 0003) und wird nur je Sprache
// in Anführungszeichen gesetzt — analog zu den eingebetteten Namen der Meldungstexte.
export const CAUSES_TITLE_KEY = 'validation.causesTitle';
const CAUSE_ITEM_KEY = 'validation.causeItem';

/**
 * Übersetzt einen strukturierten Validierungsverstoß in einen Anzeigetext der aktiven
 * UI-Sprache. Der Solver liefert Schlüssel + Parameter (ADR 0026); erst hier entsteht
 * der fertige Satz — so bleibt die Regel-Engine sprachfrei.
 *
 * - Verstöße mit `messageKey` werden über `translate` gerendert.
 * - Der abgeleitete `unit`-Platzhalter ist das katalogseitige Kostenart-Label
 *   (`unitLabel`, Pass-through) oder — fehlt es — das übersetzte Auswahl-Substantiv.
 * - Autoren-Hinweise des Katalogs tragen keinen Schlüssel, sondern fertigen Text
 *   (`message`, Katalogsprache); er wird unverändert durchgereicht.
 *
 * @param {import('../types.js').ValidationError} error
 * @param {(key: string, params?: Record<string, unknown>) => string} translate
 * @returns {string}
 */
export function formatValidationError(error, translate) {
  if (!error) return '';
  if (error.messageKey === undefined) return error.message ?? '';

  const params = error.messageParams ?? {};
  const unit = params.unitLabel ?? translate(SELECTIONS_UNIT_KEY);
  return translate(error.messageKey, { ...params, unit });
}

/**
 * Rendert die sprachfreien Ursachen eines Verstoßes (ADR 0027) zu fertigen
 * Listenpunkten der aktiven UI-Sprache. Jeder Katalogname wird über die
 * `causeItem`-Vorlage seiner Sprache in Anführungszeichen gesetzt (Pass-through,
 * ADR 0003); der Name selbst bleibt unübersetzt.
 *
 * Trägt der Verstoß kein oder ein leeres `causes`-Feld, ist das Ergebnis leer —
 * die Oberfläche zeigt dann keinen Ursachen-Block (abwärtskompatibel).
 *
 * @param {import('../types.js').ValidationError} error
 * @param {(key: string, params?: Record<string, unknown>) => string} translate
 * @returns {string[]} ein Anzeigetext je Ursache, in Reihenfolge
 */
export function formatValidationCauses(error, translate) {
  const causes = error?.causes;
  if (!causes || causes.length === 0) return [];
  return causes.map((cause) => translate(CAUSE_ITEM_KEY, { name: cause.name }));
}
