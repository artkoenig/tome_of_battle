Status: ready-for-agent
Type: refactor
Blocked by: [01]

## Description

Die PRD stellt die Caching-Entscheidung bewusst zurueck und macht eine Messung
zur Abnahmebedingung. Dieser Slice baut das Messverfahren und nimmt die
**Grundlinie am heutigen, kleinen Auswertungsbaum** auf.

Die Reihenfolge ist das Fragile daran: laeuft die Messung erst nach Slice 05,
ist der Vergleichswert unwiederbringlich weg. Deshalb steht sie hier und nicht
am Ende.

## Acceptance Criteria
- [ ] Es gibt ein reproduzierbares Verfahren, das an echten Katalogdaten misst, wie lange eine Auswertung braucht — mit getrennt ausgewiesenem Anteil fuer die Vorbereitung des Datensatzes, die iterierte Auswertung und den Nach-Durchlauf.
- [ ] Das Verfahren meldet zusaetzlich, wie die Fixpunktschleife ausgegangen ist (Rundenzahl, ggf. Zykluslaenge).
- [ ] Die Grundlinie am heutigen Stand ist aufgenommen und im Issue festgehalten, sodass Slice 08 dagegen vergleichen kann.
- [ ] Die Schwellen stehen vorab fest und sind dokumentiert: 100 ms fuer eine interaktive Auswertung; uebersteigt der Vorbereitungsanteil 50 %, faellt die Fassade zweistufig aus.
- [ ] Das Verfahren ist kein Produktivcode und wird nicht mit ausgeliefert.

## Comments
