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
