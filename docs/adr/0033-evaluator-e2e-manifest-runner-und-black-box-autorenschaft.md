# 0033: Evaluator-E2E als datengetriebener, manifest-getriebener Runner mit Black-Box-Autorenschaft

- **Status:** Accepted
- **Datum:** 2026-07-25
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Ergänzt ADR 0006 (Testing und Automation); baut auf ADR 0030 (Reinraum-Evaluator) und ADR 0032 (Mehr-Katalog-Datensätze) auf.

## Kontext und Problemstellung

Die End-to-End-Absicherung der Reinraum-Engine (`src/evaluator/`) bestand
ursprünglich aus **handgeschriebenen, je Armee eigenen** Testdateien
(`src/evaluator/e2e.ogreKingdoms.test.js`, `e2e.orcsAndGoblins.test.js`,
`e2e.vampireCounts.test.js`, `e2e.realCatalog.smoke.test.js` sowie die
`e2e.*.ros`-Charakterisierung). Jede dieser Dateien baute ihre Roster
programmatisch im Testcode auf und formulierte die Erwartungen inline.

Daraus ergaben sich zwei Probleme:

1. **Duplizierung und Divergenz.** Ablauf (Katalog laden, Roster gegen die
   Fassade `evaluate` auswerten, Bericht prüfen) war in jeder Datei erneut
   ausgeschrieben. Ein neuer Fall bedeutete eine weitere Kopie desselben Gerüsts.
2. **Fehlende Unabhängigkeit vom Prüfling.** Wer die Engine schreibt und im
   selben Zug ihre E2E-Tests, leitet die erwarteten Werte leicht aus dem
   *Verhalten der Engine* statt aus den *Katalogdaten* ab. Ein so entstandener
   Test zementiert einen etwaigen Engine-Fehler als „erwartet", statt das vom
   Katalog geforderte Verhalten festzunageln.

## Entscheidungsfaktoren (Drivers)

- **Single Source of Truth:** Ein Fall soll an *einer* Stelle deklariert sein,
  nicht als wiederholtes Testgerüst.
- **Unabhängigkeit:** Die Erwartung eines E2E-Falls muss unabhängig von der
  Implementierung entstehen, damit der Test die Engine wirklich prüft und nicht
  spiegelt.
- **Wartbarkeit:** Ein neuer Fall soll ohne neuen Testcode auskommen — reine
  Daten, kein `.test.js`.
- **Nachvollziehbarkeit:** Jeder Fall soll fachlich (nicht-technisch) belegbar
  sein, mit Verweis auf die konkrete Katalog-Grundlage.

## Betrachtete Optionen

- **Option 1 — Handgeschriebene, je Armee eigene E2E-Tests beibehalten.** Der
  Status quo: jede Armee/jeder Fall als eigenes `.test.js` in `src/evaluator/`.
- **Option 2 — Ein datengetriebener, manifest-getriebener Runner.** Ein einziger
  versionierter Testeinstieg entdeckt zur Laufzeit alle Szenarien unter
  `docs/testing/`, die ein Manifest (`scenario.json`) tragen, und erzeugt die
  Fälle dynamisch daraus. Die Szenarien werden **Black-Box** — allein aus den
  Katalogdaten, ohne Blick in den Engine-Code — autoriert.

## Entscheidungsergebnis

Gewählte Option: **Option 2 — datengetriebener, manifest-getriebener Runner mit
Black-Box-Autorenschaft**, weil sie Duplizierung beseitigt (ein Runner statt N
Testdateien), die Erwartung an *einer* maschinenlesbaren Stelle je Szenario hält
und die Autorenschaft strukturell von der Engine trennt.

Konkret:

