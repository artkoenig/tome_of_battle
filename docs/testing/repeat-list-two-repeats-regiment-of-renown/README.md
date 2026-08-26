# E2E-Regeln & Testkatalog: Mehrere `<repeat>` an einem Modifikator — die Regiment-of-Renown-Slots der Marienburger Söldnerarmee

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`),
der vendorten [`Catalogue.xsd`](../../../src/platform/battlescribe/schema/Catalogue.xsd) und der
Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§5.6, §7.6, §7.7, §8) sowie dem
[BSData-Wiki-Submodul](../../bsdata-catalogue-development-wiki/Data-structure-overview.md)
abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Gestalt ist an den
bestehenden Szenarien verifiziert (direktes `entryId` mit `entryLinkId=""` beim
Wurzeleintrag, `entryLinkId` beim verlinkten Kind, verschachtelte `selections`
mit `number`, `<costLimits><costLimit typeId=…/></costLimits>` für das
eingestellte Budget — vgl.
[`force-repeat-bloodletters-flesh-hound-slots`](../force-repeat-bloodletters-flesh-hound-slots/rosters/03-two-bloodletters-two-flesh-hounds-max-2.ros)
und [`offer-and-category-slots`](../offer-and-category-slots/rosters/02-blood-dragon-plain-visible-categories.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1, `.gst` Z. 2) — Träger der Kostenart **`pts`**
  `ecfa-8486-4f6c-c249` und des Schalter-Trägers „Mercenaries and Regiments of
  Renown" `6a7d-7d85-8d7e-cbce` (Z. 2345)
- Armeebuch: `The Empire (6th definitive edition).cat`
  (`3938-8369-a300-4a03`, rev 1, `.cat` Z. 2) — Kontingent
  **„Marienburger Mercenary Army (EM-AB)"** `d1ca-0d07-b9d2-0ff1` (`.cat` Z. 15430)
- Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — per `catalogueLink`
  `7773-ecbb-5fb9-eb56` (`.cat` Z. 15538) deklarierte Abhängigkeit des
  Empire-Katalogs. Sie ist hier **nicht** Beiwerk: die Kategorie „Regiment of
  Renown" **und** alle Einheiten darin stehen dort, nicht im Armeebuch.

---

## Die Regel (In-World)

Ein `<repeat>` lässt einen Modifikator *„multiple times"* greifen — das Wiki
definiert `Repeats` als *„the number of times the parent modifier should apply
**each time the Query is met**"* und spricht davon, dass ein Modifikator der
*„ancestor of **one or more** Repeats"* sei
([*Data structure overview*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md),
Abschnitte *Modifier* und *Repeat*). Ein Modifikator darf also **mehrere**
`<repeat>` tragen, und jeder davon ist eine **eigene, vollständige Query** mit
eigenem `field`/`scope`/`childId`. Daraus folgt die hier gepinnte Lesart:

> **Die Anwendungen der einzelnen Repeats addieren sich.** Jeder Repeat steuert
> `floor(N / value) × repeats` Anwendungen bei; die Gesamtzahl ist ihre Summe.
> Ein Repeat, der **null** Treffer zählt, steuert **nichts** bei — annulliert
> aber auch die übrigen **nicht**.

In-World: *„In der Marienburger Söldnerarmee bringt jede Einheit Staatstruppen
**und** jede Einheit Miliz einen Slot für ein Regiment of Renown mit."* Zwei
Staatstruppen-Einheiten ohne jede Miliz erlauben damit **zwei** Regiments of
Renown — eine multiplizierende Lesart erlaubte **keines**.

---

## Die Datenlage: der `categoryLink` „Regiment of Renown" des Kontingents

```
forceEntry "Marienburger Mercenary Army (EM-AB)"  d1ca-0d07-b9d2-0ff1   .cat Z. 15430
 └ categoryLink "Regiment of Renown" ecb7-b051-37c7-2997 → ee09-…       .cat Z. 15442
    ├ constraint max 0  field="selections" scope="parent" shared="true"
    │            id="51f7-4cc5-fad2-1f91"                               .cat Z. 15444
    ├ constraint max 0  field="selections" scope="parent" shared="true"
    │            id="c13f-1ee8-e81a-01ae"                               .cat Z. 15445
    ├ modifier increment value="1" field="51f7-4cc5-fad2-1f91"          .cat Z. 15448
    │   └ repeats
    │       ├ repeat value=1 repeats=1 field="selections" scope="force"
    │       │        childId="2067-05d1-55c9-f09f"  (Kategorie State troops)
    │       │        shared="true" roundUp="false"
    │       │        includeChildSelections="true"                      .cat Z. 15450
    │       └ repeat  … childId="bdb0-067d-c73e-2eb2"  (Kategorie Militia)
    │                                                                   .cat Z. 15451
    └ modifier increment value="1" field="c13f-1ee8-e81a-01ae"          .cat Z. 15454
        └ repeats  (dieselben zwei Repeats)                       .cat Z. 15456/15457
```

Die beiden gezählten Kategorien und ihre Mitglieder:

```
categoryEntry "State troops"  2067-05d1-55c9-f09f   .cat Z. 41
 ← Halberdiers 569f-… (Z. 49/59), Spearmen 1db9-… (Z. 590/600),
   Swordsmen ce0d-… (Z. 923/926), Handgunners 7132-… (Z. 1100/1110)

