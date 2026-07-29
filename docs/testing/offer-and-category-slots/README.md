# E2E-Regeln & Testkatalog: Angebots- und Kategorie-Slots

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind aus
den Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Fixtures (direktes `entryId`,
`entryLinkId=""` bzw. `entryLinkId=<Verweis-Id>` bei verlinkten Eintraegen).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1)
- zusaetzlich im Datensatz: `Orcs and goblins (6th definitive edition).cat`
  (liefert den Wurzel-`entryLink` auf „Manbiters“) und
  `Mercenaries (6th definitive edition).cat` (die per `catalogueLink` benoetigte
  Abhaengigkeit, in der die Kategorien „Mercenaries“/„Regiment of Renown“ und
  „Manbiters“ selbst definiert sind)

## Worum es geht

Der Bericht beschreibt nicht mehr nur, **was** im Roster steht, sondern **jede
Stelle, an der eine Auswahl stehen kann**. Neben den bekannten Ankern (besetzte
Auswahl, Pflicht-Anker, Gruppen-Anker) gibt es damit zwei neue Sorten:

1. **Kategorie-Anker** — je `categoryLink` des `forceEntry` ein Slot, mit
   Untergrenze/Obergrenze der Kategorie, dem Ist-Stand im Kontingent und dem
   `hidden`-Flag. Der Slot haengt am **`categoryLink`**, nicht am
   `categoryEntry`: seine eigene Definition ist der Link, das Ziel ist die
   Kategorie (siehe „Wie ein Slot benannt wird“).
2. **Angebots-Anker** — jede Definition, die im Rahmen **waehlbar** ist, dort
   aber (noch) **nicht vorkommt**.

„Waehlbar im Rahmen“ ist dabei streng definiert:

```
Kontingent (forceEntry-Instanz)
  └ jedes <selectionEntry>/<entryLink> direkt unter einer Katalog- oder
    Spielsystem-Wurzel (<selectionEntries>/<entryLinks> der Wurzel, ueber ALLE
    Kataloge des Datensatzes), sofern mindestens eine seiner BASIS-Kategorien
    unter den categoryLink-Zielen des forceEntry steht.
    Eine Definition ganz ohne Basis-Kategorie wird immer angeboten.

besetzte Auswahl
  └ ihre direkten Optionen — durch <selectionEntryGroup>s und durch einen
    <entryLink> auf eine Gruppe hindurch, aber HALT beim ersten Eintrag.
    Die Optionen eines geschachtelten Eintrags gehoeren diesem, nicht dem
    aeusseren. Ein Angebots-Anker ist immer ein Blatt.
```

Dazu vier harte Zusatzregeln:

- **Pflicht ist kein Angebot.** Traegt eine Definition eine `min`-Grenze mit
  `scope="force"` (oder `scope="parent"`), ist sie im Rahmen **pflichtig**. Fehlt
  sie dort, bekommt sie einen **Pflicht-Anker** (`mandatoryPhantom`) — und der ist
  **berichtspflichtig**: seine unerfuellte `min`-Grenze feuert als ganz normale
  Verletzung mit `actual: 0` — sofern der Traeger effektiv **sichtbar** ist; die
  Min-Grenzen eines effektiv versteckten Traegers werden nicht gemeldet
  (Issue 0088), der Faehigkeitsdatensatz traegt sie trotzdem. Wegen der
  Duplikat-Regel bekommt eine solche Definition im selben Rahmen **nie**
  zusaetzlich einen Angebots-Anker. Kurz: das Angebot ist, was man nehmen
  *darf*; der Pflicht-Anker ist, was man nehmen *muss*.
- **Kein Duplikat** — kein Angebots-Anker, wo fuer dieselbe Definition im selben
  Rahmen schon ein Knoten haengt.
- **Gesperrt/verborgen wird materialisiert und markiert**, nie weggelassen
  (`isBlocked`/`isHidden`).
- **Ein Angebots-Anker erzeugt niemals eine Verletzung** — und weil er ein Blatt
  ist, entsteht unter ihm auch kein Pflicht-Anker fuer seine Kinder.

### Wie ein Slot benannt wird

Ein Slot traegt zwei Namensfelder, und die Katalogdaten entscheiden, welches
welchen Wert hat:

