# E2E-Regeln & Testkatalog: `condition scope="<Eintrags-Id>"` — der Rahmen ist *diese* Instanz der Einheit, und der Inner Circle hebt S nur in ihr

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Element-Ids, Merkmalswerte und Erwartungswerte sind **ausschließlich aus den
Katalogdaten** der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §3.4,
§7.2, §7.3, §7.6, §7.7 und der
[Kasten `scope="unit"`/`scope="ancestor"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette))
abgeleitet. Die Roster-Form folgt den bereits verifizierten Szenarien (direktes
`entryId` bzw. `entryId` + `entryLinkId`, `entryGroupId` für Gruppenmitglieder,
verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `The Empire (6th definitive edition).cat` (`3938-8369-a300-4a03`,
  rev 1) — Kontingent **„Standard (EM-AB)"** `e821-88b8-2071-6b6a`
  (`The Empire (…).cat:15372`)
- Söldner-Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — **nicht** Fundort der geprüften
  Zelle, aber die einzige `catalogueLink`-Abhängigkeit des Armeebuchs
  (`id="7773-ecbb-5fb9-eb56"`, `.cat:15538`) und deshalb Teil des Datensatzes.

> **Abgrenzung zu den Schwester-Szenarien.**
> [`equal-to-unit-inner-circle-markup`](../equal-to-unit-inner-circle-markup/README.md)
> und [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md)
> pinnen an derselben Einheit das **Schlüsselwort** `scope="unit"` — den
> nächsten Vorfahren mit `type="unit"` — und machen ihn über **Punktesummen**
> beobachtbar. Dieses Szenario pinnt den anderen Fall derselben Spalte: einen
> `scope`, der **kein Schlüsselwort** ist, sondern eine **Eintrags-Id**, und es
> macht ihn über **Merkmalswerte** beobachtbar.
> [`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md)
> behandelt den dritten Fall — eine **Kategorie**-Id im `scope`.

---

## Worum es geht

Zwei Stellen im Armeebuch tragen **denselben** Modifikator unter **derselben**
Bedingungs-Gruppe. Wörtlich aus `The Empire (6th definitive edition).cat`:

**(a) am Einheiten-Profil** (`.cat:1874-1886`, direkt unter
`selectionEntry id="1d77-9e6e-a6ab-573f"`, `.cat:1872`):

```xml
<infoLink id="b968-23a8-1f42-6af7" name="Elite" hidden="false"
          targetId="15ce-32a2-92e2-1279" type="profile">
  <modifiers>
    <modifier type="increment" value="1" field="b690-4bc0-bb73-267b">
      <conditionGroups>
        <conditionGroup type="or">
          <conditions>
            <condition type="atLeast" value="1" field="selections"
                       scope="1d77-9e6e-a6ab-573f" childId="6e1d-9e41-114f-8128"
                       shared="true" includeChildSelections="true"/>
            <condition type="atLeast" value="1" field="selections"
                       scope="1d77-9e6e-a6ab-573f" childId="8229-6f9b-ba74-c239"
                       shared="true" includeChildSelections="true"/>
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifier>
  </modifiers>
  …
</infoLink>
```

