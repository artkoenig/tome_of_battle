Status: superseded
Type: refactor
Blocked by: None

## Description

Herkunft: Standards-Review (Achse A) zu Issue 35.

**Geruch (Data Clump / Shotgun Surgery):** Dieselbe Gruppe von ~10 Werten reist
gemeinsam an jede Editor-Kindkomponente — `system`, `activeCatalogue`, `roster`,
`force`, `costTypeLabel`, `costLimitType`, `selectionCounts`, `addUnit`,
`removeUnit`, `updateSubSelection`, `onShowRule`. In `RosterEditor.jsx` taucht
dieses Bündel viermal auf (an `CategoryUnitAdder`, `ListRuleChecklist` und zwei
`UnitSelectionCard`-Aufrufe). Kommt ein Wert hinzu, muss er an jeder Aufrufstelle
einzeln eingefädelt werden.

**Empfohlene Behebung:** Das Bündel als ein benanntes Konzept fassen — ein
`editorContext`-Objekt oder ein echtes React-`Context`
(`<EditorProvider>` + `useEditorContext()`), das die Kinder sich selbst holen,
statt es Feld für Feld durchzureichen.

**Blast-Radius (bewusst als eigenes Issue abgetrennt):** betrifft `RosterEditor.jsx`,
`UnitSelectionCard.jsx`, `CategoryUnitAdder.jsx`, `SelectionConfigurator.jsx`,
`ListRuleChecklist.jsx` — editorweit, unabhängig von den Listenregeln.
Vorbestehendes Muster; nicht durch Issue 35 verursacht, dort nur fortgeführt.

## Acceptance Criteria
- [ ]

## Comments
- Bleibt eigenstaendig bestehen, ruht aber hinter Issue 39/02: der Entwurf sieht vor, das Prop-Buendel erst zu fassen, nachdem der redundante Zustand in der Zustandsgrenze bereinigt ist - sonst wuerde die Redundanz in einen Context zementiert. Die Analyse zum zweistufigen Provider (Force-Scoping) ist in der Sitzung vom 2026-07-20 erarbeitet und noch nicht in dieses Issue eingetragen.
- superseded: Auf Weisung des Maintainers geschlossen. KORREKTUR einer zuvor
  hier eingetragenen, falschen Begruendung: der Befund ist NICHT in Issue 39
  aufgegangen — kein Kind-Issue von 39 fasst das Prop-Buendel oder einen
  EditorContext an (geprueft). Was 39 enthaelt, ist lediglich die
  Voraussetzung: 39/02 bereinigt den redundanten Zustand in der
  Zustandsgrenze, ohne den eine Buendelung die Redundanz nur zementieren
  wuerde. Die eigentliche Umstrukturierung ist damit fallengelassen, nicht
  verschoben. Erhalten bleibt die Analyse vom 2026-07-20: ein einziger
  globaler EditorContext waere falsch, weil force und activeCatalogue pro
  Force variieren — der Provider muesste zweistufig sein. Wer den Befund
  wieder aufgreifen will, findet hier den Entwurf.
- Erneute Gesamtbewertung (2026-07-21): Der Data Clump besteht messbar fort - zwoelf identische Props an drei Aufrufstellen der Einheitenkarte in RosterEditor.jsx. Das Issue bleibt geschlossen. Die Neubewertung ist bewusst an Kind-Issue 43/01 (Zerlegung der Editor-Wurzelkomponente) gekoppelt: die Zerlegung reduziert die Zahl der Aufrufstellen, sodass der Nutzen eines - laut hiesiger Analyse zweistufigen - Providers danach anders ausfallen kann.
- Korrektur der Nummerierung im vorigen Kommentar: das gekoppelte Kind-Issue ist 43/02 (Zerlegung der Editor-Wurzelkomponente), nicht 43/01. 43/01 ist die Entfernung der Save-Badges.
