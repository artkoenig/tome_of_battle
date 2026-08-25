/**
 * Issue 0088 — „Min-Grenzen versteckter Entitäten werden validiert".
 *
 * `docs/battlescribe-data-format.md` §5.6: ein `forceEntry` bzw. `categoryLink`
 * mit `hidden="true"` (oder dynamisch per Modifier `field="hidden"`, §7.7/§8)
 * darf dem Nutzer nicht als Option angeboten und dessen Mindestgrenzen duerfen
 * nicht validiert werden. Per Projektentscheidung (Issue 0088) gilt das
 * verallgemeinert fuer ALLE Ankerarten mit Min-Grenzen: Pflicht-Phantom,
 * Kategorie-Anker, Gruppen-Anker, belegter Knoten und forceEntry.
 *
 * Massgeblich ist das EIGENE effektive hidden des Grenzen-Traegers (Basis-
 * Attribut inkl. Link→Ziel-Vererbung plus `hidden`-Modifier); eine Fortpflanzung
 * ueber versteckte Vorfahren ist ausdruecklich NICHT Teil dieses Laufs und wird
 * hier nicht getestet.
 *
 * Max-Grenzen bleiben von der Sichtbarkeit unberuehrt (AC 4): eine effektiv
 * versteckte Entitaet mit verletzter Max-Grenze meldet weiterhin.
 *
 * Beobachtet wird ausschliesslich der Bericht der echten Fassade
 * (`prepareDataset`/`evaluate`); Verstoesse werden ueber ihre stabile
 * `limitId` identifiziert, nie ueber Anzeigenamen. Jeder Test, der die NEUE
 * Semantik prueft (hidden ⇒ kein Min-Verstoss), sichert zuerst
 * `diagnostics === []` ab — so schlaegt er aus dem richtigen Grund fehl
 * (unerwuenschter Ist-Verstoss), nicht wegen einer kaputten Fixture.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { MessageOrigin } from '../../../../contexts/ruleengine/engine/model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog aus. Die Fassade ist zweistufig
 * (ADR-0032): erst den Datensatz aufbereiten, dann auswerten; ein Einzelkatalog
 * ohne Spielsystem ist `{ catalogues: [xml] }`.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Die Meldungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

// ─────────────────────────────────────────────────────────────────────────────
// AC 1 + AC 3, Repro A: Pflicht-Phantom (Entitaet fehlt ganz im Roster).
// Statisches Basis-Attribut, beide Richtungen des Kipp-Nachweises.
// ─────────────────────────────────────────────────────────────────────────────

describe('Pflicht-Phantom: Basis-hidden unterdrueckt die Min-Grenze (AC 1 + 3, Repro A)', () => {
  const KNIGHT_ID = 'entry-knight';
  const WARRIOR_ID = 'entry-warrior';
  const MIN_KNIGHT_LIMIT_ID = 'min-knight';

  /** Ein Pflichteintrag (min=1, roster-weit) mit schaltbarem Basis-hidden. */
  function catalogue(hidden) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-phantom" name="Hidden Phantom Catalogue">
        <selectionEntries>
          <selectionEntry id="${KNIGHT_ID}" name="Knight" type="unit" hidden="${hidden}">
            <constraints>
              <constraint id="${MIN_KNIGHT_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
          <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit"/>
        </selectionEntries>
      </catalogue>`;
  }

  // Roster ohne den Pflichteintrag — nur ein gewoehnlicher Warrior.
  const ROSTER_WITHOUT_KNIGHT = { forces: [{ defId: WARRIOR_ID, count: 1, children: [] }] };

  it('NEU: hidden="true" ⇒ die fehlende Pflicht erzeugt KEINEN Min-Verstoss', () => {
    const report = evaluate(catalogue(true), ROSTER_WITHOUT_KNIGHT);

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_KNIGHT_LIMIT_ID)).toHaveLength(0);
  });

  it('KIPP-NACHWEIS: hidden="false" ⇒ die fehlende Pflicht meldet weiterhin (Ist 0, Grenze 1)', () => {
    const report = evaluate(catalogue(false), ROSTER_WITHOUT_KNIGHT);

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MIN_KNIGHT_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 1 + AC 3, Repro B: Kategorie-Anker (categoryLink im forceEntry).
// ─────────────────────────────────────────────────────────────────────────────

describe('Kategorie-Anker: hidden am categoryLink unterdrueckt die Min-Grenze (AC 1 + 3, Repro B)', () => {
  const RARE_CATEGORY_ID = 'cat-rare';
  const FORCE_ID = 'force-army';
  const MIN_RARE_LIMIT_ID = 'min-rare';

  /** Eine Force, deren categoryLink (min=2 je Kontingent) schaltbar versteckt ist. */
  function catalogue(hidden) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-category" name="Hidden Category Catalogue">
        <categoryEntries>
          <categoryEntry id="${RARE_CATEGORY_ID}" name="Rare"/>
        </categoryEntries>
        <forceEntries>
          <forceEntry id="${FORCE_ID}" name="Army">
            <categoryLinks>
              <categoryLink id="clink-rare" name="Rare" targetId="${RARE_CATEGORY_ID}" hidden="${hidden}">
                <constraints>
                  <constraint id="${MIN_RARE_LIMIT_ID}" type="min" value="2" field="selections" scope="force"/>
                </constraints>
              </categoryLink>
            </categoryLinks>
          </forceEntry>
        </forceEntries>
      </catalogue>`;
  }

  // Ein leeres Kontingent: kein Kategorie-Mitglied vorhanden.
  const EMPTY_FORCE_ROSTER = { forces: [{ defId: FORCE_ID, count: 1, children: [] }] };

  it('NEU: hidden="true" ⇒ die leere Force erzeugt KEINEN Min-Verstoss am Kategorie-Anker', () => {
    const report = evaluate(catalogue(true), EMPTY_FORCE_ROSTER);

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_RARE_LIMIT_ID)).toHaveLength(0);
  });

  it('KIPP-NACHWEIS: hidden="false" ⇒ die leere Force meldet weiterhin (Ist 0, Grenze 2)', () => {
    const report = evaluate(catalogue(false), EMPTY_FORCE_ROSTER);

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MIN_RARE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 2 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 1 + AC 3 dynamisch: `hidden`-Modifier in beide Richtungen.
// Traeger ist ein belegter Knoten (min=2, nur 1 gewaehlt), die Bedingung haengt
// an einem Token im Roster — so kippt dieselbe Grenze allein per Rosterinhalt.
// ─────────────────────────────────────────────────────────────────────────────

describe('Dynamische Sichtbarkeit per hidden-Modifier (AC 1 + 3)', () => {
  const MILITIA_ID = 'entry-militia';
  const TOKEN_ID = 'entry-token';
  const MIN_MILITIA_LIMIT_ID = 'min-militia';

  /**
   * Ein Eintrag mit min=2 (roster-weit), dessen Sichtbarkeit ein bedingter
   * `hidden`-Modifier steuert: die Bedingung haelt, sobald mindestens ein Token
   * im Roster steht.
   */
  function catalogue({ baseHidden, modifierValue }) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-modifier" name="Hidden Modifier Catalogue">
        <selectionEntries>
          <selectionEntry id="${MILITIA_ID}" name="Militia" type="unit" hidden="${baseHidden}">
            <constraints>
              <constraint id="${MIN_MILITIA_LIMIT_ID}" type="min" value="2" field="selections" scope="roster"/>
            </constraints>
            <modifiers>
              <modifier type="set" field="hidden" value="${modifierValue}">
                <conditions>
                  <condition type="atLeast" value="1" field="selections" scope="roster" childId="${TOKEN_ID}"/>
                </conditions>
              </modifier>
            </modifiers>
          </selectionEntry>
          <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
        </selectionEntries>
      </catalogue>`;
  }

  // Basis sichtbar, Modifier versteckt bei Token.
  const HIDE_ON_TOKEN = catalogue({ baseHidden: false, modifierValue: true });
  // Basis versteckt, Modifier macht sichtbar bei Token (Gegenrichtung).
  const REVEAL_ON_TOKEN = catalogue({ baseHidden: true, modifierValue: false });

  /** Roster: eine Militia (min=2 unerfuellt), optional mit Token. */
  function rosterWith({ token }) {
    const forces = [{ defId: MILITIA_ID, count: 1, children: [] }];
    if (token) forces.push({ defId: TOKEN_ID, count: 1, children: [] });
    return { forces };
  }

  it('NEU: Bedingung erfuellt ⇒ Modifier versteckt ⇒ die unerfuellte Min-Grenze meldet NICHT', () => {
    const report = evaluate(HIDE_ON_TOKEN, rosterWith({ token: true }));

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_MILITIA_LIMIT_ID)).toHaveLength(0);
  });

  it('KIPP-NACHWEIS: Bedingung nicht erfuellt ⇒ sichtbar ⇒ die Min-Grenze feuert (Ist 1, Grenze 2)', () => {
    const report = evaluate(HIDE_ON_TOKEN, rosterWith({ token: false }));

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MIN_MILITIA_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 1, bound: 2 });
  });

  it('NEU (Gegenrichtung): Basis-hidden ohne greifenden Modifier ⇒ die Min-Grenze meldet NICHT', () => {
    const report = evaluate(REVEAL_ON_TOKEN, rosterWith({ token: false }));

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_MILITIA_LIMIT_ID)).toHaveLength(0);
  });

  it('KIPP-NACHWEIS (Gegenrichtung): Modifier macht sichtbar ⇒ die Min-Grenze feuert wieder', () => {
    const report = evaluate(REVEAL_ON_TOKEN, rosterWith({ token: true }));

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MIN_MILITIA_LIMIT_ID);
    expect(messages).toHaveLength(1);
    // Ist zaehlt nur die Militia — der Token ist eine andere Definition.
    expect(messages[0]).toMatchObject({ actual: 1, bound: 2 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 2: die uebrigen Ankerarten — Gruppen-Anker, belegter Knoten, forceEntry.
// ─────────────────────────────────────────────────────────────────────────────

describe('Gruppen-Anker: hidden an der selectionEntryGroup unterdrueckt die Min-Grenze (AC 2)', () => {
  const SQUAD_ID = 'entry-squad';
  const WEAPONS_GROUP_ID = 'group-weapons';
  const SWORD_ID = 'entry-sword';
  const MIN_WEAPON_LIMIT_ID = 'min-weapon';

  /** Ein Squad mit einer Pflicht-Gruppe (min=1 Mitglied), schaltbar versteckt. */
  function catalogue(hidden) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-group" name="Hidden Group Catalogue">
        <selectionEntries>
          <selectionEntry id="${SQUAD_ID}" name="Squad" type="unit">
            <selectionEntryGroups>
              <selectionEntryGroup id="${WEAPONS_GROUP_ID}" name="Weapons" hidden="${hidden}">
                <constraints>
                  <constraint id="${MIN_WEAPON_LIMIT_ID}" type="min" value="1" field="selections" scope="parent"/>
                </constraints>
                <selectionEntries>
                  <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade"/>
                </selectionEntries>
              </selectionEntryGroup>
            </selectionEntryGroups>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  // Ein Squad ohne gewaehltes Gruppenmitglied — die Gruppen-Pflicht ist unerfuellt.
  const SQUAD_WITHOUT_WEAPON = { forces: [{ defId: SQUAD_ID, count: 1, children: [] }] };

  it('NEU: hidden="true" ⇒ die unerfuellte Gruppen-Pflicht erzeugt KEINEN Min-Verstoss', () => {
    const report = evaluate(catalogue(true), SQUAD_WITHOUT_WEAPON);

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_WEAPON_LIMIT_ID)).toHaveLength(0);
  });

  it('KIPP-NACHWEIS: hidden="false" ⇒ die Gruppen-Pflicht meldet weiterhin (Ist 0, Grenze 1)', () => {
    const report = evaluate(catalogue(false), SQUAD_WITHOUT_WEAPON);

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MIN_WEAPON_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
  });
});

describe('Belegter Knoten: Basis-hidden unterdrueckt die unerfuellte Min-Grenze (AC 2)', () => {
  const GUARD_ID = 'entry-guard';
  const MIN_GUARD_LIMIT_ID = 'min-guard';

  /** Ein Eintrag mit min=2 (roster-weit), schaltbar versteckt. */
  function catalogue(hidden) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-occupied" name="Hidden Occupied Catalogue">
        <selectionEntries>
          <selectionEntry id="${GUARD_ID}" name="Guard" type="unit" hidden="${hidden}">
            <constraints>
              <constraint id="${MIN_GUARD_LIMIT_ID}" type="min" value="2" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  // Der Eintrag IST gewaehlt (belegter Knoten), aber unter der Grenze: 1 < 2.
  const ONE_GUARD_ROSTER = { forces: [{ defId: GUARD_ID, count: 1, children: [] }] };

  it('NEU: hidden="true" ⇒ die gewaehlte, aber unerfuellte Min-Grenze meldet NICHT', () => {
    const report = evaluate(catalogue(true), ONE_GUARD_ROSTER);

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_GUARD_LIMIT_ID)).toHaveLength(0);
  });

  it('KIPP-NACHWEIS: hidden="false" ⇒ der belegte Knoten meldet weiterhin (Ist 1, Grenze 2)', () => {
    const report = evaluate(catalogue(false), ONE_GUARD_ROSTER);

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MIN_GUARD_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 1, bound: 2 });
  });
});

describe('forceEntry: Basis-hidden unterdrueckt die Min-Grenze des Kontingents (AC 2, §5.6 woertlich)', () => {
  const MANDATORY_FORCE_ID = 'force-mandatory';
  const OTHER_FORCE_ID = 'force-other';
  const FORCE_MIN_LIMIT_ID = 'min-mandatory-force';

  /** Ein Pflicht-Kontingent (min=1, roster-weit), schaltbar versteckt. */
  function catalogue(hidden) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-force" name="Hidden Force Catalogue">
        <forceEntries>
          <forceEntry id="${MANDATORY_FORCE_ID}" name="Mandatory Detachment" hidden="${hidden}">
            <constraints>
              <constraint id="${FORCE_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
            </constraints>
          </forceEntry>
          <forceEntry id="${OTHER_FORCE_ID}" name="Other Detachment"/>
        </forceEntries>
      </catalogue>`;
  }

  // Das Pflicht-Kontingent fehlt; nur das andere Kontingent steht im Roster.
  const ROSTER_WITHOUT_MANDATORY = { forces: [{ defId: OTHER_FORCE_ID, count: 1, children: [] }] };

  it('NEU: hidden="true" ⇒ das fehlende Pflicht-Kontingent erzeugt KEINEN Min-Verstoss', () => {
    const report = evaluate(catalogue(true), ROSTER_WITHOUT_MANDATORY);

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, FORCE_MIN_LIMIT_ID)).toHaveLength(0);
  });

  it('KIPP-NACHWEIS: hidden="false" ⇒ das fehlende Pflicht-Kontingent meldet weiterhin', () => {
    const report = evaluate(catalogue(false), ROSTER_WITHOUT_MANDATORY);

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, FORCE_MIN_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 4: Max-Grenzen bleiben von der Sichtbarkeit unberuehrt.
// ─────────────────────────────────────────────────────────────────────────────

describe('Max-Grenzen bleiben unberuehrt (AC 4)', () => {
  const OGRE_ID = 'entry-ogre';
  const MAX_OGRE_LIMIT_ID = 'max-ogre';

  /** Ein Eintrag mit max=1 (roster-weit), schaltbar versteckt. */
  function catalogue(hidden) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-max" name="Hidden Max Catalogue">
        <selectionEntries>
          <selectionEntry id="${OGRE_ID}" name="Ogre" type="unit" hidden="${hidden}">
            <constraints>
              <constraint id="${MAX_OGRE_LIMIT_ID}" type="max" value="1" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  // Max verletzt: 2 gewaehlt gegen max=1.
  const TWO_OGRES_ROSTER = { forces: [{ defId: OGRE_ID, count: 2, children: [] }] };

  it('PIN: die versteckte Entitaet meldet ihren Max-Verstoss WEITERHIN (Ist 2, Grenze 1)', () => {
    const report = evaluate(catalogue(true), TWO_OGRES_ROSTER);

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MAX_OGRE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  it('KONTROLLE: die sichtbare Entitaet meldet den Max-Verstoss (die Fixture traegt)', () => {
    const report = evaluate(catalogue(false), TWO_OGRES_ROSTER);

    expect(report.diagnostics).toEqual([]);
    const messages = violationsOf(report, MAX_OGRE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rand: min UND max am selben versteckten Traeger, beide verletzt —
// nur der Max-Verstoss erscheint.
// ─────────────────────────────────────────────────────────────────────────────

describe('Rand: versteckter Traeger mit verletztem Min UND Max meldet nur den Max-Verstoss (AC 1 + 4)', () => {
  const TROLL_ID = 'entry-troll';
  const MIN_TROLL_LIMIT_ID = 'min-troll';
  const MAX_TROLL_LIMIT_ID = 'max-troll';

  /** Ein Eintrag mit min=3 und max=1 (beide roster-weit), schaltbar versteckt. */
  function catalogue(hidden) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-hidden-minmax" name="Hidden MinMax Catalogue">
        <selectionEntries>
          <selectionEntry id="${TROLL_ID}" name="Troll" type="unit" hidden="${hidden}">
            <constraints>
              <constraint id="${MIN_TROLL_LIMIT_ID}" type="min" value="3" field="selections" scope="roster"/>
              <constraint id="${MAX_TROLL_LIMIT_ID}" type="max" value="1" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  // 2 gewaehlt: verletzt min=3 (2 < 3) UND max=1 (2 > 1) zugleich.
  const TWO_TROLLS_ROSTER = { forces: [{ defId: TROLL_ID, count: 2, children: [] }] };

  it('NEU: versteckt ⇒ der Bericht traegt genau den Max-Verstoss, keinen Min-Verstoss', () => {
    const report = evaluate(catalogue(true), TWO_TROLLS_ROSTER);

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_TROLL_LIMIT_ID)).toHaveLength(0);
    const maxMessages = violationsOf(report, MAX_TROLL_LIMIT_ID);
    expect(maxMessages).toHaveLength(1);
    expect(maxMessages[0]).toMatchObject({ actual: 2, bound: 1 });
    // Der Katalog kennt keine weitere Grenze: unter den aus Grenzen
    // ABGELEITETEN Meldungen ist der Max-Verstoss die einzige. Daneben steht
    // seit Issue 0119 die Gegenrichtung dieser Regel — der versteckte Troll
    // liegt im Roster und wird als solcher gemeldet (`report.hiddenSelection.test.js`);
    // sie traegt keine `limitId` und beruehrt die Aussage dieses Falls nicht.
    expect(report.violations.filter(v => v.origin === MessageOrigin.DERIVED_LIMIT)).toHaveLength(1);
    expect(report.violations.filter(v => v.origin === MessageOrigin.HIDDEN_SELECTION)).toHaveLength(1);
  });

  it('KONTROLLE: sichtbar ⇒ beide Verstoesse erscheinen (die Fixture traegt beide Grenzen)', () => {
    const report = evaluate(catalogue(false), TWO_TROLLS_ROSTER);

    expect(report.diagnostics).toEqual([]);
    expect(violationsOf(report, MIN_TROLL_LIMIT_ID)).toHaveLength(1);
    expect(violationsOf(report, MAX_TROLL_LIMIT_ID)).toHaveLength(1);
  });
});