| Feld | Bedeutung | Beispiel aus diesem Szenario |
|------|-----------|------------------------------|
| `defId` | die **eigene** Definition des Slots. Bei einem Verweis-Slot ist das der **Verweis selbst**, nicht sein Ziel. | Kategorie-Anker „Mercenaries“ → `categoryLink 6b8f-90b1-38b5-6e1c`; Angebots-Anker „Manbiters“ → Wurzel-`entryLink e3c2-1778-d3d5-edd1` |
| `targetDefId` | worauf ein Verweis-Slot **zeigt**: die Kategorie eines `categoryAnchor` bzw. der Eintrag hinter einem `entryLink`. `null`, wenn der Slot kein Verweis ist. | `b640-7e9c-3054-c1ce` (Kategorie „Mercenaries“); `0efb-7f63-7932-0655` (`selectionEntry "Manbiters"`) |

Daraus folgt fuer dieses Szenario:

- **Kategorie-Anker** werden hier ueber `targetDefId` (die Kategorie) plus
  `anchorKind="categoryAnchor"` und `frameDefId` (das Kontingent) benannt. Das ist
  stabil und kommt ohne die je Kontingent verschiedene `categoryLink`-Id aus — die
  Kategorie-Id als `defId` zu nennen waere schlicht falsch, weil die dem Link
  gehoert.
- **Angebots-Anker auf Wurzel-`selectionEntry`s** (Fell Bats, Dire Wolves) und
  Optionen einer Einheit (Musician, Standard Bearer, Black Knights of Bretonnia)
  sind **keine** Verweis-Slots: `defId` ist ihre eigene Id, `targetDefId` ist
  `null`.
- **„Manbiters“ ist der Sonderfall**: In den drei Katalogen des Datensatzes gibt
  es dafuer **keinen** Wurzel-`selectionEntry` — die Definition
  `0efb-7f63-7932-0655` liegt in den `<sharedSelectionEntries>` der
  Mercenaries-`.cat` (Zeilen 88–9525, also nicht wurzelnah), und ins Angebot
  kommt sie ausschliesslich ueber den Wurzel-`entryLink e3c2-1778-d3d5-edd1` der
  O&G-`.cat` (Zeile 14896, in `<entryLinks>` 14643–14914). Ihr Slot ist damit ein
  Verweis-Slot: `defId` = der Link, `targetDefId` = `0efb-7f63-7932-0655`. Das
  Manifest benennt ihn ueber `targetDefId`.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **OCS-R1** | **Angebot je Kontingent.** Ein Wurzel-`selectionEntry` des Armeekatalogs, das das Roster nicht enthaelt, bekommt unter dem Kontingent einen Slot `anchorKind=offerAnchor`. Beispiel „Fell Bats“: Basis-Kategorie **Special**, die jedes hier genutzte `forceEntry` traegt. | VC-`.cat`, Wurzel-`<selectionEntries>` (Zeilen 70–13466) → `selectionEntry "Fell Bats"` **`a431-097d-4712-eb01`**, `categoryLink 37e5-5246-afa8-2176 → 43cc-fc3f-35a7-8d03` (Special). Die Einheit selbst traegt **keine** `<constraints>` → `effectiveMin/effectiveMax/headroom = null`, `current = 0`. Weil sie ein Wurzel-`selectionEntry` ist (kein Verweis), ist `defId = a431…` und `targetDefId = null`. |
