---
status: backlog
branch:
pr:
---

# „Auffüllen" zeigt dieselbe Einheit mehrfach, wenn sie schon mehrfach in der Liste steht

## Intent

Das Auffüll-Panel sammelt einen Vorschlag **je Slot**; der Aushebe-Dialog
sammelt einen **je Definition** (`seenDefIds`, `CategoryUnitAdder.jsx`).
Stehen zwei Auswahlen derselben Einheit in der Liste und darf sie noch
wachsen, erzeugt jede ihren eigenen Vorschlag: zwei Zeilen mit demselben
Namen, demselben Preis und derselben Wirkung.

Reproduziert (Prüfung zu Issue 0135): ein Eintrag mit `max 4`,
`scope="force"`, zweimal mit Anzahl 1 im Roster. Der Bericht führt die Slots
`0/0` und `0/1`, beide `occupied`, `headroom 2`, `costs.pts 40`. Das Panel
rendert `["Speertraeger +40 Pkt", "Speertraeger +40 Pkt"]` — für den Nutzer
nicht unterscheidbar.

Das ist kein Fehler der Auswahlregel (beide Slots sind wirklich wählbar),
sondern eine Frage der Darstellung: Doppel verbrauchen die acht sichtbaren
Plätze, sodass ein Panel überwiegend aus Wiederholungen bestehen kann.

Acceptance criteria:

1. Führt die Liste mehrere Auswahlen derselben Definition mit Restspielraum,
   erscheint dafür **eine** Zeile im Auffüll-Panel, nicht eine je Auswahl.
2. Der „+"-Knopf dieser Zeile wirkt auf genau eine dieser Auswahlen, und die
   Liste enthält danach eine Instanz mehr.
3. Vorschläge an **verschiedenen** Trägern bleiben getrennt: dieselbe Option
   an zwei verschiedenen Einheiten sind zwei Zeilen, je mit ihrer Einheit
   benannt (Kriterium 6 aus Issue 0135 bleibt gültig).

## Plan

## Tasks

## Decisions

## Log

- 2026-08-12 (real-data E2E) — **Reproduces on real data.** Definitive corpus,
  "Skeletons" (`9ac2-f4c1-bcc3-3aee`) standing twice in one contingent: the
  report carries two occupied slots, `0/0` and `0/1`, both with `current=2` and
  unlimited headroom. One suggestion per slot with no dedup by definition
  (`AutoFillSuggestions.jsx:109`) turns that into two rows a user cannot tell
  apart, while the adder dedups the same pair by `seenDefIds`.

- 2026-08-12 (re-check, independent probe) — **Reproduces verbatim.** An entry
  with `max 4 scope="force"`, 40 pts, standing twice with count 1: the report
  carries the slots `0/0` and `0/1`, both `occupied`, both `headroom 2`,
  `costs.pts 40`, and the rendered panel shows two indistinguishable rows
  `["Speertraeger+40 Pkt", "Speertraeger+40 Pkt"]`. The cause is one line: the
  collector pushes one suggestion per slot with no dedup by definition
  (`AutoFillSuggestions.jsx:109`), while the adder dedups by `seenDefIds`.

- 2026-07-31: Von der Prüfung zu Issue 0135 gefunden (Befund F3), mit
  Reproduktion. Verletzt kein Kriterium jener Issue und wandert deshalb
  hierher statt in ihren PR.

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
