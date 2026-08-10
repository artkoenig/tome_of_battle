/**
 * Issue 0135, Kriterium 2 und 3 (und damit Issue 0132): **eine Option, die nur
 * durch eine versteckte Gruppe angeboten wird, ist selbst versteckt.**
 *
 * Die Angebots-Schicht (`offer.js`) durchschreitet `selectionEntryGroup`s und
 * Verweise auf sie und verankert deren Member **flach** am Rahmen (ADR-0036: ein
 * Angebots-Anker ist immer ein Blatt). Die durchschrittene Klammer ist damit die
 * einzige Stelle, an der die Sichtbarkeit der Gruppe noch am Member haengt — sie
 * wird als **Sichtbarkeits-Klammer** (`visibilityGates`) mitgefuehrt und geht in
 * das `isHidden` des Angebots-Ankers ein. Dynamisch bleibt sie, weil auch die
 * `field="hidden"`-Modifikatoren der Klammer am Anker greifen: deckt der Katalog
 * die Gruppe bedingt auf, erscheinen ihre Optionen wieder.
 *
 * Beobachtungsstelle ist der Faehigkeitsdatensatz des Berichts
 * (`capability.isHidden`) — dieselbe wie in
 * `effectiveState.baseHiddenInheritance.test.js`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus. */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Der Faehigkeitsdatensatz des ANGEBOTS-Ankers einer Definitions-ID. */
function offerCapabilityOf(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR) {
      return capability;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 2 — synthetische Kataloge, eine Regel je Fall
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_ID = 'force-army';
const SQUAD_ID = 'entry-squad';
const TOKEN_ID = 'entry-token';
const MEMBER_ID = 'entry-member';
const SHARED_GROUP_ID = 'shared-group';
const GROUP_LINK_ID = 'link-group';
const INNER_GROUP_ID = 'group-inner';
const INNER_MEMBER_ID = 'entry-inner-member';

/**
 * Ein Katalog mit einem Kontingent, einem Traeger-Eintrag („Squad") und einem
 * frei einsetzbaren „Token"-Eintrag, ueber den eine Aufdeck-Bedingung geschaltet
 * wird. `squadBody` und `sharedBody` fuellen die Struktur des jeweiligen Falls.
 */
function catalogueWith({ squadBody = '', sharedGroups = '' }) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-hidden-gate" name="Hidden Gate Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <sharedSelectionEntryGroups>${sharedGroups}</sharedSelectionEntryGroups>
      <selectionEntries>
        <selectionEntry id="${SQUAD_ID}" name="Squad" type="unit">${squadBody}</selectionEntry>
        <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;
}

/** Roster: ein Kontingent mit einem Squad — und optional dem Aufdeck-„Token". */
function armyWithSquad({ withToken = false } = {}) {
  const children = [{ defId: SQUAD_ID, count: 1, children: [] }];
  if (withToken) children.push({ defId: TOKEN_ID, count: 1, children: [] });
  return { forces: [{ defId: FORCE_ID, count: 1, children }] };
}

/** Die Bedingung „im Kontingent steht mindestens ein Token". */
const TOKEN_CONDITION = `<conditions>
  <condition type="atLeast" value="1" field="selections" scope="force"
             childId="${TOKEN_ID}" shared="true" includeChildSelections="true"/>
</conditions>`;

