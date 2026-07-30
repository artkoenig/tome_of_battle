/**
 * Failing-test pin for Issue 0098 ("Wurzel-Eintraege aller Kataloge werden
 * katalogfremd gepoolt"): observable-behaviour tests, written from the
 * acceptance criteria alone, against the public facade
 * (`evaluate`/`prepareDataset` from `./evaluator.js`), following the same
 * synthetic-two-catalogue pattern as `crossCatalog.test.js`.
 *
 * These tests encode what the issue's acceptance criteria ask for — NOT the
 * (not-yet-written) implementation. Several of them therefore FAIL against the
 * current, unfixed engine, which pools root selectionEntries/forceEntries and
 * roster-scoped MIN constraints across all catalogues given to a dataset,
 * regardless of which catalogue a contingent in the roster actually belongs
 * to. Where a test is expected to already pass today (a contrast/"Kontrast"
 * check proving the mechanism still fires when it *should*, or the dedicated
 * single-catalogue regression guard), that is called out explicitly in its own
 * comment — the convention `crossCatalog.test.js` itself already uses for its
 * "Kontrast" tests.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';
import { AnchorKind, DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-scope-0000';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="${GAME_SYSTEM_ID}" name="Test System"></gameSystem>`;

/** True, wenn irgendein Slot des Berichts diese defId als Angebots-Anker traegt. */
function isOfferedAnywhere(report, defId) {
  return [...report.capabilities.values()].some(
    capability => capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR,
  );
}

/** True, wenn der Bericht eine Verletzung mit dieser Grenz-Id traegt. */
function hasViolationWithLimitId(report, limitId) {
  return report.violations.some(violation => violation.limitId === limitId);
}

describe('Issue 0098 Kriterium 1: Wurzel-Eintraege/-Forces gehoeren nur zum Angebot ihres eigenen Katalogs', () => {
  const CATALOGUE_A = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a-rootscope" name="A" gameSystemId="${GAME_SYSTEM_ID}">
      <forceEntries>
        <forceEntry id="a-force-rootscope" name="A Force"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="a-root-unit-rootscope" name="A Root Unit" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  // Katalog B traegt zusaetzlich eine eigene, roster-skopierte MIN-Grenze an
  // seinem Wurzel-Kontingent selbst (nicht an einem Eintrag) — die zweite,
  // eigenstaendige Kodierung von "Wurzel-Forces gehoeren nur zum eigenen
  // Katalog": ein `forceEntry` darf laut BSData eigene `constraints` tragen
  // (`docs/battlescribe-data-format.md` §5.6, "forceEntry-eigene
  // Constraints/Modifier").
  const CATALOGUE_B = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-b-rootscope" name="B" gameSystemId="${GAME_SYSTEM_ID}">
      <forceEntries>
        <forceEntry id="b-force-rootscope" name="B Force">
          <constraints>
            <constraint id="b-force-root-min" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="b-root-unit-rootscope" name="B Root Unit" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  const ROSTER_A_ONLY = { forces: [{ defId: 'a-force-rootscope', count: 1, children: [] }] };

  it('bietet den Wurzel-Eintrag von Katalog B NICHT unter einem Kontingent aus Katalog A an', () => {
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }),
      ROSTER_A_ONLY,
    );

    expect(isOfferedAnywhere(report, 'b-root-unit-rootscope')).toBe(false);
  });

  it('Kontrast: bietet den eigenen Wurzel-Eintrag von Katalog A unter dessen eigenem Kontingent weiterhin an', () => {
    // Diese Gegenprobe ist heute schon wahr und bleibt es nach dem Fix — sie
    // beweist, dass der obige Test wirklich die katalogfremde Pool-Grenze
    // prueft, nicht bloss eine leere/kaputte Angebotsliste.
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }),
      ROSTER_A_ONLY,
    );

    expect(isOfferedAnywhere(report, 'a-root-unit-rootscope')).toBe(true);
  });

  // Der woertlich verlangte symmetrische Fall — "ein Wurzel-forceEntry aus
  // Katalog B wird nicht als Unter-Kontingent unter einem Kontingent aus
  // Katalog A angeboten" — ist an der Fassade NICHT beobachtbar, mit einer
  // klaren Begruendung im Code: `attachOfferAnchors`/`candidatesFor`
  // (`src/evaluator/offer.js`) fragen fuer eine Kontingent-Instanz ausschliesslich
  // `resolved.armyLevelCandidates` ab (Wurzel-`selectionEntries`, siehe
  // `collectArmyLevelCandidates` in `resolver.js:736`), und fuer eine belegte
  // Auswahl ausschliesslich `optionDefinitionsUnder`, das nur `ENTRY`/`GROUP`/
  // `ENTRY_LINK`-Definitionen liefert. Eine `DefinitionKind.FORCE`-Definition
  // wird an KEINER der beiden Stellen jemals als Kandidat geliefert — ein
  // Wurzel-forceEntry kann im heutigen Baummodell also nie als OFFER_ANCHOR
  // unter einem anderen Kontingent auftauchen, unabhaengig vom hier zu
  // behebenden Fehler. Stattdessen zeigt der Test oben ("B Force" mit eigener
  // roster-skopierter MIN-Grenze) dieselbe Pooling-Luecke fuer Wurzel-Forces
  // ueber den einzigen Kanal, ueber den sie an der Fassade beobachtbar ist: den
  // Pflicht-Phantom-Mechanismus (`synthesizeMandatoryPhantoms`), der `forceEntry`-
  // Definitionen genau wie jede andere Definition behandelt.
  it('Wurzel-Force von Katalog B erzwingt KEINE Pflichtverletzung in einer Liste ohne Bezug zu B', () => {
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }),
      ROSTER_A_ONLY,
    );

    expect(hasViolationWithLimitId(report, 'b-force-root-min')).toBe(false);
  });
});

