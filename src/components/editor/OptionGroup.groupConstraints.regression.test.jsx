import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OptionGroupComponent from './OptionGroup';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';

// ─────────────────────────────────────────────────────────────────────────────
// Konsolidierte Regression: bedingte Gruppen-Constraints (Issue 57)
//
// Diese Datei bündelt alle Verhaltensklassen des Rüstung+Schild-Bugs zu EINER
// zusammenhängenden Aussage entlang des ECHTEN Entscheidungspfads: die reale
// `OptionGroup` rendert gegen die reale Solver-Fassade (`src/solver/validator.js`)
// — hier wird der Solver bewusst NICHT gemockt. Damit greifen die tatsächlichen
// Funktionen `canGroupMaxBeRaisedAboveSingleChoice`, `getModifiedConstraintValue`,
// `getEffectiveConstraintLimit`, `getEffectiveModifiers` und `resolveEntry`
// zusammen und treffen die Radio-/Checkbox-/Stepper-/Deaktivierungs-Entscheidung,
// die der Nutzer im Konfigurator sieht.
//
// Abgrenzung — kein Duplikat der feingranularen Tests aus Issue 02:
//   OptionGroup.test.jsx prüft dieselben Klassen isoliert und MOCKT dazu die
//   Fassade (u. a. getModifiedConstraintValue), modifierEvaluator.maxRaisable.test.js
//   prüft die statische Erkennung pur. Diese Datei ist die *ungemockte*
//   Gegenprobe: sie garantiert, dass der echte Solver den echten Render-Entscheid
//   treibt — genau die Naht, in der der Bug saß (roher statt effektiver Wert).
//
// Warum kein Puppeteer-E2E: Der reale Nutzerpfad wird hier über die reale
// Solver→Komponente-Verdrahtung abgebildet. Die eingefrorene Puppeteer-Fixture
// (`src/solver/__fixtures__/whfb6/`, ADR-0006 + deren README, Upstream-Form) trägt
// zwar den Rüstung+Schild-Fall (Vampire Counts), aber WEDER den senkenden Fall
// (Max bedingt → 1) NOCH die Deaktivierung (Max bedingt → 0); beide dürfen laut
// deren Update-Politik nicht künstlich hineingeschrieben werden, und der Fixture-
// Satz wird mit dem Smoke-Test und dem Screenshot-Werkzeug geteilt. Ein schneller,
// deterministischer Integrationstest über den echten Solver (FIRST) deckt daher
// alle fünf Klassen ab, statt die Fixture zu verunreinigen.
//
// Hinweis zu den Modifier-Bedingungen: Für den REINEN Render-Entscheid zählt der
// *effektive* Constraint-Wert. Der senkende Fall und die Deaktivierung nutzen hier
// bewusst unbedingte Modifier, um den gesenkten Effektivwert deterministisch (ohne
// nachgebauten Roster-Kontext) zu erzeugen — die *bedingte* Auswertung selbst ist
// in modifierEvaluator eigens getestet. Der Rüstung+Schild-Fall behält seinen
// bedingten increment, weil gerade die statische „hebbar trotz nicht erfüllter
// Bedingung"-Erkennung den Teufelskreis auflöst.
// ─────────────────────────────────────────────────────────────────────────────

// Lucide-Icons zu Test-IDs verflachen (reine Darstellung, nicht der Solver).
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
  BookOpen: (props) => <span data-testid="icon-book" {...props} />,
}));

// Der Regel-Link-Hook hängt an der Settings-Context-Kette und ist für den
// Constraint-Entscheid irrelevant — auf „kein Link" stellen, damit die
// Fassade (Solver) die einzige nicht gemockte Abhängigkeit bleibt.
vi.mock('../../hooks/useRuleUrl', () => ({
  useRuleUrl: () => () => null,
}));

const COST_TYPE_ID = 'pts';

