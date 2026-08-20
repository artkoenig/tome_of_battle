/**
 * Issue 0156, Kriterium 4: **eine Auswahl ausserhalb des Umfangs ihres
 * Kontingents bleibt nicht still.**
 *
 * Der Auswertungsumfang eines Kontingents ist sein Armeebuch, dessen transitive
 * `catalogueLink`-Huelle und das Spielsystem (ADR-0032, Nachtrag zu Issue 0156).
 * Ein Roster darf trotzdem eine Auswahl enthalten, die von ausserhalb stammt —
 * eine von Hand gebaute oder eine aus einer aelteren Fassung importierte Liste.
 * Was der Auswerter dann **nicht** tun darf: abstuerzen oder sie stumm
 * mitwerten. Er meldet sie als Diagnose `SELECTION_OUT_OF_CATALOGUE_SCOPE` und
 * wertet weiter (ADR-0032, Entscheidung 3: nie eine stille Teil-Auswertung).
 *
 * Beobachtet wird ausschliesslich an der oeffentlichen Fassade
 * (`prepareDataset`/`evaluate`), im Muster von `crossCatalog.test.js`.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';
import { DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0156-scope';
const OWN_CATALOGUE_ID = 'cat-own-0156';
const LINKED_CATALOGUE_ID = 'cat-linked-0156';
const FOREIGN_CATALOGUE_ID = 'cat-foreign-0156';

const OWN_FORCE_ID = 'force-own-0156';
const OWN_UNIT_ID = 'unit-own-0156';
const LINKED_UNIT_ID = 'unit-linked-0156';
const FOREIGN_UNIT_ID = 'unit-foreign-0156';
const GST_SHARED_UNIT_ID = 'unit-gst-0156';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Scope System">
    <sharedSelectionEntries>
      <selectionEntry id="${GST_SHARED_UNIT_ID}" name="System Unit" type="unit"/>
    </sharedSelectionEntries>
  </gameSystem>`;

const OWN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${OWN_CATALOGUE_ID}" name="Own Book" gameSystemId="${GAME_SYSTEM_ID}">
    <catalogueLinks>
      <catalogueLink id="cl-own-to-linked" name="Library" type="catalogue" targetId="${LINKED_CATALOGUE_ID}"/>
    </catalogueLinks>
    <forceEntries>
      <forceEntry id="${OWN_FORCE_ID}" name="Own Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${OWN_UNIT_ID}" name="Own Unit" type="unit"/>
    </selectionEntries>
  </catalogue>`;

const LINKED_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${LINKED_CATALOGUE_ID}" name="Linked Library" gameSystemId="${GAME_SYSTEM_ID}" library="true">
    <sharedSelectionEntries>
      <selectionEntry id="${LINKED_UNIT_ID}" name="Linked Unit" type="unit"/>
    </sharedSelectionEntries>
  </catalogue>`;

const FOREIGN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${FOREIGN_CATALOGUE_ID}" name="Foreign Book" gameSystemId="${GAME_SYSTEM_ID}">
    <selectionEntries>
      <selectionEntry id="${FOREIGN_UNIT_ID}" name="Foreign Unit" type="unit"/>
    </selectionEntries>
  </catalogue>`;

const DATASET = {
  gameSystem: GAME_SYSTEM_XML,
  catalogues: [OWN_CATALOGUE_XML, LINKED_CATALOGUE_XML, FOREIGN_CATALOGUE_XML],
};

/** Ein Roster mit einem Kontingent des eigenen Buchs und den gegebenen Auswahlen. */
function rosterWith(...defIds) {
  return {
    forces: [{
      defId: OWN_FORCE_ID,
      count: 1,
      children: defIds.map(defId => ({ defId, count: 1, children: [] })),
    }],
  };
}

/** Die Umfangs-Diagnosen des Berichts. */
function scopeDiagnosticsOf(report) {
  return report.diagnostics.filter(
    entry => entry.kind === DiagnosticKind.SELECTION_OUT_OF_CATALOGUE_SCOPE,
  );
}

describe('Issue 0156, Kriterium 4: eine Auswahl ausserhalb des Umfangs wird gemeldet', () => {
  it('meldet SELECTION_OUT_OF_CATALOGUE_SCOPE fuer die Einheit eines fremden Armeebuchs', () => {
    const report = evaluate(prepareDataset(DATASET), rosterWith(FOREIGN_UNIT_ID));

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.SELECTION_OUT_OF_CATALOGUE_SCOPE,
        defId: FOREIGN_UNIT_ID,
        sourceId: FOREIGN_CATALOGUE_ID,
        forceCatalogueId: OWN_CATALOGUE_ID,
      }),
    );
  });

  it('wertet dieselbe Liste trotzdem zu Ende aus — kein Absturz, keine halbe Auswertung', () => {
    // Die zweite Haelfte von Kriterium 4: die Diagnose ersetzt die Auswertung
    // nicht. Der Slot der fremden Auswahl steht im Faehigkeitsdatensatz wie jeder
    // andere belegte Slot.
    const report = evaluate(prepareDataset(DATASET), rosterWith(OWN_UNIT_ID, FOREIGN_UNIT_ID));

    const defIds = [...report.capabilities.values()].map(capability => capability.defId);
    expect(defIds).toContain(OWN_UNIT_ID);
    expect(defIds).toContain(FOREIGN_UNIT_ID);
  });

  it('Kontrast: die eigene Einheit erzeugt keine Umfangs-Diagnose', () => {
    const report = evaluate(prepareDataset(DATASET), rosterWith(OWN_UNIT_ID));

    expect(scopeDiagnosticsOf(report)).toEqual([]);
  });

  it('Kontrast: ein Eintrag aus dem per catalogueLink verlinkten Katalog liegt im Umfang', () => {
    // Der Unterschied, um den es Issue 0156 geht: verlinkt ist drinnen, nicht
    // verlinkt ist draussen — `importRootEntries` spielt dafuer keine Rolle, der
    // Link traegt es hier gar nicht.
    const report = evaluate(prepareDataset(DATASET), rosterWith(LINKED_UNIT_ID));

    expect(scopeDiagnosticsOf(report)).toEqual([]);
  });

  it('Kontrast: ein geteilter Eintrag des Spielsystems liegt in jedem Kontingent im Umfang', () => {
    const report = evaluate(prepareDataset(DATASET), rosterWith(GST_SHARED_UNIT_ID));

    expect(scopeDiagnosticsOf(report)).toEqual([]);
  });
});