describe('Sichtbarkeits-Klammer: Option einer versteckten Gruppe (Kriterium 2)', () => {
  it('versteckt die Option einer direkt am Eintrag versteckten Gruppe', () => {
    const report = evaluate(catalogueWith({
      squadBody: `<selectionEntryGroups>
        <selectionEntryGroup id="${INNER_GROUP_ID}" name="Hidden Group" hidden="true">
          <selectionEntries>
            <selectionEntry id="${MEMBER_ID}" name="Member" type="upgrade"/>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, MEMBER_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, MEMBER_ID).isHidden).toBe(true);
  });

  it('versteckt die Option einer per Verweis eingebundenen, versteckten geteilten Gruppe', () => {
    // Genau das Katalogmuster der „… (Vampire Coast)"-Gruppen: die GETEILTE
    // Gruppe traegt hidden="true", der Verweis auf sie hidden="false".
    const report = evaluate(catalogueWith({
      squadBody: `<entryLinks>
        <entryLink id="${GROUP_LINK_ID}" name="Hidden Group" hidden="false"
                   targetId="${SHARED_GROUP_ID}" type="selectionEntryGroup"/>
      </entryLinks>`,
      sharedGroups: `<selectionEntryGroup id="${SHARED_GROUP_ID}" name="Hidden Group" hidden="true">
        <selectionEntries>
          <selectionEntry id="${MEMBER_ID}" name="Member" type="upgrade"/>
        </selectionEntries>
      </selectionEntryGroup>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, MEMBER_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, MEMBER_ID).isHidden).toBe(true);
  });

  it('deckt die Option wieder auf, sobald ein Modifikator die Klammer sichtbar macht', () => {
    const sharedGroups = `<selectionEntryGroup id="${SHARED_GROUP_ID}" name="Hidden Group" hidden="true">
        <selectionEntries>
          <selectionEntry id="${MEMBER_ID}" name="Member" type="upgrade"/>
        </selectionEntries>
        <modifiers>
          <modifier type="set" field="hidden" value="false">${TOKEN_CONDITION}</modifier>
        </modifiers>
      </selectionEntryGroup>`;
    const squadBody = `<entryLinks>
        <entryLink id="${GROUP_LINK_ID}" name="Hidden Group" hidden="false"
                   targetId="${SHARED_GROUP_ID}" type="selectionEntryGroup"/>
      </entryLinks>`;

    const withoutToken = evaluate(catalogueWith({ squadBody, sharedGroups }), armyWithSquad());
    expect(offerCapabilityOf(withoutToken, MEMBER_ID).isHidden).toBe(true);

    const withToken = evaluate(catalogueWith({ squadBody, sharedGroups }), armyWithSquad({ withToken: true }));
    expect(offerCapabilityOf(withToken, MEMBER_ID).isHidden).toBe(false);
  });

  it('wirkt kumulativ ueber verschachtelte Klammern: die aeussere versteckte Gruppe schlaegt die sichtbare innere', () => {
    const report = evaluate(catalogueWith({
      squadBody: `<selectionEntryGroups>
        <selectionEntryGroup id="${INNER_GROUP_ID}" name="Outer Hidden" hidden="true">
          <selectionEntryGroups>
            <selectionEntryGroup id="group-visible" name="Inner Visible" hidden="false">
              <selectionEntries>
                <selectionEntry id="${INNER_MEMBER_ID}" name="Inner Member" type="upgrade"/>
              </selectionEntries>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntryGroup>
      </selectionEntryGroups>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, INNER_MEMBER_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, INNER_MEMBER_ID).isHidden).toBe(true);
  });

  it('KONTROLLE: die Option einer sichtbaren Gruppe bleibt sichtbar', () => {
    const report = evaluate(catalogueWith({
      squadBody: `<selectionEntryGroups>
        <selectionEntryGroup id="${INNER_GROUP_ID}" name="Visible Group" hidden="false">
          <selectionEntries>
            <selectionEntry id="${MEMBER_ID}" name="Member" type="upgrade"/>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, MEMBER_ID).isHidden).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue 0147, defect 3 — a member carries its own `hidden` INDEPENDENTLY of
// the visibility bracket it descended through. A revealed bracket does not
// make a self-hidden member visible, and a hidden bracket keeps a
// self-visible member hidden: both tracks must AND together, neither
// replaces the other.
// ─────────────────────────────────────────────────────────────────────────────

describe('Sichtbarkeits-Klammer UND eigenes hidden: beide Spuren muessen gelten (Kriterium 2, Defekt 3)', () => {
  it('haelt ein Mitglied mit eigenem hidden="true" versteckt, obwohl seine Klammer durch einen feuernden Modifikator sichtbar wird', () => {
    const report = evaluate(catalogueWith({
      squadBody: `<entryLinks>
        <entryLink id="${GROUP_LINK_ID}" name="Hidden Group" hidden="false"
                   targetId="${SHARED_GROUP_ID}" type="selectionEntryGroup"/>
      </entryLinks>`,
      sharedGroups: `<selectionEntryGroup id="${SHARED_GROUP_ID}" name="Hidden Group" hidden="true">
        <selectionEntries>
          <selectionEntry id="${MEMBER_ID}" name="Member" type="upgrade" hidden="true"/>
        </selectionEntries>
        <modifiers>
          <modifier type="set" field="hidden" value="false"/>
        </modifiers>
      </selectionEntryGroup>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, MEMBER_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, MEMBER_ID).isHidden).toBe(true);
  });

  it('macht ein Mitglied mit eigenem feuerndem Aufdeck-Modifikator sichtbar, obwohl es selbst hidden="true" traegt, in einer sichtbaren Klammer', () => {
    const report = evaluate(catalogueWith({
      squadBody: `<selectionEntryGroups>
        <selectionEntryGroup id="${INNER_GROUP_ID}" name="Visible Group" hidden="false">
          <selectionEntries>
            <selectionEntry id="${MEMBER_ID}" name="Member" type="upgrade" hidden="true">
              <modifiers>
                <modifier type="set" field="hidden" value="false"/>
              </modifiers>
            </selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, MEMBER_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, MEMBER_ID).isHidden).toBe(false);
  });

  it('versteckt ein Mitglied mit eigenem hidden="false", wenn ein Modifikator die Klammer per hidden="true" versteckt', () => {
    const report = evaluate(catalogueWith({
      squadBody: `<selectionEntryGroups>
        <selectionEntryGroup id="${INNER_GROUP_ID}" name="Gated Group" hidden="false">
          <selectionEntries>
            <selectionEntry id="${MEMBER_ID}" name="Member" type="upgrade" hidden="false"/>
          </selectionEntries>
          <modifiers>
            <modifier type="set" field="hidden" value="true"/>
          </modifiers>
        </selectionEntryGroup>
      </selectionEntryGroups>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, MEMBER_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, MEMBER_ID).isHidden).toBe(true);
  });

  it('haelt ein Mitglied versteckt, dessen innere Klammer per feuerndem Modifikator aufgedeckt wird, solange die aeussere Klammer versteckt bleibt', () => {
    const report = evaluate(catalogueWith({
      squadBody: `<selectionEntryGroups>
        <selectionEntryGroup id="${INNER_GROUP_ID}" name="Outer Hidden" hidden="true">
          <selectionEntryGroups>
            <selectionEntryGroup id="group-inner-revealed" name="Inner Revealed" hidden="true">
              <selectionEntries>
                <selectionEntry id="${INNER_MEMBER_ID}" name="Inner Member" type="upgrade"/>
              </selectionEntries>
              <modifiers>
                <modifier type="set" field="hidden" value="false"/>
              </modifiers>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntryGroup>
      </selectionEntryGroups>`,
    }), armyWithSquad());

    expect(offerCapabilityOf(report, INNER_MEMBER_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, INNER_MEMBER_ID).isHidden).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 3 — an den echten DE-Katalogdaten des Repos
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_DIR = join(process.cwd(), 'src/evaluator/__fixtures__/whfb6-definitive');

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

// `<forceEntry name="Standard (VC-AB)">` bzw. `<forceEntry name="Vampire Coast
// (WD#306-UK)">` der Vampire-Counts-`.cat`. Nur im zweiten Kontingent greift der
// Aufdeck-Modifikator der Vampire-Coast-Gruppen
// (`instanceOf scope="force" childId="bf46-…"`).
const VC_STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';
const VC_COAST_FORCE_ID = 'bf46-ee85-7c10-ba98';
// `<selectionEntry type="unit" name="Vampire Count">` — ein gewoehnlicher Vampir
// mit der geteilten Gruppe „Magic Items".
const VAMPIRE_COUNT_ID = '6822-0110-a7c9-cbb0';

/**
 * Die Vampire-Coast-Inhalte, wie die Meldung sie nennt: die vier Gruppen-Verweise
 * (`… (Vampire Coast)`) und drei Member-Verweise **innerhalb** der Gruppe
 * „Magic Weapons (Vampire Coast)" — darunter das gemeldete „Bloody Nora".
 * Kein einziger dieser Eintraege traegt ein eigenes `hidden="true"`; versteckt
 * ist ausschliesslich die geteilte Gruppe, die sie haelt.
 */
const VAMPIRE_COAST_SLOTS = Object.freeze([
  { id: 'e067-9271-8d45-7469', name: 'Enchanted Items (Vampire Coast)' },
  { id: 'fd23-452f-acf9-b3d5', name: 'Magic Weapons (Vampire Coast)' },
  { id: '8af0-a5ee-c7d6-de37', name: 'Magic Armour (Vampire Coast)' },
  { id: '0b16-dd32-8896-31c7', name: 'Magic Talismans (Vampire Coast)' },
  { id: 'c95b-73d1-2ff9-0d1b', name: 'Wharf Rats' },
  { id: '336c-d90b-477c-1f01', name: 'Bloody Nora' },
  { id: '1174-3d5f-3749-ed71', name: 'Dirty Serpent' },
]);

/** Alle Faehigkeitsdatensaetze einer Definitions-ID, gleich welcher Ankerart. */
function capabilitiesOf(report, defId) {
  return [...report.capabilities.values()].filter(capability => capability.defId === defId);
}

/** Der aufbereitete DE-Datensatz (gst + Vampire Counts) — einmal je Lauf. */
let cachedVampireCounts = null;
function preparedVampireCounts() {
  cachedVampireCounts ??= prepareDataset({
    gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
    catalogues: [fixture('Vampire Counts (6th definitive edition).cat')],
  });
  return cachedVampireCounts;
}

/** Wertet einen Vampirgrafen im gegebenen Kontingent gegen gst + Vampire Counts aus. */
function evaluateVampireIn(forceDefId) {
  return evaluateDataset(preparedVampireCounts(), {
    forces: [{
      defId: forceDefId,
      count: 1,
      children: [{ defId: VAMPIRE_COUNT_ID, count: 1, children: [] }],
    }],
  });
}

describe('Echte Katalogdaten: Vampire-Coast-Inhalte am gewoehnlichen Vampir (Kriterium 3)', () => {
  it('haelt im Kontingent „Standard (VC-AB)" jeden Vampire-Coast-Slot versteckt', () => {
    const report = evaluateVampireIn(VC_STANDARD_FORCE_ID);

    for (const { id, name } of VAMPIRE_COAST_SLOTS) {
      const capabilities = capabilitiesOf(report, id);
      expect(capabilities.length, `${name} (${id}) hat keinen Slot`).toBeGreaterThan(0);
      for (const capability of capabilities) {
        expect(capability.isHidden, `${name} (${id}) ist sichtbar`).toBe(true);
      }
    }
  });

  it('zeigt dieselben Slots im Kontingent „Vampire Coast (WD#306-UK)"', () => {
    const report = evaluateVampireIn(VC_COAST_FORCE_ID);

    for (const { id, name } of VAMPIRE_COAST_SLOTS) {
      const capabilities = capabilitiesOf(report, id);
      expect(capabilities.length, `${name} (${id}) hat keinen Slot`).toBeGreaterThan(0);
      expect(
        capabilities.some(capability => !capability.isHidden),
        `${name} (${id}) bleibt versteckt`,
      ).toBe(true);
    }
  });
});

// ── Die Gegenprobe an einer zweiten, unabhaengigen Katalogregel ──────────────
//
// Die Gruppe „Armour" des Vampirs (`66f2-d6a1-420c-5a39`, hidden="true") deckt der
// Katalog per Modifikator auf, sobald die Armee die Blutlinie Blood Dragon oder Von
// Carstein fuehrt — die Regel der 6. Edition, dass nur diese beiden Blutlinien
// Ruestung tragen. Ihre Member (Heavy/Light Armour) tragen selbst kein `hidden`; sie
// haengen allein an dieser Klammer. Der Fall belegt beide Richtungen an echten Daten:
// die Klammer versteckt, und ihr Modifikator deckt wieder auf.

const BLOODLINES_ID = 'a56a-eb32-5a45-16fd';
const BLOOD_DRAGON_ID = '9fd9-e05c-ffcb-2c4d';
const VAMPIRE_THRALL_ID = 'e37b-c827-99ac-b706';
const ARMOUR_MEMBERS = Object.freeze([
  { id: '9067-694d-ae97-648a', name: 'Heavy Armour' },
  { id: 'e2fe-3bf5-bfb7-d37c', name: 'Light Armour' },
]);

/** Ein Vampirdiener im Standard-Kontingent, wahlweise mit Blood-Dragon-Blutlinie. */
function evaluateThrall({ withBloodDragon }) {
  const children = [{ defId: VAMPIRE_THRALL_ID, count: 1, children: [] }];
  if (withBloodDragon) {
    children.unshift({
      defId: BLOODLINES_ID,
      count: 1,
      children: [{ defId: BLOOD_DRAGON_ID, count: 1, children: [] }],
    });
  }
  return evaluateDataset(preparedVampireCounts(), {
    forces: [{ defId: VC_STANDARD_FORCE_ID, count: 1, children }],
  });
}

describe('Echte Katalogdaten: die blutlinien-gegatterte Ruestungsgruppe (Kriterium 2)', () => {
  it('versteckt Heavy/Light Armour ohne die passende Blutlinie', () => {
    const report = evaluateThrall({ withBloodDragon: false });

    for (const { id, name } of ARMOUR_MEMBERS) {
      const capabilities = capabilitiesOf(report, id);
      expect(capabilities.length, `${name} (${id}) hat keinen Slot`).toBeGreaterThan(0);
      for (const capability of capabilities) {
        expect(capability.isHidden, `${name} (${id}) ist sichtbar`).toBe(true);
      }
    }
  });

  it('zeigt dieselben Optionen, sobald die Blutlinie Blood Dragon gewaehlt ist', () => {
    const report = evaluateThrall({ withBloodDragon: true });

    for (const { id, name } of ARMOUR_MEMBERS) {
      const capabilities = capabilitiesOf(report, id);
      expect(
        capabilities.some(capability => !capability.isHidden),
        `${name} (${id}) bleibt versteckt`,
      ).toBe(true);
    }
  });
});
