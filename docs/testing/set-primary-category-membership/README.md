# E2E-Regeln & Testkatalog: `set-primary category` sichert die Mitgliedschaft ('Kathleen' Halftank, Ogre Kingdoms)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt der in den bestehenden Szenarien verifizierten Form (direktes
`entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044`
- Dazu `Mercenaries (6th definitive edition).cat` — der Ogre-Katalog verlangt sie
  per `catalogueLink` (`targetId="fc47-8392-a6c8-452a"`), **und** die Kategorie
  „Regiment of Renown" (`ee09-9a50-ad78-9c32`) ist dort deklariert, nicht in der
  `.gst`.

## Der Mechanismus (wichtig)

Der Wurzel-Eintrag **`'Kathleen' Halftank`** (`331a-3634-095a-574a`, 150 pts)
trägt **drei** rohe `categoryLinks` — und keinen davon auf „Regiment of Renown":

```xml
<categoryLinks>
  <categoryLink name="Rare"               id="0d39-6f7d-aa1c-0e55" targetId="e94b-6a54-8779-cd60" primary="true"/>
  <categoryLink name="Experimental rules" id="2b1c-4315-ae1b-9098" targetId="4fed-b911-e6e0-927b" primary="false"/>
  <categoryLink name="War Machine"        id="c559-4aed-eee1-5d37" targetId="f672-d9d4-a601-479a" primary="false"/>
</categoryLinks>
```

Unter seinen `<modifiers>` steht — **unbedingt**, ohne `<conditions>`, ohne
`<conditionGroups>` und **ohne** begleitendes `add`/`category` — genau eine
Zeile, die die Kategoriezugehörigkeit betrifft:

```xml
<modifier type="set-primary" value="ee09-9a50-ad78-9c32" field="category"/>
```

Das ist der Prüfstein dieses Szenarios: `set-primary` steht hier **allein**.
Nähme man an, der Modifier schalte nur ein `primary`-Flag an einem bereits
vorhandenen Link, wäre er wirkungslos — Kathleen führt keinen Link auf
`ee09-…`, hätte also eine Primärkategorie, der sie nicht angehört, und damit
überhaupt keinen Anzeige-Bucket. Die BSData-Doku
([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)) hält genau
das fest und benennt **diesen** Eintrag als Beleg: *„**`set-primary` sichert
dabei zugleich die Mitgliedschaft**: die benannte Kategorie wird Teil der
effektiven Kategorien, auch wenn der Eintrag sie nicht per `categoryLink`
führt."*

Die Gegenrichtung steht ebenfalls in den Daten: **entfernt** wird eine
Mitgliedschaft ausschließlich per `type="remove"`. Derselbe Ogre-Katalog zeigt
das an seinen Wurzel-`entryLink`s, die `set-primary` konsequent mit einem
**eigenen** `remove` kombinieren, wenn eine Einheit den Bucket wechseln soll
(z. B. „Ogre Bulls" `d82e-111e-89b9-2be1`: `set-primary` Core + `remove` Rare +
`add` Core + `remove` Regiment of Renown). An Kathleen steht **kein** `remove` —
ihre Rare-Mitgliedschaft bleibt also bestehen, verschoben wird nur das
`primary`-Flag.

