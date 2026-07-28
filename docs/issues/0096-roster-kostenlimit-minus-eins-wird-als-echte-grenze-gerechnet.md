---
status: active
branch: claude/new-session-jnwa1m-0096
pr:
---

# Roster-Kostenlimit −1 wird als echte Grenze gerechnet

## Intent

BattleScribe schreibt in `.ros`-Dateien `costLimit value="-1.0"` für „kein
Limit" (dieselbe Konvention wie `defaultCostLimit`, dokumentiert in
`docs/battlescribe-data-format.md` §5.3). Der Katalog-Leser mappt
`defaultCostLimit=-1` korrekt auf `null` (`src/evaluator/catalogReader.js:809`,
ausdrücklich „damit kein Leser den Sentinel als Zahl weiterrechnet").

Der Roster-Pfad tut das nicht: `rosterBudget.js:39` übernimmt −1 als Zahl,
die Budget-Regel (`budget.js:97`, `actual > value`) meldet dann für **jede**
nicht-leere Armee „zu teuer", und `limit::<costTypeId>`-Queries
(`query.js:142`) vergleichen Bedingungen gegen −1 (punkteskalierende
Modifier wie `lessThan limit::pts 3000` feuern, als wäre das Limit −1). Der
E2E-Fixture-Parser (`__fixtures__/rosParser.js`) reicht −1 ungefiltert durch.

Acceptance criteria:

1. Ein eingestelltes Kostenlimit von −1 gilt als „kein Limit": die
   roster-weite Budget-Regel erzeugt dafür keine Verletzung.
2. `limit::<costTypeId>` behandelt eine so eingestellte Kostenart wie eine
   unbudgetierte (bestehender fail-closed Pfad mit Diagnose bzw. Sentinel) —
   nie als Vergleichswert −1.
3. Ein `.ros` mit `costLimit value="-1.0"` läuft ohne Budget-Fehlmeldungen
   durch die Auswertung (Testfall).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Codepfade verifiziert. Ob der Produktiv-Adapter −1
  durchreicht, hängt am (ungeschriebenen) Roster-Vertrag — siehe Issue 084.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — mirror the reader's existing
  `-1 → null` sentinel mapping (`catalogReader.js:809`) onto the roster path
  so the budget rule and `limit::` queries see "no limit" instead of −1.
- What surprised me? Nothing yet; the catalog side already solved the same
  problem, so the target semantics ("unbudgeted cost type", fail-closed
  `limit::` path) exist and are tested.
- What am I assuming without having verified it? That mapping −1 (and any
  negative value) to null at the roster boundary (`rosterBudget.js`) is the
  single right seam — and that no existing fixture `.ros` relies on a
  negative limit being enforced. The test-author and implementer must check
  `budget.js`, `query.js` and `rosParser.js` call paths for a second seam.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
