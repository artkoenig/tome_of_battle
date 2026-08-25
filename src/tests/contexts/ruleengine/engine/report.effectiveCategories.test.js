/**
 * Issue 0100 — „Bericht traegt keine Primaerkategorie".
 *
 * `docs/battlescribe-data-format.md` §7.2: `primary="true"` bestimmt den
 * Anzeige-Bucket eines Eintrags (genau eine pro Eintrag). §7.7/§8:
 * `set-primary`/`unset-primary` schalten das `primary`-Flag zur Laufzeit um,
 * und SAEMTLICHE kategorie-abhaengige Logik — auch die UI-Einsortierung —
 * muss die EFFEKTIVEN Kategorie-Links auswerten. Unter ADR-0034/0035 ist der
 * Bericht die einzige Quelle der UI, also muss er sie tragen.
 *
 * Vertrag (Decisions des Issues, Feldnamen bindend):
 * - `SlotCapability.categoryIds: string[]` — die effektiven Kategorie-Ids des
 *   Slots (nach `add`/`remove`/`set-primary`-Mitgliedschaftswirkung).
 * - `SlotCapability.primaryCategoryId: string | null` — die effektive
 *   Primaerkategorie, `null` = keine.
 * - Basis-Primary = Ziel des categoryLinks mit `primary="true"` (mehrere:
 *   der erste in Dokumentreihenfolge gewinnt; keiner: `null`).
 * - `set-primary <catId>`: stellt Mitgliedschaft sicher UND setzt die
 *   Primaerkategorie auf `<catId>` (der letzte gewinnt).
 * - `unset-primary <catId>`: entfernt das Primaer-Flag genau dann, wenn
 *   `<catId>` aktuell primaer ist; die Mitgliedschaft bleibt unberuehrt.
 *
 * Beobachtet wird ausschliesslich der Bericht der echten Fassade
 * (`prepareDataset`/`evaluate`); jeder Test sichert zuerst
 * `diagnostics === []` ab, damit er aus dem richtigen Grund fehlschlaegt
 * (fehlendes Verhalten, nicht kaputte Fixture).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { AnchorKind } from '../../../../contexts/ruleengine/engine/model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade
 * aus (Konvention wie `constraints.hiddenMin.test.js`).
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Der belegte Slot einer Definitions- bzw. Link-Id — oder `null`. */
function occupiedSlotOf(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) {
      return capability;
    }
  }
  return null;
}

/**
 * Die effektiven Kategorie-Ids eines Slots, sortiert (der Vertrag legt keine
 * Reihenfolge fest). Ein heute fehlendes Feld liest sich als leere Menge, so
 * dass die Assertion sauber fehlschlaegt statt mit einem TypeError abzubrechen.
 */
function sortedCategoryIds(capability) {
  return [...(capability.categoryIds ?? [])].sort();
}

// Gemeinsame Kategorie-Ids der Fixtures.
const CAT_LORD = 'cat-lord';
const CAT_HERO = 'cat-hero';
const CAT_TAG = 'cat-tag';
const CAT_ELITE = 'cat-elite';
const CAT_MERC = 'cat-mercenary';

// ─────────────────────────────────────────────────────────────────────────────
// AC 1: Basis — der belegte Slot nennt seine Kategorien und die Primaere.
// ─────────────────────────────────────────────────────────────────────────────

describe('Basis: der Faehigkeitsdatensatz nennt effektive Kategorien und Primaerkategorie (AC 1)', () => {
  const KNIGHT_ID = 'entry-knight';
  const PLAIN_ID = 'entry-plain';
  const TAGGED_ID = 'entry-tagged';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-base-primary" name="Base Primary Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_LORD}" name="Lord"/>
        <categoryEntry id="${CAT_TAG}" name="Tag"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${KNIGHT_ID}" name="Knight" type="unit">
          <categoryLinks>
            <categoryLink id="clink-knight-lord" name="Lord" targetId="${CAT_LORD}" primary="true"/>
            <categoryLink id="clink-knight-tag" name="Tag" targetId="${CAT_TAG}" primary="false"/>
          </categoryLinks>
        </selectionEntry>
        <selectionEntry id="${TAGGED_ID}" name="Tagged" type="unit">
          <categoryLinks>
            <categoryLink id="clink-tagged-tag" name="Tag" targetId="${CAT_TAG}" primary="false"/>
          </categoryLinks>
        </selectionEntry>
        <selectionEntry id="${PLAIN_ID}" name="Plain" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('nennt am belegten Slot die Kategorie-Ids beider Links und die primary="true"-Kategorie', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: KNIGHT_ID, count: 1, children: [] }] });

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, KNIGHT_ID);
    expect(capability).not.toBeNull();
    expect(sortedCategoryIds(capability)).toEqual([CAT_LORD, CAT_TAG].sort());
    expect(capability.primaryCategoryId).toBe(CAT_LORD);
  });

  it('meldet primaryCategoryId === null, wenn kein Link primary="true" traegt — Mitgliedschaft bleibt', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: TAGGED_ID, count: 1, children: [] }] });

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, TAGGED_ID);
    expect(capability).not.toBeNull();
    expect(sortedCategoryIds(capability)).toEqual([CAT_TAG]);
    expect(capability.primaryCategoryId).toBeNull();
  });

  it('RAND: ein Eintrag ohne jeden categoryLink traegt eine leere Kategorienliste und null', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: PLAIN_ID, count: 1, children: [] }] });

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, PLAIN_ID);
    expect(capability).not.toBeNull();
    expect(capability.categoryIds).toEqual([]);
    expect(capability.primaryCategoryId).toBeNull();
  });
});

