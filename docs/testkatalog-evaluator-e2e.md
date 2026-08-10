# Testkatalog — E2E-Tests der Reinraum-Engine (Evaluator)

Dieser Katalog beschreibt **jeden** End-to-End-Test der Reinraum-Engine
(`src/evaluator/`) in nicht-technischer Sprache, damit ein fachlicher Leser jeden
geprüften Fall nachvollziehen kann — ohne den Testcode zu lesen. Er deckt
**ausschließlich** die E2E-Tests der neuen Engine ab: keine Unit-/Komponenten-
tests und keine Tests der alten Solver-Engine.

## Eine Quelle der Wahrheit: der manifest-getriebene Runner

Die gesamte E2E-Absicherung des Evaluators läuft seit Issue 69 über **einen**
generalisierten, manifest-getriebenen Runner:
[`e2e.testcatalog.test.js`](../src/evaluator/e2e.testcatalog.test.js). Er entdeckt
zur Laufzeit **alle** Szenarien unter [`docs/testing/`](testing/), die ein Manifest
(`scenario.json`) tragen, wertet jedes darin deklarierte Roster gegen die
öffentliche Fassade `evaluate` aus und prüft den Bericht — die **Verletzungen**,
die **Diagnosen** und, je benanntem Auswahlpunkt, dessen **Fähigkeitsdatensatz**
(effektiver Anzeigename, Autor-Meldungen des Katalogs, effektive Merkmalswerte
sowie die dort geltenden Profile und Regeltexte) —
gegen die je Roster deklarierte Erwartung. Die einzelnen Testfälle entstehen **dynamisch** aus den Manifesten;
versioniert sind nur der Runner und die Szenario-Daten.

Ein **Szenario** ist ein Verzeichnis unter `docs/testing/<name>/` mit:

- einem oder mehreren **Rostern** (`rosters/*.ros`) — echten Battlescribe-Roster-
  Dateien als Engine-Eingabe;
- einer **`README.md`** — die aus den Katalogdaten abgeleiteten Regeln samt Beleg
  (Black-Box: nur aus den Katalogdaten, nicht aus dem Engine-Code);
- dem Manifest **`scenario.json`** — der maschinenlesbaren Quelle der Wahrheit:
  welche Katalogdateien geladen werden und welche Grenzen/Diagnosen je Roster
  feuern müssen (`firing`), nicht feuern dürfen (`absent`) bzw. als Diagnose
  auftreten oder ausbleiben müssen (`diagnostics`) — und welchen Zustand ein
  einzelner Auswahlpunkt tragen muss (`capabilities`).

Die frühere programmatische E2E-Suite (die Roster im Testcode aufbaute:
`e2e.ogreKingdoms/orcsAndGoblins/vampireCounts/realCatalog.smoke` und die
`e2e.*.ros`-Charakterisierung) ist vollständig in dieses Format überführt und
entfernt.

## Datengrundlage

Fast alle Szenarien werten Roster gegen die **echten** Definitive-Edition-
Katalogdaten aus (ADR-[0032](adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md)) —
`src/evaluator/__fixtures__/whfb6-definitive/`, genau die Dateien, die ein Nutzer
beim Import erlebt. Ausnahme ist `vampire-bloodlines-ergofang`, das den
eigenständigen ergofang-VC-Katalog (`src/__fixtures__/whfb6/`) nutzt. Jede
Armee-`.cat` wird zusammen mit ihrer gemeinsamen **Mercenaries**-Abhängigkeit
ausgewertet (Stern-Struktur); einige Roster prüfen bewusst den **unvollständigen**
Satz *ohne* Mercenaries — per Roster-`dataset`-Override im Manifest.

## Pflege-Regel (verbindlich, manuell)

> **Sobald ein neues Problem der Engine erkannt und behoben wird, werden dafür
> zwei Dinge zusammen angelegt: (1) ein Szenario unter `docs/testing/` (Roster +
> `README.md` + `scenario.json`), das das Problem an echten Daten absichert und
> vom Runner ausgewertet wird, **und** (2) ein zugehöriger Eintrag in diesem
> Katalog.**

