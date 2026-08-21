---
status: done
branch: claude/new-session-065uhx
pr: 255
---

# Doppelte Lesungen und toter Bestand

## Goal
Die halb vollzogene Migration zu ADR-0034 wird zu Ende gebracht: wo eine
Katalog-Lesung neben ihrem Bericht-Äquivalent weiterlebt, bleibt die
Bericht-Seite. Dazu fällt, was nur noch Tests kennen, und `src/utils/` — das in
keine der drei Schichten aus ADR-0037 gehört — wird aufgelöst.

## Acceptance criteria
- AC1 Von `roster/selectionBehavior.js` und `evaluator/groupBehavior.js` bleibt eine Fassung; kein Modul beantwortet dieselbe Frage zweimal. | verify: forge-lint
- AC2 Kein Export existiert, dessen einzige Aufrufer Tests sind; `npm run knip` meldet dazu nichts mehr. | verify: forge-lint
- AC3 `src/utils/` gibt es nicht mehr; jede Datei daraus liegt in der Schicht, in die sie gehört. | verify: forge-lint
- AC4 `roster/rulesEvaluator.js` heißt `roster/profileGrouping.js` — der Name sagt, was das Modul tut, und nichts darin wertet aus. | verify: forge-lint
- AC5 Unterhalb der UI-Schicht wird nicht übersetzt: `fachlogik-kein-rueckgriff` und `keine-i18n-unter-ui` stehen auf `severity: 'error'`. | verify: forge-lint
- AC6 Anzeige und Auswertung sind unverändert; die E2E-Szenarien aus `docs/testing/` bleiben grün, bis auf die in `docs/testing/campaign-state.json` festgehaltenen roten. | verify: forge-test
- AC7 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Die Kostenanzeige-Doppelung — sie hat mit Issue 0158 ihren eigenen Vorgang und ist hier ausgenommen.
- Ein Versionssprung: Aufräumarbeit ohne Freigabegrund.
