---
status: backlog
branch:
pr:
---

# Der Katalogbezug im Editor gilt roster-weit statt je Kontingent

## Intent

Das App-Modell führt den Katalog **je Kontingent**: `force.catalogueId`
wird beim `.ros`-Import aus der Datei übernommen
(`src/utils/rosterSerialization.js`), und `useRoster.catalogueIdOfForce`
liest ihn. `roster.catalogueId` ist nur der des **ersten** Kontingents.

Der Editor benutzt trotzdem durchgehend einen einzigen, roster-weiten
Wert: `RosterEditor` leitet `activeCatalogue` einmal aus
`roster.catalogueId` ab und gibt dasselbe Objekt an jedes
`ForceEditorSection` weiter. Eine importierte Liste mit verbündetem
Kontingent — in BattleScribe ein alltäglicher Fall — wird dadurch im
Verbündeten gegen das falsche Armeebuch aufgelöst.

Betroffen sind mindestens:

- `CategoryUnitAdder.entryFor` — `findEntryInSystem(system, defId,
  activeCatalogue.id)` sucht im falschen Katalog vor; der
  Katalogübergreifende Rückfall rettet es meist, aber nicht bei
  gleichlautenden Ids.
- `OptionGroup` — `resolveEntry(system, option, activeCatalogue?.id)`
  an zwei Stellen.
- `ListRuleChecklist`.

Der Herkunftsfilter des Aushebe-Dialogs hatte denselben Fehler und ist
in Issue 0121 (Task 19) behoben worden, weil er dort neu entstanden ist
und ein Kriterium verletzte. Die übrigen Stellen sind **vorbestehend**
— sie verhalten sich wie vor dem Cutover — und gehören deshalb hierher.

Bei einer Liste mit einem Kontingent, dem Normalfall und dem der
Fixture, zeigt sich nichts davon.

Seit der Korrektur in Issue 0121 (Task 19) steht dort eine **schiefe
Kante**, die vorher nicht sichtbar war: im verbündeten Kontingent
entscheidet der Katalog des **Kontingents**, *wer* angeboten wird, aber
der Katalog des **Rosters**, gegen welchen Katalog der ausgehobene
Eintrag aufgelöst wird (`CategoryUnitAdder.entryFor`). Praktisch trägt
das, weil `findEntryInSystem` katalogübergreifend zurückfällt — aber es
ist zwei Regeln für dieselbe Frage, und die zweite gehört mit hierher.

Acceptance criteria:

1. Jede Stelle im Editor, die einen Katalogbezug braucht, benutzt den
   des **Kontingents**, in dem sie steht — nicht den des Rosters.
   Belegt an einer importierten Liste mit zwei Kontingenten aus
   verschiedenen Armeebüchern.
2. Führt ein Kontingent keinen eigenen Katalog, gilt weiterhin der des
   Rosters (Altverhalten für selbst angelegte Listen).
3. Bei einer Liste mit einem Kontingent ändert sich nichts Sichtbares.

## Plan

## Tasks

## Decisions

- **Nicht in Issue 0121 behoben.** Nur der in 0121 neu entstandene
  Herkunftsfilter wurde dort korrigiert; die übrigen Stellen sind
  vorbestehend und liegen außerhalb der acht freigegebenen Kriterien.
  Die Entscheidung des Menschen war „Umziehen, Verhalten behalten" —
  eine Umstellung des Katalogbezugs wäre eine Neukonzeption.
  *(Default, unanswered.)*

## Log

- 2026-08-12 (re-check, independent code probe) — **Reproduces; every site the
  file names is still on the roster-wide value.** `RosterEditor` derives
  `activeCatalogue` once from `roster.catalogueId` in an effect
  (`RosterEditor.jsx:37, 109-115`) and hands the same object to every
  `ForceEditorSection` (`:152`). The named consumers read it unchanged:
  `CategoryUnitAdder.entryFor` -> `findEntryInSystem(system, capability.defId,
  activeCatalogue.id)` (`CategoryUnitAdder.jsx:113`), `OptionGroup` ->
  `resolveEntry(system, option, activeCatalogue?.id)` (`OptionGroup.jsx:207,
  242`), `ListRuleChecklist` (`:90`). The skew is visible in the same file:
  `ForceEditorSection` computes `forceCatalogueId = force.catalogueId ||
  roster.catalogueId` (`:67`) and passes **both** values down. Why it rarely
  bites is exactly as described: `findEntryInSystem` prefers the given catalogue
  and only then searches the others (`catalogResolver.js:142-162`), so identical
  ids in two books are the case that breaks.

- 2026-07-30: Von Prüfrunde 3 zu Issue 0121 gefunden (Befund F3 und der
  Abschnitt „was außerhalb der Kriterien brechen kann"). Reproduziert
  ist der Aushebe-Dialog; die übrigen Stellen sind derselben Bauart und
  vom Prüfer benannt, aber nicht einzeln reproduziert.

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
