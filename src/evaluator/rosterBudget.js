/**
 * Das Wert-Objekt der **eingestellten Roster-Kostengrenzen** (`design.md`,
 * Main-Issue 68). Es kapselt die aus dem `.ros`-`<costLimits>` mitgegebene
 * Zuordnung Kostenart → eingestellter Grenzwert und ist damit die einzige Quelle
 * der Wahrheit (SSOT) fuer die konfigurierte Grenze je Kostenart.
 *
 * Rein und unveraenderlich: aus der Eingabeliste einmalig gebaut, danach nur
 * gelesen. Ein O(1)-`get(costTypeId)` fuer die spaetere Feldauflösung
 * (`limit::<id>`) und ein aufzaehlbares `entries()` fuer die Budget-Pruefung —
 * beide Konsumenten liegen in Folge-Slices; dieser Slice reicht das Objekt nur
 * bis in den `QueryContext` durch (`query` liest es noch nicht).
 */

/**
 * Eine einzelne eingestellte Kostengrenze: die Kostenart (per ID) und ihr
 * Grenzwert.
 *
 * @typedef {{ costTypeId: string, value: number }} CostLimit
 */

/**
 * Das unveraenderliche Budget-Wert-Objekt: die eingestellten Grenzen, per ID
 * abfragbar (`get`) und aufzaehlbar (`entries`).
 *
 * @typedef {object} RosterBudget
 * @property {(costTypeId: string) => (number | undefined)} get  der Grenzwert einer
 *   Kostenart oder `undefined`, wenn sie nicht budgetiert ist.
 * @property {() => CostLimit[]} entries  alle eingestellten Grenzen je Kostenart.
 */

/**
 * Baut aus der vollstaendigen Liste der eingestellten Kostengrenzen ein
 * unveraenderliches Budget-Wert-Objekt. Fehlt die Liste, ist das Budget leer —
 * verhaltensgleich zu einem Roster ohne Kostengrenzen.
 *
 * @param {CostLimit[]} [costLimits]  die Zuordnung Kostenart → Grenzwert je Kostenart.
 * @returns {RosterBudget}
 */
export function createRosterBudget(costLimits = []) {
  const valueByCostTypeId = new Map(
    costLimits.map(({ costTypeId, value }) => [costTypeId, value]),
  );

  return Object.freeze({
    get(costTypeId) {
      return valueByCostTypeId.get(costTypeId);
    },
    entries() {
      return [...valueByCostTypeId].map(([costTypeId, value]) => ({ costTypeId, value }));
    },
  });
}

/**
 * Das leere Budget (keine eingestellte Grenze). Gemeinsamer Standardwert, wo ein
 * Roster ohne Kostengrenzen ausgewertet wird, sodass die Konsumenten stets ein
 * gueltiges Budget-Objekt statt `undefined` erhalten.
 */
export const EMPTY_ROSTER_BUDGET = createRosterBudget();
