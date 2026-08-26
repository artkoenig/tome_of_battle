import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { SelectionConfiguratorHarness as SelectionConfigurator } from '../../../../tests/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../../tests/test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../../../platform/battlescribe/xmlParser.js';
import { resolveEntry } from '../../../../contexts/armylist/model/catalogResolver.js';
import { createSelectionFromDef } from '../../../../contexts/armylist/model/selectionFactory.js';
import { rootSelectionsOf } from '../../../../contexts/armylist/model/rosterTree.js';
import { prepareDataset, evaluate } from '../../../../contexts/ruleengine/evaluator.js';
import { toEvaluatorRoster } from '../../../../contexts/ruleengine/acl/rosterAdapter.js';

/**
 * Issue 0143 — „Die Einheitenkarte verliert die Gruppenzugehoerigkeit:
 * namenlose Abschnitte und heimatlose Options-Zeilen".
 *
 * Diese Datei prueft die Kriterien 1, 3, 5, 6 und 7 am gemeldeten Fall: dem
 * **Vampire Thrall** (`e37b-c827-99ac-b706`) des echten Katalogs
 * `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/Vampire Counts (6th definitive
 * edition).cat`, im Kontingent `Standard (VC-AB)`. Kriterium 2 und 4 laufen
 * ueber alle sechs Fixture-Kataloge und stehen deshalb in
 * `SelectionConfigurator.groupMembership.fixtureSweep.test.jsx`; Kriterium 4
 * wird hier zusaetzlich an der gemeldeten Karte selbst festgehalten.
 *
 * Gefahren wird durch die Produktionsnaht (processImportedData →
 * createSelectionFromDef → toEvaluatorRoster → prepareDataset/evaluate →
 * SelectionConfigurator); nur Regel-Link-Nachschlag und Settings-Kontext sind
 * gestubbt — dasselbe Muster wie
 * `SelectionConfigurator.containerGroups.integration.test.jsx` (Issue 0131).
 *
 * Beobachtet wird ausschliesslich das gerenderte DOM der Einheitenkarte und die
 * ausgeloeste Schreiboperation — nicht, WIE der Konfigurator Mitgliedschaft und
 * Namen zusammentraegt.
 */

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

