/**
 * Reale E2E-Szenarien der **Ogre-Kingdoms**-Armee (ADR-0032): das Roster wird
 * end-to-end gegen die echten Definitive-Edition-Daten ausgewertet — die `.gst`,
 * die Ogre-`.cat` **und** ihre gemeinsame `Mercenaries`-Abhaengigkeit. Geprueft
 * werden reale Domaenen-Regeln an bekannten, im Katalog verifizierten IDs und
 * Grenzwerten (siehe `__fixtures__/realCatalogs.js`):
 *
 * - die armeeweiten Pflichtregeln „General" (force-scope min 1) und „Core"
 *   (force-scope min 2), die im leeren Kontingent anschlagen und erfuellt sind,
 *   sobald die geforderten Einheiten vorhanden sind;
 * - der **bedingte** `set→1`-Modifikator auf der Core-Grenze, geschaltet ueber die
 *   selektionsbasierte „Border Patrols rules"-Bedingung;
 * - die **unbedingte** „Tyrant"-Obergrenze (roster-scope max 1);
 * - die **§7.7-Bezugsrahmen-Regel**: ein Kategorie-Ziel zaehlt armeeweit ueber
 *   alle Kontingente, auch unter `scope="force"` — belegt an einem
 *   Zwei-Kontingent-Roster (die General-/Core-Pflichtregel schlaegt an *jedem*
 *   leeren Kontingent an, ist aber erfuellt, sobald *irgendein* Kontingent die
 *   geforderten Selektionen traegt);
 * - eine Roster-Auswahl **ohne aufloesbare Definition** wird als Diagnose gemeldet
 *   (`UNRESOLVED_DEFINITION`), nicht als Absturz — der Bericht bleibt strukturell
 *   vollstaendig.
 *
 * Diese letzten beiden Bloecke sind die real-daten-getriebene Neuabbildung von
 * Szenarien der frueheren synthetischen Paritaetssuite (Issue 67, Scheibe 03):
 * die §7.7-„Kategorie zaehlt armeeweit"-Regel und „unaufloesbare Auswahl → Diagnose
 * statt Absturz" — jetzt an echten DE-Daten statt an Mini-Katalogen.
 *
 * Der Bericht ist die einzige Beobachtungsstelle jeder Assertion.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { DiagnosticKind } from './model.js';
import { selection, force, roster, violationsOf, violationOf, countDiagnostics } from './__fixtures__/e2eRoster.js';
import {
  ogreDataset,
  GENERAL_MIN_ID,
  GENERAL_CATEGORY_ID,
  GENERAL_CATEGORY_NAME,
  GENERAL_MIN_VALUE,
  GENERAL_DESIGNATOR_ID,
  CORE_MIN_ID,
  CORE_CATEGORY_ID,
  CORE_CATEGORY_NAME,
  CORE_MIN_BASE_VALUE,
  CORE_MIN_WITH_BORDER_PATROLS_VALUE,
  BORDER_PATROLS_SELECTION_ID,
  OGRE_FORCE_ID,
  OGRE_CORE_UNIT_IDS,
  TYRANT_ID,
  TYRANT_MAX_ID,
  TYRANT_MAX_VALUE,
} from './__fixtures__/realCatalogs.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit — das Primitiv, das der
// eigene XML-Leser der Engine nutzt (wie in den uebrigen Evaluator-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Ein leeres Kontingent der Ogre-Armee (Traeger vorhanden, keine Einheiten). */
const emptyForce = () => roster(force(OGRE_FORCE_ID, []));

/** Die General-Pflicht erfuellt: die gst-weite „General"-Aufwertung im Kontingent. */
const generalDesignator = () => selection(GENERAL_DESIGNATOR_ID);

/** Zwei reale Core-Einheiten — erfuellt die Core-Untergrenze von 2. */
const twoCoreUnits = () => OGRE_CORE_UNIT_IDS.map(id => selection(id));

