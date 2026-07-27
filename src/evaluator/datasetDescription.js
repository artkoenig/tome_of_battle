/**
 * Beschreibung des Datensatzes **ohne Roster** (ADR-0034, Main-Issue 75,
 * `design.md` Kontrakt 3).
 *
 * Die Oberflaeche braucht Angaben aus dem Regelsatz, fuer die es kein Roster und
 * damit keinen Slot gibt: welche Kostenarten es mit welchem Klartext-Namen gibt,
 * welche Kataloge spielbar und welche reine Bibliotheken sind, und welche
 * Kontingente sich anlegen lassen. Weil die Antwort in den Katalogdaten steht,
 * beantwortet sie die Engine — und nicht eine zweite Rechenstelle in der
 * Oberflaeche.
 *
 * Verbindlich: **keine Zaehlung, keine Grenzenauswertung, kein Roster-Bezug.**
 * Dieses Modul liest allein den aufbereiteten Datensatz
 * ({@link ./datasetPreparation.js}) und kennt weder Roster noch Auswertungsbaum.
 */

/**
 * Reduziert eine Liste identifizierbarer Angaben auf **je ID einen** Eintrag; das
 * erste Vorkommen gewinnt. Dieselbe Regel wie in der globalen Definitionstabelle
 * des Resolvers: bei deterministischer Dokumentreihenfolge (Spielsystem zuerst)
 * ist die erste Deklaration die massgebliche, und eine doppelte ID ist ohnehin
 * schon als Diagnose sichtbar.
 */
function firstOccurrencePerId(items) {
  const byId = new Map();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/**
 * Die Dokumente des Datensatzes in deterministischer Reihenfolge: das Spielsystem
 * zuerst, dann die Kataloge in Aufruf-Reihenfolge (ADR-0032 Entscheidung 1).
 */
function documentsOf(prepared) {
  return prepared.gameSystemDocument !== null
    ? [prepared.gameSystemDocument, ...prepared.catalogueDocuments]
    : prepared.catalogueDocuments;
}

/**
 * Die Kostenarten des Datensatzes: ID, Klartext-Name, Vorgabe-Grenze (`null`, wenn
 * der Katalog keine deklariert) und ob der Autor sie ausblendet. Kostenarten
 * stehen ueblicherweise im Spielsystem, duerfen laut XSD aber an jeder
 * Katalogwurzel deklariert werden — deshalb werden alle Dokumente gelesen.
 */
function costTypesOf(prepared) {
  return firstOccurrencePerId(documentsOf(prepared).flatMap(document => document.costTypes ?? []));
}

/**
 * Die Kataloge des Datensatzes: ID, Name, Spielsystem-Zugehoerigkeit und ob der
 * Katalog eine reine **Bibliothek** ist. `isLibrary` kommt aus dem
 * `library`-Kennzeichen der Katalogwurzel — spielbar ist damit jeder Katalog, der
 * keine Bibliothek ist. Bewusst **ein** Kennzeichen statt zweier: zwei Felder
 * koennten einander widersprechen.
 *
 * Die Spielsystemdatei selbst ist kein Katalog und steht deshalb nicht in dieser
 * Liste.
 */
function cataloguesOf(prepared) {
  return prepared.catalogueDocuments.map(document => ({
    id: document.id,
    name: document.name,
    gameSystemId: document.gameSystemId,
    isLibrary: document.isLibrary,
  }));
}

/**
 * Die anlegbaren Kontingente: die Kontingent-Definitionen der Dokumentwurzeln, je
 * mit ID, Name, Sichtbarkeit und der ID der Quelle, die sie beitraegt (Spielsystem
 * oder Katalog).
 *
 * **Nur die Wurzel-Kontingente.** Ein geschachtelter `forceEntry` ist ein
 * Unter-Kontingent innerhalb eines bereits angelegten und damit gerade nicht
 * eigenstaendig anlegbar.
 *
 * Ein ausgeblendetes Kontingent wird **mitgefuehrt und markiert**, nicht
 * weggelassen — sonst koennte die Oberflaeche „ausgeblendet" nicht von „gibt es
 * nicht" unterscheiden.
 */
function creatableForcesOf(prepared) {
  const forces = documentsOf(prepared).flatMap(document =>
    (document.forces ?? []).map(force => ({
      id: force.id,
      name: force.name,
      isHidden: force.isHidden,
      sourceId: document.id,
    })));
  return firstOccurrencePerId(forces);
}

/**
 * Baut die Beschreibung eines aufbereiteten Datensatzes.
 *
 * @param {{ gameSystemDocument: object|null, catalogueDocuments: object[], diagnostics: object[] }} prepared
 *   Der **Inhalt** eines aufbereiteten Datensatzes, also
 *   `PreparedDataset.contentsOf(...)` — nicht der Griff selbst. Ihn auszupacken ist
 *   Sache der Fassade; die Beschreibung arbeitet engine-intern auf den Dokumenten.
 * @returns {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] }}
 *   Die Beschreibung. Die Diagnosen sind die des Katalog-Vorlaufs — dieselben, die
 *   eine Auswertung desselben Datensatzes vor dem ersten Roster-Bezug meldet, in
 *   derselben Form. Ein Katalogfehler wird also auch ohne Roster sichtbar.
 */
export function buildDatasetDescription(prepared) {
  return {
    costTypes: costTypesOf(prepared),
    catalogues: cataloguesOf(prepared),
    creatableForces: creatableForcesOf(prepared),
    diagnostics: prepared.diagnostics,
  };
}
