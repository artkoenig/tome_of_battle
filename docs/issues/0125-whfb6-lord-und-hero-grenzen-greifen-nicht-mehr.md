---
status: backlog
branch:
pr:
---

# WHFB6: Lord- und Hero-Grenzen greifen nicht mehr (unbegrenzte Basis + increment)

## Intent

In der eingefrorenen WHFB6-Fixture zeigte die Oberfläche vor Issue 0121
am Kategorie-Chip „Lord" die Grenze `0 / MAX: 1`, und ein zweiter Lord
war im Aushebe-Dialog gesperrt. Nach dem Cutover steht dort nur noch
`0` — keine Grenze, keine Sperre, keine Verletzung, wenn vier Lords in
der Liste stehen.

Der Grund liegt **in den Katalogdaten**, nicht in der Engine.
`Warhammer Fantasy Battle 6th edition.gst`, `categoryLink
id="223a-0bf6-f992-7db0"` deklariert:

```xml
<constraint type="max" value="-1.0" .../>
<!-- dazu Modifikatoren: set 0 unterhalb 2000 Punkte,
     increment +1 je 1000 Punkte ab 1999 -->
```

Bei 2000 Punkten greift der `set 0` nicht mehr, und der `increment`
rechnet auf der **unbegrenzten** Basis `-1`. Nach
`docs/battlescribe-data-format.md` §7.6 gilt: „Arithmetik auf einer
unbegrenzten Grenze lässt sie unbegrenzt" — der Evaluator liest also
richtig, und die 1 des alten Solvers war falsch gerechnet. Die
bsdata-Doku hat Vorrang (CLAUDE.md), deshalb ist das **kein**
Engine-Defekt.

Gewollt hat der Katalogautor offensichtlich „ein Lord je 1000 Punkte ab
1999". Das lässt sich nur schreiben, indem der `increment` auf einer
konkreten Basis steht (z. B. `value="0"` als Grundwert) statt auf dem
Sentinel. Damit ist das ein **Datenfehler im Katalog-Fork** — genau die
Klasse von Befund, die ADR-0034 dorthin verweist und weder der Engine
noch dem Bericht zuschlägt.

Der Effekt ist nutzersichtbar und nicht klein: in WHFB6 begrenzt
derzeit gar nichts mehr die Zahl der Lords und Helden.

Acceptance criteria:

1. Für die WHFB6-Daten ist entschieden und notiert, wo die Korrektur
   stattfindet: im Katalog-Fork (Grundwert statt Sentinel) oder gar
   nicht (bewusst hingenommen).
2. Wird im Fork korrigiert: bei 2000 Punkten meldet der Bericht für die
   Kategorie „Lord" eine `max`-Grenze von 1, und ein zweiter Lord ist
   `isBlocked`. Belegt an der eingefrorenen Fixture, nicht behauptet.
3. Die Fixture unter `src/__fixtures__/whfb6/` und die davon abhängigen
   E2E-Erwartungen sind mit der Entscheidung in Deckung.

## Plan

## Tasks

## Decisions

- **Kein Engine-Defekt.** §7.6 der bsdata-Doku entscheidet den Fall
  gegen den alten Solver; die Doku hat laut CLAUDE.md Vorrang vor ADRs
  und vor dem Altverhalten. *(Quelle: Prüfrunde 2 zu Issue 0121,
  2026-07-30.)*
- **Nicht in Issue 0121 behoben.** Eine Katalogdaten-Korrektur liegt
  außerhalb der acht freigegebenen Kriterien und außerhalb dieses
  Repositoriums. *(Default, unanswered.)*

## Log

- 2026-08-12 (re-check, independent probe) — **Reproduces exactly**, all five
  fixture catalogues of `src/__fixtures__/whfb6/` loaded, empty Vampire Counts
  contingent, the Lord `categoryLink` `223a-0bf6-f992-7db0`:
  1500 pts -> `effectiveMax 0`, `isBlocked true`; 2000 pts -> `effectiveMax
  null`, `isBlocked false`; 3000 pts -> `null`. The Heroes link
  `7697-ca4b-195e-cd8d` reads `null` at every budget and carries no
  `<constraint>` in the fixture at all — confirmed by reading the `.gst`, where
  the Lord link declares `max -1` plus the `set 0` below 2000 and the
  `increment +1` per 1000 above 1999.

- 2026-08-12 — Reproduced against the frozen fixture, and the measurement adds
  one fact the file did not have. Empty Vampire Counts contingent over
  `src/__fixtures__/whfb6/`, the Lord `categoryLink` `223a-0bf6-f992-7db0`:
  - 1500 pts -> `effectiveMax 0` (the `set 0` below 2000 holds),
  - 2000 pts -> `effectiveMax null` (unlimited),
  - 3000 pts -> `effectiveMax null`.
  So the cap does not merely fail to rise, it disappears the moment the list is
  big enough to want it. The Heroes `categoryLink` `7697-ca4b-195e-cd8d` reads
  `null` at every budget for a different reason: it carries no `<constraint>` in
  the fixture at all, so there is nothing for a fork correction to fix there.
  The engine reading is unchanged and correct per §7.6; the decision the file
  asks for is still open.

- 2026-07-30: In Prüfrunde 2 zu Issue 0121 gefunden (Befund B4), belegt
  über den Screenshot-Vergleich gegen die Merge-Base
  (`.screenshots/desktop_06_unit_adder.png`).

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
