[BSData-Formatreferenz](../../battlescribe-data-format.md) › Referenz

# 13. Referenztabellen

## 13.1 Wichtige Enum-Werte

| Kontext | Attribut | Werte |
|---------|----------|-------|
| `selectionEntry` | `type` | `unit`, `model`, `upgrade` |
| `entryLink` | `type` | `selectionEntry`, `selectionEntryGroup`, `rule` (2× in den Fixture-Katalogen belegt — „The Dark Art" in `Vampire Counts` und `Dark Elves` —, upstream nicht dokumentiert) |
| `infoLink` | `type` | `profile`, `rule`, `infoGroup` |
| `constraint` | `type` | `min`, `max` |
| `constraint` | `field` | `selections`, `forces`, *`<costTypeId>`* |
| `constraint`/`condition`/`repeat` | `scope` | Neun Schlüsselwörter — `parent`, `roster`, `force`, `self`, `unit`, `ancestor` (nur `condition`, [§7.7](../building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)), `primary-catalogue` ([§7.6](../building-blocks/constraint.md#scopeprimary-catalogue--das-armeebuch-kein-zählrahmen)), `primary-category` (4× in den Fixture-Katalogen belegt, `Forces of Chaos`) und `model-or-unit` (2× belegt, `Lizardmen`; beide upstream nicht dokumentiert, [§7.7](../building-blocks/modifier.md#scopeprimary-category-und-scopemodel-or-unit--die-primäre-kategorie-und-der-weitere-typ-rahmen)) — **oder** eine Vorfahren-Id (Eintrag, Gruppe, `forceEntry`, Kategorie). Ein Literal `category` gibt es nicht: die Wiki-Formulierung *„any Category"* meint eine Kategorie-**Id**, und keiner der beiden eingefrorenen Korpora schreibt `scope="category"`. |
| `modifier` | `type` | `increment`, `decrement`, `set`, `append`, `prepend`, `multiply`, `add`, `remove`, `set-primary`, `unset-primary` (`prepend`/`multiply` ohne offiziellen Schema-Beleg, siehe [§7.7](../building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)) |
| `modifier` | `field` | Constraint-`id`, `<costTypeId>`, `hidden`, `name`, `category`, `error`, `warning`, `info`, `<characteristicTypeId>` |
| `condition` | `type` | `lessThan`, `greaterThan`, `equalTo`, `notEqualTo`, `atLeast`, `atMost`, `instanceOf`, `notInstanceOf`, `greaterThanOrEqualTo` (1× in den Fixture-Katalogen belegt, `src/tests/__fixtures__/whfb6/Orcs and Goblins.cat`, upstream nicht dokumentiert) |
| `conditionGroup` | `type` | `and`, `or`, `not` (`not` ohne offiziellen Schema-Beleg, siehe [§7.7](../building-blocks/modifier.md#conditiongroup--verknüpfung-mehrerer-bedingungen)) |

## 13.2 Der `field`-Wert je nach Kontext

| Element | `field` bedeutet … | Beispielwerte |
|---------|--------------------|---------------|
| `constraint` | *was gezählt/summiert wird* | `selections`, `forces`, `<costTypeId>` |
| `modifier` | *was geändert wird* | Constraint-`id`, `<costTypeId>`, `hidden`, `name`, `category`, `error`, `warning`, `info`, `<characteristicTypeId>` |
| `condition` / `repeat` | *worauf getestet/gezählt wird* | `selections`, `<costTypeId>`, `limit::<costTypeId>` |

- `limit::<costTypeId>` = das **Kostenlimit** (Budget) der Roster für diese Kostenart.
- `childId` (auf `condition`/`repeat`) = *welche* Elemente gezählt werden: eine Ziel-ID, ein
  Typ-Keyword (`model`/`unit`/`upgrade`) oder `any`.

## 13.3 Gemeinsame Attribute fast aller Entitäten

| Attribut | Zweck |
|----------|-------|
| `id` | eindeutige Kennung (UUID-artig) |
| `name` | Anzeigename (nicht eindeutig, nicht als Schlüssel nutzen) |
| `hidden` | Sichtbarkeit (per Modifier dynamisierbar) |
| `publicationId` + `page` | Quellenangabe (Buch aus `<publications>`, Seite) |
| `revision` (nur Wurzel) | Versionszähler für Update-Erkennung |

**Boolean-Attribute sind `xs:boolean`.** Damit sind **vier** lexikalische Formen gültig: `true`,
`false`, `1` und `0`. BattleScribe selbst schreibt durchgängig `true`/`false`, und in den
eingefrorenen Fixture-Katalogen kommt die Kurzform an **keinem** Boolean-Attribut vor (gezählt über
`hidden`, `shared`, `includeChildSelections`, `includeChildForces`, `percentValue`, `primary`,
`collective`, `library`, `import`, `roundUp`, `importRootEntries`: 0 Treffer). Gültiges XML ist sie
trotzdem, und wer sie nicht liest, hält ein `hidden="1"` still für sichtbar. Der Evaluator liest
deshalb beide Formen an **einer** Stelle (`readBoolean`, `src/contexts/ruleengine/engine/catalogReader.js`) —
und damit an jedem dieser Attribute gleich (Issue 0102, Punkt 6).
