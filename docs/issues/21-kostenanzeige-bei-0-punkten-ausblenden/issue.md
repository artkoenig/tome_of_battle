Status: resolved
Type: fix
Blocked by: None

## Description
Überall wo ein reiner Punktwert (Item-Kosten oder Gesamtsumme einer Einheit)
angezeigt wird, soll die Anzeige bei einem Wert von 0 komplett ausgeblendet
werden statt "0 Pkt." zu zeigen. Budget-Fortschrittsanzeigen der Form
"aktuelle Punkte / Punktelimit" sind davon ausdrücklich NICHT betroffen und
bleiben immer sichtbar, auch bei 0 aktuellen Punkten.

Referenzmuster (bereits korrekt implementiert):
- `src/components/editor/OptionGroup.jsx:387`
- `src/components/editor/SelectionConfigurator.jsx:300`
  (`{points > 0 && <span>+{points} Pkt.</span>}`)

Explizit außerhalb des Scopes (Budget-Fortschritt, bleibt unverändert):
- `src/components/editor/RosterSidebar.jsx:19`
- `src/components/RosterDashboard.jsx:220-221`
- `src/components/editor/AutoFillSuggestions.jsx` (Restbudget-Anzeigen;
  vorgeschlagene Combos/Actions sind durch bestehende Filter nie 0 Pkt.)

## Acceptance Criteria
- [ ] `CategoryUnitAdder.jsx` (Popup "Einheit hinzufügen"): Kosten werden nur
      angezeigt, wenn `points > 0` (statt "0 Pkt." zu zeigen).
- [ ] `UnitSelectionCard.jsx` (Gesamtpunktwert im Einheiten-Karten-Header):
      Anzeige wird ausgeblendet, wenn `displayPoints === 0`.
- [ ] `PlayUnitDetails.jsx` (Gesamtpunktwert im Play-Modus): Anzeige wird
      ausgeblendet, wenn der Wert 0 ist.
- [ ] Bestehende Tests bleiben grün; keine Regression bei Budget-Anzeigen.

## Comments
