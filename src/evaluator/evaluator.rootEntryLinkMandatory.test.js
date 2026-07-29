/**
 * Issue 0085 — „Pflichteinheit als Wurzel-`entryLink` erzeugt keinen Verstoss".
 *
 * `docs/battlescribe-data-format.md` §9.9 kennt **zwei** gleichwertige
 * Kodierungen der armee- bzw. kontingentweiten Pflichteinheit: der
 * `min`-Constraint haengt an einem Wurzel-`selectionEntry` **oder** an einem
 * Wurzel-`entryLink` (Basis `min="0"`, per Link-Modifier angehoben). Die
 * `selectionEntry`-Form ist gepinnt (`phantom.test.js`); die `entryLink`-Form
 * meldet heute **nichts** — eine Liste ohne die Pflichteinheit ist stumm gruen.
 *
 * Beobachtet wird ausschliesslich die echte Fassade (`prepareDataset` +
 * `evaluate`): die Meldungsliste `report.violations`. Anker-Pfade und Ankerart
 * sind bewusst **nicht** gepinnt — die Kriterien sagen nichts darueber, sie
 * bleiben Sache der Umsetzung.
 *
 * Damit auch die *negativen* Faelle (kein Verstoss) heute rot sind und nicht
 * bloss zufaellig gruen, traegt jeder Katalog eine **zweite, unabhaengige
 * Wurzel-Link-Pflicht** als positive Kontrolle mit: die Behauptung ist dann
 * stets „genau diese Meldungen, keine weiteren".
 *
 * Gepinnt aus dem Intent:
 * - Kriterium 1: Wurzel-`entryLink` mit effektivem `min > 0` (`roster` und
 *   `force`, Entscheidung D1), Zieleinheit fehlt ⇒ blockierender Verstoss
 *   (Schweregrad `error`), Ist 0 gegen die Grenze.
 * - Kriterium 2: ausgewertet werden Grenzen **und Modifier des Links**; die
 *   **eigene `min`-Grenze des Ziels** feuert an dieser Wurzelform *nicht* mit.
 * - Kriterium 3 / D3: dieselbe Pflicht in beiden Wurzelformen ⇒ genau ein
 *   Verstoss, entdoppelt ueber die aufgeloeste Ziel-Id **plus Rahmen**.
 * - D5: Anwesenheit unterdrueckt den Verstoss — unter der **Link-Id** wie unter
 *   der **aufgeloesten Ziel-Id**.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { MessageSeverity } from './model.js';

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

// ── Ids ──────────────────────────────────────────────────────────────────────

const BULLS_TARGET_ID = 'target-bulls';   // Zieleinheit des Wurzel-Links
const BULLS_LINK_ID = 'link-bulls';       // der Wurzel-`entryLink` auf sie
const MIN_BULLS_LINK = 'min-bulls-link';  // die Grenze AM Link
const MIN_BULLS_TARGET = 'min-bulls-target'; // die eigene Grenze des ZIELS

const GORGERS_TARGET_ID = 'shared-gorgers'; // zweite, unabhaengige Pflicht
const GORGERS_LINK_ID = 'link-gorgers';
const MIN_GORGERS_LINK = 'min-gorgers-link';

const TYRANT_ID = 'entry-tyrant';   // schaltet die bedingte Anhebung
const WARRIOR_ID = 'entry-warrior'; // heilt gar nichts
const FORCE_ID = 'force-army';

/**
 * Der Repro-Katalog: die Zieleinheiten liegen im geteilten Pool, die Pflicht
 * haengt an den **Wurzel-`entryLink`s** (§9.9, zweite Kodierung). Die zweite
 * Pflicht („Gorgers") ist die positive Kontrolle, an der jeder negative Fall
 * beweist, dass ueberhaupt ausgewertet wurde.
 */
