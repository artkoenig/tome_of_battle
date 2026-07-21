import React from 'react';
import { createPortal } from 'react-dom';

// Rendered via a portal straight into <body> rather than in place. The
// tooltip is `position: fixed`, but any ancestor with an active clip-path
// (e.g. the unit card's torn-edge effect) clips whatever a descendant paints
// outside that ancestor's own box -- fixed positioning doesn't exempt it.
// Portaling out of the clipped subtree is what keeps the tooltip from being
// cropped whenever it renders past the card's bottom edge.
export default function GothicTooltip({ title, x, y, children }) {
  return createPortal(
    // The position follows the pointer and therefore changes continuously --
    // the one case ADR-0004 §1 exempts from the inline-style ban.
    <div className="gothic-tooltip" style={{ left: `${x}px`, top: `${y}px` }}>
      <div className="tooltip-title">{title}</div>
      <div className="tooltip-body">{children}</div>
    </div>,
    document.body
  );
}
