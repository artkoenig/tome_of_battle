[BSData-Formatreferenz](../../battlescribe-data-format.md) › Dateien

# 5. Game System (`.gst`)

Das Game System ist der Wurzel-Katalog. Nur hier (bzw. in *Library*-Katalogen) werden die
systemweit geteilten Definitionen wie Kostenarten und Profil-Typen abgelegt.

## 5.1 Wurzelelement

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="6d8e-38d9-3c69-febf"
            name="Warhammer Fantasy Battle 6th edition"
            revision="8" battleScribeVersion="2.03" authorName="Ergo Fargo"
            xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
```

| Attribut | Bedeutung |
|----------|-----------|
| `id` | Die **`gameSystemId`** — jeder Katalog verweist per `gameSystemId` hierauf. |
| `revision` | Versionszähler (siehe [§3.3](../overview.md#33-revisionen-revision)). |
| `battleScribeVersion` | Schema-/Formatversion (hier `2.03`). |
| `authorName` | Autor. |

## 5.2 Publications (Quellen)

```xml
<publications>
  <publication id="315e-e3c4-08af-fd51" name="BRB"/>
</publications>
```

Profile, Regeln und Einträge referenzieren eine Publication per `publicationId` und geben oft
zusätzlich eine Seitenzahl (`page`) an. So lässt sich jeder Wert auf eine Buchquelle zurückführen.

> **Der Evaluator liest sie** (Issue 0102). Die `<publication>`-Deklarationen sind die **eine**
> Quelle des Klartext-Namens hinter einer `publicationId` — wie die `<profileType>`-Deklarationen
> die des Merkmalsnamens. `publicationId` und `page` hängen an der gemeinsamen `EntryBase` und
> werden deshalb an **jedem** Element gelesen; in den Bericht trägt sie die Info-Projektion je
> Profil und je Regel (`source`: Buch-Id, Klartext-Name, Seite; `null` ohne jede Angabe). Die
> Deklarationen stehen üblicherweise in der `.gst`, die `publicationId` im `.cat` — der Weg führt
> also über die Zusammenführung der Quellen.

## 5.3 Cost Types (Kostenarten)

Ein `costType` abstrahiert eine **abzählbare Ressource** — meist Punkte, aber auch beliebige andere:

```xml
<costTypes>
  <costType id="ecfa-8486-4f6c-c249" name="pts"           defaultCostLimit="-1.0" hidden="false"/>
  <costType id="fcec-2340-6368-a2ba" name=" Casting Dice" defaultCostLimit="-1.0" hidden="false"/>
  <costType id="6001-b2bf-4529-c07d" name=" Dispel Dice"  defaultCostLimit="-1.0" hidden="false"/>
</costTypes>
```

| Attribut | Bedeutung |
|----------|-----------|
| `defaultCostLimit` | Standard-Obergrenze; `-1.0` = kein Limit. |
| `hidden` | Ob die Kostenart dem Nutzer angezeigt wird. |

## 5.4 Profile Types & Characteristic Types

Ein `profileType` ist ein benanntes **Spalten-Schema** (ein „Column-Set") für Statblöcke. Jede Spalte
ist ein `characteristicType`:

```xml
<profileTypes>
  <profileType id="a54a-7f00-29bf-12b1" name="Profile">
    <characteristicTypes>
      <characteristicType id="0e92-d038-82bf-fb41" name="Mv"/>
      <characteristicType id="f95b-da01-0578-3bdc" name="WS"/>
      <characteristicType id="4a8b-0c8e-3daf-7901" name="BS"/>
      <characteristicType id="b690-4bc0-bb73-267b" name="S"/>
      <characteristicType id="8712-f56f-5b22-a720" name="T"/>
      <!-- W, I, A, Ld … -->
    </characteristicTypes>
  </profileType>
  <profileType id="7889-42d9-70a0-3ea9" name="Weapon">
    <characteristicTypes>
      <characteristicType id="3107-4d1e-9a51-6564" name="Range"/>
      <characteristicType id="6fe4-1ebb-cb04-1378" name="Strength"/>
      <characteristicType id="a21a-cdc0-4b13-b236" name="Special Rules"/>
    </characteristicTypes>
  </profileType>
</profileTypes>
```

Ein konkretes `profile` (siehe [§7.3](../building-blocks/profile-and-rule.md#73-profile-profile-type-characteristic)) verweist per
`typeId` auf einen dieser Typen und füllt die Spalten mit `characteristic`-Werten.

## 5.5 Category Entries (Kategorien)

Kategorien sind **tag-artige Entitäten**. Sie dienen der Einordnung in der Roster-UI und als
Bedingungen für die Validierung:

```xml
<categoryEntries>
  <categoryEntry id="d024-d25b-a9b4-73b6" name="Lord"    hidden="false"/>
  <categoryEntry id="64bf-efb4-9978-26df" name="Core"    hidden="false"/>
  <categoryEntry id="43cc-fc3f-35a7-8d03" name="Special" hidden="false"/>
  <categoryEntry id="a37e-7207-de6d-acb0" name="General" hidden="false">
    <constraints>
      <constraint field="selections" scope="roster" value="1.0" percentValue="false"
                  shared="true" includeChildSelections="true" includeChildForces="true"
                  id="d818-c60d-b1f8-8aaa" type="max"/>
      <constraint field="selections" scope="roster" value="1.0" percentValue="false"
                  shared="true" includeChildSelections="true" includeChildForces="true"
                  id="1077-7379-f142-f382" type="min"/>
    </constraints>
  </categoryEntry>
