# E2E-Regeln & Testkatalog: „Border Patrols rules" — Sichtbarkeits-Gatter bei exakt 500 Punkten und die Einheitenzahl-Klammer (2–4)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind
ausschließlich aus den Katalogdaten der *6th Definitive Edition* und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.6/§7.7/§8) abgeleitet; die Roster-Form ist an den bereits verifizierten
Szenarien nachgebildet (direktes `entryId`, `entryLinkId=""`, verschachtelte
`selections` mit `number`, `costLimits` mit `typeId` — siehe
[`../at-least-roster-border-patrols-gate/`](../at-least-roster-border-patrols-gate/README.md)
und [`../entrylink-raw-type-counting/`](../entrylink-raw-type-counting/README.md)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`,
  rev 1) — Kontingent **„Standard (VC-AB)"** `e989-15b8-7eb6-9668` (Z. 29297)
- Zusatz: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`), von
  Vampire Counts per `catalogueLink` `ef73-f9bd-e250-54d2` eingebunden.

> **Warum dieses Armeebuch?** Gebraucht wird ein Kontingent, in dem sich **1, 2, 4
> und 5** Einheiten unter 500 Punkten bauen lassen, ohne dass eine andere Grenze
> dazwischenfunkt. Vampire Counts liefert mit **„Skeletons"**
> (`9ac2-f4c1-bcc3-3aee`, `type="unit"`, primär *Core*) genau eine solche
> Bauform: Mindestbesetzung 10 Modelle à 8 pts plus eine Pflicht-Handweapon zu
> 0 pts ⇒ **80 pts je Einheit**, also 80/160/320/400 pts für die vier Größen —
> alle unterhalb jedes der drei getesteten Budgets. Entscheidend ist zweitens,
> dass **dieselbe** Einheit sich bei 10+ Modellen selbst die Kategorie
> *BP Infantry 10+* verleiht (VC-`.cat` Z. 401–411); damit lässt sich die zweite
> Autor-Meldung des Eintrags in **allen** Rostern konstant stillhalten, statt sie
> als Dauerrauschen mitzuschleppen. Drittens trägt die `.gst`-Kategorie *Core*
> **nur** eine `min`-, **keine** `max`-Grenze (Z. 372–375), und das Kontingent
> „Standard (VC-AB)" hängt an **keinen** seiner `categoryLinks` eigene
> Constraints (Z. 29298–29310) — fünf Core-Einheiten reißen also keine
> Kategorie-Obergrenze. Ein Armeebuch mit einer Core-Obergrenze hätte den
> `greaterThan`-Fall mit einer fremden feuernden Grenze verunreinigt.

---

## Die drei Konstrukte am Eintrag (`.gst` Z. 17584–17617)

```xml
<selectionEntry type="upgrade" import="true" name="Border Patrols rules"
                hidden="true" id="4e15-0353-165f-5528" defaultAmount="1">
  <constraints>
    <constraint type="max" value="1" field="selections" scope="parent" shared="true"
                id="fbfc-d43f-396d-09cc" includeChildSelections="false"/>
  </constraints>
  <categoryLinks>
    <categoryLink name="Special list rules" id="fd54-fb51-2021-d3cd"
                  targetId="32f1-197f-d719-a393" primary="true"/>
  </categoryLinks>
  <modifiers>
    <modifier type="set" value="false" field="hidden">                       <!-- (1) -->
      <conditions>
        <condition type="equalTo" value="500" field="limit::ecfa-8486-4f6c-c249"
                   scope="roster" childId="any" shared="true"
                   includeChildSelections="true" includeChildForces="true"/>
      </conditions>
    </modifier>
    <modifier type="add" field="error"                                        <!-- (2)/(3) -->
              value="The army must consist of at least TWO units but no more than FOUR units">
      <conditionGroups><conditionGroup type="or"><conditions>
        <condition type="greaterThan" value="4" field="selections" scope="force"
                   childId="unit" shared="true" includeChildSelections="false" childName="unit"/>
        <condition type="lessThan"    value="2" field="selections" scope="force"
                   childId="unit" shared="true" includeChildSelections="false" childName="unit"/>
      </conditions></conditionGroup></conditionGroups>
    </modifier>
    <modifier type="add" field="error"
              value="You must include at least ONE infantry unit of 10+ models.">
      <conditions>
        <condition type="lessThan" value="1" field="selections" scope="force"
                   childId="6ad6-f54e-1867-00a7" shared="true"
                   includeChildSelections="true" childName="BP Infantry 10+"/>
      </conditions>
    </modifier>
  </modifiers>
</selectionEntry>
```

