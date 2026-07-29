---
status: active
branch: claude/new-session-jnwa1m-084
pr:
---

# Der Roster-Vertrag der Fassade ist ungeschrieben und ungeprüft

## Intent

Seit Issue 076 stellt der Evaluator eine Anforderung an jeden Aufrufer von
`evaluate`, die nirgends steht: Eine Auswahl, die über einen `<entryLink>`
gesetzt wurde, muss unter der **Link**-Id übergeben werden, nicht unter der Id
ihres Ziels. Nur dann gelten die am Verweis deklarierten Grenzen, und nur dann
fällt der Slot des Verweises mit dem belegten Slot zusammen, statt daneben als
Phantom stehenzubleiben.

Geschrieben steht diese Regel bisher **nur im Test-Adapter**
(`src/evaluator/__fixtures__/rosParser.js`, JSDoc zu `defIdOf`). Der öffentliche
Rand — `src/evaluator/evaluator.js`, `@param roster` — beschreibt die Eingabe
weiter als `Array<{ defId: string, count: number, children?: object[] }>` und
sagt zu Verweis oder Ziel nichts.

Zwei Befunde aus den Review-Runden von 076, beide reproduziert, beide ohne
Testabdeckung:

**F2 — die Wirkung des Adapters ist von keiner Erwartung gedeckt.** Nimmt man
nur die Constraint-Änderung und lässt den Adapter auf dem alten Stand, sind
alle Suiten grün und die Fassaden-Ausgabe über alle 108 Manifest-Läufe
byte-identisch. Was der Adapter zusätzlich bewirkt, ist die Slot-Zuordnung: In
12 von 108 Rostern fällt ein doppelter Slot zu einem zusammen, z. B.

```
ohne Adapter-Fix:  0/0/1  abdb-bbd0-41b2-5dff  occupied          "Hand Weapon"
                   0/0/3  b581-8a9e-9d0c-b7c8  mandatoryPhantom  "Hand Weapon"
mit  Adapter-Fix:  0/0/1  b581-8a9e-9d0c-b7c8  occupied  target=abdb-bbd0-41b2-5dff
```

Kein Manifest prüft das. Fiele der Adapter zurück, bliebe die Suite grün.

**F3 — kein Rückfall auf `entryId`.** `defIdOf` bindet an `entryLinkId` ohne
Ausweichpfad. Wertet man
`docs/testing/modifier-characteristic-value/rosters/01-ogre-no-light-armour.ros`
gegen einen Datensatz *ohne* den Mercenaries-Katalog aus, entsteht neu
`{"kind":"unresolvedDefinition","defId":"b581-8a9e-9d0c-b7c8"}` (37 → 38
Diagnosen); vorher band die Auswahl an die Ziel-Id in der `.gst` und wertete
durch.

Gewünschtes Ergebnis: Die Regel steht am öffentlichen Rand, und beide Befunde
sind durch je eine Erwartung gedeckt, die rot wird, wenn das Verhalten
zurückfällt.

Acceptance criteria:

1. Der `@param roster` der Fassade (`src/evaluator/evaluator.js`) sagt, unter
   welcher Id eine über einen `entryLink` gesetzte Auswahl zu übergeben ist,
   und was gilt, wenn kein Verweis im Spiel ist.
2. Eine Erwartung deckt die Slot-Zusammenlegung ab: für eine über einen
   Verweis gesetzte Auswahl entsteht **ein** belegter Slot unter der Link-Id
   mit dem Ziel unter `targetDefId` — kein zweiter Pflicht-Phantomslot
   daneben. Sie wird rot, wenn der Adapter auf `entryId` zurückfällt.
3. Das Verhalten bei nicht auflösbarer Link-Id ist entschieden und
   dokumentiert: entweder `unresolvedDefinition` als gewollte, ehrliche
   Antwort, oder ein Rückfall auf `entryId` in der Engine (nur dort — der
   Adapter kennt den Datensatz nicht). Die Entscheidung ist durch eine
   Erwartung gedeckt.
4. Die übrige Suite bleibt grün — mit Kommando, Umfang und Exit-Code belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Review-Runden 1–3 von Issue 076. Dort bewusst nicht behoben:
  beide Befunde verletzen kein Kriterium jenes Issues, und der Mensch hat
  entschieden, den Schnitt so zu lassen und diesen Teil eigenständig zu führen.
- **F3 ist entschärft, aber nicht erledigt.** Das BSData-Wiki sagt zum
  `entryLink`, sein Ziel müsse aus den *shared*-Listen desselben Katalogs
  stammen (oder per Grundregelwerk-Import aus der `.gst`); für ein Kontingent
  gilt *„All selections within must originate from a single catalogue."* Ein
  Roster, das einen Verweis aus einem nicht geladenen Katalog benennt, war
  also nie gültig — der scheinbar verlorene Fall war keiner. Damit ist
  `unresolvedDefinition` wahrscheinlich die *richtige* Antwort und Kriterium 3
  eher eine Dokumentations- als eine Verhaltensfrage. Belegstellen:
  `docs/battlescribe-data-format.md` §7.2 und §15.
- **Die Quelle hilft bei Kriterium 1 nicht.** Die Abschnitte *Roster*, *Force*
  und *Selection* des Wikis stehen als `TODO`; welche Id eine Auswahl
  identifiziert, ist nirgends dokumentiert (`docs/battlescribe-data-format.md`
  §15). Die Festlegung ist eine Entscheidung dieses Projekts und gehört als
  solche benannt.