categoryEntry "Militia"       bdb0-067d-c73e-2eb2   .cat Z. 44
 ← Free Company 70a8-… (Z. 1292/1295), Archers de5e-… (Z. 1431/1442),
   Huntsmen e13c-… (Z. 1573/1583), Crossbowmen ac89-… (Z. 1721/1724)
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RLTR-R1** | **Basis.** Der `categoryLink` „Regiment of Renown" des Marienburger Kontingents trägt **genau zwei** Grenzen, beide gleichlautend: `max 0`, `field="selections"`, `scope="parent"`, `shared="true"`. `percentValue`, `includeChildSelections` und `includeChildForces` fehlen und stehen damit auf ihren XSD-Vorgaben `false` (`Catalogue.xsd:428–431`, `QueryBase`). Ohne jeden Modifikator wäre in diesem Kontingent also **kein** Regiment of Renown wählbar. | `.cat` Z. 15444/15445. `scope="parent"` an einem `categoryLink` eines `forceEntry` ⇒ Bezugsrahmen ist das Kontingent ([§5.6](../../battlescribe-data-format.md#56-force-entries-detachments)); gezählt werden die Auswahlen **unterhalb** des Trägers, also die Mitglieder der Kategorie ([§7.6](../../battlescribe-data-format.md#76-constraint)). |
| **RLTR-R2** | **Genau zwei Schreiber, einer je Grenze.** Jede der beiden Ids kommt im gesamten Fixture-Datensatz **zweimal** vor: als Grenze und als `field` ihres eigenen `increment`-Modifikators. Kein weiterer Katalog schreibt darauf; beide Rechnungen sind damit vollständig und voneinander unabhängig. | Grep über `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/` auf `51f7-4cc5-fad2-1f91` bzw. `c13f-1ee8-e81a-01ae` → je 2 Treffer, alle in `The Empire (…).cat`, Z. 15444/15448 bzw. 15445/15454. |
| **RLTR-R3** | **Die Modifikatoren sind unbedingt.** Beide `increment`-Modifikatoren tragen **weder** `<conditions>` **noch** `<conditionGroups>` — sie greifen in diesem Kontingent immer; allein ihre `<repeats>` entscheiden, **wie oft**. Es gibt also kein Gatter, das das Ergebnis mit erklären könnte. | `.cat` Z. 15448–15453 und 15454–15459: die einzigen Kinder sind `<repeats>`. |
| **RLTR-R4** | **Zwei Repeats je Modifikator, beide auf eine Kategorie.** Jeder `<repeats>`-Block enthält **zwei** `<repeat value="1" repeats="1" field="selections" scope="force" shared="true" roundUp="false" includeChildSelections="true">` — einen mit `childId="2067-05d1-55c9-f09f"` („State troops") und einen mit `childId="bdb0-067d-c73e-2eb2"` („Militia"). Beide `childId` sind **`categoryEntry`**-Ids, keine Eintrags-, Kontingent- oder Typ-Schlüsselwörter. | `.cat` Z. 15450/15451 und 15456/15457; Definitionen `.cat` Z. 41 und Z. 44. Beide Ids benennen im Datensatz **nichts** anderes (Grep: nur `categoryEntry`-Definition, `categoryLink`-Ziele und diese Repeats). |
| **RLTR-R5** | **Kategorie-Ziel ⇒ armeeweit.** Weil das Ziel beider Repeats eine **Kategorie** ist, wird `scope="force"` nach der Ziel-Typ-Regel **armeeweit** ausgelesen, nicht je Kontingent. Bei den Ein-Kontingent-Rostern dieses Satzes fallen beide Lesarten zusammen — der Fall ist hier bewusst nicht beobachtbar, damit die Repeat-**Liste** und nicht der Rahmenbegriff geprüft wird. | [§7.7, Kasten „Domänenregel (Kategorie-Zähler, Ziel-Typ-Regel)"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) und [§7.6](../../battlescribe-data-format.md#76-constraint) (ADR 0029). |
| **RLTR-R6** | **Der Faktor je Repeat.** `value="1" repeats="1" roundUp="false"` ⇒ ein Repeat mit `N` gezählten Auswahlen steuert `floor(N / 1) × 1 = N` Anwendungen bei. Der Modifikator ist ein `increment 1`, dessen Wirkung der Faktor vervielfacht (ein wiederholter `set` bliebe idempotent). | `.cat` Z. 15450 f.; [§7.7](../../battlescribe-data-format.md#repeat--modifier-mehrfach-anwenden) und der Kasten „Ein wiederholter `set` wächst nicht" (Issue 0095). |
| **RLTR-R7** | **Die Anwendungen addieren sich — die Kernregel.** Das Wiki spricht von einem Modifikator als *„ancestor of one or more Repeats"* und von *„the number of times the parent modifier should apply **each time the Query is met**"*; **jeder** Repeat ist „the Query" seiner eigenen Zeile. Netto: `Anwendungen = S + M` mit `S` = Zahl der State-troops-Auswahlen und `M` = Zahl der Militia-Auswahlen im Rahmen. **Wirksames Maximum = `0 + S + M`.** Ein Repeat mit `N = 0` steuert `0` bei und lässt die anderen unberührt. | [BSData-Wiki, *Repeat* / *Modifier*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md); [§7.7](../../battlescribe-data-format.md#repeat--modifier-mehrfach-anwenden). **Upstream nicht explizit entschieden** — siehe den Abschnitt „Wo die Quelle schweigt" unten. |
| **RLTR-R8** | **`number` ist die Stückzahl; getrennte Geschwister summieren.** Die Roster stellen `S` und `M` bewusst über **getrennte Auswahlen mit je `number="1"`** her, nicht über ein hochgezähltes `number`. Damit hängt kein Erwartungswert an der `.ros`-Zahlenbasis, und das Szenario misst allein die Repeat-Liste. | [§7.5, Kasten „Zahlenbasis"](../../battlescribe-data-format.md#75-cost--cost-type); die `number`-Frage selbst ist in [`force-repeat-bloodletters-flesh-hound-slots`](../force-repeat-bloodletters-flesh-hound-slots/README.md) (FRBFH-R6) gepinnt. |
| **RLTR-R9** | **Was `actual` zählt.** `actual` ist die Zahl der Auswahlen im Kontingent, deren **effektive** Kategorien `ee09-9a50-ad78-9c32` enthalten. Weil `includeChildSelections` an beiden Grenzen `false` ist (*„just `scope`'s `field`"*), zählen nur die Auswahlen auf oberster Kontingent-Ebene — dort stehen die Regiments of Renown. Ihre Kinder (Modelle, Waffen, Champion) tragen die Kategorie nicht. | [§7.6](../../battlescribe-data-format.md#76-constraint); Mercenaries-`.cat`, z. B. `selectionEntry "Bearmen of Urslo" ab79-…` mit `categoryLink ae77-c44c-cb5c-a915 → ee09-…` (Z. 1456) und Kindern **ohne** `categoryLinks`. |
| **RLTR-R10** | **Die Marienburger Kategorie-Umschaltung nimmt die RoR-Mitgliedschaft nicht weg.** Jeder Wurzel-`entryLink` des Empire-Katalogs auf ein Regiment of Renown trägt eine `modifierGroup`, die im Marienburger Kontingent `add category Core`, `set-primary Core` und `remove category Special` bzw. `Rare` ausführt. **Kein** Modifikator entfernt `ee09-…`; `set-primary` sichert nur die *zusätzliche* Mitgliedschaft in Core, und zählrelevant ist allein die Mitgliedschaft, nicht das `primary`-Flag. Die Einheiten bleiben also Regiments of Renown — und sind zugleich **Core**, was die Special-/Rare-Kategoriegrenzen aus dem Spiel nimmt. | `.cat` Z. 15541–15811 (19 Wurzel-`entryLink`s, davon 18 mit dieser `modifierGroup`); [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit), Absatz „Laufzeit-dynamische Kategoriezugehörigkeit" (Issue 0100). |
| **RLTR-R11** | **Die Kategorie ist in allen Rostern sichtbar.** `categoryEntry "Regiment of Renown"` trägt selbst einen `set hidden="true"`, dessen `or`-Gruppe (a) *„weniger als 1 Auswahl von ‚Allow Regiments of Renown' `3d35-6b18-262f-6503` im Kontingent"* und (b) *„Border-Patrols-Regeln im Roster **und** Armeebuch ≠ Dogs of War"* prüft. Jedes Roster setzt den Schalter (über `entryLink 98a8-944c-e737-3674` → `6a7d-7d85-8d7e-cbce` → `3d35-…`) und enthält **keine** Border-Patrols-Regeln — beide Zweige halten nicht. Der `categoryLink` `ecb7-…` selbst trägt `hidden="false"` und **keinen** `hidden`-Modifikator. | Mercenaries-`.cat` Z. 39–63; `.gst` Z. 2345–2351; Empire-`.cat` Z. 15898. `hidden`-Komposition [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit). Dieselbe Schalter-Mechanik wie in [`offer-and-category-slots`](../offer-and-category-slots/README.md). |
| **RLTR-R12** | **Die zweite Grenze der Kategorie ist wirkungslos.** `categoryEntry "Regiment of Renown"` trägt zusätzlich `constraint 0b6f-90dd-93f3-373b` `max -1 scope="parent"` — ein hingeschriebener Sentinel, also „unbegrenzt". Der einzige Schreiber darauf (`set 1`) verlangt Border-Patrols-Regeln im Roster; die gibt es hier nicht. Das wirksame Höchstmaß des Slots kommt damit allein aus RLTR-R1/R7. | Mercenaries-`.cat` Z. 58–66; [§7.6, Sentinel-Kasten](../../battlescribe-data-format.md#76-constraint) (Issue 079). |
| **RLTR-R13** | **Die Roster sind katalogkonform gebaut.** Jede Einheit führt ihre Pflichtkinder: *Halberdiers* 10 Modelle + Halberds + Hand Weapon + Light Armour (je `min 1`); *Free Company* 10 *Fighter* + Two Hand Weapons; *Bearmen of Urslo* 10 *Bearmen* + Hand Weapon; *Lumpin Croop's Fighting Cocks* 6 *Halfings* + eine Wahl aus der `min 1`-Gruppe „Weapons" + *Champion* + Hand Weapon; *Birdmen of Catrazza* *Champion* + 5 *Birdmen* + Bow + Hand Weapon. | Empire-`.cat` Z. 62–68/349–381 bzw. 1298–1304/1421–1426; Mercenaries-`.cat` Z. 1459–1490, 1768–1903, 2352–2421. |
| **RLTR-R14** | **Kein Roster verletzt sein Budget, und keine Punkte-Staffel greift.** Teuerstes Roster (05): 2 × Halberdiers (je 0 + 10 × 6 = 60) + 1 × Free Company (0 + 10 × 5 = 50) + Bearmen (18 + 10 × 8 = 98) + Lumpin Croop (48 + 6 × 7 = 90) + Birdmen (25 + 5 × 25 = 150) = **508** pts gegen ein eingestelltes Budget von **1000** pts. Alle Ausrüstungsteile kosten 0 pts. Weil das Budget unter 2000 liegt, greift **keine** der punkteskalierenden `.gst`-Kategorie-Staffeln. | Empire-`.cat` Z. 70/1306, Mercenaries-`.cat` Z. 1467/1507, 1774/1905, 2392/2425; `.gst` Z. 959/1004/1014/1041/1101 (alle 0 pts); `.gst` Z. 383–430 (Core-Staffel ab 2000 pts). |
| **RLTR-R15** | **Jede Auswahl steht nur einmal.** Jedes Regiment of Renown trägt eine eigene `max 1 scope="force"`-Grenze; die Roster stapeln deshalb **nie** dieselbe RoR-Einheit, sondern nehmen für `actual` 2 bzw. 3 **verschiedene** Einheiten. Die State-troops- und Militia-Einheiten tragen dagegen **keine** Wurzelgrenze und dürfen mehrfach stehen. | Mercenaries-`.cat` Z. 1512 (`cd7f-fff9-95aa-6115`), Z. 1910 (`8e0c-c414-7259-a1e1`), Z. 2430 (`12b8-1d2a-5faf-7100`); Empire-`.cat`: `569f-…` und `70a8-…` ohne Wurzel-`<constraints>`. |

### Wo die Quelle schweigt (und warum die additive Lesart trotzdem die belegte ist)

Weder das BSData-Wiki noch die XSD sagt **ausdrücklich**, wie sich mehrere
`<repeat>` an **einem** Modifikator verknüpfen. Die Herleitung stützt sich
deshalb auf drei Beobachtungen, alle aus den erlaubten Quellen:

1. **Der Wortlaut des Wikis.** `Repeats` ist *„the number of times the parent
   modifier should apply **each time the Query is met**"*, und ein Modifikator
   ist der *„ancestor of **one or more** Repeats"*. Jeder Repeat trägt seine
   **eigene** Query; „jedes Mal, wenn *die* Query erfüllt ist" ist damit je
   Repeat zu lesen, und die Male summieren sich.
2. **Die Kataloge werden sonst unsinnig.** Unter der multiplizierenden Lesart
   erlaubte eine reine Staatstruppen-Marienburger-Armee **kein einziges**
   Regiment of Renown, obwohl der Katalog eigens 19 solcher Einheiten in dieses
   Kontingent importiert (Empire-`.cat` Z. 15541–15811) und ihnen dort per
   `modifierGroup` sogar eine eigene Kategorie-Einordnung gibt. Dieselbe
   Unsinnigkeit trifft die drei weiteren Fundstellen desselben Baus:
   - Empire-`.cat` Z. 3484–3492: „Great Cannon" `d3f0-a597-6023-0c70`,
     `increment 1` auf `0cdb-7e97-efe4-402c` mit den **gleichen zwei** Repeats
     (Militia, State troops) — und daneben, als Kontrast, ein **eigener**
     `decrement`-Modifikator mit **einem** Repeat (Z. 3493–3500). Der Autor
     trennt Zähler und Nenner also über **Modifikatoren**, nicht über
     Repeat-Zeilen.
   - Empire-`.cat` Z. 24–29: `categoryEntry "Knight of Inner Circle"`
     `03f5-490b-d79d-08a2`, `increment 1` auf `8e86-2566-cc80-a59f` mit zwei
     Repeats (`fadf-e269-2309-035c`, `e474-301b-4e41-61c6`, je `value="2"`) —
     unter der multiplizierenden Lesart bliebe die Grenze bei 1, sobald nur
     *eine* der beiden Einheiten fehlt.
   - `Dwarfs (2005) (…).cat` Z. 1196–1201: derselbe Bau mit **drei** Repeats
     (`a467-b70d-dd94-a04a`, `329a-dee0-20f8-28d5`, `53a0-aa1b-b34d-82d6`,
     je `value="2"`) auf `e612-4ec7-7d85-cf5d`. Drei Faktoren zu
     multiplizieren, von denen realistisch höchstens einer besetzt ist, ergäbe
     in aller Regel 0.
3. **Die fail-closed-Richtung greift hier nicht.** Anders als bei
   `conditionGroup type="not"` (§7.7) gibt es keine „strengere" Lesart, die man
   im Zweifel wählen könnte: die multiplizierende Lesart ist nicht strenger,
   sondern **falsch** — sie macht ein ganzes Kontingent unbaubar.

Sollte der Runner-Lauf hier abweichen, ist das ein Befund über die Engine, kein
Anlass, diese Erwartung zu ändern (ADR 0033).

---

### Wahrheitstafel — die Grenzen `51f7-…` / `c13f-…` je Roster

| Roster | State troops `S` | Militia `M` | Repeat 1 | Repeat 2 | Anwendungen (additiv) | wirksame Grenze | Regiments of Renown (Ist) | Ergebnis |
|---|---|---|---|---|---|---|---|---|
| 01 | **0** | **0** | 0 | 0 | **0** | **0** (Basis) | 1 | feuert |
| 02 | **2** | **0** | 2 | 0 | **2** | **2** | 2 | still |
| 03 | **2** | **0** | 2 | 0 | **2** | **2** | 3 | feuert |
| 04 | **0** | **2** | 0 | 2 | **2** | **2** | 2 | still |
| 05 | **2** | **1** | 2 | 1 | **3** | **3** | 3 | still |
| 06 | **1** | **0** | 1 | 0 | **1** | **1** | 2 | feuert |

Die Leiter wird **zweimal von oben gestraddelt** (02 still / 03 feuert bei
demselben `S`; 05 still / 03 feuert bei denselben drei Regiments of Renown), und
das Paar 02/04 spiegelt die beiden Repeat-Zeilen gegeneinander.

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | wirksame Grenze in 02 / 04 / 05 | fällt auf bei |
|---|---|---|
| Die Repeats **multiplizieren** sich (`S × M`) | 0 / 0 / 2 | Roster 02, 04 **und** 05 — alle drei feuerten. |
| Ein Repeat mit **0 Treffern annulliert** den ganzen Modifikator | 0 / 0 / 3 | Roster 02 und 04 — beide feuerten trotz zweier Slot-Geber. |
| Nur der **erste** `<repeat>` wird gelesen | 2 / 0 / 2 | Roster 04 (feuerte) und 05 (feuerte). |
| Nur der **letzte** `<repeat>` wird gelesen | 0 / 2 / 1 | Roster 02 (feuerte) und 05 (feuerte). |
| **Maximum** statt Summe der Repeats | 2 / 2 / 2 | Roster 05 — feuerte mit Ist 3 gegen Grenze 2. |
| `<repeat>` ganz **ignoriert** (Modifikator einmal angewendet) | 1 / 1 / 1 | Roster 02, 04, 05 und 06 — alle feuerten. |
| `<repeat>` als **Bedingung** gelesen („mindestens eine ⇒ +1") | 1 / 1 / 1 | wie oben; zusätzlich bliebe 03 bei Grenze 1 statt 2. |
| Nur **eine** der beiden Grenzen bedient (die zweite bleibt bei 0) | – | Roster 02, 04, 05 — die unbediente Id feuerte, obwohl beide Modifikatoren identisch sind. |
| `childId` als **Eintrags**-Id statt Kategorie gelesen | 0 / 0 / 0 | Roster 02, 04, 05 — keine der beiden Ids benennt einen Eintrag, der Repeat zählte nie. |
| Die Marienburger `set-primary`-Umschaltung **entfernt** die RoR-Mitgliedschaft | – | Roster 01, 03, 06 — `actual` fiele auf 0 und keine der drei erwarteten Verletzungen erschiene. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen im
selben Kontingent gegen denselben Datensatz (`.gst` + `The Empire`-`.cat` + die
per `catalogueLink` deklarierte `Mercenaries`-`.cat`), tragen dasselbe Budget von
1000 pts und setzen denselben Schalter „Allow Regiments of Renown".

> **Assertion-Fokus:** ausschließlich die beiden Grenzen `51f7-4cc5-fad2-1f91`
> und `c13f-1ee8-e81a-01ae` sowie `current`/`effectiveMax` des
> Regiment-of-Renown-Kategorie-Ankers. Andere Armeeaufbau-Diagnosen — namentlich
> die General-Pflicht `1077-7379-f142-f382` (`.gst` Z. 721 ff.) und die
> Core-Pflicht `35c2-d478-392a-aeb1` (`.gst` Z. 374, hier `min 2`) — dürfen
> zusätzlich auftreten und sind hier ohne Belang (selektive Erwartung,
> Manifest-Vertrag). Sie stehen bewusst **nicht** in `absent`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Der unwiederholte Basiswert | **Keine** State troops, **keine** Militia, **ein** Regiment of Renown (*Bearmen of Urslo*). | **RLTR-R1/R7:** Beide Repeats zählen 0, der `increment` wird nie angewendet ⇒ Grenze bleibt **0**. `51f7…` und `c13f…` feuern **Ist 1 / Grenze 0**; der Kategorie-Anker meldet Ist 1 bei `effectiveMax` 0, sichtbar und blockiert. | [`01-…-max-0.ros`](rosters/01-no-state-no-militia-max-0.ros) |
| 02 | **Der entscheidende Fall:** zwei Repeats, einer davon null | **Zwei** Einheiten *Halberdiers* (State troops, getrennte Auswahlen), **keine** Militia, **zwei** Regiments of Renown. | **RLTR-R7:** 2 + 0 = 2 Anwendungen ⇒ Grenze **2**. Beide Grenzen feuern **nicht**; der Anker meldet Ist 2 bei `effectiveMax` 2, `headroom` 0, blockiert. Multiplizierte man die Repeats — oder annullierte der Null-Repeat den Modifikator —, feuerten beide gegen Grenze 0. | [`02-…-silent.ros`](rosters/02-two-state-troops-two-ror-silent.ros) |
| 03 | Eine Einheit zu viel | **Dieselben** zwei *Halberdiers*, aber **drei** Regiments of Renown. | **RLTR-R7:** Grenze weiterhin **2**. Beide Grenzen feuern **Ist 3 / Grenze 2** — gegen den *angehobenen* bound, nicht gegen die geschriebene 0. | [`03-…-fires.ros`](rosters/03-two-state-troops-three-ror-fires.ros) |
| 04 | Spiegelbild: der zweite Repeat allein | **Keine** State troops, **zwei** Einheiten *Free Company* (Militia), **zwei** Regiments of Renown. | **RLTR-R7:** 0 + 2 = 2 ⇒ Grenze **2**, beide Grenzen still. Zusammen mit 02 belegt das, dass **jede** Repeat-Zeile für sich trägt — eine Auswertung, die nur die erste liest, feuerte hier. | [`04-…-silent.ros`](rosters/04-two-militia-two-ror-silent.ros) |
| 05 | Beide Beiträge stapeln | **Zwei** *Halberdiers* **und** **eine** *Free Company*, **drei** Regiments of Renown. | **RLTR-R7:** 2 + 1 = 3 ⇒ Grenze **3**, beide Grenzen still. Dieselben drei Regiments of Renown, die in Roster 03 feuern, sind hier legal; einziger Unterschied ist die eine Militia-Einheit. Jede nicht-additive Verknüpfung käme auf höchstens 2 und feuerte. | [`05-…-silent.ros`](rosters/05-state-and-militia-three-ror-silent.ros) |
| 06 | Der erste Wiederholungsschritt | **Eine** Einheit *Halberdiers*, **keine** Militia, **zwei** Regiments of Renown. | **RLTR-R6:** Faktor 1 ⇒ Grenze **1**. Beide Grenzen feuern **Ist 2 / Grenze 1** — der Schritt ist genau eins, keine Pauschale. | [`06-…-fires.ros`](rosters/06-one-state-troop-two-ror-fires.ros) |

### Herleitung der Zahlen

- **`bound`** ist der wirksame `value` von `51f7-4cc5-fad2-1f91` bzw.
  `c13f-1ee8-e81a-01ae`: Katalogwert **0** (`.cat` Z. 15444/15445), verrechnet
  nach der Wahrheitstafel. Die Rechnung stammt ausschließlich aus dem XML.
- **`actual`** ist die Zahl der Auswahlen im Kontingent, deren effektive
  Kategorien `ee09-9a50-ad78-9c32` enthalten (RLTR-R9/R10) — also 1, 2 oder 3
  Regiments of Renown, je `number="1"`.
- **Beide Grenzen tragen dieselben Zahlen**, weil beide Modifikatoren Zeichen
  für Zeichen gleich sind (RLTR-R2/R3). Sie stehen deshalb in jedem Roster
  gemeinsam in `firing` bzw. gemeinsam in `absent`; genau das pinnt, dass die
  Rechnung **je Grenze** und nicht einmal für den ganzen `categoryLink`
  ausgeführt wird.
- **`effectiveMax`** des Kategorie-Ankers ist dieselbe Grenze aus Slot-Sicht
  (das Minimum der beiden gleichen Höchstmaße, und `0b6f-…` ist unbegrenzt,
  RLTR-R12); **`effectiveMin`** ist `null`, weil weder der `categoryLink` noch
  die Kategorie eine `min`-Grenze trägt. `headroom 0` wird nur dort behauptet,
  wo `current == effectiveMax` gilt (Roster 02/04/05); wo `current` das
  Höchstmaß **übersteigt** (01/03/06), behauptet das Manifest nur `isBlocked`,
  weil das Vorzeichen eines negativen Spielraums aus den Daten nicht abzuleiten
  ist.
- **Der Slot ist eindeutig adressierbar,** weil jedes Roster genau **ein**
  Kontingent hat und dieses genau **einen** `categoryLink` auf `ee09-…` trägt —
  daher `targetDefId` + `anchorKind` + `frameDefId` ohne `path` und ohne
  `defId` (dieselbe Adressierung wie in
  [`at-least-roster-limit-lord-slots`](../at-least-roster-limit-lord-slots/scenario.json)
  und [`offer-and-category-slots`](../offer-and-category-slots/scenario.json)).

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| Der **`hidden`-Modifikator** der Kategorie „Regiment of Renown" (Mercenaries-`.cat` Z. 41–57). | Sichtbarkeit, keine zählende Grenze — der Verletzungsbericht kodiert keine (Un-)Sichtbarkeit (vgl. [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). Behauptet wird nur das **Ausbleiben** des Gatters als `isHidden: false` am Anker; die Mechanik selbst ist in [`offer-and-category-slots`](../offer-and-category-slots/README.md) und [`set-hidden-force-gate`](../set-hidden-force-gate/README.md) gepinnt. |
| Die **Kategorie-Umschaltung** der 19 Marienburger RoR-`entryLink`s (`add`/`set-primary`/`remove category`). | Eigene Zelle ([`set-primary-category-membership`](../set-primary-category-membership/README.md)). Ihre Folge ist aber mitgedacht (RLTR-R10): sie nimmt die RoR-Mitgliedschaft **nicht** weg und macht die Einheiten zusätzlich zu **Core**, womit die Special-/Rare-Kategoriegrenzen nicht ins Spiel kommen. |
| Die **`.gst`-Kategoriegrenzen** Core `35c2-d478-392a-aeb1` (`min 2`), Heroes `7fca-63fb-63d2-9dad` (`max -1`), General `1077-7379-f142-f382`. | Beiwerk des Armeeaufbaus; die Erwartung ist selektiv. Ein General oder weitere Core-Einheiten fügten nur Rauschen hinzu, ohne die Slot-Leiter zu berühren. Sie stehen deshalb **nicht** in `absent`. |
| Die **`max 1 scope="force"`-Grenzen** der einzelnen Regiments of Renown (`cd7f-…`, `8e0c-…`, `12b8-…`). | Sie sind der Grund, weshalb die Roster verschiedene Einheiten statt eines hochgezählten `number` nutzen (RLTR-R15), aber sie messen etwas anderes — eine Eintrags-Obergrenze, keine Kategorie-Obergrenze. Kein Roster verletzt sie. |
| Die **Pflichtgrenzen der Kinder** (`min 10` Halberdiers/Fighter/Bearmen, `min 6` Halfings, `min 5` Birdmen, die `min 1`-Ausrüstung, die `min 1`-Gruppe „Weapons"). | Die Roster erfüllen sie unter jeder Lesart (RLTR-R13), behauptet wird das nicht — dieselbe Zurückhaltung wie in [`force-repeat-bloodletters-flesh-hound-slots`](../force-repeat-bloodletters-flesh-hound-slots/README.md). |
| **`includeChildForces`** (an beiden Grenzen per XSD-Vorgabe `false`, an beiden Repeats gar nicht gesetzt). | Bräuchte geschachtelte Kontingente; jedes Roster hier hat genau eines. Die roster-weite Variante derselben Frage ist in [`roster-repeat-category-count`](../roster-repeat-category-count/README.md) gepinnt. |
| Die **drei weiteren Fundstellen** desselben Baus (Great Cannon `d3f0-…`, Knight of Inner Circle `03f5-…`, Dwarf-Warriors-Umfeld `e612-…`). | Sie belegen, dass die Repeat-**Liste** im Datensatz kein Einzelfall ist, und stützen die additive Lesart (siehe „Wo die Quelle schweigt"). Sie fügen aber keine neue Zelle hinzu; die Dwarfs-Fundstelle liegt zudem in einem anderen Armeebuch und damit außerhalb dieses Datensatzes. |

*Abgrenzung:*
[`force-repeat-bloodletters-flesh-hound-slots`](../force-repeat-bloodletters-flesh-hound-slots/README.md)
pinnt **einen** `<repeat>` mit `scope="force"` und **Eintrags**-`childId`;
[`roster-repeat-category-count`](../roster-repeat-category-count/README.md) einen
mit `scope="roster"` und Kategorie-Ziel;
[`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md)
und [`parent-repeat-item-count`](../parent-repeat-item-count/README.md) je einen
mit `scope="unit"`/`scope="parent"`;
[`modifier-group-repeats-grave-markers`](../modifier-group-repeats-grave-markers/README.md)
den `<repeats>`-Block einer **`modifierGroup`**. Dieses Szenario pinnt die
verbleibende Dimension: **mehrere `<repeat>` an einem Modifikator** und ihre
Verknüpfung untereinander.

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **RLTR-R7** — ob die Anwendungen mehrerer `<repeat>` sich **addieren** und ob
   ein Repeat mit 0 Treffern die übrigen unberührt lässt (Roster 02 und 04 sind
   die beiden Kronzeugen, Roster 05 der Stapel-Beleg).
2. **RLTR-R2** — ob **beide** Grenzen desselben `categoryLink` je eigenständig
   berechnet werden; sie müssen in jedem Roster dasselbe Ergebnis tragen.
3. **RLTR-R5/R9** — ob eine **Kategorie**-`childId` im `<repeat>` und ein
   **Kategorie**-Anker in der Grenze dieselben Auswahlen zählen wie hier
   angenommen.
4. **RLTR-R10** — ob die Marienburger `set-primary`/`add`/`remove`-Umschaltung
   die RoR-Mitgliedschaft **erhält**; sonst fiele `actual` überall auf 0.
5. **RLTR-R6** — ob der Faktor bei `value="1" repeats="1"` genau `N` und nicht
   `N ± 1` ist (Roster 06 gegen Roster 02).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive (`.gst` Z. 2) | `0d13-7737-ea86-4662` |
| Katalog **The Empire** (`.cat` Z. 2, rev 1) | `3938-8369-a300-4a03` |
| Bibliothek **Mercenaries** (per `catalogueLink 7773-ecbb-5fb9-eb56`, `.cat` Z. 15538) | `fc47-8392-a6c8-452a` |
| `costType` „pts" | `ecfa-8486-4f6c-c249` |
| ForceEntry **„Marienburger Mercenary Army (EM-AB)"** (`.cat` Z. 15430) | `d1ca-0d07-b9d2-0ff1` |
| — dessen `categoryLink` **„Regiment of Renown"** (Träger der Grenzen; `defId` des Kategorie-Ankers) (`.cat` Z. 15442) | `ecb7-b051-37c7-2997` → `ee09-9a50-ad78-9c32` |
| — — Grenze 1: `max 0 field="selections" scope="parent" shared="true"` (`.cat` Z. 15444) | **`51f7-4cc5-fad2-1f91`** |
| — — Grenze 2: identisch (`.cat` Z. 15445) | **`c13f-1ee8-e81a-01ae`** |
| — — `increment 1` auf Grenze 1, **unbedingt**, mit zwei `<repeat>` (`.cat` Z. 15448–15453) | (unbenannt, `field="51f7-4cc5-fad2-1f91"`) |
| — — `increment 1` auf Grenze 2, **unbedingt**, mit denselben zwei `<repeat>` (`.cat` Z. 15454–15459) | (unbenannt, `field="c13f-1ee8-e81a-01ae"`) |
| — — Repeat A: `value=1 repeats=1 field="selections" scope="force" shared="true" roundUp="false" includeChildSelections="true"` (`.cat` Z. 15450/15456) | `childId="2067-05d1-55c9-f09f"` |
| — — Repeat B: identisch (`.cat` Z. 15451/15457) | `childId="bdb0-067d-c73e-2eb2"` |
| — dessen `categoryLink`s **Core** / **Special list rules** (im Roster mitbenutzt) | `5a34-c43c-dedb-1b3d` / `8e43-e05a-9143-7abb` |
| Kategorie **„State troops"** (`.cat` Z. 41) | `2067-05d1-55c9-f09f` |
| Kategorie **„Militia"** (`.cat` Z. 44) | `bdb0-067d-c73e-2eb2` |
| Kategorie **„Regiment of Renown"** (eigener `hidden`-Modifikator, Grenze `max -1` `0b6f-90dd-93f3-373b`; `targetDefId` des Ankers) | `ee09-9a50-ad78-9c32` (Mercenaries-`.cat` Z. 39) |
| Schalter-Träger **„Mercenaries and Regiments of Renown"** (`.gst` Z. 2345) — im Empire per Wurzel-`entryLink` `98a8-944c-e737-3674` (`.cat` Z. 15898) | `6a7d-7d85-8d7e-cbce` |
| — **„Allow Regiments of Renown"** (`.gst` Z. 2347) | `3d35-6b18-262f-6503` |
| Einheit **„Halberdiers"** (State troops; `.cat` Z. 49, `categoryLink e573-67c0-2d4e-f646`) | `569f-7be3-1aa2-004f` |
| — Modell „Halberdiers" (`min 10` `d96c-c95f-8224-7c87`, 6 pts) (`.cat` Z. 62) | `744d-a00d-b16c-3713` |
| — Pflicht-`entryLink`s *Halberds* / *Hand Weapon* / *Light Armour* (je `min 1`/`max 1`, `.cat` Z. 363/369/375) | `ddc3-c66b-ac3b-b97b` → `b3f3-a133-2869-0be8` / `1e3d-8d21-49e0-224e` → `abdb-bbd0-41b2-5dff` / `09eb-c22e-73f5-08b3` → `055f-8e4e-f170-35d2` |
| Einheit **„Free Company"** (Militia; `.cat` Z. 1292, `categoryLink d2ad-a7fc-c807-ead2`) | `70a8-8502-8782-e725` |
| — Modell „Fighter" (`min 10` `edf5-396d-b15f-07b6`, 5 pts) (`.cat` Z. 1298) | `9e84-31d4-577f-d85d` |
| — Pflicht-`entryLink` *Two Hand Weapons* (`min 1` `f796-b3d8-8b73-19e2`, `.cat` Z. 1421) | `08e2-6382-3a33-df56` → `36a8-7bbb-d204-0314` |
| Regiment of Renown **„Bearmen of Urslo"** (18 pts; Mercenaries-`.cat` Z. 1450), per Empire-`entryLink` `3ed2-7775-d217-14c2` (`.cat` Z. 15557) | `ab79-9343-3a3d-ff06` — `categoryLink ae77-c44c-cb5c-a915`, Eigengrenze `cd7f-fff9-95aa-6115` |
| — Modell „Bearmen" (`min 10` `e6ab-e36b-fd84-48f1`, 8 pts) / Pflicht-*Hand Weapon* `5136-27e1-577c-1ab3` | `a7c7-5257-8b73-af45` |
| Regiment of Renown **„Lumpin Croop's Fighting Cocks"** (48 pts; Mercenaries-`.cat` Z. 1762), per Empire-`entryLink` `04f0-d8d9-770a-cd56` (`.cat` Z. 15662) | `2a88-f6ee-0aee-21d9` — `categoryLink 4688-2c08-9124-d5bc`, Eigengrenze `8e0c-c414-7259-a1e1` |
| — Modell „Halfings" (`min 6` `ce72-c4a3-2e39-978e`, 7 pts) / Gruppe „Weapons" (`min 1` `f116-0cc1-44f3-2309`) mit „Bow" / „Champion" (`min 1` `925a-404e-f55f-d738`) / *Hand Weapon* `fc1f-2d71-cae8-91d4` | `5a14-dd4b-fb0f-6369` / `ded9-c85d-b192-2df7` → `78a6-26a3-5d09-a2b3` / `7db7-c4b9-5690-476a` |
| Regiment of Renown **„Birdmen of Catrazza"** (25 pts; Mercenaries-`.cat` Z. 2341), per Empire-`entryLink` `8049-8c25-93fa-f30b` (`.cat` Z. 15572) | `7014-02dd-7b9e-d65c` — `categoryLink 2204-a486-732a-0558`, Eigengrenze `12b8-1d2a-5faf-7100` |
| — „Champion" (`min 1` `c3e5-bef1-a96c-acc6`) / Modell „Birdmen" (`min 5` `6a1b-a0e1-c000-92e1`, 25 pts) / *Bow* `0cc9-ab44-04af-034b` → `9efb-2b02-f245-62f5` / *Hand Weapon* `a3b1-b611-7efe-aef3` | `34d5-e424-d281-aefc` / `1f9c-0f1a-001a-8459` |
| Korroboration: „Great Cannon" mit demselben Zwei-Repeat-Bau (`.cat` Z. 3484–3492) | `d3f0-a597-6023-0c70` — Grenze `0cdb-7e97-efe4-402c` |
| Korroboration: `categoryEntry` „Knight of Inner Circle" mit Zwei-Repeat-Bau (`.cat` Z. 24–29) | `03f5-490b-d79d-08a2` — Grenze `8e86-2566-cc80-a59f` |
| Korroboration: **Drei**-Repeat-Bau in `Dwarfs (2005) (…).cat` Z. 1196–1201 (anderer Datensatz, nicht geladen) | Grenze `e612-4ec7-7d85-cf5d` |
| Toleriertes Beiwerk: General-Pflicht / Core-Pflicht der `.gst` | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` |
