import React from 'react';
import { ValidationMessage } from 'army_builder';

// The `violation` prop is one entry from the evaluator report. Both published
// shapes are covered below; the fixtures follow the report contract as
// src/tests/ui/components/editor/ValidationMessage.evaluator.test.jsx builds it.
// The component renders no text of its own - `formatViolation` turns the
// violation into a sentence in the active UI language, and `severity` picks the
// colour via `validation-message--<severity>`.

const FLAGS = { shared: true, includeChildSelections: false, includeChildForces: false };

const derived = ({ kind = 'max', actual = 2, bound = 1, name = 'Musician', severity = 'error' }) => ({
  origin: 'derivedLimit',
  severity,
  anchor: { defId: 'def-1', name, path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
  limitId: 'lim-1',
  limit: {
    kind,
    measure: 'selectionCount',
    costTypeId: null,
    isPercent: false,
    scope: { kind: 'parent', targetId: null, flags: FLAGS },
  },
  actual,
  bound,
  delta: bound - actual,
  derivation: { base: bound, steps: [] },
});

const authored = ({ severity = 'warning', text }) => ({
  origin: 'authorMessage',
  severity,
  anchor: { defId: 'entry-special', name: 'Special Character', path: '0/3', anchorKind: 'occupied', isValueUnstable: false },
  text,
});

export const MaximumExceeded = () => (
  <ValidationMessage violation={derived({ kind: 'max', actual: 2, bound: 1 })} />
);

export const MinimumNotMet = () => (
  <ValidationMessage violation={derived({ kind: 'min', actual: 1, bound: 3, name: 'Longbowmen' })} />
);

export const AuthorWarning = () => (
  <ValidationMessage violation={authored({ severity: 'warning', text: 'Special characters need opponent consent.' })} />
);

export const AuthorInfo = () => (
  <ValidationMessage violation={authored({ severity: 'info', text: 'This detachment may be fielded as an allied contingent.' })} />
);
