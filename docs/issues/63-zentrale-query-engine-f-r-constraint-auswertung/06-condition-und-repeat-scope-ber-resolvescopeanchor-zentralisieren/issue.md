Status: resolved
Type: refactor
Blocked by: None

## Description
Slice 03 hat Conditions und Repeats an das Zähl-Primitiv `measureOver` (L2b)
angeschlossen, aber **nicht** an `resolveScopeAnchor` (L2a) — die laut ADR 0029
*einzige* scope-bewusste Stelle. `evaluateCondition`
(`src/solver/modifierEvaluator.js:146-190`) und `countRepeatOccurrences`
(`:317-345`) entscheiden das Scope→Anker-Mapping stattdessen inline noch einmal.

Folge (per Datenfluss belegt): derselbe Scope-Token wird für Constraints und für
Conditions/Repeats **unterschiedlich** aufgelöst.
- `force`: Constraint → `AGGREGATE`, liest `forceSelectionCounts[force.id]` (pro
  Kontingent, `queryEngine.js:270-282`); Condition/Repeat → `COUNT_BUCKET`, liest
  `selectionCounts` (armeeweit, `modifierEvaluator.js:186`).
- `entry`/`category`: Constraint → `ENTRY_BUCKET`
  (`categoryCounts[force.id]`); Condition/Repeat → `COUNT_BUCKET`.
Der `parent`-Lauf und der `shared="false"`-Teilbaum-Anker sind bereits
deckungsgleich; nur die aggregierten Scopes (force/roster/entry/category)
divergieren.

Ziel: das Scope→Anker-Mapping existiert für **alle** Query-Arten genau an einer
Stelle (`resolveScopeAnchor`). Die maßgebliche Zähl-Frame wird nicht nach
Query-Art, sondern nach **Ziel-Typ** bestimmt — die XSD gibt für einen Unterschied
nach Query-Art nichts her (`QueryBase` ist für Constraint/Condition/Repeat
identisch, `Catalogue.xsd:421-434`).

