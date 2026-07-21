/**
 * Geteilte BattleScribe-Format-Konstanten des Solvers.
 *
 * Ergänzt `battlescribeSchema.generated.js` (die aus der XSD erzeugten Enums) um
 * jene Schlüsselwörter, die das Format zwar festlegt, die XSD aber nicht als
 * eigenen Typ ausweist — allen voran die `scope`-Schlüsselwörter und das Präfix
 * der Roster-Limit-Felder. Jede Solver-Stelle, die eines davon braucht,
 * importiert es hier; handgeschriebene Literale sind genau der Driftpfad, den
 * ADR 0016 für die generierten Enums bereits geschlossen hat.
 */

/**
 * Die `scope`-Werte, die *keine* Eintrags-ID sind: sie benennen einen
 * Bezugsrahmen statt eines konkreten Katalogeintrags. Jeder andere scope-Wert
 * ist eine Selection-Entry- oder Kategorie-ID.
 */
export const ConstraintScope = Object.freeze({
  PARENT: 'parent',
  FORCE: 'force',
  ROSTER: 'roster'
});

export const NON_ENTRY_SCOPE_KEYWORDS = Object.freeze(Object.values(ConstraintScope));

/**
 * True, wenn `scope` einen Katalogeintrag bzw. eine Kategorie benennt statt
 * eines der Bezugsrahmen-Schlüsselwörter. Ein fehlender scope zählt als
 * Eintrags-Scope — das entspricht dem bisherigen Verhalten aller Aufrufer.
 */
export const isEntryScope = (scope) => !NON_ENTRY_SCOPE_KEYWORDS.includes(scope);

/**
 * Ein Constraint-/Condition-`field` dieser Form bindet an das *Punktelimit* des
 * Rosters (nicht an die ausgegebenen Punkte): `limit::<costTypeId>`.
 */
export const ROSTER_LIMIT_FIELD_PREFIX = 'limit::';

export const isRosterLimitField = (field) =>
  typeof field === 'string' && field.startsWith(ROSTER_LIMIT_FIELD_PREFIX);

/** Schneidet das Präfix ab und liefert die Kostenart, an die das Limit bindet. */
export const costTypeIdOfRosterLimitField = (field) =>
  field.slice(ROSTER_LIMIT_FIELD_PREFIX.length);