vi.mock('../../../../contexts/rulebook/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const CATALOG_DIR = path.resolve('src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive');
const GST_FILE = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const CAT_FILE = 'Vampire Counts (6th definitive edition).cat';
const PTS = 'ecfa-8486-4f6c-c249';

const THRALL_ID = 'e37b-c827-99ac-b706';
const STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';   // <forceEntry name="Standard (VC-AB)">
const LAHMIA_FORCE_ID = '2102-34f1-c876-98c5';     // <forceEntry name="Clan Lahmia (VC-AB)">

// Die beiden Container-Gruppen des Thralls: beide tragen keine eigene Grenze
// und bekommen deshalb keinen Anker im Bericht.
//
// `Magic selection` (Gruppe 53e8-0ce2-eaf6-0163, `.cat:21290`) haelt ZWEI
// Container: `Bloodline` (Link 85fb-0691-1ee6-37f8 -> Gruppe
// 0719-24b8-19d4-c832, `.cat:21223`) mit fuenf durchweg versteckten
// `Vampiric Powers`, und `Magic Items` mit den Magie-Gegenstandsgruppen. Die
// acht Magie-Gruppen der Karte haengen an `Magic Items`, nicht an `Bloodline`.
const MAGIC_ITEMS = 'Magic Items';   // Gruppe 11e6-e9d4-f6e4-c02d (`.cat:21272`), verlinkt als 14d2-cec2-9b1c-418c
const EQUIPMENT = 'Equipment';       // Gruppe 3588-2a1f-2754-0f50 (`.cat:3588`)

/** Die acht Magie-Gegenstandsgruppen, die `Magic Items` auf dieser Karte haelt. */
const MAGIC_ITEMS_MEMBERS = [
  'Magic Weapons (VC)',
  'Magic Armour (VC)',
  'Magic Talismans (VC)',
  'Arcane Items (VC)',
  'Enchanted Items (VC)',
  'Magic Armour (Common)',
  'Magic Talismans (Common)',
  'Magic Weapons (Common)',
];

const MAGIC_WEAPONS_VC = 'Magic Weapons (VC)';   // Gruppe bf27-6ca6-5c3a-3449
const MAGIC_SELECTION = 'Magic selection';       // Gruppen-Link 2e0c-7fa1-642c-54b7 (max 50 pts)

const BLOOD_DRINKER_LINK_ID = '8427-3c8d-f4af-8af3';   // entryLink in `Magic Weapons (VC)`
const FROSTBLADE_LINK_ID = '506f-3f9c-a66a-b9fc';      // Nachbar in derselben Gruppe

/**
 * Die Zeilen der Thrall-Karte in `Standard (VC-AB)` — das Angebot des Berichts,
 * Stand dieser Ausgabe. Kriterium 4: diese Menge darf sich durch die Aenderung
 * nicht bewegen, nur ihre Verteilung auf Abschnitte.
 */
const THRALL_ROWS = [
  'Arcane Items (Relics of Lustria)',
  'Armour of Bone',
  'Battle Standard Bearer',
  'Biting Blade',
  'Black Axe of Krell',
  'Black Periapt',
  'Blood Drinker',
  'Book of Arkhan',
  'Casket of Ages',
  'Cloak of Mist and Shadows',
  'Crown of the Damned',
  'Cursed Book',
  'Dispel Scroll (one use only)',
  'Enchanted Shield',
  'Frostblade',
  'Great Weapon',
  'Handweapon',
  'Lance',
  'Magic Armour (Relics of Lustria)',
  'Magic Talismans (Relics of Lustria)',
  'Magic Weapons (Relics of Lustria)',
  'Nightmare',
  'Obsidian Amulet',
  'Power Familiar',
  'Power Stone (only one use)',
  'Ring of the Night',
  'Rod of Flaming Death',
  'Spell Familiar',
  'Staff of Damnation',
  'Staff of Sorcery',
  'Sword of Battle',
  'Sword of Might',
  'Sword of Striking',
  'Sword of Unholy Power',
  'Talisman of Protection',
  'Talon of Death',
  'The Cursed Shield of Mousillon',
  'The Flayed Hauberk',
  'The Gem of Blood (one use only)',
  'Tomb Blade',
  'Two Hand Weapons',
  'Wailing Helm',
  'Warrior Familiar',
  'Wristbands of Black Gold',
];

let system;
let catalogue;
let prepared;

beforeAll(() => {
  const gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  const catContent = fs.readFileSync(path.join(CATALOG_DIR, CAT_FILE), 'utf8');
  system = processImportedData(
    [{ name: GST_FILE, content: gstContent }],
    [{ name: CAT_FILE, content: catContent }],
  ).system;
  catalogue = system.catalogues[0];
  prepared = prepareDataset({ gameSystem: gstContent, catalogues: [catContent] });
});

function buildRoster(unitId, forceEntryId) {
  const entry = catalogue.selectionEntries.find(e => e.id === unitId);
  const unit = createSelectionFromDef({ system, resolveEntry, catalogueId: catalogue.id, entry });
  return {
    catalogueId: catalogue.id,
    name: 'test',
    costLimit: 3000,
    costLimitType: PTS,
    forces: [{ id: 'force-1', forceEntryId, catalogueId: catalogue.id, selections: [unit] }],
  };
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
      activeCatalogue={catalogue}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  return { ...view, capabilities, pathBySelectionId, selection, operations };
}

/** Die Thrall-Karte, aufgeklappt — der Normalfall dieser Datei. */
function renderThrall(forceEntryId = STANDARD_FORCE_ID, operations) {
  const rendered = renderCard(buildRoster(THRALL_ID, forceEntryId), operations);
  expandAll(rendered.container);
  return rendered;
}

// ── DOM-Hilfen: rein beobachtend (Muster aus Issue 0131) ─────────────────────

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

const sectionsOf = (root) => [...root.querySelectorAll('.option-group')];
const sectionsByLabel = (root, label) => sectionsOf(root).filter(s => labelOf(s) === label);
const sectionByLabel = (root, label) => sectionsByLabel(root, label)[0];
/** Der unmittelbar umschliessende Abschnitt — `null` bei oberster Ebene. */
const enclosingSection = (section) => section.parentElement?.closest('.option-group') ?? null;
/** Die Kette der umschliessenden Abschnitte, von innen nach aussen. */
function ancestorSections(section) {
  const chain = [];
  for (let s = enclosingSection(section); s; s = enclosingSection(s)) chain.push(s);
  return chain;
}
/** Abschnitte, die unmittelbar in `section` haengen. */
const childSections = (section) => sectionsOf(section).filter(s => enclosingSection(s) === section);
/** Zeilen, die dem Abschnitt selbst gehoeren (nicht denen seiner Kind-Abschnitte). */
const ownRows = (section) =>
  [...section.querySelectorAll('.sub-selection-row')].filter(r => r.closest('.option-group') === section);

const allRows = (root) => [...root.querySelectorAll('.sub-selection-row')];
const nameOfRow = (row) => row.querySelector('.sub-selection-option-name')?.textContent.trim() ?? '';
const rowsNamed = (root, name) => allRows(root).filter(r => nameOfRow(r) === name);
const rowNames = (root) => allRows(root).map(nameOfRow);

/**
 * Klappt jeden noch zugeklappten Abschnitt auf, bis keiner mehr zugeklappt ist —
 * ein frisch aufgeklappter Container kann weitere Abschnitte freilegen.
 */
function expandAll(root, rounds = 12) {
  for (let i = 0; i < rounds; i += 1) {
    const collapsed = sectionsOf(root).filter(s => {
      const header = ownHeader(s);
      return header && header.querySelector('[data-testid="icon-chevron-right"]');
    });
    if (collapsed.length === 0) return;
    collapsed.forEach(s => fireEvent.click(ownHeader(s)));
  }
}

/** Der Slot des Berichts unter `parentPath` mit diesem Namen (getrimmt). */
function capabilityNamed(capabilities, parentPath, name) {
  for (const [slotPath, capability] of capabilities) {
    if (!slotPath.startsWith(`${parentPath}/`)) continue;
    if ((capability.name || '').trim() === name) return capability;
  }
  return undefined;
}

/** True, wenn das Operations-Argument die Options-Definition identifiziert. */
const identifiesOption = (arg, defId) => arg === defId || arg?.id === defId || arg?.defId === defId;

const sortedNames = (names) => [...names].sort();

// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 1 — eine Container-Gruppe traegt den Namen, den ihr der Katalog gibt', () => {
  test('der Abschnitt in "Magic selection", der die acht Magie-Gruppen haelt, heisst "Magic Items"', () => {
    const { container } = renderThrall();

    const magicWeapons = sectionByLabel(container, MAGIC_WEAPONS_VC);
    expect(magicWeapons, `Abschnitt "${MAGIC_WEAPONS_VC}" steht auf der Karte`).toBeTruthy();

    // Der haltende Abschnitt: der naechste umschliessende — er soll den
    // Katalognamen der Gruppe 11e6-e9d4-f6e4-c02d tragen.
    const holder = enclosingSection(magicWeapons);
    expect(holder, `"${MAGIC_WEAPONS_VC}" haengt in einem Abschnitt`).toBeTruthy();
    expect(labelOf(holder)).toBe(MAGIC_ITEMS);

    // Und er selbst haengt unmittelbar in "Magic selection".
    const magicSelection = enclosingSection(holder);
    expect(magicSelection, `"${MAGIC_ITEMS}" haengt in einem Abschnitt`).toBeTruthy();
    expect(labelOf(magicSelection)).toBe(MAGIC_SELECTION);

    // Alle acht Mitglieder haengen unmittelbar an ihm.
    MAGIC_ITEMS_MEMBERS.forEach(name => {
      const member = sectionByLabel(container, name);
      expect(member, `Abschnitt "${name}" steht auf der Karte`).toBeTruthy();
      expect(enclosingSection(member), `"${name}" haengt unmittelbar an "${MAGIC_ITEMS}"`).toBe(holder);
    });
    expect(childSections(holder).map(labelOf).sort()).toEqual([...MAGIC_ITEMS_MEMBERS].sort());
  });

  test('der Abschnitt, der "Weapons" haelt, heisst "Equipment" und steht auf oberster Ebene', () => {
    const { container } = renderThrall();

    const weapons = sectionByLabel(container, 'Weapons');
    expect(weapons, 'Abschnitt "Weapons" steht auf der Karte').toBeTruthy();

    const holder = enclosingSection(weapons);
    expect(holder, '"Weapons" haengt in einem Abschnitt').toBeTruthy();
    expect(labelOf(holder)).toBe(EQUIPMENT);
    // Der Katalog haengt `Equipment` unmittelbar an die Einheit.
    expect(enclosingSection(holder), `"${EQUIPMENT}" ist nicht verschachtelt`).toBeNull();
  });

  test('Grenzfall: jeder Abschnitt der Thrall-Karte traegt einen Titel — "Magic Items" und "Equipment" je genau einmal', () => {
    const { container } = renderThrall();

    const untitled = sectionsOf(container).filter(s => labelOf(s) === '');
    expect(untitled.length, 'Abschnitte ohne Titel auf der Thrall-Karte').toBe(0);

    // Wiederholung: der Name entsteht genau einmal, nicht je Mitglied erneut.
    expect(sectionsByLabel(container, MAGIC_ITEMS)).toHaveLength(1);
    expect(sectionsByLabel(container, EQUIPMENT)).toHaveLength(1);
  });
});

