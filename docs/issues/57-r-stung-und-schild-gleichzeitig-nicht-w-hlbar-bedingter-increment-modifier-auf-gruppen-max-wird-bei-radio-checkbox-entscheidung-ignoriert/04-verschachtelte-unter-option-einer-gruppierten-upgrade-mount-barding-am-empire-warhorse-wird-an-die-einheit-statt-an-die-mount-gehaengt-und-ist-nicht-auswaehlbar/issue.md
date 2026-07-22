Status: ready-for-agent
Type: fix
Blocked by: None

## Description

### Symptom
Am Empire-**Captain**: In der Gruppe „Mounts" wird „Empire Warhorse" gewählt,
dadurch erscheint die verschachtelte Unter-Option „Barding" — sie lässt sich
aber **nicht auswählen** (Klick bleibt wirkungslos / hakt sich nicht dauerhaft
an). Wenn dieselbe Mount als direkte Einheiten-Option (nicht in einer Gruppe)
auftritt, funktioniert die Barding-Auswahl dagegen.

### Ursache (verifiziert, read-only reproduziert)
Eine **Unter-Option einer gruppierten Upgrade-Mount** wird an den **falschen
Parent** gehängt: Ist die Mount eine `upgrade`-Option innerhalb einer
`selectionEntryGroup` (kein eigenständiges Sub-Modell/Sub-Unit), flacht der
Editor die Hierarchie Einheit → Mounts-Gruppe → Mount → Unter-Option ab. Die
Unter-Option (Barding) landet als **direktes Kind der Einheit**, als Geschwister
der Mount, statt **unter der Mount-Auswahl**.

Mechanik:
- `optionsCollector.js` (`collectFromActiveSelections`) re-emittiert die Kinder
  einer gewählten Option in die flache Options-Liste der Einheit; die
  Unter-Option wird nur mit `groupName`/`groupId` der Mount für die Anzeige
  markiert — **ohne Referenz auf die tatsächliche Mount-Auswahl im Roster**.
- Der Checkbox-Handler (`OptionGroup.jsx`) ruft `increaseCount(unit.id, option)`
  — es gibt **kein Parent-Auswahl-Argument**, das die Mount adressiert.
- `useRoster` (`updateUnitChildSelections`) mutiert daraufhin die **direkten**
  Kinder der Einheit → Barding hängt an der Einheit.

**Warum „direkt geht, gruppiert nicht":** Ist die Mount ein echtes Sub-Modell
(`type` unit/model, non-collective, mit Kindern), bekommt sie eine eigene
rekursive Karte, deren Konfigurator die Mount als Parent-Auswahl durchreicht —
Barding hängt korrekt darunter, und `collectFromActiveSelections` überspringt
Sub-Units bewusst. Als bloßes `upgrade` (Empire Warhorse) fehlt diese Karte →
Fehl-Zuweisung. Die gruppierte Darstellung ist das, was die upgrade-Mount
überhaupt sichtbar macht, daher tritt der Fehler „innerhalb einer Gruppe" auf.

**Sichtbarer Folgeeffekt (erklärt das „nicht auswählbar"):** Die fehl-geparkte
Barding-ID wird über die rekursive `groupItemIds`-Sammlung in die
**Mounts-Gruppe (max 1)** hineingezählt. Mit bereits gewählter Mount (= 1) wirkt
die Barding-Auswahl wie eine zweite Auswahl in einer max-1-Gruppe (2 > 1) und
wird blockiert/zurückgesetzt. Zusätzlich ist der exportierte Roster-Baum falsch
(Barding nicht unter der Mount).

### Einordnung
Eigenständiger, bereits vorher vorhandener Bug in der Behandlung verschachtelter
Unter-Optionen. **Unabhängig** vom Rüstung/Schild-Fix (Issue 57 / effektive
Constraint-Werte) — dessen Code-Pfade sind nicht betroffen. Wird laut Nutzer-
Entscheidung dennoch **im selben Branch/PR (#112)** wie Issue 57 bearbeitet
(bewusste Abweichung von der 1-Issue-1-PR-Regel).

### Offener Punkt für die Umsetzung
Das exakte Pixel-Symptom konnte in der isolierten Diagnose nicht 1:1 nachgestellt
werden (rekursives Zählen maskiert die Fehl-Zuweisung, Box blieb dort angehakt);
die Fehl-Zuweisung selbst und die `groupItemIds`-Verunreinigung sind aber belegt.
Vor dem Fix daher zwingend das echte Symptom entlang des realen Nutzerpfads mit
den **echten Empire-DE-Katalogdaten** reproduzieren (liegt vor), damit der Fix
das tatsächliche Problem trifft.

## Acceptance Criteria
- [ ] Am realen Nutzerpfad reproduziert: gruppierte Upgrade-Mount wählen →
      verschachtelte Unter-Option (Barding) ist danach **auswählbar** und bleibt
      dauerhaft angehakt.
- [ ] Die Unter-Option wird im Roster-Modell **unter der Mount-Auswahl**
      verschachtelt, nicht als direktes Kind der Einheit.
- [ ] Die Unter-Option verunreinigt die `max`-Zählung der umgebenden
      Mounts-Gruppe nicht mehr (Mount + Barding bleiben innerhalb max 1 der
      Mounts-Gruppe gültig).
- [ ] Der exportierte/gespeicherte Roster-Baum bildet die Verschachtelung korrekt
      ab.
- [ ] Keine Regression für Mounts, die **echte Sub-Modelle** sind (deren
      Unter-Optionen funktionieren unverändert), und für Unter-Optionen direkter
      (nicht gruppierter) Einheiten-Optionen.
- [ ] Regressionstest deckt die minimale Struktur ab: Gruppe (max 1) → Mount als
      `upgrade` (max 1) → Unter-Option (max 1); Assertion: Unter-Option landet
      unter der Mount-Auswahl.
- [ ] `npm test`, Lint und Typecheck grün.

## Comments
- Implementierungshinweis (verifiziert, Zeilen koennen driften): Fehl-Zuweisung entsteht in optionsCollector.js collectFromActiveSelections (~Z.142-157, re-emit ohne Parent-Auswahl-Referenz) -> OptionGroup.jsx Checkbox/Row-Handler (~Z.441/364-374, increaseCount(unit.id,...) ohne Parent-Argument) -> useRoster.js updateUnitChildSelections (~Z.278-313, mutiert direkte Einheiten-Kinder) -> subSelectionEditing.js withChangedOptionCount (~Z.82). Unterscheidung Sub-Unit vs upgrade: subUnit.js (~Z.46); Sub-Units bekommen eigene UnitSelectionCard (UnitSelectionCard.jsx ~Z.349-368) und werden von collectFromActiveSelections uebersprungen (~Z.148). groupItemIds-Verunreinigung: optionsCollector.js collectGroupItemIds (~Z.50-58). Reale Katalog-Struktur auch in Fixture Vampire Counts.cat (Master Necromancer -> Mounts -> Nightmare -> Barding, ~Z.844). Echte Empire-DE-.cat: Captain Mounts-Gruppe id a57e-900f-105a-80d6, Empire Warhorse -> Barding targetId 3211-d836-02f1-01d0.
