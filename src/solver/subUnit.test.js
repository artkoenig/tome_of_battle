import { describe, test, expect } from 'vitest';
import { isIndependentSubUnit, hasEntryChildren } from './validator.js';

// Das Prädikat „eigenständige Untereinheit" wird von Editor, Spielansicht,
// Optionen-Sammler, Roster-Abgleich und Serialisierung geteilt. Diese Tests
// halten die eine gültige Auslegung fest — insbesondere die Behandlung eines
// *fehlenden* collective-Attributs, bei der die früheren Kopien im
// Roster-Abgleich (`=== false`) und in der Serialisierung (`!== true`)
// gegensätzlich antworteten.
describe('isIndependentSubUnit', () => {
  const withOwnOptions = { selectionEntries: [{ id: 'opt-blade' }] };

  const entry = (overrides) => ({ id: 'e-champion', type: 'model', ...withOwnOptions, ...overrides });

  test('erkennt einen nicht-kollektiven model-Eintrag mit eigenen Optionen', () => {
    expect(isIndependentSubUnit(entry({ collective: false }))).toBe(true);
  });

  test('erkennt einen nicht-kollektiven unit-Eintrag mit eigenen Optionen', () => {
    expect(isIndependentSubUnit(entry({ type: 'unit', collective: false }))).toBe(true);
  });

  test('behandelt ein fehlendes collective-Attribut als „nicht kollektiv"', () => {
    const withoutCollectiveAttribute = entry({});
    expect(withoutCollectiveAttribute.collective).toBeUndefined();
    expect(isIndependentSubUnit(withoutCollectiveAttribute)).toBe(true);
  });

  test('akzeptiert das collective-Attribut auch als rohen String', () => {
    expect(isIndependentSubUnit(entry({ collective: 'false' }))).toBe(true);
    expect(isIndependentSubUnit(entry({ collective: 'true' }))).toBe(false);
  });

  test('schließt kollektive Einträge aus', () => {
    expect(isIndependentSubUnit(entry({ collective: true }))).toBe(false);
  });

  test('schließt Eintragsarten außer model und unit aus', () => {
    expect(isIndependentSubUnit(entry({ type: 'upgrade', collective: false }))).toBe(false);
  });

  test('schließt Einträge ohne eigene Optionen aus', () => {
    expect(isIndependentSubUnit({ id: 'e-plain', type: 'model', collective: false })).toBe(false);
  });

  test('liefert false für einen fehlenden Eintrag', () => {
    expect(isIndependentSubUnit(null)).toBe(false);
    expect(isIndependentSubUnit(undefined)).toBe(false);
  });
});

describe('hasEntryChildren', () => {
  test('zählt direkte Einträge, verlinkte Einträge und Auswahlgruppen', () => {
    expect(hasEntryChildren({ selectionEntries: [{ id: 'a' }] })).toBe(true);
    expect(hasEntryChildren({ entryLinks: [{ id: 'b' }] })).toBe(true);
    expect(hasEntryChildren({ selectionEntryGroups: [{ id: 'c' }] })).toBe(true);
  });

  test('liefert false für leere Listen und fehlende Einträge', () => {
    expect(hasEntryChildren({ selectionEntries: [], entryLinks: [], selectionEntryGroups: [] })).toBe(false);
    expect(hasEntryChildren(null)).toBe(false);
  });
});
