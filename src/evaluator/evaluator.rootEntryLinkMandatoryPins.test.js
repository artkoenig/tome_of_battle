/**
 * Issue 0085 — die **Mutationsproben** zur Wurzel-`entryLink`-Pflicht.
 *
 * Die Umsetzung des Issues traegt sechs Zusicherungen, die die bestehende Suite
 * nicht festhaelt: eine Mutation der Produktivstelle laesft grün durch (Review
 * Runde 1, Befunde 2–7). Jeder Test hier ist an **einer** solchen Stelle
 * aufgehaengt und faellt, wenn sie mutiert wird.
 *
 * Beobachtet wird wie im Schwesterfile ausschliesslich die echte Fassade
 * (`prepareDataset` + `evaluate`) — die Meldungsliste `report.violations`, die
 * Diagnosen und (fuer Befund 7, der keine Meldung aendert) die
 * Faehigkeitsdatensaetze `report.capabilities`.
 *
 * Zuordnung Befund → Stelle:
 * - Befund 2 / D11: verschiedene Grenzwerte sind **nicht** dieselbe Pflicht —
 *   die Entdopplung darf die strengere nicht verschlucken (`report.js`).
 * - Befund 3 / D3: der Entdopplungs-Schluessel nennt die **aufgeloeste**
 *   Ziel-Id, nicht die rohe `targetId` (`report.js`).
 * - Befund 4 / D7: entdoppelt werden **Wurzelformen, nicht Grenzen** — ein
 *   Anker behaelt alle seine eigenen Grenzen (`report.js`).
 * - Befund 5 / D1: der neue Anker ist auf **einen** Rahmen zugeschnitten
 *   (`limitScopeFilter`, `evalTree.js`).
 * - Befund 6 / D5: Abwesenheit zaehlt ueber Link-Id, rohe Ziel-Id **und**
 *   aufgeloeste Ziel-Id (`rosterIdentityIdsOf`, `evalTree.js`).
 * - Befund 7 / D2: der Anker entsteht nur fuer eine **eigene** MIN-Grenze des
 *   Links (`hasOwnMinLimitInFrame`, `evalTree.js`).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { diagnosticsMatching } from './__fixtures__/e2eReport.js';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind, DiagnosticKind, ScopeKeyword } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Die Meldungen des Berichts zu einer Grenz-Id. */
function messagesOf(report, limitId) {
  return report.violations.filter(message => message.limitId === limitId);
}

/** Die Grenz-Ids aller Meldungen, sortiert — die vollstaendige Meldungsliste. */
function limitIdsOf(report) {
  return report.violations.map(message => message.limitId).sort();
}

/** Die Faehigkeitsdatensaetze einer Ankerart, als `[Pfad, Datensatz]`-Paare. */
function slotsOfAnchorKind(report, anchorKind) {
  return [...report.capabilities].filter(([, capability]) => capability.anchorKind === anchorKind);
}

/** Ein Roster aus `n` Kontingenten „Army" mit den jeweiligen Kind-Auswahlen. */
function rosterWithForces(childrenPerForce) {
  return {
    forces: childrenPerForce.map(children => ({ defId: 'force-army', count: 1, children })),
  };
}

/** Eine Auswahl gegebener Definition. */
function selection(defId, count = 1) {
  return { defId, count, children: [] };
}

const FORCE_ENTRIES = '<forceEntries><forceEntry id="force-army" name="Army"/></forceEntries>';

// ── Befund 2 / D11: verschiedene Grenzwerte werden nicht entdoppelt ──────────

/**
 * Derselbe Katalog fuehrt die Pflicht in **beiden** Wurzelformen (§9.9), aber
 * mit **verschiedenen** Grenzwerten: der Wurzel-`selectionEntry` verlangt 1, der
 * Wurzel-`entryLink` auf ihn verlangt 2.
 */
