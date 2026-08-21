# E2E-Regeln & Testkatalog: die bedingungslose `modifierGroup` — eine blosse Klammer

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* (`src/domain/evaluator/__fixtures__/whfb6-definitive/`) und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.3/§7.7) abgeleitet. Die Roster-Form folgt der in den bestehenden Szenarien
verifizierten Gestalt (direktes `entryId`, `entryLinkId=""`, verschachtelte
`selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Kontingent **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668`
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`)
  — per `catalogueLink` `ef73-f9bd-e250-54d2` eingebundene Abhängigkeit des
  Vampire-Counts-Katalogs; ohne sie meldet die Datensatz-Vorbereitung eine
  fehlende Abhängigkeit.

---

## Die Regel (In-World)

Ein `<modifierGroup>` erweitert dieselbe Basis wie ein `<modifier>`
(`ModifierBase`: `<conditions>`, `<conditionGroups>`, `<repeats>` — §7.7,
`Catalogue.xsd:523-538`). Trägt eine Gruppe **keines** dieser drei Elemente als
eigenes Kind, ist sie eine **blosse Klammer**: sie fügt kein Gatter und keinen
Wiederholungsfaktor hinzu. Jeder Modifikator darin wirkt exakt so, als stünde er
in der `<modifiers>`-Liste des Trägers — jeder weiterhin von seinen **eigenen**
Bedingungen und Wiederholungen regiert.

Daraus folgen die beiden Aussagen, die dieses Szenario festnagelt:

1. **Die Klammer unterdrückt nicht.** Ein *unbedingter* Modifikator in einer
   bedingungslosen Klammer wirkt immer — nicht „nie, weil die Gruppe keine
   erfüllte Bedingung hat".
2. **Die Klammer gattert nicht pauschal.** Ein *bedingter* Modifikator in
   derselben Klammer wirkt genau dann, wenn **seine eigene** Bedingung hält —
   nicht „immer, weil die Gruppe unbedingt ist".

> **Fallstrick beim Lesen (§7.7):** `<conditions>`/`<conditionGroups>` einer
> Gruppe dürfen in Dokumentreihenfolge **hinter** ihren `<modifiers>` stehen.
> Eine Gruppe ist deshalb nur dann bedingungslos, wenn keines dieser Elemente
> **irgendwo** als ihr direktes Kind auftaucht — und eine Bedingung, die einem
> Modifikator *innerhalb* der Gruppe gehört, ist keine Bedingung der Gruppe.
> Alle drei hier verwendeten Klammern wurden über das gesamte Gruppenelement
> geprüft.

Beobachtbar ist das über die **Info-Projektion** eines Slots
(`expect.capabilities[].infoElements[]`): Namen und Merkmalswerte des
Profil-Vorkommens sowie der effektive Anzeigename des Slots. Zählende Grenzen
sind an keinem der drei Träger beteiligt.

---

## Die drei Träger (verbatim aus den Katalogdaten)

### T1 — `Simulacra`: nackte Klammer **neben** der eigenen `<modifiers>`-Liste

`Vampire Counts (…).cat:12407-12423`, `selectionEntry f38d47d3-…` („Simulacra",
`hidden="true"`), `infoLink 3ffe3e73-…` auf das geteilte Profil
`bcccf6b3-…` („Ushabti"):

```xml
<infoLink id="3ffe3e73-586f-45ae-8292-2dcdb1e7c905" name="Ushabti"
          hidden="false" targetId="bcccf6b3-41fe-4d45-966a-5b0ca8e7d438" type="profile">
  <modifiers>
    <modifier type="set" value="Simulacrum" field="name"/>
  </modifiers>
  <modifierGroups>
    <modifierGroup type="and">
      <modifiers>
        <modifier type="set" value="1" field="dfff-363e-f72a-5a59"/>   <!-- I -->
        <modifier type="set" value="5" field="b690-4bc0-bb73-267b"/>   <!-- S -->
        <modifier type="set" value="4" field="6b9f-c8fe-8998-27e3"/>   <!-- A -->
        <modifier type="set" value="5" field="8712-f56f-5b22-a720"/>   <!-- T -->
      </modifiers>
    </modifierGroup>
  </modifierGroups>
</infoLink>
```

Das ist der Beweis-Träger in Reinform: **dasselbe** Element trägt beide Listen,
und beide müssen wirken. Die Gruppe hat kein `<conditions>`, kein
`<conditionGroups>`, kein `<repeats>`.

### T2 — `0-1 Charnel Guard` und `Ghast`: unbedingte Klammer, Gegenprobe in einer gewöhnlichen Liste

`Vampire Counts (…).cat:4743-4754` (`infoLink 7000-…` der Einheit
`e90d-82fc-b484-efa0`) und `:4807-4818` (`infoLink 41d3-…` des Ghast
`e67b-523f-4be5-433b`) tragen je eine bedingungslose Klammer mit **vier
unbedingten** `set`-Modifikatoren (Name, WS, S, Ld). Daneben tragen das
Ghouls-Modell (`:4774-4777`) und der Ghast (`:4820-4822`) denselben
Umbenennungs-Effekt in einer **gewöhnlichen** `<modifiers>`-Liste — Klammer und
Liste müssen dasselbe Ergebnis liefern.

### T3 — `Vampire Count`: fünf je **eigen-bedingte** Modifikatoren in einer nackten Klammer

`Vampire Counts (…).cat:3126-3157`, `infoLink a106-4a05-36ea-cb01` auf das
geteilte Profil `fabd-ef67-72f5-6b3f` („Vampire Count"):

```xml
<modifierGroups>
  <modifierGroup type="and">
    <modifiers>
      <modifier type="set" value="4+" field="f1be-e66c-d5e1-673c">      <!-- Sv -->
        <conditions><condition type="instanceOf" … scope="6822-0110-a7c9-cbb0"
                               childId="4cae-a20e-8374-b6cb"/></conditions>   <!-- Blood Dragon -->
      </modifier>
      <modifier type="decrement" value="2" field="f95b-da01-0578-3bdc">  <!-- WS -->
        <conditions><condition … childId="fc4b-a86d-5897-9e4c"/></conditions>  <!-- Necrarch -->
      </modifier>
      <modifier type="set" value="5+" field="d4a9-0ed4-d041-e54b">      <!-- Sv+ -->
        <conditions><condition … childId="bf30-4ff0-a4d8-3909"/></conditions>  <!-- Strigoi -->
      </modifier>
      <modifier type="increment" value="2" field="f95b-da01-0578-3bdc"> <!-- WS -->
        <conditions><condition … childId="4cae-a20e-8374-b6cb"/></conditions>  <!-- Blood Dragon -->
      </modifier>
      <modifier type="increment" value="1" field="6b9f-c8fe-8998-27e3"> <!-- A -->
        <conditions><condition … childId="bf30-4ff0-a4d8-3909"/></conditions>  <!-- Strigoi -->
      </modifier>
    </modifiers>
  </modifierGroup>
</modifierGroups>
```

Die Clan-Kategorie kommt von der **zweiten** nackten Klammer derselben Einheit
(`:3422-3498`, Kommentar `BLOODLINE`): sie hält fünf **je eigen-bedingte**
`modifierGroup`s, deren jeweilige `atLeast 1 … scope="force"`-Bedingung die
gewählte Blutlinien-Selektion nennt und die passende Clan-Kategorie per
`add category` setzt (und die übrigen vier per `remove category` entfernt). Die
Blutlinienwahl im Roster schaltet damit genau eines der fünf Paare.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **UMG-R1** | Eine `modifierGroup` **ohne** eigene `<conditions>`, `<conditionGroups>` und `<repeats>` ist eine blosse Klammer; sie fügt weder Gatter noch Wiederholungsfaktor hinzu. Ihre Modifikatoren wirken wie in der `<modifiers>`-Liste des Trägers. | BSData-Doku §7.7 („Die Bedingungen der Klammer gelten für **alle** Modifier darin; die Klammer ist damit die Kurzform für ‚dieselbe Bedingung an mehreren Modifiern' — semantisch gleichwertig dazu, sie an jedem einzelnen zu wiederholen"). Fehlen die Bedingungen, ist die Kurzform leer. `Catalogue.xsd:523-538` (`modifierGroup` erbt `ModifierBase`, alle drei Kinder sind optional). |
| **UMG-R2** | Ein **unbedingter** Modifikator in einer nackten Klammer wirkt immer. | VC-`.cat:12413-12421` (Simulacra/Ushabti: vier `set` ohne jede Bedingung), `:4744-4752` (Charnel Guard/Ghoul), `:4808-4816` (Ghast). Keiner dieser Modifikatoren trägt `<conditions>`, keine der drei Gruppen auch. |
| **UMG-R3** | Die Klammer wirkt **neben** der eigenen `<modifiers>`-Liste desselben Elements; beide Listen tragen bei. | VC-`.cat:12409-12423`: derselbe `infoLink 3ffe3e73-…` trägt `<modifiers>` (`set name="Simulacrum"`) **und** die nackte Klammer (vier Merkmals-`set`). Ein Bericht, der nur eine der beiden Listen liest, verfehlt entweder den Namen oder die Merkmale. |
| **UMG-R4** | Ein **bedingter** Modifikator in einer nackten Klammer wirkt genau dann, wenn **seine eigene** Bedingung hält — die anderen Modifikatoren derselben Klammer bleiben stumm. | VC-`.cat:3128-3156`: fünf Modifikatoren, fünf verschiedene `<conditions>` (Clan-Kategorien `4cae-…`, `fc4b-…`, `bf30-…`). Eine Blutlinie schaltet genau zwei davon; würde die Klammer pauschal anwenden, träfen sich `decrement 2` und `increment 2` auf WS und zusätzlich `set 4+`/`set 5+` auf Sv/Sv+. |
| **UMG-R5** | `instanceOf` ist eine **Identitätsprüfung**, kein Zahlvergleich — das `value`-Attribut der Bedingung ist wirkungslos. | BSData-Doku §7.6/§7.7 (`instanceOf` fragt „ist es dieses?", nicht „wie viele?"; `percentValue` ist ohne Wirkung). Aus den Daten belegt: VC-`.cat` nutzt für **dieselbe** Absicht beide Werte — Blood-Dragon-/Necrarch-Bedingungen mit `value="0"`, Strigoi-Bedingungen mit `value="1"` (`:3132`, `:3137`, `:3142`, `:3147`, `:3152`), identisch wiederholt an `0-1 Vampire Lord` (`:2724-2745`) und `Vampire Thrall` (`:3838-3854`). Ein Zahlvergleich läse „**keine** Blood-Dragon-Kategorie ⇒ Blood-Dragon-Boni" — das Gegenteil des Regelnamens. |
| **UMG-R6** | Die Clan-Kategorie des Vampire Count entsteht aus der zweiten nackten Klammer der Einheit; `scope="6822-0110-a7c9-cbb0"` benennt den nächsten Vorfahren mit dieser Eintrags-Id — hier die Vampire-Count-Auswahl selbst. | VC-`.cat:3422-3498` (`BLOODLINE`-Klammer, fünf innere `modifierGroup`s mit je einer `atLeast 1 … scope="force"`-Bedingung auf die Blutlinien-Selektion und `add category`). Rahmen-Regel: BSData-Doku §7.6 („`scope` … oder eine Vorfahren-Id"), zusätzlich gepinnt in [`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md). Effektive (nicht rohe) Kategorien: §8. |
| **UMG-R7** | Die Merkmalswerte der Grundprofile sind die Ausgangsbasis der Rechnung. | VC-`.cat:28677` (Ushabti: Mv 5, WS 4, S 6, T 4, W 3, I 3, A 3, Ld 10), `:26730` (Ghoul: WS 3, S 3, A 2, T 4, Ld 6), `:27254` (Ghast: WS 3, S 3, A 3, Ld 6), `:27009` (Vampire Count: WS 7, S 5, T 5, I 7, A 4, Ld 9, Sv 7, Sv+ 7). |

