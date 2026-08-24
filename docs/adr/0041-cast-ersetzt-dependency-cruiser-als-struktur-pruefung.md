# cast ersetzt dependency-cruiser als Struktur-Prüfung des Importgraphen

- **Status:** Accepted
- **Datum:** 2026-08-24
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** löst den dependency-cruiser-Teil von ADR-0024
  (Statik-Toolchain: oxlint, Knip und dependency-cruiser) ab; oxlint und Knip aus ADR-0024 bleiben
  unverändert

## Kontext und Problemstellung

ADR-0024 hat dependency-cruiser als Werkzeug für die Struktur-Prüfung des Importgraphen
eingeführt: Schichtung, Reinraum-/Fassaden-Grenzen, Import-Zyklen und verwaiste Module. Das
Werkzeug ist als npm-Paket über `.dependency-cruiser.cjs` konfiguriert, in `npm run depcruise`
verdrahtet und lief bis hierher in `forge-lint` (blockierend, für die `error`-Regeln) und als
eigener, informativer CI-Schritt (`continue-on-error: true`, da dependency-cruiser noch nie ein
scharfes CI-Gate war — siehe ADR-0024).

Mit `cast` steht ein zweites Werkzeug für dieselbe Aufgabe zur Verfügung: ein Claude-Code-Plugin,
das den Importgraphen liest und `<root>/.cast/rules.json` als Regelsatz gegen ihn prüft, mit
denselben zwei Schweregraden (`warn`/`error`) wie dependency-cruiser. Es ist kein npm-Paket,
sondern ein Plugin-Binary, aufgelöst über `command -v cast`, sonst
`${CLAUDE_PLUGIN_ROOT}/bin/cast`.

## Entscheidungsfaktoren (Drivers)

- **Ein Werkzeug für die Struktur-Prüfung**, nicht zwei nebeneinander mit überlappender Aufgabe.
- **Dieselben Schweregrade** (`warn`/`error`) wie heute, damit die bestehende Unterscheidung
  zwischen scharf durchgesetzten Grenzen (Reinraum, Fassade, Schichten aus ADR-0037/0038) und
  sichtbar gehaltenem Alt-Bestand (`no-circular`, `no-orphans`, `schichtung-parser-kein-rueckgriff`)
  erhalten bleibt.
- **Keine Verschlechterung des heutigen Zustands** — `forge-lint` muss auf dem heutigen Codestand
  grün bleiben, kein neuer Fehlschlag allein durch den Werkzeugwechsel.
- **Ehrlichkeit über das, was cast strukturell nicht 1:1 kann** (siehe unten), statt eines
  stillschweigenden Verlusts an Abdeckung.

## Betrachtete Optionen

- **Option 1: dependency-cruiser beibehalten.** Zwei Werkzeuge mit überlappender Aufgabe
  nebeneinander betreiben, `cast` nur für Fragen ad hoc nutzen (`/cast:map`, `/cast:plan`).
- **Option 2: cast als alleinige Struktur-Prüfung.** `cast check` gegen `.cast/rules.json` ersetzt
  `npm run depcruise` überall, wo es heute strukturell geprüft wird; dependency-cruiser bleibt nur
  so lange im Projekt, wie `scripts/project-state/` es noch für den Zustandsbericht braucht
  (eigener Zuschnitt, AC5/AC6 dieses Issues).

## Entscheidungsergebnis

Gewählte Option: **Option 2 — cast als alleinige Struktur-Prüfung**, weil zwei Werkzeuge mit
identischer Aufgabe (Schichtung, Fassade, Zyklen, Waisen) keinen Erkenntnisgewinn bringen, nur
zwei Konfigurationen, die konsistent gehalten werden müssen (das Risiko, das ADR-0024 selbst schon
als Nachteil der Drei-Werkzeuge-Aufstellung benannt hat). `cast` übernimmt jede pfadbasierte
Schicht-/Fassaden-/Reinraum-Regel aus `.dependency-cruiser.cjs` als gleichnamige Regel in
`.cast/rules.json`, mit demselben Schweregrad.

