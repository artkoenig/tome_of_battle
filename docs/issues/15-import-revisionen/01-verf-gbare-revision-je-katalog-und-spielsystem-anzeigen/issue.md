Status: resolved
Type: feature
Blocked by: None

## Description
Der Fork-Katalogindex (`catpkg.json`) führt pro Datei bereits eine `revision`
(Integer-Update-Zähler, siehe [ADR 0014](../../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)),
aber der Bundle-Importer verwirft sie: `transformIndexToSystems` in
`Importer.jsx` übernimmt pro Eintrag nur `id`/`name`. In der Auswahlliste vor
dem Import ist die Datenversion damit unsichtbar.

`transformIndexToSystems` reicht `revision` pro Spielsystem- und
Katalog-Eintrag durch. Die Auswahlliste zeigt sie an: pro Katalog-Checkbox-Zeile
neben dem Namen, und für das Spielsystem separat beim Dropdown (Spielsystem
und Kataloge sind unabhängig versioniert). Format: `Rev X`.

Kein Vergleich mit lokal gespeicherten Daten in diesem Issue — das ist
[02-vergleich-lokal-verf-gbar-mit-zustandsanzeige](../02-vergleich-lokal-verf-gbar-mit-zustandsanzeige/issue.md).

## Acceptance Criteria
- [ ] `transformIndexToSystems` gibt für jedes Spielsystem-Objekt (`gst`) die
      `revision` aus dem entsprechenden Index-Eintrag zurück.
- [ ] `transformIndexToSystems` gibt für jeden Katalog-Eintrag (`catalogues`)
      die `revision` aus dem entsprechenden Index-Eintrag zurück.
- [ ] Fehlt ein Index-Eintrag die `revision` (z. B. unvollständiger/älterer
      Index), bricht die Transformation nicht ab; die Zeile zeigt keine
      Revision an statt eines Fehlers.
- [ ] In der Auswahlliste zeigt jede Katalog-Zeile ihre verfügbare Revision
      (`Rev X`) neben dem Namen.
- [ ] Beim Spielsystem-Dropdown wird die Revision des aktuell gewählten
      Spielsystems (`.gst`) sichtbar angezeigt.
- [ ] Wechselt der Nutzer das Spielsystem im Dropdown, aktualisiert sich die
      angezeigte Spielsystem-Revision entsprechend.
- [ ] Unit-Test für `transformIndexToSystems`: `revision` wird pro Spielsystem
      und Katalog korrekt durchgereicht (inkl. Fall ohne `revision`-Feld im
      Index-Eintrag).
- [ ] `Importer.test.jsx`: Gegeben ein Fork-Index mit Revisionen, zeigt die
      gerenderte Auswahlliste die erwarteten `Rev X`-Labels pro Katalog-Zeile
      und beim Spielsystem-Dropdown.

## Comments
- transformIndexToSystems reicht revision fuer gst und jeden Katalog durch; Bundle-Importer zeigt 'Rev X' pro Katalog-Zeile und fuer das aktuell gewaehlte Spielsystem (aktualisiert bei Dropdown-Wechsel). Fehlende revision wirft nicht, sondern zeigt kein Label. Unit-Tests fuer transformIndexToSystems und Rendering-Tests in Importer.test.jsx ergaenzt; Suite gruen.
