/**
 * @typedef {Object} CostEntry
 * @property {string} typeId
 * @property {number} value
 */

/**
 * @typedef {Object} Selection
 * @property {string} id
 * @property {string} name
 * @property {string|null} entryLinkId
 * @property {string|null} selectionEntryId
 * @property {number} number
 * @property {string|null} category
 * @property {boolean} [collective]
 * @property {string} [type] nur in fremden/älteren Roster-Daten vorhanden; die
 *   eigene Fabrik und der .ros-Import setzen es nicht (defensiv gelesen, z. B.
 *   in PlayUnitDetails)
 * @property {Selection[]} selections
 */

/**
 * @typedef {Object} Force
 * @property {string} id
 * @property {string|null} forceEntryId
 * @property {string} catalogueId
 * @property {Selection[]} selections
 */

/**
 * @typedef {Object} Roster
 * @property {string} id
 * @property {string} name
 * @property {string} systemId
 * @property {string} catalogueId
 * @property {number} costLimit
 * @property {string} costLimitType
 * @property {Force[]} forces
 * @property {Object} [gameState]
 */

/**
 * @typedef {Object} ValidationCause Eine benennbare auslösende Auswahl hinter einer
 *   App-Meldung, deren verletzter Grenzwert **bedingt** verändert wurde (ADR 0027): die
 *   Auswahl, deren aktiv greifender bedingter Modifier den Wert erst zum verletzten Wert
 *   gemacht hat. Sprachfrei — der Solver liefert Katalog-Id und Katalogname (Pass-through,
 *   ADR 0003); die Oberfläche rendert daraus den „Ursachen"-Block.
 * @property {string} entryId  Katalog-Id der auslösenden Auswahl.
 * @property {string} name     Katalogname der Auswahl (Pass-through, ADR 0003).
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} type
 * @property {string} [messageKey] i18n-Schlüssel der strukturierten Regelmeldung (ADR 0026); die Übersetzung passiert an der Oberfläche. Für Regelverstöße gesetzt.
 * @property {Record<string, unknown>} [messageParams] Parameter der strukturierten Meldung (Zahlen, Katalog-Namen als Pass-through).
 * @property {string} [message] Fertiger Klartext ohne Schlüssel — nur für Autoren-Hinweise des Katalogs (Katalogsprache, Pass-through).
 * @property {'error'|'warning'|'info'} severity
 * @property {string} [forceId]
 * @property {string} [categoryId]
 * @property {string} [selectionId]
 * @property {boolean} [blocksAddAvailability] Vom Validator gestempelte Aushebe-Sperr-Klassifikation (ADR-0022): true = Obergrenze/„nicht erlaubt", false = Budget-/„zu-wenig"-Zustand.
 * @property {ValidationCause[]} [causes] Optionale, sprachfreie Ursachen der Meldung (ADR 0027): die benennbaren auslösenden Auswahlen, deren bedingte Modifier den verletzten Grenzwert verändert haben. Nur an mechanischen App-Meldungen und nur wenn mindestens eine Ursache sauber auflösbar ist; fehlt sonst ganz (abwärtskompatibel).
 */
export {};
