[BSData-Formatreferenz](../../battlescribe-data-format.md) › Bausteine

# 7.5 Cost & Cost Type

Ein `cost` weist einer Auswahl einen Wert einer Kostenart (`costType`, [§5.3](../files/game-system.md#53-cost-types-kostenarten))
zu. Referenziert wird per `typeId`:

```xml
<costs>
  <cost name="pts"           typeId="ecfa-8486-4f6c-c249" value="45.0"/>
  <cost name=" Casting Dice" typeId="fcec-2340-6368-a2ba" value="0.0"/>
  <cost name=" Dispel Dice"  typeId="6001-b2bf-4529-c07d" value="0.0"/>
</costs>
```

> **Rechenregel:** `child.number * parent.number` muss für Kosten und Constraint-Zählungen
> **immer** durchmultipliziert werden — unabhängig vom `collective`-Flag. `collective` betrifft nur
> die *Anzeige* gestapelter Instanzen, nicht die zugrunde liegende Mathematik.
>
> **Zahlenbasis:** Diese Multiplikation gilt für **per-Eltern-relative** Stückzahlen — „Anzahl je
> Eltern-Instanz", die Zahlenbasis der Katalog-Constraint-Mathematik. Die Reinraum-Engine
> multipliziert dagegen **nicht** durch die Elternkette (`src/contexts/ruleengine/engine/countIndex.js`,
> `contributionOf`: jeder Knoten trägt sein `instance.count` unverrechnet bei). Sie setzt damit
> voraus, dass das `number` einer `.ros`-Selektion eine **absolute** Gesamtstückzahl ist, kein
> per-Eltern-Multiplikator — unter dieser Annahme fallen beide Rechnungen zusammen. Die
> `.ros`-Semantik selbst ist eine Lücke der Quelle ([§15](../reference/source-gaps.md#15-lücken-der-quelle)); der
> ungeschriebene Roster-Vertrag der Fassade ist
> [Issue 084](../../issues/084-roster-vertrag-der-fassade-ist-ungeschrieben-und-ungeprueft.md).
