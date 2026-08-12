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
import { AnchorKind, ConstraintKind, LimitMeasure, MessageSeverity } from './model.js';
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

describe('Bericht: ein Slot mit zaehlender UND kostenmessender Max-Grenze', () => {
  // Der Katalog-Regelfall des Magiegegenstands-Blocks: „hoechstens 1 davon, und
  // darin hoechstens 50 Punkte". Beide Grenzen sind Hoechstmasse desselben Slots,
  // messen aber Verschiedenes — die Stueckzahl-Felder des Faehigkeitsdatensatzes
  // nennen die zaehlende. Ohne diese Regel entschiede die Reihenfolge im
  // Katalogtext, und die Oberflaeche laese die 50 als Stueckzahl.
  const POINTS_ID = 'cost-points';
  const DICE_ID = 'cost-dice';
  const ITEM_DEF_ID = 'entry-magic-items';
  const COUNT_MAX = 1;
  const POINTS_MAX = 50;
  const DICE_MAX = 2;

  /** `constraintsXml` ist die Reihenfolge der Grenzen im Katalogtext. */
  function catalogueWith(constraintsXml) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-cap-mixed-max" name="Capability Mixed MAX Catalogue">
        <costTypes>
          <costType id="${POINTS_ID}" name="pts" defaultCostLimit="-1"/>
          <costType id="${DICE_ID}" name="Casting Dice" defaultCostLimit="-1"/>
        </costTypes>
        <selectionEntries>
          <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
            <selectionEntries>
              <selectionEntry id="${ITEM_DEF_ID}" name="Magic Items" type="upgrade">
                <constraints>${constraintsXml}</constraints>
              </selectionEntry>
            </selectionEntries>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  const COUNT_LIMIT = `<constraint id="max-items" type="max" value="${COUNT_MAX}" field="selections" scope="parent"/>`;
  const POINTS_LIMIT = `<constraint id="max-points" type="max" value="${POINTS_MAX}" field="${POINTS_ID}" scope="parent"/>`;
  const DICE_LIMIT = `<constraint id="max-dice" type="max" value="${DICE_MAX}" field="${DICE_ID}" scope="parent"/>`;

  /** Der Slot des Magiegegenstands-Blocks — noch nicht gewaehlt, also ein Anker. */
  function itemSlot(constraintsXml) {
    const report = evaluate(catalogueWith(constraintsXml), rosterOf(WARRIOR_DEF_ID, 1));
    return slotByDefId(report, ITEM_DEF_ID, { phantom: true }).capability;
  }

  it.each([
    ['zaehlende Grenze zuerst', COUNT_LIMIT + POINTS_LIMIT],
    ['kostenmessende Grenze zuerst', POINTS_LIMIT + COUNT_LIMIT],
  ])('nennt in effectiveMax die Stueckzahl-Grenze, nicht das Punktebudget (%s)', (_name, constraintsXml) => {
    expect(itemSlot(constraintsXml)).toMatchObject({
      effectiveMax: COUNT_MAX,
      current: 0,
      headroom: COUNT_MAX,
    });
  });

  it('fuehrt das Punktebudget daneben als eigene kostenbezogene Grenze', () => {
    expect(itemSlot(COUNT_LIMIT + POINTS_LIMIT).costLimits).toEqual([{
      limitId: 'max-points',
      costTypeId: POINTS_ID,
      measure: LimitMeasure.COST_SUM,
      kind: ConstraintKind.MAX,
      bound: POINTS_MAX,
      current: 0,
      headroom: POINTS_MAX,
      satisfied: true,
    }]);
  });

  it('haelt zwei Kostenarten nebeneinander — keine verdraengt die andere', () => {
    const costLimits = itemSlot(POINTS_LIMIT + DICE_LIMIT).costLimits;

    expect(costLimits.map(limit => [limit.costTypeId, limit.bound]))
      .toEqual([[POINTS_ID, POINTS_MAX], [DICE_ID, DICE_MAX]]);
  });

  it('laesst die Stueckzahl-Felder leer, wenn der Slot nur kostenbezogene Grenzen traegt', () => {
    expect(itemSlot(POINTS_LIMIT)).toMatchObject({ effectiveMin: null, effectiveMax: null, headroom: null });
  });
});