describe('E2E Ogre Kingdoms: armeeweite Pflichtregeln General und Core', () => {
  it('schlaegt bei leerem Kontingent fuer General (min 1) und Core (min 2) an — Ist 0 gegen die Grenze', () => {
    const report = evaluate(ogreDataset(), emptyForce());

    expect(violationOf(report, GENERAL_MIN_ID)).toMatchObject({
      anchor: { defId: GENERAL_CATEGORY_ID, name: GENERAL_CATEGORY_NAME },
      actual: 0,
      bound: GENERAL_MIN_VALUE,
    });
    expect(violationOf(report, CORE_MIN_ID)).toMatchObject({
      anchor: { defId: CORE_CATEGORY_ID, name: CORE_CATEGORY_NAME },
      actual: 0,
      bound: CORE_MIN_BASE_VALUE,
    });
  });

  it('ist erfuellt, sobald die geforderten Einheiten (General-Aufwertung + zwei Core-Einheiten) vorhanden sind', () => {
    const report = evaluate(ogreDataset(), roster(force(OGRE_FORCE_ID, [generalDesignator(), ...twoCoreUnits()])));

    expect(violationsOf(report, GENERAL_MIN_ID)).toHaveLength(0);
    expect(violationsOf(report, CORE_MIN_ID)).toHaveLength(0);
  });
});

describe('E2E Ogre Kingdoms: bedingter set→1-Modifikator auf der Core-Grenze', () => {
  // Ein einzelnes Core-Einheit-Roster: Ist-Wert 1. Ob das eine Verletzung ist,
  // haengt allein an der effektiven Untergrenze — und die schaltet der bedingte
  // Modifikator ueber die „Border Patrols rules"-Selektion.
  const oneCoreUnit = () => selection(OGRE_CORE_UNIT_IDS[0]);
  const borderPatrols = () => selection(BORDER_PATROLS_SELECTION_ID);

  it('haelt die effektive Core-Untergrenze bei 2, solange „Border Patrols rules" fehlt — eine Core-Einheit verletzt', () => {
    const report = evaluate(ogreDataset(), roster(force(OGRE_FORCE_ID, [generalDesignator(), oneCoreUnit()])));

    expect(violationOf(report, CORE_MIN_ID)).toMatchObject({
      actual: 1,
      bound: CORE_MIN_BASE_VALUE,
    });
  });

  it('setzt die effektive Core-Untergrenze auf 1, sobald „Border Patrols rules" im Roster liegt — dieselbe eine Core-Einheit erfuellt', () => {
    const report = evaluate(
      ogreDataset(),
      roster(force(OGRE_FORCE_ID, [generalDesignator(), oneCoreUnit(), borderPatrols()])),
    );

    // Der bedingte set→1-Modifikator senkt die Grenze; die Verletzung entfaellt.
    expect(violationsOf(report, CORE_MIN_ID)).toHaveLength(0);
  });

  it('senkt die Core-Untergrenze im leeren Kontingent sichtbar von 2 auf 1, wenn „Border Patrols rules" vorliegt', () => {
    const withoutBorderPatrols = evaluate(ogreDataset(), emptyForce());
    const withBorderPatrols = evaluate(
      ogreDataset(),
      roster(force(OGRE_FORCE_ID, [borderPatrols()])),
    );

    expect(violationOf(withoutBorderPatrols, CORE_MIN_ID).bound).toBe(CORE_MIN_BASE_VALUE);
    expect(violationOf(withBorderPatrols, CORE_MIN_ID).bound).toBe(CORE_MIN_WITH_BORDER_PATROLS_VALUE);
  });
});

describe('E2E Ogre Kingdoms: unbedingte Tyrant-Obergrenze (max 1)', () => {
  it('erzeugt fuer zwei Tyrants die Verletzung Ist 2, Grenze 1', () => {
    const report = evaluate(ogreDataset(), roster(force(OGRE_FORCE_ID, [selection(TYRANT_ID), selection(TYRANT_ID)])));

    const tyrantViolation = violationOf(report, TYRANT_MAX_ID);
    expect(tyrantViolation).toMatchObject({
      anchor: { defId: TYRANT_ID },
      actual: 2,
      bound: TYRANT_MAX_VALUE,
    });
  });

  it('laesst genau einen Tyrant unbeanstandet (Obergrenze eingehalten)', () => {
    const report = evaluate(ogreDataset(), roster(force(OGRE_FORCE_ID, [selection(TYRANT_ID)])));

    expect(violationsOf(report, TYRANT_MAX_ID)).toHaveLength(0);
  });
});

