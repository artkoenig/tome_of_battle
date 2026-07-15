Status: ready-for-agent
Blocked by: None

## Description
Siehe vollständiges PRD: [docs/PRD-katalog-updates-und-roster-kompatibilitaet.md](../../PRD-katalog-updates-und-roster-kompatibilitaet.md)
und die zugehörige Architekturentscheidung [ADR 0014](../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md).

Kurzfassung: Katalog-Datenfixes erreichen bestehende Nutzer heute nie — ein einmal
importiertes System bleibt dauerhaft auf seinem Datenstand, und das `revision`-Attribut,
das BattleScribes offizielles Update-Signal ist, wurde bei keinem unserer Datenfixes je
hochgezählt. Die Katalogdaten ziehen daher in einen echten Fork von
`Ergofarg/Warhammer-Fantasy-6th-edition` um. Die App lädt zur Laufzeit dessen
`catpkg.json`-Index über `raw.githubusercontent.com`, vergleicht pro Katalog die
Revision („higher wins") und aktualisiert veraltete Kataloge **still** — der Katalog ist
in-app nicht editierbar, also geht nichts vom Nutzer Erzeugtes verloren. Ein CI-Gate im
Fork erzwingt bei jeder geänderten Datei eine strikt höhere Revision.

Damit ein Update Listen nicht still beschädigt, meldet die Validierung eine Auswahl,
deren Katalogeintrag nicht mehr auflösbar ist, künftig als Fehler, statt sie stumm auf
0 Punkte fallen zu lassen.

Die offizielle BSData-Auslieferung über Release-Assets (`.bsi`) scheidet aus: Sie sendet
kein CORS und ist für eine Backend-lose PWA nicht ladbar (siehe ADR 0014).

Damit der Fork seinen Zweck (Upstream mergen) erfüllt, bleiben seine Dateien byteidentisch
zu Upstream: Die datenseitige Whitespace-Bereinigung aus Issue 11 wird zurückgenommen und
durch eine Normalisierung im Parser ersetzt. Der Abgleich mit Upstream ergab, dass dieser
nichts enthält, was uns fehlt — der Fork startet sauber; 14 der 17 Dateien tragen lokale
Fixes, die portiert und mit Revisions-Bump versehen werden müssen.

## Acceptance Criteria
- [ ] Alle in `## Description` beschriebenen User Stories/Requirements aus dem PRD sind erfüllt
- [ ] Alle Kind-Issues sind resolved

## Comments
- 2026-07-15: PRD via grill-me-for-spec erstellt. Ursprünglicher Issue-Scope (Erkennung +
  Roster-Kompatibilität) wurde auf die gesamte Kette erweitert, nachdem der geplante
  Umzug der Kataloge in ein Fork-Repo mit Laufzeit-Abruf hinzukam — die Teile sind
  kausal verkettet. Bereit für Decompose in Kind-Issues.
- 2026-07-15: Fork angelegt: artkoenig/Warhammer-Fantasy-6th-edition (Default-Branch master). Annahmen aus ADR 0014 gegen den realen Fork geprueft: (a) raw.githubusercontent.com liefert access-control-allow-origin: * -- Laufzeit-Abruf bestaetigt. (b) Upstream pflegt 'revision' diszipliniert (Chaos 9->11, Lizardmen 6->7, Skaven 3->4, Vampire Counts 8->10 seit dem letzten Release) -- das Update-Signal ist lebendig, nur unsere Kopie hatte es verrotten lassen. (c) NEU: Upstreams letztes Release ist v1.2.3 (09/2023), master wurde 11/2025 gepusht -- die offizielle Release-Kette liefert also zusaetzlich zum fehlenden CORS veraltete Daten; zweiter unabhaengiger Grund gegen Option 3. (d) NEU: Der Fork erbt Upstreams CI (ci.yml mit BSData/check-datafiles, publish-catpkg.yml, chatops.yml). check-datafiles validiert Schema/Integritaet, prueft aber keine Revisionen -- unser Gate bleibt noetig und ist ein Zusatz. Actions sind im Fork noch deaktiviert und muessen aktiviert werden. PRD und ADR 0014 entsprechend nachgezogen.
