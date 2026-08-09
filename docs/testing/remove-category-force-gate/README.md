# E2E-Regeln & Testkatalog: Force-gegattertes `remove category` (Grave Guard, Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt der in den bestehenden Szenarien verifizierten Form (direktes
`entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Forces **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668` und **„Clan Blood Dragons (VC-AB)"** `5e95-7d57-2b9c-d77d`
- Dazu `Mercenaries (6th definitive edition).cat` — der VC-Katalog verlangt sie
  per `catalogueLink` (`targetId="fc47-8392-a6c8-452a"`); ohne sie meldet die
  Datensatz-Vorbereitung eine fehlende Abhängigkeit.

## Der Mechanismus (wichtig)

Das geteilte `selectionEntry` **„Grave Guard"** (`92ee-2ebf-c6c0-71ff`) trägt roh
**genau eine** Kategorie — Special, primary (`categoryLink 145c-1a00-4374-030e`
→ `43cc-fc3f-35a7-8d03`). Zusätzlich trägt es eine `<modifierGroup type="and">`
mit **einer** Bedingung und **drei** unbedingten Modifiern (`.cat`, am Eintrag
selbst):

```xml
<modifierGroup type="and">
  <conditions>
    <condition type="instanceOf" value="1" field="selections" scope="force"
               childId="5e95-7d57-2b9c-d77d" shared="true" includeChildSelections="true"/>
  </conditions>
  <modifiers>
    <modifier type="set-primary" value="64bf-efb4-9978-26df" field="category"/>
    <modifier type="remove"      value="43cc-fc3f-35a7-8d03" field="category"/>
    <modifier type="add"         value="64bf-efb4-9978-26df" field="category"/>
  </modifiers>
</modifierGroup>
```

