Status: resolved
Blocked by: [05]

## Description
`src/solver/modifierEvaluator.js` verwendet App-eigene Aliase (`greaterThanOrEqualTo`/`lessThanOrEqualTo`),
kennt aber nicht die offiziellen BattleScribe-ConditionKind-Werte `atLeast`/`atMost`/`notInstanceOf`.

Im Fork wurden die Katalogdaten (Orcs & Goblins) auf die offiziellen Werte korrigiert.
Sobald diese via Issue 13/06 oder 13/07 in die App gelangen, brechen Condition-Auswertungen,
die diese Werte verwenden — z. B. „Fast Cavalry bei Rüstung ausblenden" — still.

Betroffen ist die `evaluateCondition`-Funktion (ab Zeile 81):
- `atLeast` muss wie `greaterThanOrEqualTo` behandelt werden
- `atMost` muss wie `lessThanOrEqualTo` behandelt werden
- `notInstanceOf` muss die Negation von `instanceOf` sein

Kontext: [Folgefund in 13/05](../../../13-katalog-update-erkennung-und-roster-kompatibilit-t-bei-reimport/05-katalog-fork-aufsetzen/issue.md#L83-L89)

## Acceptance Criteria
- [ ] `evaluateCondition` mapped `atLeast` → `greaterThanOrEqualTo`-Semantik (currentValue >= targetValue)
- [ ] `evaluateCondition` mapped `atMost` → `lessThanOrEqualTo`-Semantik (currentValue <= targetValue)
- [ ] `evaluateCondition` mapped `notInstanceOf` → Negation von `instanceOf` (Entry ist NICHT instantiiert)
- [ ] Bestehende Tests für `greaterThanOrEqualTo`/`lessThanOrEqualTo`/`instanceOf` laufen weiter grün
- [ ] Fork-Katalog mit `atLeast`-Condition wird korrekt ausgewertet

## Comments
- Gefunden in 13/05: Die Korrektur `greaterThanOrEqualTo` → `atLeast` in den Katalogen ist gemacht;
  der Evaluator muss folgen, damit der Import nicht still bricht.
- Gelöst in src/solver/modifierEvaluator.js: atLeast/greaterThanOrEqualTo und atMost/lessThanOrEqualTo als Fall-through cases zusammengelegt; notInstanceOf als isNegated-Variante von instanceOf implementiert (isNegated-Flag negiert alle vier Return-Pfade). Branch: issue/13-08-conditionkind-atleast-atmost-notinstanceof; 369 Tests grün, 2 skipped (unverändert).
