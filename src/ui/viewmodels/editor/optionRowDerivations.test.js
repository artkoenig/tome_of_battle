import { describe, it, expect } from 'vitest';

import { optionDescriptionOf, resolveRowSelectionId, subSelectionCountOf, findSelectionById } from './optionRowDerivations';

/**
 * Die Zeilen-Ableitungen, die sich Konfigurator und Options-Gruppe teilen: die
 * Beschreibung aus der Info-Projektion, die Zuordnung Zeile → Roster-Selektion
 * und die Zahl der gewählten Instanzen.
 */

describe('optionDescriptionOf', () => {
  it('setzt Regeltext, Aufwertungs-Profil und Buchquelle aus der Info-Projektion zusammen', () => {
    const text = optionDescriptionOf({
      infoElements: [
        { kind: 'rule', name: 'Segen', text: 'Rettungswurf 5+', source: { publicationName: 'Armeebuch', page: '12' } },
        {
          kind: 'profile', name: 'Lanze', profileTypeName: 'Weapon',
          characteristics: [{ name: 'S', value: '+2' }, { name: 'AP', value: null }], source: null,
        },
        { kind: 'profile', name: 'Ritter', profileTypeName: 'Model', characteristics: [{ name: 'M', value: '4' }] },
      ],
    });

    expect(text).toBe('Rettungswurf 5+ Armeebuch 12 | Lanze (S: +2)');
  });

  it('bleibt leer, wenn der Slot nichts anzuzeigen hat', () => {
    expect(optionDescriptionOf(undefined)).toBe('');
    expect(optionDescriptionOf({ infoElements: [] })).toBe('');
  });
});

describe('Zeile → Roster-Selektion (vormals optionNesting)', () => {
  const unit = {
    id: 'unit-1',
    selections: [{ id: 'row-1', entryLinkId: 'el-lance', number: 1, selections: [] }],
  };

  it('findet die Selektion, für die eine gewählte Zeile steht', () => {
    expect(resolveRowSelectionId(unit, null, { id: 'el-lance' }, { id: 'el-lance' })).toBe('row-1');
  });

  it('gibt null zurück, solange die Zeile nicht gewählt ist', () => {
    expect(resolveRowSelectionId(unit, null, { id: 'el-shield' }, { id: 'el-shield' })).toBeNull();
  });

  it('zählt eine Option im ganzen Teilbaum', () => {
    expect(subSelectionCountOf(unit, 'el-lance')).toBe(1);
    expect(subSelectionCountOf(unit, 'el-shield')).toBe(0);
  });
});

describe('findSelectionById', () => {
  const unit = {
    id: 'unit-1',
    selections: [{ id: 'row-1', entryLinkId: 'el-lance', selections: [{ id: 'row-1-1', selections: [] }] }],
  };

  it('findet eine Selektion in beliebiger Tiefe', () => {
    expect(findSelectionById(unit, 'row-1-1')?.id).toBe('row-1-1');
  });

  it('gibt null zurück, wenn es die Selektion nicht gibt', () => {
    expect(findSelectionById(unit, 'fehlt')).toBeNull();
    expect(findSelectionById(null, 'row-1')).toBeNull();
  });
});
