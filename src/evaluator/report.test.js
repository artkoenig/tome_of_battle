import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

/**
 * Wertet einen einzelnen synthetischen Katalog aus. Die Fassade ist zweistufig
 * (Main-Issue 75, Baustein 8): erst den Datensatz aufbereiten, dann auswerten. Der
 * Datensatz hat die Form `{ gameSystem, catalogues }` (ADR-0032); ein Einzelkatalog
 * ohne Spielsystem ist `{ catalogues: [xml] }`.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}
import {
  AnchorKind,
  MessageSeverity,
  ConstraintKind,
  LimitMeasure,
  ROSTER_BUDGET_ANCHOR,
  rosterBudgetLimitId,
} from './model.js';
import { buildReport } from './report.js';
import { PreparedDataset } from './datasetPreparation.js';
import { buildEvalTree, selectableSlotsOf } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';

// ── Sicht eines Verbrauchers auf den Bericht ─────────────────────────────────
// Reine Lesehilfen, wie sie eine Oberflaeche selbst schreiben wuerde (§4.8): sie
// werten keine Regel aus, sondern lesen nur Felder des Faehigkeitsdatensatzes.
// Sie stehen bewusst hier und nicht in der Engine — der Bericht traegt die
// Aussage bereits, eine zweite Rechenstelle dafuer gaebe es sonst umsonst.

/** Auswaehlbar ist ein Slot, der weder versteckt noch gesperrt ist. */
function isSelectable(report, path) {
  const capability = report.capabilities.get(path);
  return capability !== undefined && !capability.isHidden && !capability.isBlocked;
}

/** Der Restspielraum eines Slots; `null` ohne Hoechstmass oder bei unbekanntem Pfad. */
function remainingAllowed(report, path) {
  return report.capabilities.get(path)?.headroom ?? null;
}

/** Die Slots mit unerfuellter MIN-Grenze. */
function mandatoryOpenSlots(report) {
  return [...report.capabilities.values()].filter(capability => capability.isMandatoryUnmet);
}

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030: eigenes Datenmodell, eigene Fixtures) ──
// Slice 07: die zweite Sicht des Berichts — der Faehigkeitsdatensatz je Slot und
// die reinen UI-Projektions-Lookups. Die realistischen WHFB6-Fixtures und der
// Real-Katalog-Rauchtest sind bewusst NICHT hier, sondern in Slice 08 (E2E).

const WARRIOR_DEF_ID = 'entry-warrior';
const WARRIOR_NAME = 'Warrior';

/** Sucht den Faehigkeitsdatensatz eines Slots ueber die Definitions-ID (mit seinem Pfad). */
function slotByDefId(report, defId, { phantom = false } = {}) {
  for (const [path, capability] of report.capabilities) {
    if (capability.defId === defId && (capability.anchorKind !== AnchorKind.OCCUPIED) === phantom) {
      return { path, capability };
    }
  }
  return null;
}

/** Baut ein Roster mit einer einzelnen Instanz gegebener Definition und Anzahl. */
function rosterOf(defId, count) {
  return { forces: [{ defId, count, children: [] }] };
}

describe('Bericht: Faehigkeitsdatensatz einer MAX-Grenze', () => {
  const MAX_WARRIORS = 2;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-max" name="Capability MAX Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <constraints>
            <constraint id="max-warriors" type="max" value="${MAX_WARRIORS}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('weist effektives max, Stand und Restspielraum aus und meldet unter dem Max nicht gesperrt', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MAX_WARRIORS - 1));

    const { path, capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability).toMatchObject({
      effectiveMin: null,
      effectiveMax: MAX_WARRIORS,
      current: MAX_WARRIORS - 1,
      headroom: 1,
      isBlocked: false,
      isMandatoryUnmet: false,
      isHidden: false,
      authorMessages: [],
    });
    // UI-Projektion: rein aus dem Bericht abgeleitet.
    expect(isSelectable(report, path)).toBe(true);
    expect(remainingAllowed(report, path)).toBe(1);
    expect(mandatoryOpenSlots(report)).toHaveLength(0);
  });

  it('meldet einen Slot an seinem Max als gesperrt, mit Restspielraum 0', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MAX_WARRIORS));

    const { path, capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability.isBlocked).toBe(true);
    expect(capability.headroom).toBe(0);
    expect(capability.current).toBe(MAX_WARRIORS);
    // Gesperrt ⇒ nicht auswaehlbar; kein Restspielraum mehr.
    expect(isSelectable(report, path)).toBe(false);
    expect(remainingAllowed(report, path)).toBe(0);
  });

  it('haelt Restspielraum bei 0 (nie negativ), wenn das Max ueberschritten ist', () => {
    const overLimit = MAX_WARRIORS + 1;
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, overLimit));

    const { capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(report.violations).toHaveLength(1);
    expect(capability.isBlocked).toBe(true);
    expect(capability.headroom).toBe(0);
    expect(capability.current).toBe(overLimit);
  });
});

