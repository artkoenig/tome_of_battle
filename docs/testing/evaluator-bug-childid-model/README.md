# E2E-Regeln & Testkatalog: Evaluator Bug `childId="model"`

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der Roster ist an einer **echten Beispiel-Datei** verifiziert.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and Goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **BUG-R1** | Unter den „Border Patrols"-Regeln muss eine Armee **mindestens eine Infanterie-Einheit von 10+ Modellen** („BP Infantry 10+") enthalten. Geschieht dies nicht, feuert ein Constraint, der versucht einen nicht unterstützten Modifikator `type="add" field="error"` anzuwenden. | `.gst` → Upgrade „Border Patrols rules" (`4e15-0353-165f-5528`) → Modifier `add error` mit Condition `lessThan 1 childId="6ad6-f54e-1867-00a7"` (BP Infantry 10+). |
| **BUG-R2** | Einheiten wie die „Stone Trolls" erhalten die Kategorie „BP Infantry 10+" über einen Modifikator, der eine Untergrenze für Selektionen vom Typ `model` überprüft (min 10). | Orcs & Goblins `.cat` → Einheit „Stone Trolls" (`4112-026b-500a-b6fd`) → Modifier `add category 6ad6-f54e-1867-00a7` mit Condition `atLeast 10 childId="model" scope="self"`. |

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren `.gst` + Orcs & Goblins-`.cat`.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | `childId="model"` Bug | `.gst` + O&G `.cat` | Armee mit „Border Patrols rules" (`4e15…`) und einer Einheit „Stone Trolls" (`4112…`), die genau 10 Modelle „Trolls" (`f559…`) enthält. | Die Evaluierung der Condition `childId="model"` ist korrekt, die Einheit erhält die Kategorie, die Fehlerregel feuert **nicht**, und der `UNSUPPORTED_MODIFIER` (Diagnostic) tritt **nicht** auf. (Wenn der Bug aktiv ist, wird dieser Test fehlschlagen, da der Diagnosetyp gemeldet wird.) | [`01-stone-trolls.ros`](rosters/01-stone-trolls.ros) |

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Beim Anschluss dieses Szenarios an den Runner (`evaluate`: Roster rein → Bericht raus) wird jede abgeleitete Erwartung gegen den tatsächlichen Bericht abgeglichen. Da der Bug bewirkt, dass Engine-Query-Indizes BS-Dateneinträge wie `model` nicht auflösen können, schlägt die Condition `atLeast 10 childId="model"` immer fehl (Ist=0).
Die Kategorie „BP Infantry 10+" wird der Einheit folglich *nicht* zugewiesen, woraufhin der „Border Patrols rules"-Modifikator (der nach eben jener Kategorie sucht) unweigerlich feuert und einen `UNSUPPORTED_MODIFIER` wirft.
Indem die Assertion im Manifest `UNSUPPORTED_MODIFIER` explizit **auschließt** (`absent`), wird sichergestellt, dass der Runner diesen Fix als fehlend reklamiert.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| „Border Patrols rules" (GST-Upgrade) | `4e15-0353-165f-5528` |
| Einheit „Stone Trolls" | `4112-026b-500a-b6fd` |
| Modell „Trolls" (innerhalb Stone Trolls) | `f559-032b-c545-f727` |
| Kategorie „BP Infantry 10+" | `6ad6-f54e-1867-00a7` |
