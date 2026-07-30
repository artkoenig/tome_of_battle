import { describe, it, expect } from 'vitest';
import { getEffectiveName, getEffectiveSelectionName } from './modifierEvaluator.js';

// --- getEffectiveName: reine Anwendung der field="name"-Modifier -------------------

const NAME_FIELD = 'name';

// Baut eine minimale Quelle (Selection-Entry / Profil), die genau die uebergebenen
// Namens-Modifier traegt — so bleibt der Test auf die Namensauswertung fokussiert.
const nameSource = (baseName, modifiers) => ({ name: baseName, modifiers });

describe('getEffectiveName', () => {
  it('gibt den rohen Namen zurueck, wenn kein Namens-Modifier vorliegt', () => {
    expect(getEffectiveName(nameSource('Empire soldier', []))).toBe('Empire soldier');
    expect(getEffectiveName(nameSource('Empire soldier', undefined))).toBe('Empire soldier');
  });

  it('ersetzt den Namen bei type="set"', () => {
    const source = nameSource('Empire soldier', [
      { type: 'set', field: NAME_FIELD, value: 'Halberdier' }
    ]);
    expect(getEffectiveName(source)).toBe('Halberdier');
  });

  it('haengt bei type="append" den Wert mit dem geparsten join an', () => {
    const source = nameSource('Polearm', [
      { type: 'append', field: NAME_FIELD, value: '(counts as Halberd)', join: ' ' }
    ]);
    expect(getEffectiveName(source)).toBe('Polearm (counts as Halberd)');
  });

  it('stellt bei type="prepend" den Wert mit dem geparsten join voran', () => {
    const source = nameSource('Halberd', [
      { type: 'prepend', field: NAME_FIELD, value: 'Silvaron', join: ' — ' }
    ]);
    expect(getEffectiveName(source)).toBe('Silvaron — Halberd');
  });

  it('nutzt den join-Wert verbatim (NBSP-umschlossenes "+"), nicht ein Leerzeichen', () => {
    // Dogs of War: „Relics of Lustria" wird mit join="  +  " angehaengt.
    const NBSP_PLUS = '  +  ';
    const source = nameSource('Base Item', [
      { type: 'append', field: NAME_FIELD, value: 'Relics of Lustria', join: NBSP_PLUS }
    ]);
    expect(getEffectiveName(source)).toBe(`Base Item${NBSP_PLUS}Relics of Lustria`);
  });

  it('fuegt ohne join-Attribut keinen Trenner ein (kein hartkodiertes Leerzeichen)', () => {
    const source = nameSource('Foo', [
      { type: 'append', field: NAME_FIELD, value: 'Bar' }
    ]);
    expect(getEffectiveName(source)).toBe('FooBar');
  });

  it('laesst den rohen Namen unveraendert, wenn die Bedingung nicht erfuellt ist', () => {
    const source = nameSource('Empire soldier', [
      {
        type: 'set', field: NAME_FIELD, value: 'Halberdier',
        conditions: [{ type: 'atLeast', value: 1, field: 'selections', scope: 'parent', childId: 'entry-halberd' }]
      }
    ]);
    // Kontext ohne passende Auswahl -> Bedingung schlaegt fehl -> roher Name.
    const ctx = { selection: { selections: [] } };
    expect(getEffectiveName(source, ctx)).toBe('Empire soldier');
  });

  it('wendet den Modifier an, sobald die Bedingung erfuellt ist', () => {
    const source = nameSource('Empire soldier', [
      {
        type: 'set', field: NAME_FIELD, value: 'Halberdier',
        conditions: [{ type: 'atLeast', value: 1, field: 'selections', scope: 'parent', childId: 'entry-halberd' }]
      }
    ]);
    const ctx = { selection: { selections: [{ selectionEntryId: 'entry-halberd', number: 1 }] } };
    expect(getEffectiveName(source, ctx)).toBe('Halberdier');
  });

  it('ignoriert Modifier anderer Felder (z. B. cost)', () => {
    const source = nameSource('Empire soldier', [
      { type: 'set', field: 'points', value: '5' }
    ]);
    expect(getEffectiveName(source)).toBe('Empire soldier');
  });

  it('wendet mehrere passende Modifier in Dokumentreihenfolge an (set setzt zurueck)', () => {
    const source = nameSource('Base', [
      { type: 'append', field: NAME_FIELD, value: 'X', join: ' ' },
      { type: 'set', field: NAME_FIELD, value: 'Final' }
    ]);
    expect(getEffectiveName(source)).toBe('Final');
  });
});

// --- getEffectiveSelectionName: Aufloesung ueber die Katalogdefinition -------------

const CATALOGUE_ID = 'cat-name-test';
const UNIT_ENTRY_ID = 'entry-unit';
const HALBERD_ID = 'entry-halberd';

// Minimales System: eine Einheit, deren Katalogeintrag einen bedingten
// set/field="name"-Modifier traegt (umbenennen bei gewaehlter Hellebarde).
const system = {
  id: 'sys-name-test',
  catalogues: [
    {
      id: CATALOGUE_ID,
      sharedSelectionEntries: [
        {
          id: UNIT_ENTRY_ID,
          name: 'State Troops',
          type: 'unit',
          modifiers: [
            {
              type: 'set', field: NAME_FIELD, value: 'Halberdiers',
              conditions: [{ type: 'atLeast', value: 1, field: 'selections', scope: 'parent', childId: HALBERD_ID }]
            }
          ]
        },
        { id: HALBERD_ID, name: 'Halberd', type: 'upgrade' }
      ]
    }
  ]
};

const baseCtx = { system, roster: { catalogueId: CATALOGUE_ID }, parentCatalogueId: CATALOGUE_ID };

describe('getEffectiveSelectionName', () => {
  it('behaelt den rohen Namen, solange die Bedingung nicht erfuellt ist', () => {
    const selection = { name: 'State Troops', selectionEntryId: UNIT_ENTRY_ID, selections: [] };
    expect(getEffectiveSelectionName(selection, baseCtx)).toBe('State Troops');
  });

  it('liefert den modifizierten Namen, sobald die Unterauswahl vorliegt', () => {
    const selection = {
      name: 'State Troops',
      selectionEntryId: UNIT_ENTRY_ID,
      selections: [{ selectionEntryId: HALBERD_ID, number: 1 }]
    };
    expect(getEffectiveSelectionName(selection, baseCtx)).toBe('Halberdiers');
  });

  it('faellt auf den gespeicherten Namen zurueck, wenn die Definition fehlt', () => {
    const selection = { name: 'Unknown Unit', selectionEntryId: 'entry-does-not-exist' };
    expect(getEffectiveSelectionName(selection, baseCtx)).toBe('Unknown Unit');
  });

  it('mutiert die gespeicherte Selection nicht (roher Name bleibt SSOT)', () => {
    const selection = {
      name: 'State Troops',
      selectionEntryId: UNIT_ENTRY_ID,
      selections: [{ selectionEntryId: HALBERD_ID, number: 1 }]
    };
    getEffectiveSelectionName(selection, baseCtx);
    expect(selection.name).toBe('State Troops');
  });
});
