Status: resolved
Type: refactor
Blocked by: None

## Description
Ziel: **eine einzige** Scope→Anker-Auflösung für alles. Aktuell gibt es zwei
Eintrittspunkte, die eine Kategorie zählen:
- `resolveScopeAnchor` (die eine scope-bewusste Stelle) — für Query-Scopes von
  Constraints/Conditions/Repeats.
- `resolveCategoryAnchor` — direkt gerufen von `checkForceCategoryLimits`
  (`src/solver/rosterValidator.js`) für die am Force deklarierten Kategorie-Limits.

Sie liefern **nicht** dasselbe für eine **leere** Kategorie: der `CATEGORY`-Anker
zählt leer als echte **0** (`queryEngine.js:390`, `forceCategoryCounts[categoryId] || 0`),
der `ENTRY_BUCKET`-Weg von `resolveScopeAnchor` fällt bei leer auf **1** zurück
(`queryEngine.js:379-382`, `... || instanceCount`). Genau diese „leer = 0"-
Eigenschaft ist der Grund für den zweiten Weg — und sie muss beim Zusammenführen
erhalten bleiben, sonst würde eine Pflicht-Mindestgrenze (min) auf einer leeren
Kategorie fälschlich als erfüllt gelten.

Umsetzung: `resolveScopeAnchor` wird der **einzige** Resolver auch für diesen Fall.
Ein **Kategorie-Ziel** (`isCategoryTargetId`) liefert dort immer die „leer = 0"-
Semantik — unabhängig davon, ob der Aufruf aus einem Query-Scope oder aus den
force-deklarierten Limits kommt. `checkForceCategoryLimits` (und jeder andere
`resolveCategoryAnchor`-Aufrufer) ruft danach `resolveScopeAnchor`, nicht mehr
einen eigenen Anker. `resolveCategoryAnchor` entfällt als zweiter öffentlicher
Eintrittspunkt (oder wird zum internen, von `resolveScopeAnchor` genutzten
Konstruktor).

## Acceptance Criteria
- [ ] `checkForceCategoryLimits` und alle anderen bisherigen `resolveCategoryAnchor`-Aufrufer lösen ihre Kategorie-Zählung über `resolveScopeAnchor` auf; es gibt keinen zweiten öffentlichen Anker-Eintrittspunkt für „Kategorie zählen" mehr.
- [ ] Ein Kategorie-Ziel zählt eine **leere** Kategorie als echte **0** (nicht 1) — einheitlich über alle Aufrufer; nachgewiesen durch einen Test, in dem eine Pflicht-Mindestgrenze (min) auf einer leeren Kategorie als Verstoß anschlägt und eine Obergrenze (max) auf derselben leeren Kategorie nicht.
- [ ] Kategorie-Zählung bleibt armeeweit (der bestehende Multi-Force-Test aus Slice 06 bleibt grün).
- [ ] Kein Verhaltenswechsel für nicht-leere Kategorien und für Eintrags-Ziele (deren Instanz-Fallback bleibt unangetastet).
- [ ] vitest (`npm test` Unit-Teil) und Puppeteer-E2E (`node src/solver/ui.test.js`) sind grün; lint und typecheck sauber.

## Comments
- Umgesetzt: resolveCategoryAnchor und der CATEGORY-AnchorKind sind entfernt; resolveScopeAnchor ist der einzige Kategorie-Zähl-Eintrittspunkt. Die leere-Kategorie=0-Semantik lebt jetzt über ein isCategoryScope-Flag am ENTRY_BUCKET (Kategorie-Ziel -> 0 bei leer, Eintrags-Ziel behält den Instanz-Fallback). checkForceCategoryLimits ruft resolveScopeAnchor({scope: targetCatId}, ...). Verhaltens-Delta (spec-korrekt): ein kategorie-gescopetes Constraint auf einer LEEREN Kategorie zählt jetzt 0 statt 1 -> Pflicht-min feuert korrekt. Neuer Test (leere HQ-Kategorie: min feuert, max nicht). vitest 1591 + E2E grün, lint/typecheck/knip sauber.
