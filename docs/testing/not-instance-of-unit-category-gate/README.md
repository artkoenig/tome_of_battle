# E2E-Regeln & Testkatalog: `notInstanceOf` mit `scope="unit"` auf eine **Kategorie**

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7
Kasten [`scope="unit"`/`scope="ancestor"`](../../battlescribe-data-format.md#scope-unit-ancestor),
§7.7 Tabelle *condition* und §8) abgeleitet; das Roster-Format ist an den bereits
verifizierten Szenarien nachgebildet (direktes `entryId`, `entryLinkId=""`,
verschachtelte `selections` mit `number`, `entryGroupId` an Gruppen-Mitgliedern).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1),
  dazu die per `catalogueLink` (`ef73-f9bd-e250-54d2`, Z. 29511) benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).
- Kontingent: **„Standard (VC-AB)"** `e989-15b8-7eb6-9668` (Z. 29297).

> **Gegenstück.** Die positive Polarität desselben Konstrukts pinnt
> [`../unit-scope-instance-of-category/`](../unit-scope-instance-of-category/README.md)
> (dort mit einer erst zur **Laufzeit** per `add category` erteilten Kategorie).
> Dieses Szenario pinnt die **inverse** Richtung — in jenem Szenario ausdrücklich als
> „an diesen Trägern nicht beobachtbar" ausgelassen — an den einzigen beiden
> `notInstanceOf`/`scope="unit"`-Vorkommen des ganzen Korpus.

> **Assertion-Form:** Die Kernaussage ist je Roster ein `expect.capabilities[]`-Eintrag
> mit `isHidden` am Slot des gegateten `entryLink`s (`defId` = der **Verweis**,
> `targetDefId` = sein Ziel) — exakte Gleichheit auf dem effektiven
> Sichtbarkeits-Flag. Sichtbarkeit ist **Verfügbarkeit**, keine zählende Grenze: sie
> erscheint **nicht** als feuerndes Limit im Verletzungsbericht. `firing` bleibt darum
> leer — mit Ausnahme der Roster 05/06, in denen der jeweils **sichtbare** Gegenstand
> bewusst doppelt geführt wird und die eigenen `max`-Grenzen der Verweise reißen.
> `absent` pinnt zusätzlich, dass die zählenden Grenzen der beteiligten Einträge in
> den übrigen Aufbauten still bleiben. Andere Armeeaufbau-Diagnosen (General-/Core-
> Pflicht, Punktelimit) dürfen zusätzlich auftreten (selektive Erwartung).

---

## Was die Formatspezifikation über `notInstanceOf` + `scope="unit"` sagt

Wörtlich abgeleitet aus §7.7 (Kasten *`scope="unit"` und `scope="ancestor"`*), §7.7
(Tabelle `condition`) und §8:

- **`unit` ist der nächste Vorfahre mit `type="unit"` — den Träger der Query
  eingeschlossen.** `selectionEntryGroup`s und `entryLink`s tragen kein `type` und
  unterbrechen die Suche nicht; für einen Ausrüstungs-Slot tief in geschachtelten
  Gruppen ist der Rahmen deshalb die umschließende **Einheit**. Ohne umschließende
  Einheit wertet die Auswertung fail-closed (`unresolvedScope`).
- **`instanceOf`/`notInstanceOf` sind Prüfungen, keine Zählungen.** Das Ziel wird
  „über seine Definitions-Id, seine Link-Ziel-Id, eine seiner **effektiven**
  Kategorien oder seinen rohen Typ" aufgelöst — die einzige Auflösung, unter der eine
  `childId` sinnvoll ist, die im Katalog eine `categoryEntry` benennt (genau der Fall
  hier). `notInstanceOf` ist die Negation: sie hält, wenn die Auflösung **nicht**
  trifft. `percentValue` ist laut Wiki bei `instanceOf` ohne Wirkung, das `value="1"`
  der Bedingung folglich ein bedeutungsloser Rest.
- **`set hidden`** (§7.7/§8): hält die Bedingung, ersetzt der `value` das Flag exakt;
  hält sie nicht, gilt der Basiswert. `hidden` an **Verweis und Ziel** wirken als
  **ODER** — ein Vorkommen ist versteckt, sobald eine der beiden Seiten es ist.
