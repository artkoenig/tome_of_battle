import React from 'react';
import { ValidationCauses } from 'army_builder';

// The block renders the selections that triggered a violation (ADR 0027), and
// nothing at all when the violation carries no `causes` - so the empty case is
// deliberately not a story: it has no render.
// Shape per src/ui/i18n/violationMessages.js: `causes: [{ witness: { name } }]`.

const withCauses = (names: string[]) => ({
  origin: 'derivedLimit',
  severity: 'error',
  anchor: { defId: 'def-1', name: 'Core Units', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
  limitId: 'lim-1',
  limit: {
    kind: 'max',
    measure: 'selectionCount',
    costTypeId: null,
    isPercent: false,
    scope: { kind: 'parent', targetId: null, flags: { shared: true, includeChildSelections: false, includeChildForces: false } },
  },
  actual: names.length,
  bound: 1,
  delta: 1 - names.length,
  derivation: { base: 1, steps: [] },
  causes: names.map((name, i) => ({ witness: { defId: `w-${i}`, name, path: `0/${i}` } })),
});

export const SingleCause = () => (
  <ValidationCauses violation={withCauses(['Sword Master of Hoeth'])} />
);

export const SeveralCauses = () => (
  <ValidationCauses violation={withCauses(['Longbowmen', 'Sword Master of Hoeth', 'Ellyrian Reavers'])} />
);
