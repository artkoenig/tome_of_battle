/**
 * Issue 0119: **eine gewaehlte, effektiv versteckte Auswahl erzeugt einen
 * Fehler.**
 *
 * Das BSData-Wiki (*Props: Hidden*) sagt beides in einem Satz: eine versteckte
 * Entitaet ist dem Nutzer nicht sichtbar, „and any already selected entries
 * will cause error showing up in error list in Roster Editor". Die erste
 * Haelfte davon fuehrt die Engine seit Issue 0088 — die Min-Grenze eines
 * versteckten Traegers wird nicht eingefordert (`constraints.js`); dieser Test
 * pinnt die **Gegenrichtung**: was trotzdem in der Liste liegt, wird gemeldet.
 *
 * Beobachtungsstelle ist die Meldungsliste des Berichts (`report.violations`)
 * mit dem Diskriminator `origin: 'hiddenSelection'` — dieselbe eine Liste, in
 * der auch Grenzen und Autor-Meldungen stehen (ADR-0034).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { AnchorKind, MessageOrigin, MessageSeverity } from '../../../../contexts/ruleengine/engine/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus. */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Die Meldungen ueber versteckte Auswahlen, in Berichtsreihenfolge. */
function hiddenSelectionsOf(report) {
  return report.violations.filter(message => message.origin === MessageOrigin.HIDDEN_SELECTION);
}

/** Der Faehigkeitsdatensatz eines belegten Slots je Definitions-Id. */
function occupiedCapabilityOf(report, defId) {
  for (const [path, capability] of report.capabilities) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) {
      return { path, capability };
    }
  }
  return null;
}

const FORCE_ID = 'force-army';
const SQUAD_ID = 'entry-squad';
const RELIC_ID = 'entry-relic';
const TOKEN_ID = 'entry-token';
const BANNER_ID = 'entry-banner';
const RELIC_LINK_ID = 'link-relic';
const GROUP_ID = 'group-lores';
const MEMBER_ID = 'entry-lore';

/**
 * Ein Katalog mit einem Kontingent und einem Traeger-Eintrag („Squad"), dessen
 * Rumpf der jeweilige Fall fuellt. Der frei waehlbare „Token" schaltet die
 * Aufdeck-Bedingungen der dynamischen Faelle.
 */
function catalogueWith({ squadBody = '', sharedEntries = '', squadAttrs = '' }) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-hidden-selection" name="Hidden Selection Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <sharedSelectionEntries>${sharedEntries}</sharedSelectionEntries>
      <selectionEntries>
        <selectionEntry id="${SQUAD_ID}" name="Squad" type="unit" ${squadAttrs}>${squadBody}</selectionEntry>
        <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;
}

