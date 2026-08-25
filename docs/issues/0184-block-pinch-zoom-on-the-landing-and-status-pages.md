---
status: done
branch: claude/mobile-zoom-best-practices-gnm29g
pr:
---

# Block pinch zoom on the landing page and the status page

## Goal

On a phone, neither the landing page nor the generated status page can be
magnified or shrunk by a pinch gesture, so neither can be panned sideways out
of its layout. Vertical and horizontal scrolling of the page itself stay
intact. Issue 0183 deliberately left pinch zoom in place and suppressed only
the double tap; the user has since asked for the stricter behaviour, so this
issue reverses that decision, including the assertions 0183 wrote to defend it.

This knowingly fails WCAG 1.4.4 (Resize text): a reader who needs the page
larger will no longer be able to enlarge it. That is the user's explicit and
repeated instruction and is recorded here rather than argued again.

The mechanism is CSS, not JavaScript. `user-scalable=no` and `maximum-scale`
have been ignored by iOS Safari since iOS 10, so the viewport meta alone does
not deliver the goal on an iPhone; `touch-action: pan-x pan-y` removes the
pinch-zoom gesture while leaving panning and scrolling, and is honoured by
Safari. Both are set, so a browser that honours either one blocks the gesture.

## Acceptance criteria

- AC1: The landing page removes the pinch-zoom gesture through `touch-action` while keeping scroll and pan, i.e. it no longer uses the permissive `manipulation` value. | verify: `grep -qE 'touch-action:[[:space:]]*pan-x[[:space:]]+pan-y' docs/assets/landing.css && ! grep -qE 'touch-action:[[:space:]]*manipulation' docs/assets/landing.css`
- AC2: The landing page's viewport meta also denies scaling for the browsers that honour it. | verify: `grep -qE '<meta name="viewport"[^>]*user-scalable=no' docs/index.html && grep -qE '<meta name="viewport"[^>]*maximum-scale=1' docs/index.html`
- AC3: The status page removes the pinch-zoom gesture the same way. | verify: `grep -qE 'touch-action:[[:space:]]*pan-x[[:space:]]+pan-y' scripts/project-state/renderReport.js && ! grep -qE 'touch-action:[[:space:]]*manipulation' scripts/project-state/renderReport.js`
- AC4: The status page's viewport meta also denies scaling. | verify: `grep -qE 'user-scalable=no' scripts/project-state/renderReport.js && grep -qE 'maximum-scale=1' scripts/project-state/renderReport.js`
- AC5: The three assertions 0183 wrote to keep pinch zoom available are inverted rather than deleted, so the new behaviour is pinned as deliberately as the old one was. | verify: `! grep -qE 'not\.toMatch\(/user-scalable' scripts/project-state/renderReport.test.js && grep -qE 'user-scalable' scripts/project-state/renderReport.test.js && forge-test --run scripts/project-state`
- AC6: No comment or area note still claims that pinch zoom stays available on these pages. | verify: `! grep -rniE 'pinch' scripts/project-state/renderReport.js docs/assets/landing.css docs/index.html .claude/rules/areas/project-state.md .claude/rules/areas/docs.md | grep -viE 'blocked|disabled|removed|unterbunden|gesperrt|entfernt'`

## Out of scope

- The React application under `src/` and its own `index.html`. Only the two
  static pages are affected.
- `tools/rules-editor/`.
- JavaScript on the status page. `renderReport.test.js` forbids `<script>` and
  `<link>` in the emitted document and that stays true — the fix is CSS and a
  meta tag.
- Everything else 0183 delivered: touch targets, the reachable navigation, the
  focus-openable tooltips, reduced motion, image weight. None of it changes.
- WCAG 1.4.4 conformance. It is knowingly given up, see the goal.
