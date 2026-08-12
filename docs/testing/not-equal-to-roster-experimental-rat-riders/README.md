# E2E-Regeln & Testkatalog: Roster-weites `notEqualTo 0` auf ein Kategorie-Ziel (Experimental rules deckt die „Rat Riders" auf)

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln sind
ausschließlich aus den Katalogdaten der *6th Definitive Edition* und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.6/§7.7/§8) abgeleitet; das Roster-Format ist an den bereits verifizierten
Szenarien nachgebildet (direktes `entryId`, `entryLinkId=""` bzw. Verweis-Id,
verschachtelte `selections` mit `number`, `costLimits` mit `typeId`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Skaven (6th definitive edition).cat` (`cac6-5f02-f95d-a403`, rev 1),
  dazu die per `catalogueLink` (`4f16-8437-4e47-58a8`, Z. 11451–11453,
  `importRootEntries="false"`) deklarierte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Die Kernaussage je Roster ist ein
> `expect.capabilities[]`-Eintrag mit `isHidden` am Slot der Einheit
> „Rat Riders" (`d0aa-b183-877e-e731`) — in vier Rostern als **Angebots-Anker**
> (`offerAnchor`, die Einheit ist wählbar, aber nicht gewählt), in Roster 03 am
> **belegten** Slot (`occupied`). Sichtbarkeit ist **keine zählende Grenze**; sie
> erscheint nie im Verletzungsbericht. Die zählenden **Nachbargrenzen** werden je
> Roster als *still* (`absent`) deklariert — feuern muss in diesem Szenario keine.
> Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktebudget, die
> Autor-Fehlermeldungen fremder Einträge) dürfen zusätzlich auftreten und sind
> hier ohne Belang (selektive Erwartung).

---

## Was eine `notEqualTo`-Bedingung mit `scope="roster"` und Kategorie-`childId` laut Format tut

Wörtlich aus der Formatreferenz abgeleitet:

- `type="notEqualTo"` vergleicht den im Bezugsrahmen gezählten Wert mit `value`
  und hält, wenn er **ungleich** diesem Wert ist. Mit `value="0"` heißt das:
  „irgendetwas außer nichts" — **eins verhält sich exakt wie zwei**; die
  Bedingung kennt nur die Grenze zwischen 0 und ≠ 0 (§7.7, Tabelle `condition`).
- `field="selections"` + `childId="<Kategorie-Id>"` zählt die **Auswahlen**, die
  diese Kategorie führen (§7.7, `childId` = *„was gezählt wird: eine Ziel-ID"*;
  §8: Kategoriezugehörigkeit wird **ausschließlich** über `categoryLinks`/IDs
  aufgelöst, nie über Namen).
- `scope="roster"` spannt den Zählrahmen über das **gesamte Roster**. Zusätzlich
  gilt für ein **Kategorie**-Ziel die Ziel-Typ-Regel (§7.7-Kasten, ADR 0029):
  Kategorie-Zähler werden **über alle Kontingente hinweg aggregiert**. Beides
  zeigt in dieselbe Richtung — die Zählung ist armeeweit.
- `includeChildForces="false"` ist in diesem Datensatz **wirkungslos**: der
  Fixture-Satz kennt **keine** verschachtelten Kontingente (0 Vorkommen eines
  `forceEntry` innerhalb eines `forceEntry` in allen 11 `.cat` + `.gst`); zwei
  Kontingente eines Rosters sind Geschwister unterhalb der Roster-Wurzel, keine
  Kind-Kontingente.
- `includeChildSelections="false"` zählt *„just `scope`'s `field`"* — also
  eingeschränkt, **nicht** leer (§7.6). Damit diese Feinheit die Aussage nicht
  verwässert, steht **jede** zählende Auswahl dieses Szenarios als **direktes
  Kind eines Kontingents**; unter jeder Lesart wird sie mitgezählt.
- `type="set"` am Modifier → der `value` **ersetzt** den Feldwert. Für
  `field="hidden"` heißt das: hält das Gatter, trägt der Eintrag **exakt**
  `false`; hält es nicht, bleibt der geschriebene Basiswert `hidden="true"`.
- Eine `conditionGroup type="and"` hält nur, wenn **alle** Mitglieder halten
  (§7.7). Die Zählung allein genügt also nicht — das ist der Gegenstand von
  Roster 05.
- Mehrere Modifier eines Eintrags werden in **Dokumentreihenfolge** angewendet;
  ein späterer `set` überschreibt einen früheren (§7.7, Kasten zum wiederholten
  `set`). Deshalb ist die Netto-Sichtbarkeit erst aus der **ganzen** Modifier-
  Liste bestimmbar — siehe NER-R3.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **NER-R1** | **Zählung 0 → Basiswert bleibt:** Enthält das Roster **keine** Auswahl der Kategorie „Experimental rules", zählt die Bedingung 0, `notEqualTo 0` hält **nicht**, die `and`-Gruppe fällt, der `set hidden="false"` bleibt aus — die Einheit „Rat Riders" behält ihr geschriebenes `hidden="true"` (`isHidden` = `true`). | Skaven-`.cat` Z. 5692: `selectionEntry "Rat Riders"` `d0aa-b183-877e-e731`, `hidden="true"`, `type="unit"`, `publicationId` WD#317-UK, S. 80. Erster Modifier Z. 5694–5705: `<modifier type="set" field="hidden" value="false">` mit **einer** `conditionGroup type="and"` (Z. 5696) aus zwei Bedingungen: Z. 5698 `notInstanceOf … scope="force" childId="9f0b-5346-a3bc-b5fe"` und Z. 5701 `<condition field="selections" scope="roster" value="0" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" childId="4fed-b911-e6e0-927b" type="notEqualTo"/>`. Kategorie: `.gst` Z. 209 `<categoryEntry id="4fed-b911-e6e0-927b" name="Experimental rules" hidden="false"/>`. |
| **NER-R2** | **Zählung ≠ 0 → `set` ersetzt das Flag:** Steht **irgendwo** im Roster eine Auswahl mit dieser Kategorie, hält die Bedingung; ist zugleich das Kontingent nicht „Hell Pit", hält die `and`-Gruppe und die Einheit ist sichtbar (`isHidden` = `false`). Ob **eine** oder **zwei** solche Auswahlen dastehen, ändert nichts — `notEqualTo 0` ist kein `equalTo 1`. | Dieselben Zeilen wie NER-R1. Kategorie-Träger der Roster: **(a)** der Skaven-Wurzel-Verweis Z. 8568 `<entryLink id="c042-1d75-40ca-c654" name="Allow experimental rules?" targetId="8b76-92c4-23f9-54b1">` auf den geteilten `.gst`-Eintrag Z. 1836 — dieser führt die Kategorie `4fed` **zweimal** (`.gst` Z. 1846 `c18f-9f26-3979-0844`, Z. 1847 `fc80-0bf1-e336-29f8`) und primär „Special list rules" `32f1-197f-d719-a393` (Z. 1848); **(b)** die Einheit „Rat Riders" selbst (Skaven-`.cat` Z. 5738, `categoryLink 1cc0-f11f-286d-90ab` → `4fed`). |
| **NER-R3** | **Netto-Sichtbarkeit aus der ganzen Modifier-Liste:** Der Eintrag trägt **drei** Modifier (Z. 5693–5724), keine `modifierGroups`. Nr. 2 rührt die Sichtbarkeit nicht an (er hebt eine Grenze). Nr. 3 ist ein **zweiter** `set hidden="true"`, gegattert durch eine `or`-Gruppe aus fünf `instanceOf`-Prüfungen auf Sonderkontingente. In einem dieser fünf Kontingente wäre die Einheit **immer** verborgen — unabhängig von der Zählung, weil der spätere `set` den früheren überschreibt. Alle Roster außer 05 stehen deshalb im Kontingent **„Standard (SK-AB)"** (`f143-b4f7-0151-8478`), das weder Hell Pit ist noch in dieser Fünferliste steht: dort ist die Zählung der **einzige** Freiheitsgrad. | Skaven-`.cat` Z. 5706–5710 (Modifier 2: `increment` auf `367b-d38a-fd89-197c`), Z. 5711–5723 (Modifier 3: `set hidden="true"`, `or` über `bec8-e291-0c4a-903f` „Clan Eshin (SoC)", `2ac5-0165-8a9e-8942` „Bubonic Court of Nurglitch (LUS)", `adc6-cd5d-19cc-1bf3` „Clan Pestilens (SK-AB)", `38dc-9bed-455f-f309` „Clan Skryre (SK-AB)", `1191-bf6e-974a-b6e7` „Clan Eshin (SK-AB)"). Kontingente: Z. 21 „Standard (SK-AB)" `f143-b4f7-0151-8478`, Z. 158 „Clan Moulder (SK-AB)" `0903-619f-ec8b-1c7a`, Z. 184 „Hell Pit (WD-311)" `9f0b-5346-a3bc-b5fe`. |
| **NER-R4** | **Die `and`-Gruppe braucht beide Mitglieder:** Im Kontingent „Hell Pit (WD-311)" hält die Zählung, das `notInstanceOf` aber nicht — die Gruppe fällt, die Einheit bleibt verborgen. Der dritte Modifier greift dort ebenfalls nicht (Hell Pit steht nicht in seiner Fünferliste), es bleibt also beim Basiswert. | Skaven-`.cat` Z. 5698 (`notInstanceOf`, `childId="9f0b-5346-a3bc-b5fe"`, mit dem Autorenkommentar „Needless to say, this army is strange enough to require your opponent's consent" (WD#311-UK S. 113), Z. 5699) gegen Z. 5711–5723 (Fünferliste **ohne** `9f0b`). Kanonische Kodierung einer `forceEntry`-Prüfung: `scope="force"` + Id in `childId` (§7.7-Kasten). |
| **NER-R5** | **Der Zählrahmen ist armeeweit, nicht kontingentweise:** Eine kategorie-tragende Auswahl in einem **zweiten** Kontingent deckt die Einheit im **ersten** auf. | `scope="roster"` (Z. 5701) plus Ziel-Typ-Regel für Kategorie-Ziele (§7.7-Kasten / ADR 0029); `includeChildForces="false"` ist mangels verschachtelter Kontingente inert (0 Vorkommen im Fixture-Satz). Kontingent 2 der Prüfung: „Clan Moulder (SK-AB)" `0903-619f-ec8b-1c7a` (Z. 158) — nicht in der Fünferliste von Modifier 3 und nicht Hell Pit, führt aber (Z. 161) die Kategorie „Special list rules", unter der der Umschalter dort angeboten wird. |
| **NER-R6** | **Nachbargrenze der Einheit (nicht Gegenstand, aber deklariert):** Die einzige Grenze der Einheit ist `367b-d38a-fd89-197c` (`max`, `value="0"`, `field="selections"`, `scope="parent"`) — Rat Riders ist per Basis **gar nicht wählbar**. Modifier 2 hebt sie per `increment 1` auf 1, sobald das Kontingent mindestens eine Auswahl von `8b76-92c4-23f9-54b1` führt. In **allen** Rostern dieses Szenarios ist die Grenze still: Ist 0 (Roster 01/02/04/05) bzw. Ist 1 gegen den gehobenen Wert 1 (Roster 03). | Skaven-`.cat` Z. 5726 (Constraint) und Z. 5706–5709 (Modifier 2 mit `condition type="atLeast" value="1" … scope="force" childId="8b76-92c4-23f9-54b1" includeChildSelections="true"`). Ohne dieses `increment` feuerte die Grenze in Roster 03 mit Ist 1 / bound 0. |
| **NER-R7** | **Der Kategorie-Träger ist im Kontingent „Standard (SK-AB)" ein legitimes, freiwilliges Angebot:** Der Wurzel-Verweis „Allow experimental rules?" ist `hidden="false"` und trägt eine eigene Grenze `6a97-9696-25a5-d848` (`min`, Rohwert 0, `scope="force"`), die ein `set 1` nur in sechs Kontingenten hebt — „Standard (SK-AB)" ist **nicht** darunter. Er ist dort also weder Pflicht noch verborgen, und er kostet 0 Punkte. | Skaven-`.cat` Z. 8568–8603: Verweis `c042-1d75-40ca-c654`, Modifier Z. 8570–8595 (`or` über `1191`, `38dc`, `adc6`, `0903`, `9f0b`, `2ac5`), Constraint Z. 8598, `categoryLink` „Special list rules" Z. 8601 (der Standard-Force-Link dafür: Z. 24). Ziel `.gst` Z. 1836–1934: `max 1` je Kontingent `b302-93b6-3d1d-13d6` (Z. 1838), `min 0` `badf-a1a1-372c-9baf` / `d67f-4b65-a832-1e1b` (Z. 1839/1840), beide per `set 1` gehoben, sobald das Kontingent eine Auswahl der Kategorie `4fed` führt (Z. 1855–1866); Kosten 0 pts (Z. 1850–1854). Seine vier Unter-Einträge (Z. 1868–1932) tragen **keine** `categoryLinks` und in einem Skaven-Kontingent keine gehobene Pflicht — sie bleiben aus den Rostern heraus. |
| **NER-R8** | **Alle übrigen Grenzen der Roster sind still:** die Pflicht-/Höchstmaße der Rat-Riders-Kinder (Roster 03 ist voll besetzt) und die Rare-Grenze der `.gst`. Letztere hängt am Punktelimit: **alle** Roster tragen `costLimit` 2000 pts, wo sie auf 2 steht — ohne gesetztes Limit fiele sie per „Warbands (small)" auf 0 und feuerte in Roster 03. | Skaven-`.cat` Z. 5741–5760 (`Rat Rider`, `min 5` `e979-0e28-e8be-ed4c`, `max -1` `47be-57f1-df25-5528`), Z. 5810–5827 (Verweise `Hand Weapon` `bd0f-1512-75a3-239c` mit `f663`/`3122`, `Spear (Mounted)` `df1a-1ff0-3d36-5578` mit `c3e5`/`922a`, `Shield` `e653-6c3d-c3b7-ed6b` mit `e96c`/`7cfa`); `.gst` Z. 1032–1035 (`Hand Weapon` `abdb-bbd0-41b2-5dff` mit eigenen `min 1`/`max 1` `bdef-ba9b-d6ce-5b14`/`e28e-dbb4-b8ad-d4ab`), Z. 1056 (`Spear (Mounted)` `027b-31d2-b3e2-23a4`), Z. 964 (`Shield` `50e2-1873-a856-03e7`); Rare `.gst` Z. 544–637 (Constraint `0a44-2d3f-adfe-f3a1` Z. 546, Modifier „2000-2999 pts" Z. 589–600, Modifier „Warbands (small)" Z. 549–554). |

### Was die Zählung in diesem Datensatz **nicht** hergibt

- **Kein zweiter, freier Kategorie-Träger im Skaven-Kontingent.** Die Kategorie
  `4fed` tragen im Skaven-`.cat` nur drei Einträge — „Rat Riders" selbst
  (Z. 5738), „Burrowing Behemoth" `0b2d-6e5e-4305-e3d3` (Z. 7397) und
  „Chimaerat" `61ab-0728-8ec2-8c2e` (Z. 7472); die letzten beiden sind per Basis
  verborgen und werden **nur** im Kontingent „Hell Pit" aufgedeckt (Z. 7378–7382
  bzw. 7450–7454). Die Träger der `Mercenaries`-`.cat` (9 Einträge, u. a.
  Z. 4439) sind Wurzel-Einträge eines per `importRootEntries="false"`
  eingebundenen Katalogs. Für die Zählung „zwei" ist deshalb **Rat Riders
  selbst** der zweite Träger — der Fall ist zugleich der interessantere, weil er
  die Zählung an einem **belegten** Slot beobachtbar macht.
