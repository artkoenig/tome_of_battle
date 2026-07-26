# Szenario: mercenaries-repeat-bug

**Thesis**: The new engine's `catalogReader.js` fails to parse `<repeat>` elements inside modifiers because it looks for a non-existent `perValue` attribute, ignoring the correct `value` and `repeats` attributes. This causes `readRepeat` to always fail with `DiagnosticKind.UNSUPPORTED_REPEAT`, meaning the modifier is never applied.

Dieses Szenario nutzt den Datensatz **WHFB 6th Definitive Edition**, insbesondere den Katalog `Mercenaries (6th definitive edition).cat`, um den Fehler im Umgang mit `<repeat>`-Elementen zu beweisen.

## Regeln (In-World)
Die Einheit "Toxote's Hellmounts" enthält die Modelle "Kylists (Chaos Centaur Champions)" und "Bucks (Chaos Centaur Troopers)".
Die "Kylists" haben eine Obergrenze von 1 (max=1). Diese Obergrenze wird jedoch durch einen Modifier erhöht, der ein `<repeat>`-Element enthält: Für jeweils 2 Modelle vom Typ "Bucks" erhöht sich das Limit um 1.
Mit 4 "Bucks" ergibt sich also ein max-Limit von `1 + (4/2) = 3` für die "Kylists".

## Evidence (Katalog-Daten)
Aus `Mercenaries (6th definitive edition).cat`:
```xml
<selectionEntry type="model" import="true" name="Kylists (Chaos Centaur Champions)" hidden="false" id="07b6-6c42-d4d5-16e8" sortIndex="2">
  <constraints>
    <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="608d-6b9e-583a-0246" includeChildSelections="false"/>
    <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="7200-e796-ecd2-cdaa" includeChildSelections="false"/>
  </constraints>
  <modifiers>
    <modifier type="increment" value="1" field="7200-e796-ecd2-cdaa">
      <repeats>
        <repeat value="2" repeats="1" field="selections" scope="parent" childId="5350-812c-57c9-ef45" shared="true" roundUp="false"/>
      </repeats>
    </modifier>
  </modifiers>
</selectionEntry>
```
Das `childId` `5350-812c-57c9-ef45` referenziert den Eintrag "Bucks (Chaos Centaur Troopers)".

## Verifizierte Bausteine

| Fixture | Beschreibung | expect.absent | expect.diagnostics |
|---------|--------------|---------------|--------------------|
| `01-repeat.ros` | Toxote's Hellmounts mit 4 Bucks und 3 Kylists. Das Limit der Kylists (max=1) sollte durch den Repeat (2x Buck) um +2 auf 3 steigen. | `7200-e796-ecd2-cdaa` (sollte **nicht** feuern) | absent: `UNSUPPORTED_REPEAT` (die Engine sollte keine Diagnose werfen) |

Da die Engine aktuell den Repeat aufgrund des fehlenden `perValue`-Attributs nicht parst, wirft sie eine Diagnose `UNSUPPORTED_REPEAT` und belässt das Limit bei 1. Entsprechend feuert das Limit `7200-e796-ecd2-cdaa`, weil 3 Kylists ausgewählt sind. Unser Test fordert jedoch das korrekte Verhalten (`absent`), weshalb er in der fehlerhaften Engine (gewollt) fehlschlagen wird.
