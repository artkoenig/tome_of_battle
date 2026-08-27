---
paths:
  - "docs/**"
  - ".agents/**"
  - "CLAUDE.md"
  - "README.md"
---

# Dokumentation

**Sprache.** Die Prosa in `docs/` ist deutsch: ADRs, PRDs, das Glossar, `project-map.md`, die
Landing-Page. Englisch ist alles, was mitwandert oder gelesen wird, wo kein Deutsch vorausgesetzt
werden kann: Code und Bezeichner, Issues unter `docs/issues/` samt ihren Dateinamen,
Commit-Nachrichten und Pull Requests. So hält es die forge-Regel, und so ist der Baum seit den
Issues 0192 ff. auch tatsächlich — ältere deutsche Commit-Betreffs sind Altbestand, kein Vorbild.
`.agents/AGENTS.md` ist die Ausnahme in der Ausnahme: eine Agentenanweisung, also englisch.

`CLAUDE.md` ist ein Symlink auf `.agents/AGENTS.md` — die echte Datei dort bearbeiten.

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
- `docs/PRD-<thema>.md` ist die Form für Produktentscheidungen, die vor dem Code fallen müssen
  (Umbau mit sichtbarem Nutzereffekt, neues Feature). Aufbau: Problem Statement → Solution →
  User Stories/Requirements → Technical Decisions → Out of Scope. Flach in `docs/`, kein
  Unterordner, kein Index — Issues verlinken es relativ.
- `docs/testing/` sind die E2E-Szenarien des Evaluators (`.ros` + `README.md` + `scenario.json`).
  Sie werden **nur** vom `e2e-testcase-author`-Subagenten geschrieben, ausschließlich aus
  Katalogdaten (ADR 0033) — nicht nebenbei in einem Implementierungslauf.
- `docs/` wird als GitHub Pages ausgeliefert (Jekyll). `docs/index.html` ist die committete
  Landing-Page (statisches HTML plus `docs/assets/landing.css` und `landing.js`, kein Build-Schritt,
  kein Test deckt sie ab — Kriterien werden per `grep` geprüft); `/status` ist reine Build-Ausgabe
  des Zustandsbericht-Workflows und wird nie committet.
- In `docs/assets/` liegen die Bilder der Landing-Page. Es ist **kein** Bildwerkzeug installiert
  (kein sharp, kein PIL, kein ImageMagick). Ein PNG verkleinern geht nur mit einem eigenen
  Node-Skript über `zlib` (inflate → unfilter → Box-Downsampling → deflate); das funktioniert für
  8-Bit-, nicht-interlaced-PNGs, und genau die liegen hier.
- Querverweise zwischen den Dokumenten sind relative Links. Wer eine Datei umbenennt, zieht die
  Verweise nach — kaputte Links fallen in keinem Test auf.
