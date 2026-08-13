---
status: done
branch:
pr:
---

# Beim Cutover verlorene UI-Bequemlichkeiten: Auto-Fill-Restpunkte und General-Sortierung

## Intent

Der Cutover auf die Reinraum-Engine (Issue 0121) hat zwei
Oberflächen-Funktionen mitgenommen, die kein Akzeptanzkriterium verlangt
hat und die auch keine Entscheidung dort abdeckt. Beide hingen an
Solver-Code, der beim Abriss verschwand. Sie sind hier festgehalten,
damit der Mensch entscheidet: zurückholen oder bewusst fallenlassen.

**1. Auto-Fill schlug Kombinationen für die Restpunkte vor.** Vor dem
Cutover zeigte `AutoFillSuggestions` bei erfüllten Pflichten und
verbleibendem Budget ein Panel: „Du hast noch N Punkte" mit „Perfekten
Kombinationen" und „Möglichen Upgrades" — eine Knapsack-Suche des
Solvers über die Restpunkte. Heute speist sich das Panel allein aus
Pflicht-Signalen des Berichts (`isMandatoryUnmet`); wer alle Pflichten
erfüllt hat und noch 200 Punkte übrig hat, sieht **gar kein Panel
mehr**. Zehn i18n-Schlüssel (`editor.autofill.remainingBadge`,
`introPrefix`, `introSuffix`, `perfectCombos`, `exact`,
`possibleUpgrades`, `showLess`, `showAll`, `forUnit`, `apply`) wurden
ersatzlos gelöscht.

**2. Der Konfigurator stellte die „General"-Option voran.** Vor dem
Cutover sortierte `SelectionConfigurator` Gruppen und Zeilen so, dass die
General-Option oben stand — erkannt über Stichwortlisten
(`GENERAL_EXACT_KEYWORDS`, `GENERAL_SUBSTRING_KEYWORDS`) und
systemgebundene IDs (`isQuirkGeneralEntryId`). Heute erscheinen die
Optionen in Katalogreihenfolge; in WHFB6 („Vampire Counts.cat" führt
sechs Einträge namens „General") ist das sichtbar.

Zu 2 gibt es eine Spannung, die die Entscheidung trägt: **ADR-0034**
ordnet genau solche Stichwort-Heuristiken weder der Engine noch dem
Bericht zu — sie gelten als Datenfehler, der im Katalog-Fork zu beheben
ist. Eine Rückkehr wäre also eine bewusste Ausnahme in der Oberfläche,
keine Selbstverständlichkeit.

Acceptance criteria (gelten erst, wenn der Mensch „zurückholen" wählt;
wählt er „fallenlassen", schließt dieses Issue mit einer notierten
Begründung):

1. Sind alle Pflichten erfüllt und bleibt Budget übrig, zeigt der Editor
   wieder Vorschläge für die Restpunkte, mit der verbleibenden Summe und
   je Vorschlag den Kosten.
2. Die Vorschläge stammen aus dem Bericht (wählbare Slots mit Spielraum
   und ihren `costs`), nicht aus einer neuen Katalog-Ableitung in der
   Oberfläche (ADR-0034).
3. Die General-Option steht im Konfigurator wieder an erster Stelle —
   oder es ist notiert, warum die Sortierung entfällt.

## Plan

## Tasks

## Decisions

- **Closed 2026-08-12 as "deliberately dropped".** The file itself put the
  choice to the human: bring back or drop. Dropped — point 1 is covered by issue
  0135, point 2 is ruled out by ADR-0034. Reopen with one sentence if the
  combination search or the General-first ordering is wanted after all.

- **Nicht in Issue 0121 nachgeholt.** Beides liegt außerhalb der dort
  freigegebenen acht Kriterien; die Regel „ein Fund außerhalb der
  Absicht geht an den Menschen" greift. *(Default, unanswered.)*

## Log

- 2026-08-12 (real-data sweep) — **Closed: both points are already answered
  elsewhere.** Point 1: issue 0135 feeds the panel from the report's selectable
  slots and shows the remaining sum from a 50-point gap upwards; what is gone is
  the knapsack search, and no acceptance criterion ever asked for it. Point 2:
  ADR-0034 assigns keyword heuristics to the catalogue fork, not to the app —
  the data behind it is real (ergofang `Vampire Counts.cat` carries six entries
  named "General"), which makes it a fork-side naming problem, exactly the class
  the ADR routes away from the application.

- 2026-08-12 (re-check, independent probe) — **Point 1 is a decision, not a
  defect any more; point 2 reproduces.**
  - Point 1: measured at the rendered panel with a report from the real facade,
    the panel appears at a gap of 420 and of exactly 50 points and is absent at
    49 and at 10 (`MIN_REMAINING_POINTS = 50`,
    `AutoFillSuggestions.jsx`). What is genuinely gone is the combination
    search: the panel collects one flat list sorted by cost descending, with no
    "perfect combinations" and no knapsack. So the open part of point 1 is only
    whether the 50-point threshold and the flat list are enough — the human's
    call, as this file says.
  - Point 2: `GENERAL_EXACT_KEYWORDS`, `GENERAL_SUBSTRING_KEYWORDS` and
    `isQuirkGeneralEntryId` appear nowhere under `src/` (the only hit in the
    repository is a fixture README). Options render in catalogue order.

- 2026-07-30: Von der Prüfung zu Issue 0121 gefunden (Befunde 3 und 4),
  je mit Reproduktion gegen den Stand vor dem Cutover.
- 2026-07-31: Der Befund oben — „wer alle Pflichten erfüllt hat und noch 200
  Punkte übrig hat, sieht gar kein Panel mehr" — trifft so nicht mehr zu.
  Issue 0135 speist das Panel aus den wählbaren Slots des Berichts und zeigt
  die verbleibende Summe, allerdings **erst ab 50 Punkten Lücke**; bei
  kleineren Resten bleibt es weg. Ob das Punkt 1 dieses Issues abschließt,
  entscheidet der Mensch — die Kriterien hier gelten unverändert erst, wenn er
  „zurückholen" wählt. Punkt 2 (General-Sortierung im Konfigurator) ist
  unberührt.

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