Das Szenario wird **Black-Box** autoriert — allein aus den Katalogdaten, ohne
Blick in den Evaluator-Quellcode — durch den dedizierten Subagenten
`e2e-testcase-author` (siehe [`docs/agents/e2e-testcase-author.md`](agents/e2e-testcase-author.md)
und [ADR 0033](adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
So prüft der Test die Engine, statt ihr Verhalten zu spiegeln. Es entsteht dabei
**kein** handgeschriebener `src/evaluator/e2e.*.test.js` mehr — nur Szenario-Daten.

Die Pflege erfolgt **von Hand** — es gibt bewusst **keinen** Generator und
**kein** CI-Gate, das den Katalog gegen die Szenarien erzwingt. Der Katalog muss
darum deckungsgleich zum Bestand unter `docs/testing/` gehalten werden: jedes
gelistete Szenario/Roster existiert dort, und jedes Szenario/Roster steht im
Katalog. Wer ein Szenario oder ein Roster hinzufügt, umbenennt oder löscht,
aktualisiert im selben Schritt diesen Katalog.

## Abgedeckte Szenarien

| Szenario | Datengrundlage | Roster-Fälle |
| :--- | :--- | :---: |
| [`vampire-bloodlines`](testing/vampire-bloodlines/) | Definitive VC + Mercenaries | 9 |
| [`vampire-bloodlines-ergofang`](testing/vampire-bloodlines-ergofang/) | ergofang VC (ohne Mercenaries) | 6 |
| [`army-standard-bearer`](testing/army-standard-bearer/) | Definitive O&G + Mercenaries | 7 |
| [`ogre-kingdoms`](testing/ogre-kingdoms/) | Definitive Ogre (+/- Mercenaries) | 11 |
| [`orcs-and-goblins`](testing/orcs-and-goblins/) | Definitive O&G (+/- Mercenaries) | 3 |
| [`orcs-and-goblins-budget`](testing/orcs-and-goblins-budget/) | Definitive O&G + Mercenaries | 6 |
| [`vampire-counts`](testing/vampire-counts/) | Definitive VC (+/- Mercenaries) | 3 |
| [`category-scope-bug`](testing/category-scope-bug/) | Definitive VC + Mercenaries | 1 |
| [`real-catalog-smoke`](testing/real-catalog-smoke/) | Definitive Ogre (+/- Mercenaries) | 2 |
| [`evaluator-bug-childid-model`](testing/evaluator-bug-childid-model/) | Definitive O&G | 1 |
| [`evaluator-force-child-category-missing`](testing/evaluator-force-child-category-missing/) | Definitive VC | 2 |
| [`group-scope-missing-mandatory`](testing/group-scope-missing-mandatory/) | synthetischer Empire-Katalog | 2 |
| [`parent-scope-missing-mandatory`](testing/parent-scope-missing-mandatory/) | synthetischer Empire-Katalog | 2 |
| [`max-unlimited-violation`](testing/max-unlimited-violation/) | Definitive O&G | 1 |
| [`mercenaries-repeat-bug`](testing/mercenaries-repeat-bug/) | Definitive Ogre + Mercenaries | 1 |
| [`explorer-force-constraints`](testing/explorer-force-constraints/) | Definitive Ogre + Mercenaries | 2 |
| [`explorer-category-constraints`](testing/explorer-category-constraints/) | Definitive O&G | 1 |
| [`explorer-modifier-constraints`](testing/explorer-modifier-constraints/) | Definitive O&G | 2 |
| [`explorer-nested-constraints`](testing/explorer-nested-constraints/) | Definitive O&G | 1 |
| [`numeric-conditions`](testing/numeric-conditions/) | Definitive O&G + Mercenaries | 6 |
| [`remaining-condition-types`](testing/remaining-condition-types/) | Definitive VC + Mercenaries | 2 |
| [`modifier-characteristic-value`](testing/modifier-characteristic-value/) | Definitive Ogre + Mercenaries | 3 |
| [`modifier-effective-name`](testing/modifier-effective-name/) | Definitive VC + O&G + Mercenaries | 6 |
| [`author-message-severity`](testing/author-message-severity/) | Definitive Ogre / VC + Mercenaries | 7 |
| [`offer-and-category-slots`](testing/offer-and-category-slots/) | Definitive VC + O&G + Mercenaries | 3 |
| [`info-projection`](testing/info-projection/) | Definitive VC + Mercenaries | 4 |
| [`violation-classification`](testing/violation-classification/) | Definitive Ogre / O&G / VC + Mercenaries | 7 |
| [`author-message-tokens`](testing/author-message-tokens/) | Definitive Ogre + Mercenaries | 3 |
| [`shared-target-two-entrylinks`](testing/shared-target-two-entrylinks/) | Definitive VC + Mercenaries | 4 |
| [`entrylink-raw-type-counting`](testing/entrylink-raw-type-counting/) | Definitive VC + Mercenaries | 3 |
| [`unlimited-modifier-toggle`](testing/unlimited-modifier-toggle/) | Definitive O&G / Mercenaries | 5 |
| [`primary-catalogue-scope`](testing/primary-catalogue-scope/) | Definitive Ogre + VC + O&G + Mercenaries | 10 |
| [`unit-scope-per-model-cost`](testing/unit-scope-per-model-cost/) | Definitive Ogre + Mercenaries | 2 |
| [`ancestor-scope-instance-of`](testing/ancestor-scope-instance-of/) | Definitive VC + Mercenaries | 2 |
| [`root-entrylink-mandatory-catalogue-scope`](testing/root-entrylink-mandatory-catalogue-scope/) | Definitive Ogre + VC + O&G + Mercenaries | 4 |
| [`roster-scope-mandatory-chariot`](testing/roster-scope-mandatory-chariot/) | Definitive O&G + Mercenaries | 7 |
| [`parent-min-unshared-unit-size`](testing/parent-min-unshared-unit-size/) | Definitive O&G + Mercenaries | 6 |
| [`condition-group-and-nested`](testing/condition-group-and-nested/) | Definitive O&G + Mercenaries | 5 |
| [`category-id-scope-instance-of`](testing/category-id-scope-instance-of/) | ergofang VC (ohne Mercenaries) | 5 |
| [`roster-repeat-added-category`](testing/roster-repeat-added-category/) | Definitive Ogre + Mercenaries | 7 |
| [`less-than-parent-parry-save`](testing/less-than-parent-parry-save/) | Definitive Ogre + Mercenaries | 5 |
| [`parent-costsum-magic-items-budget`](testing/parent-costsum-magic-items-budget/) | Definitive Ogre + Mercenaries | 5 |
| [`decrement-cost-bloodline-casting-dice`](testing/decrement-cost-bloodline-casting-dice/) | ergofang VC (ohne Mercenaries) | 8 |
| [`modifier-unresolved-target-inert`](testing/modifier-unresolved-target-inert/) | Definitive O&G + Mercenaries | 5 |
| [`force-instance-gated-rename`](testing/force-instance-gated-rename/) | Definitive VC + Mercenaries | 2 |
| [`set-hidden-force-gate`](testing/set-hidden-force-gate/) | Definitive VC + Mercenaries | 2 |
| [`set-constraint-value-force-gate`](testing/set-constraint-value-force-gate/) | Definitive VC + Mercenaries | 2 |
| [`dispel-scroll-repeat-group-max`](testing/dispel-scroll-repeat-group-max/) | Definitive VC + Mercenaries | 2 |
| [`at-least-force-toggle-gate`](testing/at-least-force-toggle-gate/) | Definitive Ogre + Mercenaries | 2 |
| [`at-least-roster-border-patrols-gate`](testing/at-least-roster-border-patrols-gate/) | Definitive VC + Mercenaries | 2 |
| [`condition-group-or-force-gate`](testing/condition-group-or-force-gate/) | Definitive VC + Mercenaries | 2 |
| [`condition-group-and-points-bracket`](testing/condition-group-and-points-bracket/) | Definitive VC + Mercenaries | 3 |
| [`parent-scope-per-model-cost`](testing/parent-scope-per-model-cost/) | Definitive Ogre + Mercenaries | 2 |
| [`remove-category-force-gate`](testing/remove-category-force-gate/) | Definitive VC + Mercenaries | 2 |
| [`group-max-increment-on-choice`](testing/group-max-increment-on-choice/) | Definitive VC + Mercenaries | 2 |
| [`set-characteristic-force-gate`](testing/set-characteristic-force-gate/) | Definitive VC + Mercenaries | 2 |
| [`less-than-force-min-drop`](testing/less-than-force-min-drop/) | Definitive VC + Mercenaries | 3 |
| [`at-least-unit-upgrade-gate`](testing/at-least-unit-upgrade-gate/) | Definitive VC + Mercenaries | 2 |
| [`set-primary-category-membership`](testing/set-primary-category-membership/) | Definitive Ogre + Mercenaries | 3 |
| [`unit-scope-instance-of-category`](testing/unit-scope-instance-of-category/) | Definitive VC + Mercenaries | 4 |
| [`less-than-roster-category-count`](testing/less-than-roster-category-count/) | Definitive O&G + Mercenaries | 5 |
| [`greater-than-parent-upgrade-gate`](testing/greater-than-parent-upgrade-gate/) | Definitive VC + Mercenaries | 2 |
| [`set-cost-value-force-gate`](testing/set-cost-value-force-gate/) | Definitive VC + Mercenaries | 4 |
| [`force-id-scope-instance-of`](testing/force-id-scope-instance-of/) | Definitive O&G + Mercenaries | 3 |
| [`at-least-self-model-count`](testing/at-least-self-model-count/) | Definitive VC + Mercenaries | 3 |
| [`at-least-roster-points-limit`](testing/at-least-roster-points-limit/) | Definitive O&G + Mercenaries | 3 |
| [`parent-max-include-child-selections`](testing/parent-max-include-child-selections/) | Definitive O&G + Mercenaries | 5 |
| [`parent-repeat-item-count`](testing/parent-repeat-item-count/) | Definitive Ogre + Mercenaries | 5 |
| [`unconditional-modifier-group`](testing/unconditional-modifier-group/) | Definitive VC + Mercenaries | 5 |
| [`parent-repeat-model-include-children`](testing/parent-repeat-model-include-children/) | Definitive O&G + Mercenaries | 5 |
| [`parent-repeat-item-include-children`](testing/parent-repeat-item-include-children/) | Definitive Ogre + Mercenaries | 6 |
| [`nested-modifier-group`](testing/nested-modifier-group/) | Definitive VC + Mercenaries | 4 |
| [`not-instance-of-force-gate`](testing/not-instance-of-force-gate/) | Definitive Ogre + Mercenaries | 5 |
| [`roster-repeat-category-count`](testing/roster-repeat-category-count/) | Definitive O&G + Mercenaries | 6 |
| [`modifier-group-repeats`](testing/modifier-group-repeats/) | Definitive VC + Mercenaries | 9 |
| [`condition-group-or-nested`](testing/condition-group-or-nested/) | Definitive O&G + Mercenaries | 6 |
| [`category-scope-ancestor-frame`](testing/category-scope-ancestor-frame/) | Definitive VC + Mercenaries | 4 |
| [`condition-group-not`](testing/condition-group-not/) | Definitive VC + Mercenaries | 6 |
| [`greater-than-force-unlimited-gate`](testing/greater-than-force-unlimited-gate/) | Definitive Ogre + Mercenaries | 4 |
| [`at-most-roster-points-limit`](testing/at-most-roster-points-limit/) | Definitive O&G + Mercenaries | 4 |
| [`at-least-parent-any-reveal`](testing/at-least-parent-any-reveal/) | Definitive VC + Mercenaries | 5 |
| [`less-than-unit-wizard-level-gate`](testing/less-than-unit-wizard-level-gate/) | Definitive VC + Mercenaries | 6 |
| [`not-instance-of-unit-category-gate`](testing/not-instance-of-unit-category-gate/) | Definitive VC + Mercenaries | 6 |
| [`add-info-and-warning-campaign-gate`](testing/add-info-and-warning-campaign-gate/) | Definitive O&G + Mercenaries | 3 |
| [`append-characteristic-zacharias-spell`](testing/append-characteristic-zacharias-spell/) | Definitive VC + Mercenaries | 2 |
| [`set-unresolved-target-inert-lord-slot`](testing/set-unresolved-target-inert-lord-slot/) | Definitive VC + Mercenaries | 5 |
| [`unit-model-repeat-shield-markup`](testing/unit-model-repeat-shield-markup/) | Definitive O&G + Mercenaries | 6 |
| [`equal-to-force-points-limit-border-patrol`](testing/equal-to-force-points-limit-border-patrol/) | Definitive O&G + Mercenaries | 4 |
| [`equal-to-force-toggle-count-gotrek`](testing/equal-to-force-toggle-count-gotrek/) | Definitive O&G + Mercenaries | 3 |
| **Summe** | | **358** |

Jedes Szenario führt in seiner eigenen `README.md` die abgeleiteten Regeln mit
Katalogbeleg und den vollständigen Roster-Katalog. Die folgende Übersicht fasst je
Szenario zusammen, was geprüft wird.

---

## `vampire-bloodlines` (Definitive Edition)

Bloodline-Regeln der Vampire Counts: die force-weite **Pflicht** min 1 Bloodline
(`4a0a-b107-e726-da32`) und die gruppen-weite **Clan-Obergrenze** max 1
(`39c7-f615-17db-7016`). Sichtbarkeit (`hidden`) und Profilwerte sind bewusst
**nicht** Teil des Verletzungsberichts.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Eine legale Clan-Bloodline (Blood Dragon) + Vampire Count | Keine Bloodline-Verletzung — Pflicht und Clan-Obergrenze erfüllt |
| 02 | Nur ein Vampire Count, keine Bloodline | Die Pflicht min 1 feuert (Ist 0) |
| 03 | Zwei Clan-Bloodlines in einer Selektion | Die Clan-Obergrenze max 1 feuert (Ist 2) |
| 04 | Strigoi verbirgt die Gruppe „Magic selection" | Verfügbarkeit (`hidden`) — keine Verletzung |
| 05 | Blood Dragon blendet die Thrall-Gruppe „Armour" ein | Verfügbarkeit — keine Verletzung |
| 06 | Lahmia + Thrall + Count (neutrale Grundlinie) | Keine Verletzung |
| 07–09 | Vampire Count mit Bloodline (Blood Dragon / Necrarch / Strigoi), Profilfokus | Profilwerte nicht im Bericht — keine Bloodline-Verletzung |

## `vampire-bloodlines-ergofang`

Die ergofang-Variante modelliert die Bloodline als **Pflicht-Gruppe je Charakter**
(min 1 / max 1, `56c1…`/`6d0c…`), nicht armeeweit. Eigenständiger VC-Katalog ohne
Mercenaries.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| e01 | Vampire Count mit genau einer Bloodline | Keine Verletzung — Pflicht je Charakter erfüllt |
| e02 | Vampire Count ohne Bloodline | Die Pflicht min 1 je Charakter feuert (Ist 0) |
| e03 | Zwei Bloodlines an einem Charakter | Die Obergrenze max 1 je Charakter feuert (Ist 2) |
| e04 | Zwei Charaktere mit **verschiedenen** Bloodlines | Legal — keine armeeweite Schranke |
| e05 | Strigoi mit „Full plate armour" (nur Blood Dragon bietet sie) | Verfügbarkeit — keine Verletzung |
| e06 | Blood Dragon + Rüstung + Magie (Replik von `Test2.rosz`) | Legal im ergofang-Katalog — keine Verletzung |

## `army-standard-bearer`

Armee-Standartenträger (BSB) an O&G + Mercenaries. Aus den Katalogdaten abgeleitet
feuern die **eintrags-skopierten** BSB-Zählgrenzen (armeeweit `082b…`, je Charakter
`01a5…`); die **kategorie-skopierten** Grenzen (`2a1d…`, `6935…`) und die als
Verfügbarkeit (`hidden`) modellierte Magic-Items-Sperre erscheinen **nicht** im
Verletzungsbericht (Details samt Katalogbeleg in der Szenario-README).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ein Orc Bigboss mit genau einem BSB | Keine BSB-Verletzung — Obergrenzen eingehalten |
| 02 | Zwei Charaktere, jeder mit BSB | Die roster-weite Obergrenze feuert (Ist 2) an beiden BSB |
| 03 | Ein Charakter, BSB doppelt (`number=2`) | Die Charakter-Obergrenze und die roster-Obergrenze feuern (Ist 2) |
| 04 | Ein BSB + „Border Patrols rules" | Die als Kategorie-Grenze modellierte Ausnahme erscheint **nicht** — keine BSB-Verletzung |
| 05 | Ein Orc Bigboss ohne BSB | Grundlinie — keine BSB-Diagnose |
| 06 | BSB mit **einer** magischen Standarte | Legal — keine Verletzung |
| 07 | BSB mit Standarte **und** zusätzlichem Magie-Item | Verfügbarkeits-Sperre (`hidden`) — keine BSB-Verletzung |

## `ogre-kingdoms`

Reale Domänen-Regeln der Ogre-Armee (Ogre + gst + Mercenaries).

| # | Geprüfter Roster-Zustand | Datensatz | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- | :--- |
| 01 | Leeres Ogre-Kontingent | mit Mercenaries | General (min 1) und Core (min 2) feuern (Ist 0); Auflösung vollständig, keine „fehlende Abhängigkeit" |
| 01b | Dasselbe leere Kontingent | **ohne** Mercenaries | Meldung „fehlende Abhängigkeit" (Mercenaries) — kein Absturz |
| 02 | General + zwei Core-Einheiten | mit Mercenaries | Beide Pflichten erfüllt — keine Verletzung |
| 03 | General + eine Core-Einheit, ohne „Border Patrols rules" | mit Mercenaries | Core feuert (1 von 2) |
| 04 | General + eine Core-Einheit + „Border Patrols rules" | mit Mercenaries | Die gesenkte Grenze (1) ist erfüllt — keine Verletzung |
| 05 | Nur „Border Patrols rules" | mit Mercenaries | Core feuert mit **Grenze 1** statt 2 — Beleg der gesenkten Grenze |
| 06 | Zwei Tyrants | mit Mercenaries | Die Tyrant-Obergrenze (max 1) feuert (Ist 2) |
| 07 | Ein Tyrant | mit Mercenaries | Obergrenze eingehalten — keine Verletzung |
| 08 | Zwei leere Kontingente | mit Mercenaries | §7.7: General und Core feuern **je zweimal** (armeeweite Summe 0) |
| 09 | Ein Kontingent bestückt, ein zweites leer | mit Mercenaries | §7.7: die Kategorie zählt armeeweit — auch das leere Geschwister verletzt nicht |
| 10 | Auswahl mit unbekannter Kennung | mit Mercenaries | Diagnose „nicht auflösbar" — kein Absturz |

## `orcs-and-goblins`

Die im Spielsystem definierten Pflichtregeln plus die katalogübergreifende
Auflösung über Mercenaries.

| # | Geprüfter Roster-Zustand | Datensatz | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- | :--- |
| 01 | Leeres O&G-Kontingent | mit Mercenaries | General und Core feuern (Ist 0); kein Verweis offen |
| 02 | General + zwei Core-Einheiten | mit Mercenaries | Regelkonform — keine falsche Verletzung |
| 03 | Dasselbe leere Kontingent | **ohne** Mercenaries | Meldung „fehlende Abhängigkeit"; der „Pikemen"-Verweis bleibt offen — kein Absturz |

## `vampire-counts`

Wie `orcs-and-goblins`, an der Vampire-Counts-Armee (Definitive-Katalog; prüft die
General-/Core-Pflichten, **nicht** die Bloodline-Regeln).

| # | Geprüfter Roster-Zustand | Datensatz | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- | :--- |
| 01 | Leeres VC-Kontingent | mit Mercenaries | General und Core feuern (Ist 0); kein Verweis offen |
| 02 | General + zwei Core-Einheiten | mit Mercenaries | Regelkonform — keine falsche Verletzung |
| 03 | Dasselbe leere Kontingent | **ohne** Mercenaries | Meldung „fehlende Abhängigkeit"; der „Pikemen"-Verweis bleibt offen — kein Absturz |

## `real-catalog-smoke`

Rauchtest der Fassade an den vollständigen echten DE-Daten. Belegt die
**Auflösungs-Fähigkeit** (nicht die Regel-Semantik einzelner Armeen) an einer
leeren Armee.

| # | Geprüfter Roster-Zustand | Datensatz | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- | :--- |
| 01 | Leere Armee (keine Kontingente) | mit Mercenaries | Vollständiger Bericht, kein Absturz; alle Verweise (auch „Pikemen") lösen auf |
| 02 | Dieselbe leere Armee | **ohne** Mercenaries | Meldung „fehlende Abhängigkeit"; der „Pikemen"-Verweis bleibt offen — kein Absturz |

## `category-scope-bug`

Prüft, ob eine Constraint, die auf eine bestimmte Kategorie gescoped ist (hier: Strigoi `bf30-4ff0-a4d8-3909`), nicht irrtümlich feuert, wenn die entsprechende Auswahl (hier: Mount) in einer Einheit getroffen wird, die diese Kategorie *nicht* besitzt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ein Master Necromancer (enthält die gescopete Constraint), ein Von Carstein Vampire mit Mount, und ein Strigoi Vampire ohne Mount | Das Mount gehört nicht zur Strigoi-Kategorie, weshalb die Strigoi-gescopete Constraint nicht feuert — keine Verletzung |

## `orcs-and-goblins-budget`

Budget-gesteuertes Verhalten an echten O&G-Daten: die mit dem eingestellten
Punktebudget skalierende Core-Mindestzahl, die armeeweite Budget-Überschreitung und
der Fall ohne eingestelltes Budget.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Leeres Kontingent, Budget 2000 pts | Die Core-Pflicht steigt auf 3 und feuert (Ist 0) |
| 02 | Leeres Kontingent, Budget 3000 pts | Die Core-Pflicht steigt auf 4 und feuert (Ist 0) |
| 03 | Drei Core-Einheiten, Budget 2000 pts | Die Core-Pflicht (3) ist erfüllt — keine Verletzung |
| 04 | Einheit für 150 pts, Budget 100 pts | Meldung „Armee zu teuer" |
| 05 | Dieselbe Einheit, Budget 150 pts | Genau auf der Grenze — keine Verletzung |
| 06 | Leeres Kontingent **ohne** eingestelltes Budget | Die budget-lesende Regel meldet „Budget unbekannt" statt still mit 0 zu rechnen; die Core-Pflicht bleibt auf ihrem Basiswert |

## `evaluator-bug-childid-model`

Prüft, ob eine Bedingung, die auf die **Modellzahl** einer Einheit schaut
(`childId="model"`), korrekt auswertet.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Border-Patrols-Armee mit einer Einheit aus 10 Steintrollen | Die Einheit erhält die Kategorie „BP Infantry 10+"; am Slot „Border Patrols rules" liegt **keine** Autor-Meldung an |

## `evaluator-force-child-category-missing`

Prüft, ob eine Pflicht-Untergrenze an einer Kategorie des Kontingents auch dann
anschlägt, wenn gar keine passende Auswahl im Roster steht.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | „Army of the Lichemaster" ganz ohne Auswahlen | Die Pflicht „mindestens 1 Lord" feuert (Ist 0) |
| 02 | Dieselbe Armee mit genau einem Lord | Die Pflicht ist erfüllt — keine Verletzung |

## `group-scope-missing-mandatory`

Eine Auswahlgruppe mit Untergrenze verlangt zwingend eine Auswahl aus ihren Kindern.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Wizard Lord mit genau einer Auswahl aus der Pflichtgruppe „Magic Level" | Die Pflicht ist erfüllt — keine Verletzung |
| 02 | Wizard Lord ohne Auswahl aus dieser Gruppe | Die Pflicht feuert (Ist 0) |

## `parent-scope-missing-mandatory`

Grenzfall: eine Pflicht-Untergrenze an einem Modell, dessen Knoten im Roster
komplett fehlt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Einheit ohne jedes Modell | Dokumentierte Grenze der Engine: die Modell-Pflicht feuert hier **nicht** |
| 02 | Dieselbe Einheit mit 5 Modellen (zu wenig) | Die Pflicht feuert |

## `max-unlimited-violation`

Prüft die Battlescribe-Bedeutung von `max="-1"`: unbegrenzt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | 21 Goblins bei „mindestens 20, Obergrenze unbegrenzt" | Keine Verletzung — eine unbegrenzte Obergrenze feuert nie |

## `mercenaries-repeat-bug`

Prüft Wiederholungen (`<repeat>`) in einem Modifikator: die Obergrenze der „Kylists"
steigt je 2 gewählter „Bucks" um 1.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Toxote's Hellmounts mit 4 Bucks und 3 Kylists | Keine Verletzung: die Obergrenze der Kylists steigt von 1 auf 3. Keine Meldung über eine ungelesene Wiederholung |

## `explorer-force-constraints`

Prüft eine Obergrenze, die an einer **Kategorie** des Spielsystems hängt und je
Kontingent zählt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ogre-Kontingent mit 4 Einheiten der Kategorie „Special" | Die Grenze „höchstens 3 Special" feuert (Ist 4) |
| 02 | Dasselbe Kontingent mit 3 Einheiten | Die Grenze ist eingehalten — keine Verletzung |

## `explorer-category-constraints`

Prüft eine Obergrenze, die **nur eine bestimmte Armeeliste** ihrer Kategorie
auferlegt (Grenze am `categoryLink` des Kontingents).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | „Savage Orc Horde" mit 3 Goblin-Charakteren | Die Grenze „höchstens 2 Goblin-Charaktere" feuert (Ist 3) |

## `explorer-modifier-constraints`

Prüft einen Modifikator, der an einem **Verweis** (`entryLink`) hängt und dort eine
geerbte Grenze verändert.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Armeeliste „Grimgor's 'Ardboyz", Orc Great Shaman als General | In dieser Liste ist kein General dieser Art erlaubt — die Grenze feuert (Ist 1, Grenze 0) |
| 02 | Derselbe Aufbau in der Standardliste | Dort gilt „höchstens 1 General" und ist erfüllt — keine Verletzung |

## `explorer-nested-constraints`

Prüft eine Punktegrenze an einer Auswahlgruppe, deren Unterlisten per Verweis
eingebunden sind.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Savage Orc Warboss mit magischen Waffen für 125 Punkte | Die Grenze „höchstens 100 Punkte magische Gegenstände" feuert (Ist 125) |

## `numeric-conditions`

Prüft, ob die Zahlen-Vergleiche einer Modifikator-Bedingung (*kleiner als*,
*größer als*, *gleich*) richtig greifen — je Vergleich einmal erfüllt und einmal
verfehlt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01–02 | *gleich*-Bedingung erfüllt / verfehlt | Erfüllt hebt die Obergrenze von 1 auf 2 (keine Verletzung); verfehlt bleibt sie 1 und die Grenze feuert |
| 03–04 | *größer als*-Bedingung erfüllt / verfehlt | Erfüllt macht die Obergrenze unbegrenzt (keine Verletzung); verfehlt bleibt sie 0 und die Grenze feuert |
| 05–06 | *kleiner als*-Bedingung erfüllt / verfehlt | Erfüllt senkt die Pflicht auf 0 (keine Verletzung); verfehlt bleibt sie 1 und die Pflicht feuert |

## `remaining-condition-types`

Prüft die Bedingung *mindestens*, die eine Obergrenze verändert: Speer-Infanterie
und Hellebarden schließen sich bei den Skeletten gegenseitig aus.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Nur Speer-Infanterie gewählt | Die Bedingung der Gegenseite greift nicht — keine Verletzung |
| 02 | Speer-Infanterie **und** Hellebarden gewählt | Beide setzen die Obergrenze der jeweils anderen auf 0 — beide Grenzen feuern |

## `modifier-characteristic-value`

Prüft, dass ein Modifikator auf einen **Merkmalswert** genau das Profil trifft, an
dem er hängt — und nur dieses.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Söldner-Ogres mit Handwaffe, **ohne** leichte Rüstung | Der bedingte Rüstungswert greift nicht; nur der unbedingte Abzug wirkt (Sv 7) |
| 02 | Dieselbe Einheit **mit** leichter Rüstung | Beide Abzüge wirken (Sv 6); alle übrigen Merkmale bleiben unverändert |
| 03 | Anakondas Amazonen: vier Auswahlpunkte ziehen **dasselbe** geteilte Profil über je einen eigenen Verweis herein | Jeder Modifikator wirkt nur auf sein eigenes Verweis-Vorkommen; der Verweis ohne Modifikator behält die Basiswerte |

Alle drei Roster halten nebenbei fest, dass eine **am Verweis deklarierte
Pflichtgrenze** ihre eigene Auswahl mitzählt: Handwaffe (01, 02) und leichte
Rüstung (03) stehen im Roster, also darf keine Pflicht als unerfüllt gemeldet
werden (Issue 076).

## `shared-target-two-entrylinks`

Prüft, dass zwei **Verweise auf denselben Eintrag** unter einem Elternteil als
*ein* Gegenstand gezählt werden, nicht als zwei — zwei Türen zur selben Sache.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Commander mit *Armour of Heroes*, gewählt über Verweis A | Legal — ein Stück, Obergrenze 1 eingehalten |
| 02 | Derselbe Aufbau über Verweis B | Ebenfalls legal — welcher Verweis benutzt wurde, ändert nichts |
| 03 | **Ein** Commander nimmt die Rüstung über **beide** Verweise | Die Obergrenze am Zieleintrag feuert mit Ist 2 gegen Grenze 1 |
| 04 | **Zwei** Commander, jeder über einen anderen Verweis | Pro Träger nur eines — die trägerbezogene Obergrenze schweigt |

Roster 04 ist der Unterscheider: er trennt „unter einem Elternteil gemeinsam
gezählt" von „feuert immer, sobald beide Verweise vorkommen".

## `modifier-effective-name`

Prüft, dass ein Modifikator auf den **Namen** den Anzeigenamen seines Trägers
verändert — ersetzend (*set*) oder anfügend (*append*, mit dem Trennzeichen des
Katalogs).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Vampire ohne Blutlinie | Katalognamen unverändert — keine Bedingung greift |
| 02 | Vampire mit Blutlinie „Blood Dragon" | Beide Einheiten heißen „… of Clan Blood Dragon" (mit dem geschützten Leerzeichen des Katalogs) |
| 03 | Vampire Count mit Blutlinie „Lahmia" | Erst ersetzt, dann angefügt: „Vampire Countess of Clan Lahmia" |
| 04–05 | Skelette im Standard- bzw. im Sylvania-Kontingent | Nur im Sylvania-Kontingent greift die Umbenennung („Sylvanian Militia" / „Skeleton Militia") |
| 06 | Grom mit Streitwagen, dessen Profil-Verweis umbenannt wird | Der Verweis benennt nur *sein* Info-Vorkommen um; die Namen der Auswahlen bleiben unverändert |

## `author-message-severity`

Prüft, dass eine **Autor-Meldung** des Katalogs am betroffenen Auswahlpunkt
erscheint — mit ihrem Schweregrad und im Wortlaut des Katalogs — und dass sie
ausbleibt, sobald ihre Bedingung nicht mehr hält.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Skrag ohne den Schalter „Sonderfiguren erlauben" | Eine Meldung vom Schweregrad *Fehler* liegt an Skrag |
| 02 | Derselbe Aufbau **mit** dem Schalter | Keine Meldung — weder an Skrag noch am Schalter selbst |
| 03 | Zwei Träger derselben Meldung (Skrag und Greasus) | Die Meldung hängt am Auswahlpunkt, nicht am Kontingent: beide tragen je eine |
| 04–05 | Bruiser mit / ohne „Border Patrols rules" | Mit: eine Meldung vom Schweregrad *Warnung*; ohne: keine |
| 06–07 | Vampire Fleet Captain mit / ohne „Border Patrols rules" | Mit: eine Meldung vom Schweregrad *Hinweis*; ohne: keine |

## `offer-and-category-slots`

Prüft, dass der Bericht nicht nur beschreibt, **was** im Roster steht, sondern
**jede Stelle, an der eine Auswahl stehen kann**: das **Angebot** (alles, was hier
wählbar wäre, aber noch nicht gewählt ist) und die **Kategorien** des Kontingents.
Ein Angebot erzeugt dabei nie eine Verletzung — es ist eine Möglichkeit, keine
Beanstandung. Die Gegenprobe gehört zwingend dazu: ein Armee-Eintrag, den der
Katalog armeeweit **verlangt**, ist kein Angebot, sondern eine **Pflicht** — er
erscheint als Pflicht-Stelle, und seine unerfüllte Mindestzahl wird ganz normal
beanstandet.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Armeeliste „Clan Blood Dragons" mit einer Einheit *Black Knights*, die die Aufwertung *Black Knights of Bretonnia* trägt | Die Kategorien „Mercenaries" und „Regiment of Renown" der Liste sind dadurch **ausgeblendet**; „Heroes" ist sichtbar, ohne Ober-/Untergrenze und mit Ist-Stand 0, „Core" verlangt mindestens 2. Die gewählte Aufwertung ist **ausgereizt** (1 von 1). Nicht gewählte Optionen der Einheit (*Musician*, *Standard Bearer*) und nicht gewählte Armee-Einträge (*Fell Bats*, *Dire Wolves* — dort ausgeblendet, aber trotzdem aufgeführt — und *Manbiters*, dessen Obergrenze 0 ist) stehen als **Angebot** im Bericht. *Army of Sylvania* dagegen wird von der Armee **verlangt** und ist deshalb kein Angebot: beide Mindestzahl-Regeln werden mit Ist 0 beanstandet. Die Modellzahl *innerhalb* des nur angebotenen *Fell Bats* wird dagegen nicht beanstandet |
| 02 | Derselbe Aufbau **ohne** jene Aufwertung | Dieselben zwei Kategorien sind jetzt **sichtbar** — das Ausblenden ist also bedingt, nicht fest. Die weggelassene Aufwertung erscheint selbst als **Angebot** an der Einheit: 0 von 1 gewählt, ein Platz frei, sichtbar. *Army of Sylvania* bleibt Pflicht mit zwei Beanstandungen |
| 03 | Armeeliste „Army of the Lichemaster", die keine Söldner-/Regiment-of-Renown-Kategorie führt | *Fell Bats* und *Dire Wolves* werden weiterhin angeboten; *Manbiters*, dessen einzige Kategorie „Regiment of Renown" ist, **nicht** — das Angebot ist über die Kategorien der Armeeliste gefiltert. Auch hier ist *Army of Sylvania* Pflicht statt Angebot |

## `info-projection`

Prüft die zweite Hälfte dessen, was ein Auswahlpunkt im Bericht ist: **welche
Profile und Regeltexte gelten hier?** Jeder Slot führt dazu eine Liste — seine
**eigenen** Profile und Regeln **plus** die seiner tatsächlich gewählten
Unterauswahlen, nach oben vererbt. Damit steht am Statblock einer Einheit auch
das, was erst durch eine Aufwertung dazukommt. Vier Feinheiten gehören dazu: Ein
**Verweis** auf ein geteiltes Profil oder eine geteilte Regel erscheint an der
Stelle des Verweises und unter dessen Identität — das ist der Grund, warum
dasselbe geteilte Profil an mehreren Stellen verschiedene Werte tragen kann. Ein
Verweis auf eine **Regelgruppe** liefert deren Mitglieder statt eines eigenen
Eintrags. Alle Werte sind **effektiv**, also nach allen greifenden Modifikatoren;
der Regeltext dagegen ist stets der unveränderte Wortlaut des Katalogs.
**Verborgene** Elemente fehlen — wobei „verborgen" die *effektive* Sichtbarkeit
meint, also die Grundeinstellung des Katalogs, überschrieben von einer Bedingung.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Standardliste der Vampire Counts, Einheit *Skeletons* mit 10 Modellen, Pflicht-Handwaffe und einem *Skeleton Captain* | Die Einheit führt **vier** Elemente: ihre eigene Regel „Undead" im Wortlaut des Katalogs sowie — von den drei Unterauswahlen geerbt — den Statblock „Skeleton", das Waffenprofil „Hand Weapon" (Typ „Weapon", Sonderregel „-1 Sv with HW") und das Champion-Profil „Skeleton Captain". Jede Unterauswahl selbst führt genau ihr eigenes Element. Keine Grenze verletzt |
| 02 | **Dieselbe** Einheit in der Armeeliste „Army of the Lichemaster" | Das direkt eingebettete Champion-Profil heißt dort **„Skeletal Chieftain"** — sowohl am Champion-Auswahlpunkt als auch in der geerbten Liste der Einheit. Das benachbarte, nur *verwiesene* Profil „Skeleton" bleibt unverändert: die Umbenennung wirkt allein auf ihr eigenes Vorkommen. Keine Grenze verletzt |
| 03 | Standardliste, Einheit *0-1 Spirit Host* mit einem Modell | Die Einheit führt das Profil — angezeigt als **„Gloom"**, obwohl der Verweis „Spirit Host" heißt — mit den **unveränderten Katalogwerten**, dazu die Regeln „Swarm" und „Ethereal". Die zwei Regeln, die der Katalog grundsätzlich verbirgt („Spirit Levy", „Tormented"), werden hier nicht eingeblendet und müssen **fehlen**. Keine Grenze verletzt |
| 04 | **Dieselbe** Einheit in der Armeeliste „Army of the Lichemaster" (10 Modelle), dazu der dort verlangte Eintrag *The Army of the Lichemaster* | Die zwei zuvor verborgenen Regeln **„Spirit Levy"** (mit ihrem Wortlaut) und **„Tormented"** erscheinen jetzt, während „Swarm" umgekehrt **fehlt**; die Werte des Profils „Gloom" sind auf S 2 / T 2 / W 1 / A 1 / Ld 5 / US 1 geändert. Der Eintrag *The Army of the Lichemaster* bezieht seine Regeln über einen Verweis auf eine **Regelgruppe**: in seiner Liste stehen deren **drei Mitglieder** („Fear", „Immune to Panic", „Army of the Lichemaster") — **weder** der Verweis **noch** die Regelgruppe selbst. Der Modell-Auswahlpunkt führt **keines** der Elemente seiner Einheit. Keine Grenze verletzt |

> **Der Ausschluss wird mitgeprüft.** Dass ein verborgenes Element **fehlt**, ist
> keine bloße Prosa mehr: das Manifest kennt neben der „muss enthalten"-Liste
> inzwischen eine Gegenliste „darf nicht enthalten". Darüber sind sechs
> Ausschlüsse festgenagelt — in Roster 03, dass „Spirit Levy" und „Tormented"
> dort nicht auftauchen; in Roster 04, dass „Swarm" dort nicht auftaucht, dass
> der Verweis auf die Regelgruppe keinen eigenen Eintrag bildet (weder unter
> seiner eigenen Kennung noch unter der der Gruppe) und dass der Modell-
> Auswahlpunkt keines der Elemente seiner Einheit führt, weil die Vererbung nur
> nach oben läuft.

## `violation-classification`

Prüft die **Einordnung** der aus Grenzen abgeleiteten Meldungen: jede nennt ihre
Herkunft (`derivedLimit` vs. `authorMessage`) und sprachfrei, **was** gemessen
wird (Anzahl von Auswahlen, Kostensumme, Roster-Budget oder das eingestellte
Budget), **in welchem Bezugsrahmen**, **an welchem Anker** sie hängt und wie
Ist, Grenze und Differenz lauten. Dazu die Ursachen-Regel: eine Ursache wird aus
der Herleitung des Grenzwerts gelesen — nur ein bedingter Modifikator, dessen
Bedingung eine **benennbare Auswahl** nennt, erscheint als Ursache; und ein
Angebots-Anker trägt zwar Autor-Meldungen im Fähigkeits-Datensatz, steuert aber
nichts zur Meldungsliste bei. Die Roster 01–03 laufen gegen den Ogre-Datensatz,
04/05 gegen O&G und 06/07 gegen Vampire Counts (per Dataset-Override).

| # | Geprüfter Roster-Zustand | Datensatz | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- | :--- |
| 01 | Leeres Ogre-Kontingent, kein Punktebudget | Ogre | Die Core-Untergrenze meldet als abgeleitete Grenze: Mindestmaß auf einer **Anzahl von Auswahlen**, Bezugsrahmen **Kontingent**, Anker die **Kategorie**, Ist 0 von 2 — **ohne** Ursache, weil kein Modifikator den Basiswert verändert hat |
| 02 | Dasselbe Kontingent + „Border Patrols rules" | Ogre | Dieselbe Meldung mit gesenkter Grenze 1 — und **genau einer** Ursache, die die auslösende Auswahl beim Namen nennt („Border Patrols rules"), samt Art des Modifikators (`set`) und Zwischenwert |
| 03 | Zwei Tyrants im selben Kontingent | Ogre | Höchstmaß auf einer Anzahl von Auswahlen, Bezugsrahmen **Armee**, Anker je **belegte Auswahl** „Tyrant", Ist 2 von 1, Differenz **negativ**, Wert stabil, ohne Ursache — die Meldung erscheint an **beiden** Ankern |
| 04 | Savage Orc Warboss mit zwei magischen Waffen (75 + 50 pts) | O&G | Die Gruppengrenze misst eine **Kostensumme** (Kostenart pts, nicht eine Stückzahl): Bezugsrahmen Elternauswahl, Anker die **grenzentragende Gruppe** „Magic Items", Ist 125 von 100 |
| 05 | 30 Orc-Boyz-Modelle (150 pts) bei Budget 100 pts | O&G | Die **engine-eigene** Budget-Regel (ohne Katalog-Grenze): Messgröße **Roster-Budget**, Anker die Roster selbst (kein Slot), Kostenart pts, Ist 150 von 100 |
| 06 | Leeres Kontingent „Vampire Coast", Budget 1000 pts | VC | Die Kontingent-Grenze misst das **eingestellte Budget** (nicht die Kosten): Mindestmaß 2000, Ist 1000 — ohne Ursache, denn die Bedingung des hebenden Modifikators zielt auf ein Kontingent, nicht auf eine benennbare Auswahl |
| 07 | Kontingent „Clan Blood Dragons" nur mit den beiden „Allow"-Schaltern | VC + O&G | Der **Pflicht-Anker** „Army of Sylvania" liefert zwei Meldungen, die sich nur im Bezugsrahmen unterscheiden (Kontingent vs. Elternauswahl); der **Angebots-Anker** „Manbiters" trägt seine Autor-Meldung im Fähigkeits-Datensatz, aber die Meldungsliste enthält weder sie noch eine Grenze aus dem Angebot |

## `author-message-tokens`

Prüft das BattleScribe-Text-Token `{this}` in Autor-Meldungen: der Wortlaut
einer Meldung bleibt unverändert und in Katalogsprache, mit genau **einer**
Ausnahme — `{this}` wird durch den Anzeigenamen des tragenden Eintrags ersetzt.
Ein Text ohne Token bleibt Zeichen für Zeichen wörtlich. Ob `{this}` den
**wirksamen** (per `field="name"`-Modifikator geänderten) statt des
Katalog-Namens einsetzt, ist mit diesen Katalogdaten nicht prüfbar und in der
Szenario-README als Lücke dokumentiert.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ogre-Kontingent mit einer Gnoblars-Einheit, ohne „Bully Bully"-Auswahl | Genau eine Autor-Meldung (`error`) an der Einheit, mit **„Gnoblars"** an der Stelle des Tokens; die rohe Fassung mit `{this}` kommt **nullmal** vor |
| 02 | Dasselbe Kontingent + Ogre Bulls, gebunden an den **Verweis**, der die Kategorie „Bully Bully" unbedingt vergibt | Die Bedingung hält nicht mehr: an der Gnoblars-Einheit liegt **keine** Autor-Meldung an; weder die gerenderte noch die rohe Textfassung erscheint |
| 03 | Ogre-Kontingent mit Skrag, ohne „Allow special characters?" | Die token-freie Meldung bleibt **wörtlich** erhalten — derselbe Wortlaut im Fähigkeits-Datensatz des Slots und in der Meldungsliste, inklusive Anführungszeichen |

## `entrylink-raw-type-counting`

Prüft, dass eine über einen **Verweis** (`entryLink`) in die Armee gesetzte
Einheit unter dem **rohen Typ ihres Ziels** (`unit`, `model`, …) genauso zählt
wie dieselbe Einheit direkt gesetzt. Beobachtet wird das an den
„Border Patrols"-Regeln der Vampire Counts: die Armee muss aus mindestens 2 und
höchstens 4 **Einheiten** bestehen, sonst liegt am Slot „Border Patrols rules"
eine Autor-Meldung an. Die Söldner-Einheit „Ogre Bulls" gelangt nur über einen
Verweis in die Armee.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Border-Patrols-Armee mit **2 direkten** Skeletons-Einheiten (je 10 Modelle) | Keine Autor-Meldung am Slot „Border Patrols rules" — die direkte Grundlinie |
| 02 | 1 direkte Skeletons-Einheit + **Ogre Bulls über den Verweis** | Ebenfalls keine Meldung: die verlinkte Einheit zählt als 2. Einheit — identisch zur direkten Form |
| 03 | 4 direkte Skeletons-Einheiten + **Ogre Bulls über den Verweis** als fünfte | Die Obergrenze kippt **nur**, wenn die verlinkte Einheit mitzählt: genau eine Meldung „mindestens ZWEI, höchstens VIER Einheiten" |

## `unlimited-modifier-toggle`

Prüft den Sentinel `-1` („unbegrenzt") **im Zusammenspiel mit `set`-Modifikatoren** —
also beide Richtungen des Schalters, die das Schwester-Szenario
`max-unlimited-violation` offen lässt (dort nur „Rohwert `-1` ohne erfüllte
Bedingung feuert nie").

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Goblin-Einheit mit 26 Modellen, **ohne** „Border Patrols rules" | Keine Verletzung: die Modellgrenze ist unbegrenzt, solange die Bedingung nicht greift |
| 02 | Dieselbe Einheit mit 26 Modellen, **mit** „Border Patrols rules" | Der Deckel von 25 greift: genau eine Verletzung (Ist 26) |
| 03 | Goblin-Einheit mit genau 25 Modellen, mit „Border Patrols rules" | Keine Verletzung — die gesetzte Grenze ist exakt eingehalten |
| 04 | Amazon-Cold-One-Outriders **ohne** „Allow experimental rules?" | Die Einheit ist dort gar nicht erlaubt (Rohwert max 0): eine Verletzung |
| 05 | **Zwei** solche Einheiten **mit** „Allow experimental rules?" | Keine Verletzung: der Modifier hebt die Grenze per `set -1` auf |

## `primary-catalogue-scope`

Prüft den Bezugsrahmen `scope="primary-catalogue"`: eine Bedingung mit diesem
Rahmen fragt **nicht** „wie viele?", sondern „**ist diese Liste eine
Ogerarmee?**" — die `childId` benennt die Wurzel-Id eines `<catalogue>`, also
eines Armeebuchs. Beobachtet wird das an drei Söldner-Einträgen, die jedes
Armeebuch importiert: den `Rhinox Riders` (Pflicht-Slot und Obergrenze) und den
`Maneaters` (Rare-Slot-Aufschlag).

**Alle** Roster laufen gegen **denselben** Datensatz, und die Selektionen der
Paare sind byte-gleich — einzige Variable ist die `entryId` der `<force>`, also
das Armeebuch. Damit trägt jeder Unterschied im Bericht genau eine Ursache.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Eine Rhinox-Riders-Einheit in der **Ogerarmee** | Der Special-Slot ist dort Pflicht und fehlt: genau eine Verletzung |
| 02 | **Dieselbe** Einheit in der **Vampirarmee** | Umgekehrt: dort ist der *Rare*-Slot Pflicht, der Special-Slot nicht |
| 03 | Dieselbe Einheit in der **Orkarmee** | Wie 02 — die Bedingung prüft Identität mit *genau* dem Ogerbuch, nicht „Oger gegen Vampire" |
| 04 | Ogerarmee, der geforderte Special-Slot ist **gewählt** | Keine Verletzung: die angehobene Pflicht ist erfüllt |
| 05 | Vampirarmee, der geforderte Rare-Slot ist **gewählt** | Spiegelbild zu 04: keine Verletzung |
| 06 | **Zwei** Rhinox-Riders-Einheiten in der Ogerarmee | Keine Verletzung: dort ist die Obergrenze aufgehoben |
| 07 | **Zwei** solche Einheiten in der Vampirarmee | Gegenbeweis: dort greift die Obergrenze (Ist 2 gegen 1) |
| 08 | Maneaters in der **Ogerarmee** | Kein Aufschlag — der Zusatz-Slot ist dort verborgen und nicht Pflicht |
| 09 | **Dieselben** Maneaters in der Vampirarmee | Der Maneater kostet außerhalb der Ogerarmee einen Rare-Slot extra: eine Verletzung |
| 10 | Vampirarmee, deren Roster-Datei fälschlich das **Ogerbuch behauptet** | Ergebnis **identisch zu 02**: das Armeebuch kommt aus der Herkunft der Kontingent-Definition, nicht aus dem Attribut der Roster-Datei |

> **Roster 10 ist der eigentliche Prüfstein.** Eine `.ros`-Datei trägt an ihrer
> `<force>` ein `catalogueId`-Attribut. Dieses Szenario nagelt fest, dass die
> Auswertung ihm **nicht** folgt: die Datei behauptet „Ogre Kingdoms", das
> Kontingent stammt aber aus dem Vampirbuch — und der Bericht muss dem
> Kontingent folgen, nicht der Behauptung. Bestehende Fixtures tragen dort
> ohnehin schon Platzhalter (`catalogueId="cat"`), das Attribut ist also keine
> verlässliche Quelle.

> **Sichtbarkeit bleibt außen vor.** Dieselben Bedingungen steuern auch
> `field="hidden"` — in der Ogerarmee ist der Maneaters-Zusatzslot verborgen.
> Der Verletzungsbericht kodiert zählende Grenzen, keine Verfügbarkeit; diese
> Facette liest man an der Capability-Projektion ab (gleiche Abgrenzung wie in
> `vampire-bloodlines`, VBL-R4/R5).

## `unit-scope-per-model-cost`

Prüft den Bezugsrahmen `scope="unit"` am Mercenaries-Idiom „Kostenaufschlag je
Modell": das Barding der Heavy Cavalry kostet über einen Wiederhol-Modifikator
je Modell der **umschließenden Einheit** 2 Punkte extra (Issue 086). Beobachtet
wird der korrekt gerechnete Gesamtpreis über die roster-weite Budgetregel; in
beiden Rostern darf keine `unresolvedScope`-Diagnose für `unit` entstehen.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Heavy Cavalry mit 5 Modellen und Barding, Punktelimit 100 | Die Armee kostet 105 (95 + 5 × 2 Barding-Aufschlag): das Budget feuert mit Ist 105 gegen 100. Eine Engine, die den Aufschlag 0-fach rechnet, bliebe fälschlich stumm |
| 02 | Derselbe Aufbau, Punktelimit 110 | Kein Feuern — und zugleich die Klammer nach oben: eine Doppel-Anwendung des Aufschlags oder die Basiskosten der Definition (statt der Link-Kosten 0) ergäben ≥ 111 und feuerten fälschlich |

## `ancestor-scope-instance-of`

Prüft den Bezugsrahmen `scope="ancestor"` (nur mit `instanceOf`/`notInstanceOf`
gültig): die Bedingung hält genau dann, wenn **irgendein Vorfahre** der
tragenden Auswahl auf die benannte Kategorie auflöst (Issue 086). In beiden
Rostern darf keine `unresolvedScope`-Diagnose für `ancestor` entstehen.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Swain (Kategorie „Characters") → Commander → 2 Tiranoc Chariots | Der Treffer liegt erst beim **Großvater**: als Charakter-Reittier sinkt die Chariot-Obergrenze auf 1 — sie feuert (Ist 2 gegen 1), die Chariot-Pflicht entfällt |
| 02 | Swain → Noble → 1 Steed of Slaanesh, kein Vorfahre trägt „Slaanesh [DARK ELVES]" | Die Bedingung hält nicht: das Basis-Maximum 0 des Steed-Verweises bleibt stehen und feuert (Ist 1 gegen 0) |

## `root-entrylink-mandatory-catalogue-scope`

Prüft, dass eine Pflicht, die **ein** Armeebuch an **seinem eigenen**
Katalog-Wurzel-`entryLink` deklariert, nur innerhalb dieses Armeebuchs gilt —
auch wenn zwei andere, gleichzeitig geladene Armeebücher unabhängig voneinander
ihren **eigenen** (constraint-losen) Wurzel-`entryLink` auf **dasselbe** geteilte
Ziel deklarieren. Beobachtet an „Ogre Bulls" (Mercenaries-Bibliothek): Ogre
Kingdoms verlangt armeeweit mindestens eine Einheit davon (außer in der
Ironskin-Tribe-Variante); Vampire Counts und Orcs and Goblins bieten dieselbe
Einheit nur optional an. Keines der drei Armeebücher verlinkt per
`catalogueLink` auf ein anderes — nur je auf Mercenaries —, weshalb der
Ogre-Kingdoms-eigene `entryLink` in einem fremden Kontingent strukturell gar
nicht erreichbar ist.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ogre-Kontingent ohne Ogre Bulls | Die Pflicht feuert (Ist 0 gegen 1) — Regressionswache, kein Bug |
| 02 | Ogre-Kontingent mit einer Ogre-Bulls-Einheit | Positive Kontrolle: die Pflicht ist erfüllt — keine Verletzung |
| 03 | Vampire-Counts-Kontingent ohne Ogre Bulls, ohne jeden Bezug zum Ogre-Kingdoms-`entryLink` | Die eigentlich geprüfte Regel: die nur in Ogre Kingdoms deklarierte Pflicht darf hier **nicht** feuern |
| 04 | Orcs-and-Goblins-Kontingent ohne Ogre Bulls, ohne jeden Bezug zum Ogre-Kingdoms-`entryLink` | Wie 03, an einem zweiten unabhängigen Armeebuch — schützt vor einem Fix, der zufällig nur für Vampire Counts wirkt |

## `force-instance-gated-rename`

Prüft die kanonische ForceEntry-Instanzprüfung (`condition type="instanceOf"
scope="force" childId=<forceEntry-Id>`, §7.7 der Formatdoku): ein per solcher
Bedingung gegateter `set name`-Modifier greift genau in dem Kontingent, das das
benannte Sonderheer instanziiert, und in keinem anderen. Beleg: Grave Guard
(Vampire Counts) trägt drei `set name`-Modifier (Einheit „Barrow Guardians",
Modell „Barrow Guard", Profil-Info „Barrow Guard"), alle gegatet auf das
ForceEntry „Army of the Lichemaster (WD#309-UK)" (`f37a-a93e-fa22-61a8`). Beide
Roster sind bis auf das Kontingent identisch.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Grave Guard (10 Modelle, Handweapon, Heavy Armour) im Kontingent „Army of the Lichemaster" | Die Bedingung hält: die Einheit heißt „Barrow Guardians", der Modell-Slot und das Profil-Vorkommen „Barrow Guard" |
| 02 | Derselbe Aufbau im Kontingent „Standard (VC-AB)" | Die Bedingung hält nicht: alle drei behalten den Basisnamen „Grave Guard" |

## `set-hidden-force-gate`

Prüft den `set hidden`-Modifikator (§7.7/§8 der Formatdoku): er ersetzt das
`hidden`-Attribut des Trägers genau solange seine Bedingung hält; sonst gilt
der geschriebene Basiswert. Beleg: Scouts (`ff2c-a7c6-4cab-b0fd`, Basis
`hidden="true"`) unter der Wurzeleinheit Dire Wolves (Vampire Counts) trägt
`set hidden=false`, gegatet per `instanceOf scope="force"` auf das ForceEntry
„Army of Sylvania (SoC)" (`4072-c3b8-84c4-a097`). Beide Roster sind bis auf
das Kontingent identisch; Scouts ist nicht gewählt und erscheint als
Angebots-Slot.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Dire Wolves (5 Modelle) im Kontingent „Army of Sylvania" | Die Bedingung hält: der Scouts-Angebots-Slot ist sichtbar (`isHidden` false) |
| 02 | Derselbe Aufbau im Kontingent „Standard (VC-AB)" | Die Bedingung hält nicht: der Basiswert `hidden="true"` steht — der Slot ist versteckt |

## `set-constraint-value-force-gate`

Prüft den `set`-Modifikator auf eine Constraint-`id` (§7.6/§7.7 der
Formatdoku): er ersetzt den Wert der adressierten Grenze genau solange seine
Bedingung hält; sonst gilt der geschriebene Basiswert. Beleg: der
Skeletons-Modellslot (`eaa1-c6a6-9aae-ae9a`, Vampire Counts) trägt
`max value="40"` (`id 6679-1132-0a76-9ba3`) und `set value="30"` auf genau
diese Id, gegatet per `instanceOf scope="force"` auf das ForceEntry „Army of
Sylvania (SoC)" (`4072-c3b8-84c4-a097`). Beide Roster sind bis auf das
Kontingent identisch (10 Modelle + Handweapon).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Skeletons (10 Modelle) im Kontingent „Army of Sylvania" | Die Bedingung hält: das effektive Maximum des Modellslots ist 30; mit 10 Modellen feuert keine Grenze |
| 02 | Derselbe Aufbau im Kontingent „Standard (VC-AB)" | Die Bedingung hält nicht: das Basis-Maximum 40 steht; keine Grenze feuert |

## `dispel-scroll-repeat-group-max`

Prüft die `<repeats>`-Liste mit genau einem `<repeat>` an einem Modifikator
(§7.7/§9.7 der Formatdoku, Dispel-Scroll-Muster): der Modifikator wird je
gezähltem Treffer des Repeats einmal angewendet. Beleg: die Gruppe „Arcane
Items (VC)" (`2f34-a145-911a-fa00`, Vampire Counts) trägt `max 1`
(`fa59-e6b8-9523-3510`) und `increment +1` auf genau diese Grenze, wiederholt
je gewähltem Dispel Scroll (`childId adb3-9853-d566-e432`) — der Scroll
verbraucht so den einen Arcane-Slot nicht. Träger: Master Necromancer,
Kontingent „Standard (VC-AB)" in beiden Rostern.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Master Necromancer mit ZWEI Dispel Scrolls | Zwei Anwendungen des +1: effektives Gruppen-Maximum 1+2=3; keine Grenze feuert (2×25 = 50 von 100 Punkten Budget) |
| 02 | Derselbe Aufbau ohne Arcane Item | Kein Treffer: das Basis-Maximum 1 der Gruppe steht |

## `at-least-force-toggle-gate`

Prüft die `atLeast`-Bedingung mit `scope="force"` und Eintrags-`childId`
(§7.7/§9.7 der Formatdoku): sie zählt die Auswahlen des Kontingents, die auf
die benannte Id auflösen — über die Link-Id **oder** deren Ziel-Id. Beleg:
Greasus Goldtooth (`47f3-befb-e32e-0b4a`, Ogre Kingdoms, Wurzeleinheit) trägt
`max 0 scope="force"` (`cef8-c3b1-7850-85bc`) und `set 1` darauf, gegatet auf
`atLeast 1` des Wurzel-entryLinks „Allow special characters?"
(`9e50-7486-65ab-c449`, Ziel `8923-5946-7b10-8957` in der `.gst`). Beide
Roster nutzen „Standard (OK-AB)" und unterscheiden sich nur im Toggle.

**Stand beim Pinnen: rot** — Roster 02 schlägt fehl (die Engine kreditiert die
Toggle-Auswahl mit Ziel-Id nicht gegen die Link-`childId` der Bedingung);
gepinnt als Phase-B-Aufgabe in `docs/testing/campaign-state.json`.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Greasus gewählt, kein Toggle im Kontingent | Die Bedingung hält nicht: das Basis-Maximum 0 steht und feuert (Ist 1 gegen 0), `effectiveMax` 0 |
| 02 | Identisch, zusätzlich „Allow special characters?" gewählt | Die Bedingung hält (Ist 1): der `set 1` hebt die Grenze — sie feuert nicht mehr, `effectiveMax` 1 |

## `at-least-roster-border-patrols-gate`

Prüft die `atLeast`-Bedingung mit `scope="roster"` und Eintrags-`childId`
(§7.7 der Formatdoku): sie zählt rosterweit (mit `includeChildForces="true"`
über alle Kontingente) und schaltet den gegateten Modifikator genau ab dem
Schwellwert. Beleg: die Wurzeleinheit „0-1 Black Coach" (`dd09-e6e8-38ea-c6f4`,
Vampire Counts) trägt `set hidden=true`, gegatet auf `atLeast 1` der
Roster-Selektion „Border Patrols rules" (`4e15-0353-165f-5528`, `.gst`);
dieselbe Bedingung setzt in der `.gst` die Core-Pflicht von 2 auf 1. Beide
Roster: „Standard (VC-AB)", costLimit 500 (hält den Toggle legal sichtbar),
eine voll besetzte Black-Coach-Einheit; Unterschied nur der Toggle.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ohne Border-Patrols-Selektion | Zählung 0 < 1: Black Coach bleibt sichtbar (`isHidden` false), die Core-Pflicht feuert unmodifiziert mit Ist 0 gegen 2 |
| 02 | Mit einer Border-Patrols-Selektion | Zählung 1 ≥ 1: Black Coach wird versteckt (`isHidden` true), die Core-Pflicht feuert mit Grenze 1 statt 2 — beide Wirkungen derselben Bedingung |

## `condition-group-or-force-gate`

Prüft die `conditionGroup type="or"` auf oberster Ebene eines Modifikators
(§7.7 der Formatdoku): die Gruppe hält, wenn **mindestens eines** ihrer
Mitglieder hält — ein einziges wahres Mitglied genügt. Beleg: die
Wurzeleinheit „0-1 Bat Swarm" (`3161-6d02-8903-b0c4`, Vampire Counts, Basis
`hidden="false"`) trägt `set hidden=true`, gegatet durch eine einzelne
or-Gruppe mit fünf `instanceOf(scope=force)`-Mitgliedern (Necromancer's Army,
Clan Necrarch, Clan Blood Dragons, Lichemaster, Vampire Coast). Beide Roster
sind bis auf das Kontingent identisch.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Bat-Swarm-Einheit im Kontingent „Clan Necrarch (VC-AB)" — genau das zweite Gruppenmitglied hält | Die or-Gruppe hält: die Einheit ist versteckt (`isHidden` true); ihre roster-max-1-Grenze bleibt trotzdem geprüft und still |
| 02 | Derselbe Aufbau im Kontingent „Standard (VC-AB)" — kein Mitglied hält | Die Gruppe hält nicht: die Einheit bleibt sichtbar (`isHidden` false) |

## `condition-group-and-points-bracket`

Prüft die `conditionGroup type="and"` auf oberster Ebene (§7.7 der
Formatdoku): sie hält nur, wenn **alle** Mitglieder halten — ein einziges
falsches Mitglied besiegt die Gruppe. Beleg: die Punktestaffel der
Core-Pflicht in der `.gst` (categoryEntry „Core", Constraint
`35c2-d478-392a-aeb1`, Basis min 2): `set 3` gegatet auf die dreigliedrige
and-Gruppe [keine Border Patrols, Limit ≥ 2000, Limit < 3000], `set 4` analog
für 3000–3999. Drei identische, leere „Standard (VC-AB)"-Kontingente, nur das
Punktelimit variiert.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Leeres Kontingent, Limit 1000 | Beide Bracket-Gruppen scheitern je an ihrem atLeast-Mitglied (zwei von drei Mitgliedern sind wahr): Basis-Grenze 2 feuert mit Ist 0 |
| 02 | Leeres Kontingent, Limit 2500 | Alle drei Mitglieder der 2000er-Gruppe halten: Grenze 3 feuert mit Ist 0 |
| 03 | Leeres Kontingent, Limit 3000 | Grenzfall: die 2000er-Gruppe scheitert an ihrem lessThan-Mitglied (3000 ist nicht < 3000), die 3000er-Gruppe hält vollständig: Grenze 4 feuert mit Ist 0 |

## `parent-scope-per-model-cost`

Prüft `<repeat field="selections" scope="parent" childId="model" repeats="1">`
an einem Kostenaufschlag (§7.7/§9.3 der Formatdoku): der Modifikator wird je
Modell-Auswahl der **Eltern**-Einheit einmal angewendet. Beleg: der
Light-Armour-Verweis (`e5af-d4b8-8f97-9197`, Ziel-Kosten 0) hängt direkt unter
der Wurzeleinheit „Ogre Bulls" (`7754-8b3d-df99-d2d5`, Mercenaries) und trägt
`increment 3` auf die pts-Kostenart mit genau diesem Repeat. Beide Roster: 4
Bulls (je 35 pts, bewusst über dem Minimum 3), Pflicht-Club (0 pts), Light
Armour — korrekte Summe 152 = 140 + 4×3.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | 4 Bulls mit Light Armour, Punktelimit 151 | Das Budget feuert mit Ist 152: jede Unter-Anwendung (0-, 1-, 3-fach oder je Auswahl statt je Modell) bliebe unter dem Limit und stumm |
| 02 | Derselbe Aufbau, Punktelimit 153 | Kein Feuern — die Klammer nach oben: eine 5-fache Anwendung (155) oder das Zählen aller Kinder statt nur der Modelle (158) feuerte fälschlich |

## `remove-category-force-gate`

Prüft `modifier type="remove" field="category"` (§8 der Formatdoku: alle
kategorie-abhängige Zählung wertet die **effektiven** Kategorie-Links aus):
die benannte Kategorie verlässt die effektive Mitgliedschaft, solange das
Gatter hält. Beleg: Grave Guard (`92ee-2ebf-c6c0-71ff`, Vampire Counts, roh
nur „Special") trägt eine `modifierGroup`, gegatet auf das ForceEntry „Clan
Blood Dragons (VC-AB)", mit `set-primary` Core + `remove` Special + `add`
Core. Beide Roster: costLimit 1000, 4× Grave Guard (je 10 Modelle +
Handwaffe); die `.ros`-Snapshots führen bewusst in beiden die **rohe**
Special-Kategorie.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | 4× Grave Guard im Kontingent „Standard (VC-AB)" | Rohe Kategorien zählen: die Special-Obergrenze feuert (4 > 3) und die Core-Pflicht feuert (0 < 2) |
| 02 | Derselbe Aufbau im Kontingent „Clan Blood Dragons (VC-AB)" | Beide Grenzen still: das stumme Special-Max pinnt die Entfernung (sonst 4 > 3), die stumme Core-Pflicht die hinzugefügte Mitgliedschaft (sonst 0 < 2) |

## `group-max-increment-on-choice`

Prüft `modifier type="increment"` auf eine Constraint-Id (§9.8 der Formatdoku,
Rüstungs-Muster): das Gruppen-Maximum steigt, solange die gekoppelte Option
gewählt ist. Beleg: die Gruppe „Weapons and Armour" (`06c9-c170-adb2-86f5`)
des Vampire Count (Vampire Counts) trägt `max 2` (`b3b5-f872-24df-04dc`) und
`increment +1`, gegatet auf `atLeast 1` der eigenen Option „Full Plate Armour"
(`a4d1-6e85-bee8-55d1`; Ziel per Blood-Dragon-Blutlinie aufgedeckt). Beide
Roster: Standard (VC-AB), Vampire Count mit Blood-Dragon-Blutlinie,
Pflicht-Handweapon und Magic Level 1; Unterschied nur die Full-Plate-Wahl.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Full Plate Armour in der Gruppe gewählt | Die Bedingung hält: effektives Gruppen-Maximum 3 bei Ist 2, Spielraum 1; keine Grenze feuert |
| 02 | Ohne Full Plate | Basis-Maximum 2 bei Ist 1 — der Shield-increment bleibt in beiden Rostern inert |

## `set-characteristic-force-gate` (ROT — gepinnter Gap)

Prüft `modifier type="set"` auf eine characteristicType-Id (§7.7/§7.3 der
Formatdoku): der Modifikator ersetzt genau ein Merkmal des effektiven Profils,
solange die Bedingung hält. Beleg: die Wurzeleinheit „Tomb stalker"
(`f401a3ed-…`, Vampire Counts, Basis `hidden="true"`) bezieht ihren Statblock
über den unbedingten infoLink „Tomb Scorpion" (`fe84bf5a-…`) und trägt
`set Mv=6`, gegatet auf das Lichemaster-Kontingent. Beide Roster sind bis auf
das Kontingent identisch. **Roster 02 ist rot:** der Bericht führt am Slot der
versteckten Einheit gar kein Info-Vorkommen des unbedingten infoLink — die
Basiswerte (Mv 7, „Tomb Scorpion") sind dadurch nicht prüfbar (siehe
`pinnedGaps` in `campaign-state.json`).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Tomb stalker im Lichemaster-Kontingent | Die Bedingung hält: Profil zeigt Mv 6, Name „Tomb stalker", Einheit sichtbar; WS 4 und Sv+ 5 bleiben Basis |
| 02 | Derselbe Aufbau im Kontingent „Standard (VC-AB)" | Kein Modifikator greift: Profil-Vorkommen mit Basis Mv 7 und Name „Tomb Scorpion", Einheit versteckt — derzeit fehlt das Vorkommen im Bericht ganz (Gap) |

## `less-than-force-min-drop`

Prüft die `lessThan`-Bedingung mit `scope="force"` und Eintrags-`childId`
(§7.7 der Formatdoku): sie hält genau unterhalb des Schwellwerts. Beleg: die
Blutlinien-Kraft „Seduction, Domination, Transfix and Beguile."
(`adfd-d46e-23ff-3d61`, Vampire Counts, an Neferatas „Bloodline
Powers"-Gruppe) trägt `min 1` (`10a1-ac7b-4b9c-0e12`), per `set 0` gesenkt,
solange die Force **keine** Lahmia-Blutlinie (`4f07-e982-6665-70b7`) zählt.
Alle drei Roster: Standard (VC-AB) mit Special-Characters-Toggle und Neferata;
Unterschied nur Blutlinie bzw. Kraft-Auswahl.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Lahmia-Blutlinie, Kraft nicht gewählt | Die Bedingung hält nicht (1 ist nicht < 1): die Basis-Pflicht feuert (Ist 0 gegen 1), ebenso die unbedingte Link-Pflicht (Kontrolle) |
| 02 | Necrarch-Zwilling, Kraft nicht gewählt | Die Bedingung hält (0 < 1): die gegatete Pflicht ist still; die unbedingte Link-Pflicht feuert weiter und beweist, dass der Slot geprüft wird |
| 03 | Lahmia-Blutlinie, Kraft gewählt | Alles still: die Pflicht ist erfüllt (Ist 1) |

## `at-least-unit-upgrade-gate`

Prüft die `atLeast`-Bedingung mit `scope="unit"` und Eintrags-`childId`
(§7.7 der Formatdoku, Kasten `scope="unit"`): gezählt wird in der
umschließenden Einheit, verschachtelte Auswahlen eingeschlossen. Beleg: in
der „Wizard Level"-Gruppe des „0-1 Vampire Lord" (`b77b-88d5-5e80-e178`,
Vampire Counts) wird „Magic Level 4" (`c5d1-…`, Basis versteckt) per
`set hidden=false` aufgedeckt und „Magic Level 2" (`54fc-…`, Basis sichtbar)
per `set hidden=true` versteckt — beide gegatet auf `atLeast 1` von
„Nehekhara's Noble Blood" (`32d0-a151-94a3-aa54`) im unit-Rahmen. Beide
Roster: Standard (VC-AB), Necrarch-Blutlinie, Vampire Lord mit Pflichtkindern
und Magic Level 2; Unterschied nur die Noble-Blood-Auswahl.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Vampire Lord ohne Noble Blood | Zählung 0 < 1: Basiswerte stehen — Magic Level 4 verborgen, Magic Level 2 sichtbar |
| 02 | Derselbe Aufbau mit Noble Blood (verschachtelt unter dem Lord) | Zählung 1 ≥ 1 (Schwelle exakt erreicht): Magic Level 4 aufgedeckt und der **gewählte** Magic-Level-2-Slot versteckt |

## `set-primary-category-membership`

Prüft den `set-primary`-Modifikator auf `field="category"` (§8 der Formatdoku,
Projektentscheidung Issue 0100): er sichert die Mitgliedschaft in der benannten
Kategorie auch dann, wenn der Eintrag sie nicht per `categoryLink` führt und
kein begleitendes `add category` danebensteht — und er verschiebt nur das
`primary`-Flag, entfernt also keine bestehende Mitgliedschaft. Beleg:
„'Kathleen' Halftank" (`331a-3634-095a-574a`, Ogre Kingdoms) trägt die
Kategorie-Links Rare (primär), Experimental rules und War Machine sowie einen
**unbedingten** `set-primary` auf „Regiment of Renown" (`ee09-9a50-ad78-9c32`)
ohne `add`. Alle Roster stehen im Kontingent „Standard (OK-AB)", das einen
Kategorie-Link auf Regiment of Renown führt, mit den Schaltern „Allow Regiments
of Renown" und „Allow experimental rules?"; der Slave Giant (`7ec6-83de-2dc3-82e9`,
nur ein Rare-Link, kein Kategorie-Modifikator) ist die Nullprobe.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Nur „Kathleen" Halftank | Sie zählt in Regiment of Renown (Ist 1), obwohl sie dorthin keinen Kategorie-Link führt, und weiterhin in Rare (Ist 1) |
| 02 | Nur Slave Giant, sonst identisch | Regiment of Renown bleibt bei Ist 0 — die 1 aus Roster 01 ist keine Konstante |
| 03 | Beide Einheiten zusammen | Regiment of Renown zählt weiter nur Kathleen (Ist 1), Rare zählt beide (Ist 2) und die Rare-Obergrenze max 1 feuert — `set-primary` nimmt keine Mitgliedschaft weg |

**Stand: rot.** Das Szenario ist ein festgenagelter Befund der
Abdeckungs-Kampagne (`docs/testing/campaign-state.json`, `pinnedGaps`): die
Engine zählt die per `set-primary` gesicherte Mitgliedschaft heute nicht mit.

## `unit-scope-instance-of-category`

Prüft die `instanceOf`-Bedingung mit `scope="unit"` und Kategorie-`childId`
(§7.7 der Formatdoku, Kasten `scope="unit"`): sie hält genau dann, wenn die
umschließende Einheit — der nächste Vorfahre mit `type="unit"` — Mitglied der
benannten Kategorie ist, und zwar nach den **effektiven** Kategorien, also
einschließlich einer per `add category` zur Auswertungszeit gewährten und
ausschließlich einer per `remove category` genommenen Mitgliedschaft. Beleg:
die Magic-Item-Verweise Spell Familiar (`4561-b83b-6268-9dde`), Power Familiar
(`0ec8-aa23-e935-59f7`) und Warrior Familiar (`67c6-f3bb-803a-0ca3`) unter dem
Vampire Count (Vampire Counts) tragen je einen `set hidden=true`, gegatet auf
`instanceOf scope="unit" childId="4cae-a20e-8374-b6cb"` („Blood Dragon"); die
Kategorie steht an keinem `categoryLink`, sondern kommt aus der
`BLOODLINE`-modifierGroup. Alle Roster unterscheiden sich nur in der gewählten
Blutlinie; Black Periapt ist die Nullprobe.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Blutlinie Blood Dragon, ein Vampire Count | Die Bedingung hält: alle drei Familiar-Slots sind versteckt, Black Periapt und Great Weapon bleiben sichtbar |
| 02 | Derselbe Aufbau mit der Blutlinie Von Carstein | Die Bedingung hält nicht (`remove` der Blood-Dragon-Kategorie): alle fünf Slots sichtbar |
| 03 | Beide Blutlinien zugleich | Das spätere `remove` gewinnt: die Slots bleiben sichtbar, und die Gruppengrenze „Vampiric Bloodline" (max 1) feuert mit Ist 2 |
| 04 | Blutlinie Strigoi | Derselbe Konstrukttyp eine Gruppenebene tiefer: der Great-Weapon-Slot ist versteckt |

## `less-than-roster-category-count`

Prüft die `lessThan`-Bedingung mit `scope="roster"` und Kategorie-`childId`
(§7.6/§7.7 der Formatdoku): gezählt werden alle Selektionen mit dieser
Kategorie armeeweit, und die Bedingung hält genau dann, wenn die Zählung echt
unter dem `value` liegt. Beleg: „Extra Goblin Hero" (`ed97-811b-cdb5-46c3`,
Orcs and Goblins) trägt die Grenze `186c-6345-5b25-5aa2` mit Basis `max 0`;
ein `increment 1` mit `repeat` je 1000 Punkten ist auf eine `and`-Gruppe aus
`greaterThan 999` auf das Punktelimit **und** `lessThan 1` auf die Kategorie
„Orc" (`d4a7-5999-8207-4efe`) gegatet. Die Zwillingspaare unterscheiden sich
nur darin, ob der gewählte Charakter einen Kategorie-Link auf „Orc" führt
(Orc Bigboss `6279-4d0a-6dce-f2f3` gegen Goblin Bigboss `8c8f-3fba-e337-fd2f`).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | 1000 Punkte, kein Orc | Beide Bedingungen halten: Höchstmaß 1, die Grenze feuert nicht |
| 02 | 1000 Punkte, Orc-Charakter dabei | Die Zählung ist 1, nicht < 1: Höchstmaß 0, die Grenze feuert mit Ist 1 |
| 03 | 500 Punkte, kein Orc | Die Kategorie-Bedingung hält, die Punkte-Bedingung nicht: Höchstmaß 0 — die beiden Glieder der `and`-Gruppe sind unterscheidbar |
| 04 | 2000 Punkte, kein Orc | Zwei Wiederholungen: Höchstmaß 2, die Grenze feuert nicht |
| 05 | 2000 Punkte, Orc-Charakter dabei | Höchstmaß 0, die Grenze feuert mit Ist 1 |

## `greater-than-parent-upgrade-gate`

Prüft die `greaterThan`-Bedingung mit `scope="parent"` und Eintrags-`childId`
(§7.6/§7.7 der Formatdoku): sie hält genau dann, wenn die Zählung im
Eltern-Rahmen echt über dem `value` liegt. Beleg: der Verweis „Magic Level 1"
(`86d1-3bd6-6cb2-711d`, Basis `hidden="true"`, eigene Grenze
`c195-d40a-1c54-f572` mit `min 0`) unter dem Wurzel-Eintrag Vampire Thrall
(`e37b-c827-99ac-b706`, Vampire Counts) trägt genau zwei Modifikatoren ohne
`<repeats>` — `set hidden=false` und `set 1` auf die eigene Grenze —, beide
gegatet auf `greaterThan 0` von „Nehekhara's Noble Blood"
(`32d0-a151-94a3-aa54`) im Eltern-Rahmen. Beide Roster sind bis auf diese eine
Auswahl identisch.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Vampire Thrall ohne Noble Blood | Zählung 0, nicht > 0: Basiswerte — der Slot bleibt versteckt, seine Untergrenze 0, nichts feuert |
| 02 | Derselbe Aufbau mit Noble Blood | Zählung 1 > 0: der Slot wird sichtbar **und** seine Untergrenze steigt auf 1 — unerfüllt, also feuert sie mit Ist 0 gegen Grenze 1 |

## `set-cost-value-force-gate`

Prüft den `set`-Modifikator auf eine **Kostenart** (`field` = die pts-Kostenart,
§7.5/§7.7 der Formatdoku): hält seine Bedingung, ersetzt er die geschriebenen
Kosten des Trägers, und jede Summe über diese Kostenart rechnet danach mit dem
ersetzten Wert. Beleg: das Modell „Zombie" (`5c6c-eaf9-2716-6f7e`, Vampire
Counts) trägt geschriebene 6 Punkte und zwei `set`-Modifikatoren ohne
`<repeats>` — auf 5 im Kontingent „Necromancer's Army" (`d3af-1add-4e99-b977`)
und auf 8 in „Army of Sylvania" (`4072-c3b8-84c4-a097`). Alle Roster tragen
dieselbe Einheit mit 20 Modellen und unterscheiden sich nur im Kontingent
(Roster 04 zusätzlich im Budget).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Standard-Kontingent, Budget 110 | Kein Gatter hält: 6 × 20 = 120 — das Budget ist überschritten |
| 02 | „Necromancer's Army", Budget 110 | `set 5`: 5 × 20 = 100 — dieselbe Modellzahl bleibt im selben Budget |
| 03 | „Army of Sylvania", Budget 110 | `set 8`: 8 × 20 = 160 — deutlich überschritten; der Einheitenname belegt zusätzlich, dass genau dieses Gatter hält |
| 04 | „Necromancer's Army", Budget 90 | 100 > 90 — der gegatete Wert ist exakt 5, nicht bloß „klein genug" |

## `force-id-scope-instance-of`

Prüft die **selbst-gegatete** Kodierung einer `instanceOf`-Bedingung auf ein
Kontingent (§7.7 der Formatdoku, Kasten „zwei Kodierungen"): die
`forceEntry`-Id steht direkt im `scope`, `childId` trägt `"any"` — gleichbedeutend
mit der kanonischen Form `scope="force"` + Id in `childId`. Beleg: der Savage
Orc Warboss (`ca27-a5f4-4a3e-7aeb`) und der Savage Orc Great Shaman
(`0767-0a7d-7c03-8833`, Orcs and Goblins) tragen je einen `set hidden=true`
mit einer `or`-Gruppe aus sieben Mitgliedern, von denen genau eines
`scope="a2fa-6a0e-8c17-373c" childId="any"` lautet („Mountain or Troll Country
Waaagh!"). Alle Roster sind leer und bis auf die Kontingent-Id identisch —
eine zählende Lesart müsste 0 ergeben und scheitern, die Identitätsprüfung
hält. Der Orc Great Shaman (`aa57-63c4-136b-4af5`), dessen Gruppe diese Id
nicht führt, ist die Gegenprobe.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Leeres Kontingent „Mountain or Troll Country Waaagh!" | Das selbst-gegatete Mitglied hält: beide Savage-Orc-Helden versteckt, die Gegenprobe sichtbar |
| 02 | Leeres Kontingent „Savage Orc Horde" | Kein Mitglied hält: beide sichtbar — die Gegenprobe umgekehrt versteckt |
| 03 | Leeres Kontingent „Night Goblin Horde" | Die kanonisch kodierte Schwester hält: beide versteckt — beide Kodierungen verhalten sich gleich |

## `at-least-self-model-count`

Prüft die `atLeast`-Bedingung mit `scope="self"` und dem Typ-Schlüsselwort
`childId="model"` (§7.6/§7.7/§13.2 der Formatdoku): gezählt werden die Modelle
**des Trägers selbst**, nicht die des Kontingents oder der Armee, und die
Schwelle ist einschließend. Beleg: die Ghouls (`6b45-b2ad-dcdf-d3f4`, Vampire
Counts) tragen einen `add category`-Modifikator auf „BP Infantry 10+"
(`6ad6-f54e-1867-00a7`), dessen `and`-Gruppe aus `atLeast 10 selections
scope="self" childId="model"` und der roster-weiten Border-Patrols-Auswahl
(`4e15-0353-165f-5528`) besteht; die zweite Bedingung ist in allen Rostern
gleich erfüllt. Beobachtet wird die Autor-Meldung „You must include at least
ONE infantry unit of 10+ models." der `.gst`.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Zwei Ghouls-Einheiten mit 10 und 5 Modellen | Der erste Träger erreicht die Schwelle exakt: die Kategorie wird gesetzt, die Meldung bleibt still |
| 02 | Dieselben Einheiten mit 9 und 5 Modellen | Kein Träger erreicht 10 — die Meldung feuert, obwohl kontingentweit 14 Modelle stehen |
| 03 | Zwei Einheiten mit je 5 Modellen | Kontingentweit exakt 10, je Träger aber nur 5: die Meldung feuert — der Rahmen ist der Träger |

## `at-least-roster-points-limit`

Prüft die `atLeast`-Bedingung auf das **Kostenlimit** der Roster
(`field="limit::<Kostenart>"`, `scope="roster"`, `childId="any"`; §7.7/§13.2 der
Formatdoku): verglichen wird das eingestellte Budget, nicht die verplante
Summe. Beleg: „Tournament rules: Uprising (2026)" (`4bc4-8781-2091-d9df`,
Orcs and Goblins) trägt die Grenze `00f6-c1b3-ee85-5c02` (`max 0`,
`scope="force"`) und zwei Modifikatoren unter derselben `and`-Gruppe aus
`atLeast 2000` und `atMost 2500` auf das pts-Kostenlimit; die
Geschwisterbedingung ist in allen Rostern erfüllt, nur das `atLeast`-Glied
bewegt sich.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Budget 2000, verplant 0 | Schwelle exakt erreicht: der `set` hebt die Grenze auf 1, sie feuert nicht |
| 02 | Budget 1999, verplant 0 | Einen Punkt darunter: die Grenze behält `max 0` und feuert mit Ist 1 |
| 03 | Budget 1999, verplant 2000 | Die verplante Summe erreicht die Schwelle, das Budget nicht: die Grenze feuert weiter — `limit::` liest das Budget |

**Stand: rot.** Das Szenario ist ein festgenagelter Befund der
Abdeckungs-Kampagne (`docs/testing/campaign-state.json`, `pinnedGaps`).

## `parent-max-include-child-selections`

Prüft eine Obergrenze mit `scope="parent"`, `includeChildSelections="true"` und
`includeChildForces="true"` (§7.6 der Formatdoku): gezählt wird der Träger im
Eltern-Rahmen, verschachtelte Auswahlen eingeschlossen, und `shared="true"`
zählt über alle Instanzen im Rahmen. Beleg: „Buzgob's Knobbly Staff"
(`6a95-95ff-7763-bd6d`, Orcs and Goblins) trägt zwei unmodifizierte Grenzen —
`c807-4ad1-4a8d-d2b1` im Eltern-Rahmen und `7bb9-9e7c-920b-9c2a` armeeweit,
beide `max 1`. Der Gegenstand hängt über eine Gruppenkette am Orc Great Shaman.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ein Shaman mit einem Stab | Beide Grenzen eingehalten, der Slot meldet Ist 1 von Höchstmaß 1 |
| 02 | Derselbe Stab mit Stückzahl 2 | Beide Grenzen feuern mit Ist 2 |
| 03 | Ein Stab, dazu ein verschachtelter Unterbaum (Eber, Zauber in Tiefe 2) | Die Tiefe im Rahmen ändert die Zählung nicht: Ist bleibt 1 |
| 04 | Zwei Shamanen mit je einem Stab | Der Eltern-Rahmen zählt je Shaman 1 und schweigt; die armeeweite Zwillingsgrenze feuert mit Ist 2 — beide Kopien werden also gesehen |
| 05 | Zwei Geschwister-Auswahlen desselben Stabs am selben Shaman | `shared="true"`: Ist 2, beide Grenzen feuern |

## `parent-repeat-item-count`

Prüft einen `<repeat>` mit `scope="parent"`, Eintrags-`childId`, `repeats="1"`
und `includeChildSelections="false"` (§7.7/§9.7 der Formatdoku): der gebundene
Modifikator greift einmal je gezählter Kopie im Eltern-Rahmen. Beleg: die
Ogre-Gruppe „Arcane Items" (`4c3e-febe-6d5d-6912`) trägt `max 1`
(`188e-3808-4b37-c8d9`) und einen `increment 1`, dessen `repeat` die gewählten
Dispel Scrolls (`b76c-6bad-4650-dbb0`) zählt. Träger ist ein Butcher im
Kontingent „Standard (OK-AB)".

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Keine arkanen Gegenstände | Basiswert: Höchstmaß 1 |
| 02 | Ein Dispel Scroll | Eine Wiederholung: Höchstmaß 2 |
| 03 | Zwei Dispel Scrolls | Zwei Wiederholungen: Höchstmaß 3 |
| 04 | Zwei andere arkane Gegenstände, kein Scroll | Kein Treffer des `repeat`: Höchstmaß bleibt 1, die Grenze feuert mit Ist 2 |
| 05 | Zwei Scrolls und dieselben zwei Gegenstände | Höchstmaß 3 bei Ist 4 — die Grenze feuert, zwei Wiederholungsschritte über Roster 04 |

## `unconditional-modifier-group`

Prüft die **bedingungslose** `modifierGroup` (§7.7 der Formatdoku): eine
Klammer ohne eigene `<conditions>`, `<conditionGroups>` und `<repeats>` fügt
kein Gatter hinzu — jeder Modifikator darin wirkt genau so, als stünde er in
der eigenen `<modifiers>`-Liste, weiterhin gesteuert von seiner **eigenen**
Bedingung. Belege in Vampire Counts: der Simulacra-`infoLink`
(`3ffe3e73-…`) trägt neben seiner `<modifiers>`-Liste eine bare Klammer mit
vier unbedingten `set`-Modifikatoren; die Blutlinien-Klammer am Vampire Count
(`a106-4a05-36ea-cb01`) ist ebenfalls bedingungslos, ihre fünf Modifikatoren
tragen aber je eine eigene `instanceOf`-Bedingung auf eine Clan-Kategorie.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Simulacra | Die unbedingten Modifikatoren der Klammer greifen: Name und vier Merkmalswerte geändert, die übrigen unberührt |
| 02 | Charnel Guard | Klammer und gewöhnliche `<modifiers>`-Liste am selben Eintrag liefern dasselbe Ergebnis |
| 03 | Vampire Count ohne Blutlinie | Keine der fünf Eigenbedingungen hält: alle Merkmale auf Katalogwert — die Klammer setzt nichts pauschal |
| 04 | Derselbe mit Blutlinie Blood Dragon | Genau die zwei Modifikatoren mit dieser Clan-Bedingung greifen |
| 05 | Derselbe mit Blutlinie Strigoi | Genau die beiden anderen greifen |

## `parent-repeat-model-include-children`

Prüft einen `<repeat>` mit `scope="parent"`, `childId="model"` und
`includeChildSelections="true"` (§7.7/§9.4 der Formatdoku): der gebundene
Kosten-Modifikator greift einmal je gezähltem Modell des Eltern-Rahmens. Beleg:
„Additional Hand Weapon" (`2099-eac8-a45d-b4b6`, Orcs and Goblins, Basis 0 pts)
trägt `increment 2` auf die pts-Kostenart mit genau diesem `repeat`; Träger ist
eine Savage-Orc-Boyz-Einheit im Kontingent „Standard (OG-AB)". Beobachtet wird
die roster-weite Budget-Regel.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | 12 Modelle, Budget 95 | 12 Wiederholungen: Summe 96 — das Budget ist überschritten |
| 02 | Dasselbe bei Budget 96 | Gleichstand feuert nicht — die Summe ist exakt eingeklammert |
| 03 | 13 Modelle, Budget 96 | Ein Modell mehr, ein Schritt mehr: Summe 104 |
| 04 | 12 Modelle mit Zusatz-Schild, Budget 107 | Der Schild trägt denselben `repeat` mit `includeChildSelections="false"`: Summe 108 |
| 05 | Dasselbe bei Budget 108 | Wieder exakt eingeklammert — beide Flag-Varianten liefern im flachen Rahmen denselben Faktor |

## `parent-repeat-item-include-children`

Prüft einen `<repeat>` mit `scope="parent"`, Eintrags-`childId` und
`includeChildSelections="true"` (§7.7/§9.7 der Formatdoku): der gebundene
`increment` greift einmal je gezählter Kopie im Eltern-Rahmen. Beleg: die
Ogre-Gruppe „Arcane Items" (`4c3e-febe-6d5d-6912`) trägt `max 1`
(`188e-3808-4b37-c8d9`) und einen zweiten `increment 1`, dessen `repeat` die
Power Stones (`696a-648d-c842-4c6a`) zählt. Träger ist ein Butcher im
Kontingent „Standard (OK-AB)"; Dispel Scrolls bleiben aus allen Rostern
heraus, damit der Nachbar-`repeat` still bleibt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Kein arkaner Gegenstand | Basiswert: Höchstmaß 1 |
| 02 | Ein Power Stone | Höchstmaß 2 |
| 03 | Zwei Power Stones | Höchstmaß 3 |
| 04 | Zwei andere Gegenstände, kein Stein | Höchstmaß bleibt 1, die Grenze feuert mit Ist 2 |
| 05 | Dieselben zwei plus ein Stein | Grenze 2 bei Ist 3 |
| 06 | Dieselben zwei plus zwei Steine | Grenze 3 bei Ist 4 — die Grenze steigt Schritt für Schritt mit den gezählten Kopien |

## `nested-modifier-group`

Prüft die **verschachtelte** `modifierGroup` (§7.7 der Formatdoku): eine
Klammer innerhalb einer Klammer trägt eigene Bedingungen, und beide Ebenen
verknüpfen sich als Und — die äußere gattert alles darin, die innere nur ihre
eigenen Modifikatoren. Beleg: die `BLOODLINE`-Klammer des „0-1 Vampire Lord"
(`b77b-88d5-5e80-e178`, Vampire Counts) ist selbst unbedingt und enthält fünf
innere Klammern mit je einer Clan-Bedingung. Alle Roster unterscheiden sich nur
in der gewählten Blutlinie.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Keine Blutlinie | Keine innere Bedingung hält: Katalogname und Basiswerte |
| 02 | Blood Dragon | Nur diese innere Klammer greift: Namenszusatz, WS 10, Sv+ 5+ |
| 03 | Strigoi | Nur die andere greift: Namenszusatz, A 6, Sv+ 5+ |
| 04 | Beide Blutlinien | Beide inneren Klammern greifen zugleich (zwei Namenszusätze), und die Gruppengrenze max 1 feuert mit Ist 2 |

Der Fall „innere Bedingung hält, äußere scheitert" ist im Fixture-Korpus nicht
baubar — alle drei verschachtelten Fundstellen haben eine unbedingte äußere
Klammer; das ist in der README des Szenarios als Lücke festgehalten.

## `not-instance-of-force-gate`

Prüft die `notInstanceOf`-Bedingung mit `scope="force"` und `forceEntry`-`childId`
(§7.7 der Formatdoku): sie ist die inverse Identitätsprüfung — sie hält in
**jedem** Kontingent außer dem benannten. Beleg: der Wurzel-`entryLink`
„Ogre Bulls" (`d82e-111e-89b9-2be1`, Ogre Kingdoms) trägt `min 0`
(`32ed-26da-3f27-5c04`), per `set 1` gehoben, sobald das Kontingent **keine**
Instanz von „Ironskin Tribe" (`8711-ed16-2a44-7251`) ist; der Verweis ist in
allen drei Kontingenten sichtbar, seine Untergrenze also prüfbar.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Leeres Kontingent „Standard (OK-AB)" | Die Bedingung hält: Pflicht 1, unerfüllt — die Grenze feuert mit Ist 0 |
| 02 | Leeres Kontingent „Ironskin Tribe" | Die Bedingung hält nicht: der Rohwert `min 0` bleibt, nichts feuert |
| 03 | Leeres Kontingent „Gnoblar Horde" | Ein zweites Nicht-Ironskin-Kontingent: die Pflicht greift auch dort — „jedes andere", nicht „Standard" |
| 04 | „Standard" mit Ogre Bulls | Pflicht erfüllt (Ist 1), nichts feuert |
| 05 | „Ironskin Tribe" mit Ogre Bulls | Untergrenze bleibt 0, nichts feuert |

Beide leeren Roster schließen zugleich eine zählende Lesart aus: eine Zählung
wäre dort 0 und die Grenze bliebe bei 0.

## `roster-repeat-category-count`

Prüft einen `<repeat>` mit `scope="roster"`, Kategorie-`childId`,
`includeChildSelections="true"` und `includeChildForces="true"` (§7.7 der
Formatdoku): der gebundene `increment` greift einmal je gezählter Auswahl
dieser Kategorie — armeeweit, über alle Kontingente. Beleg: „Orc Big 'Uns"
(`eeb1-a6c4-b57e-f08c`, Orcs and Goblins) trägt `max 0`
(`938b-15b1-f433-e0d5`) und einen `increment 1`, dessen `repeat` die Kategorie
„Orc boyz" (`344f-77ef-7238-f157`) zählt; deren einziger Träger im Datensatz
ist die Wurzeleinheit Orc Boyz.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ein Big 'Uns, keine Orc Boyz | Höchstmaß 0 — die Grenze feuert mit Ist 1 |
| 02 | Ein Big 'Uns, eine Orc-Boyz-Einheit | Eine Wiederholung: Höchstmaß 1, still |
| 03 | Zwei und zwei | Zwei Wiederholungen: Höchstmaß 2, still |
| 04 | Drei Big 'Uns, zwei Orc Boyz | Höchstmaß 2 bei Ist 3 — die Grenze feuert |
| 05 | Dieselbe Lage, aber die zwei Orc Boyz als **eine** Auswahl mit Stückzahl 2 | Gleiches Ergebnis: gezählt wird die Stückzahl, nicht die Zahl der XML-Elemente |
| 06 | Big 'Uns im ersten, Orc Boyz im zweiten Kontingent | Höchstmaß 2 — `includeChildForces="true"` zählt über Kontingente hinweg |

## `roster-scope-mandatory-chariot`

Prüft eine armeeweite Untergrenze (`min`, `scope="roster"`, `shared="true"`,
`includeChildSelections="false"`, `includeChildForces="false"`), deren
geschriebener Wert 0 ist und die erst ein wiederholter `increment` hebt: „Orc
Boar Chariot" (`5678-6ad3-0e79-2233`, Orcs and Goblins) trägt die Grenze
`1d06-5b8c-0443-5979` und einen `increment 1`, dessen `<repeat>` armeeweit die
Merkmals-Kategorie „orc needs chariot" (`a85e-af08-5fea-41bd`) zählt. Deren
einziger Träger ist die Reittier-Option „Chariot" (`5cc1-2650-9e36-3c62`) in
der Mounts-Gruppe des Orc Bigboss — ein Charakter auf Streitwagen macht also
je Exemplar eine Streitwagen-Einheit zur Pflicht.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Bigboss ohne Reittier | Untergrenze bleibt 0 — nichts feuert |
| 02 | Bigboss auf „Boar" | Das Geschwister-Reittier trägt die Kategorie nicht — nichts feuert |
| 03 | Bigboss auf „Chariot", keine Streitwagen-Einheit | Untergrenze 1 bei Ist 0 — die Grenze feuert |
| 04 | Wie 03, mit einer Streitwagen-Einheit | Pflicht erfüllt (Ist 1) — still |
| 05 | Zwei Bigbosse auf „Chariot", keine Einheit | Zwei Wiederholungen: Untergrenze 2 bei Ist 0 |
| 06 | Wie 05, mit einer Einheit | Untergrenze 2 bei Ist 1 — die Grenze feuert weiter |
| 07 | Wie 05, mit zwei Einheiten | Pflicht erfüllt (Ist 2) — still |

## `parent-min-unshared-unit-size`

Prüft eine Mindeststärke als `min`-Grenze mit `scope="parent"` und
`shared="false"`: gezählt wird **nur die eine Einheiten-Instanz**, die die
Grenze trägt, nie die roster-weite Summe desselben Modell-Eintrags. Beleg: das
Modell „Goblin" (`ec2d-a00e-8ff8-1dff`, Orcs and Goblins) trägt
`min 20` (`7156-0a0f-aa05-582a`) unter der Einheit „Goblins"
(`b403-b7c6-0008-27d9`); dasselbe Muster mit `min 5` trägt der „Goblin Wolf
rider" (`e603-749c-713c-3d36`).

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Eine Einheit mit genau 20 Modellen | Mindeststärke erfüllt — still |
| 02 | Eine Einheit mit 15 Modellen | Eine Meldung: Ist 15 gegen Grenze 20 |
| 03 | Eine Einheit mit 25 Modellen | Mindeststärke übererfüllt — still |
| 04 | **Zwei** Einheiten mit je 15 Modellen | **Zwei** Meldungen mit je Ist 15 — die Summe 30 rettet keine der beiden |
| 05 | Eine Einheit mit 20, eine mit 15 Modellen | Genau eine Meldung — die Instanzen werden getrennt beurteilt |
| 06 | Zwei Wolfsreiter-Einheiten mit je 3 Modellen | Dasselbe Muster an einer zweiten Einheit: zwei Meldungen, Ist 3 gegen Grenze 5 |

## `condition-group-and-nested`

Prüft eine **verschachtelte** `and`-Gruppe: sie hält nur, wenn **jedes** ihrer
Mitglieder hält — die eigene Bedingung ebenso wie die eigene Untergruppe —, und
die umschließende Gruppe sieht davon nur dieses eine Urteil. Beleg: der
Umschalter „Tournament rules: Uprising (2026)" (`4bc4-8781-2091-d9df`, Orcs and
Goblins) trägt einen `add error`-Modifikator, dessen äußere `or`-Gruppe genau
ein Mitglied hat — eine `and`-Gruppe aus einer `instanceOf`-Bedingung auf das
Kontingent „Standard (OG-AB)" und einer eigenen `or`-Untergruppe aus zwei
armeeweiten Zählungen (`greaterThan 1`) auf „Savage Orc Boar Big 'Uns" bzw.
„Stone Trolls".

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Standard-Kontingent, Umschalter, zwei Big 'Uns | Die Autor-Meldung erscheint |
| 02 | Standard-Kontingent, Umschalter, zwei Stone Trolls | Dasselbe über das zweite Mitglied der Untergruppe |
| 03 | Standard-Kontingent, Umschalter, je eines | Keine Meldung — die Untergruppe hält nicht, also hält die `and`-Gruppe nicht |
| 04 | „Savage Orc Horde", Umschalter, zwei Big 'Uns | Keine Meldung — die Untergruppe hält, die eigene Bedingung nicht: der Beweis der Konjunktion |
| 05 | Standard-Kontingent **ohne** Umschalter, zwei Big 'Uns | Keine Meldung — der Träger des Modifikators liegt gar nicht in der Liste |

## `category-id-scope-instance-of`

Prüft die **Condition**-Ausprägung des Kategorie-Rahmens: Nennt der `scope`
einer Bedingung eine **Kategorie-Id**, ist der Bezugsrahmen der nächste
Vorfahre der tragenden Auswahl — sie eingeschlossen —, der diese Kategorie
trägt. Eine Kategorie, die nur ein **Nachfahre** trägt, löst den Rahmen nicht
auf, und ein nicht aufgelöster Rahmen lässt den gegatterten Modifikator nicht
greifen. Beleg: der `infoLink` `e0f2-8568-15f0-a384` des „Vampire Lord"
(`b77b-88d5-5e80-e178`, ergofang-Katalog *Vampire Counts*) trägt drei
Merkmals-Modifikatoren, deren `scope` je eine Blutlinien-Kategorie benennt
(Blood Dragon `4cae-a20e-8374-b6cb` +2 WS, Necrach `fc4b-a86d-5897-9e4c`
−2 WS, Strigoi `bf30-4ff0-a4d8-3909` +1 A) — während die Kategorien selbst an
den Blutlinien-Optionen **unterhalb** der Einheit hängen. Das Szenario ist
zugleich der erste Fall des Katalogs auf dem ergofang-Fixture-Satz.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Vampire Lord ohne Blutlinie | Grundwerte WS 8 / A 5; die unbesetzte Pflicht-Gruppe meldet Ist 0 gegen Grenze 1 |
| 02 | Mit Blutlinie „Blood Dragon" | WS bleibt 8 — die Kategorie liegt unterhalb der Einheit, nicht darüber |
| 03 | Mit Blutlinie „Strigoi" | A bleibt 5 — dasselbe an der verschachtelten Modifikator-Klammer |
| 04 | Mit Blutlinie „Necrach" | WS bleibt 8 statt 6 — die Gegenrichtung, eine Fehl-Lesart fiele hier nach unten aus |
| 05 | Beide Blutlinien zugleich (regelwidrig) | Die Gruppen-Obergrenze meldet Ist 2 gegen Grenze 1; die Merkmale bleiben WS 8 / A 5 |

## `roster-repeat-added-category`

Prüft einen `repeat` mit `scope="roster"` und einer **Kategorie-Id** in
`childId`: er wiederholt seinen Modifikator einmal je passender Auswahl im
ganzen Roster — und zählt eine Kategorie, die eine Auswahl erst zur Laufzeit
per `add category` erhält, genauso wie eine per `categoryLink` getragene. Beleg:
die Obergrenze der „Gnoblars" (`a177-82fc-0b76-5b73`, Ogre Kingdoms) steht
geschrieben auf 0 und steigt je Ogerbullen-Einheit um 1; die Kategorie
„Bully Bully" (`735e-2da1-6356-2fdb`) hat im ganzen Datensatz **keinen**
`categoryLink` — ihr einziger Träger ist der Wurzel-`entryLink` „Ogre Bulls"
(`d82e-111e-89b9-2be1`) mit einem unbedingten `add category`.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Eine Gnoblar-Einheit, **keine** Ogerbullen | Obergrenze 0 — eine Meldung Ist 1; zugleich die verletzte Ogerbullen-Pflicht |
| 02 | Eine Ogerbullen-, eine Gnoblar-Einheit | Obergrenze 1 — still |
| 03 | Eine Ogerbullen-, zwei Gnoblar-Einheiten | Eine Meldung: Ist 2 gegen Grenze 1 |
| 04 | **Zwei** Ogerbullen-, zwei Gnoblar-Einheiten | Obergrenze 2 — still: die zweite Wiederholung wirkt |
| 05 | Zwei Ogerbullen-, drei Gnoblar-Einheiten | Eine Meldung: Ist 3 gegen Grenze 2 |
| 06 | Zwei Gnoblar-Späher, keine Ogerbullen | Dasselbe Muster an der zweiten Einheit: Ist 2 gegen Grenze 1 |
| 07 | Eine Ogerbullen-Einheit, zwei Gnoblar-Späher | Obergrenze 2 — still |

## `less-than-parent-parry-save`

Prüft die `lessThan`-Bedingung mit `scope="parent"` und einer Eintrags-Id in
`childId` — die „diese Option ist **nicht** gewählt"-Hälfte eines Gatters, die
in dem Moment aufhört zu halten, in dem die Option erscheint. Beleg: das
Zwergen-Profil der Mercenaries (`c69e-8fe4-ad3d-3b7d`) schreibt `Sv` 6 und trägt
neben den Rüstungs-Abzügen einen `decrement 1`, dessen `and`-Gruppe aus
„weniger als 1 Zweihandwaffe" (`1eb7-3f36-8cf7-e0ba`) **und** „mindestens 1
Schild" besteht — die Parier-Regel. Gemessen wird an zwei Paaren, die sich
allein in der Zweihandwaffe unterscheiden.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Zwergen-Einheit ohne Ausrüstung | Rüstungswurf 7 — nur der unbedingte Aufschlag greift |
| 02 | Mit Schild, **ohne** Zweihandwaffe | Rüstungswurf 5 — Schild und Parieren zählen |
| 03 | Mit Schild **und** Zweihandwaffe | Rüstungswurf 6 — der Parier-Punkt entfällt |
| 04 | Leichte Rüstung + Schild, ohne Zweihandwaffe | Rüstungswurf 4 — dasselbe Paar, katalogkonform gebaut |
| 05 | Leichte Rüstung + Schild + Zweihandwaffe | Rüstungswurf 5 — der Parier-Punkt entfällt erneut |

## `parent-costsum-magic-items-budget`

Prüft eine Grenze, deren `field` eine **Kostenart-Id** statt `selections` ist:
sie begrenzt die **Summe** dieser Kosten unterhalb ihres Trägers, und mit
`includeChildSelections="true"` zählen auch verschachtelte Auswahlen mit. Beleg:
die Gruppe „Magic Items and Big Names" des Hunters (`9326-f5c9-9e82-f4bf`, Ogre
Kingdoms) trägt `max 50` auf die Punkte-Kostenart
(`2dd3-546b-146e-ce63`). Der gemeldete Ist-Wert ist die Punktesumme, nicht die
Anzahl der Gegenstände.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Zwei Gegenstände für zusammen 30 Punkte | Deutlich unter dem Budget — still |
| 02 | Zwei Gegenstände für genau 50 Punkte | Auf der Grenze erfüllt — still |
| 03 | Zwei Gegenstände für zusammen 55 Punkte | Eine Meldung: Ist 55 gegen Grenze 50 — erst die Summe reißt sie |
| 04 | Gegenstand mit drei verschachtelten Steinen, zusammen 65 Punkte | Eine Meldung: Ist 65 — genau das entscheidet `includeChildSelections` |
| 05 | Derselbe Aufbau mit zwei Steinen, zusammen 50 Punkte | Still — die Gegenprobe klammert den Beitrag der verschachtelten Auswahl ein |

## `decrement-cost-bloodline-casting-dice`

Prüft einen `decrement`-Modifikator, dessen `field` eine **Kostenart-Id** ist:
er senkt diese Kosten der tragenden Auswahl um seinen Wert, und die gesenkten
Kosten sind es, die das Roster-Budget dieser Kostenart zählt. Beleg: „Wizard
level 2" (`42d9-cebe-18d5-cdbd`, ergofang *Vampire Counts*) kostet geschrieben
2 Zauberwürfel (`fcec-2340-6368-a2ba`) und trägt einen `decrement 1`, dessen
Bedingung die Blutlinie **Blood Dragon** unterhalb des Vampirs zählt
(`scope="parent"`, `includeChildSelections="true"`) — dieselbe Kategorie, an der
die Profil-Modifikatoren derselben Einheit scheitern, hier aber in der Form, die
den Rahmen auflöst.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Zauberstufe 2 unter Strigoi, Würfel-Budget 1 | Kein Rabatt: Ist 2 gegen Grenze 1 |
| 02 | Dieselbe Stufe unter Blood Dragon, Budget 1 | Rabatt greift — still |
| 03 | Wie 02, Budget 0 | Ist 1 gegen Grenze 0 — nagelt die verbilligte Summe auf genau 1 |
| 04 | Zauberstufe 3 unter Strigoi, Budget 2 | Zweiter Zeuge mit anderem Grundwert: Ist 3 gegen Grenze 2 |
| 05 | Zauberstufe 3 unter Blood Dragon, Budget 2 | Still — ein Abzug, kein Setzen auf 1 |
| 06 | Wie 05, Budget 1 | Ist 2 gegen Grenze 1 — dieselbe Klammer ohne Null-Budget |
| 07 | Zwei Vampire, nur einer Blood Dragon, Budget 1 | Ist 2 — der Rabatt gilt je Auswahl, nicht armeeweit |
| 08 | Dieselben zwei, beide Blood Dragon, Budget 1 | Still — die Gegenprobe zu 07 |

## `modifier-unresolved-target-inert`

Prüft einen Modifikator, dessen `field` einen Bezeichner nennt, den der geladene
Datensatz **nirgends** definiert — weder als `constraint`, noch als Kostenart,
noch als Merkmalstyp. Er bleibt vollständig wirkungslos: er erzeugt keine eigene
Grenze, verschiebt keine fremde und stört die Auswertung seiner Nachbarn nicht.
Beleg: die vier mit „Swedish Comp System" kommentierten Modifikatoren des
Orcs-and-Goblins-Katalogs zeigen auf `ce6e-afde-2ed1-aac2` — einen unbedingten
`decrement` an den „Fanatics" (`18f4-ad33-69ca-e327`) und drei bedingte
`increment` an den „Night Goblins" (`79af-55cb-9761-f0be`). Damit „nichts
passiert" von „nichts wurde ausgewertet" unterscheidbar bleibt, zeigen zwei
Roster einen **echten** Modifikator derselben Einheit bei der Arbeit.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | 20 Modelle, 5 Netter, 3 Fanatics — alle Grenzen exakt eingehalten | Der unbedingte haltlose Modifikator wirkt nicht; nur das Punktebudget meldet sich |
| 02 | Derselbe Aufbau mit 15 Fanatics | Die erste bedingte Gruppe hält — die Nachbargrenzen bleiben unverändert |
| 03 | Dieselbe Einheit mit 45 Fanatics | Alle drei bedingten Gruppen halten zugleich — dieselben Werte wie bei 02 |
| 04 | 20 Modelle, 6 Netter, keine Fanatics | Gegenprobe: die Netter-Grenze **wird** von einem echten Modifikator auf 5 gehoben und meldet Ist 6 |
| 05 | 24 Modelle, 6 Netter, 15 Fanatics | Beide Hälften in einem Roster: Netter-Grenze 6, exakt eingehalten |

## `modifier-group-repeats`

Prüft die `<repeats>`-Liste an einer **Modifikator-Klammer** (`modifierGroup`,
§7.7 der Formatdoku, Issue 0116) — und vor allem, wie **mehrere** `<repeat>` in
**einer** Liste zusammenwirken: ihre Anwendungen **addieren** sich, sie
multiplizieren sich nicht. Beleg: „Grave markers" (`f899-4fbd-db93-629e`,
Vampire Counts) trägt `min 2` (`5c4a-c8ea-073d-909c`) und `max 2`
(`1b4e-3003-8b78-4be6`), beide `scope="parent"`; die Klammer erhöht je Anwendung
beide um 1 und zählt dabei mit dem einen `<repeat>` die Vampire Counts
(`6822-0110-a7c9-cbb0`) und mit dem anderen die „0-1 Vampire Lord"
(`b77b-88d5-5e80-e178`) im Kontingent. Erwartete Grenze = 2 + Counts + Lords;
eine multiplizierende Lesart ergäbe 2 + Counts × Lords und fällt in den Rostern
04–08 auf.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Keine Vampire, 2 Grave markers | Keine Wiederholung: beide Grenzen bleiben bei 2, Ist 2 liegt genau dazwischen — still |
| 02 | Keine Vampire, 3 Grave markers | Die Obergrenze steht unverändert auf 2 und feuert mit Ist 3 |
| 03 | Keine Vampire, 1 Grave marker | Die Untergrenze steht unverändert auf 2 und feuert mit Ist 1 |
| 04 | Ein Vampire Count, kein Lord, 3 Marker | Addierend eine Anwendung: beide Grenzen 3, exakt erlaubt — multiplizierend wäre die Obergrenze bei 2 geblieben und hätte angeschlagen |
| 05 | Ein Vampire Count, kein Lord, 2 Marker | Die Untergrenze steht auf 3 und feuert mit Ist 2 — multiplizierend schwiege sie ganz |
| 06 | Ein Vampire Count, kein Lord, 4 Marker | Die Obergrenze steht auf 3 und feuert mit Ist 4; die gemeldete Grenze unterscheidet die Lesarten auch im Verletzungsfall |
| 07 | Zwei Counts und ein Lord, 5 Marker | Addierend drei Anwendungen: beide Grenzen 5, exakt erlaubt |
| 08 | Zwei Counts und ein Lord, 4 Marker | Die Untergrenze steht auf 5 und feuert mit Ist 4 — multiplizierend läge sie bei 4 und schwiege |
| 09 | Dieselbe Rechnung im Kontingent „Clan Von Carstein (VC-AB)" | Der Träger bleibt dort verborgen; Höchstgrenzen gelten unabhängig von der Sichtbarkeit und die Obergrenze feuert wie in Roster 02 |

## `condition-group-or-nested`

Prüft eine **verschachtelte** `conditionGroup type="or"` (§7.7 der Formatdoku):
sie hält, sobald **mindestens eines** ihrer Mitglieder hält — sie ist kein
„und", keine Summe über ihre Mitglieder und kein „entweder oder". Beleg: der
`add error`-Modifikator an „Tournament rules: Uprising (2026)"
(`4bc4-8781-2091-d9df`, Orcs and Goblins) trägt einen drei Ebenen tiefen
Bedingungsbaum — eine äußere `or`-Gruppe über einer `and`-Gruppe, die einerseits
`instanceOf` auf das Kontingent „Standard (OG-AB)" (`2bfa-e64a-7123-895f`)
verlangt und andererseits **diese** innere `or`-Gruppe, deren zwei Mitglieder je
`greaterThan 1` armeeweit zählen: „Savage Orc Boar Big 'Uns"
(`c679-3389-ca76-2ea1`) und „Stone Trolls" (`4112-026b-500a-b6fd`). Alle Roster
stehen im selben Kontingent, sodass die `instanceOf`-Hälfte konstant hält und
die beobachtete Autor-Meldung der reine Wahrheitswert der inneren Gruppe ist.
Das Budget von 2000 Punkten hält das Sichtbarkeits- und Grenzen-Gatter des
Trägers offen, sodass dessen eigene Grenze (`00f6-c1b3-ee85-5c02`) in keinem
Roster dazwischenfunkt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Zwei Big 'Uns, keine Stone Trolls | Ein einzelnes haltendes Mitglied genügt: die Meldung liegt an — eine „und"-Lesart schwiege hier |
| 02 | Keine Big 'Uns, zwei Stone Trolls | Dieselbe Meldung über das **zweite** Mitglied — es wird nicht nur das erste gelesen |
| 03 | Je eines von beiden | **Keine** Meldung: kein Mitglied hält für sich; eine summierende Lesart (1+1 > 1) meldete hier fälschlich |
| 04 | Zwei und zwei | Genau **eine** Meldung: beide Mitglieder halten — kein „entweder oder", und die Meldung wird nicht je Mitglied wiederholt |
| 05 | Ein einzelnes Big 'Uns | **Keine** Meldung: `greaterThan 1` ist nicht `atLeast 1` |
| 06 | Keine der beiden Einheiten | **Keine** Meldung: „kein Mitglied hält" ist nicht leer-wahr |

## `category-scope-ancestor-frame`

Prüft, was der `scope` einer Grenze bedeutet, wenn er eine **Kategorie-Id**
nennt: der Bezugsrahmen ist der nächste **Vorfahre** der tragenden Auswahl (den
Träger eingeschlossen), der diese Kategorie trägt — **kein** armeeweiter Rahmen.
Beleg: die auf „Strigoi" skopierte Reittier-Sperre `6afc-566e-34d4-d35c` des
Master Necromancer (Vampire Counts) kann daher nie feuern, denn kein Vorfahre
seiner Gruppe „Mounts" trägt die Kategorie Strigoi — auch dann nicht, wenn im
selben Kontingent ein Strigoi-Vampir steht. Damit „schweigt" nicht mit „wird gar
nicht gezählt" verwechselt werden kann, belegt die `parent`-skopierte
Gruppengrenze `7e5f-f372-f244-a864` derselben Gruppe im Gegenzug, dass die
Gruppe sehr wohl gezählt wird.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Master Necromancer mit genau einem Reittier | Der Kategorie-Rahmen löst nicht auf: die Strigoi-Sperre schweigt, die Gruppengrenze ist eingehalten |
| 02 | Wie 01, zusätzlich ein Strigoi-Vampir im selben Kontingent | Der Strigoi ist Geschwister, nicht Vorfahre: die Sperre schweigt weiter — eine armeeweite Lesart schlüge hier an |
| 03 | Derselbe Necromancer mit **zwei** Reittieren | Die `parent`-skopierte Gruppengrenze feuert mit Ist 2 / Grenze 1 — die Gegenprobe, dass überhaupt gezählt wird |
| 04 | Strigoi im Kontingent **und** zwei Reittiere | Schärfster Kontrast: die Gruppengrenze feuert, die Strigoi-Sperre bleibt still |

## `condition-group-not`

Prüft die `conditionGroup type="not"` als **Negation**: sie hält genau dann,
wenn **keines** ihrer Mitglieder hält (§7.7 der Formatdoku, Issue 0115). Beleg
ist das einzige reale Vorkommen im Datensatz — der `set`-Modifikator, der im
Kontingent „Army of the Lichemaster" die Pflicht-Untergrenzen von Heinrich
Kemmler (`8461-3eab-e5ac-1636`) und Krell (`60a8-5b49-6b81-7c84`) von 0 auf 1
hebt. Sein Wächter ist eine `and`-Gruppe aus (a) `instanceOf` auf das Kontingent
`f37a-a93e-fa22-61a8` und (b) einer `not`-Gruppe über genau einer
`and`-Untergruppe (Punktelimit < 2000 **und** mindestens eine Kampagnen-Auswahl
`14fb-dd39-08e7-cbde` im Kontingent). Die Roster variieren Budget,
Kampagnen-Auswahl und Kontingent so, dass jede Fehl-Lesart der Negation sichtbar
wird.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Leeres Lichemaster-Kontingent, 3000 Punkte | Die innere Untergruppe scheitert doppelt, die Negation hält: beide Pflichtgrenzen stehen auf 1 und feuern mit Ist 0 |
| 02 | Wie 01, aber Kemmler und Krell gewählt | Die Pflicht gilt weiter und ist erfüllt — die Gegenprobe, dass die Stille in 03/06 nicht „gar nicht ausgewertet" heißt |
| 03 | 1500 Punkte **und** Kampagnen-Auswahl | Beide Mitglieder halten, die Negation hält **nicht**: der Modifikator greift nicht, beide Grenzen bleiben bei 0 und schweigen |
| 04 | 1500 Punkte, **ohne** Kampagnen-Auswahl | Nur eine Hälfte hält: die Negation hält, beide Pflichtgrenzen feuern — das Budget allein schaltet die Pflicht nicht ab |
| 05 | 3000 Punkte **mit** Kampagnen-Auswahl | Die andere Hälfte: die Negation hält, beide Pflichtgrenzen feuern — auch die Kampagnen-Auswahl allein schaltet sie nicht ab |
| 06 | Leeres Kontingent „Clan Von Carstein (VC-AB)", 3000 Punkte | Schon das `instanceOf` scheitert: der Modifikator greift unabhängig von der Negation nicht, beide Grenzen schweigen |

## `greater-than-force-unlimited-gate`

Prüft die `greaterThan`-Bedingung mit `scope="force"` und Eintrags-`childId`
(§7.7 der Formatdoku) zusammen mit dem Sentinel `-1` (§7.6): Die Bedingung hält,
sobald das Kontingent **echt mehr** Auswahlen des benannten Eintrags führt als
ihr `value`. Beleg: der „Slaughtermaster" (`0ff3-ec4d-1c6b-6d53`, Ogre Kingdoms)
trägt `max 0` armeeweit (`c70d-c292-36ee-21b5`) — er ist also zunächst gar nicht
wählbar — und einen `set -1` auf genau diese Grenze, gegated auf
`greaterThan value="0"` über den „Tyrant" (`2679-58f4-1771-662d`) im Kontingent.
Ein Tyrant öffnet damit das Tor, und der geschriebene `-1` bedeutet
**unbegrenzt**, nicht „eins". Alle Roster stehen im Kontingent
„Standard (OK-AB)", damit die auf das Ironskin-Kontingent gegatterte
Verbergung nicht dazwischenfunkt; die armeeweite Pflichteinheit ist überall
erfüllt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Kein Tyrant, ein Slaughtermaster | Das Tor bleibt zu: die Grenze steht auf 0 und feuert mit Ist 1; der Slot meldet ein Höchstmaß von 0 und ist gesperrt |
| 02 | Ein Tyrant, ein Slaughtermaster | Das Tor öffnet: die Grenze schweigt, der Slot meldet **eine** Auswahl bei aufgehobenem Höchstmaß |
| 03 | Ein Tyrant, zwei Slaughtermaster in **einer** Selektion | Trennt „unbegrenzt" von einer still als 1 gelesenen Kappe: die Grenze schweigt weiter, der Slot meldet **zwei** Auswahlen |
| 04 | Dieselbe Zahl als **zwei** Selektionen | Dieselbe armeeweite Summe in der anderen Kodierung — die Grenze schweigt |

> **Offene Lücke (Kampagne).** Die Roster 02 und 03 sind rot: der belegte Slot
> meldet dort **null** Auswahlen statt einer bzw. zweier, obwohl Roster 01 mit
> derselben Behauptung grün ist. Die Zählung geht also genau dann verloren, wenn
> die Obergrenze auf „unbegrenzt" gehoben wurde. Das Gatter selbst wertet die
> Engine in allen vier Rostern korrekt aus.

## `at-most-roster-points-limit`

Prüft die `atMost`-Bedingung auf dem **eingestellten Punktebudget**
(`limit::ecfa-8486-4f6c-c249`, `scope="roster"`, `childId="any"`) — die
Geschwisterhälfte des bereits gepinnten `atLeast 2000` am „Tournament rules:
Uprising (2026)" (`4bc4-8781-2091-d9df`, Orcs and Goblins). Sie liest das
**Budget**, nicht die verplante Summe, und schließt ihren Grenzwert **ein**.
Alle vier Roster tragen denselben Inhalt — eine Uprising-Selektion, Ist also
konstant 1 —, sodass sich nur das Budget ändert; die `atLeast`-Hälfte hält
überall, der Umschlag ist damit allein der `atMost`-Hälfte zuzurechnen.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Budget 2500 — der Grenzwert selbst | Eingeschlossen: das Tor bleibt offen, die eigene Grenze schweigt, der Slot meldet Höchstmaß 1 |
| 02 | Budget 2501 — ein Punkt darüber | Das Tor kippt: die Basisgrenze 0 feuert mit Ist 1, der Slot ist gesperrt |
| 03 | Budget 3000 | Dasselbe Urteil deutlich außerhalb — kein Ein-Punkt-Artefakt |
| 04 | Budget 2500, verplante Summe 3000 | Die Bedingung liest das Budget, nicht die Summe: das Tor bleibt offen, während das Roster-Budget selbst als überschritten meldet |

## `at-least-parent-any-reveal`

Prüft die `atLeast`-Bedingung mit `scope="parent"` und `childId="any"` (§7.6/§7.7
der Formatdoku): Sie zählt im **Eltern-Rahmen** des Trägers die Auswahlen von
**irgendetwas** und hält, sobald dort mindestens eine steht. Beleg: der „Wolf
Lord" (`66bc-8fc1-81a2-9cd4`, Vampire Counts) ist `hidden="true"` und trägt
genau **einen** Modifikator — `set hidden="false"`, allein auf diese Bedingung
gegated. Er hängt vier Gruppenebenen unter dem Vampir; Gruppen sind in einer
`.ros` keine Auswahlen, der Rahmen ist also die umschließende Einheiten-Auswahl
(hier ein Vampire Thrall). Die Blutlinie „Von Carstein" steht in allen Rostern,
damit das Gatter der umschließenden Gruppe konstant bleibt und sich nur der
Rahmeninhalt ändert.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Thrall ohne jede Unterauswahl | Der Rahmen zählt 0: die Bedingung hält nicht, die Option bleibt verborgen |
| 02 | Nur die Pflicht-Handwaffe darunter | Der Rahmen zählt 1: die Option wird sichtbar — obwohl in ihrer eigenen Gruppe nichts gewählt ist |
| 03 | Zusätzlich eine Great Weapon | Der Rahmen zählt 2: `atLeast` heißt „mindestens", mehr verhält sich exakt wie eines |
| 04 | Wolf Lord selbst gewählt | Der Träger zählt im eigenen Rahmen mit — das Aufdecken trägt sich selbst; seine Obergrenze 1 ist bei Ist 1 exakt eingehalten |
| 05 | Wolf Lord mit Stückzahl 2 | Die Obergrenze feuert mit Ist 2 / Grenze 1 — Höchstgrenzen gelten unabhängig von der Sichtbarkeit |

> **Offene Lücke (Kampagne).** Die Roster 01–03 sind rot: der Bericht führt für
> die **ungewählte** Option überhaupt keinen Angebots-Anker, sodass ihre
> Sichtbarkeit gar nicht beobachtbar ist. Dasselbe Verweis-/Ziel-Paar löst in
> den Rostern 04 und 05 als belegter Anker auf, und ein Nachbarszenario zeigt
> den Angebots-Anker einer ungewählten Option an flacherer Stelle. Ohne diesen
> Anker wird dem Nutzer die Option nie angeboten.

> **Nicht abgedeckt:** das zweite Vorkommen der Zelle, „From Death Awakened"
> (`c791-87b9-b00a-ddb4`). Kein `entryLink` zeigt darauf und es ist kein
> Inline-Kind einer Gruppe — kein Roster kann es in einen legalen Eltern-Rahmen
> stellen.

## `less-than-unit-wizard-level-gate`

Prüft die `lessThan`-Bedingung mit `scope="unit"` und einer Eintrags-`childId`
(§7.7 der Formatdoku, Kasten *`scope="unit"`*): Sie zählt in der **umschließenden
Einheit** die Auswahlen des benannten Eintrags — `includeChildSelections="true"`,
also auch verschachtelte — und hält, solange deren Zahl unter dem Wert liegt.
Beleg: der `entryLink` „Magic Level 3" (`9dc7-b9d7-4e92-4cda`, Vampire Counts)
trägt eine `modifierGroup type="and"`, deren `and`-Bedingungsgruppe aus genau
zwei Gliedern besteht — `lessThan 1` auf „Magic Level 4"
(`fc28-3af2-d37a-d07e`) und `atLeast 1` auf „Nehekhara's Noble Blood"
(`32d0-a151-94a3-aa54`). Greift die Klammer, hebt sie die **eigene**
Mindestgrenze des Verweises (`4d5e-8101-e8d4-d7ad`) von 0 auf 1. Die Noble-Blood-
Auswahl steht in allen Rostern, sodass sich allein das erste Glied ändert.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Vampire Lord mit Noble Blood, kein Magic Level 4 | Die Einheit zählt 0: die Bedingung hält, die Pflichtgrenze des leeren Slots feuert mit Ist 0 / Grenze 1 |
| 02 | Derselbe Lord zusätzlich mit Magic Level 4 | Die Einheit zählt 1: die Bedingung kippt, die Klammer greift nicht, die Mindestgrenze schweigt |
| 03 | Magic Level 3 selbst gewählt, kein Magic Level 4 | Derselbe Umschlag am **besetzten** Slot: die gehobene Pflicht ist bei Ist 1 erfüllt und schweigt |
| 04 | Magic Level 3 **und** Magic Level 4 gewählt | Die Klammer greift nicht mehr; zugleich feuert die Obergrenze der Gruppe „Wizard Level" mit Ist 2 / Grenze 1 |
| 05 | Vampire Count mit Noble Blood, kein Magic Level 3 | Dieselbe Form am zweiten Vorkommen: die Pflichtgrenze des Slots „Magic Level 2" feuert mit Ist 0 / Grenze 1 |
| 06 | Derselbe Count zusätzlich mit Magic Level 3 | Die Bedingung kippt, die Mindestgrenze schweigt |

> **Nicht abgedeckt:** der zweite Modifikator derselben Klammer (`set` der
> pts-Kosten des Verweises von 50 auf 0) — der Bericht führt Grenzen, keine
> Stückpreise. Ebenso wenig `unit` gegen `parent`: die Gruppe hängt direkt an
> der Einheit, beide Rahmen fallen hier zusammen.

## `not-instance-of-unit-category-gate`

Prüft die `notInstanceOf`-Bedingung mit `scope="unit"` und einer
**Kategorie**-`childId` (§7.7 der Formatdoku): Sie zählt nicht, sondern prüft
Mitgliedschaft — sie hält genau dann, wenn die umschließende Einheit die
benannte Kategorie **nicht** führt. Beleg: in der geteilten Gruppe „Magic
Weapons (VC)" (`bf27-6ca6-5c3a-3449`, Vampire Counts) trägt der „Blood Drinker"
(`8427-3c8d-f4af-8af3`) einen `set hidden="true"`, allein gegated auf
`notInstanceOf` gegen die Kategorie „Vampire" (`017d-3857-a815-782f`), und das
„Sword of the Kings " (`2749-9013-530a-a980`) denselben Modifikator gegen die
Kategorie „Wight" (`5c44-3a90-6b26-bc32`). Zwei Einheiten derselben Gruppe
kreuzen die Polarität: der „Wight Lord" führt Wight und nicht Vampire, der
„Vampire Count" Vampire und nicht Wight.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Wight Lord, im Magic-Baum nichts gewählt | Das Schwert ist sichtbar, der Blood Drinker verborgen; drei Kontroll-Gegenstände zeigen, dass der Rahmen selbst nichts verbirgt |
| 02 | Vampire Count, im Magic-Baum nichts gewählt | Exakt gespiegelt: Blood Drinker sichtbar, Schwert verborgen |
| 03 | Wight Lord mit dem Schwert | Am besetzten Slot bleibt das Urteil dasselbe |
| 04 | Vampire Count mit dem Blood Drinker | Gespiegelt am besetzten Slot |
| 05 | Wight Lord mit dem Schwert, Stückzahl 2 | Die Sichtbarkeit hängt nicht an der Stückzahl; die beiden eigenen Höchstgrenzen des Verweises feuern mit Ist 2 / Grenze 1 |
| 06 | Vampire Count mit dem Blood Drinker, Stückzahl 2 | Dasselbe gespiegelt, mit der einen Höchstgrenze dieses Verweises |

> **Nicht abgedeckt:** `notInstanceOf` gegen eine Definitions-Id oder ein
> Typ-Schlüsselwort und die Zählflaggen — beide Vorkommen der Zelle benennen
> eine Kategorie und tragen `shared="true"` ohne `includeChildSelections`.
> Ebenso wenig, ob die Kategorie aus dem Katalog stammt oder in der `.ros`
> zwischengespeichert ist; das trennt das Nachbarszenario
> `unit-scope-instance-of-category`.

## `add-info-and-warning-campaign-gate`

Prüft die beiden Autor-Meldungen `add info` und `add warning` (§7.7 der
Formatdoku): Ein solcher Modifikator trägt keinen Feldwert, sondern einen
Klartext-Hinweis an den Spieler, und erreicht den Bericht genau dann, wenn seine
Bedingungen halten. Beleg: die „0-1 Amazon Serpent Priestess"
(`9ddd-69c8-644d-abc2`, Mercenaries) trägt beide — und sie hängen an den
**komplementären** Hälften desselben Schalters, des `.gst`-Eintrags „Campaign: A
Dark Conspiracy" (`7d87-7436-5341-bbc0`): die Info an `atLeast 1`, die Warnung
an `lessThan 1` (zusätzlich verlangt ihre Klammer per `or`-Gruppe eines von
sieben Armeebüchern im `scope="primary-catalogue"`). Dieselbe Klammer hängt
sichtbar ein `*` an den Namen, sodass ihr Greifen nicht nur an der Meldung
hängt. Der Schalter „Allow special characters?" steht in den Rostern 01/02, damit
die dritte Meldung derselben Einheit — ein `add error` — schweigt.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Kampagneneintrag gewählt, Sonderfiguren erlaubt | Die Info liegt an, die Warnung fehlt, der Name bleibt ungesternt |
| 02 | Kampagneneintrag entfernt, Sonderfiguren erlaubt | Gespiegelt: die Warnung liegt an, die Info fehlt, der Name trägt das `*` |
| 03 | Ohne den Schalter „Allow special characters?" | Kontrolle: Fehler **und** Warnung liegen gleichzeitig am selben Slot, und die Force-Obergrenze der Priesterin feuert mit Ist 1 / Grenze 0 |

> **Bewusste Entscheidung:** Ob der Platzhalter `{this}` im Meldungstext den
> Katalognamen oder den **wirksamen** Namen einsetzt, ist aus den Katalogdaten
> nicht ableitbar. Das Szenario folgt dem Vertrag des Manifests (wirksamer Name)
> und stellt beide Lesarten gegeneinander: die gesternte Fassung wird als
> vorhanden, die ungesternte und die rohe `{this}`-Fassung als abwesend
> behauptet. Damit schließt es die Lücke, die `author-message-tokens` offen
> gelassen hat.

## `append-characteristic-zacharias-spell`

Prüft den `append`-Modifikator auf ein **Merkmal** (§7.7 der Formatdoku): Er
hängt seinen `value` an den Text des benannten Merkmals an, getrennt durch das
`join`-Attribut, das verbatim übernommen wird. Beide Vorkommen der Zelle hängen
am geteilten Spruchprofil „1. Invocation of Nehek" (`6484-4a1a-e62b-2ce1`,
Vampire Counts) und sind auf dieselbe Bedingung gegated — `instanceOf`,
`scope="unit"`, `childId="1c05-5813-2f0c-f878"` („Zacharias the Everliving").
Beide Roster tragen dieselbe „Lore of Necromancy" und tauschen allein den
Zauberer.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Zacharias the Everliving mit der Lore | Das Merkmal „Effect" trägt die angehängte 15+-Zeile, getrennt durch das eine Leerzeichen aus `join=" "` — und weil der Basistext **nicht** mit einem Umbruch endet, landet sie in derselben Textzeile |
| 02 | Ein Necromancer mit derselben Lore | Beide Merkmale stehen auf ihren Basistexten: der Modifikator gehört zum Profil, greift aber nur unter seiner Einheit |

> **Offene Frage (Kampagne).** Der zweite Modifikator dieses Szenarios trägt `position="-1"` — ein
> Attribut, das weder die Formatdoku noch das Wiki kennt und das die vendorte
> `Catalogue.xsd` nicht zulässt. Es kommt genau einmal im ganzen Korpus vor,
> seine Bedeutung ist aus den Daten nicht erschließbar. Das Szenario behauptet
> das betroffene Merkmal „Cast" deshalb nur im **nicht** greifenden Roster, wo
> jede Lesart denselben Basistext ergibt.

## `set-unresolved-target-inert-lord-slot`

Prüft, dass ein `modifier`, dessen `field` eine im Datensatz **nirgends
definierte** Id nennt, wirkungslos ist (§7.6/§7.7 der Formatdoku: die Wirkung
eines Modifikators ist allein als Änderung eines benannten Ziels definiert, und
Grenzen entstehen nur aus `constraint`-Elementen). Beleg: die Id
`a59d-2ddb-429c-1aca` kommt im ganzen eingefrorenen Korpus **nur** als `field`
zweier unbedingter `set`-Modifikatoren vor — an den Lord-`categoryLink`s der
beiden Vampire-Counts-Sonderheere „Army of the Lichemaster" und „Vampire
Coast" — und nie als `id=`. Das Schwesterszenario
`modifier-unresolved-target-inert` zeigt dieselbe Regel für `increment` und
`decrement`.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | „Army of the Lichemaster", leer, Budget 3000 | Keine Grenze der haltlosen Id im Bericht; die echte Lord-Pflicht desselben Links feuert mit ihrem geschriebenen Wert (Ist 0 / Grenze 1), daneben die deklarierten Sonderheer-Pflichten |
| 02 | Dasselbe Heer mit Kemmler und Krell | Die Lord-Pflicht und beide Sonderheer-Pflichten schweigen |
| 03 | „Vampire Coast", leer | Dasselbe Urteil am zweiten Vorkommen |
| 04 | Dasselbe Heer mit Luthor Harkon | Die Pflichten schweigen |
| 05 | Zusätzlich ein Bloated Corpse | Gegenprobe am Nachbar-Link: ein **echter** Modifikator verschiebt sehr wohl — die Core-Pflicht steigt von 4 auf 5 |

> **Grenze der Beobachtbarkeit:** Der wirkungslose `set` trägt den Wert 1, und
> die echte Nachbargrenze steht ebenfalls auf 1 — eine Fehlleitung genau auf
> diese Nachbarin wäre in den realen Daten unsichtbar. Das Szenario behauptet
> deshalb nur, was beobachtbar ist: keine Grenze der haltlosen Id, alle
> erreichbaren Nachbarn auf ihren geschriebenen bzw. regulär modifizierten
> Werten.

## `unit-model-repeat-shield-markup`

Prüft den `repeat` mit `scope="unit"` und `childId="model"` (§7.7 der
Formatdoku, Kasten `scope="unit"`): Er wendet seinen Modifikator **einmal je
Modell der umschließenden Einheit** an — das idiomatische Muster des
Kostenaufschlags je Modell. Beleg: der Shield-Verweis der „Manbiters"
(`a7e5-d466-038a-a9d6`, Mercenaries) trägt ein `increment 1` auf die
pts-Kostenart mit genau diesem `repeat`, der Barding-Verweis der „Heavy
Cavalry" (`19d1-de95-644d-00a7`) dasselbe mit `increment 2`. Weil eine Summe
kein Feld des Slots ist, machen die Roster den Aufschlag über das **Punktebudget**
beobachtbar: das Limit ist je Roster einen Punkt unter der abgeleiteten Summe
gesetzt, sodass es mit genau dieser Summe feuert.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | 20 Manbiters mit Schild | Summe 120 — 100 für die Modelle plus 20 Aufschlag |
| 02 | 25 Manbiters mit Schild | Summe 150: der Aufschlag wächst mit der Modellzahl |
| 03 | 30 Manbiters mit Schild | Summe 180 — die Staffel ist linear, nicht einmalig |
| 04 | 20 Manbiters ohne Schild | Summe 100: ohne die Auswahl kein Aufschlag, dafür feuert ihre Pflichtgrenze |
| 05 | 30 Manbiters ohne Schild | Summe 150 — die Gegenprobe zur dritten Größe |
| 06 | 8 Heavy Cavalry mit Barding | Summe 168: der Faktor 2 kommt aus dem `increment`, nicht aus dem `value` des `repeat` |

## `equal-to-force-points-limit-border-patrol`

Prüft die `equalTo`-Bedingung auf dem **eingestellten Punktebudget**
(`limit::ecfa-8486-4f6c-c249`) mit `scope="force"` und `childId="any"`: Sie hält
nur bei exakter Gleichheit, ein Punkt darüber oder darunter kippt sie. Beleg:
der geteilte Eintrag „Border Patrol (500pts)" (`2066-082d-a465-4baf`,
Mercenaries) hängt seine Pflicht — `set 1` auf die Mindestgrenze
`1a97-1579-ab05-a6d7`, Basis 0 — an genau diese Bedingung mit dem Wert 500. Alle
vier Roster tragen denselben Inhalt; nur die eine Zahl im `costLimit` ändert sich.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Budget exakt 500, der Eintrag gewählt | Die Bedingung hält: der Slot meldet Mindestmaß 1, und weil eine Auswahl liegt, schweigt die Grenze |
| 02 | Budget 499 — ein Punkt darunter | Die Bedingung kippt: Mindestmaß 0. Damit ist `equalTo` von `atMost` getrennt |
| 03 | Budget 501 — ein Punkt darüber | Dasselbe nach oben: `equalTo` ist auch von `atLeast` getrennt |
| 04 | Budget 500, nichts gewählt | Der Eintrag ist im Katalog verwaist — kein Verweis zeigt auf ihn —, also trägt der Bericht keine Grenze dieser Id |

> **Offene Lücke (Kampagne).** Die Roster 01–03 sind rot. Das `.ros`-Format kennt
> ein Budget nur an der Roster-Wurzel, der Rahmen `force` ist also auflösbar und
> liefert genau dieses Budget — die Engine liest es hier aber nicht: bei exakt
> 500 bleibt das Mindestmaß auf 0, und bei 499 wie 501 meldet der Bericht
> zusätzlich die Diagnose `UNRESOLVED_BUDGET_LIMIT`. Unter der jetzigen
> Auswertung ist die Regel des Katalogautors tot.

## `equal-to-force-toggle-count-gotrek`

Prüft die `equalTo`-Bedingung auf einer **Auswahlzählung** im Kontingent
(`field="selections"`, `scope="force"`, `childId` = eine Eintrags-Id): Sie hält
nur bei exakter Gleichheit. Beleg: „Gotrek Gurnisson & Felix Jaeger"
(`ef9d-ae15-cc43-f2d6`, Mercenaries) trägt eine Roster-Obergrenze `max 0`
(`e3c5-278b-09bc-84cf`), die per `set 1` gehoben wird, sobald das Kontingent
**genau eine** Selektion des `.gst`-Schalters „Allow special characters?"
(`8923-5946-7b10-8957`) führt. Derselbe Zähler trägt zusätzlich die Autor-Meldung
des Eintrags — aber mit `lessThan 1` als Gatter, und genau diese Kombination
trennt `equalTo` von `atLeast`.

| # | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) |
| :--- | :--- | :--- |
| 01 | Ein Gotrek, kein Schalter | Die Obergrenze bleibt 0 und feuert mit Ist 1; die Fehlermeldung „Please enable …" liegt an |
| 02 | Ein Gotrek, ein Schalter | Die Obergrenze ist 1: alles schweigt |
| 03 | Ein Gotrek, zwei Schalter | Die Gleichheit kippt: die Obergrenze fällt auf 0 zurück und feuert erneut — die Meldung bleibt jedoch stumm, denn ihr Gatter ist `lessThan 1`. Offen deklariert: die Roster-Obergrenze des Schalters selbst feuert mit Ist 2 / Grenze 1 |