describe('Basis-Rand: mehrere primary="true"-Links — der erste in Dokumentreihenfolge gewinnt (AC 1)', () => {
  const DOUBLE_ID = 'entry-double-primary';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-double-primary" name="Double Primary Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_LORD}" name="Lord"/>
        <categoryEntry id="${CAT_HERO}" name="Hero"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${DOUBLE_ID}" name="Double" type="unit">
          <categoryLinks>
            <categoryLink id="clink-double-lord" name="Lord" targetId="${CAT_LORD}" primary="true"/>
            <categoryLink id="clink-double-hero" name="Hero" targetId="${CAT_HERO}" primary="true"/>
          </categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('nennt die Kategorie des ERSTEN primary-Links als Primaere, beide als Mitgliedschaften', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: DOUBLE_ID, count: 1, children: [] }] });

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, DOUBLE_ID);
    expect(capability).not.toBeNull();
    expect(sortedCategoryIds(capability)).toEqual([CAT_HERO, CAT_LORD].sort());
    expect(capability.primaryCategoryId).toBe(CAT_LORD);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 2: das §8-Beispiel — eine per entryLink eingebundene Einheit wird per
// bedingtem `set-primary` in eine andere Kategorie umgegliedert.
// ─────────────────────────────────────────────────────────────────────────────

