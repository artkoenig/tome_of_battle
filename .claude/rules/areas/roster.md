---
paths:
  - "src/roster/**"
  - "src/evaluation/**"
  - "src/db/**"
---

# Write model, bridge and persistence

`src/roster/` builds and rewrites the selection tree. `src/evaluation/` translates it for the
evaluator. `src/db/` persists it in IndexedDB.

- `src/roster/` is **structural only** — it never judges a roster (ADR 0011). A rule check that
  creeps in here duplicates the evaluator and will drift from it.
- No import of `src/evaluator/**` from `src/roster/**`, in either direction; the rule is blocking
  in `forge-lint`. Anything that needs both belongs in `src/evaluation/`.
- `src/roster/index.js` is a convenience barrel, not an enforced facade — do not rely on it to hide
  a module.
- `evaluateAppRoster` in `src/evaluation/` is the single memoized seam; adding a second call path
  into the evaluator silently defeats `evaluationCache.js`.
- A change to the persisted shape in `src/db/database.js` needs a migration — existing users carry
  their IndexedDB across releases (ADR 0002).
- Three modules read a catalogue's **root pools** and they do not agree, by design:
  `entryVisibility.js`'s `collectPrimaryCategoryEntries` (der `+`-Adder) also reads
  `sharedSelectionEntries` — die Söldner-Regimenter hängen daran —, `listRules.js` darf das
  nicht: es *setzt* Einträge automatisch, und ein geteilter Eintrag ist allein über einen
  Verweis erreichbar (BSData §7.2, wie `resolver.js` im Evaluator). Wer einen Pool ändert, prüft
  zuerst, ob die Stelle anbietet oder setzt.
- The only automatic, choice-free write into a roster is `useRoster.js`'s fresh-roster effect over
  `findMissingMandatoryListRuleSelections` — gated on `isFreshRoster`, ohne Undo-Schritt. Alles,
  was dort hineingerät, erscheint für den Nutzer aus dem Nichts auf Kontingent-Ebene.
- `src/roster/` still holds a legacy `no-circular` warning (`modifierEvaluator → queryEngine →
  rosterCounter`). It is a warning by design; do not add a second one.
