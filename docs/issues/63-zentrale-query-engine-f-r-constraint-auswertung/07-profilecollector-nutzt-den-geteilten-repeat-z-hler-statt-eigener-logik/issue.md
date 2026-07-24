Status: ready-for-agent
Type: refactor
Blocked by: [06]

## Description
`profileCollector.computeRepeatCount` (`src/solver/profileCollector.js:78-115`)
ist ein eigenständiger, live genutzter Repeat-Zähler
(`collectUnitProfilesAndRules` → `applyCharacteristicModifier` → `:130`; skaliert
Profil-Statwerte wie „+1 Attacke je 3 Modelle"). Er umgeht den Kernel
**vollständig**: er ruft weder `resolveScopeAnchor` noch `measureOver` und baut in
`countMatches` (`:85-102`) einen **eigenen** Ziel-Matcher.

Dieser Inline-Matcher ist schwächer als der Kernel-Matcher
`createEntryInstanceMatcher` mit `REPEAT_TARGET_MATCH_OPTIONS`
(`modifierEvaluator.js:323-326`): er kann `targetId`/aufgelöste-ID/`model`-deckt-
`unit`, aber **nicht** die Kategorie-Mitgliedschaft. Ein kategorie-zählender
Repeat liefert damit im Profil eine andere Zahl als in der Validierung — nicht
nur Code-Duplikat (DRY-Verstoß), sondern eine fachliche Divergenz.

Ziel: `profileCollector` verwendet denselben, in Slice 06 gefestigten
Repeat-Zähler `countRepeatOccurrences` aus `modifierEvaluator`. Der Hand-Matcher
`countMatches` und die duplizierte Scope-/Arithmetik-Logik in
`computeRepeatCount` entfallen. `countRepeatOccurrences` wird dazu aus
`modifierEvaluator` exportiert.

## Acceptance Criteria
- [ ] `profileCollector` importiert und nutzt `countRepeatOccurrences` (aus `modifierEvaluator`); `computeRepeatCount` samt dem Inline-Matcher `countMatches` ist entfernt.
- [ ] Ein kategorie-zählender Repeat liefert im Profil-Statwert dieselbe Zahl wie in der Validierung — nachgewiesen durch einen Regressionstest, der genau diesen Fall vor dem Umbau abweichend und nach dem Umbau gleich zeigt.
- [ ] Kein zweiter Repeat-Zähler und kein zweiter zählender Ziel-Matcher verbleibt neben dem Kernel (Ausnahme: der bewusst separate `instanceOf`-`checkInstance`).
- [ ] vitest (`npm test` Unit-Teil) und Puppeteer-E2E (`node src/solver/ui.test.js`) sind grün.

## Comments