describe('set-primary: die per Link umgegliederte Einheit nennt die neue Primaerkategorie (AC 2, §8)', () => {
  const FORCE_ID = 'force-main';
  const OGRE_LINK_ID = 'link-maneater';
  const OGRE_TARGET_ID = 'shared-maneater';
  const TOKEN_ID = 'entry-token';

  // Das §8-Muster: ein geteilter Eintrag mit Basis-Primary "Lord", eingebunden
  // ueber einen entryLink, dessen bedingter `set-primary`-Modifier ihn in die
  // Kategorie "Mercenary" umgliedert, sobald ein Token im Roster steht.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-set-primary" name="Set Primary Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_LORD}" name="Lord"/>
        <categoryEntry id="${CAT_MERC}" name="Mercenary"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Main Force"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
      </selectionEntries>
      <entryLinks>
        <entryLink id="${OGRE_LINK_ID}" name="Maneater" targetId="${OGRE_TARGET_ID}" type="selectionEntry">
          <modifiers>
            <modifier type="set-primary" field="category" value="${CAT_MERC}">
              <conditions>
                <condition type="atLeast" value="1" field="selections" scope="roster" childId="${TOKEN_ID}"/>
              </conditions>
            </modifier>
          </modifiers>
        </entryLink>
      </entryLinks>
      <sharedSelectionEntries>
        <selectionEntry id="${OGRE_TARGET_ID}" name="Maneater" type="unit">
          <categoryLinks>
            <categoryLink id="clink-maneater-lord" name="Lord" targetId="${CAT_LORD}" primary="true"/>
          </categoryLinks>
        </selectionEntry>
      </sharedSelectionEntries>
    </catalogue>`;

  /** Ein Kontingent mit dem Maneater und optional dem Token. */
  function army({ token }) {
    const children = [{ defId: OGRE_LINK_ID, count: 1, children: [] }];
    if (token) children.push({ defId: TOKEN_ID, count: 1, children: [] });
    return { forces: [{ defId: FORCE_ID, count: 1, children }] };
  }

  it('NEU: die Bedingung haelt ⇒ neue Primaere "Mercenary" UND Mitgliedschaft in beiden Kategorien', () => {
    const report = evaluate(CATALOGUE_XML, army({ token: true }));

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, OGRE_LINK_ID);
    expect(capability).not.toBeNull();
    // `set-primary` stellt die Mitgliedschaft sicher; die Basis-Mitgliedschaft
    // "Lord" bleibt bestehen — nur das Primaer-Flag wandert.
    expect(sortedCategoryIds(capability)).toEqual([CAT_LORD, CAT_MERC].sort());
    expect(capability.primaryCategoryId).toBe(CAT_MERC);
  });

  it('KIPP-NACHWEIS: die Bedingung haelt NICHT ⇒ Basis-Primary "Lord", keine Mercenary-Mitgliedschaft', () => {
    const report = evaluate(CATALOGUE_XML, army({ token: false }));

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, OGRE_LINK_ID);
    expect(capability).not.toBeNull();
    expect(sortedCategoryIds(capability)).toEqual([CAT_LORD]);
    expect(capability.primaryCategoryId).toBe(CAT_LORD);
  });
});

describe('set-primary: bei mehreren feuernden Modifikatoren gewinnt der letzte (AC 2, Vertrag)', () => {
  const CHAMPION_ID = 'entry-champion';

  // Zwei unbedingte `set-primary` in Dokumentreihenfolge: erst Hero, dann Elite.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-last-set-primary" name="Last Set Primary Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_LORD}" name="Lord"/>
        <categoryEntry id="${CAT_HERO}" name="Hero"/>
        <categoryEntry id="${CAT_ELITE}" name="Elite"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${CHAMPION_ID}" name="Champion" type="unit">
          <categoryLinks>
            <categoryLink id="clink-champion-lord" name="Lord" targetId="${CAT_LORD}" primary="true"/>
          </categoryLinks>
          <modifiers>
            <modifier type="set-primary" field="category" value="${CAT_HERO}"/>
            <modifier type="set-primary" field="category" value="${CAT_ELITE}"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('nennt die Kategorie des LETZTEN set-primary als Primaere; beide feuernden stellen Mitgliedschaft sicher', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: CHAMPION_ID, count: 1, children: [] }] });

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, CHAMPION_ID);
    expect(capability).not.toBeNull();
    expect(sortedCategoryIds(capability)).toEqual([CAT_ELITE, CAT_HERO, CAT_LORD].sort());
    expect(capability.primaryCategoryId).toBe(CAT_ELITE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 3 (+ Mitgliedschafts-Pin fuer AC 4): unset-primary ist kein No-op mehr.
// ─────────────────────────────────────────────────────────────────────────────

describe('unset-primary wirkt auf das Primaer-Flag, nie auf die Mitgliedschaft (AC 3 + 4)', () => {
  const GUARD_ID = 'entry-guard';

  /** Ein Eintrag mit Primary "Lord" + Tag "Tag" und einem unbedingten unset-primary auf `unsetValue`. */
  function catalogue(unsetValue) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-unset-primary" name="Unset Primary Catalogue">
        <categoryEntries>
          <categoryEntry id="${CAT_LORD}" name="Lord"/>
          <categoryEntry id="${CAT_TAG}" name="Tag"/>
        </categoryEntries>
        <selectionEntries>
          <selectionEntry id="${GUARD_ID}" name="Guard" type="unit">
            <categoryLinks>
              <categoryLink id="clink-guard-lord" name="Lord" targetId="${CAT_LORD}" primary="true"/>
              <categoryLink id="clink-guard-tag" name="Tag" targetId="${CAT_TAG}" primary="false"/>
            </categoryLinks>
            <modifiers>
              <modifier type="unset-primary" field="category" value="${unsetValue}"/>
            </modifiers>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  const GUARD_ROSTER = { forces: [{ defId: GUARD_ID, count: 1, children: [] }] };

  it('NEU: unset-primary auf die AKTUELLE Primaere ⇒ primaryCategoryId === null', () => {
    const report = evaluate(catalogue(CAT_LORD), GUARD_ROSTER);

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, GUARD_ID);
    expect(capability).not.toBeNull();
    expect(capability.primaryCategoryId).toBeNull();
    // Der AC-4-Pin: die Mitgliedschaft ueberlebt das unset-primary unveraendert —
    // Zaehlung und Grenzen sehen weiterhin beide Kategorien.
    expect(sortedCategoryIds(capability)).toEqual([CAT_LORD, CAT_TAG].sort());
  });

  it('RAND: unset-primary auf eine NICHT-primaere Kategorie aendert nichts', () => {
    const report = evaluate(catalogue(CAT_TAG), GUARD_ROSTER);

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, GUARD_ID);
    expect(capability).not.toBeNull();
    expect(capability.primaryCategoryId).toBe(CAT_LORD);
    expect(sortedCategoryIds(capability)).toEqual([CAT_LORD, CAT_TAG].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 1 „effektiv": ein `add`-Modifikator erscheint in `categoryIds`.
// ─────────────────────────────────────────────────────────────────────────────

describe('add-Modifikator: die hinzugefuegte Kategorie erscheint in categoryIds (AC 1)', () => {
  const VETERAN_ID = 'entry-veteran';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-add-category" name="Add Category Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_LORD}" name="Lord"/>
        <categoryEntry id="${CAT_ELITE}" name="Elite"/>
      </categoryEntries>
      <selectionEntries>
        <selectionEntry id="${VETERAN_ID}" name="Veteran" type="unit">
          <categoryLinks>
            <categoryLink id="clink-veteran-lord" name="Lord" targetId="${CAT_LORD}" primary="true"/>
          </categoryLinks>
          <modifiers>
            <modifier type="add" field="category" value="${CAT_ELITE}"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('fuehrt die per add-Modifikator erworbene Kategorie in categoryIds; die Primaere bleibt', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: VETERAN_ID, count: 1, children: [] }] });

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, VETERAN_ID);
    expect(capability).not.toBeNull();
    expect(sortedCategoryIds(capability)).toEqual([CAT_ELITE, CAT_LORD].sort());
    expect(capability.primaryCategoryId).toBe(CAT_LORD);
  });
});
