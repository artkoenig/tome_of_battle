/**
 * Schnelle, synthetische Tests der kataloguebergreifenden Auflösung und der
 * Kohaerenz-Diagnosen der Fassade (ADR-0032) — das Gegenstueck zu den langsamen,
 * an echten Definitive-Edition-Daten laufenden E2E-Tests
 * (`e2e.realCatalog.smoke.test.js`). Hier wird das **Verhalten** an minimalen
 * Katalogen isoliert geprueft (FIRST): globale `id → Definition`-Auflösung ueber
 * Dokumentgrenzen, Zyklen-Sicherheit, die Regel „geteilte/verlinkte Eintraege
 * synthetisieren keinen Pflicht-Phantom" und die beiden Kohaerenz-Diagnosen.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';
const OTHER_GAME_SYSTEM_ID = 'gs-ffff-ffff-ffff';
const EMPTY_ARMY = { forces: [] };

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="${GAME_SYSTEM_ID}" name="Test System"></gameSystem>`;

/** Zaehlt die Diagnosen der gegebenen Art. */
function countDiagnostics(report, kind) {
  return report.diagnostics.filter(diagnostic => diagnostic.kind === kind).length;
}

/** True, wenn der Bericht eine baumelnde `entryLink`-Diagnose auf die Ziel-Id traegt. */
function hasDanglingEntryLink(report, targetId) {
  return report.diagnostics.some(
    diagnostic => diagnostic.kind === DiagnosticKind.DANGLING_ENTRY_LINK && diagnostic.targetId === targetId,
  );
}

describe('Fassade: kataloguebergreifende Auflösung ueber eine globale id→Definition-Tabelle', () => {
  const IMPORTED_ID = 'b-shared-unit';
  const CATALOGUE_A = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a" name="A" gameSystemId="${GAME_SYSTEM_ID}">
      <selectionEntries>
        <selectionEntry id="a-unit" name="A Unit" type="unit">
          <entryLinks>
            <entryLink id="a-link" name="Imported" targetId="${IMPORTED_ID}" type="selectionEntry"/>
          </entryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
  const CATALOGUE_B = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-b" name="B" gameSystemId="${GAME_SYSTEM_ID}">
      <sharedSelectionEntries>
        <selectionEntry id="${IMPORTED_ID}" name="B Shared Unit" type="unit"/>
      </sharedSelectionEntries>
    </catalogue>`;

  it('loest einen entryLink aus Katalog A auf sein Ziel in Katalog B auf, wenn beide mitgegeben sind', () => {
    const report = evaluate({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }, EMPTY_ARMY);

    expect(hasDanglingEntryLink(report, IMPORTED_ID)).toBe(false);
    expect(countDiagnostics(report, DiagnosticKind.DANGLING_ENTRY_LINK)).toBe(0);
  });

  it('meldet denselben entryLink als baumelnd, wenn nur Katalog A ohne B mitgegeben ist', () => {
    const report = evaluate({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A] }, EMPTY_ARMY);

    expect(hasDanglingEntryLink(report, IMPORTED_ID)).toBe(true);
  });
});

describe('Fassade: entryLink-Auflösung ist baumelnd- und zyklen-sicher', () => {
  it('meldet ein nirgends definiertes entryLink-Ziel als Diagnose, ohne zu stuerzen', () => {
    const MISSING_TARGET = 'no-such-target';
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-dangling" name="Dangling">
        <selectionEntries>
          <selectionEntry id="host" name="Host" type="unit">
            <entryLinks>
              <entryLink id="link" name="Broken" targetId="${MISSING_TARGET}" type="selectionEntry"/>
            </entryLinks>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    const report = evaluate({ catalogues: [catalogue] }, EMPTY_ARMY);

    expect(hasDanglingEntryLink(report, MISSING_TARGET)).toBe(true);
    expect(Array.isArray(report.violations)).toBe(true);
  });

  it('terminiert bei einer gegenseitig referenziellen entryLink-Kette (Zyklus) mit Diagnose statt Absturz', () => {
    // link-a → link-b → link-a: ohne Zyklen-Guard eine Endlosschleife.
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-cycle" name="Cycle">
        <entryLinks>
          <entryLink id="link-a" name="A" targetId="link-b" type="selectionEntry"/>
          <entryLink id="link-b" name="B" targetId="link-a" type="selectionEntry"/>
        </entryLinks>
      </catalogue>`;

    const report = evaluate({ catalogues: [catalogue] }, EMPTY_ARMY);

    expect(countDiagnostics(report, DiagnosticKind.DANGLING_ENTRY_LINK)).toBeGreaterThan(0);
    expect(Array.isArray(report.violations)).toBe(true);
  });
});

