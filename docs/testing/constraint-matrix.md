# Evaluator Constraint & Condition Matrix

Diese Matrix ordnet die im Projekt definierten XSD-Elemente (`constraint`, `condition`, `repeat`) den bestehenden E2E-Tests zu. Sie dient dem `evaluator-constraint-explorer` als Landkarte, um blinde Flecken bei der Testabdeckung aufzudecken.

> **Maschinenlesbar sind seit Issue 0146 `covered-cells.json` (Handeintrag) und `worklist.json` (erzeugt aus `scripts/evaluator-coverage-inventory.js`) in diesem Verzeichnis** — sie allein steuern die Abdeckungsschleife.
> Diese Matrix ist ausschliesslich menschlicher Kontext: kein Werkzeug und kein Agent liest sie innerhalb der Schleife, und ihre Zeilen sind pro Attribut geschrieben, nicht pro Zelle.

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
| **scope** | `primary-catalogue` | *An einem `constraint` **kein** Vorkommen: alle 27 Vorkommen stehen an einer `condition` (Issue 077) — siehe §2* | - |
| **scope** | (Spezifische ID) | `category-scope-ancestor-frame` (Kategorie-Id = Vorfahren-Rahmen, nicht armeeweit); Modultest `query.categoryScope` | ✅ |
| **field** | `selections` (Standard) | Fast alle Tests | ✅ |
| **field** | `forces` | *Wird in Daten nicht verwendet (laut Suche)* | - |
| **field** | `pts` (Punkte / Kosten) | `explorer-nested-constraints` | ✅ |
| **percentValue** | `true` | *Wird in Daten nicht verwendet (laut Suche)* | - |
| **shared** | `false` | Alle 8 Fundstellen stehen an `scope="parent"`, wo `parent` **vor** `shared` geht (ADR 0003 §4) — auf den realen Daten also ohne Wirkung. Die Kombination selbst deckt der Modultest `query.matrix` in allen acht Flag-Zellen ab | - |
| **includeChildSelections** | `true` / `false` | Beide Werte kommen in fast jedem Szenario vor (z. B. `explorer-nested-constraints`, `orcs-and-goblins-budget`); die acht Flag-Kombinationen deckt der Modultest `query.matrix` als ausführbare Spezifikation ab | ✅ |
| **includeChildForces** | `true` / `false` | **Kein realer Fall:** kein `forceEntry` aller sechs Fixture-Kataloge trägt Unter-Kontingente (0 von 24) — Verbündete sind Geschwister an der Roster-Wurzel. Synthetisch abgedeckt in `query.matrix` | - |

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
| **scope** | `primary-catalogue` (das Armeebuch des umschließenden Kontingents, Issue 077) | `primary-catalogue-scope` (10 Roster, beide Lagen je Armeebuch); Modultests `query.primaryCatalogueScope`, `evaluator.primaryCatalogueFixture` | ✅ |
| **type** | `greaterThanOrEqualTo` | *Kein XSD-Wert; 1 Vorkommen (O&G ergofang) wird als `unsupportedCondition` gemeldet und feuert fail-closed nicht* | - |
| **conditionGroup type** | `not` | `condition-group-not` (Lichemaster-Pflichteinheiten); Modultest `groups` | ✅ |
| *(Conditions erben Scope, Field, etc. von QueryBase)* | - | - | - |

## 3. Repeats (Modifier Multiplikatoren)

