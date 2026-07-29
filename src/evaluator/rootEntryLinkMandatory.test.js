/**
 * Armeeweite Pflichteinheit in der `entryLink`-Wurzelform (§9.9, Issue 85):
 * der `min`-Constraint haengt an einem Wurzel-`entryLink` statt an einem
 * Wurzel-`selectionEntry`. Beide Kodierungen sind gleichwertig — die Auswertung
 * muss auch die Link-Form einsammeln:
 *
 *  1. Ein Wurzel-`entryLink` mit effektivem `min > 0` (`scope="roster"` oder
 *     `scope="force"`), dessen Zieleinheit im jeweiligen Rahmen fehlt, erzeugt
 *     einen blockierenden Verstoss (Ist 0 gegen die Grenze).
 *  2. Ausgewertet werden die Grenzen und Modifier DES LINKS, nicht die des
 *     Ziels: die bedingte Anhebung von Basis `min=0` auf 1 greift, ohne
 *     erfuellte Bedingung entsteht kein Verstoss, und eine eigene `min`-Grenze
 *     des Ziels feuert am Link-Anker nicht mit.
 *  3. Fuehrt ein Katalog dieselbe Pflicht in beiden Wurzelformen, wird ueber
 *     die Ziel-Id entdoppelt: genau ein Verstoss.
 *
 * Synthetische Minimal-Kataloge wie in `crossCatalog.test.js` und
 * `phantom.test.js`; Auswahlen eines verlinkten Eintrags stehen im Roster
 * unter der eigenen Id des `entryLink` (vgl. `rosParser.entryLinkId.test.js`).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { MessageSeverity } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog gegen ein Roster aus. */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

const EMPTY_ARMY = { forces: [] };

const TARGET_ID = 'shared-ogre-bulls';
const TARGET_NAME = 'Ogerbullen';
const LINK_ID = 'link-ogre-bulls';
const LINK_MIN_LIMIT_ID = 'link-min-ogre-bulls';
const DETACHMENT_FORCE_ID = 'force-detachment';
const TRIGGER_ID = 'entry-trigger-unit';

/** Das geteilte Ziel der Pflicht — ohne eigene Grenzen. */
const SHARED_TARGET = `<sharedSelectionEntries>
    <selectionEntry id="${TARGET_ID}" name="${TARGET_NAME}" type="unit"/>
  </sharedSelectionEntries>`;

/** Ein Wurzel-`entryLink` mit fester `min`-Grenze im gegebenen Rahmen. */
function rootLinkWithMin(scope) {
  return `<entryLinks>
      <entryLink id="${LINK_ID}" name="${TARGET_NAME}" targetId="${TARGET_ID}" type="selectionEntry">
        <constraints>
          <constraint id="${LINK_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="${scope}"/>
        </constraints>
      </entryLink>
    </entryLinks>`;
}

describe('§9.9 Kriterium 1: Wurzel-entryLink mit min > 0, Zieleinheit fehlt', () => {
  it('scope="roster": fehlende Zieleinheit erzeugt genau einen blockierenden Verstoss, vorhandene keinen', () => {
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-link-roster" name="Link Roster Min">
        ${rootLinkWithMin('roster')}
        ${SHARED_TARGET}
      </catalogue>`;

    // Leere Armee: die Pflichteinheit fehlt ganz → Ist 0 gegen die Grenze 1.
    const missing = evaluate(catalogue, EMPTY_ARMY);
    expect(missing.violations).toHaveLength(1);
    expect(missing.violations[0]).toMatchObject({
      limitId: LINK_MIN_LIMIT_ID,
      severity: MessageSeverity.ERROR,
      actual: 0,
      bound: 1,
    });

    // Gegenprobe: die ueber genau diesen Link gewaehlte Einheit (Roster bindet
    // ueber die Link-Id, vgl. rosParser.entryLinkId.test.js) erfuellt die Pflicht.
    const present = evaluate(catalogue, { forces: [{ defId: LINK_ID, count: 1, children: [] }] });
    expect(present.violations).toHaveLength(0);
  });

  it('scope="force": nur das Kontingent ohne Zieleinheit wird verletzt', () => {
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-link-force" name="Link Force Min">
        <forceEntries>
          <forceEntry id="${DETACHMENT_FORCE_ID}" name="Detachment"/>
        </forceEntries>
        ${rootLinkWithMin('force')}
        ${SHARED_TARGET}
      </catalogue>`;

    // Kontingent A fuehrt die Einheit (ueber den Link), Kontingent B nicht:
    // genau eine Verletzung — die des leeren Kontingents.
    const report = evaluate(catalogue, {
      forces: [
        { defId: DETACHMENT_FORCE_ID, count: 1, children: [{ defId: LINK_ID, count: 1, children: [] }] },
        { defId: DETACHMENT_FORCE_ID, count: 1, children: [] },
      ],
    });

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      limitId: LINK_MIN_LIMIT_ID,
      severity: MessageSeverity.ERROR,
      actual: 0,
      bound: 1,
    });
  });
});

