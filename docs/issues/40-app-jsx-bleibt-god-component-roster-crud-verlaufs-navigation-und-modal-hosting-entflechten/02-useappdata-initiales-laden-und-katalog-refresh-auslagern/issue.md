Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Das initiale Laden der App-Daten (Systeme + Roster aus IndexedDB), die
Katalog-Hintergrund-Aktualisierung und die Behandlung eines frisch importierten
Systems verlassen `App.jsx` und werden ein eigener Hook. Dieser Belang fehlte in
der ursprünglichen Sechser-Liste des Befunds; er hängt heute eng am CRUD, ist
aber ein eigener Grund zur Änderung (Laden/Migration statt Nutzer-CRUD).

DB-Zugriff weiterhin nur über `database.js` (ADR-0002). Verhalten unverändert:
gleiche Ladereihenfolge, gleiches Fehlerverhalten, gleicher Hintergrund-Refresh.

## Acceptance Criteria
- [ ] Ein Hook (`useAppData` o. ä.) kapselt initiales Laden, Hintergrund-
  Katalog-Refresh und System-Import; `App.jsx` ruft ihn nur noch auf.
- [ ] Lade- und Fehlerverhalten sind unverändert; DB-Zugriff nur über
  `database.js`.
- [ ] Der Hook hat eigene Unit-Tests; `src/App.test.jsx` bleibt unverändert grün.

## Comments
