---
status: backlog
branch:
pr:
---

# Bezugsrahmen primary-catalogue wird nicht unterstützt

## Intent

Eine Query mit `scope="primary-catalogue"` kann die Engine nicht auflösen. Sie
verhält sich dabei korrekt — sie meldet `unresolvedScope` und wertet
fail-closed statt still falsch —, aber die Regel wirkt nicht.

27 Vorkommen in den Fixture-Katalogen: 7 in der `.gst`, 20 in
`Mercenaries (…).cat`.

Praktische Folge: Der einzige Katalogfall, der einen
`field="name"`-Modifikator mit einer `{this}`-Autor-Meldung verbindet, hängt an
genau diesem Bezugsrahmen und kann deshalb nie feuern. Die betroffene
E2E-Facette wurde ausgelassen und als Lücke dokumentiert; die Regel selbst
bleibt durch einen Modultest festgehalten.

Zu klären ist zuerst die Fachfrage, **was** `primary-catalogue` in einem
Mehr-Katalog-Datensatz (ADR 0032) bezeichnet — der Datensatz löst global by-id
auf und kennt keinen ausgezeichneten „primären" Katalog. Die Antwort gehört an
die Katalogdaten und an das Format-Dokument, nicht an eine Annahme.

Acceptance criteria:

1. Aus den Katalogdaten und dem Format-Dokument ist belegt, welchen
   Bezugsrahmen `primary-catalogue` bezeichnet.
2. Eine Query mit diesem Bezugsrahmen wird ausgewertet; die Diagnose
   `unresolvedScope` entfällt für sie.
3. Ein Szenario an echten Katalogdaten deckt den Fall ab (ADR 0033, verfasst
   vom Black-Box-Autor).
4. Die übrige E2E-Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt —, und jede geänderte Erwartung ist einzeln begründet.

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/77-bezugsrahmen-primary-catalogue-wird-nicht-unterstuetzt/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Gefunden in Slice 07 von Alt-Issue 75.
- **Kriterium 1 ist eine Fachfrage, keine Implementierungsaufgabe.** Sie geht
  an die Daten und das Format-Dokument; fällt die Antwort so aus, dass der
  Bezugsrahmen in diesem Datensatz keinen Gegenstand hat, ist das ein
  legitimes Ergebnis und die übrigen Kriterien ändern ihre Form.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
