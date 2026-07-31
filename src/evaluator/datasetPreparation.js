/**
 * Vorbereitung des Datensatzes — der **rosterunabhaengige** Katalog-Vorlauf der
 * Engine als eigener, benannter Schritt: *lesen → zusammenfuehren → aufloesen*
 * (`docs/evaluator-architecture.md` §3.1, ADR-0032).
 *
 * Er ist die gemeinsame Grundlage der beiden Fragen, die die Fassade beantwortet:
 * die Auswertung eines Rosters (`evaluate`) und die Beschreibung des Datensatzes
 * ohne Roster (`describeDataset`). Beide laufen ueber **diese eine**
 * Implementierung — es gibt keinen zweiten Weg, aus XML eine aufgeloeste Sicht zu
 * machen.
 *
 * Der Schritt ist eine reine Funktion ohne eigenen Zwischenspeicher. Ob sein
 * Ergebnis wiederverwendet wird, hat eine Messung an echten Katalogdaten
 * entschieden und nicht eine Vermutung (Main-Issue 75, `design.md`, „Ein- oder
 * zweistufige Fassade"): der Vorlauf macht **98,9–99,5 %** einer vollstaendigen
 * Auswertung aus und reisst damit die vorab festgelegte Schwelle von 50 % um
 * Groessenordnungen. Die Fassade ist deshalb **zweistufig** — sie exportiert
 * diesen Schritt, und Auswertung wie Beschreibung arbeiten auf seinem Ergebnis.
 *
 * Nach aussen gereicht wird dabei nicht die aufgeloeste Sicht selbst, sondern ein
 * **undurchsichtiger Griff** ({@link PreparedDataset}): der Aufrufer haelt den
 * aufbereiteten Datensatz und gibt ihn zurueck, kann aber in ihn nicht
 * hineingreifen. Genau das ist der Zweck des Main-Issues — die Oberflaeche
 * bekommt keine Kenntnis der Engine-Interna, sondern allein den Bericht
 * (ADR-0034).
 */

import { parseCatalogue } from './catalogReader.js';
import {
  mergeCatalogues,
  buildPrimaryCatalogueIndex,
  buildDefinitionSourceIndex,
  buildCatalogueRootEntryClosure,
  buildLibraryCatalogueIds,
  buildDeclaredCatalogueLinkIndex,
} from './catalogSet.js';
import { resolveCatalogue } from './resolver.js';
import { DiagnosticKind, diagnostic } from './model.js';
import { MeasuredPhase, measurementFor } from './measurement.js';

/**
 * Prueft die Kohaerenz des Datensatzes und meldet sie als Diagnose statt einer
 * stillen Teil-Auswertung (ADR-0032, Entscheidung 3):
 *
 * - **`GAMESYSTEM_MISMATCH`**: ein Katalog nennt eine `gameSystemId`, die nicht zur
 *   mitgegebenen `.gst` passt.
 * - **`MISSING_CATALOGUE_DEPENDENCY`**: ein Katalog deklariert per `catalogueLink`
 *   eine Abhaengigkeit auf einen Katalog, der nicht mitgegeben wurde.
 *
 * Ohne mitgegebenes Spielsystem entfaellt die `gameSystemId`-Pruefung (ein
 * synthetischer Einzelkatalog ohne `.gst`).
 */
function checkDatasetCoherence(gameSystemDocument, catalogueDocuments, diagnostics) {
  const providedCatalogueIds = new Set(catalogueDocuments.map(document => document.id));
  for (const catalogue of catalogueDocuments) {
    if (gameSystemDocument !== null && catalogue.gameSystemId !== null && catalogue.gameSystemId !== gameSystemDocument.id) {
      diagnostics.push(diagnostic(DiagnosticKind.GAMESYSTEM_MISMATCH, {
        catalogueId: catalogue.id,
        gameSystemId: catalogue.gameSystemId,
        expected: gameSystemDocument.id,
      }));
    }
    for (const link of catalogue.catalogueLinks ?? []) {
      if (!providedCatalogueIds.has(link.targetId)) {
        diagnostics.push(diagnostic(DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY, {
          catalogueId: catalogue.id,
          targetId: link.targetId,
          name: link.name,
        }));
      }
    }
  }
}

/**
 * Der **aufbereitete Datensatz** — das Ergebnis des Katalog-Vorlaufs als
 * undurchsichtiger Griff.
 *
 * Er traegt keine oeffentliche Eigenschaft: von aussen ist er nichts als ein Wert,
 * den man von {@link prepareDataset} bekommt und an die Fassade zurueckgibt. Die
 * aufgeloeste Sicht, die gelesenen Dokumente und die Diagnosen des Vorlaufs liegen
 * in einem privaten Feld und sind allein ueber {@link PreparedDataset.contentsOf}
 * erreichbar — engine-intern, denn nach aussen fuehrt nur die Fassade
 * (`evaluator.js`, maschinell durchgesetzt).
 *
 * Warum ueberhaupt gekapselt: die zweistufige Fassade gibt dem Aufrufer einen
 * Zwischenstand in die Hand. Gaebe sie ihm die aufgeloeste Sicht offen, waere aus
 * der Wiederverwendung eines Ergebnisses ein Wissen ueber den inneren Aufbau der
 * Engine geworden — dieselbe Kopplung, deren Beseitigung der ganze Umbau
 * bezweckt (ADR-0034).
 */
