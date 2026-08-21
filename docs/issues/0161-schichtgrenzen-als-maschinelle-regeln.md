---
status: done
branch: claude/forge-work-0161-bmddpn
pr: 253
---

# Schichtgrenzen als maschinelle Regeln, zunächst warnend

## Goal
Die Schichtung aus ADR-0037 (UI → Fachlogik → Daten) steht als Regelsatz in
`.dependency-cruiser.cjs` und macht den heutigen Bestand an Verstößen sichtbar,
ohne einen davon zu beheben. Erst danach lässt sich jede folgende Phase daran
messen, wie viele Kanten sie geschnitten hat.

## Acceptance criteria
- AC1 `.dependency-cruiser.cjs` kennt die vier Regeln `ui-nicht-auf-daten`, `daten-kein-rueckgriff`, `fachlogik-kein-rueckgriff` und `keine-i18n-unter-ui`, jede mit `severity: 'warn'` und derselben Testdatei-Ausnahme wie die bestehenden Regeln. | verify: forge-lint
- AC2 Die Schichtpräfixe stehen als benannte Konstanten neben den vorhandenen (`PARSER_LAYER`, `EVALUATOR_LAYER`, …) und sind einzeln kommentiert. | verify: forge-lint
- AC3 `ui-nicht-auf-daten` meldet genau die 14 in ADR-0037 aufgezählten Kanten und keine weitere; die Zahl steht als Kommentar an der Regel, damit ein Zuwachs auffällt. | verify: forge-lint
- AC4 `forge-lint` bleibt grün — warnende Regeln blockieren nicht. | verify: forge-lint
- AC5 Die Schichttabelle aus ADR-0037 steht in `docs/project-map.md`, und die Bereichsnotizen `.claude/rules/areas/ui.md` und `evaluator.md` verweisen auf den ADR. | verify: forge-lint
- AC6 Alle vier Wrapper sind grün. | verify: forge-test

## Out of scope
- Jede Verlegung eines Imports — diese Ausgabe beschreibt nur.
- `src/services/` und die ViewModel-Regeln — Issues 0167 bzw. 0166.
- Ein Versionssprung: nichts davon ist für Benutzer sichtbar.