describe('Bericht: Faehigkeitsdatensatz einer MIN-Grenze am realen Knoten', () => {
  const MIN_WARRIORS = 2;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-min" name="Capability MIN Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <constraints>
            <constraint id="min-warriors" type="min" value="${MIN_WARRIORS}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet einen Slot unter seinem Min als Pflicht-unerfuellt und ohne Restspielraum (kein Max)', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MIN_WARRIORS - 1));

    const { path, capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability).toMatchObject({
      effectiveMin: MIN_WARRIORS,
      effectiveMax: null,
      current: MIN_WARRIORS - 1,
      headroom: null,
      isMandatoryUnmet: true,
      isBlocked: false,
    });
    // Ohne Max weder gesperrt noch versteckt ⇒ auswaehlbar; offener Pflichtslot.
    expect(isSelectable(report, path)).toBe(true);
    expect(remainingAllowed(report, path)).toBeNull();
    expect(mandatoryOpenSlots(report)).toEqual([capability]);
  });

  it('meldet den Slot nicht mehr als Pflicht-unerfuellt, sobald das Min erreicht ist', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, MIN_WARRIORS));

    const { capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability.isMandatoryUnmet).toBe(false);
    expect(capability.current).toBe(MIN_WARRIORS);
    expect(mandatoryOpenSlots(report)).toHaveLength(0);
  });
});

describe('Bericht: Faehigkeitsdatensatz eines Phantom-Pflichtslots (Pflicht-Absenz)', () => {
  const OGRE_DEF_ID = 'entry-ogre-bulls';
  const MIN_OGRE = 2;
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-phantom" name="Capability Phantom Catalogue">
      <selectionEntries>
        <selectionEntry id="${OGRE_DEF_ID}" name="Ogerbullen" type="unit">
          <constraints>
            <constraint id="min-ogre" type="min" value="${MIN_OGRE}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('legt fuer den fehlenden Pflichteintrag einen Phantom-Slot mit Stand 0 und Pflicht-unerfuellt an', () => {
    // Roster ohne Ogerbullen — der Pflichteintrag fehlt ganz.
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, 3));

    const phantom = slotByDefId(report, OGRE_DEF_ID, { phantom: true });
    expect(phantom).not.toBeNull();
    expect(phantom.capability).toMatchObject({
      effectiveMin: MIN_OGRE,
      current: 0,
      headroom: null,
      isMandatoryUnmet: true,
    });
    // Der Phantom-Slot ist ein offener Pflichtslot des Berichts.
    expect(mandatoryOpenSlots(report)).toContainEqual(phantom.capability);
  });
});

describe('Bericht: versteckter Slot', () => {
  const HIDDEN_DEF_ID = 'entry-hidden-relic';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-hidden" name="Capability Hidden Catalogue">
      <selectionEntries>
        <selectionEntry id="${HIDDEN_DEF_ID}" name="Verborgenes Relikt" type="upgrade">
          <modifiers>
            <modifier type="set" field="hidden" value="true"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet einen durch Modifikator versteckten Slot als versteckt und damit als nicht auswaehlbar', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(HIDDEN_DEF_ID, 1));

    const { path, capability } = slotByDefId(report, HIDDEN_DEF_ID);
    expect(capability.isHidden).toBe(true);
    expect(isSelectable(report, path)).toBe(false);
  });
});

