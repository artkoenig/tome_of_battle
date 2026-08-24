# cast als Strukturprüfer des Projekts

- **Status:** Accepted
- **Datum:** 2026-08-24
- **Beteiligte:** artkoenig (Maintainer), Umsetzung Issue 0180
- **Zugehörige ADRs:** setzt die Grenzen aus ADR 0030 (Reinraum), ADR 0034,
  ADR 0037 (Schichtung), ADR 0038 (ViewModels) und ADR 0039 maschinell um;
  löst dependency-cruiser als deren Prüfer ab.

## Kontext und Problemstellung

dependency-cruiser war an zwei voneinander unabhängigen Stellen der
Strukturprüfer des Projekts: als blockierende Hälfte des Lint-Gates
(`forge-lint` = `npm run lint && npm run depcruise`) und als Graphquelle des
Zustandsberichts (`scripts/project-state/`). Mit cast — dem Modulgraph-Werkzeug,
das als Claude-Code-Plugin bereits installiert ist und auf demselben
Wrapper-Vertrag antwortet (Exit 0 mit einer Zeile, Exit 1 mit jedem Fundort,
Exit 2 wenn der Lauf gar nicht zustande kam) — trug das Projekt zwei Werkzeuge
für denselben Graphen. Eines davon reicht.

Der Umstieg darf keine Grenze verlieren: die Regeln aus ADR 0037/0038, die
Reinraum-Trennung (ADR 0030/0034) und die Evaluator-Fassade sind der Grund,
weshalb es den Prüfer überhaupt gibt.

## Entscheidungsfaktoren (Drivers)

- **Ein Graph, ein Werkzeug.** Zwei Werkzeuge für dieselbe Frage driften.
- **Keine Grenze fällt still weg.** Jede Regel braucht ein Gegenstück.
- **Kein Gate, das über Nacht rot wird.** Was die neue Auswertung anders sieht
  als die alte, muss erst gezählt werden, bevor es blockiert.
- **cast liegt nicht auf npm.** Es ist ein Plugin — installierbar ist es damit
  nicht, beziehbar schon: blankes Node ohne Abhängigkeiten in einem öffentlichen
  Repository.

## Betrachtete Optionen

- **Option 1:** dependency-cruiser behalten, cast nur als Ansichtswerkzeug.
- **Option 2:** Portierung auf cast, alle Regeln sofort als `error`.
- **Option 3:** Portierung auf cast, alle Regeln zunächst als `warn`; die
  Entscheidung über `error` folgt auf den gezählten Fundstellen.

## Entscheidungsergebnis

Gewählte Option: **Option 3**. cast ist der Strukturprüfer des Projekts.
`.cast/layers.json` legt die Flughöhe fest, `.cast/rules.json` hält die Regeln,
`npm run cast` (= `cast-check`, scannt und prüft) ist die Strukturhälfte von
`forge-lint`, und `scripts/project-state/graph.js` liest die Module aus
`cast scan`.

Jede Regel ist `error` und **blockiert**: ein Verstoß setzt den Exitcode und
lässt `forge-lint` wie die CI fehlschlagen. Ein Baseline-File gibt es nicht —
`.cast/baseline.json` existiert nicht und soll nicht entstehen, weil nichts
zurückzuhalten ist.

Der Umstieg lief zunächst mit `warn`, um erst zu zählen (siehe unten): über alle
Einträge fand die Prüfung genau eine Kante, und die war Testgerüst im
Evaluator-Verzeichnis. Es liegt seither im Testbaum
(`src/tests/test-utils/rosParser.js`, `src/tests/test-utils/e2eReport.js`),
damit fand die Prüfung nichts mehr, und die Regeln konnten ohne Umbau am Code
auf `error` gezogen werden.

### Wie die CI cast bekommt

cast liegt nicht auf npm, aber es ist blankes Node ohne jede Abhängigkeit in
einem öffentlichen Repository. Ein flacher Klon genügt:

