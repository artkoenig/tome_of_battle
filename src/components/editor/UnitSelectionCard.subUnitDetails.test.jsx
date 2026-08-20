/**
 * Issue 0152 — die Karte einer eigenstaendigen Untereinheit (z. B. ein
 * einzelner Streitwagen in einer Streitwagengruppe) zeigt ihre Upgrade-Chips
 * dauerhaft und traegt keinen Details-Knopf mehr.
 *
 * Warum die Karte hier keinen Knopf braucht: Statblock und Regel-Chips haengen
 * an `!isSubUnit` und erscheinen auf der Untereinheiten-Karte gar nicht — die
 * Profile werden nach oben vererbt und stehen in der Tabelle der Gruppe. Hinter
 * dem Knopf lag also nur die Upgrade-Chip-Zeile, und die ist leer, sobald die
 * Untereinheit keine Upgrades hat.
 *
 * Naht: die Mocks aus `UnitSelectionCard.test.jsx` — `../../roster` mit echtem
 * `isIndependentSubUnit`, dazu `findEntryInSystem`/`resolveEntry` als Stubs, die
 * genau die beiden Streitwagen zu eigenstaendigen Untereinheiten machen.
 * `./UnitChips` ist gefaked, weil hier nicht zaehlt, WELCHE Chips die Auswahl
 * ergibt (das pinnen `UnitChips.test.jsx` und `UnitSelectionCard.test.jsx`),
 * sondern nur, ob eine vorhandene Chip-Zeile ohne Zutun sichtbar ist.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import UnitSelectionCard from './UnitSelectionCard';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="icon-trash" />,
  Copy: () => <span data-testid="icon-copy" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  MoreVertical: () => <span data-testid="icon-more" />,
  ReceiptText: () => <span data-testid="icon-receipt" />,
}));

vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

vi.mock('./SelectionConfigurator', () => ({
  default: () => <div data-testid="selection-configurator" />,
}));

// Nur der bewaffnete Streitwagen bringt eine Chip-Zeile mit; der zweite hat
// keine Upgrades, seine Chip-Komponente rendert — wie die echte — `null`.
vi.mock('./UnitChips', () => ({
  UnitUpgradesChips: ({ selection }) =>
    selection.id === 'chariot-armed' ? <div data-testid="upgrade-chips">Sensenraeder</div> : null,
  UnitRulesChips: () => <div data-testid="rules-chips">Dummheit</div>,
}));

const CHARIOT_ENTRY_ID = 'el-chariot';

// Ein aufgeloester Eintrag, der `isIndependentSubUnit` erfuellt: Typ `unit`,
// nicht kollektiv, mit eigenen Auswahlmoeglichkeiten.
const SUB_UNIT_ENTRY = { type: 'unit', collective: false, selectionEntries: [{ id: 'opt-1' }] };

const mockResolveEntry = vi.fn();

vi.mock('../../roster', async () => ({
  collectUnitProfilesAndRules: () => ({ profiles: [], rules: [] }),
  findEntryInSystem: (_system, entryId) => ({ id: entryId }),
  resolveEntry: (...args) => mockResolveEntry(...args),
  getEffectiveSelectionName: (selection) => selection?.name ?? '',
  isIndependentSubUnit: (await vi.importActual('../../roster/subUnit')).isIndependentSubUnit,
  childSelectionsOf: (await vi.importActual('../../roster/rosterTree')).childSelectionsOf,
  groupProfilesByType: (await vi.importActual('../../roster/rulesEvaluator')).groupProfilesByType,
  ...(await vi.importActual('../../roster/constants')),
}));

const CHARIOT_PROFILE = {
  id: 'p-chariot',
  profileTypeName: 'Model',
  name: 'Goblin Wolf Chariot',
  characteristics: [
    { name: 'M', value: '9' },
    { name: 'T', value: '4' },
  ],
};

const groupSelection = () => ({
  id: 'group',
  name: 'Goblin Wolf Chariots',
  entryLinkId: 'el-group',
  number: 1,
  selections: [
    { id: 'chariot-armed', name: 'Goblin Wolf Chariot', entryLinkId: CHARIOT_ENTRY_ID, number: 1, selections: [] },
    { id: 'chariot-plain', name: 'Goblin Wolf Chariot', entryLinkId: CHARIOT_ENTRY_ID, number: 1, selections: [] },
  ],
});

// `isIndependentSubUnit` ist die Antwort des BERICHTS (Issue 0156): die Karte
// fragt sie am Slot ab, statt den Katalog-Eintrag ein zweites Mal aufzuloesen.
// Beide Streitwagen sind eigenstaendige Untereinheiten, ihre Gruppe ist keine.
const capabilities = () =>
  new Map([
    ['0/0', { anchorKind: 'occupied', totalCosts: { pts: 134 }, isIndependentSubUnit: false, infoElements: [{ kind: 'profile', ...CHARIOT_PROFILE }] }],
    ['0/0/0', { anchorKind: 'occupied', totalCosts: { pts: 74 }, isIndependentSubUnit: true, infoElements: [] }],
    ['0/0/1', { anchorKind: 'occupied', totalCosts: { pts: 60 }, isIndependentSubUnit: true, infoElements: [] }],
  ]);

function renderGroupCard() {
  const selection = groupSelection();
  return render(
    <UnitSelectionCard
      selection={selection}
      selectedRosterSelection={null}
      setSelectedRosterSelection={vi.fn()}
      roster={{ costLimitType: 'pts' }}
      system={{}}
      violations={[]}
      capabilities={capabilities()}
      pathBySelectionId={new Map([['group', '0/0'], ['chariot-armed', '0/0/0'], ['chariot-plain', '0/0/1']])}
      costTypeLabel="Pkt."
      removeUnit={vi.fn()}
      copyUnit={vi.fn()}
      subSelectionOperations={createSubSelectionOperationsMock()}
      activeCatalogue={{ id: 'og-cat' }}
    />
  );
}

/** Die Karten der Untereinheiten: die verschachtelten `.selection-node` unter der Gruppe. */
const subCards = (container) =>
  Array.from(container.querySelectorAll('.selection-node-sub-units > .selection-node'));

