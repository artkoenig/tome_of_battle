/**
 * Die Mitglieder einer Katalog-Definition bzw. einer Auswahlgruppe — und der
 * Weg von einer Definitions-Id zurück zu dem Mitglied, das sie bezeichnet.
 *
 * **Welche** Mitglieder beim Ausheben mitkommen, entscheidet diese Schicht seit
 * Issue 0157 nicht mehr: das sagt der Bericht (`capability.raiseMembers`,
 * ADR-0034), aus demselben Durchlauf, aus dem auch der angezeigte Aushebe-Preis
 * stammt. Hier bleibt allein die **Auflösung**: welches Katalog-Objekt die vom
 * Bericht genannte Id ist — Gruppen sind dabei durchlässig, wie überall.
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
 * Das Mitglied unter `def`, das die Id `defId` trägt — in **jeder** Tiefe, durch
 * geschachtelte Gruppen und Gruppen-Verweise hindurch.
 *
 * Gesucht wird über die **eigene** Id des Mitglieds (bei einem Verweis dessen
 * Link-Id), genau wie der Bericht sie meldet; erst wenn keine passt, entscheidet
 * die aufgelöste Ziel-Id. Auf jeder Ebene gehen die direkten Mitglieder den
 * Gruppen darunter vor, sodass eine Id, die zweimal vorkommt, dieselbe Stelle
 * trifft wie beim Bericht (Dokumentreihenfolge).
 *
 * @param {object} def die (aufgelöste) Definition oder Gruppe, die begangen wird.
 * @param {string} defId die vom Bericht genannte Id des Pflicht-Mitglieds.
 * @param {(member: object) => object|null} resolveGroupDef  liefert die
 *   Gruppendefinition hinter einem Gruppen-Verweis, sonst `null`.
 * @param {string|null} [targetDefId] die aufgelöste Ziel-Id, als zweite Chance.
 * @returns {object|null} das (unaufgelöste) Mitglied, oder null.
 */
export function findMemberDefById(def, defId, resolveGroupDef, targetDefId = null) {
  if (!def || defId === null || defId === undefined) return null;

  const members = memberDefsOf(def);
  const own = members.find(member => member.id === defId);
  if (own) return own;

  const groups = [
    ...(def.selectionEntryGroups || []),
    ...members.map(member => resolveGroupDef(member)).filter(Boolean),
  ];
  for (const group of groups) {
    const found = findMemberDefById(group, defId, resolveGroupDef, targetDefId);
    if (found) return found;
  }

  if (targetDefId) {
    const byTarget = members.find(member => member.targetId === targetDefId);
    if (byTarget) return byTarget;
  }
  return null;
}
