Status: claimed
Type: chore
Blocked by: None

## Description

### Kontext und Problem

Die letzten Refactoring-Bündel (Issues 39, 42, 43, 47, 49, 50) haben wiederholt
dieselben Fehlerklassen aufgedeckt, die der aktuelle Linter (**oxlint**,
`npm run lint`) prinzipiell nicht sieht, weil er pro Datei arbeitet:

- **Toter/ungenutzter Code über Dateigrenzen** — z. B. Issue 50 K2 („`shared`
  wird geparst, aber nie ausgewertet"), diverse Aufräum-Befunde in 39/43.
- **Verletzung der Schichtung und der Solver-Fassade** — die Schichtung
  `parser → solver → components` und der ausschließliche Zugriff auf den Solver
  über `src/solver/validator.js` sind in ADR 0023 festgeschrieben und heute nur
  teilweise per oxlint-Regel `no-restricted-imports` bewacht; Import-Zyklen
  erkennt oxlint gar nicht.
- **Duplizierung** — Issue 42: dasselbe E2E-Harness lag dreifach kopiert vor,
  zwei Kopien liefen unbemerkt kaputt.

Es fehlt ein Werkzeug, das **dateiübergreifend** analysiert. Dieses Issue führt
zwei solche Werkzeuge ein — die Behebung der von ihnen gefundenen Befunde ist
ausdrücklich **nicht** Teil dieses Issues, sondern wird als eigene Folge-Issues
erfasst (wie 39/43/50 es bereits vorgemacht haben).

### Ziele

1. **Knip** einführen: findet ungenutzte Dateien, Exports, Typen und
   `package.json`-Abhängigkeiten dateiübergreifend. Adressiert die
   „geparst-aber-nie-genutzt"/Aufräum-Klasse direkt.
2. **dependency-cruiser** einführen: macht die in ADR 0023 fixierte Schichtung
   und die Solver-Fassade zu prüfbaren Regeln (verbotene Layer-Rückgriffe,
   Import-**Zyklen**, verwaiste Module). Ergänzt die oxlint-Fassadenregel um die
   Zyklus-Erkennung, die oxlint nicht leisten kann.
3. Beide als **npm-Scripts** verfügbar machen und in **CI** einhängen —
   zunächst **warn-only** (Step läuft, blockiert aber nicht).
4. Die Entscheidung in einer **neuen ADR** dokumentieren (Statik-Toolchain:
   Rollenverteilung oxlint/Knip/dependency-cruiser, Warn-only-Gate-Strategie
   und der geplante spätere Übergang auf blockierend).

### Nicht-Ziele (Scope-Grenzen)

- **Keine** Behebung der Befunde, die Knip/dependency-cruiser melden — das sind
  Folge-Issues.
- **Kein** jscpd (Copy-Paste-Detektor) und **kein** TypeScript-`checkJS`/JSDoc
  in diesem Issue. Beide bleiben als mögliche spätere, eigenständige Issues
  offen (checkJS ist der größere, inkrementelle Brocken).
- **Kein** Umstellen der Tools auf blockierend in diesem Issue. Der Übergang
  warn-only → blockierend geschieht bewusst später, wenn der Alt-Bestand
  bereinigt ist; die ADR hält das als Plan fest.
- **Kein** Ersatz von oxlint. Die drei Werkzeuge haben getrennte Rollen.

### Fachliche Anforderungen

**Knip**
- Zero-Config-Start soweit möglich; Konfiguration nur, wo nötig (Entry-Points:
  `index.html`/Vite-Einstieg, Test-Setups, `scripts/*`).
- Muss folgende Verzeichnisse ignorieren bzw. korrekt behandeln, damit keine
  Falschmeldungen entstehen: `.worktrees/**`, `**/.claude/**`, generierte
  Dateien unter `src/parser/schema/**`, Fixtures (`**/__fixtures__/**`).
- Testdateien (`*.test.js(x)`) und `scripts/**` gelten als legitime Nutzer von
  Exports, nicht als tote Enden.

**dependency-cruiser**
- Regeln kodieren die Schichtung `parser → solver → components` (erlaubte
  Import-Richtung) und die Solver-Fassade (Zugriff auf `src/solver/**` nur über
  `src/solver/validator.js`, mit denselben Ausnahmen wie die bestehende
  oxlint-Regel: solver-intern und Testdateien frei).
- Regel gegen **Import-Zyklen** (`no-circular`).
- Regel gegen **verwaiste Module** (`orphans`), mit sinnvollen Ausnahmen
  (Konfig-, Setup- und Einstiegsdateien).
- Gleiche Ausschlüsse wie oben (`.worktrees/`, `.claude/`, Fixtures,
  generierte Dateien).

**Integration**
- Neue npm-Scripts, konsistent zu `lint` benannt (z. B. `knip`,
  `depcruise`), sowie ein Sammel-Script für beide.
- In `.github/workflows/ci.yml`, Job `lint-and-test`, je ein Step **nach** dem
  Lint-Step, mit `continue-on-error: true` (warn-only). Sichtbar im CI-Log,
  aber nicht blockierend.
- Keine Änderung an den lokalen `pre-push`-Hooks in diesem Issue (die prüfen den
  Git-Workflow, nicht Statik); Warn-only lebt zunächst nur in CI.

### Seams / Verifikation

Die „Testschnittstelle" dieses Issues sind die Tool-Kommandos selbst: ein
deterministischer, reproduzierbarer Lauf von `npm run knip` und
`npm run depcruise` auf dem aktuellen Stand. Verifikation = beide laufen ohne
Konfigurationsfehler durch und melden nur echte, erklärbare Befunde (keine
Falschmeldungen aus `.worktrees/`, Fixtures, generierten Dateien). Für
dependency-cruiser gehört dazu eine Positiv-/Negativ-Probe: ein bewusst
regelwidriger Import (Layer-Rückgriff bzw. Solver-Direktimport) wird als
Verstoß gemeldet, ein erlaubter nicht. Neue Vitest-Unit-Tests sind für reine
Tool-Konfiguration nicht vorgesehen.

### Betroffene Artefakte

- `package.json` (devDependencies, Scripts)
- neue Konfigurationsdateien für Knip und dependency-cruiser
- `.github/workflows/ci.yml` (zwei warn-only Steps)
- neue ADR unter `docs/adr/` (+ Eintrag in `docs/adr/README.md`)
- ggf. Hinweis in ADR 0006 (Testing/Automation) auf die erweiterte
  Statik-Toolchain

## Acceptance Criteria
- [ ]

## Comments