describe('Issue 0098 Kriterium 2: ein roster-skopierter MIN-Wurzeleintrag aus Katalog B trifft nur Listen mit Bezug zu B', () => {
  const CATALOGUE_A = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a-minscope" name="A" gameSystemId="${GAME_SYSTEM_ID}">
      <forceEntries>
        <forceEntry id="a-force-minscope" name="A Force"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="a-root-unit-minscope" name="A Root Unit" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  const MIN_LIMIT_ID = 'b-root-min';
  const CATALOGUE_B = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-b-minscope" name="B" gameSystemId="${GAME_SYSTEM_ID}">
      <forceEntries>
        <forceEntry id="b-force-minscope" name="B Force"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="b-root-unit-minscope" name="B Root Unit" type="unit">
          <constraints>
            <constraint id="${MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erzeugt KEINE Verletzung aus Bs roster-skopiertem Wurzel-MIN in einer Liste ohne jeden Bezug zu B', () => {
    const rosterAOnly = { forces: [{ defId: 'a-force-minscope', count: 1, children: [] }] };

    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }),
      rosterAOnly,
    );

    expect(hasViolationWithLimitId(report, MIN_LIMIT_ID)).toBe(false);
  });

  it('Kontrast: erzeugt SEHR WOHL die Verletzung, wenn das Roster ein Kontingent aus Katalog B selbst enthaelt', () => {
    // Diese Gegenprobe ist heute schon wahr und bleibt es nach dem Fix: ein
    // echtes B-Kontingent im Roster loest Bs eigene Pflicht weiterhin aus — der
    // Mechanismus wird durch den Fix nur katalog-lokal gemacht, nicht abgeschafft.
    const rosterWithBForce = { forces: [{ defId: 'b-force-minscope', count: 1, children: [] }] };

    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }),
      rosterWithBForce,
    );

    expect(hasViolationWithLimitId(report, MIN_LIMIT_ID)).toBe(true);
  });
});