```yaml
- run: |
    git clone --depth 1 https://github.com/artkoenig/ai-blacksmith.git "$RUNNER_TEMP/ai-blacksmith"
    echo "$RUNNER_TEMP/ai-blacksmith/plugins/cast/bin" >> "$GITHUB_PATH"
```

Danach löst `cast-check` (und `cast scan`) auf dem Runner auf, `npm run cast`
läuft unverändert. So bezieht ihn der Lint-Workflow (`.github/workflows/ci.yml`,
Step *Strukturpruefung (cast)*, blockierend) ebenso wie der
Zustandsbericht-Workflow (`.github/workflows/status-report.yml`), dessen
Struktur-Gate sonst mangels Werkzeug auf `not-run` stünde. Der Klon ist bewusst
auf keine Revision festgenagelt: die Prüfung folgt dem aktuellen Stand des
Werkzeugs.

### Was die Regeln in cast anders schreiben

cast kennt pro Regel genau eine Quelle und genau ein Ziel, jeweils ein
Schichtname oder ein Pfad-Glob — keine Listen, keine Negation, keine `pathNot`.
Daraus folgen drei Übersetzungsmuster:

- **Mehrere Ziele → mehrere Einträge gleichen Namens.** `komponente-kein-bericht`
  und `daten-kein-rueckgriff` stehen je zweimal in der Datei; die Gruppierung der
  Ausgabe führt sie unter ihrem Namen zusammen.
- **Eine benannte Menge → eine Schicht.** `.cast/layers.json` zieht die
  Evaluator-Fassade (`evaluator-fassade`) von den engine-internen Modulen
  (`evaluator-intern`) ab und fasst die drei Anzeige-Ableitungen aus ADR 0038 als
  `anzeige-ableitungen` zusammen. So bleiben `evaluator-nur-ueber-fassade` und
  `ableitungen-nur-in-viewmodels` je ein einziger Eintrag — die Fassade ist
  ausgenommen, weil sie eine eigene Schicht ist, nicht weil eine Ausnahmeregel
  sie nachträglich freispricht.
- **Ausnahmen → `allowed`.** Die Testdatei-Ausnahme (`**/*.test.js`,
  `**/*.test.jsx`, gespiegelt aus `.oxlintrc.json`) und "evaluator-interne Module
  unter sich" stehen als `allowed`-Regeln. `allowed` gilt global: eine
  Ausnahme, die die Fassade pauschal freigibt, hätte auch
  `roster-keine-evaluator-abhaengigkeit` mit ausgehebelt — genau deshalb ist die
  Fassade eine Schicht und keine `allowed`-Regel.

Regeln tragen in `.cast/rules.json` **keine** Kommentare: cast meldet jedes
Attribut, das es nicht auswertet, als `not evaluated`. Die Begründung jeder Regel
steht in dem ADR, der sie fordert (0030, 0034, 0037, 0038, 0039).

### Was ersatzlos wegfällt

- **`no-circular`.** War warn-only, cast hat keinen Regeltyp für Zyklen. Es
  braucht auch keinen: `cast report` nennt jeden Zyklus als vollständige
  Zusammenhangskomponente. Beim Umstieg gemessen: **0 Zyklen** über 555 Module.
- **`no-orphans`.** War warn-only, cast hat keinen Regeltyp dafür, und toter Code
  ist schon durch knip abgedeckt (`npm run knip`, ebenfalls warn-only).

### Was die Prüfung findet

Gezählt wurde beim Umstieg, mit `warn` (17 Einträge unter 14 Regelnamen):

