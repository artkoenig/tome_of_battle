---
status: backlog
branch:
pr:
---

# Statusbericht im Epic-Battlefield-Design

## Intent

Die automatisch erzeugte Statusbericht-Seite unter `/status` benutzt weiterhin
das alte helle Pergament-Design, während die Landingpage bereits auf das
dunkle Fantasy-Design „Epic Battlefield" umgestellt ist. Beide Seiten gehören
zur selben Anwendung und sollen als eine wirken.

Gewünschtes beobachtbares Verhalten: Der Statusbericht sieht aus wie die
Landingpage — dunkler Hintergrund, Obsidian-Glasmorphismus-Karten mit goldenen
Akzenträndern, dieselben Schriftrollen (Cinzel für Überschriften, Outfit für
Zwischenüberschriften, Badges und Tabs, Inter für Fließtext).

Betroffen ist `scripts/project-state/renderReport.js` mit seinem eingebetteten
CSS (`REPORT_STYLES`); das erzeugte `docs/status/index.html` gehört mit
aktualisiert.

Acceptance criteria:

1. Die Statusbericht-Seite trägt das Epic-Battlefield-Design: dunkler
   Schiefer-Hintergrund (`#07090E`), Karten als Obsidian-Glas
   (`rgba(21, 26, 38, 0.85)`), goldene Akzentränder
   (`rgba(212, 175, 55, 0.25)`).
2. Die Typografie nutzt Cinzel für Überschriften, Outfit für
   Zwischenüberschriften, Badges und Tabs, Inter für Fließtext.
3. Der Kopfzeilen-Link `← Zurück zur Landingpage` ist im gotischen
   Gold-Button-Stil der Landingpage-CTA gestaltet.
4. `scripts/project-state/renderReport.test.js` läuft grün.
5. `docs/status/index.html` ist mit dem neuen Design neu erzeugt und
   eingecheckt.

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/57-status-report-dark-fantasy-design/issue.md`, Status
  `ready-for-agent`). Inhaltlich unverändert; die Kriterien sind aus der
  Checkliste in nummerierte, einzeln prüfbare Form gebracht und die
  Farb-/Schriftvorgaben aus dem alten `## Solution`-Abschnitt zu den Kriterien
  gezogen, damit die Vorgabe prüfbar ist statt nur beschrieben.

## Log

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
