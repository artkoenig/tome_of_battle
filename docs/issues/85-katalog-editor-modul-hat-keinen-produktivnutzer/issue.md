Status: ready-for-agent
Type: chore
Blocked by: None

## Description

`src/parser/catalogEditor.js` ist ein Modul von 299 Zeilen, das von keiner
Produktivdatei benutzt wird. Eine Suche ueber das ganze Repository findet als
Nutzer nur seine eigenen beiden Testdateien
(`catalogEditor.test.js:8`, `catalogEditor.entryUpdateSerialization.test.js:3`) —
nichts unter `src/`, `scripts/` oder `tools/` importiert es.

Beide eingerichteten Gates sind dafuer strukturell blind: die Prueflauf-Analyse
fuer ungenutzte Exporte behandelt Testdateien als Einstiegspunkte
(`knip.json:5`), und die Abhaengigkeitspruefung sieht das Modul dank seiner Tests
nicht als verwaist. Es kann also beliebig lange unbemerkt liegenbleiben.

Die Bewertung ist nicht neu: `docs/issues/39-.../issue.md:38` nennt es bereits
"die schwaechste Datei der Codebasis".

Zwei Moeglichkeiten, und die Entscheidung gehoert vor die Arbeit: entweder es
hatte einen Nutzer, der entfernt wurde — dann fehlt eine Funktion. Oder es wurde
auf Vorrat gebaut — dann gehoert es weg, samt seiner Tests. Was von beidem gilt,
ist aus der Versionsgeschichte zu belegen, nicht zu vermuten.

Gefunden bei der Standards-Pruefung zu Main-Issue 79.

## Acceptance Criteria
- [ ] Aus der Versionsgeschichte ist belegt, ob das Modul je einen Produktivnutzer hatte.
- [ ] Es ist entschieden und begruendet, ob es entfernt oder wieder angebunden wird.
- [ ] Die gewaehlte Richtung ist umgesetzt; bei Entfernung fallen auch seine Tests weg.
- [ ] Die Testsuite bleibt gruen.

## Comments
- Zusatzbefund derselben Pruefung: dass beide Gates dieses Modul nicht sehen, ist ein allgemeines Loch, nicht nur eines fuer diese Datei. Ob die Konfiguration das aendern soll (Testdateien nicht als Einstiegspunkte zu werten), ist eine eigene Frage — hier nur festgehalten, nicht entschieden.
- PO-Sichtung, Versionsgeschichte ausgewertet (AC 1 belegt): ueber ALLE Refs und die gesamte Historie referenzieren nur vier Dateien das Modul — es selbst, seine beiden Tests und frueher src/solver/validator.test.js (Import von updateRawXml, entfernt in 1914016). Kein einziger Produktivnutzer, zu keinem Zeitpunkt. Angelegt am 2026-07-20 in 7bf437c zusammen mit der gesamten src/parser-Schicht, seither nur einmal angefasst (1914016, Issue 39). Damit ist Fall B belegt: auf Vorrat gebaut, nie angebunden.

PO-Entscheid: entfernen, samt seiner beiden Testdateien. Begruendung: 299 Zeilen ohne Nutzer sind Speculative Generality; sollte je ein Katalog-Editor spezifiziert werden, ist der Code aus der Historie wiederherstellbar, waehrend die Kosten des Liegenbleibens (Pflege, Analyse-Rauschen, blinde Gates) laufend anfallen. Der Maintainer kann diesen Entscheid kippen, bevor die Scheibe umgesetzt wird.

Der Zusatzbefund (beide Gates sehen das Modul nicht, weil Testdateien als Einstiegspunkte gelten, knip.json:5) bleibt hier bewusst ausgeklammert und gehoert zu Issue 87, wo die Frage 'Gate oder Hinweis' ohnehin entschieden wird.
