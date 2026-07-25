/**
 * End-to-End-**Paritaetstests** der Reinraum-Engine ueber die Fassade
 * `evaluate(catalogXml, roster)` (Slice 05, Issue 66).
 *
 * Ziel: belegen, dass die neue Engine dieselben realen Regel-Situationen korrekt
 * behandelt wie die **alte** Engine (Solver, `src/solver/`, Seam `validateRoster`)
 * — fuer die Teilmenge, die im Zweck des Evaluators liegt (Grenzverletzungen /
 * effektive Werte). Jedes Szenario ist als **eigenes Evaluator-Fixture** in echter
 * BattleScribe-XSD-Syntax (`type`/`field`/`scope`) gegen `evaluate` nachgebaut.
 *
 * **Kein Import aus `src/solver/`** (ADR-0030, maschinell erzwungen). Die
 * Erwartungswerte sind am **tatsaechlichen, korrekten Verhalten der neuen Engine**
 * festgemacht (per Reproduktion verifiziert), nicht blind aus Solver-Tests kopiert.
 *
 * ── Bewusst evaluator-eigene Modellierung (kein Fake, sondern Naht-Anpassung) ──
 * Der Solver kennt `selectionEntryGroup`, `entryLink`-Aliase und das
 * roster-eigene `costLimit`. Die Reinraum-Engine kennt keines davon: ihr Leser
 * liest nur `selectionEntry`/`forceEntry`/`categoryEntry`, `evaluate` nimmt **kein**
 * Punktelimit entgegen, und eine Grenze zaehlt stets die **eigene Definition ihres
 * Ankers** (`node.def.id`). Solver-Szenarien werden deshalb auf die
 * naechstliegende evaluator-native Form abgebildet:
 *   - Ein **Auswahlgruppen-Budget** ueber heterogene Optionen wird ueber eine
 *     gemeinsame **Kategorie** ausgedrueckt (nur ein Kategorie-Ziel aggregiert eine
 *     gemischte Menge; ein Container-Eintrag zaehlte nur seine eigenen Kosten).
 *   - Ein **entryLink-Alias** wird als dieselbe Definition an mehreren Positionen
 *     modelliert (die Engine hat keine Links).
 * Diese Abbildungen sind im jeweiligen Block kommentiert.
 *
 * ── Verifizierte Verhaltensbefunde der neuen Engine (Details in der Rueckmeldung) ──
 *   B1: Eine Kategoriegrenze wird **nur** ausgewertet, wenn die `categoryEntry`
 *       eine MIN-Grenze traegt (nur dann synthetisiert die Join-Schicht einen
 *       Phantom-Anker; Kategorien sind nie Roster-Instanzen). Eine **reine
 *       MAX-Kategorie** (ohne MIN) ist damit effektiv **unbegrenzt** — was `max="-1"`
 *       real umsetzt (siehe Block C4), aber eine *endliche* reine MAX-Kategorie
 *       ebenso ungeprueft laesst (siehe Block C6, Charakterisierung des Befunds).
 *   B2: Ein **forceEntry-eigenes Punktelimit** ist nicht ausdrueckbar (Kontingente
 *       tragen keine Kosten, Grenzen zaehlen ihre eigene Definitions-ID). Die
 *       Semantik „dieses Heer braucht >= N Punkte" ist aber ueber eine
 *       **Kategorie-MIN-Kostengrenze** erreichbar (Block E).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { DiagnosticKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Eine per ID benannte Kostenart (nie per Name — ADR-0003).
const POINTS = 'cost-pts';

// ── Roster-Baukloetze (Instanzbaum, wie ihn `evaluate` erwartet) ───────────────

/** Eine Auswahl-Instanz gegebener Anzahl mit optionalen Kindern. */
function selection(defId, count = 1, children = []) {
  return { defId, count, children };
}

/** Ein Kontingent gegebener Definition, das die uebergebenen Auswahlen traegt. */
function force(defId, children = []) {
  return { defId, count: 1, children };
}

/** Ein Roster aus den uebergebenen Kontingenten. */
function roster(...forces) {
  return { forces };
}

// ── Bericht-Leser ─────────────────────────────────────────────────────────────

/** Alle Verletzungen zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

/** Die (erste) Verletzung zu einer Grenz-Id, oder `undefined`. */
function violationOf(report, limitId) {
  return violationsOf(report, limitId)[0];
}

/** True, wenn eine Diagnose der gegebenen Art vorliegt. */
function hasDiagnostic(report, kind) {
  return report.diagnostics.some(diagnostic => diagnostic.kind === kind);
}

// ═══════════════════════════════════════════════════════════════════════════
// A. Pflichtselektoren
// ═══════════════════════════════════════════════════════════════════════════

