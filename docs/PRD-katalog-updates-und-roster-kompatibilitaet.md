# PRD: Katalog-Updates aus dem Fork-Repo und Roster-Kompatibilität

## Problem Statement / Bug Description

Katalog-Datenfixes erreichen bestehende Nutzer nicht, und wenn sie es täten, könnten
sie Armeelisten still beschädigen.

**Aktuelles Verhalten.** Die Katalogdaten liegen als Kopie im App-Repo
(`public/catalogs/`) und werden mit dem Build ausgeliefert. Beim Import landet ein
System dauerhaft in IndexedDB. Beim App-Start parst die Migrations-Pipeline
(ADR-0002 §6) lediglich das *gespeicherte* Roh-XML mit dem aktuellen Parser neu — sie
holt **keine** neuen Katalogdaten. Wer „Warhammer Fantasy Battle 6th edition" einmal
importiert hat, behält dessen Datenstand dauerhaft. Ein korrigierter Punktwert, ein
gefixtes Profil oder ein berichtigter Regelname erreicht ihn nie, ohne dass er das
System von Hand neu importiert — worauf ihn nichts hinweist.

Drei Befunde schärfen das Bild:

1. **Das `revision`-Attribut lügt.** Die Dateien tragen BattleScribes
   `revision`-Attribut, laut offizieller Doku das Update-Signal
   („check that changed files have their internal `revision` attribute incremented -
   otherwise the change won't propagate to the users!"). Kein einziger unserer
   Datenfix-Commits hat es hochgezählt. `Orcs and Goblins.cat` steht auf
   `revision="12"` — identisch zu Upstream — bei mindestens fünf inhaltlichen
   Abweichungen.
2. **Ein Reimport kann Listen brechen, ohne es zu sagen.** Rosters speichern laut
   ADR-0011 keine Kosten, sondern nur strukturelle Referenzen auf Katalogeinträge,
   die bei jedem Lesevorgang aufgelöst werden. Verschwindet oder ändert sich eine
   ID, findet `syncRosterSelectionsWithSystem` den Eintrag schlicht nicht — und tut
   dann **nichts**: kein Flag, keine Warnung. Die Auswahl bleibt mit ihrem
   gespeicherten Namen sichtbar (die von ADR-0011 gewollte Resilienz), zählt aber
   0 Punkte. Der Nutzer sieht eine plausible Liste mit falscher Summe.
3. **Eine gescheiterte Migration bleibt unsichtbar.** Wirft das Neu-Parsen eines
   gespeicherten Systems einen Fehler, wird das alte, unmigrierte System still
   weiterverwendet — nur ein `console.error`.

**Erwartetes Verhalten.** Ein Katalog-Fix erreicht jeden Nutzer automatisch, und
falls eine Liste dadurch einen Eintrag verliert, sieht der Nutzer das dort, wo er
ohnehin nach Problemen seiner Liste schaut.

## Solution

Die Katalogdaten ziehen aus dem App-Repo nach
[artkoenig/Warhammer-Fantasy-6th-edition](https://github.com/artkoenig/Warhammer-Fantasy-6th-edition)
um — einen **echten Fork** von
[Ergofarg/Warhammer-Fantasy-6th-edition](https://github.com/Ergofarg/Warhammer-Fantasy-6th-edition)
(Default-Branch `master`) — und werden dort gepflegt. Die App ruft sie zur Laufzeit ab und hält importierte
Systeme selbsttätig aktuell. Die Architekturentscheidung samt verworfener
Alternativen ist in [ADR 0014](adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)
festgehalten; die Eckpunkte:

- **Der Fork ist die Datenquelle.** Sein CI erzeugt den offiziellen Index
  `catpkg.json` ([BSData-Schema](https://github.com/BSData/schemas)) und committet
  ihn in den Branch. Ein CI-Gate verlangt bei jeder geänderten `.cat`/`.gst` eine
  **strikt höhere** Revision als im Base-Commit — damit kann das Update-Signal nicht
  mehr vergessen werden.
- **Die App vergleicht Revisionen und aktualisiert still.** Beim App-Start lädt sie
  den Index, vergleicht pro Katalog `remote.revision > stored.revision`
  („higher wins", die offizielle Semantik) und lädt nur die tatsächlich veralteten
  Dateien nach. Es gibt keine Rückfrage: Der Katalog ist kein Nutzer-Artefakt,
  sondern ein Cache — er ist in-app nicht editierbar, es geht also nichts verloren.
  Der Nutzer hat ein Spielsystem importiert, nicht eine Revision davon.
- **Verlorene Einträge werden zu Validierungsfehlern.** Eine Auswahl, deren
  Katalogeintrag nicht mehr auflösbar ist, meldet die Validierung künftig als Fehler,
  statt sie stumm auf 0 Punkte fallen zu lassen. Das nutzt die bestehende
  Fehler-Naht und wirkt unabhängig von der Ursache.
- **Formatierung wird normalisiert statt bereinigt.** Der Fork bleibt byteidentisch zu
  Upstream; Whitespace in `name`-Attributen trimmt der Parser an der Systemgrenze. Die
  datenseitige Bereinigung aus Issue 11 wird dafür zurückgenommen (Begründung und
  Abgrenzung zur Projektlinie: [ADR 0014](adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)).

### Ausgangslage des Forks (erhoben am 2026-07-15)

Der Fork ist angelegt (`artkoenig/Warhammer-Fantasy-6th-edition`, Default-Branch
`master`) und liefert erwartungsgemäß Upstreams HEAD, nicht unsere Dateien — die lokalen
Fixes müssen portiert werden. Der Abgleich gegen
`Ergofarg/Warhammer-Fantasy-6th-edition@master` ergab:

- **Upstream enthält nichts, was uns fehlt.** Jede upstream-exklusive Stelle ist entweder
  eine unserer Ersetzungen (z. B. `"Mantle of Damsel "` → `"Mantle of Damsel Elena"`,
  korrigierte Tippfehler) oder eine bewusste Löschung (`83e29ee`: dupliziertes
  Crew-Profil und falsche Stupidity-Regel der Goblin Wolf Chariots). Es gibt keine
  hängenden Verweise auf entfernte IDs. Der Fork startet also sauber.
- **Zu portieren sind 14 der 17 Dateien.** Dominierend ist neunmal derselbe
  Magic-Item-Modifier (`04c325f`); der Brocken ist `Orcs and Goblins.cat`.
  `Dogs of War.cat`, `Dwarfs.cat` und `Vampire Counts.cat` unterscheiden sich **nur** durch
  Whitespace — dort ist nichts zu portieren.
- **Alle 17 Dateien tragen aktuell Upstreams Revision**, obwohl 14 inhaltlich abweichen.
  Jeder portierte Fix braucht daher einen Bump; ab dann erzwingt ihn das CI-Gate.
- **Der Fork bringt CI mit.** Er erbt von Upstream `ci.yml` (offizielles
  `BSData/check-datafiles` — validiert Schema und Integrität bei jedem Push/PR, prüft
  aber **keine** Revisionen), `publish-catpkg.yml` (läuft nur `on: release`) und
  `chatops.yml` (erwartet ein Secret, das wir nicht haben; läuft folgenlos leer). Die
  Workflows bleiben; unser Revisions-Gate und die `catpkg.json`-Erzeugung auf `master`
  kommen hinzu. **Actions sind im Fork noch deaktiviert** (GitHub-Standard für Forks)
  und müssen einmalig eingeschaltet werden, sonst greift kein Gate.

## User Stories / Requirements

1. Als **Spieler** möchte ich Korrekturen an Katalogdaten automatisch erhalten, ohne
   mein Spielsystem von Hand neu importieren zu müssen, damit meine Punkte und
   Profile stimmen.
2. Als **Spieler** möchte ich sehen, wenn eine Einheit oder Option meiner Liste im
   Katalog nicht mehr existiert, damit ich nicht mit einer falsch berechneten Liste
   zum Spiel erscheine.
3. Als **Spieler** möchte ich, dass mein Erst-Import weiterhin funktioniert und meine
   Listen offline nutzbar bleiben, sobald das System einmal importiert ist.
4. Als **Datenpfleger** möchte ich Katalogfixes im Fork-Repo pflegen und per PR an
   Upstream zurückgeben können, damit die Arbeit nicht in einer abgeschnittenen Kopie
   versandet.
5. Als **Datenpfleger** möchte ich, dass die CI mich zwingt, die Revision zu erhöhen,
   damit ein Fix nicht wirkungslos ausgeliefert wird.
6. Als **Spieler** möchte ich informiert werden, wenn ein gespeichertes System nicht
   verarbeitet werden konnte, statt still auf veralteten Daten zu sitzen.
7. Als **Datenpfleger** möchte ich Upstream-Änderungen ohne kosmetische Konflikte mergen
   können, damit der Fork seinen Zweck erfüllt.
8. Als **Spieler** möchte ich keine Namen mit überflüssigen Leerzeichen sehen — weder in
   der Anzeige noch in exportierten Listen — auch wenn die Katalogdaten sie enthalten.

## Technical Decisions

- **Affected Modules:**
  - Katalog-Update: Erkennung (Revisionsvergleich) und Orchestrierung (Abruf, Parsen,
    Speichern), angesiedelt bei der bestehenden Migrations-Pipeline, die beim
    App-Start läuft.
  - Roster-Validierung: neue Fehlerklasse für nicht auflösbare Einträge.
  - Roster-Sync: muss nicht auflösbare Einträge künftig melden statt zu ignorieren.
  - Importer: bezieht die Systemliste aus dem Fork-Index statt aus dem
    Build-Zeit-Manifest.
  - Service Worker: `raw.githubusercontent.com` in die Caching-Regel aufnehmen.
  - Parser: normalisiert `name`-Attribute beim Einlesen (siehe unten).
  - Build: das Manifest-generierende Vite-Plugin und `public/catalogs/` entfallen.
  - **Neu, außerhalb dieses Repos:** der Katalog-Fork
    (`artkoenig/Warhammer-Fantasy-6th-edition@master`) — Actions aktivieren, lokale
    Fixes portieren und mit Revisions-Bump versehen, Revisions-Gate und
    `catpkg.json`-Erzeugung ergänzend zur geerbten Upstream-CI.

- **Technical Clarifications / Architectural Decisions:**
  - Datenquelle, Abrufweg und Update-Signal: siehe
    [ADR 0014](adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md).
  - **Update-Signal ist ausschließlich `revision`**, verglichen mit *strikt größer*.
    Der ebenfalls im Index vorhandene `sourceSha256` dient allenfalls der
    Integritätsprüfung, nicht der Update-Erkennung.
  - **Die „higher wins"-Regel gilt ausnahmslos**, auch für selbst hochgeladene
    Systeme: Trägt ein Upload eine höhere Revision als der Fork, bleibt er
    unangetastet; trägt er eine niedrigere, wird er aktualisiert. Eine Herkunfts-
    Sonderbehandlung entfällt damit. Systeme, deren ID der Index nicht kennt, bleiben
    zwangsläufig unberührt.
  - **Kein Blockieren, kein Rückfragen.** Ein Update läuft auch dann, wenn dadurch
    Roster-Einträge unauflösbar werden — der Nutzer erfährt es über die Validierung.
    Bekannt fehlerhafte Daten zu konservieren, um einen Folgefehler zu vermeiden,
    wäre die schlechtere Wahl.
  - Ein fehlgeschlagener Abruf (offline, Rate-Limit, GitHub-Ausfall) ist **kein
    Fehlerfall für den Nutzer**: Die App arbeitet mit dem gespeicherten Stand
    weiter. Nur eine fehlgeschlagene *Verarbeitung* eines vorhandenen Systems wird
    gemeldet.
  - **Namens-Normalisierung gehört an genau eine Stelle: den Parser.** Er trimmt jedes
    `name`-Attribut beim Einlesen; alles dahinter (Anzeige, Sortierung, Vergleiche,
    Export) arbeitet mit sauberen Namen, ohne selbst zu trimmen. Verstreute `trim()`-
    Aufrufe an Verwendungsstellen sind ausdrücklich **nicht** die Lösung — das
    vorhandene `ct.name.trim()` in der Kostenaufstellung wird dadurch überflüssig und
    entfällt. Das ist keine Heuristik (die raten würde), sondern eine deterministische
    Normalisierung an der Systemgrenze — derselbe Anti-Corruption-Layer-Gedanke, den
    ADR-0011 bereits für den Roster-Import etabliert hat.

- **API Contracts / Data Models:**
  - **Index:** `catpkg.json` nach offiziellem Schema. Genutzt werden pro Eintrag in
    `repositoryFiles`: `id`, `name`, `type` (`catalogue` | `gameSystem`) und
    `revision`. Die `fileUrl`-Felder zeigen auf Release-Assets und werden **nicht**
    genutzt; die Dateien werden über `raw.githubusercontent.com` geladen, das sie
    gzip-komprimiert ausliefert.
  - **Gespeichertes System:** muss künftig die Revision pro Katalog/Spielsystem
    mitführen — heute wird `revision` vom Parser gar nicht gelesen. Ohne dieses Feld
    gibt es keine Vergleichsbasis.
  - **Bestandsdaten ohne Revision** (alles vor diesem Change) gelten als veraltet und
    werden beim ersten Start einmalig aktualisiert.
  - **Validierungsfehler:** eine neue `type`-Ausprägung in der bestehenden
    `ValidationError`-Struktur (`{ type, message, severity }`), Schweregrad `error`.

## Testing Decisions

- **Modules to Test:** Revisionsvergleich, Update-Orchestrierung, Roster-Validierung,
  Parser-Normalisierung, das CI-Gate im Fork-Repo, sowie der bestehende
  E2E-Import-Durchlauf.

- **Test Interfaces (Seams):**
  1. **Revisionsvergleich** — eine reine Funktion, die Index und gespeichertes System
     entgegennimmt und die veralteten Kataloge zurückgibt. Netzfrei, deckt
     „higher wins", Gleichstand, fehlende Revision (Bestandsdaten) und dem Index
     unbekannte Systeme ab.
  2. **Update-Orchestrierung** — nimmt die Abruf-Funktion per Dependency Injection
     entgegen und ist damit ohne Netz testbar: erfolgreiches Update, fehlgeschlagener
     Abruf (muss den gespeicherten Stand unangetastet lassen), Parser-Fehler.
  3. **`validateRoster(roster, system)`** — bestehende Naht. Test: ein System, dem ein
     referenzierter Eintrag fehlt, erzeugt genau einen Fehler der neuen Klasse; ein
     vollständiges System erzeugt keinen.
  4. **CI-Gate** — als eigenständiges Skript im Fork-Repo prüfbar: geänderte Datei
     ohne Bump → rot; mit Bump → grün; unveränderte Datei → ignoriert.
  5. **Parser (`processImportedData`)** — bestehende Naht. Test: Roh-XML mit
     führenden/nachgestellten Leerzeichen in `name` (die realen Fälle sind die
     `costType`-Definitionen `" Casting Dice"` / `" Dispel Dice"` sowie Entry-Namen wie
     `"Armour of Damnation "`) erzeugt ein Systemobjekt mit getrimmten Namen. Ergänzend
     die Regression, die Issue 11 ursprünglich motivierte: Die fünf dort genannten Regeln
     (`Cavalry hammer`, `Repeater Handgun`, `Repeater Pistol`, `Chariot of the Gods`,
     `Crazed!`) bleiben verlinkt — nun aus zwei unabhängigen Gründen (Normalisierung im
     Parser *und* `normalizeName()` im Lookup).
  6. **E2E (`ui.test.js`)** — behält den vollen Import-Durchlauf, bezieht seine
     Kataloge aber aus einer **eingefrorenen Fixture im App-Repo** statt aus
     `public/catalogs/`. Der Test wird dadurch deterministisch und netzunabhängig; er
     prüft die App, nicht die Katalogdaten. Bisher hing grünes CI an Fremddaten.
     Die Fixture trägt bewusst die **Upstream-Form inklusive Whitespace** — nur so
     durchläuft der E2E-Test die Normalisierung, statt sie mit vorbereinigten Daten zu
     umgehen.

## Out of Scope

- **Kein UI zum Verwalten von Katalogquellen.** Der Fork ist fest verdrahtet; Nutzer
  können keine eigenen Repos hinzufügen.
- **Keine Reparatur gebrochener Roster.** Ein verlorener Eintrag wird *gemeldet*, nicht
  automatisch auf einen Nachfolge-Eintrag umgebogen. Ein ID-Mapping über
  Katalogversionen hinweg ist ein eigenes Thema.
- **Kein Rollback auf eine ältere Katalogrevision** und kein Pinnen eines Systems auf
  eine bestimmte Revision.
- **Keine Anzeige, *was* sich in einem Katalog geändert hat** (Daten-Changelog).
- **Kein Roster-Migrationsframework.** Änderungen an der internen *Roster*-Struktur
  bleiben ungelöst; hier geht es ausschließlich um Katalogdaten.
- **Kein Beitrag an Upstream** als Teil dieser Umsetzung — der Fork *ermöglicht* PRs,
  das Einreichen selbst ist redaktionelle Arbeit.
- **Keine Migration weiterer Spielsysteme.** Betroffen ist ausschließlich das
  vorhandene WHFB-6th-Set.
- **Der bestehende `.bsz`-Upload-Weg bleibt unverändert** erhalten.
- **Keine weitergehende Namens-Normalisierung.** Der Parser trimmt führende/nachgestellte
  Leerzeichen — er vereinheitlicht keine Akzente, Anführungszeichen oder Interpunktion.
  Das bleibt Sache von `normalizeName()` im Regel-Lookup, wo es hingehört.
