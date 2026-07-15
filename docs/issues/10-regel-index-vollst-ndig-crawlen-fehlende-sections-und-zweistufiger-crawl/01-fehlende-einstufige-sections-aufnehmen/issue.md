Status: resolved
Blocked by: None

## Description

**Ergebnis für den Nutzer:** Die Psychologie-Regeln erhalten im Editor einen
Regel-Link. „Fear" ist der Auslöser des Eltern-Issues und nach diesem Slice
gelöst.

Fünf Sections der Quelle fehlen in der Section-Liste des Crawlers, obwohl sie
exakt dem bestehenden Muster folgen (Übersichtsseite `/{section}` verlinkt die
Einzelseiten `/{section}/<slug>`). Sie sind damit ohne Änderung am Crawl-Modell
erreichbar:

| Section | Gewinn | Namen |
|---|---|---|
| `psychology` | +6 | Fear, Terror, Hatred, Frenzy, Stupidity, Stubborn |
| `units` | +2 | Infantry, Unit Strength |
| `chariots` | +2 | Chariot Units, Impact Hits |
| `movement` | +1 | Charge Reactions |
| `close-combat` | +1 | Break Tests |

Der Grund für das Fehlen ist keine Parsing-Schwäche: Die Übersichtsseite
`/special-rules` enthält 640 Links und der Crawler übernimmt alle 640 korrekt.
Der Text „Fear" kommt dort schlicht nicht vor, weil die Regel unter
`/psychology/fear` liegt.

**Kollisionsfreiheit ist geprüft:** Die 25 Labels von `psychology` überschneiden
sich mit keinem bestehenden Index-Eintrag. Die Labels heißen exakt wie die
Katalognamen (`Fear`), es ist also kein Synonym nötig.

**Wichtig — nicht auf den Statuscode verlassen:** `/special-rules/fear` liefert
HTTP 200 mit einer 404-Seite (Soft-404). Die Regel darf deshalb ausschließlich
über die tatsächlich verlinkte URL `/psychology/fear` in den Index gelangen,
niemals über einen geratenen Pfad unter `special-rules`.

**Abgrenzung:** Dieser Slice ändert das Crawl-Modell nicht. Die Singular-Sections
(`/magic-item`, `/unit`, `/spell`) sind Gegenstand der Geschwister-Issues.

## Acceptance Criteria
- [ ] Ein Crawl erfasst zusätzlich die Sections `psychology`, `units`,
      `chariots`, `movement` und `close-combat`.
- [ ] Nach dem Crawl liefert die Regel-Suche für „Fear", „Terror", „Hatred",
      „Frenzy", „Stupidity" und „Stubborn" je eine URL unterhalb `/psychology/`.
- [ ] Im Editor zeigt ein Chip bzw. eine Regel „Fear" das Regel-Link-Symbol und
      öffnet die Regelseite (E2E in der laufenden App geprüft, nicht nur im JSON).
- [ ] Kein bestehender Index-Eintrag ändert seine Ziel-URL.
- [ ] Der Fortschritt weist die erhöhte Section-Zahl aus (Balken und Log zählen
      gegen die neue Gesamtzahl).
- [ ] Ein Test deckt ab, dass eine neu aufgenommene Section im Index landet.
- [ ] Volle Suite grün.

## Comments
- SECTIONS in scripts/rules-crawler.js um psychology, units, chariots, movement und close-combat erweitert; das Crawl-Modell blieb unveraendert, da alle fuenf dem bestehenden Muster folgen. Vorab geprueft: alle fuenf Sections sind kollisionsfrei gegen den bestehenden Index (0 Ueberschneidungen), Labels heissen exakt wie die Katalognamen, kein Synonym noetig. Ergebnis: Index waechst von 843 auf 983 Eintraege. Formal verifiziert, dass es keine Regression gibt: 0 Eintraege entfernt, 0 Werte geaendert, 140 hinzugekommen (Vergleich gegen HEAD). Fear/Terror/Hatred/Frenzy/Stupidity/Stubborn zeigen jetzt auf /psychology/. E2E in der laufenden App verifiziert: Vampire-Counts-Roster mit Ghouls angelegt, der Regel-Chip 'Fear' traegt das BookOpen-Symbol und oeffnet den Regeltext (Kategorie Psychology, Main Rulebook p. 81); keine Konsolenfehler. Fortschritt im Editor verifiziert: 'Crawle 10 Sections', Balken laeuft bis [10/10], gruen, 983 Eintraege. Tests: zwei neue Faelle in scripts/generate-rules-index.test.js (Psychologie-Regeln unter /psychology/, uebrige neue Sections unter ihrem Pfad). Volle Suite gruen: 29 Dateien, 287 Tests plus E2E-UI-Suite; Lint sauber.