describe('Kriterium 3 — eine angebotene Option steht in der Gruppe, die der Katalog ihr gibt', () => {
  test('"Blood Drinker" ist eine Zeile in "Magic Weapons (VC)", nicht eine heimatlose Zeile', () => {
    const { container, capabilities, pathBySelectionId, selection } = renderThrall();

    // Vorbedingung am echten Bericht: die Option wird angeboten und ist nicht versteckt.
    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityNamed(capabilities, unitPath, 'Blood Drinker'))
      .toMatchObject({ anchorKind: 'offerAnchor', isHidden: false, defId: BLOOD_DRINKER_LINK_ID });

    // Wiederholung: genau eine Zeile, nicht zusaetzlich eine heimatlose daneben.
    const rows = rowsNamed(container, 'Blood Drinker');
    expect(rows, '"Blood Drinker" steht genau einmal auf der Karte').toHaveLength(1);

    const holder = rows[0].closest('.option-group');
    expect(holder, '"Blood Drinker" steht in einem Abschnitt').toBeTruthy();
    expect(labelOf(holder)).toBe(MAGIC_WEAPONS_VC);
    // Es ist eine EIGENE Zeile dieses Abschnitts, keine seines Kindes.
    expect(ownRows(holder).map(nameOfRow)).toContain('Blood Drinker');

    // Und die Gruppe selbst liegt in "Magic selection".
    const magicSelection = sectionByLabel(container, MAGIC_SELECTION);
    expect(magicSelection, `Abschnitt "${MAGIC_SELECTION}" steht auf der Karte`).toBeTruthy();
    expect(magicSelection.contains(holder), `"${MAGIC_WEAPONS_VC}" liegt in "${MAGIC_SELECTION}"`).toBe(true);
  });

  test('Grenzfall: "Handweapon" — vom Katalog unmittelbar an der Einheit gefuehrt — bleibt eine Zeile ausserhalb jedes Abschnitts', () => {
    const { container } = renderThrall();

    const rows = rowsNamed(container, 'Handweapon');
    expect(rows, '"Handweapon" steht genau einmal auf der Karte').toHaveLength(1);
    expect(rows[0].closest('.option-group'), '"Handweapon" gehoert keiner Gruppe an').toBeNull();
  });
});

