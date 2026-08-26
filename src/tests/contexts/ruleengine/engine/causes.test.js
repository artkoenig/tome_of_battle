/**
 * Ursachen einer Verletzung (`causes.js`, ADR-0027) — isoliert gegen die
 * Herleitungskette geprueft, ohne Katalog und ohne Auswertung.
 *
 * Das ist der Punkt des Moduls: es ist ein **reiner Leser**. Bekaeme es die Kette
 * nicht als Eingabe, sondern muesste sie sich beschaffen, waere dieser Test ohne
 * halbe Engine gar nicht schreibbar — und genau daran haengt die
 * Akzeptanzbedingung „gelesen aus der Herleitungskette, nicht rekonstruiert".
 */

import { describe, it, expect } from 'vitest';
import { causesOf, causesFieldOf } from '../../../../contexts/ruleengine/engine/causes.js';
import { ModifierKind } from '../../../../contexts/ruleengine/engine/model.js';

const BANNER = Object.freeze({ defId: 'entry-battle-standard', name: 'Battle Standard Bearer' });
const HORN = Object.freeze({ defId: 'entry-war-horn', name: 'War Horn' });

/** Ein Kettenschritt in der Form, die die Modifikator-Schicht schreibt. */
function step({ kind = ModifierKind.SET, rawValue = '0', times = 1, result, isConditional, witness = null }) {
  return { kind, rawValue, times, result, isConditional, witness };
}

/** Eine Herleitung aus Basiswert und Schritten (Reihenfolge = Dokumentreihenfolge). */
function derivation(base, steps) {
  return { base, steps };
}

describe('causesOf: was als Ursache zaehlt', () => {
  it('nennt den Zeugen eines bedingten Schritts, der den Wert veraendert hat', () => {
    // Der klassische Fall aus ADR-0027: „Max 0, weil Battle Standard Bearer gewaehlt ist".
    const chain = derivation(2, [step({ result: 0, isConditional: true, witness: BANNER })]);

    expect(causesOf(chain)).toEqual([
      { witness: BANNER, modifierKind: ModifierKind.SET, value: 0 },
    ]);
  });

  it('nennt einen unbedingten Schritt nicht — er gilt immer und erklaert nichts', () => {
    const chain = derivation(2, [step({ result: 0, isConditional: false, witness: BANNER })]);

    expect(causesOf(chain)).toEqual([]);
  });

  it('nennt einen bedingten Schritt ohne Zeugen nicht (Ehrlichkeit vor Vollstaendigkeit)', () => {
    // Eine Kostenschwelle oder ein Kategorie-Ziel loest auf keine benennbare
    // Auswahl auf. Der Schritt bleibt in der Kette sichtbar, erfindet aber nichts.
    const chain = derivation(2, [step({ result: 0, isConditional: true, witness: null })]);

    expect(causesOf(chain)).toEqual([]);
    // Der Schritt selbst geht dabei nicht verloren — die Kette bleibt vollstaendig.
    expect(chain.steps).toHaveLength(1);
  });

  it('nennt einen bedingten Schritt nicht, der den Wert gar nicht veraendert hat', () => {
    // `set 2` auf einen Wert, der bereits 2 ist: die Bedingung hielt, aber diese
    // Auswahl hat die Grenze nicht auf ihren Wert gebracht.
    const chain = derivation(2, [step({ result: 2, isConditional: true, witness: BANNER })]);

    expect(causesOf(chain)).toEqual([]);
  });

  it('misst Wirksamkeit gegen den Vorgaenger-Schritt, nicht gegen den Basiswert', () => {
    // Schritt 1 hebt 2 → 5, Schritt 2 setzt wieder auf 2. Beide sind wirksam,
    // obwohl der Endwert dem Basiswert gleicht — gegen den Basiswert gemessen
    // waere der zweite faelschlich unwirksam.
    const chain = derivation(2, [
      step({ kind: ModifierKind.INCREMENT, result: 5, isConditional: true, witness: BANNER }),
      step({ result: 2, isConditional: true, witness: HORN }),
    ]);

    expect(causesOf(chain)).toEqual([
      { witness: BANNER, modifierKind: ModifierKind.INCREMENT, value: 5 },
      { witness: HORN, modifierKind: ModifierKind.SET, value: 2 },
    ]);
  });

  it('gibt die Ursachen in Dokumentreihenfolge aus — die Reihenfolge ist Semantik', () => {
    const chain = derivation(0, [
      step({ kind: ModifierKind.INCREMENT, result: 1, isConditional: true, witness: HORN }),
      step({ kind: ModifierKind.INCREMENT, result: 2, isConditional: true, witness: BANNER }),
    ]);

    expect(causesOf(chain).map(cause => cause.witness.defId)).toEqual([HORN.defId, BANNER.defId]);
  });

  it('liefert fuer eine Kette ohne Schritte und fuer eine fehlende Kette keine Ursache', () => {
    expect(causesOf(derivation(3, []))).toEqual([]);
    expect(causesOf(null)).toEqual([]);
    expect(causesOf(undefined)).toEqual([]);
  });
});

describe('causesFieldOf: das Feld entfaellt, wenn keine Ursache bleibt (ADR-0027)', () => {
  it('liefert ein leeres Teilobjekt, wenn nichts benennbar ist', () => {
    const field = causesFieldOf(derivation(2, [step({ result: 0, isConditional: false })]));

    expect(field).toEqual({});
    // Ausdruecklich: kein `causes: []`, das die Oberflaeche einen leeren
    // Ursachen-Block anlegen liesse.
    expect('causes' in field).toBe(false);
  });

  it('liefert das Feld, sobald es mindestens eine Ursache gibt', () => {
    const field = causesFieldOf(derivation(2, [step({ result: 0, isConditional: true, witness: BANNER })]));

    expect(field.causes).toHaveLength(1);
    expect(field.causes[0].witness).toEqual(BANNER);
  });
});
