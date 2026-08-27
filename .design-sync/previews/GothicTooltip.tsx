import React from 'react';
import { GothicTooltip } from 'army_builder';

// The tooltip is portalled to the document body and positioned from `x`/`y`
// viewport coordinates, so a story has to place it somewhere visible inside the
// card rather than anchor it to a trigger.

export const RuleText = () => (
  <div style={{ minHeight: 190 }}>
    <GothicTooltip title="Always Strikes First" x={28} y={40}>
      Models with this special rule always strike first in combat, regardless of
      Initiative, unless their opponent also has it.
    </GothicTooltip>
  </div>
);

export const ShortNote = () => (
  <div style={{ minHeight: 120 }}>
    <GothicTooltip title="Musician" x={28} y={40}>
      One model in the unit may be upgraded to a musician.
    </GothicTooltip>
  </div>
);
