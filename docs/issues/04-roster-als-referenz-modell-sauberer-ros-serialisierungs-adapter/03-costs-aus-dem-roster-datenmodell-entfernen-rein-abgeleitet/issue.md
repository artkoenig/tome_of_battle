Status: ready-for-agent
Blocked by: [01]

## Description

Das `costs`-Feld wird aus dem `Selection`-Datenmodell entfernt (`types.js`). Die
Roster-Erzeugung schreibt keine Kosten mehr in Auswahlen; `syncRosterSelections-
WithSystem` synchronisiert keine Kosten mehr (nur noch `name`). UI-Stellen, die
`selection.costs` direkt lesen, werden auf die abgeleitete Berechnung (Issue 01)
umgestellt.

Migration ist **nicht-destruktiv**: ein in bestehenden gespeicherten Rostern noch
vorhandenes `costs`-Feld wird ignoriert und beim nächsten Speichern lazy
weggelassen. Kein Schema-Bruch, kein Datenverlust.

`name` bleibt bewusst erhalten (Anzeige ohne Katalog-Auflösung, Resilienz bei
fehlendem System).

## Acceptance Criteria
- [ ] `Selection` enthält kein `costs` mehr; neu erzeugte/gespeicherte Roster
      schreiben es nicht.
- [ ] Bestehende Roster mit `costs` laden ohne Fehler; Kosten/Anzeige korrekt.
- [ ] `name` bleibt erhalten und wird weiterhin synchronisiert.
- [ ] Editor- und Play-Ansicht zeigen unveränderte Kosten (aus Ableitung).
- [ ] Betroffene Tests angepasst; `docs`/CLAUDE.md an ADR-0011 angeglichen.

## Comments
