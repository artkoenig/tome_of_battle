/**
 * Failing-test pin fuer Issue 0140, Kriterien 2 und 3 an den **echten**
 * ergofang-Katalogdaten des Repos (`src/tests/__fixtures__/whfb6/`) — im Muster von
 * `evaluator.primaryCatalogueFixture.test.js` (echte Daten, Fassade, ein
 * einziger Auswertungslauf je Lage).
 *
 * Die Lage des Issues, so weit sie im Repo nachstellbar ist: das
 * Vampire-Counts-Kontingent „Standard" (`7d9d-6c8d-4ea0-b7ad`) ist in der
 * **Spielsystemdatei** deklariert, nicht in einer `.cat` — der Herkunftsindex
 * aus den `.cat`-`forceEntry`s kann fuer es prinzipiell keine Antwort haben. Das
 * Roster nennt als Armeebuch `ea4b-9294-3427-1fc1` (Vampire Counts).
 *
 * Von den fuenf fremden Pflichten der Tabelle im Issue ist im Repo genau eine
 * nachstellbar — „needs a Bulls" aus `Ogre Kingdoms.cat` (Grenze
 * `8469-51b4-75c9-4402` am Wurzel-Eintrag `7754-8b3d-df99-d2d5`); High Elf, RH
 * Chaos Dwarfs und Tomb Kings liegen nicht als Fixture vor. Die Fixture traegt
 * ausserdem `Orcs and Goblins.cat`, das keine roster-weite Pflicht deklariert,
 * dafuer aber 44 Wurzel-Angebote — es traegt deshalb Kriterium 3.
 *
 * Reproduziert (Wegwerf-Skript ueber genau dieser Fixture, leeres Kontingent,
 * 2000 Punkte): der heutige Bericht traegt **drei** Verletzungen —
 * `9636-e6ed-b522-1f4a` („Core", Spielsystem), `8469-51b4-75c9-4402` („Bulls",
 * Ogre Kingdoms) und `1077-7379-f142-f382` („General", Spielsystem) — und 80
 * Angebots-Anker, davon 20 aus Vampire Counts, 16 aus Ogre Kingdoms und 44 aus
 * Orcs and Goblins.
 *
 * Von der Rangfolge-Entscheidung („der Herkunftsindex schlaegt die Angabe des
 * Rosters, wo er antwortet") ist diese Datei nicht beruehrt: fuer das
 * `.gst`-deklarierte VC-Kontingent hat der Index prinzipiell keine Antwort, das
 * Roster fuellt also genau die Luecke. Ebenso wenig von der
 * Bibliotheks-Ausnahme: die ergofang-Fixture enthaelt keinen einzigen
 * `library="true"`-Katalog.
 *
 * Zur Namenswahl `catalogueId` am Kontingent-Knoten des Eingabe-Rosters siehe
 * den Kopf von `crossCatalog.rosterDeclaredCatalogue.test.js`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { AnchorKind } from '../../../domain/evaluator/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = join(process.cwd(), 'src/tests/__fixtures__/whfb6');

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

const GAME_SYSTEM_ID = '6d8e-38d9-3c69-febf';
const VAMPIRE_COUNTS_ID = 'ea4b-9294-3427-1fc1';
const OGRE_KINGDOMS_ID = '731d-5b13-2a92-5426';
const ORCS_AND_GOBLINS_ID = 'b126-4acf-f567-bea6';

/** `<forceEntry name="Standard ">` — deklariert in der `.gst`, nicht in einer `.cat`. */
const STANDARD_FORCE_ID = '7d9d-6c8d-4ea0-b7ad';

/** Die Punkt-Kostenart der `.gst` (`<costType name="pts">`). */
const POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';

/** Die beiden Pflichten des SPIELSYSTEMS, die im VC-Roster stehen muessen. */
const CORE_MIN_LIMIT_ID = '9636-e6ed-b522-1f4a';     // categoryLink „Core" am .gst-forceEntry
const GENERAL_MIN_LIMIT_ID = '1077-7379-f142-f382';  // categoryEntry „General" der .gst

/** Die FREMDE Pflicht aus `Ogre Kingdoms.cat` — „needs a Bulls". */
const BULLS_MIN_LIMIT_ID = '8469-51b4-75c9-4402';
const BULLS_ENTRY_ID = '7754-8b3d-df99-d2d5';

const DATASET = {
  gameSystem: fixture('Warhammer Fantasy Battle 6th edition.gst'),
  catalogues: [
    fixture('Vampire Counts.cat'),
    fixture('Ogre Kingdoms.cat'),
    fixture('Orcs and Goblins.cat'),
  ],
};

/** Ein leeres Kontingent, 0/2000 Punkte — genau der Fall aus dem Screenshot. */
function emptyVampireCountsRoster(catalogueId) {
  const force = catalogueId === undefined
    ? { defId: STANDARD_FORCE_ID, count: 1, children: [] }
    : { defId: STANDARD_FORCE_ID, count: 1, catalogueId, children: [] };
  return { forces: [force], costLimits: [{ costTypeId: POINTS_COST_TYPE_ID, value: 2000 }] };
}

