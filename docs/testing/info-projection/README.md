# E2E-Regeln & Testkatalog: Info-Projektion je Slot (`infoElements`)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs,
Namen, Texte und Werte sind **ausschliesslich aus den Katalogdaten** der
*6th Definitive Edition*, aus der vendorten `Catalogue.xsd` und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Kontingente **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668` (Z. 29297) und **„Army of the Lichemaster (WD#309-UK)"**
  `f37a-a93e-fa22-61a8` (Z. 29441)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  von Vampire Counts per `catalogueLink ef73-f9bd-e250-54d2` eingebunden (Z. 29511)
  und daher im Datensatz zwingend mitzuladen.

## Worum es geht

Jeder Slot des Berichts fuehrt eine geordnete Liste `infoElements`: **welche
Profile und Regeltexte gelten fuer diesen Slot?** Das Datenformat kennt dafuer
vier Traeger — `<profile>`, `<rule>`, `<infoGroup>` und `<infoLink>` (XSD-Gruppe
`InfoNodeGroup`, `Catalogue.xsd` Z. 118–125; Format-Doku §7.2/§7.3/§7.4). Ein
`<infoGroup>` enthaelt seinerseits genau dieselben vier Arten
(`Catalogue.xsd` Z. 192–200), ein `<infoLink>` zeigt per `type` auf `profile`,
`rule` **oder** `infoGroup` (`Catalogue.xsd` Z. 346–352, Format-Doku §13.1).

Die Format-Doku haelt in §7.3 als Domaenenregel fest, dass Profile und
Sonderregeln oft **nicht** an der Grundeinheit haengen, sondern verschachtelt an
Aufwertungen, und dass die effektiven Profile/Regeln einer Einheit deshalb
**rekursiv** aus Katalogdefinition **und** den tatsaechlich getroffenen Auswahlen
eingesammelt werden muessen — nur **aktiv gewaehlte** optionale Aufwertungen
zaehlen (§7.1). Genau das ist die Vererbung nach oben, die dieses Szenario pinnt.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **IPJ-R1** | **Eigene Info-Elemente.** Jedes `<profile>`, jede `<rule>`, jedes `<infoGroup>`-Mitglied und jeder `<infoLink>` an der Definition des Slots gehoert in dessen Liste. | `Vampire Counts…cat` Z. 71: Einheit **Skeletons** `9ac2-f4c1-bcc3-3aee` traegt genau einen eigenen `infoLink` **`2e96-1358-0d62-d453`** („Undead", `type="rule"`, `targetId="0e726d5e-c950-4518-90ce-d931d6218df0"`, Z. 73). Z. 179–208: **Skeleton Captain** `31e1-bd91-2c0b-b604` traegt ein **direkt eingebettetes** `<profile>` **`8cdc-fdc5-c29c-7d31`**. |
| **IPJ-R2** | **Regeltext = woertliche `<description>`.** Der Text einer Regel ist die `<description>` des Ziels, unveraendert; kein Modifikator im Datensatz adressiert `description` (Format-Doku §7.7/§13.2 fuehren `description` nicht als `field`-Wert). | `Vampire Counts…cat` Z. 25892–25894: `rule "Undead" 0e726d5e-…` → `<description>See page 20 and 21 of the army book.</description>`. `…gst` Z. 16679–16681: `rule "Fear" 1524-2372-4aa0-6881` → „Unit causes Fear". `…gst` Z. 16737–16739: `rule "Immune to Panic" ff2b-8db6-64fa-e9ca` → „The unit do not take Panic tests.". **Woertlich heisst byte-genau:** die `<description>` von `rule "Spirit Levy" 81c6-781a-75ce-a69b` (`…cat` Z. 26458) enthaelt an **vier** Stellen ein **geschuetztes Leerzeichen U+00A0** statt eines normalen. Das ist kein Einzelfall dieser einen Regel — U+00A0 steckt auch in anderen `<description>`s desselben Katalogs (z. B. Z. 10674, Z. 26461, Z. 29675). |
| **IPJ-R3** | **Profil-Eintraege tragen ihren `profileType`.** `profileTypeId` ist das `typeId` des Profils, `profileTypeName` der Klartextname der `<profileType>`-Deklaration im Spielsystem; die Merkmale hangen per `typeId` an den `<characteristicType>`s dieses Typs. | `…gst` Z. 18 `profileType "Profile" a54a-7f00-29bf-12b1` (Merkmale Mv/WS/BS/S/T/W/I/A/Ld/Sv/Sv+/US/Base, Z. 20–124) und Z. 126 `profileType "Weapon" 7889-42d9-70a0-3ea9` (Range/Strength/Damage/Special Rules/Saves, Z. 127–163). Profil **Skeleton** `0971-8485-8672-524a` (`…cat` Z. 26696) nutzt `a54a…`, Profil **Hand Weapon** `5556-38ea-b278-4a8f` (`…gst` Z. 17254) nutzt `7889…`. |
| **IPJ-R4** | **Vererbung nach oben — und nur nach oben.** Die Liste eines Slots enthaelt zusaetzlich die Info-Elemente seiner **besetzten** Unterauswahlen. Anker fuer nicht gewaehlte Optionen steuern nichts bei; umgekehrt reicht **kein** Element von der Einheit nach **unten** in ihre Unterauswahlen durch. | `Vampire Counts…cat` Z. 71–155: an der Einheit **Skeletons** selbst haengt nur „Undead". Statblock (`infoLink 9f0d-b3a8-86ff-673e` → Profil `0971-…`, Z. 130), Waffenprofil (`infoLink 9314-7e3c-78ed-fbd8` → `5556-…`, Z. 147) und Champion-Profil (`<profile> 8cdc-…`, Z. 184) haengen an den drei Unterauswahlen `eaa1-c6a6-9aae-ae9a` (Modell), `565b-37e6-290b-e040` (Handweapon, `min=1`/`max=1` Z. 143–144) und `31e1-bd91-2c0b-b604` (Captain, in der Gruppe `ecab-191e-2d84-3287`, Z. 157). Fuer die Gegenrichtung: der Modell-Slot **Spirit Host** `7a8a-ae42-4d15-7d9f` (`…cat` Z. 1680–1710) fuehrt **weder** `<profiles>`/`<rules>` **noch** `<infoLinks>` — alle fuenf Info-Verweise haengen an der Einheit `41a3-61ff-bfd0-b4b1` darueber (Z. 1626–1675). Format-Doku §7.3 („rekursive Profil-Sammlung") / §7.1. |
| **IPJ-R5** | **Verweis-Identitaet.** Ein per `<infoLink>` bezogenes Profil / eine so bezogene Regel erscheint **an der Stelle des Verweises** und unter dessen Identitaet: `id` ist die **Link-Id**, nicht die Ziel-Id; der Name ist der effektive Name des Verweises, Merkmale/Regeltext kommen vom Ziel. | Format-Doku §3.2: Kosten, Constraints und Modifikatoren haengen **am Link**, nicht an der Definition — der Link ist das Vorkommen. Belegt an vier Paaren: `9f0d-b3a8-86ff-673e` → `0971-8485-8672-524a`, `9314-7e3c-78ed-fbd8` → `5556-38ea-b278-4a8f`, `2e96-1358-0d62-d453` → `0e726d5e-…`, `48e1-2acb-4d95-a551` → `1342-aad0-121e-6543`. Das Muster ist bereits im Szenario [`modifier-characteristic-value`](../modifier-characteristic-value/README.md) belegt: **vier** Verweise auf **ein** geteiltes Profil ergeben **vier** Vorkommen mit je eigenen Werten. |
| **IPJ-R6** | **`infoLink` auf eine `infoGroup` liefert die Mitglieder**, keinen eigenen Eintrag — weder unter der Id des Verweises noch unter der der Gruppe. Mitglieder sind alle vier Traegerarten der Gruppe — im Fixture zwei `<infoLink>`s **und** eine eingebettete `<rule>`. | `Vampire Counts…cat` Z. 12281–12303: `selectionEntry "The Army of the Lichemaster"` **`2d69-e7b1-e2c1-92bd`** traegt genau einen `infoLink` **`fd0e-2346-9f95-8c99`** mit `type="infoGroup" targetId="fb4b-1df6-3bf8-63dd"`. Die Gruppe (Z. 29668–29697, in `<sharedInfoGroups>`) enthaelt `infoLink "Fear" b446-2605-d413-a39d`, `infoLink "Immune to Panic" a246-d767-6ef1-36bc` und die eingebettete `rule "Army of the Lichemaster" 7607-820c-4f41-f190`. Eine `infoGroup` ist ein **Container** (`EntryBase` + `InfoNodeGroup`, `Catalogue.xsd` Z. 192–200) und selbst kein Profil und keine Regel — sie hat weder `characteristics` noch `description` und kann damit gar keinen Eintrag der beiden erlaubten `kind`-Werte bilden. |
| **IPJ-R7** | **Effektive Werte.** Merkmalswerte sind die Werte **nach** jedem greifenden Merkmals-Modifikator, der Name ist der Name **nach** jedem greifenden `field="name"`-Modifikator. | `Vampire Counts…cat` Z. 1627–1646: `infoLink 48e1-2acb-4d95-a551` traegt einen **unbedingten** `modifier type="set" value="Gloom" field="name"` (Z. 1629) und eine `modifierGroup` mit `condition instanceOf … childId="f37a-a93e-fa22-61a8"` (Lichemaster), die T=2, Ld=5, US=1, S=2, A=1, W=1 setzt (Z. 1637–1642). Z. 200–206: das eingebettete Profil `8cdc-…` wird im selben Kontingent per `set "Skeletal Chieftain" field="name"` umbenannt. Format-Doku §7.7. |
| **IPJ-R8** | **Wirksam verborgene Elemente fehlen.** Massgeblich ist die **effektive** Sichtbarkeit: das Basis-`hidden` des Elements, ueberschrieben von einem `field="hidden"`-Modifikator **an genau diesem Element**, dessen Bedingungen halten. Was an einem verborgenen Knoten haengt, faellt mit weg. | `Vampire Counts…cat`, Einheit **0-1 Spirit Host** `41a3-61ff-bfd0-b4b1` (Z. 1622): `infoLink "Spirit Levy" 7f0b-7925-a1f8-1aeb` und `infoLink "Tormented" bd66-0701-64b6-e8da` haben **Basis `hidden="true"`** und je einen `set hidden=false` unter der Lichemaster-Bedingung (Z. 1647–1655 / 1666–1674); `infoLink "Swarm" b600-a799-afb3-3174` hat **Basis `hidden="false"`** und einen `set hidden=true` unter derselben Bedingung (Z. 1656–1664); `infoLink "Ethereal" 3f1c-1c30-6e83-4b75` (Z. 1665) traegt gar keinen Modifikator und ist immer sichtbar. Format-Doku §8. |

### IPJ-R7/R8 im Detail — dieselbe Einheit, zwei Kontingente

Basis-`characteristics` des geteilten Profils **Spirit Host**
`1342-aad0-121e-6543` (`…cat` Z. 26815–26831):

```
Mv 6 | WS 2 | BS 0 | S 3 | T 3 | W 4 | I 1 | A 4 | Ld 6 | Sv 7 | Sv+ 7 | US 3
```

| Info-Verweis der Einheit | Basis-`hidden` | Modifikator am Verweis | Standard (VC-AB) | Army of the Lichemaster |
|---------------------------|----------------|-------------------------|------------------|--------------------------|
| `48e1-2acb-4d95-a551` (Profil „Spirit Host") | `false` | unbedingt `set name="Gloom"`; Lichemaster: 6 Merkmals-`set` | **sichtbar**, Name **„Gloom"**, Basiswerte | **sichtbar**, Name **„Gloom"**, S 2 / T 2 / W 1 / A 1 / Ld 5 / US 1 |
| `7f0b-7925-a1f8-1aeb` (Regel „Spirit Levy") | **`true`** | Lichemaster: `set hidden=false` | **fehlt** (assertiert) | **sichtbar** |
| `b600-a799-afb3-3174` (Regel „Swarm") | `false` | Lichemaster: `set hidden=true` | **sichtbar** | **fehlt** (assertiert) |
| `3f1c-1c30-6e83-4b75` (Regel „Ethereal") | `false` | — | **sichtbar** | **sichtbar** |
| `bd66-0701-64b6-e8da` (Regel „Tormented") | **`true`** | Lichemaster: `set hidden=false` | **fehlt** (assertiert) | **sichtbar** |

Die Bedingung aller `hidden`- und Merkmals-Modifikatoren ist wortgleich
`condition type="instanceOf" field="selections" scope="force"
childId="f37a-a93e-fa22-61a8"` — sie haelt genau dann, wenn das Kontingent das
Lichemaster-Kontingent ist. Roster 03 steht in `force entryId="e989-15b8-7eb6-9668"`
(Standard), Roster 04 in `force entryId="f37a-a93e-fa22-61a8"`; damit sind beide
Spalten der Tabelle allein aus dem Roster-Kopf entschieden.

Die Einheit selbst wird im Lichemaster-Kontingent per `modifierGroup`
(Z. 1717–1730) zu **„Glooms"** umbenannt, ihr Modell (Z. 1680–1710) zu
**„Gloom"**, dessen Mindestmenge dort auf **10** gesetzt (`34f6-fda6-54a6-3deb`)
und die Roster-Obergrenze `6041-13bc-4302-5d28` auf `-1` gehoben — die Roster
tragen das entsprechend nach.

### IPJ-R4 im Detail — was an der Einheit *Skeletons* haengt

```
selectionEntry "Skeletons" 9ac2-f4c1-bcc3-3aee              ← infoLink 2e96-… (Regel „Undead")
  ├ selectionEntry "Skeletons" eaa1-c6a6-9aae-ae9a  (Modell) ← infoLink 9f0d-… (Profil „Skeleton")
  ├ selectionEntry "Handweapon" 565b-37e6-290b-e040          ← infoLink 9314-… (Profil „Hand Weapon")
  └ selectionEntryGroup "Command group" ecab-191e-2d84-3287
       └ selectionEntry "Skeleton Captain" 31e1-bd91-2c0b-b604 ← <profile> 8cdc-… (eingebettet)
```

Die Liste der **Einheit** muss daher alle vier Elemente fuehren, die Listen der
Unterauswahlen jeweils nur ihr eigenes. Die Gruppe „Command group" traegt keine
`constraints`; die Auswahl steht im Roster mit `entryGroupId="ecab-191e-2d84-3287"`
direkt unter der Einheit — dieselbe Kodierung wie in
[`modifier-characteristic-value`](../modifier-characteristic-value/) verifiziert.

> **Mengen und Vielfachheit.** Das Modell steht mit `number="10"` im Roster
> (Mindestgrenze `ad1d-03cf-a16f-ae52`). `infoElements` beantwortet die Frage
> *„welche Profile und Regeln gelten hier?"* — eine Menge geltender Elemente,
> keine Aufzaehlung je Modell. Das geerbte Profil `9f0d-…` wird deshalb als
> **genau ein** Eintrag der Einheiten-Liste erwartet, nicht zehnmal.

---

## Assertierte Abwesenheiten (`infoElementsAbsent`)

Die Negativhaelfte von IPJ-R4, IPJ-R6 und IPJ-R8 laeuft ueber den
Manifest-Schluessel `expect.capabilities[].infoElementsAbsent` — eine Liste von
Vorkommens-Ids, die in der Projektion **dieses** Slots **nicht** stehen duerfen
(siehe `.claude/agents/e2e-testcase-author.md`).
`infoElements` allein ist eine Teilmengen-Zusicherung und bemerkt einen zu viel
gefuehrten Eintrag nie.

| Roster | Slot | Ausgeschlossene Id | Warum die Daten das verlangen |
|--------|------|--------------------|--------------------------------|
| 03 | Einheit `41a3-61ff-bfd0-b4b1` | `7f0b-7925-a1f8-1aeb` („Spirit Levy") | `…cat` Z. 1647: Basis `hidden="true"`. Der einzige Gegen-Modifikator (`set hidden=false`, Z. 1649) haengt an der Lichemaster-`condition` (Z. 1651); Roster 03 steht im Kontingent `e989-15b8-7eb6-9668`, die Bedingung haelt nicht → wirksam verborgen (IPJ-R8). |
| 03 | Einheit `41a3-61ff-bfd0-b4b1` | `bd66-0701-64b6-e8da` („Tormented") | `…cat` Z. 1666: identische Konstruktion — Basis `hidden="true"`, `set hidden=false` (Z. 1668) nur unter der Lichemaster-`condition` (Z. 1670). |
| 04 | Einheit `41a3-61ff-bfd0-b4b1` | `b600-a799-afb3-3174` („Swarm") | `…cat` Z. 1656: Basis `hidden="false"`, aber `set hidden=true` (Z. 1658) unter der Lichemaster-`condition` (Z. 1660). Roster 04 steht im Kontingent `f37a-a93e-fa22-61a8`, die Bedingung haelt → wirksam verborgen. Die Gegenprobe steht in Roster 03, wo genau dieses Element **positiv** in `infoElements` erwartet wird. |
| 04 | Auswahl `2d69-e7b1-e2c1-92bd` | `fd0e-2346-9f95-8c99` (der `infoLink` selbst) | `…cat` Z. 12286: `type="infoGroup"`. Der Verweis liefert die drei Mitglieder der Gruppe `fb4b-1df6-3bf8-63dd`, keinen Eintrag unter seiner eigenen Id (IPJ-R6). |
| 04 | Auswahl `2d69-e7b1-e2c1-92bd` | `fb4b-1df6-3bf8-63dd` (die `infoGroup` selbst) | Dieselbe Begruendung unter der anderen moeglichen Identitaet: die Gruppe (`…cat` Z. 29668) ist ein Container ohne `characteristics` und ohne `description` und kann daher weder ein `kind="profile"`- noch ein `kind="rule"`-Element bilden. |
| 04 | Modell `7a8a-ae42-4d15-7d9f` | `48e1-2acb-4d95-a551`, `3f1c-1c30-6e83-4b75` | Der Modell-Slot (`…cat` Z. 1680–1710) traegt selbst kein einziges Info-Element; beide Verweise haengen an der **Einheit** darueber (Z. 1627 / Z. 1665). Die Projektion sammelt eigene Elemente plus die der besetzten **Unter**auswahlen — nach unten reicht nichts durch (IPJ-R4). |

---

## Was dieses Szenario bewusst **nicht** festnagelt

- **`infoElements` bleibt eine Teilmengen-Zusicherung.** Ueber Elemente, die
  weder in `infoElements` noch in `infoElementsAbsent` eines Slots genannt sind,
  macht das Szenario keine Aussage — es zaehlt insbesondere nicht, wie viele
  Eintraege ein Slot insgesamt fuehrt. Die frueher hier vermerkte Luecke
  („der Ausschluss verborgener Elemente ist nicht ausdrueckbar") ist mit
  `infoElementsAbsent` geschlossen; die sechs konkreten Ausschluesse stehen oben.
- **Reihenfolge.** Die Regel nennt Dokumentreihenfolge (eigene zuerst, dann
  Unterauswahlen in Baumreihenfolge). `infoElements` ist eine Teilmenge; das
  Szenario macht deshalb **keine** Aussage ueber die Position eines Eintrags.
  Anmerkung am Rand: die Gruppe `fb4b-1df6-3bf8-63dd` fuehrt im XML `<infoLinks>`
  **vor** `<rules>`, waehrend die XSD-Sequenz (`Catalogue.xsd` Z. 118–125)
  `profiles, rules, infoGroups, infoLinks` vorgibt — „Dokumentreihenfolge" ist
  hier also nicht eindeutig, was ein weiterer Grund ist, sie nicht zu pinnen.
- **Leere Merkmalswerte und `formatRules`.** Das Profil `5556-38ea-b278-4a8f`
  („Hand Weapon") hat vier leere `<characteristic>`-Elemente; zusaetzlich tragen
  die `characteristicType`s des Spielsystems `formatRules` (z. B. `Sv`:
  `^7+$ → -`, `…gst` Z. 84–96). Ob `value` den Rohwert oder den formatierten Wert
  meint, ist aus den Daten nicht entscheidbar. Das Szenario assertiert deshalb
  nur **nicht-leere, von keiner Format-Regel betroffene** Merkmale (Mv, WS, S, T,
  W, A, Ld, US und „Special Rules") und **kein** Sv/Sv+.
- **Der Verletzungsbericht.** Info-Elemente sind **keine** zaehlende Schranke;
  aus IPJ-R1…R8 wird **keine** feuernde Grenze erwartet. Die `firing`-Liste aller
  vier Roster ist leer; die Aussagen laufen ueber
  `expect.capabilities[].infoElements` und `…infoElementsAbsent`.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

> **Assertion-Fokus:** die genannten Info-Elemente, ihre Namen, Texte,
> Profiltypen und Merkmalswerte, die ausgeschlossenen Info-Elemente sowie die
> aufgefuehrten Constraint-Ids. Andere
> Armeeaufbau-Diagnosen (General-/Core-/Lord-Pflicht, Punktelimit — das
> Lichemaster-Kontingent verlangt per `8f3f-ffa8-387b-0bf9` mindestens 2000
> Punkte und per `760d-2352-9fac-0e46` mindestens einen Lord) koennen zusaetzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Eigene und geerbte Info-Elemente | Standard-Kontingent, Einheit *Skeletons*: 10 Modelle, Pflicht-Handwaffe, ein *Skeleton Captain*. | Die Einheit fuehrt **vier** Elemente: die eigene Regel „Undead" mit ihrem woertlichen Text sowie — von den drei Unterauswahlen geerbt — den Statblock „Skeleton" (Typ „Profile"), das Waffenprofil „Hand Weapon" (Typ „Weapon", Sonderregel „-1 Sv with HW") und das Champion-Profil „Skeleton Captain". Jede Unterauswahl fuehrt genau ihr eigenes Element. Keine Grenze verletzt. | [`01-skeletons-standard.ros`](rosters/01-skeletons-standard.ros) |
| 02 | Modifikator am eingebetteten Profil sichtbar | **Dieselbe** Einheit im Lichemaster-Kontingent, dazu die dort verlangte Auswahl *The Army of the Lichemaster*. | Das eingebettete Champion-Profil heisst jetzt **„Skeletal Chieftain"** — in der Liste des Captain-Slots **und** in der geerbten Liste der Einheit. Das benachbarte, per Verweis bezogene Profil „Skeleton" bleibt unveraendert: die Umbenennung wirkt nur auf ihr eigenes Vorkommen. Keine Grenze verletzt. | [`02-skeletons-lichemaster.ros`](rosters/02-skeletons-lichemaster.ros) |
| 03 | Sichtbare Elemente, Basiswerte, verborgene Regeln fehlen | Standard-Kontingent, Einheit *0-1 Spirit Host* mit einem Modell. | Die Einheit fuehrt das Profil — angezeigt als **„Gloom"**, obwohl der Verweis „Spirit Host" heisst — mit den **Katalog-Basiswerten**, dazu die Regeln „Swarm" und „Ethereal". Die beiden basis-verborgenen Regeln **„Spirit Levy"** und **„Tormented"** werden hier nicht eingeblendet und muessen **fehlen**. Keine Grenze verletzt. | [`03-spirit-host-standard.ros`](rosters/03-spirit-host-standard.ros) |
| 04 | Einblenden, Ausblenden, geaenderte Werte, `infoGroup`-Verweis | **Dieselbe** Einheit im Lichemaster-Kontingent (10 Modelle) plus *The Army of the Lichemaster*. | Die zwei zuvor verborgenen Regeln **„Spirit Levy"** (mit ihrem woertlichen Text, geschuetzte Leerzeichen eingeschlossen) und **„Tormented"** erscheinen jetzt, waehrend „Swarm" umgekehrt **fehlt**; die Merkmale des Profils „Gloom" sind auf **S 2 / T 2 / W 1 / A 1 / Ld 5 / US 1** geaendert. Die Auswahl *The Army of the Lichemaster* zieht ihre Regeln ueber einen Verweis auf eine **Regelgruppe** herein: in ihrer Liste stehen deren **drei Mitglieder** („Fear", „Immune to Panic", „Army of the Lichemaster"), **weder** der Verweis **noch** die Gruppe selbst. Der Modell-Slot fuehrt keines der Elemente seiner Einheit. Keine Grenze verletzt. | [`04-spirit-host-lichemaster.ros`](rosters/04-spirit-host-lichemaster.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (VC-AB)" / „Army of the Lichemaster (WD#309-UK)" | `e989-15b8-7eb6-9668` / `f37a-a93e-fa22-61a8` |
| Katalog Vampire Counts / Mercenaries (per `catalogueLink ef73-f9bd-e250-54d2`) | `4d73-5ab0-9020-403c` / `fc47-8392-a6c8-452a` |
| Einheit *Skeletons* | `9ac2-f4c1-bcc3-3aee` (Force-min `0005-cca1-4c68-4bcf`) |
| Modell-Slot *Skeletons* (min 10 `ad1d-03cf-a16f-ae52`) | `eaa1-c6a6-9aae-ae9a` |
| *Handweapon* (min 1 `175c-13ab-b2bf-a749`, max 1 `c217-3344-da80-f974`) | `565b-37e6-290b-e040` |
| Gruppe *Command group* / Slot *Skeleton Captain* | `ecab-191e-2d84-3287` / `31e1-bd91-2c0b-b604` |
| `infoLink` „Undead" → Regel `0e726d5e-c950-4518-90ce-d931d6218df0` | `2e96-1358-0d62-d453` |
| `infoLink` „Skeleton" → Profil `0971-8485-8672-524a` | `9f0d-b3a8-86ff-673e` |
| `infoLink` „Hand Weapon" → Profil `5556-38ea-b278-4a8f` (`.gst`) | `9314-7e3c-78ed-fbd8` |
| Eingebettetes `<profile>` „Skeleton Captain" (Lichemaster: „Skeletal Chieftain") | `8cdc-fdc5-c29c-7d31` |
| Einheit *0-1 Spirit Host* (Lichemaster: „Glooms") | `41a3-61ff-bfd0-b4b1` (Roster-max `6041-13bc-4302-5d28`) |
| Modell-Slot *Spirit Host* (Lichemaster: „Gloom", min `34f6-fda6-54a6-3deb`); traegt **selbst keine** Info-Elemente | `7a8a-ae42-4d15-7d9f` |
| `infoLink` „Spirit Host" → Profil `1342-aad0-121e-6543`, Name-`set` „Gloom" | `48e1-2acb-4d95-a551` |
| `infoLink` „Spirit Levy" (Basis `hidden=true`) → Regel `81c6-781a-75ce-a69b`. **Achtung:** deren `<description>` (`…cat` Z. 26458) trennt vier Wortpaare mit **U+00A0** statt eines normalen Leerzeichens — nach „still", nach „flesh", nach „in" und nach „rank". Im Manifest byte-genau uebernommen; U+00A0 sieht im Editor aus wie ein normales Leerzeichen. | `7f0b-7925-a1f8-1aeb` |
| `infoLink` „Tormented" (Basis `hidden=true`) → Regel `0158-3b43-0206-ecc0` | `bd66-0701-64b6-e8da` |
| `infoLink` „Swarm" (Basis `hidden=false`, Lichemaster verborgen) → Regel `400b-9e7d-7128-3294` | `b600-a799-afb3-3174` |
| `infoLink` „Ethereal" (immer sichtbar) → Regel `6d98-35cb-09d5-9cf1` | `3f1c-1c30-6e83-4b75` |
| Auswahl *The Army of the Lichemaster* (Basis `hidden=true`, dort eingeblendet; min `d7ca-7e6b-7a46-617f`) | `2d69-e7b1-e2c1-92bd` |
| `infoLink` auf die `infoGroup` „Special rules for Army of the Lichemaster" | `fd0e-2346-9f95-8c99` → `fb4b-1df6-3bf8-63dd` |
| Mitglieder dieser Gruppe: `infoLink` „Fear" / „Immune to Panic" / eingebettete `<rule>` | `b446-2605-d413-a39d` / `a246-d767-6ef1-36bc` / `7607-820c-4f41-f190` |
| Regeln „Fear" / „Immune to Panic" (`.gst`) | `1524-2372-4aa0-6881` / `ff2b-8db6-64fa-e9ca` |
| `profileType` „Profile" / „Weapon" (`.gst`) | `a54a-7f00-29bf-12b1` / `7889-42d9-70a0-3ea9` |
| `characteristicType` Mv / WS / S / T / W / A / Ld / US | `0e92-d038-82bf-fb41` / `f95b-da01-0578-3bdc` / `b690-4bc0-bb73-267b` / `8712-f56f-5b22-a720` / `253a-9b00-4fde-8ac2` / `6b9f-c8fe-8998-27e3` / `2d45-18fe-9eb3-b113` / `fa44-51dd-e69c-8d6a` |
| `characteristicType` „Special Rules" (profileType „Weapon") | `a21a-cdc0-4b13-b236` |