function catalogXml({
  bullsLinkBodyXml,
  bullsTargetConstraintsXml = '',
  gorgersScope = 'roster',
  withForceEntry = false,
} = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0085" name="Root Entry Link Mandatory Catalogue">
      ${withForceEntry ? `<forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>` : ''}
      <sharedSelectionEntries>
        <selectionEntry id="${BULLS_TARGET_ID}" name="Ogre Bulls" type="unit">
          ${bullsTargetConstraintsXml}
        </selectionEntry>
        <selectionEntry id="${GORGERS_TARGET_ID}" name="Gorgers" type="unit"/>
      </sharedSelectionEntries>
      <selectionEntries>
        <selectionEntry id="${TYRANT_ID}" name="Tyrant" type="unit"/>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit"/>
      </selectionEntries>
      <entryLinks>
        <entryLink id="${BULLS_LINK_ID}" name="Ogre Bulls" type="selectionEntry" targetId="${BULLS_TARGET_ID}">
          ${bullsLinkBodyXml}
        </entryLink>
        <entryLink id="${GORGERS_LINK_ID}" name="Gorgers" type="selectionEntry" targetId="${GORGERS_TARGET_ID}">
          <constraints>
            <constraint id="${MIN_GORGERS_LINK}" type="min" value="1" field="selections" scope="${gorgersScope}" shared="true"/>
          </constraints>
        </entryLink>
      </entryLinks>
    </catalogue>`;
}

/** Die Grenze am Link, unbedingt. */
function linkMin(value, scope = 'roster') {
  return `<constraints>
    <constraint id="${MIN_BULLS_LINK}" type="min" value="${value}" field="selections" scope="${scope}" shared="true"/>
  </constraints>`;
}

/**
 * Basis `min="0"` am Link, per Link-`modifier` auf 1 gesetzt — gegatet darauf,
 * dass ein Tyrant im Roster steht (§9.9: „Basis `min=0`, per Link-`modifier`
 * … auf 1 angehoben"). Das synthetische Gegenstueck zur Ogerbullen-Pflicht der
 * „Definitive Edition".
 */
function conditionalLinkMin(scope = 'roster') {
  return `<constraints>
      <constraint id="${MIN_BULLS_LINK}" type="min" value="0" field="selections" scope="${scope}" shared="true"/>
    </constraints>
    <modifiers>
      <modifier type="set" field="${MIN_BULLS_LINK}" value="1">
        <conditions>
          <condition type="atLeast" field="selections" scope="roster" childId="${TYRANT_ID}" value="1"/>
        </conditions>
      </modifier>
    </modifiers>`;
}

/** Ein Roster ohne Kontingent-Definition: die Auswahlen haengen direkt am Roster. */
function roster(children) {
  return { forces: children };
}

/** Eine Auswahl gegebener Definition. */
function selection(defId, count = 1) {
  return { defId, count, children: [] };
}

/** Ein Roster aus `n` Kontingenten „Army" mit den jeweiligen Kind-Auswahlen. */
function rosterWithForces(childrenPerForce) {
  return {
    forces: childrenPerForce.map(children => ({ defId: FORCE_ID, count: 1, children })),
  };
}

// ── Kriterium 1: die Pflicht schlaegt an, wenn die Zieleinheit fehlt ─────────

describe('Kriterium 1: Wurzel-entryLink mit min>0, Zieleinheit fehlt (scope="roster")', () => {
  const CATALOGUE = catalogXml({ bullsLinkBodyXml: linkMin(1) });

  it('leeres Roster: die Grenze DES LINKS meldet einen blockierenden Verstoss (Ist 0 gegen 1)', () => {
    // Heute rot: `violations` ist leer — der Wurzel-Link bekommt kein
    // Pflicht-Phantom, sein Angebots-Anker ist nach ADR-0035 nicht meldefaehig.
    const report = evaluate(CATALOGUE, { forces: [] });

    const messages = messagesOf(report, MIN_BULLS_LINK);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      actual: 0,
      bound: 1,
      severity: MessageSeverity.ERROR, // „blockierender Verstoss"
    });
  });

  it('Roster mit anderen Einheiten: die Absenz bleibt ein Verstoss, jede Wurzel-Pflicht genau einmal', () => {
    // Fremde Auswahlen heilen die Pflicht nicht. Zugleich die Grenze nach oben:
    // die Meldungsliste enthaelt GENAU die beiden Wurzel-Link-Pflichten, keine
    // Doppelmeldung (heute rot: die Liste ist leer).
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 3)]));

    expect(limitIdsOf(report)).toEqual([MIN_BULLS_LINK, MIN_GORGERS_LINK].sort());
  });

  it('hoehere Grenze: der Verstoss nennt den Grenzwert des Links (Ist 0 gegen 2)', () => {
    // Der Grenzwert kommt aus dem Constraint AM LINK — nicht aus einer
    // Normierung auf 1 (heute rot: keine Meldung).
    const report = evaluate(catalogXml({ bullsLinkBodyXml: linkMin(2) }), { forces: [] });

    const messages = messagesOf(report, MIN_BULLS_LINK);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 2 });
  });
});

describe('Kriterium 1 / D1: derselbe Wurzel-Link im Kontingent-Rahmen (scope="force")', () => {
  const CATALOGUE = catalogXml({
    bullsLinkBodyXml: linkMin(1, 'force'),
    gorgersScope: 'force',
    withForceEntry: true,
  });

  it('ein leeres Kontingent: die Pflicht des Links meldet einmal (Ist 0 gegen 1)', () => {
    // Heute rot: keine Meldung. D1 — beide Rahmen werden unterstuetzt.
    const report = evaluate(CATALOGUE, rosterWithForces([[]]));

    const messages = messagesOf(report, MIN_BULLS_LINK);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1, severity: MessageSeverity.ERROR });
  });

  it('zwei leere Kontingente: je Kontingent ein eigener Verstoss (Kriterium 1: „im jeweiligen Rahmen")', () => {
    // Heute rot: keine Meldung. Der Rahmen ist das einzelne Kontingent — die
    // Entdopplung aus Kriterium 3 laeuft ueber Ziel-Id PLUS Rahmen (D3) und
    // darf zwei verschiedene Kontingente deshalb nicht zusammenziehen.
    const report = evaluate(CATALOGUE, rosterWithForces([[], []]));

    const messages = messagesOf(report, MIN_BULLS_LINK);
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message).toMatchObject({ actual: 0, bound: 1 });
    }
  });

  it('nur ein Kontingent fuehrt die Einheit: genau ein Verstoss — der des leeren Kontingents', () => {
    // Heute rot: keine Meldung. Zugleich D5 im Kontingent-Rahmen: die Auswahl
    // traegt die LINK-Id und unterdrueckt die Pflicht in ihrem Kontingent.
    const report = evaluate(CATALOGUE, rosterWithForces([[selection(BULLS_LINK_ID)], []]));

    expect(messagesOf(report, MIN_BULLS_LINK)).toHaveLength(1);
  });
});

// ── Kriterium 2: die Grenzen und Modifier DES LINKS, nicht die des Ziels ────

describe('Kriterium 2: die bedingte Anhebung von Basis min=0 auf 1 greift (Link-Modifier)', () => {
  const CATALOGUE = catalogXml({ bullsLinkBodyXml: conditionalLinkMin() });

  it('Bedingung erfuellt (Tyrant im Roster): die angehobene Pflicht meldet (Ist 0 gegen 1)', () => {
    // Heute rot: keine Meldung. §9.9: die Modifier DES LINKS werden ausgewertet.
    const report = evaluate(CATALOGUE, roster([selection(TYRANT_ID)]));

    const messages = messagesOf(report, MIN_BULLS_LINK);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
  });

  it('Bedingung nicht erfuellt (kein Tyrant): KEIN Verstoss — die Kontroll-Pflicht meldet trotzdem', () => {
    // Heute rot: die Liste ist leer, statt die Kontroll-Pflicht zu enthalten.
    // Der Beweis, dass ausgewertet wurde UND die ungegatete Basis 0 bleibt.
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID)]));

    expect(limitIdsOf(report)).toEqual([MIN_GORGERS_LINK]);
    expect(messagesOf(report, MIN_BULLS_LINK)).toHaveLength(0);
  });

  it('Bedingung erfuellt, Einheit aber vorhanden: kein Verstoss trotz angehobener Grenze', () => {
    // Heute rot (die Kontroll-Pflicht fehlt in der Liste).
    const report = evaluate(CATALOGUE, roster([selection(TYRANT_ID), selection(BULLS_LINK_ID)]));

    expect(limitIdsOf(report)).toEqual([MIN_GORGERS_LINK]);
  });
});

describe('Kriterium 2: die eigene min-Grenze des ZIELS feuert an dieser Wurzelform NICHT mit', () => {
  // Der im Intent ausgeschriebene Bruch der naheliegenden Loesung: Wurzel-Link
  // `min=1` auf ein Ziel mit eigenem `min=3` ⇒ EIN Verstoss gegen 1, nicht zwei.
  const TARGET_OWN_MIN = `<constraints>
    <constraint id="${MIN_BULLS_TARGET}" type="min" value="3" field="selections" scope="roster" shared="true"/>
  </constraints>`;
  const CATALOGUE = catalogXml({
    bullsLinkBodyXml: linkMin(1),
    bullsTargetConstraintsXml: TARGET_OWN_MIN,
  });

  it('leeres Roster: genau EINE Bullen-Meldung, gegen die Grenze DES LINKS (1), nicht gegen 3', () => {
    // Heute rot, aber aus dem anderen Grund (gar keine Meldung); mit der naiven
    // Loesung rot aus DIESEM Grund (zwei Meldungen: 1 und 3).
    const report = evaluate(CATALOGUE, { forces: [] });

    expect(messagesOf(report, MIN_BULLS_TARGET)).toHaveLength(0);
    const messages = messagesOf(report, MIN_BULLS_LINK);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
  });

  it('leeres Roster: die gesamte Meldungsliste sind die zwei Wurzel-Link-Pflichten', () => {
    // Die Grenze nach oben: keine dritte Meldung aus der geerbten Zielgrenze
    // (ADR-0032 — ein nur geteilter Eintrag synthetisiert keine Pflicht).
    const report = evaluate(CATALOGUE, { forces: [] });

    expect(limitIdsOf(report)).toEqual([MIN_BULLS_LINK, MIN_GORGERS_LINK].sort());
  });
});

describe('Kriterium 1, negativ: ein Wurzel-Link mit effektivem min=0 erzeugt gar nichts', () => {
  it('Basis min=0 ohne Modifier: nur die Kontroll-Pflicht meldet', () => {
    // Heute rot: die Liste ist leer statt die Kontroll-Pflicht zu enthalten.
    const report = evaluate(catalogXml({ bullsLinkBodyXml: linkMin(0) }), { forces: [] });

    expect(limitIdsOf(report)).toEqual([MIN_GORGERS_LINK]);
  });

  it('Wurzel-Link ganz ohne Grenzen: nur die Kontroll-Pflicht meldet', () => {
    const report = evaluate(catalogXml({ bullsLinkBodyXml: '' }), { forces: [] });

    expect(limitIdsOf(report)).toEqual([MIN_GORGERS_LINK]);
  });
});

// ── D5: Anwesenheit unterdrueckt — unter Link-Id wie unter Ziel-Id ──────────

describe('D5: die vorhandene Einheit unterdrueckt den Verstoss', () => {
  const CATALOGUE = catalogXml({ bullsLinkBodyXml: linkMin(1) });

  it('Auswahl unter der LINK-Id: die Bullen-Pflicht schweigt, die Kontroll-Pflicht meldet', () => {
    // Heute rot: die Liste ist leer statt die Kontroll-Pflicht zu enthalten.
    const report = evaluate(CATALOGUE, roster([selection(BULLS_LINK_ID)]));

    expect(limitIdsOf(report)).toEqual([MIN_GORGERS_LINK]);
  });

  it('Auswahl unter der aufgeloesten ZIEL-Id: die Bullen-Pflicht schweigt ebenfalls (D5)', () => {
    // D5: „Abwesenheit zaehlt ueber Link-Id UND aufgeloeste Ziel-Id" — zaehlte
    // der Anker nur die Link-Id, feuerte er hier faelschlich.
    const report = evaluate(CATALOGUE, roster([selection(BULLS_TARGET_ID)]));

    expect(limitIdsOf(report)).toEqual([MIN_GORGERS_LINK]);
  });
});

// ── Kriterium 3 / D3: Entdopplung ueber die aufgeloeste Ziel-Id plus Rahmen ──

/**
 * Derselbe Katalog fuehrt die Pflicht in **beiden** Wurzelformen: ein
 * Wurzel-`selectionEntry` mit eigener `min`-Grenze UND ein Wurzel-`entryLink`
 * auf genau diesen Eintrag mit eigener `min`-Grenze. Die zweite, unabhaengige
 * Wurzel-Link-Pflicht („Gorgers") bleibt als Kontrolle daneben stehen.
 */
function dualRootFormCatalogXml({ linkScope = 'roster', withForceEntry = false } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0085-dual" name="Dual Root Form Catalogue">
      ${withForceEntry ? `<forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>` : ''}
      <sharedSelectionEntries>
        <selectionEntry id="${GORGERS_TARGET_ID}" name="Gorgers" type="unit"/>
      </sharedSelectionEntries>
      <selectionEntries>
        <selectionEntry id="${BULLS_TARGET_ID}" name="Ogre Bulls" type="unit">
          <constraints>
            <constraint id="${MIN_BULLS_TARGET}" type="min" value="1" field="selections" scope="roster" shared="true"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit"/>
      </selectionEntries>
      <entryLinks>
        <entryLink id="${BULLS_LINK_ID}" name="Ogre Bulls" type="selectionEntry" targetId="${BULLS_TARGET_ID}">
          <constraints>
            <constraint id="${MIN_BULLS_LINK}" type="min" value="1" field="selections" scope="${linkScope}" shared="true"/>
          </constraints>
        </entryLink>
        <entryLink id="${GORGERS_LINK_ID}" name="Gorgers" type="selectionEntry" targetId="${GORGERS_TARGET_ID}">
          <constraints>
            <constraint id="${MIN_GORGERS_LINK}" type="min" value="1" field="selections" scope="roster" shared="true"/>
          </constraints>
        </entryLink>
      </entryLinks>
    </catalogue>`;
}