describe('Issue 0098 Kriterium 3: importRootEntries steuert, ob ein verlinkter Bibliothekskatalog Wurzel-Eintraege beitraegt', () => {
  const LIBRARY_ROOT_ID = 'l-root-unit-import';
  const LIBRARY_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-lib-import" name="Library" library="true" gameSystemId="${GAME_SYSTEM_ID}">
      <selectionEntries>
        <selectionEntry id="${LIBRARY_ROOT_ID}" name="Library Root Unit" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  const ROSTER_A_ONLY = { forces: [{ defId: 'a-force-import', count: 1, children: [] }] };

  function cataloguePointingAtLibrary(importRootEntriesAttr) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-a-import" name="A" gameSystemId="${GAME_SYSTEM_ID}">
        <catalogueLinks>
          <catalogueLink id="cl-import" name="Library" type="catalogue" targetId="cat-lib-import"${importRootEntriesAttr}/>
        </catalogueLinks>
        <forceEntries>
          <forceEntry id="a-force-import" name="A Force"/>
        </forceEntries>
      </catalogue>`;
  }

  it('bietet Ls Wurzel-Eintrag an, wenn der catalogueLink importRootEntries="true" traegt', () => {
    // Kontrast/Sanity: haengt heute schon (unbedingt, weil alles pooled),
    // bleibt nach dem Fix wahr (bedingt, weil importRootEntries="true" gesetzt
    // ist) — belegt, dass der "false"-Test unten wirklich die neue Filterung
    // prueft und nicht bloss eine grundsaetzlich kaputte Angebotskette.
    const catalogueA = cataloguePointingAtLibrary(' importRootEntries="true"');
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueA, LIBRARY_XML] }),
      ROSTER_A_ONLY,
    );

    expect(isOfferedAnywhere(report, LIBRARY_ROOT_ID)).toBe(true);
  });

  it('bietet Ls Wurzel-Eintrag NICHT an, wenn der catalogueLink importRootEntries="false" traegt', () => {
    const catalogueA = cataloguePointingAtLibrary(' importRootEntries="false"');
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueA, LIBRARY_XML] }),
      ROSTER_A_ONLY,
    );

    expect(isOfferedAnywhere(report, LIBRARY_ROOT_ID)).toBe(false);
  });

  it('bietet Ls Wurzel-Eintrag NICHT an, wenn der catalogueLink kein importRootEntries traegt (XSD-Vorgabe false)', () => {
    const catalogueA = cataloguePointingAtLibrary('');
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueA, LIBRARY_XML] }),
      ROSTER_A_ONLY,
    );

    expect(isOfferedAnywhere(report, LIBRARY_ROOT_ID)).toBe(false);
  });
});

describe('Issue 0098 Review-Runde 1: eine per Kontingent-categoryLink referenzierte CATEGORY bleibt von der Katalog-Filterung ausgenommen', () => {
  // Nachbildet exakt das reale WHFB6-Muster, das die Review-Runde fand — und
  // exakt an der Stelle, an der es tatsaechlich vorkommt: der `categoryLink`
  // haengt am `forceEntry` selbst (`Vampire Counts (6th definitive
  // edition).cat:29308-29309`, "Regiment of Renown" per categoryLink am
  // Kontingent "Standard (VC-AB)"), nicht an einem Wurzel-Eintrag. Ein
  // Kontingent, das im Roster tatsaechlich anwesend ist und sich per
  // eigenem `categoryLink` ausdruecklich zu einer fremden Kategorie
  // bekennt, macht diese Kategorie fuer sich relevant — unabhaengig davon,
  // in welchem Katalog sie deklariert ist. Die Erwartung ist deshalb
  // umgekehrt zu Kriterium 1: die roster-skopierte MIN-Grenze an Bs
  // Kategorie soll WEITERHIN feuern, wenn nur A (dessen Kontingent per
  // categoryLink auf Bs Kategorie verweist) im Roster steckt — genau wie
  // ein Wurzel-`entryLink` mit eigener MIN-Grenze weiterhin unbedingt
  // feuert (Kriterium-1-Tests oben). Ohne die Ausnahme wuerde diese Grenze
  // faelschlich verschluckt, weil Bs Katalog nicht im Fussabdruck von As
  // referenzierten Katalogen steckt (der Reviewer-Fund aus Runde 1).
  const CATEGORY_MIN_LIMIT_ID = 'b-category-root-min';
  const CATALOGUE_B = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-b-categoryscope" name="B" gameSystemId="${GAME_SYSTEM_ID}">
      <categoryEntries>
        <categoryEntry id="b-category-rootscope" name="B Category">
          <constraints>
            <constraint id="${CATEGORY_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="b-force-categoryscope" name="B Force"/>
      </forceEntries>
    </catalogue>`;

  const CATALOGUE_A = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a-categoryscope" name="A" gameSystemId="${GAME_SYSTEM_ID}">
      <forceEntries>
        <forceEntry id="a-force-categoryscope" name="A Force">
          <categoryLinks>
            <categoryLink id="a-catlink-categoryscope" targetId="b-category-rootscope" primary="false"/>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
    </catalogue>`;

  it('erzeugt weiterhin die Verletzung aus Bs roster-skopiertem Kategorie-MIN, wenn nur As Kontingent (per eigenem categoryLink auf Bs Kategorie) im Roster steckt', () => {
    const rosterAOnly = { forces: [{ defId: 'a-force-categoryscope', count: 1, children: [] }] };

    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }),
      rosterAOnly,
    );

    expect(hasViolationWithLimitId(report, CATEGORY_MIN_LIMIT_ID)).toBe(true);
  });

  it('erzeugt die Verletzung ebenso, wenn das Roster ein Kontingent aus Katalog B selbst enthaelt', () => {
    const rosterWithBForce = { forces: [{ defId: 'b-force-categoryscope', count: 1, children: [] }] };

    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_B] }),
      rosterWithBForce,
    );

    expect(hasViolationWithLimitId(report, CATEGORY_MIN_LIMIT_ID)).toBe(true);
  });
});

