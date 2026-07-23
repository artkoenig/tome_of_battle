Status: ready-for-agent
Type: fix
Blocked by: None

## Description

### Problem

Fix #122 (Issue 62) erzwingt einen armeeweiten Pflicht-`min` nur, wenn er als
`constraint scope="roster"` **direkt auf einem Wurzel-`selectionEntry`** steht
(alter whfb6/ergofarg-Datensatz: „Bulls"-Eintrag trägt die Constraint selbst).

Die **Definitive Edition** (`lexicanum-imperialis`, gameSystemId `0d13-…`)
codiert dieselbe Pflicht anders: „Ogre Bulls" ist ein **Wurzel-`entryLink`** im
`<entryLinks>`-Block des Katalogs (kein `selectionEntry`), der auf die geteilte
Einheit zeigt. Die Pflicht steckt in einer **force-scoped `min`-Constraint am
Link** (Basiswert 0), die ein Modifier des Links (Gruppe „Standard", gegatet auf
`notInstanceOf` Ironskin Tribe) auf **1** anhebt. Für eine Standard-Oger-Armee
gilt damit „mindestens eine Ogerbullen-Einheit".

`collectScopedMinSelectors` (`armyWideSelectors.js`) durchsucht ausschließlich
`catalogue.selectionEntries`, **nie** `catalogue.entryLinks`. Damit sammeln
weder `checkMandatoryForceSelectors` noch `checkMandatoryRosterSelectors` diesen
Selektor ein — die Pflicht wird nicht erzwungen.

**Folge:** Eine Oger-Liste der Definitive Edition ganz ohne Ogerbullen wird
fälschlich als gültig gemeldet.

### Aktuelles vs. erwartetes Verhalten

- **Aktuell:** Definitive-Edition-Roster ohne Ogerbullen → keine Meldung, gilt
  als spielbar.
- **Erwartet:** Blockierende `error`-Meldung („Die Armee braucht noch einen
  „Ogre Bulls."), sobald die Einheit armeeweit fehlt — genau wie beim
  `selectionEntry`-Muster aus #122.

### Umfang der Behebung (system-agnostisch, ADR 0003)

Die armeeweiten Pflichtselektor-Kollektoren
(`collectForceScopedMinSelectors` / `collectRosterScopedMinSelectors`, bzw. das
gemeinsame `collectScopedMinSelectors`) müssen zusätzlich die **Wurzel-`entryLinks`**
des Katalogs berücksichtigen. Für einen solchen Link gilt:

- Der Link wird auf sein Ziel-`selectionEntry` **aufgelöst** (Name, Sichtbarkeit,
  categoryLinks, Zählung über die aufgelöste Ziel-Id — bestehende
  `entry.targetId`-Logik in den Checks greift bereits).
- Ausgewertet werden die **am Link** hängende `min`-Constraint und die
  **Link-Modifier** (inkl. `modifierGroups`), damit die bedingte Anhebung
  (Standard vs. Ironskin Tribe) korrekt greift. Ein `set/increment`-Modifier auf
  die Link-Constraint-Id muss also mit ausgewertet werden.
- Kein doppeltes Melden: ein Katalog, der dieselbe Pflicht sowohl als
  `selectionEntry` als auch als `entryLink` führte, darf nur **einen** Verstoß
  erzeugen. (Praktisch tritt pro Katalog nur eine der beiden Formen auf.)

Force- und roster-scoped Varianten laufen danach über die bestehenden
Prüfpfade (`force-selector-min` bzw. `roster-selector-min`) — es entsteht **kein
neuer Verstoß-Typ**.

### Verifikation (E2E, echte Daten)

Bug zuerst an echten Katalogdaten reproduzieren: ein eingefrorener Verbatim-Auszug
des Definitive-Edition-Ogre-Kingdoms-Katalogs (Muster wie die vorhandenen
`src/solver/__fixtures__/whfb6-lexicanum/`-Fixtures) mit dem realen
„Ogre Bulls"-Wurzel-`entryLink` samt force-`min`-Constraint und
Standard-Modifier. Test: Roster ohne Ogerbullen → blockierender Verstoß; Roster
mit einer Ogerbullen-Einheit → kein Verstoß. Die bestehenden Tests aus #122
(`rosterValidator.mandatoryRosterSelector.test.js`) müssen grün bleiben.

## Acceptance Criteria
- [ ] Ein Wurzel-`entryLink` mit force- oder roster-scoped `min ≥ 1` (nach
  Modifier-Auswertung) wird als armeeweiter Pflichtselektor erkannt und erzwungen,
  wenn die Zieleinheit armeeweit fehlt.
- [ ] Die bedingte Anhebung am Link (z. B. Standard = min 1, Ironskin Tribe =
  min 0) wird korrekt ausgewertet: nur die Standard-Armee bekommt den Verstoß.
- [ ] Die force-/roster-Unterscheidung bleibt erhalten (`force-selector-min` mit
  `forceId` bzw. `roster-selector-min` einmal pro Roster, ohne `forceId`); kein
  neuer Verstoß-Typ.
- [ ] Kein Doppel-Melden, wenn Pflicht sowohl per `selectionEntry` als auch per
  `entryLink` vorläge.
- [ ] Reproduktions-Fixture aus echten Definitive-Edition-Daten + Test: Roster
  ohne Ogerbullen → blockierender Verstoß, mit einer Ogerbullen-Einheit → kein
  Verstoß.
- [ ] Bestehende Tests (inkl. #122) und `npm test` bleiben grün.

## Comments
