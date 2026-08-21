---
status: done
branch: claude/new-session-065uhx
pr: 255
---

# Verzeichnisse auf die Schichtnamen umbenennen

## Goal
Letzte, ausdrücklich optionale Phase von ADR-0037: die Verzeichnisse heißen wie
die Schichten, denen sie angehören. Reiner Umbenenn-Vorgang ohne
Verhaltensänderung — erst sinnvoll, wenn alle vorherigen Phasen gemergt sind, weil
er jeden offenen Zweig unauflösbar in Konflikt bringt.

## Acceptance criteria
- AC1 Die Schichten liegen unter `src/ui/`, `src/domain/`, `src/data/` und `src/shared/`; jedes heutige Verzeichnis ist genau einer davon zugeordnet. | verify: forge-build
- AC2 Sämtliche Regeln in `.dependency-cruiser.cjs` und `.oxlintrc.json` benennen die neuen Präfixe und bleiben blockierend. | verify: forge-lint
- AC3 Der Diff besteht aus Verschiebungen und Import-Pfaden; keine Datei ändert ihren Inhalt darüber hinaus. | verify: forge-test
- AC4 `docs/project-map.md`, die ADRs und die Bereichsnotizen unter `.claude/rules/areas/` nennen die neuen Pfade; die `paths:`-Globs greifen weiterhin. | verify: forge-lint
- AC5 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Jede inhaltliche Änderung.
- Ein Versionssprung.