describe('Bericht: ein belegter Slot behaelt seinen Stand, wenn sein einziges Max per set -1 zu unbegrenzt wird', () => {
  // Issue 0147, Kriterium 1: die Unit-Analogie der Rosters 01/03 des Szenarios
  // `greater-than-force-unlimited-gate` — derselbe Rohwert-Max mit demselben
  // bedingten `set -1`, hier isoliert an einem Minimal-Katalog.
  const ARCHER_DEF_ID = 'entry-archer';
  const LIMIT_ID = 'max-warriors';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-unlimited-gate" name="Capability Unlimited Gate Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit">
          <constraints>
            <constraint id="${LIMIT_ID}" type="max" value="1" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="${LIMIT_ID}" value="-1">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${ARCHER_DEF_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${ARCHER_DEF_ID}" name="Archer" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  /** Ein Roster aus Kriegern und optional einem Schuetzen (dem Bedingungs-Ausloeser). */
  function warriorsAndMaybeArcher(warriorCount, { withArcher }) {
    const forces = [{ defId: WARRIOR_DEF_ID, count: warriorCount, children: [] }];
    if (withArcher) forces.push({ defId: ARCHER_DEF_ID, count: 1, children: [] });
    return { forces };
  }

  it('haelt den Stand eines belegten Slots, nachdem set -1 sein einziges Max zu unbegrenzt gehoben hat', () => {
    const report = evaluate(CATALOGUE_XML, warriorsAndMaybeArcher(2, { withArcher: true }));

    const { capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability).toMatchObject({
      current: 2,
      effectiveMax: null,
      headroom: null,
      isBlocked: false,
      isMandatoryUnmet: false,
      anchorKind: AnchorKind.OCCUPIED,
    });
  });

  it('KONTROLLE: bei geschlossenem Tor liefert das Grenzergebnis den Stand weiterhin (Analogie Roster 01)', () => {
    const report = evaluate(CATALOGUE_XML, warriorsAndMaybeArcher(2, { withArcher: false }));

    const { capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability).toMatchObject({
      current: 2,
      effectiveMax: 1,
      isBlocked: true,
    });
  });
});

describe('Bericht: der Stand eines Slots ohne jede Grenze', () => {
  const FORCE_ID = 'force-no-limit-army';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-no-limit" name="Capability No Limit Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="${WARRIOR_NAME}" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('meldet an einem belegten Slot ohne jede Grenze trotzdem seinen Stand', () => {
    const report = evaluate(CATALOGUE_XML, rosterOf(WARRIOR_DEF_ID, 3));

    const { capability } = slotByDefId(report, WARRIOR_DEF_ID);
    expect(capability.current).toBe(3);
  });

  it('GEGENPROBE: jede Instanz meldet ihren eigenen Stand, nicht die Summe des Rahmens', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [
        { defId: WARRIOR_DEF_ID, count: 1, children: [] },
        { defId: WARRIOR_DEF_ID, count: 2, children: [] },
      ],
    });

    // Absichtlich nicht ueber slotByDefId (liefert nur den ersten Treffer):
    // hier zaehlt das Multiset der Staende beider belegten Slots.
    const occupiedCounts = [...report.capabilities.values()]
      .filter(capability => capability.defId === WARRIOR_DEF_ID && capability.anchorKind === AnchorKind.OCCUPIED)
      .map(capability => capability.current)
      .sort();
    expect(occupiedCounts).toEqual([1, 2]);
  });

  it('KONTROLLE: der Angebots-Anker einer nicht gewaehlten Instanz meldet Stand 0', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });

    const offer = slotByDefId(report, WARRIOR_DEF_ID, { phantom: true });
    expect(offer).not.toBeNull();
    expect(offer.capability.current).toBe(0);
  });
});