describe('Issue 0098 Review-Runde 2: eine voellig unbezogene CATEGORY bleibt katalog-gefiltert (keine pauschale Ausnahme)', () => {
  // Die Review-Runde 2 wies nach, dass eine pauschale CATEGORY-Ausnahme (jede
  // Kategorie, unbedingt) genau die Pooling-Regression aus Kriterium 2
  // wiederherstellt — nur fuer `categoryEntry` statt `selectionEntry`/
  // `forceEntry`: Katalog C ist zu Katalog A in KEINER Beziehung (kein
  // `categoryLink` von irgendeinem anwesenden Kontingent, kein
  // `catalogueLink`). Die Ausnahme darf deshalb nur fuer eine Kategorie
  // gelten, die ein anwesendes Kontingent tatsaechlich per eigenem
  // `categoryLink` fuehrt (siehe Runde-1-Block oben) — nicht fuer jede
  // beliebige Kategorie.
  const ROSTER_MIN_LIMIT_ID = 'c-category-roster-min';
  const FORCE_MIN_LIMIT_ID = 'c2-category-force-min';
  const CATALOGUE_C = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-c-categoryscope-unrelated" name="C" gameSystemId="${GAME_SYSTEM_ID}">
      <categoryEntries>
        <categoryEntry id="c-category-unrelated" name="C Category (roster-min)">
          <constraints>
            <constraint id="${ROSTER_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </categoryEntry>
        <categoryEntry id="c2-category-unrelated" name="C Category (force-min)">
          <constraints>
            <constraint id="${FORCE_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="force"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="c-force-categoryscope-unrelated" name="C Force"/>
      </forceEntries>
    </catalogue>`;

  const CATALOGUE_A = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a-categoryscope-unrelated" name="A" gameSystemId="${GAME_SYSTEM_ID}">
      <forceEntries>
        <forceEntry id="a-force-categoryscope-unrelated" name="A Force"/>
      </forceEntries>
    </catalogue>`;

  const ROSTER_A_ONLY = { forces: [{ defId: 'a-force-categoryscope-unrelated', count: 1, children: [] }] };

  it('erzeugt KEINE Verletzung aus Cs roster-skopiertem Kategorie-MIN, wenn As Kontingent Cs Kategorie nirgends referenziert', () => {
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_C] }),
      ROSTER_A_ONLY,
    );

    expect(hasViolationWithLimitId(report, ROSTER_MIN_LIMIT_ID)).toBe(false);
  });

  it('erzeugt KEINE Verletzung aus Cs force-skopiertem Kategorie-MIN unter As Kontingent, das Cs Kategorie nirgends referenziert', () => {
    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_C] }),
      ROSTER_A_ONLY,
    );

    expect(hasViolationWithLimitId(report, FORCE_MIN_LIMIT_ID)).toBe(false);
  });

  it('Kontrast: erzeugt SEHR WOHL beide Verletzungen, wenn das Roster ein Kontingent aus Katalog C selbst enthaelt', () => {
    const rosterWithCForce = { forces: [{ defId: 'c-force-categoryscope-unrelated', count: 1, children: [] }] };

    const report = evaluate(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A, CATALOGUE_C] }),
      rosterWithCForce,
    );

    expect(hasViolationWithLimitId(report, ROSTER_MIN_LIMIT_ID)).toBe(true);
    expect(hasViolationWithLimitId(report, FORCE_MIN_LIMIT_ID)).toBe(true);
  });
});

