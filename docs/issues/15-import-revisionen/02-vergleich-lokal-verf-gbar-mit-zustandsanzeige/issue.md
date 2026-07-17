Status: resolved
Type: feature
Blocked by: [01]

## Description
Aufbauend auf [01-verf-gbare-revision-je-katalog-und-spielsystem-anzeigen](../01-verf-gbare-revision-je-katalog-und-spielsystem-anzeigen/issue.md)
(zeigt nur die verfügbare Revision) ergänzt dieses Issue den Vergleich mit der
lokal gespeicherten Revision, damit der Nutzer ohne Blick in die separate
Liste importierter Systeme erkennt, ob ein Katalog/System neu, aktuell,
veraltet oder mit einer eigenen höheren Revision lokal vorhanden ist.

Der Vergleich nutzt dieselbe "higher wins"-Semantik wie der stille
Laufzeit-Updater (`isOutdated` / `findOutdatedCatalogFiles` in
`catalogUpdate.js`, siehe [ADR 0014](../../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)) —
keine zweite, eigenständige Vergleichslogik. Für den lokalen Wert wird die
bereits geladene `systems`-Liste (`getAllSystems()`) herangezogen, kein neuer
DB-Zugriff.

Zustandsmatrix (gilt identisch für Katalog- und Spielsystem-Zeilen):

| verfügbar | lokal | Zustand | Anzeige | Ton |
|---|---|---|---|---|
| Rev X | keine | neu | `Rev X · neu` | dezent |
| Rev X | = X | aktuell | `Rev X · aktuell` | dezent |
| Rev X | Y < X | Update verfügbar | `Rev X · lokal Y · Update verfügbar` | Akzent |
| Rev X | Y > X | eigener Upload höher | `Rev X · lokal Y` | neutral |
| Rev X | unbekannt (Alt-Daten ohne Revision) | Update verfügbar | `Rev X · lokal unbekannt · Update verfügbar` | Akzent |

## Acceptance Criteria
- [ ] Eine reine Funktion leitet aus (verfügbare Revision, lokale Revision
      oder "nicht vorhanden") einen Zustand ab: `neu | aktuell | outdated |
      ahead`. Sie baut auf der bestehenden `isOutdated`-Vergleichsfunktion aus
      `catalogUpdate.js` auf (kein eigenständiger Vergleich).
- [ ] Unit-Test deckt alle fünf Fälle der Zustandsmatrix ab, inklusive des
      Falls "lokal vorhanden, aber ohne `revision`-Feld" (Alt-Daten vor
      Revisions-Tracking).
- [ ] In der Auswahlliste zeigt jede Katalog-Zeile zusätzlich zur verfügbaren
      Revision den abgeleiteten Zustand gemäß der Matrix (Text + Ton).
- [ ] Die Spielsystem-Zeile beim Dropdown zeigt denselben Zustandsvergleich
      für das `.gst`.
- [ ] Der Zustand wird pro Katalog/System aus der bereits geladenen
      `systems`-Liste (`getAllSystems()`) ermittelt, ohne zusätzlichen
      DB-Zugriff.
- [ ] Wechselt der Nutzer das Spielsystem im Dropdown, aktualisieren sich die
      Zustände der angezeigten Kataloge entsprechend dem neu gewählten
      System.
- [ ] `Importer.test.jsx`: Gegeben ein Fork-Index und eine Liste bereits
      importierter Systeme mit unterschiedlichen Revisionsverhältnissen,
      zeigt die Auswahlliste je Zeile den erwarteten Zustandstext.

## Comments
- Neue reine Funktion deriveRevisionState in catalogUpdate.js leitet den Zustand (neu|aktuell|outdated|ahead) aus verfügbarer vs. lokal gespeicherter Revision ab und baut dabei auf dem bestehenden isOutdated ('higher wins') auf – keine zweite Vergleichslogik. Importer.jsx annotiert Spielsystem- und jede Katalog-Zeile zusätzlich zur Revision mit dem Zustandstext + Ton gemäß Matrix (dezent/Akzent/neutral); der lokale Wert kommt aus der bereits via getAllSystems() geladenen systems-Liste ohne neuen DB-Zugriff und aktualisiert sich beim Dropdown-Wechsel. Unit-Tests decken alle fünf Matrix-Zeilen (inkl. Alt-Daten ohne revision) ab; Importer.test.jsx prüft die Zustandstexte je Zeile und die Neuberechnung nach Systemwechsel.
