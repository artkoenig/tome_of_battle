Status: resolved
Type: fix
Blocked by: None

## Description

Ein Angebots-Slot, dessen einzige Grenze eine **unbegrenzte** Obergrenze ist,
meldet im Faehigkeitsdatensatz einen Ist-Stand von 0 — unabhaengig davon, wie
viel dort tatsaechlich ausgewaehlt ist.

Ursache im Datenfluss: der Bericht liest den Ist-Stand aus dem Ergebnis einer
Grenze, nicht aus der Zaehlung selbst. `src/evaluator/report.js:196` bildet ihn
als `maxResult?.actual ?? minResult?.actual ?? 0`. Eine unbegrenzte Obergrenze
wird vorher fallengelassen und liefert kein Ergebnis; gibt es daneben keine
Untergrenze, greift der Ersatzwert 0.

Folge: die Oberflaeche, die den Faehigkeitsdatensatz als alleinige Quelle nutzt
(ADR-0035), sieht fuer solche Slots dauerhaft "0 ausgewaehlt". Der Ist-Stand ist
dann keine Aussage mehr ueber das Roster, sondern ein Artefakt der Frage, welche
Grenzen zufaellig ein Ergebnis beigesteuert haben.

Vorbestehend — nicht durch Main-Issue 79 entstanden, dort aber bei der
Datenanalyse aufgefallen. Nach 79 tritt der Fall haeufiger auf, weil dann mehr
Obergrenzen ueberhaupt erst korrekt als unbegrenzt erkannt werden.

