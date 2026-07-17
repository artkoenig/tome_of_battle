Status: claimed
Type: feature
Blocked by: None

## Description
# PRD: Import-Revisionen

## Problem Statement / Bug Description
Der Bundle-Importer (`Importer.jsx`) zeigt beim Import von Spielsystem und
Katalogen keinerlei Revisionsinformation an. BattleScribes `revision`-Attribut
(ein Integer-Update-Zähler, kein Changelog) wird bereits geparst
(`getRevision()` in `xmlParser.js`) und pro Datei im Fork-Index (`catpkg.json`,
siehe [ADR 0014](../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md))
geführt, aber im Importer schlicht verworfen (`transformIndexToSystems` übernimmt
nur `id`/`name`). Der Nutzer kann daher vor dem Import nicht erkennen, welche
Datenversion er bekommt, und nicht unterscheiden zwischen "noch nicht
importiert", "lokal aktuell" und "lokal veraltet".

## Solution
Die Auswahlliste des Bundle-Importers zeigt pro Katalog-Zeile und pro
Spielsystem (`.gst`, beim Dropdown) die verfügbare Revision aus dem Fork-Index
an, zusammen mit einem Vergleich gegen die lokal gespeicherte Revision (falls
das System/der Katalog bereits importiert wurde). Der Vergleich nutzt dieselbe
"higher wins"-Semantik wie der stille Laufzeit-Updater
(`findOutdatedCatalogFiles` in `catalogUpdate.js`), damit die Anzeige nie vom
tatsächlichen Update-Verhalten abweicht (Single Source of Truth).

Zustandsmatrix (gilt identisch für Katalog- und Spielsystem-Zeilen):

| verfügbar | lokal | Zustand | Anzeige | Ton |
|---|---|---|---|---|
| Rev X | keine | neu | `Rev X · neu` | dezent |
| Rev X | = X | aktuell | `Rev X · aktuell` | dezent |
| Rev X | Y < X | Update verfügbar | `Rev X · lokal Y · Update verfügbar` | Akzent |
| Rev X | Y > X | eigener Upload höher | `Rev X · lokal Y` | neutral |
| Rev X | unbekannt (Alt-Daten ohne Revision) | Update verfügbar | `Rev X · lokal unbekannt · Update verfügbar` | Akzent |

## User Stories / Requirements
1. Als Nutzer möchte ich beim Import-Dialog pro Katalog die verfügbare
   Revision sehen, um die Datenversion vor dem Import einschätzen zu können.
2. Als Nutzer möchte ich die Revision des Spielsystems (.gst) separat vom
   Dropdown sehen, da Spielsystem und Kataloge unabhängig versioniert sind.
3. Als Nutzer möchte ich erkennen können, ob ein Katalog/System lokal bereits
   vorhanden und aktuell ist, ein Update verfügbar ist, oder er noch gar nicht
   importiert wurde, ohne die separate Liste der importierten Systeme
   abgleichen zu müssen.

## Technical Decisions
- Affected Modules: `src/components/Importer.jsx` (Anzeige),
  `src/db/catalogUpdate.js` (Wiederverwendung der bestehenden
  Revisionsvergleichs-Logik, keine Duplikation).
- Technical Clarifications / Architectural Decisions:
  - Kein neues ADR nötig — dies ist eine reine UI-Erweiterung auf Basis des in
    ADR 0014 bereits getroffenen Revisionsmodells.
  - Die Zustandsableitung (`neu | aktuell | outdated | ahead`) muss auf der
    bestehenden `isOutdated`-Vergleichsfunktion aus `catalogUpdate.js`
    aufbauen, nicht auf einer zweiten, eigenständigen Vergleichslogik.
- API Contracts / Data Models:
  - `transformIndexToSystems` liefert pro `gst`- und `catalogue`-Eintrag
    zusätzlich `revision` (bereits im Index vorhanden, nur bisher nicht
    durchgereicht).
  - Für den lokalen Vergleich wird die bereits geladene `systems`-Liste
    (aus `getAllSystems()`) herangezogen; kein neuer DB-Zugriff nötig.

## Testing Decisions
- Modules to Test: `Importer.jsx` (Transformation + Rendering),
  `catalogUpdate.js` (Wiederverwendung, keine neue Logik nötig, falls die
  bestehende Funktion exportierbar/wiederverwendbar ist).
- Test Interfaces (Seams):
  1. Reine Funktion, die aus verfügbarer und lokaler Revision den Zustand
     ableitet (`neu | aktuell | outdated | ahead`), aufbauend auf der
     bestehenden `isOutdated`-Logik. Unit-Test deckt alle fünf Fälle der
     Zustandsmatrix ab.
  2. `transformIndexToSystems`: Unit-Test, dass `revision` pro Spielsystem
     und Katalog durchgereicht wird.
  3. `Importer.test.jsx`: Gegeben ein Fork-Index und eine Liste bereits
     importierter Systeme, zeigt die Auswahlliste die erwarteten
     Revisions-Labels/Zustände pro Zeile.

## Out of Scope
- Kein Changelog oder Diff-Ansicht der inhaltlichen Änderungen zwischen
  Revisionen — nur die Revisionsnummer und der Update-Zustand.
- Keine Änderung am stillen Laufzeit-Update-Mechanismus selbst
  (`updateSystemFromCatalogIndex`) — dieser bleibt unverändert; die neue
  Anzeige liest ihn nur mit.
- Keine Anzeige von Revisionen für den (aktuell per `{false && ...}`
  deaktivierten) eigenen ZIP-Upload-Pfad.
- Keine Revisionsanzeige in der Liste der bereits importierten Spielsysteme
  unterhalb des Importers (nur die Auswahlliste vor dem Import ist Scope).

## Acceptance Criteria
- [ ]

## Comments
