/**
 * Eine **versteckte `selectionEntryGroup`** versteckt, was sie haelt — und zwar
 * fuer **jeden** Knoten an dieser Stelle, nicht nur fuer das Angebot.
 *
 * `docs/battlescribe-data-format.md` §8: „Eine versteckte `selectionEntryGroup`
 * versteckt, was sie haelt. Die Gruppe ist der einzige Ort, an dem ihre Member
 * dem Nutzer angeboten werden — ist sie ‚not visible to the user', ist es keine
 * ihrer Optionen. Verschachtelte Gruppen wirken kumulativ, und ein
 * `hidden`-Modifier an der Gruppe deckt ihre Optionen wieder mit auf." Dazu, aus
 * demselben Abschnitt: „Die Min-Grenzen einer effektiv versteckten Entitaet
 * werden **nicht** validiert."
 *
 * Bis Issue 0147 trug nur der **Angebots-Anker** die Sichtbarkeits-Klammer
 * (`offer.js`); die belegte Auswahl und das Pflicht-Phantom bekamen sie nicht.
 * Beobachtbare Folge an echten Daten: der Master Necromancer (Vampire Counts,
 * Definitive Edition) fuehrt die Gruppe „Lores of Magic"
 * (`3e50-5f62-a177-304d`) mit `hidden="true"` **ohne** Aufdeck-Modifikator; ihr
 * Member „Lore of Necromancy" (`09ca-8236-8226-79c0`) traegt `min 1`. Die Engine
 * meldete „muss mindestens einmal gewaehlt werden" fuer eine Option, die dem
 * Nutzer nie angeboten wird — eine Pflicht, die niemand erfuellen kann.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const HERO_ID = 'entry-hero';
const SWITCH_ID = 'entry-switch';
const HIDDEN_GROUP_ID = 'group-hidden';
const OPEN_GROUP_ID = 'group-open';
const HIDDEN_MIN_ID = 'entry-hidden-min';
const OPEN_MIN_ID = 'entry-open-min';
const HIDDEN_LIMIT_ID = 'limit-hidden-min';
const OPEN_LIMIT_ID = 'limit-open-min';
const MAX_IN_HIDDEN_ID = 'limit-hidden-max';

// Der Held fuehrt zwei Gruppen mit je einer Pflicht-Option. Die eine Gruppe ist
// versteckt und wird nur bei gesetztem Schalter aufgedeckt, die andere ist immer
// sichtbar. Beide Member tragen selbst KEIN `hidden` — genau die reale Lage.
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-hidden-group" name="Hidden Group Catalogue">
  <selectionEntries>
    <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
      <selectionEntryGroups>
        <selectionEntryGroup id="${HIDDEN_GROUP_ID}" name="Lores of Magic" hidden="true">
          <modifiers>
            <modifier type="set" value="false" field="hidden">
              <conditions>
                <condition type="atLeast" value="1" field="selections" scope="roster" childId="${SWITCH_ID}" includeChildSelections="true"/>
              </conditions>
            </modifier>
          </modifiers>
          <selectionEntries>
            <selectionEntry id="${HIDDEN_MIN_ID}" name="Lore of Necromancy" type="upgrade" hidden="false">
              <constraints>
                <constraint id="${HIDDEN_LIMIT_ID}" type="min" value="1" field="selections" scope="parent" shared="true"/>
                <constraint id="${MAX_IN_HIDDEN_ID}" type="max" value="1" field="selections" scope="parent" shared="true"/>
              </constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
        <selectionEntryGroup id="${OPEN_GROUP_ID}" name="Weapons" hidden="false">
          <selectionEntries>
            <selectionEntry id="${OPEN_MIN_ID}" name="Handweapon" type="upgrade" hidden="false">
              <constraints>
                <constraint id="${OPEN_LIMIT_ID}" type="min" value="1" field="selections" scope="parent" shared="true"/>
              </constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>
    <selectionEntry id="${SWITCH_ID}" name="Aufdeck-Schalter" type="upgrade"/>
  </selectionEntries>
</catalogue>`;

function evaluate(forces) {
  return evaluateDataset(prepareDataset({ catalogues: [CATALOGUE_XML] }), { forces });
}

/** Ein Held, optional mit dem Aufdeck-Schalter und optional mit Extra-Kindern. */
function hero(children = []) {
  return { defId: HERO_ID, count: 1, children };
}

function limitIds(report) {
  return report.violations.map(violation => violation.limitId);
}

function slotOf(report, defId) {
  return [...report.capabilities.values()].find(capability => capability.defId === defId);
}

describe('Eine versteckte Gruppe versteckt ihre Member (Issue 0147)', () => {
  it('validiert die Min-Grenze eines Members der versteckten Gruppe nicht', () => {
    const report = evaluate([hero()]);

    expect(limitIds(report)).toContain(OPEN_LIMIT_ID);
    expect(limitIds(report)).not.toContain(HIDDEN_LIMIT_ID);
  });

  it('markiert das Pflicht-Phantom des Members als versteckt', () => {
    const report = evaluate([hero()]);

    expect(slotOf(report, HIDDEN_MIN_ID)).toMatchObject({ anchorKind: 'mandatoryPhantom', isHidden: true });
    expect(slotOf(report, OPEN_MIN_ID)).toMatchObject({ anchorKind: 'mandatoryPhantom', isHidden: false });
  });

  it('deckt mit dem Modifikator an der Gruppe auch ihre Member wieder auf', () => {
    const report = evaluate([hero(), { defId: SWITCH_ID, count: 1, children: [] }]);

    expect(limitIds(report)).toContain(HIDDEN_LIMIT_ID);
    expect(slotOf(report, HIDDEN_MIN_ID)).toMatchObject({ isHidden: false });
  });

  it('versteckt auch eine **belegte** Auswahl in der versteckten Gruppe', () => {
    const report = evaluate([hero([{ defId: HIDDEN_MIN_ID, count: 1, children: [] }])]);

    expect(slotOf(report, HIDDEN_MIN_ID)).toMatchObject({ anchorKind: 'occupied', isHidden: true });
  });

  it('laesst Max-Grenzen der versteckten Gruppe unberuehrt (§8: unabhaengig von der Sichtbarkeit)', () => {
    const report = evaluate([hero([{ defId: HIDDEN_MIN_ID, count: 2, children: [] }])]);

    expect(limitIds(report)).toContain(MAX_IN_HIDDEN_ID);
  });
});
