/**
 * Deklarative Sonderfälle einzelner Spielsysteme ("Quirks").
 *
 * Manche Kataloge bilden Regeln nicht sauber im Battlescribe-Datenmodell ab
 * (z. B. Constraints, die nur implizit über eine andere Kategorie gelten).
 * Solche Fälle gehören hierher als Daten — niemals als systemspezifische
 * if-Zweige in die generische Solver-Logik.
 *
 * Schlüssel ist die ID des Spielsystems (id-Attribut der .gst-Datei).
 */
// IDs innerhalb der Warhammer-Fantasy-Battles-6.-Edition-Kataloge. Sie sind
// zwischen der alten Ergofarg-Quelle (ADR-0014) und der neuen
// Lexicanum-Imperialis-Quelle (ADR-0017) identisch – gegen echte Katalogdaten
// beider Quellen verifiziert (siehe __fixtures__/whfb6-lexicanum/README.md).
const WHFB6_HEROES_CATEGORY_ID = 'c16b-f319-2c62-2c12';
const WHFB6_CHARACTERS_CATEGORY_ID = '7a1c-d611-c2dc-def1';
const WHFB6_GENERAL_ENTRY_ID = '1b7c-2c90-6d96-28c9';

// Dasselbe Spiel wird von zwei Datenquellen mit unterschiedlicher gameSystemId,
// aber identischen internen IDs abgebildet.
const WHFB6_ERGOFARG_SYSTEM_ID = '6d8e-38d9-3c69-febf';
const WHFB6_LEXICANUM_SYSTEM_ID = '0d13-7737-ea86-4662';

// Warhammer Fantasy Battles, 6. Edition.
const WHFB6_QUIRKS = Object.freeze({
  // Heroes und Characters teilen sich ein Maximum, das im Kontingent nur auf der
  // Characters-categoryLink definiert ist. Hat die Kategorie (Schlüssel) keinen
  // eigenen max-Constraint, erbt sie ihn von der Kategorie (Wert). Im neuen
  // Datensatz gilt dieselbe Konstellation (Heroes-Link ohne, Characters-Link mit
  // force-weitem max, z. B. Lizardmen „Red Host") und Heroes ⊆ Characters, daher
  // bleibt die Regel gültig.
  inheritedCategoryMax: Object.freeze({
    [WHFB6_HEROES_CATEGORY_ID]: WHFB6_CHARACTERS_CATEGORY_ID // Heroes ← Characters
  }),
  // Einträge, die die Armeegeneral-Auswahl darstellen, aber weder über Namen
  // noch über Kategorien als solche erkennbar sind (UI-Sortierung).
  generalEntryIds: Object.freeze([WHFB6_GENERAL_ENTRY_ID])
});

// Beide gameSystemIds bilden dasselbe Spiel mit denselben IDs ab und teilen sich
// deshalb denselben (eingefrorenen) Quirk-Datensatz.
const SYSTEM_QUIRKS = {
  [WHFB6_ERGOFARG_SYSTEM_ID]: WHFB6_QUIRKS,
  [WHFB6_LEXICANUM_SYSTEM_ID]: WHFB6_QUIRKS
};

const EMPTY_QUIRKS = Object.freeze({
  inheritedCategoryMax: Object.freeze({}),
  generalEntryIds: Object.freeze([])
});

export function getSystemQuirks(system) {
  return SYSTEM_QUIRKS[system?.id] || EMPTY_QUIRKS;
}

/**
 * Liefert die Kategorie-ID, von der `categoryId` in diesem System einen
 * fehlenden max-Constraint erbt, sonst null.
 */
export function getInheritedCategoryMaxSource(system, categoryId) {
  return getSystemQuirks(system).inheritedCategoryMax[categoryId] || null;
}

/** Prüft, ob ein Eintrag laut Quirk-Daten die Armeegeneral-Auswahl darstellt. */
export function isQuirkGeneralEntryId(system, entryId) {
  return getSystemQuirks(system).generalEntryIds.includes(entryId);
}
