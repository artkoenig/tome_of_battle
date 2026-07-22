Status: resolved
Type: chore
Blocked by: None

## Description
`docs/status/index.html` ist eine eingecheckte, veraltete deutsche Kopie des
generierten Zustandsberichts (lang="de", Titel „Projektzustandsbericht",
committet mit Issue 57). Sie widerspricht dem dokumentierten Modell:

- ADR 0025: „Der Bericht ist Build-Ausgabe und darf nicht committet werden."
- `.github/workflows/status-report.yml` (Kopfkommentar): „Der Bericht wird
  NICHT committet — er ist reine Build-Ausgabe."
- Der Generator (`scripts/project-state/`) rendert seit Issue 58-i18n englisch
  und schreibt lokal standardmäßig nach `.report/index.html`.

Befund (2026-07-22, per `gh api repos/artkoenig/tome_of_battle/pages`):
Pages läuft auf `build_type: workflow`. Der Workflow baut `docs/` mit Jekyll
nach `_site/` und generiert den Bericht anschließend frisch nach
`_site/status/index.html` — er überschreibt dabei genau die Stelle, an die
Jekyll die eingecheckte Kopie legt. Die Datei hat damit keinerlei Funktion
mehr; für GitHub Pages ist sie nicht nötig. Nichts im Repo referenziert sie
(einzige Fundstelle: historisches Issue 57).

Lösung: `docs/status/index.html` (und damit das Verzeichnis `docs/status/`)
aus dem Repo entfernen. Kein gitignore-Eintrag nötig — kein Werkzeug schreibt
mehr dorthin.

## Acceptance Criteria
- [x] `docs/status/index.html` ist aus dem Repository entfernt (Verzeichnis `docs/status/` verschwindet damit).
- [x] Kein Repo-Inhalt (Workflows, Skripte, Doku außer historischen Issues) referenziert `docs/status/` weiterhin als Quelle.
- [x] Der Status-Report-Workflow bleibt unverändert funktionsfähig (er erzeugt `/status` selbst per `mkdir -p` + Generator).

## Comments
- Umgesetzt: docs/status/index.html per git rm entfernt (Commit auf issue/59-remove-committed-status-report, sauber auf origin/main aufgesetzt, da der Session-Worktree vom noch offenen i18n-Branch abzweigte). Pages verifiziert auf build_type=workflow; /status wird vom Workflow selbst erzeugt. Vier-Achsen-Verifikation gruen: Tests 1426 unit + E2E gruen, Standards ohne blockierende Gates (4 diff-fremde Altlast-Smells notiert), Spec vollstaendig erfuellt, Docs konsistent.