describe('Bericht: Faehigkeitsdatensatz eines Kontingent-Slots ohne jede Grenze', () => {
  const FORCE_ID = 'force-plain-army';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cap-force-slot" name="Capability Force Slot Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
    </catalogue>`;

  it('meldet an seinem Kontingent-Slot dessen Stand, obwohl das Kontingent keine eigene Grenze traegt', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });

    const { capability } = slotByDefId(report, FORCE_ID);
    expect(capability.current).toBe(1);
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

describe('Bericht: der Kategorie-Anker zaehlt die Mitgliedschaft, die ein set-primary gewaehrt hat', () => {
  // Eigene, minimale Fixtur statt der des vorigen Blocks (die traegt schon vier
  // Faelle und soll keinen fuenften Sinn dazubekommen): ein Kontingent mit zwei
  // Kategorien — eine ohne jede Grenze (der Fall unter Test) und eine mit einer
  // MAX-Grenze (der Vorrang-Fall) — und Eintraege, die die Mitgliedschaft je Fall
  // unterschiedlich herstellen: per categoryLink, per set-primary, per beidem,
  // gar nicht, oder ueber ein Kind (verschachtelte Auswahl).
  const FORCE_ID = 'force-set-primary-count';
  const UNBOUNDED_CATEGORY_ID = 'cat-unbounded';
  const BOUNDED_CATEGORY_ID = 'cat-bounded';
  const MAX_BOUNDED = 3;

  const UNBOUNDED_MEMBER_ID = 'entry-unbounded-member';
  const SET_PRIMARY_ONLY_ID = 'entry-set-primary-only';
  const SET_PRIMARY_PLUS_BOUNDED_ID = 'entry-set-primary-plus-bounded';
  const OUTSIDER_ID = 'entry-outsider';
  const BOUNDED_MEMBER_ID = 'entry-bounded-member';
  const NESTED_PARENT_ID = 'entry-nested-parent';
  const NESTED_CHILD_ID = 'entry-nested-child';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-set-primary-anchor-count" name="Set Primary Anchor Count Catalogue">
      <categoryEntries>
        <categoryEntry id="${UNBOUNDED_CATEGORY_ID}" name="Unbounded"/>
        <categoryEntry id="${BOUNDED_CATEGORY_ID}" name="Bounded"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army">
          <categoryLinks>
            <categoryLink id="link-unbounded" name="Unbounded" targetId="${UNBOUNDED_CATEGORY_ID}"/>
            <categoryLink id="link-bounded" name="Bounded" targetId="${BOUNDED_CATEGORY_ID}">
              <constraints>
                <constraint id="max-bounded" type="max" value="${MAX_BOUNDED}" field="selections" scope="force"/>
              </constraints>
            </categoryLink>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNBOUNDED_MEMBER_ID}" name="Unbounded Member" type="unit">
          <categoryLinks>
            <categoryLink id="clink-unbounded-member" targetId="${UNBOUNDED_CATEGORY_ID}"/>
          </categoryLinks>
        </selectionEntry>
        <selectionEntry id="${SET_PRIMARY_ONLY_ID}" name="Set Primary Only" type="unit">
          <modifiers>
            <modifier type="set-primary" field="category" value="${UNBOUNDED_CATEGORY_ID}"/>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${SET_PRIMARY_PLUS_BOUNDED_ID}" name="Set Primary Plus Bounded" type="unit">
          <categoryLinks>
            <categoryLink id="clink-set-primary-plus-bounded" targetId="${BOUNDED_CATEGORY_ID}"/>
          </categoryLinks>
          <modifiers>
            <modifier type="set-primary" field="category" value="${UNBOUNDED_CATEGORY_ID}"/>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${OUTSIDER_ID}" name="Outsider" type="unit"/>
        <selectionEntry id="${BOUNDED_MEMBER_ID}" name="Bounded Member" type="unit">
          <categoryLinks>
            <categoryLink id="clink-bounded-member" targetId="${BOUNDED_CATEGORY_ID}"/>
          </categoryLinks>
        </selectionEntry>
        <selectionEntry id="${NESTED_PARENT_ID}" name="Nested Parent" type="unit">
          <selectionEntries>
            <selectionEntry id="${NESTED_CHILD_ID}" name="Nested Child" type="upgrade">
              <categoryLinks>
                <categoryLink id="clink-nested-child" targetId="${UNBOUNDED_CATEGORY_ID}"/>
              </categoryLinks>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  /** Ein Kontingent mit den uebergebenen Auswahl-Instanzen (wie im Kategorie-Knoten-Block). */
  function army(selections) {
    return { forces: [{ defId: FORCE_ID, count: 1, children: selections }] };
  }

  /** Der Faehigkeitsdatensatz des Kategorie-Ankers dieser Kategorie — allein aus dem Bericht. */
  function categorySlot(report, categoryId) {
    return [...report.capabilities.values()].find(
      capability => capability.anchorKind === AnchorKind.CATEGORY_ANCHOR && capability.targetDefId === categoryId,
    );
  }

  it('zaehlt an einem grenzenlosen Kategorie-Anker seine per categoryLink verbundenen Mitglieder', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: UNBOUNDED_MEMBER_ID, count: 2, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    expect(categorySlot(report, UNBOUNDED_CATEGORY_ID)).toMatchObject({
      current: 2,
      effectiveMin: null,
      effectiveMax: null,
      headroom: null,
    });
  });

  it('set-primary allein laesst den Eintrag am Anker der Zielkategorie zaehlen, ohne dass ein categoryLink dorthin besteht', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: SET_PRIMARY_ONLY_ID, count: 1, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    expect(categorySlot(report, UNBOUNDED_CATEGORY_ID)).toMatchObject({ current: 1 });
  });

  it('set-primary entfernt keine bestehende Mitgliedschaft — der Eintrag zaehlt an BEIDEN Ankern', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: SET_PRIMARY_PLUS_BOUNDED_ID, count: 1, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    // Die Mitgliedschaft ist gewachsen (set-primary zusaetzlich zum categoryLink),
    // nicht gewandert: der Eintrag zaehlt weiterhin an der grenzenbehafteten
    // Kategorie UND neu an der grenzenlosen.
    expect(categorySlot(report, BOUNDED_CATEGORY_ID)).toMatchObject({ current: 1 });
    expect(categorySlot(report, UNBOUNDED_CATEGORY_ID)).toMatchObject({ current: 1 });
  });

  it('GEGENPROBE: ein Eintrag ohne categoryLink und ohne set-primary zaehlt am Anker nicht mit', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: OUTSIDER_ID, count: 1, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    expect(categorySlot(report, UNBOUNDED_CATEGORY_ID)).toMatchObject({ current: 0 });
  });

  it('haelt an einem grenzenbehafteten Anker den Stand aus dem Grenzergebnis, unveraendert vom Vorrang', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: BOUNDED_MEMBER_ID, count: 2, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    expect(categorySlot(report, BOUNDED_CATEGORY_ID)).toMatchObject({
      current: 2,
      effectiveMax: MAX_BOUNDED,
      headroom: MAX_BOUNDED - 2,
    });
  });

  it('zaehlt ein Mitglied auch dann, wenn der categoryLink an einer verschachtelten Kind-Auswahl haengt', () => {
    const report = evaluate(
      CATALOGUE_XML,
      army([{ defId: NESTED_PARENT_ID, count: 1, children: [{ defId: NESTED_CHILD_ID, count: 1, children: [] }] }]),
    );

    expect(report.diagnostics).toEqual([]);
    expect(categorySlot(report, UNBOUNDED_CATEGORY_ID)).toMatchObject({ current: 1 });
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