const DIFFERING_BOUNDS_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-0085-d11" name="Differing Bounds Catalogue">
    <selectionEntries>
      <selectionEntry id="bulls" name="Ogre Bulls" type="unit">
        <constraints>
          <constraint id="min-entry" type="min" value="1" field="selections" scope="roster" shared="true"/>
        </constraints>
      </selectionEntry>
    </selectionEntries>
    <entryLinks>
      <entryLink id="link-bulls" name="Ogre Bulls" type="selectionEntry" targetId="bulls">
        <constraints>
          <constraint id="min-link" type="min" value="2" field="selections" scope="roster" shared="true"/>
        </constraints>
      </entryLink>
    </entryLinks>
  </catalogue>`;

describe('D11: zwei Wurzelformen mit verschiedenen Grenzwerten sind zwei Pflichten', () => {
  it('leeres Roster: BEIDE Meldungen stehen — die strengere (0 von 2) wird nicht verschluckt', () => {
    // D11: die Entdopplung fasst zwei Wurzelform-Meldungen nur zusammen, wenn
    // ihre effektive Grenze gleich ist. „0 von 1" zu melden und „0 von 2"
    // stumm fallen zu lassen ist die schlechteste aller Ausgaben — der Nutzer
    // erfuellt die gemeldete Grenze und die Liste bleibt illegal.
    const report = evaluate(DIFFERING_BOUNDS_CATALOGUE, { forces: [] });

    expect(limitIdsOf(report)).toEqual(['min-entry', 'min-link']);
    expect(messagesOf(report, 'min-entry')[0]).toMatchObject({ actual: 0, bound: 1 });
    expect(messagesOf(report, 'min-link')[0]).toMatchObject({ actual: 0, bound: 2 });
  });
});

// ── Befund 3 / D3: entdoppelt wird ueber die AUFGELOESTE Ziel-Id ─────────────

/**
 * Eine **Verweiskette**: der Wurzel-Link `l1` traegt die Pflicht und zeigt auf
 * `l2`, der erst auf den Wurzel-Eintrag `bulls` zeigt. Damit laufen rohe
 * `targetId` (`l2`) und aufgeloeste Ziel-Id (`bulls`) auseinander — nur ueber
 * die aufgeloeste treffen sich die beiden Wurzelformen (D3).
 */
const LINK_CHAIN_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-0085-chain" name="Link Chain Catalogue">
    <selectionEntries>
      <selectionEntry id="bulls" name="Ogre Bulls" type="unit">
        <constraints>
          <constraint id="min-entry" type="min" value="1" field="selections" scope="roster" shared="true"/>
        </constraints>
      </selectionEntry>
    </selectionEntries>
    <entryLinks>
      <entryLink id="l1" name="Ogre Bulls (via chain)" type="selectionEntry" targetId="l2">
        <constraints>
          <constraint id="min-link" type="min" value="1" field="selections" scope="roster" shared="true"/>
        </constraints>
      </entryLink>
      <entryLink id="l2" name="Ogre Bulls (relay)" type="selectionEntry" targetId="bulls"/>
    </entryLinks>
  </catalogue>`;

describe('D3: die Entdopplung schluesselt auf die aufgeloeste Ziel-Id, nicht die rohe targetId', () => {
  it('Kette l1 → l2 → bulls, leeres Roster: genau EINE Bullen-Meldung', () => {
    // Beide Wurzelformen meinen dieselbe Einheit `bulls` und dieselbe Grenze 1.
    // Ueber die rohe `targetId` (`l2`) getroffen sie sich nie — die Meldung
    // erschiene doppelt.
    const report = evaluate(LINK_CHAIN_CATALOGUE, { forces: [] });

    expect(limitIdsOf(report)).toEqual(['min-entry']);
    expect(messagesOf(report, 'min-entry')[0]).toMatchObject({ actual: 0, bound: 1 });
  });
});

// ── Befund 4 / D7: ein Anker behaelt ALLE seine eigenen Grenzen ──────────────

/**
 * Ein Wurzel-`entryLink` mit **zwei eigenen** MIN-Grenzen im selben Rahmen. Beide
 * haengen am selben Anker; die Entdopplung entdoppelt **Wurzelformen**, nicht
 * Grenzen — die zweite Grenze desselben Ankers darf nicht verschwinden.
 */