- **Effektive Kategorien** (§8): kategorie-abhängige Logik liest die effektiven
  Kategorie-Links (statische `categoryLinks` **plus** `add`/`remove`/`set-primary`
  zur Laufzeit), nie Namen.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Alle Zeilennummern beziehen sich auf `Vampire Counts (6th definitive edition).cat`,
sofern nicht anders vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **NIUC-R1** | **Genau zwei Vorkommen, beide im selben geteilten Rahmen.** Der Korpus kennt das Konstrukt `condition type="notInstanceOf" field="selections" scope="unit" childId=<Kategorie>` an genau zwei Stellen; beide stehen als **einzige** Bedingung eines `modifier type="set" value="true" field="hidden"` an einem `entryLink` der geteilten Gruppe *Magic Weapons (VC)*. | `selectionEntryGroup id="bf27-6ca6-5c3a-3449" name="Magic Weapons (VC)" hidden="false"` (Z. 21047, in `sharedSelectionEntryGroups`). Vorkommen 1: Z. 21058. Vorkommen 2: Z. 21070. Die Gruppe selbst trägt **keine** `constraints` und **keinen** `hidden`-Modifikator (ihr einziger Modifikator, Z. 21123, ist ein `append` auf `name`, gegatet auf `7d87-7436-5341-bbc0` — in keinem Roster dieses Szenarios gewählt). |
| **NIUC-R2** | **Blood Drinker ist nur auf einem *Vampire* sichtbar.** Der Verweis trägt Basis `hidden="false"`, sein Ziel ebenfalls; der `set hidden=true` greift genau dann, wenn die umschließende Einheit **nicht** Mitglied der Kategorie „Vampire" ist. | `entryLink import="true" name="Blood Drinker" hidden="false" id="8427-3c8d-f4af-8af3" targetId="ab72-7ce0-8eea-7ea6"` (Z. 21054) mit `<modifier type="set" value="true" field="hidden">` (Z. 21056) und der einzigen Bedingung `<condition type="notInstanceOf" value="1" field="selections" scope="unit" childId="017d-3857-a815-782f" shared="true"/>` (Z. 21058). `017d-3857-a815-782f` ist `categoryEntry name="Vampire"` (Z. 43). Ziel `ab72-7ce0-8eea-7ea6` (Z. 14104): `hidden="false"`, **kein** eigener Modifikator, 50 pts. |
| **NIUC-R3** | **Sword of the Kings ist nur auf einem *Wight* sichtbar.** Identische Bauform, andere Kategorie. | `entryLink import="true" name="Sword of the Kings " hidden="false" id="2749-9013-530a-a980" targetId="408c-9cf1-0288-5d87"` (Z. 21066), Modifikator Z. 21068, einzige Bedingung `<condition type="notInstanceOf" value="1" field="selections" scope="unit" childId="5c44-3a90-6b26-bc32" shared="true"/>` (Z. 21070). `5c44-3a90-6b26-bc32` ist `categoryEntry name="Wight"` (Z. 44). Ziel `408c-9cf1-0288-5d87` (Z. 14083): `hidden="false"`, **kein** eigener Modifikator, 25 pts. |
| **NIUC-R4** | **Das gekreuzte Paar: jede der beiden Einheiten führt genau eine der beiden Kategorien.** Der **Wight Lord** ist ein Wight und kein Vampir, der **Vampire Count** ein Vampir und kein Wight. Auf dem Wight Lord muss deshalb `Sword of the Kings ` sichtbar und `Blood Drinker` verborgen sein — auf dem Vampire Count exakt umgekehrt. | `selectionEntry id="b9c6-93fb-ce3c-965a" name="Wight Lord" type="unit"` (Z. 2107), `categoryLinks` Z. 2112–2116: Heroes `c16b-f319-2c62-2c12` (primär), Characters `7a1c-d611-c2dc-def1`, **Wight** `5c44-3a90-6b26-bc32` (Z. 2115). `selectionEntry id="6822-0110-a7c9-cbb0" name="Vampire Count" type="unit"` (Z. 3124), `categoryLinks` Z. 3172–3176: Lord `d024-d25b-a9b4-73b6` (primär), Characters, **Vampire** `017d-3857-a815-782f` (Z. 3175). |
| **NIUC-R5** | **Die Mitgliedschaft ist eindeutig und statisch.** Im gesamten Fixture-Korpus steht `017d-3857-a815-782f` an vier `categoryLink`s (Z. 2767, 3175, 3528, 12824) und `5c44-3a90-6b26-bc32` an genau **einem** (Z. 2115, Wight Lord); **kein** `modifier … field="category"` trägt eine der beiden Ids als `value`. Es gibt also keinen Laufzeit-Weg, der einer Einheit eine dieser Kategorien erteilt oder entzieht. | Volltextsuche über `src/evaluator/__fixtures__/whfb6-definitive/` nach beiden Ids: nur die `categoryEntry`-Definitionen (Z. 43/44), die genannten `categoryLink`s und die beiden `condition`s (Z. 21058/21070). Kein `value="017d-…"`/`value="5c44-…"`. |
| **NIUC-R6** | **Derselbe geteilte Rahmen, zwei völlig verschiedene Wege.** Der Wight Lord erreicht `bf27-…` über **eine** Gruppen-/Verweis-Ebene, der Vampire Count über **fünf**. Keine Zwischenstufe trägt ein `type`-Attribut — der nächste `unit`-Vorfahre ist in beiden Fällen die Einheit. | Wight Lord: `selectionEntryGroup deae-815d-c2ef-a607 "Magic Items"` (Z. 2292) → `entryLink 3219-3f82-eead-b592` (Z. 2296) → `bf27-6ca6-5c3a-3449`. Vampire Count: `entryLink 2dc4-ffd3-2c99-c560 "Magic selection"` (Z. 3385) → `selectionEntryGroup 53e8-0ce2-eaf6-0163` (Z. 21290) → `entryLink 14d2-cec2-9b1c-418c` (Z. 21292) → `selectionEntryGroup 11e6-e9d4-f6e4-c02d "Magic Items"` (Z. 21272) → `entryLink afe1-9a75-ceba-5949` (Z. 21276) → `bf27-6ca6-5c3a-3449`. Alle Zwischenstufen sind `selectionEntryGroup`/`entryLink`. |
| **NIUC-R7** | **Kein Rahmen verdeckt das Ergebnis.** Die Wight-Lord-Gruppe `deae-…` wird nur bei einem Battle Standard Bearer verborgen (`atLeast 1 scope="unit" childId="0937-a1bc-b331-8ce1"`), der Verweis `14d2-…` des Vampirs nur bei einer **Strigoi**-Blutlinie im Kontingent. Beides ist in allen sechs Rostern ausgeschlossen: kein BSB, und die `Bloodlines`-Auswahl bleibt bewusst **ohne** Clan. | Wight Lord: `modifier set hidden=true` an `deae-815d-c2ef-a607`, Z. 2307–2312 (`<comment>BSB</comment>`). Vampire Count: `modifier set hidden=true` an `14d2-cec2-9b1c-418c`, Z. 21294–21298, Bedingung `childId="ddfa-0d72-8557-6906"` (Strigoi). |
| **NIUC-R8** | **Kontrolle „ungegatetes Geschwister": Frostblade** trägt in derselben Gruppe **keinen** `hidden`-Modifikator (Verweis und Ziel `hidden="false"`) und ist deshalb in **jedem** Roster sichtbar. Die Sichtbarkeitsänderung der beiden Prüflinge ist damit dem Modifikator zuzuschreiben, nicht dem Rahmen. | `entryLink name="Frostblade" hidden="false" id="506f-3f9c-a66a-b9fc" targetId="1a6a-193c-1cfa-d730"` (Z. 21049) — nur `<constraints>`, keine `<modifiers>`. Ziel Z. 13828: `hidden="false"`, ohne Modifikator. |
| **NIUC-R9** | **Kontrolle „umgekehrte Polarität": Black Axe of Krell** trägt dasselbe `set hidden=true`, aber gegatet auf eine **`or`-Gruppe zweier `instanceOf`** auf demselben `scope="unit"`. Da in keinem Roster eine Clan-Blutlinie gewählt ist, führt keine Einheit die Kategorien Necrarch/Lahmia — die `instanceOf`-Prüfungen halten **nicht**, der Slot bleibt sichtbar. Das trennt „Polarität falsch herum" von „Rahmen falsch". | `entryLink name="Black Axe of Krell" hidden="false" id="07db-c99e-adb7-22ed" targetId="8569-0a6f-3d66-7daf"` (Z. 21079), `conditionGroup type="or"` (Z. 21083) mit `instanceOf … childId="fc4b-a86d-5897-9e4c"` (Necrarch, Z. 21085) und `instanceOf … childId="c872-4b18-1aad-6953"` (Lahmia, Z. 21086). Ziel Z. 14072: `hidden="false"`, ohne Modifikator. |
| **NIUC-R10** | **Kontrolle „Basiswert `hidden="true"`": Asp Bow** ist am Verweis basis-verborgen und wird nur durch ein `instanceOf` auf Lahmia aufgedeckt; ohne Clan hält der Aufdecker nicht, der Slot bleibt in **jedem** Roster verborgen. Er belegt, dass ein `isHidden: true` auch ohne haltendes Gatter vorkommt — die beiden Prüflinge werden also nicht bloß „irgendwie" verborgen gemeldet. | `entryLink name="Asp Bow " hidden="true" id="cce6-6082-b5e0-32fe" targetId="b60a-1687-9e54-9291"` (Z. 21102) mit `modifier set hidden=false` (Z. 21104), Bedingung `instanceOf … scope="unit" childId="c872-4b18-1aad-6953"` (Z. 21106). Ziel Z. 14094: `hidden="false"` — nach der ODER-Regel (§8) bleibt das Vorkommen trotzdem verborgen. |
| **NIUC-R11** | **Sichtbarkeit und Zählgrenze sind unabhängig.** Der Sword-Verweis trägt **zwei** eigene Hoechstmasse — `max 1 scope="parent"` und `max 1 scope="force"` —, der Blood-Drinker-Verweis nur **eines** (`scope="force"`). Wird der jeweils *sichtbare* Gegenstand doppelt geführt, reißen genau diese Grenzen mit **Ist 2 / Grenze 1**, während `isHidden` unverändert `false` bleibt. | Sword: `constraint type="max" value="1" field="selections" scope="parent" shared="true" id="8f7d-d49e-d74c-81b3"` (Z. 21075) und `… scope="force" … id="ff3a-8103-8351-eba5"` (Z. 21076). Blood Drinker: nur `… scope="force" … id="17dc-3976-7dfc-5700"` (Z. 21063). Gezählt wird das Ziel des Verweises (§7.6); eine Auswahl mit `number="2"` trägt 2 bei (§7.5, Zahlenbasis der Reinraum-Engine). |
| **NIUC-R12** | **Die Punkte-Budgets bleiben in allen sechs Rostern still** — die Doppelwahl trifft sie exakt, überschreitet sie aber nicht. Wight Lord: 2 × 25 = **50** gegen `max 50`. Vampire Count: 2 × 50 = **100** gegen `max 100`. | Wight Lord: `constraint type="max" value="50" field="ecfa-8486-4f6c-c249" scope="parent" id="b012-c96f-128c-0848"` an `deae-815d-c2ef-a607` (Z. 2304). Vampire Count: `constraint type="max" value="100" field="ecfa-8486-4f6c-c249" scope="parent" id="61f5-4991-b5f9-32bd"` am Verweis `2dc4-ffd3-2c99-c560` (Z. 3387). Kosten: Sword 25 pts (Z. 14089), Blood Drinker 50 pts (Z. 14110); die Verweise selbst tragen keine eigenen `<costs>`. |
| **NIUC-R13** | **Legale, minimale Einheiten:** beide Einheiten erfüllen ihre Pflicht-Kinder, damit sich die Sichtbarkeits-Aussagen nicht mit unerfüllten Mindestmaßen vermischen. Die armeeweite Blutlinien-Pflicht ist durch die `Bloodlines`-Auswahl erfüllt, ihre Gruppe hat **kein** Mindestmaß und bleibt darum ohne Clan legal. | Wight Lord: `selectionEntry Handweapon c527-e525-5b58-9b7c` (Z. 2118) `min 1` = `a775-7b1e-7fa8-d353` (Z. 2121) / `max 1` = `34c1-6e91-4dae-0ef6` (Z. 2120); `selectionEntry Handweapon c43e-3854-1448-20fc` (Z. 2225) in Gruppe `2e1a-7fe5-3705-33d0` „Weapons" (Z. 2173) `min 1` = `ed42-9091-8bf7-8006` (Z. 2228) / `max 1` = `8c58-8d92-f372-a13d` (Z. 2227), Gruppengrenze `max 2` = `d0f2-4ae3-a163-7081` (Z. 2241). Vampire Count: Handweapon `9e6c-19ea-19ad-7cbe` (Z. 3258) `min 1` = `3a5f-f22c-f213-581e` / `max 1` = `6798-e03b-977d-7506`; Gruppe `7ab1-d9dc-6124-443f` „Wizard Level" (Z. 3178) `min 1` = `19ba-de18-6ad7-2825` / `max 1` = `436d-44fa-86cf-bf42`, erfüllt durch **Magic Level 2** (`entryLink 5a5f-aaf8-868f-9630` → `fbc2-5115-f240-7367`, Z. 3184). `Bloodlines` `a56a-eb32-5a45-16fd` (Z. 5094) `min 1 scope="force"` = `4a0a-b107-e726-da32` (Z. 5194); Gruppe `5655-13ba-8980-bd1c` (Z. 5099) hat **nur** `max 1` = `39c7-f615-17db-7016` (Z. 5101), kein `min`. |

