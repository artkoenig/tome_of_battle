Status: resolved
Type: fix
Blocked by: None

## Description

Befund K1. Beim Ausheben einer Einheit wird ein Selektionsobjekt gebaut und
anschließend an *jedes* Kontingent des Rosters angehängt — dasselbe Objekt mit
derselben Selektions-Id.

Solange ein Roster nur ein Kontingent hat, bleibt das folgenlos; die App legt
selbst genau eines an. Der `.ros`-Import erzeugt jedoch beliebig viele
Kontingente. In einem so importierten Roster hat ein einzelnes Ausheben dann
diese Folgen:

- die Einheit erscheint in jedem Kontingent
- Punkte und Kategoriezähler fallen entsprechend vervielfacht aus
- dieselbe Selektions-Id existiert mehrfach, wodurch jede Suche oder Ersetzung
  über die Id nur den ersten Treffer erwischt — Bearbeiten trifft dann das
  falsche Objekt, Entfernen löscht mehrere Einträge auf einmal

Das Ausheben muss stattdessen genau ein Kontingent adressieren: das der aktiven
Ansicht, ersatzweise das erste des Rosters.

## Acceptance Criteria
- [ ] In einem Roster mit mehreren Kontingenten landet eine ausgehobene Einheit in genau einem Kontingent
- [ ] Punkte- und Kategoriezähler steigen dabei um genau den Wert einer Einheit
- [ ] Selektions-Ids bleiben roster-weit eindeutig; Bearbeiten und Entfernen wirken auf genau die gemeinte Einheit
- [ ] Ein Regressionstest deckt den Mehr-Kontingent-Fall ab und schlägt gegen den alten Stand fehl
- [ ] Das Verhalten bei genau einem Kontingent bleibt unverändert

## Comments
- addUnit adressiert jetzt genau ein Kontingent (Ziel-Id, ersatzweise das erste); ForceEditorSection bindet das Kontingent der Sektion an das Ausheben. Regressionstests fuer den Mehr-Kontingent-Fall in useRoster.test.js und ForceEditorSection.test.jsx.