const cardOf = (container, name) =>
  subCards(container).find((card) => card.querySelector('.selection-node-name').textContent.includes(name));

describe('UnitSelectionCard: Untereinheiten-Karte ohne Details-Knopf (Issue 0152)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEntry.mockImplementation((_system, entry) =>
      entry?.id === CHARIOT_ENTRY_ID ? SUB_UNIT_ENTRY : { type: 'unit', collective: false }
    );
  });

  it('rendert die beiden Streitwagen als eigene Karten (Vorbedingung)', () => {
    const { container } = renderGroupCard();

    expect(subCards(container)).toHaveLength(2);
  });

  it('zeigt auf keiner Untereinheiten-Karte einen Details-Knopf (Kriterium 1)', () => {
    const { container } = renderGroupCard();

    subCards(container).forEach((card) => {
      expect(card.querySelector('.unit-card-details-toggle')).toBeNull();
    });
    // Genau einer bleibt uebrig: der der Gruppe.
    expect(container.querySelectorAll('.unit-card-details-toggle')).toHaveLength(1);
  });

  it('zeigt die Upgrade-Chips einer Untereinheit ohne Aufklappen (Kriterium 2)', () => {
    const { container } = renderGroupCard();

    const card = cardOf(container, 'Goblin Wolf Chariot');
    const details = card.querySelector('.unit-card-details');
    expect(details.className).toContain('is-open');
    expect(details.querySelector('[data-testid="upgrade-chips"]')).not.toBeNull();
  });

  it('laesst die Karte einer Untereinheit ohne Upgrades leer, statt eine leere Flaeche zu zeigen (Kriterium 3)', () => {
    const { container } = renderGroupCard();

    const details = subCards(container)[1].querySelector('.unit-card-details');
    expect(details.querySelector('[data-testid="upgrade-chips"]')).toBeNull();
    // Ausser dem Rand-Marker (rendert nichts) steht nichts in der Lade.
    const rendered = Array.from(details.children).filter((el) => !el.classList.contains('unit-card-torn-edge'));
    expect(rendered).toHaveLength(0);
  });

  it('zeigt weder Statblock noch Regel-Chips auf einer Untereinheiten-Karte (Kriterium 4)', () => {
    const { container } = renderGroupCard();

    subCards(container).forEach((card) => {
      expect(card.querySelector('.profile-table')).toBeNull();
      expect(card.querySelector('[data-testid="rules-chips"]')).toBeNull();
    });
  });

  it('KONTROLLE: die Gruppenkarte behaelt ihren Knopf und klappt Profil und Chips erst auf Klick auf (Kriterium 5)', () => {
    const { container } = renderGroupCard();

    const groupDetails = container.querySelector('.unit-card-details');
    expect(groupDetails.className).not.toContain('is-open');
    expect(groupDetails.querySelector('.profile-table')).not.toBeNull();
    expect(groupDetails.querySelector('[data-testid="rules-chips"]')).not.toBeNull();

    fireEvent.click(container.querySelector('.unit-card-details-toggle'));

    expect(container.querySelector('.unit-card-details').className).toContain('is-open');
  });

  it('behaelt Kosten, Aktionsmenue und den Rand-Marker der Untereinheiten-Karte (Kriterium 6)', () => {
    const { container } = renderGroupCard();

    const card = subCards(container)[1];
    expect(card.querySelector('.selection-node-cost').textContent).toContain('60');
    expect(card.querySelector('[data-testid="unit-actions-menu"]')).not.toBeNull();
    expect(card.querySelector('.unit-card-details .unit-card-torn-edge')).not.toBeNull();
  });
});

