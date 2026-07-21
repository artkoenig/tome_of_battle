Status: resolved
Type: fix
Blocked by: None

## Description
**Typ:** Bug (Aushebe-Verfügbarkeit / Selektions-Fabrik, ADR-0022).

**Aktuelles Verhalten:** Im Aushebe-Dialog erscheinen Einheiten mit einer
„alles-verpflichtend"-Waffengruppe fälschlich als *(Nicht verfügbar)* mit der
Begründung `Option "Hand Weapon" erlaubt maximal 1 Auswahlen`.

**Reproduziert** mit den echten Definitive-Edition-Daten
(`lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition`,
ADR-0017), Einheit „Tichi Huichi's Raiders" (definiert in
`Mercenaries (6th definitive edition).cat`, `selectionEntry`
`86b2-59ec-ed5a-cf74`, verlinkt aus Lizardmen und Dogs of War). Reale Struktur:

```
[selectionEntryGroup] 'Weapons and Armour'  min=3, max=3 (scope=parent)
    [entryLink] 'Hand Weapon'      min=1, max=1
    [entryLink] 'Spear (Mounted)'  min=1, max=1
    [entryLink] 'Shield'           min=1, max=1
```

Semantik: Die Gruppe verlangt **3 Auswahlen gesamt** — je einmal Hand Weapon,
Spear und Shield.

**Root Cause:** `populateChildren` in `src/solver/selectionFactory.js`
(Gruppen-Zweig) behandelt jede Pflichtgruppe als „wähle N-mal aus einem Topf":
Es liest die **Gruppen-Untergrenze** (`min=3`), wählt die **Default- bzw.
Erst-Option** (hier „Hand Weapon") und legt sie **einmal mit `number = 3`** an —
statt jedes Mitglied mit eigenem `min>0` je einmal zu bevölkern. Der Validator
zählt daraufhin 3 Hand Weapons gegen deren eigenes `max = 1` → `entry-max`
„erlaubt maximal 1 Auswahlen (aktuell: 3)". Auf dem Anzeigepfad des Dialogs wird
„(aktuell: 3)" via `stripHypotheticalCount` gekappt → exakt die gemeldete
Meldung. Nebenbefund: Spear und Shield werden gar nicht bevölkert.

Weil dieselbe Fabrik das echte `addUnit` treibt, ist die Sperre konsistent, aber
falsch: die Einheit ist legal baubar (je 1× der drei Waffen).

**Verifikation (reine Node-Reproduktion gegen die echte Fabrik):**
`createSelectionFromDef` über die reale Gruppenstruktur erzeugt
`Hand Weapon: number=3`.

## Acceptance Criteria
- [ ] `populateChildren` bevölkert eine Pflichtgruppe, deren Mitglieder eigene
      `min>0`-Constraints tragen, indem es **jedes** solche Mitglied mit seinem
      **eigenen** `min` (rekursiv) anlegt — nicht die Erst-/Default-Option mit
      dem Gruppen-`min` multipliziert.
- [ ] Für die reale „Tichi Huichi's Raiders"-Struktur entsteht je 1× Hand Weapon,
      Spear (Mounted) und Shield; kein `entry-max`-Verstoß; die Einheit ist im
      Aushebe-Dialog verfügbar.
- [ ] Das bestehende „wähle-eine"-Verhalten (Pflichtgruppe `min=1`, Mitglieder
      ohne eigenes `min`) bleibt unverändert: die Default-/Erst-Option wird
      gewählt.
- [ ] Ein neuer, automatisierter Regressionstest deckt die
      „alles-verpflichtend"-Gruppe ab (vor Fix rot, danach grün) und bleibt
      generisch — keine katalog-/einheitsspezifische Sonderlogik.
- [ ] Die volle Testsuite (`npm test`) bleibt grün, keine neuen Lint-Funde.

## Comments
- Root Cause bestaetigt und behoben. populateChildren (src/solver/selectionFactory.js) las fuer jede Pflichtgruppe das Gruppen-min und legte die Default-/Erst-Option mit number=Gruppen-min an. Fuer die reale Struktur 'Weapons and Armour' (min=3, Mitglieder je min1/max1) entstand Hand Weapon x3 -> entry-max (max=1) -> Aushebe-Dialog sperrte die Einheit. Fix: neuer DRY-Helper populateMandatoryMembers bevoelkert zuerst jedes Mitglied mit eigenem min>0 je einmal (geteilt mit den direkten Pflicht-Kindern); nur wenn kein Mitglied selbst pflichtig ist, greift die bisherige Waehle-eine-Logik (Default-/Erst-Option x Gruppen-min). Generisch, ADR-0003-konform. Verifiziert per Node-Reproduktion gegen echte Definitive-Edition-Daten (Tichi Huichi's Raiders): vorher Hand Weapon number=3, nachher je 1x Hand Weapon/Spear/Shield. Regressionstest selectionFactory.test.js (itemisiert + waehle-eine + Default-Fallback + direkte Pflicht-Kinder), vor Fix rot, danach gruen. Volle Vitest-Suite 771/771 gruen, keine neuen Lint-Funde.
