import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset } from './evaluator.js';

/**
 * Wertet einen einzelnen synthetischen Katalog aus. Die Fassade nimmt seit
 * ADR-0032 einen Datensatz `{ gameSystem, catalogues }`; ein Einzelkatalog ohne
 * Spielsystem ist `{ catalogues: [xml] }`.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset({ catalogues: [catalogXml] }, roster);
}
import { parseCatalogue } from './catalogReader.js';
import { DiagnosticKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, synthetische Fixtures (Slice 02) ────────────────────────────────
// Der reale Ogre-Kingdoms-Katalog enthaelt KEINE conditionGroups/modifierGroups
// (im design.md verifiziert). Die Gruppen-Acceptance-Criteria sind daher nur
// ueber eigene Fixtures in echter BattleScribe-Syntax pruefbar: `<conditionGroup
// type="and">…`, verschachtelte `<conditionGroups>` und `<modifierGroup>…`.

const WARRIOR_ID = 'entry-warrior';
const ARCHER_ID = 'entry-archer';
const TOKEN_ID = 'entry-token';
const BANNER_ID = 'entry-banner';
const POINTS_ID = 'cost-points';
const MAX_POINTS_ID = 'max-points';

const WARRIOR_BASE_POINTS = 10;
const MODIFIER_POINTS = 5;
const MAX_POINTS = 12; // Basis 10 <= 12; ein einzelner +5-Modifikator (15) verletzt.

/** Baut ein Roster aus den gegebenen Auswahl-Instanzen (ohne Kontingent-Ebene). */
function roster(selections) {
  return { forces: selections };
}

/** Eine Auswahl-Instanz mit Anzahl und ohne Kinder. */
function selection(defId, count) {
  return { defId, count, children: [] };
}

/** Eine `atLeast 1`-Bedingung auf die Roster-Anzahl der gegebenen Ziel-Definition. */
function atLeastOne(childId) {
  return `<condition type="atLeast" field="selections" scope="roster" childId="${childId}" value="1"/>`;
}

/**
 * Baut einen Katalog: ein Warrior mit Basiskosten, einer MAX-Punktegrenze und dem
 * uebergebenen `<modifiers>`/`<modifierGroups>`-Rumpf. Die Nebendarsteller
 * (Archer/Token/Banner) existieren als Ziele der Bedingungen.
 */
function warriorCatalogue(modifierBody) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-groups" name="Groups Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_ID}" value="${WARRIOR_BASE_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          ${modifierBody}
        </selectionEntry>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit"/>
        <selectionEntry id="${TOKEN_ID}" name="Token" type="upgrade"/>
        <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;
}

/** Die effektiven Warrior-Punkte, wie der Bericht sie als Ist-Wert der Grenze zeigt. */
function effectivePoints(report) {
  return report.violations.length === 0 ? WARRIOR_BASE_POINTS : report.violations[0].actual;
}

describe('Eine `and`-Bedingungsgruppe haelt genau dann, wenn alle Bedingungen halten', () => {
  // +5 Punkte, aber nur wenn mindestens ein Archer UND ein Token im Roster stehen.
  const CATALOGUE = warriorCatalogue(`
    <modifiers>
      <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
        <conditionGroups>
          <conditionGroup type="and">
            <conditions>
              ${atLeastOne(ARCHER_ID)}
              ${atLeastOne(TOKEN_ID)}
            </conditions>
          </conditionGroup>
        </conditionGroups>
      </modifier>
    </modifiers>`);

  it('feuert, wenn beide Bedingungen halten (Archer und Token)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1), selection(TOKEN_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht, wenn nur eine Bedingung haelt (nur Archer)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });

  it('feuert nicht, wenn keine Bedingung haelt', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });
});

