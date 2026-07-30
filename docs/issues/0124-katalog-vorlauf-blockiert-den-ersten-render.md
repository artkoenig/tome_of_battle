---
status: backlog
branch:
pr:
---

# Katalog-Vorlauf blockiert den ersten Render (268–600 ms Freeze)

## Intent

Seit Issue 0121 liest die Oberfläche ihren Bericht aus den rohen
Katalogdateien. Der teure Teil davon — `prepareDataset`, das XML-Lesen
und Auflösen — läuft **synchron im Render**: in `useEvaluation` beim
Öffnen eines Rosters und in `NewRosterModal` beim Öffnen des
Anlege-Dialogs. Gemessen an der eingefrorenen WHFB6-Fixture (jsdom):
**268 ms** bei einem Katalog, **599 ms** bei drei; das anschließende
`evaluate` kostet 51 ms. Vor dem Cutover fiel das XML-Lesen einmalig
beim Import bzw. Start an, und der Render-Pfad kostete rund 27 ms.

Der Cache je Datensatz greift (Kriterium 8 von Issue 0121, per
Aufrufzähler geprüft) — der **erste** Treffer je System bleibt aber ein
spürbarer Ruckler ohne jeden Ladehinweis. Der Kopfkommentar des Hooks
räumt das ein und verweist auf „spätere Tasks", die es nicht gibt.

Acceptance criteria:

1. Beim Öffnen eines Rosters, dessen Datensatz noch nicht aufbereitet
   ist, blockiert die Oberfläche nicht: entweder ist der Vorlauf aus dem
   Render heraus verlagert, oder der Nutzer sieht währenddessen einen
   Ladezustand statt eines eingefrorenen Fensters.
2. Ist der Datensatz bereits aufbereitet, kostet das Öffnen weiterhin
   nur die Auswertung (kein neuer Vorlauf) — der Zähler-Test aus
   Issue 0121 bleibt grün.
3. Dasselbe gilt für den Anlege-Dialog, der `describeSystem` ruft.
4. Die gemessene Zeit bis zum ersten sichtbaren Editor-Inhalt ist an der
   echten Fixture belegt (Kommando und Zahl im Issue notiert), nicht nur
   behauptet.

## Plan

## Tasks

## Decisions

- **Nicht in Issue 0121 behoben.** Die Entkopplung ist ein
  Architektur-Eingriff (Nebenläufigkeit, Ladezustände) und gehörte nicht
  in den Cutover-Schnitt; Kriterium 8 verlangte nur den Cache, und der
  greift. *(Default, unanswered.)*

## Log

- 2026-07-30: Von der Prüfung zu Issue 0121 gefunden (Befund 6), mit
  Messung gegen den Stand vor dem Cutover.

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
