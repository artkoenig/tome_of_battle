Status: ready-for-agent
Type: chore
Blocked by: [02, 04, 06]

## Description

Vervollständigt die zweite Sicht des Berichts. Je auswählbarem Slot (reale Knoten
plus Pflicht-Phantomslots) entsteht ein **Fähigkeitsdatensatz**: effektives
min/max, aktueller Stand, Restspielraum, Pflicht-/Gesperrt-/Versteckt-Flag,
bedingte Hinweise. Dazu die reinen **UI-Projektions-Lookups** (auswählbar,
Restspielraum, offene Pflichtslots), die nur den Bericht lesen. Alle während der
Auswertung entstandenen **Diagnosen** (Auflösung, Nichtkonvergenz, Null-Nenner)
sind im Bericht gesammelt.

## Acceptance Criteria
- [ ] Jeder auswählbare Slot weist effektives min/max, Stand, Restspielraum und
      Pflicht-/Gesperrt-/Versteckt-Flag aus, konsistent zu den ausgewerteten Grenzen.
- [ ] Ein Slot an seinem Max wird als gesperrt gemeldet; ein Slot unter seinem Min
      als Pflicht-unerfüllt; ein versteckter Slot als versteckt.
- [ ] Von Modifikatoren erzeugte bedingte Hinweise erscheinen am betreffenden Slot.
- [ ] Die UI-Projektions-Lookups leiten sich rein aus dem Bericht ab und werten
      keine Regel erneut aus.
- [ ] Alle bei der Auswertung ausgelösten Diagnosen sind im Bericht enthalten.

## Comments