| **OCS-R2** | **Der Kategorie-Filter ist echt.** Ein Wurzel-Eintrag, dessen Basis-Kategorien das `forceEntry` **nicht** traegt, bekommt **keinen** Angebots-Anker. Beispiel „Manbiters“: einzige Basis-Kategorie ist **Regiment of Renown**. Unter „Clan Blood Dragons“ (traegt `ee09…`) wird es angeboten, unter „Army of the Lichemaster“ (traegt es nicht) nicht. Seine einzige eigene Grenze ist `max 0` → `effectiveMax 0`, `headroom 0` (der Modifikator, der sie auf 1 hebt, verlangt „Allow experimental rules?“ `8b76-92c4-23f9-54b1` im Kontingent — in keinem Roster gewaehlt). Der Slot ist ein **Verweis-Slot**: `defId` = der Wurzel-`entryLink`, `targetDefId` = der verlinkte Eintrag. | Wurzel-`<entryLinks>` der O&G-`.cat` (Zeilen 14643–14914) → `entryLink "Manbiters" e3c2-1778-d3d5-edd1 → 0efb-7f63-7932-0655` (ohne eigene `categoryLinks`). Ziel in Mercenaries-`.cat` (`<sharedSelectionEntries>`): `selectionEntry "Manbiters" 0efb-7f63-7932-0655` mit genau einem `categoryLink dc60-fb87-cc94-ad35 → ee09-9a50-ad78-9c32` und genau einer eigenen Grenze `constraint 30f0-d417-2185-bf4a` `max 0 field=selections scope=parent`. `forceEntry "Clan Blood Dragons (VC-AB)" 5e95-7d57-2b9c-d77d` hat `categoryLink 6948-84bc-be26-e39a → ee09…`; `forceEntry "Army of the Lichemaster (WD#309-UK)" f37a-a93e-fa22-61a8` hat **weder** `ee09…` noch `b640…`. |
| **OCS-R3** | **Angebot unterhalb einer besetzten Auswahl.** Die direkten Optionen der Einheit „Black Knights“ — auch die Mitglieder der constraint-losen Gruppe „Command“ — haengen mit `frameDefId` = **Einheit**. | VC-`.cat` → `selectionEntry "Black Knights" 115c-d87a-35e6-26c9`; darin `selectionEntryGroup "Command" e801-929e-ea87-2f62` (**ohne** `<constraints>`, also kein eigener Gruppen-Anker) mit `"Musician" 472e-27c4-2bb2-a482` (constraint `0d6c-d973-9d3a-efa6` `max 1 scope=parent`) und `"Standard Bearer" 4249-136b-4089-bf98` (constraint `6526-3601-6280-93f9` `max 1 scope=parent`). Beide sind `<selectionEntry>`-Elemente, keine `entryLink`s → `defId` = ihre eigene Id, `targetDefId = null`. |
| **OCS-R4** | **Eine Ebene tiefer gehoert nicht dazu.** Die magischen Standarten sind Optionen des **Standartentraegers**, nicht der Einheit: das Angebot der Einheit stoppt beim ersten Eintrag. | `"Standard Bearer" 4249-136b-4089-bf98` traegt `entryLink 89cb-7891-0f33-2d89 → selectionEntryGroup "Magic Standards" 0937-a1bc-b331-8ce1` (constraint `ffa7-0f2f-7f2e-8781` `max 1 scope=parent`); deren Mitglieder sind u. a. `entryLink "Hell Banner" ae3c-bbc2-0ee8-4ef8 → fb58-1e62-1283-db8c`. |
| **OCS-R5** | **Verborgen wird materialisiert und markiert — auf beiden Ebenen.** (a) Die Aufwertung „Black Knights of Bretonnia“ ist per Basis `hidden="true"` und wird **nur** im Blood-Dragon-Kontingent eingeblendet; als **nicht** gewaehlte Option bleibt sie ein Angebots-Anker (dort mit `isHidden=false`). (b) Umgekehrt der Wurzel-Eintrag „Dire Wolves“: er ist per Basis sichtbar, wird aber in **genau** den beiden hier genutzten Kontingenten verborgen — er bleibt trotzdem im Angebot, mit `isHidden=true`. | (a) `selectionEntry "Black Knights of Bretonnia" 6afd-186f-15da-94e0` (`hidden="true"`), `modifier set hidden=false` mit `condition instanceOf value=1 childId="5e95-7d57-2b9c-d77d" scope=force`; constraint **`082a-e7cc-492d-1091`** `max 1 field=selections scope=parent`. (b) VC-`.cat`, Wurzel-`<selectionEntries>` → `selectionEntry "Dire Wolves" 3c0f-28ce-0807-81fa` (`hidden="false"`, **ohne** eigene `<constraints>`), `categoryLink 333e-ebd4-f9cd-c7f8 → 64bf-efb4-9978-26df` (Core), `modifier set hidden=true` mit `conditionGroup type="or"` aus `instanceOf … childId="f37a-a93e-fa22-61a8"` und `instanceOf … childId="5e95-7d57-2b9c-d77d"`. |
| **OCS-R6** | **Gesperrt wird markiert.** Ist die Bretonnia-Aufwertung gewaehlt (`number=1`), ist ihre Obergrenze aufgebraucht: `current 1`, `headroom 0`, `isBlocked=true`. | dieselbe constraint `082a-e7cc-492d-1091` (`max 1`). |
| **OCS-R7** | **Pflicht schlaegt Angebot.** „Army of Sylvania“ ist ein Wurzel-Eintrag mit **zwei** unerfuellten `min 1`-Grenzen (`scope=force` und `scope=parent`). In jedem Kontingent, in dem er fehlt, ist er darum **kein** Angebots-Anker, sondern ein **Pflicht-Anker** (`anchorKind=mandatoryPhantom`). Weil der Eintrag in diesen Kontingenten effektiv **versteckt** ist (`hidden="true"`, kein greifender Sichtbarkeits-Modifikator), melden seine Min-Grenzen **nicht** (Issue 0088) — das Manifest fordert beide in `expect.absent`. Der Slot traegt die volle Auswertung trotzdem: `current 0`, `effectiveMin 1`, `effectiveMax 1`, `headroom 1`, `isMandatoryUnmet=true`, `isHidden=true`. | VC-`.cat`, Wurzel-`<selectionEntries>` → `selectionEntry "Army of Sylvania" b48b-4a69-80f1-5d47` (`hidden="true"`), `categoryLink ed05-7018-dd55-37b2 → 32f1-197f-d719-a393` (Special list rules); constraints **`1f2f-e5cc-d04d-162e`** `min 1 field=selections scope=force`, **`e23f-0cea-11ac-9376`** `min 1 field=selections scope=parent`, dazu `e574-8cdb-9a8a-e48f` (`max 1 scope=force`) und `9f7d-8853-00c9-4bb1` (`max 1 scope=parent`). Der einzige `set hidden=false`-Modifikator bedingt auf `instanceOf childId="4072-c3b8-84c4-a097"` (Force „Army of Sylvania (SoC)“) — in keinem Roster erfuellt. |
| **OCS-R8** | **Ein Angebots-Anker ist ein Blatt und schweigt.** Weil „Fell Bats“ nur angeboten und nicht besetzt ist, entsteht **unter** ihm gar kein Knoten fuer sein Modell — nichts wertet es aus, also feuert dessen `min 3` nicht. Das ist der Gegensatz zu OCS-R7: dort wird die Grenze voll ausgewertet (und nur wegen der effektiven Verborgenheit nicht gemeldet, Issue 0088), hier schweigt sie, weil die Definition nur *waehlbar* ist. | `selectionEntry "Fell bats" 6dd9-c477-0549-37bb` in `a431-097d-4712-eb01`, constraint **`98c2-b213-2d60-6920`** `min 3 field=selections scope=parent`. Die aeussere Einheit `a431…` traegt selbst keine `min`-Grenze — sie ist damit Angebot, nicht Pflicht. |
| **OCS-R9** | **Kategorie-Anker je `categoryLink` des Kontingents, mit Grenzen und Ist-Stand.** Der Slot gehoert dem `categoryLink` (dessen Id ist sein `defId`), die Kategorie ist sein `targetDefId`; Grenzen und Ist-Stand kommen aus der verlinkten Kategorie. „Heroes“ traegt genau eine, modifikator-freie Grenze `max -1` (Katalogwert fuer *unbegrenzt*) → `effectiveMax = null`; keine `min`-Grenze → `effectiveMin = null`, `headroom = null`; im Roster steht keine Heroes-Auswahl → `current = 0`. „Core“ traegt `min 2`. | `.gst` → `categoryEntry "Heroes" c16b-f319-2c62-2c12`, constraint **`7fca-63fb-63d2-9dad`** `max -1 scope=force`; `categoryEntry "Core" 64bf-efb4-9978-26df`, constraint **`35c2-d478-392a-aeb1`** `min 2 scope=force`. Verlinkt vom Kontingent ueber `categoryLink ca72-6035-08f9-e021` (Heroes) bzw. `f05a-5bc4-7d43-43d0` (Core) im `forceEntry 5e95-7d57-2b9c-d77d` (VC-`.cat` Zeilen 29364/29365), im `forceEntry f37a-a93e-fa22-61a8` ueber `7352-efeb-1090-e8d5` (Heroes, Zeile 29455). Weil dieselbe Kategorie in jedem Kontingent an einer **anderen** Link-Id haengt, benennt das Manifest diese Slots ueber `targetDefId` + `frameDefId`. |
| **OCS-R10** | **`hidden` am Kategorie-Anker ist bedingt, nicht konstant.** Im `forceEntry` „Clan Blood Dragons (VC-AB)“ tragen die `categoryLink`s auf „Mercenaries“ und „Regiment of Renown“ je einen `modifier set hidden=true` unter derselben Bedingung: **mindestens eine** Auswahl von „Black Knights of Bretonnia“ im Kontingent. Haelt sie → `isHidden=true`; haelt sie nicht → `isHidden=false`. Dass der Modifikator am **Link** und nicht an der Kategorie haengt, ist genau der Grund, warum der Slot dem Link gehoert. | `forceEntry 5e95-7d57-2b9c-d77d` → `categoryLink "Mercenaries" 6b8f-90b1-38b5-6e1c → b640-7e9c-3054-c1ce` und `categoryLink "Regiment of Renown" 6948-84bc-be26-e39a → ee09-9a50-ad78-9c32`, beide mit `modifier type="set" field="hidden" value="true"` und `condition type="atLeast" value="1" field="selections" scope="force" childId="6afd-186f-15da-94e0" includeChildSelections="true"`. |

