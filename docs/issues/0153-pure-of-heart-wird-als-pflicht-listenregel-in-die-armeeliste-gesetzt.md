---
status: waiting
branch: claude/hochelfen-pure-of-heart-option-dj4116
pr:
---

# „Pure of Heart" wird bei Hochelfen in die Armeeliste gesetzt statt am Helden gewählt

## Goal

In einem neu angelegten Hochelfen-Kontingent erscheint „Pure of Heart" als eigene
Zeile in der Armeeliste. Der Eintrag ist aber keine Listenregel, sondern eine
**Ehre (Honour)**, die ein Held (Prince/Archmage/Commander/Mage) in seiner Gruppe
„Magic and Honors → Honours" wählt. Ursache ist der Pflicht-Listenregel-Sweep
`findMissingMandatoryListRuleSelections` (`src/roster/listRules.js`): er zählt
`catalogue.sharedSelectionEntries` zu den **Wurzel-Pools** eines Katalogs.
Geteilte Definitionen sind aber keine Wurzeleinträge — sie sind ausschließlich
über einen `entryLink` erreichbar und erscheinen allein an dessen Stelle
(`docs/battlescribe-data-format.md` §9.9 nennt genau zwei Wurzelformen: Wurzel-
`selectionEntry` und Wurzel-`entryLink`; die Reinraum-Engine hält das in
`src/evaluator/resolver.js` `collectArmyLevelCandidates` bereits so).

„Pure of Heart" erfüllt in beiden Datenquellen alle übrigen Merkmale des
Prädikats `isUnconditionalMandatoryListRule` (Typ `upgrade`, keine eigenen
Unterauswahlen, eigener `min value="1" scope="roster"`), lebt aber nur in
`sharedSelectionEntries` und wird nur von der geteilten Gruppe „Honours"
verlinkt:

| Datenquelle | Eintrag | Gruppe „Honours" | verlinkt von |
|---|---|---|---|
| Definitive (`High Elves (6th definitive edition).cat`, `b59c-7ff5-fb34-405e`) | `sharedSelectionEntries` → `selectionEntry` `d0ce-b0c4-fcc1-6cac` | `sharedSelectionEntryGroups` → `45a3-3e65-6c49-5cc0` | Prince/Archmage/Commander/Mage, je Gruppe „Magic and Honors" |
| Ergofarg (`High Elf.cat`, `3878-c4be-6286-15a7`) | dieselben Ids | dieselbe Id | dieselben vier Helden |

Der Eintrag trägt zudem keinen `categoryLink`, weshalb der „+"-Adder und die
Ankreuzliste ihn korrekt nie zeigen (`collectPrimaryCategoryEntries` filtert
über die Primärkategorie) — allein der Sweep setzt ihn.

## Acceptance criteria

- AC1: `findMissingMandatoryListRuleSelections` durchsucht nur die echten
  Wurzel-Pools eines Katalogs (`selectionEntries`, `entryLinks`) und liefert
  einen ausschließlich in `sharedSelectionEntries` definierten Eintrag mit
  `min ≥ 1 scope="roster"|"force"` **nicht** mehr als fehlende Pflicht-
  Listenregel. | verify: `npx vitest run src/roster/listRules`
- AC2: Ein Pflichtselektor in der Wurzel-`entryLink`-Form (§9.9, „Ogre Bulls":
  Constraint am Link, Ziel liegt geteilt) wird weiter gefunden — die Auflösung
  geteilter Ziele über einen Wurzel-Link bleibt unberührt. | verify: `npx vitest run src/roster/listRules`
- AC3: Die bisher gefundenen echten Wurzel-Pflichtregeln bleiben gefunden
  („The Laws of Undeath", Wurzel-`selectionEntry` mit `min=1 scope="force"`;
  „Intrigue at Court" der Hochelfen, Wurzel-`selectionEntry` mit per Modifier
  auf 1 gehobenem `min scope="roster"`). | verify: `npx vitest run src/roster/listRules`
- AC4: Alle bestehenden Testschichten bleiben grün. | verify: `npx vitest run`

## Out of scope

- `collectPrimaryCategoryEntries` (`src/roster/entryVisibility.js`) führt
  `sharedSelectionEntries` ebenfalls im Pool. Dort ist der Pool durch den
  Primärkategorie-Filter abgeschirmt; an den echten Hochelfen-Daten (beide
  Quellen) liefert die Funktion **keinen** nur-geteilten Eintrag. Bleibt
  unangetastet.
- Die Regel „ein Hochelfen-Held **muss** die Ehre ‚Pure of Heart' tragen" wird
  nicht ersatzweise erzwungen: die Pflicht hängt an keinem Wurzeleintrag, und
  §11.1 („Erlauben schlägt Verbieten") gibt dem Zulassen den Vorzug.
- Der Evaluator (`src/evaluator/`) wird nicht angefasst; er schließt geteilte
  Definitionen von den Armee-Ebene-Kandidaten längst korrekt aus.
