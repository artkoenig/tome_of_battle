/**
 * Die **Listenregel-Ankreuzliste einer Kategorie, gelesen aus dem Bericht**
 * (Issue 0156, ADR-0034).
 *
 * Beide Fragen des Editors — „ist diese Kategorie-Sektion eine Ankreuzliste
 * statt einer Einheiten-Liste?" und „welche Regeln stehen darin, und welche
 * davon sind angehakt?" — beantworteten bislang ein zweiter Katalog-Durchlauf
 * (`src/contexts/armylist/model/listRules.js`, Modifikatoren und Grenzen inbegriffen). Sie
 * stehen aber alle im Bericht: welche Definitionen die Kategorie unter diesem
 * Kontingent anbietet (dieselbe Aufzählung, aus der der Aushebe-Dialog seine
 * Kandidaten liest), welche davon Listenregeln sind (`isListRule`), welche eine
 * eindeutige armeeweite Pflicht (`isMandatoryListRule`) und welche gerade belegt
 * sind.
 *
 * Das Modul liest nur — es wertet nichts nach. Der Katalog-Eintrag, den das
 * **Schreiben** braucht (Anhaken legt eine Selektion an), kommt über `entryOf`
 * von aussen; das ist Schreibmodell, kein Anzeigepfad.
 */
import { resolvedDefIdOf } from './slotIndex.js';

/** Die Ankerarten, deren Slots eine Kategorie überhaupt anbietet. */
const CANDIDATE_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

/**
 * Die angebotenen Slots einer Kategorie unter einem Kontingent, je Definition
 * genau einer — dieselbe Lesart wie im Aushebe-Dialog: Ankerart, Sichtbarkeit
 * und die **effektive** Primärkategorie des Berichts.
 */
function categoryCandidatesOf(slots, forcePath, categoryId) {
  const seen = new Set();
  const candidates = [];
  for (const { path, capability } of slots.childSlotsOf(forcePath)) {
    if (!CANDIDATE_ANCHOR_KINDS.has(capability.anchorKind)) continue;
    if (capability.isHidden) continue;
    if (capability.primaryCategoryId !== categoryId) continue;
    const resolvedId = resolvedDefIdOf(capability);
    if (seen.has(resolvedId)) continue;
    seen.add(resolvedId);
    candidates.push({ path, capability });
  }
  return candidates;
}

/**
 * Klassifiziert eine Kategorie-Gruppe und liefert die Zustände ihrer
 * Ankreuzliste — beides allein aus dem Bericht.
 *
 * `isListRuleGroup`: Stehen bereits Auswahlen in der Kategorie, entscheiden
 * sie (sind alle Listenregeln?); ist die Kategorie leer, entscheidet ihr
 * Angebot. Eine gemischte Kategorie ist bewusst keine Listenregel-Gruppe.
 * `states` wird nur für eine echte Listenregel-Gruppe befüllt.
 *
 * @param {import('./slotIndex.js').SlotIndex} slots  Die Slot-Seite des Berichts.
 * @param {string|null|undefined} forcePath  Slot-Pfad des Kontingents.
 * @param {string} categoryId
 * @param {{ selectionByPath?: Map<string, object>, entryOf?: (capability: object) => object|null,
 *   detailsOf?: (capability: object) => Array<object>|null }} [context]
 *   `selectionByPath`: die App-Selektionen dieses Kontingents unter ihrem
 *   Slot-Pfad (aus `pathBySelectionId`) — sie machen einen Slot „angehakt".
 *   `entryOf`: der Katalog-Eintrag einer Definition für das Schreibmodell.
 *   `detailsOf`: der Detailblock eines Slots, aus seiner Info-Projektion — die
 *   Anzeigeschicht reicht ihn herein, weil sie ihn übersetzt rendert.
 * @returns {{ isListRuleGroup: boolean, states: object[] }}
 */
export function resolveListRuleGroupFromReport(slots, forcePath, categoryId, context = {}) {
  const { selectionByPath = new Map(), entryOf = () => null, detailsOf = () => null } = context;
  const candidates = categoryCandidatesOf(slots, forcePath, categoryId);
  const occupied = candidates.filter(({ path }) => selectionByPath.has(path));
  // Belegtes schlaegt Angebot: was schon in der Kategorie steht, entscheidet
  // ueber ihre Art — genau wie zuvor die Selektionen der Kategorie.
  const judged = occupied.length > 0 ? occupied : candidates;
  const isListRuleGroup = judged.length > 0 && judged.every(({ capability }) => capability.isListRule);

  if (!isListRuleGroup) return { isListRuleGroup: false, states: [] };

  const states = candidates.map(({ path, capability }) => {
    const selection = selectionByPath.get(path) ?? null;
    return {
      entry: entryOf(capability),
      name: capability.name,
      categoryId,
      resolvedId: resolvedDefIdOf(capability),
      checked: selection !== null,
      selection,
      // Ein reiner Schalter ist die Regel, solange ihr wirksames Hoechstmass
      // keine echte Menge zulaesst; sonst faellt die Zeile auf den Mengen-Adder
      // zurueck. Kein Hoechstmass heisst „unbeschraenkt binaer" wie bisher.
      isBinary: capability.effectiveMax === null || capability.effectiveMax <= 1,
      // Behaelter-Regel: der belegte Slot fuehrt eigene Unter-Slots. Ein noch
      // nicht angehaktes Angebot hat keine — seine Unteroptionen erscheinen
      // ohnehin erst nach dem Anhaken.
      isContainer: slots.childSlotsOf(path).length > 0,
      mandatory: capability.isMandatoryListRule === true,
      // Der Detailblock der Zeile — die Anzeigeschicht leitet ihn aus der
      // Info-Projektion des Slots ab (`capability.infoElements`, ADR-0034).
      details: detailsOf(capability),
    };
  });

  return { isListRuleGroup: true, states };
}
