---
status: backlog
branch:
pr:
---

# Selbst-gegatetes `instanceOf` erkennt ein leeres Kontingent nicht

## Intent

`docs/battlescribe-data-format.md` §7.7 beschreibt zwei gleichbedeutende
Kodierungen der Prüfung „ist das Kontingent eine Instanz dieses Detachments":
kanonisch (`scope="force" childId="<forceId>"`) und selbst-gegatet
(`scope="<forceId>"`, `childId` leer). Die Auswertung soll eine
forceEntry-Instanz-Prüfung daran erkennen, dass `scope` **oder** `childId` auf
eine reale `forceEntry`-Id auflöst.

Diese Erkennung existiert nicht: eine forceEntry-Id in `scope` läuft durch
`nearestAncestorWithDefId` (`src/evaluator/query.js:74`) und zählt dann mit
Ziel `null` „alles im Rahmen" — Kontingent-Knoten tragen zum `null`-Ziel aber
nichts bei (`src/evaluator/countIndex.js`). Die selbst-gegatete Form
degeneriert so zur Selektionszählung: ein **gewähltes, aber leeres**
Sonderheer gilt als „nicht Instanz seiner selbst".

Repro (Audit 2026-07-28, gegen die echte Fassade): Vampire-Counts-Idiom
„eigenes Punktelimit" (§5.6) — `min` über `limit::pts`, per Modifier mit
`instanceOf scope="<eigene forceId>"` angehoben. Force gewählt mit einer
Einheit → Verstoß feuert (korrekt); Force gewählt, aber leer → kein Verstoß
(Regel still nicht durchgesetzt). Ein `notInstanceOf` in dieser Kodierung
feuert auf einem leeren Kontingent entsprechend fälschlich. Die kanonische
Form funktioniert auch leer (Kontroll-Repro).

Acceptance criteria:

1. Eine `instanceOf`-Condition mit `scope="<forceId>"` (ohne `childId`) hält
   für jeden Knoten innerhalb eines Kontingents dieser Definition — auch wenn
   das Kontingent leer ist.
2. `notInstanceOf` in derselben Kodierung hält auf einem leeren Kontingent
   dieser Definition **nicht**.
3. Beide Kodierungen aus §7.7 liefern in denselben Szenarien dasselbe
   Ergebnis.
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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