describe('Bericht: bedingte Autor-Meldungen am Slot', () => {
  const BANNER_DEF_ID = 'entry-banner-unit';
  const NOTE_TEXT = 'Verbund erst ab zwei Einheiten';
  const NOTE_THRESHOLD = 2;
  // Eine Autor-Meldung unter einer Bedingung: sie erscheint nur, wenn die
  // Bedingung (self >= 2 Selektionen) haelt.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-note" name="Capability Note Catalogue">
      <selectionEntries>
        <selectionEntry id="${BANNER_DEF_ID}" name="Bannertraeger" type="unit">
          <modifiers>
            <modifier type="add" field="info" value="${NOTE_TEXT}">
              <conditions>
                <condition type="atLeast" field="selections" scope="self" value="${NOTE_THRESHOLD}"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('haengt die bedingte Meldung an den betreffenden Slot, wenn die Bedingung haelt', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(BANNER_DEF_ID, NOTE_THRESHOLD));

    const { capability } = slotByDefId(report, BANNER_DEF_ID);
    expect(capability.authorMessages).toEqual([{ severity: MessageSeverity.INFO, text: NOTE_TEXT }]);
  });

  it('laesst die Meldung am Slot aus, wenn die Bedingung nicht haelt (sie ist wirklich bedingt)', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(BANNER_DEF_ID, NOTE_THRESHOLD - 1));

    const { capability } = slotByDefId(report, BANNER_DEF_ID);
    expect(capability.authorMessages).toEqual([]);
  });
});

describe('Bericht: die Kennung eines Slots leitet sich aus seinem Pfad ab', () => {
  const FORCE_ID = 'force-army';
  const OPTION_ID = 'entry-option';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-slot-key" name="Slot Key Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <selectionEntries>
            <selectionEntry id="${OPTION_ID}" name="Option" type="upgrade"/>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  const ROSTER = {
    forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: WARRIOR_DEF_ID, count: 1, children: [] }] }],
  };

  /** Die Folge der Kind-Indizes von der Wurzel bis zum Knoten, hier unabhaengig gebildet. */
  function childIndexPathOf(node) {
    const segments = [];
    for (let current = node; current.parent !== null; current = current.parent) {
      segments.unshift(current.parent.children.indexOf(current));
    }
    return segments.join('/');
  }

  it('kennzeichnet jeden Slot mit seiner Kind-Index-Folge, nicht mit einer laufenden Nummer', () => {
    const report = evaluate(CATALOGUE_XML, ROSTER);

    // Der Bericht traegt keinen Baumknoten (ADR-0034), also wird der Baum hier
    // unabhaengig noch einmal gebaut und die erwartete Schluesselmenge daraus
    // gebildet — genau die Gegenprobe, die der Test meint.
    const { resolved } = PreparedDataset.contentsOf(prepareDataset({ catalogues: [CATALOGUE_XML] }));
    const { root } = buildEvalTree(resolved, ROSTER);
    attachOfferAnchors(root, resolved);

    const expectedKeys = selectableSlotsOf(root).map(childIndexPathOf);
    expect([...report.capabilities.keys()].sort()).toEqual([...expectedKeys].sort());
    for (const key of report.capabilities.keys()) {
      expect(key, `Slot-Kennung "${key}" ist keine Kind-Index-Folge`).toMatch(/^\d+(\/\d+)*$/);
    }
  });

  it('liefert ueber zwei Auswertungen desselben Rosters dieselben Slot-Kennungen', () => {
    const first = evaluate(CATALOGUE_XML, ROSTER);
    const second = evaluate(CATALOGUE_XML, ROSTER);

    expect([...second.capabilities.keys()]).toEqual([...first.capabilities.keys()]);
  });

  it('haelt die Kennung eines belegten Slots stabil, obwohl das Angebot den Baum vergroessert', () => {
    // Der Krieger haengt als erstes Kind des Kontingents — die Angebots-Anker
    // kommen ausschliesslich dahinter, sein Pfad bleibt damit „0/0".
    const report = evaluate(CATALOGUE_XML, ROSTER);

    const { path, capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(path).toBe('0/0');
    expect(capability.anchorKind).toBe(AnchorKind.OCCUPIED);
    // Und das Angebot ist wirklich da: die Option des Kriegers wird angeboten.
    expect([...report.capabilities.values()].some(
      slot => slot.defId === OPTION_ID && slot.anchorKind === AnchorKind.OFFER_ANCHOR,
    )).toBe(true);
  });
});