### Warum die Roster die beiden „Allow“-Schalter enthalten

Die **Kategorien selbst** bringen in `Mercenaries (6th definitive edition).cat`
eigene Verberge-Modifikatoren mit: `categoryEntry "Mercenaries" b640-7e9c-3054-c1ce`
setzt `hidden=true`, solange **weniger als 1** Auswahl von „Allow Mercenaries“
(`fda5-49b9-b74c-aaf4`) im Kontingent steht; `categoryEntry "Regiment of Renown"
ee09-9a50-ad78-9c32` ebenso bezogen auf „Allow Regiments of Renown“
(`3d35-6b18-262f-6503`). Beide Schalter sind daher in Roster 01 **und** 02
gesetzt (ueber den Wurzel-`entryLink` `2682-f1d1-ad94-5574` → `"Mercenaries and
Regiments of Renown" 6a7d-7d85-8d7e-cbce` der `.gst`). Damit ist der einzige
Unterschied zwischen 01 und 02 die Bedingung aus **OCS-R10** — der Kontrast
`isHidden true ↔ false` belegt, dass das Flag wirklich bedingt ist.

### Bewusst nicht behauptet

- **`current` des Kategorie-Ankers „Core“.** Im Blood-Dragon-Kontingent
  verschiebt eine `modifierGroup` an `115c-d87a-35e6-26c9` die Kategorie der
  Einheit von *Special* nach *Core* (`set-primary`/`remove`/`add category`,
  bedingt auf `instanceOf childId="5e95-7d57-2b9c-d77d"`). Ob diese Verschiebung
  in den Ist-Stand des Kategorie-Ankers eingeht, ist eine eigene Frage; dieses
  Szenario pinnt an „Core“ deshalb nur `effectiveMin` und `isHidden`, und den
  Ist-Stand ausschliesslich an „Heroes“ (dort unstrittig 0).