- **Der `report.js`-Ankervertrag ist die Begründung der heutigen Wahl:** „ein
  Angebots-Anker den `entryLink`, nicht den Eintrag (nur so gelten die am
  Verweis deklarierten Grenzen)". Kriterium 2 hält genau das fest.
- **Entschieden (Default dieses Laufs, 2026-07-29):** Kriterium 3 —
  `unresolvedDefinition` OHNE Rückfall auf die Ziel-Id ist die gewollte
  Antwort. Quelle: §7.2 (Link-Ziel aus demselben Katalog bzw.
  `.gst`-Import; Kontingent-Auswahlen aus einem einzigen Katalog — ein
  solches Roster war nie gültig) und §15; dokumentiert am Fassaden-Rand,
  gepinnt durch zwei F3-Tests. Ein stiller Rückfall würde den
  Datensatz-Fehler tarnen.
- **Symptom-Präzisierung (Review-Runde 1):** der Rückfall auf die Ziel-Id
  äußert sich im flachen Fall als STILLES Verschwinden der Link-Grenzen
  (grüne Auswertung ohne Regel-Durchsetzung); das „Phantom daneben" aus
  076/F2 entsteht nur in verschachtelten Konstellationen (beide vom
  Reviewer reproduziert). Das JSDoc nennt jetzt beide Symptome.

## Log

- **2026-07-28, Beobachtung aus dem Engine-Audit** (Prüfung der Engine gegen
  die BSData-Doku im Repo): zwei konkrete Vertragslücken am Roster-Eingang,
  beide am Fixture-Parser (`src/evaluator/__fixtures__/rosParser.js`) belegt:
  - Reale BattleScribe-`.ros` tragen in `entryId` mit `::` verkettete
    Id-Pfade (z. B. `src/utils/__fixtures__/blood-dragons.ros`,
    `entryId="05bd-…::1b7c-…"`, 7 Vorkommen); `rosterFromRos` reicht sie
    verbatim durch → `unresolvedDefinition`.
  - Verschachtelte `<forces>` innerhalb einer Force werden durch das tiefe
    `getElementsByTagName('force')` still zu Top-Level-Forces geflacht —
    die `includeChildForces`-Schachtelung, die die Zählschicht selbst
    unterstützt, geht am Eingang verloren.
  Dazu passend: Issue 0096 (Kostenlimit `-1.0` wird ungefiltert
  durchgereicht) hängt an derselben ungeschriebenen Vertragsfrage.
- 2026-07-29 test-author: `src/evaluator/evaluator.rosterContract.test.js`,
  6 GREEN pins (by design — the issue pins 076-built behaviour; red =
  regression), each with a proven red variant in a temporary file (adapter
  fallback input → slot identity and link-limit assertions fail; resolvable
  id → F3 diagnostic assertion fails). Surprise recorded: in the
  regression variant (root-level link, min=1 force scope, selection under
  target id) NO mandatory phantom appeared beside — the 076/F2 "phantom
  beside it" symptom needs a nested constellation; pins go red via slot
  identity and the link-limit violation instead. Criterion 1 (JSDoc) has
  nothing to run — falls to the review.
- 2026-07-29 implementer: contract written at `evaluator.js` `@param roster`
  (identity rule, project-decision provenance, no-fallback behaviour with
  §7.2/§15 rationale); pointers in `evaluator-architecture.md`
  (InstanceNode record) and `rosParser.js` `defIdOf` (slimmed, delegates).
  Comment/doc-only diff; 6/6 pins green, suite 211 files / 2149 tests
  exit 0, lint/typecheck 0.
- 2026-07-29 review round 1 (fresh context): criteria met; pins verified as
  real guards (red variants reproduced independently); citations verified
  verbatim. 2 minor findings, both fixed: (1) the JSDoc's "Phantom daneben"
  rationale overstated the flat-case symptom — reviewer reproduced both
  constellations (flat: silent loss of link limits; nested: phantom
  beside); JSDoc now names both. (2) the F3 default still hedged in
  Decisions — now settled there, dated and sourced.
- 2026-07-29 review round 2 (fresh context): criteria met; two-symptom
  claim reproduced TRUE; pins re-verified; citations re-verified. 2 minor
  findings, fixed: (1) duplicated verb from the round-1 edit
  ("haelt … festhaelt") — corrected; (2) this Log was missing the round-1
  entry — this and the neighbouring entries close it.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — write the link-id rule at the public
  edge, pin the two uncovered behaviours (slot merge, unresolvable link id)
  with expectations that go red on regression.
- What surprised me? The Decisions already carry most of the thinking: F3 is
  defused (a roster naming a link from an unloaded catalog was never valid,
  §7.2/§15), so criterion 3 leans strongly toward documenting
  `unresolvedDefinition` as the honest answer — no engine fallback.
  Recorded as the default for this run.
- What am I assuming without having verified it? That the criterion-2
  expectation can be expressed against the facade report (occupied slot
  under link id + targetDefId, absence of the phantom) without new engine
  work — issue 076 built the behaviour, only the pin is missing. And that
  the two Log observations (:: id paths, nested forces flattening) remain
  OUT of scope — they are adapter/contract questions for the human, this
  run only documents and pins the existing contract.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
