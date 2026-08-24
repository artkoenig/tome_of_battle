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
- **cast liegt nicht auf npm.** Es ist ein Plugin; ein CI-Runner kann es nicht
  installieren.

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

Jede Regel ist `warn`. Sie werden gelistet, mit Datei und Zeile, und lassen den
Exitcode in Ruhe. Damit ist der Umstieg selbst kein Umbau am Code: erst die
Zahlen, dann die Entscheidung über `error` (Folge-Issue).

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

### Was der Umstieg heute findet

Gemessen beim Umstieg (555 Module, 2196 Importe, davon 1234 auf ein Modul des
Projekts aufgelöst; 17 Einträge unter 14 Regelnamen):

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

Die eine Fundstelle ist
`scripts/lib/evaluator-measurement-cases.js:17 → src/domain/evaluator/__fixtures__/rosParser.js`.
Sie ist **neu sichtbar**, nicht neu entstanden: dependency-cruiser schloss
`__fixtures__/` per `options.exclude` aus dem Graphen aus, cast kennt keinen
solchen Ausschluss. Sie bleibt bewusst stehen, statt per `allowed` weggeschrieben
zu werden — das Folge-Issue, das die Regeln auf `error` zieht, soll sie sehen.

Damit ist die Zahl, auf der die spätere Entscheidung steht, **1**: alle vierzehn
Regeln zusammen kosten heute eine einzige Importkante.

### Konsequenzen (Auswirkungen)

- **Positiv:** Ein Werkzeug statt zwei. Ein Fundort trägt Datei und Zeile. Die
  Flughöhe des Graphen ist erklärt (`layers.json`) statt in Regex-Präfixen
  verstreut. Der Zustandsbericht liest denselben Graphen, den die Prüfung
  bewertet.
- **Negativ:** Bis zum Folge-Issue sind die Schichtregeln **unerzwungen** — eine
  neue Verletzung erscheint im Log und lässt das Gate grün. Blockierend bleiben
  allein Fassade und Reinraum, über den `no-restricted-imports`-Spiegel in
  `.oxlintrc.json` (unverändert). Und: cast lässt sich in der CI nicht
  installieren, der Workflow hat deshalb keinen Struktur-Step mehr; die Prüfung
  läuft lokal und in jedem Agentenlauf über `forge-lint`. Im Zustandsbericht
  steht das Gate `cast` folgerichtig auf `enforcement: unknown`.
- **Neutral:** `.cast/layers.json` ordnet 549 der 555 Module einer Schicht zu;
  die übrigen sechs (Konfigurationsdateien, `public/sw.js`,
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
