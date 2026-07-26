# Szenario: Remaining Condition Types

Dieses Szenario verifiziert die Verarbeitung von Modifikatoren, die auf Bedingungen vom Typ `atLeast` reagieren. Solche Bedingungen sind essenziell, um komplexe Interaktionen zwischen Auswahlen abzubilden (z.B. gegenseitige Ausschlüsse oder Freischaltungen).

Das getestete Beispiel entstammt dem Armeebuch der Vampire (6. Edition) und zeigt, wie *Spear Infantry* und *Halberds* bei *Skeletons* sich gegenseitig ausschließen.

## Abgeleitete Regeln

| Regel | Evidenz im Katalog (`Vampire Counts (6th definitive edition).cat`) |
| --- | --- |
| *Spear Infantry* hat ein Grundlimit von maximal 1 Auswahl. | `entryLink` (id: `29e7-8795-b6e9-d7a2`) -> `constraint` (id: `a54e-dfd7-e8d0-12a0`, `type="max"`, `value="1"`) |
| Wird mindestens 1 *Halberds* ausgewählt, sinkt das Limit von *Spear Infantry* auf 0. | `modifier` (id: n/a, `type="set"`, `field="a54e-dfd7-e8d0-12a0"`, `value="0"`) -> `condition` (`type="atLeast"`, `value="1"`, `childId="b3f3-a133-2869-0be8"`) |
| *Halberds* hat ein Grundlimit von maximal 1 Auswahl. | `entryLink` (id: `d467-90c5-9aff-5988`) -> `constraint` (id: `8843-f59e-5761-bf09`, `type="max"`, `value="1"`) |
| Wird mindestens 1 *Spear Infantry* ausgewählt, sinkt das Limit von *Halberds* auf 0. | `modifier` (id: n/a, `type="set"`, `field="8843-f59e-5761-bf09"`, `value="0"`) -> `condition` (`type="atLeast"`, `value="1"`, `childId="104f-5817-4bda-9382"`) |

*Anmerkung:* Halberds ist regulär versteckt und wird nur für die *Army of Sylvania* aufgedeckt (über eine `instanceOf`-Bedingung). Um das Setup sauber abzubilden, verwenden beide Testroster den Force-Type *Army of Sylvania* (`4072-c3b8-84c4-a097`). Die Sichtbarkeitsregelung wird in diesem Szenario nicht evaluiert (sie führt nicht zu Limit-Fehlern).

## Testkatalog

- `01-spear-infantry-only.ros`: Ein legaler Aufbau. Es wird nur *Spear Infantry* ausgewählt. Das Limit bleibt bei 1, da die `atLeast`-Bedingung für *Halberds* nicht erfüllt ist.
- `02-spear-and-halberds-illegal.ros`: Ein illegaler Aufbau. Sowohl *Spear Infantry* als auch *Halberds* sind ausgewählt. Beide `atLeast`-Bedingungen greifen simultan, setzen das jeweilige Limit des anderen auf 0 und lösen entsprechende Regelverletzungen aus (`actual: 1`, `bound: 0`).

## Verifizierte Bausteine

| ID | Typ | Beschreibung |
| --- | --- | --- |
| `a54e-dfd7-e8d0-12a0` | `constraint` | Maximal 1 *Spear Infantry* |
| `8843-f59e-5761-bf09` | `constraint` | Maximal 1 *Halberds* |