describe('Fassade: geteilte/verlinkte Eintraege synthetisieren keinen Pflicht-Phantom (ADR-0032)', () => {
  const MIN_LIMIT_ID = 'roster-min';
  const minConstraint = `<constraints><constraint id="${MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/></constraints>`;

  it('erzeugt fuer eine leere Armee KEINE Pflichtverletzung aus einem nur geteilten Eintrag', () => {
    // Der Eintrag steht ausschliesslich im geteilten Pool (Verweisziel), nicht im
    // Wurzel-Baum — seine `min`-Grenze darf keine falsche Pflicht synthetisieren.
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-shared-min" name="Shared Min">
        <sharedSelectionEntries>
          <selectionEntry id="shared-unit" name="Shared Unit" type="unit">${minConstraint}</selectionEntry>
        </sharedSelectionEntries>
      </catalogue>`;

    const report = evaluate({ catalogues: [catalogue] }, EMPTY_ARMY);

    expect(report.violations).toHaveLength(0);
  });

  it('erzeugt fuer denselben Fall am Wurzel-Eintrag SEHR WOHL eine Pflichtverletzung (Kontrast)', () => {
    // Derselbe Eintrag als regulaerer Wurzel-Eintrag: hier ist die Pflicht real und
    // schlaegt beim Fehlen an — der Gegenbeweis, dass die Ausnahme nur den Pool trifft.
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-root-min" name="Root Min">
        <selectionEntries>
          <selectionEntry id="root-unit" name="Root Unit" type="unit">${minConstraint}</selectionEntry>
        </selectionEntries>
      </catalogue>`;

    const report = evaluate({ catalogues: [catalogue] }, EMPTY_ARMY);

    expect(report.violations).toContainEqual(expect.objectContaining({ limitId: MIN_LIMIT_ID }));
  });
});

describe('Fassade: Kohaerenz-Diagnosen statt stiller Teil-Auswertung', () => {
  it('meldet GAMESYSTEM_MISMATCH, wenn die gameSystemId eines Katalogs nicht zur .gst passt', () => {
    const mismatchedCatalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-mismatch" name="Mismatch" gameSystemId="${OTHER_GAME_SYSTEM_ID}">
        <selectionEntries><selectionEntry id="unit" name="Unit" type="unit"/></selectionEntries>
      </catalogue>`;

    const report = evaluate({ gameSystem: GAME_SYSTEM_XML, catalogues: [mismatchedCatalogue] }, EMPTY_ARMY);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.GAMESYSTEM_MISMATCH,
        catalogueId: 'cat-mismatch',
        gameSystemId: OTHER_GAME_SYSTEM_ID,
        expected: GAME_SYSTEM_ID,
      }),
    );
  });

  it('meldet MISSING_CATALOGUE_DEPENDENCY, wenn ein deklarierter catalogueLink nicht mitgegeben ist', () => {
    const MISSING_DEPENDENCY_ID = 'cat-not-provided';
    const dependentCatalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-dep" name="Dependent" gameSystemId="${GAME_SYSTEM_ID}">
        <catalogueLinks>
          <catalogueLink id="cl" name="Missing" type="catalogue" targetId="${MISSING_DEPENDENCY_ID}"/>
        </catalogueLinks>
      </catalogue>`;

    const report = evaluate({ gameSystem: GAME_SYSTEM_XML, catalogues: [dependentCatalogue] }, EMPTY_ARMY);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY,
        targetId: MISSING_DEPENDENCY_ID,
      }),
    );
  });
});
