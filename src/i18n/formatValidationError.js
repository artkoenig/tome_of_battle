// Locale-Schlüssel des Auswahl-Substantivs für Prozent-Meldungen, deren Bezugsgröße
// keine Kostenart ist ("… % der Auswahlen …"). Katalog-abgeleitete Kostenart-Labels
// bleiben unübersetzter Pass-through und kommen stattdessen als `unitLabel`-Parameter.
const SELECTIONS_UNIT_KEY = 'validation.selectionsUnit';

// Locale-Schlüssel des Einleitungstokens der „aktuell:"-Klammer. Nur darüber erkennt
// der Aushebe-Dialog den technischen Zählstand-Zusatz sprachneutral, um ihn zu kappen.
const CURRENT_COUNT_LEAD_KEY = 'validation.currentCountLead';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Entfernt den technischen Zählstand-Zusatz „(aktuell: …)" aus einer bereits
 * übersetzten Meldung. Das Einleitungstoken kommt aus der aktiven Sprache, sodass
 * ausschließlich diese eine Klammer getroffen wird — Prozent-Klammern („({threshold})")
 * beginnen nicht mit dem Token und bleiben unberührt.
 */
function stripCurrentCountClause(message, translate) {
  const lead = translate(CURRENT_COUNT_LEAD_KEY);
  const clausePattern = new RegExp(`\\s*\\(${escapeRegExp(lead)}[^)]*\\)`);
  return message.replace(clausePattern, '');
}

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
 * - `omitCurrentCount` kappt den „(aktuell: …)"-Zusatz (Aushebe-Dialog, ADR-0022).
 *
 * @param {import('../types.js').ValidationError} error
 * @param {(key: string, params?: Record<string, unknown>) => string} translate
 * @param {{ omitCurrentCount?: boolean }} [options]
 * @returns {string}
 */
export function formatValidationError(error, translate, { omitCurrentCount = false } = {}) {
  if (!error) return '';
  if (error.messageKey === undefined) return error.message ?? '';

  const params = error.messageParams ?? {};
  const unit = params.unitLabel ?? translate(SELECTIONS_UNIT_KEY);
  const rendered = translate(error.messageKey, { ...params, unit });

  return omitCurrentCount ? stripCurrentCountClause(rendered, translate) : rendered;
}
