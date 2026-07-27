/**
 * Zwei-Wege-Vollstaendigkeitstest der Handler-Registries gegen die SSOT
 * (`battlescribeSchema.generated.js`, ADR-0016/0031, Clean-Room-Abgleich Q2).
 *
 * Die Auswertung von Bedingungen und Modifikatoren liegt als Registry vor:
 * `COMPARATORS` bildet `ConditionKind`→Wahrheitswert, `MODIFIER_HANDLERS` bildet
 * `ModifierKind`→Effekt. Dieser Test haelt beide **deckungsgleich** mit der SSOT:
 *
 *  - jeder Enum-Wert der SSOT hat **genau einen** Handler (kein fehlender Fall),
 *  - jeder Handler-Schluessel ist ein **gueltiger** Enum-Wert (kein verwaister Fall).
 *
 * Waechst die SSOT um einen Wert ohne Handler — oder bleibt ein Handler ohne
 * Enum-Wert zurueck —, schlaegt dieser Test fehl. Das haelt die Engine bei
 * Schema-Wachstum ehrlich, statt einen neuen Format-Wert still als UNSUPPORTED
 * durchrutschen zu lassen.
 */

import { describe, it, expect } from 'vitest';
import { ConditionKind, ModifierKind, ModifierTargetKind } from './model.js';
import { COMPARATORS, MODIFIER_HANDLERS } from './modifiers.js';

/** Deckungsgleich = identische Schluesselmengen (jede Seite genau einmal). */
function expectExactCoverage(handlerKeys, enumValues) {
  expect(new Set(handlerKeys)).toEqual(new Set(enumValues));
  expect(handlerKeys).toHaveLength(enumValues.length);
}

describe('COMPARATORS deckt ConditionKind zweiseitig vollstaendig ab', () => {
  it('hat genau einen Handler je ConditionKind-Wert und keinen verwaisten Schluessel', () => {
    expectExactCoverage(Object.keys(COMPARATORS), Object.values(ConditionKind));
  });

  it('haelt jeden Handler-Wert als aufrufbares Praedikat', () => {
    for (const comparator of Object.values(COMPARATORS)) {
      expect(typeof comparator).toBe('function');
    }
  });
});

describe('MODIFIER_HANDLERS deckt ModifierKind zweiseitig vollstaendig ab', () => {
  it('hat genau eine Ziel-Tabelle je ModifierKind-Wert und keinen verwaisten Schluessel', () => {
    expectExactCoverage(Object.keys(MODIFIER_HANDLERS), Object.values(ModifierKind));
  });

  it('haelt jede Ziel-Tabelle mit mindestens einem Ziel besetzt', () => {
    for (const [kind, handlersByTarget] of Object.entries(MODIFIER_HANDLERS)) {
      expect(Object.keys(handlersByTarget), `Modifikator-Art ${kind} ohne wirkendes Ziel`).not.toHaveLength(0);
    }
  });

  it('benennt in jeder Ziel-Tabelle nur gueltige Zielarten und haelt jeden Effekt aufrufbar', () => {
    const targetKinds = new Set(Object.values(ModifierTargetKind));
    for (const [kind, handlersByTarget] of Object.entries(MODIFIER_HANDLERS)) {
      for (const [targetKind, handler] of Object.entries(handlersByTarget)) {
        expect(targetKinds, `${kind} verweist auf unbekannte Zielart ${targetKind}`).toContain(targetKind);
        expect(typeof handler).toBe('function');
      }
    }
  });
});
