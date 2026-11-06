[BSData-Formatreferenz](../../battlescribe-data-format.md) › Bausteine

# 7.1 Selection Entry & Selection Entry Group

`selectionEntry` (SE) und `selectionEntryGroup` (SEG) sind laut Wiki **„absolutely fundamental"** —
sie repräsentieren *Einheiten, Modelle, Upgrades und sonstige Ausrüstung*.

## Selection Entry

```xml
<selectionEntry id="5f2b-d3e2-60f2-a4e6" name="Tomb King"
                hidden="false" collective="false" import="true" type="unit">
  <infoLinks> … </infoLinks>          <!-- Profile & Regeln -->
  <categoryLinks> … </categoryLinks>  <!-- Einordnung -->
  <selectionEntries> … </selectionEntries>          <!-- verschachtelte Einträge -->
  <selectionEntryGroups> … </selectionEntryGroups>  <!-- Auswahlgruppen -->
  <entryLinks> … </entryLinks>        <!-- Verweise auf shared entries -->
  <constraints> … </constraints>
  <costs> … </costs>
</selectionEntry>
```

| Attribut | Werte | Bedeutung |
|----------|-------|-----------|
| `type` | `unit` \| `model` \| `upgrade` | Metadatum, das Anzeige und Statistiken beeinflusst. `unit`/`model` sind physische Elemente, `upgrade` sind Optionen/Ausrüstung. |
| `collective` | `true`/`false` | Ob der Eintrag als eine gruppierte Zeile dargestellt/synchronisiert wird (siehe [§10](../patterns/collective-entries.md#10-collective-entries)). |
| `import` | `true`/`false` | Ob der Eintrag beim Export in die Roster übernommen wird. |
| `hidden` | `true`/`false` | Sichtbarkeit (kann per Modifier dynamisch werden). |

## Selection Entry Group

Eine SEG bündelt Alternativen — typischerweise „wähle X aus dieser Liste". Ein `max="1"`-Constraint
auf einer Gruppe bedeutet **exklusive Wahl (Radiobutton-Semantik)**, nicht „höchstens 1 Stück von
etwas Zählbarem".

```xml
<selectionEntryGroup id="ea98-9474-c6d2-03af" name="Additional Weapons"
                     hidden="false" collective="false" import="true">
  <constraints>
    <constraint field="selections" scope="parent" value="1.0" percentValue="false"
                shared="true" includeChildSelections="false" includeChildForces="false"
                id="306f-ca1d-0f4d-0da0" type="max"/>
  </constraints>
  <entryLinks>
    <entryLink id="4c13-4d43-029c-39e4" name="Great Weapon" targetId="1eb7-3f36-8cf7-e0ba" type="selectionEntry">
      <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="6.0"/></costs>
    </entryLink>
    <entryLink id="f94d-f042-d658-698a" name="Flail" targetId="2eb9-be12-caec-57e8" type="selectionEntry">
      <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="3.0"/></costs>
    </entryLink>
  </entryLinks>
</selectionEntryGroup>
```

Eine Gruppe kann eine **Standardauswahl** über `defaultSelectionEntryId` festlegen:

```xml
<selectionEntryGroup id="7e80-30c2-95ef-51c3" name="Weapons"
                     collective="false" import="true"
                     defaultSelectionEntryId="163c-9fe8-772c-94a5"> … </selectionEntryGroup>
```

Auswertung von `defaultSelectionEntryId`:

- Es greift, wenn die Gruppe eine **Mindestauswahl** (`min > 0`) hat, und benennt die ID der Option
  (`selectionEntry` oder `entryLink` unterhalb der Gruppe), die dann vorausgewählt sein soll.
- Ist das Attribut gesetzt und passt zu einer Option der Gruppe, muss **diese** Option erzeugt werden
  — nicht die erste in der Liste.
- Fehlt das Attribut oder ist es ungültig, fällt das System auf die **erste verfügbare Option** der
  Gruppe zurück.

> **Der Evaluator liest es, wendet es aber nicht an** (Issue 0102). Vorbelegen ist eine Regel des
> **Bearbeitens** — der Evaluator wählt nichts aus, er beurteilt Gewähltes. Der Wert steht deshalb
> im aufbereiteten Datensatz an der Gruppe (`defaultSelectionEntryId`, `null` ohne Angabe) und ist
> für die Oberfläche da; eine Liste, die die vorbelegte Option nicht enthält, ist kein Verstoß.
> Der Verzicht ist damit ein benannter, kein stiller.

> **Wichtige Domänenregel:** Optionale Upgrades (kein `min > 0`) dürfen ihre Profile/Regeln **nicht**
> automatisch auf die Elterneinheit aufaddieren, bevor der Spieler sie tatsächlich wählt. Sonst wird
> z. B. ein *Savage Orc Great Shaman* fälschlich als beritten gewertet, nur weil im Katalog unter ihm
> ein optionaler *Boar*-Mount definiert ist.
