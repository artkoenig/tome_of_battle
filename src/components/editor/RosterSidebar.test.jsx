import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterSidebarHarness as RosterSidebar } from '../../test-utils/harnesses/RosterSidebarHarness';

// Die Sidebar projiziert seit Issue 0121, Task 7 allein den Evaluator-Bericht:
// die Armeeanforderungen kommen aus den categoryAnchor-Slots (`capabilities`),
// die Kostensumme aus `costTotals`, die Extra-Ressourcen aus `costTotals` ×
// den Kostenarten der Datensatz-Beschreibung (`costTypes`, `isHidden`
// ausgeschlossen). Die früheren Solver-Ableitungen (getCategoryDisplayLimits,
// getExtraResourceTotals, Prozent-Suffix, WHFB6-Vererbungs-Quirk) sind aus
// diesem Pfad entfallen — der Quirk bleibt gemäß ADR-0034 undurchgesetzt, bis
// die Katalog-Forks korrigiert sind.
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
      {
        id: 'force-1',
        forceEntryId: 'fe-main',
        catalogueId: 'cat',
        selections: [],
      },
    ],
  };
}

/** Ein categoryAnchor-Slot des Berichts unter dem ersten Kontingent (Pfad "0"). */
function categoryAnchor(path, overrides = {}) {
  return [path, {
    anchorKind: 'categoryAnchor',
    defId: 'cl-core',
    targetDefId: 'cat-core',
    name: 'Core',
    current: 0,
    effectiveMin: null,
    effectiveMax: null,
    isHidden: false,
    isMandatoryUnmet: false,
    ...overrides,
  }];
}

