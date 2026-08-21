/**
 * Failing-test pin fuer Issue 0140, Kriterium 7: „Die App reicht die Angabe
 * durch: eine im App-Roster gesetzte Armeebuch-Id eines Kontingents kommt in
 * der Auswertung an."
 *
 * Beobachtet wird an der **einen** App-Auswertung
 * (`evaluateAppRoster(system, roster)` aus `./evaluationCache.js`, Issue 0121) —
 * der Naht, durch die jede Stelle der Oberflaeche geht. Bewusst NICHT gepinnt
 * ist die Form, in der der Roster-Adapter die Angabe weiterreicht: welches Feld
 * der Eingabevertrag der Fassade dafuer traegt, ist Sache der Umsetzung. Gepinnt
 * ist allein die Wirkung, die die Kriterien verlangen — dass die Angabe
 * **ankommt**, also die Pflichten und Wurzel-Angebote eines fremden Armeebuchs
 * aus dem Ergebnis der App-Auswertung verschwinden.
 *
 * Der Datensatz ist der des Issues in klein: das Kontingent ist in der
 * **Spielsystemdatei** deklariert, der Herkunftsindex aus den `.cat`-`forceEntry`s
 * kann deshalb prinzipiell nicht antworten — allein das App-Roster weiss, aus
 * welchem Armeebuch das Kontingent stammt (`Force.catalogueId`, `src/types.js`;
 * gesetzt von `src/roster/createRoster.js`).
 *
 * Deshalb ist diese Datei von der revidierten Rangfolge („der Herkunftsindex
 * schlaegt die Angabe des Rosters, wo er antwortet") **nicht** beruehrt: hier
 * antwortet er nirgends. Der Widerspruchsfall gehoert an die Engine-Naht und
 * steht dort (`crossCatalog.rosterDeclaredCatalogue.test.js`,
 * `query.primaryCatalogueFromRoster.test.js`).
 *
 * ── Gelesen wird NUR `force.catalogueId` ────────────────────────────────────
 * Kein Rueckfall auf `roster.catalogueId` (Entscheidung des Issues):
 * `roster.catalogueId` ist das Buch der **Liste**; auf ein Kontingent
 * angewandt, das keines nennt, ordnete es einem verbuendeten Kontingent das
 * falsche Buch zu — aktiv falsch gefiltert ist schlechter als ungefiltert. Der
 * Block „Kriterium 4 an der App-Naht" unten pinnt genau das: dort traegt das
 * Roster sehr wohl ein `catalogueId`, das Kontingent aber keines, und gefiltert
 * wird trotzdem nicht.
 *
 * Aufbau (System-/Roster-Formen, Leerfall-Konventionen) nach
 * `evaluationCache.evaluator.test.js`; hier ohne Fassaden-Mock, weil nicht der
 * Aufrufzaehler, sondern das Ergebnis Vertragsgegenstand ist.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluateAppRoster } from './evaluationCache.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-0140-app';
const COST_TYPE_ID = 'cost-pts-0140-app';
const CATALOGUE_A_ID = 'cat-a-0140-app';
const CATALOGUE_B_ID = 'cat-b-0140-app';

/** Das Kontingent steht in der `.gst` — genau der Fall des Issues. */
const GST_FORCE_ID = 'gst-force-0140-app';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <forceEntries><forceEntry id="${GST_FORCE_ID}" name="System Force"/></forceEntries>
  </gameSystem>`;

/** Ein Armeebuch mit einem Wurzel-Angebot und einer armeeweiten Pflicht. */
function catalogueXml(letter, catalogueId) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${catalogueId}" name="Army ${letter}" gameSystemId="${GAME_SYSTEM_ID}" library="false">
      <selectionEntries>
        <selectionEntry id="${letter}-offer-unit-app" name="${letter} Offer Unit" type="unit"/>
        <selectionEntry id="${letter}-roster-min-unit-app" name="${letter} Roster Min Unit" type="unit">
          <constraints>
            <constraint id="${letter}-roster-min-app" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Das App-System-Objekt mit den rohen XMLs (Form aus `src/db/systemImport.js`). */
function appSystem() {
  return {
    id: 'system-uuid-0140',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [
        { name: 'a.cat', content: catalogueXml('a', CATALOGUE_A_ID) },
        { name: 'b.cat', content: catalogueXml('b', CATALOGUE_B_ID) },
      ],
    },
  };
}

/**
 * Ein leeres App-Roster mit einem Kontingent aus der `.gst`. `catalogueId` ist
 * die Armeebuch-Id, die die App am Kontingent fuehrt (`Force.catalogueId`).
 */
function appRoster(catalogueId) {
  return {
    id: 'roster-uuid-0140',
    name: 'Test Roster',
    systemId: 'system-uuid-0140',
    catalogueId,
    costLimit: 2000,
    costLimitType: COST_TYPE_ID,
    forces: [{ id: 'force-uuid-0140', forceEntryId: GST_FORCE_ID, catalogueId, selections: [] }],
  };
}

/** True, wenn das Ergebnis eine Verletzung mit dieser Grenz-Id traegt. */
function hasViolationWithLimitId(result, limitId) {
  return result.violations.some(violation => violation.limitId === limitId);
}

/** True, wenn irgendein Slot des Ergebnisses diese defId als Angebots-Anker traegt. */
function isOfferedAnywhere(result, defId) {
  return [...result.capabilities.values()].some(
    capability => capability.defId === defId && capability.anchorKind === 'offerAnchor',
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 7: die im App-Roster gesetzte Armeebuch-Id kommt in der Auswertung an
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 7: App-Auswertung mit gesetzter Armeebuch-Id am Kontingent', () => {
  it('Kontrast: die Pflicht des eigenen Armeebuchs steht weiterhin im Ergebnis', () => {
    // Heute schon gruen und bleibt es — ohne diese Gegenprobe waere der Test
    // darunter auch von einer leeren Verletzungsliste erfuellt.
    const result = evaluateAppRoster(appSystem(), appRoster(CATALOGUE_A_ID));

    expect(hasViolationWithLimitId(result, 'a-roster-min-app')).toBe(true);
  });

  it('die Pflicht des fremden Armeebuchs steht NICHT mehr im Ergebnis', () => {
    const result = evaluateAppRoster(appSystem(), appRoster(CATALOGUE_A_ID));

    expect(hasViolationWithLimitId(result, 'b-roster-min-app')).toBe(false);
  });

  it('der Wurzel-Eintrag des fremden Armeebuchs wird nicht mehr als Slot angeboten', () => {
    const result = evaluateAppRoster(appSystem(), appRoster(CATALOGUE_A_ID));

    expect(isOfferedAnywhere(result, 'b-offer-unit-app')).toBe(false);
  });

  it('Kontrast: der Wurzel-Eintrag des eigenen Armeebuchs wird weiterhin angeboten', () => {
    const result = evaluateAppRoster(appSystem(), appRoster(CATALOGUE_A_ID));

    expect(isOfferedAnywhere(result, 'a-offer-unit-app')).toBe(true);
  });

  it('Rand: setzt das App-Roster das ANDERE Armeebuch, kehrt sich die Lage um', () => {
    const result = evaluateAppRoster(appSystem(), appRoster(CATALOGUE_B_ID));

    expect(hasViolationWithLimitId(result, 'b-roster-min-app')).toBe(true);
    expect(hasViolationWithLimitId(result, 'a-roster-min-app')).toBe(false);
    expect(isOfferedAnywhere(result, 'b-offer-unit-app')).toBe(true);
    expect(isOfferedAnywhere(result, 'a-offer-unit-app')).toBe(false);
  });
});

describe('Kriterium 4 an der App-Naht: ohne Armeebuch-Id am Kontingent bleibt alles beim Alten', () => {
  /**
   * Ein App-Roster, dessen **Kontingent** keine Armeebuch-Id traegt — die
   * **Liste** dagegen schon (`roster.catalogueId`). Genau so wird der fehlende
   * Rueckfall beobachtbar: griffe er, wuerde nach Armeebuch A gefiltert und Bs
   * Pflicht verschwaende.
   */
  function rosterWithoutForceCatalogueId() {
    const roster = appRoster(CATALOGUE_A_ID);
    delete roster.forces[0].catalogueId;
    return roster;
  }

  it('beide Pflichten und beide Wurzel-Angebote bleiben — es wird wie bisher nicht gefiltert', () => {
    // Regressions-Wache, heute gruen. Zugleich der Pin auf „kein Rueckfall auf
    // `roster.catalogueId`": das Roster nennt A, das Kontingent nichts — und
    // trotzdem bleibt Bs Pflicht stehen.
    const result = evaluateAppRoster(appSystem(), rosterWithoutForceCatalogueId());

    expect(hasViolationWithLimitId(result, 'a-roster-min-app')).toBe(true);
    expect(hasViolationWithLimitId(result, 'b-roster-min-app')).toBe(true);
    expect(isOfferedAnywhere(result, 'a-offer-unit-app')).toBe(true);
    expect(isOfferedAnywhere(result, 'b-offer-unit-app')).toBe(true);
  });

  it('Rand: eine ausdruecklich auf null gesetzte Armeebuch-Id zaehlt wie keine', () => {
    // Regressions-Wache, heute gruen: `null` ist keine Armeebuch-Id — die
    // Kriterien verlangen fuer „keine Id" das unveraenderte Verhalten, und ein
    // fehlendes Feld und ein leeres Feld sind derselbe Fall.
    const roster = appRoster(CATALOGUE_A_ID);
    roster.forces[0].catalogueId = null;

    const result = evaluateAppRoster(appSystem(), roster);

    expect(hasViolationWithLimitId(result, 'a-roster-min-app')).toBe(true);
    expect(hasViolationWithLimitId(result, 'b-roster-min-app')).toBe(true);
  });

  it('widerspricht die Liste dem Kontingent, gilt das KONTINGENT — `roster.catalogueId` wird nie gelesen', () => {
    // Der schaerfste Pin auf „nur `force.catalogueId`": die Liste nennt A, das
    // Kontingent B. Gefiltert wird nach B.
    const roster = appRoster(CATALOGUE_A_ID);
    roster.forces[0].catalogueId = CATALOGUE_B_ID;

    const result = evaluateAppRoster(appSystem(), roster);

    expect(hasViolationWithLimitId(result, 'b-roster-min-app')).toBe(true);
    expect(hasViolationWithLimitId(result, 'a-roster-min-app')).toBe(false);
  });
});
