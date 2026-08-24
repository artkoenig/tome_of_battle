import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useAutoFillSuggestions, FILL_UP_WINDOW_POINTS } from '../../../../ui/viewmodels/editor/useAutoFillSuggestions';
import { createRosterProviderWrapper, createEmptyRosterReport, createNoopRosterCommands } from '../../../../shared/test-utils/rosterProviders';

/**
 * ViewModel-Tests der Auffüll-Vorschläge (Issue 0164): das Fenster, in dem das
 * Panel überhaupt offen ist, die Auswahl der Kandidaten und die Anwenden-Aktion.
 */

const SYSTEM = {
  costTypes: [{ id: 'pts', name: 'Pkt.' }],
  catalogues: [
    { id: 'cat-main', selectionEntries: [{ id: 'e-knight', name: 'Ritter aus dem Katalog' }] },
    { id: 'cat-foreign', name: 'Fremdes Armeebuch', selectionEntries: [{ id: 'e-ogre', name: 'Oger' }] },
  ],
};

const offer = (over = {}) => ({
  anchorKind: 'offerAnchor',
  isIndependentSubUnit: false,
  defId: 'e-knight',
  name: 'Ritter',
  isHidden: false,
  isBlocked: false,
  sourceId: 'cat-main',
  primaryCategoryId: 'cat-core',
  frame: { path: '0' },
  raiseCosts: { pts: 10 },
  ...over,
});

const renderPanel = ({
  capabilities = new Map(), costLimit = 1000, spent = 980,
  pathBySelectionId = new Map(), commands,
} = {}) => renderHook(
  () => useAutoFillSuggestions({ forceId: 'f1', forcePath: '0' }),
  {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({
        capabilities, pathBySelectionId, costTotals: { pts: spent },
      }),
      roster: {
        catalogueId: 'cat-main', costLimitType: 'pts', costLimit,
        forces: [{ id: 'f1', catalogueId: 'cat-main' }],
      },
      system: SYSTEM,
      activeCatalogue: { id: 'cat-main' },
      commands: createNoopRosterCommands(commands),
    }),
  }
);

describe('useAutoFillSuggestions — das Fenster', () => {
  it('offen auf den letzten Punkten, auch wenn nichts hineinpasst', () => {
    const { result } = renderPanel({ costLimit: 1000, spent: 990 });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.remainingPoints).toBe(10);
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.costTypeLabel).toBe('Pkt.');
  });

  it('geschlossen, solange die Lücke größer ist als die Spanne', () => {
    const { result } = renderPanel({ costLimit: 1000, spent: 1000 - FILL_UP_WINDOW_POINTS - 1 });

    expect(result.current.isOpen).toBe(false);
  });

  it('geschlossen bei erreichter oder überschrittener Punktgrenze', () => {
    expect(renderPanel({ costLimit: 1000, spent: 1000 }).result.current.isOpen).toBe(false);
    expect(renderPanel({ costLimit: 1000, spent: 1100 }).result.current.isOpen).toBe(false);
  });

  it('geschlossen ohne gesetzte Punktgrenze', () => {
    const { result } = renderPanel({ costLimit: 0, spent: 0 });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.remainingPoints).toBeNull();
  });

  it('ohne Slot-Pfad schweigt das Panel — der Bericht sagt über dieses Kontingent nichts', () => {
    const { result } = renderHook(
      () => useAutoFillSuggestions({ forceId: 'f1', forcePath: null }),
      {
        wrapper: createRosterProviderWrapper({
          report: createEmptyRosterReport({ costTotals: { pts: 980 } }),
          roster: { costLimitType: 'pts', costLimit: 1000, forces: [{ id: 'f1' }] },
          system: SYSTEM,
        }),
      }
    );

    expect(result.current.isOpen).toBe(false);
  });
});