**Warum das Assertion-Paar erst zusammen trägt:** Roster 01/02 fallen, wenn eine
nackte Klammer als „nie erfüllt" behandelt wird (die Merkmale blieben auf dem
Katalogwert). Roster 03 fällt, wenn die Klammer ihre Modifikatoren pauschal
anwendet (Sv stünde auf `4+` statt `7`). Roster 04/05 fallen in **beide**
Richtungen zugleich: sie fordern, dass genau zwei der fünf Modifikatoren wirken —
die zwei, deren eigene Bedingung hält.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Vampire-Counts-`.cat` + die per `catalogueLink` benötigte
`Mercenaries`-`.cat` und benutzen dasselbe Kontingent „Standard (VC-AB)".

> **Assertion-Fokus:** ausschliesslich `expect.capabilities` (effektiver
> Anzeigename, Info-Projektion, Merkmalswerte). Andere Armeeaufbau-Diagnosen
> (General-Pflicht, Core-Pflicht, Bloodlines-Pflicht, unerfüllte Mindestmengen
> der Untereinträge) dürfen zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Nackte Klammer neben eigener `<modifiers>`-Liste | Simulacra mit 3 Simulacrum-Modellen | Das Ushabti-Vorkommen heisst **„Simulacrum"** (eigene Liste) **und** trägt I 1, S 5, A 4, T 5 (nackte Klammer). Nicht adressiert und darum unverändert: WS 4, Ld 10. Der Slot bleibt „Simulacra" und ist ausgeblendet — die Klammer wirkt trotzdem. | [`01-simulacra-bare-bracket.ros`](rosters/01-simulacra-bare-bracket.ros) |
| 02 | Unbedingte Klammer vs. gewöhnliche `<modifiers>`-Liste | 0-1 Charnel Guard mit 5 Ghouls, 2 Handwaffen, 1 Ghast | Beide Profil-Vorkommen sind umbenannt („Charnel Guard" / „Charnel Champion") und tragen WS 4, S 4, Ld 7; unangetastet bleiben T 4 bzw. A 2/3. Das Ghouls-Modell und der Ghast tragen denselben Namenseffekt aus einer gewöhnlichen Liste — Klammer und Liste liefern dasselbe. | [`02-charnel-guard-bare-bracket.ros`](rosters/02-charnel-guard-bare-bracket.ros) |
| 03 | Nackte Klammer ohne erfüllte Modifikator-Bedingung | Vampire Count, **keine** Bloodlines-Selektion | **Kein** Modifikator der Klammer wirkt: Sv 7, Sv+ 7, WS 7, A 4 — die Katalogwerte. Die Klammer selbst darf nichts auslösen. | [`03-vampire-count-no-bloodline.ros`](rosters/03-vampire-count-no-bloodline.ros) |
| 04 | Genau die Blood-Dragon-Modifikatoren der Klammer | Bloodlines + Bloodline of Clan Blood Dragon + Vampire Count | Sv wird auf **`4+`** gesetzt, WS um 2 auf **9** erhöht. Sv+ bleibt 7 und A bleibt 4 — die Strigoi- und Necrarch-Modifikatoren derselben Klammer bleiben stumm. | [`04-vampire-count-blood-dragon.ros`](rosters/04-vampire-count-blood-dragon.ros) |
| 05 | Genau die Strigoi-Modifikatoren derselben Klammer | Bloodlines + Bloodline of Clan Strigoi + Vampire Count | Sv+ wird auf **`5+`** gesetzt, A um 1 auf **5** erhöht. Sv bleibt 7 und WS bleibt 7 — die Blood-Dragon-Modifikatoren bleiben stumm. | [`05-vampire-count-strigoi.ros`](rosters/05-vampire-count-strigoi.ros) |

