# E2E-Regeln & Testkatalog: Kategorie-Id im `scope` — der nächste Vorfahre, kein armeeweiter Rahmen

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.6/§7.7)
abgeleitet. Die Roster-Form ist an den bestehenden Szenarien verifiziert
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`entryId`=Ziel-Id + `entryLinkId`=Verweis-Id bei einem `entryLink`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1)
  — Kontingent **„Clan Von Carstein (VC-AB)"** `b1e4-e1cf-9bd6-2438`
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `ef73-f9bd-e250-54d2` eingebundene Abhängigkeit des
  Vampire-Counts-Katalogs (`Vampire Counts (…).cat:29511`).

---

## Die Regel (In-World)

Nennt der `scope` einer Grenze eine **Kategorie-Id**, dann ist der Bezugsrahmen
der Zählung der **nächste Vorfahre der tragenden Auswahl — die tragende Auswahl
eingeschlossen —, der diese Kategorie trägt**. Das ist derselbe Mechanismus wie
bei einer **Eintrags-Id** im `scope`, die den nächsten Vorfahren mit dieser
Eintrags-Id benennt. Die Quelle sagt es in einem Atemzug:

> `Scope` - one of `parent|roster|force|primary category` **or any type of
> ancestor identifier**, this decides which entity should sum up all `field`'s
> values of descendant selections of this constraint's parent entry.
> — [BSData-Wiki, *Data structure overview*, Abschnitt *Constraint*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md)

Zwei Folgerungen, die dieses Szenario festnagelt:

1. Eine Kategorie-Id im `scope` ist **kein armeeweiter Rahmen**. Dass irgendwo
   im Kontingent (oder im Roster) eine Auswahl mit dieser Kategorie steht, ist
   ohne Belang, solange sie nicht **Vorfahre** der tragenden Auswahl ist.
2. Trägt **kein** Vorfahre die Kategorie, **löst der Rahmen nicht auf** — die
   Grenze schlägt nicht an. Sie ist damit im Datensatz wirkungslos, nicht
   „immer verletzt" und nicht „immer erfüllt durch Zählwert 0".