describe('useAutoFillSuggestions — die Kandidaten', () => {
  it('nimmt Angebote und wachstumsfähige Auswahlen, sortiert nach Kosten absteigend', () => {
    const { result } = renderPanel({
      capabilities: new Map([
        ['0/0', offer({ name: 'Klein', raiseCosts: { pts: 5 } })],
        ['0/1', offer({ name: 'Groß', raiseCosts: { pts: 18 } })],
        ['0/2', offer({ name: 'Wachsend', anchorKind: 'occupied', headroom: 2, raiseCosts: { pts: 9 } })],
        ['0/3', offer({ name: 'Voll', anchorKind: 'occupied', headroom: 0, raiseCosts: { pts: 9 } })],
        ['0/4', offer({ name: 'Kategorie-Pflicht', anchorKind: 'mandatoryPhantom', raiseCosts: { pts: 9 } })],
      ]),
      spent: 980,
    });

    expect(result.current.suggestions.map(s => [s.name, s.cost]))
      .toEqual([['Groß', 18], ['Wachsend', 9], ['Klein', 5]]);
  });

  it('lässt Verstecktes, Gesperrtes, Kostenloses, zu Teures und Fremdes heraus', () => {
    const { result } = renderPanel({
      capabilities: new Map([
        ['0/0', offer({ name: 'Versteckt', isHidden: true })],
        ['0/1', offer({ name: 'Gesperrt', isBlocked: true })],
        ['0/2', offer({ name: 'Kostenlos', raiseCosts: { pts: 0 } })],
        ['0/3', offer({ name: 'Zu teuer', raiseCosts: { pts: 40 } })],
        ['0/4', offer({ name: 'Fremd', sourceId: 'cat-foreign' })],
        ['0/5', offer({ name: 'Passt' })],
      ]),
      spent: 980,
    });

    expect(result.current.suggestions.map(s => s.name)).toEqual(['Passt']);
  });

  it('nur die Slots des eigenen Kontingents zählen', () => {
    const { result } = renderPanel({
      capabilities: new Map([
        ['0/0', offer({ name: 'Eigenes' })],
        ['1/0', offer({ name: 'Fremdes Kontingent', frame: { path: '1' } })],
      ]),
      spent: 980,
    });

    expect(result.current.suggestions.map(s => s.name)).toEqual(['Eigenes']);
  });

  it('ein Slot an einer Auswahl eines anderen Kontingents ist kein Vorschlag', () => {
    // Zwei Kontingente in einer Liste: der Rahmen eines Slots im zweiten steht
    // im roster-weiten Auswahl-Index, der Slot liegt aber außerhalb des eigenen
    // Teilbaums — er gehört in das Panel des anderen Kontingents (Issue 0172).
    const { result } = renderPanel({
      capabilities: new Map([
        ['0/0', offer({ name: 'Eigenes Angebot' })],
        ['1/0', offer({ name: 'Ally Unit', anchorKind: 'occupied', headroom: null, frame: { path: '1' } })],
        ['1/0/0', offer({ name: 'Foreign Upgrade', frame: { path: '1/0' } })],
      ]),
      pathBySelectionId: new Map([['sel-b', '1/0']]),
      spent: 980,
    });

    expect(result.current.suggestions.map(s => s.name)).toEqual(['Eigenes Angebot']);
  });

  it('ein Slot an einer bestehenden Auswahl nennt seine Einheit und wächst über increaseCount', () => {
    const increaseCount = vi.fn();
    const { result } = renderPanel({
      capabilities: new Map([
        ['0/0', offer({ name: 'Ritter', anchorKind: 'occupied', headroom: null, raiseCosts: { pts: 0 } })],
        ['0/0/0', offer({ name: 'Lanze', frame: { path: '0/0' }, raiseCosts: { pts: 4 } })],
      ]),
      pathBySelectionId: new Map([['sel-knight', '0/0']]),
      spent: 990,
      commands: { subSelectionOperations: { increaseCount } },
    });

    const suggestion = result.current.suggestions[0];
    expect(suggestion.unitName).toBe('Ritter');
    suggestion.apply();
    expect(increaseCount).toHaveBeenCalledWith(
      'sel-knight', { id: 'e-knight', name: 'Ritter aus dem Katalog' });
  });

  it('ein Slot unter dem Kontingent wird unter seiner effektiven Primärkategorie ausgehoben', () => {
    const addUnit = vi.fn();
    const { result } = renderPanel({
      capabilities: new Map([['0/0', offer()]]),
      spent: 990,
      commands: { addUnit },
    });

    expect(result.current.suggestions[0].unitName).toBeNull();
    result.current.suggestions[0].apply();
    expect(addUnit).toHaveBeenCalledWith(
      { id: 'e-knight', name: 'Ritter aus dem Katalog' }, 'cat-core', 'f1');
  });
});
