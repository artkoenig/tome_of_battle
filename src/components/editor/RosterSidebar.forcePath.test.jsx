/**
 * Issue 0121, Pruefrunde 4, Befund A (Kriterien 3 und 5) — die Seitenleiste
 * nimmt den Pfad des Kontingents entgegen, statt ihn aus einem festen Literal
 * zu raten.
 *
 * Heute traegt `RosterSidebar` ein `const FIRST_FORCE_PATH = '0'` und sucht die
 * Kategorie-Anker damit. Der Pfad eines Kontingents ist aber nur dann sein
 * Eingabe-Index, wenn **jede** Kontingent-Definition aufloest. Loest die erste
 * nicht auf, fuehrt der Bericht unter `"0"` das **zweite** Kontingent — und die
 * „Armeeanforderungen" zeigen still dessen Kategorien und Grenzen.
 *
 * Beobachtbares Sollverhalten (an dieser Komponente, dem Rand, den der Nutzer
 * sieht):
 * 1. Mit dem Pfad des gemeinten Kontingents erscheinen **dessen** Kategorien —
 *    und nur die.
 * 2. `forcePath === null` heisst „der Bericht fuehrt fuer dieses Kontingent
 *    keine Slots": dann erscheint **keine** Anforderung, nicht die eines
 *    fremden Kontingents.
 * 3. Mit `"0"` bleibt alles wie heute (Regressionsschutz).
 *
 * **Vertrag (im Auftrag festgelegt, nicht hier erfunden):** die Stuetze heisst
 * `forcePath` — wie bei `CategoryUnitAdder` und `RosterCategorySection` —, und
 * `null` bedeutet „keine Slots".
 *
 * Harness- und Fixture-Muster: `RosterSidebar.test.jsx` (Anker-Formen des
 * Berichts als Map, lucide-react stummgeschaltet); diese Datei bleibt
 * unberuehrt.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RosterSidebar from './RosterSidebar';

vi.mock('lucide-react', () => ({
  Check: (props) => <span data-testid="icon-check" {...props} />,
  ShieldAlert: (props) => <span data-testid="icon-shield-alert" {...props} />,
  AlertTriangle: (props) => <span data-testid="icon-alert-triangle" {...props} />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
}));

function makeRoster() {
  return {
    id: 'roster-1',
    catalogueId: 'cat',
    costLimitType: 'pts',
    costLimit: 1000,
    forces: [
      { id: 'force-1', forceEntryId: 'fe-main', catalogueId: 'cat', selections: [] },
      { id: 'force-2', forceEntryId: 'fe-second', catalogueId: 'cat', selections: [] },
    ],
  };
}

/** Ein categoryAnchor-Slot des Berichts (Form aus `RosterSidebar.test.jsx`). */
function categoryAnchor(path, name, overrides = {}) {
  return [path, {
    anchorKind: 'categoryAnchor',
    defId: `cl-${name.toLowerCase()}`,
    targetDefId: `cat-${name.toLowerCase()}`,
    name,
    current: 0,
    effectiveMin: null,
    effectiveMax: null,
    isHidden: false,
    isMandatoryUnmet: false,
    ...overrides,
  }];
}

/**
 * Zwei Kontingente im Bericht: unter `"0"` die Kategorie „Core", unter `"1"`
 * die Kategorie „Rare" — plus je ein Angebots-Anker, damit nicht jeder
 * Kind-Slot ein Kategorie-Anker ist.
 */
function twoForceCapabilities() {
  return new Map([
    ['0', { anchorKind: 'occupied', defId: 'fe-main', name: 'Main Force' }],
    categoryAnchor('0/0', 'Core', { current: 2, effectiveMin: 2, effectiveMax: 3 }),
    ['0/1', { anchorKind: 'offerAnchor', defId: 'entry-alpha', name: 'Alpha' }],
    ['1', { anchorKind: 'occupied', defId: 'fe-second', name: 'Second Force' }],
    categoryAnchor('1/0', 'Rare', { current: 1, effectiveMax: 4 }),
    ['1/1', { anchorKind: 'offerAnchor', defId: 'entry-alpha', name: 'Alpha' }],
  ]);
}