describe('Bericht: UI-Projektions-Lookups sind reine Bericht-Leser', () => {
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-lookup" name="Capability Lookup Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <constraints>
            <constraint id="max-warriors" type="max" value="3" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('behandelt einen unbekannten Pfad als nicht auswaehlbar und ohne Restspielraum, statt zu werfen', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, 1));

    expect(isSelectable(report, 'kein-solcher-pfad')).toBe(false);
    expect(remainingAllowed(report, 'kein-solcher-pfad')).toBeNull();
  });
});

describe('Bericht: Faehigkeitsdatensatz eines Kategorie-Knotens', () => {
  const FORCE_ID = 'force-army';
  const CORE_CATEGORY_ID = 'cat-core';
  const HIDDEN_CATEGORY_ID = 'cat-mercenaries';
  const TRIGGER_ID = 'entry-trigger';
  const CORE_UNIT_ID = 'entry-core-unit';
  const MAX_CORE = 3;

  // Ein Kontingent mit zwei Kategorien: „Core" mit einer Hoechstgrenze und
  // „Mercenaries", die ein Modifikator ausblendet, sobald der Ausloeser gewaehlt
  // ist. Genau die Form, die die Oberflaeche als Abschnitt mit eigenen Grenzen
  // darstellt — und die bis Issue 75/05 im Bericht gar nicht vorkam.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-category-slot" name="Category Slot Catalogue">
      <categoryEntries>
        <categoryEntry id="${CORE_CATEGORY_ID}" name="Core"/>
        <categoryEntry id="${HIDDEN_CATEGORY_ID}" name="Mercenaries"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army">
          <categoryLinks>
            <categoryLink id="link-core" name="Core" targetId="${CORE_CATEGORY_ID}">
              <constraints>
                <constraint id="max-core" type="max" value="${MAX_CORE}" field="selections" scope="force"/>
              </constraints>
            </categoryLink>
            <categoryLink id="link-mercenaries" name="Mercenaries" targetId="${HIDDEN_CATEGORY_ID}">
              <modifiers>
                <modifier type="set" field="hidden" value="true">
                  <conditions>
                    <condition type="atLeast" field="selections" scope="force" childId="${TRIGGER_ID}" value="1"/>
                  </conditions>
                </modifier>
              </modifiers>
            </categoryLink>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${CORE_UNIT_ID}" name="Core Unit" type="unit">
          <categoryLinks>
            <categoryLink targetId="${CORE_CATEGORY_ID}"/>
          </categoryLinks>
        </selectionEntry>
        <selectionEntry id="${TRIGGER_ID}" name="Trigger" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  /** Ein Kontingent mit den uebergebenen Auswahl-Instanzen. */
  function army(selections) {
    return { forces: [{ defId: FORCE_ID, count: 1, children: selections }] };
  }

  /**
   * Der Faehigkeitsdatensatz des Kategorie-Ankers dieser Kategorie — **allein aus
   * dem Bericht** nachgeschlagen (`targetDefId`), ohne in den Baumknoten zu
   * greifen. Genau das muss die Oberflaeche koennen (ADR-0034): der Anker traegt
   * den `categoryLink`, gemeint ist die Kategorie dahinter.
   */
  function categorySlot(report, categoryId) {
    return [...report.capabilities.values()].find(
      capability => capability.anchorKind === AnchorKind.CATEGORY_ANCHOR && capability.targetDefId === categoryId,
    );
  }

  it('fuehrt fuer jede Kategorie des Kontingents einen Slot mit Hoechstmass, Belegung und Rahmen-Bezug', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: CORE_UNIT_ID, count: 2, children: [] }]));

    expect(categorySlot(report, CORE_CATEGORY_ID)).toMatchObject({
      anchorKind: AnchorKind.CATEGORY_ANCHOR,
      frame: { defId: FORCE_ID, path: '0' },
      effectiveMax: MAX_CORE,
      current: 2,
      headroom: MAX_CORE - 2,
      isBlocked: false,
      isHidden: false,
    });
  });

  it('meldet eine per Modifikator ausgeblendete Kategorie als versteckt und damit als nicht verfuegbar', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: TRIGGER_ID, count: 1, children: [] }]));

    const hiddenCategory = categorySlot(report, HIDDEN_CATEGORY_ID);
    expect(hiddenCategory.isHidden).toBe(true);
    expect(isSelectable(report, [...report.capabilities].find(([, c]) => c === hiddenCategory)[0])).toBe(false);
  });

  it('haelt dieselbe Kategorie ohne den Ausloeser sichtbar — das Merkmal ist wirklich bedingt', () => {
    const report = evaluate(CATALOGUE_XML, army([]));

    expect(categorySlot(report, HIDDEN_CATEGORY_ID).isHidden).toBe(false);
  });

  it('meldet eine ausgeschoepfte Kategorie als gesperrt, statt sie wegzulassen', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: CORE_UNIT_ID, count: MAX_CORE, children: [] }]));

    expect(categorySlot(report, CORE_CATEGORY_ID)).toMatchObject({ isBlocked: true, headroom: 0 });
  });
});