Beobachtbar ist beides im Bericht über **kategoriezählende** Größen: den
Kategorie-Anker des Kontingents (`anchorKind: categoryAnchor`, `current`) und
die kategoriezählende `scope="force"`-Grenze der `.gst`.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **SPCM-R1** | `'Kathleen' Halftank` zählt **als Regiment of Renown**, obwohl sie keinen `categoryLink` dorthin trägt und **kein** `add`/`category` danebensteht. | Ogre-`.cat`, `selectionEntry 331a-3634-095a-574a` → unbedingter `modifier type="set-primary" value="ee09-9a50-ad78-9c32" field="category"` (Zitat oben); die drei rohen `categoryLinks` nennen `ee09-…` nicht. BSData-Doku §8 („`set-primary` sichert zugleich die Mitgliedschaft"), die diesen Eintrag namentlich als Beleg führt. |
| **SPCM-R2** | Sichtbar/zählbar wird diese Mitgliedschaft nur in einem Kontingent, dessen `forceEntry` einen `categoryLink` auf die Kategorie führt. „Standard (OK-AB)" tut das. | Ogre-`.cat`, `forceEntry 729f-9246-5cd3-5044` → `categoryLink id="f78c-c639-4655-0461" targetId="ee09-9a50-ad78-9c32" primary="false"`. (Die beiden anderen Ogre-Forces — „Ironskin Tribe" `8711-…`, „Gnoblar Horde" `9746-…` — führen diesen Link **nicht**; deshalb spielt das Szenario ausschließlich in „Standard (OK-AB)".) |
| **SPCM-R3** | `set-primary` **entfernt nichts**: Kathleen bleibt Mitglied von **Rare**. Ihr `primary`-Flag wandert, ihre Mitgliedschaften wachsen. | Ogre-`.cat`, `331a-…`: `categoryLink 0d39-6f7d-aa1c-0e55 → e94b-6a54-8779-cd60` bleibt stehen, **kein** `modifier type="remove" value="e94b-…"` am Eintrag. Gegenmuster im selben Katalog: `entryLink d82e-111e-89b9-2be1` („Ogre Bulls") und neun weitere Wurzel-`entryLink`s schreiben `remove` **explizit** hin, wenn die alte Kategorie weg soll. BSData-Doku §8: `unset-primary` „löscht dagegen nur das Flag; die Mitgliedschaft bleibt, denn zählrelevant ist allein sie". |
| **SPCM-R4** | **Rare max 1** (Kategorie-Ziel ⇒ armeeweit gezählt, §7.7/ADR 0029) bei `costLimit` 1000: die Basisgrenze gilt. | `.gst`, `categoryEntry "Rare" e94b-6a54-8779-cd60` → constraint **`0a44-2d3f-adfe-f3a1`** `type=max value=1 field=selections scope=force includeChildSelections=true`. Brackets: `set 0` verlangt Limit < 200; `set 1` verlangt 200–499; `set 2`–`set 5` verlangen ≥ 2000; die beiden Border-Patrols-Varianten verlangen eine Border-Patrols-Selektion (`4e15-0353-165f-5528`). Bei 1000 pts ohne Border Patrols hält **keiner** ⇒ Grenze 1. Kein anderer Katalog des Datensatzes modifiziert `0a44-…`. |
| **SPCM-R5** | Die Kategorie „Regiment of Renown" trägt **keine** force-zählende Grenze: ihre einzige Constraint ist `scope="parent"` und `value="-1"` (unbegrenzt). Der Regiment-of-Renown-Anker wird deshalb über seinen **Ist-Stand** gepinnt, nicht über eine feuernde Grenze. | `Mercenaries.cat`, `categoryEntry ee09-9a50-ad78-9c32` → constraint `0b6f-90dd-93f3-373b` `type=max value=-1 field=selections scope=parent`; der einzige `set`-Modifier darauf verlangt „Border Patrols rules" (`4e15-…`), die hier fehlt. Der Ogre-`categoryLink` `f78c-…` trägt selbst keine Constraints. |
| **SPCM-R6** | Die Kategorie „Regiment of Renown" ist **verborgen**, solange im Kontingent kein „Allow Regiments of Renown" steht. Alle drei Roster wählen diesen Schalter, damit der Anker sichtbar ist (`isHidden=false`). | `Mercenaries.cat`, `ee09-…` → `modifier set hidden=true` mit `conditionGroup type="or"`: Zweig 1 = Border Patrols **und** `notInstanceOf primary-catalogue` „Dogs of War" (`fa9c-5f79-ce12-480c`), Zweig 2 = `lessThan 1 selections scope="force" childId="3d35-6b18-262f-6503"`. Ohne Border Patrols ist Zweig 1 falsch; der Schalter `3d35-…` (`.gst`, Kind von `6a7d-7d85-8d7e-cbce`) macht Zweig 2 falsch ⇒ sichtbar. |
| **SPCM-R7** | **Gatter:** Kathleens Eigengrenze ist roh `max 0` und wird erst durch den Schalter „Allow experimental rules?" auf `1` gehoben; ohne ihn fiele zusätzlich die Autor-Fehlermeldung des Eintrags an. Alle Roster wählen den Schalter, damit die Kategorie-Regel isoliert sichtbar bleibt. | Ogre-`.cat`, `331a-…` → constraint **`99ea-c7dd-2a0b-ff10`** `type=max value=0 field=selections scope=parent` + `modifier type="set" value="1" field="99ea-c7dd-2a0b-ff10"` mit `condition atLeast 1 selections scope="force" childId="8b76-92c4-23f9-54b1"`; dazu `modifier type="add" field="error"` („Please enable …") mit der komplementären `lessThan`-Bedingung. |
| **SPCM-R8** | **Border Patrols bleiben draußen.** Ein weiterer Modifier an `331a-…` setzt `hidden=true`, sobald „Border Patrols rules" (`4e15-0353-165f-5528`) im Roster steht; keines der Roster enthält diese Selektion. | Ogre-`.cat`, `331a-…` → `modifier type="set" value="true" field="hidden"` mit `condition atLeast 1 … scope="roster" childId="4e15-0353-165f-5528"`. |
| **SPCM-R9** | Der `<categories>`-Block einer `.ros`-Selektion ist ein **denormalisierter Snapshot** — nicht die Wahrheit. Die Roster notieren für Kathleen bewusst nur die **rohen** Links (Rare/Experimental rules/War Machine, ohne Regiment of Renown): die Zugehörigkeit muss aus den Katalogdaten abgeleitet werden. | ADR 0011 (Katalog ist SSOT für abgeleitete Daten; `.ros` = denormalisierter Snapshot); BSData-Doku §8 („**Sämtliche** kategorie-abhängige Logik muss die **effektiven** … Kategorie-Links auswerten, nicht die rohen"). |

**Warum das Trio den Modifier isoliert:** Roster 01 und 02 unterscheiden sich
**ausschließlich** in der gewählten Rare-Einheit. Der Slave Giant
(`7ec6-83de-2dc3-82e9`) trägt genau einen `categoryLink` (Rare, `primary=true`)
und **keinen** Kategorie-Modifier — er ist damit die Nullprobe: Ist-Stand des
Regiment-of-Renown-Ankers **0**. Steht stattdessen Kathleen im Kontingent, muss
derselbe Anker **1** zählen; eine Konstante kann das nicht erklären. Roster 03
schließt die zweite Hälfte: würde eine Engine `set-primary` als *Umzug*
(implizites `add` + `remove`) lesen, verlöre Kathleen die Rare-Mitgliedschaft,
der Rare-Zähler bliebe bei 1 und `0a44-…` bliebe stumm — Roster 03 verlangt
Ist **2** und ein feuerndes `0a44-…`.

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle drei
referenzieren `.gst` + Ogre-Kingdoms-`.cat` + `Mercenaries`-`.cat`, setzen
`costLimit` 1000 pts (`typeId ecfa-8486-4f6c-c249`) und enthalten dieselben
beiden Schalter („Allow Regiments of Renown" unter `6a7d-…`, „Allow experimental
rules?").

> **Assertion-Fokus:** die beiden Kategorie-Anker des Kontingents, die
> Rare-Grenze `0a44-…` und Kathleens Eigengrenze `99ea-…`. Andere
> Armeeaufbau-Diagnosen — insbesondere die unerfüllte General-Pflicht
> (`1077-7379-f142-f382`) und Core min 2 (`35c2-d478-392a-aeb1`), die keines
> dieser bewusst minimalen Roster erfüllt — dürfen zusätzlich auftreten und sind
> hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | `set-primary` allein macht Mitglied | `.gst` + Ogre-`.cat` + Mercenaries | Standard (OK-AB), beide Schalter, **eine** `'Kathleen' Halftank`. | **SPCM-R1/R2:** Kategorie-Anker „Regiment of Renown" (`ee09-…`) zeigt Ist **1** und ist sichtbar — obwohl kein `categoryLink` und kein `add` dorthin führt. **SPCM-R3:** Rare-Anker zeigt Ist **1** bei Grenze **1** ⇒ `0a44-…` feuert **nicht**. **SPCM-R7:** Kathleens Eigengrenze steht auf max **1** ⇒ `99ea-…` feuert nicht. | [`01-kathleen-set-primary-regiment-of-renown.ros`](rosters/01-kathleen-set-primary-regiment-of-renown.ros) |
| 02 | Nullprobe ohne `set-primary` | wie 01 | **Identischer** Aufbau, einziger Unterschied: statt Kathleen ein **Slave Giant** (`7ec6-…`, nur Rare, kein Kategorie-Modifier) samt Pflichtkind. | Kategorie-Anker „Regiment of Renown" zeigt Ist **0**; Rare-Anker Ist **1**, `0a44-…` stumm. Der Kontrast zu 01 belegt: die 1 in 01 stammt aus dem Modifier, nicht aus dem Anker. | [`02-slave-giant-no-set-primary.ros`](rosters/02-slave-giant-no-set-primary.ros) |
| 03 | Mitgliedschaft wandert nicht, sie wächst | wie 01 | Vereinigung von 01 und 02: Kathleen **und** Slave Giant. | **SPCM-R3/R4:** Rare zählt **beide** (Ist **2**) ⇒ `0a44-…` feuert (Ist 2, Grenze 1); „Regiment of Renown" zählt weiterhin nur Kathleen (Ist **1**). Läse eine Engine `set-primary` als Umzug, bliebe der Rare-Zähler bei 1 und die Grenze stumm. | [`03-kathleen-and-slave-giant-rare-max.ros`](rosters/03-kathleen-and-slave-giant-rare-max.ros) |

**Bewusst nicht als feuernde Grenze erwartet:**

- **Der Anzeige-Bucket selbst.** Welche Kategorie nach dem `set-primary` das
  `primary`-Flag trägt — also unter welcher Überschrift die Einheit in der UI
  einsortiert wird —, ist eine reine Darstellungsfrage. Der Manifest-Vertrag
  kennt dafür **keinen** Schlüssel (ein Slot trägt `defId`/`targetDefId`,
  `anchorKind`, `frameDefId`, Grenzen und Flags, aber keine Primärkategorie),
  und der Verletzungsbericht kodiert keine Buckets. Gepinnt wird deshalb
  ausschließlich die vom `set-primary` **mitgesicherte Mitgliedschaft** — über
  den Ist-Stand des Kategorie-Ankers (SPCM-R1) und über die kategoriezählende
  Grenze (SPCM-R3/R4). Dass Rare „nicht mehr der primäre Bucket" ist, bleibt
  damit unbehauptet; es wäre aus den erlaubten Quellen nicht prüfbar.
- **Sichtbarkeit (`hidden`).** Sie ist Verfügbarkeit, keine zählende Schranke,
  und taucht im Verletzungsbericht nicht auf. Das `isHidden`-Flag des
  Kategorie-Ankers (SPCM-R6) wird nur als **Slot-Aussage** behauptet, nicht als
  Verletzung; die `hidden`-Regel an Kathleen selbst (SPCM-R8) wird durch das
  Weglassen von „Border Patrols rules" schlicht ausgeschaltet.
- **Die Autor-Fehlermeldung** von `331a-…` („Please enable …") ist durch den
  Experimental-Schalter unterdrückt (SPCM-R7); sie ist nicht Gegenstand dieses
  Szenarios und wird nicht behauptet.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OK-AB)" (Ogre) | `729f-9246-5cd3-5044` |
| `categoryLink` „Regiment of Renown" dieses forceEntry | `f78c-c639-4655-0461` → `ee09-9a50-ad78-9c32` |
| `categoryLink` „Rare" dieses forceEntry | `7fe5-abdc-581e-567c` → `e94b-6a54-8779-cd60` |
| `'Kathleen' Halftank` (Träger des `set-primary`, 150 pts) | `331a-3634-095a-574a` |
| Rohe Kategorie-Links an Kathleen (Rare primary / Experimental rules / War Machine) | `0d39-6f7d-aa1c-0e55` / `2b1c-4315-ae1b-9098` / `c559-4aed-eee1-5d37` |
| Kathleens Eigengrenze (max 0, `scope=parent`; per Schalter auf 1) | `99ea-c7dd-2a0b-ff10` |
| Kategorie „Regiment of Renown" (`Mercenaries.cat`) | `ee09-9a50-ad78-9c32` — constraint `0b6f-90dd-93f3-373b` (max −1, `scope=parent`) |
| Kategorie „Rare" (`.gst`) | `e94b-6a54-8779-cd60` — constraint `0a44-2d3f-adfe-f3a1` (max 1, `scope=force`) |
| Kategorie „Experimental rules" / „War Machine" (`.gst`, ohne force-zählende Grenze) | `4fed-b911-e6e0-927b` / `f672-d9d4-a601-479a` |
| Slave Giant (Nullprobe: nur Rare, kein Kategorie-Modifier, 175 pts) | `7ec6-83de-2dc3-82e9` — Kategorie-Link `f64c-a98d-288a-1db7` |
| Pflichtkind des Slave Giant (min 1, `scope=parent`, 0 pts) | `6cb7-d2e4-0e39-f6e4` — constraint `21a3-01fb-5bec-f687` |
| Schalter „Allow experimental rules?" (`.gst`) | `8b76-92c4-23f9-54b1` (Ogre-`entryLink` `9a0b-4d97-1625-919f`) |
| Träger „Mercenaries and Regiments of Renown" (`.gst`) | `6a7d-7d85-8d7e-cbce` (Ogre-`entryLink` `254b-aa03-1b8c-90f8`) |
| Schalter „Allow Regiments of Renown" (`.gst`, Kind davon) | `3d35-6b18-262f-6503` |
| „Border Patrols rules" (bewusst **nicht** im Roster) | `4e15-0353-165f-5528` |
| Gegenmuster `set-primary` **mit** explizitem `remove` (Ogre-`entryLink` „Ogre Bulls") | `d82e-111e-89b9-2be1` |
| pts-Kostenart (`costLimit`-`typeId`) | `ecfa-8486-4f6c-c249` |
| Mercenaries-Katalog (per `catalogueLink` verlangt) | `fc47-8392-a6c8-452a` |
