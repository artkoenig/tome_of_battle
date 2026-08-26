/**
 * Kaputtes Katalog-XML darf nie still zu einem leeren Katalog werden
 * (Issue 0097). `DOMParser` liefert fuer nicht wohlgeformtes XML ein
 * `<parsererror>`-Dokument (in jsdom hier verifiziert: unverschlossener Tag,
 * abgeschnittenes Dokument, leerer String und reiner Whitespace ergeben alle
 * eine `parsererror`-Wurzel); eine versehentlich uebergebene `.ros` traegt eine
 * wohlgeformte, aber falsche Wurzel (`roster` statt `catalogue`/`gameSystem`).
 *
 * Beide Faelle muessen als **Diagnose** sichtbar werden — der bestehende
 * `diagnostics`-Kanal des Lesers, nie ein Wurf und nie `diagnostics: []`
 * („Fehlerpfade sind explizit; nichts wird still verschluckt",
 * `docs/evaluator-architecture.md` §4):
 *
 * - Kriterium 1: nicht wohlgeformtes XML → Diagnose, die die betroffene Datei
 *   benennt. Da die heutige Signatur keinen Dateinamen kennt, wird hier der
 *   kleinste tragfaehige Vertrag festgelegt: ein optionaler zweiter Parameter
 *   `parseCatalogue(xml, { sourceName })`; der vom Aufrufer gelieferte Name
 *   muss im Diagnose-Inhalt wieder auftauchen (geprueft ueber den Wert, nicht
 *   ueber einen bestimmten Feldnamen).
 * - Kriterium 2: unerwarteter Wurzel-Tag → ebenso eine Diagnose.
 * - Kriterium 3: ein Datensatz mit einer so diagnostizierten Datei wertet
 *   nicht still „teilleer" aus — die Diagnose erreicht den Bericht der
 *   Fassade (`evaluate` wie `describeDataset`). Laut festgehaltenem Default
 *   des Issues darf die Auswertung dabei teilweise weiterlaufen; gefordert
 *   ist allein, dass die Diagnose im Bericht steht.
 *
 * Mit `KONTROLLE:` markierte Faelle pinnen den heutigen Gut-Pfad fest und
 * duerfen schon vor der Implementierung gruen sein.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from '../../../../contexts/ruleengine/engine/catalogReader.js';
import { describeDataset, evaluate, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';

// Ein bewusst unverwechselbarer Dateiname: sein Auftauchen im Diagnose-Inhalt
// kann nur vom Aufrufer stammen, nie zufaellig aus dem XML.
const SOURCE_NAME = 'Orcs and Goblins (kaputt).cat';

const GAME_SYSTEM_XML = `<?xml version="1.0"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System"/>`;

// gameSystemId absichtlich weggelassen: die Kohaerenzpruefung der Fassade
// (GAMESYSTEM_MISMATCH) bleibt so aussen vor, und jede Diagnose im Bericht kann
// nur aus dem Lesen der kaputten Datei stammen.
const VALID_CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-valid" name="Valid Army"/>`;

// Nicht wohlgeformt: der Wurzel-Tag wird nie geschlossen.
const UNCLOSED_TAG_XML = `<?xml version="1.0"?>
  <catalogue id="cat-broken" name="Broken"><entryLinks>`;

// Nicht wohlgeformt: mitten im Attribut abgeschnitten (abgebrochener Download).
const TRUNCATED_XML = `<?xml version="1.0"?>
  <catalogue id="cat-broken" name="Broken"><sharedSelectionEntries><selectionEntry id="x"`;

// Wohlgeformt, aber falsche Wurzel: eine versehentlich uebergebene .ros.
const ROSTER_ROOT_XML = `<?xml version="1.0"?>
  <roster id="roster-1" name="My Army" gameSystemId="${GAME_SYSTEM_ID}"/>`;

/** Alle Diagnosen eines Lese-Ergebnisses als ein durchsuchbarer Text. */
function diagnosticsText(result) {
  return JSON.stringify(result.diagnostics);
}

