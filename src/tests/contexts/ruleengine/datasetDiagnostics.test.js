import { describe, test, expect } from 'vitest';
import { unresolvedSelectionsOf } from '../../../contexts/ruleengine/readmodel/datasetDiagnostics.js';

/**
 * Reproduktion des Befunds aus der Prüfung zu Issue 0121: ein stilles
 * Katalog-Update (ADR 0018) entfernt einen Eintrag, die gespeicherte Auswahl
 * bleibt stehen. Die Engine meldet dazu die Diagnose `unresolvedDefinition`
 * und übergeht die Auswahl — ohne diese Projektion verschwände sie stumm aus
 * der Bewertung, statt dem Nutzer gemeldet zu werden.
 */

const roster = {
  forces: [{
    id: 'f1',
    selections: [
      { id: 'sel-a', selectionEntryId: 'unit-gone', name: 'Alter Held', number: 1, selections: [] },
      {
        id: 'sel-b',
        selectionEntryId: 'unit-ok',
        name: 'Krieger',
        number: 1,
        selections: [
          { id: 'sel-c', entryLinkId: 'link-gone', selectionEntryId: 'opt-target', name: 'Verlorene Option', number: 1 }
        ]
      }
    ]
  }]
};

describe('unresolvedSelectionsOf', () => {
  test('nennt die betroffene Auswahl mit ihrem Namen aus dem Roster', () => {
    const result = unresolvedSelectionsOf([{ kind: 'unresolvedDefinition', defId: 'unit-gone' }], roster);

    expect(result).toEqual([{ defId: 'unit-gone', name: 'Alter Held' }]);
  });

  test('findet auch eine tief verschachtelte Auswahl — unter ihrer Verweis-Id', () => {
    const result = unresolvedSelectionsOf([{ kind: 'unresolvedDefinition', defId: 'link-gone' }], roster);

    expect(result).toEqual([{ defId: 'link-gone', name: 'Verlorene Option' }]);
  });

  test('faellt auf die Definitions-Id zurueck, wenn das Roster den Namen nicht kennt', () => {
    const result = unresolvedSelectionsOf([{ kind: 'unresolvedDefinition', defId: 'ganz-fremd' }], roster);

    expect(result).toEqual([{ defId: 'ganz-fremd', name: 'ganz-fremd' }]);
  });

  test('meldet dieselbe Definition nur einmal, auch bei mehreren Diagnosen', () => {
    const result = unresolvedSelectionsOf(
      [
        { kind: 'unresolvedDefinition', defId: 'unit-gone' },
        { kind: 'unresolvedDefinition', defId: 'unit-gone' }
      ],
      roster
    );

    expect(result).toHaveLength(1);
  });

  test('uebergeht Diagnosen anderer Art', () => {
    const result = unresolvedSelectionsOf(
      [{ kind: 'duplicateDefinition', defId: 'unit-gone' }, { kind: 'gameSystemMismatch' }],
      roster
    );

    expect(result).toEqual([]);
  });

  test('leere und fehlende Eingaben ergeben eine leere Liste, ohne zu werfen', () => {
    expect(unresolvedSelectionsOf([], roster)).toEqual([]);
    expect(unresolvedSelectionsOf(null, roster)).toEqual([]);
    expect(unresolvedSelectionsOf(undefined, undefined)).toEqual([]);
    expect(unresolvedSelectionsOf([{ kind: 'unresolvedDefinition', defId: 'x' }], null))
      .toEqual([{ defId: 'x', name: 'x' }]);
  });
});