- **Kein `count` auf der Zählung selbst.** Der `.gst`-Eintrag `8b76` führt die
  Kategorie `4fed` **zweimal** (Z. 1846/1847). Ob eine Engine daraus 1 oder 2
  zählt, ist aus den Quellen nicht entscheidbar — und für eine
  `notEqualTo 0`-Bedingung auch gleichgültig. Das Szenario behauptet deshalb
  **nirgends** einen konkreten Zählwert, sondern nur die Seite der Null.

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `effectiveMax` des Rat-Riders-Slots (0 ohne, 1 mit „Allow experimental rules?" im **selben** Kontingent) | Gehört zur **Nachbarzelle** `condition/atLeast/force` mit **Eintrags**-Ziel (Modifier 2), nicht zur hier geprüften `notEqualTo`-Zelle. Ihre Stille ist über `absent: 367b-d38a-fd89-197c` bereits deklariert; ein zusätzlicher Zahlenwert würde die Roster an eine fremde Zelle koppeln. |
| `badf-a1a1-372c-9baf` / `d67f-4b65-a832-1e1b` in **Roster 04** | Ihr `set 1`-Gatter (`.gst` Z. 1855–1866) zählt ein **Kategorie**-Ziel mit `scope="force"`. Nach der Ziel-Typ-Regel wird ein Kategorie-Zähler armeeweit gelesen — dann stünde im leeren Kontingent 1 ein gehobenes Mindestmaß ohne Auswahl. Das ist genau die Frage der Nachbarzelle „Kategorie-Ziel bei `scope=force`" und nicht Gegenstand dieses Szenarios; in Roster 04 wird über beide Grenzen darum **nichts** behauptet (in allen Ein-Kontingent-Rostern sind sie eindeutig still und stehen in `absent`). |
| Sichtbarkeit der Rat-Riders-**Kinder** in den verborgenen Rostern (01, 05) | Ob das `hidden` eines Elternteils auf die Slot-Projektion der Kinder durchschlägt, ist in der Formatreferenz nicht spezifiziert (§8 sagt nur, dass Verborgenes nicht **angeboten** wird). Eine Behauptung wäre aus den erlaubten Quellen nicht ableitbar. |
| Die Autor-Fehlermeldungen des Musters „Please enable ‚Allow experimental rules?'" (`Mercenaries`, z. B. Z. 4453) | Eigene Zelle (`add field="error"`), bereits von `author-message-severity` / `violation-classification` gepinnt. Im Skaven-Kontingent tragen die Rat Riders keine solche Meldung. |
| Rat Riders im Kontingent einer der **fünf** `instanceOf`-Kontingente von Modifier 3 | Dort ist die Einheit unabhängig von der Zählung verborgen (NER-R3) — die `notEqualTo`-Zelle wäre nicht mehr beobachtbar. Genau deshalb wird sie gemieden. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle tragen
`costLimit` 2000 pts und unterscheiden sich **ausschließlich** in der Anzahl und
Verortung der kategorie-tragenden Auswahl bzw. im Kontingent.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Zählung 0 → verborgen | Leeres Kontingent „Standard (SK-AB)". | **NER-R1:** Rat-Riders-Angebot `isHidden: true` (Basiswert). Alle genannten Grenzen still. | [`01-standard-no-experimental-selection-rat-riders-hidden.ros`](rosters/01-standard-no-experimental-selection-rat-riders-hidden.ros) |
| 02 | Zählung 1 → sichtbar | **Derselbe** Aufbau plus genau **eine** Auswahl „Allow experimental rules?". | **NER-R2:** Rat-Riders-Angebot `isHidden: false` bei Ist 0. Einziger Unterschied zu 01 — der Flag-Wechsel hat keine andere mögliche Ursache. | [`02-standard-one-experimental-selection-rat-riders-visible.ros`](rosters/02-standard-one-experimental-selection-rat-riders-visible.ros) |
| 03 | Zählung 2 → unverändert sichtbar, Slot belegt | Wie 02 plus die Einheit „Rat Riders" selbst (voll besetzt) — sie trägt dieselbe Kategorie. | **NER-R2:** `isHidden: false` am **belegten** Slot bei Ist 1. Zwei zählende Auswahlen wirken wie eine (`notEqualTo 0`, nicht `equalTo 1`). **NER-R6/R8:** alle Kind- und Rare-Grenzen still. | [`03-standard-two-experimental-selections-rat-riders-selected.ros`](rosters/03-standard-two-experimental-selections-rat-riders-selected.ros) |
| 04 | Zählung 1 im **zweiten** Kontingent → im ersten sichtbar | Kontingent 1 „Standard (SK-AB)" leer (wie 01), Kontingent 2 „Clan Moulder (SK-AB)" hält allein die eine Auswahl. | **NER-R5:** Rat-Riders-Angebot **des ersten Kontingents** `isHidden: false`. Eine kontingentweise Zählung ergäbe hier den Zustand von Roster 01. | [`04-experimental-selection-in-second-force-rat-riders-visible.ros`](rosters/04-experimental-selection-in-second-force-rat-riders-visible.ros) |
| 05 | Zählung 1, aber falsches Kontingent → verborgen | Dieselbe eine Auswahl wie in 02, aber im Kontingent „Hell Pit (WD-311)". | **NER-R4:** `isHidden: true` — die Zählung hält, das zweite Mitglied der `and`-Gruppe fällt. Gegenprobe dazu, dass 02 nicht aus der Zählung allein folgt. | [`05-hell-pit-force-experimental-selection-rat-riders-hidden.ros`](rosters/05-hell-pit-force-experimental-selection-rat-riders-hidden.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **NER-R2** — ob `notEqualTo 0` als „ungleich null" ausgewertet wird und nicht
   versehentlich als Gleichheitsprüfung gegen den `value` (dann wäre Roster 01
   sichtbar und 02/03 verborgen — das exakte Spiegelbild).
2. **NER-R5** — ob der Zählrahmen `roster` trotz `includeChildForces="false"`
   die Auswahl des **zweiten** Kontingents erfasst (Kategorie-Ziel,
   Ziel-Typ-Regel).
3. **NER-R4** — ob die `and`-Gruppe wirklich beide Mitglieder verlangt.
4. Die Slot-Adressierung: `defId d0aa-b183-877e-e731` + `frameDefId` des
   jeweiligen Kontingents muss genau **einen** Slot treffen — in Roster 04 steht
   die Einheit in **beiden** Kontingenten als Angebot, dort trennt das
   `frameDefId` `f143-b4f7-0151-8478`.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| „Rat Riders", Träger des Gatters (Wurzel-Einheit, Basis `hidden="true"`) | `d0aa-b183-877e-e731` (Skaven-`.cat` Z. 5692) |
| Kategorie „Experimental rules" (gezähltes `childId`) | `4fed-b911-e6e0-927b` (`.gst` Z. 209) |
| `categoryLink` der Einheit auf diese Kategorie (zweiter Zähl-Träger) | `1cc0-f11f-286d-90ab` (Z. 5738) |
| Ausgeschlossenes Kontingent der `and`-Gruppe (`notInstanceOf`) | `9f0b-5346-a3bc-b5fe` „Hell Pit (WD-311)" (Z. 184) |
| Gewähltes Kontingent aller übrigen Roster | `f143-b4f7-0151-8478` „Standard (SK-AB)" (Z. 21) |
| Zweites Kontingent in Roster 04 | `0903-619f-ec8b-1c7a` „Clan Moulder (SK-AB)" (Z. 158) |
| Kontingente des späteren `set hidden="true"` (alle gemieden) | `bec8-e291-0c4a-903f`, `2ac5-0165-8a9e-8942`, `adc6-cd5d-19cc-1bf3`, `38dc-9bed-455f-f309`, `1191-bf6e-974a-b6e7` (Z. 5715–5719) |
| Kategorie-tragende Auswahl der Roster (Wurzel-Verweis im Skaven-`.cat`) | `c042-1d75-40ca-c654` → Ziel `8b76-92c4-23f9-54b1` „Allow experimental rules?" (Z. 8568 / `.gst` Z. 1836) |
| Grenze des Verweises (min, Rohwert 0 in „Standard", als `absent`) | `6a97-9696-25a5-d848` (Z. 8598) |
| Grenzen des Ziels (max 1 je Kontingent; zwei min-0-Grenzen, als `absent`) | `b302-93b6-3d1d-13d6` / `badf-a1a1-372c-9baf` / `d67f-4b65-a832-1e1b` (`.gst` Z. 1838–1840) |
| Einzige Grenze der Einheit (max, Rohwert 0, `scope="parent"`; als `absent`) | `367b-d38a-fd89-197c` (Z. 5726), gehoben per `increment` Z. 5706 |
| Rat-Riders-Kinder in Roster 03 (Pflicht-/Höchstmaße, als `absent`) | Modell `6b53-ce72-e621-b18b` (`e979-0e28-e8be-ed4c` min 5 / `47be-57f1-df25-5528` max -1); Verweise `bd0f-1512-75a3-239c` (`f663`/`3122`), `df1a-1ff0-3d36-5578` (`c3e5`/`922a`), `e653-6c3d-c3b7-ed6b` (`e96c`/`7cfa`) |
| Ziele dieser Verweise (`.gst`) | `abdb-bbd0-41b2-5dff` (mit `bdef-ba9b-d6ce-5b14` / `e28e-dbb4-b8ad-d4ab`), `027b-31d2-b3e2-23a4`, `50e2-1873-a856-03e7` |
| Kategorie *Rare* (primär an der Einheit; force-Grenze, als `absent`) | `e94b-6a54-8779-cd60` — Constraint `0a44-2d3f-adfe-f3a1` (`.gst` Z. 546) |
| Kategorie *Special list rules* (primär am Umschalter) | `32f1-197f-d719-a393` (Force-Link Z. 24) |
| Weitere Kategorie-Träger im Skaven-`.cat` (nicht genutzt, nur in Hell Pit sichtbar) | `0b2d-6e5e-4305-e3d3` „Burrowing Behemoth" (Z. 7376), `61ab-0728-8ec2-8c2e` „Chimaerat" (Z. 7448) |
| Kostenart Punkte (`costLimit`-`typeId` aller Roster) | `ecfa-8486-4f6c-c249` |
| `catalogueLink` Skaven → Mercenaries | `4f16-8437-4e47-58a8` → `fc47-8392-a6c8-452a` (Z. 11452) |
