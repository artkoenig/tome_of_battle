/**
 * Reine Lookups ueber die Kostenarten der Datensatz-Beschreibung und die
 * Kostensummen des Evaluator-Berichts (Issue 0121, Task 7; ADR-0034).
 *
 * Die Beschreibung (`describeSystem(...).costTypes`) sagt, welche Kostenarten
 * es gibt, wie sie heissen und ob der Autor sie ausblendet; der Bericht
 * (`costTotals`) sagt, was davon verplant ist. Was die Oberflaeche daraus
 * anzeigt — das Limit-Label, die Extra-Ressourcen-Leiste — sind reine Lookups
 * auf diese beiden Quellen und gehoeren deshalb zum Verbraucher, nicht in die
 * Engine (Leitprinzip 3). Dieses Modul rechnet nichts nach.
 */

/**
 * Die Kostenart, in der ein Roster gemessen wird: seine eingestellte
 * Limit-Kostenart, ersatzweise die **erste** deklarierte Kostenart des
 * Datensatzes (keine Id ist fuer Punkte reserviert — die erste Deklaration
 * ist der einzige vertretbare Ersatz).
 *
 * @param {{ costLimitType?: string|null }|null|undefined} roster
 * @param {ReadonlyArray<{ id: string }>|null|undefined} costTypes
 *   `description.costTypes` der Datensatz-Beschreibung.
 * @returns {string|null}
 */
export function costLimitTypeIdOf(roster, costTypes) {
  return roster?.costLimitType ?? costTypes?.[0]?.id ?? null;
}

/**
 * Der Klartext-Name einer Kostenart aus der Datensatz-Beschreibung.
 * Katalog-Autoren fuehren fuehrende Leerzeichen (`" Casting Dice"`), deshalb
 * wird getrimmt — die **einzige** Veraenderung; nie uebersetzt oder gekuerzt.
 *
 * @param {ReadonlyArray<{ id: string, name: string }>|null|undefined} costTypes
 * @param {string|null} costTypeId
 * @returns {string} der Name, oder '' ohne passende Deklaration.
 */
function costTypeLabelOf(costTypes, costTypeId) {
  const costType = (costTypes ?? []).find(candidate => candidate.id === costTypeId);
  return costType?.name?.trim() ?? '';
}

/**
 * Das Anzeige-Label der Limit-Kostenart eines Rosters (bzw. — ohne Roster —
 * der ersten Kostenart des Datensatzes).
 *
 * @param {{ costLimitType?: string|null }|null|undefined} roster
 * @param {ReadonlyArray<{ id: string, name: string }>|null|undefined} costTypes
 * @returns {string}
 */
export function costLimitLabelOf(roster, costTypes) {
  return costTypeLabelOf(costTypes, costLimitTypeIdOf(roster, costTypes));
}

/**
 * Die armee-weiten Extra-Ressourcen (z. B. Casting/Dispel Dice): alle
 * **Nicht-Limit**-Kostenarten mit Summe ≠ 0. Eine als `hidden` deklarierte
 * Kostenart bleibt ausgeschlossen (bestehende Anzeige-Observable; die
 * Beschreibung traegt `isHidden`).
 *
 * @param {Readonly<Record<string, number>>|null|undefined} costTotals
 *   die roster-weite Kostensumme je Kostenart aus dem Bericht.
 * @param {ReadonlyArray<{ id: string, name: string, isHidden?: boolean }>|null|undefined} costTypes
 * @param {string|null} limitCostTypeId  die Limit-Kostenart des Rosters.
 * @returns {Array<{ id: string, name: string, total: number }>}
 */
export function extraResourceTotalsOf(costTotals, costTypes, limitCostTypeId) {
  return (costTypes ?? [])
    .filter(costType => costType.id !== limitCostTypeId)
    .filter(costType => costType.isHidden !== true)
    .map(costType => ({
      id: costType.id,
      name: costType.name?.trim() ?? '',
      total: costTotals?.[costType.id] ?? 0,
    }))
    .filter(resource => resource.total !== 0);
}