### Wie die Formatreferenz diese Teile liest

- **`equalTo` auf `limit::<costTypeId>`** — `field="limit::ecfa-8486-4f6c-c249"`
  ist laut §7.7/§13.2 das **eingestellte Kostenlimit (Budget)** der Roster, nicht
  die verplante Summe. `scope="roster"` + `includeChildForces="true"` spannt den
  Rahmen über das ganze Roster; `childId="any"` benennt kein Zählziel, weil bei
  einem Budget nichts zu zählen ist. `equalTo` ist ein **strenger Gleichheits**-
  Vergleich: 500 trifft, 499 und 501 treffen nicht — das trennt ihn zugleich von
  `atMost 500` (hielte bei 499) und von `atLeast 500` (hielte bei 501).
- **`set` auf `field="hidden"`** — §7.7/§8: der `value` **ersetzt** den Feldwert.
  Hält die Bedingung, trägt der Eintrag exakt `false`; hält sie nicht, bleibt der
  **Basiswert** aus dem `hidden`-Attribut, hier `true`.
- **`childId="unit"` ist ein Typ-Schlüsselwort, kein Id-Verweis** — §7.7 und
  §13.2: `childId` ist „eine Ziel-ID, ein Typ-Keyword (`model`/`unit`/`upgrade`)
  oder `any`". Gezählt werden also die Auswahlen, deren (transitiv aufgelöster)
  **roher `type`** `unit` ist. In den hier gebauten Rostern sind das genau die
  Skeletons-Auswahlen (`type="unit"`); „Border Patrols rules" selbst ist
  `type="upgrade"` und zählt **nicht** mit, ebensowenig die Modelle
  (`type="model"`) und die Handweapon (`type="upgrade"`) unterhalb der Einheiten.
