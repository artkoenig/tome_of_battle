import { describe, it, expect } from 'vitest';
import { createSelectionFromDef } from './selectionFactory.js';

// Verifiziert das in Issue 01 vorgesehene Durchreichen eines Bewertungskontexts:
// ohne Kontext bleibt das rohe `min` maßgeblich (unverändertes Verhalten), mit
// Kontext fließt ein bedingter Modifier, der das `min` anhebt, als Pflichtwahl ein.

// Stub-resolveEntry: löst Links über targetId, Einträge über id auf.
function makeResolver(entriesById) {
  return (_system, entry) => {
    if (!entry) return null;
    if (entry.targetId) return entriesById[entry.targetId] || null;
    return entriesById[entry.id] || entry;
  };
}

const MEMBER_MIN_ID = 'member-min-constraint';
const TRIGGER_FIELD = 'trigger-count';

// Mitglied mit rohem min=0, das ein bedingter increment-Modifier auf genau diese
// Min-Constraint auf 1 anhebt, sobald `TRIGGER_FIELD` vorhanden ist — nachgebildetes
// „bedingt erhöhtes Gruppen-Min" (Pflichtwahl).
const memberWithConditionalMin = () => ({
  id: 'reinforcement', name: 'Reinforcement',
  constraints: [{ id: MEMBER_MIN_ID, type: 'min', field: 'selections', scope: 'parent', value: 0 }],
  modifiers: [{
    type: 'increment', field: MEMBER_MIN_ID, valueObject: 1,
    conditions: [{ type: 'greaterThan', field: TRIGGER_FIELD, value: 0 }]
  }]
});

const unitDef = () => ({
  id: 'unit', name: 'Unit',
  selectionEntries: [memberWithConditionalMin()],
  entryLinks: [], selectionEntryGroups: []
});

const childNames = selection => selection.selections.map(child => child.name);

describe('createSelectionFromDef — effektives min via durchgereichtem Bewertungskontext', () => {
  const build = evaluationContext => {
    const def = unitDef();
    const resolveEntry = makeResolver({ unit: def, reinforcement: def.selectionEntries[0] });
    return createSelectionFromDef({ system: {}, resolveEntry, catalogueId: 'cat', entry: { id: 'unit' }, evaluationContext });
  };

  it('ohne Kontext: rohes min=0 → Mitglied bleibt ungewählt (unverändertes Verhalten)', () => {
    expect(childNames(build(null))).toEqual([]);
  });

  it('mit Kontext, dessen Bedingung erfüllt ist: effektives min=1 → Mitglied wird als Pflichtwahl bevölkert', () => {
    const selection = build({ selectionCounts: { [TRIGGER_FIELD]: 1 } });
    expect(childNames(selection)).toEqual(['Reinforcement']);
    expect(selection.selections[0].number).toBe(1);
  });

  it('mit Kontext, dessen Bedingung nicht erfüllt ist: effektives min bleibt 0 → nicht bevölkert', () => {
    expect(childNames(build({ selectionCounts: { [TRIGGER_FIELD]: 0 } }))).toEqual([]);
  });
});
