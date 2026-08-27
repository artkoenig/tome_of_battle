import React from 'react';
import { CategoryCountBadge } from 'army_builder';

// Props from src/ui/components/editor/CategoryCountBadge.jsx: the chip prints the
// current count, then only those limits that actually constrain - `min` is dropped
// when it is 0/null, `max` when unbounded - so the "no limits" and "both limits"
// cases look genuinely different.

export const WithinLimits = () => (
  <CategoryCountBadge count={2} min={1} max={3} hasErrors={false} />
);

export const OverMaximum = () => (
  <CategoryCountBadge count={4} min={1} max={3} hasErrors />
);

export const MinimumOnly = () => (
  <CategoryCountBadge count={1} min={2} max={null} hasErrors={false} />
);

export const Unbounded = () => (
  <CategoryCountBadge count={6} min={null} max={null} hasErrors={false} />
);