function renderSidebar({
  roster = makeRoster(),
  costTotals = { pts: 0 },
  costTypes = [{ id: 'pts', name: 'Points' }],
  capabilities = new Map(),
  violations = [],
  forcePath,
} = {}) {
  return render(
    <RosterSidebar
      roster={roster}
      costTotals={costTotals}
      costTypes={costTypes}
      capabilities={capabilities}
      violations={violations}
      costTypeLabel="Pkt."
      forcePath={forcePath}
    />
  );
}

/** Die gerenderten Anforderungszeilen als „Name" → Zeilentext. */
function requirementRows() {
  return [...document.querySelectorAll('.sidebar-requirement-row')].map(
    (row) => row.textContent.replace(/\s+/g, ' ').trim()
  );
}

describe('RosterSidebar: die Anforderungen kommen vom uebergebenen Kontingent-Pfad (Issue 0121, Befund A)', () => {
  it('forcePath "0": die Kategorien des ersten Kontingents — unveraendert zu heute', () => {
    renderSidebar({ capabilities: twoForceCapabilities(), forcePath: '0' });

    expect(screen.getByText('Core:')).toBeTruthy();
    expect(screen.queryByText('Rare:')).toBeNull();
    expect(requirementRows()).toEqual(['Core:2 / Min: 2, Max: 3']);
  });

  it('forcePath "1": die Kategorien des ZWEITEN Kontingents — nicht die des ersten', () => {
    renderSidebar({ capabilities: twoForceCapabilities(), forcePath: '1' });

    expect(screen.getByText('Rare:')).toBeTruthy();
    expect(screen.queryByText('Core:')).toBeNull();
  });

  it('forcePath "1": die Grenzen stammen aus dem Anker DIESES Kontingents', () => {
    renderSidebar({ capabilities: twoForceCapabilities(), forcePath: '1' });

    expect(requirementRows()).toEqual(['Rare:1 / Max: 4']);
  });

  it('forcePath null („der Bericht fuehrt keine Slots"): KEINE Anforderung — auch nicht die eines fremden Kontingents', () => {
    renderSidebar({ capabilities: twoForceCapabilities(), forcePath: null });

    expect(requirementRows()).toEqual([]);
    expect(screen.queryByText('Core:')).toBeNull();
    expect(screen.queryByText('Rare:')).toBeNull();
  });

  it('forcePath null: die Ueberschrift „Armeeanforderungen" bleibt stehen (nur die Zeilen fehlen)', () => {
    renderSidebar({ capabilities: twoForceCapabilities(), forcePath: null });

    expect(screen.getByTestId('sidebar-army-requirements')).toBeTruthy();
  });

  it('Rand: ein Pfad, unter dem der Bericht gar keine Slots fuehrt, ergibt keine Zeilen', () => {
    renderSidebar({ capabilities: twoForceCapabilities(), forcePath: '7' });

    expect(requirementRows()).toEqual([]);
  });

  it('Rand: Praefix-Verwechslung — "1" darf nicht die Anker von "10" einsammeln', () => {
    const capabilities = new Map([
      ['1', { anchorKind: 'occupied', defId: 'fe-second', name: 'Second Force' }],
      categoryAnchor('1/0', 'Rare'),
      ['10', { anchorKind: 'occupied', defId: 'fe-eleventh', name: 'Eleventh Force' }],
      categoryAnchor('10/0', 'Fremd'),
    ]);

    renderSidebar({ capabilities, forcePath: '1' });

    expect(screen.getByText('Rare:')).toBeTruthy();
    expect(screen.queryByText('Fremd:')).toBeNull();
  });

  it('Rand: leerer Bericht (keine capabilities) ergibt keine Zeilen und keinen Fehler', () => {
    renderSidebar({ capabilities: new Map(), forcePath: '0' });

    expect(requirementRows()).toEqual([]);
  });

  it('versteckte Kategorie-Anker bleiben auch unter dem uebergebenen Pfad verborgen', () => {
    const capabilities = new Map([
      categoryAnchor('1/0', 'Rare'),
      categoryAnchor('1/1', 'Verborgen', { isHidden: true }),
    ]);

    renderSidebar({ capabilities, forcePath: '1' });

    expect(screen.getByText('Rare:')).toBeTruthy();
    expect(screen.queryByText('Verborgen:')).toBeNull();
  });
});
