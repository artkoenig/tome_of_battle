---
status: active
branch: claude/independent-implementation-auto-merge-m1o0m8-083
pr:
---

# Zwei Grenzen am Doppelverweis feuern nicht

## Intent

Zwei Grenzen aus `Vampire Counts (6th definitive edition).cat` feuern nicht,
obwohl das Roster den begrenzten Gegenstand zweimal enthält. Die Ursache ist
offen; dieses Issue soll sie klären.

Zwei belegte Fälle, beide aus `Vampire Counts (6th definitive edition).cat`,
beide beim Bau des Szenarios `shared-target-two-entrylinks` aufgefallen:

| Grenze | Deklariert an | Erwartet | Beobachtet |
|---|---|---|---|
| `0aa08f91-b271-402b-98aa-32c51f3beae7` (max 1, `scope="roster"`) | Zieleintrag `d612998a-…`, Z. 20051 | Ist 2 / Grenze 1 | feuert nicht |
| `76e2c1c8-8320-4bc2-a370-cc3e95c7fd2c` (max 1, `scope="parent"`) | Gruppe „Magic Armour" `847028b2-…`, Z. 23462 | Ist 2 / Grenze 1 | feuert nicht |

Reproduzierbar mit den Rostern 03 und 04 aus
`docs/testing/shared-target-two-entrylinks/`: das Roster nimmt denselben
Gegenstand zweimal, beide Grenzen schweigen. Die Ids sind dort aus der
Erwartung genommen und bewusst **nicht** nach `absent` verschoben — das
Manifest macht über sie derzeit keine Aussage.

**Eine naheliegende Erklärung ist bereits widerlegt.** Beide Grenzen tragen
`includeChildSelections="false"` und `includeChildForces="false"`, und die
Zählschicht summiert bei dieser Kombination nur den Basis-Eimer ihres
Bezugsrahmens (`src/evaluator/countIndex.js`), an dem keine Auswahl liegt. Das
kann es aber nicht allein sein: `f25f23c2-f5f1-4bd0-8c7a-0ce617302c7e` (Z. 20050)
trägt **dieselben zwei Flags** und feuert in Roster 03 mit Ist 2 gegen Grenze 1.

Was die Fälle unterscheidet, ist ihr Bezugspunkt:

| Grenze | Anker | Rahmen | feuert |
|---|---|---|---|
| `f25f23c2` | Zieleintrag `d612998a` | `parent` | ja |
| `0aa08f91` | derselbe Zieleintrag | `roster` | nein |
| `76e2c1c8` | Gruppe `847028b2` (zählt ihre Mitglieder) | `parent` | nein |

**Die Fremddokumentation ist inzwischen eingeholt** und engt die Frage stark
ein. Das [BSData-Wiki, *Data structure
overview*](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview)
beschreibt das `shared`-Attribut einer Grenze so: ist es gesetzt, *„the
constrained value is a sum of all selections of this shared entry in roster in
total"*; ist es nicht gesetzt, *„the sum is calculated for a given entry link
instance"*.

Alle drei Grenzen tragen `shared="true"`. Für `0aa08f91` (`scope="roster"`,
`max 1`) heißt das wörtlich: gezählt werden **alle** Vorkommen des Eintrags im
Roster. Roster 03 und 04 enthalten zwei — die Grenze muss feuern. Damit ist ihr
Schweigen mit hoher Wahrscheinlichkeit ein echter Engine-Fehler und keine
Fehldeutung des Autors.

Die Flags heißen im Wiki *„And all child selections?"* und *„And all child
forces?"*; unangekreuzt zählt die Grenze *„just `scope`'s `field`"* bzw.
*„only from parent force selections"* — von „gar nichts" ist keine Rede. Auch
das spricht gegen die verworfene Flag-Erklärung.

Auch die zweite Hälfte ist inzwischen belegt. Die Quelle beschreibt den
Bezugsrahmen einer Grenze so: der `scope` entscheide, *„which entity should sum
up all `field`'s values **of descendant selections of this constraint's parent
entry**"*. Gezählt werden also die Auswahlen **unterhalb** des Trägers der
Grenze. Für `76e2c1c8`, die an der Gruppe „Magic Armour" hängt, heißt das: ihre
Mitglieder. Zwei gewählte Mitglieder ergeben Ist 2 — die Grenze muss feuern.
Unsere Engine zählt stattdessen die eigene Id des Gruppenknotens und kommt auf
1.

Damit sind **beide** Fälle belegte Fehler, nicht offene Fachfragen. Die
Belegstellen stehen in
[`docs/battlescribe-data-format.md`](../battlescribe-data-format.md) §7.6; die
Quelle selbst liegt als Submodul unter
`docs/bsdata-catalogue-development-wiki/Data-structure-overview.md`.