describe('Eine `or`-Bedingungsgruppe haelt genau dann, wenn mindestens eine Bedingung haelt', () => {
  // +5 Punkte, wenn mindestens ein Archer ODER ein Token im Roster steht.
  const CATALOGUE = warriorCatalogue(`
    <modifiers>
      <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
        <conditionGroups>
          <conditionGroup type="or">
            <conditions>
              ${atLeastOne(ARCHER_ID)}
              ${atLeastOne(TOKEN_ID)}
            </conditions>
          </conditionGroup>
        </conditionGroups>
      </modifier>
    </modifiers>`);

  it('feuert, wenn nur eine Bedingung haelt (nur Token)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(TOKEN_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht, wenn keine Bedingung haelt', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });
});

describe('Verschachtelte Bedingungsgruppen loesen sich ueber Tiefe korrekt auf', () => {
  // +5 Punkte, wenn ein Archer UND (ein Token ODER ein Banner) im Roster steht.
  const CATALOGUE = warriorCatalogue(`
    <modifiers>
      <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
        <conditionGroups>
          <conditionGroup type="and">
            <conditions>
              ${atLeastOne(ARCHER_ID)}
            </conditions>
            <conditionGroups>
              <conditionGroup type="or">
                <conditions>
                  ${atLeastOne(TOKEN_ID)}
                  ${atLeastOne(BANNER_ID)}
                </conditions>
              </conditionGroup>
            </conditionGroups>
          </conditionGroup>
        </conditionGroups>
      </modifier>
    </modifiers>`);

  it('feuert bei Archer und einem Zweig der Untergruppe (Archer + Banner)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1), selection(BANNER_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht, wenn die aeussere `and`-Bedingung fehlt (Token+Banner, kein Archer)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(TOKEN_ID, 1), selection(BANNER_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });

  it('feuert nicht, wenn die innere `or`-Untergruppe leer ausgeht (nur Archer)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });
});

describe('Eine Modifikatorgruppe greift und entfaellt gemeinsam', () => {
  // Zwei +5-Modifikatoren unter EINER gemeinsamen Bedingung (Archer): zusammen +10.
  const CATALOGUE = warriorCatalogue(`
    <modifierGroups>
      <modifierGroup>
        <conditions>
          ${atLeastOne(ARCHER_ID)}
        </conditions>
        <modifiers>
          <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}"/>
          <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}"/>
        </modifiers>
      </modifierGroup>
    </modifierGroups>`);

  it('wendet alle gebuendelten Modifikatoren gemeinsam an, wenn die Gruppen-Bedingung haelt', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS + MODIFIER_POINTS);
  });

  it('laesst alle gebuendelten Modifikatoren gemeinsam entfallen, wenn die Gruppen-Bedingung nicht haelt', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });
});

describe('Ein Modifikator einer Gruppe bleibt seiner eigenen Bedingung unterworfen', () => {
  const OWN_CONDITION_BONUS = 100;
  // Gruppen-Bedingung: Archer. Erster Modifikator unbedingt (+5); zweiter zusaetzlich
  // an seine eigene Token-Bedingung gebunden (+100).
  const CATALOGUE = warriorCatalogue(`
    <modifierGroups>
      <modifierGroup>
        <conditions>
          ${atLeastOne(ARCHER_ID)}
        </conditions>
        <modifiers>
          <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}"/>
          <modifier type="increment" field="${POINTS_ID}" value="${OWN_CONDITION_BONUS}">
            <conditions>
              ${atLeastOne(TOKEN_ID)}
            </conditions>
          </modifier>
        </modifiers>
      </modifierGroup>
    </modifierGroups>`);

  it('wendet nur den unbedingten Gruppen-Modifikator an, wenn die eigene Bedingung fehlt', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('wendet beide an, wenn Gruppen- und eigene Bedingung halten', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1), selection(TOKEN_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS + OWN_CONDITION_BONUS);
  });
});

