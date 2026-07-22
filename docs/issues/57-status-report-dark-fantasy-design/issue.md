Status: ready-for-agent
Type: style
Blocked by: None

## Description
# PRD: Epic Battlefield Theme for Status Report

## Problem Statement
The automated project status report page at `/status` currently uses the legacy light parchment design system instead of matching the newly introduced "Epic Battlefield" dark fantasy design system of the landing page.

## Solution
Update `scripts/project-state/renderReport.js` and its embedded CSS (`REPORT_STYLES`) to match the "Epic Battlefield" dark fantasy design system:
- Use dark slate background (`#07090E`), obsidian glassmorphism cards (`rgba(21, 26, 38, 0.85)`), and gold accent borders (`rgba(212, 175, 55, 0.25)`).
- Update typography tokens to `Cinzel` for headings, `Outfit` for subheadings/badges/tabs, and `Inter` for body text.
- Format the `← Zurück zur Landingpage` header button to match the landing page CTA link design.
- Regenerate `docs/status/index.html` with the updated design.

## Acceptance Criteria
- [ ] Status report page styling matches the Epic Battlefield dark fantasy theme.
- [ ] Header link `← Zurück zur Landingpage` uses gothic gold button styling.
- [ ] Tests in `scripts/project-state/renderReport.test.js` pass cleanly.
- [ ] `docs/status/index.html` is updated and committed.
