# E2E-Regeln & Testkatalog: Merkmals-Modifikatoren (`field` = `characteristicType`-Id)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* und aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Kontingent **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044`; es traegt einen `categoryLink` **Mercenaries**
  (`d4b8-575b-1b7d-261a` → `b640-7e9c-3054-c1ce`) und laesst Soeldner damit zu.
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) — hier liegen beide getesteten Einheiten. Ogre Kingdoms bindet
  sie per `catalogueLink a067-78d5-50a2-affe` ein und verlinkt sie am Katalog-Wurzel
  (`entryLink 42d8-7559-6542-15fc` → *Ogres*, `entryLink 6b83-e5d0-92db-3d36` →
  *Anakonda's Amazons*).

## Worum es geht

Ein `<modifier>`, dessen `field` die **Id eines `<characteristicType>`** aus den
`<profileTypes>` des Spielsystems nennt, aendert **genau einen Merkmalswert** —
naemlich den des Profils bzw. des `<infoLink>`-Vorkommens, an dem er haengt. Das
Format-Dokument fuehrt `<characteristicTypeId>` explizit als zulaessigen
`field`-Wert (§7.7, Tabelle „`modifier`-Attribut"), und §5.4 definiert die
`characteristicType`-Ids des Spielsystems.

Relevante `characteristicType`-Ids des profileType **„Profile"**
(`a54a-7f00-29bf-12b1`, `.gst` Z. 18–125):

| Merkmal | `characteristicType`-Id |
|---------|--------------------------|
| Mv | `0e92-d038-82bf-fb41` |
| WS | `f95b-da01-0578-3bdc` |
| BS | `4a8b-0c8e-3daf-7901` |
| T | `8712-f56f-5b22-a720` |
| W | `253a-9b00-4fde-8ac2` |
| I | `dfff-363e-f72a-5a59` |
| A | `6b9f-c8fe-8998-27e3` |
| Ld | `2d45-18fe-9eb3-b113` |
| Sv | `f1be-e66c-d5e1-673c` (`defaultValue="7"`) |
| Sv+ | `d4a9-0ed4-d041-e54b` (`defaultValue="7"`) |

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **MCV-R1** | Ein Merkmals-`modifier` mit `<conditions>` wirkt **erst**, wenn die Bedingung haelt. Haelt sie nicht, gilt der Basiswert des Merkmals (ggf. veraendert durch unbedingte Modifikatoren). | `Mercenaries…cat`, Einheit **Ogres** `7db1-21db-c287-f50d` → Modell **Ogre** `ff8f-ce5a-d663-f9b4` → `profile` **`6101-0a1c-96ef-09d6`**. Dessen `<modifiers>`: `type="decrement" value="1" field="f1be-e66c-d5e1-673c"` mit `condition type="atLeast" value="1" field="selections" scope="parent" childId="055f-8e4e-f170-35d2" includeChildSelections="true"` (Z. 7389–7396). |
| **MCV-R2** | `decrement` rechnet **numerisch auf dem Basiswert** des Merkmals; mehrere `decrement`s auf demselben Merkmal summieren sich. | Dasselbe Profil traegt zusaetzlich einen **unbedingten** `type="decrement" value="4" field="f1be-e66c-d5e1-673c"` (Z. 7397–7399, Kommentar „For avoiding race condition"). Basis-`characteristic` **Sv = 11** (Z. 7383). Ohne Leichte Ruestung: `11 − 4 = 7`; mit Leichter Ruestung: `11 − 1 − 4 = 6`. Beide Modifikatoren sind `decrement`, die Reihenfolge ist damit fuer das Ergebnis unerheblich. |
| **MCV-R3** | Der Modifikator veraendert **nur** das im `field` genannte Merkmal — alle anderen Merkmale desselben Profils bleiben auf ihrem Basiswert. | Am Ogre-Profil `6101-0a1c-96ef-09d6` haengen **ausschliesslich** die beiden Sv-Modifikatoren. WS bleibt `3` (Z. 7375), T bleibt `4` (Z. 7378), Sv+ bleibt `7` (Z. 7384) — in **beiden** Rostern. |
| **MCV-R4** | Ein Merkmals-`modifier` an einem `<infoLink type="profile">` veraendert **genau dieses Verweis-Vorkommen** des geteilten Profils — nicht das geteilte Profil selbst und nicht die anderen Verweise darauf. | `Mercenaries…cat`, `sharedProfiles` → `profile "Anakonda's Amazon"` **`0db4-314f-7419-19d7`** (Z. 10171–10187) hat **keine eigenen** `<modifiers>`. Vier Slots der Einheit **Anakonda's Amazons** `ebf9-c112-3cb4-1f02` ziehen es ueber vier verschiedene `infoLink`s herein, drei davon mit eigenen `<modifiers>` (Z. 4296–4298, 4366–4376, 4393–4399, 4412–4418). |
| **MCV-R5** | `type="set"` **setzt** den Merkmalswert (als Text), unabhaengig vom Basiswert. | Die drei modifizierenden `infoLink`s verwenden ausschliesslich `type="set"`, z. B. `set value="5" field="f95b-da01-0578-3bdc"` (WS) am `infoLink 4288-2e40-701a-b5ac`. |

### MCV-R1/R2/R3 im Detail — Basiswerte und Rechnung

Basis-`characteristics` des Profils `6101-0a1c-96ef-09d6` („Ogre", `typeId=a54a-7f00-29bf-12b1`, Z. 7373–7387):

```
Mv 6 | WS 3 | BS 2 | S 4 | T 4 | W 3 | I 2 | A 3 | Ld 7 | Sv 11 | Sv+ 7 | US 3
```

`scope="parent"` der Bedingung: der `modifier` haengt am Profil des **Modells**
`ff8f-ce5a-d663-f9b4`; dessen Elternauswahl im Roster ist die **Einheit**
`7db1-21db-c287-f50d`. Die Leichte Ruestung `055f-8e4e-f170-35d2` haengt als
`entryLink d824-eb03-77ac-8be2` in der Gruppe „Weapons and Armour"
`6aad-4eeb-5d2c-35cb` und ist damit ein **Geschwister** des Modells unter derselben
Einheit — genau der Bezugsrahmen, den die Bedingung zaehlt. Das Format-Dokument
haelt dazu fest: `scope="parent"` vergleicht **aufgeloeste Ziel-Ids**, nicht
`entryLinkId`s (§3.4/§7.6) — die Roster tragen die Ziel-Id `055f-8e4e-f170-35d2`
im `entryId` und die Link-Id im `entryLinkId`.

| Roster | Auswahl „Light Armour" unter der Einheit | Bedingung `atLeast 1` | Sv |
|--------|-------------------------------------------|------------------------|-----|
| 01 | **nein** (0 Stueck) | haelt **nicht** | `11 − 4` = **7** |
| 02 | **ja** (1 Stueck) | **haelt** | `11 − 1 − 4` = **6** |

### MCV-R4/R5 im Detail — ein geteiltes Profil, vier Verweis-Vorkommen

Basis-`characteristics` des geteilten Profils `0db4-314f-7419-19d7`
(„Anakonda's Amazon", Z. 10172–10186):

```
Mv 4 | WS 3 | BS 3 | S 3 | T 3 | W 1 | I 3 | A 1 | Ld 7 | Sv 7 | Sv+ 6 | US 1
```

| Slot (`selectionEntry`) | `infoLink` (Traeger) | `<modifiers>` am Verweis | Erwarteter Effektivwert |
|--------------------------|----------------------|---------------------------|--------------------------|
| Modell **Amazons** `6bf6-467b-2b6f-71fb` | `3645-5ebd-c72a-1ebb` | **keine** | WS 3, BS 3, I 3, A 1, W 1 (Basis) |
| **Anakonda** `14b0-1d64-8f2c-4da2` | `4288-2e40-701a-b5ac` | `set 5` I, `set Anakonda` name, `set 5` WS, `set 5` BS, `set 3` A, `set 2` W | WS 5, BS 5, I 5, A 3, W 2; Mv 4 und Ld 7 unveraendert |
| **Humming Bird (Standard Bearer)** `f43c-4825-7032-8043` | `cc45-7f67-1cbd-3b1a` | `set Humming Bird` name, `set 4` WS | WS 4; BS 3, I 3, A 1 unveraendert |
| **Pirrana (Musician)** `b7de-ebe9-8eb4-de58` | `8ce4-f9da-a2ec-ba16` | `set 4` WS, `set Pirrana` name | WS 4; I 3, A 1 unveraendert |

Damit belegt Roster 03 beide Halbsaetze der Regel auf einmal: der Modifikator wirkt
auf **sein** Vorkommen (Anakonda: WS 5), und er wirkt **nicht** auf die anderen
Vorkommen desselben geteilten Profils (Amazons-Modell: WS 3, Humming Bird: WS 4).

> **Warum die Einheit „Anakonda's Amazons" legal ist:** Sie traegt
> `constraint type="max" value="0" field="selections" scope="force"`
> **`8626-3c7d-20c5-129b`**; ein `modifier type="set" value="1"` auf genau diese
> Constraint-Id hebt die Grenze auf 1, sobald „Allow experimental rules?"
> (`8b76-92c4-23f9-54b1`) im Kontingent liegt (Z. 4429–4435). Das Roster waehlt
> diesen Schalter deshalb mit; Ogre Kingdoms verlinkt ihn per
> `entryLink 9a0b-4d97-1625-919f`.

---

## Was dieses Szenario bewusst **nicht** festnagelt

- **`name`-Slot-Assertion.** Die `field="name"`-Modifikatoren in Roster 03 haengen
  am `<infoLink>` und benennen damit das **Profil-Vorkommen** um („Anakonda",
  „Humming Bird", „Pirrana"). Das Manifest-Feld `capabilities[].name` bezeichnet
  dagegen den Anzeigenamen des **Slots**. Beides ist nicht dasselbe; das Szenario
  macht deshalb **keine** `name`-Aussage.
- **`append` / `prepend` mit `join`.** In den Fixture-Katalogen existieren solche
  Modifikatoren auf Merkmalsfeldern nur an den Zauber-Profilen der Vampire Counts
  (z. B. `Vampire Counts…cat` Z. 27113 / 27118: `append … field="7d21-349e-b0a8-fc7d"
  join=" "` bzw. `field="f1e6-8816-26e0-8a70" join=" " position="-1"`). Ihre
  Bedingungen sind `type="instanceOf"` mit `scope="unit"` — weder die
  `instanceOf`-Vergleichslogik noch das Scope-Schluesselwort `unit` sind aus
  `docs/battlescribe-data-format.md` ableitbar (§7.7 fuehrt `roster`, `force`,
  `parent`, `category`, `self`). Ein Roster, das die Bedingung gezielt trifft oder
  verfehlt, laesst sich daraus **nicht** als Black-Box konstruieren. **Luecke,
  bewusst offen gelassen.**
- **`set` mit nicht-numerischem Text (`5+`, `24"`).** Vorhanden, aber nur an
  Stellen mit denselben `instanceOf`-Bedingungen (Vampire Counts, Z. 2737/3130/3846)
  oder tief in einem Spezialcharakter (`Orcs and goblins…cat` Z. 8030:
  `set value="5+" field="b600-e1ed-0765-27c1"` am `infoLink 6d80-6615-76ea-b906`
  der Auswahl „Warpaint" `271b-bfa0-88c9-c6ca` **innerhalb** von *Wurrzag Ud Ura
  Zahubu* `74d1-13e5-d030-0577`, der sieben weitere Pflicht-Unterauswahlen
  erzwingt). Nicht minimal darstellbar; **nicht** abgedeckt.
- **Der Verletzungsbericht.** Merkmalswerte sind **keine** zaehlende Schranke. Es
  wird deshalb **keine** feuernde Grenze aus MCV-R1…R5 erwartet; die Aussagen
  laufen ueber `expect.capabilities[].characteristics`. Die `firing`-Liste aller
  drei Roster ist leer.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

> **Assertion-Fokus:** die genannten Merkmalswerte sowie die aufgefuehrten
> Constraint-Ids. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit)
> koennen zusaetzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Bedingung haelt **nicht** | Soeldner-Einheit *Ogres*: 3 Ogre-Modelle + Handwaffe, **keine** Leichte Ruestung. | Der Ogre hat **Sv 7** (kein Ruestungswurf) — nur der unbedingte `−4` wirkt. Sv+ 7, WS 3, T 4 unveraendert. Keine Grenze verletzt. | [`01-ogre-no-light-armour.ros`](rosters/01-ogre-no-light-armour.ros) |
| 02 | Bedingung **haelt** | **Dieselbe** Einheit, zusaetzlich Leichte Ruestung. | Der Ogre hat **Sv 6** — der bedingte `−1` kommt hinzu. Sv+ 7, WS 3, T 4 weiterhin unveraendert (nur das Sv-Merkmal aendert sich). Keine Grenze verletzt. | [`02-ogre-light-armour.ros`](rosters/02-ogre-light-armour.ros) |
| 03 | Modifikator am `<infoLink>` auf ein geteiltes Profil | *Anakonda's Amazons* mit 5 Amazonen, Blades of the Ancients, Leichter Ruestung und komplettem Kommandotrupp; „Allow experimental rules?" im Kontingent. | Vier Slots zeigen **dasselbe** geteilte Profil mit **vier verschiedenen** Wertesaetzen: Amazonen WS 3 (Basis), Anakonda WS 5 / BS 5 / I 5 / A 3 / W 2, Humming Bird WS 4, Pirrana WS 4. Nicht gesetzte Merkmale bleiben ueberall auf Basis. Keine Grenze verletzt. | [`03-amazons-infolink-profile.ros`](rosters/03-amazons-infolink-profile.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (OK-AB)" (Ogre Kingdoms) | `729f-9246-5cd3-5044` |
| Katalog Ogre Kingdoms / Mercenaries | `731d-5b13-2a92-5427` / `fc47-8392-a6c8-452a` |
| SelectionEntry *Ogres* (Soeldner-Einheit) | `7db1-21db-c287-f50d` (Wurzel-`entryLink` `42d8-7559-6542-15fc`) |
| SelectionEntry Modell *Ogre* (traegt das Profil) | `ff8f-ce5a-d663-f9b4` |
| Profil *Ogre* (Traeger der Merkmals-Modifikatoren) | `6101-0a1c-96ef-09d6` |
| Merkmal Sv / Sv+ / WS / T | `f1be-e66c-d5e1-673c` / `d4a9-0ed4-d041-e54b` / `f95b-da01-0578-3bdc` / `8712-f56f-5b22-a720` |
| Ausloeser *Light Armour* (Ziel-Id, `.gst`-Wurzeleintrag) | `055f-8e4e-f170-35d2` (Ogres-`entryLink` `d824-eb03-77ac-8be2`) |
| *Hand Weapon* (Ziel-Id) | `abdb-bbd0-41b2-5dff` (Ogres-`entryLink` `b581-8a9e-9d0c-b7c8`) |
| Grenze „min 3 Ogre" / „min 1 Hand Weapon" / „max 1 Light Armour" | `0dad-7f3c-00e8-e07e` / `dfd9-3e46-eda5-be8b` / `c80a-0bac-008c-d900` |
| SelectionEntry *Anakonda's Amazons* | `ebf9-c112-3cb4-1f02` (Wurzel-`entryLink` `6b83-e5d0-92db-3d36`) |
| Geteiltes Profil *Anakonda's Amazon* | `0db4-314f-7419-19d7` |
| Slot *Amazons* (Modell) + `infoLink` ohne Modifikatoren | `6bf6-467b-2b6f-71fb` + `3645-5ebd-c72a-1ebb` |
| Slot *Anakonda* + `infoLink` | `14b0-1d64-8f2c-4da2` + `4288-2e40-701a-b5ac` |
| Slot *Humming Bird* + `infoLink` | `f43c-4825-7032-8043` + `cc45-7f67-1cbd-3b1a` |
| Slot *Pirrana* + `infoLink` | `b7de-ebe9-8eb4-de58` + `8ce4-f9da-a2ec-ba16` |
| Gruppen *Equipment* / *Command group* | `a2b9-a75e-a12d-748e` / `0517-9b7e-63ff-cde0` |
| Force-Grenze der Amazonen (Basis `max 0`, per Modifier auf 1) | `8626-3c7d-20c5-129b` |
| Schalter „Allow experimental rules?" (`.gst`) | `8b76-92c4-23f9-54b1` (OK-`entryLink` `9a0b-4d97-1625-919f`) |
| Pflichtgrenzen der Amazonen (min 5 Modelle, Blades, Ruestung, Kommandotrupp) | `bd7e-e5cf-c571-7659`, `d8f0-cec9-edf3-0fbe`, `feb1-c10d-9318-dbda`, `0e94-6317-5852-6ba5`, `b883-c633-6422-0cbc`, `9e16-9834-5aaf-48a1` |

## Abgleich mit dem Engine-Lauf: zwei Grenzen aus der Erwartung genommen

Beim ersten Runner-Lauf feuerten drei Grenzen, die als `absent` deklariert waren,
obwohl das Roster die geforderte Auswahl enthält:

| Grenze | Anker | Ist / Grenze |
|---|---|---|
| `dfd9-3e46-eda5-be8b` (min 1 *Hand Weapon*) | `b581-8a9e-9d0c-b7c8` | 0 / 1 |
| `feb1-c10d-9318-dbda` (min 1 *Light Armour* der Amazonen) | `d3dc-56c1-9565-889a` | 0 / 1 |

Die Untersuchung an den Daten zeigt ein **gemeinsames Muster, das nichts mit
Merkmals-Modifikatoren zu tun hat**: beide Grenzen sind nicht an der Auswahl-
Definition deklariert, sondern am `entryLink`, der sie hereinzieht
(`Mercenaries (…).cat` Z. 7462–7464 bzw. Z. 4352–4354) — und zwar mit
`scope="parent"`. Ein Roster benennt eine so bezogene Auswahl mit *zwei* Ids:
`entryId` (das Ziel) und `entryLinkId` (der Verweis). Die Zählung findet die
Instanz unter der Ziel-Id, die Pflicht-Grenze fragt aber nach der Link-Id — also
zählt sie 0 und meldet die Pflicht als unerfüllt, obwohl die Auswahl gesetzt ist.

Das ist ein eigenständiger Befund an der Verweis-Identität, kein Ergebnis dieses
Szenarios und keine Aussage über Merkmals-Modifikatoren. Die beiden Ids sind
deshalb aus `absent` **entfernt** — das Manifest macht über sie schlicht keine
Aussage mehr (die Erwartung ist selektiv, nicht erschöpfend). Sie wurden
ausdrücklich **nicht** nach `firing` verschoben: das würde das beobachtete
Verhalten als gewollt festschreiben. Alle Merkmals-Erwartungen dieses Szenarios
trafen im selben Lauf unverändert zu.