describe('Kriterium 3: dieselbe Pflicht in beiden Wurzelformen wird ueber die Ziel-Id entdoppelt', () => {
  it('gleicher Rahmen (beide roster), leeres Roster: genau EIN Bullen-Verstoss — zusammen mit der Kontrolle zwei', () => {
    // Heute rot: nur die `selectionEntry`-Form meldet (eine Meldung), die
    // Kontroll-Pflicht des zweiten Wurzel-Links fehlt ganz.
    // Bliebe die Entdopplung aus, waeren es drei Meldungen.
    const report = evaluate(dualRootFormCatalogXml(), { forces: [] });

    expect(report.violations).toHaveLength(2);
    const bullsMessages = report.violations.filter(
      message => message.limitId === MIN_BULLS_LINK || message.limitId === MIN_BULLS_TARGET,
    );
    expect(bullsMessages).toHaveLength(1);
    expect(bullsMessages[0]).toMatchObject({ actual: 0, bound: 1 });
    expect(messagesOf(report, MIN_GORGERS_LINK)).toHaveLength(1);
  });

  it('verschiedene Rahmen (Eintrag roster, Link force): BEIDE melden — der Rahmen gehoert zum Schluessel (D3)', () => {
    // Heute rot: nur die roster-Grenze des Wurzel-Eintrags meldet (eine
    // Meldung). Entdoppelt wird ueber Ziel-Id PLUS Rahmen — zwei verschiedene
    // Rahmen sind zwei verschiedene Pflichten.
    const report = evaluate(
      dualRootFormCatalogXml({ linkScope: 'force', withForceEntry: true }),
      rosterWithForces([[]]),
    );

    expect(messagesOf(report, MIN_BULLS_TARGET)).toHaveLength(1);
    expect(messagesOf(report, MIN_BULLS_LINK)).toHaveLength(1);
  });

  it('beide Wurzelformen, Einheit unter der ZIEL-Id vorhanden: keine Bullen-Meldung (D5)', () => {
    // Genau der von D5 beschriebene Fall: „Fuehrt ein Katalog beide
    // Wurzelformen, kann dieselbe Einheit unter der Ziel-Id im Roster stehen".
    // Heute rot: die Kontroll-Pflicht fehlt in der Liste.
    const report = evaluate(dualRootFormCatalogXml(), roster([selection(BULLS_TARGET_ID)]));

    expect(limitIdsOf(report)).toEqual([MIN_GORGERS_LINK]);
  });
});
