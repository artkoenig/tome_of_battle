Status: resolved
Type: chore
Blocked by: None

## Description
Der bisher dokumentierte Versions-Bump-Workflow (`docs/agents/issue-tracker.md`,
ADR 0019) sah vor, nach dem Merge eines main-issues direkt auf `main` einen
Versions-Commit + Tag zu pushen. Der `pre-push`-Hook lehnt aber JEDEN Push auf
`main`/`master` kategorisch ab (nur PR-Merges dürfen `main` bewegen) — dafür
gibt es keine Ausnahme. Der dokumentierte Workflow war damit in der Praxis nur
über `git push --no-verify` durchführbar, was dem Grundsatz "kein Hook-Bypass
ohne explizite Nutzeranfrage" widerspricht.

Korrigierter Workflow: Der Versions-Bump (`package.json`) wird VOR dem Merge
direkt auf dem `issue/<slug>`-Branch committet, ist damit Teil des PRs und
landet über den Squash-Merge automatisch im `main`-Commit. Erst NACH dem
Merge wird `main` lokal aktualisiert (`git pull`) und der Tag `v<version>` auf
den entstandenen Commit gesetzt. Gepusht wird dann nur der Tag-Ref
(`git push origin v<version>`) — das ist kein Push auf `refs/heads/main` und
wird vom Hook daher nicht blockiert, kein `--no-verify` nötig.

## Acceptance Criteria
- [ ] `docs/agents/issue-tracker.md`, Abschnitt "Version bump after merging a
      feature/fix main-issue": beschreibt den Versions-Bump-Commit als Teil
      des PRs (vor dem Merge) und das Taggen + reinen Tag-Push nach dem Merge.
- [ ] `docs/adr/0019-manuelle-versionierung-und-release-freigabe.md`:
      Entscheidungstext an denselben Ablauf angepasst.
- [ ] `package.json` wird im selben PR auf 1.0.1 gebumpt (Patch, da das
      vorausgehende main-issue #21 vom Typ `fix` war) — demonstriert/nutzt den
      korrigierten Ablauf direkt.

## Comments
- docs/agents/issue-tracker.md und ADR 0019 korrigiert: Versions-Bump-Commit ist jetzt Teil des PRs (vor dem Merge), nach dem Merge wird nur noch der Tag gepusht statt eines main-Branch-Pushs. package.json im selben PR auf 1.0.1 gebumpt. scripts/release.test.js grün.
