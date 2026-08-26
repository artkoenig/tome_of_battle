/**
 * Die zwei Ids einer Auswahl — und die zwei Begriffe, die sie tragen.
 *
 * Eine `Selection` nennt zwei Ids: den **Verweis**, über den sie gesetzt wurde
 * (`entryLinkId`), und den **Katalogeintrag**, auf den sie zeigt
 * (`selectionEntryId`). Welche der beiden zählt, hängt allein davon ab, auf
 * welcher Seite von `reconcileImportedSelectionIds` (ADR 0011 §2, umgesetzt in
 * `contexts/armylist/model/rosterSync.js`) man steht:
 *
 * - **Danach** — und das ist jedes Roster, das die App führt, speichert,
 *   anzeigt, auswertet oder exportiert — identifiziert der Verweis die Auswahl.
 *   Ein `entryLink` trägt eigene Constraints, Kosten und Kinder
 *   (`docs/battlescribe-data-format.md` §7.2), derselbe Zieleintrag kostet über
 *   zwei Verweise also Verschiedenes. Dafür ist `selectionIdentityId` da.
 * - **Davor** — beim Einlesen einer fremden `.ros`, bevor der Abgleich die Ids
 *   auf die Identitätsregel normiert — nennt die Datei ihr **Ziel**, und nur
 *   darüber findet sich die Katalogoption wieder. Dafür ist
 *   `importedCatalogueEntryId` da.
 *
 * Warum das eine eigene Datei ist: `findEntryInSystem` indiziert Verweis-Ids und
 * Eintrags-Ids in einem Topf, jede der beiden Reihenfolgen löst also **immer**
 * auf irgendetwas auf. Ein Griff in die falsche liefert stumm den falschen
 * Eintrag. Die Unterscheidung darf deshalb nicht in der Reihenfolge zweier
 * Operanden eines Inline-Ausdrucks stecken, sondern gehört in einen Namen.
 *
 * Beide Funktionen behandeln den leeren String wie ein fehlendes Attribut: der
 * `.ros`-Serialisierer schreibt für eine direkt gesetzte Auswahl
 * `entryLinkId=""`, und BattleScribe tut es ebenso.
 */

/**
 * @param {string|null|undefined} preferred
 * @param {string|null|undefined} fallback
 * @returns {string|null}
 */
function firstPresent(preferred, fallback) {
  return preferred || fallback || null;
}

/**
 * Die Id, die eine Auswahl **identifiziert** — der Verweis, sonst der Eintrag.
 *
 * Gilt **nach** `reconcileImportedSelectionIds`, also überall im laufenden
 * Modell: Schreibmodell, Oberfläche, ACL des Evaluators, Export.
 *
 * @param {{ entryLinkId?: string|null, selectionEntryId?: string|null }} selection
 * @returns {string|null} `null`, wenn die Auswahl weder Verweis noch Eintrag
 *   nennt — sie löst dann in keinem Katalog auf.
 */
export function selectionIdentityId(selection) {
  return firstPresent(selection.entryLinkId, selection.selectionEntryId);
}

/**
 * Die Id des Katalogeintrags, auf den sich eine **noch nicht abgeglichene**
 * Auswahl beruft — der Eintrag, sonst der Verweis.
 *
 * Gilt **vor** `reconcileImportedSelectionIds`, also allein auf dem Importweg:
 * eine fremde `.ros` nennt dort ihr Ziel, und nur darüber lässt sich die
 * Katalogoption finden, gegen die abgeglichen wird. Auf einem abgeglichenen
 * Roster ist genau eines der beiden Felder gesetzt — dann antwortet diese
 * Funktion wie `selectionIdentityId`.
 *
 * @param {{ entryLinkId?: string|null, selectionEntryId?: string|null }} selection
 * @returns {string|null} `null`, wenn die Auswahl weder Eintrag noch Verweis nennt.
 */
export function importedCatalogueEntryId(selection) {
  return firstPresent(selection.selectionEntryId, selection.entryLinkId);
}
