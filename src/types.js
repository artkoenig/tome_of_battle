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
 * @typedef {Object} ValidationError
 * @property {string} type
 * @property {string} message
 * @property {'error'|'warning'|'info'} severity
 * @property {string} [forceId]
 * @property {string} [categoryId]
 * @property {string} [selectionId]
 * @property {boolean} [blocksAddAvailability] Vom Validator gestempelte Aushebe-Sperr-Klassifikation (ADR-0022): true = Obergrenze/„nicht erlaubt", false = Budget-/„zu-wenig"-Zustand.
 */
export {};
