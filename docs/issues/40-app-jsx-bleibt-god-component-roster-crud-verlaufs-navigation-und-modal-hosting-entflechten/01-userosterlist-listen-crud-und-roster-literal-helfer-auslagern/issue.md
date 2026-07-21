Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Das Roster-Listen-CRUD verlässt `App.jsx` und wird ein eigener Hook. Betroffen:
Anlegen, Öffnen, Abspielen, Umbenennen, Löschen, Import und Export einer ganzen
Roster-Liste, samt dem Muster „nach jeder Mutation neu laden" und der
Fehlermeldungs-Zuordnung. Das heute inline in `handleCreateRoster` aufgebaute
Roster-Literal (Objektaufbau inkl. Default-Kostenart und Initial-Spielzustand)
wandert in einen reinen Helfer neben `src/utils/rosterDefaults.js`.

DB-Zugriff weiterhin ausschließlich über `src/db/database.js` (ADR-0002). Der
Hook heißt **nicht** `useRoster` (Name belegt durch den Editor-Hook). Kein neues
Feature — insbesondere kein „Duplizieren".

## Acceptance Criteria
- [ ] Ein reiner Helfer (neben `rosterDefaults.js`) erzeugt das Roster-Objekt;
  `App.jsx` baut kein Roster-Literal mehr inline auf.
- [ ] Ein Hook (`useRosterList` o. ä., **nicht** `useRoster`) kapselt das
  Listen-CRUD; `App.jsx` ruft ihn nur noch auf.
- [ ] DB-Zugriff nur über `database.js`; kein direkter IndexedDB-Zugriff.
- [ ] Helfer und Hook haben eigene Unit-Tests; `src/App.test.jsx` bleibt
  unverändert grün.

## Comments
