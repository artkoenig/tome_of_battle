# Szenario: Numerische Constraint-Conditions (`equalTo`, `greaterThan`, `lessThan`)

Dieses Szenario verifiziert, dass Constraint-Modifier, die an Bedingungen vom Typ `equalTo`, `greaterThan` oder `lessThan` geknüpft sind, korrekt greifen und die Limits (`min` / `max`) anpassen, wenn das Kriterium erfüllt bzw. nicht erfüllt ist.

## Abgeleitete Regeln

| Regel | Katalog / Element | Evidenz (XML) |
| --- | --- | --- |
| **equalTo**: Wenn ein Element in bestimmter Anzahl exakt vorhanden ist, greift der Modifier. | `Orcs and Goblins` / `Magic Armour (Orc)` (Upgrade-Gruppe) | `<modifier type="increment" field="4928-8a21-ef4a-3007" value="1">` mit `<condition type="equalTo" value="1" field="selections" scope="parent" childId="c5c1-60aa-745f-c9d3".../>`. Max-Limit steigt von 1 auf 2, wenn exakt 1 Enchanted Shield gewählt ist. |
| **greaterThan**: Wenn ein Element streng häufiger als der angegebene Wert vorhanden ist, greift der Modifier. | `Ogre Kingdoms` / `Slaughtermaster` (Einheit) | `<modifier type="set" field="c70d-c292-36ee-21b5" value="-1">` mit `<condition type="greaterThan" value="0" field="selections" scope="force" childId="2679-58f4-1771-662d".../>`. Max-Limit ändert sich von 0 auf -1 (unbegrenzt), wenn mindestens 1 Tyrant im Roster ist. |
| **lessThan**: Wenn ein Element streng seltener als der angegebene Wert vorhanden ist, greift der Modifier. | `Vampire Counts` / `Seduction, Domination, Transfix and Beguile.` (Upgrade) | `<modifier type="set" value="0" field="10a1-ac7b-4b9c-0e12">` mit `<condition type="lessThan" value="1" field="selections" scope="force" childId="4f07-e982-6665-70b7".../>`. Min-Limit sinkt von 1 auf 0, wenn Clan Lahmia Bloodline *nicht* gewählt ist (Anzahl < 1). |

## Test-Katalog

Wir definieren sechs Roster, die das Erfüllen sowie Verfehlen der drei Conditions provozieren.

- **`rosters/equal-to-true.ros`**: Wählt Enchanted Shield (`c5c1-60aa-745f-c9d3`, genau 1) und Armour of Gork (zusammen 2 Magische Rüstungen). Das `equalTo 1` Kriterium ist erfüllt, das Limit steigt auf 2. 2 gewählte Rüstungen verletzen das Limit nicht.
- **`rosters/equal-to-false.ros`**: Wählt Armour of Gork und Armour of Mork (ohne Enchanted Shield). Das `equalTo 1` Kriterium ist nicht erfüllt, das Limit bleibt bei 1. Die 2 gewählten Rüstungen werfen einen Validation-Error (`actual: 2`, `bound: 1`).
- **`rosters/greater-than-true.ros`**: Ein Slaughtermaster und ein Tyrant. Das `greaterThan 0` Kriterium für den Tyrant ist erfüllt. Das Limit des Slaughtermaster wird auf -1 (unendlich) gesetzt, weshalb kein Limit anschlägt.
- **`rosters/greater-than-false.ros`**: Ein Slaughtermaster, ohne Tyrant. Das `greaterThan 0` Kriterium ist nicht erfüllt. Das Limit des Slaughtermaster bleibt auf der Basis 0. Der Test schlägt an (`actual: 1`, `bound: 0`).
- **`rosters/less-than-true.ros`**: Eine Vampirkraft "Seduction..." mit Anzahl 0 (nicht gewählt), und keine Clan Lahmia Bloodline gewählt. Das Kriterium `lessThan 1` Clan Lahmia Bloodline ist erfüllt (es sind 0). Das Min-Limit fällt auf 0. Keine Fehlermeldung.
- **`rosters/less-than-false.ros`**: Eine Vampirkraft "Seduction..." mit Anzahl 0 (nicht gewählt), aber Clan Lahmia Bloodline ist gewählt. Das Kriterium `lessThan 1` ist nicht erfüllt (es ist 1). Das Min-Limit bleibt auf 1. Der Test schlägt an, weil die Kraft fehlt (`actual: 0`, `bound: 1`).

## Verifizierte Bausteine

| ID | Typ | Beschreibung |
| --- | --- | --- |
| `4928-8a21-ef4a-3007` | Constraint (max) | Max-Limit in *Orcs and Goblins* auf die Kategorie *Magic Armour (Orc)* |
| `c70d-c292-36ee-21b5` | Constraint (max) | Max-Limit in *Ogre Kingdoms* auf die Auswahl *Slaughtermaster* |
| `10a1-ac7b-4b9c-0e12` | Constraint (min) | Min-Limit in *Vampire Counts* auf die Auswahl *Seduction, Domination, Transfix and Beguile.* |
