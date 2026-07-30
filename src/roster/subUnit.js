/**
 * Das Prädikat „eigenständige Untereinheit" — genau einmal definiert.
 *
 * Eine eigenständige Untereinheit ist ein Eintrag, der innerhalb einer Einheit
 * steht, aber selbst wie eine Einheit konfiguriert wird: er ist vom Typ `unit`
 * oder `model`, er ist *nicht* kollektiv (jede Instanz wird einzeln geführt),
 * und er bringt eigene Auswahlmöglichkeiten mit. Editor, Spielansicht,
 * Optionen-Sammler, Roster-Abgleich und Serialisierung müssen dieselbe Antwort
 * geben — vorher lagen sechs Kopien vor, zwei davon mit gegensätzlicher
 * Behandlung eines fehlenden `collective`-Attributs.
 */
import { SelectionEntryKind } from '../parser/schema/battlescribeSchema.generated.js';

/** Nur diese Eintragsarten können eine eigenständige Untereinheit sein. */
const SUB_UNIT_ENTRY_KINDS = Object.freeze([SelectionEntryKind.UNIT, SelectionEntryKind.MODEL]);

/**
 * True, wenn der aufgelöste Eintrag eigene Auswahlmöglichkeiten mitbringt —
 * direkte Einträge, verlinkte Einträge oder Auswahlgruppen.
 */
export const hasEntryChildren = (resolvedEntry) => {
  if (!resolvedEntry) return false;
  return (resolvedEntry.selectionEntries?.length > 0) ||
         (resolvedEntry.entryLinks?.length > 0) ||
         (resolvedEntry.selectionEntryGroups?.length > 0);
};

/**
 * True, wenn der Eintrag als kollektiv geführt wird. Das XML-Attribut kann als
 * echter Boolean (nach dem Parser) oder als roher String (aus unnormalisierten
 * Quellen) vorliegen; beides wird hier abgedeckt.
 *
 * Ein **fehlender** Wert gilt als „nicht kollektiv": die BattleScribe-XSD gibt
 * `collective` den Vorgabewert `false`. Diese Festlegung ist die eigentliche
 * Auflösung der früheren Gegensätzlichkeit — die Kopien im Roster-Abgleich
 * lasen `=== false`, die in der Serialisierung `!== true`, und stimmten nur
 * deshalb überein, weil der Parser das Attribut normalisiert.
 */
const isCollectiveEntry = (resolvedEntry) =>
  resolvedEntry.collective === true || resolvedEntry.collective === 'true';

/**
 * @param {object|null|undefined} resolvedEntry ein über `resolveEntry` aufgelöster Eintrag
 * @returns {boolean}
 */
export const isIndependentSubUnit = (resolvedEntry) =>
  !!resolvedEntry &&
  SUB_UNIT_ENTRY_KINDS.includes(resolvedEntry.type) &&
  !isCollectiveEntry(resolvedEntry) &&
  hasEntryChildren(resolvedEntry);