Acceptance criteria:

1. Die Engine zählt für eine Grenze die Auswahlen **unterhalb ihres Trägers**,
   im Rahmen des `scope` — nicht die eigene Id des Trägers.
2. Eine Grenze, die nach dieser Deutung feuern muss, feuert.
3. Die beiden belegten Fälle feuern: `0aa08f91` und `76e2c1c8` jeweils mit
   Ist 2 gegen Grenze 1.
4. Das Szenario `shared-target-two-entrylinks` nimmt beide Ids wieder in seine
   Erwartung auf — auf der Seite, die die Untersuchung ergibt.
5. Die übrige E2E-Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt —, und jede geänderte Erwartung ist einzeln begründet.

## Plan

## Tasks

## Decisions

- **Herkunft:** Aufgefallen beim Bau des Szenarios
  `shared-target-two-entrylinks` in Issue 076. Der Black-Box-Autor leitete
  beide Grenzen aus den Katalogdaten als feuernd ab; die Engine schweigt.
- **Erste Ursachenvermutung verworfen.** Dieses Issue nannte zunächst die
  beiden `include`-Flags als Ursache. Review-Runde 3 von Issue 076 hat das
  am selben Szenario widerlegt (`f25f23c2` trägt dieselben Flags und feuert).
  Titel und Intent sind entsprechend korrigiert.
- **Vorbestehend, nicht durch 076 entstanden:** Auf einem Worktree des
  Standes vor dem Fix verhalten sich beide Grenzen identisch.
- **Die Fachfrage ist beantwortet, bevor der Lauf beginnt.** Die
  BSData-Dokumentation belegt beide Fälle als Fehler (siehe Intent). Dieses
  Issue ist damit eine Implementierungsaufgabe, keine Untersuchung.
- **Testumfang je Lauf: die Evaluator-Tests einschließlich der
  Evaluator-E2E-Tests** — beides deckt `npx vitest run src/evaluator` ab
  (Unit-Tests plus manifest-getriebener E2E-Runner über `docs/testing/`).
  Nicht mehr je Lauf: die übrige App-Suite und das Puppeteer-Solver-E2E aus
  `npm test`. Quelle: Anweisung des Maintainers mid-run (2026-07-29); gilt
  für diesen und die folgenden Läufe dieser Session. Der Implementer-Lauf
  dieses Issues hatte die volle Suite bereits grün (`npm test` Exit 0),
  bevor die Anweisung kam.

## Log

