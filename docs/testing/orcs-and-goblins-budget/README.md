# E2E-Regeln & Testkatalog: Orcs and Goblins — budget-gesteuertes Verhalten

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind
**aus den Katalogdaten** der *6th Definitive Edition* abgeleitet — nicht aus einem
Engine-Lauf. Die Erwartungswerte wurden über den manifest-getriebenen Runner
(`src/evaluator/e2e.testcatalog.test.js`) bestätigt.

Das Roster stellt sein Punktebudget je Kostenart über einen `<costLimits>`-Block
am `<roster>`-Wurzelelement ein:

```xml
<costLimits>
  <costLimit typeId="ecfa-8486-4f6c-c249" name="pts" value="2000"/>
</costLimits>
```

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat` — Force **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (id `fc47-8392-a6c8-452a`),
  per `catalogueLink` aus der O&G-`.cat` deklariert (wie im Basis-Szenario
  `orcs-and-goblins` mitgeführt).
- Punkte-Kostenart: `pts` `ecfa-8486-4f6c-c249` (in der `.gst` deklariert:
  `costType id="ecfa-8486-4f6c-c249" name="pts"`).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **OGB-R1** | **Budget-gesteuerte Core-Untergrenze.** Die Core-Mindestzahl skaliert mit dem gesetzten Punktebudget: Basis **2**, ab **2000** pts → **3**, ab **3000** pts → **4** (weiter: 4000 → 5, 5000 → 6). | `.gst` `categoryEntry` „Core" `64bf-efb4-9978-26df` → constraint **`35c2-d478-392a-aeb1`** (`type=min value=2 field=selections scope=force`), plus `set`-Modifikatoren mit `conditionGroup` `atLeast/lessThan` auf `field="limit::ecfa-8486-4f6c-c249" scope="roster"` (Zeilen 383/395: `set 3` für 2000–2999, `set 4` für 3000–3999). |
| **OGB-R2** | **Budget-Überschreitung (Engine-Regel, nicht im Katalog).** Übersteigt die verplante Punktsumme das gesetzte `<costLimits>`, feuert eine roster-weite Budget-Verletzung. Die Grenze wird bei Gleichstand (Summe = Limit) **nicht** verletzt (strikte Überschreitung). | Grenz-Id **`budget::ecfa-8486-4f6c-c249`**, abgeleitet aus der Kostenart-Id `ecfa-8486-4f6c-c249` und dem roster-weiten `<costLimits>`-Wert. Kein Katalog-Constraint — die Regel ist Engine-seitig. Punktquelle: Orc-Boyz-Modell `cef0-77ce-8158-32d4` `cost name="pts" value="5"`. |
| **OGB-R3** | **Kein Budget gesetzt → Diagnose + fail-closed.** Fehlt der `<costLimits>`-Block, erzeugt eine `limit::`-lesende Regel die Diagnose **`UNRESOLVED_BUDGET_LIMIT`** statt still 0 anzunehmen; die Core-Grenze bleibt auf dem Basiswert **2** (skaliert nicht auf 3). | Fehlender `<costLimits>`-Block; die `set`-Modifikatoren aus OGB-R1 lesen `limit::ecfa-8486-4f6c-c249` und können ohne gesetztes Budget nicht auflösen → Diagnose `UNRESOLVED_BUDGET_LIMIT` (Schlüssel der SSOT-Aufzählung `DiagnosticKind`). |

### Verwendete reale Einträge

- **Orc Boyz** (Einheit) `ac23-b9d3-4046-23b7` (`type=unit`): `categoryLink` → „Core"
  `64bf-efb4-9978-26df` (`primary=true`); enthält das Modell **Orc Boyz**
  `cef0-77ce-8158-32d4` (`type=model`) mit `cost name="pts" value="5"`.
- **Orc Arrer Boyz** `bc74-bb63-2abd-4e0b` (`type=unit`): `categoryLink` → „Core".
- **Savage Orc Boyz** `e4d9-143c-2cf3-6615` (`type=unit`): `categoryLink` → „Core".

Eine Orc-Boyz-Einheit mit **30** Modellen à 5 pts ergibt die per Runner
bestätigte Summe **150 pts**.

---

## Testkatalog (E2E-Szenarien)

> **Assertion-Fokus:** nur die genannten Grenz-/Diagnose-Ids. Das Manifest
> [`scenario.json`](scenario.json) pinnt die per Runner verifizierten Werte.
> Andere Pflichten (General min 1, Core-Basis) dürfen zusätzlich feuern, ohne
> einen Fall zu brechen.

| # | Roster / Budget | Erwartetes Ergebnis (aus Katalogdaten abgeleitet, per Runner bestätigt) | Fixture |
|---|-----------------|------------------------------------------------------------------------|---------|
| 01 | Leeres Kontingent, `pts=2000` | **OGB-R1:** Core `35c2-d478-392a-aeb1` feuert **Ist 0 / Grenze 3** (skaliert von 2). | [`01-empty-2000.ros`](rosters/01-empty-2000.ros) |
| 02 | Leeres Kontingent, `pts=3000` | **OGB-R1:** Core feuert **Ist 0 / Grenze 4** (skaliert von 2). Derselbe Aufbau, anderer Grenzwert → belegt die Budget-Steuerung. | [`02-empty-3000.ros`](rosters/02-empty-3000.ros) |
| 03 | Drei Core-Einheiten, `pts=2000` | **OGB-R1 (erfüllt):** Core-Ist 3 ≥ skalierte Grenze 3 → Core `35c2-d478-392a-aeb1` **feuert nicht** (absent). | [`03-three-core-2000.ros`](rosters/03-three-core-2000.ros) |
| 04 | Orc-Boyz-Einheit, 30 Modelle, `pts=100` | **OGB-R2:** Budget `budget::ecfa-8486-4f6c-c249` feuert **Ist 150 / Grenze 100** (Summe übersteigt Limit). | [`04-over-budget.ros`](rosters/04-over-budget.ros) |
| 05 | Dieselbe Einheit (Summe 150), `pts=150` | **OGB-R2 (Grenzfall):** Summe = Limit → Budget `budget::ecfa-8486-4f6c-c249` **feuert nicht** (absent; strikte Überschreitung). | [`05-within-budget.ros`](rosters/05-within-budget.ros) |
| 06 | Leeres Kontingent, **ohne** `<costLimits>` | **OGB-R3:** Diagnose `UNRESOLVED_BUDGET_LIMIT` tritt auf; Core `35c2-d478-392a-aeb1` bleibt auf **Ist 0 / Grenze 2** (skaliert **nicht** auf 3). | [`06-no-budget.ros`](rosters/06-no-budget.ros) |

*Fall 06 belegt fail-closed: ohne Budget wird die Core-Grenze nicht still auf
einen skalierten Wert gehoben, sondern bleibt auf der Basis 2, begleitet von der
Diagnose statt einer stillen 0.*

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (gst) | `0d13-7737-ea86-4662` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| Kostenart „pts" | `ecfa-8486-4f6c-c249` |
| Kategorie „Core" / constraint min 2 (force) | `64bf-efb4-9978-26df` / `35c2-d478-392a-aeb1` |
| Budget-Grenze (Engine, roster-weit) | `budget::ecfa-8486-4f6c-c249` |
| Orc Boyz (Einheit) / Orc Boyz (Modell, 5 pts) | `ac23-b9d3-4046-23b7` / `cef0-77ce-8158-32d4` |
| Orc Arrer Boyz / Savage Orc Boyz (Core) | `bc74-bb63-2abd-4e0b` / `e4d9-143c-2cf3-6615` |
