Status: superseded
Type: refactor
Blocked by: None

## Description

Herkunft: Standards-Review (Achse A) zu Issue 35.

**Geruch (Duplizierter Code):** Die Tooltip-/Info-Maschinerie —
`activeInfo`/`hoveredInfo`-State, `handleMouseEnter`/`handleMouseMove`/
`handleMouseLeave`, `GothicTooltip` und der `BottomSheet`-Info-Block — existiert
nahezu wortgleich in mehreren Editor-Komponenten (`UnitSelectionCard.jsx` und die
im Zuge von Issue 35 neu entstandene `ListRuleChecklist.jsx`). oxlint hat keine
Duplikat-Regel, das statische Tor übersieht es daher.

**Empfohlene Behebung:** In einen geteilten Hook (z. B. `useCardTooltip`) und/oder
eine kleine gemeinsame Komponente extrahieren, sodass jede Editor-Karte ihn nutzt
statt ihn zu wiederholen.

**Blast-Radius (bewusst als eigenes Issue abgetrennt):** fasst die vorbestehende
Maschinerie in `UnitSelectionCard.jsx` an — über die Listenregeln hinaus.
Vorbestehendes Muster; nicht durch Issue 35 verursacht.

Hinweis: Bei Issue 35 wird vermieden, das Tooltip-Duplikat in der neuen
`ListRuleChecklist.jsx` überhaupt erst einzuführen, soweit möglich.

## Acceptance Criteria
- [ ]

## Comments
- Bleibt eigenstaendig bestehen; nicht in Issue 39 enthalten. Befund weiterhin zutreffend (Tooltip-Maschinerie parallel in UnitSelectionCard.jsx und ListRuleChecklist.jsx). Beruehrt dieselben Dateien wie der offene i18n-Pull-Request.
- superseded: Auf Weisung des Maintainers geschlossen. KORREKTUR einer zuvor
  hier eingetragenen, falschen Begruendung: der Befund ist NICHT in Issue 39
  aufgegangen — kein Kind-Issue von 39 fasst die Tooltip-Maschinerie an
  (geprueft; 39/04 betrifft App.jsx, 39/10 nur Inline-Styles). Der Befund war
  zum Zeitpunkt der Schliessung weiterhin zutreffend: die Maschinerie liegt
  unveraendert doppelt in UnitSelectionCard.jsx und ListRuleChecklist.jsx.
  Er ist damit bewusst fallengelassen, nicht verschoben. Empfohlene Loesung,
  falls er wieder aufgegriffen wird: Extraktion in einen geteilten Hook.
