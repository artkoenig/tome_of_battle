# E2E-Regeln & Testkatalog: Unresolved Limit Force Scope (Mercenaries)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an etablierten Tests verifiziert.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, rev 1)

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **UL-R1** | Ein `limit::`-Zugriff mit `scope="force"` kann das Punktebudget einer Force korrekt lesen. Da das Limit gesetzt ist, darf es **keine** `UNRESOLVED_BUDGET_LIMIT`-Diagnose für diese Kostenart geben. | Das Verhalten der Evaluator-Engine beim Auswerten von limits. |
| **UL-R2** | Modifikatoren mit `limit::`-Zugriff triggern ordnungsgemäß, wenn die Punktegrenze auf Force-Ebene zutrifft. | `selectionEntry "Border Patrol (500pts)"` `2066-082d-a465-4baf` in `Mercenaries.cat` → `modifier` (setzt `value=1`) auf Constraint `1a97-1579-ab05-a6d7` mit `condition equalTo 500 field="limit::ecfa-8486-4f6c-c249" scope="force"`. |

---

## Verifizierte Bausteine

| Id | Typ | Name im Katalog |
|----|-----|-----------------|
| `fc47-8392-a6c8-452a` | `catalogue` | Mercenaries |
| `2066-082d-a465-4baf` | `selectionEntry` | Border Patrol (500pts) |
| `1a97-1579-ab05-a6d7` | `constraint` | Minimum 0 Selections (wird modifiziert zu 1) |
| `ecfa-8486-4f6c-c249` | `costType` | pts |

## Test-Katalog (Rosters)

| # | Setup | Erwartung (Diagnosen & Constraints) | Datei |
|---|-------|-------------------------------------|-------|
| 01 | Force-Limits für 'pts' auf genau 500 | **UL-R1:** Diagnose `UNRESOLVED_BUDGET_LIMIT` tritt **nicht** auf.<br>**UL-R2:** Constraint `1a97-1579-ab05-a6d7` feuert mit **Ist 0 / Grenze 1**, da der `limit::`-Ausdruck den Wert liest und das Minimum (ohne existierende Selektion) anhebt. | [`01-force-limit-500.ros`](rosters/01-force-limit-500.ros) |