| Regel | Fundstellen |
|---|---|
| `schichtung-parser-kein-rueckgriff` | 0 |
| `ableitungen-nur-in-viewmodels` | 0 |
| `viewmodel-keine-komponente` | 0 |
| `komponente-kein-bericht` | 0 |
| `viewmodel-keine-datenschicht` | 0 |
| `ui-nicht-auf-daten` | 0 |
| `daten-kein-rueckgriff` | 0 |
| `fachlogik-kein-rueckgriff` | 0 |
| `keine-i18n-unter-ui` | 0 |
| `evaluator-keine-roster-abhaengigkeit` | 0 |
| `roster-keine-evaluator-abhaengigkeit` | 0 |
| `roster-keine-evaluation-abhaengigkeit` | 0 |
| `evaluation-keine-roster-abhaengigkeit` | 0 |
| `evaluator-nur-ueber-fassade` | 1 |

Die eine Fundstelle war
`scripts/lib/evaluator-measurement-cases.js:17 → src/domain/evaluator/__fixtures__/rosParser.js`.
Sie war **neu sichtbar**, nicht neu entstanden: dependency-cruiser schloss
`__fixtures__/` per `options.exclude` aus dem Graphen aus, cast kennt keinen
solchen Ausschluss — zu Recht, denn ein Modul außerhalb der Tests, das
Testgerüst importiert, ist eine Meldung wert. Aufgelöst wurde sie nicht per
`allowed`, sondern am Ort: die beiden Helfer liegen jetzt unter
`src/tests/test-utils/`, wo Tests und Messskript sie holen.

Heute meldet `npm run cast`:

```
0 violations (0 errors) in 1235 module edges against 17 rules
```

554 Module, 1235 aufgelöste Importkanten, 17 Einträge — und keine Verletzung.
Alle Regeln zusammen kosten damit null Kanten; das ist die Zahl, auf der `error`
steht.

### Konsequenzen (Auswirkungen)

- **Positiv:** Ein Werkzeug statt zwei. Ein Fundort trägt Datei und Zeile. Die
  Flughöhe des Graphen ist erklärt (`layers.json`) statt in Regex-Präfixen
  verstreut. Der Zustandsbericht liest denselben Graphen, den die Prüfung
  bewertet.
- **Negativ:** Die Prüfung hängt an einem Klon zur Laufzeit statt an einer
  gepinnten Abhängigkeit: ändert cast seine Auswertung, ändert sich das Urteil
  der CI ohne Commit im Projekt. Das ist gewollt (die Prüfung soll dem Werkzeug
  folgen), aber es ist ein Preis. `no-restricted-imports` in `.oxlintrc.json`
  bleibt daneben stehen — der zweite, editornahe Spiegel für Fassade und
  Reinraum.
- **Neutral:** `.cast/layers.json` ordnet 549 der 554 Module einer Schicht zu;
  die übrigen fünf (Konfigurationsdateien, `public/sw.js`,
  `tools/rules-editor/server.js`, `docs/assets/landing.js`) bleiben
  `unassigned` — cast zählt und nennt sie, es fällt nichts weg.

## Vor- und Nachteile der Optionen

### Option 1 (dependency-cruiser behalten)

- **Gut, weil** nichts zu tun ist und jede Regel wörtlich bleibt.
- **Schlecht, weil** das Projekt zwei Graphwerkzeuge pflegt, deren Antworten
  auseinanderlaufen können — und der Zustandsbericht ohnehin einen Graphen und
  kein Regelurteil braucht.

### Option 2 (Portierung, sofort `error`)

- **Gut, weil** keine Lücke entsteht, in der eine Grenze unerzwungen ist.
- **Schlecht, weil** cast andere Kanten sieht als dependency-cruiser (kein
  `exclude` für Fixtures, eigene Auflösung) und ein Gate rot werden kann, ohne
  dass sich am Code etwas geändert hat. Was das kostet, war vor der Messung
  unbekannt — die Messung ist genau das, was diese Option überspringt.

### Option 3 (Portierung, zunächst `warn`)

- **Gut, weil** der Umstieg eine reine Werkzeugentscheidung bleibt und die
  Entscheidung über die Härte auf gezählten Fundstellen steht.
- **Schlecht, weil** die Schichtregeln zwischen diesem Issue und seinem
  Nachfolger nur warnen.
