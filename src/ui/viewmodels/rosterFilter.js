/**
 * Der Filter der Listen-Übersicht (Issue 0203) — reine Funktionen.
 *
 * Der Filter besteht aus zwei Mengen von Ids: Spielsysteme und Fraktionen (die
 * Id ist die des Armeebuchs, unter dem die Liste geführt wird). Innerhalb einer
 * Kategorie verbinden sich die Werte als ODER, die beiden Kategorien als UND;
 * eine leere Kategorie schränkt nichts ein.
 *
 * Hier steht kein React: der Zustand liegt in `SettingsContext` (er wird
 * gespeichert), die Bindung in `useRosterFilter`.
 */

/** Die beiden Kategorien, über die gefiltert wird. */
export const FILTER_CATEGORY = { SYSTEM: 'system', FACTION: 'faction' };

/**
 * Nichts gefiltert.
 *
 * @type {{ systemIds: string[], factionIds: string[] }}
 */
export const EMPTY_ROSTER_FILTER = { systemIds: [], factionIds: [] };

/**
 * Keine Auswahlwerte vorhanden.
 *
 * @type {{ systems: Array<{id: string, name: string}>, factions: Array<{id: string, name: string}> }}
 */
export const NO_FILTER_OPTIONS = { systems: [], factions: [] };

/**
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @param {string} category eine der {@link FILTER_CATEGORY}
 * @returns {string[]}
 */
export function selectedIdsOf(filter, category) {
  return category === FILTER_CATEGORY.SYSTEM ? filter.systemIds : filter.factionIds;
}

/**
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @param {string} category
 * @param {string[]} ids
 * @returns {{ systemIds: string[], factionIds: string[] }}
 */
function withIds(filter, category, ids) {
  return category === FILTER_CATEGORY.SYSTEM
    ? { systemIds: ids, factionIds: filter.factionIds }
    : { systemIds: filter.systemIds, factionIds: ids };
}

/**
 * Die Werte, die unter den gespeicherten Listen tatsächlich vorkommen — je
 * Kategorie alphabetisch nach dem Namen, unter dem die Oberfläche sie sonst
 * zeigt. Eine Liste ohne auflösbares System oder Armeebuch trägt keinen Wert
 * bei: es gibt nichts, wonach sich filtern liesse.
 *
 * @param {object[]} rosters
 * @param {object[]} systems
 * @returns {{ systems: Array<{id: string, name: string}>, factions: Array<{id: string, name: string}> }}
 */
export function filterOptionsOf(rosters, systems) {
  /** @type {Map<string, string>} */
  const systemNames = new Map();
  /** @type {Map<string, string>} */
  const factionNames = new Map();

  rosters.forEach((roster) => {
    const system = systems.find((candidate) => candidate.id === roster.systemId);
    if (!system) return;
    systemNames.set(system.id, system.name);
    const catalogue = system.catalogues?.find((candidate) => candidate.id === roster.catalogueId);
    if (catalogue) factionNames.set(catalogue.id, catalogue.name);
  });

  const sorted = (names) => [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { systems: sorted(systemNames), factions: sorted(factionNames) };
}

/**
 * Passt eine Liste zum Filter? Werte einer Kategorie als ODER, die Kategorien
 * als UND.
 *
 * @param {object} roster
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @returns {boolean}
 */
export function matchesRosterFilter(roster, filter) {
  const bySystem = filter.systemIds.length === 0 || filter.systemIds.includes(roster.systemId);
  const byFaction = filter.factionIds.length === 0 || filter.factionIds.includes(roster.catalogueId);
  return bySystem && byFaction;
}

/**
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @param {string} category
 * @param {string} id
 * @returns {{ systemIds: string[], factionIds: string[] }} ein neuer Filter.
 */
export function toggleFilterValue(filter, category, id) {
  const ids = selectedIdsOf(filter, category);
  return withIds(filter, category, ids.includes(id) ? ids.filter((it) => it !== id) : [...ids, id]);
}

/**
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @param {string} category
 * @param {string} id
 * @returns {{ systemIds: string[], factionIds: string[] }} ein neuer Filter ohne genau diesen Wert.
 */
export function withoutFilterValue(filter, category, id) {
  return withIds(filter, category, selectedIdsOf(filter, category).filter((it) => it !== id));
}

/**
 * Wie viele Werte insgesamt gewählt sind.
 *
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @returns {number}
 */
export function filterValueCount(filter) {
  return filter.systemIds.length + filter.factionIds.length;
}

/**
 * Die Chips zur aktuellen Auswahl, in der Reihenfolge der Auswahlwerte:
 * erst Spielsysteme, dann Fraktionen. Ein gewählter Wert, den keine Liste mehr
 * trägt, hat keinen Namen und bekommt keinen Chip.
 *
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @param {{ systems: Array<{id: string, name: string}>, factions: Array<{id: string, name: string}> }} options
 * @returns {Array<{ category: string, id: string, name: string }>}
 */
export function filterChipsOf(filter, options) {
  const chipsOf = (category, values) => values
    .filter((value) => selectedIdsOf(filter, category).includes(value.id))
    .map((value) => ({ category, id: value.id, name: value.name }));

  return [
    ...chipsOf(FILTER_CATEGORY.SYSTEM, options.systems),
    ...chipsOf(FILTER_CATEGORY.FACTION, options.factions),
  ];
}
