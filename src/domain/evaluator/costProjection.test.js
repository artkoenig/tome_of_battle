/**
 * Kostenprojektion im Bericht (Issue 0121, Task 1) — Black-box-Tests aus der
 * Intention, VOR der Implementierung geschrieben.
 *
 * Gepruefte Intention:
 *  1. `evaluate(...)` liefert zusaetzlich `costTotals: Record<costTypeId, number>` —
 *     die roster-weite Kostensumme je Kostenart ueber alle Kontingente und
 *     Selektionen: Kosten je Instanz × Anzahl, verschachtelte Selektionen
 *     eingerechnet, Kosten-Modifikatoren des Katalogs angewandt.
 *     Die Anzahl einer Selektion ist im Roster-Vertrag der Fassade eine
 *     **absolute** Gesamtstueckzahl (docs/battlescribe-data-format.md §7.5,
 *     Kasten „Zahlenbasis") — die Summe ist also Σ ueber alle Knoten von
 *     (Eigenkosten je Instanz × Anzahl des Knotens), ohne Durchmultiplizieren
 *     der Elternkette.
 *  2. Jede `SlotCapability` belegter Slots traegt `costs: Record<costTypeId,
 *     number>` — die Eigenkosten EINER Instanz (nach Modifikatoren, ohne Kinder).
 *  3. Jede `SlotCapability` traegt `totalCosts: Record<costTypeId, number>` —
 *     Eigenkosten × aktueller Anzahl plus die totalCosts aller Kind-Slots.
 *  4. Auch `offerAnchor`-Slots tragen `costs` — was EINE Instanz beim Waehlen
 *     kosten wuerde.
 *
 * VERTRAGSENTSCHEIDUNG (bsdata-Doku entscheidet es nicht — sie beschreibt den
 * Bericht gar nicht): eine im Datensatz **deklarierte** Kostenart ohne Vorkommen
 * erscheint in `costTotals` mit dem Wert **0**, statt zu fehlen. Begruendung:
 * Battlescribe zeigt jede Kostenart des Spielsystems mit „0" an, und
 * `describeDataset` fuehrt die deklarierten Kostenarten bereits vollstaendig —
 * eine Summe je deklarierter Kostenart ist die dazu passende Projektion. Die
 * Tests, die diese Entscheidung tragen, sind im Namen markiert.
 *
 * Erwartete Zahlen sind aus den synthetischen Katalogen unten abgeleitet
 * (Doku §7.5 Kosten, §9.3 „Kosten am Link statt an der Definition", §7.7
 * Kosten-Modifikatoren) — NICHT aus dem Engine-Quelltext.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (Konvention aller
// Evaluator-Tests; der XML-Leser der Engine nutzt genau dieses Primitiv).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus
 * (Konvention wie `evaluator.rosterContract.test.js`).
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Der (einzige) Slot des Berichts mit dieser Definitions-Id. */
function slotByDefId(report, defId) {
  return [...report.capabilities.values()].find(capability => capability.defId === defId);
}

/** Der Angebots-Anker-Slot des Berichts mit dieser Definitions-Id. */
function offerAnchorByDefId(report, defId) {
  return [...report.capabilities.values()].find(
    capability => capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR,
  );
}

// ── Fixture A: verschachtelte Selektionen, count > 1 auf mehreren Ebenen ─────
//
// Regiment (pts 100) → Soldier (pts 8) → Spear (pts 2); daneben Banner ohne
// jede Kostenangabe. Zwei deklarierte Kostenarten: „pts" (belegt) und „gold"
// (nirgends belegt — der Fall der Vertragsentscheidung).

const FORCE_ID = 'force-army';
const POINTS_ID = 'cost-points';
const GOLD_ID = 'cost-gold';
const REGIMENT_ID = 'entry-regiment';
const SOLDIER_ID = 'entry-soldier';
const SPEAR_ID = 'entry-spear';
const BANNER_ID = 'entry-banner';

const REGIMENT_POINTS = 100;
const SOLDIER_POINTS = 8;
const SPEAR_POINTS = 2;