### Warum die `Bloodlines`-Auswahl bewusst **ohne** Clan bleibt

Eine Clan-Blutlinie im Kontingent erteilt dem Vampire Count über seine
`BLOODLINE`-`modifierGroup` (Z. 3422–3498) eine Clan-Kategorie. Diese Kategorien
sind genau die Ziele der beiden **Kontroll**-Gatter (Black Axe: Necrarch/Lahmia,
Asp Bow: Lahmia) und — im Fall Strigoi — der Auslöser, der den ganzen
Magic-Item-Baum des Vampirs verbirgt (NIUC-R7). Ohne Clan hält **keines** dieser
Gatter, in **keinem** der sechs Roster und auf **keiner** der beiden Einheiten. Damit
bleibt genau eine Variable übrig: die statische Kategorie der umschließenden
Einheit — der Auslöser, den dieses Szenario isoliert.

### Warum die Kategorien zusätzlich in den `<categories>` der Roster stehen

Anders als im Schwester-Szenario `unit-scope-instance-of-category` (dort entsteht die
Mitgliedschaft erst zur Laufzeit und darf deshalb **nicht** im Roster stehen) sind
„Wight" und „Vampire" hier **statische** `categoryLink`s der Einheiten (NIUC-R5). Die
Roster führen sie deshalb so, wie BattleScribe sie schreibt. Beide Quellen — Katalog
und Roster-Cache — stimmen hier überein; dieser Aufbau unterscheidet sie also
**nicht**. Genau diese Unterscheidung pinnt das Schwester-Szenario, und sie ist hier
an den Daten gar nicht herstellbar.

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `notInstanceOf`/`scope="unit"` gegen eine **Definitions-Id** oder ein **Typ-Keyword** | Existiert im Korpus nicht: beide Vorkommen benennen eine `categoryEntry`. Nur die Kategorie-Auflösung ist an diesen Daten beobachtbar. |
| `includeChildSelections` / `shared="false"` an dieser Bedingungsart | Beide Vorkommen tragen `shared="true"` und **kein** `includeChildSelections`. Die „Zähl-Flags verengen nichts"-Hälfte ist hier nicht variierbar; sie ist im Schwester-Szenario (USIC-R5) an der `instanceOf`-Seite gepinnt. |
| `unresolvedScope` (Slot ohne umschließende Einheit) | Die geteilte Gruppe `bf27-…` hängt in allen vier Verwendungen unter einer `selectionEntry type="unit"`; ein Vorkommen ohne `unit`-Vorfahre gibt es in diesen Daten nicht. |
| Der `hidden`-Zustand als **feuernde** Grenze | Der Verletzungsbericht kodiert zählende Grenzen, keine (Un-)Sichtbarkeit — dieselbe Feststellung wie in `vampire-bloodlines` (VBL-R4/R5). Deshalb steht die Aussage in `capabilities[].isHidden`, nicht in `firing`. |
| Ob ein **verborgener** Gegenstand trotzdem gewählt werden *dürfte* | Die Roster 03–06 wählen nur den jeweils **sichtbaren** Gegenstand. Ob die Engine eine bereits gewählte, nun verborgene Selektion als unzulässig meldet, ist eine eigene Frage (Verfügbarkeit vs. Bestand) und gehört in ein eigenes Szenario. |
| Namen, Kosten und Profile der beteiligten Einträge | Eigene Modifikator-Zellen, abgedeckt von `modifier-effective-name` / `modifier-characteristic-value` / `set-cost-value-force-gate`. Der `append name`-Modifikator der Gruppe (Z. 21123) ist in allen Rostern ungehalten. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle sechs Roster
teilen denselben Aufbau: Kontingent „Standard (VC-AB)" (`e989-15b8-7eb6-9668`), eine
`Bloodlines`-Auswahl **ohne** Clan und **eine** Charaktereinheit mit ihren
Pflicht-Kindern. Die Roster 01/03/05 tragen den **Wight Lord**, die Roster 02/04/06
den **Vampire Count**; genau dieser Unterschied ist der Auslöser.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Wight Lord, nichts gewählt | Wight Lord, Magic-Item-Baum leer. | **NIUC-R3/R4/R6:** `Sword of the Kings ` meldet `isHidden: false`. **NIUC-R2:** `Blood Drinker` meldet `isHidden: true`. **NIUC-R8/R9:** Frostblade und Black Axe `false`, **NIUC-R10:** Asp Bow `true`. Keine der gepinnten Grenzen feuert. | [`01-wight-lord-sword-visible-blood-drinker-hidden.ros`](rosters/01-wight-lord-sword-visible-blood-drinker-hidden.ros) |
| 02 | Vampire Count, nichts gewählt | Vampire Count, Magic-Item-Baum leer. | **Gekreuzt zu 01:** `Blood Drinker` `false`, `Sword of the Kings ` `true`. Die drei Kontroll-Slots melden dieselben Werte wie in 01 — trotz völlig anderer Verweiskette (NIUC-R6). Keine der gepinnten Grenzen feuert. | [`02-vampire-count-blood-drinker-visible-sword-hidden.ros`](rosters/02-vampire-count-blood-drinker-visible-sword-hidden.ros) |
| 03 | Wight Lord führt das Schwert | Wie 01 + `Sword of the Kings ` (`number="1"`, 25 pts). | Der **belegte** Slot meldet weiterhin `isHidden: false`; der ungewählte `Blood Drinker`-Angebots-Slot bleibt `true`. Beide Sword-Grenzen sind mit Ist 1 erfüllt, das 50-Punkte-Budget mit 25 pts (NIUC-R12). | [`03-wight-lord-sword-selected.ros`](rosters/03-wight-lord-sword-selected.ros) |
| 04 | Vampire Count führt den Blood Drinker | Wie 02 + `Blood Drinker` (`number="1"`, 50 pts). | Spiegelbild zu 03: belegter Slot `false`, ungewählter Sword-Slot `true`. Grenze und 100-Punkte-Budget erfüllt. | [`04-vampire-count-blood-drinker-selected.ros`](rosters/04-vampire-count-blood-drinker-selected.ros) |
| 05 | Sichtbar **und** überzählig (Wight Lord) | Wie 03, aber `number="2"`. | **NIUC-R11:** `isHidden` bleibt `false`, **beide** Sword-Grenzen reißen — `8f7d-d49e-d74c-81b3` (parent) und `ff3a-8103-8351-eba5` (force), je Ist **2** / Grenze **1**. **NIUC-R12:** das Budget `b012-c96f-128c-0848` bleibt bei exakt 50 pts still. | [`05-wight-lord-sword-twice-max-fires.ros`](rosters/05-wight-lord-sword-twice-max-fires.ros) |
| 06 | Sichtbar **und** überzählig (Vampire Count) | Wie 04, aber `number="2"`. | **NIUC-R11:** `isHidden` bleibt `false`, es reißt **genau eine** Grenze — `17dc-3976-7dfc-5700` (force), Ist **2** / Grenze **1**. Der parent-skopierte `8f7d-…` gehört allein dem Sword-Verweis und bleibt still. **NIUC-R12:** das Budget `61f5-4991-b5f9-32bd` bleibt bei exakt 100 pts still. | [`06-vampire-count-blood-drinker-twice-max-fires.ros`](rosters/06-vampire-count-blood-drinker-twice-max-fires.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine erst im
**Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **Die Polarität selbst** (NIUC-R2/R3) — ob `notInstanceOf` als Negation der
   Mitgliedschaftsprüfung ausgewertet wird und nicht als „zähle die Auswahlen, die
   nicht dieses Ziel sind" (eine Zählung würde in beiden Einheiten dieselbe Antwort
   liefern und das gekreuzte Paar zum Einsturz bringen).
