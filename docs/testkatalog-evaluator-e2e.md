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
öffentliche Fassade `evaluate` aus und prüft den Bericht — sowohl die
**Verletzungen** als auch die **Diagnosen** — gegen die je Roster deklarierte
Erwartung. Die einzelnen Testfälle entstehen **dynamisch** aus den Manifesten;
versioniert sind nur der Runner und die Szenario-Daten.

Ein **Szenario** ist ein Verzeichnis unter `docs/testing/<name>/` mit:

- einem oder mehreren **Rostern** (`rosters/*.ros`) — echten Battlescribe-Roster-
  Dateien als Engine-Eingabe;
- einer **`README.md`** — die aus den Katalogdaten abgeleiteten Regeln samt Beleg
  (Black-Box: nur aus den Katalogdaten, nicht aus dem Engine-Code);
- dem Manifest **`scenario.json`** — der maschinenlesbaren Quelle der Wahrheit:
  welche Katalogdateien geladen werden und welche Grenzen/Diagnosen je Roster
  feuern müssen (`firing`), nicht feuern dürfen (`absent`) bzw. als Diagnose
  auftreten oder ausbleiben müssen (`diagnostics`).

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
| [`vampire-counts`](testing/vampire-counts/) | Definitive VC (+/- Mercenaries) | 3 |
| [`category-scope-bug`](testing/category-scope-bug/) | Definitive VC + Mercenaries | 1 |
| [`real-catalog-smoke`](testing/real-catalog-smoke/) | Definitive Ogre (+/- Mercenaries) | 2 |
| **Summe** | | **42** |

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