/** Eine Autoren-Meldung in der Berichtsform der Evaluator-Fassade (Text-Pass-through). */
function authorMessage(text, severity) {
  return {
    origin: 'authorMessage',
    severity,
    anchor: { defId: 'entry-1', name: 'Special Character', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    text,
  };
}

function renderSidebar({
  roster = makeRoster(),
  costTotals = { pts: 0 },
  costTypes = [{ id: 'pts', name: 'Points' }],
  capabilities = new Map(),
  violations = [],
  // Seit Issue 0121 Task 21 nimmt die Seitenleiste den Slot-Pfad ihres
  // Kontingents entgegen, statt ihn als `'0'` anzunehmen. Die Anker dieser
  // Datei liegen unter dem ersten Kontingent (`0/1`, `0/2`, …), also `'0'` —
  // nur die Stütze wird nachgezogen, keine Erwartung.
  forcePath = '0',
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

describe('RosterSidebar category requirement rows (categoryAnchor slots)', () => {
  it('renders a row per visible category anchor with current count and effective limits', () => {
    renderSidebar({
      capabilities: new Map([
        categoryAnchor('0/1', { name: 'Core', current: 2, effectiveMin: 2, effectiveMax: 3 }),
      ]),
    });

    const row = screen.getByText('Core:').closest('.sidebar-requirement-row');
    expect(row.textContent).toMatch(/2 \/ Min: 2, Max: 3/);
  });

  it('renders a category without effective limits with its count only', () => {
    renderSidebar({
      capabilities: new Map([
        categoryAnchor('0/1', { name: 'Open', targetDefId: 'cat-open', current: 1 }),
      ]),
    });

    const row = screen.getByText('Open:').closest('.sidebar-requirement-row');
    expect(row.textContent.replace(/\s+/g, ' ').trim()).toBe('Open:1');
    expect(row.textContent).not.toMatch(/Min|Max/);
  });

  it('does not render a hidden category anchor', () => {
    renderSidebar({
      capabilities: new Map([
        categoryAnchor('0/1', { name: 'Verborgen', isHidden: true }),
      ]),
    });

    expect(screen.queryByText('Verborgen:')).toBeNull();
  });

  it('marks a row invalid when the anchor reports an unmet minimum or an exceeded maximum', () => {
    renderSidebar({
      capabilities: new Map([
        categoryAnchor('0/1', { name: 'Pflicht', current: 0, effectiveMin: 2, isMandatoryUnmet: true }),
        categoryAnchor('0/2', { name: 'Voll', targetDefId: 'cat-voll', defId: 'cl-voll', current: 4, effectiveMax: 3 }),
        categoryAnchor('0/3', { name: 'Ok', targetDefId: 'cat-ok', defId: 'cl-ok', current: 1, effectiveMax: 3 }),
      ]),
    });

    const badgeOf = (label) =>
      screen.getByText(label).closest('.sidebar-requirement-row').querySelector('span.badge');
    expect(badgeOf('Pflicht:').className).toContain('badge-danger');
    expect(badgeOf('Voll:').className).toContain('badge-danger');
    expect(badgeOf('Ok:').className).toContain('badge-muted');
  });
});

describe('RosterSidebar hidden cost types', () => {
  it('lists a non-hidden extra resource with a nonzero total', () => {
    renderSidebar({
      costTypes: [
        { id: 'pts', name: 'Points' },
        { id: 'cd', name: 'Casting Dice', isHidden: false },
      ],
      costTotals: { pts: 0, cd: 4 },
    });

    expect(screen.getByText('Casting Dice:')).toBeTruthy();
  });

  it('never surfaces a hidden cost type, even with a nonzero total', () => {
    renderSidebar({
      costTypes: [
        { id: 'pts', name: 'Points' },
        { id: 'internal', name: 'Internal Budget', isHidden: true },
      ],
      costTotals: { pts: 0, internal: 9 },
    });

    expect(screen.queryByText('Internal Budget:')).toBeNull();
  });
});

describe('RosterSidebar total costs', () => {
  it('shows the report total of the limit cost type against the roster limit', () => {
    renderSidebar({ costTotals: { pts: 420 } });

    expect(screen.getByTestId('sidebar-total-costs').textContent.replace(/\s+/g, ' ').trim())
      .toContain('420 / 1000 Pkt.');
  });
});

describe('RosterSidebar structured validation messages', () => {
  it('renders a derived evaluator violation as translated text (formatViolation)', () => {
    renderSidebar({
      violations: [{
        origin: 'derivedLimit',
        severity: 'error',
        anchor: { defId: 'def-1', name: 'Musician', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
        limitId: 'lim-1',
        limit: {
          kind: 'max',
          measure: 'selectionCount',
          costTypeId: null,
          isPercent: false,
          scope: { kind: 'parent', targetId: null, flags: { shared: true, includeChildSelections: false, includeChildForces: false } },
        },
        actual: 2,
        bound: 1,
        delta: -1,
        derivation: { base: 1, steps: [] },
      }],
    });

    // validation.evaluator.selectionCount.max.local_one mit name=Musician
    expect(
      screen.getByText('„Musician" darf höchstens einmal gewählt werden.')
    ).toBeTruthy();
  });
});

describe('RosterSidebar validation severity', () => {
  it('renders an error entry with the danger icon and no severity modifier class', () => {
    renderSidebar({
      violations: [authorMessage('Zu viele Helden gewählt.', 'error')],
    });

    expect(screen.getByTestId('icon-shield-alert')).toBeTruthy();
    expect(screen.getByText('Zu viele Helden gewählt.').closest('.validation-error-item').className)
      .not.toMatch(/--warning|--info/);
    expect(screen.getByText(/Fehlerhaft/)).toBeTruthy();
  });

  it('renders a warning entry with its own icon/class and does not mark the roster invalid', () => {
    renderSidebar({
      violations: [authorMessage('Bitte "Allow special characters?" aktivieren.', 'warning')],
    });

    expect(screen.getByTestId('icon-alert-triangle')).toBeTruthy();
    expect(screen.getByText(/aktivieren/).closest('.validation-error-item').className).toMatch(/--warning/);
    expect(screen.getByText('Gültig')).toBeTruthy();
  });

  it('renders an info entry with its own icon/class and does not mark the roster invalid', () => {
    renderSidebar({
      violations: [authorMessage('Hinweis zur Aufstellung.', 'info')],
    });

    expect(screen.getByTestId('icon-info')).toBeTruthy();
    expect(screen.getByText('Hinweis zur Aufstellung.').closest('.validation-error-item').className).toMatch(/--info/);
    expect(screen.getByText('Gültig')).toBeTruthy();
  });

  it('mixes severities: only the error contributes to the blocking count, all three render', () => {
    renderSidebar({
      violations: [
        authorMessage('Echter Verstoß.', 'error'),
        authorMessage('Nur eine Warnung.', 'warning'),
        authorMessage('Nur ein Hinweis.', 'info'),
      ],
    });

    expect(screen.getByText('Fehlerhaft (1)')).toBeTruthy();
    expect(screen.getByText('Echter Verstoß.')).toBeTruthy();
    expect(screen.getByText('Nur eine Warnung.')).toBeTruthy();
    expect(screen.getByText('Nur ein Hinweis.')).toBeTruthy();
  });
});
