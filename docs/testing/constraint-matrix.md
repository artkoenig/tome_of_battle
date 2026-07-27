# Evaluator Constraint & Condition Matrix

Diese Matrix ordnet die im Projekt definierten XSD-Elemente (`constraint`, `condition`, `repeat`) den bestehenden E2E-Tests zu. Sie dient dem `evaluator-constraint-explorer` als Landkarte, um blinde Flecken bei der Testabdeckung aufzudecken.

## 1. Constraints (type: min / max)

| Attribut / Typ | Wert / Spezifikation | Bisher getestet in (Scenario) | Status |
| :--- | :--- | :--- | :--- |
| **type** | `max` | `explorer-category-constraints`, `explorer-force-constraints`, `explorer-nested-constraints` | ✅ |
| **type** | `min` | `group-scope-missing-mandatory`, `parent-scope-missing-mandatory`, `evaluator-force-child-category-missing` | ✅ |
| **type** | `max="-1"` (unlimited) | `max-unlimited-violation` | ✅ |
| **scope** | `roster` | `army-standard-bearer` | ✅ |
| **scope** | `force` | `explorer-force-constraints`, `explorer-modifier-constraints`, `vampire-bloodlines` | ✅ |
| **scope** | `category` | `category-scope-bug`, `explorer-category-constraints` | ✅ |
| **scope** | `parent` | `parent-scope-missing-mandatory`, `explorer-nested-constraints`, `army-standard-bearer` | ✅ |
| **scope** | `primary-catalogue` | *An einem `constraint` in den Daten **nicht** verwendet: alle 27 Vorkommen des Rahmens sind `condition`s (siehe §2 und [`battlescribe-data-format.md` §7.7](../battlescribe-data-format.md#primary-catalogue--der-armee-katalog-des-kontingents))* | - |
| **scope** | (Spezifische ID) | *Bisher kein expliziter E2E-Test gefunden* | ❌ |
| **field** | `selections` (Standard) | Fast alle Tests | ✅ |
| **field** | `forces` | *Wird in Daten nicht verwendet (laut Suche)* | - |
| **field** | `pts` (Punkte / Kosten) | `explorer-nested-constraints` | ✅ |
| **percentValue** | `true` | *Wird in Daten nicht verwendet (laut Suche)* | - |
| **shared** | `false` | *Vorkommen gefunden (O&G, VC), ungetestet* | ❌ |
| **includeChildSelections** | `true` / `false` | *Vorkommen gefunden, ungetestet* | ❌ |
| **includeChildForces** | `true` / `false` | *Vorkommen gefunden, ungetestet* | ❌ |

## 2. Conditions (Modifier / ConditionGroups)

| Attribut / Typ | Wert / Spezifikation | Bisher getestet in (Scenario) | Status |
| :--- | :--- | :--- | :--- |
| **type** | `instanceOf` | `explorer-modifier-constraints` | ✅ |
| **type** | `lessThan` | `numeric-conditions` | ✅ |
| **type** | `greaterThan` | `numeric-conditions` | ✅ |
| **type** | `equalTo` | `numeric-conditions` | ✅ |
| **type** | `notEqualTo` | `remaining-condition-types` | ✅ |
| **type** | `atLeast` | `remaining-condition-types` | ✅ |
| **type** | `atMost` | `remaining-condition-types` | ✅ |
| **type** | `notInstanceOf` | `remaining-condition-types` | ✅ |
| **childId** | `model` / Spezifische ID | `evaluator-bug-childid-model` | ✅ |
| **scope** | `primary-catalogue` (Armee-Katalog des Kontingents; **kein** Zählrahmen — alle 27 Vorkommen sind `condition`s) | `primary-catalogue-scope` | ✅ |
| *(Conditions erben Scope, Field, etc. von QueryBase)* | - | - | - |

## 3. Repeats (Modifier Multiplikatoren)

| Attribut / Typ | Wert / Spezifikation | Bisher getestet in (Scenario) | Status |
| :--- | :--- | :--- | :--- |
| **repeats** | Positiver Integer (z.B. > 1) | `mercenaries-repeat-bug` | ✅ |
| **roundUp** | `true` / `false` | *Bisher kein expliziter E2E-Test gefunden* | ❌ |
| *(Repeats erben childId, Scope, Field)* | - | - | - |

## 4. Orthogonale Kombinationen (Fokus-Bereiche)

Hier werden interessante, komplexe Interaktionen zwischen Attributen festgehalten, die oft Fehlerquellen sind.

| Kombination | Beispiel / Beschreibung | Bisher getestet in (Scenario) | Status |
| :--- | :--- | :--- | :--- |
| `max` auf `pts` + `scope="parent"` | Punkte-Limit für magische Gegenstände auf einem Charaktermodell. | `explorer-nested-constraints` | ✅ |
| Modifier mit `condition` auf `force` | Ändert das Limit basierend auf dem Kontingent-Typ (z.B. spezielle Armeelisten). | `explorer-modifier-constraints` | ✅ |
| `min` auf `SelectionEntryGroup` | Pflichtauswahl-Logik in Gruppen. | `group-scope-missing-mandatory` | ✅ |
| `max` auf `categoryLink` in `forceEntry` | Armeeweite Limitierung einer bestimmten Kategorie. | `explorer-category-constraints` | ✅ |
| Verschachtelter `modifier` mit `<repeat>` | Erhöht ein Limit in Stufen pro X gekauften Modellen einer anderen Auswahl. | `mercenaries-repeat-bug` | ✅ |
| `condition` mit `type="equalTo"` auf Punktebudget (`field="limit::..."`) | Modifikator greift ein, wenn ein Limit genau getroffen wird (z.B. Army Budget). | *Vorkommen gefunden* | ❌ |
| `condition` mit `type="notInstanceOf"` + `scope="primary-catalogue"` | Modifikator greift, wenn der Armee-Katalog des Kontingents **nicht** der genannte ist — Mercenaries Z. 4129 („Extra Rare choice" nur außerhalb einer Ogre-Kingdoms-Armee). Gegenstück `instanceOf` ebenda Z. 4102/4271. | `primary-catalogue-scope` (Kontrast-Paar Ogre / Orcs and Goblins) | ✅ |
| `constraint` mit `shared="false"` + `scope="parent"` | Individuelles Limit für spezifische Eltern-Auswahlen (O&G / Vampire Counts). | *Vorkommen gefunden* | ❌ |
| `condition` mit `type="atLeast"` + `includeChildForces="true"` | Bedingung zählt Einheiten über verbündete Kontingente hinweg (oft in Border Patrols). | *Vorkommen gefunden* | ❌ |
| Mehrere `modifier` (gemischt `set` + `increment`/`decrement`) auf **dasselbe** Ziel-Feld, je eigenständig konditioniert | Stapel-Semantik ohne definierte Anwendungsreihenfolge; Kosten-Id `ecfa-8486-4f6c-c249` trägt in Vampire Counts 47 gestapelte Modifikatoren. | *Vorkommen gefunden (VC, Mercenaries, Orcs)* | ❌ |
| Eine `categoryEntry` trägt gleichzeitig 3 Constraints unterschiedlichen Scopes/`includeChildForces` | Kategorie „General" (`a37e-7207-de6d-acb0`): `max scope=force icf=T` (`d818-c60d…`) + `min scope=force icf=T` (`1077-7379…`) + `max scope=parent icf=F` (`54c9-b217…`) parallel aktiv. | Nur der `min`-Constraint ist getestet (`ogre-kingdoms`, `orcs-and-goblins`, `vampire-counts`) | ❌ (die beiden `max`-Geschwister) |
| `constraint` direkt am `forceEntry` (`type="min"`, `field="limit::<costTypeId>"`, `scope="roster"`), angehoben durch `modifier`, konditioniert auf `instanceOf` der **eigenen** Force-Id | Vampire Counts: `8f3f-ffa8-387b-0bf9` / `f3aa-b530-9b6c-0995`, Basiswert 0, `set value=2000` bei `condition instanceOf childId=<eigene forceEntry-Id> scope=force` — selbstreferenzielle Punkte-Untergrenze. | *Vorkommen gefunden (VC)* | ❌ |
| `entryLink type="selectionEntryGroup"` trägt gleichzeitig eigene `<constraints>` (Kosten-Deckel) und `<modifiers>` (konditional) | 6 Vorkommen (Orcs, Vampire); z. B. entryLink `0111-4b1e-83eb-0dff` „Magical Standard": `max=50 field=costId scope=parent` + konditionales `set field=hidden`. | *Vorkommen gefunden* | ❌ |
| `conditionGroup type="or"` mit 5–8 verschachtelten Conditions (grosser Fan-out) | 19× `or`/6 Conditions (Orcs), 16× `or`/5 (Orcs, Vampire), 9× `or`/8 (Vampire) — deutlich über die bisher getesteten kleinen 2-Condition-Gruppen hinaus. | Nur kleine and/or-Gruppen getestet (`orcs-and-goblins-budget`) | ❌ |
| `condition type="atLeast" scope="self" childId="model"` — selbstreferenzielles Mindest-Modellzahl-Gate | 32 Vorkommen (Ogre, Orcs, Vampire). | *Vorkommen gefunden* | ❌ |
| `notInstanceOf` + `scope="primary-catalogue"` **verschachtelt in einer `conditionGroup`** (statt als direkte Condition) | 4 der 9 `notInstanceOf`-Vorkommen (Mercenaries Z. 48/4797/6743, `.gst` Z. 773). Der Rahmen selbst ist seit `primary-catalogue-scope` abgedeckt — offen ist allein diese Verschachtelung; das `instanceOf`-Gegenstück in einer `conditionGroup` (Mercenaries Z. 4102) ist dort bereits mitgeprüft. | *Vorkommen gefunden* | ❌ |
| `repeat scope="roster"` auf eine konkrete Verbündeten-`childId` mit `includeChildForces="true"` | Zählt eine benannte Ally-Einheit kontingentübergreifend als Repeat-Multiplikator; 7 Vorkommen (Ogre, Orcs). | Nur `repeat scope="parent" childId="model"` getestet | ❌ |

---
*Diese Matrix wurde initial aus der `Catalogue.xsd` und den Scenarios im `docs/testing/` Ordner abgeleitet. Sie dient künftig als Ausgangspunkt für thesengetriebenes Test-Design.*