/** Roster: ein Kontingent mit einem Squad, dessen Kinder der Fall bestimmt. */
function armyWith(squadChildren, { withToken = false } = {}) {
  const children = [{ defId: SQUAD_ID, count: 1, children: squadChildren }];
  if (withToken) children.push({ defId: TOKEN_ID, count: 1, children: [] });
  return { forces: [{ defId: FORCE_ID, count: 1, children }] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 1 — die versteckte Auswahl liegt im Roster und wird gemeldet
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 1: eine effektiv versteckte, gewaehlte Auswahl erzeugt einen blockierenden Verstoss', () => {
  const CATALOGUE = catalogueWith({
    squadBody: `<selectionEntries>
      <selectionEntry id="${RELIC_ID}" name="Relic" type="upgrade" hidden="true"/>
    </selectionEntries>`,
  });

  it('meldet die Auswahl, deren Definition `hidden="true"` traegt', () => {
    const report = evaluate(CATALOGUE, armyWith([{ defId: RELIC_ID, count: 1, children: [] }]));

    const messages = hiddenSelectionsOf(report);
    expect(messages).toHaveLength(1);
    expect(messages[0].anchor.defId).toBe(RELIC_ID);
    expect(messages[0].severity).toBe(MessageSeverity.ERROR);
    expect(messages[0].anchor.anchorKind).toBe(AnchorKind.OCCUPIED);
  });

  it('KONTROLLE: dieselbe Auswahl ohne `hidden` erzeugt keine Meldung', () => {
    const visibleCatalogue = catalogueWith({
      squadBody: `<selectionEntries>
        <selectionEntry id="${RELIC_ID}" name="Relic" type="upgrade"/>
      </selectionEntries>`,
    });

    const report = evaluate(visibleCatalogue, armyWith([{ defId: RELIC_ID, count: 1, children: [] }]));

    expect(hiddenSelectionsOf(report)).toHaveLength(0);
  });

  it('meldet nichts ueber die versteckte Definition, solange sie nicht in der Liste liegt', () => {
    const report = evaluate(CATALOGUE, armyWith([]));

    // Der Angebots-Anker der versteckten Option steht weiterhin im Bericht und
    // ist dort als versteckt markiert — eine Meldung waere er nicht wert: es
    // hat sie niemand gewaehlt.
    expect(hiddenSelectionsOf(report)).toHaveLength(0);
    const offer = [...report.capabilities.values()]
      .find(c => c.defId === RELIC_ID && c.anchorKind === AnchorKind.OFFER_ANCHOR);
    expect(offer?.isHidden).toBe(true);
  });

  it('meldet einen versteckten Traeger, aber nicht seine sichtbare Option darunter', () => {
    const nestedCatalogue = catalogueWith({
      squadAttrs: 'hidden="true"',
      squadBody: `<selectionEntries>
        <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade"/>
      </selectionEntries>`,
    });

    const report = evaluate(nestedCatalogue, armyWith([{ defId: BANNER_ID, count: 1, children: [] }]));

    expect(hiddenSelectionsOf(report).map(message => message.anchor.defId)).toEqual([SQUAD_ID]);
  });

  it('meldet je belegtem Slot einmal — nicht je Stueckzahl', () => {
    const report = evaluate(CATALOGUE, {
      forces: [{
        defId: FORCE_ID,
        count: 1,
        children: [
          { defId: SQUAD_ID, count: 1, children: [{ defId: RELIC_ID, count: 3, children: [] }] },
          { defId: SQUAD_ID, count: 1, children: [{ defId: RELIC_ID, count: 1, children: [] }] },
        ],
      }],
    });

    // Zwei Squads mit je einem Relic-Slot: zwei Meldungen. Die Stueckzahl 3 im
    // ersten Slot macht daraus keine vier.
    expect(hiddenSelectionsOf(report)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 2 — wird die Definition wieder sichtbar, verschwindet der Verstoss
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 2: die Meldung folgt dem effektiven Zustand, nicht dem Basiswert', () => {
  /** Das Relic ist versteckt und wird nur aufgedeckt, wenn der Token in der Armee liegt. */
  const GATED_CATALOGUE = catalogueWith({
    squadBody: `<selectionEntries>
      <selectionEntry id="${RELIC_ID}" name="Relic" type="upgrade" hidden="true">
        <modifiers>
          <modifier type="set" field="hidden" value="false">
            <conditions>
              <condition type="atLeast" value="1" field="selections" scope="roster" childId="${TOKEN_ID}"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
    </selectionEntries>`,
  });

  it('meldet, solange der Aufdeck-Modifikator nicht greift', () => {
    const report = evaluate(GATED_CATALOGUE, armyWith([{ defId: RELIC_ID, count: 1, children: [] }]));

    expect(hiddenSelectionsOf(report).map(message => message.anchor.defId)).toEqual([RELIC_ID]);
  });

  it('meldet nicht mehr, sobald ein Modifikator die Definition wieder sichtbar macht', () => {
    const report = evaluate(
      GATED_CATALOGUE,
      armyWith([{ defId: RELIC_ID, count: 1, children: [] }], { withToken: true }),
    );

    expect(occupiedCapabilityOf(report, RELIC_ID).capability.isHidden).toBe(false);
    expect(hiddenSelectionsOf(report)).toHaveLength(0);
  });

  it('meldet ein Mitglied, das nur eine versteckte Gruppe klammert', () => {
    const groupedCatalogue = catalogueWith({
      squadBody: `<selectionEntryGroups>
        <selectionEntryGroup id="${GROUP_ID}" name="Lores of Magic" hidden="true">
          <selectionEntries>
            <selectionEntry id="${MEMBER_ID}" name="Lore of Necromancy" type="upgrade"/>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>`,
    });

    const report = evaluate(groupedCatalogue, armyWith([{ defId: MEMBER_ID, count: 1, children: [] }]));

    // Die versteckte Gruppe versteckt, was sie haelt (§8) — das Mitglied traegt
    // selbst kein `hidden` und wird trotzdem gemeldet.
    expect(hiddenSelectionsOf(report).map(message => message.anchor.defId)).toEqual([MEMBER_ID]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 3 — benannt wird ueber stabile Merkmale, nicht ueber den Namen
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 3: der Verstoss benennt die Auswahl ueber stabile Merkmale', () => {
  it('traegt Definitions-Id und stabilen Pfad des belegten Slots', () => {
    const catalogue = catalogueWith({
      squadBody: `<selectionEntries>
        <selectionEntry id="${RELIC_ID}" name="Relic" type="upgrade" hidden="true">
          <modifiers>
            <modifier type="set" field="name" value="Verhuelltes Relikt"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>`,
    });

    const report = evaluate(catalogue, armyWith([{ defId: RELIC_ID, count: 1, children: [] }]));

    const [message] = hiddenSelectionsOf(report);
    const { path } = occupiedCapabilityOf(report, RELIC_ID);
    expect(message.anchor.defId).toBe(RELIC_ID);
    expect(message.anchor.path).toBe(path);
    // Der Name steht daneben — als **effektiver** Name, wie an jeder anderen
    // Meldung auch; die Identitaet der Auswahl haengt nicht an ihm.
    expect(message.anchor.name).toBe('Verhuelltes Relikt');
  });

  it('nennt bei einem Verweis die **Link**-Id, nicht die seines Ziels', () => {
    const linkedCatalogue = catalogueWith({
      sharedEntries: `<selectionEntry id="${RELIC_ID}" name="Relic" type="upgrade" hidden="true"/>`,
      squadBody: `<entryLinks>
        <entryLink id="${RELIC_LINK_ID}" name="Relic" hidden="false" targetId="${RELIC_ID}" type="selectionEntry"/>
      </entryLinks>`,
    });

    const report = evaluate(linkedCatalogue, armyWith([{ defId: RELIC_LINK_ID, count: 1, children: [] }]));

    // Verweis und Ziel wirken mit ODER (§8): das `hidden="false"` des Verweises
    // hebt das `hidden="true"` des Ziels nicht auf.
    const [message] = hiddenSelectionsOf(report);
    expect(message.anchor.defId).toBe(RELIC_LINK_ID);
  });

  it('traegt keines der Grenzen-Felder und keinen Text', () => {
    const catalogue = catalogueWith({
      squadBody: `<selectionEntries>
        <selectionEntry id="${RELIC_ID}" name="Relic" type="upgrade" hidden="true"/>
      </selectionEntries>`,
    });

    const [message] = hiddenSelectionsOf(evaluate(catalogue, armyWith([{ defId: RELIC_ID, count: 1, children: [] }])));

    for (const field of ['limitId', 'limit', 'actual', 'bound', 'delta', 'derivation', 'causes', 'text']) {
      expect(field in message, `Versteckt-Meldung darf kein Feld "${field}" tragen`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Die Gegenrichtung zu Issue 0088 — beide Regeln greifen nebeneinander
// ─────────────────────────────────────────────────────────────────────────────

describe('Zusammenspiel mit der Min-Unterdrueckung (Issue 0088)', () => {
  it('fordert die Min-Grenze des versteckten Traegers weiterhin nicht ein, meldet ihn aber als versteckt', () => {
    const catalogue = catalogueWith({
      squadBody: `<selectionEntries>
        <selectionEntry id="${RELIC_ID}" name="Relic" type="upgrade" hidden="true">
          <constraints>
            <constraint id="min-relic" type="min" value="2" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>`,
    });

    const report = evaluate(catalogue, armyWith([{ defId: RELIC_ID, count: 1, children: [] }]));

    expect(report.violations.filter(m => m.limitId === 'min-relic')).toHaveLength(0);
    expect(hiddenSelectionsOf(report)).toHaveLength(1);
  });
});
