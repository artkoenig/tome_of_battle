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
 * Der Schritt ist eine reine Funktion ohne Zwischenspeicher: ob sein Ergebnis
 * kuenftig wiederverwendet wird — und damit, ob die Fassade ein- oder zweistufig
 * ist —, entscheidet eine Messung an echten Katalogdaten, nicht eine Vermutung
 * (Main-Issue 75, `design.md`, „Ein- oder zweistufige Fassade"). Bis dahin bleibt
 * er **engine-intern**: nach aussen fuehrt allein die Fassade.
 */

import { parseCatalogue } from './catalogReader.js';
import { mergeCatalogues } from './catalogSet.js';
import { resolveCatalogue } from './resolver.js';
import { DiagnosticKind, diagnostic } from './model.js';

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
 * Bereitet einen Datensatz rosterunabhaengig auf: liest die Spielsystemdatei und
 * die Kataloge, prueft ihre Kohaerenz, fuehrt sie in der deterministischen
 * engine-eigenen Reihenfolge zusammen (Spielsystem zuerst, dann die Kataloge in
 * Aufruf-Reihenfolge, ADR-0032 Entscheidung 1) und loest das Aggregat auf.
 *
 * Die gelesenen Dokumente bleiben **einzeln** erhalten, weil das zusammengefuehrte
 * Aggregat ihre Herkunft nicht mehr kennt: die Datensatz-Beschreibung sagt je
 * Katalog, ob er spielbar ist, und je Kontingent, aus welcher Quelle es stammt.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset
 *   Die optionale Spielsystemdatei (`.gst`-XML) und die geordnete Liste der
 *   Armee-Kataloge (`.cat`-XML).
 * @returns {{ gameSystemDocument: object|null, catalogueDocuments: object[], resolved: object, diagnostics: object[] }}
 *   Die gelesenen Dokumente, die aufgeloeste Sicht und alle im Vorlauf
 *   angefallenen Diagnosen (Zusammenfuehrung, Kohaerenz, Auflösung).
 */
export function prepareDataset(dataset) {
  const { gameSystem, catalogues = [] } = dataset;

  const gameSystemDocument = gameSystem !== undefined ? parseCatalogue(gameSystem) : null;
  const catalogueDocuments = catalogues.map(parseCatalogue);
  const documents = gameSystemDocument !== null
    ? [gameSystemDocument, ...catalogueDocuments]
    : catalogueDocuments;

  const coherenceDiagnostics = [];
  checkDatasetCoherence(gameSystemDocument, catalogueDocuments, coherenceDiagnostics);

  const merged = mergeCatalogues(documents);
  const resolved = resolveCatalogue(merged);

  return {
    gameSystemDocument,
    catalogueDocuments,
    resolved,
    diagnostics: [...merged.diagnostics, ...coherenceDiagnostics, ...resolved.diagnostics],
  };
}