describe('Kriterium 4 — das Angebot der Karte bewegt sich nicht (gemeldete Karte)', () => {
  test('die Thrall-Karte zeigt genau dieselben Options-Zeilen wie zuvor — nur anders verteilt', () => {
    const { container } = renderThrall();
    expect(sortedNames(rowNames(container))).toEqual(sortedNames(THRALL_ROWS));
  });
});

describe('Kriterium 5 — eine vom Bericht versteckte Option steht nirgends', () => {
  test('"Asp Bow" (isHidden im Bericht) hat in "Standard (VC-AB)" keine Zeile', () => {
    const { container, capabilities, pathBySelectionId, selection } = renderThrall(STANDARD_FORCE_ID);

    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityNamed(capabilities, unitPath, 'Asp Bow'), 'der Bericht kennt den Slot')
      .toMatchObject({ anchorKind: 'offerAnchor', isHidden: true });

    expect(rowsNamed(container, 'Asp Bow'), '"Asp Bow" steht nicht auf der Karte').toHaveLength(0);
  });

  test('dasselbe im Kontingent "Clan Lahmia (VC-AB)", wo der Bericht sie ebenfalls versteckt', () => {
    const { container, capabilities, pathBySelectionId, selection } = renderThrall(LAHMIA_FORCE_ID);

    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityNamed(capabilities, unitPath, 'Asp Bow')).toMatchObject({ isHidden: true });

    expect(rowsNamed(container, 'Asp Bow')).toHaveLength(0);
    // Positivkontrolle: die nicht versteckte Nachbarin derselben Gruppe steht sehr wohl da.
    expect(rowsNamed(container, 'Blood Drinker')).toHaveLength(1);
  });

  test('Grenzfall: "Winged Nightmare" ist in der gerenderten Gruppe "Mounts" versteckt und fehlt dort als Zeile', () => {
    const { container, capabilities, pathBySelectionId, selection } = renderThrall();

    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityNamed(capabilities, unitPath, 'Winged Nightmare')).toMatchObject({ isHidden: true });

    const mounts = sectionByLabel(container, 'Mounts');
    expect(mounts, 'Abschnitt "Mounts" steht auf der Karte').toBeTruthy();
    expect(ownRows(mounts).map(nameOfRow)).toEqual(['Nightmare']);
    expect(rowsNamed(container, 'Winged Nightmare')).toHaveLength(0);
  });
});