## Acceptance Criteria
- [ ] Der Ist-Stand eines Slots gibt die tatsaechliche Zaehlung wieder, auch wenn keine Grenze ein Ergebnis beisteuert.
- [ ] Ein Slot mit ausschliesslich unbegrenzter Obergrenze meldet den echten Ist-Stand statt 0.
- [ ] Ein Test haelt den Fall fest.
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
- Belegt bei der PO-Sichtung von Issue 79: src/evaluator/report.js:196 bildet current als `maxResult?.actual ?? minResult?.actual ?? 0`. Faellt die Obergrenze als unbegrenzt weg und existiert keine Untergrenze, bleibt der Ersatzwert 0 stehen.
- Verwandter Punkt aus Main-Issue 76, gehoert zur selben Frage 'was sagen die Zahlen des Faehigkeitsdatensatzes wirklich': ADR-0035 formuliert im Entscheidungsergebnis (Z. 78-79) 'gesperrt ist, wessen Hoechstmass ausgeschoepft ist; ... wie viel noch hineinpasst, sagt der verbleibende Spielraum'. Das verspricht mehr, als der Bericht halten kann. Ein Slot fuehrt je Art nur eine Grenze, kann aber Grenzen mehrerer Messgroessen tragen — er meldet dann etwa 'noch 4 frei' in Auswahlen, waehrend die Punktegrenze bereits ausgereizt ist. Main-Issue 76 hat die Zahlen einheiten-treu gemacht und den Vorbehalt in docs/evaluator-architecture.md §4.8 dokumentiert; die ADR selbst wurde bewusst NICHT angefasst, weil ihre Entscheidung (Verfuegbarkeit ablesen statt errechnen) unveraendert gilt und ihr Wortlaut Sache des Maintainers ist. Wer 82 anfasst, sollte entscheiden, ob die ADR eine klarstellende Ergaenzung bekommt — sie ist der Vertrag, gegen den die kuenftige Oberflaeche gebaut wird.
- Der Ist-Stand eines Slots kommt jetzt aus einer eigenen Zaehlung (neu: src/evaluator/occupancy.js, 'Belegung'): Rahmen = der Elternknoten (scope=parent, ohne includeChild-Flags), Ziel = die vom Slot genannte Id (neu geteilt als identity.js#countingTargetIdOf, vorher inline in constraints.js), Messgroesse = Anzahl (forceCount am Kontingent-Slot, sonst selectionCount) — ueber das Query-Primitiv, nicht mit einem zweiten Indexzugriff. report.js#currentOf nutzt sie nur, wenn KEINE Grenze ein Ergebnis beisteuert; weist der Slot eine Grenze aus, bleibt es deren Ist-Wert (Einheiten-Treue aus Main-Issue 76). Damit sind beide Wege gedeckt: unbegrenzt erklaerte Grenze und Grenze ohne Antwort (unevaluatedLimitKinds, Issue 77) — headroom 0 / isBlocked true bleiben dort fail-closed. Messung ueber alle 112 Szenario-Roster (17180 Slots), vorher/nachher: Verletzungen und Diagnosen in JEDEM Roster unveraendert, keine einzige Verletzung kippt; von den 13 Feldern des Faehigkeitsdatensatzes aendert sich nur 'current', an 280 Slots (200 belegt, 80 Kategorie-Anker), alle von 0 auf 1-4 — Zuordnung: 39 unbegrenzte Grenze, 7 Grenze ohne Antwort, 234 gar keine deklarierte Grenze. Angebots-Anker aendern sich nicht: offer.js entdoppelt, ein Angebots-Anker existiert nur, wo im Rahmen nichts seiner Definition steht — seine 0 ist korrekt. Keine Erwartung unter docs/testing/ geaendert (ADR-0033). Neu: occupancy.test.js (6), report.occupancy.test.js (6); docs/evaluator-architecture.md §4.8 nachgezogen.
- Review-Gate, vier Achsen (Design-Konformitaet entfaellt mangels Plan):
- Achse A (Standards): statische Analyse sauber an jedem Gate, das gatet (lint 0, typecheck 0, depcruise 0 Fehler; knip 1 ist der vorbestehende Rueckstand, Issue 87). Sechs Befunde, keiner blockierend: vier als Issue 91 ausgelagert, einer an Issue 87 ergaenzt, einer ist eine ehrlich hingeschriebene Annahme.
- Achse B (Spezifikation): 0 fehlende Kriterien, 0 Scope Creep, 1 Fund (Doku-Drift, behoben). Bestaetigt ausdruecklich, dass die Einheiten-Treue aus Main-Issue 76 unangetastet bleibt: die Belegung greift nur, wenn WEDER Unter- noch Obergrenze ein Ergebnis liefert, und die Messgroessen-Rangfolge ist unberuehrt.
- Achse C (Tests): selbst gemessen statt delegiert, nachdem der Testlauf zu Issue 84 auf einem manipulierten Arbeitsbaum entstanden war. 214 Dateien / 2222 Tests gruen, exakt die Zahl des Implementierers.
- Achse D (Doku): 3 Befunde. Zwei behoben (§4.2 und der Vertrag des Black-Box-Autors), der dritte ist eine Feststellung.

Zwei Korrekturen an meinem eigenen Auftragstext, beide vom Implementierer belegt: (1) Ich schrieb 'Angebots-Slot'. Angebots-Anker aendern sich in keinem einzigen Fall (0 von 6152) — ein Anker entsteht nur dort, wo nichts seiner Definition im Rahmen steht, seine Null ist also richtig. Betroffen waren belegte Slots (200) und Kategorie-Anker (80). (2) Die Ursache ist breiter als beschrieben: von 280 betroffenen Slots haben 234 ueberhaupt keine deklarierte Grenze — eine dritte Spielart desselben erfundenen Nullwerts, neben 'unbegrenzt erklaert' (39) und 'nicht auswertbar' (7).

Zur Frage an den Maintainer (ADR-0035): nicht beantwortet, ADR unveraendert. Die Doku-Achse hat unabhaengig geprueft und kommt zum Ergebnis, dass dieser Vorgang die Luecke NICHT vergroessert — ADR-0035 sagt in Z. 78-79 nur etwas ueber Sperre und Spielraum, nicht ueber den Ist-Stand. Die aeltere Luecke aus Main-Issue 76 (Zahlen gelten je Messgroesse) besteht unveraendert fort.
