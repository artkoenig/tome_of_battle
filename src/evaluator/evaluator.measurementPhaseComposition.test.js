/**
 * **Woraus die gemessenen Abschnitte bestehen** (Issue 0138, Kriterium 2).
 *
 * Die Metadata weist drei Dauern aus — aber eine Dauer sagt von sich aus nicht,
 * *welche* Schritte in ihr stecken. Genau das legt Kriterium 2 fest:
 *
 * - **iterierte Auswertung** = `buildEvalTree` + `evaluateToFixpoint` + `buildIndex`
 * - **Nach-Durchlauf** = `attachOfferAnchors` + `extendBaseEffectiveState` + `applyAnchorPostPass`
 * - **Grenzen und Bericht** = `evaluateConstraints` + `evaluateRosterBudget` + `buildReport`
 *
 * Ohne diesen Test bliebe die Zusammensetzung ungepinnt: ein Schritt, der aus
 * seinem Abschnitt herausrutscht, liefe unbemerkt ungemessen mit — die
 * Auswertung meldete dann eine Dauer, die weniger enthaelt, als sie behauptet.
 * Das ist genau die stille Drift, deren Ende diese Issue ist.
 *
 * ── Wie gemessen wird, worin ein Schritt liegt ───────────────────────────────
 * Jeder der neun Schritte wird ueber sein Modul umhuellt; die Huelle laesst den
 * **echten** Schritt laufen und verbrennt danach eine gut sichtbare Zeitspanne
 * ({@link DELAY_MS}). Wo diese Zeit auftaucht, dort liegt der Schritt: der
 * erwartete Abschnitt muss sie tragen, die beiden anderen duerfen sie nicht
 * sehen. Der Ausgangswert jedes Abschnitts liegt bei dieser Katalogroesse weit
 * darunter (siehe den Grundlinien-Test) — die Zuordnung ist damit eindeutig.
 *
 * `buildIndex` ist der einzige Schritt, den die Engine mehrfach ruft: die
 * Fixpunktschleife baut ihren Index je Runde selbst. Verbrannt wird deshalb nur
 * beim Aufruf **nach** der Schleife — das ist der eine Aufruf der Fassade, den
 * Kriterium 2 der iterierten Auswertung zurechnet.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { evaluate, prepareDataset, MeasuredPhase } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Die Zeitspanne, die der scharf gestellte Schritt verbrennt. Sie liegt weit
 * ueber der echten Dauer aller Abschnitte zusammen (Grundlinien-Test unten),
 * damit ihr Auftauchen eindeutig **einen** Abschnitt benennt.
 */
const DELAY_MS = 40;

/**
 * Der Zeitfresser, den die Modul-Huellen benutzen. Er liegt in `vi.hoisted`,
 * weil die Huellen beim Import der Engine entstehen — also bevor der Rumpf
 * dieser Datei laeuft.
 */
const probe = vi.hoisted(() => {
  const state = { step: null, delayMs: 0, fixpointReturned: false };

  /** Verbrennt `ms` echte Millisekunden — Zeit, die jede Uhr sieht. */
  function burn(ms) {
    const until = performance.now() + ms;
    while (performance.now() < until) {
      // absichtlich leere Warteschleife: sie soll Zeit kosten, nichts tun
    }
  }

  return {
    /** Stellt genau einen Schritt scharf. */
    arm(step, delayMs) {
      state.step = step;
      state.delayMs = delayMs;
      state.fixpointReturned = false;
    },
    /** Kein Schritt kostet mehr Zeit — der Grundlinien-Zustand. */
    disarm() {
      state.step = null;
      state.delayMs = 0;
      state.fixpointReturned = false;
    },
    /** Verbrennt die Zeitspanne, wenn `step` der scharf gestellte Schritt ist. */
    spend(step) {
      if (state.step === step) burn(state.delayMs);
    },
    noteFixpointReturned() {
      state.fixpointReturned = true;
    },
    hasFixpointReturned() {
      return state.fixpointReturned;
    },
  };
});

// ── Die neun Schritte, je in ihrer Huelle ────────────────────────────────────
// Die Huelle ruft immer den echten Schritt: die Auswertung selbst bleibt
// unveraendert, gemessen wird allein, wo die verbrannte Zeit landet.

vi.mock('./evalTree.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildEvalTree(...args) {
      const result = actual.buildEvalTree(...args);
      probe.spend('buildEvalTree');
      return result;
    },
  };
});

vi.mock('./fixpoint.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    evaluateToFixpoint(...args) {
      const result = actual.evaluateToFixpoint(...args);
      // Ab hier ist jeder weitere `buildIndex` der eine Aufruf der Fassade.
      probe.noteFixpointReturned();
      probe.spend('evaluateToFixpoint');
      return result;
    },
    applyAnchorPostPass(...args) {
      const result = actual.applyAnchorPostPass(...args);
      probe.spend('applyAnchorPostPass');
      return result;
    },
  };
});