2. **Der `unit`-Rahmen über verschieden tiefe Ketten** (NIUC-R6) — der Wight Lord
   liegt eine, der Vampire Count fünf Gruppen-/Verweis-Ebenen über dem Slot. Beide
   müssen dieselbe Einheit als Rahmen finden; das trennt „Rahmen falsch" von
   „Tiefe nicht unterstützt".
3. **Die ODER-Komposition von `hidden`** (NIUC-R10) — Verweis `hidden="true"`, Ziel
   `hidden="false"`: das Vorkommen muss verborgen bleiben, sonst wäre der
   Kontroll-Slot fälschlich sichtbar.
4. **Der belegte Slot** (Roster 03/04) — ob `isHidden` auch an einem `occupied`-Anker
   gemeldet wird und dort denselben Wert trägt wie am Angebots-Slot.
5. **Die Slot-Adressierung:** `defId` (der **Verweis**) + `targetDefId` muss jeden
   Slot **eindeutig** treffen. Die geteilte Gruppe `bf27-6ca6-5c3a-3449` wird im
   Katalog von **vier** weiteren Verweisen eingebunden (`cf3d-b18d-ec0a-11a1` Z. 2064,
   `932c-f1ef-24a4-cb32` Z. 2429, `fe4b-665e-1f34-20be` Z. 2618, `afe1-9a75-ceba-5949`
   Z. 21276); in jedem Roster steht deshalb **genau eine** Einheit, die sie erreicht.
