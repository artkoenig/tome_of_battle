---
status: done
branch: claude/statusseite-code-coverage-4wt1a0
pr: https://github.com/artkoenig/tome_of_battle/pull/184
---

# Statusseite zeigt keine Code Coverage mehr, sobald ein Test rot ist

## Intent

Die deployte Statusseite (`/status`, gebaut von
`.github/workflows/status-report.yml` bei jedem Push auf `main`) zeigt aktuell
bei **jeder** Modul-Kachel "No test coverage data" — die gesamte
Coverage-Anzeige ist leer.

**Befund:**

- Auf der Live-Seite zeigt das Gate "Unit/component tests" den Status
  `findings` (nicht `passed`); alle ~20 Modul-Kacheln zeigen im
  Coverage-Tooltip "No test coverage data".
- Das Rohlog des letzten erfolgreichen "Zustandsbericht"-Workflow-Laufs
  (Run 30580042005, `head_sha` 32d0cefb) zeigt: das `unit-tests`-Gate führt
  `npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=json`
  aus; die eingefangene Ausgabe zeigt "Test Files 1 failed | 249 passed
  (250)" — zwei fehlgeschlagene Tests in `src/evaluator/e2e.testcatalog.test.js`,
  beide `Error: Test timed out in 5000ms`. Das ist der bereits als
  vorbestehend bekannte CPU-Last-Flake aus
  `docs/issues/0110-e2e-testcatalog-timeout-flake-unter-cpu-last.md`
  (Status: backlog, noch nicht behoben).
- Lokal reproduziert: `npx vitest run --coverage --coverage.provider=v8
  --coverage.reporter=json` schreibt `coverage/coverage-final.json`
  **überhaupt nicht** (das Verzeichnis `coverage/` entsteht gar nicht),
  sobald irgendein Test in dem Lauf fehlschlägt — verifiziert an einer
  eigens präparierten Testdatei mit einem absichtlich roten Test. Das ist
  Vitests eigenes Standardverhalten: die Option `coverage.reportOnFailure`
  ist standardmäßig `false`, der Coverage-Report wird nur bei einem
  durchweg grünen Lauf geschrieben.
- Die Folge in diesem Repo: `scripts/project-state/generate.js`s
  `readJsonFile()` fängt eine fehlende `coverage-final.json` bewusst als
  Fallback `{}` ab (gedacht z. B. für den allerersten Lauf).
  `buildReportModel.js` ruft darauf `aggregateCoverage({})` auf, das `[]`
  liefert. `renderReport.js`s `renderModuleTiles()` rendert daraufhin jede
  Modul-Kachel mit `coverage: null` — nicht unterscheidbar von "diesem
  Modul fehlen wirklich alle Tests".

Sobald also irgendein Test im Lauf auf `main` rot ist (aktuell: der
CPU-Last-Flake in `e2e.testcatalog.test.js`), läuft der
Zustandsbericht-Workflow trotzdem grün durch und deployt — verliert dabei
aber stillschweigend die komplette Coverage-Anzeige, ohne jeden Hinweis
warum.

**Abgrenzung:** Dieses Issue behebt die Coverage-Anzeige unabhängig davon,
*welcher* Test gerade rot ist — der eigentliche Timeout-Flake in
`e2e.testcatalog.test.js` ist bereits separat als Issue 0110 erfasst
(backlog) und wird hier bewusst nicht mitbehoben: auch nach dessen Fix
würde jeder zukünftige rote Lauf dieselbe leere Coverage-Anzeige erzeugen,
solange dieses Issue nicht behoben ist.

Acceptance criteria:

1. Ein `vitest run --coverage`-Lauf mit mindestens einem fehlschlagenden
   Test schreibt trotzdem `coverage/coverage-final.json` mit
   Coverage-Daten (verifiziert durch echten Lauf gegen eine Testdatei mit
   einem absichtlich roten Test, nicht nur gelesen).
2. Ein komplett grüner Lauf verhält sich unverändert: `coverage-final.json`
   wird weiterhin geschrieben, der Bericht zeigt weiterhin
   Modul-Coverage wie bisher.
3. `scripts/project-state/generate.js`s
   `GATE_EXECUTION_OVERRIDES['unit-tests']`-Kommando enthält das nötige
   Flag, damit der reale Zustandsbericht-Lauf in CI davon profitiert.

**Hinweis zu Tests:** `generate.js` ist laut eigenem Modul-Docstring die
bewusst ungetestete I/O-Randschicht dieses Vorhabens (reine Logik liegt in
den Nachbarmodulen und ist dort getestet; `generate.js` selbst folgt, wie
`scripts/release.js`, demselben Muster: dünne Ränder ohne eigene Tests).
Es gibt kein `generate.test.js`. Die Änderung ist ein Flag an einem
Shell-Kommando, das einen echten `vitest`-Subprozess startet — dafür gibt
es in den bestehenden Konventionen dieses Projekts keine sinnvolle
Unit-Test-Fläche; der Beleg ist der reale Kommandolauf (Kriterium 1), nicht
ein automatisierter Test. Der `test-author`-Schritt entfällt daher bewusst
für diese Änderung, analog zu invariant 2 des Metis-Regelbuchs.

## Plan

## Tasks

## Decisions

