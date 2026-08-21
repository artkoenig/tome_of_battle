# E2E-Regeln & Testkatalog: `instanceOf` mit `scope="parent"` — das Sky-Chariot-Gatter

**Rolle:** Black-Box-Test (kein Blick in den Engine-Quellcode). Alle Regeln,
Grenz-Ids, Ist- und Grenzwerte sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* (`src/domain/evaluator/__fixtures__/whfb6-definitive/`), der
Format-Doku [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
und der vendorten `Catalogue.xsd` **abgeleitet** — nicht aus einem Engine-Lauf.
Die Roster-Form folgt der in bestehenden Szenarien verifizierten Gestalt
(direktes `entryId` mit leerem `entryLinkId` für eine Wurzel-/Inline-Definition,
`entryId`=Ziel-Id **+** `entryLinkId`=Verweis-Id bei einem `entryLink`,
verschachtelte `selections` mit `number`, `<costLimits><costLimit …/></costLimits>`
für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`,
  rev 1) — Kontingente **„Army of the Lichemaster (WD#309-UK)"**
  `f37a-a93e-fa22-61a8` (`:29441`) und **„Clan Lahmia (VC-AB)"**
  `2102-34f1-c876-98c5` (`:29403`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `<catalogueLink … targetId="fc47-8392-a6c8-452a"/>` (`:29511`) erklärte
  Abhängigkeit des Armeebuchs; ohne sie wäre der Datensatz unvollständig.

Das Umfeld der beiden Sonderheer-Pflichten (Kemmler, Krell, Budget-Eigengrenze,
Core-/General-Pflicht der `.gst`) ist bereits in
[`../set-unresolved-target-inert-lord-slot/`](../set-unresolved-target-inert-lord-slot/README.md)
aus denselben Daten hergeleitet; dieses Szenario **übernimmt** jene Herleitung,
statt sie zu wiederholen, und zitiert sie unten in der Beiwerk-Tabelle.

---

## Worum es geht

Eine `condition` ist laut
[§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)
ein Vergleich über einen Bezugsrahmen. Für die Typen `instanceOf`/`notInstanceOf`
ist sie aber **keine Zählung, sondern eine Identitäts-/Mitgliedschaftsprüfung** —
so ausdrücklich für `scope="primary-catalogue"`
([Kasten in §7.6](../../battlescribe-data-format.md#scope-primary-catalogue):
„Die Frage lautet nicht ‚wie viele?', sondern ‚ist es dieses?'") und für
`scope="ancestor"`
([Kasten in §7.7](../../battlescribe-data-format.md#scope-unit-ancestor):
„`ancestor` ist kein Zählrahmen, sondern — wie `primary-catalogue` — eine
Prüfung"); `percentValue` ist bei `instanceOf` laut derselben Tabelle „ohne
Wirkung". Für `scope="parent"` heißt das: die Bedingung hält genau dann, wenn der
**Eltern-Rahmen** — die Auswahl, unter der der Träger hängt — auf die in `childId`
genannte Definition auflöst. `scope="parent"` vergleicht dabei **aufgelöste
Ziel-IDs**, nicht `entryLinkId`s
([§3.4](../../battlescribe-data-format.md#34-kontext-threading) /
[§7.6](../../battlescribe-data-format.md#76-constraint)).

Der eingefrorene Korpus enthält **genau ein** Vorkommen dieser Konstruktion
(Volltextsuche über alle fünf Dateien nach `type="instanceOf" … scope="parent"`
und nach `scope="parent" … type="instanceOf"`; einziger weiterer parent-skopierter
Instanz-Test ist ein `notInstanceOf` in `Mercenaries (…).cat:4101`):

```xml
<!-- Vampire Counts (…).cat:20454-20476 -->
<selectionEntry type="upgrade" name="Sky Chariot" hidden="true" id="33bd-1a1e-a286-60ac" …>
  <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="50"/> … </costs>
  <modifiers>
    <modifier type="set" value="false" field="hidden">
      <conditionGroups>
        <conditionGroup type="and">
          <conditions>
            <condition type="instanceOf" value="1" field="selections" scope="parent"
                       childId="0b24e6f4-0f37-4243-a0a5-99e723692dc3" shared="true"
                       includeChildSelections="true" childName="Tomb Prince [KHEMRI]"/>
            <condition type="instanceOf" value="1" field="selections" scope="force"
                       childId="f37a-a93e-fa22-61a8" shared="true" includeChildSelections="true"/>
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifier>
  </modifiers>
</selectionEntry>
```

Das ist eine **`and`-Gruppe aus zwei Instanzprüfungen**: „mein Träger ist der Tomb
Prince" **und** „mein Kontingent ist das Lichemaster-Heer". Nur wenn beides gilt,
ersetzt der Modifikator den Basiswert `hidden="true"` durch `false`.

### Wie man an den Sky Chariot herankommt (Erreichbarkeits-Herleitung)

Der Sky Chariot steht in `<sharedSelectionEntries>` (`:20454`, zwischen `:13467`
und `:20861`) und ist damit **kein** Wurzel-Eintrag: er ist nur über einen
`entryLink` erreichbar. Volltextsuche nach `33bd-1a1e-a286-60ac` liefert genau
**zwei** Treffer — die Definition selbst und **einen** Verweis:

```xml
<!-- Vampire Counts (…).cat:23819-23829, sharedSelectionEntryGroups -->
<selectionEntryGroup name="Enchanted Items (Lichemaster)" id="81c5-7ea4-7cb5-61d4" hidden="false" …>
  <entryLinks>
    <entryLink name="Charm of Defiance" hidden="false" id="7014-1ec5-46b7-36e5" type="selectionEntry" targetId="94d1-a517-f236-7812"/>
    <entryLink name="Sky Chariot"       hidden="false" id="472e-d107-b0dc-c51a" type="selectionEntry" targetId="33bd-1a1e-a286-60ac"/>
    …
  </entryLinks>
  <constraints>
    <constraint type="max" value="1" field="selections" scope="parent" shared="true"
                id="7ef4-7ce1-e1da-22ea" includeChildSelections="false"/>
  </constraints>
</selectionEntryGroup>
```

Und die Gruppe `81c5-7ea4-7cb5-61d4` wird ihrerseits von genau **zwei** Stellen
verlinkt (Volltextsuche nach der Gruppen-Id):

| Verweis auf die Gruppe | steht in | Umschließender Wurzel-Eintrag |
|---|---|---|
| `0406-f097-c5d3-e51c` (`:2644`) | Gruppe „Magic Items" `b4e0-9f6b-30b0-346e` (`:2641`, `hidden="true"`, im Lichemaster-Kontingent per `set hidden=false` aufgedeckt, `:2656`) | **Necromancer** `b5d8-db21-a4b7-9e94` (`:2485`–`:2712`) |
| `d6b3-7aaa-5cd2-d026` (`:12215`) | Gruppe „Magic Items" `7611-df97-0864-39a3` (`:12212`, `hidden="true"`, ebenso aufgedeckt, `:12225`) | **Tomb Prince [KHEMRI]** `0b24e6f4-0f37-4243-a0a5-99e723692dc3` (`:12061`–`:12280`) |

Damit ist das Paar aus den Daten **bestimmt, nicht gewählt**: Der Sky Chariot kann
im ganzen Datensatz nur unter genau diesen zwei Einheiten hängen — unter einer
davon deckt ihn die `and`-Gruppe auf, unter der anderen nicht. Beide Wege führen
**ausschließlich über `selectionEntryGroup`s** (Unit → „Magic Items" → „Enchanted
Items (Lichemaster)" → Verweis); Gruppen erzeugen keine Selektion in der Roster
([§4](../../battlescribe-data-format.md#4-das-objektmodell-im-überblick)), der
Eltern-**Rahmen** der Bedingung ist also unmittelbar die Einheit.

### Ist der Tomb Prince außerhalb des Lichemaster-Kontingents erreichbar?

**Ja — an genau einer Stelle.** Der Tomb Prince ist selbst `hidden="true"`
(`:12061`) und wird auf zwei Wegen aufgedeckt:

1. **Als Wurzel-Eintrag** (er steht in `<selectionEntries>`, `:70`–`:13466`): die
   `modifierGroup` `:12258-12271` setzt — gegatet auf `instanceOf scope="force"
   childId="f37a-a93e-fa22-61a8"` — `hidden=false`, den Namen auf „Barrow King",
   fügt die Kategorie „Characters" `7a1c-d611-c2dc-def1` hinzu und hebt seine
   eigene Grenze `3d9d-764e-6661-91ed` von `min 0` auf **1**. Er ist im
   Lichemaster-Kontingent also nicht nur sichtbar, sondern **Pflicht**.
2. **Als Verweis unter „Swain"**: `entryLink c7e0-a4dc-65a2-7fd0` (`:9808`) in der
   Gruppe „Tomb Kings" `75da-b518-329e-5f55` (`:9646`) innerhalb der Gruppe „Hero
   from another faction" `09bf-a395-daf9-7e25` (`:5216`) der Einheit **Swain**
   `b920-b398-dc26-7f4d` (`:5210`–`:10078`). Dieser Verweis trägt einen eigenen
   `set hidden=false` mit der Bedingung `instanceOf scope="force"
   childId="2102-34f1-c876-98c5"` (`:9810-9814`) — dem Kontingent **„Clan Lahmia
   (VC-AB)"** (`:29403`). Swain selbst wird für dasselbe Kontingent aufgedeckt
   (`:10057-10062`).

Weitere Vorkommen der Tomb-Prince-Id gibt es im Korpus nicht (drei Treffer
insgesamt: Definition, Verweis, `childId` der hier untersuchten Bedingung). Damit
ist Roster 05 **kein konstruierter Sonderfall**, sondern der einzige von den Daten
angebotene Weg, denselben Träger in einem anderen Kontingent zu stellen. Es ist
zugleich der **einzige** Roster dieses Szenarios, dessen Träger **selbst** über
einen Verweis hängt — mit Folgen für die Adressierung des Slots, siehe
[„Bewusst offen gelassen"](#bewusst-offen-gelassen).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **IOPSC-R1** | `instanceOf` mit `scope="parent"` prüft die **Identität des Eltern-Rahmens**, nicht eine Anzahl. Sie hält genau dann, wenn die Auswahl, unter der der Träger hängt, auf `childId` auflöst. | `:20469`: `type="instanceOf" value="1" field="selections" scope="parent" childId="0b24e6f4-…" childName="Tomb Prince [KHEMRI]"`. Semantik aus [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) (Condition-Tabelle: `percentValue` bei `instanceOf` „ohne Wirkung") und den beiden Prüf-Kästen zu `primary-catalogue` / `ancestor`. Roster 01/03 (hält) gegen 02/04 (hält nicht). |
| **IOPSC-R2** | Die **`and`-Gruppe** verlangt beide Hälften. Fällt die **parent**-Hälfte, bleibt der Basiswert `hidden="true"` stehen — auch wenn das Kontingent stimmt. | `:20466-20473`: eine `conditionGroup type="and"` mit genau zwei `condition`s; eine `and`-Gruppe hält, wenn **alle** Mitglieder halten ([§7.7](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen)). Roster 02/04: Kontingent `f37a`, Träger Necromancer ⇒ `isHidden true`. |
| **IOPSC-R3** | Fällt die **force**-Hälfte, gilt dasselbe — auch wenn der Träger stimmt. | Roster 05: Träger ist derselbe Tomb Prince, Kontingent ist `2102-34f1-c876-98c5`. Die zweite Bedingung (`scope="force" childId="f37a-a93e-fa22-61a8"`, `:20470`) hält nicht ⇒ `isHidden true`. |
| **IOPSC-R4** | Hält die Gruppe, **ersetzt** der Modifikator `hidden` exakt durch `false` — der Slot ist sichtbar. | `:20465` `type="set" value="false" field="hidden"`; `set` überschreibt ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)). Roster 01/03/06 ⇒ `isHidden false`. |
| **IOPSC-R5** | Das Gatter ist eine Aussage über **diesen Slot**, nicht über den Rahmen. Der ungegatete Nachbar **„Charm of Defiance"** derselben Gruppe ist in **jedem** dieser Rahmen sichtbar. | `:23821` `entryLink 7014-1ec5-46b7-36e5 → 94d1-a517-f236-7812`; das Ziel (`:20489`) ist `hidden="false"` und trägt **keinen** Modifikator. Roster 01/02/06 als `capabilities.isHidden: false`. |
| **IOPSC-R6** | Die Sichtbarkeit erzeugt **keine Grenze**. Weder der Verweis noch der Zieleintrag trägt ein `constraint`; der Sky Chariot kann deshalb **nie** als `limitId` im Verletzungsbericht stehen. | `:23822` (`entryLink` ohne `<constraints>`) und `:20454-20476` (der `selectionEntry` enthält nur `infoLinks`, `costs`, `modifiers`). Erwartet als `effectiveMin: null` / `effectiveMax: null`. Grenzen entstehen ausschließlich aus `constraint`-Elementen ([§7.6](../../battlescribe-data-format.md#76-constraint)). |
| **IOPSC-R7** | Ein verborgener Slot bleibt **wählbar**: der Katalog verbietet die Wahl nicht zählend, sondern nur über die Verfügbarkeit. Eine trotzdem getroffene Wahl erscheint im Bericht — als belegter Slot mit `isHidden true`. | Es gibt keine Grenze am Slot (IOPSC-R6) und keine, die ihn von außen deckelt (die Gruppengrenze `7ef4-…` ist ein `max 1` und bei einem Mitglied erfüllt). [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) / Issue 0088 kennt nur die Umkehrung: **Min**-Grenzen einer versteckten Entität werden nicht validiert. Roster 04/05. |
| **IOPSC-R8** | **Gegenprobe (Lebendigkeit):** Der Rahmen wird tatsächlich ausgewertet und der Sky-Chariot-Slot zählt in ihm mit — zwei Mitglieder derselben Gruppe reißen deren echte Grenze. | `:23828` `constraint type="max" value="1" field="selections" scope="parent" shared="true" id="7ef4-7ce1-e1da-22ea"`; eine Grenze an einer Gruppe zählt **ihre Mitglieder** ([§7.6](../../battlescribe-data-format.md#76-constraint), Regelkasten). Roster 06: Ist **2** / Grenze **1**. |
| **IOPSC-R9** | Der Tomb Prince ist im Lichemaster-Kontingent **Pflicht**; steht er nicht darin, feuert seine eigene Grenze. Das ist zugleich der Zeuge dafür, dass die Engine seine Anwesenheit registriert. | `:12253` `constraint type="min" value="0" field="selections" scope="force" shared="true" id="3d9d-764e-6661-91ed"`, per `:12262` `set 1` in der auf `f37a` gegateten `modifierGroup`. Roster 02/04: **feuert** 0/1. Roster 01/03/06: still (Ist 1). Roster 05 (Clan Lahmia): der `set` greift nicht, die Grenze bleibt `min 0` und ist nie verletzbar ⇒ `absent`. |

### Was in beiden Kontingenten sonst noch Pflicht ist — und wie dieses Szenario damit umgeht

| Grenze | Herkunft | Wert | Wie die Roster damit umgehen |
|--------|----------|------|------------------------------|
| `760d-2352-9fac-0e46` (Lord-`categoryLink` des Lichemaster-Heeres) | `:29452`, `min 1`, `field=selections`, `scope=parent` | 1 | Alle Lichemaster-Roster: **feuert** 0/1 — weder Tomb Prince (`Heroes`, `:12112`) noch Necromancer (`Heroes`, `:2508`) ist ein Lord. Bewusst so gelassen: ein Lord würde nur Rauschen hinzufügen. |
| `8461-3eab-e5ac-1636` (Kemmler) / `60a8-5b49-6b81-7c84` (Krell) | Basis `min 0`, per `set 1`, wenn das Kontingent `f37a` ist und **nicht** (Budget < 2000 **und** Kampagne gewählt) — hergeleitet in [`../set-unresolved-target-inert-lord-slot/`](../set-unresolved-target-inert-lord-slot/README.md) | 1 / 1 | Alle Lichemaster-Roster: **feuert** je 0/1 (Budget 3000, keine Kampagne). |
| `35c2-d478-392a-aeb1` (Kategorie „Core", `min`) | `.gst:374` Basis `min 2`, per `.gst:395` `set 4` für die Klasse 3000–3999 | 4 | In **allen** Rostern **feuert** sie 0/4; keine Auswahl trägt die Kategorie „Core". |
| `1077-7379-f142-f382` / `d818-c60d-b1f8-8aaa` (Kategorie „General") | `.gst:724` / `.gst:723`, `min 1` / `max 1`, `scope=force` | 1 / 1 | Kein Roster wählt einen „General": `1077-…` **feuert** 0/1, `d818-…` bleibt still (0 ≤ 1) ⇒ `absent`. |
| `7ef4-7ce1-e1da-22ea` (Gruppe „Enchanted Items (Lichemaster)", `max 1`) | `:23828` | 1 | Roster 01–05: 0 bzw. 1 Mitglied ⇒ `absent`. Roster 06: **feuert** 2/1 (IOPSC-R8). |
| `8471-437a-59d6-bc3d` (Lord-`categoryLink` des Vampire-Coast-Heeres) | `:29482` | 1 | Gehört einem Kontingent, das hier **nie** gewählt ist ⇒ in allen Rostern `absent`. Detektor gegen eine kontingent-übergreifende Fehl-Auswertung. |

### Warum die Roster ein Budget von 3000 Punkten setzen

1. **Das Lichemaster-Heer fordert selbst mindestens 2000 Punkte**: `:29461`
   `constraint min 0 field="limit::ecfa-8486-4f6c-c249" scope="roster"
   id="8f3f-ffa8-387b-0bf9"`, per `:29464` auf `2000` gesetzt, wenn das Kontingent
   `f37a` ist ([§5.6](../../battlescribe-data-format.md#56-force-entries-detachments)).
2. **Die Core-Untergrenze ist damit eindeutig 4** (`.gst:395`, Klasse 3000–3999) —
   dieselbe Klasse für **alle** sechs Roster, auch das Clan-Lahmia-Roster, damit
   der deklarierte `bound` überall derselbe ist.
3. Die Punktesummen (150 / 120 / 165 …) bleiben weit unter dem Budget; das
   Punktelimit spielt hier nur als Klassenschalter eine Rolle.

### Zahlenbasis der Roster

Jede Auswahl trägt `number="1"`. Damit ist die in
[§7.5](../../battlescribe-data-format.md#75-cost--cost-type) benannte Lücke
(„ist `.ros`-`number` per-Eltern-relativ oder absolut?") für dieses Szenario
**folgenlos**: `1 × 1 = 1` in beiden Lesarten.

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | Wo sie auffällt |
|---|---|
| `instanceOf scope="parent"` wird als **Zählung** gelesen („mindestens `value`=1 Tomb Princes im Eltern-Rahmen") | Roster 02/04: unter dem Necromancer stünde 0 — zufällig dasselbe Ergebnis. Roster 05 dagegen trennt: dort zählte der Rahmen den Tomb Prince **nicht** (die Bedingung zählt Nachkommen des Rahmens, der Tomb Prince **ist** der Rahmen) — eine zählende Lesart machte den Slot dort erst recht verborgen, aber auch in **01/03/06**, wo er sichtbar sein muss. |
| Der Eltern-Rahmen wird an der **`entryLinkId`** statt an der aufgelösten **Ziel-Id** festgemacht | Roster 05: dort kommt der Tomb Prince über den Verweis `c7e0-a4dc-65a2-7fd0`, in 01/03/06 direkt — die parent-Hälfte muss in beiden Fällen halten ([§3.4](../../battlescribe-data-format.md#34-kontext-threading)). |
| Als Eltern-Rahmen wird die **tragende Gruppe** (`81c5-…` oder `7611-…`) genommen statt der umschließenden Auswahl | Dann hielte die parent-Hälfte **nirgends** ⇒ Roster 01/03/06 meldeten `isHidden true`. |
| Die `and`-Gruppe wird als `or` gelesen | Roster 02/04 (Kontingent stimmt) und Roster 05 (Träger stimmt) meldeten fälschlich `isHidden false`. |
| Das `hidden`-Gatter wird als **Grenze** modelliert | Der Sky Chariot erschiene mit `effectiveMin`/`effectiveMax` ≠ `null` — beide Slots sind im Katalog grenzenlos (IOPSC-R6). |
| Der Rahmen wird **gar nicht ausgewertet** („nichts sichtbar" = „nichts gemessen") | Roster 06: die echte Gruppengrenze `7ef4-…` feuert 2/1. |

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Vampire-Counts-`.cat` + die per `catalogueLink`
benötigte `Mercenaries`-`.cat`). Das `catalogueId`-Attribut einer `<force>` ist
Roster-Beiwerk; welcher Katalog das Kontingent deklariert hat, kommt aus der
Herkunft der Force-**Definition**.

> **Assertion-Fokus:** der Sky-Chariot-Slot (`defId 472e-d107-b0dc-c51a`,
> `targetDefId 33bd-1a1e-a286-60ac`) mit seinem `isHidden`, der ungegatete
> Nachbar-Slot, die echte Gruppengrenze und die oben tabellierten Pflichtgrenzen.
> Andere Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne
> Belang — namentlich die Pflicht-Kinder des Tomb Prince im Lichemaster-Kontingent
> („Chariot" `f718-ec10-5f41-dfe6` auf 1 gesetzt, `:12145`; „Great Weapon"
> `0074-af8d-c145-c446` und „Heavy Armour" `fb8c-a9bb-445b-f37c` in der dort
> aufgedeckten Gruppe `832515ba-…`, `:12201`/`:12207`), die Pflicht-Kinder des
> Necromancers („Handweapon" `2525-273c-d3f1-cd1f`, Gruppe „Wizard Level"
> `03cf-1c4e-cf6f-0dad`), die Sonderlisten-Pflicht `d7ca-7e6b-7a46-617f`
> („The Army of the Lichemaster", `:12289`/`:12298`) sowie die Eigengrenze des
> Kontingents auf `limit::pts` (`8f3f-ffa8-387b-0bf9`).

| # | Roster-Zustand | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|----------------|---------------------------------------------------|---------|
| 01 | Kontingent **Lichemaster**, Budget 3000, **Tomb Prince**; Sky Chariot **nicht** gewählt | **IOPSC-R1/R4:** beide Hälften halten ⇒ der Angebots-Slot ist **sichtbar** (`isHidden false`), ohne Grenzen (`effectiveMin`/`effectiveMax` `null`). **IOPSC-R5:** der Nachbar „Charm of Defiance" ebenfalls sichtbar. **IOPSC-R9:** `3d9d-…` still. Deklariertes Beiwerk: `760d-…` 0/1, `8461-…` 0/1, `60a8-…` 0/1, `35c2-…` 0/**4**, `1077-…` 0/1. | [`01-lichemaster-tomb-prince-offer-visible.ros`](rosters/01-lichemaster-tomb-prince-offer-visible.ros) |
| 02 | Wie 01, aber Träger ist der **Necromancer** (die einzige andere Einheit, die dieselbe Gruppe verlinkt) | **IOPSC-R2:** die parent-Hälfte fällt ⇒ derselbe Slot ist **verborgen** (`isHidden true`), während der Nachbar sichtbar bleibt (**IOPSC-R5**) — der Unterschied liegt am Slot, nicht am Rahmen. **IOPSC-R9:** ohne Tomb Prince feuert `3d9d-…` 0/1. | [`02-lichemaster-necromancer-offer-hidden.ros`](rosters/02-lichemaster-necromancer-offer-hidden.ros) |
| 03 | Wie 01, Sky Chariot **gewählt** (50 pts) | Derselbe Slot einmal **belegt** statt angeboten: `isHidden false`, `current 1`. Die Aussage hängt am Eltern-Rahmen, nicht an der Herkunft des Slots. `7ef4-…` (max 1) still bei einem Mitglied. | [`03-lichemaster-tomb-prince-selected-visible.ros`](rosters/03-lichemaster-tomb-prince-selected-visible.ros) |
| 04 | Wie 02, Sky Chariot **gewählt** | **IOPSC-R7:** die Wahl ist möglich (keine Grenze verbietet sie) und erscheint im Bericht — als belegter Slot mit `isHidden true`. Trennt „nicht anwählbar" von „nicht auswertbar". | [`04-lichemaster-necromancer-selected-hidden.ros`](rosters/04-lichemaster-necromancer-selected-hidden.ros) |
| 05 | Kontingent **Clan Lahmia**, **Swain → Tomb Prince** (Verweis `c7e0-…`) → Sky Chariot **gewählt** | **IOPSC-R3:** derselbe Träger, anderes Kontingent ⇒ die force-Hälfte fällt, `isHidden true`. **IOPSC-R9:** `3d9d-…` bleibt hier auf `min 0` ⇒ `absent`, ebenso die übrigen Lichemaster-Pflichten. *Einziger Roster ohne `frameDefId` in der Slot-Adresse — Begründung unten.* | [`05-clan-lahmia-tomb-prince-selected-hidden.ros`](rosters/05-clan-lahmia-tomb-prince-selected-hidden.ros) |
| 06 | Wie 03, zusätzlich **„Charm of Defiance"** (15 pts) aus derselben Gruppe | **IOPSC-R8 (Gegenprobe):** `7ef4-7ce1-e1da-22ea` feuert **Ist 2 / Grenze 1** — der Rahmen wird ausgewertet und der Sky-Chariot-Slot zählt in ihm mit. Sichtbarkeit beider Slots unverändert. | [`06-lichemaster-tomb-prince-two-enchanted-items.ros`](rosters/06-lichemaster-tomb-prince-two-enchanted-items.ros) |

### Herleitung der Zahlen

- **`isHidden`** ist kein Zahlenwert, sondern die Auswertung des Basiswerts
  `hidden="true"` (`:20454`) gegen den einen `set hidden=false`-Modifikator
  (`:20465`) unter seiner `and`-Gruppe. Der Verweis `472e-…` trägt — wie jeder
  `entryLink` der Kataloge — `hidden="false"`; nach
  [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) (Verweis
  **oder** Ziel versteckt ⇒ Vorkommen versteckt) entscheidet damit das Ziel.
- **`effectiveMin`/`effectiveMax` = `null`** folgt daraus, dass es zu diesem Slot
  überhaupt keine Grenze gibt (IOPSC-R6) — dieselbe Lesart wie beim
  grenzenlosen Heroes-Slot in
  [`../set-unresolved-target-inert-lord-slot/`](../set-unresolved-target-inert-lord-slot/README.md).
- **`7ef4-7ce1-e1da-22ea`: Ist 2 / Grenze 1** — der geschriebene `value` ist 1 und
  kein Modifikator im Korpus nennt diese Id als `field`; gezählt werden die
  Mitglieder der Gruppe unter dem Träger, in Roster 06 also Sky Chariot **und**
  Charm of Defiance.
- **`3d9d-764e-6661-91ed`: Grenze 1** — Basis `min 0` (`:12253`), im
  Lichemaster-Kontingent per `set 1` (`:12262`); Ist ist die Zahl der
  Tomb-Prince-Auswahlen im Kontingent (0 bzw. 1).
- **Core `bound` 4** = `.gst`-Basis `min 2` (`:374`), überschrieben durch den
  `set 4` der Klasse 3000–3999 (`:395`); Ist 0, weil keine Auswahl der Roster die
  Kategorie „Core" trägt.

### Wie die Slots adressiert werden

Der Manifest-Vertrag verlangt, dass eine `capabilities`-Aussage **genau einen**
Slot trifft, und bietet dafür `defId`, `targetDefId`, `anchorKind`, `frameDefId`
und `path` an. Dieses Szenario nutzt:

- **`defId` = die Id des `entryLink`** (`472e-d107-b0dc-c51a` bzw.
  `7014-1ec5-46b7-36e5`) — der Vertrag sagt ausdrücklich „die eigene Definition
  des Slots; bei einem Verweis-Slot der **VERWEIS**" —, **`targetDefId`** = die Id
  des verwiesenen Eintrags (`33bd-1a1e-a286-60ac` bzw. `94d1-a517-f236-7812`).
- **`anchorKind`** = `offerAnchor`, wo der Verweis nicht gewählt ist (Roster
  01/02), `occupied`, wo er gewählt ist (03–06).
- **`frameDefId`** = die Id des Trägers, unter dem der Slot hängt — in den Rostern
  01–04 und 06 der **Wurzel-Eintrag** `0b24e6f4-…` (Tomb Prince) bzw.
  `b5d8-db21-a4b7-9e94` (Necromancer). In Roster 05 **fehlt** diese Koordinate
  bewusst; die Begründung steht in der nächsten Tabelle.

---

### Nicht als feuernde Grenze erwartet

- **Die Sichtbarkeit selbst.** `hidden` ist keine zählende Schranke und erscheint
  nicht im Verletzungsbericht (Konvention der bestehenden Szenarien, vgl.
  [`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md), VBL-R4/R5;
  ebenso [`../set-hidden-force-gate/`](../set-hidden-force-gate/README.md)). Sie
  wird hier ausschließlich als `capabilities.isHidden` festgehalten — dort ist sie
  eine Slot-Aussage, keine Grenze.