describe('Bericht: alle ausgeloesten Diagnosen sind gesammelt', () => {
  const HERO_DEF_ID = 'entry-hero';
  const UNKNOWN_SCOPE = 'kein-rahmen';
  const POINTS_COST_ID = 'pts';
  // Ein einziger Katalog/Roster, der drei verschiedene Diagnose-Arten ausloest:
  //  - Null-Nenner (Prozentgrenze auf eine nirgends getragene Kostenart),
  //  - nicht aufloesbarer Bezugsrahmen (MIN-Grenze mit unbekanntem Scope),
  //  - unaufloesbare Definition (Roster verweist auf eine unbekannte ID).
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-diagnostics" name="Capability Diagnostics Catalogue">
      <selectionEntries>
        <selectionEntry id="${HERO_DEF_ID}" name="Held" type="unit">
          <constraints>
            <constraint id="pct-max" type="max" value="50" field="${POINTS_COST_ID}" scope="roster" percentValue="true"/>
            <constraint id="bad-scope-min" type="min" value="1" field="selections" scope="${UNKNOWN_SCOPE}"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('vereint Resolver-, Nichtaufloesungs- und Null-Nenner-Diagnosen im Bericht', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [
        { defId: HERO_DEF_ID, count: 1, children: [] },
        { defId: 'unbekannt', count: 1, children: [] },
      ],
    });

    expect(report.diagnostics).toContainEqual(expect.objectContaining({ kind: 'zeroDenominator' }));
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: UNKNOWN_SCOPE })
    );
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedDefinition', defId: 'unbekannt' })
    );
  });
});

