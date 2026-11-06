[BSData-Formatreferenz](../../battlescribe-data-format.md) › Bausteine

# 7.3 Profile, Profile Type, Characteristic

Ein `profile` ist eine benannte Liste von Merkmalswerten (ein Statblock). Es verweist per `typeId`
auf einen `profileType` ([§5.4](../files/game-system.md#54-profile-types--characteristic-types)) und liefert für jede Spalte
einen `characteristic`-Wert. Profile werden meist zentral unter `sharedProfiles` abgelegt und per
`infoLink` eingebunden:

```xml
<sharedProfiles>
  <profile id="8a60-0398-a620-ca9e" name="Tomb King" publicationId="04f9-cede-fdb3-1e6c"
           hidden="false" typeId="a54a-7f00-29bf-12b1" typeName="Profile">
    <characteristics>
      <characteristic name="Mv" typeId="0e92-d038-82bf-fb41">4</characteristic>
      <characteristic name="WS" typeId="f95b-da01-0578-3bdc">6</characteristic>
      <characteristic name="BS" typeId="4a8b-0c8e-3daf-7901">4</characteristic>
      <characteristic name="S"  typeId="b690-4bc0-bb73-267b">5</characteristic>
      <characteristic name="T"  typeId="8712-f56f-5b22-a720">5</characteristic>
      <characteristic name="W"  typeId="253a-9b00-4fde-8ac2">4</characteristic>
      <characteristic name="I"  typeId="dfff-363e-f72a-5a59">3</characteristic>
      <characteristic name="A"  typeId="6b9f-c8fe-8998-27e3">4</characteristic>
      <characteristic name="Ld" typeId="2d45-18fe-9eb3-b113">10</characteristic>
    </characteristics>
  </profile>
</sharedProfiles>
```

- Der **Textinhalt** eines `characteristic` ist die Anzeige (`4`, `6`, `4+`, `Str 5, no armour save`).
- Ist der Wert numerisch, kann er von Modifiern verrechnet werden.
- Der `name`/`typeId` jedes `characteristic` bindet ihn an eine Spalte des `profileType`.

> **Domänenregel (rekursive Profil-Sammlung):** Profile und Sonderregeln hängen oft **nicht** an der
> Grundeinheit, sondern verschachtelt an Upgrades (z. B. eine *Bloodline* eines *Vampire Thrall*). Die
> effektiven Profile/Regeln einer Einheit müssen daher **rekursiv** aus den Katalogdefinitionen **und**
> den tatsächlich getroffenen Spielerauswahlen eingesammelt werden — dabei aber nur *aktiv gewählte*
> optionale Upgrades berücksichtigen (siehe [§7.1](selection-entry.md#71-selection-entry--selection-entry-group)).

# 7.4 Rule

Eine `rule` ist die **einzige mehrzeilige** Textentität — Zeilenumbrüche im `<description>` bleiben
erhalten. Regeln werden meist unter `sharedRules` definiert und per `infoLink type="rule"` verlinkt:

```xml
<sharedRules>
  <rule id="1165-2ae3-f1fb-075d" name="The Hierophant" publicationId="04f9-cede-fdb3-1e6c" hidden="false">
    <description>The army must include one Liche High Priest or Liche Priest. Highest leadership is
    the Hierophant. In the phase he is destroyed and at the beginning of each undead turn after,
    every unit must take a leadership test …</description>
  </rule>
</sharedRules>
```

Sonderzeichen werden XML-üblich escaped (`&apos;` `&quot;` `&amp;`).
