Status: ready-for-agent
Type: chore
Blocked by: [03]

## Description

Berechnet effektive Werte, indem Modifikatoren **in Dokumentreihenfolge** auf eine
frische Kopie der Basisdefinitionen angewendet werden (nie kumulativ über Pässe).
Ein Modifikator feuert nur, wenn **alle** seine Bedingungen halten; sein
Wiederholungsfaktor kommt aus den Wiederholungs-Zählungen. Wirkungen umfassen
effektive Kosten, Kategorien, Grenzwerte, Sichtbarkeit und bedingte Hinweise.
Bedingungen und Wiederholungen werden über dasselbe Query-Primitiv (Slice 03)
beantwortet.

## Acceptance Criteria
- [ ] Ein Modifikator, dessen Bedingungen halten, ändert den anvisierten effektiven
      Wert (Kosten/Kategorie/Grenzwert/Sichtbarkeit/Hinweis); einer, dessen
      Bedingungen nicht halten, lässt den Basiswert unverändert.
- [ ] Modifikatoren auf dasselbe Ziel wirken strikt in Dokumentreihenfolge, und die
      Reihenfolge ist am Ergebnis beobachtbar.
- [ ] Eine Wiederholung multipliziert die Modifikator-Wirkung mit der ganzzahligen
      Wiederholungszahl; Wiederholungszahl 0 lässt den Modifikator inaktiv.
- [ ] Die Zählung stützt sich auf **effektive** Kategorien (nach kategorie-ändernden
      Modifikatoren), nicht auf Basis-Kategorien.
- [ ] Eine erneute Modifikator-Anwendung von den Basiswerten aus liefert dieselben
      effektiven Werte (keine kumulative Drift innerhalb einer Auswertung).

## Comments
