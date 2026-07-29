# E2E-Regeln & Testkatalog: Army Standard Bearer (Orcs & Goblins)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-IDs und Erwartungswerte (`actual`/`bound`) sind **ausschliesslich aus
den Katalogdaten** der *6th Definitive Edition* **abgeleitet** — nicht aus einem
Engine-Lauf und nicht aus dem Evaluator-Quellcode. Das Roster-Format ist an den
bereits verifizierten Beispiel-Dateien dieses Projekts orientiert (direktes
`entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — hier lebt der **geteilte** BSB-Eintrag.
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`.
- Abhaengigkeit: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`) via `catalogueLink` (`.cat`-Zeile 14916) — im Datensatz
  mitgefuehrt.

## Wie der BSB im Roster gewaehlt wird (wichtig)

Der „Battle Standard Bearer" ist **ein geteilter `selectionEntry`** im `.gst`
(`e9ad-f1ce-aebf-6d23`, `.gst`-Zeile 799). Die Charaktere binden ihn ueber
`entryLink`s ein (z. B. Orc Bigboss `4280-e373-746b-438f`, `.cat`-Zeile 1700;
Goblin Bigboss `c312-e4d9-02b1-65c5`, `.cat`-Zeile 2465). Die Roster waehlen ihn
**direkt ueber die eigene `entryId` `e9ad-f1ce-aebf-6d23`** mit leerem
`entryLinkId` — **nie** ueber eine zusammengesetzte `linkId::targetId` (solche
Composite-IDs loesen nicht auf und waren der urspruengliche Defekt dieses
Szenarios). Struktur:

```
selectionEntry "Orc Bigboss" (6279-4d0a-6dce-f2f3)              ← Force-Selection (Charakter)
  └ entryLink "Battle Standard Bearer" → e9ad-f1ce-aebf-6d23     ← direkt als entryId gewaehlt
       ├ constraint 082b-067c-b983-c393  max 1  scope=roster     (armeeweit)
       ├ constraint 01a5-106d-f6e8-560b  max 1  scope=parent     (je Charakter)
       └ entryLink "Magical Standard" → 0406-bb04-6134-2ee9      ← magische Standarte, max 1
```

Zusaetzlich haengt die **Kategorie** „Battle standard bearer"
(`2ef7-3efe-a448-423f`) an jedem BSB (categoryLink `9968-62a6-6d39-ac81`,
`.gst`-Zeile 810). Diese `categoryEntry` traegt **eigene** (kategorie-skopierte)
Grenzen — siehe ASB-R3.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ASB-R1** | **Je Charakter** darf der Battle Standard Bearer **hoechstens einmal** gewaehlt werden. | Geteilter Eintrag `selectionEntry "Battle Standard Bearer"` `e9ad-f1ce-aebf-6d23` (`.gst` Z. 799) → constraint **`01a5-106d-f6e8-560b`** `type=max value=1 field=selections scope=parent` (`.gst` Z. 802). |
| **ASB-R2** | **Armeeweit** darf es **hoechstens einen** Battle Standard Bearer geben. | Derselbe Eintrag `e9ad…` → constraint **`082b-067c-b983-c393`** `type=max value=1 field=selections scope=roster includeChildSelections=true` (`.gst` Z. 801). |
| **ASB-R3** | Die `categoryEntry "Battle standard bearer"` (`2ef7…`) traegt **eigene** zaehlende Grenzen: je Elter max 1 (`6935…`) und je Force max 1 (`2a1d…`). Laut Datenformat ([§5.5/§5.6](../../battlescribe-data-format.md)) gelten `categoryEntry`-Grenzen **ohne** Wiederholung am `categoryLink`, und eine `scope="force"`-Grenze mit **Kategorie**-Ziel zaehlt **armeeweit**. Unter **Border Patrols** setzt ein Modifier die Force-Grenze `2a1d` auf **0** (BSB dort verboten). | `categoryEntry 2ef7-3efe-a448-423f` (`.gst` Z. 728) → constraints **`6935-5f06-39d4-5f45`** `max 1 scope=parent` (Z. 730) und **`2a1d-03a1-b48c-64ad`** `max 1 scope=force includeChildSelections=true includeChildForces=true` (Z. 731); modifier `set value=0 field=2a1d…` unter `condition atLeast 1 childId="4e15-0353-165f-5528" (Border Patrols rules) scope=force` (`.gst` Z. 733–740). Mitgliedschaft via categoryLink `9968-62a6-6d39-ac81` am BSB-Eintrag (`.gst` Z. 810). |
| **ASB-R4** | Ein BSB darf **hoechstens eine** magische Standarte tragen. | Am BSB-`entryLink` haengt der Gruppen-`entryLink "Magical Standard"` → `0406-bb04-6134-2ee9` mit constraint **`b836-2be2-d9aa-2f6f`** `max 1 scope=parent` (Orc Bigboss, `.cat` Z. 1704; je Charakter eigene ID, z. B. Goblin Bigboss `5f6f-4380-6050-356e`, `.cat` Z. 2469). |
| **ASB-R5** | Traegt ein BSB eine magische Standarte, **darf er kein weiteres Magie-Item** waehlen. Dies ist als **Verfuegbarkeit (`hidden`)** modelliert, nicht als zaehlende Schranke. | Gruppe „Magic Items" des Orc Bigboss `85e5-c24a-91be-160c` → `modifier set value=true field=hidden` mit `condition atLeast 1 childId="0406-bb04-6134-2ee9" (Magical Standard) scope=unit` (`.cat` Z. 1544–1550, Kommentar „BSB"). Analoge `hidden`-Modifier verbergen auch Shield/Additional-Hand-Weapon usw. bei gesetzter BSB-Kategorie. |

**Hinweis zur Abgrenzung (ASB-R3 & ASB-R5):** Der Verletzungsbericht des
Evaluators kodiert **zaehlende Selektions-Constraints und strukturelle
Diagnosen**, keine Verfuegbarkeit (`hidden`) und keine Profilwerte. Daraus
abgeleitet:

- **ASB-R1/ASB-R2** sind zaehlende `max`-Constraints auf dem `selectionEntry`
  (Feld `selections`) — dieselbe Gattung, die im Pilot als feuernde Grenze
  verifiziert ist. Sie werden hier als **feuernd** erwartet.
- **ASB-R3, Force-Grenze `2a1d`:** ebenfalls ein zaehlender `max`-Constraint
  (Feld `selections`), nur dass er an der `categoryEntry` haengt. Laut
  Datenformat §5.5/§5.6 gilt er dort **vollwertig** — ohne Wiederholung am
  `categoryLink` — und zaehlt sein Kategorie-Ziel **armeeweit**. Er wird daher
  ueberall dort als **feuernd** erwartet, wo die Roster-Struktur ihn reisst:
  Roster 02 (zwei BSB, Ist 2 > 1), Roster 03 (`number=2`, Ist 2 > 1) und
  Roster 04 (Border-Patrols-Modifier setzt die Grenze auf 0, Ist 1 > 0). Die
  fruehere Domaenenkonvention („kategorie-skopierte Grenzen erscheinen nie als
  Zaehl-Verletzung") ist mit Issue 0092 verworfen — sie beschrieb eine
  Engine-Einschraenkung, keinen BattleScribe-Datenfakt.
- **ASB-R3, Parent-Grenze `6935`:** bleibt in allen Rostern **unveraendert**
  als `absent` gepinnt — ihre Neubewertung ist von Issue 0092 nicht erfasst
  und nicht Teil dieser Aenderung. Fuer Roster 03 ist das ein **offener
  Punkt**: nach derselben §5.5-Lesart waere dort Ist 2 je Elter > Grenze 1
  denkbar.
- **ASB-R4** haelt in allen Rostern die Grenze ein (hoechstens eine Standarte) und
  feuert daher nirgends; sie ist kein Assertions-Fokus.
- **ASB-R5** ist als `hidden` modelliert und daher **keine** zaehlende Verletzung.

> **Kein Engine-Lauf.** Dieses Dokument trifft **keine** Aussage aus einem
> tatsaechlichen Evaluator-Lauf. `actual`/`bound` je Roster ergeben sich allein aus
> (a) der Constraint-`value` im Katalog (inkl. anwendbarer Modifier) und (b) der
> im Roster gebauten Selektions-Anzahl unter dem jeweiligen `scope`.

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + Orcs-&-Goblins-`.cat` (+ die per `catalogueLink` benoetigte
`Mercenaries`-`.cat`). Format wie die verifizierten Beispiel-Dateien (direktes
`entryId`, `entryLinkId=""`).

> **Assertion-Fokus:** nur die genannten BSB-Constraint-IDs. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit) koennen zusaetzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Abgeleitete Erwartung (Bericht) | Fixture |
|---|-----------|----------------|----------------------------------|---------|
| 01 | Ein BSB (legal) | Orc Bigboss + **1** BSB. | **Keine** BSB-Verletzung: `082b` (roster, max 1), `01a5` (parent, max 1) und `2a1d` (kategorie/force, max 1) je Ist 1 ≤ 1. | [`01-bsb-single-legal.ros`](rosters/01-bsb-single-legal.ros) |
| 02 | Zwei BSB in einer Armee (unzulaessig) | Orc Bigboss + **1** BSB **und** Goblin Bigboss + **1** BSB. | **ASB-R2 feuert:** armeeweite Grenze `082b` (scope=roster) Ist **2** / Grenze **1**. **ASB-R3 feuert ebenfalls:** Kategorie-Force-Grenze `2a1d` (zaehlt armeeweit, §5.6) Ist **2** / Grenze **1** — beide BSB tragen die Kategorie `2ef7`. `01a5` und `6935` halten (je Charakter 1). | [`02-bsb-two-in-army-illegal.ros`](rosters/02-bsb-two-in-army-illegal.ros) |
| 03 | BSB zweimal an einem Charakter (unzulaessig) | Orc Bigboss + BSB mit `number="2"`. | **ASB-R1 feuert:** Charakter-Grenze `01a5` (scope=parent) Ist **2** / Grenze **1**. **Zusaetzlich** feuern `082b` (roster) Ist **2** / Grenze **1** **und** `2a1d` (kategorie/force, armeeweit) Ist **2** / Grenze **1**. `6935` bleibt unveraendert `absent` gepinnt (offener Punkt, s. Hinweis zu ASB-R3). | [`03-bsb-twice-on-one-character-illegal.ros`](rosters/03-bsb-twice-on-one-character-illegal.ros) |
| 04 | BSB unter Border Patrols (unzulaessig) | Orc Bigboss + **1** BSB + Force-Selektion **Border Patrols rules** (`4e15-0353-165f-5528`). | **ASB-R3 feuert:** der Border-Patrols-Modifier (`.gst` Z. 734–739, Bedingung `atLeast 1` x `4e15…` `scope=force` — im Roster erfuellt) setzt die Kategorie-Force-Grenze `2a1d` auf **0**; mit einem BSB gilt Ist **1** / Grenze **0**. `082b`/`01a5` halten (1 ≤ 1). | [`04-bsb-border-patrols-illegal.ros`](rosters/04-bsb-border-patrols-illegal.ros) |
| 05 | Kein BSB (Grundlinie) | Nur Orc Bigboss, **kein** BSB. | **Keine** BSB-Verletzung: BSB ist optional (nur `max`, keine `min`), Ist 0. | [`05-no-bsb-baseline.ros`](rosters/05-no-bsb-baseline.ros) |
| 06 | BSB mit genau einer Standarte (legal) | Orc Bigboss + BSB + **War Banner** (`f327-567f-ef99-0403`, Gruppe `0406`). | **Keine** BSB-Verletzung: eine Standarte (ASB-R4 max 1 eingehalten), ein BSB. | [`06-bsb-magic-standard-only-legal.ros`](rosters/06-bsb-magic-standard-only-legal.ros) |
| 07 | BSB mit Standarte + zusaetzlichem Magie-Item (unzulaessig) | Orc Bigboss + BSB + War Banner + **Sword of Might** (`8c56-9be1-c4a9-5afe`, Gruppe `6d5f`). | **Keine** BSB-Zaehl-Verletzung: die Sperre „kein weiteres Magie-Item bei Standarte" ist als `hidden` (ASB-R5) modelliert, nicht als Zaehlgrenze. | [`07-bsb-magic-standard-plus-item-illegal.ros`](rosters/07-bsb-magic-standard-plus-item-illegal.ros) |

### Ableitung von `actual`/`bound` (aus Roster-Struktur + Katalog-`value`)

| Roster | Grenze | `scope` | gezaehlt | `actual` | `bound` | feuert? |
|--------|--------|---------|----------|----------|---------|---------|
| 02 | `082b-067c-b983-c393` | roster | BSB-Selektionen im ganzen Roster (2 Charaktere × 1) | **2** | 1 | **JA** |
| 02 | `2a1d-03a1-b48c-64ad` | force (Kategorie-Ziel → armeeweit) | Mitglieder der Kategorie `2ef7` (2 BSB, je via categoryLink `9968…`) | **2** | 1 | **JA** |
| 02 | `01a5-106d-f6e8-560b` | parent | BSB je Charakter (je 1) | 1 | 1 | nein |
| 03 | `01a5-106d-f6e8-560b` | parent | BSB unter dem Orc Bigboss (`number=2`) | **2** | 1 | **JA** |
| 03 | `082b-067c-b983-c393` | roster | BSB-Selektionen im Roster (`number=2`) | **2** | 1 | **JA** |
| 03 | `2a1d-03a1-b48c-64ad` | force (Kategorie-Ziel → armeeweit) | Kategorie-Mitglieder (`number=2`) | **2** | 1 | **JA** |
| 04 | `2a1d-03a1-b48c-64ad` | force (Kategorie-Ziel → armeeweit) | 1 BSB; Border-Patrols-Modifier setzt die Grenze auf **0** | **1** | **0** | **JA** |
| 01,05–07 | `082b` / `01a5` / `2a1d` | roster / parent / force | 0 bzw. 1 BSB, Grenze je 1 | 0/1 | 1 | nein |
| alle | `6935` | parent (kategorie-skopiert) | Pin unveraendert `absent` (nicht Teil von Issue 0092; Roster 03: offener Punkt) | — | 1 | **nein** (Pin) |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (`.gst`) | `0d13-7737-ea86-4662` |
| Katalog „Orcs and Goblins" (`.cat`) | `4049-c46d-7f80-44fb` |
| Abhaengigkeit „Mercenaries" (`catalogueLink` targetId) | `fc47-8392-a6c8-452a` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| Geteilter Eintrag „Battle Standard Bearer" (`.gst`) | `e9ad-f1ce-aebf-6d23` |
| **ASB-R2** armeeweite Obergrenze (max 1, scope=roster) | `082b-067c-b983-c393` |
| **ASB-R1** Charakter-Obergrenze (max 1, scope=parent) | `01a5-106d-f6e8-560b` |
| Kategorie „Battle standard bearer" (`categoryEntry`) | `2ef7-3efe-a448-423f` |
| BSB-Kategoriezugehoerigkeit (`categoryLink` am BSB-Eintrag) | `9968-62a6-6d39-ac81` |
| **ASB-R3** Kategorie-Force-Grenze (max 1, unter Border Patrols → 0) | `2a1d-03a1-b48c-64ad` |
| **ASB-R3** Kategorie-Parent-Grenze (max 1) | `6935-5f06-39d4-5f45` |
| **ASB-R4** „Magical Standard"-Gruppe (max 1 je BSB) | `0406-bb04-6134-2ee9` (constraint Orc Bigboss `b836-2be2-d9aa-2f6f`) |
| **ASB-R5** „Magic Items"-Gruppe Orc Bigboss (hidden bei Standarte) | `85e5-c24a-91be-160c` |
| Border Patrols rules (Force-Selektion) | `4e15-0353-165f-5528` |
| Orc Bigboss (Charakter, mit BSB-Link) | `6279-4d0a-6dce-f2f3` |
| Goblin Bigboss (Charakter, mit BSB-Link) | `8c8f-3fba-e337-fd2f` |
| War Banner (magische Standarte, Gruppe `0406`) | `f327-567f-ef99-0403` |
| Sword of Might (Magie-Waffe, Gruppe `6d5f-aed3-1c41-d305`) | `8c56-9be1-c4a9-5afe` |
