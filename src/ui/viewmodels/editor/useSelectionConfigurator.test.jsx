import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSelectionConfigurator, optionDescriptionOf, resolveRowSelectionId, subSelectionCountOf } from './useSelectionConfigurator';
import {
  createRosterProviderWrapper,
  createEmptyRosterReport,
  createNoopRosterCommands,
} from '../../../shared/test-utils/rosterProviders';

/**
 * ViewModel-Tests des Auswahl-Konfigurators (ADR-0038).
 *
 * Der Bericht wird von Hand gestellt und das geparste System kennt die Struktur
 * dieses Rahmens nicht — dann sagt allein der Bericht, was auf der Karte steht
 * (das Sicherheitsnetz des Konfigurators). Genau das ist hier der Punkt: die
 * Zeilen und ihre Texte kommen aus den Slots.
 */

const SELECTION = { id: 'sel-1', name: 'Ritter', entryLinkId: 'el-1', number: 1, selections: [] };
const ROSTER = { costLimitType: 'pts', catalogueId: 'cat-main', forces: [{ id: 'f1', selections: [SELECTION] }] };

const slot = (overrides) => ({
  anchorKind: 'offerAnchor',
  primaryCategoryId: null, defId: null, targetDefId: null,
  costs: {}, effectiveMin: null, effectiveMax: null, current: 0,
  isMandatoryUnmet: false, isBlocked: false, isHidden: false,
  isIndependentSubUnit: false, sortIndex: null, infoElements: [],
  ...overrides,
});

const renderModel = ({ capabilities, system, commands, selection = SELECTION } = {}) =>
  renderHook(() => useSelectionConfigurator({ selection }), {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({
        capabilities,
        pathBySelectionId: new Map([[selection.id, '0/0']]),
      }),
      roster: ROSTER,
      system: system ?? { catalogues: [{ id: 'cat-main' }] },
      commands,
    }),
  });

describe('useSelectionConfigurator', () => {
  it('macht aus jedem Options-Slot des Rahmens eine Zeile und lässt versteckte weg', () => {
    const capabilities = new Map([
      ['0/0', slot({ anchorKind: 'occupied', defId: 'unit', name: 'Ritter' })],
      ['0/0/0', slot({ defId: 'opt-lance', name: 'Lanze', costs: { pts: 5 } })],
      ['0/0/1', slot({ defId: 'opt-secret', name: 'Geheim', isHidden: true })],
      ['0/0/2', slot({ anchorKind: 'groupAnchor', defId: 'grp', name: 'Waffen' })],
    ]);

    const { result } = renderModel({ capabilities });

    const rows = result.current.sections.filter(s => s.kind === 'standalone');
    expect(rows.map(s => s.name)).toEqual(['Lanze']);
    expect(rows[0].points).toBe(5);
    // Kennt das geparste System die Struktur dieses Rahmens nicht, behält ein
    // Gruppen-Anker seinen Abschnitt: leer heißt hier „nicht zugeordnet".
    expect(result.current.sections.filter(s => s.kind === 'group').map(s => s.group.name)).toEqual(['Waffen']);
  });

  it('schreibt beim Klick auf die Zeile über die Kommandos des Kontexts', () => {
    const subSelectionOperations = {
      addInstance: vi.fn(), removeInstance: vi.fn(), increaseCount: vi.fn(), decreaseCount: vi.fn(),
    };
    const capabilities = new Map([
      ['0/0', slot({ anchorKind: 'occupied', defId: 'unit', name: 'Ritter' })],
      ['0/0/0', slot({ defId: 'opt-lance', name: 'Lanze', effectiveMax: 1 })],
    ]);

    const { result } = renderModel({
      capabilities,
      commands: createNoopRosterCommands({ subSelectionOperations }),
    });
    result.current.sections[0].onRowClick();

    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-1', expect.objectContaining({ id: 'opt-lance' }));
  });

  // AC5: der namensbasierte Regel-Lookup ist entfallen. Er nahm den ERSTEN
  // gleichnamigen Treffer über alle Kataloge und verwechselte damit zwei Regeln,
  // die nur den Namen teilen. Die Beschreibung kommt jetzt aus der
  // Info-Projektion des Slots (ADR-0034), die den Katalog kennt.
  it('verwechselt zwei gleichnamige Regeln aus verschiedenen Katalogen nicht mehr', () => {
    const system = {
      sharedRules: [],
      catalogues: [
        { id: 'cat-fremd', sharedRules: [{ name: 'Segen', description: 'FALSCH: der Segen des fremden Katalogs' }] },
        { id: 'cat-main', sharedRules: [{ name: 'Segen', description: 'RICHTIG: der Segen dieses Katalogs' }] },
      ],
    };
    const capabilities = new Map([
      ['0/0', slot({ anchorKind: 'occupied', defId: 'unit', name: 'Ritter' })],
      ['0/0/0', slot({
        defId: 'opt-blessing', name: 'Segen',
        infoElements: [{ kind: 'rule', id: 'r-main', name: 'Segen', text: 'RICHTIG: der Segen dieses Katalogs', source: null }],
      })],
    ]);

    const { result } = renderModel({ capabilities, system });

    expect(result.current.sections[0].descText).toBe('RICHTIG: der Segen dieses Katalogs');
    expect(result.current.sections[0].descText).not.toContain('FALSCH');
  });
});

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
