import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { SelectionConfiguratorHarness as SelectionConfigurator } from '../../../../shared/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../../shared/test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../../../data/parser/xmlParser.js';
import { resolveEntry } from '../../../../domain/roster/catalogResolver.js';
import { createSelectionFromDef } from '../../../../domain/roster/selectionFactory.js';
import { replaceSelectionById, rootSelectionsOf } from '../../../../domain/roster/rosterTree.js';
import { withChangedOptionCount } from '../../../../domain/roster/subSelectionEditing.js';
import { getUnitOptions } from '../../../../domain/roster/optionsCollector.js';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../../domain/evaluation/rosterAdapter.js';

/**
 * Issue 0131 — Eine „Container-Gruppe" (ein `selectionEntryGroup`, dessen Kinder
 * ausschliesslich Links auf andere `selectionEntryGroup`s sind) soll ihre
 * Mitglieder HALTEN statt sie als Geschwister neben sich zu stellen.
 *
 * Diese Datei prueft die Kriterien 1–5 am gemeldeten Fall: der ECHTE Katalog
 * `src/shared/__fixtures__/whfb6/Ogre Kingdoms.cat`, durch die Produktionsnaht
 * (processImportedData → createSelectionFromDef → toEvaluatorRoster →
 * prepareDataset/evaluate → SelectionConfigurator). Nur die beiden
 * peripheren Nahtstellen sind gestubbt (Regel-Link-Nachschlag und der
 * Settings-Kontext), wie in den bestehenden Suiten dieses Ordners.
 *
 * Beobachtbar geprueft wird ausschliesslich das gerenderte DOM des Unit-Cards
 * und die ausgeloeste Schreiboperation — nicht, WIE der Konfigurator seine
 * Abschnitte zusammenstellt.
 */

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