- **Timeout-Flake (Issue 0110) wird hier nicht mitbehoben.** Eigenständiger
  Defekt, eigene Akzeptanzkriterien; diese Änderung muss unabhängig davon
  korrekt sein, da jeder künftige rote Lauf sonst dasselbe Symptom erzeugt.
  *(Default, unanswered.)*
- **Kein `test-author`-Schritt.** Die Änderung betrifft ausschließlich die
  ungetestete I/O-Randschicht (`generate.js`); Beleg ist der reale
  Kommandolauf, siehe Hinweis in den Acceptance Criteria. *(Default,
  unanswered — dokumentiert statt stillschweigend übersprungen.)*

## Log

- 2026-08-12 — Closed: merged as PR #184 (`1c5a9eb`). Bookkeeping only; the
  status line was never flipped.

- 2026-07-30: Diagnose abgeschlossen (Live-Seite, GitHub-Actions-Rohlog,
  lokale Reproduktion). Ursache bestätigt: Vitests
  `coverage.reportOnFailure: false` unterdrückt `coverage-final.json` bei
  jedem roten Testlauf; `generate.js` liest das als "keine Daten" statt als
  eigenen Zustand.
- 2026-07-30: Umgesetzt — `GATE_EXECUTION_OVERRIDES['unit-tests']` in
  `scripts/project-state/generate.js` um `--coverage.reportOnFailure`
  ergänzt. Verifiziert (Kriterium 1, echter Lauf statt nur gelesen):
  `rm -rf coverage && npx vitest run --coverage --coverage.provider=v8
  --coverage.reporter=json --coverage.reportOnFailure` gegen eine Datei mit
  einem absichtlich roten Test (1 bestanden, 1 fehlgeschlagen) → Exit 1,
  `coverage/coverage-final.json` wird trotzdem geschrieben (167 Einträge).
  Vor der Änderung (ohne das Flag) entsteht bei demselben roten Lauf gar
  kein `coverage/`-Verzeichnis. Kriterium 2 (grüner Lauf unverändert):
  `npx vitest run scripts/project-state`, 10 Dateien / 110 Tests, Exit 0;
  zusätzlich `npm run lint` und `npm run typecheck`, beide Exit 0.
- 2026-07-30: Unabhängige Prüfung durch `metis:reviewer` (frischer
  Kontext, nur Diff + Intent). Alle drei Akzeptanzkriterien bestätigt,
  jeweils durch eigene reale Läufe nachvollzogen (nicht nur gelesen):
  roter Lauf schreibt `coverage-final.json` (2.161.265 Bytes, echte
  Coverage-Daten); grüner Lauf mit und ohne Flag liefert byte-identisches
  `coverage-final.json` (JSON-kanonisiert verglichen) — das Flag ist auf
  grünen Läufen ein No-op. `--coverage.reportOnFailure` als offizielles,
  zweckgebautes Vitest-Flag bestätigt (`npx vitest --help --coverage`).
  Blast-radius-Prüfung: `ci.yml`s `lint-and-test`-Job läuft `npx vitest
  run` ohne Coverage-Flags und ruft `generate.js` nie auf — unberührt; das
  Gate-Ergebnis (`gates.js`) bleibt unverändert an den echten Exit-Code
  gekoppelt, ein roter Lauf zeigt weiterhin `findings`, nie fälschlich
  `passed`. Keine Funde. Einzige Anmerkung: Log/Checkpoints trugen zum
  Prüfzeitpunkt noch keinen Beleg der Kriterium-1/2-Läufe — mit diesem
  Log-Eintrag nachgetragen.

## Checkpoints

### Before implementation

- Does this match what was asked? Ja — die Statusseite hat tatsächlich
  keine Coverage-Daten mehr; die Ursache ließ sich bis auf Vitests
  eigenes Default-Verhalten zurückverfolgen und real reproduzieren.
- What surprised me? Dass der komplette Coverage-Teil des Berichts von
  einem einzelnen (bereits bekannten, unabhängigen) flakigen Test
  abhängt — nicht offensichtlich aus dem Symptom "keine Coverage"
  ersichtlich, ohne das Rohlog des CI-Laufs zu lesen.
- What am I assuming without having verified it? Dass der
  CPU-Last-Flake in `e2e.testcatalog.test.js` (Issue 0110) tatsächlich
  die *einzige* aktuelle Rot-Ursache ist. Für dieses Issue irrelevant,
  da der Fix unabhängig von der konkreten Fehlerursache wirkt.

### Before the PR

- Does this match what was asked? Ja — alle drei Akzeptanzkriterien
  sind durch reale Läufe belegt (eigene und die des unabhängigen
  Reviewers), keine Funde in der frischen Prüfung.
- What surprised me? Wie klar sich Kriterium 2 (grüner Lauf
  unverändert) belegen ließ — byte-identisches `coverage-final.json`
  mit und ohne Flag, kein Rätselraten nötig.
- What am I assuming without having verified it? Dass GitHub Actions'
  reale `status-report.yml`-Umgebung sich bezüglich `--coverage
  .reportOnFailure` genauso verhält wie lokal — plausibel (reines
  Vitest-Verhalten, keine Umgebungsabhängigkeit erkennbar), aber erst
  am nächsten echten Workflow-Lauf auf `main` endgültig bestätigt.

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
