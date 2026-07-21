/**
 * Vorgabewerte eines neuen bzw. unvollständig deklarierten Rosters.
 *
 * Bewusst eine eigene, winzige Quelle: das Punktelimit wird an drei
 * unabhängigen Stellen gebraucht (Anlege-Dialog, Import, Export) und lag zuvor
 * mehrfach als eigene Konstante bzw. als nacktes Literal vor.
 */

/** Punktelimit, wenn weder Nutzer noch Roster-Datei eines vorgeben. */
export const DEFAULT_ROSTER_COST_LIMIT = 2000;