### `forge-lint` statt `npm run depcruise`

`forge-lint` (`.forge/config.json`, Command `lint`) ruft jetzt `npm run lint && cast check --root
.` statt `npm run lint && npm run depcruise` auf. `cast` wird wie überall im Projekt aufgelöst:
`command -v cast`, sonst `${CLAUDE_PLUGIN_ROOT}/bin/cast`.

### Zwei Annahmen, die diese Entscheidung bewusst trägt

**1. Kein CI-Gate für cast.** `cast` ist ein Claude-Code-Plugin-Binary, kein npm-Paket — anders
als dependency-cruiser lässt es sich nicht per `npm ci` installieren, und ein CI-Schritt, der
`cast` aufruft, ist in einem GitHub-Actions-Runner ohne das Plugin nicht lauffähig. Der bisherige
dependency-cruiser-CI-Schritt war bereits `continue-on-error` und damit rein informativ — er ist
jetzt ersatzlos entfernt (`.github/workflows/ci.yml`), nicht durch einen gleichwertigen
cast-Schritt ersetzt. Die Struktur-Prüfung bleibt lokal/Agent-seitig über `forge-lint`. Ein
CI-Gate, das cast tatsächlich ausführt, ist eine eigene, hier bewusst offengelassene Frage
(Distribution des Plugin-Binaries außerhalb einer Claude-Code-Session).

**2. Kein 1:1-Ersatz für `no-circular`/`no-orphans`.** `cast` kennt in `.cast/rules.json` keinen
eigenen Regeltyp für Zyklen oder verwaiste Module (anders als dependency-cruisers
`to: { circular: true }` bzw. `from: { orphan: true }`). Die zwei entsprechenden
dependency-cruiser-Regeln (beide bereits `warn`-only, ohnehin folgenlos für den Exitcode) werden
nicht als `.cast/rules.json`-Regel nachgebaut, sondern durch die dazu passende cast-Ausgabe
ersetzt: `cast scan`/`cast report` und `cast:map` machen Zyklen und unaufgelöste Importe im Graphen
direkt sichtbar, ohne eigenen Schweregrad. Wer diese Klasse von Befunden sucht, liest den Report,
statt ein Rule-Ergebnis zu zählen.

### Von Regex-Pfaden zu Layer-Namen und Glob-Pfaden

`.dependency-cruiser.cjs` beschreibt `from`/`to` als reguläre Ausdrücke, teils mit Arrays
mehrerer Ziel-Präfixe (`to: { path: [A, B, C] }`) und Negation (`pathNot`).
`.cast/rules.json` kennt pro Regel nur **eine** Zeichenkette je Seite — einen Layer-Namen aus
`.cast/layers.json` oder einen Glob-Pfad (`**`/`*`, keine Vereinigung, keine Negation direkt am
Pfad). Die Übertragung nutzt zwei Mittel:

- **Glob-Pfade direkt**, wo eine Regel ohnehin nur einen Präfix je Seite braucht (z. B.
  `viewmodel-keine-komponente`: `src/ui/viewmodels/**` → `src/ui/components/**`).
- **`.cast/layers.json`**, wo mehrere Pfade zu einem Namen zusammengefasst werden müssen — die
  drei Zieldateien von `ableitungen-nur-in-viewmodels` als Layer `ableitung-ziel`, und die
  Trennung `evaluator-facade`/`evaluator-intern`/`rest` (Test- und Fixture-Dateien zuerst
  herausgefiltert), die `evaluator-nur-ueber-fassade` exakt auf `pathNot: [EVALUATOR_LAYER,
  TEST_FILE]` gegen die Fassadendatei abbildet.

