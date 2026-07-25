Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Die Auswertungs-Engine erhält das vollständige, aus `.ros` geparste Roster,
nicht länger ein eigens definiertes, reduziertes Roster. Übergeben werden die
Auswahl-Struktur der Armee **und** die eingestellten Kostengrenzen je Kostenart
(die Zuordnung Kostenart → eingestellter Grenzwert).

Dieser Slice stellt nur die Durchreichung her: das vollständige Roster inklusive
seiner Kostengrenzen kommt vollständig und ohne Verlust bei der Engine an. Die
Kostengrenzen werden hier noch nicht ausgewertet (das leisten die
Folge-Slices). Für jede Armee ohne Bezug auf die Kostengrenze bleibt das
Auswertungsergebnis unverändert — dieser Slice ist ein verhaltenserhaltender
Umbau der Eingabe.

Hintergrund: Bisher erreicht die eingestellte Punktgrenze die Engine gar nicht,
weil die Engine nur eine budgetfreie Kurzform des Rosters entgegennimmt. Ohne
diese Durchreichung kann keine budget-abhängige Auswertung entstehen.

## Acceptance Criteria
- [ ] Eine aus `.ros` geparste Armee wird von der Engine ausgewertet, ohne dass
      die Auswahl-Struktur über eine budgetfreie Zwischenform verkürzt wird.
- [ ] Die eingestellten Kostengrenzen der Armee (je Kostenart) stehen der Engine
      bei der Auswertung zur Verfügung.
- [ ] Für Armeen ohne Bezug auf die Kostengrenze liefert die Auswertung dasselbe
      Ergebnis wie zuvor (keine Verhaltensänderung).

## Comments
