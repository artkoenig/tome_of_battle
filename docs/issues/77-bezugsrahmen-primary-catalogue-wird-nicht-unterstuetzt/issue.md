Status: needs-triage
Type: fix
Blocked by: None

## Description

Eine Query mit `scope="primary-catalogue"` kann die Engine nicht aufloesen. Sie
verhaelt sich dabei korrekt — sie meldet `unresolvedScope` und wertet
fail-closed statt still falsch — aber die Regel wirkt nicht.

**27 Vorkommen in den Fixture-Katalogen**: 7 in der `.gst`, 20 in
`Mercenaries (…).cat`.

Gefunden in Slice 75/07. Praktische Folge dort: der einzige Katalogfall, der
einen `field="name"`-Modifikator mit einer `{this}`-Autor-Meldung verbindet,
haengt an genau diesem Bezugsrahmen und kann deshalb nie feuern. Die betroffene
E2E-Facette wurde ausgelassen und als Luecke dokumentiert; die Regel selbst
bleibt durch einen Modultest festgehalten.

Zu klaeren ist zuerst die Fachfrage, **was** `primary-catalogue` in einem
Mehr-Katalog-Datensatz (ADR-0032) bezeichnet — der Datensatz loest global
by-id auf und kennt keinen ausgezeichneten „primaeren" Katalog. Die Antwort
gehoert an die Katalogdaten und an das Format-Dokument, nicht an eine Annahme.

## Acceptance Criteria
- [ ] Aus den Katalogdaten und dem Format-Dokument ist belegt, welchen Bezugsrahmen `primary-catalogue` bezeichnet.
- [ ] Eine Query mit diesem Bezugsrahmen wird ausgewertet; die Diagnose `unresolvedScope` entfaellt fuer sie.
- [ ] Ein Szenario an echten Katalogdaten deckt den Fall ab (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
