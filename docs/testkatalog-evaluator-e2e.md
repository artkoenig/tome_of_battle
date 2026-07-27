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
eigenständigen ergofang-VC-Katalog (`src/solver/__fixtures__/whfb6/`) nutzt. Jede
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
| [`violation-classification`](testing/violation-classification/) | Definitive Ogre + Mercenaries | 7 |
| [`author-message-tokens`](testing/author-message-tokens/) | Definitive Ogre + Mercenaries | 3 |
| [`linked-entry-type-counting`](testing/linked-entry-type-counting/) | Definitive Ogre + Mercenaries | 4 |
| **Summe** | | **108** |

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
