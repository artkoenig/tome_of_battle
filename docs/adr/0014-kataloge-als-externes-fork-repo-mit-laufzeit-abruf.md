# 0014: Kataloge als externes Fork-Repo mit Laufzeit-Abruf

- **Status:** Accepted
- **Datum:** 2026-07-15
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Ergänzt [ADR 0002](0002-data-flow-and-indexeddb-storage.md) (Data Flow & IndexedDB), berührt [ADR 0006](0006-testing-and-automation.md) (Testing), [ADR 0011](0011-roster-referenzmodell-und-serialisierungs-adapter.md) (Roster-Referenzmodell)

## Kontext und Problemstellung

Die Katalogdaten (`.cat`/`.gst`) lagen bisher als Kopie im App-Repo unter
`public/catalogs/` und wurden mit dem App-Build ausgeliefert. Daraus folgten drei
Probleme:

1. **Datenfixes erreichen bestehende Nutzer nicht.** Ein importiertes System liegt
   dauerhaft in IndexedDB; die Migrations-Pipeline (ADR-0002 §6) parst nur das
   gespeicherte Roh-XML mit dem aktuellen Parser neu und holt **keine** neuen
   Katalogdaten nach. Ein korrigierter Punktwert erreicht nur, wer das System
   manuell neu importiert.