export class PreparedDataset {
  /** @type {{ gameSystemDocument: object|null, catalogueDocuments: object[], resolved: object, primaryCatalogueByForceDefId: Map<string, string>, sourceIdByDefId: Map<string, string>, catalogueRootEntryClosureById: Map<string, Set<string>>, libraryCatalogueIds: Set<string>, linkedCatalogueIdsById: Map<string, Set<string>>, diagnostics: object[] }} */
  #contents;

  /** @param {{ gameSystemDocument: object|null, catalogueDocuments: object[], resolved: object, primaryCatalogueByForceDefId: Map<string, string>, sourceIdByDefId: Map<string, string>, catalogueRootEntryClosureById: Map<string, Set<string>>, libraryCatalogueIds: Set<string>, linkedCatalogueIdsById: Map<string, Set<string>>, diagnostics: object[] }} contents */
  constructor(contents) {
    this.#contents = contents;
  }

  /**
   * Der Inhalt eines aufbereiteten Datensatzes — **engine-intern**.
   *
   * @param {PreparedDataset} prepared  Das Ergebnis von {@link prepareDataset}.
   * @returns {{ gameSystemDocument: object|null, catalogueDocuments: object[], resolved: object, primaryCatalogueByForceDefId: Map<string, string>, sourceIdByDefId: Map<string, string>, catalogueRootEntryClosureById: Map<string, Set<string>>, libraryCatalogueIds: Set<string>, linkedCatalogueIdsById: Map<string, Set<string>>, diagnostics: object[] }}
   * @throws {TypeError} Wenn kein aufbereiteter Datensatz uebergeben wurde. Das ist
   *   der haeufigste Aufruffehler der zweistufigen Fassade — ein roher Datensatz
   *   `{ gameSystem, catalogues }` statt seines aufbereiteten Ergebnisses —, und er
   *   faellt hier sofort mit klarer Meldung auf, statt spaeter als fehlendes Feld.
   */
  static contentsOf(prepared) {
    if (!(prepared instanceof PreparedDataset)) {
      throw new TypeError(
        'Erwartet wird ein mit `prepareDataset(datensatz)` aufbereiteter Datensatz, nicht der rohe ' +
          'Datensatz `{ gameSystem, catalogues }`. Die Fassade ist zweistufig: einmal aufbereiten, ' +
          'dann dasselbe Ergebnis fuer beliebig viele Auswertungen wiederverwenden.',
      );
    }
    return prepared.#contents;
  }
}

/**
 * Bereitet einen Datensatz rosterunabhaengig auf: liest die Spielsystemdatei und
 * die Kataloge, prueft ihre Kohaerenz, fuehrt sie in der deterministischen
 * engine-eigenen Reihenfolge zusammen (Spielsystem zuerst, dann die Kataloge in
 * Aufruf-Reihenfolge, ADR-0032 Entscheidung 1) und loest das Aggregat auf.
 *
 * Die gelesenen Dokumente bleiben **einzeln** erhalten, weil das zusammengefuehrte
 * Aggregat ihre Herkunft nicht mehr kennt: die Datensatz-Beschreibung sagt je
 * Katalog, ob er spielbar ist, und je Kontingent, aus welcher Quelle es stammt.
 * Aus derselben Quelle entsteht der **Herkunftsindex der Kontingente**
 * (`primaryCatalogueByForceDefId`, {@link buildPrimaryCatalogueIndex}), den das
 * Query-Primitiv fuer den Bezugsrahmen `primary-catalogue` liest (Issue 077),
 * und der **Herkunftsindex der Definitionen** (`sourceIdByDefId`,
 * {@link buildDefinitionSourceIndex}), aus dem der Bericht je Slot seine
 * `sourceId` liest (Issue 0121) — anders als jener ueber **alle** Dokumente,
 * das Spielsystem eingeschlossen. Aus denselben Katalog-Dokumenten entsteht
 * ausserdem der **Wurzel-Angebots-Fussabdruck** je Katalog
 * (`catalogueRootEntryClosureById`, {@link buildCatalogueRootEntryClosure}):
 * welche Katalog-Herkuenfte als „zu diesem Katalog gehoerig" gelten, ihn
 * selbst und die per `catalogueLink importRootEntries="true"` importierten
 * eingeschlossen (Issue 0098) — und daneben die Menge der
 * **Bibliothekskataloge** (`libraryCatalogueIds`,
 * {@link buildLibraryCatalogueIds}), die derselbe Rahmen ausnimmt wie das
 * Spielsystem: eine Bibliothek ist kein fremdes Armeebuch (Issue 0140). Alle
 * vier sind rosterunabhaengig und gehoeren deshalb in den Vorlauf, nicht in die
 * Auswertung.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset
 *   Die optionale Spielsystemdatei (`.gst`-XML) und die geordnete Liste der
 *   Armee-Kataloge (`.cat`-XML).
 * @param {{ measure?: boolean }} [options]
 *   Der **Mess-Modus** als Opt-in (Issue 0138): unter `{ measure: true }` stoppt
 *   der Vorlauf seine eigene Dauer. Fehlende Optionen, ein leeres Optionsobjekt
 *   und `{ measure: false }` sind der Normalpfad — dort laeuft kein Zeitgeber.
 * @returns {PreparedDataset & { measurement?: import('./measurement.js').PreparationMeasurement }}
 *   Der aufbereitete Datensatz als undurchsichtiger Griff: er haelt die gelesenen
 *   Dokumente, die aufgeloeste Sicht und alle im Vorlauf angefallenen Diagnosen
 *   (Zusammenfuehrung, Kohaerenz, Auflösung), gibt sie nach aussen aber nicht preis.
 *
 *   Im Mess-Modus traegt er zusaetzlich die **eigene** Eigenschaft `measurement`
 *   (`{ phases: { preparation } }`). Sie existiert nur dann: ungemessen bleibt der
 *   Griff eine Sache ohne jede aufzaehlbare Eigenschaft, wie ihn die Fassade
 *   zusichert.
 */