vi.mock('./countIndex.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildIndex(...args) {
      const result = actual.buildIndex(...args);
      // Die Index-Bauten INNERHALB der Schleife gehoeren zu `evaluateToFixpoint`;
      // gemeint ist der finale Index der Fassade.
      if (probe.hasFixpointReturned()) probe.spend('buildIndex');
      return result;
    },
  };
});

vi.mock('./offer.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    attachOfferAnchors(...args) {
      const result = actual.attachOfferAnchors(...args);
      probe.spend('attachOfferAnchors');
      return result;
    },
  };
});

vi.mock('./effectiveState.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    extendBaseEffectiveState(...args) {
      const result = actual.extendBaseEffectiveState(...args);
      probe.spend('extendBaseEffectiveState');
      return result;
    },
  };
});

vi.mock('./constraints.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    evaluateConstraints(...args) {
      const result = actual.evaluateConstraints(...args);
      probe.spend('evaluateConstraints');
      return result;
    },
  };
});

vi.mock('./budget.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    evaluateRosterBudget(...args) {
      const result = actual.evaluateRosterBudget(...args);
      probe.spend('evaluateRosterBudget');
      return result;
    },
  };
});

vi.mock('./report.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildReport(...args) {
      const result = actual.buildReport(...args);
      probe.spend('buildReport');
      return result;
    },
  };
});

// ── Datensatz und Roster ──────────────────────────────────────────────────────

const FORCE_ID = 'force-army';
const WARRIOR_ID = 'entry-warrior';
const BANNER_ID = 'entry-banner';

const CATALOGUE_XML = `<?xml version="1.0"?>
  <catalogue id="cat-phase-composition" name="Phase Composition">
    <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <constraints>
          <constraint id="max-warriors" type="max" value="2" field="selections" scope="roster"/>
        </constraints>
      </selectionEntry>
      <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade"/>
    </selectionEntries>
  </catalogue>`;

const DATASET = { catalogues: [CATALOGUE_XML] };
const ROSTER = {
  forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: WARRIOR_ID, count: 3, children: [] }] }],
};

/** Die Abschnitte, die `evaluate` selbst ausfuehrt. */
const EVALUATION_PHASES = [
  MeasuredPhase.ITERATED_EVALUATION,
  MeasuredPhase.POST_PASS,
  MeasuredPhase.CONSTRAINTS_AND_REPORT,
];

/** Die Zuordnung, die Kriterium 2 festlegt: welcher Schritt in welchem Abschnitt liegt. */
const COMPOSITION = [
  { step: 'buildEvalTree', phase: MeasuredPhase.ITERATED_EVALUATION },
  { step: 'evaluateToFixpoint', phase: MeasuredPhase.ITERATED_EVALUATION },
  { step: 'buildIndex', phase: MeasuredPhase.ITERATED_EVALUATION },
  { step: 'attachOfferAnchors', phase: MeasuredPhase.POST_PASS },
  { step: 'extendBaseEffectiveState', phase: MeasuredPhase.POST_PASS },
  { step: 'applyAnchorPostPass', phase: MeasuredPhase.POST_PASS },
  { step: 'evaluateConstraints', phase: MeasuredPhase.CONSTRAINTS_AND_REPORT },
  { step: 'evaluateRosterBudget', phase: MeasuredPhase.CONSTRAINTS_AND_REPORT },
  { step: 'buildReport', phase: MeasuredPhase.CONSTRAINTS_AND_REPORT },
];

/** Die gemessenen Dauern eines Laufs. */
function measuredPhases() {
  const measured = evaluate(prepareDataset(DATASET), ROSTER, { measure: true });
  expect(measured.measurement, 'Das Ergebnis traegt kein `measurement`-Feld.').toBeDefined();
  return measured.measurement.phases;
}

afterEach(() => {
  probe.disarm();
});

describe('Zusammensetzung der gemessenen Abschnitte', () => {
  it('misst ohne verbrannte Zeit jeden Abschnitt deutlich unter der Pruefspanne', () => {
    // Die Grundlinie, ohne die die Zuordnung unten nichts hiesse: kein Abschnitt
    // erreicht die Pruefspanne von sich aus.
    const phases = measuredPhases();

    for (const phase of EVALUATION_PHASES) {
      expect(phases[phase], `Abschnitt ${phase} ist schon ohne Zutun zu langsam fuer diesen Test`)
        .toBeLessThan(DELAY_MS);
    }
  });

  it.each(COMPOSITION)('rechnet $step dem Abschnitt „$phase" zu — und keinem anderen', ({ step, phase }) => {
    probe.arm(step, DELAY_MS);

    const phases = measuredPhases();

    expect(phases[phase], `Die Zeit von ${step} taucht im Abschnitt ${phase} nicht auf — der Schritt liegt ausserhalb.`)
      .toBeGreaterThanOrEqual(DELAY_MS);
    for (const other of EVALUATION_PHASES.filter(candidate => candidate !== phase)) {
      expect(phases[other], `Die Zeit von ${step} taucht faelschlich im Abschnitt ${other} auf.`)
        .toBeLessThan(DELAY_MS);
    }
  });
});
