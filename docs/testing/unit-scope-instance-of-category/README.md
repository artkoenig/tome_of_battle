# E2E-Regeln & Testkatalog: `instanceOf` mit `scope="unit"` auf eine **Kategorie**

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7
Kasten [`scope="unit"`/`scope="ancestor"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)
und §8) abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`entryGroupId` an Gruppen-Mitgliedern) nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1),
  dazu die per `catalogueLink` (`ef73-f9bd-e250-54d2`, Z. 29511) benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Die Kernaussage ist je Roster ein `expect.capabilities[]`-Eintrag
> mit `isHidden` an einem **nicht gewählten** Verweis-Slot (`anchorKind: offerAnchor`) —
> exakte Gleichheit auf dem effektiven Sichtbarkeits-Flag. Sichtbarkeit ist
> **Verfügbarkeit**, keine zählende Grenze: sie erscheint **nicht** als feuerndes Limit
> im Verletzungsbericht. `firing` bleibt darum leer — mit der einen Ausnahme von
> Roster 03, dessen absichtlich doppelte Blutlinienwahl die Gruppengrenze
> `39c7-f615-17db-7016` reißt (das ist dort Nebenwirkung des Aufbaus, nicht die zu
> pinnende Regel). `absent` pinnt zusätzlich, dass die zählenden Grenzen der beteiligten
> Einträge in diesen Aufbauten still bleiben. Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht, Punktelimit) dürfen zusätzlich auftreten (selektive Erwartung).

---

## Was die Formatspezifikation über `scope="unit"` + `instanceOf` sagt

Wörtlich abgeleitet aus §7.7 (Kasten *`scope="unit"` und `scope="ancestor"`*), §7.7
(Tabelle `condition`) und §8 (*Laufzeit-dynamische Kategoriezugehörigkeit*):

- **`unit` ist der nächste Vorfahre mit `type="unit"` — den Träger der Query
  eingeschlossen.** Für einen Ausrüstungs-Slot tief in geschachtelten
  `selectionEntryGroup`s ist das die umschließende **Einheit**: Gruppen tragen keinen
  `type` und unterbrechen die Suche nicht. Ohne umschließende Einheit wertet die
  Auswertung fail-closed (`unresolvedScope`).
- **`instanceOf` ist eine Prüfung, keine Zählung.** Für `scope="ancestor"` sagt der
  Kasten es ausdrücklich: die Prüfung greift auf die **effektiven Kategorien**, und die
  Zähl-Flags (`shared`, `includeChild…`) sind ohne Wirkung, weil „eine Vorfahrenkette
  durch eine Instanz nicht enger wird". Dieselbe Ziel-Auflösung („Definitions-Id,
  Link-Ziel-Id, eine der **effektiven** Kategorien oder der rohe Typ") ist die einzige,
  die eine `childId` benennt, die im Katalog eine `categoryEntry` ist — genau der Fall
  hier. Auch `percentValue` ist laut Wiki bei `instanceOf` „has no effect".
- **Effektive Kategorien schließen Laufzeit-Änderungen ein.** §8: `modifier`
  `type="add"`/`type="remove"` mit `field="category"` fügen eine Kategoriezugehörigkeit
  bedingt hinzu bzw. entfernen sie; „**sämtliche** kategorie-abhängige Logik muss
  deshalb die **effektiven** Kategorie-Links auswerten, nicht die rohen Katalog-Links".
- **`set hidden`** (§7.7/§8): hält die Bedingung, ersetzt der `value` das Flag exakt;
  hält sie nicht, gilt der Basiswert. `hidden` an Verweis und Ziel wirken als **ODER**.
- **`modifierGroup`** (§7.7): die Bedingungen der Klammer gelten für alle Modifier
  darin — semantisch gleichwertig dazu, sie an jedem einzelnen zu wiederholen.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **USIC-R1** | **Die Kategorie kommt erst zur Laufzeit.** Kein Vampir-Eintrag führt einen `categoryLink` auf „Blood Dragon". Die Mitgliedschaft entsteht ausschließlich aus der `modifierGroup` mit dem Kommentar `BLOODLINE` am Einheiten-Eintrag, gegatet auf die im Kontingent gewählte Blutlinie. | VC-`.cat` Z. 40: `<categoryEntry id="4cae-a20e-8374-b6cb" name="Blood Dragon" hidden="false"/>`. Vampire Count `6822-0110-a7c9-cbb0` (Z. 3124, `type="unit"`): seine `categoryLinks` (Z. 3172–3176) sind **nur** `Lord` (`d024-d25b-a9b4-73b6`, primär), `Characters` (`7a1c-d611-c2dc-def1`), `Vampire` (`017d-3857-a815-782f`). Sein `modifierGroups`-Block Z. 3422–3498 (`<comment>BLOODLINE</comment>`) enthält fünf Untergruppen; die *Blood Dragon*-Untergruppe (Z. 3426–3439) macht `add category 4cae-a20e-8374-b6cb` (Z. 3429) und `remove` der vier Schwester-Kategorien, gegatet auf `<condition type="atLeast" value="1" field="selections" scope="force" childId="9fd9-e05c-ffcb-2c4d" …/>` (Z. 3437). Im ganzen Katalog steht `4cae-a20e-8374-b6cb` an **keinem** `categoryLink`. |
| **USIC-R2** | **Bedingung hält → `set hidden=true` greift.** Ist die umschließende Einheit ein Blood Dragon, sind die drei Familiar-Slots der Gruppe *Arcane Items (VC)* **verborgen** (`isHidden` = `true`), obwohl Verweis **und** Ziel `hidden="false"` tragen. | VC-`.cat` Z. 21156–21164: `entryLink id="4561-b83b-6268-9dde" name="Spell Familiar" hidden="false" targetId="5eb3-43a3-e38f-2402"` mit `<modifier type="set" value="true" field="hidden">`, einzige Bedingung `<condition type="instanceOf" value="1" field="selections" scope="unit" childId="4cae-a20e-8374-b6cb" shared="true"/>` (Z. 21160). Analog `0ec8-aa23-e935-59f7` „Power Familiar" (Z. 21165–21173, Bedingung Z. 21169) und `67c6-f3bb-803a-0ca3` „Warrior Familiar" (Z. 21176–21184, Bedingung Z. 21180). Ziele: `5eb3-43a3-e38f-2402` (Z. 13577), `94dc-9b20-f845-34ba` (Z. 13591), `218b-5620-2777-2986` (Z. 13647) — alle `hidden="false"`, keiner mit eigenem `hidden`-Modifikator. |
| **USIC-R3** | **Bedingung hält nicht → Basiswert bleibt.** Trägt der Vampir eine andere Blutlinie, ist er kein Blood Dragon; die Bedingung hält nicht, kein anderer Modifikator greift, die drei Slots bleiben **sichtbar** (`isHidden` = `false`). | Dieselben drei `entryLink`s: der `set hidden`-Modifikator ist ihr **einziger**. Die *Von Carstein*-Untergruppe (Z. 3482–3495) macht `remove 4cae-a20e-8374-b6cb` (Z. 3485) und `add ff24-ca11-afd5-865b`, gegatet auf `childId="f557-097a-d26b-9363"` (Z. 3493). `f557-097a-d26b-9363` ist `selectionEntry "Bloodline of Clan Von Carstein"` (Z. 5169) in der Gruppe `5655-13ba-8980-bd1c` unter `Bloodlines` `a56a-eb32-5a45-16fd` (Z. 5094). |
| **USIC-R4** | **Die umschließende Einheit ist der Vampir, nicht der Träger und nicht eine Gruppe.** Die Familiar-Verweise hängen vier Gruppen-/Verweis-Ebenen unter der Einheit; keine dieser Zwischenstufen ist eine `selectionEntry` mit `type="unit"`, also ist der nächste `unit`-Vorfahre der Vampire Count. | Kette: Vampire Count `6822-0110-a7c9-cbb0` → `entryLink 2dc4-ffd3-2c99-c560` (Z. 3385) → `selectionEntryGroup 53e8-0ce2-eaf6-0163` „Magic selection" (Z. 21290) → `entryLink 14d2-cec2-9b1c-418c` (Z. 21292) → `selectionEntryGroup 11e6-e9d4-f6e4-c02d` „Magic Items" (Z. 21272) → `entryLink efb9-a0e7-342c-603b` (Z. 21282) → `selectionEntryGroup 2f34-a145-911a-fa00` „Arcane Items (VC)" (Z. 21130) → die drei Familiar-`entryLink`s. Alle Zwischenstufen sind `selectionEntryGroup`/`entryLink`, keine trägt ein `type`-Attribut. |
| **USIC-R5** | **Mitgliedschaftsprüfung, nicht Zählung — die Zähl-Flags verengen nichts.** „Spell Familiar" und „Warrior Familiar" tragen die Bedingung **ohne** `includeChildSelections`, „Power Familiar" **mit** `includeChildSelections="true"`; alle drei müssen in jedem Roster **dasselbe** `isHidden` melden. | Z. 21160 (`shared="true"`, kein `includeChildSelections`) gegen Z. 21169 (`shared="true" includeChildSelections="true"`) gegen Z. 21180 (wie 21160). Sonst sind die drei Verweise strukturgleich. |
| **USIC-R6** | **`remove` schlägt ein vorheriges `add`.** Halten beide Blutlinien-Untergruppen, läuft erst `add 4cae` (Blood Dragon, Z. 3429) und danach — **später in Dokumentreihenfolge** — `remove 4cae` (Von Carstein, Z. 3485). Die effektiven Kategorien enthalten die Kategorie dann **nicht**: die Slots bleiben sichtbar. | Die fünf Untergruppen sind Geschwister unter der `BLOODLINE`-Klammer (Z. 3423) in der Reihenfolge Blood Dragon (3426) · Lahmia (3440) · Strigoi (3454) · Necrarch (3468) · **Von Carstein (3482)**. Ihre Bedingungen (`atLeast 1`, `scope="force"`) sind voneinander unabhängig — mit zwei Blutlinien im Kontingent halten beide. |
| **USIC-R7** | **Nebenwirkung des R6-Aufbaus:** Zwei Blutlinien in derselben Gruppe reißen deren `max`-Grenze — Ist **2**, Grenze **1**. | `selectionEntryGroup id="5655-13ba-8980-bd1c" name="Vampiric Bloodline"` (Z. 5099) mit `<constraint type="max" value="1" field="selections" scope="parent" shared="true" id="39c7-f615-17db-7016" includeChildSelections="false"/>` (Z. 5101). Gezählt werden die Mitglieder der Gruppe (§7.6): 2 Auswahlen à `number="1"`. |
| **USIC-R8** | **Dasselbe Konstrukt eine Ebene unter der Einheit** (flacher Zeuge, andere Kategorie): Ist der Vampir ein *Strigoi*, ist der Verweis „Great Weapon" der Gruppe *Weapons and Armour* verborgen. | Vampire Count → `selectionEntryGroup 06c9-c170-adb2-86f5` „Weapons and Armour" (Z. 3256, `hidden="false"`, keine `hidden`-Modifier) → `entryLink id="4b34-9f0f-38ec-191c" name="Great Weapon" hidden="false" targetId="1eb7-3f36-8cf7-e0ba"` (Z. 3303) mit `<modifier type="set" value="true" field="hidden">`, einzige Bedingung `<condition type="instanceOf" value="1" field="selections" scope="unit" childId="bf30-4ff0-a4d8-3909" shared="true"/>` (Z. 3313). `bf30-4ff0-a4d8-3909` ist `categoryEntry "Strigoi"` (Z. 41), hinzugefügt von der Strigoi-Untergruppe (`add`, Z. 3456) gegatet auf `ddfa-0d72-8557-6906` (Z. 3465). Ziel `1eb7-3f36-8cf7-e0ba` steht in der `.gst` (Z. 987, `hidden="false"`). |
| **USIC-R9** | **Kontrolle im selben Rahmen:** Der Nachbar-Slot „Black Periapt" derselben Gruppe trägt **keinen** `hidden`-Modifikator und bleibt in **jedem** Roster sichtbar — die Sichtbarkeitsänderung der Familiars ist also dem Modifikator zuzuschreiben, nicht dem Rahmen. | Z. 21155: `entryLink id="787e-19e8-0444-a8c3" name="Black Periapt" hidden="false" targetId="3013-1494-ee91-1cf8"` — leeres Element, kein `<modifiers>`. Ziel `3013-1494-ee91-1cf8` (Z. 13563) `hidden="false"`, ohne `hidden`-Modifikator. |
| **USIC-R10** | **Legaler, minimaler Vampir:** Die beiden Pflicht-Kinder sind erfüllt, sodass die Sichtbarkeits-Aussagen nicht mit unerfüllten Mindestmaßen vermischt werden. | Gruppe `7ab1-d9dc-6124-443f` „Wizard Level" (Z. 3178): `min 1` = `19ba-de18-6ad7-2825`, `max 1` = `436d-44fa-86cf-bf42` — erfüllt durch **Magic Level 2** (`entryLink 5a5f-aaf8-868f-9630` → `fbc2-5115-f240-7367`, Z. 3184). Inline-Eintrag `Handweapon` `9e6c-19ea-19ad-7cbe` (Z. 3258) in Gruppe `06c9-c170-adb2-86f5`: `min 1` = `3a5f-f22c-f213-581e`, `max 1` = `6798-e03b-977d-7506`. Gruppengrenze `b3b5-f872-24df-04dc` (`max 2`, Z. 3350) bleibt bei 1 still. Armeeweite Blutlinien-Pflicht `4a0a-b107-e726-da32` (`min 1`, `scope="force"`, Z. 5194) ist durch die `Bloodlines`-Auswahl erfüllt. |

### Warum „Blood Dragon" **nicht** in den `<categories>` der Roster steht

Die `.ros`-Dateien führen am Vampire Count nur die drei Kategorien seiner
Katalog-`categoryLinks` (`Lord`/`Characters`/`Vampire`). Die Blutlinien-Kategorie ist
**bewusst weggelassen**: stünde sie im Roster, könnte eine Auswertung, die nur die
gecachten Roster-Kategorien liest, aus dem falschen Grund bestehen. So kann die
Mitgliedschaft nur aus dem `add category`-Modifikator stammen (USIC-R1).

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `shared="false"` an einer `instanceOf`/`scope="unit"`-Kategorie-Bedingung | Existiert in diesen Katalogdaten nicht: alle drei Familiar-Bedingungen (und die Great-Weapon-Bedingung) tragen `shared="true"`. Beobachtbar ist deshalb nur die `includeChildSelections`-Hälfte von USIC-R5. |
| Die Arcane-Item-Slots im **Strigoi**-Roster (04) | Unter Strigoi verbirgt ein **eigener** Modifikator am Verweis „Magic Items" (`14d2-cec2-9b1c-418c`, `set hidden=true`, Bedingung `atLeast 1 scope="force" childId="ddfa-0d72-8557-6906"`, Z. 21294–21298) die ganze umgebende Gruppe. Der Zustand der Familiars wäre dort **mehrdeutig verursacht** (Gruppen-Sichtbarkeit vs. eigener Modifikator) und wird darum nicht behauptet. |
| `add category` an einer **Gruppe** statt an einer Einheit | Die Gruppe `b1a2-07df-1a18-9bf9` „Vampiric Powers" (Z. 20954) trägt einen **unbedingten** `add category 4cae-a20e-8374-b6cb` (Z. 20967). Ihr Träger ist die Gruppe selbst, nicht die umschließende Einheit; für die `scope="unit"`-Prüfung ist sie deshalb ohne Belang. Ob eine Engine eine Gruppen-Kategorie fälschlich auf die Einheit hochzieht, wäre eine eigene Frage (eigenes Szenario). |
| Kosten, Namen und Profile der beteiligten Einträge | Eigene Modifikator-Zellen (`field="name"`, Kostenarten, `characteristic`), von anderen Szenarien abgedeckt (`modifier-effective-name`, `modifier-characteristic-value`). |
| Die Familiar-Grenzen als **feuernde** Grenzen | Dazu müssten die Gegenstände mehrfach gewählt werden — das prüft Zähllogik, nicht die Bedingung. Hier nur als `absent` gepinnt. |
| `notInstanceOf` mit `scope="unit"` | Kommt an diesen Trägern nicht vor; die inverse Richtung ist an diesen Daten nicht beobachtbar. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle vier Roster sind
**bis auf die gewählte Blutlinie identisch**: Kontingent „Standard (VC-AB)"
(`e989-15b8-7eb6-9668`), eine `Bloodlines`-Auswahl (`a56a-eb32-5a45-16fd`) und ein
Vampire Count (`6822-0110-a7c9-cbb0`) mit Handweapon und Magic Level 2. Im gesamten
Magic-Item-Baum ist **nichts** gewählt — die geprüften Slots sind Angebots-Slots.
Genau der eine Unterschied ist der Auslöser.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Kategorie zur Laufzeit erteilt → Slots verborgen | Blutlinie **Blood Dragon** (`9fd9-e05c-ffcb-2c4d`). | **USIC-R1/R2/R4/R5:** Alle drei Familiar-Slots melden `isHidden: true`. **USIC-R9:** Black Periapt bleibt `false`. **USIC-R8-Gegenprobe:** Great Weapon bleibt `false` (Strigoi-Bedingung hält nicht). Keine der gepinnten Grenzen feuert. | [`01-blood-dragon-familiars-hidden.ros`](rosters/01-blood-dragon-familiars-hidden.ros) |
| 02 | Andere Blutlinie → Basiswert bleibt | Blutlinie **Von Carstein** (`f557-097a-d26b-9363`). | **USIC-R3:** Alle drei Familiar-Slots melden `isHidden: false`. Black Periapt und Great Weapon ebenfalls `false`. Keine der gepinnten Grenzen feuert. | [`02-von-carstein-familiars-visible.ros`](rosters/02-von-carstein-familiars-visible.ros) |
| 03 | `remove` nach `add` → keine Mitgliedschaft | **Beide** Blutlinien (Blood Dragon **und** Von Carstein) in derselben Gruppe. | **USIC-R6:** Trotz greifendem `add` ist der Vampir kein Blood Dragon — alle drei Familiar-Slots `isHidden: false`, Black Periapt `false`. **USIC-R7:** Die Gruppengrenze `39c7-f615-17db-7016` feuert mit Ist **2** / Grenze **1**. | [`03-both-bloodlines-remove-wins.ros`](rosters/03-both-bloodlines-remove-wins.ros) |
| 04 | Flacher Träger, andere Kategorie | Blutlinie **Strigoi** (`ddfa-0d72-8557-6906`). | **USIC-R8:** Der Great-Weapon-Slot (`4b34-9f0f-38ec-191c`, eine Gruppenebene unter der Einheit) meldet `isHidden: true`. Die Arcane-Item-Slots werden hier nicht behauptet (siehe *Bewusst ausgelassene Facetten*). | [`04-strigoi-great-weapon-hidden.ros`](rosters/04-strigoi-great-weapon-hidden.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine erst im
**Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **USIC-R1/R2** — ob die `instanceOf`-Prüfung mit `scope="unit"` eine `childId`
   überhaupt gegen die **effektiven** Kategorien der Einheit auflöst (und nicht nur
   gegen Definitions-Ids oder gegen die rohen `categoryLinks`). Nur der
   `add category`-Modifikator kann die Mitgliedschaft hier erzeugen.
2. **USIC-R4** — ob der `unit`-Rahmen über **vier** Gruppen-/Verweis-Ebenen hinweg zur
   Einheit hochläuft, statt an der nächsten Gruppe zu enden oder `unresolvedScope` zu
   melden. Roster 04 prüft dasselbe eine Ebene tief und trennt so „Rahmen falsch" von
   „Tiefe nicht unterstützt".
3. **USIC-R5** — ob `includeChildSelections="true"` das Ergebnis der Prüfung
   **unverändert** lässt (Power Familiar gegen Spell/Warrior Familiar).
4. **USIC-R6** — die Reihenfolge-Semantik von `add`/`remove` auf derselben Kategorie:
   der spätere `remove` muss gewinnen. Jede rein sequenzielle Anwendung in
   Dokumentreihenfolge liefert dieses Ergebnis.
5. Die Slot-Adressierung: `defId` (der **Verweis**) + `targetDefId` muss jeden Slot
   **eindeutig** treffen. Im Roster steht genau ein Vampir und kein Necromancer, obwohl
   die Gruppe `2f34-a145-911a-fa00` auch von `4ee2-ac3a-3cc6-11af` (Z. 2060) und
   `b5d8-db21-a4b7-9e94` (Z. 2615) verlinkt wird.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Kontingent „Standard (VC-AB)" | `e989-15b8-7eb6-9668` (Z. 29297) |
| Einheit „Vampire Count", `type="unit"` (der `unit`-Rahmen) | `6822-0110-a7c9-cbb0` (Z. 3124); `categoryLinks` Z. 3172–3176 |
| `categoryEntry` „Blood Dragon" (Ziel der `instanceOf`-Bedingung) | `4cae-a20e-8374-b6cb` (Z. 40) |
| `categoryEntry` „Strigoi" (Ziel der flachen Gegenprobe) | `bf30-4ff0-a4d8-3909` (Z. 41) |
| `modifierGroup` `BLOODLINE` am Vampire Count | Z. 3422–3498; `add`/`remove` Blood Dragon Z. 3429 / Z. 3485 |
| „Bloodlines"-Eintrag (Wahl der Blutlinie) | `a56a-eb32-5a45-16fd` (Z. 5094), `min 1 force` = `4a0a-b107-e726-da32` |
| Gruppe „Vampiric Bloodline" (`max 1`) | `5655-13ba-8980-bd1c` (Z. 5099) — Grenze `39c7-f615-17db-7016` (Z. 5101) |
| Blutlinien-Auswahlen Blood Dragon / Von Carstein / Strigoi | `9fd9-e05c-ffcb-2c4d` (Z. 5104) / `f557-097a-d26b-9363` (Z. 5169) / `ddfa-0d72-8557-6906` (Z. 5153) |
| Gruppe „Arcane Items (VC)" (Rahmen der Familiar-Slots) | `2f34-a145-911a-fa00` (Z. 21130) — Gruppengrenze `fa59-e6b8-9523-3510` |
| Verweis-Kette Einheit → Gruppe | `2dc4-ffd3-2c99-c560` → `53e8-0ce2-eaf6-0163` → `14d2-cec2-9b1c-418c` → `11e6-e9d4-f6e4-c02d` → `efb9-a0e7-342c-603b` → `2f34-a145-911a-fa00` |
| „Spell Familiar" (Verweis / Ziel), Bedingung ohne `includeChildSelections` | `4561-b83b-6268-9dde` → `5eb3-43a3-e38f-2402` (Z. 21156 / 13577) |
| „Power Familiar" (Verweis / Ziel), Bedingung **mit** `includeChildSelections="true"` | `0ec8-aa23-e935-59f7` → `94dc-9b20-f845-34ba` (Z. 21165 / 13591) |
| „Warrior Familiar" (Verweis / Ziel) | `67c6-f3bb-803a-0ca3` → `218b-5620-2777-2986` (Z. 21176 / 13647) |
| „Black Periapt" (Kontrolle, Verweis / Ziel) | `787e-19e8-0444-a8c3` → `3013-1494-ee91-1cf8` (Z. 21155 / 13563) |
| „Great Weapon" (flacher Zeuge, Verweis / Ziel in der `.gst`) | `4b34-9f0f-38ec-191c` (Z. 3303) → `1eb7-3f36-8cf7-e0ba` (`.gst` Z. 987) |
| Gruppe „Weapons and Armour" (`max 2`) | `06c9-c170-adb2-86f5` (Z. 3256) — Grenze `b3b5-f872-24df-04dc` (Z. 3350) |
| Pflicht-Kinder: Handweapon / Wizard Level | `9e6c-19ea-19ad-7cbe` (`min 1` = `3a5f-f22c-f213-581e`, `max 1` = `6798-e03b-977d-7506`) / Gruppe `7ab1-d9dc-6124-443f` (`min 1` = `19ba-de18-6ad7-2825`, `max 1` = `436d-44fa-86cf-bf42`), gewählt: `5a5f-aaf8-868f-9630` → `fbc2-5115-f240-7367` |
| Als `absent` gepinnte Gegenstands-Grenzen | Spell `6e83-c0ad-a87e-cdb8` / `b9f7-fd62-2f07-8ad8`; Power `757a-8839-2f42-2dcd` / `7c63-73c7-0112-a7de`; Warrior `4670-9aed-2209-cda6` / `982a-b87d-fa02-0858`; Black Periapt `d83b-7706-3d74-dbc8` / `47b3-9116-6f74-d142`; Great Weapon `9fc9-938f-6289-e4bb` |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` (Z. 29511) |
