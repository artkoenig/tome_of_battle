# E2E-Fixture: WHFB6 „Definitive Edition" (echte Katalogdaten)

Echte, vollständige BattleScribe-Katalogdaten der **Definitive Edition** für die
End-to-End-Tests der Reinraum-Engine (`src/evaluator/`). Anders als die
synthetischen Mini-Kataloge werten diese Dateien die Engine an genau den Daten
aus, die ein Nutzer beim Import erlebt — inklusive katalogübergreifender
`entryLink`/`infoLink`- und **`catalogueLink`**-Auflösung.

## Herkunft

- Quelle: `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition`, Branch
  `main`, Commit `4a558216aabea1719d15c8f45bf52b6ee0cd5e3e`. The seven books
  added for the coverage campaign (The Empire, Bretonnia, Dark Elves, Dwarfs
  (2005), Skaven, Lizardmen, Forces of Chaos) come from that same pinned
  commit and are copied verbatim — not reformatted, not re-indented, not
  normalised.
  Upstream: `lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition`
  (Karak Norn Wargaming Club) — dieselbe Quelle, die die App zur Laufzeit über
  `CATALOG_REPO_RAW_BASE_URL` (`src/db/catalogUpdate.js`) bezieht.
- Spielsystem-Id der `.gst`: `0d13-7737-ea86-4662` (Revision 1).

## Warum diese Teilmenge (nicht alle 18 Kataloge)

Der volle DE-Satz ist 18 `.cat` + 1 `.gst` (~14 MB). Hier liegen **12** der 18
`.cat` plus die `.gst` — aus drei verschiedenen Gründen.

**Fünf Dateien sind der minimale echte Multi-`.cat`-Fall.** Die
Abhängigkeits­struktur ist ein **Stern**: **jeder** der 17 Armee-Kataloge
deklariert genau **einen** `catalogueLink` auf die gemeinsame
**`Mercenaries`**-`.cat`; Mercenaries selbst hängt von keinem anderen Katalog
ab. Dafür genügt:

- `Warhammer Fantasy Battles (6th definitive edition).gst` — das Spielsystem,
- `Mercenaries (6th definitive edition).cat` — die gemeinsame Abhängigkeit,
- `Ogre Kingdoms (6th definitive edition).cat`,
- `Orcs and goblins (6th definitive edition).cat`,
- `Vampire Counts (6th definitive edition).cat`.

Belegt an den echten Daten: die Ogre-`.cat` hat 244 eindeutige `targetId`s,
**41** davon lösen **ausschließlich** über die Mercenaries-`.cat` auf (ohne sie
41 dangling, mit ihr 0). Der `catalogueLink` ist also eine echte, zwingende
Abhängigkeit — kein toter Verweis.

**Sieben weitere Dateien liegen aus Abdeckungsgründen hier** (siehe den
nächsten Abschnitt). Die sechs noch fehlenden Bücher bringen **keine weitere
Zelle** und bleiben deshalb draußen — jedes Byte Korpus wird bei jedem
Inventar- und Drift-Lauf bezahlt.

**Ein Buch liegt wegen eines einzelnen Szenarios hier: `High Elves (6th
definitive edition).cat`** (`b59c-7ff5-fb34-405e`), hinzugefügt für Issue 0153
aus demselben oben genannten Commit, unverändert kopiert. Es trägt den im
ganzen Korpus einzigen **geteilten** Eintrag mit eigenem `min`-Constraint
`scope="roster"` ≥ 1 und ohne eigene Unterauswahlen — „Pure of Heart"
(`d0ce-b0c4-fcc1-6cac`), erreichbar allein über den `entryLink`
`30b5-bd1a-60e2-2354` in der geteilten Gruppe „Honours" unter
Prince/Archmage/Commander/Mage. Ohne dieses Buch ist der Fall „geteilter
Eintrag ist kein Wurzel-Angebot" an echten Daten nicht zu pinnen; das Szenario
dazu liegt unter
[`docs/testing/shared-entry-roster-min-hero-option/`](../../../../docs/testing/shared-entry-roster-min-hero-option/README.md).
Ein Abdeckungsargument steht dahinter nicht — die Zellen des Buchs bleiben in
der Inventur, was sie waren.

## Why these seven books

The Empire, Bretonnia, Dark Elves, Dwarfs (2005), Skaven, Lizardmen and Forces
of Chaos are in the corpus because each one carries at least one rule construct
no other file of either corpus carries. Together they raise the coverage
inventory from 106 to 130 cells — 24 new cells, all of them uncovered by
design; closing them is the coverage campaign's work, not this fixture's.

Measured, per book, the cell that is found in that file alone:

- **The Empire** —
  `repeat|selectionCount|unit|child=id|repeats=1|s=true|ics=true|icf=false|roundUp=false|pct=false`,
  51 occurrences. It is the sole owner of four further cells:
  `condition|atLeast|id|selectionCount|child=id` (11x),
  `condition|equalTo|unit|selectionCount|child=id` (13x),
  `condition|lessThan|id|selectionCount|child=id` (4x),
  `condition|notEqualTo|parent|selectionCount|child=id` (1x).
- **Bretonnia** — `condition|notEqualTo|roster|limitValue|child=any`, 1
  occurrence.
- **Dark Elves** —
  `constraint|min|selectionCount|parent|s=true|ics=true|icf=false|pct=false`, 1
  occurrence, and `condition|atLeast|self|selectionCount|child=any`, 1
  occurrence.
- **Dwarfs (2005)** — `modifier|multiply|costValue`, 3 occurrences, and
  `condition|atLeast|parent|selectionCount|child=model`, 1 occurrence.
- **Skaven** —
  `repeat|selectionCount|id|child=id|repeats=1|s=true|ics=false|icf=false|roundUp=false|pct=false`,
  6 occurrences, and `condition|notEqualTo|roster|selectionCount|child=id`, 1
  occurrence.
- **Lizardmen** — `condition|greaterThan|self|selectionCount|child=id`, 7
  occurrences.
- **Forces of Chaos** —
  `repeat|selectionCount|force|child=id|repeats=1|s=true|ics=true|icf=true|roundUp=false|pct=false`,
  9 occurrences.

Removing any one of the seven makes its cells unreachable again — the same
argument the sibling fixture's README makes for Dogs of War.

## Update-Politik

Diese Fixture wird **nicht** automatisch mit dem Upstream synchronisiert. Sie
ändert sich nur, wenn eine Engine-Funktionsänderung (neue geprüfte Regel, neuer
Datenfall) das erfordert. Beim Aktualisieren die Herkunfts-Commit-Id oben
mitziehen.
