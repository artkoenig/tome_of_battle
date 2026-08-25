import { JSDOM } from 'jsdom';
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { AnchorKind, DiagnosticKind } from '../../../../contexts/ruleengine/engine/model.js';
import { rosterFromRos } from '../../../test-utils/rosParser.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus
 * (Konvention wie `phantom.test.js`): erst aufbereiten, dann auswerten.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue 084: Der Roster-Vertrag der Fassade — GRUENE PINS gegen Rueckfall.
//
// Seit Issue 076 muss jeder `evaluate`-Aufrufer eine ueber einen `<entryLink>`
// gesetzte Auswahl unter der **Link-Id** uebergeben, nicht unter der Id ihres
// Ziels. Nur dann gelten die am Link deklarierten Grenzen, und der Slot des
// Links faellt mit dem belegten Slot zusammen (statt dass ein Pflicht-Phantom
// daneben steht). Diese Tests pinnen genau dieses bestehende Verhalten:
// sie sind heute gruen und werden rot, wenn der Adapter oder die Bindung auf
// die Ziel-Id (`entryId`) zurueckfaellt — oder wenn eine nicht aufloesbare
// Link-Id still durchgereicht statt laut diagnostiziert wird (F3).
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_ID = 'force-main';
const LINK_ID = 'link-hand-weapon';
const TARGET_ID = 'shared-hand-weapon';
const WARRIOR_ID = 'entry-warrior';
const LINK_MIN_LIMIT_ID = 'min-hand-weapon-am-link';
const LINK_MAX_LIMIT_ID = 'max-hand-weapon-am-link';

// Ein Katalog nach dem Muster des F2-Falls aus Issue 076: ein geteilter Eintrag
// ("Hand Weapon") ohne eigene Grenzen, erreichbar allein ueber einen
// `<entryLink>`, der seine Grenzen (min 1 / max 1 je Kontingent) SELBST traegt.
const CONTRACT_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-roster-contract" name="Roster Contract Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <entryLinks>
      <entryLink id="${LINK_ID}" name="Hand Weapon" targetId="${TARGET_ID}" type="selectionEntry">
        <constraints>
          <constraint id="${LINK_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="force"/>
          <constraint id="${LINK_MAX_LIMIT_ID}" type="max" value="1" field="selections" scope="force"/>
        </constraints>
      </entryLink>
    </entryLinks>
    <sharedSelectionEntries>
      <selectionEntry id="${TARGET_ID}" name="Hand Weapon" type="upgrade"/>
    </sharedSelectionEntries>
  </catalogue>`;

/** Alle Slots des Berichts, deren `defId` eine der gegebenen Ids ist. */
function slotsOf(report, ...defIds) {
  return [...report.capabilities.values()].filter(capability => defIds.includes(capability.defId));
}

/** Alle Pflicht-Phantom-Slots des Berichts. */
function mandatoryPhantomsOf(report) {
  return [...report.capabilities.values()].filter(
    capability => capability.anchorKind === AnchorKind.MANDATORY_PHANTOM,
  );
}

/** Ein Kontingent des Vertrags-Katalogs mit den gegebenen Kind-Auswahlen. */
function mainForce(children) {
  return { forces: [{ defId: FORCE_ID, count: 1, children }] };
}

describe('Roster-Vertrag F2: Slot-Verschmelzung — eine per Link gesetzte Auswahl belegt den Link-Slot', () => {
  // GRUENER PIN. Er wird rot, wenn die Engine-Bindung eine unter der Link-Id
  // uebergebene Auswahl nicht mehr auf die Link-Definition bindet — dann steht
  // ein Pflicht-Phantom fuer den Link NEBEN einem belegten Ziel-Slot, statt dass
  // beide in EINEM belegten Slot unter der Link-Id zusammenfallen.
  it('liefert genau EINEN Slot: belegt, defId = Link-Id, targetDefId = Ziel-Id — kein Phantom daneben', () => {
    const report = evaluate(
      CONTRACT_CATALOGUE_XML,
      mainForce([{ defId: LINK_ID, count: 1, children: [] }]),
    );

    // Genau ein Slot fuer die Entitaet (Link ODER Ziel) — die Verschmelzung.
    const slots = slotsOf(report, LINK_ID, TARGET_ID);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      defId: LINK_ID,
      targetDefId: TARGET_ID,
      anchorKind: AnchorKind.OCCUPIED,
    });

    // Kein Pflicht-Phantom irgendwo im Bericht: die min-1-Grenze des Links ist
    // durch die belegte Auswahl selbst erfuellt.
    expect(mandatoryPhantomsOf(report)).toEqual([]);
    expect(report.violations).toEqual([]);
  });

  // GRUENER PIN auf die ADAPTER-Naht (Fixture-Parser + Engine gemeinsam). Er
  // wird rot, wenn `rosterFromRos` (`defIdOf`) eine `<selection>` mit BEIDEN
  // Attributen wieder unter `entryId` statt `entryLinkId` bindet — genau der
  // Rueckfall, den Issue 076/F2 gezeigt hat. Heute waere die Suite bei diesem
  // Rueckfall gruen geblieben; dieser Test pinnt ihn durchgaengig (.ros → Bericht).
  describe('durchgaengig ab .ros-Datei (Adapter-Naht)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'evaluator-roster-contract-'));
    const rosPath = join(dir, 'contract.ros');
    // Die Auswahl traegt BEIDE Ids — massgeblich ist der Verweis (entryLinkId).
    writeFileSync(
      rosPath,
      `<?xml version="1.0" encoding="utf-8"?>
      <roster name="Contract Roster">
        <forces>
          <force entryId="${FORCE_ID}" name="Main Force">
            <selections>
              <selection entryId="${TARGET_ID}" entryLinkId="${LINK_ID}" name="Hand Weapon" number="1"/>
            </selections>
          </force>
        </forces>
      </roster>`,
      'utf8',
    );

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('bindet die .ros-Auswahl unter der Link-Id: ein belegter Link-Slot, kein Phantom, keine Verletzung', () => {
      const report = evaluate(CONTRACT_CATALOGUE_XML, rosterFromRos(rosPath));

      const slots = slotsOf(report, LINK_ID, TARGET_ID);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toMatchObject({
        defId: LINK_ID,
        targetDefId: TARGET_ID,
        anchorKind: AnchorKind.OCCUPIED,
      });
      expect(mandatoryPhantomsOf(report)).toEqual([]);
      expect(report.violations).toEqual([]);
    });
  });
});

describe('Roster-Vertrag F2 (Schaerfung): die AM Link deklarierten Grenzen gelten fuer die Link-Auswahl', () => {
  // GRUENER PIN. Er wird rot, wenn die Bindung auf die Ziel-Id zurueckfaellt:
  // unter der Ziel-Id zaehlt die Auswahl nicht gegen die max-Grenze des Links —
  // die Verletzung mit der Limit-Id des Links bliebe aus.
  it('meldet bei count=2 unter der Link-Id genau eine MAX-Verletzung mit der Limit-Id des Links', () => {
    const report = evaluate(
      CONTRACT_CATALOGUE_XML,
      mainForce([{ defId: LINK_ID, count: 2, children: [] }]),
    );

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      limitId: LINK_MAX_LIMIT_ID,
      actual: 2,
      bound: 1,
      anchor: { defId: LINK_ID },
    });
  });
});

// ── F3: keine Rueckfall-Aufloesung fuer eine nicht aufloesbare (Link-)Id ─────

// Ein bewusst grenzenfreier Katalog, damit der F3-Fall keine Pflicht-Phantom-
// Verletzungen als Nebengeraeusch produziert.
const PLAIN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-plain" name="Plain Catalogue">
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit"/>
    </selectionEntries>
  </catalogue>`;

