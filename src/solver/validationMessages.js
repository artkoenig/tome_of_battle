/**
 * Meldungsschlüssel, die der Roster-Validator erzeugt.
 *
 * Der Solver bleibt sprachfrei (ADR 0023/0026): jeder Verstoß trägt einen
 * stabilen Schlüssel plus strukturierte Parameter statt eines fertigen
 * deutschen Satzes. Die Übersetzung in die aktive UI-Sprache passiert erst an
 * der Oberfläche über das i18n-Modul (`formatValidationError`).
 *
 * Zu jedem Schlüssel muss in `src/i18n/locales/*.json` eine Vorlage liegen —
 * für die numerus-abhängigen Meldungen als `_one`/`_other`-Paar. Ein Test
 * (`validationMessages.locales.test.js`) erzwingt diese Deckung.
 */
export const ValidationMessageKey = Object.freeze({
  ROSTER_LIMIT: 'validation.rosterLimit',
  FORCE_SELECTOR_MIN: 'validation.forceSelectorMin',
  FORCE_ROSTER_LIMIT: 'validation.forceRosterLimit',
  CATEGORY_MIN: 'validation.categoryMin',
  CATEGORY_MAX: 'validation.categoryMax',
  UNRESOLVED_ENTRY: 'validation.unresolvedEntry',
  ENTRY_MIN: 'validation.entryMin',
  ENTRY_MAX: 'validation.entryMax',
  ENTRY_PERCENT_MIN: 'validation.entryPercentMin',
  ENTRY_PERCENT_MAX: 'validation.entryPercentMax',
  GROUP_POINTS_MAX: 'validation.groupPointsMax',
  GROUP_POINTS_MIN: 'validation.groupPointsMin',
  GROUP_COUNT_MAX: 'validation.groupCountMax',
  GROUP_COUNT_MIN: 'validation.groupCountMin',
  GROUP_PERCENT_MIN: 'validation.groupPercentMin',
  GROUP_PERCENT_MAX: 'validation.groupPercentMax'
});

/**
 * Numerus-abhängige Meldungsschlüssel: Ihre Vorlagen kommen als `_one`/`_other`
 * und pluralisieren über den `count`-Parameter (die Grenze, deren Auswahl-Substantiv
 * mit ihr kongruiert). Alle übrigen Schlüssel haben genau eine Vorlage.
 */
export const PLURALIZED_VALIDATION_MESSAGE_KEYS = Object.freeze([
  ValidationMessageKey.CATEGORY_MIN,
  ValidationMessageKey.CATEGORY_MAX,
  ValidationMessageKey.ENTRY_MIN,
  ValidationMessageKey.ENTRY_MAX,
  ValidationMessageKey.GROUP_COUNT_MAX,
  ValidationMessageKey.GROUP_COUNT_MIN
]);

/**
 * Obergrenzen-Familien, deren Grenze null („darf gar nichts") eine eigene
 * Formulierung trägt statt „höchstens 0 …". Da weder Deutsch noch Englisch eine
 * `zero`-Numeruskategorie kennen, wählt `translate` diese Vorlage über den
 * expliziten `_zero`-Suffix, wenn `count === 0` ist. Zusätzlich zum
 * `_one`/`_other`-Paar muss also für diese Schlüssel eine `_zero`-Vorlage je
 * Sprache vorliegen.
 */
export const ZERO_AWARE_VALIDATION_MESSAGE_KEYS = Object.freeze([
  ValidationMessageKey.CATEGORY_MAX,
  ValidationMessageKey.ENTRY_MAX,
  ValidationMessageKey.GROUP_COUNT_MAX
]);
