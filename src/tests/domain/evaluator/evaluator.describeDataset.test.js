/**
 * Tests der Fassaden-Funktion `describeDataset` (Main-Issue 75, Slice 01): der
 * Datensatz laesst sich **ohne Roster** beschreiben (ADR-0034) — Kostenarten,
 * spielbare Kataloge gegenueber Bibliotheken, anlegbare Kontingente, und die
 * Diagnosen des Katalog-Vorlaufs.
 *
 * Geprueft wird an synthetischen Miniatur-Datensaetzen **und** an den echten
 * Definitive-Edition-Katalogdaten des Repos: erst dort ist belegt, dass die
 * Einordnung „spielbar vs. Bibliothek" aus den Katalogdaten selbst stammt und
 * nicht aus einer Namensliste.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { describeDataset, evaluate, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { DiagnosticKind } from '../../../domain/evaluator/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0000-0000-0000';
const OTHER_GAME_SYSTEM_ID = 'gs-ffff-ffff-ffff';
const POINTS_COST_TYPE_ID = 'cost-points';

const GAME_SYSTEM_XML = `<?xml version="1.0"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${POINTS_COST_TYPE_ID}" name="pts" defaultCostLimit="2000"/></costTypes>
  </gameSystem>`;

const ARMY_CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-army" name="Army" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <forceEntries>
      <forceEntry id="force-standard" name="Standard"/>
      <forceEntry id="force-wip" name="[WIP] Horde" hidden="true">
        <forceEntries><forceEntry id="force-nested" name="Detachment"/></forceEntries>
      </forceEntry>
    </forceEntries>
  </catalogue>`;

const LIBRARY_CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-library" name="Mercenaries" gameSystemId="${GAME_SYSTEM_ID}" library="true"/>`;

const SYNTHETIC_DATASET = {
  gameSystem: GAME_SYSTEM_XML,
  catalogues: [ARMY_CATALOGUE_XML, LIBRARY_CATALOGUE_XML],
};

// ── Die echten Definitive-Edition-Katalogdaten des Repos ──────────────────────
const FIXTURE_DIR = join(process.cwd(), 'src/domain/evaluator/__fixtures__/whfb6-definitive');
const WHFB_GAME_SYSTEM_ID = '0d13-7737-ea86-4662';
const POINTS_ID_WHFB = 'ecfa-8486-4f6c-c249';
const VAMPIRE_COUNTS_ID = '4d73-5ab0-9020-403c';
const MERCENARIES_ID = 'fc47-8392-a6c8-452a';
const VAMPIRE_COUNTS_STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

const WHFB_DATASET = {
  gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
  catalogues: [
    fixture('Vampire Counts (6th definitive edition).cat'),
    fixture('Mercenaries (6th definitive edition).cat'),
  ],
};

// Die echten Kataloge sind gross; die Beschreibung ist eine reine Funktion und
// wird deshalb einmal fuer alle Faelle gebildet statt je Fall neu.
const WHFB_DESCRIPTION = describeDataset(prepareDataset(WHFB_DATASET));

/** Der beschriebene Eintrag mit gegebener ID, oder `undefined`. */
function byId(entries, id) {
  return entries.find(entry => entry.id === id);
}

describe('describeDataset: Kostenarten ohne Roster', () => {
  it('nennt Kostenart-ID, Klartext-Name und Vorgabe-Grenze', () => {
    const description = describeDataset(prepareDataset(SYNTHETIC_DATASET));

    expect(description.costTypes).toEqual([
      { id: POINTS_COST_TYPE_ID, name: 'pts', defaultLimit: 2000, isHidden: false },
    ]);
  });

  it('nennt die Kostenart der echten Katalogdaten mit ihrem Katalog-Namen', () => {
    const points = byId(WHFB_DESCRIPTION.costTypes, POINTS_ID_WHFB);

    expect(points).toMatchObject({ name: 'pts', isHidden: false });
  });
});

describe('describeDataset: spielbare Kataloge und Bibliotheken', () => {
  it('unterscheidet den spielbaren Katalog von der reinen Bibliothek', () => {
    const description = describeDataset(prepareDataset(SYNTHETIC_DATASET));

    expect(description.catalogues).toEqual([
      { id: 'cat-army', name: 'Army', gameSystemId: GAME_SYSTEM_ID, isLibrary: false },
      { id: 'cat-library', name: 'Mercenaries', gameSystemId: GAME_SYSTEM_ID, isLibrary: true },
    ]);
  });

  it('leitet die Einordnung an echten Katalogdaten aus dem library-Kennzeichen ab', () => {
    const { catalogues } = WHFB_DESCRIPTION;

    expect(byId(catalogues, VAMPIRE_COUNTS_ID)).toEqual({
      id: VAMPIRE_COUNTS_ID,
      name: 'Vampire Counts',
      gameSystemId: WHFB_GAME_SYSTEM_ID,
      isLibrary: false,
    });
    expect(byId(catalogues, MERCENARIES_ID)).toMatchObject({ name: 'Mercenaries', isLibrary: true });
  });
});

