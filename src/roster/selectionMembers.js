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

/**
 * What a single selection-entry group contributes, plus the contributions of the
 * groups nested inside it. Descent into nested groups is unconditional — a group
 * without a `min` of its own contributes nothing itself but may still contain a
 * mandatory group (the real shape of `Wizard Level` inside `Magic`).
 *
 * @param {object} group the (unresolved) selection-entry group.
 * @param {(defOrGroup: object) => number} minOf the caller's reading of a min constraint.
 * @returns {Array<{ def: object, count: number }>} in creation order.
 */
function mandatoryChildrenOfGroup(group, minOf) {
  const children = [];
  const members = memberDefsOf(group);
  const groupMin = minOf(group);

  if (groupMin > 0 && members.length > 0) {
    const itemized = members
      .map(member => ({ def: member, count: minOf(member) }))
      .filter(member => member.count > 0);
    if (itemized.length > 0) {
      children.push(...itemized);
    } else {
      const chosenOption = resolveGroupDefaultMember(group);
      if (chosenOption) children.push({ def: chosenOption, count: groupMin });
    }
  }

  group?.selectionEntryGroups?.forEach(nested => {
    children.push(...mandatoryChildrenOfGroup(nested, minOf));
  });
  return children;
}

/**
 * Die Pflicht-Kinder, die eine aufgelöste Definition beim Ausheben beisteuert:
 * direkte Mitglieder mit eigenem `min`, dazu der Beitrag jeder Auswahlgruppe
 * darunter — in **jeder** Tiefe.
 *
 * Für eine Pflichtgruppe (`min > 0`) gibt es zwei Muster:
 * - **Itemisiert („nimm all diese")**: die Mitglieder tragen eigene `min`-Constraints;
 *   dann steuert jedes solche Mitglied genau sein eigenes `min` bei.
 * - **Wähle-eine („aus einem Topf")**: kein Mitglied ist selbst pflichtig; dann füllt
 *   die Default- bzw. Erst-Option (`resolveGroupDefaultMember`) das Gruppen-`min`.
 *
 * Das eigene `min` einer Gruppe entscheidet nur darüber, was diese Gruppe selbst
 * beisteuert — nie darüber, ob in sie hinabgestiegen wird. Eine Gruppe steuert
 * ausschließlich ihre direkten Mitglieder bei; die Mitglieder einer verschachtelten
 * Gruppe sind deren Sache.
 *
 * @param {object} def die aufgelöste Definition (oder Gruppe), die begangen wird.
 * @param {(defOrGroup: object) => number} minOf die Lesart des `min`-Constraints des
 *   Aufrufers (roh oder effektiv); 0, wenn kein `min` vorliegt.
 * @returns {Array<{ def: object, count: number }>} in Anlege-Reihenfolge: erst die
 *   direkten Mitglieder, dann die Gruppen in Dokumentreihenfolge, jede Gruppe vor
 *   den in ihr verschachtelten Gruppen.
 */
export function mandatoryChildrenOf(def, minOf) {
  const children = [];

  memberDefsOf(def).forEach(member => {
    const count = minOf(member);
    if (count > 0) children.push({ def: member, count });
  });

  def?.selectionEntryGroups?.forEach(group => {
    children.push(...mandatoryChildrenOfGroup(group, minOf));
  });
  return children;
}
