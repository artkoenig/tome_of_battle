---
status: active
branch: claude/hochelfen-pure-of-heart-6k2pi1
pr:
---

# „Pure of Heart" wird der Armeeliste hinzugefügt, statt als Helden-Option gewählt zu werden

## Goal

Bei den Hochelfen legt die App beim Anlegen eines frischen Rosters automatisch
einen Wurzeleintrag „Pure of Heart" in die Armeeliste. Das ist falsch: „Pure of
Heart" ist eine **Ehre** (`Honours`), die ausschließlich unter einem Helden
gewählt wird — sie steht auf Armee-Ebene gar nicht zur Wahl.

Ursache ist `findMissingMandatoryListRuleSelections` (`src/roster/listRules.js`):
der Sweep für eindeutige Pflicht-Listenregeln (§9.9, Issue 0138/0140) durchsucht
neben den echten Wurzel-Pools `selectionEntries` und `entryLinks` auch
`sharedSelectionEntries`. Geteilte Definitionen sind aber **kein**
Wurzelbestand — sie sind laut
[§4 „`entryLink` — verweist auf ein shared SE/SEG"](../battlescribe-data-format.md)
nur über einen Verweis erreichbar und erscheinen allein an dessen Stelle. §9.9
spricht dementsprechend ausdrücklich vom **Wurzeleintrag des Katalogs** in den
beiden Kodierungen Wurzel-`selectionEntry` und Wurzel-`entryLink`. Der
Reinraum-Evaluator zieht dieselbe Grenze bereits korrekt
(`collectArmyLevelCandidates` in `src/evaluator/resolver.js`); die Schreibseite
tut es nicht.

`Pure of Heart` (`High Elves (6th definitive edition).cat`, geteilter Eintrag
`d0ce-b0c4-fcc1-6cac`) erfüllt jedes übrige Merkmal der Pflicht-Listenregel —
`type="upgrade"`, keine eigenen Unterauswahlen, `min value="1" scope="roster"`,
nicht ausgeblendet — und wird deshalb automatisch gesetzt. Erreichbar ist er
real nur über die geteilte Gruppe „Honours" (`45a3-3e65-6c49-5cc0`), die an vier
Helden-Einträgen hängt.

**Blast Radius (empirisch über beide Live-Forks gezählt: 19 Dateien der
Definitive Edition + 17 des ergofang-Satzes):** genau **ein** betroffener
Eintrag — „Pure of Heart". Jede andere Pflicht-Listenregel (`Errantry War`,
`War of Vengeance rules`, `Forces of Dwarfs' Army Rules`, `Gnoblar Army special
rules`, `Grimgor's 'Ardboyz`, `The Laws of Undeath`, `Who Is the general? …`)
liegt im Wurzel-Pool `selectionEntries` und bleibt unverändert.

## Acceptance criteria

- AC1: `findMissingMandatoryListRuleSelections` durchsucht nur noch die
  Wurzel-Pools `selectionEntries` und `entryLinks`; ein Eintrag, der allein in
  `sharedSelectionEntries` liegt, wird nie gemeldet — auch dann nicht, wenn er
  jedes übrige Merkmal der Pflicht-Listenregel trägt. | verify: `npx vitest run src/roster/listRules`
- AC2: Ein frisches Hochelfen-Roster enthält nach dem Anlegen keine Auswahl
  „Pure of Heart" mehr. Die Ehre bleibt unter einem Helden in der Gruppe
  „Honours" wählbar. | verify: `npx vitest run src/hooks/useRoster`
- AC3: Jede bisher automatisch gesetzte Pflicht-Listenregel aus einem echten
  Wurzel-Pool wird weiterhin gesetzt — die Wurzel-`selectionEntry`-Form ebenso
  wie die Wurzel-`entryLink`-Form. | verify: `npx vitest run src/roster src/hooks`

## Out of scope

- Die Durchsetzung des `min scope="roster"`-Constraints von „Pure of Heart"
  selbst. Dass eine Hochelfen-Armee genau einen Helden mit dieser Ehre führen
  muss, prüft der Evaluator heute nicht, solange die Auswahl ganz fehlt — das
  ist die bekannte Lücke „Pflicht-Unterauswahl auf einer fehlenden
  Elternauswahl" und ein eigenes Issue wert, kein Teil dieser Korrektur.
- `collectPrimaryCategoryEntries` (`src/roster/entryVisibility.js`) durchsucht
  `sharedSelectionEntries` ebenfalls, filtert aber zusätzlich auf die primäre
  Kategorie — ein geteilter Eintrag ohne `categoryLink` erscheint dort nie.
  Diese Stelle bleibt unangetastet.
