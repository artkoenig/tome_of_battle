Status: ready-for-agent
Type: feature
Blocked by: None

## Description
Der bisher dokumentierte Ablauf (ADR 0019, CLAUDE.md-Abschnitt "Version bump
after merging a feature/fix main-issue") sieht vor, dass nach dem Merge eines
main-issues vom Typ `feature`/`fix` der Agent lokal `git tag vX.Y.Z` setzt und
ausschließlich diesen Tag pusht (`git push origin vX.Y.Z`). In Cloud-Sessions
(Claude Code on the web) scheitert dieser Tag-Push aber reproduzierbar mit
HTTP 403 vom Git-Relay der Session — der Session-Token erlaubt Branch-Pushes
und PR-Merges (über die GitHub-App-Berechtigung des Session-Backends), aber
keinen direkten Tag-Push, unabhängig von GitHub-seitigen Repo-Einstellungen
(Tag-Protection-Regeln/Rulesets wurden geprüft und angepasst, ohne Wirkung —
die Sperre liegt beim Relay/Session-Token, nicht bei GitHub). Lokales Taggen
aus einer Cloud-Session heraus ist damit strukturell nicht zuverlässig
möglich.

Lösung: Ein neuer GitHub-Actions-Workflow ersetzt den manuellen Tag-Push-Schritt.
Bei jedem Push auf `main` vergleicht er das `version`-Feld in `package.json`
mit dem Vorgänger-Commit. Hat es sich geändert, erstellt und pusht der Workflow
automatisch den Tag `v<version>` — mit dem workflow-eigenen `GITHUB_TOKEN`
(`permissions: contents: write`), das unabhängig vom Session-Relay-Token ist
und daher nicht an dieselbe Sperre stößt. Existiert der Tag bereits (z. B. bei
einem erneuten Lauf), bricht der Workflow ohne Fehler ab (idempotent).

Die Versionsentscheidung selbst bleibt ein bewusster, manueller Akt vor dem
Merge: der Agent schlägt Patch/Minor vor, der Nutzer bestätigt, `package.json`
wird auf dem `issue/<slug>`-Branch committet und wandert per Squash-Merge nach
`main`. `package.json` bleibt Single Source of Truth für die Version — nur der
rein mechanische Tag-Push-Schritt danach wird automatisiert. Der Kern von ADR
0019 ("Release ist ein bewusster Akt, keine Nebenwirkung eines Pushes") bleibt
damit unangetastet; verändert wird nur, WER den bereits feststehenden Tag
pusht.

Dokumentations-Konsistenz ist Teil dieses main-issues:
- ADR 0019 muss den neuen automatisierten Tag-Push-Mechanismus statt des
  manuellen Agent-Schritts beschreiben.
- ADR 0007 (CI/CD Workflow) braucht einen neuen Abschnitt für diesen Workflow
  in der Liste der bestehenden Workflows.
- CLAUDE.md, Abschnitt "Version bump after merging a feature/fix main-issue",
  muss den Tag-Push-Schritt als automatisch (durch den neuen Workflow)
  beschreiben statt als Agent-Handlung nach dem Pull des gemergten Commits.

## Acceptance Criteria
- [ ] Neuer Workflow `.github/workflows/*.yml`, Trigger `push` auf `main`,
      Stil analog zu `ci.yml`/`issue_agent.yml` (explizite `permissions:`,
      deutschsprachige Step-Namen).
- [ ] Erkennt eine Änderung des `version`-Felds in `package.json` gegenüber
      dem Vorgänger-Commit; bei keiner Änderung passiert nichts.
- [ ] Bei erkannter Änderung: erstellt und pusht Tag `v<version>` auf den
      auslösenden `main`-Commit.
- [ ] Idempotent: existiert der Tag bereits, bricht der Lauf ohne Fehler ab
      (kein Doppel-Tag, kein roter Workflow-Status).
- [ ] ADR 0019 beschreibt den neuen Mechanismus statt des manuellen
      Agent-Tag-Push.
- [ ] ADR 0007 listet den neuen Workflow analog zu den bestehenden Einträgen.
- [ ] CLAUDE.md, Abschnitt "Version bump after merging a feature/fix
      main-issue", beschreibt den Tag-Push als automatisch statt als
      Agent-Schritt.

## Comments