**Festgelegte Entscheidung (Nutzer, „Kategorie immer armeeweit"):** Der Frame pro
Scope/Ziel-Typ, einheitlich für Constraint, Condition und Repeat:
- `roster` → armeeweit.
- `force` + **Eintrags**-Ziel → pro Kontingent (`forceSelectionCounts[force.id]`).
- **Kategorie**-Ziel (scope = Kategorie-ID bzw. `field`/`childId` benennt eine
  Kategorie) → **armeeweit aggregiert**, für *alle* Query-Arten. Das kodiert die
  §7.7-Domänenregel („Kategorie-Zähler über alle Forces aggregiert") einheitlich
  als Ziel-Typ-Regel.
- `parent` → Teilbaum des Eltern-Containers; `shared="false"` → Instanz-Teilbaum
  (beide bereits deckungsgleich).

**Bewusste Verhaltensänderung (spec-korrekt, ADR 0029):** Eine Kategorie-*Constraint*
zählt dadurch armeeweit statt pro Kontingent — heute liest sie `categoryCounts[force.id]`
(`queryEngine.js:244-254`, `ENTRY_BUCKET`). Nur bei Multi-Force-Rostern beobachtbar;
bei Ein-Force-Listen identisch. Die bereits getestete Zusage „Kategorie-Condition
armeeweit" (Issue 03 AC, `rosterValidator.mandatoryRosterSelector.test.js:156`)
bleibt erhalten und wird auf Constraints ausgeweitet, nicht gebrochen.

**Nicht in Scope:** der `instanceOf`/`notInstanceOf`-Matcher `checkInstance`
(`modifierEvaluator.js:250-273`). Das ist ein boolescher Mengen-Zugehörigkeits-
test, kein „Zählen in einem Rahmen"; er teilt die Query-Semantik der zählenden
Pfade nicht und bleibt bewusst separat.

## Acceptance Criteria
- [ ] `evaluateCondition` und `countRepeatOccurrences` lösen ihren Scope über `resolveScopeAnchor` auf; in `modifierEvaluator.js` verbleibt kein eigener Inline-Zweig, der zum Zählen auf Scope-Schlüsselwörter (`force`/`roster`/`parent`/`entry`/`category`) verzweigt.
- [ ] `resolveScopeAnchor` bestimmt den Frame nach **Ziel-Typ**: Kategorie-Ziel → armeeweit (für Constraint *und* Condition/Repeat), Eintrags-Ziel + `force` → pro Kontingent, `roster` → armeeweit; die Regel steht an genau dieser einen Stelle mit Bezug auf §7.7.
- [ ] Ein gegebener Scope-Token/Ziel-Typ liefert für Constraint und für Condition/Repeat denselben Anker und dieselbe Zähl-Semantik (kein query-art-abhängiger Zweig).
- [ ] Eine kategoriezählende Condition bleibt armeeweit (Regressionsschutz: der bestehende Test `rosterValidator.mandatoryRosterSelector.test.js:156` bleibt grün), und eine kategoriezählende Constraint zählt nun ebenfalls armeeweit (neuer Test an einem Multi-Force-Roster).
- [ ] Der `parent`-Scope-Lauf und der aggregierte force/roster/kategorie-Anker existieren jeweils nur noch einmal (in `resolveScopeAnchor`), nicht mehr zusätzlich in `modifierEvaluator.js`.
- [ ] Jede dadurch geänderte Validierungs-/Modifier-Auswertung an einem realen Katalog ist als spec-korrekte Korrektur dokumentiert (Comment am Issue), nicht stillschweigend.
- [ ] vitest (`npm test` Unit-Teil) und Puppeteer-E2E (`node src/solver/ui.test.js`) sind grün; neue Unit-Tests decken die zuvor divergierenden force/kategorie-Fälle für Conditions und Repeats ab.

## Comments
- Umgesetzt: evaluateCondition/countRepeatOccurrences lösen ihren Scope jetzt über resolveScopeAnchor (L2a) auf; die Inline-Anker (resolveContainerAnchor/resolveCountBucketAnchor/resolveSubtreeAnchor) sind aus modifierEvaluator entfernt. Frame nach Ziel-Typ, §7.7 an einer Stelle (queryEngine.isCategoryTargetId + FORCE-Zweig). Verhaltens-Delta (spec-korrekt): (1) Condition/Repeat mit scope=force + EINTRAGS-Ziel zählen nun PRO KONTINGENT statt armeeweit — nur auf Multi-Force-Rostern beobachtbar, in der Validierung real wirksam (counts jetzt in die Condition-ctx durchgereicht). (2) Kategorie-Ziel zählt für ALLE Query-Arten armeeweit; für die ENTRY_BUCKET-Kategorie-Constraint bestätigt sich die im Issue vermutete Subtilität: sie war durch die selectionCounts-vor-forceCategoryCounts-Reihenfolge bereits armeeweit — jetzt bewusst/dokumentiert statt zufällig (kein reales Delta). checkForceCategoryLimits (per-Kontingent-Kategorie-CAP, CATEGORY-Anker) bleibt bewusst pro Force und ist NICHT Teil dieser Vereinheitlichung. Drei synthetische Tests, die den alten per-Force-Zähler-Griff (Zähler in forceCategoryCounts statt selectionCounts) festhielten, auf die armeeweite Tabelle umgestellt (modifierGating, repeatingModifiers, multiplyModifier) — dokumentiert im jeweiligen Test-Kommentar. Neue Tests: scopeUnification.test.js. Alle 1581 Unit-Tests grün, E2E grün, lint+typecheck sauber.
- Nachtrag (Koordinator-Korrektur): Force-deklarierte Kategoriegrenzen (checkForceCategoryLimits) zählen jetzt ebenfalls ARMEEWEIT statt pro Kontingent — konsistent mit der settled decision 'Kategorie immer armeeweit' (§7.7). Der eine 'count' (resolveCategoryAnchor) wird nun aus der armeeweiten selectionCounts-Tabelle gespeist (derselben SSOT, die der ENTRY_BUCKET-Anker zuerst liest; keine zweite Aggregation); er trägt sowohl max (Cap) als auch min (Pflicht) und sowohl categoryLink- als auch categoryEntry-force-Constraints (collectCategoryEntryForceConstraints) — alle damit armeeweit. Delta nur auf Multi-Force-Rostern sichtbar; die App erzeugt Ein-Force-Roster (createRoster.js) und alle drei .ros-Fixtures sind Ein-Force, dort per-Kontingent==armeeweit → kein reales Delta, nur der Multi-Force-Fall wird kompositions-korrekt. Geprüft (Punkt 2/3): (a) collectCategoryEntryForceConstraints teilt denselben count → mit erfasst; (b) isCategoryLinkHidden zählt Kategorie-Ziele bereits armeeweit — seine hidden-Bedingungen laufen durch evaluateCondition (Slice-06-Pfad, Kategorie-Ziel→selectionCounts) und es wertet bewusst ohne force aus, daher bleibt es unverändert korrekt; (c) profileCollector.js:108-110 liest selectionCounts vor forceCategoryCounts → für belegte Kategorien bereits armeeweit, und ist ohnehin Ziel von Issue 07 (nicht angefasst); (d) UI-Anzeige (RosterSidebar/RosterCategorySection) zeigt bewusst die per-Kontingent-Belegung — Anzeige, keine Grenzwertung, out of scope. Neuer Test: rosterValidator.forceCategoryConstraints.test.js (Multi-Force category-max armeeweit + Ein-Force unverändert). Alle 1583 Unit-Tests grün, E2E grün, lint+typecheck sauber.
