Status: ready-for-agent
Type: refactor
Blocked by: [01]

## Description
Führt die beiden übrigen Query-Ausprägungen — Bedingungen (Conditions) und
Wiederholungen (Repeats) — über denselben Zähl-Kern wie die Grenzen (siehe
[ADR 0029](../../../adr/0029-zentrale-query-engine-fuer-constraint-auswertung.md)).
Damit zählt jede Query im Roster über einen einzigen Pfad, und die bisher zwei
getrennten „ist Auswahl eine Instanz des Ziels?"-Prüfungen werden eine.

Beobachtbares Verhalten: bedingt veränderte Grenzwerte und wiederholungs-
gesteuerte Modifier ergeben dieselben effektiven Werte wie zuvor — jetzt aus
einer gemeinsamen Zählung, spec-konform.

## Acceptance Criteria
- [ ] Ein bedingt gehobener Grenzwert (Modifier mit erfüllter Bedingung, z. B. Gruppen-Max steigt bei Rüstung + Schild) und ein bedingt gesenkter (z. B. Waffen-Max wird 0 bei aktivem Battle Standard Bearer) ergeben den korrekten effektiven Grenzwert.
- [ ] Ein Wiederholungs-Modifier (z. B. +1 Kontingent-Slot je 1000 Punkte) wird die korrekte Anzahl Male angewendet.
- [ ] Eine Bedingung, die eine Force-Instanz prüft, wird in beiden Kodierungen erkannt (`scope=<forceId>` mit leerem `childId`, und `scope=force` mit `childId=<forceId>`).
- [ ] Eine kategoriezählende Bedingung liest die Kategorie-Zähler korrekt über alle Forces aggregiert, nicht isoliert pro Force.

## Comments
