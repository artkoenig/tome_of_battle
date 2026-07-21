/**
 * Auswahl der Kataloge, aus denen sich eine Armeeliste bauen lässt.
 *
 * BattleScribe kennzeichnet reine Bibliothekskataloge am Wurzelelement
 * (`catalogue@library`). Sie liefern geteilte Einträge, auf die andere Kataloge
 * verweisen, stellen aber selbst keine spielbare Armee dar. Für die Auflösung
 * geteilter Einträge bleiben sie im System erhalten — sie werden dem Nutzer nur
 * nicht als Fraktion angeboten.
 */

/**
 * @param {{ catalogues?: Array<{ isLibrary?: boolean }> }} [system]
 * @returns {Array<object>} die als Armee wählbaren Kataloge des Systems.
 */
export function getPlayableCatalogues(system) {
  return (system?.catalogues ?? []).filter(catalogue => catalogue.isLibrary !== true);
}