// Minimales, aber gültiges reales System/Roster: die Fassaden-Funktionen laufen
// darauf echt. Optionen tragen ihre `id`/`name` direkt, sodass resolveEntry sie
// unverändert zurückgibt; parent-skopierte Gruppen-Constraints überleben die
// Filterung auch ohne aufgelöste Elterneinheit (parent ist kein Entry-Scope).
const system = { id: 'sys-regression', costTypes: [{ id: COST_TYPE_ID, name: 'Punkte' }], catalogues: [] };
const roster = { costLimitType: COST_TYPE_ID, forces: [] };
const activeCatalogue = { id: 'cat-regression' };

const option = (id, name) => ({ option: { id, name } });

const groupMaxConstraint = (id, value) => ({
  id, type: 'max', field: 'selections', scope: 'parent', value,
});

// Genau der Rüstung+Schild-Katalogfall: Gruppe max=1 plus bedingter increment auf
// diese Max-Constraint, an eine Schild-Auswahl gekoppelt (kein <repeat>).
const SHIELD_PRESENT = (shieldId) => ({
  type: 'greaterThan', field: 'selections', scope: 'parent', childId: shieldId, value: 0,
});

let subSelectionOperations;
let counts;

const getSubSelectionCount = (_selection, resolvedId) => counts[resolvedId] || 0;

const buildProps = (group) => ({
  group,
  selection: { id: 'sel-unit', entryLinkId: 'unit-link', number: 1, selections: [] },
  system,
  roster,
  getSubSelectionCount,
  subSelectionOperations,
  getOptionDescription: () => '',
  activeCatalogue,
  setActiveInfo: vi.fn(),
  onHoverEnter: vi.fn(),
  onHoverMove: vi.fn(),
  onHoverLeave: vi.fn(),
});

const renderGroup = (group) => render(<OptionGroupComponent {...buildProps(group)} />);

// Klappt die Gruppe auf, falls sie nicht ohnehin (wegen bestehender Auswahl)
// bereits offen ist — die Optionszeilen erscheinen erst dann.
const expandGroup = (groupName) => {
  if (screen.queryByTestId('icon-chevron-right')) {
    fireEvent.click(screen.getByText(groupName).closest('div'));
  }
};

const rowOf = (optionName) => screen.getByText(optionName).closest('.sub-selection-row');

beforeEach(() => {
  subSelectionOperations = createSubSelectionOperationsMock();
  counts = {};
});

