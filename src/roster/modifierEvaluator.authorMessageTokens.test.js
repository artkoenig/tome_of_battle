import { describe, test, expect } from 'vitest';
import { resolveAuthorMessageTokens, collectTriggeredMessages } from './modifierEvaluator.js';

// ADR 0028: BattleScribe-Text-Tokens in Autor-Meldungen werden gerendert. Belegt ist nur
// `{this}` = effektiver Name des betroffenen Eintrags; unbekannte Tokens bleiben unangetastet
// (Token-Rendering, keine Übersetzung). Getestet an beiden Nahtstellen: die reine Auflöse-
// Funktion und ihr Einsatz in collectTriggeredMessages (mit dem effektiven Eintragsnamen).

describe('resolveAuthorMessageTokens — Token-Rendering (Seam 1)', () => {
  const values = { this: 'Gnoblars' };

  test('ersetzt {this} durch seinen Wert', () => {
    expect(resolveAuthorMessageTokens('more units of {this} than Ogre Bulls', values))
      .toBe('more units of Gnoblars than Ogre Bulls');
  });

  test('ersetzt mehrere Vorkommen von {this}', () => {
    expect(resolveAuthorMessageTokens('{this} vs {this}', values)).toBe('Gnoblars vs Gnoblars');
  });

  test('lässt unbekannte Tokens unverändert', () => {
    expect(resolveAuthorMessageTokens('a {this} and a {parent}', values))
      .toBe('a Gnoblars and a {parent}');
  });

  test('Text ohne Token bleibt unverändert', () => {
    expect(resolveAuthorMessageTokens('no tokens here', values)).toBe('no tokens here');
  });
});

describe('collectTriggeredMessages — {this} → effektiver Eintragsname (Seam 2)', () => {
  const errorModifier = (value) => ({ type: 'add', field: 'error', value, conditions: [], conditionGroups: [] });

  test('der Gnoblars-Fall: {this} wird zum Einheitennamen', () => {
    const entry = {
      id: 'e-gnoblars', name: 'Gnoblars', type: 'unit',
      modifiers: [errorModifier('You cannot have more units of {this} than you have units of Ogre Bulls')]
    };

    expect(collectTriggeredMessages(entry, {})).toEqual([{
      severity: 'error',
      message: 'You cannot have more units of Gnoblars than you have units of Ogre Bulls'
    }]);
  });

  test('Autor-Meldung ohne Token bleibt unverändert', () => {
    const entry = { id: 'e', name: 'Whatever', type: 'unit', modifiers: [errorModifier('Plain author hint')] };

    expect(collectTriggeredMessages(entry, {})).toEqual([{ severity: 'error', message: 'Plain author hint' }]);
  });

  test('{this} nutzt den durch Namens-Modifier veränderten effektiven Namen, nicht den Rohnamen', () => {
    const entry = {
      id: 'e', name: 'Base', type: 'unit',
      modifiers: [
        { type: 'set', field: 'name', value: 'Renamed', conditions: [], conditionGroups: [] },
        errorModifier('This is {this}')
      ]
    };

    expect(collectTriggeredMessages(entry, {})).toEqual([{ severity: 'error', message: 'This is Renamed' }]);
  });
});
