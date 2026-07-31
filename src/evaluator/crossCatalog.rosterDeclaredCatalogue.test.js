/**
 * Failing-test pin fuer Issue 0140 („Fremde Armeebuch-Pflichten feuern, wenn das
 * Spielsystem die Kontingente deklariert"), Kriterien 1, 3, 4 und 5 —
 * beobachtbares Verhalten an der oeffentlichen Fassade
 * (`prepareDataset`/`evaluate` aus `./evaluator.js`), im Muster von
 * `crossCatalog.rootEntryScope.test.js` (Issue 0098): zwei synthetische
 * Armeebuecher ueber einem Spielsystem, das die Kontingente selbst deklariert —
 * genau die Lage der ergofang-Kataloge, in der der Herkunftsindex aus den
 * `.cat`-`forceEntry`s prinzipiell keine Antwort haben kann.
 *
 * Diese Tests kodieren, was die Kriterien VERLANGEN — nicht die (noch nicht
 * geschriebene) Umsetzung. Die meisten schlagen deshalb gegen die heutige Engine
 * fehl: ohne Antwort des Herkunftsindex bleibt die Referenzmenge leer,
 * `isInCatalogueScope` faellt bestimmungsgemaess offen aus, und die Pflichten
 * und Wurzel-Angebote **jedes** geladenen Armeebuchs treffen jedes Kontingent.
 * Wo ein Test heute schon gruen ist, steht das ausdruecklich dabei — entweder
 * als Gegenprobe („Kontrast", die Konvention von `crossCatalog.test.js") oder
 * als die von Kriterium 4 verlangte Regressions-Wache.
 *
 * ── Die eine Namenswahl, die diese Datei treffen musste ──────────────────────
 * Der Eingabevertrag der Fassade (`evaluate`, `@param roster`) traegt heute
 * keine Armeebuch-Id am Kontingent-Knoten; die Kriterien benennen das Feld
 * nicht. Gewaehlt ist `catalogueId` — woertlich der Name, den der Intent des
 * Issues fuer **beide** benachbarten Modelle nennt („`force.catalogueId` im
 * App-Modell, `catalogueId`-Attribut am `<force>` einer `.ros`") und den auch
 * `src/types.js` (`Force.catalogueId`) fuehrt. Die `.ros`-Struktur selbst ist
 * eine dokumentierte Luecke der Quelle (`docs/battlescribe-data-format.md`
 * §15) — hier entscheidet das Projekt, und die naheliegende Entscheidung ist,
 * die Angabe unter demselben Namen weiterzureichen, unter dem sie ueberall
 * sonst steht.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0140-declared';
const CATALOGUE_A_ID = 'cat-a-0140-declared';
const CATALOGUE_B_ID = 'cat-b-0140-declared';

/** Zwei Kontingente, deklariert in der **Spielsystemdatei** — der Fall des Issues. */
const GST_FORCE_ID = 'gst-force-0140-declared';
const GST_FORCE_2_ID = 'gst-force-2-0140-declared';