describe('Issue 57 — konsolidierte Regression: bedingte Gruppen-Constraints (realer Solver)', () => {
  it('(a) Rüstung+Schild: max-hebbare Gruppe rendert als Mehrfachauswahl und beide sind gemeinsam wählbar', () => {
    // max=1 + bedingter increment auf die Gruppen-Max, an das Schild gekoppelt.
    const armourGroup = {
      id: 'grp-armour',
      name: 'Rüstung',
      constraints: [groupMaxConstraint('con-armour-max', 1)],
      modifiers: [{ type: 'increment', field: 'con-armour-max', valueObject: 1, conditions: [SHIELD_PRESENT('opt-shield')] }],
      items: [option('opt-fullplate', 'Volle Rüstung'), option('opt-shield', 'Schild')],
    };

    // Noch KEIN Schild gewählt → aktuelles effektives Max wäre 1. Der rohe-Wert-Bug
    // hätte hier Radios erzwungen (Teufelskreis). Da ein Modifier das Max über 1
    // heben KANN, muss die Gruppe dennoch als Checkboxen rendern.
    const { unmount } = renderGroup(armourGroup);
    expandGroup('Rüstung');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    unmount();

    // Rüstung ist gewählt; das Anwählen des Schilds darf sie NICHT verdrängen
    // (die alte Radio-Logik hätte genau das getan).
    counts = { 'opt-fullplate': 1 };
    renderGroup(armourGroup); // bestehende Auswahl → klappt automatisch auf
    fireEvent.click(rowOf('Schild'));
    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-shield' }));
    expect(subSelectionOperations.decreaseCount)
      .not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-fullplate' }));
  });

  it('(b) Senkender Fall: sinkt das effektive Max auf 1, wird die Gruppe zum gegenseitigen Ausschluss (Radio)', () => {
    // Basis-Max 2 (Mehrfach), unbedingt auf 1 gesenkt (realer Fall: bedingt am
    // Battle Standard Bearer). Kein Modifier HEBT über 1 → echte Einzelwahl.
    const weaponsGroup = {
      id: 'grp-weapons',
      name: 'Waffen',
      constraints: [groupMaxConstraint('con-weapons-max', 2)],
      modifiers: [{ type: 'decrement', field: 'con-weapons-max', valueObject: 1 }],
      items: [option('opt-sword', 'Schwert'), option('opt-axe', 'Axt')],
    };

    renderGroup(weaponsGroup);
    expandGroup('Waffen');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('(c) Deaktivierung: sinkt das effektive Max auf 0, ist die Gruppe nicht mehr wählbar', () => {
    const mountGroup = {
      id: 'grp-mount',
      name: 'Reittier-Panzerung',
      constraints: [groupMaxConstraint('con-mount-max', 1)],
      modifiers: [{ type: 'set', field: 'con-mount-max', valueObject: 0 }],
      items: [option('opt-barding', 'Rossharnisch')],
    };

    renderGroup(mountGroup);
    expandGroup('Reittier-Panzerung');
    const bardingRow = rowOf('Rossharnisch');
    expect(bardingRow.className).toContain('disabled');
    fireEvent.click(bardingRow);
    expect(subSelectionOperations.increaseCount)
      .not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-barding' }));
  });

  it('(d) Keine Regression: echte fix-max=1-Gruppe ohne hebenden Modifier bleibt gegenseitig ausschließendes Radio', () => {
    const magicWeapons = {
      id: 'grp-magic-weapons',
      name: 'Magische Waffen',
      constraints: [groupMaxConstraint('con-mw-max', 1)],
      modifiers: [],
      items: [option('opt-flail', 'Flegel'), option('opt-lance', 'Lanze')],
    };

    const { unmount } = renderGroup(magicWeapons);
    expandGroup('Magische Waffen');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    unmount();

    // Flegel ist gewählt; das Anwählen der Lanze verdrängt ihn (Ausschluss).
    counts = { 'opt-flail': 1 };
    renderGroup(magicWeapons); // bestehende Auswahl → offen
    fireEvent.click(rowOf('Lanze'));
    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-lance' }));
    expect(subSelectionOperations.decreaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-flail' }));
  });

  it('(e) Keine Regression: increment+<repeat> bleibt Mengen-Stepper, die übrige Gruppe bleibt Radio', () => {
    // „Arcane Items"-Muster (§9.7): max=1, aber increment MIT <repeat> auf genau
    // ein Item hebt die Kappe je gewähltem Exemplar → dieses Item ist zählbar,
    // die restliche Gruppe bleibt exklusiv.
    const arcaneItems = {
      id: 'grp-arcane',
      name: 'Arkane Gegenstände',
      constraints: [groupMaxConstraint('con-arcane-max', 1)],
      modifiers: [{ type: 'increment', field: 'con-arcane-max', valueObject: 1, repeat: { childId: 'opt-scroll', value: 1, repeats: 1 } }],
      items: [option('opt-scroll', 'Bannrolle'), option('opt-wand', 'Grauer Stab')],
    };

    renderGroup(arcaneItems);
    expandGroup('Arkane Gegenstände');

    // Grauer Stab bleibt exklusives Radio, Bannrolle wird zum Stepper.
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    const scrollRow = rowOf('Bannrolle');
    const plusButton = scrollRow.querySelector('.quantity-control button:last-child');
    expect(plusButton).not.toBeNull();

    fireEvent.click(plusButton);
    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-scroll' }));
  });
});