const TWO_OWN_MINS_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-0085-two-mins" name="Two Own Mins Catalogue">
    ${FORCE_ENTRIES}
    <sharedSelectionEntries>
      <selectionEntry id="bulls" name="Ogre Bulls" type="unit"/>
    </sharedSelectionEntries>
    <entryLinks>
      <entryLink id="link-bulls" name="Ogre Bulls" type="selectionEntry" targetId="bulls">
        <constraints>
          <constraint id="min-force-a" type="min" value="1" field="selections" scope="force" shared="true"/>
          <constraint id="min-force-b" type="min" value="2" field="selections" scope="force" shared="true"/>
        </constraints>
      </entryLink>
    </entryLinks>
  </catalogue>`;

describe('D7: entdoppelt werden Wurzelformen, nicht Grenzen', () => {
  it('ein Anker mit zwei eigenen MIN-Grenzen: BEIDE Grenzen melden', () => {
    // Beide Meldungen haengen am selben Anker und tragen denselben
    // Entdopplungs-Schluessel (Rahmen + Ziel-Id). Wer den Schluessel ohne den
    // Anker-Vergleich anwendet, verliert die zweite Grenze — einen echten
    // Verstoss.
    const report = evaluate(TWO_OWN_MINS_CATALOGUE, rosterWithForces([[]]));

    expect(limitIdsOf(report)).toEqual(['min-force-a', 'min-force-b']);
    expect(messagesOf(report, 'min-force-a')[0]).toMatchObject({ actual: 0, bound: 1 });
    expect(messagesOf(report, 'min-force-b')[0]).toMatchObject({ actual: 0, bound: 2 });
  });
});

// ── Befund 5 / D1: der neue Anker ist auf EINEN Rahmen zugeschnitten ─────────

/**
 * Ein Wurzel-`entryLink` mit Grenzen in **beiden** Rahmen: armeeweit (roster)
 * und kontingentweit (force). Er bekommt je Rahmen einen eigenen Anker; ohne
 * den `limitScopeFilter` wertete jeder Anker jede Grenze aus.
 */
const BOTH_SCOPES_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-0085-both-scopes" name="Both Scopes Catalogue">
    ${FORCE_ENTRIES}
    <sharedSelectionEntries>
      <selectionEntry id="bulls" name="Ogre Bulls" type="unit"/>
    </sharedSelectionEntries>
    <entryLinks>
      <entryLink id="link-bulls" name="Ogre Bulls" type="selectionEntry" targetId="bulls">
        <constraints>
          <constraint id="min-roster" type="min" value="1" field="selections" scope="roster" shared="true"/>
          <constraint id="min-force" type="min" value="1" field="selections" scope="force" shared="true"/>
        </constraints>
      </entryLink>
    </entryLinks>
  </catalogue>`;

describe('Befund 5: der Rahmen-Zuschnitt des neuen Ankers (limitScopeFilter)', () => {
  it('ein Link mit roster- UND force-Grenze, ein leeres Kontingent: genau zwei Meldungen', () => {
    // Je Rahmen ein Anker, je Anker genau seine eigene Grenze. Ohne Zuschnitt
    // wertete jeder der beiden Anker beide Grenzen aus — vier Meldungen.
    const report = evaluate(BOTH_SCOPES_CATALOGUE, rosterWithForces([[]]));

    expect(limitIdsOf(report)).toEqual(['min-force', 'min-roster']);
    expect(messagesOf(report, 'min-roster')).toHaveLength(1);
    expect(messagesOf(report, 'min-force')).toHaveLength(1);
  });

  it('derselbe Fall: keine unechte unresolvedScope-Diagnose zum FORCE-Rahmen', () => {
    // Der rahmen-fremde Anker haette den FORCE-Rahmen an der Wurzel gelesen, wo
    // er nicht aufloest — eine Diagnose ueber einen Rahmen, den niemand
    // ausgewertet haben wollte. Eingeengt auf `scope` UND `targetId`, weil
    // `unresolvedScope` fuer *jeden* offenen Rahmen des Berichts entsteht: eine
    // breite Zusage („keine einzige Diagnose") faellt ueber jeden unabhaengigen
    // Rahmen desselben Datensatzes (`__fixtures__/e2eReport.js`, Lehre aus 077).
    const report = evaluate(BOTH_SCOPES_CATALOGUE, rosterWithForces([[]]));

    expect(diagnosticsMatching(report, DiagnosticKind.UNRESOLVED_SCOPE, {
      scope: ScopeKeyword.FORCE,
      targetId: 'bulls',
    })).toEqual([]);
  });
});

// ── Befund 6 / D5: Abwesenheit zaehlt ueber alle drei Identitaets-Ids ────────

/**
 * Dieselbe Verweiskette wie oben, aber **ohne** die zweite Wurzelform: nur der
 * Wurzel-Link `l1` traegt die Pflicht (`min=2`), sein rohes Ziel ist `l2`, sein
 * aufgeloestes `bulls`. Damit ist jede der drei Identitaets-Ids einzeln
 * pruefbar (D5).
 */