describe('Kriterium 6 — die Wahl schreibt unveraendert an dieselbe Selektion', () => {
  test('"Blood Drinker" waehlen loest increaseCount(Unit, Blood-Drinker-Link) aus', () => {
    const operations = createSubSelectionOperationsMock();
    const { container, selection } = renderThrall(STANDARD_FORCE_ID, operations);

    const row = rowsNamed(container, 'Blood Drinker')[0];
    expect(row, '"Blood Drinker" steht auf der Karte').toBeTruthy();
    const control = row.querySelector('input[type="radio"], input[type="checkbox"]');
    expect(control, '"Blood Drinker" hat einen Wahlschalter').toBeTruthy();
    fireEvent.click(control);

    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], BLOOD_DRINKER_LINK_ID),
    ), 'increaseCount(unitSelectionId, Blood Drinker)').toBe(true);
    expect(operations.increaseCount).toHaveBeenCalledTimes(1);
    expect(operations.addInstance).not.toHaveBeenCalled();
    expect(operations.decreaseCount).not.toHaveBeenCalled();
  });

  test('die Nachbarin derselben Gruppe, "Frostblade", schreibt an dieselbe Selektion', () => {
    const operations = createSubSelectionOperationsMock();
    const { container, selection } = renderThrall(STANDARD_FORCE_ID, operations);

    const row = rowsNamed(container, 'Frostblade')[0];
    expect(row, '"Frostblade" steht auf der Karte').toBeTruthy();
    const control = row.querySelector('input[type="radio"], input[type="checkbox"]');
    expect(control).toBeTruthy();
    fireEvent.click(control);

    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], FROSTBLADE_LINK_ID),
    ), 'increaseCount(unitSelectionId, Frostblade)').toBe(true);
    expect(operations.addInstance).not.toHaveBeenCalled();
  });
});

describe('Kriterium 7 — das Ergebnis von Issue 0131 bleibt bestehen', () => {
  test('"Weapons" haelt seine Optionen als eigene Zeilen und keine Mitgliedsgruppen', () => {
    const { container } = renderThrall();

    const weapons = sectionByLabel(container, 'Weapons');
    expect(weapons).toBeTruthy();
    expect(childSections(weapons), '"Weapons" haelt keine Gruppen').toHaveLength(0);
    expect(sortedNames(ownRows(weapons).map(nameOfRow)))
      .toEqual(sortedNames(['Two Hand Weapons', 'Great Weapon', 'Lance']));
  });

  test('"Magic Weapons (VC)" haengt in der Tiefe, die der Katalog vorgibt: zwei Abschnitte darueber', () => {
    const { container } = renderThrall();

    const magicWeapons = sectionByLabel(container, MAGIC_WEAPONS_VC);
    expect(magicWeapons).toBeTruthy();
    // Katalog: Magic selection → Magic Items → Magic Weapons (VC).
    expect(ancestorSections(magicWeapons)).toHaveLength(2);
  });

  test('kein Abschnitt der Thrall-Karte steht ohne Zeilen UND ohne Mitgliedsgruppen da', () => {
    const { container } = renderThrall();

    const barren = sectionsOf(container)
      .filter(s => ownRows(s).length === 0 && childSections(s).length === 0)
      .map(labelOf);
    expect(barren, 'inhaltslose Abschnitte auf der Karte').toEqual([]);
  });
});