describe('Issue 0098 Regressions-Wache: der Ein-Katalog-Fall bleibt unveraendert (additive Filterung)', () => {
  // Kein zweiter Armee-Katalog im Spiel — dieselbe Art Fixture wie die
  // bestehende Suite (`crossCatalog.test.js`, "ADR-0032"-Beschreibung). Dieser
  // Test soll HEUTE SCHON gruen sein und es nach dem Fix bleiben: er belegt,
  // dass die katalog-lokale Filterung additiv ist und den Ein-Katalog-Fall
  // nicht veraendert (Plan-Punkt 5 des Issues).
  const MIN_LIMIT_ID = 'single-root-min';
  const CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-single" name="Single">
      <forceEntries>
        <forceEntry id="single-force" name="Force"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="single-root-unit" name="Root Unit" type="unit">
          <constraints>
            <constraint id="${MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet die roster-skopierte Pflichtverletzung eines einzigen Katalogs weiterhin, ohne Bezug zu einem zweiten', () => {
    const emptyRoster = { forces: [] };
    const report = evaluate(prepareDataset({ catalogues: [CATALOGUE] }), emptyRoster);

    expect(hasViolationWithLimitId(report, MIN_LIMIT_ID)).toBe(true);
  });

  it('bietet den Wurzel-Eintrag des einzigen Katalogs weiterhin unter dessen eigenem Kontingent an', () => {
    const rosterWithForce = { forces: [{ defId: 'single-force', count: 1, children: [] }] };
    const report = evaluate(prepareDataset({ catalogues: [CATALOGUE] }), rosterWithForce);

    expect(isOfferedAnywhere(report, 'single-root-unit')).toBe(true);
  });

  it('meldet keine unerwartete Diagnose fuer diesen unveraenderten Ein-Katalog-Fall', () => {
    const rosterWithForce = { forces: [{ defId: 'single-force', count: 1, children: [] }] };
    const report = evaluate(prepareDataset({ catalogues: [CATALOGUE] }), rosterWithForce);

    expect(report.diagnostics.filter(d => d.kind !== DiagnosticKind.GAMESYSTEM_MISMATCH)).toHaveLength(0);
  });
});