- **Der Sky Chariot als `limitId`.** Er trägt kein `constraint` (IOPSC-R6) und
  kann deshalb nie als Grenze im Bericht stehen.
- **Profilwerte.** Der Sky Chariot bringt zwei Regeln per `infoLink` mit („Sky
  Chariot" `8102-b15a-4467-837e`, „Fly" `e930-0b71-2fef-3937`, `:20456-20457`),
  aber keinen Profil-Modifikator; die Info-Projektion ist nicht Gegenstand dieses
  Szenarios (dafür gibt es [`../info-projection/`](../info-projection/README.md)).
- **Autor-Meldungen** (`field="error"/"warning"/"info"`) tragen
  `origin="authorMessage"` und keine `limitId`; sie gehören nicht in
  `firing`/`absent`.

### Bewusst offen gelassen

| Facette | Warum |
|---------|-------|
| **Die Rahmen-Koordinate (`frameDefId`) des Sky-Chariot-Slots in Roster 05** | Roster 05 ist der einzige, dessen **Träger selbst über einen Verweis** hängt: der Tomb Prince kommt dort als `entryLink c7e0-a4dc-65a2-7fd0` unter der Einheit „Swain" `b920-b398-dc26-7f4d`, in 01–04/06 dagegen als Wurzel-Auswahl. Ob ein so erreichter Rahmen mit der **Verweis-Id** (`c7e0-…`) oder mit der **Ziel-Id** (`0b24e6f4-…`) adressiert wird, ist aus den erlaubten Quellen **nicht** zu entscheiden: der Manifest-Vertrag trifft die Unterscheidung „bei einem Verweis-Slot der VERWEIS" ausdrücklich nur für das **`defId` des Slots selbst** und beschreibt `frameDefId` bloß als „Kontingent bzw. Eltern-Auswahl"; und **alle** `frameDefId`-Werte im gesamten Bestand unter `docs/testing/` benennen entweder ein `forceEntry` oder ein schlichtes, nicht über einen Verweis erreichtes `selectionEntry` (geprüft: `729f-…`, `febe-…`, `8933-…`, `aa57-…`, `0767-…`, `79af-…`, `3f40-…`, `3c0f-…`, `115c-…`, `41a3-…`, `4ee2-…`, `9ac2-…` — kein einziger ist eine `entryLink`-Id). Statt zu raten, adressiert Roster 05 den Slot ohne `frameDefId`: `defId` + `targetDefId` + `anchorKind: "occupied"` treffen ihn eindeutig, weil der Sky Chariot in diesem Roster **genau einmal** vorkommt und gewählt ist (der zweite mögliche Träger, der Necromancer, steht nicht darin, und ein gewählter Verweis erzeugt kein zusätzliches Angebot). Die Aussage von Roster 05 — die force-Hälfte allein — bleibt davon unberührt. |
| **Die 50 Punkte des Sky Chariot als zweiter Zeuge** | Der einzige erreichbare zählende Zeuge wäre das Punktebudget der tragenden „Magic Items"-Gruppe (`a385-781e-1d25-66e5` am Tomb Prince, `dee4-3354-e125-5b8b` am Necromancer; je `max 50`, `field=ecfa-8486-4f6c-c249`, `scope=parent`, **ohne** `includeChildSelections`, also XSD-Vorgabewert `false`, `Catalogue.xsd:430`). Die Gegenstände hängen aber **zwei** Gruppenebenen tiefer (`7611-…` → `81c5-…` → Verweis), und was `includeChildSelections="false"` („just `scope`'s `field`", [§7.6](../../battlescribe-data-format.md#76-constraint)) über diese Verschachtelung sagt, legt die Formatspezifikation nicht eindeutig fest. Deshalb wird weder in `firing` noch in `absent` etwas dazu behauptet — dieselbe Zurückhaltung wie bei den `limit::pts`-Eigengrenzen in [`../set-unresolved-target-inert-lord-slot/`](../set-unresolved-target-inert-lord-slot/README.md). Der Preis ist dennoch belegt: mit genau 50 Punkten in der Gruppe (Roster 03/04) ist das Budget punktgenau eingehalten, mit 65 (Roster 06) überschritten. |
| **Ob „doppelt verborgen" von „einfach verborgen" unterscheidbar ist** | In Roster 05 ist der Slot aus **zwei** unabhängigen Gründen verborgen: die force-Hälfte der `and`-Gruppe fällt, **und** die tragende Gruppe „Magic Items" `7611-df97-0864-39a3` bleibt außerhalb des Lichemaster-Kontingents `hidden="true"` (eine versteckte Gruppe versteckt, was sie hält, [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)). Die Daten bieten keinen Weg, den Tomb Prince außerhalb `f37a` mit **aufgedeckter** Magic-Items-Gruppe zu stellen — die Gruppe kennt nur diesen einen Aufdeck-Modifikator (`:12225`). Roster 05 behauptet deshalb nur `isHidden true`, nicht *welche* der beiden Ursachen greift; die **isolierte** Aussage über die parent-Hälfte tragen Roster 02/04, wo die Gruppe nachweislich aufgedeckt ist. |
| **Ob die Engine für einen verborgenen Slot überhaupt ein Angebot ausweist** | Roster 01/02 setzen (wie [`../set-hidden-force-gate/`](../set-hidden-force-gate/README.md) und [`../greater-than-parent-upgrade-gate/`](../greater-than-parent-upgrade-gate/README.md)) voraus, dass ein nicht gewählter Verweis als `offerAnchor` im Bericht steht. Weil das eine Berichts-Eigenschaft und keine Katalogaussage ist, tragen die Roster 03–06 dieselbe Regel zusätzlich über **belegte** Slots — bricht nur 01/02, ist die Frage das Angebots-Modell, nicht das Gatter. |
| **Der `value="1"` der Bedingung** | Bei `instanceOf` ist der Vergleichswert bedeutungslos (dieselbe Wirkungslosigkeit wie bei `percentValue`, [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)). Das Szenario behauptet dazu nichts; es gibt im Korpus kein `instanceOf` mit einem anderen `value`, an dem sich eine Aussage prüfen ließe. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (`.gst`) | `0d13-7737-ea86-4662` |
| Katalog „Vampire Counts" | `4d73-5ab0-9020-403c` |
| Bibliothek „Mercenaries" (per `catalogueLink` `ef73-f9bd-e250-54d2`) | `fc47-8392-a6c8-452a` |
| **Geteiltes Upgrade „Sky Chariot"** (`:20454`, `hidden="true"`, 50 pts, ohne jedes `constraint`) | **`33bd-1a1e-a286-60ac`** |
| — dessen einziger Verweis, in der Gruppe „Enchanted Items (Lichemaster)" (`:23822`) | **`472e-d107-b0dc-c51a`** |
| Geteilte Gruppe „Enchanted Items (Lichemaster)" (`:23819`) | `81c5-7ea4-7cb5-61d4` |
| — deren Grenze `max 1`, `field=selections`, `scope=parent`, `shared=true` (`:23828`) | **`7ef4-7ce1-e1da-22ea`** |
| — deren ungegateter Nachbar-Verweis „Charm of Defiance" (`:23821`) → Ziel (`:20489`, 15 pts, `hidden="false"`) | `7014-1ec5-46b7-36e5` → `94d1-a517-f236-7812` |
| SelectionEntry „Tomb Prince [KHEMRI]" (`:12061`, Wurzel-Eintrag, `hidden="true"`, 100 pts, primär „Heroes" `c16b-f319-2c62-2c12`) | **`0b24e6f4-0f37-4243-a0a5-99e723692dc3`** |
| — dessen Aufdeck-/Umbenenn-`modifierGroup` für `f37a` (`:12258-12271`, u. a. `set name="Barrow King"`, `add category 7a1c-d611-c2dc-def1`) | — |
| — dessen Pflichtgrenze (`min 0` → `set 1`, `:12253`/`:12262`) | `3d9d-764e-6661-91ed` |
| — dessen Gruppe „Magic Items" (`:12212`, `hidden="true"`, für `f37a` aufgedeckt `:12225`) mit dem Gruppenverweis `:12215` | `7611-df97-0864-39a3` / `d6b3-7aaa-5cd2-d026` |
| — dessen Verweis unter „Swain", nur für Clan Lahmia aufgedeckt (`:9808-9816`); **einzige Stelle, an der ein Träger dieses Szenarios selbst über einen Verweis hängt** | `c7e0-a4dc-65a2-7fd0` |
| SelectionEntry „Necromancer" (`:2485`, Wurzel-Eintrag, `hidden="false"`, 65 pts, im Lichemaster 70 pts und „Shadow Druid", primär „Heroes") | `b5d8-db21-a4b7-9e94` |
| — dessen Gruppe „Magic Items" (`:2641`, `hidden="true"`, für `f37a` aufgedeckt `:2656`) mit dem Gruppenverweis `:2644` | `b4e0-9f6b-30b0-346e` / `0406-f097-c5d3-e51c` |
| — deren Punktebudget `max 50` (`:2653`), **nicht** asseriert | `dee4-3354-e125-5b8b` |
| — das gleichartige Budget am Tomb Prince (`:12222`), **nicht** asseriert | `a385-781e-1d25-66e5` |
| SelectionEntry „Swain" (`:5210`, `hidden="true"`, für Clan Lahmia aufgedeckt `:10057`, keine eigenen Kosten) | `b920-b398-dc26-7f4d` |
| — dessen Gruppe „Hero from another faction" (`:5216`, `max 1` `2e71-b752-12d3-5100`) → Untergruppe „Tomb Kings" (`:9646`) | `09bf-a395-daf9-7e25` / `75da-b518-329e-5f55` |
| Kontingent „Army of the Lichemaster (WD#309-UK)" (`:29441`) | **`f37a-a93e-fa22-61a8`** |
| — dessen Lord-`categoryLink` (`:29447`) mit `min 1` (`:29452`) | `7a76-8153-c4b2-9fee` — constraint `760d-2352-9fac-0e46` |
| — dessen Eigengrenze `limit::pts` (`:29461`), per `set 2000` (`:29464`), **nicht** asseriert | `8f3f-ffa8-387b-0bf9` |
| Kontingent „Clan Lahmia (VC-AB)" (`:29403`, ohne eigene `constraints`) | **`2102-34f1-c876-98c5`** |
| Kontingent „Vampire Coast (WD#306-UK)" — nie gewählt, dessen Lord-Grenze (`:29482`) steht überall in `absent` | `bf46-ee85-7c10-ba98` — constraint `8471-437a-59d6-bc3d` |
| Pflichten des Lichemaster-Heeres: Kemmler / Krell | `8461-3eab-e5ac-1636` / `60a8-5b49-6b81-7c84` |
| Kategorie „Core" (`.gst:372`) — `min 2`, Klasse 3000–3999 ⇒ 4 (`.gst:395`) | `64bf-efb4-9978-26df` — constraint `35c2-d478-392a-aeb1` |
| Kategorie „Heroes" (`.gst:366`) — nur `max -1` = unbegrenzt | `c16b-f319-2c62-2c12` — constraint `7fca-63fb-63d2-9dad` |
| Kategorie „General" (`.gst:721`) — `min 1` / `max 1`, `scope=force` | `a37e-7207-de6d-acb0` — constraints `1077-7379-f142-f382` / `d818-c60d-b1f8-8aaa` |
| Kostenart „pts" (Klassenschalter `limit::…`) | `ecfa-8486-4f6c-c249` |
| Einziges weiteres parent-skopiertes `notInstanceOf` im Korpus (`Mercenaries (…).cat:4101`), nicht Gegenstand dieses Szenarios | `7ff5-9e55-c594-4b40` |
