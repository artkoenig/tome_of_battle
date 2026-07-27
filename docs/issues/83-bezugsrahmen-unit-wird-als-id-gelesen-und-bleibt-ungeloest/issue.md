Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Der Bezugsrahmen `unit` wird von der Auswertung nicht als Schluesselwort
erkannt. Die bekannten Schluesselwoerter sind `roster`, `force`, `parent` und
`self` (`src/evaluator/model.js:109-114`); alles andere liest die Engine als Id.
`unit` benennt aber keine Id, also findet sie nichts und meldet einen ungeloesten
Bezugsrahmen.

Umfang: `scope="unit"` kommt in den Szenario- und Fixture-Daten des Evaluators
**131 Mal** vor. Jede dieser Regeln wirkt heute nicht.

Verschaerfend — und der eigentliche Grund, warum das ein Fehler und keine
Luecke ist: ein ungeloester Bezugsrahmen wertet derzeit nicht fail-closed,
sondern fail-open (siehe Issue 77). Die betroffenen Regeln fallen also nicht
sichtbar aus, sondern liefern still ein Ergebnis, als waere die Bedingung
erfuellt.

Zu klaeren ist zuerst die Fachfrage, **was** `unit` als Bezugsrahmen bezeichnet:
der naechste Vorfahre vom Eintrags-Typ `unit`, oder etwas anderes. Die Antwort
gehoert an die Katalogdaten und an das Format-Dokument
(`docs/battlescribe-data-format.md`), nicht an eine Annahme.

Vorbestehend. Gefunden als Nebenbefund bei der Architektur-Planung von
Main-Issue 76, dort nur festgehalten und ausdruecklich nicht mitgeaendert.

## Acceptance Criteria
- [ ] Aus den Katalogdaten und dem Format-Dokument ist belegt, welchen Bezugsrahmen `unit` bezeichnet.
- [ ] Eine Regel mit diesem Bezugsrahmen wird ausgewertet; die Diagnose "ungeloester Bezugsrahmen" entfaellt fuer sie.
- [ ] Die Menge der bekannten Bezugsrahmen-Schluesselwoerter ist an einer Stelle gepflegt und stimmt mit dem Format-Dokument ueberein.
- [ ] Ein Szenario an echten Katalogdaten deckt den Fall ab (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
- Bei der PO-Sichtung nachgemessen: 131 Vorkommen von scope="unit" in docs/testing und src/evaluator/__fixtures__. ScopeKeyword in src/evaluator/model.js:109-114 fuehrt nur ROSTER, FORCE, PARENT, SELF.
- Haengt mit Issue 77 zusammen, ist aber nicht dasselbe: 77 klaert den Bezugsrahmen primary-catalogue und behebt nebenbei das fail-open-Verhalten fuer ungeloeste Bezugsrahmen. Nach 77 faellt dieser Fehler hier sichtbar aus, statt still falsch zu wirken — behoben ist er damit nicht.