- **Die `categoryLink`-Ids als `defId` der Kategorie-Anker.** Die Ids sind
  verifiziert (`6b8f…`, `6948…`, `ca72…`, `f05a…`, `7352…`), das Manifest nennt
  sie aber bewusst nicht: `targetDefId` + `frameDefId` beschreibt denselben Slot
  ohne die je Kontingent wechselnde Link-Id.
- **Grenzen der Kategorien „Special“, „Rare“, „Lord“, „Characters“.** Deren
  Werte haengen im `.gst` an Modifikatoren, die das eingestellte **Punktebudget**
  lesen (`limit::ecfa-8486-4f6c-c249`). Die Roster stellen bewusst kein Budget
  ein; wie ein *unbekanntes* Budget zu lesen ist, ist Gegenstand des Szenarios
  [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) und wird hier
  nicht mit-behauptet. „Heroes“ (`max -1`, ohne Modifikator) und „Core“
  (`min 2`, dessen Modifikatoren erst ab 2000 pts bzw. mit „Border Patrols
  rules“ greifen — beides hier nicht der Fall) sind davon frei.
- **Was *unter* dem Pflicht-Anker „Army of Sylvania“ passiert.** Der Eintrag hat
  ein Pflicht-Kind „Grave markers“ `f899-4fbd-db93-629e` (constraint
  `5c4a-c8ea-073d-909c` `min 2 scope=parent`). Ob ein Pflicht-Anker — anders als
  ein Angebots-Anker — in seine Kinder hinein materialisiert, sagt OCS-R7 nicht;
  das Szenario behauptet darum weder, dass `5c4a…` feuert, noch dass es schweigt.
- **Die Autor-Meldung an „Manbiters“.** Der Eintrag traegt einen
  `modifier type="add" field="error"` („Please enable &quot;Allow experimental
  rules?&quot;“), der hier greift. Autor-Meldungen sind Gegenstand des Szenarios
  [`author-message-severity`](../author-message-severity/README.md); hier wird am
  Manbiters-Slot bewusst kein `authorMessages` behauptet.
- **Die beiden Negativfaelle** (OCS-R2 und OCS-R4) stehen nur als Prosa: das
  Manifest kennt keine Ausdrucksform fuer „dieser Slot existiert nicht“. Sie sind
  unten je konkret benannt und aus dem XML nachpruefbar.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/).

