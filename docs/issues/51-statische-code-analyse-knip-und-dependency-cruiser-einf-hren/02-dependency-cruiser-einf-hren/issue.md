Status: resolved
Type: chore
Blocked by: [01]

## Description

Führt **dependency-cruiser** ein und macht damit die in **ADR 0023** fixierte
Schichtung und die Solver-Fassade zu maschinell geprüften Regeln. Ergänzt die
bestehende oxlint-Regel `no-restricted-imports` um die Zyklus-Erkennung, die
oxlint nicht leisten kann.

Blockiert durch 01, weil beide `package.json` und `ci.yml` anfassen — sequenziell
vermeidet das Merge-Konflikte.

Umfang dieser Scheibe:
- dependency-cruiser als devDependency ergänzen.
- Konfiguration mit Regeln:
  - **Schichtung** `parser → solver → components`: erlaubte Import-Richtung,
    Rückgriffe verboten.
  - **Solver-Fassade**: Zugriff auf `src/solver/**` von außen nur über
    `src/solver/validator.js`; dieselben Ausnahmen wie die bestehende
    oxlint-Regel (solver-intern und Testdateien frei).
  - **`no-circular`**: Import-Zyklen verboten.
  - **`orphans`**: verwaiste Module gemeldet, mit sinnvollen Ausnahmen
    (Konfig-, Setup-, Einstiegsdateien).
- Gleiche Ausschlüsse wie bei Knip (`.worktrees/`, `.claude/`, Fixtures,
  generierte Dateien).
- npm-Script `depcruise` sowie ein Sammel-Script, das Knip **und**
  dependency-cruiser zusammen ausführt.
- In `.github/workflows/ci.yml`, Job `lint-and-test`, ein warn-only Step
  (`continue-on-error: true`).

Ausdrücklich **nicht** Teil: gemeldete Verstöße im Bestand beheben (Folge-Issues).

## Acceptance Criteria
- [ ] `npm run depcruise` läuft ohne Konfigurationsfehler durch.
- [ ] Ein bewusst regelwidriger Import wird als Verstoß gemeldet — je eine Probe
      für Layer-Rückgriff, Solver-Direktimport (an `validator.js` vorbei) und
      Zyklus; ein erlaubter Import wird **nicht** gemeldet.
- [ ] Keine Falschmeldungen aus `.worktrees/`, `.claude/`, Fixtures oder
      generierten Dateien.
- [ ] Ein Sammel-Script führt Knip und dependency-cruiser gemeinsam aus.
- [ ] CI-Job `lint-and-test` enthält einen dependency-cruiser-Step, der bei
      Befunden **nicht** fehlschlägt (`continue-on-error: true`).
- [ ] Verbleibende echte Verstöße sind unverändert gelassen (nicht hier behoben).

## Comments
- dependency-cruiser (v18) additiv neben Knip eingefuehrt: .dependency-cruiser.cjs mit warn-only Regeln (Schichtung parser->solver->components, Solver-Fassade wie ADR 0023 mit denselben Ausnahmen wie die oxlint-Regel, no-circular, no-orphans; Ausschluesse wie Knip). npm-Scripts depcruise und analyze (Knip+depcruise), warn-only CI-Step im Job lint-and-test. Wirksamkeit per absichtlicher Verstoss-Proben nachgewiesen; Bestandscode ist regelkonform, keine Verstoesse behoben.
