Status: ready-for-agent
Blocked by: None

## Description
**Diese Arbeit findet außerhalb des App-Repos statt**, in
[artkoenig/Warhammer-Fantasy-6th-edition](https://github.com/artkoenig/Warhammer-Fantasy-6th-edition)
(Fork von `Ergofarg/Warhammer-Fantasy-6th-edition`, Default-Branch `master`). Ohne sie gibt es
nichts abzurufen — sie blockiert jede App-seitige Arbeit an Issue 06 und 07.

Der Fork ist angelegt und trägt Upstreams HEAD. Vier Teilaufgaben:

**1. Actions aktivieren.** GitHub deaktiviert Workflows in Forks standardmäßig (aktuell
`total_count: 0`). Ohne Aktivierung greift kein Gate.

**2. Lokale Fixes portieren, je mit Revisions-Bump.** 14 der 17 Dateien im App-Repo weichen
inhaltlich von Upstream ab, tragen aber **alle** noch Upstreams Revision — das Update-Signal
lügt also derzeit. Jeder portierte Fix braucht einen Bump. Dominierend ist neunmal derselbe
Magic-Item-Modifier (`04c325f`); der Brocken ist `Orcs and Goblins.cat`. `Dogs of War.cat`,
`Dwarfs.cat` und `Vampire Counts.cat` unterscheiden sich **nur** durch Whitespace — dort ist
nichts zu portieren.

**Die Whitespace-Bereinigung aus Issue 11 wird ausdrücklich nicht portiert.** Sie betraf
~11.000 Zeilen in allen 17 Dateien und wäre dauerhafte Konfliktfläche gegen jeden
Upstream-Merge, also gegen den Zweck des Forks. Sie wird stattdessen im Parser normalisiert
(Issue 02). Die Dateien bleiben byteidentisch zu Upstream, soweit sie keinen semantischen Fix
tragen.

**3. Revisions-Gate.** Bei jeder geänderten `.cat`/`.gst` muss die Revision **strikt höher**
sein als im Base-Commit. Das ersetzt Disziplin durch Struktur. Als eigenständiges Skript im
Fork-Repo prüfbar halten.

**4. `catpkg.json` auf `master` erzeugen.** Der offizielle Action `BSData/publish-catpkg`
läuft nur `on: release` und hängt den Index ans Release; wir brauchen ihn im Branch. Ein
generiertes Artefakt unter Versionskontrolle ist der bewusst akzeptierte Preis dafür, kein
Eigenformat zu erfinden.

**Der Fork erbt Upstreams CI und behält sie:** `ci.yml` (offizielles `BSData/check-datafiles`
— validiert Schema und Integrität bei jedem Push/PR, prüft aber **keine** Revisionen; unser
Gate ist ein Zusatz, kein Ersatz), `publish-catpkg.yml` und `chatops.yml` (erwartet ein
Secret, das wir nicht besitzen; läuft folgenlos leer).

Nicht Teil dieses Issues: Beiträge an Upstream einreichen. Der Fork *ermöglicht* PRs; das
Einreichen ist redaktionelle Arbeit.

Kontext: [PRD](../../../PRD-katalog-updates-und-roster-kompatibilitaet.md) („Ausgangslage des
Forks", Requirements 4+5, Seam 4),
[ADR 0014](../../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md).

## Acceptance Criteria
- [ ] GitHub Actions sind im Fork aktiviert und die geerbten Workflows laufen
- [ ] Alle inhaltlichen Fixes aus dem App-Repo sind portiert; jede geänderte Datei trägt eine
      höhere Revision als Upstream
- [ ] Die Whitespace-Bereinigung ist **nicht** portiert; Dateien ohne semantischen Fix sind
      byteidentisch zu Upstream
- [ ] Das Gate meldet rot bei geänderter Datei ohne Bump, grün mit Bump, und ignoriert
      unveränderte Dateien — jeweils belegt
- [ ] `catpkg.json` liegt auf `master`, folgt dem BSData-Schema und wird bei jeder Änderung
      automatisch neu erzeugt
- [ ] `catpkg.json` führt für alle 17 Dateien `id`, `name`, `type` und `revision`
- [ ] `check-datafiles` läuft grün über den portierten Stand

## Comments
