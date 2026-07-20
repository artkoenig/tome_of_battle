Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

**Geruch:** Verstoß gegen robuste Fehlerbehandlung — Fehler werden nicht
verschluckt, aber auch nicht sichtbar gemacht.

25 von 27 `catch`-Blöcken im Produktivcode protokollieren ausschließlich auf die
Konsole. Dem stehen nur vier Stellen gegenüber, die den Nutzer über einen Toast
erreichen. Leere `catch`-Blöcke gibt es bis auf eine Ausnahme keine.

Dies ist eine Anwendung ohne Backend; IndexedDB ist der einzige Datenpfad. Die
Konsole sieht auf einem Tablet am Spieltisch niemand.

Vier konkrete Stellen:

1. **Autosave.** Scheitert das automatische Speichern — überschrittene Quota,
   während eines Katalog-Updates blockierte Datenbank —, arbeitet der Nutzer
   ahnungslos weiter und verliert seine Liste.
2. **Katalog-Parsefehler.** Schlägt das Parsen einer einzelnen `.cat`-Datei
   fehl, läuft der Import mit unvollständigem Datensatz weiter und meldet
   anschließend Erfolg — mit einer Katalogzahl, welche die fehlgeschlagenen
   bereits nicht mehr enthält, sodass nichts auffällt. Später äußert sich das
   als Validierungsfehler „Auswahl verweist auf einen nicht mehr vorhandenen
   Eintrag", weit entfernt von der Ursache.
3. **Umbenennen und Löschen eines Rosters sowie Laden der Systemliste.** In
   allen drei Fällen existiert im selben Modul bereits ein Rückkanal, der hier
   schlicht nicht genutzt wird — Fehlschlag und Erfolg sind für den Nutzer
   nicht unterscheidbar.
4. **Leerer `catch` beim Deserialisieren.** Der Rückfall „kein ZIP, also als
   Text lesen" ist berechtigt, verschluckt aber auch die echte Beschädigung
   eines gültigen ZIP; der Nutzer bekommt dann eine irreführende Folgemeldung.

**Vorgeschlagene Behebung:** Ein zentraler Fehlerkanal, über den Persistenz-,
Import- und Parsefehler den Nutzer erreichen. Das Toast-System aus ADR-0010 ist
bereits vorhanden und wird lediglich nicht genutzt. Beim Import werden
fehlgeschlagene Kataloge gesammelt und analog zur bestehenden
Abhängigkeitswarnung angezeigt.

## Acceptance Criteria
- [ ] Ein Fehlschlag beim automatischen Speichern wird dem Nutzer angezeigt
- [ ] Fehlgeschlagene Kataloge werden beim Import gesammelt und benannt; die
      Erfolgsmeldung behauptet keinen vollständigen Import mehr
- [ ] Umbenennen, Löschen und Laden der Systemliste melden ihre Fehler über den
      vorhandenen Rückkanal
- [ ] Der bislang leere `catch` beim Deserialisieren unterscheidet den
      erwarteten Rückfall von einer echten Beschädigung
- [ ] Kein `catch`-Block im Produktivcode endet mehr ausschließlich in der
      Konsole, ohne dass dies als bewusste Entscheidung kommentiert ist
- [ ] `npm run lint` und `npm test` bleiben grün

## Comments