Wo eine dependency-cruiser-Regel mehrere, disjunkte Ziel-Präfixe vereinigt (`daten-kein-rueckgriff`:
Daten dürfen weder auf UI noch auf Fachlogik zurückgreifen; `fachlogik-kein-rueckgriff`: Fachlogik
darf nicht auf UI zurückgreifen, wobei `i18n` als Teil von UI zählt; `keine-i18n-unter-ui`:
Fachlogik und Daten dürfen `i18n` nicht importieren), lässt sich die Vereinigung nicht als eine
einzige cast-Regel ausdrücken — jede Seite ist genau ein Layer-Name oder ein Glob, nie eine
Liste. Die cast-Regel deckt hier den architektonisch wichtigsten Einzel-Präfix ab
(`daten-kein-rueckgriff`: `src/data/**` → `src/domain/**`; `fachlogik-kein-rueckgriff`:
`src/domain/**` → `src/ui/**`, was `i18n` als Unterpfad automatisch mit erfasst;
`keine-i18n-unter-ui`: `src/domain/**` → `src/ui/i18n/**`). Alle so ausgelassenen Kanten (etwa
`src/data/** → src/ui/**`) waren beim Umstieg bereits bei null Treffern (geprüft mit `cast edges`
gegen den heutigen Graphen) — die Verengung kostet also keine heute aktive Absicherung, ist aber
eine bewusste Vereinfachung gegenüber dem dependency-cruiser-Original und keine exakte
Nachbildung.

### Konsequenzen (Auswirkungen)

- **Positiv:** Nur noch ein Werkzeug für die Struktur-Prüfung, `forge-lint` bleibt grün, keine
  gespiegelte Konfiguration zwischen zwei Werkzeugen mehr für dieselbe Aufgabe.
- **Positiv:** `cast` liefert zusätzlich `cast:map`/`cast:plan` für Fragen zum Graphen und
  Refactoring-Simulationen, die dependency-cruiser nicht kannte.
- **Negativ:** Kein CI-Gate mehr, das die Struktur-Regeln überhaupt ausführt (auch nicht
  informativ) — ein Verstoß fällt erst auf, wenn ein Agent oder eine Entwicklerin lokal
  `forge-lint` laufen lässt. Das war beim informativen dependency-cruiser-CI-Schritt nicht anders
  scharf, aber dort lief das Werkzeug wenigstens mit.
- **Negativ:** Die auf einen Einzel-Präfix verengten Mehrfach-Ziel-Regeln (siehe oben) decken
  weniger ab als das dependency-cruiser-Original — ein zukünftiger Verstoß auf der ausgelassenen
  Seite bliebe unentdeckt, bis eine eigene Regel oder ein `.cast/layers.json`-Ausbau ihn wieder
  einfängt.
- **Neutral:** `no-circular`/`no-orphans` werden nicht als Regel geführt; wer sie braucht, liest
  `cast report`/`cast:map` statt eines Rule-Treffers.
- **Neutral:** `dependency-cruiser` bleibt vorerst im Projekt (`package.json`,
  `.dependency-cruiser.cjs`), weil `scripts/project-state/gates.js` es noch für den
  Zustandsbericht aufruft — eigener Zuschnitt desselben Issues (0180), nicht Teil dieser
  Entscheidung.

## Vor- und Nachteile der Optionen

### Option 1 — dependency-cruiser beibehalten

- **Gut, weil** keine Übertragungsarbeit nötig wäre und die Regel-Engine (Regex, Arrays, Negation)
  ausdrucksstärker ist als cast's Layer-/Glob-Modell.
- **Schlecht, weil** zwei Werkzeuge dieselbe Aufgabe lösen — genau die Konfigurationslast, die
  ADR-0024 schon als Nachteil der Drei-Werkzeuge-Aufstellung benannt hat, ohne einen zusätzlichen
  Erkenntnisgewinn.

### Option 2 — cast als alleinige Struktur-Prüfung

- **Gut, weil** es ein Werkzeug weniger zu pflegen gibt und `cast` ohnehin schon für
  Graph-Fragen und Refactoring-Planung im Projekt verankert ist.
- **Schlecht, weil** cast's Ein-Wert-je-Seite-Modell mehrfache Ziel-Präfixe nicht verlustfrei
  abbildet und `no-circular`/`no-orphans` keinen eigenen Regeltyp haben — beide Lücken sind hier
  bewusst dokumentiert statt stillschweigend zu verschwinden.