**(b) am Champion-Profil** (`.cat:2258-2272`), im Kommandogruppen-Upgrade
„First Knight" `4267-ee8f-ec8c-e0f9` (`.cat:2253`) — also einem **Enkel** der
Einheit (Einheit → `selectionEntryGroup "Command group"` `4f37-6971-14f9-79c8`
→ „First Knight"):

```xml
<infoLink name="Elite Champion" id="7310-540c-a461-d9e9" hidden="false"
          targetId="73cc-0129-e7fe-ea53" type="profile">
  <modifiers>
    <modifier type="set" value="First Knight" field="name"/>
    <modifier type="increment" value="1" field="b690-4bc0-bb73-267b">
      <conditionGroups>
        <conditionGroup type="or">
          <conditions>
            <condition … scope="1d77-9e6e-a6ab-573f" childId="6e1d-9e41-114f-8128" …/>
            <condition … scope="1d77-9e6e-a6ab-573f" childId="8229-6f9b-ba74-c239" …/>
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifier>
  </modifiers>
</infoLink>
```

Lesart der Attribute:

- **`field="b690-4bc0-bb73-267b"`** ist der `characteristicType` **S** des
  `profileType` „Profile" `a54a-7f00-29bf-12b1` der `.gst`
  ([§5.4](../../battlescribe/files/game-system.md#54-profile-types--characteristic-types)) —
  der Modifikator ändert einen **Merkmalswert**, keinen Constraint und keine
  Kosten.
- **`scope="1d77-9e6e-a6ab-573f"`** ist **kein** Schlüsselwort. Die Spezifikation
  zählt als Schlüsselwörter `parent | roster | force | category | self | unit |
  primary-catalogue` auf ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint))
  und nennt daneben ausdrücklich **„Vorfahren-Ids"** als zulässige `scope`-Werte
  ([Kasten `primary-catalogue`](../../battlescribe/building-blocks/constraint.md#scopeprimary-catalogue--das-armeebuch-kein-zählrahmen):
  „das Wiki zählt `parent|roster|force|primary category` **und Vorfahren-Ids**
  auf"). `1d77-9e6e-a6ab-573f` ist eine solche Id — die des `selectionEntry`
  „Knights of the Knightly Orders" (`type="unit"`, `.cat:1872`).
- **`childId="6e1d-9e41-114f-8128"`** ist der `entryLink` „Knights of the Inner
  Circle" (`.cat:2061`, Ziel `selectionEntry 2cbd-fee0-a336-0e5d`,
  `.cat:10519`), **`childId="8229-6f9b-ba74-c239"`** der Geschwister-Verweis
  „Knights of the Inner Circle (White Wolf)" (`.cat:2103`, `hidden="true"`).
  Beide sind **direkte Kinder** der Einheit; die `or`-Gruppe hält also, sobald
  die Einheit **eine** der beiden Aufwertungen trägt
  ([§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)).
- **`type="atLeast" value="1"`** ist eine Mindestschranke: gezählt ≥ 1 ⇒ hält.

Daraus folgt die Rechnung, deren Ausgangswerte in den beiden geteilten Profilen
stehen (`.cat:14597` bzw. `.cat:14614`):

| Profil | Id | Basis-S | S mit Inner Circle im Rahmen |
|--------|----|--------:|-----------------------------:|
| „Elite" (Einheit) | `15ce-32a2-92e2-1279` | **3** | **4** |
| „Elite Champion" (First Knight) | `73cc-0129-e7fe-ea53` | **3** | **4** |

### Wo die Bausteine im Katalog hängen

```
selectionEntry "Knights of the Knightly Orders" (1d77-9e6e-a6ab-573f, type="unit", Core 64bf-…)
 ├ infoLink "Elite" (b968-23a8-1f42-6af7 -> profile 15ce-32a2-92e2-1279, S 3)
 │    modifier increment 1 auf b690-… (S), or-Gruppe: atLeast 1 scope="1d77-…" childId=6e1d-…
 │                                                    atLeast 1 scope="1d77-…" childId=8229-…
 ├ selectionEntry "Knight" (7b8d-8405-0e74-9f46, type="model", 23 pts, min 5 / max -1)
 ├ selectionEntryGroup "Weapons and Armour" (f1bb-0dde-c39a-d0e1)
 │    Shield / Lance / Hand Weapon / Full Plate Armour  je min 1 / max 1, alle 0 pts
 │    "Cavalry hammer " (9a71-…, min 0, hidden)         — nicht gewaehlt
 ├ entryLink "Empire Warhorse" (aaf2-8dbc-b925-fac5, min 1 / max 1, 0 pts)
 ├ entryLink "Knights of the Inner Circle" (6e1d-9e41-114f-8128 -> 2cbd-fee0-a336-0e5d)
 │    increment 3 pts je Modell (repeat scope="parent" childId="model")
 │    constraint max 1 scope="parent" (5454-b1cf-abc3-042a); Ziel: max 1 scope="force" (abd1-…)
 ├ entryLink "Knights of the Inner Circle (White Wolf)" (8229-6f9b-ba74-c239, hidden="true")
 ├ selectionEntryGroup "Knightly Order" (06b5-8412-53d1-49ac)  — in keinem Roster benutzt
 └ selectionEntryGroup "Command group" (4f37-6971-14f9-79c8, keine eigenen constraints)
      ├ selectionEntry "Musician" (4c6f-0fe8-e65a-0ffc, 8 pts)          — nicht gewaehlt
      ├ selectionEntry "Standard Bearer" (7418-ab2a-143f-61e2, 16 pts)  — nicht gewaehlt
      └ selectionEntry "First Knight" (4267-ee8f-ec8c-e0f9, 16 pts, max 1 parent e6e2-…)
           └ infoLink "Elite Champion" (7310-540c-a461-d9e9 -> profile 73cc-…, S 3)
                modifier set name="First Knight" (unbedingt)
                modifier increment 1 auf b690-… (S), DIESELBE or-Gruppe wie oben
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **AIISC-R1** | **Ein `scope`, der keines der Schlüsselwörter ist, benennt einen Katalog-Eintrag und damit einen Zählrahmen aus dem Roster-Baum.** `1d77-9e6e-a6ab-573f` ist die `id` eines realen `selectionEntry` — nicht die einer Kategorie, eines Kontingents oder eines Katalogs. | `.cat:1872` (`<selectionEntry id="1d77-9e6e-a6ab-573f" … type="unit">`). Die Id kommt im gesamten Fixture-Datensatz nur an dieser Definition und in zehn `scope="1d77-…"`-Attributen vor (`.cat:1880`, `1881`, `2265`, `2266`, `2558`, `2563`, `12996`, `13127`, `13155`, `13183`) — nirgends als `categoryEntry`, `forceEntry` oder Katalog-Wurzel. Zur Abgrenzung dieser drei Fälle: [Kasten `primary-catalogue`](../../battlescribe/building-blocks/constraint.md#scopeprimary-catalogue--das-armeebuch-kein-zählrahmen), [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat) (`forceEntry`-Kodierungen). |
| **AIISC-R2** | **Der Rahmen ist die nächste umschließende Auswahl, die auf diese Id auflöst — den Träger eingeschlossen.** Am Einheiten-`infoLink` ist das die Einheit selbst; am Champion-`infoLink` ein **Vorfahre** (Träger → „Command group" → Einheit). | Dieselbe Bedingung steht an beiden Orten byte-gleich: `.cat:1880-1881` (Träger = `infoLink` **der Einheit**) und `.cat:2265-2266` (Träger = `infoLink` im **Enkel** `4267-ee8f-ec8c-e0f9`). Eine Lesart „nur der Träger" (wie `self`) ließe (b) nie greifen und machte die zweite Fundstelle sinnlos; eine Lesart „nur echte Vorfahren" ließe (a) nie greifen. Nur die trägerinklusive Vorfahrenkette erklärt **beide**. Dieselbe Konvention beschreibt die Spezifikation für das Schlüsselwort `unit`: „der nächste **Vorfahre** — den Träger der Query **eingeschlossen**" ([Kasten](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)). Roster 01 (beide auf 4) ↔ Roster 02 (beide auf 3). |
| **AIISC-R3** | **Eine Eintrags-Id im `scope` und das Schlüsselwort `unit` benennen an dieser Katalogstelle denselben Rahmen.** Der Datensatz schreibt dieselbe Frage nebeneinander in beiden Schreibweisen. | `sharedSelectionEntryGroup "Knightly Orders (CJ#43)"` `d454-fa90-afa7-fa48` (`.cat:12956`): der `entryLink` „Reiksguard Knights" `07a9-8f33-4435-2a18` (`.cat:12989`) gattet seinen 5-pts-Zweig mit `equalTo 0 … scope="1d77-9e6e-a6ab-573f" childId="6e1d-9e41-114f-8128"` (`.cat:12996`) und seinen 7-pts-Zweig mit `equalTo 1 … scope="unit" childId="6e1d-9e41-114f-8128"` (`.cat:13004`) — dieselbe Frage, zwei Schreibweisen, sonst strukturgleich. Der Geschwister-Link „Knights of the Blazing Sun" `f711-222f-99ff-5e01` (`.cat:12961`) schreibt beide Zweige mit `scope="unit"` (`.cat:12968`, `12976`). Die Einheit `1d77-…` ist der einzige `type="unit"`-Vorfahre dieser Verweise. |
| **AIISC-R4** | **Der Rahmen ist *eine* Instanz, nicht die Menge aller Instanzen dieses Eintrags und nicht das Kontingent.** Stehen zwei Ritterregimenter im selben Kontingent und trägt nur das eine den Inner Circle, bleibt der Champion des **anderen** auf S 3. | „Vorfahre" ist eine Eigenschaft der **Instanz** im Roster-Baum, nicht der Definition; `shared="true"` weitet einen so bestimmten Rahmen nicht ([Kasten `scope="unit"`/`ancestor`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette): die Zähl-Flags sind für einen Vorfahren-Rahmen ohne Wirkung — „eine Vorfahrenkette wird durch eine Instanz nicht enger"; ebenso [§3.4](../../battlescribe/overview.md#34-kontext-threading)). Roster 03 macht den Unterschied messbar: S 3 statt 4. |
| **AIISC-R5** | **Eine zweite, aufwertungslose Instanz derselben Einheit unterdrückt den Modifikator nicht.** Trägt das Regiment mit dem Champion selbst den Inner Circle, steht sein S auf 4 — unabhängig davon, dass ein zweites Regiment desselben Eintrags im Kontingent ohne Aufwertung steht. | Gegenprobe zu AIISC-R4 aus derselben Rahmen-Regel: eine `atLeast`-Bedingung im Instanz-Rahmen kennt nur die eigene Kette. Roster 04. |
| **AIISC-R6** | **Der `increment` trifft ausschließlich `S`.** WS bleibt 4, A bleibt 1 (Einheit) bzw. 2 (Champion) — auch dort, wo S auf 4 steht. | `field="b690-4bc0-bb73-267b"` benennt genau eine Spalte; die übrigen `characteristic`-Werte der Profile `15ce-32a2-92e2-1279` (`.cat:14597-14612`) und `73cc-0129-e7fe-ea53` (`.cat:14614-14629`) sind unangetastet. Kein weiterer Modifikator im Armeebuch adressiert `b690-…` an diesen beiden `infoLink`s (die übrigen Fundstellen `.cat:2804`, `2935`, `7933`, `8039` hängen an **anderen** Einheiten und deren eigenen `infoLink`s). |
| **AIISC-R7** | **Der Name des Champion-Profils ist unbedingt „First Knight".** Der `set`-Modifikator davor trägt **keine** `conditions`/`conditionGroups`. | `.cat:2260` (`<modifier type="set" value="First Knight" field="name"/>`, ohne Bedingungsblock). Deshalb ist er in allen vier Rostern zugesichert — er dient zugleich als Sonde dafür, dass die Modifikator-Kette dieses `infoLink`s überhaupt ausgeführt wird. |
| **AIISC-R8** | **Die `or`-Gruppe hält auch über den zweiten, verborgenen Verweis.** Für die vier Roster ist das ohne Wirkung, weil `8229-…` in keinem gewählt ist — festgehalten wird es, damit die Zusage „S 3" der Roster 02/03 nicht versehentlich einen zweiten Weg offenlässt. | `.cat:1881` / `.cat:2266` (`childId="8229-6f9b-ba74-c239"`); der Verweis selbst `.cat:2103` (`hidden="true"`, aufgedeckt nur bei gewähltem Orden „Knights of the White Wolf" `9f9b-5a33-9c07-93e6`, `.cat:2110-2114`). In keinem Roster steht ein Knightly Order. |
| **AIISC-R9** | **Die Ritterzahl ist nach unten auf 5 gebunden, nach oben unbegrenzt;** jedes Regiment führt deshalb genau 5 Modelle, ohne dass eine Grenze feuert. | `selectionEntry "Knight"` `7b8d-8405-0e74-9f46` (`.cat:2029`) → `24bb-871e-6aa3-e4b5` (`min 5 scope="parent" shared="false"`, `.cat:2031`) und `9941-5a64-0bde-add3` (`max -1`, `.cat:2032`; `-1` = unbegrenzt, [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) Sentinel-Kasten — der einzige `set 25` hängt an „Border Patrols rules" `4e15-0353-165f-5528`, die in keinem Roster steht). |
| **AIISC-R10** | **Die Pflichtausrüstung der Einheit ist Shield, Lance, Hand Weapon, Full Plate Armour und Empire Warhorse (je `min 1`/`max 1`), alle 0 pts;** die „Cavalry hammer "-Option ist `min 0` und bleibt außen vor. Deshalb trägt jedes Regiment genau diese fünf Auswahlen. | Gruppe „Weapons and Armour" `f1bb-0dde-c39a-d0e1` (`.cat:2282-2390`) → Links `9ccc-ad24-583e-41e0` (`min 1e3a-4402-70e8-2b08`), `e082-13b2-e746-34e0` (`min f0ce-7b2e-0be1-9dd1`), `d2a3-c146-1dbb-118f` (`min 50ac-f86f-cfa1-d050`), `8757-aa59-69fa-1060` (`min 8d09-7d84-af64-cb83`), `9a71-cb61-06fb-005a` (`min f78b-9ad2-c515-7c0a` = 0, `hidden="true"`); dazu `entryLink` „Empire Warhorse" `aaf2-8dbc-b925-fac5` (`min 22cd-67c5-1c2c-2266`, `.cat:2052-2056`). Die beiden `set 0` auf `1e3a-…`/`f0ce-…` sind an das Kontingent `d2eb-6fe3-7349-f03d` bzw. an „Knights of the White Wolf" gebunden und greifen nicht. |
| **AIISC-R11** | **Die force-skopierte Obergrenze der Einheit ist im Standard-Kontingent aufgehoben,** sodass **zwei** Regimenter derselben Einheit legal nebeneinander stehen. Roh steht `max 0`; ein `set -1` hebt sie für jedes Kontingent auf, das **nicht** „Emperor's Guard (EM-AB)" ist. | `selectionEntry 1d77-…` → constraint **`2943-aa1c-4532-4fb2`** (`type="max" value="0" field="selections" scope="force"`, `.cat:2393`) → `modifier type="set" value="-1"` mit `condition type="notInstanceOf" scope="force" childId="9d76-5d25-ce1d-1d12"` (`.cat:2130-2134`). Die Roster nutzen „Standard (EM-AB)" `e821-88b8-2071-6b6a` ≠ `9d76-…`. |
| **AIISC-R12** | **Höchstens ein Inner Circle je Kontingent** — deshalb tragen die Roster 03/04 die Aufwertung nur in **einem** der beiden Regimenter, und `abd1-…` bleibt still. | Ziel `2cbd-fee0-a336-0e5d` → `abd1-90ab-2b66-ecff` (`max 1 field="selections" scope="force" includeChildSelections="true" includeChildForces="true"`, `.cat:10521`); Verweis `6e1d-…` → `5454-b1cf-abc3-042a` (`max 1 scope="parent"`, `.cat:2097`). |
| **AIISC-R13** | **Die Einheit ist im Standard-Kontingent sichtbar, der „First Knight" trägt gar kein `hidden`-Gatter.** | Der `set hidden="true"` der Einheit (`.cat:2144-2153`) ist an die Kontingente `d1ca-0d07-b9d2-0ff1` / `d2eb-6fe3-7349-f03d` gebunden — beide ≠ `e821-…`. `4267-ee8f-ec8c-e0f9` (`.cat:2253`) hat `hidden="false"` und keinen `hidden`-Modifikator. |
| **AIISC-R14** | **Beobachtbar wird die Regel über die Merkmals-Projektion der Slots,** nicht über den Verletzungsbericht: der Modifikator ändert einen Profilwert, keine zählende Grenze. | Manifest-Vertrag: `expect.capabilities[].infoElements[].characteristics`; als Vorlage das Szenario [`set-characteristic-force-gate`](../set-characteristic-force-gate/README.md). Die `id` eines Info-Elements ist die des **Verweises** (`b968-…`, `7310-…`), denn dort erscheint das bezogene Profil ([§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link)). |

---

## Die Merkmals-Arithmetik je Roster

Basis sind die geteilten Profile; der einzige wirksame Modifikator ist der
`increment 1` auf S.

| Zelle | Basis | 01 | 02 | 03 | 04 |
|-------|------:|---:|---:|---:|---:|
| Regiment A trägt Inner Circle? | — | ja | nein | **ja** | **ja** |
| Regiment B im selben Kontingent? | — | — | — | ja (ohne IC) | ja (ohne IC) |
| „First Knight" steht in Regiment … | — | A | A | **B** | **A** |
| Einheiten-Profil `15ce-…`, **S** | 3 | **4** | **3** | *(nicht behauptet)* | *(nicht behauptet)* |
| Champion-Profil `73cc-…`, **S** | 3 | **4** | **3** | **3** | **4** |
| Champion-Profil `73cc-…`, WS / A | 4 / 2 | 4 / 2 | 4 / 2 | 4 / 2 | 4 / 2 |

Punktesummen (nur zur Einordnung, **nicht** Gegenstand einer Zusage; Ritter
23 pts, „First Knight" 16 pts, Inner Circle 0 pts + `increment 3` je Modell im
`parent`-Rahmen, alles übrige 0 pts): 146 / 131 / 261 / 261. Das
`<costLimits>` steht in allen vier Rostern auf 2000, damit die roster-weite
Budget-Regel schweigt.

### Warum die Zusagen scharf sind

| Fehlauswertung der Engine | Wirkung auf S | Ergebnis |
|---------------------------|---------------|----------|
| `scope="<Eintrags-Id>"` unaufgelöst, fail-closed | 3 überall | Roster 01 und 04 weichen ab → Fall bricht (zusätzlich verlangt `diagnostics.absent` das Ausbleiben von `UNRESOLVED_SCOPE` mit `scope="1d77-9e6e-a6ab-573f"`) |
| Rahmen wie `self` gelesen (nur der Träger) | Champion überall 3 | Roster 01 und 04 weichen ab → Fall bricht |
| Rahmen wie `force` gelesen | Champion in Roster 03 auf 4 | Roster 03 weicht ab → Fall bricht |
| Rahmen wie `roster` gelesen | Champion in Roster 03 auf 4 | Roster 03 weicht ab → Fall bricht |
| Rahmen als „alle Instanzen dieses Eintrags" gelesen (`shared="true"` als Instanz-Vereinigung) | Champion in Roster 03 auf 4 | Roster 03 weicht ab → Fall bricht |
| Bedingung als „alle Instanzen müssen tragen" gelesen | Champion in Roster 04 auf 3 | Roster 04 weicht ab → Fall bricht |
| `or`-Gruppe als `and` gelesen | 3 überall (nur `6e1d-…` ist je gewählt) | Roster 01 und 04 weichen ab → Fall bricht |
| `increment` auf das falsche Merkmal angewandt | WS oder A ≠ Basis | jede Roster-Zusage nennt WS und A mit → Fall bricht |
| Modifikator-Kette des `infoLink`s gar nicht ausgeführt | Profilname bleibt „Elite Champion" | AIISC-R7 (`name: "First Knight"`) → Fall bricht |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen
gegen **denselben** Datensatz (`.gst` + The-Empire-`.cat` + Mercenaries-`.cat`)
und dasselbe Kontingent „Standard (EM-AB)". Regimentsgröße (5 Ritter) und
Pflichtausrüstung sind überall identisch; variiert wird **nur**, welches
Regiment den Inner Circle und welches den „First Knight" trägt.

> **Assertion-Fokus:** die Merkmalswerte der beiden Profil-Vorkommen
> (`b968-23a8-1f42-6af7` am Einheiten-Slot, `7310-540c-a461-d9e9` am
> Champion-Slot) mit **S** als geprüfter Zelle und **WS**/**A** als
> Kontrollzellen, dazu der unbedingte Profilname „First Knight", die
> Abwesenheit der berührten Katalog-Grenzen und das Ausbleiben von
> `UNRESOLVED_SCOPE` für `scope="1d77-9e6e-a6ab-573f"`. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht der `.gst`, Kategorie-Slots)
> dürfen zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | **Beide Stellen greifen:** eine Einheit mit Inner Circle | 1 Regiment: 5 Ritter, Pflichtausrüstung, „First Knight", „Knights of the Inner Circle". | Einheiten-Profil `b968-…`: **S 4** (WS 4, A 1). Champion-Profil `7310-…`: **S 4** (WS 4, A 2), Name „First Knight" (AIISC-R2/R6/R7). Keine der gelisteten Grenzen feuert. | [`01-single-unit-with-inner-circle-s4.ros`](rosters/01-single-unit-with-inner-circle-s4.ros) |
| 02 | **Kontrolle:** dieselbe Einheit ohne Inner Circle | Wie 01, ohne die Aufwertung. | Beide Profile stehen auf ihrem **Basis-S 3**; WS/A unverändert. Der Kontrast zu 01 isoliert genau den `increment` (AIISC-R2). | [`02-single-unit-without-inner-circle-s3.ros`](rosters/02-single-unit-without-inner-circle-s3.ros) |
| 03 | **Rahmen-Beweis:** Champion in der Einheit **ohne** Inner Circle | Zwei Regimenter in **einem** Kontingent. A: 5 Ritter + Inner Circle, **kein** Champion. B: 5 Ritter + „First Knight", **kein** Inner Circle. | Champion-Profil `7310-…`: **S 3** (AIISC-R4). Ein kontingent- oder rosterweiter Rahmen ergäbe 4. Über die beiden Einheiten-Profile wird nichts behauptet (siehe Lücke unten). | [`03-two-units-champion-in-unit-without-inner-circle.ros`](rosters/03-two-units-champion-in-unit-without-inner-circle.ros) |
| 04 | **Gegenprobe:** Champion in der Einheit **mit** Inner Circle | Dieselbe Besetzung, getauscht. A: 5 Ritter + Inner Circle + „First Knight". B: 5 Ritter, sonst nichts. | Champion-Profil `7310-…`: **S 4** (AIISC-R5). Die aufwertungslose Zweit-Instanz desselben Eintrags unterdrückt den `increment` nicht. | [`04-two-units-champion-in-unit-with-inner-circle.ros`](rosters/04-two-units-champion-in-unit-with-inner-circle.ros) |

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|------------------------|
| **Der Merkmals-Modifikator selbst.** | Profilwerte sind keine zählenden Grenzen; der Verletzungsbericht kodiert Grenzen (gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). Beobachtet wird deshalb über `expect.capabilities[].infoElements[].characteristics` (AIISC-R14), nicht über `firing`. |
| **Der effektive *Name* des Einheiten-Profils** `b968-…` („Elite" → „Knight", sobald kein Knightly Order gewählt ist). | Er hängt an einem `modifierGroup` „Rename :)" mit `scope="self"`-Bedingungen (`.cat:1887-2022`, u. a. `lessThan 1 … childId="06b5-8412-53d1-49ac"`) — eine **andere** Rahmen-Frage als die hier geprüfte. Das Szenario behauptet über sie bewusst nichts, damit ein Fehlschlag eindeutig dem Eintrags-Id-Rahmen zuzuordnen bleibt. Beim Champion-Profil ist der Name dagegen **unbedingt** gesetzt (AIISC-R7) und wird zugesichert. |
| **Sichtbarkeit.** Der Geschwister-Verweis `8229-…` ist `hidden="true"`, die Einheit trägt kontingentgebundene `hidden`-Gatter. | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke. Zugesichert wird nur der Slot-Stand `isHidden: false` für Einheit und Champion im Kontingent „Standard (EM-AB)" (AIISC-R13). |
| **Punktekosten** (Ritter 23, „First Knight" 16, Inner Circle `increment 3` je Modell). | Sie sind an den Schwester-Szenarien [`equal-to-unit-inner-circle-markup`](../equal-to-unit-inner-circle-markup/README.md) und [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md) bereits über die Budget-Regel gepinnt. Hier steht das `<costLimits>` bewusst großzügig auf 2000, damit `budget::ecfa-8486-4f6c-c249` schweigt und die Merkmals-Zusage allein steht. |
| **Laufzeit-Kategoriewechsel** der Einheit (`add`/`remove`/`set-primary category` ab `.cat:2395`). | Alle Klammern sind an andere Kontingente gebunden (`c6c6-3b29-466d-5ac0`, `fb55-f061-f6d9-9f27`, `802e-a5b7-4570-1e7e`) und greifen unter „Standard (EM-AB)" nicht; Kategorie-Slots gehören ohnehin zum Nebengeräusch. |
| **Autor-Meldung** am Constraint `2943-aa1c-4532-4fb2` („You must have at least one unit of Reiksguard for every unit of other Knights …"). | Die Grenze ist per `set -1` aufgehoben (AIISC-R11); über das Erscheinen oder Ausbleiben ihrer Meldung wird nichts behauptet. |

### Eine bewusst offen gelassene Zelle (Lücke, kein Befund über die Engine)

In den Rostern 03/04 stehen **zwei** Slots mit derselben Definitions-Id
`1d77-9e6e-a6ab-573f` nebeneinander. Der Manifest-Vertrag trennt solche Slots
über `path` („nur nötig, wenn dieselbe Definition mehrfach im Roster steht"),
gibt aber keine aus den Katalogdaten ableitbare Bildungsregel für diesen
Slot-Pfad an — und kein bestehendes Szenario nutzt das Feld. Deshalb behaupten
die Roster 03/04 über die **Einheiten**-Profile nichts; der Eintrags-Id-Rahmen
wird dort ausschließlich am **Champion**-Slot geprüft, der eindeutig bleibt,
weil in jedem der beiden Roster genau **ein** „First Knight" gewählt ist (die
nicht gewählte Stelle im anderen Regiment wäre höchstens ein Angebots-Anker —
darum ist jeder Slot-Selektor zusätzlich auf `anchorKind: "occupied"`
eingeschränkt). Da der Champion-Fall den **tieferen** der beiden Fälle prüft
(Rahmen = Vorfahre statt Träger) und beide Fundstellen dieselbe
Bedingungs-Gruppe byte-gleich tragen (AIISC-R2), bleibt die Herleitung
vollständig; die Einheiten-Profile sind in den Rostern 01/02 einzeln gepinnt.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **The Empire** / **Mercenaries** | `3938-8369-a300-4a03` / `fc47-8392-a6c8-452a` |
| `catalogueLink` The Empire → Mercenaries | `7773-ecbb-5fb9-eb56` |
| ForceEntry „Standard (EM-AB)" (benutzt) | `e821-88b8-2071-6b6a` |
| ForceEntry „Emperor's Guard (EM-AB)" (Bedingung des `set -1`, **nicht** benutzt) | `9d76-5d25-ce1d-1d12` |
| **SelectionEntry Einheit „Knights of the Knightly Orders" — zugleich der `scope`-Wert der geprüften Bedingungen** | **`1d77-9e6e-a6ab-573f`** — constraint `2943-aa1c-4532-4fb2` (`max 0 scope="force"` → per `set -1` aufgehoben) |
| **`infoLink` „Elite" an der Einheit → geteiltes Profil (Basis S 3)** | **`b968-23a8-1f42-6af7`** → `15ce-32a2-92e2-1279` |
| SelectionEntryGroup „Command group" (ohne eigene Constraints) | `4f37-6971-14f9-79c8` |
| **SelectionEntry „First Knight" (16 pts)** | **`4267-ee8f-ec8c-e0f9`** — constraint `e6e2-1254-e3fb-a17b` (`max 1 scope="parent"`) |
| **`infoLink` „Elite Champion" am First Knight → geteiltes Profil (Basis S 3)** | **`7310-540c-a461-d9e9`** → `73cc-0129-e7fe-ea53` |
| `characteristicType` **S** / **WS** / **A** (`.gst`, profileType `a54a-7f00-29bf-12b1`) | `b690-4bc0-bb73-267b` / `f95b-da01-0578-3bdc` / `6b9f-c8fe-8998-27e3` |
| **`entryLink` „Knights of the Inner Circle" (erstes gezähltes `childId`)** | **`6e1d-9e41-114f-8128`** → Ziel `2cbd-fee0-a336-0e5d` — constraints `5454-b1cf-abc3-042a` (`max 1 scope="parent"`), `abd1-90ab-2b66-ecff` (`max 1 scope="force"`, am Ziel) |
| `entryLink` „Knights of the Inner Circle (White Wolf)" (zweites gezähltes `childId`, `hidden="true"`, **nicht** gewählt) | `8229-6f9b-ba74-c239` → Ziel `12c2-2826-c92f-4930` — constraint `ad1b-51cb-9726-034e` |
| „Knights of the White Wolf" (Aufdeck-Bedingung von `8229-…`; in **keinem** Roster gewählt) | `9f9b-5a33-9c07-93e6` |
| SelectionEntry Modell „Knight" (23 pts) | `7b8d-8405-0e74-9f46` — constraints `24bb-871e-6aa3-e4b5` (`min 5`), `9941-5a64-0bde-add3` (`max -1`) |
| Gruppe „Weapons and Armour" | `f1bb-0dde-c39a-d0e1` |
| `entryLinks` Shield / Lance / Hand Weapon / Full Plate Armour (je `min 1`/`max 1`, alle 0 pts) | `9ccc-ad24-583e-41e0`→`50e2-1873-a856-03e7` (`1e3a-4402-70e8-2b08` / `58c4-d930-895a-0b74`), `e082-13b2-e746-34e0`→`8649-8ac8-5a6f-fd8d` (`f0ce-7b2e-0be1-9dd1` / `128a-6411-f218-72fc`), `d2a3-c146-1dbb-118f`→`abdb-bbd0-41b2-5dff` (`50ac-f86f-cfa1-d050` / `9368-e62e-157c-023e`), `8757-aa59-69fa-1060`→`199f-b4b9-aaca-490f` (`8d09-7d84-af64-cb83` / `e635-0971-2920-856c`, am Ziel `e369-888c-81f7-bf21`) |
| `entryLink` „Cavalry hammer " (`min 0`, `hidden="true"`; nicht gewählt) | `9a71-cb61-06fb-005a` — constraint `f78b-9ad2-c515-7c0a` |
| `entryLink` „Empire Warhorse" (`min 1`/`max 1`, 0 pts) → Ziel | `aaf2-8dbc-b925-fac5` (`22cd-67c5-1c2c-2266` / `ae52-6868-5949-892c`) → `a1e3-7f97-5fc6-abaa` (`0cda-8c44-bc6f-1e6a`) |
| Gruppe „Knightly Order" (in **keinem** Roster besetzt) | `06b5-8412-53d1-49ac` — constraints `7944-27db-49ec-7bbd` (`max 1 scope="self"`), `21ca-c541-0b3d-6d4d` (`min 0 scope="parent"`) |
| Korroboration `scope="1d77-…"` ↔ `scope="unit"`: geteilte Gruppe „Knightly Orders (CJ#43)" mit den Verweisen „Reiksguard Knights" / „Knights of the Blazing Sun" | `d454-fa90-afa7-fa48` → `07a9-8f33-4435-2a18` / `f711-222f-99ff-5e01` |
| „Border Patrols rules" (`set 25` auf die Ritter-Obergrenze; in **keinem** Roster enthalten) | `4e15-0353-165f-5528` |
| pts-Kostenart (`.gst`; nur zur Einordnung, keine Zusage) | `ecfa-8486-4f6c-c249` |

*(`UNRESOLVED_SCOPE` ist kein Katalog-Baustein, sondern ein Schlüssel des
Manifest-Vertrags — die `absent`-Aussage ist hier bewusst auf
`scope="1d77-9e6e-a6ab-573f"` eingeschränkt, damit sie nicht über einen
unabhängigen, offen gebliebenen Rahmen desselben Datensatzes fällt.)*
