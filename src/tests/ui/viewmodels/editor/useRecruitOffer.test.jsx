import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useRecruitOffer } from '../../../../ui/viewmodels/editor/useRecruitOffer';
import { createRosterProviderWrapper, createEmptyRosterReport, createNoopRosterCommands } from '../../../../shared/test-utils/rosterProviders';

/**
 * ViewModel-Tests des Aushebe-Angebots (Issue 0164). Die Kandidatenliste stand
 * bis dahin in einer Map-Schleife im Render von `CategoryUnitAdder` und war nur
 * über das DOM prüfbar; hier wird sie direkt gelesen.
 *
 * Der Bericht ist von Hand gebaut — nur so weit, wie die Ableitung ihn liest:
 * Ankerart, Sichtbarkeit, effektive Primärkategorie, Herkunft und
 * Aushebe-Preis.
 */

const CATEGORY = 'cat-core';
const SYSTEM = {
  costTypes: [{ id: 'pts', name: 'Pkt.' }],
  catalogues: [{
    id: 'cat-main',
    selectionEntries: [{ id: 'e-knight', name: 'Ritter aus dem Katalog' }],
  }],
};

const slot = (over = {}) => ({
  anchorKind: 'offerAnchor',
  isIndependentSubUnit: false,
  defId: 'e-x',
  targetDefId: null,
  name: 'Irgendwas',
  isHidden: false,
  isBlocked: false,
  isForeignCatalogue: false,
  primaryCategoryId: CATEGORY,
  raiseCosts: { pts: 0 },
  ...over,
});

const renderOffer = (capabilities, { commands, params } = {}) => renderHook(
  () => useRecruitOffer({ forceId: 'f1', forcePath: '0', categoryId: CATEGORY, ...params }),
  {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({ capabilities }),
      roster: { catalogueId: 'cat-main', costLimitType: 'pts' },
      system: SYSTEM,
      activeCatalogue: { id: 'cat-main' },
      commands: createNoopRosterCommands(commands),
    }),
  }
);

describe('useRecruitOffer', () => {
  it('nimmt nur Kandidaten-Ankerarten der eigenen Kategorie auf, entdoppelt nach Definition', () => {
    const capabilities = new Map([
      ['0/0', slot({ defId: 'e-a', name: 'Bogen' })],
      ['0/1', slot({ defId: 'e-a', name: 'Bogen (zweiter Slot)' })],
      ['0/2', slot({ defId: 'e-b', name: 'Anker', anchorKind: 'groupAnchor', })],
      ['0/3', slot({ defId: 'e-c', name: 'Andere Kategorie', primaryCategoryId: 'cat-rare' })],
      ['0/4/0', slot({ defId: 'e-d', name: 'Enkel' })],
    ]);

    const { result } = renderOffer(capabilities);

    expect(result.current.candidates.map(c => c.name)).toEqual(['Bogen']);
  });

  it('lässt Verstecktes und Fremdkatalogisches ganz weg, Gesperrtes dagegen sichtbar', () => {
    const capabilities = new Map([
      ['0/0', slot({ defId: 'e-hidden', name: 'Versteckt', isHidden: true })],
      ['0/1', slot({ defId: 'e-foreign', name: 'Fremd', isForeignCatalogue: true })],
      ['0/2', slot({ defId: 'e-blocked', name: 'Ausgeschöpft', isBlocked: true })],
    ]);

    const { result } = renderOffer(capabilities);

    expect(result.current.candidates.map(c => c.name)).toEqual(['Ausgeschöpft']);
    expect(result.current.candidates[0].isBlocked).toBe(true);
  });

  it('bepreist über raiseCosts der Limit-Kostenart und sortiert absteigend', () => {
    const capabilities = new Map([
      ['0/0', slot({ defId: 'e-cheap', name: 'Billig', raiseCosts: { pts: 5 } })],
      ['0/1', slot({ defId: 'e-dear', name: 'Teuer', raiseCosts: { pts: 40 } })],
      ['0/2', slot({ defId: 'e-mid', name: 'Mittel', raiseCosts: { pts: 12, other: 99 } })],
    ]);

    const { result } = renderOffer(capabilities);

    expect(result.current.candidates.map(c => [c.name, c.points]))
      .toEqual([['Teuer', 40], ['Mittel', 12], ['Billig', 5]]);
    expect(result.current.costTypeLabel).toBe('Pkt.');
  });

  it('hebt mit dem Katalog-Eintrag der Definition in das eigene Kontingent aus', () => {
    const addUnit = vi.fn();
    const capabilities = new Map([['0/0', slot({ defId: 'e-knight', name: 'Ritter' })]]);

    const { result } = renderOffer(capabilities, { commands: { addUnit } });
    result.current.candidates[0].recruit();

    expect(addUnit).toHaveBeenCalledWith(
      { id: 'e-knight', name: 'Ritter aus dem Katalog' }, CATEGORY, 'f1');
  });

  it('eine vorgegebene Eintragsliste kuratiert selbst: Herkunft und Kategorie gelten dann nicht', () => {
    const capabilities = new Map([
      ['0/0', slot({ defId: 'e-listed', name: 'Genannt', isForeignCatalogue: true, primaryCategoryId: 'cat-anders' })],
      ['0/1', slot({ defId: 'e-other', name: 'Nicht genannt' })],
    ]);

    const { result } = renderOffer(capabilities, {
      params: { entries: [{ id: 'e-listed', name: 'Genannt aus der Liste' }] },
    });

    expect(result.current.candidates.map(c => c.name)).toEqual(['Genannt']);
  });

  it('ohne aktiven Katalog gibt es kein Angebot', () => {
    const { result } = renderHook(
      () => useRecruitOffer({ forceId: 'f1', forcePath: '0', categoryId: CATEGORY }),
      {
        wrapper: createRosterProviderWrapper({
          report: createEmptyRosterReport({
            capabilities: new Map([['0/0', slot({ defId: 'e-a', name: 'Bogen' })]]),
          }),
          roster: { costLimitType: 'pts' },
          system: SYSTEM,
          activeCatalogue: null,
        }),
      }
    );

    expect(result.current.candidates).toEqual([]);
  });
});