describe('parseCatalogue: nicht wohlgeformtes XML (Kriterium 1)', () => {
  it('meldet fuer einen unverschlossenen Tag eine Diagnose statt eines stillen leeren Katalogs', () => {
    const result = parseCatalogue(UNCLOSED_TAG_XML);

    expect(result.diagnostics).not.toEqual([]);
    // Diagnose-Konvention des Modells: jede Diagnose traegt ihre Art.
    for (const diag of result.diagnostics) expect(diag.kind).toBeTruthy();
  });

  it('meldet auch fuer ein mitten im Dokument abgeschnittenes XML eine Diagnose', () => {
    expect(parseCatalogue(TRUNCATED_XML).diagnostics).not.toEqual([]);
  });

  it('benennt in der Diagnose die betroffene Datei, wenn der Aufrufer sie benennt', () => {
    const result = parseCatalogue(UNCLOSED_TAG_XML, { sourceName: SOURCE_NAME });

    expect(result.diagnostics).not.toEqual([]);
    expect(diagnosticsText(result)).toContain(SOURCE_NAME);
  });

  it('meldet fuer einen leeren String eine Diagnose (Rand: leere Eingabe)', () => {
    expect(parseCatalogue('').diagnostics).not.toEqual([]);
  });

  it('meldet fuer reinen Whitespace eine Diagnose (Rand)', () => {
    expect(parseCatalogue('   \n  ').diagnostics).not.toEqual([]);
  });
});

describe('parseCatalogue: unerwarteter Wurzel-Tag (Kriterium 2)', () => {
  it('meldet fuer eine .ros-Wurzel (<roster>) eine Diagnose', () => {
    expect(parseCatalogue(ROSTER_ROOT_XML).diagnostics).not.toEqual([]);
  });

  it('benennt auch beim falschen Wurzel-Tag die betroffene Datei, wenn der Aufrufer sie benennt', () => {
    const result = parseCatalogue(ROSTER_ROOT_XML, { sourceName: SOURCE_NAME });

    expect(result.diagnostics).not.toEqual([]);
    expect(diagnosticsText(result)).toContain(SOURCE_NAME);
  });
});

describe('parseCatalogue: gueltige Wurzeln bleiben diagnosefrei (KONTROLLE)', () => {
  it('KONTROLLE: eine minimale gueltige <catalogue> erzeugt keine Diagnose', () => {
    const result = parseCatalogue(VALID_CATALOGUE_XML);

    expect(result.id).toBe('cat-valid');
    expect(result.diagnostics).toEqual([]);
  });

  it('KONTROLLE: eine minimale gueltige <gameSystem> erzeugt keine Diagnose', () => {
    const result = parseCatalogue(GAME_SYSTEM_XML);

    expect(result.id).toBe(GAME_SYSTEM_ID);
    expect(result.diagnostics).toEqual([]);
  });
});

describe('Fassade: die Diagnose erreicht den Bericht (Kriterium 3)', () => {
  it('ein Datensatz mit kaputtem Katalog wertet nicht still teilleer aus: evaluate traegt die Diagnose', () => {
    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [UNCLOSED_TAG_XML] });

    const report = evaluate(prepared, { forces: [] });

    // Heute: 0 Verletzungen gegen nichts, diagnostics: [] — ein scheinbar
    // sauberer Lauf. Gefordert: die Lese-Diagnose steht im Bericht.
    expect(report.diagnostics).not.toEqual([]);
  });

  it('auch die Datensatz-Beschreibung ohne Roster traegt die Diagnose', () => {
    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [TRUNCATED_XML] });

    expect(describeDataset(prepared).diagnostics).not.toEqual([]);
  });

  it('eine kaputte Spielsystemdatei (.gst) wird ebenso im Bericht sichtbar', () => {
    const prepared = prepareDataset({ gameSystem: UNCLOSED_TAG_XML, catalogues: [VALID_CATALOGUE_XML] });

    expect(evaluate(prepared, { forces: [] }).diagnostics).not.toEqual([]);
  });

  it('eine versehentlich als Katalog uebergebene .ros wird im Bericht sichtbar', () => {
    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [ROSTER_ROOT_XML] });

    expect(evaluate(prepared, { forces: [] }).diagnostics).not.toEqual([]);
  });

  it('KONTROLLE: ein Datensatz aus lauter gueltigen Dateien bleibt diagnosefrei', () => {
    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [VALID_CATALOGUE_XML] });

    expect(evaluate(prepared, { forces: [] }).diagnostics).toEqual([]);
  });
});