> **Assertion-Fokus:** nur die unten genannten Slots und Constraint-IDs. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Lord-Pflicht des
> Lichemaster-Kontingents, Punktelimit) koennen zusaetzlich auftreten und sind
> hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Verborgene Kategorien + Angebot rundum | Kontingent „Clan Blood Dragons“, beide „Allow“-Schalter, eine Einheit *Black Knights* (5 Modelle, Heavy Armour, Shield, Handweapon, Lance) **mit** der Aufwertung *Black Knights of Bretonnia*. | Die Kategorie-Anker **Mercenaries** und **Regiment of Renown** sind **verborgen** (OCS-R10). **Heroes** ist sichtbar, ohne Ober- und Untergrenze, Ist-Stand 0; **Core** verlangt mindestens 2 (OCS-R9). Die gewaehlte Bretonnia-Aufwertung ist **gesperrt** (1 von 1, kein Spielraum, OCS-R6). *Musician* und *Standard Bearer* haengen als **Angebot an der Einheit** (OCS-R3). *Fell Bats*, *Dire Wolves* und *Manbiters* haengen als **Angebot am Kontingent** (OCS-R1/R2/R5b) — *Dire Wolves* dabei verborgen, *Manbiters* mit aufgebrauchter Obergrenze 0. *Army of Sylvania* ist **kein** Angebot, sondern ein **Pflicht-Anker** — effektiv versteckt, seine `min 1`-Grenzen melden darum nicht (OCS-R7, Issue 0088). Die Modell-Pflicht unter *Fell Bats* feuert ebenfalls nicht (OCS-R8). | [`01-blood-dragon-bretonnia-hidden-categories.ros`](rosters/01-blood-dragon-bretonnia-hidden-categories.ros) |
| 02 | Sichtbare Kategorien (Gegenprobe) | Wie 01, aber **ohne** die Aufwertung *Black Knights of Bretonnia*. | Dieselben Kategorie-Anker sind jetzt **sichtbar** — das `hidden`-Flag ist also bedingt, nicht konstant (OCS-R10). Die weggelassene Aufwertung erscheint als **Angebot an der Einheit**: 0 von 1 gewaehlt, ein Platz frei, sichtbar (OCS-R5a). *Standard Bearer* und der verborgene Wurzel-Eintrag *Dire Wolves* bleiben ebenfalls angeboten. *Army of Sylvania* bleibt Pflicht-Anker, effektiv versteckt und darum ohne Meldung (OCS-R7, Issue 0088). | [`02-blood-dragon-plain-visible-categories.ros`](rosters/02-blood-dragon-plain-visible-categories.ros) |
| 03 | Kategorie-Filter des Angebots | Kontingent „Army of the Lichemaster“ (traegt **keine** Mercenaries-/Regiment-of-Renown-Kategorie), eine Einheit *Skeletons* mit 10 Modellen. | *Fell Bats* (Special) und *Dire Wolves* (Core, hier verborgen) werden weiterhin **angeboten**; *Manbiters* — dessen einzige Basis-Kategorie *Regiment of Renown* ist — **nicht** (OCS-R2, Prosa). Der Heroes-Kategorie-Anker existiert auch hier, sichtbar und ohne Ober-/Untergrenze. *Army of Sylvania* ist auch in diesem Kontingent Pflicht-Anker, effektiv versteckt und darum ohne Meldung (OCS-R7, Issue 0088); die Modell-Pflicht unter *Fell Bats* schweigt weiterhin (OCS-R8). | [`03-lichemaster-offer-category-filter.ros`](rosters/03-lichemaster-offer-category-filter.ros) |

### Die beiden Negativfaelle im Klartext

- **OCS-R2 (Kategorie-Filter).** In Roster 03 darf es **keinen** Slot mit
  `targetDefId = 0efb-7f63-7932-0655` („Manbiters“, benannt ueber das Ziel des
  Wurzel-`entryLink e3c2-1778-d3d5-edd1`) und `frameDefId = f37a-a93e-fa22-61a8`
  geben. Beleg: die einzige Basis-Kategorie
  der Definition ist `ee09-9a50-ad78-9c32`, und das `forceEntry`
  `f37a-a93e-fa22-61a8` listet in seinen `<categoryLinks>` nur
  `4fed…, 32f1…, 7a1c…, 0644…, d024…, c16b…, 64bf…, 43cc…, e94b…`. Die
  Gegenprobe ist maschinell gepinnt: in Roster 01 verlangt das Manifest genau
  diesen Slot unter `frameDefId = 5e95-7d57-2b9c-d77d`, weil jenes `forceEntry`
  den `categoryLink 6948-84bc-be26-e39a → ee09…` traegt.