vi.mock('../../../../data/rules/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const CATALOG_DIR = path.resolve('src/shared/__fixtures__/whfb6');
const GST_FILE = 'Warhammer Fantasy Battle 6th edition.gst';
const CAT_FILE = 'Ogre Kingdoms.cat';
const PTS = 'ecfa-8486-4f6c-c249';

const BRUISER_ID = 'd097-a3de-898f-91c8';
const TYRANT_ID = '2679-58f4-1771-662d';

const CONTAINER_NAME = 'MAgic Items anD biG naMeS';
const BRUISER_CONTAINER_ID = 'faf4-9300-097c-c415';
const TYRANT_CONTAINER_ID = '2802-decc-4c03-b662';

/** Die fuenf Mitglieder des Bruiser-Containers (Ids = entryLink-Ids). */
const BRUISER_MEMBERS = [
  { name: 'Big Names', id: '483a-21e9-80c5-e547' },
  { name: 'Magic Weapons', id: 'b1cb-0509-d4b2-009a' },
  { name: 'Magic Armour', id: 'd92f-1fee-5b92-0ec8' },
  { name: 'Talismans', id: '4318-e908-dd47-08c6' },
  { name: 'Enchanted Items', id: 'f84b-7030-ee5b-d3a2' },
];

/** Die Mitglieder des Tyrant-Containers — derselbe Bauplan, andere Ids/Namen. */
const TYRANT_MEMBER_NAMES = ['Big Names', 'Magic Weapons', 'Magic Armour', 'Talismans', 'Tyrant Enchanted Items'];

const KINEATER_LINK_ID = '55cb-3334-b1fa-c963';

let system;
let catalogueId;
let prepared;
let forceEntryId;

beforeAll(() => {
  const gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  const catContent = fs.readFileSync(path.join(CATALOG_DIR, CAT_FILE), 'utf8');
  system = processImportedData(
    [{ name: GST_FILE, content: gstContent }],
    [{ name: CAT_FILE, content: catContent }],
  ).system;
  catalogueId = system.catalogues[0].id;
  prepared = prepareDataset({ gameSystem: gstContent, catalogues: [catContent] });
  forceEntryId = system.forceEntries[0].id;
});

function buildRoster(unitId) {
  const entry = system.catalogues[0].selectionEntries.find(e => e.id === unitId);
  const unit = createSelectionFromDef({ system, resolveEntry, catalogueId, entry, categoryId: 'characters' });
  return {
    catalogueId,
    name: 'test',
    costLimit: 2000,
    costLimitType: PTS,
    forces: [{ id: 'force-1', forceEntryId, catalogueId, selections: [unit] }],
  };
}

/** Waehlt eine Option ueber den Sammler — derselbe Weg wie useRoster.increaseCount. */
function pickOption(roster, optionName) {
  const unitId = rootSelectionsOf(roster)[0].id;
  const collected = getUnitOptions(system, catalogueId, rootSelectionsOf(roster)[0])
    .find(o => o.option.name === optionName);
  expect(collected, `Option "${optionName}" wird am Unit angeboten`).toBeTruthy();
  const targetId = collected.ownerSelectionId || unitId;
  const roots = replaceSelectionById(rootSelectionsOf(roster), targetId, node => ({
    ...node,
    selections: withChangedOptionCount(
      node.selections || [], collected.option.id, 1,
      () => createSelectionFromDef({ system, resolveEntry, catalogueId, entry: collected.option }),
    ),
  }));
  return { ...roster, forces: [{ ...roster.forces[0], selections: roots }] };
}

function renderCard(roster, operations = createSubSelectionOperationsMock()) {
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const { capabilities } = evaluate(prepared, evalRoster);
  const selection = rootSelectionsOf(roster)[0];
  const view = render(
    <SelectionConfigurator
      selection={selection}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      system={system}
      roster={roster}
      subSelectionOperations={operations}
      activeCatalogue={system.catalogues[0]}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  return { ...view, capabilities, pathBySelectionId, selection, operations };
}

// ── DOM-Hilfen: rein beobachtend ─────────────────────────────────────────────

/** Die Kopfzeile, die dem Abschnitt selbst gehoert (nicht die eines Kindes). */
const ownHeader = (section) => {
  const header = section.querySelector('.option-group-header');
  return header && header.closest('.option-group') === section ? header : null;
};

/** Der Titel eines Abschnitts ohne den angehaengten Grenzwert. */
function labelOf(section) {
  const header = ownHeader(section);
  if (!header) return '';
  const title = header.querySelector('.text-ui-title') || header;
  const limit = title.querySelector('.option-group-limit');
  const full = title.textContent || '';
  return (limit ? full.replace(limit.textContent, '') : full).trim();
}

/** Der Grenzwert-Text eines Abschnitts ("(Max: 1)", "(0 / 100)", …). */
function limitTextOf(section) {
  const header = ownHeader(section);
  const limit = header && header.querySelector('.option-group-limit');
  return limit ? limit.textContent.trim() : '';
}

const sectionsOf = (root) => [...root.querySelectorAll('.option-group')];
const sectionByLabel = (root, label) => sectionsOf(root).find(s => labelOf(s) === label);
/** Der unmittelbar umschliessende Abschnitt — `null` bei oberster Ebene. */
const enclosingSection = (section) => section.parentElement?.closest('.option-group') ?? null;
const topLevelSections = (root) => sectionsOf(root).filter(s => enclosingSection(s) === null);
/** Zeilen, die dem Abschnitt selbst gehoeren (nicht denen seiner Kind-Abschnitte). */
const ownRows = (section) =>
  [...section.querySelectorAll('.sub-selection-row')].filter(r => r.closest('.option-group') === section);

/**
 * Klappt jeden noch zugeklappten Abschnitt auf, bis keiner mehr zugeklappt ist —
 * ein frisch aufgeklappter Container kann weitere Abschnitte freilegen.
 */
function expandAll(root, rounds = 8) {
  for (let i = 0; i < rounds; i += 1) {
    const collapsed = sectionsOf(root).filter(s => {
      const header = ownHeader(s);
      return header && header.querySelector('[data-testid="icon-chevron-right"]');
    });
    if (collapsed.length === 0) return;
    collapsed.forEach(s => fireEvent.click(ownHeader(s)));
  }
}

/** Capability eines Slots unterhalb eines Pfads per Definitions-Id. */
function capabilityUnder(capabilities, parentPath, defId) {
  for (const [slotPath, capability] of capabilities) {
    if (slotPath.startsWith(`${parentPath}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

/** True, wenn das Operations-Argument die Options-Definition identifiziert. */
const identifiesOption = (arg, defId) => arg === defId || arg?.id === defId || arg?.defId === defId;

// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 1 — die Container-Gruppe haelt ihre Mitglieder (Ogre Bruiser)', () => {
  test('das Aufklappen des Containers zeigt alle fuenf Mitgliedsgruppen INNERHALB seines Abschnitts', () => {
    const roster = buildRoster(BRUISER_ID);
    const { container, capabilities, pathBySelectionId, selection } = renderCard(roster);

    // Vorbedingung am echten Bericht: ein Container-Anker mit Budget 50 und die
    // fuenf Mitglieder-Anker liegen alle unter dem Unit-Pfad.
    const unitPath = pathBySelectionId.get(selection.id);
    expect(unitPath).toBe('0/0');
    expect(capabilityUnder(capabilities, unitPath, BRUISER_CONTAINER_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', costLimits: [expect.objectContaining({ bound: 50 })] });
    BRUISER_MEMBERS.forEach(member => {
      expect(capabilityUnder(capabilities, unitPath, member.id), `Anker fuer ${member.name}`)
        .toMatchObject({ anchorKind: 'groupAnchor' });
    });

    expandAll(container);

    const containerSection = sectionByLabel(container, CONTAINER_NAME);
    expect(containerSection, `Abschnitt "${CONTAINER_NAME}" steht auf der Karte`).toBeTruthy();

    BRUISER_MEMBERS.forEach(member => {
      const memberSection = sectionByLabel(container, member.name);
      expect(memberSection, `Abschnitt "${member.name}" steht auf der Karte`).toBeTruthy();
      expect(memberSection).not.toBe(containerSection);
      // Enthalten — und zwar unmittelbar: der Container ist der naechste
      // umschliessende Abschnitt, nicht bloss irgendein Vorfahre.
      expect(
        containerSection.contains(memberSection),
        `"${member.name}" liegt im Abschnitt des Containers`,
      ).toBe(true);
      expect(
        enclosingSection(memberSection),
        `"${member.name}" haengt unmittelbar am Container`,
      ).toBe(containerSection);
    });
  });

  test('keine der fuenf Mitgliedsgruppen ist ein Geschwister-Abschnitt des Containers', () => {
    const roster = buildRoster(BRUISER_ID);
    const { container } = renderCard(roster);
    expandAll(container);

    const topLevelLabels = topLevelSections(container).map(labelOf);

    // Positivkontrolle: der Container und die beiden echten Optionsgruppen
    // stehen weiterhin auf oberster Ebene.
    expect(topLevelLabels).toContain(CONTAINER_NAME);
    expect(topLevelLabels).toContain('Weapons Selection');
    expect(topLevelLabels).toContain('Armour');

    BRUISER_MEMBERS.forEach(member => {
      expect(topLevelLabels, `"${member.name}" ist kein Geschwister des Containers`)
        .not.toContain(member.name);
    });
  });

  test('derselbe Bauplan beim Tyrant: auch dort haelt der Container seine fuenf Mitglieder', () => {
    const roster = buildRoster(TYRANT_ID);
    const { container, capabilities, pathBySelectionId, selection } = renderCard(roster);

    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityUnder(capabilities, unitPath, TYRANT_CONTAINER_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', costLimits: [expect.objectContaining({ bound: 100 })] });

    expandAll(container);

    const containerSection = sectionByLabel(container, CONTAINER_NAME);
    expect(containerSection).toBeTruthy();
    const topLevelLabels = topLevelSections(container).map(labelOf);

    TYRANT_MEMBER_NAMES.forEach(name => {
      const memberSection = sectionByLabel(container, name);
      expect(memberSection, `Abschnitt "${name}" steht auf der Karte`).toBeTruthy();
      expect(enclosingSection(memberSection), `"${name}" haengt am Container`).toBe(containerSection);
      expect(topLevelLabels).not.toContain(name);
    });
  });
});

describe('Kriterium 2 — das Budget des Containers bleibt auf der Karte lesbar (Ogre Tyrant)', () => {
  test('ohne Auswahl zeigt die Kopfzeile des haltenden Containers 0 / 100 und keine Fehler-Auszeichnung', () => {
    const roster = buildRoster(TYRANT_ID);
    const { container, capabilities, pathBySelectionId, selection } = renderCard(roster);

    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityUnder(capabilities, unitPath, TYRANT_CONTAINER_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', costLimits: [expect.objectContaining({ bound: 100, current: 0 })] });

    expandAll(container);

    const containerSection = sectionByLabel(container, CONTAINER_NAME);
    expect(containerSection).toBeTruthy();
    // Das Budget haelt seinen Platz genau dort, wo jetzt die Mitglieder haengen.
    expect(enclosingSection(sectionByLabel(container, 'Big Names'))).toBe(containerSection);
    expect(limitTextOf(containerSection)).toMatch(/0\s*\/\s*100/);
    expect(ownHeader(containerSection).className).not.toContain('option-group-header--error');
  });

  test('bei 105 Punkten zeigt dieselbe Kopfzeile 105 / 100 in Fehler-Auszeichnung — und haelt weiter ihre Mitglieder', () => {
    let roster = buildRoster(TYRANT_ID);
    roster = pickOption(roster, 'Wallcrusher');   // 15
    roster = pickOption(roster, 'Thundermace');   // 55
    roster = pickOption(roster, 'Kineater');      // 35
    const { container, capabilities, pathBySelectionId, selection } = renderCard(roster);

    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityUnder(capabilities, unitPath, TYRANT_CONTAINER_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', costLimits: [expect.objectContaining({ bound: 100, current: 105 })] });

    expandAll(container);

    const containerSection = sectionByLabel(container, CONTAINER_NAME);
    expect(containerSection).toBeTruthy();
    expect(enclosingSection(sectionByLabel(container, 'Big Names'))).toBe(containerSection);
    expect(enclosingSection(sectionByLabel(container, 'Magic Weapons'))).toBe(containerSection);
    expect(limitTextOf(containerSection)).toMatch(/105\s*\/\s*100/);
    expect(ownHeader(containerSection).className).toContain('option-group-header--error');
  });
});

describe('Kriterium 3 — eine verschachtelte Mitgliedsgruppe verhaelt sich wie zuvor (Ogre Bruiser)', () => {
  test('die verschachtelte Gruppe "Big Names" traegt ihre eigene Grenze (Max: 1) in ihrer eigenen Kopfzeile', () => {
    const roster = buildRoster(BRUISER_ID);
    const { container } = renderCard(roster);
    expandAll(container);

    const containerSection = sectionByLabel(container, CONTAINER_NAME);
    const bigNames = sectionByLabel(container, 'Big Names');
    expect(bigNames).toBeTruthy();
    expect(enclosingSection(bigNames)).toBe(containerSection);
    expect(limitTextOf(bigNames)).toMatch(/Max:\s*1/);
  });

  test('die Wahl von Kineater in der verschachtelten Gruppe loest unveraendert increaseCount(Unit, Kineater) aus', () => {
    const roster = buildRoster(BRUISER_ID);
    const operations = createSubSelectionOperationsMock();
    const { container, selection } = renderCard(roster, operations);
    expandAll(container);

    const containerSection = sectionByLabel(container, CONTAINER_NAME);
    const bigNames = sectionByLabel(container, 'Big Names');
    expect(bigNames).toBeTruthy();
    expect(enclosingSection(bigNames)).toBe(containerSection);

    const kineaterRow = screen.getByText('Kineater').closest('.sub-selection-row');
    expect(kineaterRow, 'Kineater ist eine Zeile der verschachtelten Gruppe').toBeTruthy();
    expect(kineaterRow.closest('.option-group')).toBe(bigNames);

    const control = kineaterRow.querySelector('input[type="radio"], input[type="checkbox"]');
    expect(control).toBeTruthy();
    fireEvent.click(control);

    // Unveraendertes Ziel: die Unit-Selektion selbst, mit der Kineater-Option.
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], KINEATER_LINK_ID),
    ), 'increaseCount(unitSelectionId, Kineater)').toBe(true);
    expect(operations.addInstance).not.toHaveBeenCalled();
  });
});

describe('Kriterium 4 — kein Abschnitt ohne Optionszeilen und ohne verschachtelte Mitglieder (Ogre Bruiser)', () => {
  test('jeder Abschnitt der Bruiser-Karte zeigt aufgeklappt entweder Optionszeilen oder Mitgliedsgruppen', () => {
    const roster = buildRoster(BRUISER_ID);
    const { container } = renderCard(roster);
    expandAll(container);

    const empty = sectionsOf(container)
      .filter(s => ownRows(s).length === 0 && s.querySelectorAll('.option-group').length === 0)
      .map(labelOf);

    expect(empty, 'leere Abschnitte auf der Karte').toEqual([]);
  });
});

describe('Kriterium 5 — eine Gruppe, die selbst Optionen haelt, bleibt unveraendert (Ogre Bruiser)', () => {
  test('"Weapons Selection" bleibt auf oberster Ebene und zeigt ihre vier Optionen als direkte Zeilen', () => {
    const roster = buildRoster(BRUISER_ID);
    const { container } = renderCard(roster);
    expandAll(container);

    const weapons = sectionByLabel(container, 'Weapons Selection');
    expect(weapons).toBeTruthy();
    expect(enclosingSection(weapons), '"Weapons Selection" ist nicht verschachtelt').toBeNull();
    expect(weapons.querySelectorAll('.option-group').length, 'keine Mitgliedsgruppen').toBe(0);
    expect(limitTextOf(weapons)).toMatch(/Max:\s*1/);

    const rowTexts = ownRows(weapons).map(r => r.textContent);
    ['Great Weapon', 'Two Hand Weapons', 'Cathayan Longsword', 'Ogre Ironfist'].forEach(name => {
      expect(rowTexts.some(t => t.includes(name)), `${name} ist eine direkte Zeile`).toBe(true);
    });
    expect(ownRows(weapons)).toHaveLength(4);
  });

  test('"Armour" (Pflichtgruppe mit Vorauswahl) bleibt ebenso unverschachtelt mit direkten Zeilen', () => {
    const roster = buildRoster(BRUISER_ID);
    const { container } = renderCard(roster);
    expandAll(container);

    const armour = sectionByLabel(container, 'Armour');
    expect(armour).toBeTruthy();
    expect(enclosingSection(armour), '"Armour" ist nicht verschachtelt').toBeNull();
    expect(armour.querySelectorAll('.option-group').length, 'keine Mitgliedsgruppen').toBe(0);

    const rowTexts = ownRows(armour).map(r => r.textContent);
    ['Light Armour', 'Heavy Armour'].forEach(name => {
      expect(rowTexts.some(t => t.includes(name)), `${name} ist eine direkte Zeile`).toBe(true);
    });
    expect(ownRows(armour)).toHaveLength(2);
  });
});