- **Ein Runner als einzige Quelle der Wahrheit.**
  [`src/evaluator/e2e.testcatalog.test.js`](../../src/evaluator/e2e.testcatalog.test.js)
  ist der **einzige** versionierte E2E-Einstieg der Engine. Er entdeckt zur
  Laufzeit alle Szenarien unter [`docs/testing/`](../testing/) mit einem
  `scenario.json`, wertet jedes darin deklarierte Roster gegen die öffentliche
  Fassade `evaluate` aus und prüft den Bericht — Verletzungen wie Diagnosen —
  gegen die je Roster deklarierte Erwartung. Die einzelnen Fälle entstehen
  **dynamisch** aus den Manifesten; versioniert sind nur der Runner und die
  Szenario-Daten.
- **Szenario-Daten statt Testcode.** Ein Szenario ist ein Verzeichnis unter
  `docs/testing/<name>/` mit Roster(n) (`rosters/*.ros`), einer `README.md` (die
  aus den Katalogdaten abgeleiteten Regeln samt Beleg) und dem Manifest
  `scenario.json` (der maschinenlesbaren Erwartung). Ein neuer Fall = ein
  neues/erweitertes Szenario, **kein** neues `.test.js`.
- **Black-Box-Autorenschaft.** Szenarien werden vom dedizierten Subagenten
  `e2e-testcase-author` (`.claude/agents/e2e-testcase-author.md`) autoriert. Er
  liest ausschließlich aus einer festen Allow-List (Katalogdaten, Datenformat-
  Spezifikation, vendored XSD) und **nie** den Evaluator-Quellcode. Die
  Aufteilung ist strikt: Der Autor liefert Daten und Prosa (`.ros` + `README.md`
  + `scenario.json`); Runner und jedes `.test.js` gehören zur Engine-Seite und
  sind kein Autoren-Artefakt. Rolle, Allow-List, Manifest-Vertrag und Grenze sind
  in der Begleit-Dokumentation
  [`docs/agents/e2e-testcase-author.md`](../agents/e2e-testcase-author.md)
  beschrieben.
- **Abgleich statt Anpassung an die Engine.** Die blind abgeleitete Erwartung
  eines Szenarios trifft die Engine erst im **Runner-Lauf** — das *ist* der
  Verifikationsschritt, und er ist bewusst von der Autorenschaft getrennt: der
  Autor hat kein Bash-Werkzeug und führt die Engine nie aus, er leitet `actual`/
  `bound` allein aus Katalog-XML und dem selbst gebauten Roster ab. Weicht die
  abgeleitete Erwartung beim Runner-Lauf vom Engine-Bericht ab, wird die
  Abweichung **untersucht** — Katalog-Fehldeutung des Autors *oder* Engine-Fehler —
  nicht stillschweigend an die Engine-Ausgabe angepasst. Ein Manifest, dessen
  Zahlen nachträglich an die Engine getunt werden, verliert genau die
  Unabhängigkeit, um derentwillen die Trennung existiert; die Szenario-`README.md`
  behauptet daher auch keine „gegen einen Engine-Lauf verifizierten" Werte,
  sondern belegt sie aus den Katalogdaten.
- **Migration abgeschlossen.** Die frühere handgeschriebene Suite ist vollständig
  in dieses Format überführt und entfernt.

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Ein neuer E2E-Fall braucht keinen Testcode mehr — nur Szenario-Daten.
  - Die Erwartung eines Falls entsteht unabhängig von der Engine und kann sie
    daher wirklich widerlegen, statt ihr Verhalten zu spiegeln.
  - Kein dupliziertes Testgerüst; die Absicherung wächst durch Daten, nicht durch
    Code.
  - Jeder Fall ist fachlich in der Szenario-`README.md` und im
    [Testkatalog](../testkatalog-evaluator-e2e.md) belegt.
- **Negativ:**
  - Der Runner ist generischer und damit indirekter als ein je Armee direkt
    lesbarer Test; ein Manifestfehler äußert sich als Laufzeitmeldung des Runners
    (der dafür klare, auf das Manifest verweisende Fehlermeldungen wirft).
- **Neutral:**
  - Testkatalog und Szenario-Bestand werden **von Hand** deckungsgleich gehalten;
    es gibt bewusst keinen Generator und kein CI-Gate (siehe ADR 0006 und den
    Testkatalog).
