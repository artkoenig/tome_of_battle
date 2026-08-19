---
status: active
branch: claude/issue-done-on-pr
pr:
---

# Pure of Heart is mandatory, but a hero has to take it

## Goal

Issue 0153 stopped "Pure of Heart" from appearing on army level, but it went too
far: for High Elves the rule is not optional — at least one hero has to take it.
The army list must therefore still say the requirement is unmet while no hero
has taken it, and the choice itself must sit on the hero. Whether that
requirement is enforceable at all is decided by the catalog data: read the
`.cat`/`.gst` first and establish whether the "at least one" constraint is
expressed there. If it is, honour it. If it is not, the catalog is wrong, not
the app — then say so plainly and change no behaviour to fake it.

## Acceptance criteria

- AC1: It is established from the catalog data alone whether High Elves express the "Pure of Heart must be taken by at least one hero" requirement, and the finding is written into the issue file.
- AC2: Where the catalog expresses that requirement, a High Elves roster without it reports the requirement as unmet on army/force level. | verify: forge-test --run src/evaluator
- AC3: "Pure of Heart" stays selectable below the hero entry the catalog attaches it to, and taking it there clears the requirement. | verify: forge-test --run src/evaluator
- AC4: A scenario under `docs/testing/` pins AC2 and AC3 against the real High Elves catalog data through the manifest-driven E2E runner. | verify: forge-test --run src/evaluator
- AC5: Where the catalog does not express the requirement, no behaviour is invented to enforce it, and the issue file records it as a catalog data error instead.
- AC6: Every existing evaluator unit and E2E test stays green, and the scenario added by issue 0153 keeps passing or is corrected with its reason stated. | verify: forge-test --run src/evaluator

## Befund aus den Katalogdaten (AC1/AC5)

Der Katalog **drückt die Pflicht aus** — sie ist kein Datenfehler, AC5 greift
nicht. In `High Elves (6th definitive edition).cat` steht „Pure of Heart"
ausschließlich unter `<sharedSelectionEntries>`
(`selectionEntry d0ce-b0c4-fcc1-6cac`, Z. 5178) und trägt dort drei eigene
Grenzen:

| Constraint | Bedeutung |
| --- | --- |
| `4720-59d3-07c4-68b3` | `max 1`, `scope="roster"` — höchstens eine in der Armee |
| `69ac-892d-a730-545d` | `max 1`, `scope="parent"` — höchstens eine je Träger |
| `82ef-69c7-f459-5e20` | **`min 1`, `scope="roster"`**, `includeChildSelections="true"`, `includeChildForces="true"` — **mindestens eine in der Armee** |

Die dritte ist die gesuchte Pflicht: sie zählt roster-weit, also gleich, unter
welchem Helden die Ehrung steht. Erreichbar ist der Eintrag allein über den
`entryLink 30b5-bd1a-60e2-2354` in der geteilten Gruppe „Honours"
(`45a3-3e65-6c49-5cc0`), die Prince, Archmage, Commander und Mage einbinden —
Ort der Wahl und Reichweite der Pflicht fallen im Katalog also auseinander, und
genau so ist es gemeint. Der verlinkte Regeltext (`aef2-97fe-962d-9f7a`) sagt
es in Prosa: *„This Honour MUST be given to exactly one high Elf character."*

## Umsetzung

Die Engine wertete die Grenze bisher nur am **Angebots-Anker** unter dem Helden
aus (`isMandatoryUnmet: true` am Slot), meldete sie aber nie — ein Ergebnis am
Angebots-Anker ist nicht berichtsfähig (ADR-0035/0036). Ein Pflicht-Phantom
bekam sie ebenfalls nicht: geteilte Einträge stehen bewusst nicht in der
Wurzel-Definitionsliste (ADR-0032, Issue 0153).

Neu ist deshalb **Baumphase 2.5**
(`synthesizeOfferedSharedMandatoryPhantoms`, `evalTree.js`), die nach den
Angebots-Ankern läuft: ein geteilter Eintrag mit armee- bzw. kontingentweiter
`min`-Grenze bekommt sein Pflicht-Phantom genau dann, wenn dieser Roster ihn
**anbietet** — ein Anker des fertigen Baums sein aufgelöstes Ziel führt. Ein
geteilter Eintrag, auf den kein `entryLink` zeigt (Szenario
`roster-scope-mandatory-chariot`, RSMC-R7), und eine leere Armee bleiben damit
unberührt; der Katalog-Bezugsrahmen (Issue 0098) und die Absenz-Prüfung gelten
unverändert. `countInstances` zählt dafür einen Verweis für sein Ziel mit —
eine über den `entryLink` genommene Ehrung ist ein Vorkommen des geteilten
Eintrags.

Kein Test musste korrigiert werden (AC6): das Szenario aus Issue 0153 bleibt
grün und ist um die vorher offen gelassene Aussage **erweitert** — Roster 01
pinnt jetzt, dass `82ef-69c7-f459-5e20` genau einmal feuert, Roster 02, dass
sie schweigt.

## Out of scope

- Editing the Battlescribe catalog data (`.cat`/`.gst`) to repair a data error found under AC5.
- Special-casing "Pure of Heart", High Elves, or any entry by name or id in the code.
- Rules of other armies, unless the same cause covers them.