const IDENTITY_CHAIN_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-0085-identity" name="Roster Identity Catalogue">
    <sharedSelectionEntries>
      <selectionEntry id="bulls" name="Ogre Bulls" type="unit"/>
    </sharedSelectionEntries>
    <entryLinks>
      <entryLink id="l1" name="Ogre Bulls (via chain)" type="selectionEntry" targetId="l2">
        <constraints>
          <constraint id="min-link" type="min" value="2" field="selections" scope="roster" shared="true"/>
        </constraints>
      </entryLink>
      <entryLink id="l2" name="Ogre Bulls (relay)" type="selectionEntry" targetId="bulls"/>
    </entryLinks>
  </catalogue>`;

describe('D5: eine vorhandene Instanz unterdrueckt den Anker unter jeder ihrer Identitaets-Ids', () => {
  it('Instanz unter der LINK-Id: genau EINE Meldung (1 von 2), keine doppelte', () => {
    // Der reale Knoten wertet die Grenze des Links selbst aus. Entstuende
    // daneben noch ein Pflicht-Anker, traege der Bericht dieselbe Pflicht
    // zweimal. Dieser Fall haelt die **Link-Id** der Dreiheit fest; die beiden
    // anderen Ids sind hier folgenlos (die Link-Id allein macht den Rahmen
    // schon belegt) und stehen deshalb in den zwei Faellen darunter.
    const report = evaluate(IDENTITY_CHAIN_CATALOGUE, { forces: [selection('l1')] });

    const messages = messagesOf(report, 'min-link');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 1, bound: 2 });
  });

  it('Instanz unter der ROHEN Ziel-Id (l2): kein zusaetzlicher Pflicht-Anker', () => {
    // Die Einheit steht im Roster — unter der Id, auf die der Wurzel-Link roh
    // zeigt. Zaehlte die Abwesenheitspruefung diese Id nicht, entstuende ein
    // Pflicht-Anker neben der vorhandenen Auswahl und meldete sie ein zweites
    // Mal.
    const report = evaluate(IDENTITY_CHAIN_CATALOGUE, { forces: [selection('l2')] });

    expect(messagesOf(report, 'min-link')).toEqual([]);
  });

  it('Instanz unter der AUFGELOESTEN Ziel-Id (bulls): kein zusaetzlicher Pflicht-Anker', () => {
    // Dieselbe Einheit, diesmal unter dem Ende der Verweiskette gesetzt (D5:
    // „kann dieselbe Einheit unter der Ziel-Id im Roster stehen").
    const report = evaluate(IDENTITY_CHAIN_CATALOGUE, { forces: [selection('bulls')] });

    expect(messagesOf(report, 'min-link')).toEqual([]);
  });
});

// ── Befund 7 / D2: der Anker entsteht nur fuer eine EIGENE MIN-Grenze ────────

/**
 * Zwei Wurzel-`entryLink`s auf je eine geteilte Einheit:
 * - `link-inherited` traegt **selbst keine** Grenze; sein Ziel traegt eine
 *   armeeweite `min`-Grenze. Er darf keinen Pflicht-Anker bekommen — der Anker
 *   wertet ohnehin nur die eigenen Grenzen aus (`ownLimitsOnly`, D2) und
 *   haenge sonst da, ohne etwas auszuwerten.
 * - `link-own` traegt eine eigene Grenze und ist die Positivkontrolle: an ihm
 *   ist belegt, dass Pflicht-Anker in diesem Bericht ueberhaupt entstehen.
 */
const INHERITED_MIN_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-0085-inherited" name="Inherited Min Catalogue">
    <sharedSelectionEntries>
      <selectionEntry id="gorgers" name="Gorgers" type="unit">
        <constraints>
          <constraint id="min-target" type="min" value="1" field="selections" scope="roster" shared="true"/>
        </constraints>
      </selectionEntry>
      <selectionEntry id="bulls" name="Ogre Bulls" type="unit"/>
    </sharedSelectionEntries>
    <entryLinks>
      <entryLink id="link-inherited" name="Gorgers" type="selectionEntry" targetId="gorgers"/>
      <entryLink id="link-own" name="Ogre Bulls" type="selectionEntry" targetId="bulls">
        <constraints>
          <constraint id="min-own" type="min" value="1" field="selections" scope="roster" shared="true"/>
        </constraints>
      </entryLink>
    </entryLinks>
  </catalogue>`;

describe('D2: ein Wurzel-Link ohne eigene MIN-Grenze bekommt keinen Pflicht-Anker', () => {
  it('leeres Roster: der einzige Pflicht-Anker ist der des Links mit EIGENER Grenze', () => {
    // Beobachtet an den Faehigkeitsdatensaetzen, nicht an den Meldungen: der
    // ueberzaehlige Anker wertet nichts aus und aendert deshalb keine einzige
    // Meldung — sichtbar ist er allein als zusaetzlicher Slot.
    const report = evaluate(INHERITED_MIN_CATALOGUE, { forces: [] });

    const mandatorySlots = slotsOfAnchorKind(report, AnchorKind.MANDATORY_PHANTOM);
    expect(mandatorySlots.map(([, capability]) => capability.defId)).toEqual(['link-own']);
  });

  it('leeres Roster: die Meldungsliste bleibt die eine Pflicht des Links mit eigener Grenze', () => {
    // Die Gegenprobe zur Aussage oben: die geerbte Zielgrenze feuert an dieser
    // Wurzelform nicht mit (Kriterium 2 / D2).
    const report = evaluate(INHERITED_MIN_CATALOGUE, { forces: [] });

    expect(limitIdsOf(report)).toEqual(['min-own']);
  });
});
