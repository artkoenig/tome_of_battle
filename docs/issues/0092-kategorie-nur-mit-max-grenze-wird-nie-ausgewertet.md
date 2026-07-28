---
status: active
branch: claude/new-session-jnwa1m-0092
pr:
---

# Kategorie nur mit Max-Grenze wird nie ausgewertet

## Intent

`docs/battlescribe-data-format.md` §5.5/§5.6: Grenzen können direkt an der
`categoryEntry`-Definition hängen und gelten dann, ohne dass ein
`categoryLink` sie wiederholt — „Eine Auswertung, die nur
`categoryLink`-Grenzen liest, würde diese Limits still nicht durchsetzen."

Die Engine verankert Kategorie-Grenzen an zwei Stellen: Kategorie-Anker
entstehen nur für die `categoryLink`s einer Force
(`synthesizeForceCategoryAnchors`, `src/evaluator/evalTree.js:302`), und
Pflicht-Phantome nur für Definitionen mit **Min**-Grenze
(`hasMinLimitInFrame`, `evalTree.js:227`). Eine `categoryEntry`, die **nur
eine Max-Grenze** trägt und von keiner Force verlinkt ist, bekommt damit
keinerlei Anker — ihre Grenze wird still nie ausgewertet.

Repro (Audit 2026-07-28, gegen die echte Fassade): `categoryEntry` mit nur
`max=1 scope="roster" includeChildSelections="true"`, zwei Member im Roster →
0 Verstöße; Kontrolle mit zusätzlichem `min` → der Max-Verstoß erscheint
(huckepack auf dem Min-Phantom). Klassische „0–1"-Kodierungen (max ohne min)
sind genau dieses Muster.

Acceptance criteria:

1. Eine `categoryEntry` mit ausschließlich Max-Grenze(n) (`scope="roster"`
   oder `"force"`) wird auch dann ausgewertet, wenn keine Force sie per
   `categoryLink` führt: das Repro meldet Ist 2 gegen Grenze 1.
2. Min- und Max-Grenzen derselben Kategorie liefern unabhängig davon, ob die
   Kategorie zusätzlich verlinkt ist, dieselben Ergebnisse.
3. Es entstehen dadurch keine zusätzlichen Doppelmeldungen (Abgrenzung zu
   Issue 0093).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — anchor unlinked, max-only category
  definitions so their limits are evaluated; the min-phantom path shows the
  mechanism already exists for min limits.
- What surprised me? The asymmetry itself: `hasMinLimitInFrame` deliberately
  filters to min limits, so the fix is likely widening that predicate (or a
  sibling anchor source) rather than new machinery.
- What am I assuming without having verified it? That widening anchor
  synthesis to max-only categories does not double-report categories that
  ARE linked (criterion 3 — the interplay with force category anchors and
  with issue 0093's known min duplication needs care), and that the
  criterion-2 equivalence is observable through the existing report shape.
  The or-frame question (roster vs force scope for an unlinked category in
  a force frame) may hold edges the criteria do not decide — test-author
  should flag, not guess.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
