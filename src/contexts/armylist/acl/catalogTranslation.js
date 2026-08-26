import { findForceEntryById } from '../model/index.js';

/**
 * **Die Übersetzungsschicht der Liste (Anti-Corruption Layer).**
 *
 * Hier — und nur hier — endet das Vokabular des Fremdformats. Was der
 * BattleScribe-Katalog `categoryLinks`, `targetId`, `selectionEntries`,
 * `entryLinks`, `selectionEntryGroups` oder `infoLinks` nennt, verlässt diesen
 * Ordner ausschließlich in **unseren** Worten: eine Kategorie mit Id und Namen,
 * ein Angebot, eine Optionsgruppe. Das Gegenstück im Regelwerks-Kontext ist
 * `src/contexts/ruleengine/acl/rosterAdapter.js`; diese Naht tut für die
 * Darstellung, was jene für die Auswertung tut.
 *
 * Die Naht ist eng gehalten: Was der **Bericht** schon beantwortet (ADR-0034),
 * wird dort gelesen und nicht hier ein zweites Mal aus dem Katalog abgeleitet.
 * Diese Funktionen bleiben deshalb auf die wenigen Fragen beschränkt, die der
 * Bericht nicht führt — die Kategorien, die ein Kontingent überhaupt anbietet,
 * und die Identität bzw. der Umfang eines Katalog-Eintrags, den das
 * Schreibmodell ohnehin durchreicht.
 *
 * ## Abbildungsregeln (mapping rules)
 *
 * 1. **Kategorie**: Ein `categoryLink` eines `forceEntry` ist bei uns eine
 *    *Kategorie des Kontingents* `{ id, name, anchorIds }`. Die `id` ist das
 *    Ziel des Verweises (`targetId`) — nicht die Id des Verweises selbst, denn
 *    eine Auswahl trägt die Ziel-Id als `category`.
 * 2. **Name**: Der Name kommt aus der Kategorie-Definition des Spielsystems,
 *    ersatzweise vom Verweis. Der Verweis darf umbenennen, die Definition ist
 *    die Wahrheit; fehlt beides, ist der Name `null` und die Anzeige setzt ihre
 *    eigene Ersatzbeschriftung.
 * 3. **Anker-Ids**: Der Evaluator verankert eine Kategorie je nach Katalog am
 *    Verweis oder an der Kategorie selbst (Anker-Vertrag aus `report.js`).
 *    Beide Ids reist die Kategorie deshalb als `anchorIds` mit — in der
 *    Reihenfolge „Kategorie zuerst, Verweis danach“ —, damit die Darstellung
 *    ihren Anker findet, ohne den Unterschied zu kennen.
 * 4. **Angebot**: Ein Katalog-Eintrag, den das Schreibmodell zum Ausheben
 *    braucht, ist ein *Angebot*. Seine Identität ist die eigene Id **und** —
 *    bei einem Verweis — die Id des verwiesenen Eintrags; ein Slot des Berichts
 *    trägt dieselbe Identität als `defId`/`targetDefId`.
 * 5. **Umfang**: Ob ein Eintrag eigene Kinder hat, ist eine Zahl, keine drei
 *    Listen: Unter-Einträge, Verweise und Gruppen zählen gleich. Die
 *    Darstellung fragt „hat das etwas unter sich?“, nicht „welche der drei
 *    Sammlungen des Formats ist gefüllt?“.
 */

/**
 * @typedef {{ id: string, name: string|null, anchorIds: Array<string> }} ForceCategory
 */

/**
 * Die Kategorien, die ein Kontingent anbietet — in der Reihenfolge des
 * Katalogs (Abbildungsregeln 1–3).
 *
 * @param {Object|null} system geparstes Spielsystem
 * @param {string|null|undefined} forceEntryId Definition des Kontingents
 * @returns {Array<ForceCategory>}
 */
export function forceCategoriesOf(system, forceEntryId) {
  const forceDefinition = findForceEntryById(system, forceEntryId);
  const links = forceDefinition?.categoryLinks || [];
  const definitions = system?.categoryEntries || [];
  return links.map(link => {
    const id = link.targetId;
    const definition = definitions.find(entry => entry.id === id);
    return {
      id,
      name: definition ? definition.name : (link.name ?? null),
      anchorIds: [id, link.id].filter(Boolean),
    };
  });
}

/**
 * Die Definitions-Ids, unter denen ein Angebot bekannt ist (Abbildungsregel 4).
 *
 * @param {Object|null|undefined} entry Katalog-Eintrag
 * @returns {Array<string>}
 */
export function offerDefIdsOf(entry) {
  return [entry?.id, entry?.targetId].filter(Boolean);
}

/**
 * Ob ein Angebot denselben Eintrag meint wie ein Slot des Berichts
 * (Abbildungsregel 4). Ein Verweis zählt nur über sein Ziel: seine eigene Id
 * ist die des Verweises, die der Bericht als `defId` führt.
 *
 * @param {Object|null|undefined} entry Katalog-Eintrag
 * @param {{ defId?: string, targetDefId?: string|null }|null|undefined} slot Slot des Berichts
 * @returns {boolean}
 */
export function offerIdentifiesSlot(entry, slot) {
  if (!entry || !slot) return false;
  if (entry.id === slot.defId || entry.id === slot.targetDefId) return true;
  return Boolean(entry.targetId) && entry.targetId === slot.targetDefId;
}

/**
 * Die Unter-Angebote eines Eintrags — die Einträge, die er selbst mitbringt
 * (Abbildungsregel 5).
 *
 * @param {Object|null|undefined} entry Katalog-Eintrag
 * @returns {Array<Object>}
 */
export function childOffersOf(entry) {
  return entry?.selectionEntries || [];
}

/**
 * Wie viel ein Eintrag unter sich führt — Unter-Einträge, Verweise und Gruppen
 * zusammen (Abbildungsregel 5).
 *
 * @param {Object|null|undefined} entry Katalog-Eintrag
 * @returns {number}
 */
export function childOfferCountOf(entry) {
  return (entry?.selectionEntries?.length || 0)
    + (entry?.entryLinks?.length || 0)
    + (entry?.selectionEntryGroups?.length || 0);
}
