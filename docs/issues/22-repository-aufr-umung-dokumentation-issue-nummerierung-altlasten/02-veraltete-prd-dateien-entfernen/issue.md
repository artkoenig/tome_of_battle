Status: resolved
Type: chore
Blocked by: None

## Description
Zwei PRD-Dateien sind Altlasten:

- Root-`PRD.md` beschreibt ein Deployment-Cleanup (Staging entfernen,
  ADR-0008 umbenennen, `deploy-vercel.yml` löschen), das bereits vollständig
  umgesetzt ist. Nirgends verlinkt, enthält Pfade zum alten Repo-Namen
  `army_builder`.
- `docs/PRD-collapsible-play-profiles.md` beschreibt ein Feature, das bereits
  umgesetzt ist (`PlayUnitDetails.jsx`), wird aber von keinem `issue.md`
  referenziert.

Beide Dateien werden gelöscht, da ihr Inhalt umgesetzt und sonst nirgends
referenziert ist.

## Acceptance Criteria
- [ ] Root-`PRD.md` ist gelöscht
- [ ] `docs/PRD-collapsible-play-profiles.md` ist gelöscht
- [ ] Keine verbleibenden Links auf eine der beiden Dateien im Repo

## Comments
- Beide veralteten PRD-Dateien (Root-PRD.md und docs/PRD-collapsible-play-profiles.md) geloescht; keine verbleibenden Links im Repo ausser den beschreibenden Issue-Dateien.