- **`includeChildSelections="false"` — unsere Lesart** — §7.6: `false` zählt
  *„just `scope`'s `field`"*, also **eingeschränkt, nicht leer**. Auf
  `scope="force"` bezogen heißt das: gezählt werden die **direkten** Auswahlen
  des Kontingents, nicht die darunter verschachtelten. Eine Auswahl vom Rohtyp
  `unit`, die **unterhalb einer anderen Auswahl** hinge (etwa eine Einheit als
  Kind einer Einheit), zählte damit **nicht** mit; die Klammer „2 bis 4" meint
  also die Wurzel-Einheiten des Kontingents. Beobachtbar ist dieser Unterschied
  in diesem Szenario **nicht** — die Roster enthalten unterhalb der Einheiten
  ausschließlich `model`/`upgrade`-Auswahlen, so dass beide Lesarten dieselbe
  Zahl ergeben (siehe „Bewusst ausgelassene Facetten").
- **`shared="true"`** — §7.6/§7.7: über **alle** Instanzen im Rahmen gezählt.
- **`conditionGroup type="or"`** — §7.7: hält, wenn **mindestens ein** Mitglied
  hält. Die Meldung erscheint also bei „zu viele" **oder** „zu wenige"; bei
  2, 3 und 4 Einheiten hält keines von beiden.
- **`modifier type="add" field="error"`** — §7.7: kein Wert-Modifikator, sondern
  ein Klartext-Hinweis an den Spieler; `value` ist der Wortlaut, `error` der
  Schweregrad. Er wird **unverändert in Katalogsprache** übernommen (keine
  Übersetzung, kein Umformulieren) — der zweite Text endet mit einem Punkt, der
  erste nicht.

### Warum der Eintrag gewählt (und nicht bloß angeboten) sein muss

Das Nachbarszenario [`violation-classification`](../violation-classification/scenario.json)
pinnt in Roster 07 ausdrücklich: „ein **Angebots-Anker** (`offerAnchor`) trägt
zwar seine Autor-Meldungen im Fähigkeits-Datensatz, steuert aber **NICHTS** zur
Meldungsliste bei" — dort steht die Autor-Meldung des nur angebotenen
„Manbiters" mit `count: 0` in `expect.messages`. Da dieses Szenario seine
Kernaussagen über `expect.messages` (`origin: "authorMessage"`) trifft, ist
„Border Patrols rules" in **jedem** Roster tatsächlich **gewählt** — eine
Wurzel-Auswahl mit `number="1"` (Anker `occupied`), genauso wie im Szenario
`at-least-roster-border-patrols-gate`.

### Warum der Eintrag im Kontingent überhaupt erreichbar ist

Er ist ein **Wurzel-`selectionEntry` der `.gst`** und trägt als primäre
Kategorie *Special list rules* (`32f1-197f-d719-a393`, Link `fd54-fb51-2021-d3cd`).
Das Kontingent „Standard (VC-AB)" führt genau diese Kategorie in seinen
`categoryLinks` (`950e-cea9-64a9-25a1` → `32f1-197f-d719-a393`, VC-`.cat`
Z. 29300) — der Eintrag gehört also in diese Force. Die bereits verifizierten
Roster von `at-least-roster-border-patrols-gate` und
`entrylink-raw-type-counting` setzen ihn auf demselben Weg.

### Was `6ad6-f54e-1867-00a7` ist

Eine **`categoryEntry`** der `.gst`: `<categoryEntry name="BP Infantry 10+"
id="6ad6-f54e-1867-00a7" hidden="true"/>` (Z. 796) — **kein** Eintrag, sondern
eine versteckte Tag-Kategorie **ohne eigene Constraints**. Vergeben wird sie
**zur Laufzeit** per `modifier type="add" field="category"` an den Einheiten
(§8, „Laufzeit-dynamische Kategoriezugehörigkeit"): bei den VC-Skeletons
(VC-`.cat` Z. 401–411) unter der `and`-Gruppe „`atLeast 10` Auswahlen vom
Rohtyp `model` in `scope="self"`" **und** „`atLeast 1` Auswahl
`4e15-0353-165f-5528` im Roster". Jede Skeletons-Einheit dieses Szenarios führt
**10** Modelle und „Border Patrols rules" liegt im Roster — die Kategorie ist
damit in **allen sechs** Rostern vergeben, die zugehörige Bedingung `lessThan 1`
hält nie, und die Meldung „You must include at least ONE infantry unit of 10+
models." ist **überall** als abwesend (`count: 0`) gepinnt. Sie verunreinigt
damit keine andere Aussage.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **BPU-R1** | **Sichtbarkeit kippt bei exakt 500:** Bei einem eingestellten Punktebudget von **genau 500** hält die einzige Bedingung des `set hidden=false`-Modifikators; der besetzte Slot meldet `isHidden` **false**. | `.gst` Z. 17584 (`selectionEntry` `4e15-0353-165f-5528`, Basis `hidden="true"`) → Z. 17595–17599: `<modifier type="set" value="false" field="hidden">` mit `<condition type="equalTo" value="500" field="limit::ecfa-8486-4f6c-c249" scope="roster" childId="any" shared="true" includeChildSelections="true" includeChildForces="true"/>`. Kostenart Punkte: `.gst` `costType` `ecfa-8486-4f6c-c249`. |
| **BPU-R2** | **Ein Punkt daneben genügt:** Bei **499** und bei **501** hält `equalTo` nicht, der `set` greift nicht, und der Eintrag behält seinen Basiswert — `isHidden` **true**, obwohl er im Roster steht. Damit ist `equalTo` beidseitig von `atMost`/`atLeast` getrennt. | Dieselben Zeilen wie BPU-R1; §7.7 (strenger Gleichheitsvergleich) und §7.7/§8 (`set` ersetzt, sonst gilt der Basiswert `hidden="true"`). |
| **BPU-R3** | **Die Bedingung liest das *konfigurierte* Budget, nicht die verplante Summe:** Alle drei Sichtbarkeits-Roster verplanen konstant **160** Punkte und unterscheiden sich **ausschließlich** im `<costLimits>`-Wert. Wäre die verplante Summe gemeint, wären alle drei gleich (160 ≠ 500) und der Flag-Wechsel bliebe aus. | `field="limit::<costTypeId>"` = „das **Kostenlimit** (Budget) der Roster für diese Kostenart" (§13.2, §7.7). Roster: 2 × (10 × 8 pts) = 160 pts, `costLimit` 500/499/501. |
| **BPU-R4** | **„Höchstens VIER Einheiten": 4 ist still, 5 feuert.** Die force-weite Zählung `childId="unit"` ergibt bei vier Skeletons-Einheiten **4** — `greaterThan 4` hält nicht (streng größer). Mit der fünften Einheit ergibt sie **5** und hält; die `or`-Gruppe hält, und am besetzten Slot liegt genau eine Autor-Meldung vom Schweregrad *error* mit dem Wortlaut `The army must consist of at least TWO units but no more than FOUR units`. | `.gst` Z. 17600–17610: `<modifier type="add" value="…" field="error">` mit `conditionGroup type="or"` → `<condition type="greaterThan" value="4" field="selections" scope="force" childId="unit" shared="true" includeChildSelections="false" childName="unit"/>` (Z. 17605). Gezähltes Ziel: `selectionEntry "Skeletons"` `9ac2-f4c1-bcc3-3aee` mit `type="unit"` (VC-`.cat` Z. 71). |
| **BPU-R5** | **„Mindestens ZWEI Einheiten": 2 ist still, 1 feuert.** Dieselbe Meldung, andere Hälfte der `or`-Gruppe: bei **2** Einheiten hält `lessThan 2` nicht, bei **1** hält es. Der Wortlaut ist derselbe — die beiden Zellen unterscheiden sich nur im Auslöser. | `.gst` Z. 17606: `<condition type="lessThan" value="2" field="selections" scope="force" childId="unit" shared="true" includeChildSelections="false" childName="unit"/>`. |
| **BPU-R6** | **Die Infanterie-Meldung wird konstant stillgehalten:** Ihre Bedingung `lessThan 1` auf die Kategorie *BP Infantry 10+* hält nie, weil jede Skeletons-Einheit mit ihren 10 Modellen die Kategorie per Modifikator erhält. Sie ist in allen sechs Rostern als `count: 0` gepinnt — also ausdrücklich **abwesend**, nicht bloß toleriert. | `.gst` Z. 17611–17615 (Meldung + `condition lessThan 1 childId="6ad6-f54e-1867-00a7" scope="force" includeChildSelections="true"`); `.gst` Z. 796 (`categoryEntry "BP Infantry 10+"`, `hidden="true"`, ohne Constraints); VC-`.cat` Z. 401–411 (`modifier add category 6ad6…` unter `and`: `atLeast 10 childId="model" scope="self" includeChildSelections="true"` **und** `atLeast 1 childId="4e15-0353-165f-5528" scope="roster"`). |
| **BPU-R7** | **Die Core-Pflicht bleibt in allen Rostern still — auch bei nur einer Einheit.** Die `.gst`-Kategorie *Core* verlangt `min 2` (force-scope), doch derselbe Border-Patrols-Trigger senkt den Grenzwert per `set` auf **1**. Jedes Roster enthält mindestens eine Core-Auswahl (Skeletons ist primär *Core*), also ist die Grenze überall erfüllt und steht in `absent`. | `.gst` Z. 372–375: `categoryEntry "Core"` `64bf-efb4-9978-26df`, Constraint `35c2-d478-392a-aeb1` (`min 2`, `scope="force"`, `includeChildSelections="true"`) → Z. 377–382 `<modifier type="set" value="1" …>` mit `atLeast 1` auf `4e15-0353-165f-5528`. Die Punkteband-Modifikatoren (Z. 383–430) verlangen alle ≥ 2000 und sind bei 499–501 wirkungslos. Primärkategorie der Skeletons: VC-`.cat` Z. 76 (`categoryLink` `c747-fa20-debf-8e62` → `64bf-efb4-9978-26df`). |
| **BPU-R8** | **Die General-Pflicht feuert in jedem Roster — deklariert, nicht verschwiegen.** Die `.gst`-Kategorie *General* trägt `min 1` mit `scope="force"` an der **`categoryEntry`-Definition**; laut §5.6 gilt eine so deklarierte Grenze „für die Kategorie **in jeder Force**", auch ohne eigenen `categoryLink` am Kontingent (das Kontingent „Standard (VC-AB)" führt in der Tat keinen). Keines der Roster enthält einen General ⇒ Ist **0** gegen Grenze **1**. | `.gst` Z. 721–727: `categoryEntry "General"` `a37e-7207-de6d-acb0` mit `1077-7379-f142-f382` (`min 1`, `scope="force"`), `d818-c60d-b1f8-8aaa` (`max 1`, `scope="force"`) und `54c9-b217-e67c-bd60` (`max 1`, `scope="parent"`); **keine** Modifikatoren. Kontingent-`categoryLinks`: VC-`.cat` Z. 29298–29310. |
| **BPU-R9** | **Alle übrigen Border-Patrols-Umwertungen bleiben still**, weil die Roster keine passende Auswahl führen: *Lord* `max → 0`, *Special* `max → 1`, *Rare* `max` (unterste Bank), Bannerträger `max → 0`, *Magical Standard* `max → 0`, *War Machine*/*Chariot* `max → 1`, *Heroes* `max -1`. Sämtlich Obergrenzen bei Ist 0. | `.gst` Z. 363 (`fda5-91c2-e17f-774c`, Modifikator Z. 246–251), Z. 436 (`16f0-6e5b-55d0-4102`, Z. 458–464), Z. 546 (`0a44-2d3f-adfe-f3a1`), Z. 731 (`2a1d-03a1-b48c-64ad`, Z. 734–739), Z. 785 (`30bf-4c62-23fb-6143`, Z. 788–793), Z. 752 (`8be7-a669-c00b-625d`), Z. 765 (`4b43-5d4e-94ca-1fd5`), Z. 368 (`7fca-63fb-63d2-9dad`). |
| **BPU-R10** | **Die Grenzen der gewählten Bausteine sind erfüllt:** „Border Patrols rules" `max 1` (parent) mit einer Auswahl; Skeletons-Modell `min 10`/`max 40` mit genau 10 sowie die Border-Patrols-Sondergrenze (`-1` → `set 25`); Handweapon `min 1`/`max 1` mit genau einer; die force-weite `min 0` der Einheit. Alle stehen in `absent`. | `.gst` Z. 17586 (`fbfc-d43f-396d-09cc`); VC-`.cat` Z. 81 (`ad1d-03cf-a16f-ae52`, `min 10`), Z. 82 (`6679-1132-0a76-9ba3`, `max 40`), Z. 83–85 + Z. 122–127 (`77fc-39e4-00c0-4e3a`, `max -1` → `set 25` unter Border Patrols), Z. 143/144 (`c217-3344-da80-f974` / `175c-13ab-b2bf-a749`), Z. 438 (`0005-cca1-4c68-4bcf`, `min 0`). |
| **BPU-R11** | **Kein Budget-Verstoß:** Verplant sind 80 / 160 / 320 / 400 Punkte (8 pts je Skeletons-Modell, Handweapon und Einheit je 0 pts) gegen Budgets von 499–501 — die roster-eigene Budget-Regel bleibt in allen Rostern still. | VC-`.cat` Z. 88 (`cost pts 8` am Modell; die `set 7`/`set 10`-Modifikatoren Z. 93–111 sind auf die Kontingente Lichemaster/Necromancer/Sylvania `instanceOf`-gegattert und greifen in „Standard (VC-AB)" nicht), Z. 150 (Handweapon 0 pts), Z. 385–389 (Einheit 0 pts). |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| Ob ein **effektiv verborgener** Träger seine Autor-Meldungen noch abgibt | Aus den erlaubten Quellen nicht ableitbar: §8 regelt für versteckte Entitäten nur, dass sie nicht **angeboten** werden und ihre **Min-Grenzen** nicht validiert werden (Issue 0088); über Autor-Meldungen schweigt die Referenz. Die Sichtbarkeits-Roster 02/03 sind deshalb bewusst so gebaut, dass **beide** Meldungen ohnehin bedingungsfalsch sind (2 Einheiten, Kategorie *BP Infantry 10+* vorhanden) — die `count: 0`-Aussage dort ist damit unabhängig von dieser offenen Frage. |
| `includeChildSelections="false"` **beobachtbar** machen (verschachtelte `unit`-Auswahl) | Bräuchte eine Auswahl vom Rohtyp `unit` **unterhalb** einer anderen Auswahl. In den hier gebauten Rostern gibt es keine; beide Lesarten ergäben dieselbe Zahl. Die Lesart ist oben schriftlich festgehalten, aber nicht behauptet — eine eigene Zelle. |
| `scope="force"` über **mehrere** Kontingente | Alle Roster haben genau ein Kontingent. Die Frage, ob `scope="force"` mit einem **Typ**-Ziel pro Detachment zählt (Ziel-Typ-Regel, §7.7/ADR 0029), ist eine eigene Facette. |
| Die **verlinkte** Form der Rohtyp-Zählung (`entryLink` auf ein `type="unit"`-Ziel) | Bereits von [`entrylink-raw-type-counting`](../entrylink-raw-type-counting/README.md) gepinnt. Hier zählen ausschließlich **direkt** gesetzte Einheiten, damit die Zellen `greaterThan`/`lessThan` nicht mit der Link-Auflösung vermischt werden. |
| Der `defaultAmount="1"` des Eintrags | Ein Vorbelegungshinweis für den Editor; er sagt nichts über eine zählende Grenze oder eine Meldung aus und ist im Bericht nicht beobachtbar. |
| `isHidden` **anderer** Slots im 499/501-Fall | Ob das `hidden` eines Trägers auf die Slot-Projektion anderer Anker durchschlägt, ist in der Formatreferenz nicht spezifiziert; behauptet wird nur der Slot des Trägers selbst. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle sechs
verwenden das Kontingent „Standard (VC-AB)", enthalten genau **eine**
Wurzel-Auswahl „Border Patrols rules" (`number="1"`) und bestehen sonst
ausschließlich aus Skeletons-Einheiten zu je 10 Modellen + 1 Handweapon.

> **Assertion-Form:** Die Sichtbarkeit wird über `expect.capabilities[].isHidden`
> am **besetzten** Slot (`anchorKind: occupied`) des Eintrags behauptet, die
> beiden Autor-Meldungen über `expect.messages` mit `origin: "authorMessage"` —
> anwesend mit Wortlaut, Schweregrad und Anker, abwesend mit `count: 0`.
> `firing`/`absent` tragen die **echten** Grenzen: die General-Pflicht feuert
> überall (BPU-R8), die Core-Pflicht und alle Bausteine-Grenzen sind ausdrücklich
> als abwesend gepinnt (BPU-R7/R9/R10/R11).

| # | Testtitel | Roster-Zustand | Zählung / Auslöser | Erwartetes Ergebnis | Fixture |
|---|-----------|----------------|--------------------|---------------------|---------|
| 01 | Budget **500** → Eintrag wird angeboten, 2 Einheiten still | `costLimit` 500, BP-Auswahl, **2** Skeletons-Einheiten (160 pts) | Budget = 500 ⇒ `equalTo` hält. Einheiten = **2** ⇒ weder > 4 noch < 2 | **BPU-R1:** Slot `4e15…` `isHidden: false`. **BPU-R5 (stille Hälfte):** „at least TWO … no more than FOUR" `count: 0`. **BPU-R6:** Infanterie-Meldung `count: 0`. **BPU-R8:** `1077…` feuert Ist 0 / Grenze 1 | [`01-budget-500-two-units-offered.ros`](rosters/01-budget-500-two-units-offered.ros) |
| 02 | Budget **499** → Eintrag bleibt verborgen | **Identischer** Inhalt, `costLimit` 499 | 499 ≠ 500 ⇒ `equalTo` hält nicht | **BPU-R2:** Slot `4e15…` `isHidden: true`. Beide Meldungen weiter `count: 0` (bedingungsfalsch, s. o.) | [`02-budget-499-hidden.ros`](rosters/02-budget-499-hidden.ros) |
| 03 | Budget **501** → Eintrag bleibt verborgen | **Identischer** Inhalt, `costLimit` 501 | 501 ≠ 500 ⇒ `equalTo` hält nicht | **BPU-R2/R3:** Slot `4e15…` `isHidden: true`; zusammen mit 02 ist die Gleichheit beidseitig eingeklemmt | [`03-budget-501-hidden.ros`](rosters/03-budget-501-hidden.ros) |
| 04 | **VIER** Einheiten — die Obergrenze ist erreicht, nicht überschritten | `costLimit` 500, BP-Auswahl, **4** Einheiten (320 pts) | Einheiten = **4** ⇒ `greaterThan 4` hält **nicht** | **BPU-R4 (stille Hälfte):** „at least TWO … no more than FOUR" `count: 0`; Slot sichtbar (`isHidden: false`) | [`04-four-units-silent.ros`](rosters/04-four-units-silent.ros) |
| 05 | **FÜNF** Einheiten — die Meldung feuert | Wie 04 plus **eine** weitere Einheit (400 pts) | Einheiten = **5** ⇒ `greaterThan 4` hält | **BPU-R4 (feuernde Hälfte):** genau eine Autor-Meldung am Slot `4e15…`, *error*, Wortlaut unverändert; Infanterie-Meldung `count: 0` | [`05-five-units-too-many.ros`](rosters/05-five-units-too-many.ros) |
| 06 | **EINE** Einheit — die Meldung feuert | `costLimit` 500, BP-Auswahl, **1** Einheit (80 pts) | Einheiten = **1** ⇒ `lessThan 2` hält | **BPU-R5 (feuernde Hälfte):** dieselbe Autor-Meldung; **BPU-R7:** die Core-Pflicht bleibt trotz nur einer Core-Auswahl still (Grenzwert per `set` auf 1 gesenkt) | [`06-one-unit-too-few.ros`](rosters/06-one-unit-too-few.ros) |

**Paarbildung der drei Abdeckungszellen** — jede Zelle wird von genau einem
Roster**paar** getragen, das sich in **einer** Eigenschaft unterscheidet:

| Zelle | still | feuert / kippt | Einziger Unterschied |
|-------|-------|-----------------|----------------------|
| `condition\|equalTo\|roster\|limitValue\|child=any` | 01 (`isHidden false`) | 02 und 03 (`isHidden true`) | der `<costLimits>`-Wert (500 vs. 499 / 501) |
| `condition\|greaterThan\|force\|selectionCount\|child=unit` | 04 (4 Einheiten) | 05 (5 Einheiten) | eine Einheit mehr |
| `condition\|lessThan\|force\|selectionCount\|child=unit` | 01 (2 Einheiten) | 06 (1 Einheit) | eine Einheit weniger |

**Punktekontrolle (nicht Teil der Assertion):** 10 Modelle × 8 pts = 80 pts je
Einheit, Handweapon 0 pts, Einheit selbst 0 pts, „Border Patrols rules" ohne
`<costs>` = 0 pts. Roster 01/02/03: 160, Roster 04: 320, Roster 05: 400,
Roster 06: 80 — alle unter jedem der drei Budgets (BPU-R11).

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **BPU-R2** — ob `isHidden` einer **besetzten** Auswahl den Basiswert
   `hidden="true"` meldet, wenn der aufdeckende Modifikator nicht greift (die
   Auswahl steht ja im Roster, wird aber nicht mehr angeboten).
2. **BPU-R3** — ob `limit::<costTypeId>` das **eingestellte** Budget liest und
   nicht die verplante Summe; bei 160 verplanten Punkten wäre der Unterschied
   sofort sichtbar.
3. **BPU-R4/R5** — ob `childId="unit"` als **Typ-Schlüsselwort** gelesen wird
   (und nicht als unauflösbare Ziel-Id, was 0 ergäbe und die Meldung in *jedem*
   Roster feuern ließe) und ob `greaterThan`/`lessThan` **strikt** vergleichen
   (4 still, 5 feuernd; 2 still, 1 feuernd).
4. **BPU-R8** — ob eine an der **`categoryEntry`** deklarierte `scope="force"`-
   Mindestgrenze auch dann gilt, wenn das Kontingent für diese Kategorie
   **keinen** `categoryLink` führt (§5.6).
5. Die Anker-Adressierung: `defId 4e15-0353-165f-5528` + `anchorKind occupied`
   muss die eine Border-Patrols-Auswahl eindeutig treffen; der Wortlaut der
   Autor-Meldung muss **unverändert** aus dem `value`-Attribut stammen
   (inklusive des Schlusspunkts der Infanterie-Meldung).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| „Border Patrols rules", Träger aller drei Konstrukte (`.gst`-Wurzeleintrag, Basis `hidden="true"`, `defaultAmount="1"`) | `4e15-0353-165f-5528` (`.gst` Z. 17584) |
| Eigene Grenze des Eintrags (parent `max 1`, als `absent`) | `fbfc-d43f-396d-09cc` (Z. 17586) |
| Kategorie *Special list rules* (primär am Eintrag; Link) | `32f1-197f-d719-a393` (Link `fd54-fb51-2021-d3cd`, Z. 17592) |
| Kostenart Punkte (Ziel von `limit::…` und der `costLimits`) | `ecfa-8486-4f6c-c249` |
| Kategorie *BP Infantry 10+* (versteckt, ohne Constraints; Ziel der zweiten Meldung) | `6ad6-f54e-1867-00a7` (`.gst` Z. 796) |
| Einheit „Skeletons" (`type="unit"`, primär *Core*, Träger des `add category`-Modifikators) | `9ac2-f4c1-bcc3-3aee` (VC-`.cat` Z. 71) |
| Modell „Skeletons" (8 pts; `min 10` / `max 40` / BP-`max` als `absent`) | `eaa1-c6a6-9aae-ae9a` — Grenzen `ad1d-03cf-a16f-ae52` / `6679-1132-0a76-9ba3` / `77fc-39e4-00c0-4e3a` |
| „Handweapon" (0 pts; `min 1` / `max 1` als `absent`) | `565b-37e6-290b-e040` — Grenzen `175c-13ab-b2bf-a749` / `c217-3344-da80-f974` |
| Force-weite `min 0` der Skeletons (als `absent`) | `0005-cca1-4c68-4bcf` (VC-`.cat` Z. 438) |
| Kategorie *Core* (Pflicht `min 2` → `set 1` unter Border Patrols; als `absent`) | `64bf-efb4-9978-26df` — Constraint `35c2-d478-392a-aeb1` (`.gst` Z. 374) |
| Kategorie *General* (Pflicht `min 1`, feuert in allen Rostern) | `a37e-7207-de6d-acb0` — Constraint `1077-7379-f142-f382` (`.gst` Z. 724); `max`-Gegenstücke `d818-c60d-b1f8-8aaa` / `54c9-b217-e67c-bd60` |
| Border-Patrols-Umwertungen, sämtlich still (als `absent`) | *Lord* `fda5-91c2-e17f-774c`, *Special* `16f0-6e5b-55d0-4102`, *Rare* `0a44-2d3f-adfe-f3a1`, BSB `2a1d-03a1-b48c-64ad`, *Heroes* `7fca-63fb-63d2-9dad` |
| Roster-Budget-Regel (als `absent`) | `budget::ecfa-8486-4f6c-c249` |
| Kontingent „Standard (VC-AB)" (führt *Special list rules* per `950e-cea9-64a9-25a1`, ohne eigene `categoryLink`-Constraints) | `e989-15b8-7eb6-9668` (VC-`.cat` Z. 29297) |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