const NESTED_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-cost-projection" name="Cost Projection Catalogue">
    <costTypes>
      <costType id="${POINTS_ID}" name="pts"/>
      <costType id="${GOLD_ID}" name="gold"/>
    </costTypes>
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Army"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
        <costs>
          <cost name="pts" typeId="${POINTS_ID}" value="${REGIMENT_POINTS}"/>
        </costs>
        <selectionEntries>
          <selectionEntry id="${SOLDIER_ID}" name="Soldier" type="model">
            <costs>
              <cost name="pts" typeId="${POINTS_ID}" value="${SOLDIER_POINTS}"/>
            </costs>
            <selectionEntries>
              <selectionEntry id="${SPEAR_ID}" name="Spear" type="upgrade">
                <costs>
                  <cost name="pts" typeId="${POINTS_ID}" value="${SPEAR_POINTS}"/>
                </costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntry>
          <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade"/>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Ein Kontingent des Fixture-A-Katalogs mit den gegebenen Kind-Auswahlen. */
function armyWith(children) {
  return { forces: [{ defId: FORCE_ID, count: 1, children }] };
}

// Regiment ×2, darunter Soldier ×10 mit Spear ×10 und Banner ×1 — Anzahlen sind
// absolute Gesamtstueckzahlen (Roster-Vertrag der Fassade, Doku §7.5):
// pts = 2×100 + 10×8 + 10×2 + 0 = 300.
const NESTED_ROSTER = armyWith([
  {
    defId: REGIMENT_ID,
    count: 2,
    children: [
      {
        defId: SOLDIER_ID,
        count: 10,
        children: [{ defId: SPEAR_ID, count: 10, children: [] }],
      },
      { defId: BANNER_ID, count: 1, children: [] },
    ],
  },
]);

const NESTED_POINTS_TOTAL =
  2 * REGIMENT_POINTS + 10 * SOLDIER_POINTS + 10 * SPEAR_POINTS; // 300

// ── Fixture B: ein Kosten-Modifikator des Katalogs ───────────────────────────
//
// Knight kostet 50 pts, +25 sobald mindestens ein Archer (10 pts) im Roster
// steht (Muster wie `compare.instanceOf.test.js`, Doku §7.7: modifier mit
// `field=<costTypeId>`).

const KNIGHT_ID = 'entry-knight';
const ARCHER_ID = 'entry-archer';
const KNIGHT_BASE_POINTS = 50;
const KNIGHT_SURCHARGE = 25;
const ARCHER_POINTS = 10;

const MODIFIER_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-cost-modifier" name="Cost Modifier Catalogue">
    <costTypes>
      <costType id="${POINTS_ID}" name="pts"/>
    </costTypes>
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Army"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${KNIGHT_ID}" name="Knight" type="unit">
        <costs>
          <cost name="pts" typeId="${POINTS_ID}" value="${KNIGHT_BASE_POINTS}"/>
        </costs>
        <modifiers>
          <modifier type="increment" field="${POINTS_ID}" value="${KNIGHT_SURCHARGE}">
            <conditions>
              <condition type="greaterThan" value="0" field="selections" scope="roster" childId="${ARCHER_ID}"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
      <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit">
        <costs>
          <cost name="pts" typeId="${POINTS_ID}" value="${ARCHER_POINTS}"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

// ── Fixture C: Kosten am Verweis, nicht an der Definition (Doku §9.3) ────────
//
// Das geteilte Schwert traegt selbst KEINE Kosten; der `entryLink` darauf
// kostet 6 pts — das reale Muster „Kosten liegen am Link".

const SWORD_LINK_ID = 'link-sword';
const SHARED_SWORD_ID = 'shared-sword';
const SWORD_LINK_POINTS = 6;