/** Ein Kontingent, das Armeebuch B in seiner eigenen `.cat` deklariert. */
const B_OWN_FORCE_ID = 'b-own-force-0140-declared';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <forceEntries>
      <forceEntry id="${GST_FORCE_ID}" name="System Force 1"/>
      <forceEntry id="${GST_FORCE_2_ID}" name="System Force 2"/>
    </forceEntries>
  </gameSystem>`;

/**
 * Ein Armeebuch mit drei Wurzel-Eintraegen, die je einen der drei beobachtbaren
 * Kanaele bedienen:
 *
 * - `<letter>-offer-unit` — ohne jede Grenze, wird deshalb als Angebots-Anker
 *   sichtbar (ein Pflicht-Phantom wuerde den Slot sonst schon belegen);
 * - `<letter>-roster-min-unit` — roster-skopierte MIN-Grenze (die Pflicht, die
 *   der Lagerbericht als armeeweite Verletzung meldet);
 * - `<letter>-force-min-unit` — kontingent-skopierte MIN-Grenze (dieselbe
 *   Pflicht je Kontingent; ohne roster-skopierte Grenze haengt ihr Phantom
 *   ausschliesslich unter den Kontingenten, nie an der Wurzel).
 *
 * `ownForceId` deklariert zusaetzlich ein eigenes Kontingent **im Katalog** —
 * nur so laesst sich der Widerspruch „Index sagt B, Roster sagt A" bauen.
 */
function catalogueXml(letter, catalogueId, ownForceId) {
  const forceEntries = ownForceId === undefined
    ? ''
    : `<forceEntries><forceEntry id="${ownForceId}" name="Own Force of ${letter}"/></forceEntries>`;
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${catalogueId}" name="Army ${letter}" gameSystemId="${GAME_SYSTEM_ID}" library="false">
      ${forceEntries}
      <selectionEntries>
        <selectionEntry id="${letter}-offer-unit" name="${letter} Offer Unit" type="unit"/>
        <selectionEntry id="${letter}-roster-min-unit" name="${letter} Roster Min Unit" type="unit">
          <constraints>
            <constraint id="${letter}-roster-min" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${letter}-force-min-unit" name="${letter} Force Min Unit" type="unit">
          <constraints>
            <constraint id="${letter}-force-min" type="min" value="1" field="selections" scope="force"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

const CATALOGUE_A_XML = catalogueXml('a', CATALOGUE_A_ID, undefined);
const CATALOGUE_B_XML = catalogueXml('b', CATALOGUE_B_ID, B_OWN_FORCE_ID);

const DATASET = { gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_A_XML, CATALOGUE_B_XML] };

/**
 * Ein Kontingent-Knoten des Eingabe-Rosters. Ohne `catalogueId` entsteht genau
 * der heutige Knoten (Kriterium 4: die Angabe fehlt und darf nichts aendern).
 */
function forceNode(defId, catalogueId) {
  return catalogueId === undefined
    ? { defId, count: 1, children: [] }
    : { defId, count: 1, catalogueId, children: [] };
}

/** Wertet den Zwei-Armeebuch-Datensatz gegen die gegebenen Kontingente aus. */
function evaluateForces(forces) {
  return evaluate(prepareDataset(DATASET), { forces });
}

/** Die Verletzungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

/** True, wenn der Bericht eine Verletzung mit dieser Grenz-Id traegt. */
function hasViolationWithLimitId(report, limitId) {
  return violationsOf(report, limitId).length > 0;
}

/** True, wenn irgendein Slot des Berichts diese defId als Angebots-Anker traegt. */
function isOfferedAnywhere(report, defId) {
  return [...report.capabilities.values()].some(
    capability => capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR,
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 1: die Armeebuch-Id des Rosters ist das Armeebuch des Kontingents —
// auch wenn die Kontingent-Definition aus der Spielsystemdatei stammt
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 1: Kontingent aus der .gst, Armeebuch-Id am Roster', () => {
  const forcesFromA = [forceNode(GST_FORCE_ID, CATALOGUE_A_ID)];

  it('Kontrast: die roster-weite Pflicht des EIGENEN Armeebuchs feuert weiterhin', () => {
    // Heute schon gruen und bleibt es: der Fix macht die Pflicht katalog-lokal,
    // er schafft sie nicht ab. Ohne diese Gegenprobe koennte der Test darunter
    // auch von einer schlicht abgeschalteten Pflicht-Synthese erfuellt werden.
    const report = evaluateForces(forcesFromA);

    expect(hasViolationWithLimitId(report, 'a-roster-min')).toBe(true);
  });

  it('die roster-weite Pflicht des FREMDEN Armeebuchs feuert NICHT', () => {
    const report = evaluateForces(forcesFromA);

    expect(hasViolationWithLimitId(report, 'b-roster-min')).toBe(false);
  });

  it('die kontingent-weite Pflicht des FREMDEN Armeebuchs feuert NICHT', () => {
    const report = evaluateForces(forcesFromA);

    expect(hasViolationWithLimitId(report, 'b-force-min')).toBe(false);
  });

  it('Kontrast: die kontingent-weite Pflicht des EIGENEN Armeebuchs feuert weiterhin', () => {
    const report = evaluateForces(forcesFromA);

    expect(hasViolationWithLimitId(report, 'a-force-min')).toBe(true);
  });

  it('Kriterium 3: kein Wurzel-Eintrag des fremden Armeebuchs wird als Slot angeboten', () => {
    const report = evaluateForces(forcesFromA);

    expect(isOfferedAnywhere(report, 'b-offer-unit')).toBe(false);
  });

  it('Kontrast: der Wurzel-Eintrag des eigenen Armeebuchs wird weiterhin angeboten', () => {
    const report = evaluateForces(forcesFromA);

    expect(isOfferedAnywhere(report, 'a-offer-unit')).toBe(true);
  });
});

describe('Kriterium 1, Rand: die Angabe des Rosters schlaegt den Herkunftsindex', () => {
  // Woertlich die Entscheidung des Issues („Decisions"): „Widersprechen sich
  // beide, gilt das Roster." Das Kontingent ist in Armeebuch B deklariert — der
  // Herkunftsindex antwortet also, und zwar B —, das Roster nennt aber A.
  const forcesConflicting = [forceNode(B_OWN_FORCE_ID, CATALOGUE_A_ID)];

  it('die Pflicht des im Roster genannten Armeebuchs A feuert', () => {
    const report = evaluateForces(forcesConflicting);

    expect(hasViolationWithLimitId(report, 'a-roster-min')).toBe(true);
  });

  it('die Pflicht des vom Index gemeldeten Armeebuchs B feuert NICHT', () => {
    const report = evaluateForces(forcesConflicting);

    expect(hasViolationWithLimitId(report, 'b-roster-min')).toBe(false);
  });

  it('angeboten wird der Wurzel-Eintrag von A, nicht der von B', () => {
    const report = evaluateForces(forcesConflicting);

    expect(isOfferedAnywhere(report, 'a-offer-unit')).toBe(true);
    expect(isOfferedAnywhere(report, 'b-offer-unit')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 4 (Regressions-Wache): ohne Armeebuch-Id am Kontingent bleibt alles,
// wie es ist — diese Tests sind HEUTE SCHON GRUEN und muessen es bleiben
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 4: ohne Armeebuch-Id am Kontingent bleibt das Verhalten unveraendert', () => {
  it('Kontingent aus der .gst ohne Armeebuch-Id: der Index hat keine Antwort — es wird wie bisher NICHT gefiltert', () => {
    // Regressions-Wache, heute gruen: genau der Fehlerzustand des Issues, aber
    // ohne die Angabe, die ihn beheben soll. Die Kriterien verlangen hier
    // ausdruecklich das unveraenderte Verhalten.
    const report = evaluateForces([forceNode(GST_FORCE_ID, undefined)]);

    expect(hasViolationWithLimitId(report, 'a-roster-min')).toBe(true);
    expect(hasViolationWithLimitId(report, 'b-roster-min')).toBe(true);
    expect(isOfferedAnywhere(report, 'a-offer-unit')).toBe(true);
    expect(isOfferedAnywhere(report, 'b-offer-unit')).toBe(true);
  });

  it('Kontingent aus einer .cat ohne Armeebuch-Id: der bisherige Herkunftsindex gilt weiter', () => {
    // Regressions-Wache, heute gruen: das Kontingent steht in Armeebuch B, der
    // Index antwortet — also gilt B, und As Pflicht bleibt draussen.
    const report = evaluateForces([forceNode(B_OWN_FORCE_ID, undefined)]);

    expect(hasViolationWithLimitId(report, 'b-roster-min')).toBe(true);
    expect(hasViolationWithLimitId(report, 'a-roster-min')).toBe(false);
  });

  it('Rand: ein Roster ganz ohne Kontingente filtert wie bisher nicht', () => {
    // Regressions-Wache, heute gruen: die leere Referenzmenge des
    // ROSTER-Rahmens faellt weiter offen aus (Issue 0098, `isInCatalogueScope`).
    const report = evaluateForces([]);

    expect(hasViolationWithLimitId(report, 'a-roster-min')).toBe(true);
    expect(hasViolationWithLimitId(report, 'b-roster-min')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 5: zwei Kontingente aus verschiedenen Armeebuechern
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 5: je Kontingent sein eigenes Buch, roster-weit beide', () => {
  // Beide Kontingente stammen aus der `.gst`; erst die Angabe des Rosters
  // unterscheidet sie. Reihenfolge = Slot-Pfad-Schema des Berichts: das erste
  // Kontingent liegt unter "0", das zweite unter "1".
  const mixedForces = [
    forceNode(GST_FORCE_ID, CATALOGUE_A_ID),
    forceNode(GST_FORCE_2_ID, CATALOGUE_B_ID),
  ];

  it('die kontingent-weite Pflicht von A feuert genau einmal — unter dem A-Kontingent', () => {
    const report = evaluateForces(mixedForces);

    const violations = violationsOf(report, 'a-force-min');
    expect(violations).toHaveLength(1);
    expect(violations[0].anchor.path.startsWith('0/')).toBe(true);
  });

  it('die kontingent-weite Pflicht von B feuert genau einmal — unter dem B-Kontingent', () => {
    const report = evaluateForces(mixedForces);

    const violations = violationsOf(report, 'b-force-min');
    expect(violations).toHaveLength(1);
    expect(violations[0].anchor.path.startsWith('1/')).toBe(true);
  });

  it('der roster-weite Bezugsrahmen umfasst beide Buecher: beide roster-weiten Pflichten feuern', () => {
    // Kontrast, heute schon gruen: der Fix darf den Roster-Rahmen nicht auf ein
    // einzelnes Buch verengen — beide im Roster vertretenen Buecher gehoeren dazu.
    const report = evaluateForces(mixedForces);

    expect(hasViolationWithLimitId(report, 'a-roster-min')).toBe(true);
    expect(hasViolationWithLimitId(report, 'b-roster-min')).toBe(true);
  });

  it('jedes Kontingent bekommt die Wurzel-Angebote seines eigenen Buchs', () => {
    const report = evaluateForces(mixedForces);

    const offersUnder = (forcePath) => [...report.capabilities.entries()]
      .filter(([path, capability]) => path.startsWith(`${forcePath}/`)
        && capability.anchorKind === AnchorKind.OFFER_ANCHOR)
      .map(([, capability]) => capability.defId);

    expect(offersUnder('0')).toContain('a-offer-unit');
    expect(offersUnder('0')).not.toContain('b-offer-unit');
    expect(offersUnder('1')).toContain('b-offer-unit');
    expect(offersUnder('1')).not.toContain('a-offer-unit');
  });

  it('Rand: zwei Kontingente aus DEMSELBEN Buch lassen das fremde Buch ganz draussen', () => {
    const report = evaluateForces([
      forceNode(GST_FORCE_ID, CATALOGUE_A_ID),
      forceNode(GST_FORCE_2_ID, CATALOGUE_A_ID),
    ]);

    expect(hasViolationWithLimitId(report, 'a-roster-min')).toBe(true);
    expect(hasViolationWithLimitId(report, 'b-roster-min')).toBe(false);
    expect(violationsOf(report, 'a-force-min')).toHaveLength(2);
    expect(violationsOf(report, 'b-force-min')).toHaveLength(0);
  });
});
