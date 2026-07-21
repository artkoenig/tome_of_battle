import React from 'react';
import { Info, BookOpen } from 'lucide-react';
import { useRuleUrl } from '../../hooks/useRuleUrl';

const ICON_SIZE = 14;

// Trailing icon for a rule / upgrade / magic-item chip.
//
// Link priority (deliberate product decision): if a 6th.whfb.app rule link
// exists for `name`, the BookOpen link is shown and the catalogue-derived Info
// is intentionally NOT offered. Only when no link exists do we fall back to the
// Info affordance for the catalogue text.
//
// The rule link is resolved through the central useRuleUrl hook, so the global
// whfb6 linking setting (ADR-0015) is honored here: when linking is disabled the
// resolver yields null for every name and the component falls back to the Info
// affordance exactly as it would for an unmapped name.
//
// The Info interaction differs per call site (chip vs. configurator row), so the
// hover/click handlers are injected. `onInfoClick` is optional — when omitted the
// Info icon renders without a click handler (letting the click bubble to the row).
export default function RuleChipIcon({
  name,
  hasInfo,
  onShowRule,
  onInfoEnter,
  onInfoMove,
  onInfoLeave,
  onInfoClick = null,
}) {
  const resolveRuleUrl = useRuleUrl();

  if (resolveRuleUrl(name)) {
    return (
      <BookOpen
        size={ICON_SIZE}
        className="rule-link-icon"
        onClick={(e) => {
          e.stopPropagation();
          if (onShowRule) onShowRule(name);
        }}
      />
    );
  }

  if (hasInfo) {
    return (
      <Info
        size={ICON_SIZE}
        className="rule-link-icon"
        onClick={onInfoClick ? (e) => { e.stopPropagation(); onInfoClick(); } : undefined}
        onMouseEnter={onInfoEnter ? (e) => { e.stopPropagation(); onInfoEnter(e); } : undefined}
        onMouseMove={onInfoMove}
        onMouseLeave={onInfoLeave}
      />
    );
  }

  return null;
}