const LINK_COST_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-link-cost" name="Link Cost Catalogue">
    <costTypes>
      <costType id="${POINTS_ID}" name="pts"/>
    </costTypes>
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Army"/>
    </forceEntries>
    <entryLinks>
      <entryLink id="${SWORD_LINK_ID}" name="Sword" targetId="${SHARED_SWORD_ID}" type="selectionEntry">
        <costs>
          <cost name="pts" typeId="${POINTS_ID}" value="${SWORD_LINK_POINTS}"/>
        </costs>
      </entryLink>
    </entryLinks>
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_SWORD_ID}" name="Sword" type="upgrade"/>
    </sharedSelectionEntries>
  </catalogue>`;

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 1: `costTotals` — die roster-weite Kostensumme je Kostenart.
// ─────────────────────────────────────────────────────────────────────────────

describe('costTotals: roster-weite Kostensumme je Kostenart', () => {
  it('summiert Kosten je Instanz × Anzahl ueber verschachtelte Selektionen mit count > 1 auf mehreren Ebenen', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, NESTED_ROSTER);

    expect(report.costTotals?.[POINTS_ID]).toBe(NESTED_POINTS_TOTAL);
  });

  it('summiert ueber alle Kontingente des Rosters hinweg', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, {
      forces: [
        { defId: FORCE_ID, count: 1, children: [{ defId: REGIMENT_ID, count: 1, children: [] }] },
        { defId: FORCE_ID, count: 1, children: [{ defId: REGIMENT_ID, count: 2, children: [] }] },
      ],
    });

    expect(report.costTotals?.[POINTS_ID]).toBe(3 * REGIMENT_POINTS);
  });

  it('wendet einen Kosten-Modifikator des Katalogs auf die Summe an', () => {
    const report = evaluate(
      MODIFIER_CATALOGUE_XML,
      armyWith([
        { defId: KNIGHT_ID, count: 1, children: [] },
        { defId: ARCHER_ID, count: 1, children: [] },
      ]),
    );

    expect(report.costTotals?.[POINTS_ID]).toBe(
      KNIGHT_BASE_POINTS + KNIGHT_SURCHARGE + ARCHER_POINTS,
    );
  });

  it('Vertragsentscheidung: eine deklarierte Kostenart ohne Vorkommen erscheint mit 0 statt zu fehlen', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, NESTED_ROSTER);

    // „gold" ist deklariert, aber an keinem Eintrag belegt.
    expect(report.costTotals?.[GOLD_ID]).toBe(0);
  });

  it('Vertragsentscheidung: leeres Roster (nur Kontingent) → alle deklarierten Kostenarten mit Summe 0, keine weiteren Schluessel', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, armyWith([]));

    expect(report.costTotals).toEqual({ [POINTS_ID]: 0, [GOLD_ID]: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 2: `SlotCapability.costs` — Eigenkosten EINER Instanz.
// ─────────────────────────────────────────────────────────────────────────────

describe('SlotCapability.costs: Eigenkosten EINER Instanz (nach Modifikatoren, ohne Kinder)', () => {
  it('traegt je Slot die Eigenkosten einer Instanz — unabhaengig von der Anzahl und ohne die Kinder', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, NESTED_ROSTER);

    const regiment = slotByDefId(report, REGIMENT_ID);
    const soldier = slotByDefId(report, SOLDIER_ID);
    expect(regiment).toBeDefined();
    expect(soldier).toBeDefined();

    // Regiment ×2 und Soldier ×10: costs bleibt der Wert EINER Instanz,
    // die Kinderkosten (Spear/Banner) gehen nicht ein.
    expect(regiment.costs?.[POINTS_ID]).toBe(REGIMENT_POINTS);
    expect(soldier.costs?.[POINTS_ID]).toBe(SOLDIER_POINTS);
  });

  it('traegt nach einem Kosten-Modifikator den effektiven Wert einer Instanz', () => {
    const report = evaluate(
      MODIFIER_CATALOGUE_XML,
      armyWith([
        { defId: KNIGHT_ID, count: 1, children: [] },
        { defId: ARCHER_ID, count: 1, children: [] },
      ]),
    );

    const knight = slotByDefId(report, KNIGHT_ID);
    expect(knight).toBeDefined();
    expect(knight.costs?.[POINTS_ID]).toBe(KNIGHT_BASE_POINTS + KNIGHT_SURCHARGE);
  });

  it('ein Eintrag ohne jede Kostenangabe traegt costs ohne Punkte-Beitrag', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, NESTED_ROSTER);

    const banner = slotByDefId(report, BANNER_ID);
    expect(banner).toBeDefined();

    // `costs` muss vorhanden sein (jede SlotCapability traegt das Feld);
    // ob die pts-Kostenart darin mit 0 steht oder fehlt, laesst dieser Test
    // bewusst offen — der Beitrag muss in beiden Lesarten 0 sein.
    expect(banner.costs).toBeDefined();
    expect(banner.costs?.[POINTS_ID] ?? 0).toBe(0);
  });

  it('eine ueber einen entryLink gesetzte Auswahl traegt die Kosten des Verweises (Doku §9.3)', () => {
    const report = evaluate(
      LINK_COST_CATALOGUE_XML,
      armyWith([{ defId: SWORD_LINK_ID, count: 2, children: [] }]),
    );

    const sword = slotByDefId(report, SWORD_LINK_ID);
    expect(sword).toBeDefined();
    expect(sword.costs?.[POINTS_ID]).toBe(SWORD_LINK_POINTS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 3: `SlotCapability.totalCosts` — Eigenkosten × Anzahl + Kinder.
// ─────────────────────────────────────────────────────────────────────────────

describe('SlotCapability.totalCosts: Gesamtkosten des Slots im aktuellen Zustand', () => {
  it('Blatt-Slot: Eigenkosten × aktueller Anzahl', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, NESTED_ROSTER);

    const spear = slotByDefId(report, SPEAR_ID);
    expect(spear).toBeDefined();
    expect(spear.totalCosts?.[POINTS_ID]).toBe(10 * SPEAR_POINTS);
  });

  it('verschachtelter Slot: Eigenkosten × Anzahl plus die totalCosts aller Kind-Slots', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, NESTED_ROSTER);

    const soldier = slotByDefId(report, SOLDIER_ID);
    const regiment = slotByDefId(report, REGIMENT_ID);
    expect(soldier).toBeDefined();
    expect(regiment).toBeDefined();

    // Soldier: 10×8 + Spear (10×2) = 100.
    expect(soldier.totalCosts?.[POINTS_ID]).toBe(10 * SOLDIER_POINTS + 10 * SPEAR_POINTS);
    // Regiment: 2×100 + Soldier-Zweig (100) + Banner (0) = 300.
    expect(regiment.totalCosts?.[POINTS_ID]).toBe(NESTED_POINTS_TOTAL);
  });

  it('ein Slot ohne Kostenangabe und ohne Kinderkosten traegt totalCosts ohne Punkte-Beitrag', () => {
    const report = evaluate(NESTED_CATALOGUE_XML, NESTED_ROSTER);

    const banner = slotByDefId(report, BANNER_ID);
    expect(banner).toBeDefined();
    expect(banner.totalCosts).toBeDefined();
    expect(banner.totalCosts?.[POINTS_ID] ?? 0).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 4: auch Angebots-Anker tragen `costs`.
// ─────────────────────────────────────────────────────────────────────────────

describe('offerAnchor-Slots: die Kosten, die EINE Instanz beim Waehlen kosten wuerde', () => {
  it('ein Angebots-Anker einer nicht gewaehlten Definition traegt deren Eigenkosten', () => {
    // Leeres Roster (nur das Kontingent): das Regiment ist waehlbar, nicht gewaehlt.
    const report = evaluate(NESTED_CATALOGUE_XML, armyWith([]));

    const anchor = offerAnchorByDefId(report, REGIMENT_ID);
    expect(anchor).toBeDefined();
    expect(anchor.costs?.[POINTS_ID]).toBe(REGIMENT_POINTS);
  });

  it('ein am Verweis angebotener Eintrag traegt die Kosten des Links, nicht des Ziels', () => {
    const report = evaluate(LINK_COST_CATALOGUE_XML, armyWith([]));

    const anchor = offerAnchorByDefId(report, SWORD_LINK_ID);
    expect(anchor).toBeDefined();
    expect(anchor.costs?.[POINTS_ID]).toBe(SWORD_LINK_POINTS);
  });

  it('ein Angebots-Anker traegt die MODIFIZIERTEN Wahl-Kosten und zaehlt nicht in costTotals', () => {
    // Nur der Archer ist gewaehlt; der Knight ist Angebot. Sein Modifikator
    // (+25 bei ≥1 Archer) feuert — waehlen wuerde 75 kosten. In die Summe geht
    // nur der Archer ein.
    const report = evaluate(
      MODIFIER_CATALOGUE_XML,
      armyWith([{ defId: ARCHER_ID, count: 1, children: [] }]),
    );

    const anchor = offerAnchorByDefId(report, KNIGHT_ID);
    expect(anchor).toBeDefined();
    expect(anchor.costs?.[POINTS_ID]).toBe(KNIGHT_BASE_POINTS + KNIGHT_SURCHARGE);
    expect(report.costTotals?.[POINTS_ID]).toBe(ARCHER_POINTS);
  });
});
