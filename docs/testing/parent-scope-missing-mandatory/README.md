# Szenario: Parent-Scope Missing Mandatory (Engine-Grenze)

Dieses Szenario verifiziert eine bekannte Grenze im Evaluator: Eine Pflicht-Auswahl (Minimum) innerhalb eines Parents (`scope="parent"`, `type="min"`, `field="selections"`) wird aktuell **nicht** als Verletzung erfasst, wenn die besitzende Selektion (hier das Modell innerhalb einer Einheit) komplett im Roster fehlt. Die Regel feuert nur dann korrekt, wenn der Knoten im Rosterbaum existiert, aber eine zu geringe Anzahl aufweist.

## Abgeleitete Regeln aus den Katalogdaten

Die Empire-Katalogdaten definieren die Einheit „Halberdiers“. Diese Einheit verlangt als Modell-Auswahl zwingend mindestens 10 Halberdier-Modelle.

| ID | Regel | Beleg in den Daten (Empire.cat) |
|---|---|---|
| **PSMM-R1** | Minimum 10 Modelle im Parent | `selectionEntry` „Halberdiers“ (Modell) trägt `constraint` `d96c-c95f-8224-7c87` mit `type="min"`, `value="10.0"`, `field="selections"`, `scope="parent"`. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren `.gst` + Empire-`.cat`.

> **Assertion-Fokus:** nur die genannte Constraint-ID `d96c-c95f-8224-7c87`. Andere Armeeaufbau-Diagnosen können zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|---------------------------|----------------|------------------------------------|---------|
| 01 | Fehlender Knoten | `.gst` + Empire-`.cat` | Die Einheit „Halberdiers“ ist im Roster, enthält aber **0** Auswahlen des Modells „Halberdiers“. | **Verletzung von PSMM-R1:** Das Constraint sollte feuern (actual 0 / bound 10), da die Katalogdaten dies verlangen. (Dieser Test wird fehlschlagen, da die Engine das noch nicht unterstützt). | [`01-missing-node.ros`](rosters/01-missing-node.ros) |
| 02 | Zu wenig Modelle (Knoten existiert) | wie 01 | Die Einheit „Halberdiers“ ist im Roster und enthält **5** Auswahlen des Modells „Halberdiers“. | **Verletzung von PSMM-R1:** Das Constraint feuert, da der Knoten da ist und 5 < 10. | [`02-present-but-insufficient.ros`](rosters/02-present-but-insufficient.ros) |

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Beim Anschluss dieses Szenarios an den Runner (`evaluate`: Roster rein → Bericht raus) wurde die Erwartung gegen den tatsächlichen Bericht abgeglichen. Das Szenario dient dazu, das Fehlen der Verletzung im ersten Fall als bekannte Baseline (Engine-Verhalten) festzuhalten, bis dies repariert wird.

| Regel | Skopus | Engine meldet es? | Beleg |
|-------|--------|-------------------|-------|
| **PSMM-R1** (min 10) bei 0 Modellen | **parent** | **NEIN** (bekannte Grenze) | Test 01: Die Katalogdaten verlangen, dass `d96c-c95f-8224-7c87` feuert (actual 0, bound 10). Da die Engine das übergeht, schlägt der Test als "Expected length 1, received 0" fehl. |
| **PSMM-R1** (min 10) bei 5 Modellen | **parent** | **JA** | Test 02: Verletzung `d96c-c95f-8224-7c87` schlägt an, actual 5 / bound 10. |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard“ | `7d9d-6c8d-4ea0-b7ad` |
| „Halberdiers“ (Unit) | `569f-7be3-1aa2-004f` |
| „Halberdiers“ (Model, in Unit) | `744d-a00d-b16c-3713` — constraint `d96c-c95f-8224-7c87` (min 10) |