| Attribut / Typ | Wert / Spezifikation | Bisher getestet in (Scenario) | Status |
| :--- | :--- | :--- | :--- |
| **repeats** | Positiver Integer (z.B. > 1) | `mercenaries-repeat-bug` | ✅ |
| **roundUp** | `true` / `false` | *In den Daten kommt ausschliesslich `roundUp="false"` vor — kein realer Fall zu testen* | - |
| *mehrere `<repeat>` in **einer** Liste* | Anwendungen addieren sich (nicht multiplizieren) | `modifier-group-repeats` („Grave markers"); Modultest `groups` | ✅ |
| *`<repeats>` an einer `modifierGroup`* | Faktor der Klammer × eigener Faktor des Mitglieds | `modifier-group-repeats`; Modultest `groups` | ✅ |
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
| `condition` mit `type="equalTo"` auf Punktebudget (`field="limit::..."`) | Der Schalter „Border Patrols rules" (`4e15-0353-165f-5528`, basis-versteckt) wird per `set hidden="false"` sichtbar, wenn das Punktelimit **genau** 500 ist (`.gst:17597`). | Nachgemessen an echten Daten: 499 → versteckt, 500 → sichtbar, 501 und 2000 → versteckt. Ein eigenes E2E-Szenario fehlt noch. | ⚠️ |
| `condition` mit `type="notInstanceOf"` + `scope="primary-catalogue"` | Modifikator greift, wenn das Armeebuch des Kontingents ein anderes ist (sehr häufig in Mercenaries). Die Engine wertet den Rahmen seit Issue 077 aus — er ist keine `unresolvedScope`-Lücke mehr. | `primary-catalogue-scope` (Roster 02/03/07/09 sind die `notInstanceOf`-Seite); Modultest `query.primaryCatalogueScope` | ✅ |
| `constraint` mit `shared="false"` + `scope="parent"` | Individuelles Limit für spezifische Eltern-Auswahlen (O&G / Vampire Counts). | Alle 8 Fundstellen tragen `scope="parent"`, und `parent` geht **vor** `shared` (ADR 0003 §4) — `shared="false"` ist dort ohne Wirkung, es gibt nichts zu unterscheiden. Modultest `query.matrix` deckt die Kombination synthetisch ab. | - |
| `condition` mit `type="atLeast"` + `includeChildForces="true"` | Bedingung zählt Einheiten über verbündete Kontingente hinweg (oft in Border Patrols). | **Kein realer Fall:** kein `forceEntry` aller sechs Fixture-Kataloge enthält ein Unter-Kontingent (0 von 24), Verbündete stehen als **Geschwister**-Kontingente an der Roster-Wurzel. Das Flag ist damit auf diesen Daten ohne beobachtbare Wirkung; die Zählsemantik deckt der Modultest `query.matrix` synthetisch ab. | - |
| Mehrere `modifier` (gemischt `set` + `increment`/`decrement`) auf **dasselbe** Ziel-Feld, je eigenständig konditioniert | Stapel-Semantik; Kosten-Id `ecfa-8486-4f6c-c249` trägt in Vampire Counts 47 gestapelte Modifikatoren. | Die Reihenfolge **ist** definiert und geprüft: strikt Dokumentreihenfolge, Modultest `modifiers` („increment dann multiply: (5+10)×2 = 30" gegen „multiply dann increment: 5×2+10 = 20") | ✅ |
| Eine `categoryEntry` trägt gleichzeitig 3 Constraints unterschiedlichen Scopes/`includeChildForces` | Kategorie „General" (`a37e-7207-de6d-acb0`): `max scope=force icf=T` (`d818-c60d…`) + `min scope=force icf=T` (`1077-7379…`) + `max scope=parent icf=F` (`54c9-b217…`) parallel aktiv. | Nachgemessen an echten Daten: zwei Generäle in **einem** Kontingent lassen `d818-c60d-b1f8-8aaa` mit Ist 2 / Grenze 1 feuern; `54c9-b217-e67c-bd60` (`scope="parent"`, `includeChildSelections="false"`) bleibt still, weil die General-Aufwertungen unter den Einheiten hängen und nicht direkt unter dem Kontingent — „just scope's field" (§7.6). Ein eigenes E2E-Szenario fehlt noch. | ⚠️ |
| `constraint` direkt am `forceEntry` (`type="min"`, `field="limit::<costTypeId>"`, `scope="roster"`), angehoben durch `modifier`, konditioniert auf `instanceOf` der **eigenen** Force-Id | Vampire Counts: `8f3f-ffa8-387b-0bf9` / `f3aa-b530-9b6c-0995`, Basiswert 0, `set value=2000` bei `condition instanceOf childId=<eigene forceEntry-Id> scope=force` — selbstreferenzielle Punkte-Untergrenze. | Nachgemessen an echten Daten (Budget 1500 → Ist 1500 / Grenze 2000, `measure=budgetLimit`; 2000 und 3000 → still). Modultest `query.limitValue`. Ein eigenes E2E-Szenario fehlt noch. | ⚠️ |
| `entryLink type="selectionEntryGroup"` trägt gleichzeitig eigene `<constraints>` (Kosten-Deckel) und `<modifiers>` (konditional) | 143 Vorkommen (Orcs, Vampire, Ogre, Mercenaries); z. B. entryLink `a645-84e1-9352-9c9d` „Magic Standards" am Grave-Guard-Standartenträger: `max=50 field=<pts> scope=parent`. | Nachgemessen an echten Daten: Hell Banner (65 pts) → `0c6b-000c-8680-adb0` feuert mit Ist 65 / Grenze 50; Banner of the Dead Legion (25 pts) → still. Ein eigenes E2E-Szenario fehlt noch. | ⚠️ |
| `conditionGroup type="or"` mit 5–8 verschachtelten Conditions (grosser Fan-out) | 19× `or`/6 Conditions (Orcs), 16× `or`/5 (Orcs, Vampire), 9× `or`/8 (Vampire) — deutlich über die bisher getesteten kleinen 2-Condition-Gruppen hinaus. | Kein größenabhängiger Codepfad: `conditionGroupHolds` verknüpft die Mitglieder als Liste (`every`/`some`/Negation), unabhängig von ihrer Zahl — ein 8er-`or` durchläuft dieselbe eine Stelle wie ein 2er. Der Fan-out ist damit keine eigene Zelle der Matrix | - |
| `condition type="atLeast" scope="self" childId="model"` — selbstreferenzielles Mindest-Modellzahl-Gate | 32 Vorkommen (Ogre, Orcs, Vampire); z. B. „Gnoblars" (`1e26-0d1a-bb3c-f47a`) bekommen die Tag-Kategorie „BP Infantry 10+" (`6ad6-f54e-1867-00a7`) ab 10 eigenen Modellen **und** gesetztem Border-Patrols-Schalter. | Nachgemessen an echten Daten: 9 Modelle → keine Kategorie, 10 und 12 → Kategorie, 12 ohne Schalter → keine. Ein eigenes E2E-Szenario fehlt noch. | ⚠️ |
| `notInstanceOf` + `scope="primary-catalogue"` **verschachtelt in einer `conditionGroup`** (statt als direkte Condition) | 4 Vorkommen (Mercenaries, Warhammer) — eigener Codepfad gegenüber der bereits oben notierten direkten Verwendung. Der Bezugsrahmen selbst ist seit Issue 077 auflösbar; offen ist allein die Gruppen-Verschachtelung. | *Vorkommen gefunden* | ❌ |
| `repeat scope="roster"` auf eine konkrete Verbündeten-`childId` mit `includeChildForces="true"` | Zählt eine benannte Ally-Einheit kontingentübergreifend als Repeat-Multiplikator; 7 Vorkommen (Ogre, Orcs). | Der `includeChildForces`-Teil hat auf diesen Daten keine Wirkung (kein `forceEntry` trägt Unter-Kontingente, siehe oben); der roster-skopierte Repeat selbst ist in `mercenaries-repeat-bug` und `modifier-group-repeats` abgedeckt | - |

---
*Diese Matrix wurde initial aus der `Catalogue.xsd` und den Scenarios im `docs/testing/` Ordner abgeleitet. Sie dient künftig als Ausgangspunkt für thesengetriebenes Test-Design.*
