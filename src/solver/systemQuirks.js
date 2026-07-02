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
const SYSTEM_QUIRKS = {
  // Warhammer Fantasy Battles, 6. Edition (BSData whfb6)
  '6d8e-38d9-3c69-febf': {
    // Heroes und Characters teilen sich ein Maximum, das im Katalog nur auf
    // der Characters-Kategorie definiert ist. Hat die Kategorie (Schlüssel)
    // keinen eigenen max-Constraint, erbt sie ihn von der Kategorie (Wert).
    inheritedCategoryMax: {
      'c16b-f319-2c62-2c12': '7a1c-d611-c2dc-def1' // Heroes ← Characters
    },
    // Einträge, die die Armeegeneral-Auswahl darstellen, aber weder über
    // Namen noch über Kategorien als solche erkennbar sind (UI-Sortierung).
    generalEntryIds: ['1b7c-2c90-6d96-28c9']
  }
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
