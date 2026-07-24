Status: resolved
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
- Conditions und Repeats zählen jetzt über den Query-Kern (measureOver): neuer COUNT_BUCKET-Anker plus resolveSubtreeAnchor/resolveContainerAnchor tragen den aggregierten bzw. instanz-/parent-gebundenen Zähler. Die zwei Ziel-Matcher (createEntryInstanceMatcher + createTargetSelectionMatcher) sind zu einem vereinigt, per Optionen matchCategoryMembership/matchUnitsAsModels gesteuert; entryHasCategoryLink lebt nun als SSOT im Kern. Regression gefixt: resolveCountBucketAnchor normalisiert null-Zähltabellen (entryVisibility reicht forceCategoryCounts:null durch) auf leer — vorher Null-Zugriff beim Roster-Render, nur vom Puppeteer-E2E erkannt; mit gezielten Unit-Tests (Kern + Adapter) abgedeckt.