describe('Bericht: ein Slot mit Grenzen mehrerer Messgroessen', () => {
  // Ein Gegenstand, der **zweifach** begrenzt ist: nach Anzahl und nach Punkten —
  // die haeufigste Doppelbegrenzung der echten Kataloge ("hoechstens 2 magische
  // Gegenstaende und hoechstens 100 Punkte"). Die Zahlen sind so gewaehlt, dass
  // die **Punkte**-Grenze den kleineren Abstand zu ihrem Grenzwert hat: wuerden
  // die Abstaende beider Messgroessen gegeneinander verglichen, gewaenne sie —
  // und der Slot meldete 98 von 100 statt 1 von 5.
  const ITEM_DEF_ID = 'entry-item';
  const POINTS_COST_TYPE_ID = 'pts';
  const ITEM_POINTS = 98;
  const MAX_ITEM_SELECTIONS = 5;
  const MAX_ITEM_POINTS = 100;
  const MIN_ITEM_SELECTIONS = 3;
  const MIN_ITEM_POINTS = 500;
  const MAX_POINTS_LIMIT_ID = 'max-item-points';

  /** Ein Katalog mit dem Gegenstand und genau den uebergebenen Grenzen. */
  function catalogueWith(constraintsXml) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-cap-measures" name="Capability Measures Catalogue">
        <selectionEntries>
          <selectionEntry id="${ITEM_DEF_ID}" name="Magischer Gegenstand" type="upgrade">
            <costs>
              <cost name="Points" typeId="${POINTS_COST_TYPE_ID}" value="${ITEM_POINTS}"/>
            </costs>
            <constraints>${constraintsXml}</constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  const MAX_BY_SELECTIONS = `<constraint id="max-item-selections" type="max" value="${MAX_ITEM_SELECTIONS}" field="selections" scope="roster"/>`;
  const MAX_BY_POINTS = `<constraint id="${MAX_POINTS_LIMIT_ID}" type="max" value="${MAX_ITEM_POINTS}" field="${POINTS_COST_TYPE_ID}" scope="roster"/>`;
  const MIN_BY_SELECTIONS = `<constraint id="min-item-selections" type="min" value="${MIN_ITEM_SELECTIONS}" field="selections" scope="roster"/>`;
  const MIN_BY_POINTS = `<constraint id="min-item-points" type="min" value="${MIN_ITEM_POINTS}" field="${POINTS_COST_TYPE_ID}" scope="roster"/>`;

  it('weist die Obergrenze auf Auswahlen aus, nicht die auf Punkte mit dem kleineren Abstand', () => {
    // 1 von 5 Auswahlen (Abstand 4) gegen 98 von 100 Punkten (Abstand 2).
    const report = evaluate(catalogueWith(MAX_BY_SELECTIONS + MAX_BY_POINTS), rosterOf(ITEM_DEF_ID, 1));

    expect(slotByDefId(report, ITEM_DEF_ID).capability).toMatchObject({
      effectiveMax: MAX_ITEM_SELECTIONS,
      current: 1,
      headroom: MAX_ITEM_SELECTIONS - 1,
      isBlocked: false,
    });
  });

  it('weist die Untergrenze auf Auswahlen aus, nicht die auf Punkte mit dem groesseren Fehlbetrag', () => {
    // 1 von 3 Auswahlen (Fehlbetrag 2) gegen 98 von 500 Punkten (Fehlbetrag 402).
    const report = evaluate(catalogueWith(MIN_BY_SELECTIONS + MIN_BY_POINTS), rosterOf(ITEM_DEF_ID, 1));

    expect(slotByDefId(report, ITEM_DEF_ID).capability).toMatchObject({
      effectiveMin: MIN_ITEM_SELECTIONS,
      current: 1,
      isMandatoryUnmet: true,
    });
  });

  it('meldet die uebergangene Punktegrenze weiterhin als Verletzung — der Vorrang waehlt aus, er verschweigt nicht', () => {
    // 2 Gegenstaende: 2 von 5 Auswahlen erlaubt, aber 196 von 100 Punkten.
    const report = evaluate(catalogueWith(MAX_BY_SELECTIONS + MAX_BY_POINTS), rosterOf(ITEM_DEF_ID, 2));

    expect(slotByDefId(report, ITEM_DEF_ID).capability).toMatchObject({
      effectiveMax: MAX_ITEM_SELECTIONS,
      current: 2,
    });
    expect(report.violations.map(violation => violation.limitId)).toContain(MAX_POINTS_LIMIT_ID);
  });

  it('weist eine Punktegrenze unveraendert aus, wenn der Slot keine Grenze auf Auswahlen traegt', () => {
    const report = evaluate(catalogueWith(MAX_BY_POINTS), rosterOf(ITEM_DEF_ID, 1));

    expect(slotByDefId(report, ITEM_DEF_ID).capability).toMatchObject({
      effectiveMax: MAX_ITEM_POINTS,
      current: ITEM_POINTS,
      headroom: MAX_ITEM_POINTS - ITEM_POINTS,
    });
  });

  it('meldet Spielraum in der ausgewiesenen Messgroesse — das ist keine Zusage ueber Verfuegbarkeit', () => {
    // Dieselbe Lage wie im ersten Fall, hier als ausdrueckliche Aussage (§4.8):
    // der Slot meldet 4 freie Auswahlen und „nicht gesperrt", obwohl eine zweite
    // Auswahl (2 x 98) die Punktegrenze braeche. Was eine weitere Auswahl
    // verletzte, sagt allein die Meldungsliste — sie fuehrt jede Grenze.
    const report = evaluate(catalogueWith(MAX_BY_SELECTIONS + MAX_BY_POINTS), rosterOf(ITEM_DEF_ID, 1));

    expect(slotByDefId(report, ITEM_DEF_ID).capability).toMatchObject({
      headroom: MAX_ITEM_SELECTIONS - 1,
      isBlocked: false,
    });
    expect(ITEM_POINTS * 2).toBeGreaterThan(MAX_ITEM_POINTS);
  });
});