**Bewusst nicht als feuernde Grenze erwartet:** Dieses Szenario macht **keine**
Aussage über `expect.firing`/`expect.absent`. Die Wirkung einer nackten Klammer
ist hier eine Frage von Namen und Merkmalswerten, und Merkmals- bzw.
Namensänderungen sind keine zählenden Schranken — sie erscheinen nicht im
Verletzungsbericht, sondern nur in der Slot-Projektion. Ebenso wenig ist die
Sichtbarkeit (`hidden`) Gegenstand: sie wird in Roster 01/02 nur als
*Beobachtung* mitgeführt (`isHidden: true`), um festzuhalten, dass eine
ausgeblendete Einheit ihre Klammer trotzdem anwendet.

**Nicht doppelt gepinnt:** Der Anzeigename des Vampire-Count-Slots
(„… of Clan Blood Dragon", aus der `BLOODLINE`-Klammer) gehört zu
[`modifier-effective-name`](../modifier-effective-name/README.md) und wird hier
absichtlich nicht erneut behauptet — die `BLOODLINE`-Klammer tritt in diesem
Szenario nur als **Ursache** der Clan-Kategorie auf (UMG-R6).

---

## Lücke: die beiden Ogre-Kingdoms-Anker sind nicht beobachtbar

Der Korpus hält weitere bedingungslose `modifierGroup`s, darunter zwei im
`Ogre Kingdoms (…).cat` an den Wurzel-`entryLink`s **Maneaters**
(`313e-458a-246f-7e88`, `:3197-3206`) und **Rhinox Riders**
(`c8d5-1198-3d4a-8a67`, `:3236-3246`). Beide wurden geprüft und **bewusst nicht**
als Träger gewählt — sie sind über den Manifest-Vertrag nicht falsifizierbar:

- Ihre Klammer-Modifikatoren sind `set-primary`/`remove` auf `field="category"`.
  Kategoriezugehörigkeit erscheint nicht als eigene Aussage im Bericht, sondern
  nur mittelbar über kategoriezählende Grenzen (so wie in
  [`remove-category-force-gate`](../remove-category-force-gate/README.md)).
- Der `set-primary`-Modifikator zielt auf **Rare** (`e94b-6a54-8779-cd60`) — eine
  Kategorie, die **beide** Ziel-Einträge bereits **roh** tragen
  (`Mercenaries (…).cat:3807` für Maneaters `b360-ce9c-85d7-ff03`, `:4060` für
  Rhinox Riders `5e33-e510-ba45-933e`). Die mitgesicherte Mitgliedschaft (§8)
  ändert am Zählerstand also nichts; die Rare-Obergrenze
  `0a44-2d3f-adfe-f3a1` feuert mit und ohne wirksame Klammer gleich.
- Der unbedingte `remove ee09-9a50-ad78-9c32` („Regiment of Renown") zielt auf
  eine Kategorie, deren einzige Grenze `0b6f-90dd-93f3-373b`
  (`Mercenaries (…).cat:65`) `max="-1"` — also unbegrenzt — ist und erst durch
  eine Border-Patrols-Selektion auf 1 gehoben wird.
- Die Gegenrichtung ist zusätzlich **überbestimmt**: die jeweils zweite,
  *bedingte* `modifierGroup` desselben Trägers ist exakt komplementär gegattert
  (Maneaters: `lessThan 1` vs. `atLeast 1` Border Patrols rules; Rhinox Riders:
  `notInstanceOf` vs. `instanceOf` Kontingent „Ironskin Tribe"
  `8711-ed16-2a44-7251`) und entfernt in genau dem Fall dieselbe Kategorie, in
  dem die Klammer-Bedingung fehlschlägt. Ein Roster kann daher nicht
  unterscheiden, ob der Modifikator korrekt ausblieb oder nur überschrieben
  wurde.

Deshalb liegen die Träger dieses Szenarios im Vampire-Counts-Katalog, wo
dieselbe Konstruktion über Profil-Merkmale und Namen **direkt** sichtbar ist.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Kontingent „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Katalog „Vampire Counts" | `4d73-5ab0-9020-403c` |
| Bibliothek „Mercenaries" (per `catalogueLink` verlangt) | `fc47-8392-a6c8-452a` |
| Einheit „Simulacra" (`hidden="true"`) | `f38d47d3-32d7-40de-a093-f01f12afa61d` |
| Modell „Simulacrum" (min 3 je Einheit) | `96f93e1b-7e1a-4372-b3c7-47d14bf6083d` |
| `infoLink` „Ushabti" — Träger von `<modifiers>` **und** nackter Klammer | `3ffe3e73-586f-45ae-8292-2dcdb1e7c905` → Profil `bcccf6b3-41fe-4d45-966a-5b0ca8e7d438` |
| Einheit „0-1 Charnel Guard" (`hidden="true"`) | `e90d-82fc-b484-efa0` |
| `infoLink` „Ghoul" — nackte Klammer (Name, WS, S, Ld) | `7000-4421-89d9-9cf4` → Profil `0615-62cf-143f-fbcb` |
| Modell „Ghouls" (min 5 / max 20; gewöhnliche `<modifiers>`-Umbenennung) | `7432-3972-32cb-77d2` |
| Upgrade „Handweapon" (min 2 / max 2) | `6f53-5bed-2a7a-42ea` |
| Upgrade „Ghast" (max 1; gewöhnliche `<modifiers>`-Umbenennung) | `e67b-523f-4be5-433b` |
| `infoLink` „Ghast" — nackte Klammer (Name, WS, S, Ld) | `41d3-b9aa-b10d-c024` → Profil `e190-fc7a-ca9b-992b` |
| Einheit „Vampire Count" | `6822-0110-a7c9-cbb0` |
| `infoLink` „Vampire Count" — nackte Klammer mit fünf eigen-bedingten Modifikatoren | `a106-4a05-36ea-cb01` → Profil `fabd-ef67-72f5-6b3f` |
| Auswahl „Bloodlines" | `a56a-eb32-5a45-16fd` |
| „Bloodline of Clan Blood Dragon" (Bedingungs-`childId` der `BLOODLINE`-Klammer) | `9fd9-e05c-ffcb-2c4d` |
| „Bloodline of Clan Strigoi" (dito) | `ddfa-0d72-8557-6906` |
| Clan-Kategorie „Blood Dragon" (`add category` / Bedingungs-`childId`) | `4cae-a20e-8374-b6cb` |
| Clan-Kategorie „Strigoi" (dito) | `bf30-4ff0-a4d8-3909` |
| Clan-Kategorie „Necrarch" (dito) | `fc4b-a86d-5897-9e4c` |
| Profil-Typ „Profile" | `a54a-7f00-29bf-12b1` |
| Merkmal WS | `f95b-da01-0578-3bdc` |
| Merkmal S | `b690-4bc0-bb73-267b` |
| Merkmal T | `8712-f56f-5b22-a720` |
| Merkmal I | `dfff-363e-f72a-5a59` |
| Merkmal A | `6b9f-c8fe-8998-27e3` |
| Merkmal Ld | `2d45-18fe-9eb3-b113` |
| Merkmal Sv | `f1be-e66c-d5e1-673c` |
| Merkmal Sv+ | `d4a9-0ed4-d041-e54b` |
| Kategorie „Core" (Roster-Snapshot der Träger) | `64bf-efb4-9978-26df` |
| Kategorie „Lord" (Roster-Snapshot des Vampire Count) | `d024-d25b-a9b4-73b6` |
| Kategorie „Special list rules" (Roster-Snapshot der Bloodlines) | `32f1-197f-d719-a393` |
| pts-Kostenart | `ecfa-8486-4f6c-c249` |
