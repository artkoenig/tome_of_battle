---
paths:
  - "docs/**"
  - "CLAUDE.md"
  - "CONTEXT.md"
  - "README.md"
---

# Dokumentation

Doku, Issues und Commit-Nachrichten sind deutsch, Code und Bezeichner englisch. `CONTEXT.md`
legt die Begriffe fest, die dieses Projekt eng führt (Release vs. Deployment vs. Version,
Query/Scope/Modifier/ConditionGroup) — vor ihrer Verwendung dort nachsehen.

- **Rangfolge bei Widerspruch:** `docs/battlescribe-data-format.md` → ADR → `docs/project-map.md`.
  Die Karte ist Orientierungshilfe, nie Beleg; wer sie widerlegt findet, korrigiert sie.
- `docs/adr/` ist Pflichtlektüre vor jeder Entwicklung. Ein neuer ADR entsteht aus
  `docs/adr/template.md`, Prozess in ADR 0001, und **braucht eine Zeile in der Tabelle von
  `docs/adr/README.md`** (Nummer, Titel, Status, Datum) — ohne sie ist er unauffindbar.
- Ändert eine Entscheidung eine frühere, wird der alte ADR nicht gelöscht: sein Status wird
  fortgeschrieben und der neue verweist zurück (0029 → 0030 ist das Muster).
- `docs/issues/` ist der Tracker, nicht Prosa — Format und Kommandos in
  `.claude/skills/issue-backend/SKILL.md`. `docs/issues/**/design.md` ist bewusst gitignored:
  Planungsartefakt während der Umsetzung, landet nie im PR.
- `docs/testing/` sind die E2E-Szenarien des Evaluators (`.ros` + `README.md` + `scenario.json`).
  Sie werden **nur** vom `e2e-testcase-author`-Subagenten geschrieben, ausschließlich aus
  Katalogdaten (ADR 0033) — nicht nebenbei in einem Implementierungslauf.
- `docs/` wird als GitHub Pages ausgeliefert (Jekyll). `docs/index.html` ist die committete
  Platzhalter-Wurzel; `/status` ist reine Build-Ausgabe des Zustandsbericht-Workflows und wird
  nie committet.
- Querverweise zwischen den Dokumenten sind relative Links. Wer eine Datei umbenennt, zieht die
  Verweise nach — kaputte Links fallen in keinem Test auf.
