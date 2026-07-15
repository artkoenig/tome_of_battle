Status: resolved
Blocked by: None

## Description

**Typ:** Verbesserung (Entwickler-Tool: Rules-URL-Editor + Crawl-Skript).

**Aktuelles Verhalten:** Der Crawl-Button im Editor startet das Crawl-Skript und
liefert erst nach dessen Ende eine Zahl zurück. Währenddessen zeigt die UI nur ein
statisches „⏳ Crawlen…" — kein Fortschritt, keine Zwischenmeldung, kein Hinweis
darauf, welche Section gerade geholt wird. Schlägt eine Section fehl, bricht das
Skript sofort mit einem Prozess-Exit ab; im Editor erscheint nur eine generische
Fehlermeldung. Nach dem Lauf existiert keinerlei Aufzeichnung, was passiert ist.

**Beobachtete Schwachstellen:**
- Der Crawl läuft **synchron und blockierend** — der Server kann während des
  gesamten Laufs keine weitere Anfrage beantworten, die UI kann den Fortschritt
  also gar nicht abfragen.
- Das Crawl-Skript ist **fail-fast über alle Sections**: der erste fehlgeschlagene
  Fetch verwirft auch die bereits erfolgreich geholten Sections.
- Ein Fetch-Fehler wird **nicht unterschieden** nach Ursache (HTTP-Status,
  Netzwerkfehler, Section ohne Treffer) und ist nach dem Lauf nicht mehr
  nachvollziehbar.
- Eine Section, die zwar 200 liefert, aber **null Links** ergibt (z. B. weil sich
  das HTML-Markup der Quelle geändert hat), fällt still durch — der Lauf gilt als
  erfolgreich, das Ergebnis ist aber unvollständig.

**Gewünschtes Verhalten:** Der Crawl meldet seinen Fortschritt live an den Editor
(Fortschrittsbalken über die Sections plus fortlaufendes Log-Panel), läuft pro
Section fehlertolerant weiter statt komplett abzubrechen, meldet Sections ohne
Treffer als Fehler, und jeder Lauf wird zusätzlich als Logdatei abgelegt, um
Fehler auch nachträglich untersuchen zu können.

**Lösungsansatz:** Das Crawl-Skript erhält einen strukturierten Event-Ausgabemodus
(eine JSON-Zeile pro Ereignis: Start, Section-Beginn, Section-Ergebnis,
Section-Fehler, Abschluss), der die bestehende menschenlesbare Ausgabe für den
CLI-Aufruf unberührt lässt. Der Editor-Server startet den Crawl asynchron als
Child-Prozess statt blockierend, reicht die Event-Zeilen direkt an den Browser
weiter und schreibt sie parallel in eine Logdatei pro Lauf. Der Editor
konsumiert den Stream und rendert Fortschritt und Log.

**Abgrenzung:** Kein Retry-Mechanismus, keine Parallelisierung der Fetches, keine
Änderung am Datenformat von `rules-index.json`. Der Editor bleibt ein rein
lokales Entwickler-Tool ohne Auth (siehe PRD „URL-Mapping-Editor für 6th.whfb.app").

## Acceptance Criteria
- [ ] Während des Crawls zeigt der Editor einen Fortschrittsbalken, der die
      abgearbeiteten Sections gegen die Gesamtzahl der Sections ausweist, und
      aktualisiert ihn fortlaufend — nicht erst am Ende des Laufs.
- [ ] Der Editor zeigt ein Log-Panel, in dem die Ereignisse des laufenden Crawls
      (Section begonnen, Section fertig mit Trefferzahl, Fehler, Abschluss)
      erscheinen, während der Crawl läuft.
- [ ] Der Server blockiert während des Crawls nicht: weitere Anfragen werden
      parallel zum laufenden Crawl beantwortet.
- [ ] Schlägt eine Section fehl, wird der Fehler samt Ursache gemeldet, der Crawl
      läuft mit den übrigen Sections weiter, und die erfolgreich geholten
      Einträge bleiben erhalten.
- [ ] Eine Section, die keine Treffer liefert, wird als Fehler gemeldet und nicht
      still übergangen.
- [ ] Scheitern alle Sections, wird `rules-index.json` nicht überschrieben und
      der Editor meldet den Lauf als fehlgeschlagen.
- [ ] Nach dem Lauf zeigt der Editor eine Zusammenfassung mit der Zahl der
      Einträge und der Zahl der fehlgeschlagenen Sections.
- [ ] Jeder Lauf hinterlässt eine Logdatei mit den Ereignissen des Laufs; der
      Ablageort ist von der Versionskontrolle ausgenommen.
- [ ] Der direkte CLI-Aufruf des Crawl-Skripts funktioniert unverändert mit
      menschenlesbarer Ausgabe und einem Exit-Code, der Erfolg von Fehlschlag
      unterscheidet.
- [ ] Tests decken die Event-Erzeugung des Crawlers ab: erfolgreicher Lauf,
      Lauf mit fehlgeschlagener Section, Lauf mit leerer Section, Lauf mit
      ausschließlich fehlgeschlagenen Sections.
- [ ] Volle Test-Suite grün; PRD des Editors spiegelt das neue Crawl-Verhalten
      und den Endpunkt-Vertrag wider.

## Comments
- Crawl-Logik aus dem Skript in ein eigenes Modul (scripts/rules-crawler.js) gezogen: Fetch wird injiziert, der Ablauf emittiert Events (run-started, section-started/-completed/-failed, run-completed) - dadurch ohne Netzwerk testbar. generate-rules-index.js ist nur noch CLI-Einstieg: ohne Flag menschenlesbare Ausgabe, mit --events NDJSON auf stdout; Exit-Code 0 nur bei fehlerfreiem Lauf. Fehlertoleranz: pro Section statt fail-fast; leere Section gilt als Fehler; beim Schreiben werden Eintraege fehlgeschlagener Sections aus der bestehenden Datei uebernommen (mergeRetainingFailedSections), bei komplettem Fehlschlag bleibt die Datei unveraendert. Server: execSync durch spawn ersetzt (nicht mehr blockierend), streamt die Events als application/x-ndjson an den Editor und tee-t sie nach tools/rules-editor/logs/crawl-<zeitstempel>.log (bereits per .gitignore 'logs' ausgenommen); 409 bei parallelem Crawl; Aufraeumen idempotent, damit ein Setup-Fehler das Flag nicht dauerhaft blockiert. UI: Crawl-Panel mit Fortschrittsbalken (gruen/orange/rot je nach Ausgang), Live-Log und Logdatei-Pfad; laedt danach rules-index.json ueber /api/data nach. Verifiziert E2E im Browser: Lauf ueber 5 Sections gruen (843 Eintraege), Server antwortete waehrend des Crawls in 2.7ms, 409-Guard greift, Fehler-Events rendern orange/rot mit Ursache; rules-index.json wird byte-identisch reproduziert (git diff leer). Tests: 10 neue Unit-Tests in scripts/rules-crawler.test.js; volle Suite gruen (29 Dateien, 285 Tests) inkl. E2E-UI-Suite. PRD-rules-url-editor.md an neuen Endpunkt-Vertrag, Event-Vokabular, Fehlertoleranz und Testumfang angepasst.
