/**
 * Die **armeeweiten Pflicht-Selektoren eines Kontingents, gelesen aus dem
 * Bericht** (Issue 0156, ADR-0034).
 *
 * Manche Pflicht eines Armeebuchs haengt an keiner Kategorie des Kontingents —
 * kein Kategorie-Abschnitt bietet sie an, und ohne eigenen Abschnitt waere sie
 * ueberhaupt nicht waehlbar. Welche Definitionen das sind, sagt der Bericht:
 * ein Slot direkt unter dem Kontingent, sichtbar, mit einem wirksamen Minimum
 * ueber null, dessen **effektive** Kategorien keine der Kategorien des
 * Kontingents treffen. Die Oberflaeche wertete dafuer bisher Modifikatoren,
 * Bedingungen und Grenzen ein zweites Mal am Katalog aus.
 */
import { resolvedDefIdOf } from './slotIndex.js';

/** Die Ankerarten, deren Slots ueberhaupt ein Angebot des Kontingents sind. */
const CANDIDATE_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

/**
 * Die Slots der armeeweiten Pflicht-Selektoren, je Definition genau einer, in
 * Slot-Reihenfolge des Berichts.
 *
 * @param {import('./slotIndex.js').SlotIndex} slots  Die Slot-Seite des Berichts.
 * @param {string|null|undefined} forcePath  Slot-Pfad des Kontingents.
 * @param {Iterable<string>} forceCategoryIds  die Kategorien, die das Kontingent fuehrt.
 * @returns {object[]} die Faehigkeitsdatensaetze der Selektoren.
 */
export function armyWideSelectorSlotsOf(slots, forcePath, forceCategoryIds) {
  const offeredByCategory = new Set(forceCategoryIds ?? []);
  const seen = new Set();
  const selectors = [];
  for (const { capability } of slots.childSlotsOf(forcePath)) {
    if (!CANDIDATE_ANCHOR_KINDS.has(capability.anchorKind)) continue;
    if (capability.isHidden) continue;
    // Kein Minimum, keine Pflicht — und ohne Pflicht braucht es keinen eigenen
    // Abschnitt; angeboten wird der Slot dann ueber seine Kategorie.
    if (!(capability.effectiveMin > 0)) continue;
    // Erreichbar ueber eine Kategorie des Kontingents? Dann erledigt deren
    // Abschnitt die Auswahl bereits (der haeufige Fall).
    if ((capability.categoryIds ?? []).some(categoryId => offeredByCategory.has(categoryId))) continue;
    const resolvedId = resolvedDefIdOf(capability);
    if (seen.has(resolvedId)) continue;
    seen.add(resolvedId);
    selectors.push(capability);
  }
  return selectors;
}
