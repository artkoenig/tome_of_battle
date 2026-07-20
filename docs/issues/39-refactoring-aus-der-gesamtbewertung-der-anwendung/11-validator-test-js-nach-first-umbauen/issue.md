Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

**Geruch:** Verstoß gegen FIRST — konkret gegen *Independent* und
*Self-Validating*.

Die Testkultur des Projekts ist insgesamt gut: rund 700 Tests über mehr als
40 Dateien, fein nach Aspekt geschnitten, mit gefälschter IndexedDB und
injizierten Abrufern statt echter Netzwerkzugriffe. Die Validator-Testdatei ist
der **einzelne Ausreißer** und wird deshalb gesondert behandelt.

Sie umfasst rund 2.400 Zeilen, enthält aber nur etwa 20 echte Testblöcke. Dem
stehen rund 135 Anweisungen auf Modulebene und 24 Konsolenausgaben gegenüber:
Aufbau und Teile der Prüfung laufen beim Laden des Moduls, nicht innerhalb
eines Tests.

Zwei konkrete Schäden: Ein Fehler im Modul-Setup lässt die gesamte Datei
abstürzen, statt einen benannten Test scheitern zu lassen — man erfährt nicht,
*was* kaputt ist. Und die Konsolenausgaben sind Lärm, keine Zusicherung: sie
können nicht fehlschlagen und würden ein falsches Ergebnis anstandslos
ausgeben.

**Vorgeschlagene Behebung:** Die Aufbauten auf Modulebene in Fabrikfunktionen
überführen, jede Prüfung in einen eigenen Testblock mit sprechendem Namen
heben und die Konsolenausgaben durch echte Zusicherungen ersetzen. Bei dieser
Größe bietet sich zugleich eine Aufteilung nach Aspekt an, wie sie die übrigen
Testdateien des Projekts bereits vorbildlich zeigen.

## Acceptance Criteria
- [ ] Es laufen keine Zusicherungen mehr auf Modulebene; jede Prüfung sitzt in
      einem benannten Testblock
- [ ] Die Aufbauten sind Fabrikfunktionen, sodass Tests einander nicht
      beeinflussen
- [ ] Die Konsolenausgaben sind durch Zusicherungen ersetzt oder entfernt
- [ ] Die Datei ist nach Aspekt aufgeteilt, entsprechend der im Projekt
      bereits üblichen Schnittweise
- [ ] Die inhaltliche Abdeckung bleibt vollständig erhalten — kein Testfall
      geht bei der Umstellung verloren
- [ ] `npm run lint` und `npm test` bleiben grün

## Comments
