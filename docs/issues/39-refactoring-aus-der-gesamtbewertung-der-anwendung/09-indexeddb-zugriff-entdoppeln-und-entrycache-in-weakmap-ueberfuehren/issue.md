Status: resolved
Type: refactor
Blocked by: None

## Description

**Geruch:** DRY-Verstoß und Leaky Abstraction — beide in der Datenzugriffs-
schicht.

### Teil A — Zehnfach duplizierter Datenbank-Wrapper

Zehn Funktionen der Datenbankschicht haben denselben Rumpf: Datenbank öffnen,
Transaktion beginnen, Store holen, Anfrage stellen, Erfolg und Fehler
verdrahten. Sie unterscheiden sich nur in Storename, Modus und der einen Zeile,
welche die Anfrage stellt.

Nebenwirkung mit Laufzeitfolge: **jede einzelne Operation öffnet eine neue
IndexedDB-Verbindung.** Beim Laden aller Daten für einen Bildschirmaufbau sind
das mehrere Verbindungen hintereinander.

### Teil B — Auflösungsindex am persistierbaren Objekt

Der Katalog-Resolver hängt seinen Auflösungsindex als Feld direkt an das
System- beziehungsweise Katalogobjekt — dieselben Objekte, die beim Speichern
nach IndexedDB geschrieben werden. Dass die Indexierung sich beim Aufbau selbst
ausklammern muss, ist der Beleg für die Kontamination.

Heute geht das gut, weil nur frisch geparste Systeme gespeichert werden; sobald
jemand ein bereits aufgelöstes System speichert, landet der vollständige Index
in der Datenbank — Maps sind strukturell klonbar, es fällt also nicht einmal
als Fehler auf. Zusätzlich inkonsistent: die eine Lookup-Funktion invalidiert
den Index über ein Quellenfeld, die andere gar nicht.

**Vorgeschlagene Behebung:** Ein Helfer, der Öffnen, Transaktion und Store
kapselt, sodass die zehn Funktionen auf je eine Zeile schrumpfen, plus eine
einmalig aufgelöste Verbindung. Für den Index eine `WeakMap` im Modul-Scope
statt eines Feldes am Objekt — das löst Persistenzrisiko und Invalidierung in
einem Zug.

## Acceptance Criteria
- [ ] Öffnen, Transaktion und Store sind in einem Helfer gekapselt; die
      Datenzugriffsfunktionen enthalten keine wiederholte Verdrahtung mehr
- [ ] Die Datenbankverbindung wird einmalig aufgelöst und wiederverwendet
- [ ] Der Auflösungsindex hängt nicht mehr am System- oder Katalogobjekt
- [ ] Ein Test belegt, dass ein gespeichertes System keinen Auflösungsindex
      enthält
- [ ] Die Invalidierung des Index verhält sich für beide Lookup-Wege gleich
- [ ] `npm run lint` und `npm test` bleiben grün; kein verändertes Verhalten

## Comments
- Datenzugriff auf einen gemeinsamen Store-Request-Helfer plus einmalig aufgeloeste, wiederverwendete Verbindung reduziert; der Auflaesungsindex des Katalog-Resolvers liegt jetzt in modulweiten WeakMaps statt als Feld am System-/Katalogobjekt, mit identischer Invalidierungsregel fuer beide Lookup-Wege.