Die Bedingung ist die **kanonische** forceEntry-Instanz-Prüfung
(BSData-Doku §7.7): `scope="force"` + `childId=<forceEntry-Id>` — sie hält genau
dann, wenn das umschließende Kontingent den forceEntry **„Clan Blood Dragons
(VC-AB)"** instanziiert. Dann gilt: Special wird **entfernt**, Core
(`64bf-efb4-9978-26df`) wird **hinzugefügt** und primär. Effektive Kategorien
der Einheit = {Core}. In jeder anderen Force (hier: „Standard (VC-AB)") bleiben
die rohen Kategorien — Special, nicht Core.

Beobachtbar ist das im Verletzungsbericht **nur** über kategoriezählende
Grenzen: Kategoriezugehörigkeit selbst ist keine feuernde Grenze. Gepinnt wird
deshalb über die beiden `scope="force"`-Zählgrenzen der `.gst`-`categoryEntries`
(Kategorie-Ziel ⇒ armeeweit gezählt, Ziel-Typ-Regel §7.7/ADR 0029; bei
Ein-Force-Listen identisch mit „pro Force").

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RCF-R1** | Grave Guard zählt roh **als Special und nicht als Core**. | VC-`.cat`, `selectionEntry 92ee-2ebf-c6c0-71ff` → einziger `categoryLink 145c-1a00-4374-030e` `targetId=43cc-fc3f-35a7-8d03 primary=true`. Kein Core-Link. (Der einzige weitere Kategorie-Modifier, `add 6ad6-…` „Border Patrols", ist auf eine hier nicht vorhandene Border-Patrols-Selektion gegatet.) |
| **RCF-R2** | In einer Force, die **„Clan Blood Dragons (VC-AB)"** instanziiert, zählt Grave Guard **als Core und nicht mehr als Special** — die `modifierGroup` (Zitat oben) entfernt Special und fügt Core hinzu (`remove`/`add`/`set-primary`, `field="category"`). Alle kategorieabhängigen Zählungen müssen die **effektiven** Kategorie-Links auswerten, nie die rohen. | VC-`.cat`, `modifierGroups` an `92ee-2ebf-c6c0-71ff` (verbatim oben); BSData-Doku §8 („Laufzeit-dynamische Kategoriezugehörigkeit": `remove` entfernt die Mitgliedschaft, `add` fügt hinzu, `set-primary` sichert die Mitgliedschaft zugleich). |
| **RCF-R3** | **Special max 3** (armeeweit, Kategorie-Ziel) bei `costLimit` 1000: die Basisgrenze gilt, keine Anhebung/Absenkung hält. | `.gst`, `categoryEntry "Special" 43cc-fc3f-35a7-8d03` → constraint **`16f0-6e5b-55d0-4102`** `type=max value=3 field=selections scope=force`. Modifier-Brackets: `set 0` verlangt Limit < 200; `set 1`/`set 2` verlangen 200–499; `set 4`–`set 7` verlangen ≥ 2000; die Border-Patrols-Varianten verlangen eine Border-Patrols-Selektion (`4e15-0353-165f-5528`) — bei 1000 pts ohne Border Patrols hält **keiner** ⇒ Grenze 3. |
| **RCF-R4** | **Core min 2** (armeeweit, Kategorie-Ziel) bei `costLimit` 1000: die Basisgrenze gilt. | `.gst`, `categoryEntry "Core" 64bf-efb4-9978-26df` → constraint **`35c2-d478-392a-aeb1`** `type=min value=2 field=selections scope=force`. Modifier: `set 1` verlangt Border Patrols, `set 3`–`set 6` verlangen ≥ 2000 pts ⇒ bei 1000 pts Grenze 2. (Der einzige `.cat`-Modifier auf diese Grenze — `increment` je „Bloated Corpse" — hängt am Core-`categoryLink` des forceEntry „Vampire Coast (WD#306-UK)" und betrifft unsere Forces nicht.) |
| **RCF-R5** | Der `<categories>`-Block einer `.ros`-Selektion ist ein **denormalisierter Snapshot** — nicht die Wahrheit. Beide Roster notieren bewusst den **rohen** Link (Special), auch in der Blood-Dragons-Force: die Zählung muss die effektiven Kategorien aus den Katalogdaten ableiten, nicht den Snapshot lesen. | ADR 0011 (Katalog ist SSOT für abgeleitete Daten; `.ros` = denormalisierter Snapshot); BSData-Doku §8 („**Sämtliche** kategorie-abhängige Logik muss die **effektiven** … Kategorie-Links auswerten, nicht die rohen"). |

**Warum das Assertion-Paar nur mit der ENTFERNUNG besteht:** Würde die Engine
allein das `add`/`set-primary` (Core-Seite) umsetzen und das `remove`
ignorieren, trüge Grave Guard in der Blood-Dragons-Force *beide* Kategorien —
der Special-Zähler bliebe 4 und `16f0-…` müsste feuern, was Roster 02 als
`absent` verbietet. Umgekehrt pinnt `35c2-…` (absent in Roster 02) die
Core-Seite: würde nur entfernt und nichts hinzugefügt, stünde der Core-Zähler
auf 0 < 2. Die beiden Roster unterscheiden sich **ausschließlich** im
`entryId`/`name` der Force.

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide
referenzieren `.gst` + Vampire-Counts-`.cat` + die per `catalogueLink` benötigte
`Mercenaries`-`.cat`; beide setzen `costLimit` 1000 pts und enthalten dieselben
vier Grave-Guard-Einheiten (je 10 Modelle à 12 pts + Pflicht-Handwaffe; 480 pts
gesamt — Modell-Minimum `4eb4-…` min 10 und Handwaffen-Pflicht `c1ea-…` min 1
sind erfüllt, damit die Kategorie-Regel isoliert sichtbar bleibt).

> **Assertion-Fokus:** nur die beiden genannten `.gst`-Kategorie-Grenzen.
> Andere Armeeaufbau-Diagnosen (z. B. General-Pflicht) können zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Standard-Force: rohe Kategorien zählen | `.gst` + VC-`.cat` (+ Mercenaries) | Force „Standard (VC-AB)", 4× Grave Guard. Gatter hält **nicht**. | **Beide Grenzen feuern:** Special-Obergrenze `16f0-…` (Ist 4, Grenze 3) und Core-Untergrenze `35c2-…` (Ist 0, Grenze 2) — Grave Guard zählt als Special, nicht als Core. | [`01-standard-grave-guard-special.ros`](rosters/01-standard-grave-guard-special.ros) |
| 02 | Blood-Dragons-Force: `remove` + `add` greifen | wie 01 | **Identischer** Aufbau, einziger Unterschied: Force „Clan Blood Dragons (VC-AB)" `5e95-…`. Gatter hält. | **Keine der beiden Grenzen feuert:** Special-Zähler 0 (Entfernung greift — `16f0-…` stumm trotz 4 Einheiten), Core-Zähler 4 ≥ 2 (`35c2-…` erfüllt). | [`02-blood-dragons-grave-guard-core.ros`](rosters/02-blood-dragons-grave-guard-core.ros) |

**Bewusst nicht als feuernde Grenze erwartet:** Das `primary`-Flag des
`set-primary` (UI-Einsortierung) und der geänderte Anzeige-Bucket sind keine
zählenden Schranken und tauchen im Verletzungsbericht nicht auf — gepinnt wird
`set-primary` hier nur über seine mitgesicherte **Mitgliedschaft** (zusammen mit
dem `add`, via `35c2-…`). Sichtbarkeit (`hidden`) und Profile sind in diesem
Szenario nicht beteiligt.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Force „Clan Blood Dragons (VC-AB)" (Gatter-`childId`) | `5e95-7d57-2b9c-d77d` |
| Grave Guard (Einheit, Träger der `modifierGroup`) | `92ee-2ebf-c6c0-71ff` |
| Roher Kategorie-Link Special an Grave Guard (primary) | `145c-1a00-4374-030e` → `43cc-fc3f-35a7-8d03` |
| Kategorie „Special" (`.gst`) | `43cc-fc3f-35a7-8d03` — constraint `16f0-6e5b-55d0-4102` (max 3, scope=force) |
| Kategorie „Core" (`.gst`) | `64bf-efb4-9978-26df` — constraint `35c2-d478-392a-aeb1` (min 2, scope=force) |
| Grave Guard Modell (min 10 / max 30 je Einheit, 12 pts) | `4d29-67e8-1d93-a404` |
| Handweapon (Pflicht min 1 je Einheit) | `6cb6-4b58-d77c-4781` |
| pts-Kostenart (`costLimit`-`typeId`) | `ecfa-8486-4f6c-c249` |
| Mercenaries-Katalog (per `catalogueLink` verlangt) | `fc47-8392-a6c8-452a` |
