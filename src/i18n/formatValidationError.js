// Locale-Schlüssel des Auswahl-Substantivs für Prozent-Meldungen, deren Bezugsgröße
// keine Kostenart ist ("… % der Auswahlen …"). Katalog-abgeleitete Kostenart-Labels
// bleiben unübersetzter Pass-through und kommen stattdessen als `unitLabel`-Parameter.
const SELECTIONS_UNIT_KEY = 'validation.selectionsUnit';

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
