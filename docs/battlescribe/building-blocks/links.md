[BSData-Formatreferenz](../../battlescribe-data-format.md) › Bausteine

# 7.2 Entry Link, Info Link, Category Link

Es gibt drei Link-Typen. Alle referenzieren per `targetId` eine geteilte Definition.

## `entryLink` — verweist auf ein shared SE/SEG

```xml
<entryLink id="573d-1e36-4358-84ea" name="Light Armour"
           collective="false" import="true"
           targetId="055f-8e4e-f170-35d2" type="selectionEntry">
  <constraints>
    <constraint field="selections" scope="parent" value="1.0" type="max"
                id="3db3-9c83-7af4-8aa6" percentValue="false" shared="true"
                includeChildSelections="false" includeChildForces="false"/>
  </constraints>
  <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="3.0"/></costs>
</entryLink>
```

| `type` | Ziel |
|--------|------|
| `selectionEntry` | verweist auf ein geteiltes `selectionEntry` |
| `selectionEntryGroup` | verweist auf ein geteiltes `selectionEntryGroup` |

Ein `entryLink` kann eigene `constraints`, `modifiers` und `costs` mitbringen. So kostet dieselbe
Waffe an verschiedenen Einheiten unterschiedlich viel — die **Kosten liegen am Link, nicht an der
Definition**.

Ein `entryLink` kann darüber hinaus **eigene Kinder deklarieren**: laut `Catalogue.xsd` erweitert
`EntryLink` den Typ `SelectionEntryBase` und führt damit selbst
`selectionEntries`/`selectionEntryGroups`/`entryLinks`. Diese am Link deklarierten Kinder stehen an
**genau dieser Verwendungsstelle** neben denen des Ziels — das geteilte Ziel selbst bleibt
unberührt. Die realen Kataloge nutzen das: im Empire-Katalog (6th definitive edition) tragen 31 der
720 `entryLink`s eigene Kinder, etwa der Verweis auf „Empire Warhorse", an dem die Option „Barding"
hängt, statt am geteilten Ross-Eintrag.

Das Ziel muss aus den **shared**-Listen *desselben* Katalogs stammen; per Grundregelwerk-Import
zählen die geteilten Einträge der `.gst` mit dazu (dort schreibgeschützt). Ein Roster, das einen
Verweis aus Katalog X benennt, ist gegen einen Datensatz ohne X folglich nicht auswertbar — auch
dann nicht, wenn die Ziel-Id zufällig in der `.gst` auflöst. Analog für Kontingente: *„All
selections within must originate from a single catalogue."*

> **Bewusster Override in der Reinraum-Engine (ADR-0032):** Der Evaluator erzwingt diese
> Katalog-Lokalität nicht. `entryLink`-/`infoLink`-Ziele lösen **global-by-ID** über eine flache
> Symboltabelle aller mitgegebenen Quellen auf; ein `catalogueLink` ist dort nur eine
> Abhängigkeits-Deklaration, kein eigener Auflösungsmechanismus. Abgesichert wird das durch
> Diagnosen statt stiller Fehlauswertung: eine echte ID-Kollision zwischen Katalogen meldet der
> Kollisions-Guard des Resolvers als `DUPLICATE_DEFINITION`; einen fehlenden Ziel-Katalog meldet
> die Datensatz-Vorbereitung der Fassade als `MISSING_CATALOGUE_DEPENDENCY`
> (siehe [ADR 0032](../../adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md)).

Ein `modifier` am Link wirkt asymmetrisch: er ändert die **Eigenschaften des Ziels**, aber die
**Grenzwerte des Links**.

## `infoLink` — verweist auf ein Profil oder eine Regel

```xml
<infoLinks>
  <infoLink id="2210-9741-7311-e655" name="Tomb King"  targetId="8a60-0398-a620-ca9e" type="profile"/>
  <infoLink id="6e69-d60f-61d8-5f27" name="Undead"     targetId="97a4-d2a9-5b16-f0c3" type="rule"/>
  <infoLink id="45ec-367c-3308-8f61" name="Flammable"  targetId="ff92-e6dd-2f5d-dcca" type="rule"/>
</infoLinks>
```

`type` ist `profile`, `rule` oder `infoGroup`. So bekommt eine Einheit ihren Statblock (`profile`)
und ihre Sonderregeln (`rule`) angehängt, ohne sie zu duplizieren.

## `categoryLink` — ordnet den Eintrag in Kategorien ein

```xml
<categoryLinks>
  <categoryLink id="1c5b-4911-4cdb-fa23" name="New CategoryLink" targetId="d024-d25b-a9b4-73b6" primary="true"/>
  <categoryLink id="6751-1abf-6518-f54f" name="Characters"      targetId="7a1c-d611-c2dc-def1" primary="false"/>
  <categoryLink id="910e-ee4d-9fb6-ec1d" name="Tomb King"       targetId="a066-363e-a1c1-aa6b" primary="false"/>
</categoryLinks>
```

- **`primary="true"`** — die **eine** Kategorie, unter der der Eintrag in der Roster-UI einsortiert
  wird (hier: „Lord").
- **`primary="false"`** — unsichtbare, tag-artige Schlüsselwort-Kategorien, nur für die Validierung
  (z. B. „wer darf ein Reittier nehmen", „wer kann General sein").

> **Regel:** Die UI wird **nie** nach hartkodierten Kategorienamen gruppiert, sondern immer über
> `primary="true"` und die aufgelöste Kategorie-ID.
