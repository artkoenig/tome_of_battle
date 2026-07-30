/**
 * Die Mitglieder einer Katalog-Definition bzw. einer Auswahlgruppe und die
 * Frage, welches Mitglied beim Ausheben aus einer Pflichtgruppe mitkommt.
 *
 * Diese Ermittlung ist Single Source of Truth (ADR-0022): sowohl die Fabrik,
 * die die Auswahl tatsächlich anlegt (`selectionFactory`), als auch die
 * Kostenschätzung, die den Preis vor dem Ausheben anzeigt (`rosterCounter`),
 * müssen dieselbe Option meinen — sonst weicht der angezeigte Preis vom
 * tatsächlich anfallenden ab.
 */

/**
 * Alle Mitglieder (Einträge und Links) einer Definition oder Gruppe in einer Liste.
 *
 * @param {{ selectionEntries?: Array<object>, entryLinks?: Array<object> }} [defOrGroup]
 * @returns {Array<object>} die Mitglieder in Dokumentreihenfolge (Einträge vor Links).
 */
export function memberDefsOf(defOrGroup) {
  return [...(defOrGroup?.selectionEntries || []), ...(defOrGroup?.entryLinks || [])];
}

/**
 * Die Option, die eine Pflicht-Auswahlgruppe beim Ausheben beisteuert: die im
 * Katalog vorgegebene (`selectionEntryGroup@defaultSelectionEntryId`), sonst —
 * ohne oder mit unauflösbarer Vorgabe — das erste Mitglied.
 *
 * Die Vorgabe referenziert die `id` des Mitglieds selbst; bei einem Link ist
 * das dessen Link-Id, nicht die `targetId` des Ziel-Eintrags.
 *
 * @param {{ defaultSelectionEntryId?: string|null, selectionEntries?: Array<object>, entryLinks?: Array<object> }} [group]
 * @returns {object|null} das Mitglied, oder null bei leerer Gruppe.
 */
export function resolveGroupDefaultMember(group) {
  const members = memberDefsOf(group);
  const configuredDefault = group?.defaultSelectionEntryId
    ? members.find(member => member.id === group.defaultSelectionEntryId)
    : null;
  return configuredDefault || members[0] || null;
}