export function prepareDataset(dataset, options) {
  const measurement = measurementFor(options);
  return measurement.attachTo(measurement.phase(MeasuredPhase.PREPARATION, () => prepare(dataset)));
}

/**
 * Der Vorlauf selbst — der gemessene Abschnitt, ohne jedes Wissen darum, dass er
 * gemessen wird.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset
 * @returns {PreparedDataset}
 */
function prepare(dataset) {
  const { gameSystem, catalogues = [] } = dataset;

  // Die Fassade kennt keine Dateinamen (der Datensatz-Vertrag traegt nackte
  // XML-Strings); als Quellname fuer die Lese-Diagnosen dient deshalb die Rolle
  // im Datensatz: `gameSystem` bzw. `catalogue[<index>]` in Aufruf-Reihenfolge.
  const gameSystemDocument = gameSystem !== undefined
    ? parseCatalogue(gameSystem, { sourceName: 'gameSystem' })
    : null;
  const catalogueDocuments = catalogues.map((catalogueXml, index) =>
    parseCatalogue(catalogueXml, { sourceName: `catalogue[${index}]` }));
  const documents = gameSystemDocument !== null
    ? [gameSystemDocument, ...catalogueDocuments]
    : catalogueDocuments;

  const coherenceDiagnostics = [];
  checkDatasetCoherence(gameSystemDocument, catalogueDocuments, coherenceDiagnostics);

  const merged = mergeCatalogues(documents);
  const resolved = resolveCatalogue(merged);

  return new PreparedDataset({
    gameSystemDocument,
    catalogueDocuments,
    resolved,
    // Nur die Kataloge: ein `primary-catalogue` ist ein Armeebuch, die `.gst`
    // ist keines (Issue 077).
    primaryCatalogueByForceDefId: buildPrimaryCatalogueIndex(catalogueDocuments),
    // Alle Dokumente, das Spielsystem eingeschlossen: ein geteilter Eintrag der
    // `.gst` hat als Herkunft die Spielsystem-Id (Issue 0121).
    sourceIdByDefId: buildDefinitionSourceIndex(documents),
    // Nur die Kataloge, wie beim Herkunftsindex der Kontingente: der
    // Wurzel-Angebots-Fussabdruck eines Katalogs ist eine Eigenschaft von
    // `catalogueLink`s, die nur zwischen Katalogen bestehen (Issue 0098).
    catalogueRootEntryClosureById: buildCatalogueRootEntryClosure(catalogueDocuments),
    // Ebenfalls nur die Kataloge: das `library`-Kennzeichen ist ein Attribut der
    // `.cat`-Wurzel; ein Bibliothekskatalog ist nie ein fremdes Armeebuch (Issue 0140).
    libraryCatalogueIds: buildLibraryCatalogueIds(catalogueDocuments),
    // Worueber ein Katalog sich per `catalogueLink` ausdruecklich geaeussert hat:
    // die Grenze der Bibliotheks-Ausnahme (Issue 0140, siehe isInCatalogueScope).
    linkedCatalogueIdsById: buildDeclaredCatalogueLinkIndex(catalogueDocuments),
    diagnostics: [...merged.diagnostics, ...coherenceDiagnostics, ...resolved.diagnostics],
  });
}