2. **Der Fork ist von seinem Upstream abgeschnitten.** Die Daten stammen aus
   [Ergofarg/Warhammer-Fantasy-6th-edition](https://github.com/Ergofarg/Warhammer-Fantasy-6th-edition)
   (Autor „Ergo Fargo"), wurden einmalig kopiert und seither nur lokal gefixt.
   Upstream-Verbesserungen zu übernehmen oder eigene Fixes zurückzugeben ist ohne
   echte Fork-Beziehung nicht praktikabel.
3. **Das `revision`-Attribut lügt.** Die Katalogdateien tragen BattleScribes
   `revision`-Attribut, das laut offizieller Doku das Update-Signal ist. Keiner
   unserer Datenfix-Commits hat es je hochgezählt: `Orcs and Goblins.cat` trägt
   `revision="12"` — identisch zu Upstream — obwohl mindestens fünf inhaltliche
   Fixes eingeflossen sind. Das Feld behauptet Gleichstand bei divergierten Daten.

Erschwerend: BattleScribe als Anwendung ist faktisch Abandonware, und der offizielle
Index-Dienst „AppSpot" (`BSData/bsdata`) ist seit 08/2025 archiviert. Die Daten
werden weiter gepflegt, primär für New Recruit — das ein Backend besitzt, das wir
laut ADR-0002 bewusst nicht haben.

## Entscheidungsfaktoren (Drivers)

- **Wirksamkeit von Datenfixes:** Ein korrigierter Katalog muss Nutzer erreichen,
  ohne dass sie etwas tun.
- **Upstream-Beziehung:** Fixes zurückgeben, Upstream-Änderungen übernehmen.
- **Ökosystem-Kompatibilität:** Keine Eigenformate erfinden, wo die Community
  bereits ein Schema definiert hat.
- **Backend-Freiheit:** ADR-0002 (reine Client-PWA) soll nicht gebrochen werden.
- **Roster-Integrität:** Ein Katalog-Update darf gespeicherte Listen nicht still
  beschädigen.

## Betrachtete Optionen

- **Option 1 (Status quo):** Kataloge im App-Repo gebündelt, manueller Reimport.
- **Option 2 (Fork + Build-Zeit-Bundling):** Fork als Pflege-Repo, App zieht ihn
  beim Build; ein Push triggert per `repository_dispatch` einen Redeploy.
- **Option 3 (Fork + Laufzeit-Abruf über die offizielle `.bsi`/Release-Kette).**
- **Option 4 (Fork + Laufzeit-Abruf über `raw.githubusercontent.com`).**

## Entscheidungsergebnis

Gewählte Option: **Option 4** — Die Katalogdaten ziehen in
[artkoenig/Warhammer-Fantasy-6th-edition](https://github.com/artkoenig/Warhammer-Fantasy-6th-edition)
um, einen echten Fork von `Ergofarg/Warhammer-Fantasy-6th-edition` (Default-Branch:
`master`). Die App ruft zur Laufzeit den Index und die geänderten Katalogdateien über
`raw.githubusercontent.com` ab und aktualisiert importierte Systeme still, wenn deren
Revision niedriger ist. Der Abruf aus dem Fork ist empirisch bestätigt:
`raw.githubusercontent.com` antwortet mit `access-control-allow-origin: *`.

**Option 3 scheidet aus zwei unabhängigen Gründen aus:**

1. **Kein CORS.** Die offizielle Auslieferung über GitHub-Release-Assets endet nach
   zwei Redirects auf einer zeitlich signierten Blob-URL
   (`release-assets.githubusercontent.com`), die **kein
   `access-control-allow-origin` sendet** (empirisch verifiziert). Eine Backend-lose
   Browser-PWA kann sie damit nicht laden. Die Kette wurde für den nativen
   BattleScribe-Client und den serverseitigen AppSpot-Index gebaut; für
   Browser-Clients existiert keine offizielle Lösung.
2. **Veraltete Daten.** Upstreams letztes Release ist `v1.2.3` (09/2023), `master`
   wurde zuletzt 11/2025 gepusht. Vier Dateien sind seither weitergezogen (Chaos,
   Lizardmen, Skaven, Vampire Counts). Das Release-`catpkg.json` beschreibt damit
   einen zwei Jahre alten Stand. Selbst mit einem Proxy wäre die Release-Kette die
   falsche Quelle — der Branch ist die aktuelle.

**Format ja, Auslieferung nein:** Wir übernehmen das offizielle Indexformat
`catpkg.json` ([BSData/schemas](https://github.com/BSData/schemas), erzeugt von
`BSData/publish-catpkg`), das pro Datei `id`, `name`, `type`, `revision` und
`sourceSha256` führt — aber unser Fork-CI committet es zusätzlich in den Branch,
weil der offizielle Action (`on: release`) es nur ans Release hängt. Ein generiertes
Artefakt unter Versionskontrolle ist der bewusst akzeptierte Preis dafür, kein
Eigenformat zu erfinden und ökosystem-kompatibel zu bleiben.

**Der Fork erbt Upstreams CI.** Mit dem Fork kommen drei Workflows:
`ci.yml` (offizielles [BSData/check-datafiles](https://github.com/BSData/check-datafiles):
kompiliert und validiert die Datendateien bei jedem Push/PR), `publish-catpkg.yml`
und `chatops.yml`. Sie bleiben erhalten — `check-datafiles` prüft Validität und
Integrität, aber **keine Revisionen**; unser Gate ist also ein Zusatz, kein Ersatz.
`chatops.yml` erwartet ein Secret (`SLASH_COMMAND_DISPATCH_TOKEN`), das wir nicht
besitzen; der Workflow läuft folgenlos leer. GitHub deaktiviert Actions in Forks
standardmäßig — sie müssen einmalig aktiviert werden, sonst greift kein Gate.

**Revision statt Hash, „higher wins":** Das Update-Signal ist ausschließlich das
`revision`-Attribut, verglichen mit **strikt größer** — exakt die offizielle
Semantik („if it's higher, the file will be updated"). Ein Content-Hash wurde
verworfen, obwohl er ohne Disziplin auskäme: Er ist byte-genau statt semantisch
(ein reiner Whitespace-Commit hätte alle Clients zum Neu-Import gezwungen), und die
fehlende Disziplin wird stattdessen strukturell durch ein CI-Gate erzwungen, das
bei geänderter `.cat`/`.gst` eine strikt höhere Revision als im Base-Commit
verlangt. Dass das Feld upstream *gelebt* wird, stützt die Wahl: Ergo Fargo hat es
seit dem letzten Release diszipliniert gepflegt (Chaos 9→11, Lizardmen 6→7,
Skaven 3→4, Vampire Counts 8→10). Es ist kein totes Relikt — allein unsere Kopie
hat es verrotten lassen. Eine konkurrierende Revision aus einem Upstream-Merge
fliegt als Git-Konflikt in genau dieser Zeile auf und wird bewusst entschieden.

**Formatierung wird normalisiert, nicht bereinigt:** Die Katalogdateien bleiben
byteidentisch zu Upstream; Whitespace in `name`-Attributen wird stattdessen **beim
Parsen** an der Systemgrenze getrimmt. Das kehrt die datenseitige Bereinigung aus
Issue 11 um, deren Akzeptanzkriterium („kein `trim()` als Workaround") damit überholt
ist — faktisch war es das bereits durch `normalizeName()` (Issue 07), das beim
Regel-Lookup alles außer `[a-z0-9]` verwirft und Whitespace-Unterschiede damit ohnehin
ignoriert. Begründung: Der Cleanup betraf ~11.000 Zeilen in allen 17 Dateien und wäre im
Fork eine dauerhafte Konfliktfläche gegen jeden Upstream-Merge — also gegen den Zweck
des Forks. Der reale Schaden ist dagegen winzig: Von 5.543 führenden Leerzeichen entfallen
alle auf das `name`-Attribut von `<cost>`-Elementen, das der Parser gar nicht liest;
tatsächlich betroffen sind **zwei** `costType`-Definitionen (`" Casting Dice"`,
`" Dispel Dice"`). Die Projektlinie „Datenfehler gehören in den Katalog" bleibt für
**semantische Lücken** (fehlende Regeln/Modifier) unverändert gültig — sie gilt nicht für
Formatierung.

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Datenfixes erreichen Nutzer ohne App-Deploy und ohne Zutun, dateigranular.
  - Echte Fork-Beziehung: Upstream mergen und Fixes per PR zurückgeben wird möglich.
  - Das `revision`-Feld sagt wieder die Wahrheit und ist CI-gesichert.
  - Wir folgen dem offiziellen Schema statt einem Eigenmanifest.
  - `raw.githubusercontent.com` liefert gzip (`Chaos.cat`: 740 KB → 83 KB übertragen),
    daher sind die `.catz`-Assets und clientseitiges Entpacken unnötig.
- **Negativ / Trade-offs:**
  - GitHub wird zur Laufzeit-Abhängigkeit der App. Der Host ist IP-basiert
    rate-limited (verschärft im [GitHub-Changelog 05/2025](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/));
    das Limit greift pro Client-IP und ist bei unserem Volumen unkritisch, kann aber
    hinter geteilten IPs (Firmennetze, CGNAT) greifen. `raw.githubusercontent.com`
    ist von GitHub nicht als CDN dokumentiert.
  - Ein generiertes Artefakt (`catpkg.json`) liegt unter Versionskontrolle.
  - Der Katalog-Fork wird ein zweites zu pflegendes Repo mit eigener CI.
- **Neutral:**
  - **Kein Offline-Regress:** Der Service Worker precacht die Kataloge schon heute
    nicht — ein Erstimport brauchte immer Netz. Der Umzug tauscht lediglich
    same-origin gegen cross-origin; `raw.githubusercontent.com` ist dafür in die
    `shouldCache`-Regel des Service Workers aufzunehmen.
  - Der E2E-Smoke-Test (ADR-0006) bezog seine Kataloge aus `public/catalogs/` und
    erhält stattdessen eine eingefrorene Fixture. Er wird dadurch deterministisch und
    netzunabhängig — bisher hing grünes CI an Fremddaten.
  - Kataloge sind in-app nicht editierbar (der Editor wurde entfernt), also
    überschreibt ein stilles Update nichts vom Nutzer Erzeugtes. Das ist die
    Voraussetzung, unter der „still" überhaupt vertretbar ist.