describe('E2E Ogre Kingdoms: kataloguebergreifende Auflösung ueber Mercenaries', () => {
  it('loest alle per Verweis importierten Definitionen auf — kein Verweis erscheint fälschlich als unaufgelöst', () => {
    const report = evaluate(ogreDataset(), emptyForce());

    expect(countDiagnostics(report, DiagnosticKind.DANGLING_ENTRY_LINK)).toBe(0);
    expect(countDiagnostics(report, DiagnosticKind.DANGLING_INFO_LINK)).toBe(0);
    expect(countDiagnostics(report, DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY)).toBe(0);
  });
});

describe('E2E Ogre Kingdoms: §7.7 — Kategorie-Ziel zaehlt armeeweit ueber Kontingente', () => {
  // Die General-/Core-Pflichtregeln sind `scope="force"`, ihr Grenz-Anker ist aber
  // eine **Kategorie**. Nach §7.7 (ADR-0029) weitet ein Kategorie-Ziel den
  // force-Rahmen armeeweit auf: jeder Kontingent-Phantom sieht dieselbe Armeesumme.
  // Das ist die reale Entsprechung der frueheren synthetischen „Kategorie-armeeweit"-
  // Szenarien (Paritaetssuite Bloecke C/G, Issue 67) an echten DE-Daten.

  const twoEmptyForces = () => roster(force(OGRE_FORCE_ID, []), force(OGRE_FORCE_ID, []));

  // Ein Kontingent traegt die Pflicht-Selektionen vollstaendig, das zweite ist leer.
  const oneForceSatisfied = () =>
    roster(
      force(OGRE_FORCE_ID, [generalDesignator(), ...twoCoreUnits()]),
      force(OGRE_FORCE_ID, []),
    );

  it('schlaegt an *jedem* leeren Kontingent an — zwei leere Kontingente ergeben je eine General- und Core-Verletzung', () => {
    const report = evaluate(ogreDataset(), twoEmptyForces());

    const generalViolations = violationsOf(report, GENERAL_MIN_ID);
    const coreViolations = violationsOf(report, CORE_MIN_ID);
    // Ein Phantom-Anker je Kontingent; jeder sieht die armeeweite Summe 0.
    expect(generalViolations).toHaveLength(2);
    expect(coreViolations).toHaveLength(2);
    expect(generalViolations.every(violation => violation.actual === 0 && violation.bound === GENERAL_MIN_VALUE)).toBe(true);
    expect(coreViolations.every(violation => violation.actual === 0 && violation.bound === CORE_MIN_BASE_VALUE)).toBe(true);
  });

  it('ist armeeweit erfuellt, sobald *irgendein* Kontingent die Pflicht traegt — das leere Geschwister-Kontingent verletzt nicht', () => {
    const report = evaluate(ogreDataset(), oneForceSatisfied());

    // Kategorie-Ziel zaehlt armeeweit: die Selektionen im ersten Kontingent
    // erfuellen die General-/Core-Untergrenze fuer die ganze Armee.
    expect(violationsOf(report, GENERAL_MIN_ID)).toHaveLength(0);
    expect(violationsOf(report, CORE_MIN_ID)).toHaveLength(0);
  });
});

describe('E2E Ogre Kingdoms: unaufloesbare Roster-Auswahl — Diagnose statt Absturz', () => {
  // Reale Entsprechung des Paritaets-Szenarios „meldet eine nicht mehr aufloesbare
  // Auswahl als Diagnose statt zu stuerzen" (Issue 67): ein Roster verweist auf eine
  // Definitions-Id, die es im echten Datensatz nicht gibt (z. B. nach einem
  // Katalog-Update entfernt). Die Engine meldet `UNRESOLVED_DEFINITION` und liefert
  // dennoch einen strukturell vollstaendigen Bericht.
  const UNKNOWN_DEFINITION_ID = 'ffff-ffff-ffff-ffff';

  it('meldet eine Roster-Auswahl ohne Definition als UNRESOLVED_DEFINITION und stuerzt nicht', () => {
    const report = evaluate(ogreDataset(), roster(force(OGRE_FORCE_ID, [selection(UNKNOWN_DEFINITION_ID)])));

    expect(countDiagnostics(report, DiagnosticKind.UNRESOLVED_DEFINITION)).toBeGreaterThanOrEqual(1);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNRESOLVED_DEFINITION, defId: UNKNOWN_DEFINITION_ID }),
    );
    // Trotz des unaufloesbaren Verweises bleibt der Bericht strukturell vollstaendig.
    expect(Array.isArray(report.violations)).toBe(true);
    expect(report.capabilities).toBeInstanceOf(Map);
  });
});
