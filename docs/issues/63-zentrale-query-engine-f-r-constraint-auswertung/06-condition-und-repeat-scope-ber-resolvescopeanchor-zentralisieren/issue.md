Status: claimed
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
Stelle (`resolveScopeAnchor`). Die maßgebliche Zähl-Frame pro Scope-Token wird
gegen die BSData-Spec (§7.6/§7.7, vendored XSD) bestimmt und für Constraint *und*
Condition/Repeat identisch angewandt. Weicht der heutige Condition/Repeat-Frame
davon ab (z. B. force armeeweit statt pro Kontingent), folgt das Verhalten der
Spec — latente Divergenz wird spec-korrekt aufgelöst (ADR 0029, Format-
Korrektheit als Oracle), nicht per Verhaltensparität mit dem Ist-Zustand.

**Nicht in Scope:** der `instanceOf`/`notInstanceOf`-Matcher `checkInstance`
(`modifierEvaluator.js:250-273`). Das ist ein boolescher Mengen-Zugehörigkeits-
test, kein „Zählen in einem Rahmen"; er teilt die Query-Semantik der zählenden
Pfade nicht und bleibt bewusst separat.

## Acceptance Criteria
- [ ] `evaluateCondition` und `countRepeatOccurrences` lösen ihren Scope über `resolveScopeAnchor` auf; in `modifierEvaluator.js` verbleibt kein eigener Inline-Zweig, der zum Zählen auf Scope-Schlüsselwörter (`force`/`roster`/`parent`/`entry`/`category`) verzweigt.
- [ ] Ein gegebener Scope-Token liefert für Constraint und für Condition/Repeat denselben Anker und dieselbe Zähl-Semantik; wo der maßgebliche Frame pro Scope gegen BSData §7.6/§7.7 bestimmt wurde, ist er im Code (Kommentar/Doc) an der einen Stelle belegt.
- [ ] Der `parent`-Scope-Lauf und der aggregierte force/roster/entry/category-Anker existieren jeweils nur noch einmal (in `resolveScopeAnchor`), nicht mehr zusätzlich in `modifierEvaluator.js`.
- [ ] Jede dadurch geänderte Validierungs-/Modifier-Auswertung an einem realen Katalog ist als spec-korrekte Korrektur dokumentiert (Comment am Issue), nicht stillschweigend.
- [ ] vitest (`npm test` Unit-Teil) und Puppeteer-E2E (`node src/solver/ui.test.js`) sind grün; neue Unit-Tests decken die zuvor divergierenden force/entry-Fälle für Conditions und Repeats ab.

## Comments
