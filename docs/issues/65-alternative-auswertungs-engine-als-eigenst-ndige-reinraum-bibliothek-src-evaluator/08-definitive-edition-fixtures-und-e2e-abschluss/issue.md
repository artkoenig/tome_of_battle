Status: resolved
Type: chore
Blocked by: [05, 07]

## Description

Stellt die **eigenen minimalen** `.cat`/`.gst`-Fixtures der Engine bereit,
modelliert an realen WHFB6-/Definitive-Edition-Fällen (inkl. der
Ogerbullen-Pflichteinheit), unabhängig von den Fixtures der bestehenden Engine.
Bündelt End-to-End-`evaluate()`-Tests über die realen Domänenfälle; optional ein
Smoke-Test über einen realen WHFB6-Katalog.

## Acceptance Criteria
- [x] Die Engine hat eigene minimale `.cat`/`.gst`-Fixtures, modelliert an realen
      Definitive-Edition-/WHFB6-Fällen, nicht aus der bestehenden Engine übernommen.
- [x] End-to-End-`evaluate()`-Tests decken die realistischen Fälle ab, inklusive
      einer armeeweiten Pflichteinheit (Ogerbullen), die bei Fehlen angeschlagen und
      bei Vorhandensein erfüllt ist.
- [x] Die vollständige Suite (beide Nahtstellen) läuft grün.

## Comments
- INSTANCE_OF-Komparator (Slice 04 aufgeschoben): als Mitgliedschafts-Praedikat ueber dem zaehlenden Query-Primitiv umgesetzt. Semantik (in model.js/CompareOp und modifiers.js/compare() dokumentiert): value>=1 fordert Mitgliedschaft (actual>0, mindestens eine Ziel-Instanz im Rahmen), value===0 fordert Abwesenheit (actual===0, das belegte notInstanceOf-Idiom) — deckungsgleich mit der Solver-Engine (cond.value===0 ? !isInstance : isInstance). Bei mehrdeutiger BSData-Doku ist dies die defensibelste Lesart, im Code als Annahme kommentiert.
- Realkatalog-Smoke-Test: DURCHGEFUEHRT als EIN-Katalog-Test gegen die echte Datei src/solver/__fixtures__/whfb6/Ogre Kingdoms.cat (via fs gelesen, kein Import -> Isolation nach ADR-0030 bleibt gruen). evaluate() liefert einen Bericht ohne Absturz; die reale Bulls-Pflichteinheit (min selections roster=1) schlaegt bei leerer Armee an und ist mit 1 Trupp erfuellt. BEWUSSTE GRENZE (kein Fake): evaluate() bleibt EIN-Katalog. Voller Mehr-Katalog-Import (.gst + mehrere .cat, entryLinks/sharedSelectionEntries/catalogueLinks, Link-Ketten) bleibt kuenftige Arbeit — die von Slice 01 im Resolver ausgeklammerte Nahtstelle. Nur die direkt unter der Wurzel stehenden selectionEntries/categoryEntries werden aufgeloest; volles BS-Vokabular (condition@type/modifier@type) wird als Diagnose gemeldet, nie still verschluckt. Dokumentiert im Test-Header und in resolver.js.
- Umgesetzt: eigene minimale WHFB6-/Definitive-Edition-Fixture (__fixtures__/definitiveEditionCatalogue.js) im engine-eigenen Vokabular + E2E-Tests ueber evaluate() (Ogerbullen-Pflicht bei Fehlen angeschlagen/bei Vorhandensein erfuellt, min/max/Prozent+Kosten-Mix, bedingter instanceOf-Modifikator, kategoriegetriebene Zaehlung, gueltige Armee ohne Verletzung). INSTANCE_OF-Komparator (Slice 04 nachgeholt) in CompareOp+compare() mit fokussierten Tests. Realkatalog-Smoke-Test gegen die echte Ogre Kingdoms.cat (ein Katalog; voller Mehr-Katalog-Import bleibt dokumentiert deferred). Volle Suite gruen: vitest 1716 Tests/183 Dateien + Puppeteer-E2E (node src/solver/ui.test.js) beide gelaufen und gruen. Isolation (lint+depcruise) gruen.