/**
 * Der Zackenrand gehoert der Karte, die ihn traegt — nicht ihren Vorfahren.
 *
 * Die Untereinheiten-Karte hat keinen Details-Knopf und ihre Lade steht darum
 * dauerhaft offen; sie traegt den Rand-Marker also immer. Greift die
 * `:has()`-Regel den Marker als beliebigen Nachfahren, passt sie auch auf die
 * umschliessende Gruppenkarte, und der Zackenrand erscheint unter der ganzen
 * Gruppe statt unter der Karte, die noch etwas Eingeklapptes verbirgt.
 *
 * Der Test liest den Selektor aus dem Stylesheet und prueft ihn mit
 * `Element.matches()` gegen den echten Baum — die Regel selbst wendet jsdom
 * nicht an, der Selektor ist aber genau das Bewegliche daran.
 */
const tornEdgeClipSelector = () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/30-unit-chips-and-details.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const block = css
    .split('}')
    .find((chunk) => chunk.includes('unit-card-torn-edge') && chunk.includes('clip-path'));
  return block.slice(0, block.indexOf('{')).trim();
};

describe('UnitSelectionCard: der Zackenrand bleibt auf seiner eigenen Karte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEntry.mockImplementation((_system, entry) =>
      entry?.id === CHARIOT_ENTRY_ID ? SUB_UNIT_ENTRY : { type: 'unit', collective: false }
    );
  });

  it('schneidet die Gruppenkarte nicht an, solange nur die Untereinheiten offen sind', () => {
    const { container } = renderGroupCard();

    const groupCard = container.querySelector('.selection-node');
    expect(groupCard.querySelector('.unit-card-details').className).not.toContain('is-open');
    expect(groupCard.matches(tornEdgeClipSelector())).toBe(false);
  });

  it('schneidet jede Untereinheiten-Karte an, weil deren Lade offen steht', () => {
    const { container } = renderGroupCard();

    const selector = tornEdgeClipSelector();
    subCards(container).forEach((card) => {
      expect(card.matches(selector)).toBe(true);
    });
  });

  it('KONTROLLE: schneidet die Gruppenkarte an, sobald ihre eigene Lade offen steht', () => {
    const { container } = renderGroupCard();

    fireEvent.click(container.querySelector('.unit-card-details-toggle'));

    expect(container.querySelector('.selection-node').matches(tornEdgeClipSelector())).toBe(true);
  });
});