// Die echten Kataloge sind gross; die Auswertung ist eine reine Funktion und
// wird deshalb einmal je Lage gebildet.
const PREPARED = prepareDataset(DATASET);
const REPORT = evaluate(PREPARED, emptyVampireCountsRoster(VAMPIRE_COUNTS_ID));
const REPORT_WITHOUT_CATALOGUE_ID = evaluate(PREPARED, emptyVampireCountsRoster(undefined));

/** Die Grenz-Ids aller gemeldeten Verletzungen, ohne Dubletten. */
function limitIdsOf(report) {
  return [...new Set(report.violations.map(violation => violation.limitId))].sort();
}

/** Die Herkunfts-Ids aller Angebots-Anker des Berichts, ohne Dubletten. */
function offerSourceIdsOf(report) {
  return [...new Set([...report.capabilities.values()]
    .filter(capability => capability.anchorKind === AnchorKind.OFFER_ANCHOR)
    .map(capability => capability.sourceId))].sort();
}

/** True, wenn irgendein Slot des Berichts diese defId als Angebots-Anker traegt. */
function isOfferedAnywhere(report, defId) {
  return [...report.capabilities.values()].some(
    capability => capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR,
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 2: nur die Pflichten des Spielsystems und des eigenen Armeebuchs
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 2: leeres ergofang-VC-Kontingent ueber echten Katalogdaten', () => {
  it('meldet die Pflicht „General" des Spielsystems', () => {
    // Kontrast, heute schon gruen: die Pflichten des Spielsystems gehoeren ins
    // VC-Roster und duerfen durch die Filterung nicht mit verschwinden.
    expect(limitIdsOf(REPORT)).toContain(GENERAL_MIN_LIMIT_ID);
  });

  it('meldet die Pflicht „Core" des Spielsystems', () => {
    // Kontrast, heute schon gruen — derselbe Grund.
    expect(limitIdsOf(REPORT)).toContain(CORE_MIN_LIMIT_ID);
  });

  it('meldet die fremde Pflicht „Bulls" aus Ogre Kingdoms NICHT', () => {
    expect(limitIdsOf(REPORT)).not.toContain(BULLS_MIN_LIMIT_ID);
  });

  it('meldet ueberhaupt nur die beiden Pflichten des Spielsystems', () => {
    expect(limitIdsOf(REPORT)).toEqual([CORE_MIN_LIMIT_ID, GENERAL_MIN_LIMIT_ID].sort());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 3: keine Wurzel-Angebote fremder Armeebuecher
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 3: dasselbe Kontingent bekommt keinen fremden Wurzel-Eintrag als Slot', () => {
  it('bietet den Ogre-Kingdoms-Wurzel-Eintrag „Bulls" nicht an', () => {
    expect(isOfferedAnywhere(REPORT, BULLS_ENTRY_ID)).toBe(false);
  });

  it('bietet keinen Wurzel-Eintrag aus Ogre Kingdoms oder Orcs and Goblins an', () => {
    expect(offerSourceIdsOf(REPORT)).not.toContain(OGRE_KINGDOMS_ID);
    expect(offerSourceIdsOf(REPORT)).not.toContain(ORCS_AND_GOBLINS_ID);
  });

  it('Kontrast: bietet die Wurzel-Eintraege des eigenen Vampire-Counts-Buchs weiterhin an', () => {
    // Heute schon gruen und bleibt es: „Skeletons" ist ein Wurzel-Eintrag des
    // VC-Buchs. Ohne diese Gegenprobe waere der Test darueber auch von einer
    // vollstaendig leeren Angebotsliste erfuellt.
    expect(isOfferedAnywhere(REPORT, '9ac2-f4c1-bcc3-3aee')).toBe(true);
    expect(offerSourceIdsOf(REPORT)).toContain(VAMPIRE_COUNTS_ID);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 4 (Regressions-Wache) an denselben echten Daten
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 4 an echten Daten: ohne Armeebuch-Id am Kontingent bleibt alles beim Alten', () => {
  it('derselbe Datensatz ohne Armeebuch-Id meldet die fremde Pflicht „Bulls" weiterhin', () => {
    // Regressions-Wache, heute gruen: genau der gemeldete Fehlerzustand — ohne
    // die Angabe, die ihn beheben soll, filtert die Engine wie bisher nicht.
    expect(limitIdsOf(REPORT_WITHOUT_CATALOGUE_ID)).toEqual(
      [CORE_MIN_LIMIT_ID, BULLS_MIN_LIMIT_ID, GENERAL_MIN_LIMIT_ID].sort(),
    );
  });

  it('derselbe Datensatz ohne Armeebuch-Id bietet die fremden Wurzel-Eintraege weiterhin an', () => {
    // Regressions-Wache, heute gruen.
    expect(offerSourceIdsOf(REPORT_WITHOUT_CATALOGUE_ID)).toEqual(
      [VAMPIRE_COUNTS_ID, OGRE_KINGDOMS_ID, ORCS_AND_GOBLINS_ID].sort(),
    );
  });

  it('KONTROLLE: der Datensatz laedt und das Spielsystem ist das erwartete', () => {
    expect(Array.isArray(REPORT.violations)).toBe(true);
    expect(REPORT.capabilities.size).toBeGreaterThan(0);
    expect(DATASET.gameSystem).toContain(GAME_SYSTEM_ID);
  });
});
