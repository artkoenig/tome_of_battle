---
status: done
branch: claude/list-view-filter-1haa1f
pr: 275
---

# Filter the army list overview by game system and faction

## Goal

The army list overview lets a user narrow the shown lists to a chosen set of game systems and
factions, shows the current selection as dismissible chips with a clear-all control, is reachable
on mobile as well as on desktop, and remembers the selection across a restart of the app. The cards
are no longer grouped by game system, and the desktop toolbar gives the room the heading used to
take to the filter control.

## Acceptance criteria

- AC1: The overview's desktop toolbar holds the filter control on the left, where the heading and
  its subtitle stood, and the import and new-list actions on the right. Neither the heading nor the
  subtitle is rendered any more, and while any value is selected the filter control shows how many
  values are selected.
  | verify: forge-test --run src/tests/ui/components/RosterDashboard
- AC2: The filter control opens a panel offering multi-select over game systems and over factions.
  Each list holds only the values that actually occur among the stored army lists, under the
  display name shown elsewhere in the current UI language.
  | verify: forge-test --run src/tests/ui/components/RosterDashboard
- AC3: The cards are grouped by faction only. The game-system grouping level is gone, so a faction
  appears once and its heading no longer sits inside a system heading.
  | verify: forge-test --run src/tests/ui/viewmodels/useRosterDashboard
- AC4: With a selection active the overview shows only the army lists that match it — values within
  one category combine as OR, the two categories as AND — and a faction group left without a card
  is not rendered at all.
  | verify: forge-test --run src/tests/ui/viewmodels/useRosterDashboard
- AC5: A row below the toolbar shows one dismissible chip per selected value plus a clear-all
  control. Dismissing a chip removes exactly that value; clear-all empties the selection and the
  row disappears with it.
  | verify: forge-test --run src/tests/ui/components/RosterDashboard
- AC6: A selection that matches no army list produces its own message saying so, together with the
  clear-all control — not the first-start empty state a user without any list sees.
  | verify: forge-test --run src/tests/ui/components/RosterDashboard
- AC7: Below the app's mobile breakpoint the filter is reachable from the app header next to the
  settings control and opens in the app's existing bottom-sheet overlay, with the chip row visible
  under the header.
- AC8: The selection survives a reload: it is written to the app's persisted settings and restored
  on start, so an army list hidden by a filter is still hidden after a restart.
  | verify: forge-test --run src/tests/ui/viewmodels/SettingsContext
- AC9: Changing the filter does not re-run the evaluation of an army list — a report is still
  computed once per army list and system identity, not once per filter change.
  | verify: forge-test --run src/tests/ui/viewmodels/useRosterDashboard
- AC10: Every string the filter shows exists as a key under `dashboard.filter.` in the German and
  in the English locale file.
  | verify: grep -q '"dashboard\.filter\.' src/ui/i18n/locales/de.json && grep -q '"dashboard\.filter\.' src/ui/i18n/locales/en.json
- AC11: The lint and type gates stay green: the filter's state and its predicate live in the view
  model layer, the overview component stays JSX only.
  | verify: forge-lint

## Out of scope

- Filtering or searching by list name, points, force or date. A date filter would need a new
  persisted field on the army list and a database migration; neither belongs in this issue.
- Sorting. The faction groups and the cards within them keep the alphabetical order they have
  today, with the catch-all group last.
- Every screen other than the overview — the editor, play mode and the rules index get no filter.
- The Battlescribe import and the persisted shape of an army list itself.
