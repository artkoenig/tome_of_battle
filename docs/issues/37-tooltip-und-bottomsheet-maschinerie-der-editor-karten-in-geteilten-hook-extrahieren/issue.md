Status: needs-triage
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
