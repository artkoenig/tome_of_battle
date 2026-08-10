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
| **Summe** | | **134** |

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
