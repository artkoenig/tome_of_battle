---
status: active
branch: claude/was-ist-hier-zu-tun-dy2le2
pr:
---

# Gewählte, effektiv versteckte Auswahl erzeugt keinen Fehler

## Intent

Das BSData-Wiki (*Data structure overview*, „Props: Hidden") beschreibt die
Gegenrichtung zur Min-Unterdrückung aus Issue 0088: Eine Auswahl, die im
Roster **liegt**, deren Definition aber effektiv versteckt ist (Basis-Attribut
oder `hidden`-Modifier), soll einen Fehler in der Fehlerliste erzeugen — der
Spieler hat etwas gewählt, das ihm gar nicht angeboten werden dürfte
(typisch: Armee-Variante gewechselt, Altauswahl bleibt liegen).

Die Reinraum-Engine (`src/evaluator/`) kennt diese Prüfung nicht: `isHidden`
ist im Bericht ein reines Capability-Flag, ein Verstoß entsteht nicht. In
Issue 0088 wurde entschieden, diese Gegenrichtung nicht im selben Lauf
umzusetzen, sondern hier zu erfassen.

Acceptance criteria:

1. Liegt im Roster eine Auswahl, deren Träger-Definition zur Auswertungszeit
   effektiv versteckt ist, enthält die Meldungsliste dafür einen
   blockierenden Verstoß.
2. Wird die Definition (etwa per Modifier) wieder sichtbar, verschwindet
   dieser Verstoß.
3. Der Verstoß benennt die betroffene Auswahl über stabile Merkmale
   (Definitions-/Link-Id), nicht über Anzeigenamen.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

A hidden selection carries no limit, no actual and no bound, so it is not a
derived limit message and cannot be squeezed into one. It becomes a **third
message origin** in the one message list (`MessageOrigin.HIDDEN_SELECTION`),
built in `report.js` beside the author messages: one message per **occupied**
slot whose capability record reads `isHidden`. Reading the capability record
means reading the same effective state the slot shows — the rule inherits its
dynamics (an unhiding modifier removes the message) and every source of
concealment (base attribute, link-OR-target, a hiding group above) for free.

The UI side is a single new key in the message projection
(`validation.evaluator.hiddenSelection`, `src/i18n/violationMessages.js`);
everything else already routes by anchor path and by severity, so the message
reaches the unit card, the validation panel and the blocking count untouched.

## Tasks

- [x] `MessageOrigin.HIDDEN_SELECTION` in `src/evaluator/model.js`.
- [x] `classifyHiddenSelection` in `src/evaluator/violationClassification.js` —
      origin, severity `error` (the wiki states it), anchor, nothing else.
- [x] `hiddenSelectionViolationsOf` in `src/evaluator/report.js`, occupied slots
      only, feeding the same `violations` list.
- [x] Message projection and locale entries (de/en) for the new origin.
- [x] Tests: `src/evaluator/report.hiddenSelection.test.js` (12 cases over all
      four criteria), i18n projection cases, coverage of the new key in both
      locales.
- [x] Docs: `docs/battlescribe-data-format.md` §8 (the counter-direction rule)
      and `docs/evaluator-architecture.md` §3.6 (third origin, pseudocode).

## Decisions

- **Herkunft:** Abspaltung aus Issue 0088 (Decisions, 2026-07-29): die
  Wiki-Gegenrichtung gehört nicht in den Min-Unterdrückungs-Lauf.
- **Occupied slots only.** A mandatory phantom and an offer anchor hold no
  instance, a group or category anchor is a frame and not a selection — none of
  them is "already selected". Default taken, not a user question.
- **A hidden ancestor reports for itself, not for its children.** The same cut
  the limit layer already draws ("what counts is the carrier's own effective
  hidden"); otherwise one hidden unit would flood the list with a message per
  option below it.
- **Own message origin instead of a synthetic limit.** A fabricated limit id
  with an invented actual/bound would put a number in front of the user that no
  catalogue declares; the origin discriminator exists precisely so a message can
  say which fields it carries.

## Log

- 2026-08-13 (implemented) — The report carries a third message origin,
  `hiddenSelection`. Verified end to end in the running app: a hand-written
  `.ros` holding "Stone Trolls" (Orcs and Goblins, `4112-026b-500a-b6fd`,
  `hidden="true"`, unhidden only inside the "Troll Mountain Country Horde"
  force) in a **Standard** force shows the message on the unit card and in the
  rule-violations panel, and the status counter moves to INVALID (4).
  Commands: `npm test` — 304 files / 3858 unit tests plus the puppeteer app E2E,
  exit 0; `npm run lint` and `npm run typecheck` — clean, only pre-existing
  warnings; `npm run analyze` — no new knip or dependency-cruiser findings.
  One existing case had to be adjusted, and that adjustment is the interplay
  worth recording: `constraints.hiddenMin.test.js` claimed the whole report of a
  hidden troll with a violated min AND max is exactly one message. It is now two
  — the max violation plus this new one; the case asserts per origin instead.
  **False-positive risk measured** on the frozen corpora: in the app fixture
  (`src/__fixtures__/whfb6`) every one of the 13 `hidden="true"` elements
  carries its own unhiding modifier, so no ordinary roster is affected; across
  the 13 definitive books, 30 of 414 hidden elements carry none (PLACEHOLDER
  groups, cross-faction leftovers, a "Logic:" helper entry) — a roster holding
  one of those is exactly the case the wiki wants flagged.

- 2026-08-12 (real-data E2E) — **Reproduces end to end on real data.** Whole
  definitive corpus (18 books) prepared in one dataset, force "Standard (VC-AB)"
  (`e989-15b8-7eb6-9668`), unit **"Dire Wolves"** holding its own option
  **"Scouts"** (`ff2c-a7c6-4cab-b0fd`), which the catalogue declares
  `hidden="true"`. Report through the facade: slot `0/0/0` reads
  `anchorKind=occupied, isHidden=true, current=1` — the report knows the
  selection is there and knows it should not be offered — and **not one of the 5
  violations names it**. The shape is everywhere in the data: 545 elements carry
  `hidden="true"` and 1,456 modifiers write `field="hidden"` across both corpora.

- 2026-08-12 (re-check, independent probe) — **Reproduces unchanged.** A unit
  holds an option declared `hidden="true"`. Its slot reads
  `{anchorKind: "occupied", isHidden: true, current: 1}` at path `0/0` — the
  report knows the selection is there and knows it should not be offered — and
  the report carries **zero violations and zero diagnostics**.

- 2026-08-12 — Reproduced on the current tree. A unit holds an option declared
  `hidden="true"` in the roster. The report gives that slot
  `{anchorKind: "occupied", isHidden: true, current: 1}` — it knows the
  selection is there and knows it should not be offered — and reports **no**
  violation and **no** diagnostic. `isHidden` is read in exactly one direction
  today: `constraints.js:202` suppresses MIN violations at hidden carriers
  (issue 0088). The counter-direction this file asks for does not exist.

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