describe('Roster-Vertrag F3: eine in keinem geladenen Dokument definierte Id faellt LAUT aus', () => {
  const UNKNOWN_LINK_ID = 'link-aus-nicht-geladenem-katalog';

  // GRUENER PIN. Er wird rot, wenn die Engine fuer eine unbekannte (Link-)Id
  // eine stille Rueckfall-Aufloesung einfuehrt (etwa auf eine entryId) oder die
  // Auswahl kommentarlos verschluckt, statt sie als `unresolvedDefinition` zu
  // melden. Festgehaltene Entscheidung des Runs: fail-loud IST das gewollte
  // Verhalten — ein Roster, das einen Link aus einem nicht geladenen Katalog
  // benennt, war nie gueltig (docs §7.2/§15).
  it('meldet die unbekannte Id als unresolvedDefinition-Diagnose mit genau dieser defId', () => {
    const report = evaluate(PLAIN_CATALOGUE_XML, {
      forces: [{ defId: UNKNOWN_LINK_ID, count: 1, children: [] }],
    });

    // Der Wortlaut des Vertrags: {"kind":"unresolvedDefinition","defId":...}.
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedDefinition', defId: UNKNOWN_LINK_ID }),
    );
    // Dieselbe Konstante der Engine — Wortlaut und Modell duerfen nicht auseinanderlaufen.
    expect(DiagnosticKind.UNRESOLVED_DEFINITION).toBe('unresolvedDefinition');
  });

  it('erfindet fuer die unbekannte Id weder eine Verletzung noch einen Slot (kein stilles Durchreichen)', () => {
    const report = evaluate(PLAIN_CATALOGUE_XML, {
      forces: [{ defId: UNKNOWN_LINK_ID, count: 1, children: [] }],
    });

    expect(report.violations).toEqual([]);
    expect(slotsOf(report, UNKNOWN_LINK_ID)).toEqual([]);
  });
});

describe('Roster-Vertrag KONTROLLE: eine direkte (verweislose) Auswahl unter ihrer Eintrags-Id', () => {
  // GRUENER PIN. Er wird rot, wenn die Link-Id-Regel faelschlich auch direkte
  // Auswahlen trifft — eine ohne Verweis gesetzte Auswahl muss unveraendert
  // unter ihrer Eintrags-Id EINEN belegten Slot ergeben, ohne Diagnose.
  it('ergibt genau einen belegten Slot unter der Eintrags-Id — keine Diagnose, keine Verletzung', () => {
    const report = evaluate(PLAIN_CATALOGUE_XML, {
      forces: [{ defId: WARRIOR_ID, count: 1, children: [] }],
    });

    const slots = slotsOf(report, WARRIOR_ID);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ defId: WARRIOR_ID, anchorKind: AnchorKind.OCCUPIED });
    expect(report.diagnostics).toEqual([]);
    expect(report.violations).toEqual([]);
  });
});