describe('describeDataset: anlegbare Kontingente', () => {
  it('nennt die Kontingente der Katalogwurzel samt Quelle und Sichtbarkeit', () => {
    const description = describeDataset(prepareDataset(SYNTHETIC_DATASET));

    expect(description.creatableForces).toEqual([
      { id: 'force-standard', name: 'Standard', isHidden: false, sourceId: 'cat-army' },
      { id: 'force-wip', name: '[WIP] Horde', isHidden: true, sourceId: 'cat-army' },
    ]);
  });

  it('fuehrt ein Unter-Kontingent nicht als eigenstaendig anlegbar', () => {
    const description = describeDataset(prepareDataset(SYNTHETIC_DATASET));

    expect(byId(description.creatableForces, 'force-nested')).toBeUndefined();
  });

  it('nennt an echten Katalogdaten das Standard-Kontingent seines Katalogs', () => {
    const { creatableForces } = WHFB_DESCRIPTION;

    expect(byId(creatableForces, VAMPIRE_COUNTS_STANDARD_FORCE_ID)).toEqual({
      id: VAMPIRE_COUNTS_STANDARD_FORCE_ID,
      name: 'Standard (VC-AB)',
      isHidden: false,
      sourceId: VAMPIRE_COUNTS_ID,
    });
  });
});

describe('describeDataset: Diagnosen ohne Roster', () => {
  it('meldet einen Katalog, dessen Spielsystem nicht zur mitgegebenen .gst passt', () => {
    const foreign = `<?xml version="1.0"?>
      <catalogue id="cat-foreign" name="Foreign" gameSystemId="${OTHER_GAME_SYSTEM_ID}"/>`;

    const description = describeDataset(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [foreign] }));

    expect(description.diagnostics).toContainEqual({
      kind: DiagnosticKind.GAMESYSTEM_MISMATCH,
      catalogueId: 'cat-foreign',
      gameSystemId: OTHER_GAME_SYSTEM_ID,
      expected: GAME_SYSTEM_ID,
    });
  });

  it('meldet eine deklarierte Katalog-Abhaengigkeit, die nicht mitgegeben wurde', () => {
    const dependent = `<?xml version="1.0"?>
      <catalogue id="cat-dependent" name="Dependent" gameSystemId="${GAME_SYSTEM_ID}">
        <catalogueLinks><catalogueLink id="link" name="Mercenaries" targetId="cat-library"/></catalogueLinks>
      </catalogue>`;

    const description = describeDataset(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [dependent] }));

    expect(description.diagnostics).toContainEqual({
      kind: DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY,
      catalogueId: 'cat-dependent',
      targetId: 'cat-library',
      name: 'Mercenaries',
    });
  });

  it('meldet dieselben Vorlauf-Diagnosen wie eine Auswertung desselben Datensatzes', () => {
    const foreign = `<?xml version="1.0"?>
      <catalogue id="cat-foreign" name="Foreign" gameSystemId="${OTHER_GAME_SYSTEM_ID}">
        <entryLinks><entryLink id="link" name="Missing" targetId="nowhere" type="selectionEntry"/></entryLinks>
      </catalogue>`;
    // Ein Datensatz, **ein** Vorlauf: seit die Fassade zweistufig ist, teilen sich
    // Beschreibung und Auswertung buchstaeblich dasselbe aufbereitete Ergebnis.
    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [foreign] });

    const described = describeDataset(prepared).diagnostics;
    const evaluated = evaluate(prepared, { forces: [] }).diagnostics;

    expect(described).not.toEqual([]);
    expect(evaluated.slice(0, described.length)).toEqual(described);
  });

  it('meldet fuer einen kohaerenten echten Datensatz keine Kohaerenz-Diagnose', () => {
    const kinds = WHFB_DESCRIPTION.diagnostics.map(diagnostic => diagnostic.kind);

    expect(kinds).not.toContain(DiagnosticKind.GAMESYSTEM_MISMATCH);
    expect(kinds).not.toContain(DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY);
  });
});

describe('describeDataset: keine Zaehlung, keine Grenzenauswertung', () => {
  it('beschreibt den Datensatz ohne jeden Roster-Bezug (kein Bericht-Feld)', () => {
    const description = describeDataset(prepareDataset(SYNTHETIC_DATASET));

    expect(Object.keys(description).sort()).toEqual(
      ['catalogues', 'costTypes', 'creatableForces', 'diagnostics'],
    );
  });
});
