---
status: done
branch: ccr-7ce343a0-iptau5
pr:
---

# Lords sind unter 2000 Punkten wählbar (Definitive-Daten, versteckte Kategorie sperrt nicht)

## Goal

Bei einer Armee mit 1000 Punkten (WHFB6 Definitive-Fork) kann der Nutzer Kommandanten
(Kategorie „Lord") ausheben, obwohl die Regeln das erst ab 2000 Punkten erlauben. Die
Definitive-Daten kodieren die Grenze **nicht** über die Max-Grenze: der Constraint
`fda5-91c2-e17f-774c` (`max 1`, `scope="parent"`) behält zwischen 500 und 1999 Punkten seinen
Grundwert 1 — nur die `set 0`-Modifier für Warbands/Border Patrols und die `set N`-Stufen ab
2000 greifen. Die Sperre unter 2000 Punkten steckt allein im `categoryEntry`
`d024-d25b-a9b4-73b6` („Lord") des `.gst`: `set hidden=true` bei
`limit::ecfa-8486-4f6c-c249 < 2000`. Die App wertet dieses effektive `hidden` der Kategorie
offenbar nicht als Sperre für Einträge mit dieser Primärkategorie aus. Laut
`docs/battlescribe-data-format.md` §5/§8 darf eine effektiv versteckte Entität nicht als Option
angeboten werden, und eine trotzdem gewählte ist ein Fehler. Zu klären und festzunageln: wie
das effektive `hidden` einer `categoryEntry` auf ihre Einträge wirkt (ggf. §15-Lücke, dann
Entscheidung begründen), und dass es im Aushebe-Dialog und im Bericht ankommt.

## Acceptance criteria

- AC1: Bei Punktgrenze 1000 (Definitive-Fork, Standard-Force) ist kein Eintrag mit
  Primärkategorie „Lord" im Aushebe-Dialog wählbar bzw. er ist als gesperrt mit Grund markiert.
- AC2: Ein trotzdem im Roster liegender Lord bei 1000 Punkten erzeugt eine Meldung im Bericht.
- AC3: Bei 2000 Punkten ist genau ein Lord wählbar, bei 3000 Punkten zwei (Verhalten bleibt).
- AC4: Ein E2E-Szenario unter `docs/testing/` (vom `e2e-testcase-author`) pinnt AC1–AC3 aus
  den Katalogdaten. | verify: forge-test
- AC5: Falls das Wiki die Wirkung einer versteckten `categoryEntry` nicht regelt, ist die
  Entscheidung in §15 der Formatdoku bzw. einem ADR festgehalten.

## Out of scope

- Die Ergofang-Kodierung (`max -1` + increment), siehe Issue 0125.
- Helden-Grenzen.
