import React from 'react';
import { RuleChipIcon } from 'army_builder';

// RuleChipIcon is the *trailing* icon of a chip, not a chip: on its own it
// renders 14px of icon, and nothing at all when neither a rule link nor
// `hasInfo` gives it an affordance to show. So each story composes it where it
// actually lives - inside the chip span UnitChips wraps it in, with that
// component's own `text-micro upgrade-badge` classes.
//
// The axis is which affordance the icon offers: `hasInfo` shows the Info icon
// for catalogue text, and `forceInfo` keeps Info even where an external rule
// link would otherwise take priority (the ListRuleChecklist lock case).

const noop = () => {};

const Chip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <span className="text-micro upgrade-badge has-desc">
    {label}
    {children}
  </span>
);

export const WithInfo = () => (
  <Chip label="Always Strikes First">
    <RuleChipIcon
      name="Always Strikes First"
      hasInfo
      onShowRule={noop}
      onInfoEnter={noop}
      onInfoMove={noop}
      onInfoLeave={noop}
    />
  </Chip>
);

export const InfoAlwaysVisible = () => (
  <Chip label="Stubborn">
    <RuleChipIcon
      name="Stubborn"
      hasInfo
      forceInfo
      onShowRule={noop}
      onInfoEnter={noop}
      onInfoMove={noop}
      onInfoLeave={noop}
    />
  </Chip>
);