6. **Trennung Sichtbarkeit ↔ Zählung** (NIUC-R11) — der überzählige Gegenstand ist
   sichtbar; eine Auswertung, die Sichtbarkeit und Grenze koppelt, würde entweder die
   Grenze verschlucken oder den Slot verbergen.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Kontingent „Standard (VC-AB)" | `e989-15b8-7eb6-9668` (Z. 29297) |
| Geteilte Gruppe „Magic Weapons (VC)" (Rahmen beider Prüflinge) | `bf27-6ca6-5c3a-3449` (Z. 21047) |
| `categoryEntry` „Vampire" / „Wight" (Ziele der `notInstanceOf`-Bedingungen) | `017d-3857-a815-782f` (Z. 43) / `5c44-3a90-6b26-bc32` (Z. 44) |
| Prüfling 1 „Blood Drinker" (Verweis / Ziel), Bedingung Z. 21058 | `8427-3c8d-f4af-8af3` (Z. 21054) → `ab72-7ce0-8eea-7ea6` (Z. 14104, 50 pts) |
| Prüfling 2 „Sword of the Kings " (Verweis / Ziel), Bedingung Z. 21070 | `2749-9013-530a-a980` (Z. 21066) → `408c-9cf1-0288-5d87` (Z. 14083, 25 pts) |
| Eigene Grenzen Blood Drinker | `17dc-3976-7dfc-5700` (`max 1`, `scope="force"`, Z. 21063) |
| Eigene Grenzen Sword of the Kings | `8f7d-d49e-d74c-81b3` (`max 1`, `scope="parent"`, Z. 21075) · `ff3a-8103-8351-eba5` (`max 1`, `scope="force"`, Z. 21076) |
| Kontrolle „Frostblade" (ohne `hidden`-Modifikator) | `506f-3f9c-a66a-b9fc` (Z. 21049) → `1a6a-193c-1cfa-d730` (Z. 13828); Grenze `8a61-b1e5-d2d4-d7b1` |
| Kontrolle „Black Axe of Krell" (`or` aus zwei `instanceOf`) | `07db-c99e-adb7-22ed` (Z. 21079) → `8569-0a6f-3d66-7daf` (Z. 14072); Grenze `cc8f-a62f-7578-e56f` |
| Kontrolle „Asp Bow " (Verweis basis-`hidden="true"`) | `cce6-6082-b5e0-32fe` (Z. 21102) → `b60a-1687-9e54-9291` (Z. 14094); Grenze `91ca-38e5-e64f-2e3e` |
| Einheit „Wight Lord", `type="unit"` (Wight, kein Vampir) | `b9c6-93fb-ce3c-965a` (Z. 2107); `categoryLinks` Z. 2112–2116 |
| Einheit „Vampire Count", `type="unit"` (Vampir, kein Wight) | `6822-0110-a7c9-cbb0` (Z. 3124); `categoryLinks` Z. 3172–3176 |
| Weg Wight Lord → geteilte Gruppe | `deae-815d-c2ef-a607` (Z. 2292) → `3219-3f82-eead-b592` (Z. 2296) → `bf27-6ca6-5c3a-3449` |
| Weg Vampire Count → geteilte Gruppe | `2dc4-ffd3-2c99-c560` (Z. 3385) → `53e8-0ce2-eaf6-0163` (Z. 21290) → `14d2-cec2-9b1c-418c` (Z. 21292) → `11e6-e9d4-f6e4-c02d` (Z. 21272) → `afe1-9a75-ceba-5949` (Z. 21276) → `bf27-6ca6-5c3a-3449` |
| Magic-Item-Budgets | Wight Lord `b012-c96f-128c-0848` (`max 50` pts, Z. 2304) · Vampire Count `61f5-4991-b5f9-32bd` (`max 100` pts, Z. 3387) |
| Pflicht-Kinder Wight Lord | `c527-e525-5b58-9b7c` (`min` `a775-7b1e-7fa8-d353` / `max` `34c1-6e91-4dae-0ef6`) · `c43e-3854-1448-20fc` in Gruppe `2e1a-7fe5-3705-33d0` (`min` `ed42-9091-8bf7-8006` / `max` `8c58-8d92-f372-a13d`, Gruppe `max 2` = `d0f2-4ae3-a163-7081`) |
| Pflicht-Kinder Vampire Count | `9e6c-19ea-19ad-7cbe` (`min` `3a5f-f22c-f213-581e` / `max` `6798-e03b-977d-7506`) · Gruppe `7ab1-d9dc-6124-443f` (`min` `19ba-de18-6ad7-2825` / `max` `436d-44fa-86cf-bf42`), gewählt `5a5f-aaf8-868f-9630` → `fbc2-5115-f240-7367`; Gruppe `06c9-c170-adb2-86f5` (`max 2` = `b3b5-f872-24df-04dc`) |
| „Bloodlines" (Pflicht `min 1`, `scope="force"`) / Gruppe „Vampiric Bloodline" (`max 1`) | `a56a-eb32-5a45-16fd` (Z. 5094) — `4a0a-b107-e726-da32` (Z. 5194) / `5655-13ba-8980-bd1c` (Z. 5099) — `39c7-f615-17db-7016` (Z. 5101) |
| Verdeckungs-Gatter, die ausgeschlossen bleiben | Wight Lord `deae-…` per BSB `0937-a1bc-b331-8ce1` (Z. 2307–2312) · Vampire Count `14d2-…` per Strigoi `ddfa-0d72-8557-6906` (Z. 21294–21298) |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` (Z. 29511) |
