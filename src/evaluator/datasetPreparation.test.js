/**
 * Tests des rosterunabhaengigen Katalog-Vorlaufs `prepareDataset` (Main-Issue 75,
 * Slice 01): *lesen → zusammenfuehren → aufloesen* als **ein** benannter Schritt,
 * den sich Auswertung und Datensatz-Beschreibung teilen.
 *
 * Geprueft wird, dass er die Dokumente einzeln erhaelt (die Beschreibung braucht
 * ihre Herkunft), die aufgeloeste Sicht liefert und **alle** im Vorlauf
 * anfallenden Diagnosen sichtbar macht — die der Zusammenfuehrung, die der
 * Kohaerenzpruefung (ADR-0032, Entscheidung 3) und die der Auflösung.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { prepareDataset } from './datasetPreparation.js';
import { DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';
const OTHER_GAME_SYSTEM_ID = 'gs-ffff-ffff-ffff';
const ABSENT_CATALOGUE_ID = 'cat-missing';

const GAME_SYSTEM_XML = `<?xml version="1.0"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System"/>`;

/** Ein Katalog mit gegebener ID/Name, optional an ein abweichendes Spielsystem gebunden. */
function catalogueXml(id, name, { gameSystemId = GAME_SYSTEM_ID, body = '' } = {}) {
  return `<?xml version="1.0"?>
    <catalogue id="${id}" name="${name}" gameSystemId="${gameSystemId}">${body}</catalogue>`;
}

/** Die Diagnose-Arten des Vorlaufs in ihrer Reihenfolge. */
function diagnosticKinds(prepared) {
  return prepared.diagnostics.map(diagnostic => diagnostic.kind);
}

describe('prepareDataset: die gelesenen Dokumente bleiben einzeln erhalten', () => {
  it('trennt die Spielsystemdatei von den Katalogen und haelt deren Aufruf-Reihenfolge', () => {
    const prepared = prepareDataset({
      gameSystem: GAME_SYSTEM_XML,
      catalogues: [catalogueXml('cat-a', 'A'), catalogueXml('cat-b', 'B')],
    });

    expect(prepared.gameSystemDocument.id).toBe(GAME_SYSTEM_ID);
    expect(prepared.catalogueDocuments.map(document => document.id)).toEqual(['cat-a', 'cat-b']);
  });

  it('laesst das Spielsystem-Dokument weg, wenn keine .gst mitgegeben ist', () => {
    const prepared = prepareDataset({ catalogues: [catalogueXml('cat-a', 'A')] });

    expect(prepared.gameSystemDocument).toBeNull();
    expect(prepared.catalogueDocuments).toHaveLength(1);
  });

  it('kommt ohne jede Quelle aus (leerer Datensatz, keine Diagnose)', () => {
    const prepared = prepareDataset({});

    expect(prepared.gameSystemDocument).toBeNull();
    expect(prepared.catalogueDocuments).toEqual([]);
    expect(prepared.diagnostics).toEqual([]);
  });
});

describe('prepareDataset: aufgeloeste, rosterunabhaengige Sicht', () => {
  it('loest die Definitionen aller Quellen ueber eine gemeinsame Tabelle auf', () => {
    const catalogue = catalogueXml('cat-a', 'A', {
      body: '<selectionEntries><selectionEntry id="unit" name="Unit" type="unit"/></selectionEntries>',
    });

    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogue] });

    expect(prepared.resolved.lookup('unit').name).toBe('Unit');
  });
});

describe('prepareDataset: Diagnosen des Vorlaufs', () => {
  it('meldet einen Katalog, dessen Spielsystem nicht zur mitgegebenen .gst passt', () => {
    const prepared = prepareDataset({
      gameSystem: GAME_SYSTEM_XML,
      catalogues: [catalogueXml('cat-a', 'A', { gameSystemId: OTHER_GAME_SYSTEM_ID })],
    });

    expect(prepared.diagnostics).toContainEqual({
      kind: DiagnosticKind.GAMESYSTEM_MISMATCH,
      catalogueId: 'cat-a',
      gameSystemId: OTHER_GAME_SYSTEM_ID,
      expected: GAME_SYSTEM_ID,
    });
  });

  it('meldet eine deklarierte Katalog-Abhaengigkeit, die nicht mitgegeben wurde', () => {
    const dependent = catalogueXml('cat-a', 'A', {
      body: `<catalogueLinks><catalogueLink id="link" name="Dep" targetId="${ABSENT_CATALOGUE_ID}"/></catalogueLinks>`,
    });

    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [dependent] });

    expect(prepared.diagnostics).toContainEqual({
      kind: DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY,
      catalogueId: 'cat-a',
      targetId: ABSENT_CATALOGUE_ID,
      name: 'Dep',
    });
  });

  it('meldet auch die Diagnosen der Auflösung (baumelnder entryLink)', () => {
    const catalogue = catalogueXml('cat-a', 'A', {
      body: '<entryLinks><entryLink id="link" name="Missing" targetId="nowhere" type="selectionEntry"/></entryLinks>',
    });

    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogue] });

    expect(diagnosticKinds(prepared)).toContain(DiagnosticKind.DANGLING_ENTRY_LINK);
  });

  it('meldet einen kohaerenten Datensatz ohne Diagnose', () => {
    const prepared = prepareDataset({
      gameSystem: GAME_SYSTEM_XML,
      catalogues: [catalogueXml('cat-a', 'A')],
    });

    expect(prepared.diagnostics).toEqual([]);
  });
});
