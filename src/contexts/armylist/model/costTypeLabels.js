/**
 * Die Kostenart, in der ein Roster gemessen wird, und ihr Anzeigename.
 *
 * Was das Roster **kostet**, rechnet diese Schicht seit Issue 0157 nicht mehr:
 * jede Summe kommt aus dem Bericht (`costs`/`totalCosts`/`costTotals`/
 * `raiseCosts`, ADR-0034). Hier bleibt allein die Beschriftung — eine reine
 * Lesung der Spielsystem-Deklaration, ohne jede Auswertung.
 */

/**
 * The id of the cost type a roster is measured in.
 *
 * `cost/@typeId` always references `costType/@id`, never `costType/@name`, and
 * that id is chosen freely by the catalogue author (GUIDs in the WHFB6 fork,
 * `points` in wh40k-9e). No id is reserved for points, so none may be assumed:
 * the roster's own setting is the source of truth, and the only defensible
 * substitute is the first cost type the game system declares.
 *
 * @returns {string|null} the cost-type id, or null if the system declares none
 */
export function resolveCostLimitTypeId(roster, system) {
  return roster?.costLimitType ?? system?.costTypes?.[0]?.id ?? null;
}

/**
 * The display name of a cost type, taken verbatim from the game system's
 * declaration. This is the single derivation "cost-type id → label"; nothing
 * else in the application may name a cost type.
 *
 * Catalogue authors pad these names with a leading space (`" Casting Dice"`,
 * `" Dispel Dice"`, `" PL"` in wh40k-9e), so trimming is the *only* alteration
 * made: the name is never translated, abbreviated or otherwise normalised.
 *
 * @returns {string} the trimmed name, or '' if the system declares no such type
 */
export function resolveCostTypeLabel(system, costTypeId) {
  const costType = system?.costTypes?.find(candidate => candidate.id === costTypeId);
  return costType?.name?.trim() ?? '';
}

/** The display name of the cost type a roster is measured in. */
export function resolveCostLimitLabel(roster, system) {
  return resolveCostTypeLabel(system, resolveCostLimitTypeId(roster, system));
}
