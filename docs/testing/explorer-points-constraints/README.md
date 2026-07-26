# E2E-Szenario: Explorer Points Constraints (`limit::<costTypeId>`)

**Rolle:** Black-Box-Test (keine Inspektion des Evaluator-Quellcodes).
Dieses E2E-Szenario prüft das Verhalten von `limit::<costTypeId>`-Feldern mit `scope="force"` in Conditions an echten Katalogdaten.

## Hintergrund & Datensatz

- **GameSystem:** `src/evaluator/__fixtures__/whfb6-definitive/Warhammer Fantasy Battles (6th definitive edition).gst` (id `0d13-7737-ea86-4662`)
- **Catalogue:** `src/evaluator/__fixtures__/whfb6-definitive/Mercenaries (6th definitive edition).cat` (id `fc47-8392-a6c8-452a`)
- **Punkte-Kostenart (costTypeId):** `ecfa-8486-4f6c-c249` (`pts`)

In `Mercenaries (6th definitive edition).cat` existiert der Eintrag `Border Patrol (500pts)` (ID `2066-082d-a465-4baf`):
- **Constraint ID `1a97-1579-ab05-a6d7`:** `type="min"`, `value="0"`, `field="selections"`, `scope="parent"`
- **Modifier:** `type="set"`, `value="1"`, `field="1a97-1579-ab05-a6d7"`
- **Condition:** `<condition type="equalTo" value="500" field="limit::ecfa-8486-4f6c-c249" scope="force" childId="any" shared="true" includeChildSelections="true" includeChildForces="true"/>`

## Roster & Erwartungen

1. **`rosters/01-border-patrols-500pts.ros`**
   - Roster mit `gameSystemId="Warhammer Fantasy Battles (6th definitive edition)"` und `<costLimits>`: `costTypeId="ecfa-8486-4f6c-c249"`, `value="500"`.
   - Force: `id="fa9c-5f79-ce12-480c"`, `catalogueId="Mercenaries (6th definitive edition)"`.
   - Ohne den "Border Patrols rules" Eintrag im Roster.
   - Da das Budget 500 pts beträgt, wertet die Condition `equalTo 500` für `limit::ecfa-8486-4f6c-c249` mit `scope="force"` wahr aus. Der Modifikator setzt die Untergrenze von `1a97-1579-ab05-a6d7` auf 1. Da der Eintrag nicht gewählt ist (`actual=0`), feuert die Schranke.
   - Erwartung: `firing: [{ "limitId": "1a97-1579-ab05-a6d7", "actual": 0, "bound": 1 }]`, `diagnostics.absent: [{ "kind": "UNRESOLVED_BUDGET_LIMIT" }]`.

2. **`rosters/02-border-patrols-1000pts.ros`**
   - Roster mit `costLimits`: `costTypeId="ecfa-8486-4f6c-c249"`, `value="1000"`.
   - Force: `id="fa9c-5f79-ce12-480c"`, `catalogueId="Mercenaries (6th definitive edition)"`.
   - Ohne den "Border Patrols rules" Eintrag im Roster.
   - Bei 1000 pts trifft `equalTo 500` nicht zu. Die Untergrenze bleibt 0.
   - Erwartung: `absent: ["1a97-1579-ab05-a6d7"]`, `diagnostics.absent: [{ "kind": "UNRESOLVED_BUDGET_LIMIT" }]`.

## Verifizierte Bausteine (Katalogdaten)

| Element | ID / Wert |
|---------|-----------|
| GameSystem ID | `0d13-7737-ea86-4662` / `Warhammer Fantasy Battles (6th definitive edition)` |
| Catalogue ID | `fc47-8392-a6c8-452a` / `Mercenaries (6th definitive edition)` |
| CostType ID (pts) | `ecfa-8486-4f6c-c249` |
| SelectionEntry `Border Patrol (500pts)` | `2066-082d-a465-4baf` |
| Constraint ID (min 0) | `1a97-1579-ab05-a6d7` |
| Constraint Max ID | `ac2c-85cb-fdd9-9fe0` |
| Force ID in Rostern | `fa9c-5f79-ce12-480c` |