</categoryEntries>
```

Hier erzwingt die Kategorie „General" per `min=1`/`max=1`, dass **genau ein** General in der Armee
steht — komplett sprachneutral, allein über die verlinkte Kategorie-ID.

## 5.6 Force Entries (Detachments)

Ein `forceEntry` repräsentiert eine „Force" — ein Detachment/Bataillon/eine Armeeorganisation. Es
legt über `categoryLinks` fest, **welche Kategorien in dieser Force erscheinen** und mit welchen
Grenzen:

```xml
<forceEntries>
  <forceEntry id="7d9d-6c8d-4ea0-b7ad" name="Standard " hidden="false">
    <categoryLinks>
      <categoryLink id="223a-0bf6-f992-7db0" name="Lord"   targetId="d024-d25b-a9b4-73b6" primary="false"> … </categoryLink>
      <categoryLink id="7697-ca4b-195e-cd8d" name="Heroes" targetId="c16b-f319-2c62-2c12" primary="false"/>
      <categoryLink id="a87e-de8e-ade8-cae0" name="Core"   targetId="64bf-efb4-9978-26df" primary="false"> … </categoryLink>
    </categoryLinks>
  </forceEntry>
</forceEntries>
```

Die `categoryLink`s tragen häufig **dynamische Grenzen** über `modifier`s: In WHFB6 skalieren die
erlaubten Lord-/Core-Slots mit dem Punktelimit. Genau das zeigt das Beispiel in
[§7.7](../building-blocks/modifier.md#77-modifier-condition-condition-group-repeat).

> **Zwei Orte für Force-Kategoriegrenzen.** Eine force-weite Kategoriegrenze kann an **zwei**
> Stellen deklariert sein, und beide müssen bei der Validierung berücksichtigt werden:
> 1. Am **`categoryLink`** innerhalb des `forceEntry` (das oben gezeigte, klassische Muster).
> 2. Direkt an der **`categoryEntry`-Definition** ([§5.5](#55-category-entries-kategorien)) als
>    `constraint` mit `scope="force"` (inkl. punkteskalierender `modifier`). Diese Grenze gilt dann
>    für die Kategorie **in jeder Force**, ohne dass sie am `categoryLink` wiederholt werden muss.
>    Der Lexicanum-WHFB6-Datensatz nutzt genau diese Variante für die Charaktergrenzen (die
>    Characters-`categoryEntry` trägt die punkteskalierende `scope="force"`-Grenze, während die
>    Heroes-Kategorie `max="-1"` = unbegrenzt setzt). Eine Auswertung, die nur `categoryLink`-Grenzen
>    liest, würde diese Limits still nicht durchsetzen.

> **Regeln zur Auswertung:**
> - Force-Kategoriegrenzen zählen ihr **Kategorie**-Ziel **armeeweit** (über alle Forces aggregiert) —
>   unabhängig davon, ob sie am `categoryLink` oder an der `categoryEntry`-Definition hängen. Das ist
>   die einheitliche Ziel-Typ-Regel aus [§7.7](../building-blocks/modifier.md#77-modifier-condition-condition-group-repeat) (ADR 0029):
>   ein `scope="force"`-Constraint mit **Eintrags**-Ziel zählt pro Detachment, mit **Kategorie**-Ziel
>   armeeweit. Bei Ein-Force-Listen ist beides identisch.
> - Force Entries können **sowohl im Game System (`.gst`) als auch im einzelnen Katalog (`.cat`)**
>   deklariert sein — beim Erstellen einer Liste müssen **beide Quellen** berücksichtigt werden.
> - Ein `forceEntry` bzw. `categoryLink` mit `hidden="true"` (oder dynamisch per Modifier
>   `field="hidden"`, siehe [§8](../building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit)) darf dem Nutzer **nicht** als Option
>   angeboten und dessen Mindestgrenzen dürfen **nicht** validiert werden. Per Projektentscheidung
>   (Issue 0088) gilt das Validierungsverbot für **jede** effektiv versteckte Entität mit
>   Min-Grenzen — auch `selectionEntry`/`selectionEntryGroup` —, denn ein Verstoß über etwas, das
>   nicht angeboten wird, wäre für den Nutzer unbehebbar. Max-Grenzen bleiben davon unberührt.

> **`forceEntry`-eigene Constraints/Modifier (eigenes Punktelimit).** Ein `forceEntry` kann —
> zusätzlich zu seinen `categoryLinks` — **eigene** `constraints` und `modifiers` tragen (es erbt
> von `ContainerEntryBase`). Muster im Lexicanum-WHFB6-Datensatz (zwei Vampire-Counts-Sonderheere,
> „Army of the Lichemaster", „Vampire Coast"): eine Constraint mit `field="limit::<pts-costTypeId>"`
> und `scope="roster"` (Basis `min="0"`, also armeeweit **kein** Mindestpunktelimit), angehoben auf
> einen konkreten Wert durch einen `modifier`, dessen `condition` per `type="instanceOf"
> scope="force"` auf die **eigene** `forceEntry`-Id gated ist — netto: „wird dieses Sonderheer
> gewählt, muss die Liste auf mindestens X Punkte gebaut werden". Diese Constraint ist von den
> `categoryLink`-Constraints ([§7.6](../building-blocks/constraint.md#76-constraint)) unabhängig und wird gesondert ausgewertet.