describe('A. Pflichtselektoren — roster-weit, force-scoped und dedupliziert', () => {
  const GENERAL_ID = 'entry-general';
  const GENERAL_MIN_ID = 'min-general';
  const STANDARD_FORCE_ID = 'force-standard';
  const OTHER_FORCE_ID = 'force-other';

  // Roster-weite Pflichteinheit (Bulls-Muster, Issue 62): min=1 scope="roster".
  const ROSTER_MANDATORY_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a1" name="Roster Mandatory">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${GENERAL_ID}" name="General" type="unit">
          <constraints>
            <constraint id="${GENERAL_MIN_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('schlaegt an, wenn die roster-weite Pflichteinheit in der ganzen Armee fehlt', () => {
    const report = evaluate(ROSTER_MANDATORY_XML, roster(force(STANDARD_FORCE_ID, [])));

    expect(violationOf(report, GENERAL_MIN_ID)).toMatchObject({
      anchor: { defId: GENERAL_ID, name: 'General' },
      actual: 0,
      bound: 1,
    });
  });

  it('ist erfuellt, sobald die roster-weite Pflichteinheit vorhanden ist', () => {
    const report = evaluate(ROSTER_MANDATORY_XML, roster(force(STANDARD_FORCE_ID, [selection(GENERAL_ID)])));

    expect(violationsOf(report, GENERAL_MIN_ID)).toHaveLength(0);
  });

  // Force-scoped Pflicht (Issue 17/07): min=1 scope="force" je Kontingent.
  const FORCE_MANDATORY_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a2" name="Force Mandatory">
      <forceEntries>
        <forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/>
        <forceEntry id="${OTHER_FORCE_ID}" name="Other"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${GENERAL_ID}" name="General" type="unit">
          <constraints>
            <constraint id="${GENERAL_MIN_ID}" type="min" value="1" field="selections" scope="force"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('verletzt die force-scoped Pflicht nur im Kontingent ohne den Eintrag', () => {
    const report = evaluate(
      FORCE_MANDATORY_XML,
      roster(
        force(STANDARD_FORCE_ID, [selection(GENERAL_ID)]), // erfuellt
        force(OTHER_FORCE_ID, []),                          // leer → Verletzung
      ),
    );

    // Genau eine Verletzung: das leere Kontingent bekommt einen Phantom-Anker,
    // das gefuellte wertet seine Grenze am realen Knoten aus (erfuellt).
    expect(violationsOf(report, GENERAL_MIN_ID)).toHaveLength(1);
    expect(violationOf(report, GENERAL_MIN_ID)).toMatchObject({ actual: 0, bound: 1 });
  });

  // Dedupe: eine als zwei Elemente doppelt codierte Pflicht (Solver: selectionEntry
  // UND entryLink). Die Engine hat keine Links; die naechste Entsprechung ist
  // **dieselbe Definitions-ID doppelt** — der Resolver dedupliziert sie (eine
  // DUPLICATE_DEFINITION-Diagnose), sodass genau **eine** Verletzung entsteht.
  const DUPLICATE_MANDATORY_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-a3" name="Duplicate Mandatory">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${GENERAL_ID}" name="General" type="unit">
          <constraints>
            <constraint id="${GENERAL_MIN_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${GENERAL_ID}" name="General (alias)" type="unit">
          <constraints>
            <constraint id="${GENERAL_MIN_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet fuer eine doppelt codierte Pflicht genau eine Verletzung (Dedupe)', () => {
    const report = evaluate(DUPLICATE_MANDATORY_XML, roster(force(STANDARD_FORCE_ID, [])));

    expect(violationsOf(report, GENERAL_MIN_ID)).toHaveLength(1);
    expect(hasDiagnostic(report, DiagnosticKind.DUPLICATE_DEFINITION)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. Eintrags-Constraints
// ═══════════════════════════════════════════════════════════════════════════

describe('B. Eintrags-Constraints — Kontingent-Hoechstzahl, roster-weite Aggregation, unaufloesbar', () => {
  const STANDARD_FORCE_ID = 'force-standard';
  const SQUAD_ID = 'entry-squad';
  const SQUAD_MAX_ID = 'max-squad';
  const SQUAD_PER_FORCE_MAX = 3;

  // Hoechstzahl gleicher Eintraege je Kontingent: max scope="force".
  const PER_FORCE_MAX_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-b1" name="Per Force Max">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${SQUAD_ID}" name="Tactical Squad" type="unit">
          <constraints>
            <constraint id="${SQUAD_MAX_ID}" type="max" value="${SQUAD_PER_FORCE_MAX}" field="selections" scope="force"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('verletzt die Kontingent-Hoechstzahl, sobald sie ueberschritten wird', () => {
    const overLimit = SQUAD_PER_FORCE_MAX + 1;
    const report = evaluate(PER_FORCE_MAX_XML, roster(force(STANDARD_FORCE_ID, [selection(SQUAD_ID, overLimit)])));

    expect(violationOf(report, SQUAD_MAX_ID)).toMatchObject({ actual: overLimit, bound: SQUAD_PER_FORCE_MAX });
  });

  it('haelt die Kontingent-Hoechstzahl bei genau erlaubter Anzahl', () => {
    const report = evaluate(PER_FORCE_MAX_XML, roster(force(STANDARD_FORCE_ID, [selection(SQUAD_ID, SQUAD_PER_FORCE_MAX)])));

    expect(violationsOf(report, SQUAD_MAX_ID)).toHaveLength(0);
  });

  // Roster-weites Limit ueber verschiedene „Aliase": derselbe Eintrag an zwei
  // getrennten Positionen (die Engine hat keine entryLinks) zaehlt aggregiert.
  const BSB_ID = 'entry-bsb';
  const BSB_ROSTER_MAX_ID = 'max-bsb-roster';
  const BSB_ROSTER_MAX = 1;
  const ROSTER_MAX_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-b2" name="Roster Max Across Positions">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${BSB_ID}" name="Battle Standard Bearer" type="unit">
          <constraints>
            <constraint id="${BSB_ROSTER_MAX_ID}" type="max" value="${BSB_ROSTER_MAX}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('greift roster-weit ueber zwei getrennte Positionen desselben Eintrags', () => {
    const report = evaluate(
      ROSTER_MAX_XML,
      roster(force(STANDARD_FORCE_ID, [selection(BSB_ID, 1), selection(BSB_ID, 1)])),
    );

    // Aggregiert 2 > 1: die Verletzung feuert an jeder tragenden Instanz.
    const bsbViolations = violationsOf(report, BSB_ROSTER_MAX_ID);
    expect(bsbViolations.length).toBeGreaterThanOrEqual(1);
    expect(bsbViolations[0]).toMatchObject({ actual: 2, bound: BSB_ROSTER_MAX });
  });

  it('meldet eine nicht mehr aufloesbare Auswahl als Diagnose statt zu stuerzen', () => {
    const report = evaluate(ROSTER_MAX_XML, roster(force(STANDARD_FORCE_ID, [selection('entry-removed-by-update', 1)])));

    expect(hasDiagnostic(report, DiagnosticKind.UNRESOLVED_DEFINITION)).toBe(true);
    expect(Array.isArray(report.violations)).toBe(true); // kein Absturz, strukturell vollstaendiger Bericht
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. Force-/Kategorie-Constraints
// ═══════════════════════════════════════════════════════════════════════════

describe('C. Kategorie-Constraints — armeeweite Mindestbesetzung und Hoechstzahl, unbegrenzt', () => {
  const CHARACTERS_ID = 'cat-characters';
  const CHARACTERS_MIN_ID = 'min-characters';
  const CHARACTERS_MAX_ID = 'max-characters';
  const CHARACTERS_MAX = 1;
  const HERO_ID = 'entry-hero';
  const FORCE_A_ID = 'force-a';
  const FORCE_B_ID = 'force-b';

  // Eine `categoryEntry` mit MIN **und** MAX (scope="force"): die MIN-Grenze
  // verankert einen Kategorie-Phantomknoten je Kontingent. Weil das Ziel eine
  // Kategorie ist, zaehlt der Wert nach §7.7 (ADR-0029) jedoch **armeeweit** ueber
  // alle Kontingente — auch unter scope="force". Jeder Kontingent-Phantom sieht
  // daher dieselbe Armeesumme (eine Verletzung je Kontingent). Das spiegelt die
  // „Kategorie immer armeeweit"-Regel, an der auch die alte Engine zwei ueber
  // Kontingente **verteilte** Charaktere gemeinsam als Ueberzahl erkennt.
  const CATEGORY_MIN_MAX_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-c" name="Category Min Max">
      <categoryEntries>
        <categoryEntry id="${CHARACTERS_ID}" name="Characters">
          <constraints>
            <constraint id="${CHARACTERS_MIN_ID}" type="min" value="1" field="selections" scope="force"/>
            <constraint id="${CHARACTERS_MAX_ID}" type="max" value="${CHARACTERS_MAX}" field="selections" scope="force"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_A_ID}" name="A"/>
        <forceEntry id="${FORCE_B_ID}" name="B"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
          <categoryLinks><categoryLink targetId="${CHARACTERS_ID}"/></categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet die Kategorie-Mindestbesetzung, wenn die ganze Armee keinen Charakter traegt', () => {
    const report = evaluate(CATEGORY_MIN_MAX_XML, roster(force(FORCE_A_ID, []), force(FORCE_B_ID, [])));

    // Armeeweit 0 Charaktere → die Mindestbesetzung schlaegt an (an jedem Kontingent).
    const minViolations = violationsOf(report, CHARACTERS_MIN_ID);
    expect(minViolations.length).toBeGreaterThanOrEqual(1);
    expect(minViolations.every(violation => violation.actual === 0 && violation.bound === 1)).toBe(true);
  });

  it('ist erfuellt, sobald irgendein Kontingent den Pflicht-Charakter traegt (armeeweit)', () => {
    const report = evaluate(CATEGORY_MIN_MAX_XML, roster(force(FORCE_A_ID, [selection(HERO_ID, 1)]), force(FORCE_B_ID, [])));

    expect(violationsOf(report, CHARACTERS_MIN_ID)).toHaveLength(0);
  });

  it('verletzt die Kategorie-Hoechstzahl armeeweit, wenn zwei Kontingente je einen Charakter tragen', () => {
    const report = evaluate(
      CATEGORY_MIN_MAX_XML,
      roster(force(FORCE_A_ID, [selection(HERO_ID, 1)]), force(FORCE_B_ID, [selection(HERO_ID, 1)])),
    );

    // Auf zwei Kontingente verteilt (je 1) ergibt die Armeesumme 2 > 1 → Verletzung,
    // obwohl kein Kontingent fuer sich die Grenze reisst.
    const maxViolations = violationsOf(report, CHARACTERS_MAX_ID);
    expect(maxViolations.length).toBeGreaterThanOrEqual(1);
    expect(maxViolations.every(violation => violation.actual === 2 && violation.bound === CHARACTERS_MAX)).toBe(true);
  });

  it('haelt die Kategorie-Hoechstzahl, solange die Armeesumme im Rahmen bleibt', () => {
    const report = evaluate(
      CATEGORY_MIN_MAX_XML,
      roster(force(FORCE_A_ID, [selection(HERO_ID, 1)]), force(FORCE_B_ID, [])),
    );

    expect(violationsOf(report, CHARACTERS_MAX_ID)).toHaveLength(0);
  });

  // C4: `max="-1"` = unbegrenzt. Real ist die Heroes-`categoryEntry` eine **reine
  // MAX-Kategorie** ohne MIN — sie erhaelt daher nie einen Phantom-Anker und ist
  // schon deshalb effektiv unbegrenzt. `max="-1"` bekraeftigt das nur.
  const HEROES_ID = 'cat-heroes';
  const HEROES_MAX_ID = 'max-heroes';
  const HERO_ONLY_ID = 'entry-hero-only';
  const UNLIMITED = -1;
  const UNLIMITED_CATEGORY_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-c4" name="Unlimited Category">
      <categoryEntries>
        <categoryEntry id="${HEROES_ID}" name="Heroes">
          <constraints>
            <constraint id="${HEROES_MAX_ID}" type="max" value="${UNLIMITED}" field="selections" scope="force"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${FORCE_A_ID}" name="A"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_ONLY_ID}" name="Skink Hero" type="unit">
          <categoryLinks><categoryLink targetId="${HEROES_ID}"/></categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erzeugt fuer max="-1" (unbegrenzt) keine Verletzung, egal wie viele Auswahlen', () => {
    const report = evaluate(UNLIMITED_CATEGORY_XML, roster(force(FORCE_A_ID, [selection(HERO_ONLY_ID, 8)])));

    expect(violationsOf(report, HEROES_MAX_ID)).toHaveLength(0);
  });

  // C6: Charakterisierung des Befunds B1 — eine reine MAX-`categoryEntry` (ohne MIN)
  // mit *endlicher* Grenze wird **nicht** erzwungen, weil kein Phantom-Anker
  // synthetisiert wird. Das ist ein bewusst festgehaltener Verhaltensunterschied
  // zur alten Engine (dort griff die Kategoriegrenze unabhaengig von einer MIN).
  const FINITE_MAX_ONLY_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-c6" name="Finite Max-Only Category">
      <categoryEntries>
        <categoryEntry id="${HEROES_ID}" name="Heroes">
          <constraints>
            <constraint id="${HEROES_MAX_ID}" type="max" value="1" field="selections" scope="force"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${FORCE_A_ID}" name="A"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_ONLY_ID}" name="Skink Hero" type="unit">
          <categoryLinks><categoryLink targetId="${HEROES_ID}"/></categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('BEFUND: eine reine MAX-Kategorie ohne MIN wird nicht erzwungen (kein Phantom-Anker)', () => {
    const report = evaluate(FINITE_MAX_ONLY_XML, roster(force(FORCE_A_ID, [selection(HERO_ONLY_ID, 3)])));

    // 3 > 1 bliebe in der alten Engine haengen; die neue verankert die Grenze mangels
    // MIN nicht → keine Verletzung. Festgehalten als dokumentierter Unterschied.
    expect(violationsOf(report, HEROES_MAX_ID)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D. Gruppen-Constraints (ueber eine gemeinsame Kategorie ausgedrueckt)
// ═══════════════════════════════════════════════════════════════════════════

describe('D. Gruppen-/Optionslimits — Punktebudget, angehobenes Limit, kategoriegebunden, andere Kostenart', () => {
  const STANDARD_FORCE_ID = 'force-standard';
  const MAGIC_ITEMS_ID = 'cat-magic-items';
  const MAGIC_BUDGET_ID = 'max-magic-budget';
  const MAGIC_ANCHOR_MIN_ID = 'min-magic-anchor';
  const SWORD_ID = 'entry-sword';
  const SHIELD_ID = 'entry-shield';
  const LANCE_ID = 'entry-lance';
  const SWORD_COST = 30;
  const SHIELD_COST = 15;
  const LANCE_COST = 25;
  const MAGIC_BUDGET = 50;

  // Auswahlgruppen-Budget: die Optionen teilen die Kategorie „Magic Items"; eine
  // MAX-Kostengrenze auf dieser Kategorie ist das Gruppenbudget. Die MIN-Grenze
  // (value 0, stets erfuellt) verankert nur den Phantom-Anker (Befund B1).
  const MAGIC_BUDGET_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-d1" name="Magic Items Budget">
      <categoryEntries>
        <categoryEntry id="${MAGIC_ITEMS_ID}" name="Magic Items">
          <constraints>
            <constraint id="${MAGIC_ANCHOR_MIN_ID}" type="min" value="0" field="selections" scope="roster"/>
            <constraint id="${MAGIC_BUDGET_ID}" type="max" value="${MAGIC_BUDGET}" field="${POINTS}" scope="roster"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${SWORD_ID}" name="Sword of Battle" type="upgrade">
          <costs><cost name="pts" typeId="${POINTS}" value="${SWORD_COST}"/></costs>
          <categoryLinks><categoryLink targetId="${MAGIC_ITEMS_ID}"/></categoryLinks>
        </selectionEntry>
        <selectionEntry id="${SHIELD_ID}" name="Shield of Grace" type="upgrade">
          <costs><cost name="pts" typeId="${POINTS}" value="${SHIELD_COST}"/></costs>
          <categoryLinks><categoryLink targetId="${MAGIC_ITEMS_ID}"/></categoryLinks>
        </selectionEntry>
        <selectionEntry id="${LANCE_ID}" name="Lance of Doom" type="upgrade">
          <costs><cost name="pts" typeId="${POINTS}" value="${LANCE_COST}"/></costs>
          <categoryLinks><categoryLink targetId="${MAGIC_ITEMS_ID}"/></categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('haelt das Gruppen-Punktebudget, solange die Optionen hineinpassen', () => {
    expect(SWORD_COST + SHIELD_COST).toBeLessThanOrEqual(MAGIC_BUDGET);
    const report = evaluate(MAGIC_BUDGET_XML, roster(force(STANDARD_FORCE_ID, [selection(SWORD_ID), selection(SHIELD_ID)])));

    expect(violationsOf(report, MAGIC_BUDGET_ID)).toHaveLength(0);
  });

  it('verletzt das Gruppen-Punktebudget, wenn die Optionen es sprengen', () => {
    expect(SWORD_COST + LANCE_COST).toBeGreaterThan(MAGIC_BUDGET);
    const report = evaluate(MAGIC_BUDGET_XML, roster(force(STANDARD_FORCE_ID, [selection(SWORD_ID), selection(LANCE_ID)])));

    expect(violationOf(report, MAGIC_BUDGET_ID)).toMatchObject({ actual: SWORD_COST + LANCE_COST, bound: MAGIC_BUDGET });
  });

  // D2: per Modifikator angehobenes Gruppenlimit. Eine Wahl (Grand Tome) hebt das
  // Optionslimit der Kategorie von 1 auf 3 (set-Modifikator auf die Grenz-Id).
  const ARCANE_ID = 'cat-arcane';
  const ARCANE_MAX_ID = 'max-arcane';
  const ARCANE_ANCHOR_MIN_ID = 'min-arcane-anchor';
  const SCROLL_ID = 'entry-scroll';
  const GRAND_TOME_ID = 'entry-grand-tome';
  const ARCANE_BASE_MAX = 1;
  const ARCANE_RAISED_MAX = 3;
  const RAISED_LIMIT_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-d2" name="Modifier Raised Group Limit">
      <categoryEntries>
        <categoryEntry id="${ARCANE_ID}" name="Arcane Items">
          <constraints>
            <constraint id="${ARCANE_ANCHOR_MIN_ID}" type="min" value="0" field="selections" scope="roster"/>
            <constraint id="${ARCANE_MAX_ID}" type="max" value="${ARCANE_BASE_MAX}" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="${ARCANE_MAX_ID}" value="${ARCANE_RAISED_MAX}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${GRAND_TOME_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${SCROLL_ID}" name="Dispel Scroll" type="upgrade">
          <categoryLinks><categoryLink targetId="${ARCANE_ID}"/></categoryLinks>
        </selectionEntry>
        <selectionEntry id="${GRAND_TOME_ID}" name="Grand Tome" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('erzwingt das Basis-Gruppenlimit, solange der anhebende Ausloeser fehlt', () => {
    const overBase = ARCANE_BASE_MAX + 1;
    const report = evaluate(RAISED_LIMIT_XML, roster(force(STANDARD_FORCE_ID, [selection(SCROLL_ID, overBase)])));

    expect(violationOf(report, ARCANE_MAX_ID)).toMatchObject({ actual: overBase, bound: ARCANE_BASE_MAX });
  });

  it('laesst das per Modifikator angehobene Gruppenlimit wirken, sobald der Ausloeser vorhanden ist', () => {
    const report = evaluate(
      RAISED_LIMIT_XML,
      roster(force(STANDARD_FORCE_ID, [selection(SCROLL_ID, ARCANE_RAISED_MAX), selection(GRAND_TOME_ID)])),
    );

    // Grand Tome hebt das Limit auf 3 → drei Schriftrollen sind erlaubt.
    expect(violationsOf(report, ARCANE_MAX_ID)).toHaveLength(0);
  });

  // D3: kategoriegebundenes Optionslimit. Ein „Schild (nur Blutdrachen)" traegt
  // max=0; ein set-Modifikator hebt es auf 1, sobald eine Geschwisterauswahl der
  // Kategorie „Blood Dragon" angehoert (instanceOf-Bedingung auf das Elternteil).
  const VAMPIRE_ID = 'entry-vampire';
  const BLOOD_DRAGON_ID = 'cat-blood-dragon';
  const BLOODLINE_ID = 'entry-bloodline';
  const SHIELD_OPTION_ID = 'entry-shield-option';
  const SHIELD_OPTION_MAX_ID = 'max-shield-option';
  const GATED_MAX = 0;
  const LIFTED_MAX = 1;
  const CATEGORY_GATED_OPTION_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-d3" name="Category Gated Option">
      <categoryEntries><categoryEntry id="${BLOOD_DRAGON_ID}" name="Blood Dragon"/></categoryEntries>
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${VAMPIRE_ID}" name="Vampire" type="unit">
          <selectionEntries>
            <selectionEntry id="${BLOODLINE_ID}" name="Blood Dragon Bloodline" type="upgrade">
              <categoryLinks><categoryLink targetId="${BLOOD_DRAGON_ID}"/></categoryLinks>
            </selectionEntry>
            <selectionEntry id="${SHIELD_OPTION_ID}" name="Shield (Blood Dragons only)" type="upgrade">
              <constraints>
                <constraint id="${SHIELD_OPTION_MAX_ID}" type="max" value="${GATED_MAX}" field="selections" scope="parent"/>
              </constraints>
              <modifiers>
                <modifier type="set" field="${SHIELD_OPTION_MAX_ID}" value="${LIFTED_MAX}">
                  <conditions>
                    <condition type="instanceOf" field="selections" scope="parent" childId="${BLOOD_DRAGON_ID}" value="1"/>
                  </conditions>
                </modifier>
              </modifiers>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('sperrt die kategoriegebundene Option ohne die freischaltende Kategorie', () => {
    const report = evaluate(
      CATEGORY_GATED_OPTION_XML,
      roster(force(STANDARD_FORCE_ID, [selection(VAMPIRE_ID, 1, [selection(SHIELD_OPTION_ID)])])),
    );

    expect(violationOf(report, SHIELD_OPTION_MAX_ID)).toMatchObject({ actual: 1, bound: GATED_MAX });
  });

  it('gibt die kategoriegebundene Option frei, sobald die Kategorie im Elternteil vertreten ist', () => {
    const report = evaluate(
      CATEGORY_GATED_OPTION_XML,
      roster(force(STANDARD_FORCE_ID, [selection(VAMPIRE_ID, 1, [selection(BLOODLINE_ID), selection(SHIELD_OPTION_ID)])])),
    );

    expect(violationsOf(report, SHIELD_OPTION_MAX_ID)).toHaveLength(0);
  });

  // D4: Gruppengrenze auf einer **anderen** Kostenart (nicht Punkte) — absolut und
  // als Prozentgrenze. Modelliert eine „Magic Points"-Waehrung mit eigenem Budget.
  const MAGIC_POINTS = 'cost-magic';
  const COVEN_ID = 'cat-coven';
  const COVEN_ANCHOR_MIN_ID = 'min-coven-anchor';
  const COVEN_ABS_MAX_ID = 'max-coven-abs';
  const COVEN_PCT_MAX_ID = 'max-coven-pct';
  const SPELL_ID = 'entry-spell';
  const SPELL_MAGIC_COST = 40;
  const COVEN_ABS_BUDGET = 30;
  const OTHER_MAGIC_ID = 'entry-other-magic';
  const OTHER_MAGIC_COST = 60;
  const COVEN_PCT_MAX = 25; // hoechstens 25 % der Magic Points

  const ABS_OTHER_COST_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-d4a" name="Other Cost Type Absolute Budget">
      <categoryEntries>
        <categoryEntry id="${COVEN_ID}" name="Coven">
          <constraints>
            <constraint id="${COVEN_ANCHOR_MIN_ID}" type="min" value="0" field="selections" scope="roster"/>
            <constraint id="${COVEN_ABS_MAX_ID}" type="max" value="${COVEN_ABS_BUDGET}" field="${MAGIC_POINTS}" scope="roster"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${SPELL_ID}" name="Spell" type="upgrade">
          <costs><cost name="magic" typeId="${MAGIC_POINTS}" value="${SPELL_MAGIC_COST}"/></costs>
          <categoryLinks><categoryLink targetId="${COVEN_ID}"/></categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erzwingt eine absolute Gruppengrenze auf einer anderen Kostenart als Punkte', () => {
    expect(SPELL_MAGIC_COST).toBeGreaterThan(COVEN_ABS_BUDGET);
    const report = evaluate(ABS_OTHER_COST_XML, roster(force(STANDARD_FORCE_ID, [selection(SPELL_ID)])));

    expect(violationOf(report, COVEN_ABS_MAX_ID)).toMatchObject({ actual: SPELL_MAGIC_COST, bound: COVEN_ABS_BUDGET });
  });

  const PCT_OTHER_COST_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-d4b" name="Other Cost Type Percent Budget">
      <categoryEntries>
        <categoryEntry id="${COVEN_ID}" name="Coven">
          <constraints>
            <constraint id="${COVEN_ANCHOR_MIN_ID}" type="min" value="0" field="selections" scope="roster"/>
            <constraint id="${COVEN_PCT_MAX_ID}" type="max" value="${COVEN_PCT_MAX}" percentValue="true" field="${MAGIC_POINTS}" scope="roster"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${SPELL_ID}" name="Coven Spell" type="upgrade">
          <costs><cost name="magic" typeId="${MAGIC_POINTS}" value="${SPELL_MAGIC_COST}"/></costs>
          <categoryLinks><categoryLink targetId="${COVEN_ID}"/></categoryLinks>
        </selectionEntry>
        <selectionEntry id="${OTHER_MAGIC_ID}" name="Other Magic" type="upgrade">
          <costs><cost name="magic" typeId="${MAGIC_POINTS}" value="${OTHER_MAGIC_COST}"/></costs>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erzwingt eine Prozent-Gruppengrenze auf einer anderen Kostenart als Punkte', () => {
    // Coven traegt 40 Magic Points von gesamt 40+60=100 → Grenzwert round(100*25%)=25.
    // 40 > 25 → Verletzung.
    const report = evaluate(
      PCT_OTHER_COST_XML,
      roster(force(STANDARD_FORCE_ID, [selection(SPELL_ID), selection(OTHER_MAGIC_ID)])),
    );

    const totalMagic = SPELL_MAGIC_COST + OTHER_MAGIC_COST;
    const expectedBound = Math.floor((totalMagic * COVEN_PCT_MAX) / 100 + 0.5);
    expect(violationOf(report, COVEN_PCT_MAX_ID)).toMatchObject({ actual: SPELL_MAGIC_COST, bound: expectedBound });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E. „forceEntry-eigenes Punktelimit" — Armee-Punkteuntergrenze
// ═══════════════════════════════════════════════════════════════════════════

describe('E. Armee-Punkteuntergrenze (Vampire-Counts-Sonderheer-Semantik)', () => {
  // BEFUND B2: Ein Kontingent traegt keine Kosten, und eine Grenze zaehlt stets die
  // eigene Definitions-ID ihres Ankers — eine `forceEntry`-eigene Kostengrenze
  // liest daher immer 0. Die *Semantik* „dieses Sonderheer muss >= N Punkte bauen"
  // ist aber ueber eine **Kategorie-MIN-Kostengrenze** erreichbar: alle Einheiten
  // des Heeres teilen die Armee-Kategorie, deren MIN-Kostengrenze den Boden setzt.
  const STANDARD_FORCE_ID = 'force-standard';
  const ARMY_ID = 'cat-army';
  const ARMY_FLOOR_ID = 'min-army-floor';
  const UNIT_ID = 'entry-unit';
  const UNIT_COST = 500;
  const REQUIRED_FLOOR = 2000;

  const ARMY_FLOOR_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-e" name="Special Army Points Floor">
      <categoryEntries>
        <categoryEntry id="${ARMY_ID}" name="Vampire Coast Army">
          <constraints>
            <constraint id="${ARMY_FLOOR_ID}" type="min" value="${REQUIRED_FLOOR}" field="${POINTS}" scope="roster"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Zombie Regiment" type="unit">
          <costs><cost name="pts" typeId="${POINTS}" value="${UNIT_COST}"/></costs>
          <categoryLinks><categoryLink targetId="${ARMY_ID}"/></categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet einen Fehler, wenn das Sonderheer unter der geforderten Punktzahl bleibt', () => {
    const belowFloor = 3; // 3 * 500 = 1500 < 2000
    const report = evaluate(ARMY_FLOOR_XML, roster(force(STANDARD_FORCE_ID, [selection(UNIT_ID, belowFloor)])));

    expect(violationOf(report, ARMY_FLOOR_ID)).toMatchObject({ actual: belowFloor * UNIT_COST, bound: REQUIRED_FLOOR });
  });

  it('laesst den Fehler ab der geforderten Punktzahl verschwinden', () => {
    const atFloor = REQUIRED_FLOOR / UNIT_COST; // 4 * 500 = 2000
    const report = evaluate(ARMY_FLOOR_XML, roster(force(STANDARD_FORCE_ID, [selection(UNIT_ID, atFloor)])));

    expect(violationsOf(report, ARMY_FLOOR_ID)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F. multiply-Modifikator
// ═══════════════════════════════════════════════════════════════════════════

describe('F. multiply — Kosten-Verdopplung und multiply auf einer Nicht-Kosten-Grenze', () => {
  const STANDARD_FORCE_ID = 'force-standard';

  // „Traditional Army"-Verdopplung: ein multiply-Modifikator verdoppelt die
  // Punktekosten der Organ Gun, sobald King Alrik im Roster steht; der verdoppelte
  // Wert fliesst in eine Kosten-Grenze (Budget) ein.
  const ORGAN_GUN_ID = 'entry-organ-gun';
  const KING_ALRIK_ID = 'entry-king-alrik';
  const GUN_BUDGET_ID = 'max-gun-budget';
  const GUN_BASE_COST = 125;
  const GUN_BUDGET = 200;
  const DOUBLING_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-f1" name="Traditional Army Doubling">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${KING_ALRIK_ID}" name="King Alrik" type="unit"/>
        <selectionEntry id="${ORGAN_GUN_ID}" name="Organ Gun" type="unit">
          <costs><cost name="pts" typeId="${POINTS}" value="${GUN_BASE_COST}"/></costs>
          <constraints>
            <constraint id="${GUN_BUDGET_ID}" type="max" value="${GUN_BUDGET}" field="${POINTS}" scope="self"/>
          </constraints>
          <modifiers>
            <modifier type="multiply" field="${POINTS}" value="2">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${KING_ALRIK_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('laesst die Grundkosten unveraendert, solange die Verdopplungs-Bedingung nicht haelt', () => {
    const report = evaluate(DOUBLING_XML, roster(force(STANDARD_FORCE_ID, [selection(ORGAN_GUN_ID)])));

    expect(violationsOf(report, GUN_BUDGET_ID)).toHaveLength(0);
  });

  it('verdoppelt die effektiven Kosten und sprengt damit das Budget, wenn die Bedingung haelt', () => {
    const report = evaluate(
      DOUBLING_XML,
      roster(force(STANDARD_FORCE_ID, [selection(ORGAN_GUN_ID), selection(KING_ALRIK_ID)])),
    );

    expect(violationOf(report, GUN_BUDGET_ID)).toMatchObject({ actual: GUN_BASE_COST * 2, bound: GUN_BUDGET });
  });

  // multiply auf einer Nicht-Kosten-Grenze: derselbe Effekt-Pfad wie bei Kosten —
  // der Modifikator skaliert einen Selektions-Grenzwert.
  const REGIMENT_ID = 'entry-regiment';
  const BANNER_ID = 'entry-banner';
  const REGIMENT_MAX_ID = 'max-regiment';
  const REGIMENT_BASE_MAX = 10;
  const MULTIPLY_FACTOR = 3;
  const NON_COST_MULTIPLY_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-f2" name="Multiply Non-Cost Limit">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <constraints>
            <constraint id="${REGIMENT_MAX_ID}" type="max" value="${REGIMENT_BASE_MAX}" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="multiply" field="${REGIMENT_MAX_ID}" value="${MULTIPLY_FACTOR}">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" childId="${BANNER_ID}" value="1"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_ID}" name="Battle Banner" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('erzwingt den Basis-Grenzwert einer Nicht-Kosten-Grenze ohne die anhebende Bedingung', () => {
    const overBase = REGIMENT_BASE_MAX * 2;
    const report = evaluate(NON_COST_MULTIPLY_XML, roster(force(STANDARD_FORCE_ID, [selection(REGIMENT_ID, overBase)])));

    expect(violationOf(report, REGIMENT_MAX_ID)).toMatchObject({ actual: overBase, bound: REGIMENT_BASE_MAX });
  });

  it('skaliert den Grenzwert einer Nicht-Kosten-Grenze per multiply, wenn die Bedingung haelt', () => {
    const withinRaised = REGIMENT_BASE_MAX * 2; // 20 <= 10*3
    const report = evaluate(
      NON_COST_MULTIPLY_XML,
      roster(force(STANDARD_FORCE_ID, [selection(REGIMENT_ID, withinRaised), selection(BANNER_ID)])),
    );

    expect(violationsOf(report, REGIMENT_MAX_ID)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G. Bezugsrahmen / Ziel-Typ (§7.7) und `shared`
// ═══════════════════════════════════════════════════════════════════════════

describe('G. §7.7 — Eintrags-Ziel pro Kontingent, Kategorie-Ziel armeeweit, shared="false"', () => {
  const ELITE_ID = 'cat-elite';
  const UNIT_ID = 'entry-unit';
  const FORCE_EMPTY_ID = 'force-empty';
  const FORCE_FULL_ID = 'force-full';

  // Eintrags-Ziel mit scope="force" zaehlt PRO Kontingent.
  const ENTRY_MAX_ID = 'max-unit-force';
  const ENTRY_PER_FORCE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-g1" name="Entry Force Scope">
      <forceEntries>
        <forceEntry id="${FORCE_EMPTY_ID}" name="Empty"/>
        <forceEntry id="${FORCE_FULL_ID}" name="Full"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Special Unit" type="unit">
          <constraints>
            <constraint id="${ENTRY_MAX_ID}" type="max" value="1" field="selections" scope="force"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('zaehlt ein Eintrags-Ziel mit scope="force" pro Kontingent — nur das ueberzaehlige Kontingent verletzt', () => {
    const report = evaluate(
      ENTRY_PER_FORCE_XML,
      roster(force(FORCE_EMPTY_ID, [selection(UNIT_ID, 1)]), force(FORCE_FULL_ID, [selection(UNIT_ID, 2)])),
    );

    const entryViolations = violationsOf(report, ENTRY_MAX_ID);
    // Nur das Kontingent mit 2 Einheiten ueberschreitet die pro-Kontingent-Grenze.
    expect(entryViolations).toHaveLength(1);
    expect(entryViolations[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  // Kategorie-Ziel zaehlt ARMEEWEIT, auch unter scope="force" (§7.7).
  const CATEGORY_MAX_ID = 'max-elite-force';
  const CATEGORY_ANCHOR_MIN_ID = 'min-elite-anchor';
  const CATEGORY_ARMY_WIDE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-g2" name="Category Force Scope Army Wide">
      <categoryEntries>
        <categoryEntry id="${ELITE_ID}" name="Elite">
          <constraints>
            <constraint id="${CATEGORY_ANCHOR_MIN_ID}" type="min" value="0" field="selections" scope="force"/>
            <constraint id="${CATEGORY_MAX_ID}" type="max" value="1" field="selections" scope="force"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_EMPTY_ID}" name="Empty"/>
        <forceEntry id="${FORCE_FULL_ID}" name="Full"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Elite Unit" type="unit">
          <categoryLinks><categoryLink targetId="${ELITE_ID}"/></categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('zaehlt ein Kategorie-Ziel armeeweit, auch unter scope="force" — jedes Kontingent sieht die Armeesumme', () => {
    // Zwei Elite-Einheiten liegen ausschliesslich im zweiten Kontingent; die
    // armeeweite Summe (2) verletzt die Grenze an *beiden* Kontingent-Phantomen,
    // auch am leeren (§7.7: Kategorie-Ziel weitet den force-Rahmen armeeweit auf).
    const report = evaluate(
      CATEGORY_ARMY_WIDE_XML,
      roster(force(FORCE_EMPTY_ID, []), force(FORCE_FULL_ID, [selection(UNIT_ID, 2)])),
    );

    const categoryViolations = violationsOf(report, CATEGORY_MAX_ID);
    expect(categoryViolations.length).toBeGreaterThanOrEqual(1);
    expect(categoryViolations.every(violation => violation.actual === 2)).toBe(true);
  });

  // shared="false" zaehlt nur die eigene Instanz.
  const HERO_ID = 'entry-hero';
  const HERO_MAX_ID = 'max-hero';
  const STANDARD_FORCE_ID = 'force-standard';
  const sharedXml = (shared) => `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-g3" name="Shared Scope">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
          <constraints>
            <constraint id="${HERO_MAX_ID}" type="max" value="1" field="selections" scope="roster" shared="${shared}"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('eine geteilte Grenze (shared="true") zaehlt zwei getrennte Instanzen aggregiert und verletzt max=1', () => {
    const twoInstances = roster(force(STANDARD_FORCE_ID, [selection(HERO_ID, 1), selection(HERO_ID, 1)]));
    const report = evaluate(sharedXml('true'), twoInstances);

    expect(violationsOf(report, HERO_MAX_ID).length).toBeGreaterThan(0);
  });

  it('eine nicht geteilte Grenze (shared="false") zaehlt nur die eigene Instanz und verletzt max=1 nicht', () => {
    const twoInstances = roster(force(STANDARD_FORCE_ID, [selection(HERO_ID, 1), selection(HERO_ID, 1)]));
    const report = evaluate(sharedXml('false'), twoInstances);

    expect(violationsOf(report, HERO_MAX_ID)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H. Dokumentreihenfolge
// ═══════════════════════════════════════════════════════════════════════════

describe('H. Dokumentreihenfolge — gestapelte, nicht-kommutierende Modifikatoren', () => {
  const STANDARD_FORCE_ID = 'force-standard';
  const ENTRY_ID = 'entry-regiment';
  const ENTRY_MAX_ID = 'max-regiment';
  const BASE_MAX = 1;
  const INCREMENT_AMOUNT = 2;
  const SET_AMOUNT = 5;
  const UNIT_COUNT = 7; // ueber beiden moeglichen effektiven Grenzen (5 bzw. 7)

  const incrementModifier = `<modifier type="increment" field="${ENTRY_MAX_ID}" value="${INCREMENT_AMOUNT}"/>`;
  const setModifier = `<modifier type="set" field="${ENTRY_MAX_ID}" value="${SET_AMOUNT}"/>`;

  const stackedXml = (modifierBody) => `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-h" name="Document Order">
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Regiment" type="unit">
          <constraints>
            <constraint id="${ENTRY_MAX_ID}" type="max" value="${BASE_MAX}" field="selections" scope="roster"/>
          </constraints>
          <modifiers>${modifierBody}</modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  const rosterOfUnits = roster(force(STANDARD_FORCE_ID, [selection(ENTRY_ID, UNIT_COUNT)]));

  it('„erhoehen, dann setzen" liefert den gesetzten Grenzwert', () => {
    const report = evaluate(stackedXml(incrementModifier + setModifier), rosterOfUnits);

    // increment (1→3), dann set (→5): effektive Grenze 5; 7 > 5 → Verletzung mit bound 5.
    expect(violationOf(report, ENTRY_MAX_ID)).toMatchObject({ actual: UNIT_COUNT, bound: SET_AMOUNT });
  });

  it('„setzen, dann erhoehen" erhoeht den gesetzten Grenzwert — dieselbe Liste, andere Reihenfolge', () => {
    const report = evaluate(stackedXml(setModifier + incrementModifier), rosterOfUnits);

    // set (→5), dann increment (→7): effektive Grenze 7; 7 <= 7 → keine Verletzung.
    expect(violationsOf(report, ENTRY_MAX_ID)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I. Prozentgrenze
// ═══════════════════════════════════════════════════════════════════════════

describe('I. Prozentgrenze — Unterschreitung mit kaufmaennischer Rundung des Grenzwerts', () => {
  const STANDARD_FORCE_ID = 'force-standard';
  const CORE_ID = 'cat-core';
  const CORE_PERCENT_MIN_ID = 'min-core-percent';
  const CORE_MIN_PERCENT = 25;
  const CORE_UNIT_ID = 'entry-core-unit';
  const OTHER_UNIT_ID = 'entry-other-unit';
  const CORE_UNIT_COST = 50;
  const OTHER_UNIT_COST = 160; // gesamt 210 → 25 % = 52,5 → kaufmaennisch gerundet 53

  const PERCENT_MIN_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-i" name="Percent Minimum Rounding">
      <categoryEntries>
        <categoryEntry id="${CORE_ID}" name="Core">
          <constraints>
            <constraint id="${CORE_PERCENT_MIN_ID}" type="min" value="${CORE_MIN_PERCENT}"
                        percentValue="true" field="${POINTS}" scope="roster"/>
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries><forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${CORE_UNIT_ID}" name="Core Unit" type="unit">
          <costs><cost name="pts" typeId="${POINTS}" value="${CORE_UNIT_COST}"/></costs>
          <categoryLinks><categoryLink targetId="${CORE_ID}"/></categoryLinks>
        </selectionEntry>
        <selectionEntry id="${OTHER_UNIT_ID}" name="Other Unit" type="unit">
          <costs><cost name="pts" typeId="${POINTS}" value="${OTHER_UNIT_COST}"/></costs>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('verletzt die Prozent-Mindestgrenze bei Unterschreitung, mit kaufmaennisch gerundetem Grenzwert', () => {
    const report = evaluate(
      PERCENT_MIN_XML,
      roster(force(STANDARD_FORCE_ID, [selection(CORE_UNIT_ID), selection(OTHER_UNIT_ID)])),
    );

    const totalPoints = CORE_UNIT_COST + OTHER_UNIT_COST;
    const expectedBound = Math.floor((totalPoints * CORE_MIN_PERCENT) / 100 + 0.5); // 52,5 → 53
    expect(violationOf(report, CORE_PERCENT_MIN_ID)).toMatchObject({ actual: CORE_UNIT_COST, bound: expectedBound });
  });

  it('haelt die Prozent-Mindestgrenze, wenn der Anteil ausreicht', () => {
    // Vier Kern-Einheiten (200) von gesamt 360 → Grenzwert round(360*25%)=90; 200 >= 90.
    const report = evaluate(
      PERCENT_MIN_XML,
      roster(force(STANDARD_FORCE_ID, [selection(CORE_UNIT_ID, 4), selection(OTHER_UNIT_ID)])),
    );

    expect(violationsOf(report, CORE_PERCENT_MIN_ID)).toHaveLength(0);
  });
});