describe('§9.9 Kriterium 2: Grenzen und Modifier DES LINKS werden ausgewertet', () => {
  it('bedingte Anhebung von Basis min=0 auf 1 greift; ohne erfuellte Bedingung kein Verstoss', () => {
    // Die reale Kodierung der Definitive Edition: Basis min=0 am Link, per
    // Link-Modifier (gegatet auf eine andere Auswahl) auf 1 gesetzt (§7.7).
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-link-conditional" name="Link Conditional Min">
        <entryLinks>
          <entryLink id="${LINK_ID}" name="${TARGET_NAME}" targetId="${TARGET_ID}" type="selectionEntry">
            <constraints>
              <constraint id="${LINK_MIN_LIMIT_ID}" type="min" value="0" field="selections" scope="roster"/>
            </constraints>
            <modifiers>
              <modifier type="set" field="${LINK_MIN_LIMIT_ID}" value="1">
                <conditions>
                  <condition type="atLeast" value="1" field="selections" scope="roster"
                             childId="${TRIGGER_ID}" shared="true" includeChildSelections="true"/>
                </conditions>
              </modifier>
            </modifiers>
          </entryLink>
        </entryLinks>
        <selectionEntries>
          <selectionEntry id="${TRIGGER_ID}" name="Trigger Unit" type="unit"/>
        </selectionEntries>
        ${SHARED_TARGET}
      </catalogue>`;

    // Bedingung erfuellt (Trigger-Einheit liegt im Roster), Ziel fehlt:
    // das effektive min ist 1 → genau ein blockierender Verstoss.
    const triggered = evaluate(catalogue, { forces: [{ defId: TRIGGER_ID, count: 1, children: [] }] });
    expect(triggered.violations).toHaveLength(1);
    expect(triggered.violations[0]).toMatchObject({
      limitId: LINK_MIN_LIMIT_ID,
      severity: MessageSeverity.ERROR,
      actual: 0,
      bound: 1,
    });

    // Bedingung nicht erfuellt (leere Armee): das min bleibt auf der Basis 0 —
    // kein Verstoss, obwohl das Ziel ebenso fehlt.
    const untriggered = evaluate(catalogue, EMPTY_ARMY);
    expect(untriggered.violations).toHaveLength(0);
  });

  it('eine eigene min-Grenze des Ziels feuert am Link-Anker nicht mit: genau ein Verstoss, der des Links', () => {
    // Der Link traegt min=1; das geteilte Ziel traegt SELBST min=3 im gleichen
    // Rahmen. §9.9: am Link zaehlen Constraint und Modifier des Links, das Ziel
    // wird nur zur Namensaufloesung aufgeloest — die Zielgrenze darf weder
    // zusaetzlich feuern noch die Grenze des Links (1) ueberschreiben.
    const TARGET_OWN_MIN_LIMIT_ID = 'target-own-min';
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-link-vs-target" name="Link vs Target Limits">
        ${rootLinkWithMin('roster')}
        <sharedSelectionEntries>
          <selectionEntry id="${TARGET_ID}" name="${TARGET_NAME}" type="unit">
            <constraints>
              <constraint id="${TARGET_OWN_MIN_LIMIT_ID}" type="min" value="3" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </sharedSelectionEntries>
      </catalogue>`;

    const report = evaluate(catalogue, EMPTY_ARMY);

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      limitId: LINK_MIN_LIMIT_ID,
      actual: 0,
      bound: 1,
    });
  });
});

describe('§9.9 Kriterium 3: beide Wurzelformen derselben Pflicht werden ueber die Ziel-Id entdoppelt', () => {
  it('Wurzel-selectionEntry mit min UND Wurzel-entryLink auf denselben Eintrag: genau ein Verstoss', () => {
    // Vorbedingung im selben Test: die Link-Form allein feuert (sonst waere die
    // Entdopplung unbeobachtbar und der Test truegerisch gruen).
    const linkOnlyCatalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-dedup-linkonly" name="Dedup Link Only">
        ${rootLinkWithMin('roster')}
        ${SHARED_TARGET}
      </catalogue>`;
    expect(evaluate(linkOnlyCatalogue, EMPTY_ARMY).violations).toHaveLength(1);

    // Beide Formen im selben Katalog: der Wurzel-selectionEntry traegt die
    // Pflicht selbst (seine Ziel-Id ist seine eigene Id), der Wurzel-entryLink
    // zeigt auf genau diesen Eintrag und traegt dieselbe Pflicht als eigene
    // Grenze. Gleiche Ziel-Id ⇒ Entdopplung ⇒ genau EIN Verstoss, nicht zwei.
    const ROOT_ENTRY_ID = 'root-ogre-bulls';
    const ROOT_MIN_LIMIT_ID = 'root-min-ogre-bulls';
    const bothFormsCatalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-dedup-both" name="Dedup Both Forms">
        <selectionEntries>
          <selectionEntry id="${ROOT_ENTRY_ID}" name="${TARGET_NAME}" type="unit">
            <constraints>
              <constraint id="${ROOT_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
        <entryLinks>
          <entryLink id="${LINK_ID}" name="${TARGET_NAME}" targetId="${ROOT_ENTRY_ID}" type="selectionEntry">
            <constraints>
              <constraint id="${LINK_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
            </constraints>
          </entryLink>
        </entryLinks>
      </catalogue>`;

    const report = evaluate(bothFormsCatalogue, EMPTY_ARMY);

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ actual: 0, bound: 1 });
  });
});
