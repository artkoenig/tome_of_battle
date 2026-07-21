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
 * True, wenn eine Query (Constraint oder Condition) **geteilt** ist: dann zählt
 * sie alle Instanzen des Eintrags im gesamten Roster zusammen. Ist sie *nicht*
 * geteilt (`shared="false"`), zählt sie nur innerhalb der einen Instanz, an der
 * sie hängt (ADR 0003, Abschnitt 4).
 *
 * Einzige Auslegung des Attributs; jede zählende Stelle fragt hier, statt
 * `query.shared` selbst zu interpretieren. Ein fehlendes Attribut gilt als
 * geteilt — das ist der Vorgabewert der XSD (`DEFAULT_SHARED_QUERY` in
 * `xmlParser.js`), und eine im Code gebaute Query ohne das Feld soll sich
 * genauso verhalten wie geparste Katalogdaten ohne das Attribut.
 */
export const isSharedQuery = (query) => query?.shared !== false;

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