describe('Bericht: eine Messgroesse, die an keinem Slot ausweisbar ist', () => {
  // Die roster-weite Regel „Armee zu teuer" (`budget.js`) haengt an keinem Slot:
  // ihre Ergebnisse gehoeren in die Meldungsliste (`extras.budgetViolations`), nie
  // in die Ergebnisliste, aus der die Faehigkeitsdatensaetze entstehen. Beide
  // Listen laufen im Bericht dicht nebeneinander — die Zusicherung muss deshalb
  // schon beim **ersten** so gemessenen Ergebnis anschlagen: alle Budget-
  // Ergebnisse teilen denselben Anker, dieselbe Grenzenart und dieselbe
  // Messgroesse, sie treffen also nie auf eine andere Messgroesse, an der ein
  // Vergleich sie auffallen liesse.
  const POINTS_COST_TYPE_ID = 'points-cost-type';
  const MANA_COST_TYPE_ID = 'mana-cost-type';
  const PLANNED_SUM = 2200;
  const BUDGET = 2000;

  // Ein Baum ohne Slots: die Zusicherung greift beim Aufbau des Ergebnis-Index,
  // also vor dem ersten Faehigkeitsdatensatz — ein leerer Baum genuegt, und der
  // effektive Zustand wird auf diesem Weg nie gelesen.
  const TREE_WITHOUT_SLOTS = { children: [], parent: null, isRoot: true, def: null };
  const UNUSED_EFFECTIVE_STATE = {};
  const NO_DIAGNOSTICS = [];

  /** Ein Ergebnis in genau der Form, die `budget.js` liefert. */
  function budgetResultOf(costTypeId) {
    return {
      limit: { id: rosterBudgetLimitId(costTypeId), kind: ConstraintKind.MAX },
      anchor: ROSTER_BUDGET_ANCHOR,
      actual: PLANNED_SUM,
      bound: BUDGET,
      satisfied: false,
      delta: BUDGET - PLANNED_SUM,
      isReportable: true,
      measure: LimitMeasure.ROSTER_BUDGET,
    };
  }

  /** Baut den Bericht mit den uebergebenen Ergebnissen in der **Slot**-Ergebnisliste. */
  function buildingReportFrom(results) {
    return () => buildReport(TREE_WITHOUT_SLOTS, UNUSED_EFFECTIVE_STATE, results, NO_DIAGNOSTICS);
  }

  it('meldet ein einzelnes solches Ergebnis laut, statt es still zu indizieren', () => {
    expect(buildingReportFrom([budgetResultOf(POINTS_COST_TYPE_ID)])).toThrow(LimitMeasure.ROSTER_BUDGET);
  });

  it('meldet auch zwei davon laut — sie treffen nur aufeinander, nie auf eine andere Messgroesse', () => {
    expect(buildingReportFrom([
      budgetResultOf(POINTS_COST_TYPE_ID),
      budgetResultOf(MANA_COST_TYPE_ID),
    ])).toThrow(LimitMeasure.ROSTER_BUDGET);
  });

  it('nimmt dieselbe Verletzung auf ihrem vorgesehenen Weg an: als roster-weite Meldung ohne Slot', () => {
    const catalogueXml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-budget-measure" name="Budget Measure Catalogue">
        <selectionEntries>
          <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
            <costs>
              <cost name="Points" typeId="${POINTS_COST_TYPE_ID}" value="${BUDGET}"/>
            </costs>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    const report = evaluate(catalogueXml, {
      costLimits: [{ costTypeId: POINTS_COST_TYPE_ID, value: BUDGET }],
      forces: [{ defId: WARRIOR_DEF_ID, count: 2, children: [] }],
    });

    expect(report.violations.map(violation => violation.limit.measure)).toEqual([LimitMeasure.ROSTER_BUDGET]);
    expect([...report.capabilities.values()].every(capability => capability.effectiveMax === null)).toBe(true);
  });
});
