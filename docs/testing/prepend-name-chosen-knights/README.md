# E2E-Regeln & Testkatalog: `prepend` auf `field="name"` mit `join` (Chosen Knights of Chaos)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschließlich** aus den Katalogdaten der *6th Definitive
Edition*, aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
(§7.7, §8) und aus der vendorten [`Catalogue.xsd`](../../../src/data/parser/schema/Catalogue.xsd)
abgeleitet; die Roster-Gestalt ist an den bereits verifizierten Szenarien
nachgebildet (direktes `entryId` beim Wurzeleintrag, `entryLinkId=""` dort,
`entryLinkId="<Link-Id>"` bei Verweis-Slots, verschachtelte `selections` mit
`number` — vgl.
[`at-least-self-equipment-save`](../at-least-self-equipment-save/rosters/06-lord-all-four-sv-2.ros)
und [`less-than-self-mount-and-weapon-gate`](../less-than-self-mount-and-weapon-gate/rosters/04-shield-and-dark-pegasus-sv-6.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Dark Elves (6th definitive edition).cat` (`d4c0-4f0c-4a89-40fc`,
  rev 1); der Katalog deklariert per `catalogueLink 4301-a1ec-729b-b898` (Z. 10152)
  die Bibliothek `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`)
  als Abhängigkeit — im Szenario selbst wird sie nicht benutzt, muss aber im
  Datensatz liegen.
- Kontingent: **„Cult of Slaanesh (SoC)"** `5013-f9f4-e03b-94d5` (`.cat` Z. 10137).
- Getesteter Träger: der Wurzel-`selectionEntry` **„Knights of Chaos"**
  `7843-05b6-ba2d-cc2b` (`.cat` Z. 6135, `type="unit"`, `hidden="true"`).

> **⚠️ Das Trennzeichen ist ein NBSP, kein Leerzeichen.** Der `join`-Wert des
> geprüften Modifikators (`.cat` Z. 6303) ist **ein einzelnes U+00A0 NO-BREAK
> SPACE**, **nicht** U+0020. Der erwartete Name in Roster 02 lautet daher
> `Chosen` + **U+00A0** + `Knights of Chaos`; im Manifest steht dort ein
> **literales NBSP**. Wer diese Stelle in `scenario.json` oder hier „aufräumt"
> und ein gewöhnliches Leerzeichen daraus macht, macht die Erwartung **falsch**.
> Beleg und Prüfmethode stehen in **PNCK-R3**.

> **Assertion-Form:** Dieses Szenario prüft **keine** zählenden Grenzen als
> feuernd. Jede Kernaussage ist ein `expect.capabilities[]`-Eintrag mit dem
> **effektiven `name`** des Einheiten-Slots (dazu sein `isHidden`); `firing`
> bleibt in beiden Rostern leer. `absent` pinnt zusätzlich, dass die Grenzen der
> mitgeführten Pflichtausrüstung in diesen katalogkonformen Aufbauten still
> bleiben. Andere Armeeaufbau-Diagnosen (General-Pflicht `1077-7379-f142-f382`,
> die punkteskalierte Core-Pflicht, Kategorie- und Budgetgrenzen) dürfen
> zusätzlich auftreten und sind hier ohne Belang (selektive Erwartung).

---

## Was ein `prepend`-Modifikator auf `field="name"` laut Format tut

Aus [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)
der Formatreferenz, wörtlich abgeleitet:

- `type="prepend"` ist eine **Text**-Operation auf einem Textfeld
  (`append`/`prepend`/`set` „für Text"); `field="name"` benennt den Anzeigenamen
  des Trägers.
- `value` ist *„der anzufügende Text"* — bei `prepend` wandert er **vor** den
  bestehenden Namen.
- `join` ist das *„Trennzeichen zwischen dem bestehenden Namen und dem
  angehängten/vorangestellten Text"*. Das Ergebnis ist damit exakt

  ```
  effektiver Name  =  value  +  join  +  Basisname
  ```

- **`join` wird verbatim übernommen, nicht angenommen.** Genau dieser Satz der
  Formatreferenz ist hier der springende Punkt: der Trenner ist **das Zeichen,
  das in der Datei steht** — nicht „ein Leerzeichen, weil da irgendein
  Zwischenraum steht". Die Formatreferenz nennt in derselben Tabellenzeile
  ausdrücklich, dass reale Kataloge neben dem einfachen Leerzeichen auch **NBSP
  (`&#160;`)** und `"&#160;+&#160;"` als `join` benutzen. Der hier geprüfte
  Modifikator ist ein solcher NBSP-Fall (PNCK-R3): eine Auswertung, die den
  Trenner *interpretiert* statt ihn zu *übernehmen* — etwa indem sie jeden
  Zwischenraum als U+0020 normalisiert —, liefert einen anderen String und
  fällt hier auf.
- Greift die Bedingung des Modifikators **nicht**, bleibt der **Basiswert** des
  `name`-Attributs unverändert stehen.
- `prepend` und `join` sind upstream nicht spezifiziert; die vendorte
  `Catalogue.xsd` führt beide bewusst (`join`: Z. 492, `prepend`: Z. 518, jeweils
  mit ADR-0016-Kommentar). Sie sind also gültige, aber projektspezifisch
  bezeugte Konstrukte — genau deshalb lohnt der Testfall.

Die geprüfte Zelle ist damit: `modifier | prepend | name | join=<U+00A0>`,
gegattert durch `condition | atLeast | self | selections | child=<Aufwertungs-Id>`.

### Der getestete Ausschnitt des Katalogs

```
selectionEntry "Knights of Chaos" (7843-05b6-ba2d-cc2b, type=unit, hidden=true)   Z. 6135
 ├ categoryLink "Rare" 6725-e253-28c2-af97 → e94b-6a54-8779-cd60 (primary)        Z. 6137
 ├ selectionEntries
 │   ├ "Musician"            8767-317f-3402-e5d3   max 1 (cd44-…)                 Z. 6140
 │   ├ "Standard Bearer"     20f1-c09f-21ca-485e   max 1 (3dca-…)                 Z. 6150
 │   ├ "Champion"            9fb1-d61c-c1c1-c7e4   max 1 (da11-…)                 Z. 6167
 │   ├ "Knights of Chaos"    2a5f-a5b9-62c7-4659   type=model, min 4 (cb54-…)     Z. 6180  ← Namensgleiche Kontrolle
 │   ├ "Additional Rare slot" bbc6-be9d-36c7-e71a  min 1 / max 1                  Z. 6215
 │   └ "Chosen"              7ab9-d251-abf3-8878   max 1 (e044-…)                 Z. 6224  ← der Auslöser
 ├ entryLinks
 │   ├ "Hand Weapon"   1eab-… → abdb-…   min 1 / max 1                            Z. 6241
 │   ├ "Shield"        e517-… → 50e2-…   min 1 / max 1                            Z. 6247
 │   ├ "Mark of Slaanesh (troops)" 4b40-… → fdca-…  min 1                         Z. 6253
 │   ├ "Chaos Steed"   7946-… → 3c1f-…   min 1 / max 1  (darunter Barding min 1)  Z. 6258
 │   ├ "Heavy Armour"  e62a-… → dde4-…   min 1 / max 1  + set hidden=true (Chosen) Z. 6267
 │   └ "Chaos Armour*" a969-… → 91d4-…   min 0, hidden=true
 │                                        + modifierGroup(Chosen): min→1, hidden→false  Z. 6280
 └ modifiers                                                                      Z. 6302–6313
     ├ <modifier type="prepend" value="Chosen" field="name" join=<U+00A0>>        Z. 6303   ← Subjekt
     │    └ condition atLeast 1 selections scope="self" childId="7ab9-…"          Z. 6305
     └ <modifier type="set" value="false" field="hidden">                         Z. 6308
          └ condition instanceOf scope="force" childId="5013-…"                   Z. 6310   ← Vorbedingung
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Alle Belege aus `Dark Elves (6th definitive edition).cat`, soweit nicht anders
vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PNCK-R1** | **Basisname:** Ohne greifenden Namens-Modifikator heißt der Einheiten-Slot exakt **„Knights of Chaos"** — der Wert des `name`-Attributs der Definition. Ein zweiter `field="name"`-Modifikator existiert an dieser Einheit nicht. | `selectionEntry name="Knights of Chaos" id="7843-05b6-ba2d-cc2b"` (Z. 6135). Ihr vollständiges `<modifiers>`-Inventar sind **genau zwei** Modifikatoren (Z. 6302–6313): der `prepend` auf `name` und der `set` auf `hidden`. Die Einheit steht nur in `<selectionEntries>` der Katalogwurzel und wird **von keinem `entryLink` referenziert** (die Id `7843-05b6-ba2d-cc2b` kommt im gesamten Datensatz nur an dieser einen Stelle vor) — es gibt also auch keinen Verweis-Träger, der einen weiteren Namens-Modifikator beisteuern könnte. |
| **PNCK-R2** | **Bedingung hält nicht → Basisname bleibt:** Ist unter der Einheit **keine** Auswahl der Aufwertung „Chosen" `7ab9-d251-abf3-8878` vorhanden (Ist 0), hält `atLeast 1` nicht, der Modifikator greift nicht, der Slot meldet **„Knights of Chaos"**. | Bedingung Z. 6305: `<condition type="atLeast" value="1" field="selections" scope="self" childId="7ab9-d251-abf3-8878" shared="true" childName="Chosen" includeChildSelections="true"/>` — die **einzige** Bedingung des `prepend`-Modifikators (keine `<conditionGroups>`, kein `<repeats>`). |
| **PNCK-R3** | **Bedingung hält → `value` + `join` + Basisname, mit `join` = U+00A0.** Steht **mindestens eine** „Chosen"-Auswahl unter der Einheit (Ist 1), greift der Modifikator und der Slot meldet **`Chosen` `Knights of Chaos`** — also `value="Chosen"`, dann **ein NO-BREAK SPACE (U+00A0)** als verbatimer Trenner, dann der Basisname. **Ausdrücklich nicht** ein gewöhnliches Leerzeichen U+0020. | Modifikator Z. 6303: `<modifier type="prepend" value="Chosen" field="name" join="…">`, wobei das `join`-Attribut das **rohe Zeichen U+00A0** trägt (nicht die Entität `&#160;` — die Datei enthält die UTF-8-Bytes `C2 A0` selbst). **Prüfmethode ohne Sichtprüfung** (ein NBSP ist im Editor von einem Leerzeichen nicht zu unterscheiden): eine Suche nach dem Codepunkt. `rg 'join="\x{00A0}"'` trifft Z. 6303, `rg 'join="\x{0020}"'` trifft dort **nicht**. Reihenfolge und Verbatim-Regel des Trenners: [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) (Tabellenzeilen `value` und `join`, inkl. der ausdrücklichen Nennung von NBSP als realem `join`-Wert). |
| **PNCK-R4** | **Der Zählrahmen ist der Träger selbst (`scope="self"`).** Gezählt wird, was **unter der Einheit** hängt — mit `includeChildSelections="true"` auch tiefer als die direkten Kinder. Die Aufwertung „Chosen" ist ein **direktes** Kind der Einheit, liegt also in jedem Fall im Rahmen. | Die Aufwertung ist inline unter `<selectionEntries>` der Einheit deklariert (Z. 6224, `type="upgrade"`, `hidden="false"`, `max 1` `e044-8da5-f362-824e` Z. 6226). Rahmen-Semantik: [§7.6](../../battlescribe-data-format.md#76-constraint) (Regel-Kasten: der `scope` summiert *„descendant selections"*) und [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) (`includeChildSelections`). |
| **PNCK-R5** | **Vorbedingung Sichtbarkeit:** Die Einheit trägt den Basiswert `hidden="true"` und wird **nur** in einem Kontingent sichtbar, das das `forceEntry` „Cult of Slaanesh (SoC)" instanziiert. Beide Roster nutzen dieses Kontingent, der Slot meldet daher `isHidden` = **`false`**. | Zweiter Entry-Modifikator Z. 6308–6312: `<modifier type="set" value="false" field="hidden">` mit einziger Bedingung `<condition type="instanceOf" value="1" field="selections" scope="force" childId="5013-f9f4-e03b-94d5" …/>`; `5013-f9f4-e03b-94d5` ist das `forceEntry "Cult of Slaanesh (SoC)"` (Z. 10137) **derselben** Datei. Es führt den `categoryLink` *Rare* `6646-2ca2-87c0-247c` (Z. 10147), unter dem die Einheit primär einsortiert ist (`categoryLink 6725-e253-28c2-af97`, Z. 6137). |
| **PNCK-R6** | **Der Modifikator wirkt nur auf seinen Träger — Kontrolle am Namensvetter:** Der Modell-Slot unter der Einheit heißt im Katalog **identisch** „Knights of Chaos", trägt aber **keinen** `field="name"`-Modifikator. Er muss deshalb in **beiden** Rostern „Knights of Chaos" melden, auch wenn die Einheit darüber umbenannt wird. | `selectionEntry name="Knights of Chaos" id="2a5f-a5b9-62c7-4659" type="model"` (Z. 6180). Ihr `<modifiers>`-Block (Z. 6206–6213) enthält **einen** Modifikator, und der adressiert einen **Constraint-Wert** (`field="5057-48d9-fb89-a463"`, Border Patrols), nicht `name`. |
| **PNCK-R7** | **Auch der Auslöser selbst wird nicht umbenannt:** Der Slot der Aufwertung „Chosen" meldet unverändert **„Chosen"**. | `selectionEntry name="Chosen" id="7ab9-d251-abf3-8878"` (Z. 6224); ihr `<modifiers>`-Block (Z. 6228–6234) enthält nur einen Kosten-`increment` (+12 pts je Modell, `repeat` auf `childId="model"`, `scope="parent"`). |
| **PNCK-R8** | **Der Ausrüstungstausch kann die Umbenennung nicht verursachen.** Roster 02 führt statt *Heavy Armour* die *Chaos Armour\**, weil dieselbe „Chosen"-Auswahl den einen Verweis verbirgt und den anderen freischaltet. **Keiner** der vier beteiligten Bausteine (die beiden `entryLink`s und ihre Zieleinträge) trägt einen `field="name"`-Modifikator — der Namensunterschied der Einheit ist damit allein dem `prepend` zuzuschreiben. | `entryLink "Heavy Armour" e62a-a91f-8f57-4e75` (Z. 6267): einziger Modifikator `set hidden=true` (Z. 6273–6277), gegattert auf „Chosen" (`scope="parent"`). `entryLink "Chaos Armour*" a969-18a8-f7a2-1ed4` (Z. 6280, `hidden="true"`): `modifierGroup type="and"` (Z. 6284–6294) mit derselben „Chosen"-Bedingung und den zwei Modifikatoren `set 1` auf die Grenze `b72c-0388-8010-ce40` und `set hidden=false`. Zieleinträge: `dde4-0ba8-7b3c-57b7` (`.gst` Z. 938) und `91d4-774c-6c6c-fba3` (`.cat` Z. 7468) — beide **ohne** `<modifiers>`. |
| **PNCK-R9** | **Namen sind keine zählende Schranke.** Aus PNCK-R1…R8 wird **keine** feuernde Grenze erwartet; der Verletzungsbericht kodiert Zähl-Grenzen (`constraint`), nicht Namen oder Sichtbarkeit. Die Aussagen laufen über `expect.capabilities[].name` bzw. `.isHidden`, `firing` ist in beiden Rostern leer. | Dieselbe Feststellung wie in [`force-instance-gated-rename`](../force-instance-gated-rename/README.md), [`modifier-effective-name`](../modifier-effective-name/README.md) und [`set-hidden-force-gate`](../set-hidden-force-gate/README.md). |

### Wie der erwartete Name im Manifest steht

`scenario.json` trägt in Roster 02 unter `capabilities[].name` den String

```
Chosen<U+00A0>Knights of Chaos
```

mit einem **literalen NBSP** zwischen „Chosen" und „Knights". Weil das Zeichen
unsichtbar ist, hier die Kontrollsuche, mit der sich der Ist-Zustand der Datei
jederzeit ohne Sichtprüfung nachweisen lässt:

| Suche | Erwartung |
|-------|-----------|
| `rg '"name": "Chosen\x{00A0}Knights of Chaos"' docs/testing/prepend-name-chosen-knights/scenario.json` | **trifft** (Zeile der Roster-02-Capability) |
| `rg '"name": "Chosen\x{0020}Knights of Chaos"' docs/testing/prepend-name-chosen-knights/scenario.json` | **trifft nicht** |

Dieselben zwei Suchen gegen `Dark Elves (6th definitive edition).cat` mit
`join="…"` belegen die Quelle (PNCK-R3). Schlägt die erste Suche im Manifest
fehl und die zweite an, hat jemand den Trenner zu einem gewöhnlichen Leerzeichen
„korrigiert" — das ist dann der Fehler, nicht die Engine.

### Warum beide Roster katalogkonform gebaut sind

Die Einheit trägt sechs **Pflicht**-Bausteine (`min 1`, `scope="parent"`), die
mit dem geprüften Modifikator nichts zu tun haben; sie stehen in beiden Rostern,
damit keine unnötige Verletzung das Bild trübt:

| Pflicht | Grenze | Erfüllt durch |
|---------|--------|----------------|
| Modelle „Knights of Chaos" | `cb54-4992-1515-e03a` (`min 4`, Z. 6182) | `number="4"` am Modell-Slot `2a5f-…` |
| „Additional Rare slot" | `2d9b-6911-40b9-01aa` (`min 1`) / `03d4-f851-1fb7-37f4` (`max 1`), Z. 6217–6218 | eine Auswahl `bbc6-…` |
| Hand Weapon | `f138-915b-bd0b-18bb` (`min 1`, Z. 6243) | Verweis-Slot `1eab-…` → `abdb-…` |
| Shield | `9410-8464-eb23-1252` (`min 1`, Z. 6250) | Verweis-Slot `e517-…` → `50e2-…` |
| Mark of Slaanesh (troops) | `41de-302a-7655-2546` (`min 1`, Z. 6255) | Verweis-Slot `4b40-…` → `fdca-…`; das Ziel ist `hidden="true"` und wird im selben Kontingent per `set hidden=false` freigeschaltet (Z. 7775–7779) |
| Chaos Steed **mit** Barding | `dc9e-e06c-1be3-bc6a` (`min 1`, Z. 6260) und am Zieleintrag `3d49-595d-671e-df23` (`min 1`, Z. 7719) | Verweis-Slot `7946-…` → `3c1f-…`, darunter `bbd6-…` → `3211-…` |

Das Punktelimit ist in beiden Rostern **2000 pts**. Damit steht die
Force-Grenze der Kategorie *Rare* (`0a44-2d3f-adfe-f3a1`, `.gst` Z. 546) per
Modifikator „2000–2999 pts" auf **2** (`.gst` Z. 589–600) — die Einheit selbst
und ihr „Additional Rare slot" (eigener `categoryLink` *Rare*, Z. 6221) füllen
sie exakt aus. Die Punktesumme bleibt mit 152 (Roster 01) bzw. 200 pts
(Roster 02: +12 pts je Modell für „Chosen") weit unter dem Limit.

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| Der Kosten-`increment` der Aufwertung „Chosen" (+12 pts je Modell, `repeat childId="model" scope="parent"`, Z. 6229–6233) | Eigene Modifikator-Zelle (`increment` auf eine Kostenart mit `repeats`); `capabilities` kennt ohnehin keine Kosten-Aussage. |
| Die Profil-Modifikatoren am `infoLink "Knight"` des Modells (`increment 1` auf A `6b9f-…`, `decrement 1` auf Sv `f1be-…`, Z. 6192–6203) | Andere Zelle: Merkmalswert statt Name, und mit `scope="parent"` **ein anderer Zählrahmen** als der hier geprüfte `self`. Gehört in ein Merkmals-Szenario (vgl. [`modifier-characteristic-value`](../modifier-characteristic-value/README.md)). |
| Das `set hidden`-Paar an Heavy Armour / Chaos Armour\* (Z. 6273, 6291) | Verfügbarkeit statt Name — eigene Szenario-Familie ([`set-hidden-force-gate`](../set-hidden-force-gate/README.md)). Hier nur als Begründung des Ausrüstungstauschs dokumentiert (PNCK-R8), **nicht** behauptet: die Mindestgrenze des in Roster 02 effektiv versteckten Heavy-Armour-Verweises (`1183-85a4-570d-865e`) steht dort **weder in `firing` noch in `absent`** — ob eine Min-Grenze an einer versteckten Entität gemeldet wird, ist die Frage aus [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments) (Issue 0088) und nicht Gegenstand dieses Szenarios. |
| Die per `modifierGroup` von 0 auf 1 gehobene Grenze `b72c-0388-8010-ce40` | Modifikator auf einen **Constraint-Wert** — zählende Facette (vgl. [`set-constraint-value-force-gate`](../set-constraint-value-force-gate/README.md)). Roster 02 erfüllt sie durch die Auswahl der Chaos Armour\*, weshalb sie hier nur in `absent` steht. |
| `shared="true"` an der `prepend`-Bedingung | Kein Roster stellt die Einheit **zweimal** ins Kontingent; die Instanz-Frage wird hier also nicht entschieden. |
| Der Modell-Slot als Träger eines `prepend` | Der Modifikator hängt an der **Einheit**, nicht am Modell; die Träger-Frage ist über PNCK-R6 als Kontrolle gepinnt, nicht als eigene Zelle. |
| `prepend` **ohne** `join` (leerer Trenner) und `prepend` mit `join=" "` (U+0020) | An dieser Einheit nicht belegt — beide Varianten gehören zu eigenen Fällen (die Formatreferenz nennt für die `join`-lose Form `append`-Fundstellen in `Mercenaries`/`Skaven`/`The Empire`). |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide nutzen das
Kontingent „Cult of Slaanesh (SoC)" `5013-f9f4-e03b-94d5`, tragen `costLimit`
2000 pts und sind **bis auf die Aufwertung „Chosen" und den von ihr geschalteten
Rüstungstausch identisch**.

| # | Testtitel | Roster-Zustand | Ist-Wert der `self`-Zählung | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|------------------------------|----------------------------------------|---------|
| 01 | Ohne „Chosen" → Katalogname | Knights of Chaos mit 4 Modellen, Additional Rare slot, Hand Weapon, Shield, **Heavy Armour**, Mark of Slaanesh, Chaos Steed + Barding. | „Chosen" **0** → Bedingung hält **nicht**. | **PNCK-R1/R2:** Der Einheiten-Slot `7843-…` meldet **„Knights of Chaos"**. **PNCK-R5:** `isHidden` = `false`. **PNCK-R6:** Der Modell-Slot `2a5f-…` meldet ebenfalls „Knights of Chaos". Keine der gepinnten Grenzen feuert. | [`01-knights-of-chaos-without-chosen.ros`](rosters/01-knights-of-chaos-without-chosen.ros) |
| 02 | Mit „Chosen" → vorangestellter Name | Derselbe Aufbau **plus** die Aufwertung **„Chosen"**; statt Heavy Armour die **Chaos Armour\***, weil dieselbe Auswahl den einen Verweis verbirgt und den anderen mit `min 1` freischaltet. | „Chosen" **1** → Bedingung hält. | **PNCK-R3:** Der Einheiten-Slot meldet **`Chosen` + U+00A0 + `Knights of Chaos`** — ein NO-BREAK SPACE als Trenner, kein gewöhnliches Leerzeichen. **PNCK-R5:** `isHidden` weiterhin `false`. **PNCK-R6/R7:** Der Modell-Slot bleibt „Knights of Chaos", der Chosen-Slot bleibt „Chosen". Keine der gepinnten Grenzen feuert. | [`02-knights-of-chaos-with-chosen.ros`](rosters/02-knights-of-chaos-with-chosen.ros) |

**Beweisführung in beide Richtungen:** Roster 01 schlägt fehl, wenn die
Auswertung den Modifikator ohne Beleg anwendet (etwa weil sie `scope="self"` zu
weit fasst oder die Bedingung ignoriert). Roster 02 schlägt fehl, wenn sie ihn
gar nicht anwendet, die Reihenfolge dreht („Knights of Chaos Chosen"), den
Trenner verliert („ChosenKnights of Chaos"), ihn verdoppelt oder ihn **zu einem
gewöhnlichen Leerzeichen normalisiert** (U+0020 statt U+00A0) — der letzte Fall
ist der unauffälligste und genau deshalb der wertvollste an dieser Fundstelle.
Die Kontrollen PNCK-R6/R7 schlagen fehl, wenn die Umbenennung auf Nachbar-Slots
durchschlägt — insbesondere auf den **namensgleichen** Modell-Slot, der bei einer
namensbasierten statt id-basierten Zuordnung mitgerissen würde.

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Namen treffen die Engine erst im
**Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **PNCK-R3, Trennzeichen:** Wird der `join`-Wert **byteweise verbatim**
   übernommen? Ein Ergebnis mit U+0020 statt U+00A0 bedeutet, dass irgendwo
   normalisiert wird (im XML-Leser, beim Attribut-Trimmen oder beim Zusammenbau
   des Namens) — das ist ein Befund über die Engine und **kein** Anlass, die
   Erwartung auf ein Leerzeichen umzuschreiben.
2. **PNCK-R3, Reihenfolge:** Steht `value` **vor** dem Basisnamen
   (`value + join + name`)? Ein `append`-artiges Anhängen fällt hier auf.
3. **PNCK-R4** — wird `scope="self"` als der **Träger** gelesen (die Einheit),
   nicht als dessen Elternrahmen? Die Aufwertung „Chosen" liegt unter der
   Einheit; ein `parent`-artiges Lesen würde im Kontingent-Rahmen suchen und in
   Roster 02 nichts finden.
4. **PNCK-R5** — greift der zweite, force-gegatterte Entry-Modifikator so, dass
   der Slot überhaupt sichtbar ist (`isHidden false` trotz `hidden="true"` an der
   Definition)?
5. Die Slot-Adressierung: `defId 7843-…` + `frameDefId 5013-…` (Kontingent als
   Rahmen des Wurzel-Slots) bzw. `defId 2a5f-…` + `frameDefId 7843-…` muss je
   **genau einen** Slot treffen — jedes Roster enthält nur eine Einheit.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Katalog *Dark Elves* / `catalogueLink` → Bibliothek *Mercenaries* | `d4c0-4f0c-4a89-40fc` / `4301-a1ec-729b-b898` → `fc47-8392-a6c8-452a` (Z. 10152) |
| ForceEntry „Cult of Slaanesh (SoC)" (Ziel der `instanceOf`-Vorbedingung) | `5013-f9f4-e03b-94d5` (Z. 10137; `categoryLink` *Rare* `6646-2ca2-87c0-247c`, Z. 10147) |
| Träger: SelectionEntry *Knights of Chaos* (`type="unit"`, `hidden="true"`) | `7843-05b6-ba2d-cc2b` (Z. 6135) — Modifikatoren Z. 6302–6313 |
| … `prepend`-Modifikator (Subjekt), Trenner **U+00A0** | Z. 6303: `type="prepend" value="Chosen" field="name" join=<U+00A0>` (rohes Zeichen, nicht `&#160;`; nachweisbar per `rg 'join="\x{00A0}"'`) — Bedingung Z. 6305 (`atLeast 1`, `scope="self"`, `childId="7ab9-d251-abf3-8878"`, `includeChildSelections="true"`) |
| … `set hidden=false`-Modifikator (Vorbedingung) | Z. 6308 — Bedingung Z. 6310 (`instanceOf`, `scope="force"`, `childId="5013-f9f4-e03b-94d5"`) |
| Auslöser: Aufwertung *Chosen* | `7ab9-d251-abf3-8878` (Z. 6224; `max 1` `e044-8da5-f362-824e`, Kategorie *Chosen* `1865-654c-3278-892a`) |
| Kontrolle: namensgleicher Modell-Slot *Knights of Chaos* | `2a5f-a5b9-62c7-4659` (Z. 6180; `min 4` `cb54-4992-1515-e03a`, `max -1` `5057-48d9-fb89-a463`) |
| Pflicht *Additional Rare slot* (eigener `categoryLink` *Rare*) | `bbc6-be9d-36c7-e71a` (Z. 6215; `min 1` `2d9b-6911-40b9-01aa`, `max 1` `03d4-f851-1fb7-37f4`) |
| Pflicht *Hand Weapon* | Link `1eab-3950-8518-cec4` → `abdb-bbd0-41b2-5dff` (`.gst` Z. 1032); `min 1` `f138-915b-bd0b-18bb`, `max 1` `3fde-4907-2865-d87f` |
| Pflicht *Shield* | Link `e517-105e-92b5-de39` → `50e2-1873-a856-03e7` (`.gst` Z. 964); `min 1` `9410-8464-eb23-1252`, `max 1` `b0c3-f0e7-8319-ce4d` |
| Pflicht *Mark of Slaanesh (troops)* (`hidden="true"`, im Kontingent freigeschaltet) | Link `4b40-2f23-f079-8fdf` → `fdca-8baf-a3cb-dc25` (Z. 7762); `min 1` `41de-302a-7655-2546` |
| Pflicht *Chaos Steed* **mit** *Barding* | Link `7946-1b32-e202-e6ff` → `3c1f-3fc2-11b9-49aa` (Z. 7703); `min 1` `dc9e-e06c-1be3-bc6a`, `max 1` `5341-a13a-53cf-5f4f`; darunter Link `bbd6-10ce-3616-1ee9` → `3211-d836-02f1-01d0` (`.gst` Z. 1019) mit `min 1` `3d49-595d-671e-df23` |
| *Heavy Armour* (Roster 01; von „Chosen" verborgen) | Link `e62a-a91f-8f57-4e75` → `dde4-0ba8-7b3c-57b7` (`.gst` Z. 938); `min 1` `1183-85a4-570d-865e`, `max 1` `3280-167a-349f-c888` |
| *Chaos Armour\** (Roster 02; von „Chosen" freigeschaltet) | Link `a969-18a8-f7a2-1ed4` → `91d4-774c-6c6c-fba3` (Z. 7468); Link-`min` `b72c-0388-8010-ce40` (Basis 0, per `modifierGroup` auf 1), Ziel-`max 1` `0d5e-788f-dcad-d20f` |
| Kategorie *Rare* (primär an der Einheit; Force-Grenze bei 2000 pts = 2) | `e94b-6a54-8779-cd60` (Link an der Einheit `6725-e253-28c2-af97`) — Grenze `0a44-2d3f-adfe-f3a1` (`.gst` Z. 546, Modifikator Z. 589) |
| Kostenart „pts" (`costLimit` 2000 in beiden Rostern) | `ecfa-8486-4f6c-c249` |
| XSD-Beleg für die vendorten Konstrukte | `src/data/parser/schema/Catalogue.xsd` Z. 492 (`join`) und Z. 518 (`prepend`) |