describe('Eine verschachtelte Modifikatorgruppe greift nur bei innerem UND aeusserem Gate', () => {
  // Aeussere Gruppe: Archer im Roster. Innere Gruppe (verschachtelt): Token im
  // Roster. Der innere Modifikator (+5) feuert nur, wenn beide Gates halten
  // (effektives Gate = AND(aeusseres, inneres)).
  const CATALOGUE = warriorCatalogue(`
    <modifierGroups>
      <modifierGroup>
        <conditions>
          ${atLeastOne(ARCHER_ID)}
        </conditions>
        <modifierGroups>
          <modifierGroup>
            <conditions>
              ${atLeastOne(TOKEN_ID)}
            </conditions>
            <modifiers>
              <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}"/>
            </modifiers>
          </modifierGroup>
        </modifierGroups>
      </modifierGroup>
    </modifierGroups>`);

  it('feuert, wenn inneres UND aeusseres Gate halten (Archer + Token)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1), selection(TOKEN_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS + MODIFIER_POINTS);
  });

  it('feuert nicht bei falschem innerem Gate (nur Archer, kein Token)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });

  it('feuert nicht bei falschem aeusserem Gate (nur Token, kein Archer)', () => {
    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(TOKEN_ID, 1)]));
    expect(effectivePoints(report)).toBe(WARRIOR_BASE_POINTS);
  });
});

describe('Ein `repeats` auf einer ganzen Modifikatorgruppe wird als Diagnose sichtbar (nie still verschluckt)', () => {
  // ModifierGroup erbt `repeats` von ModifierBase; volle Gruppen-Repeat-Semantik
  // ist bewusst nicht im Umfang. Ein nicht-leeres `<repeats>` muss sichtbar
  // gemeldet werden statt still verworfen.
  const CATALOGUE = warriorCatalogue(`
    <modifierGroups>
      <modifierGroup>
        <repeats>
          <repeat field="selections" scope="self" value="1" perValue="1"/>
        </repeats>
        <conditions>
          ${atLeastOne(ARCHER_ID)}
        </conditions>
        <modifiers>
          <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}"/>
        </modifiers>
      </modifierGroup>
    </modifierGroups>`);

  it('meldet UNSUPPORTED_MODIFIER_GROUP_REPEAT beim Lesen', () => {
    const { diagnostics } = parseCatalogue(CATALOGUE);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNSUPPORTED_MODIFIER_GROUP_REPEAT })
    );
  });
});

describe('Gueltige Gruppen erzeugen keine Diagnose; ungueltige werden nicht verschluckt', () => {
  it('meldet fuer einen wohlgeformten, verschachtelten Gruppen-Katalog keine Diagnose', () => {
    const CATALOGUE = warriorCatalogue(`
      <modifiers>
        <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
          <conditionGroups>
            <conditionGroup type="and">
              <conditions>${atLeastOne(ARCHER_ID)}</conditions>
              <conditionGroups>
                <conditionGroup type="or">
                  <conditions>${atLeastOne(TOKEN_ID)}</conditions>
                </conditionGroup>
              </conditionGroups>
            </conditionGroup>
          </conditionGroups>
        </modifier>
      </modifiers>`);

    const report = evaluate(CATALOGUE, roster([selection(WARRIOR_ID, 1), selection(ARCHER_ID, 1), selection(TOKEN_ID, 1)]));

    expect(report.diagnostics).toEqual([]);
  });

  it('meldet einen `conditionGroup`-`type` ausserhalb von and/or als Diagnose (nie still verschluckt)', () => {
    const CATALOGUE = warriorCatalogue(`
      <modifiers>
        <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
          <conditionGroups>
            <conditionGroup type="nand">
              <conditions>${atLeastOne(ARCHER_ID)}</conditions>
            </conditionGroup>
          </conditionGroups>
        </modifier>
      </modifiers>`);

    const { diagnostics } = parseCatalogue(CATALOGUE);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNSUPPORTED_CONDITION_GROUP, type: 'nand' })
    );
  });
});
