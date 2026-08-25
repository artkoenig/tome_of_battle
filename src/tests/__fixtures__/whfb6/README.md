# E2E-Fixture: WHFB6 (eingefroren)

Katalogdaten für die Puppeteer-Werkzeuge — den E2E-Smoke-Test `e2e/ui.test.js` und
`scripts/generate_screenshots.js`, die sie über das gemeinsame Harness
`scripts/lib/e2e-harness.js` beziehen (siehe ADR-0006, Seam 6 im
[PRD](../../../../docs/PRD-katalog-updates-und-roster-kompatibilitaet.md)). Geprüft wird die
App, nicht die Katalogdaten — die Fixture ist bewusst eingefroren und unabhängig von den zur
Laufzeit bezogenen Katalogen.

## Herkunft

- Quelle: `Warhammer Fantasy Battle 6th edition.gst` und `Ogre Kingdoms.cat` aus dem damaligen
  Verzeichnis `public/catalogs/whfb6/`, das mit ADR-0014 entfallen ist
- Stand: Commit `d13b7e5` (2026-07-02), **vor** der Whitespace-Bereinigung aus Issue 11
  (Commit `db7848d`, 2026-07-15)
- `Dogs of War.cat` was copied verbatim from `artkoenig/Warhammer-Fantasy-6th-edition` at commit
  `9c7203c94221a4a98d5c1ffcfcfaedafe7d6d233`, the current upstream head (issue 0148). Not
  reformatted, re-indented or normalised in any way.

## Two vintages on purpose

This directory now deliberately carries **two vintages** of the same upstream repository:

- `Dogs of War.cat` sits at upstream head (`9c7203c9`).
- The other four files (`Warhammer Fantasy Battle 6th edition.gst`, `Ogre Kingdoms.cat`,
  `Orcs and Goblins.cat`, `Vampire Counts.cat`) come from commit `d13b7e5` and predate the
  whitespace cleanup of issue 11 (commit `db7848d`), so they still carry the leading and
  trailing whitespace the E2E is meant to run through (siehe „Warum die unbereinigte Fassung“ weiter unten).

Mixing the two is intentional, not drift: the older files exist for the normalisation path, the
newer one for its rule constructs. Neither vintage may be "harmonised" with the other.

## Warum Dogs of War

Added for issue 0148 (evaluator coverage campaign). This book carries rule constructs no other
book of either fixture corpus carries: it holds the only `childId="upgrade"` repeats in the
whole corpus (3 occurrences), i.e. the cell

```
repeat|selectionCount|parent|child=upgrade|repeats=1|s=true|ics=false|icf=false|roundUp=false|pct=false
```

which the coverage campaign cannot reach at all without this file. Removing the book would make
that cell unreachable again.

## Warum die unbereinigte Fassung

Die Fixture trägt bewusst die Upstream-Form inklusive Whitespace, damit der E2E-Test die
Normalisierung aus Issue 02 durchläuft, statt sie mit vorbereinigten Daten zu umgehen:

- `Warhammer Fantasy Battle 6th edition.gst`: `costType`-Namen `" Casting Dice"` und
  `" Dispel Dice"` mit führendem Leerzeichen
- `Ogre Kingdoms.cat`: Regelnamen wie `"Sword Gnoblars "` und `"Immune to Psycology "` mit
  nachgestelltem Leerzeichen

## Warum Ogre Kingdoms

Kleinste der drei WHFB6-Kataloge, die bereits an anderer Stelle im Testkorpus verwendet werden
(`src/contexts/armylist/model/rosterSerialization.integration.test.js`), trägt beide Whitespace-Fälle und deckt
sowohl eine primäre `Heroes`- als auch eine nicht-primäre `Characters`-Kategorie ab — beides
prüft `ui.test.js` explizit.

## Update-Politik

Diese Fixture wird **nicht** automatisch mit dem externen Katalog-Fork
synchronisiert. Sie ändert sich nur, wenn eine App-seitige Funktionsänderung
(z. B. neue Struktur, neue getestete Regel) das erfordert.

The addition of `Dogs of War.cat` is exactly such a functional reason: the evaluator coverage
campaign needs a rule construct no file already here provides.
