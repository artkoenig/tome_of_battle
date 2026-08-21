/**
 * Tests der Datensatz-Beschreibung `buildDatasetDescription` (Main-Issue 75,
 * Slice 01, `design.md` Kontrakt 3). Sie beantwortet die Fragen, die sich **ohne
 * Roster** stellen: welche Kostenarten es gibt, welche Kataloge spielbar und
 * welche reine Bibliotheken sind, welche Kontingente sich anlegen lassen.
 *
 * Geprueft wird gegen einen von Hand gebauten aufbereiteten Datensatz — die
 * Beschreibung ist eine reine Projektion und braucht dafuer weder XML noch
 * Auswertungsbaum (FIRST: schnell und isoliert). Das Zusammenspiel mit dem
 * echten Leser deckt `evaluator.describeDataset.test.js` ab.
 */

import { describe, it, expect } from 'vitest';
import { buildDatasetDescription } from './datasetDescription.js';

const POINTS = { id: 'cost-points', name: 'pts', defaultLimit: 2000, isHidden: false };
const CASTING_DICE = { id: 'cost-dice', name: ' Casting Dice', defaultLimit: null, isHidden: true };

/** Ein gelesenes Dokument in der Form, die der Vorlauf liefert. */
function document({ id, name = id, gameSystemId = 'gs', isLibrary = false, costTypes = [], forces = [] }) {
  return { id, name, gameSystemId, isLibrary, costTypes, forces };
}

/** Eine Kontingent-Definition in der Form, die der Leser liefert. */
function force({ id, name = id, isHidden = false }) {
  return { id, name, isHidden };
}

/** Ein aufbereiteter Datensatz aus Spielsystem-Dokument, Katalogen und Diagnosen. */
function prepared({ gameSystemDocument = null, catalogueDocuments = [], diagnostics = [] }) {
  return { gameSystemDocument, catalogueDocuments, diagnostics };
}

describe('buildDatasetDescription: Kostenarten', () => {
  it('fuehrt die Kostenarten aller Quellen mit Name, Vorgabe-Grenze und Sichtbarkeit', () => {
    const description = buildDatasetDescription(prepared({
      gameSystemDocument: document({ id: 'gs', costTypes: [POINTS, CASTING_DICE] }),
    }));

    expect(description.costTypes).toEqual([POINTS, CASTING_DICE]);
  });

  it('liest auch die an einer Katalogwurzel deklarierten Kostenarten', () => {
    const description = buildDatasetDescription(prepared({
      gameSystemDocument: document({ id: 'gs', costTypes: [POINTS] }),
      catalogueDocuments: [document({ id: 'cat-a', costTypes: [CASTING_DICE] })],
    }));

    expect(description.costTypes.map(costType => costType.id)).toEqual([POINTS.id, CASTING_DICE.id]);
  });

  it('fuehrt eine mehrfach deklarierte Kostenart genau einmal — die erste Quelle gewinnt', () => {
    const redeclared = { ...POINTS, name: 'Punkte' };
    const description = buildDatasetDescription(prepared({
      gameSystemDocument: document({ id: 'gs', costTypes: [POINTS] }),
      catalogueDocuments: [document({ id: 'cat-a', costTypes: [redeclared] })],
    }));

    expect(description.costTypes).toEqual([POINTS]);
  });

  it('liefert fuer einen Datensatz ohne Kostenarten eine leere Liste', () => {
    expect(buildDatasetDescription(prepared({})).costTypes).toEqual([]);
  });
});

describe('buildDatasetDescription: spielbare Kataloge und Bibliotheken', () => {
  it('nennt je Katalog ID, Name, Spielsystem-Zugehoerigkeit und das Bibliotheks-Kennzeichen', () => {
    const description = buildDatasetDescription(prepared({
      catalogueDocuments: [
        document({ id: 'cat-a', name: 'Vampire Counts', isLibrary: false }),
        document({ id: 'cat-b', name: 'Mercenaries', isLibrary: true }),
      ],
    }));

    expect(description.catalogues).toEqual([
      { id: 'cat-a', name: 'Vampire Counts', gameSystemId: 'gs', isLibrary: false },
      { id: 'cat-b', name: 'Mercenaries', gameSystemId: 'gs', isLibrary: true },
    ]);
  });

  it('fuehrt die Spielsystemdatei nicht als Katalog', () => {
    const description = buildDatasetDescription(prepared({
      gameSystemDocument: document({ id: 'gs', name: 'System' }),
      catalogueDocuments: [document({ id: 'cat-a' })],
    }));

    expect(description.catalogues.map(catalogue => catalogue.id)).toEqual(['cat-a']);
  });
});

describe('buildDatasetDescription: anlegbare Kontingente', () => {
  it('nennt je Kontingent ID, Name, Sichtbarkeit und die Quelle, die es beitraegt', () => {
    const description = buildDatasetDescription(prepared({
      catalogueDocuments: [document({
        id: 'cat-a',
        forces: [force({ id: 'force-standard', name: 'Standard' })],
      })],
    }));

    expect(description.creatableForces).toEqual([
      { id: 'force-standard', name: 'Standard', isHidden: false, sourceId: 'cat-a' },
    ]);
  });

  it('fuehrt ein ausgeblendetes Kontingent mit — markiert statt weggelassen', () => {
    const description = buildDatasetDescription(prepared({
      catalogueDocuments: [document({
        id: 'cat-a',
        forces: [force({ id: 'force-wip', name: '[WIP] Horde', isHidden: true })],
      })],
    }));

    expect(description.creatableForces).toEqual([
      { id: 'force-wip', name: '[WIP] Horde', isHidden: true, sourceId: 'cat-a' },
    ]);
  });

  it('nimmt auch die Kontingente der Spielsystemdatei auf', () => {
    const description = buildDatasetDescription(prepared({
      gameSystemDocument: document({ id: 'gs', forces: [force({ id: 'force-gs' })] }),
      catalogueDocuments: [document({ id: 'cat-a', forces: [force({ id: 'force-cat' })] })],
    }));

    expect(description.creatableForces.map(entry => [entry.id, entry.sourceId])).toEqual([
      ['force-gs', 'gs'],
      ['force-cat', 'cat-a'],
    ]);
  });

  it('fuehrt ein doppelt beigetragenes Kontingent genau einmal', () => {
    const description = buildDatasetDescription(prepared({
      catalogueDocuments: [
        document({ id: 'cat-a', forces: [force({ id: 'force-shared' })] }),
        document({ id: 'cat-b', forces: [force({ id: 'force-shared' })] }),
      ],
    }));

    expect(description.creatableForces.map(entry => entry.sourceId)).toEqual(['cat-a']);
  });
});

describe('buildDatasetDescription: Diagnosen', () => {
  it('reicht die Diagnosen des Katalog-Vorlaufs unveraendert durch', () => {
    const diagnostics = [{ kind: 'missingCatalogueDependency', targetId: 'cat-missing' }];

    expect(buildDatasetDescription(prepared({ diagnostics })).diagnostics).toEqual(diagnostics);
  });
});