Der Formatspezifikation nach ist die Aufzählung in §7.6 (`parent | roster |
force | category | self | unit | primary-catalogue`) genau deshalb keine
abschließende Liste von Literalen: das Wiki nennt die Vorfahren-Ids ausdrücklich
mit, und die XSD typt `scope` als nackten String (`Catalogue.xsd:426`, zitiert in
[§7.6-Kasten](../../battlescribe-data-format.md#scope-primary-catalogue)).
Denselben Mechanismus in der *Condition*-Ausprägung pinnt das Nachbarszenario
[`ancestor-scope-instance-of`](../ancestor-scope-instance-of/README.md) fest
(`scope="ancestor"` als Prüfung über die ganze Kette); hier geht es um die
**Constraint**-Ausprägung mit einer **konkret benannten** Kategorie-Id.

---

## Die Datenlage im Fixture-Satz

Im gesamten eingefrorenen Datensatz (5 Dateien) tragen **genau vier**
`constraint`-Elemente einen Id-wertigen `scope` — und alle vier nennen dieselbe
Kategorie **„Strigoi"** `bf30-4ff0-a4d8-3909`:

| Datei / Zeile | Träger (`selectionEntryGroup` „Mounts") | Umschließender `selectionEntry` | Constraint-Id |
|---|---|---|---|
| `Vampire Counts (…).cat:1977` | `fe59-4e8b-24e8-3316` | „Master Necromancer" `4ee2-ac3a-3cc6-11af` (`:1949`) | **`6afc-566e-34d4-d35c`** |
| `Vampire Counts (…).cat:2137` | (Mounts des Wight Lord) | „Wight Lord" `b9c6-93fb-ce3c-965a` (`:2107`) | `eafe-0b69-c4eb-55e1` |
| `Vampire Counts (…).cat:2385` | `9ec9-3085-4624-a03a` | „Wraith" `038e-dd7b-f346-178d` (`:2371`) | `6d41-0ff2-892c-993f` |
| `Vampire Counts (…).cat:2541` | (Mounts des Necromancer) | „Necromancer" `b5d8-db21-a4b7-9e94` (`:2485`) | `6681-a071-a9f8-4146` |

Alle vier sind wortgleich:

```xml
<constraint field="selections" scope="bf30-4ff0-a4d8-3909" value="0"
            percentValue="false" shared="true"
            includeChildSelections="true" includeChildForces="true"
            id="6afc-566e-34d4-d35c" type="max"/>
```

**Der Befund:** Die vier Träger sind genau die **vier Nicht-Vampir-Charaktere**
des Buches — und **keiner** von ihnen kann jemals die Kategorie „Strigoi"
tragen. Die Kategorie wird im ganzen Datensatz nur auf zwei Wegen vergeben, und
beide führen an den vieren vorbei:

| Weg | Stelle | Wirkt auf |
|-----|--------|-----------|
| `categoryLink targetId="bf30-4ff0-a4d8-3909"` | **existiert nirgends** — die Id kommt nur als `categoryEntry` (`:41`), in `constraint`/`condition`-Attributen und in `modifier value=…` vor | — |
| `modifier type="add" value="bf30-4ff0-a4d8-3909" field="category"` | `:3080` (bedingt: `atLeast 1 childId="ddfa-0d72-8557-6906" scope="force"`) | „0-1 Vampire Lord" `b77b-88d5-5e80-e178` |
| dito | `:3456` (gleiche Bedingung) | „Vampire Count" `6822-0110-a7c9-cbb0` |
| dito | `:3901` (gleiche Bedingung) | „Vampire Thrall" `e37b-c827-99ac-b706` |
| dito | `:21025` (**unbedingt**) | `selectionEntryGroup` „Vampiric Powers" `0304-9b9c-c3cc-7cbf`, erreichbar nur über die geteilte Gruppe „Bloodline" `0719-24b8-19d4-c832` — und die ist per `entryLink` **ausschließlich** in `b77b…` (`:3013`), `6822…` (`:3390`) und `e37b…` (`:3790`) eingebunden |

Der **Master Necromancer** trägt entsprechend nur zwei `categoryLink`s — „Lord"
`d024-d25b-a9b4-73b6` (primär, `4a65-6d41-e28b-5f3f`) und „Characters"
`7a1c-d611-c2dc-def1` (`e62c-107d-4043-b294`, `:1953-1956`) —, keinen
Kategorie-Modifikator auf `bf30…` und keinen `entryLink` auf die
Bloodline-Gruppe (seine `entryLinks` bestehen aus dem einzigen Eintrag
„General" `5c57-5cd6-a17c-1d0c`, `:2080-2082`).

> **Die In-World-Absicht — und wie das Buch sie an anderer Stelle korrekt
> ausdrückt.** Gemeint war offenkundig „Strigoi reiten nicht". Bei den
> **Vampir**-Charakteren steht genau diese Regel als **Sichtbarkeit** an einer
> `unit`-skopierten Prüfung: die Mounts-Gruppe des Vampire Count
> (`4d14-f8d4-fa17-e738`) trägt `modifier set hidden="true"` mit
> `condition instanceOf value=1 scope="unit" childId="bf30-4ff0-a4d8-3909"`
> (`:3233-3238`). Bei den **vier Nicht-Vampiren** hat der Autor stattdessen die
> Kategorie-Id in den `scope` einer Zählgrenze geschrieben — und da diese vier
> die Kategorie nie tragen, ist die Grenze im Datensatz folgenlos. Dieses
> Szenario prüft die **Datenlage**, nicht die Absicht.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **CSAF-R1** | Der `scope` `bf30-4ff0-a4d8-3909` der Grenze `6afc-566e-34d4-d35c` benennt den **nächsten Vorfahren mit der Kategorie „Strigoi"** (Träger eingeschlossen), nicht das Kontingent und nicht das Roster. | `Vampire Counts (…).cat:1977` — `constraint type="max" value="0" field="selections" scope="bf30-4ff0-a4d8-3909"` an der Gruppe „Mounts" `fe59-4e8b-24e8-3316` (`:1974`) des `selectionEntry` „Master Necromancer" `4ee2-ac3a-3cc6-11af` (`:1949`). `bf30-4ff0-a4d8-3909` ist die `categoryEntry` „Strigoi" (`:41`). Wiki-Zitat oben: *„or any type of ancestor identifier"*. |
| **CSAF-R2** | **Kein Vorfahre der Mounts-Gruppe des Master Necromancer trägt jemals „Strigoi"** — der Rahmen löst nicht auf, die Grenze feuert nie. Die Vorfahrenkette lautet: Mounts-Gruppe → Master Necromancer → Kontingent → Roster. | Master Necromancer: `categoryLinks` nur „Lord"/„Characters" (`:1953-1956`), kein `add category bf30…` (alle vier solchen Modifikatoren stehen an `b77b…`/`6822…`/`e37b…`/`0304…`, s. Tabelle oben), kein `entryLink` auf die Bloodline-Gruppe (`:2080-2082`). Kontingent „Clan Von Carstein (VC-AB)" `b1e4-e1cf-9bd6-2438`: `categoryLinks` `:29313-29325` — kein Ziel `bf30…`. Kein `categoryLink` im ganzen Datensatz zielt auf `bf30…`. |
| **CSAF-R3** | **Ein Strigoi im selben Kontingent ändert daran nichts:** ein Geschwister ist kein Vorfahre. | Die Vorfahrenrelation ist eine Kette nach oben ([§7.7-Kasten](../../battlescribe-data-format.md#scope-unit-ancestor): *„die gesamte strikte Kette, Kontingente eingeschlossen"*). Ein Vampire Count `6822-0110-a7c9-cbb0` mit Strigoi-Kategorie steht im Roster **neben** dem Master Necromancer, nicht über ihm. |
| **CSAF-R4** | Die **parent-skopierte** Grenze derselben Gruppe zählt sehr wohl — und zwar die **Mitglieder der Gruppe**, nicht alle Kinder der Einheit. | `Vampire Counts (…).cat:1976` — `constraint type="max" value="1" field="selections" scope="parent" includeChildSelections="false" id="7e5f-f372-f244-a864"` an derselben Gruppe `fe59…`. [§7.6-Regelkasten](../../battlescribe-data-format.md#76-constraint): *„Eine Grenze an einer `selectionEntryGroup` zählt damit **ihre Mitglieder**, nicht die Gruppe."* Präzedenz: VBL-R2 in [`vampire-bloodlines`](../vampire-bloodlines/README.md). |
| **CSAF-R5** | Die Gruppe „Mounts" `fe59…` bietet drei Reittiere über `entryLink`s an; zwei **verschiedene** davon füllen die Gruppe auf 2, ohne die Eigengrenzen der Einträge zu reißen. | `:1980` `entryLink` „Nightmare" `ba19-24a1-412f-569e` → Ziel `1c56-48e6-7c01-5ae9`; `:1997` `entryLink` „Winged Nightmare" `8378-f691-55c4-42f2` → Ziel `70f3-c286-d1ac-5942`; `:2002` `entryLink` „Zombie Dragon" `2ee8-c3c4-27b0-c668`. Eigengrenzen der Ziele: `3a65-e7fe-b50d-e6d9` (`:13478`, max 1, `scope="parent"`) bzw. `5c99-666c-d942-6cbf` (`:13495`, max 1, `scope="parent"`) — je eine Instanz, also eingehalten. |
| **CSAF-R6** | Die Sichtbarkeit des Master Necromancer und die Sichtbarkeit der Mounts-Gruppen sind **Verfügbarkeit**, keine zählende Schranke — sie stehen **nicht** im Verletzungsbericht. | Master Necromancer: `modifier set hidden="true"` u. a. bei `instanceOf … childId="b1e4-e1cf-9bd6-2438" scope="force"` (`:2088-2104`) — in genau diesem Kontingent ist er also verborgen. Die Gruppe `fe59…` selbst trägt **keine** Modifikatoren (`:1974-2012`). Gleiche Abgrenzung wie VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md) und wie beim verborgenen „Swain" in [`ancestor-scope-instance-of`](../ancestor-scope-instance-of/README.md): Verborgenheit verhindert die Auswertung der Zählgrenzen im Roster nicht. |

### Was ein falscher Bezugsrahmen produzieren würde

Die Roster sind so gebaut, dass jede naheliegende Fehl-Lesart des Kategorie-`scope`
in mindestens einem Fall **sichtbar** wird:

| Fehl-Lesart | Roster 01 | Roster 02 | Roster 03 | Roster 04 |
|---|---|---|---|---|
| Rahmen = **Kontingent** (Kategorie ignoriert) | `6afc…` feuert — im Kontingent stehen Auswahlen, die Grenze ist `max 0` — **fällt auf** | fällt auf | fällt auf | fällt auf |
| Rahmen = **Roster/Kontingent, gefiltert auf die Kategorie** (armeeweite Lesart) | still (kein Strigoi im Roster) | `6afc…` feuert Ist 1 / Grenze 0 — **fällt auf** | still | `6afc…` feuert Ist 2 / Grenze 0 — **fällt auf** |
| Gruppengrenze zählt **alle Kinder der Einheit** statt der Gruppenmitglieder | `7e5f…` feuert (3 direkte Kinder) — **fällt auf** | fällt auf | feuert ohnehin, aber mit `actual` 4 statt 2 — **fällt auf** | fällt auf |
| Gruppe wird **gar nicht** gezählt | still (korrekt, aber unbewiesen) | still | `7e5f…` feuert **nicht** — **fällt auf** | fällt auf |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle vier laufen
gegen **denselben** Datensatz (`.gst` + Vampire Counts `.cat` + Mercenaries `.cat`)
und **dasselbe** Kontingent `b1e4-e1cf-9bd6-2438` mit
`catalogueId="8e66-3042-1d6b-fa6b"` — wie im Nachbarszenario
[`category-scope-bug`](../category-scope-bug/). Das `catalogueId`-Attribut einer
`<force>` ist dabei Roster-Beiwerk; welcher Katalog das Kontingent deklariert hat,
kommt aus der Herkunft der Force-**Definition**
(PCS-R5 in [`primary-catalogue-scope`](../primary-catalogue-scope/README.md)).

> **Assertion-Fokus:** nur die genannten Constraint-Ids. Andere
> Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne Belang —
> namentlich die General-/Core-Pflichten des Kontingents, die restlichen
> Pflicht-Kinder des Master Necromancer (die Gruppe „Lores of Magic"
> `3e50-5f62-a177-304d` mit `min 1` am `entryLink` „Lore of Necromancy"
> `7c6b-9f80-b44d-a824`) und — in den Rostern 02/04 — die im Kontingent „Clan Von
> Carstein" auf `min 1` gehobene Pflicht zur Von-Carstein-Bloodline
> (`2391-243f-5f62-b6b9`, `:5174-5186`), die durch die bewusst gewählte
> Strigoi-Bloodline unerfüllt bleibt.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Ein Reittier, kein Strigoi weit und breit | Master Necromancer (Handweapon, Wizard level 3) + **1 ×** Nightmare aus der Gruppe „Mounts". | **CSAF-R1/R2:** `6afc-566e-34d4-d35c` **absent** — kein Vorfahre trägt Strigoi. **CSAF-R4:** `7e5f-f372-f244-a864` **absent** (ein Gruppenmitglied ≤ 1, obwohl die Einheit drei direkte Kinder hat). Eigengrenze `3a65-e7fe-b50d-e6d9` **absent**. | [`01-necromancer-one-mount-legal.ros`](rosters/01-necromancer-one-mount-legal.ros) |
| 02 | Strigoi im Kontingent — aber als Geschwister | Wie 01, zusätzlich „Bloodlines" mit **Bloodline of Clan Strigoi** und ein **Vampire Count**, der dadurch die Kategorie Strigoi trägt. | **CSAF-R3:** `6afc-566e-34d4-d35c` bleibt **absent** — der Strigoi steht **neben**, nicht **über** der Mounts-Gruppe. `7e5f…` und `3a65…` ebenfalls **absent**. | [`02-strigoi-in-force-not-ancestor.ros`](rosters/02-strigoi-in-force-not-ancestor.ros) |
| 03 | Zwei Reittiere aus derselben Gruppe | Master Necromancer + **Nightmare** *und* **Winged Nightmare**. | **CSAF-R4:** `7e5f-f372-f244-a864` feuert **Ist 2 / Grenze 1**. Die Eigengrenzen `3a65-e7fe-b50d-e6d9` und `5c99-666c-d942-6cbf` (je max 1, je eine Instanz) bleiben **absent**; `6afc-566e-34d4-d35c` bleibt **absent**. | [`03-two-mounts-parent-limit-fires.ros`](rosters/03-two-mounts-parent-limit-fires.ros) |
| 04 | Beides zugleich — der schärfste Kontrast | Strigoi-Bloodline + Strigoi-Vampire-Count **und** zwei Reittiere am Master Necromancer. | Der **parent**-Rahmen zählt 2 → `7e5f-f372-f244-a864` feuert **Ist 2 / Grenze 1**; der **Kategorie**-Rahmen löst weiterhin nicht auf → `6afc-566e-34d4-d35c` **absent** (eine armeeweite Lesart läge hier bei Ist 2 / Grenze 0). `3a65…`, `5c99…` **absent**. | [`04-strigoi-in-force-two-mounts.ros`](rosters/04-strigoi-in-force-two-mounts.ros) |

### Herleitung der Zahlen

`bound` ist in allen Fällen der `value` des Constraints aus dem Katalog
(`7e5f-f372-f244-a864`: `value="1"`; `6afc-566e-34d4-d35c`: `value="0"`).
`actual` folgt aus dem Aufbau der Roster unter dem jeweiligen `scope`:

- **`7e5f…` (`scope="parent"`, `field="selections"`, Träger = Gruppe `fe59…`):**
  gezählt werden die **Mitglieder der Gruppe** im Rahmen der Elternauswahl
  (Master Necromancer). Roster 01/02: ein Mitglied (Nightmare) → 1 ≤ 1, still.
  Roster 03/04: zwei Mitglieder (Nightmare, Winged Nightmare) → **Ist 2**,
  Grenze **1**. Handweapon und Wizard level 3 sind **keine** Mitglieder von
  `fe59…` und zählen daher nicht mit.
- **`6afc…` (`scope="bf30-4ff0-a4d8-3909"`):** der Rahmen ist der nächste
  Vorfahre mit der Kategorie Strigoi. In **allen vier** Rostern gibt es keinen —
  die Grenze hat keinen Rahmen, in dem sie zählen könnte, und erscheint nicht im
  Bericht. Ein `actual`/`bound` ist für sie deshalb gar nicht anzugeben; die
  Erwartung lautet `absent`.
- **`3a65…` / `5c99…` (`scope="parent"` an den Ziel-Einträgen der Reittiere,
  je max 1):** je Roster steht höchstens **eine** Instanz jedes Ziels unter dem
  Master Necromancer → 1 ≤ 1, still. Präzedenz für diese Lesart: ASI-R3 in
  [`ancestor-scope-instance-of`](../ancestor-scope-instance-of/README.md)
  (Steed-Eigengrenze `d84fb948-…` bei einer Instanz **absent**).

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| **Sichtbarkeit (CSAF-R6)** — der Master Necromancer ist im Kontingent „Clan Von Carstein" per `set hidden="true"` verborgen (`:2088-2104`); die Mounts-Gruppe des **Vampire Count** wird per `unit`-skopiertem `instanceOf` auf Strigoi verborgen (`:3233-3238`). | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke. Der Verletzungsbericht kodiert zählende Grenzen; Sichtbarkeit liest man an der Capability-Projektion ab (gleiche Abgrenzung wie VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md)). |
| **Profil- und Namensänderungen** der Strigoi-Bloodline am Vampire Count (`set 5+`/`increment 1` auf Profilwerte, `append "of Clan Strigoi"`, `:3140-3154`, `:3456-3462`). | Profilwerte und effektive Namen stehen nicht im Verletzungsbericht (VBL-R6). Sie sind hier nur der **Weg**, dem Vampire Count die Kategorie Strigoi zu geben, nicht die geprüfte Aussage. |
| **Eine Diagnose für den nicht auflösbaren Kategorie-Rahmen** (etwa `UNRESOLVED_SCOPE` mit `scope="bf30-4ff0-a4d8-3909"`). | Aus den erlaubten Quellen **nicht entscheidbar**: die Formatspezifikation regelt das fail-closed-Verhalten samt Diagnose ausdrücklich nur für `primary-catalogue` ([§7.6-Kasten](../../battlescribe-data-format.md#scope-primary-catalogue)) und für `unit` ohne umschließende Einheit ([§7.7-Kasten](../../battlescribe-data-format.md#scope-unit-ancestor)); für eine Kategorie-Id im `scope`, die auf keinen Vorfahren passt, sagt sie nichts. Dieses Szenario fordert deshalb **weder** die Anwesenheit **noch** die Abwesenheit einer solchen Diagnose — nur, dass die Grenze **nicht feuert**. Sollte das Verhalten normativ festgelegt werden, gehört hier eine `diagnostics`-Erwartung ergänzt. |
| **Die drei Schwester-Constraints** `eafe-0b69-c4eb-55e1` (Wight Lord), `6d41-0ff2-892c-993f` (Wraith), `6681-a071-a9f8-4146` (Necromancer). | Wortgleich zu `6afc…` und mit derselben Datenlage (auch diese drei Träger bekommen nie die Kategorie Strigoi) — als Beleg oben aufgeführt, aber nicht als eigene Roster gebaut: sie brächten keinen neuen Fall, nur Wiederholung. |
| **Eine Gegenprobe „Rahmen löst auf"** (ein Roster, in dem ein Vorfahre die Kategorie *trägt* und die Grenze deshalb feuert). | Im Fixture-Satz **nicht baubar**: alle vier Kategorie-skopierten Constraints hängen an Einträgen, die die genannte Kategorie nie erhalten können (s. Datenlage oben). Ein solcher Fall müsste erfunden werden — das wäre kein Test an echten Katalogdaten mehr. Die positive Richtung des Mechanismus deckt stattdessen die **Eintrags-Id**-Ausprägung ab (Profil-Conditions `scope="6822-0110-a7c9-cbb0"`, `:3132-3152`) bzw. das Nachbarszenario [`ancestor-scope-instance-of`](../ancestor-scope-instance-of/README.md). |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Vampire Counts** | `4d73-5ab0-9020-403c` |
| Bibliothek **Mercenaries** (per `catalogueLink` `ef73-f9bd-e250-54d2`) | `fc47-8392-a6c8-452a` |
| ForceEntry „Clan Von Carstein (VC-AB)" (`:29312`) | `b1e4-e1cf-9bd6-2438` |
| `publication` „VC-AB" (das im `.ros` als `catalogueId` mitgeführte Beiwerk, `:4`) | `8e66-3042-1d6b-fa6b` |
| `categoryEntry` „Strigoi" (`:41`) | `bf30-4ff0-a4d8-3909` |
| SelectionEntry „Master Necromancer" (`:1949`) | `4ee2-ac3a-3cc6-11af` |
| — dessen `categoryLink`s „Lord" / „Characters" | `4a65-6d41-e28b-5f3f` → `d024-d25b-a9b4-73b6` / `e62c-107d-4043-b294` → `7a1c-d611-c2dc-def1` |
| — dessen Pflicht-Kind „Handweapon" (min `b1f6-6649-de74-f4d5` / max `3a41-f8a3-c341-7e87`) | `c4a5-f61d-e7da-8d5c` |
| — dessen Gruppe „Wizard Level" (min 1 `4599-666f-72d3-1822` / max 1 `a73d-88e2-3f75-e335`) | `22be-1719-8e8a-96dc` — gewählt: „Wizard level 3" `c39e-3f58-0fbd-3a04` |
| `selectionEntryGroup` „Mounts" des Master Necromancer (`:1974`) | `fe59-4e8b-24e8-3316` |
| — **parent**-Grenze max 1 (`:1976`) | `7e5f-f372-f244-a864` |
| — **Kategorie**-Grenze max 0, `scope="bf30-4ff0-a4d8-3909"` (`:1977`) | `6afc-566e-34d4-d35c` |
| `entryLink` „Nightmare" in der Gruppe (`:1980`) / dessen Ziel | `ba19-24a1-412f-569e` / `1c56-48e6-7c01-5ae9` |
| — Eigengrenze des Ziels (max 1, `scope="parent"`, `:13478`) | `3a65-e7fe-b50d-e6d9` |
| `entryLink` „Winged Nightmare" in der Gruppe (`:1997`) / dessen Ziel | `8378-f691-55c4-42f2` / `70f3-c286-d1ac-5942` |
| — Eigengrenze des Ziels (max 1, `scope="parent"`, `:13495`) | `5c99-666c-d942-6cbf` |
| SelectionEntry „Bloodlines" (`:5094`) / Gruppe „Vampiric Bloodline" (`:5099`) | `a56a-eb32-5a45-16fd` / `5655-13ba-8980-bd1c` |
| „Bloodline of Clan Strigoi" (`:5153`) | `ddfa-0d72-8557-6906` |
| „Bloodline of Clan Von Carstein" (`:5169`) — im Kontingent `b1e4…` per `set 1` Pflicht | `f557-097a-d26b-9363` — constraint `2391-243f-5f62-b6b9` |
| SelectionEntry „Vampire Count" (`:3124`) — bekommt Strigoi per `add category` (`:3456`) | `6822-0110-a7c9-cbb0` |
| — dessen `categoryLink`s „Lord"/„Characters"/„Vampire" (`:3172-3176`) | `a707-fa03-c001-c040` / `a790-7e28-f678-2eb4` / `f398-ef23-f63b-4aa6` → `017d-3857-a815-782f` |
| — dessen Gruppe „Mounts" (per `unit`-Prüfung auf Strigoi **verborgen**, `:3229-3238`) | `4d14-f8d4-fa17-e738` — Grenze `773d-ede5-5208-454c` |
| Weitere Träger von `add category bf30…`: „0-1 Vampire Lord" / „Vampire Thrall" / Gruppe „Vampiric Powers" | `b77b-88d5-5e80-e178` / `e37b-c827-99ac-b706` / `0304-9b9c-c3cc-7cbf` |
| Geteilte Gruppe „Bloodline" (Trägerin der Strigoi-Powers, nur in `b77b…`/`6822…`/`e37b…` verlinkt) | `0719-24b8-19d4-c832` |
| Schwester-Constraints mit demselben Kategorie-`scope` (Wight Lord / Wraith / Necromancer) | `eafe-0b69-c4eb-55e1` / `6d41-0ff2-892c-993f` / `6681-a071-a9f8-4146` |