- **2026-07-28, Ursachenanalyse aus dem Engine-Audit** (Intensiv-Prüfung der
  Reinraum-Engine gegen die BSData-Doku, mit ausgeführten Repros gegen die
  echte Fassade). Die beiden Fälle haben **zwei verschiedene Ursachen**:
  - **`76e2c1c8` (Gruppe „Magic Armour", `scope="parent"`):** Die Gruppe
    erreicht ihre Träger über einen `entryLink type="selectionEntryGroup"`.
    `groupDefinitionsWithLimits` (`src/evaluator/evalTree.js:369`) steigt beim
    Einsammeln aber nur in Kinder mit `kind === GROUP` ab und überspringt
    einen Link, dessen aufgelöstes Ziel eine Gruppe ist. Folge: für verlinkte
    Gruppen entsteht **kein Gruppen-Anker und keine Member-Annotation** —
    `max` feuert nie, und ein `min` einer verlinkten Pflichtgruppe feuert
    stets mit „Ist 0", auch wenn ein Member gewählt ist (beide Richtungen im
    Audit per Minimal-Katalog reproduziert; Inline-Gruppe als Kontrolle
    feuert korrekt).
  - **`0aa08f91` (Zieleintrag, `scope="roster"`):** Die im Intent verworfene
    Flag-Erklärung war nur in ihrer pauschalen Form falsch. Die Eimer-Zuteilung
    ist **relativ zum Rahmen** (`indexNodeContribution`,
    `src/evaluator/countIndex.js:149`): liegt zwischen Beitragendem und Rahmen
    ein Selektionsknoten, landet der Beitrag im SELECTION-Eimer, den
    `includeChildSelections="false"` ausschließt. Die unter Charakteren
    geschachtelten Gegenstände sind für den `parent`-Rahmen direkte Kinder
    (BASE-Eimer → `f25f23c2` feuert), für den `roster`-Rahmen aber
    geschachtelt (SELECTION-Eimer → `0aa08f91` liest 0). Das erklärt genau
    die Beobachtungstabelle im Intent. Laut der im Intent zitierten
    Wiki-Semantik („shared=true: Summe **aller** Vorkommen im Roster";
    unangekreuzt zählt „just `scope`'s `field`", nicht „nichts") zählt die
    Referenz solche Vorkommen dennoch — die wörtliche Eimer-Lesart der Engine
    weicht hier vom Referenzverhalten ab.

- **2026-07-29, test-author (blind from the intent):** failing tests written
  and proven. `src/evaluator/constraints.carrierDescendants.test.js` (4 fail /
  3 guard-pass: linked-group max stays silent, linked-group min fires
  spuriously with "Ist 0" — direct proof the engine counts the carrier's own
  id —, roster-max misses nested occurrences twice); scenario manifest
  `shared-target-two-entrylinks` re-expects `0aa08f91` and `76e2c1c8` as
  firing (rosters 03/04 fail, 01/02 pin the legal boundary as absent).
  Full E2E runner: 124/126 pass, only the two updated cases fail.

- **2026-07-29, implementer:** all handed tests pass; two narrow fixes.
  (1) Linked groups get a group anchor: `groupDefinitionsWithLimits` descends
  through `entryLink type="selectionEntryGroup"`, the link is the anchor,
  members annotated under the queried id; cycle/dedupe guards. (2) New
  `countingFlagsOf` in `constraints.js`: a shared, entry-anchored
  `scope="roster"` constraint counts nested occurrences regardless of
  `includeChildSelections="false"` — only that combination, everything else
  keeps the written flags. (3) `buildGroupMemberIndex` indexes all groups
  (a linked group's limit can sit solely on the link). Facts: `npm test`
  227 files / 2329 tests + puppeteer E2E exit 0; lint/typecheck/analyze
  exit 0; `measure-evaluator` 6.2 ms against the 100 ms budget.
  Out-of-scope note for later: whether `offer.js` offers members of a
  *linked* group as selectable options was not touched.

- **2026-07-29, review round 1** (fresh context; `npx vitest run src/evaluator`
  53 files / 711 tests exit 0, lint exit 0, typecheck exit 0; handed tests
  untouched by the implementer, verified by diff). 3 findings, triage:
  1. **F1 (criterion 2, fix now):** the `visited`-dedupe in
     `groupDefinitionsWithLimits` keys on the target group id and skips the
     whole second link to an already-seen group — a constraint declared only
     on that second link is silently dropped; outcome depends on sibling
     document order. Reproduced with a minimal catalog (min on second of two
     links to the same group → silent; on the first → fires). Real catalogs
     carry the dual-link shape (VC: 20 owners), so the gap is real even
     though the frozen fixtures never put a constraint on the duplicate link.
  2. **F2 (no criterion, fix now):** `resolveBound`'s comment "Nenner und
     Zaehler teilen Scope und Flags" is stale since `countingFlagsOf` —
     numerator gets forced flags, percent denominator keeps written ones.
  3. **F3 (no criterion, dismissed with reason):** the implementer's
     out-of-scope note on `offer.js` is moot — the reviewer read
     `offer.js:124-128`: `optionDefinitionsUnder` already descends through
     links whose resolved target is a group. Nothing to file.
  - **Beyond the criteria (filed, not fixed):** the `countingFlagsOf`
    override is deliberately roster-only; the same shape with
    `scope="force"` stays silent (reproduced). Whether the reference counts
    those is undecided by the cited wiki sentence — off-intent, filed as
    issue 0110 instead of fixed by default.
  - Finding trend: K2 1, outside criteria 2 — total 3.

- **2026-07-29, F1/F2 fix (implementer):** `groupDefinitionsWithLimits`
  yields a sibling link to an already-visited group with `ownLimitsOnly`
  when it carries own constraints; its anchor evaluates only those —
  link-own limits fire per link, shared target limits keep one anchor per
  owner. `resolveBound` comment corrected. Facts: carrierDescendants file
  11 tests exit 0; `npx vitest run src/evaluator` 53 files / 715 tests
  exit 0; lint exit 0; typecheck exit 0; measure-evaluator 11.2 ms.
  Out-of-scope note: a group reachable both directly nested and via a
  sibling link would anchor its target limits twice — pre-existing, not in
  the fixtures, untouched.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — the maintainer asked for autonomous
  implementation of the backlog; this issue is fully specified (criteria
  falsifiable, root causes recorded in the Log), so it is a pure
  implementation task.
- What surprised me? The two silent limits have two *different* root causes:
  a link-to-group never gets a group anchor (`groupDefinitionsWithLimits`
  only descends into `kind === GROUP` children), and the bucket assignment in
  `indexNodeContribution` is frame-relative, so `roster`-scope reads nested
  contributions from a bucket that `includeChildSelections="false"` excludes.
- What am I assuming without having verified it? That the audit's root-cause
  analysis in the Log is accurate — the failing tests and the implementation
  will verify it against the real facade. And the decided reading of the wiki
  semantics: a constraint counts the selections below its carrier, within its
  scope.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