- **OCS-R4 (eine Ebene tiefer).** In Roster 01 und 02 darf es **keinen** Slot mit
  `defId = fb58-1e62-1283-db8c` („Hell Banner“) und
  `frameDefId = 115c-d87a-35e6-26c9` geben. „Hell Banner“ haengt in der Gruppe
  „Magic Standards“ (`0937-a1bc-b331-8ce1`), die per `entryLink`
  `89cb-7891-0f33-2d89` am **Standartentraeger** `4249-136b-4089-bf98` haengt —
  also eine Option der Option. Maschinell gepinnt ist die positive Haelfte: der
  Standartentraeger selbst ist ein Angebot der Einheit.

Ein dritter Negativfall ist dagegen **maschinell** gepinnt, weil er sich als
schweigende Grenze ausdruecken laesst: `98c2-b213-2d60-6920` (`min 3` am Modell
„Fell bats“) steht in allen drei Rostern in `expect.absent`. Da ein
Angebots-Anker ein Blatt ist, entsteht unter dem nicht gewaehlten „Fell Bats“
ueberhaupt kein Knoten fuer sein Modell — es gibt nichts, was diese Grenze
auswerten koennte (OCS-R8).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Element) |
|---------|-----|---------------------------|
| Force „Clan Blood Dragons (VC-AB)“ | `5e95-7d57-2b9c-d77d` | VC-`.cat` → `<forceEntries>` |
| Force „Army of the Lichemaster (WD#309-UK)“ | `f37a-a93e-fa22-61a8` | VC-`.cat` → `<forceEntries>` |
| `categoryLink` „Mercenaries“ am Blood-Dragon-Force (mit `hidden`-Modifikator; `defId` des Kategorie-Ankers) | `6b8f-90b1-38b5-6e1c` → `b640-7e9c-3054-c1ce` | VC-`.cat` → `forceEntry 5e95…` (Zeile 29368) |
| `categoryLink` „Regiment of Renown“ am Blood-Dragon-Force (mit `hidden`-Modifikator; `defId` des Kategorie-Ankers) | `6948-84bc-be26-e39a` → `ee09-9a50-ad78-9c32` | VC-`.cat` → `forceEntry 5e95…` (Zeile 29377) |
| `categoryLink` „Heroes“ / „Core“ am Blood-Dragon-Force (`defId` der jeweiligen Kategorie-Anker) | `ca72-6035-08f9-e021` / `f05a-5bc4-7d43-43d0` | VC-`.cat` → `forceEntry 5e95…` (Zeilen 29364/29365) |
| `categoryLink` „Heroes“ am Lichemaster-Force (`defId` des dortigen Kategorie-Ankers) | `7352-efeb-1090-e8d5` | VC-`.cat` → `forceEntry f37a…` (Zeile 29455) |
| Kategorie „Heroes“ (Obergrenze *unbegrenzt*; `targetDefId` des Ankers) | `c16b-f319-2c62-2c12` — constraint `7fca-63fb-63d2-9dad` (`max -1`, `scope=force`) | `.gst` → `<categoryEntries>` |
| Kategorie „Core“ (Untergrenze 2; `targetDefId` des Ankers) | `64bf-efb4-9978-26df` — constraint `35c2-d478-392a-aeb1` (`min 2`, `scope=force`) | `.gst` → `<categoryEntries>` |
| Kategorie „Mercenaries“ (eigener `hidden`-Modifikator, **keine** Grenzen; `targetDefId` des Ankers) | `b640-7e9c-3054-c1ce` | Mercenaries-`.cat` → `<categoryEntries>` |
| Kategorie „Regiment of Renown“ (eigener `hidden`-Modifikator, Grenze `max -1` `0b6f-90dd-93f3-373b`; `targetDefId` des Ankers) | `ee09-9a50-ad78-9c32` | Mercenaries-`.cat` → `<categoryEntries>` |
| Schalter-Traeger „Mercenaries and Regiments of Renown“ | `6a7d-7d85-8d7e-cbce`, eingebunden per Wurzel-`entryLink` `2682-f1d1-ad94-5574` | `.gst` → `<sharedSelectionEntries>` / VC-`.cat` → `<entryLinks>` |
| „Allow Regiments of Renown“ / „Allow Mercenaries“ | `3d35-6b18-262f-6503` / `fda5-49b9-b74c-aaf4` | `.gst` → in `6a7d…` |
| Einheit „Black Knights“ | `115c-d87a-35e6-26c9` | VC-`.cat` → Wurzel-`<selectionEntries>` |
| Modell „Black Knights“ (min 5 / max 20, `scope=parent`) | `9252-1ba6-f635-5b22` — `012e-4983-dfb3-fcc4` / `dfcb-c14b-3309-f56b` | in `115c…` |
| Pflicht-Ausruestung der Einheit (je `min 1`/`max 1`, `scope=parent`) | Heavy Armour `d1d2-2653-7ab0-fbb0`, Shield `3667-f990-51ea-d0e4`, Handweapon `8a69-c735-7c76-f588`, Lance `f50b-09b7-e669-69ad` | in `115c…` |
| Aufwertung „Black Knights of Bretonnia“ (`<selectionEntry>`, `hidden="true"`, `max 1 scope=parent`) | `6afd-186f-15da-94e0` — constraint `082a-e7cc-492d-1091` | in `115c…` (Zeile 1409) |
| Gruppe „Command“ (**ohne** `constraints`) | `e801-929e-ea87-2f62` | in `115c…` |
| „Musician“ / „Standard Bearer“ (je `<selectionEntry>` mit `max 1 scope=parent`) | `472e-27c4-2bb2-a482` (`0d6c-d973-9d3a-efa6`) / `4249-136b-4089-bf98` (`6526-3601-6280-93f9`) | in Gruppe `e801…` (Zeilen 1436/1446) |
| Gruppe „Magic Standards“ (eine Ebene tiefer) | `0937-a1bc-b331-8ce1` — constraint `ffa7-0f2f-7f2e-8781`, angehaengt per `entryLink 89cb-7891-0f33-2d89` | VC-`.cat` → `<sharedSelectionEntryGroups>` |
| „Hell Banner“ (Mitglied jener Gruppe) | `fb58-1e62-1283-db8c` (per `entryLink ae3c-bbc2-0ee8-4ef8`) | VC-`.cat` → in `0937…` |
| Einheit „Fell Bats“ (Wurzel-`selectionEntry`, Kategorie Special, **ohne** eigene `constraints`) | `a431-097d-4712-eb01` — `categoryLink 37e5-5246-afa8-2176` | VC-`.cat` → Wurzel-`<selectionEntries>` (Zeile 1558) |
| Modell „Fell bats“ (`min 3 scope=parent`) | `6dd9-c477-0549-37bb` — constraint `98c2-b213-2d60-6920` | in `a431…` |
| Einheit „Dire Wolves“ (Wurzel-`selectionEntry`, Kategorie Core, **ohne** eigene `constraints`, `hidden=true` in `f37a…`/`5e95…`) | `3c0f-28ce-0807-81fa` — `categoryLink 333e-ebd4-f9cd-c7f8 → 64bf…` | VC-`.cat` → Wurzel-`<selectionEntries>` (Zeile 885) |
| „Army of Sylvania“ (Wurzel-`selectionEntry`, `hidden="true"`, **Pflicht**: zwei unerfuellte `min 1`) | `b48b-4a69-80f1-5d47` — `1f2f-e5cc-d04d-162e` (`min 1 force`), `e23f-0cea-11ac-9376` (`min 1 parent`), `e574-8cdb-9a8a-e48f` / `9f7d-8853-00c9-4bb1` (`max 1`) | VC-`.cat` → Wurzel-`<selectionEntries>` (Zeile 10079) |
| Pflicht-Kind „Grave markers“ von „Army of Sylvania“ (bewusst nicht behauptet) | `f899-4fbd-db93-629e` — `5c4a-c8ea-073d-909c` (`min 2 parent`) | in `b48b…` |
| „Manbiters“ (nur Kategorie *Regiment of Renown*, Grenze `max 0 parent`; `targetDefId` des Angebots-Ankers) | `0efb-7f63-7932-0655` — `categoryLink dc60-fb87-cc94-ad35 → ee09…`, constraint `30f0-d417-2185-bf4a` | Mercenaries-`.cat` → `<sharedSelectionEntries>` (Zeile 6552; Abschnitt 88–9525, also **nicht** wurzelnah) |
| Wurzel-`entryLink` auf „Manbiters“ (ohne eigene `categoryLinks`; `defId` des Angebots-Ankers) | `e3c2-1778-d3d5-edd1` → `0efb-7f63-7932-0655` | O&G-`.cat` → `<entryLinks>` (Zeile 14896; Abschnitt 14643–14914) |
| Einheit „Skeletons“ + Modell (Roster 03) | `9ac2-f4c1-bcc3-3aee` / `eaa1-c6a6-9aae-ae9a` | VC-`.cat` → Wurzel-`<selectionEntries>` |
