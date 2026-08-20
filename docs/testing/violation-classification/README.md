# E2E-Regeln & Testkatalog: Einordnung der gemeldeten Meldungen

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind aus
den Katalogdaten der *6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) abgeleitet;
das Eingabeformat der Roster folgt den bereits verifizierten Fixtures
(direktes `entryId`, `entryLinkId=""` bzw. `entryLinkId=<Verweis-Id>` bei
verlinkten Eintraegen, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee (Standard-Datensatz): `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
  (+ die per `catalogueLink` `a067-78d5-50a2-affe` geforderte
  `Mercenaries`-`.cat` `fc47-8392-a6c8-452a`)
- Datensatz-Override der Roster 04/05: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`
- Datensatz-Override der Roster 06/07: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Forces **„Vampire Coast (WD#306-UK)"**
  `bf46-ee85-7c10-ba98` bzw. **„Clan Blood Dragons (VC-AB)"** `5e95-7d57-2b9c-d77d`
  (Roster 07 zusaetzlich mit der O&G-`.cat`, deren Wurzel-`entryLink` auf
  „Manbiters" zeigt — seit Issue 0156 verankert er unter einem
  Vampirfuersten-Kontingent allerdings kein Angebot mehr)

## Worum es geht

Die Meldungsliste des Berichts (weiterhin `violations`) enthaelt zwei Sorten
Meldung, unterschieden durch `origin`:

- **`derivedLimit`** — die Engine hat sie aus einer nicht erfuellten Grenze
  (`<constraint>`) abgeleitet, oder aus ihrer eigenen Budget-Regel
  („Armee teurer als das eingestellte Punktebudget").
- **`authorMessage`** — der Katalog-Autor hat sie geschrieben
  (`modifier type="add" field="error"|"warning"|"info"`, siehe das
  Schwester-Szenario [`author-message-tokens`](../author-message-tokens/README.md)
  und [`author-message-severity`](../author-message-severity/README.md)).

Dieses Szenario nagelt die **Einordnung** der ersten Sorte fest. Eine abgeleitete
Meldung benennt sprachfrei, **was** gemessen wird, **in welchem Bezugsrahmen**,
**an welchem Anker** sie haengt und **warum** der Grenzwert so lautet, wie er
lautet. Alle diese Angaben sind eins zu eins aus den Attributen des
`<constraint>` und aus den auf ihn wirkenden `<modifier>`n ablesbar
([`battlescribe-data-format.md`](../../battlescribe-data-format.md) §7.6/§7.7):

| Feld der Meldung | Woraus es im Katalog folgt |
|------------------|-----------------------------|
| `limitKind` | `constraint/@type` (`min` \| `max`) |
| `measure` | `constraint/@field`: `selections` → `selectionCount`, `forces` → `forceCount`, eine `costType`-Id → `costSum`, `limit::<costType-Id>` → `budgetLimit`. `rosterBudget` ist die einzige Messgroesse ohne Katalog-`constraint` (Engine-Regel, siehe VCC-R6). |
| `costTypeId` | die Kostenart-Id aus `@field` (bei `costSum`/`budgetLimit`) bzw. die Kostenart des Budgets; sonst `null` |
| `isPercent` | `constraint/@percentValue` |
| `scopeKind` / `scopeTargetId` | `constraint/@scope`: die vier Schluesselwoerter `roster`/`force`/`parent`/`self` → gleichnamiges `scopeKind` mit `scopeTargetId = null`; eine **Id** in `@scope` → `categoryId` bzw. `entryId`, je nachdem ob sie eine `<categoryEntry>` oder ein `<selectionEntry>` benennt, und die Id steht in `scopeTargetId` |
| `bound` | der **effektive** `@value` nach allen greifenden Modifikatoren |
| `actual` | der im Roster gezaehlte Ist-Stand unter genau diesem Bezugsrahmen |
| `delta` | immer `bound - actual` — also positiv bei einer unerfuellten Untergrenze, negativ bei einer ueberschrittenen Obergrenze |
| `causes` | die Modifikatoren, die den Grenzwert veraendert haben, sofern ihre Bedingung eine **benennbare Auswahl** nennt (VCC-R7/R8) |
| `severity` | bei `derivedLimit` **immer** `error` |

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **VCC-R1** | **Untergrenze auf eine Kategorie, Bezugsrahmen `force`.** Die Kategorie „Core" verlangt je Kontingent mindestens **2** Auswahlen. Die Meldung ist `limitKind=min`, `measure=selectionCount`, `costTypeId=null`, `scopeKind=force`, `scopeTargetId=null` und haengt an einem **Kategorie-Anker**. | `.gst` → `categoryEntry "Core"` **`64bf-efb4-9978-26df`** → constraint **`35c2-d478-392a-aeb1`** `type="min" value="2" field="selections" scope="force" includeChildSelections="true"`. Verlinkt im Ogre-Kontingent ueber `categoryLink b508-4bfc-bcb0-3f84 → 64bf…` (Ogre-`.cat`, `forceEntry 729f…`). Dass der Anker einer Kategorie-Grenze ein **Kategorie**-Anker ist, ist bereits in [`offer-and-category-slots`](../offer-and-category-slots/README.md) (OCS-R9) und [`ogre-kingdoms`](../ogre-kingdoms/README.md) (OK-R5) festgehalten. |
| **VCC-R2** | **Derselbe Grenzwert, bedingt gesenkt.** Steht „Border Patrols rules" im Roster, setzt ein Modifikator dieselbe Grenze auf **1**. Einordnung und Anker bleiben identisch; nur `bound`/`delta` aendern sich — und es entsteht eine **Ursache** (VCC-R7). | `.gst`, direkt an derselben `categoryEntry`: `modifier type="set" value="1" field="35c2-d478-392a-aeb1"` mit `condition type="atLeast" value="1" field="selections" scope="roster" childId="4e15-0353-165f-5528" includeChildSelections="true" includeChildForces="true"`. Ziel der Bedingung: `.gst` → `selectionEntry name="Border Patrols rules" id="4e15-0353-165f-5528"`. |
| **VCC-R3** | **Obergrenze auf einer belegten Auswahl, Bezugsrahmen `roster`, negativer `delta`.** Der Tyrant darf armeeweit hoechstens **einmal** vorkommen. Bei zwei Tyrants meldet die Engine `limitKind=max`, `measure=selectionCount`, `scopeKind=roster`, `anchorKind=occupied`, `anchorName="Tyrant"`, `actual=2`, `bound=1`, `delta=-1` — und zwar an **jedem** der beiden Anker. Weil an dieser Grenze ueberhaupt kein Modifikator haengt, ist ihr Wert stabil (`isValueUnstable=false`) und sie hat keine Ursache. | Ogre-`.cat` → `selectionEntry "Tyrant"` **`2679-58f4-1771-662d`** → einzige eigene constraint **`cb1c-3389-8f55-d6c6`** `field="selections" scope="roster" value="1" type="max" percentValue="false" includeChildSelections="true" includeChildForces="true"`. Kein `modifier` adressiert diese Id (keine Fundstelle `field="cb1c-3389-8f55-d6c6"` in den Fixtures); der Eintrag traegt auch keinen `field="name"`-Modifikator. |
| **VCC-R4** | **Eine Grenze kann eine KOSTENSUMME messen.** Traegt ein `constraint` als `field` eine **Kostenart-Id** statt `selections`, ist die Messgroesse `costSum`, und `costTypeId` nennt genau diese Kostenart. Die Grenze der Gruppe „Magic Items" erlaubt hoechstens **100** pts; 75 + 50 pts ergeben `actual=125`, `bound=100`, `delta=-25`. | O&G-`.cat` → `selectionEntry "Savage Orc Warboss" ca27-a5f4-4a3e-7aeb` → `selectionEntryGroup "Magic Items"` **`5a4a-5944-51b3-2334`** → constraint **`e008-75cc-80f3-59a7`** `field="ecfa-8486-4f6c-c249" scope="parent" value="100" type="max" percentValue="false"`. Kostenart: `.gst` → `costType id="ecfa-8486-4f6c-c249" name="pts"`. Punktquellen: `entryLink cc2d-39ed-a9f3-31d3 → ad25-b6b2-7eb8-4181` (75 pts) und `deaf-7f7e-b244-8190 → cb89-b525-88ef-79d3` (50 pts). |
| **VCC-R5** | **Eine grenzentragende Gruppe ist der Anker.** Weil `e008…` an der `selectionEntryGroup` haengt und nicht an einer Einheit, ist `anchorKind=groupAnchor` mit `anchorName="Magic Items"` (dem `name` der Gruppe; kein `field="name"`-Modifikator wirkt darauf). | dieselbe Gruppe `5a4a-5944-51b3-2334`. Dass eine grenzentragende Gruppe einen eigenen Anker bekommt, ist bereits in [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R2) und [`offer-and-category-slots`](../offer-and-category-slots/README.md) (OCS-R3, „Command" **ohne** `constraints` → **kein** Gruppen-Anker) belegt. |
| **VCC-R6** | **`rosterBudget` ist die einzige Messgroesse ohne Katalog-`constraint`.** Uebersteigt die verplante Punktsumme das per `<costLimits>` eingestellte Budget, meldet die Engine ihre eigene Regel: `measure=rosterBudget`, `anchorKind=roster` (sie haengt an keinem Slot), `scopeKind=roster`, `costTypeId` = die Kostenart des Budgets, `limitKind=max`. 30 Orc-Boyz-Modelle a 5 pts = 150 pts gegen ein Budget von 100 → `delta=-50`. | Grenz-Id **`budget::ecfa-8486-4f6c-c249`**, abgeleitet aus der Kostenart-Id und dem `<costLimits>`-Wert der Roster (bereits in [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), OGB-R2, festgenagelt). Punktquelle: O&G-`.cat` → `selectionEntry "Orc Boyz" (model)` `cef0-77ce-8158-32d4` mit `cost name="pts" value="5"`, in der Einheit `ac23-b9d3-4046-23b7`. |
| **VCC-R7** | **Eine Ursache wird aus der Herleitung gelesen, nicht erfunden.** Hat ein `modifier` (a) Bedingungen, (b) den Zahlenwert tatsaechlich veraendert und (c) nennt seine Bedingung ueber `childId` eine **benennbare Auswahl** (ein `selectionEntry`/`entryLink`, gezaehlt mit `field="selections"`, und im Roster wirklich vorhanden), traegt die Meldung genau eine `causes`-Zeile: `witnessDefId` = jene Id, `witnessName` = deren Katalog-`name`, `modifierKind` = `modifier/@type`, `value` = der so entstandene Zwischenwert. | Der `set 1` aus VCC-R2: `modifierKind="set"`, `value=1`, `witnessDefId="4e15-0353-165f-5528"`, `witnessName="Border Patrols rules"` (der `name` des `.gst`-Eintrags, mit gewoehnlichen Leerzeichen). Dieses Muster ist das haeufigste der Fixtures — dieselbe Bedingung schaltet u. a. auch `a4ac-f983-c92f-457c` (Gnoblars-Modell, `set 25`) und `9eae-88c9-5c5d-8a07` (Manbiters-Modell, `set 25`). |
| **VCC-R8** | **Kein Kandidat → gar keine Ursache.** Ohne bedingten Modifikator (VCC-R1, VCC-R3, VCC-R4), bei einer Bedingung auf eine **Kostenschwelle** (`field="limit::<costType-Id>"`) oder auf ein **`forceEntry`** (`instanceOf`) bleibt die Liste leer. Das Manifest fordert das als `"causes": []` — eine **vollstaendige** Aussage. | (a) VCC-R1: die uebrigen Core-Modifikatoren `set 3`/`set 4`/`set 5`/`set 6` lesen `limit::ecfa-8486-4f6c-c249` und verlangen zusaetzlich `lessThan 1` von `4e15…` — bei nicht gesetztem Budget greift keiner, und die einzige selektionsbezogene Teilbedingung zaehlt einen **abwesenden** Eintrag. (b) VCC-R9: der `set 2000` haengt an `condition type="instanceOf" … childId="bf46-ee85-7c10-ba98"` — das ist ein **`forceEntry`**, kein `selectionEntry`. |
| **VCC-R9** | **Eine Grenze kann das BUDGET der Roster messen.** Traegt `field` das Praefix `limit::`, ist die Messgroesse `budgetLimit` (nicht `costSum`): gemessen wird nicht, was die Armee kostet, sondern worauf das Budget eingestellt ist. Das `forceEntry` „Vampire Coast" verlangt so ein Budget von mindestens **2000** pts; bei eingestellten 1000 pts → `limitKind=min`, `actual=1000`, `bound=2000`, `delta=1000`. | VC-`.cat` → `forceEntry "Vampire Coast (WD#306-UK)"` **`bf46-ee85-7c10-ba98`** → constraint **`f3aa-b530-9b6c-0995`** `type="min" value="0" field="limit::ecfa-8486-4f6c-c249" scope="roster" includeChildSelections="true" includeChildForces="true"`, gehoben durch `modifier type="set" value="2000" field="f3aa-b530-9b6c-0995"` mit `condition type="instanceOf" value="1" field="selections" scope="force" childId="bf46-ee85-7c10-ba98"`. Das Muster ist in [`battlescribe-data-format.md`](../../battlescribe-data-format.md) §5.6 („eigenes Punktelimit") beschrieben. |
| **VCC-R10** | **Die Min-Grenzen eines effektiv versteckten Pflicht-Ankers melden nicht.** „Army of Sylvania" ist ein Wurzel-Eintrag mit je einer unerfuellten `min 1`-Grenze in **force**- und in **parent**-Reichweite — und im Blood-Dragon-Kontingent effektiv **versteckt** (`hidden="true"`, der einzige Sichtbarkeits-Modifikator bedingt auf ein anderes Kontingent). Per Projektentscheidung (Issue 0088, `battlescribe-data-format.md` §5.6) erzeugt keine der beiden Min-Grenzen eine Meldung; das Manifest fordert beide als abwesend (`expect.absent` plus `count: 0`-Meldungspins). *Urspruenglich pinnte dieses Roster hier den `scopeKind`-Beleg (`force` vs. `parent` am selben Anker); der ist mit der Verborgenheits-Regel aus diesem Roster nicht mehr zu gewinnen.* | VC-`.cat`, Wurzel-`<selectionEntries>` → `selectionEntry "Army of Sylvania"` **`b48b-4a69-80f1-5d47`** (`hidden="true"`) mit constraints **`1f2f-e5cc-d04d-162e`** (`min 1`, `scope="force"`) und **`e23f-0cea-11ac-9376`** (`min 1`, `scope="parent"`); die uebrigen beiden sind `max 1` (`e574-8cdb-9a8a-e48f` / `9f7d-8853-00c9-4bb1`). Der einzige Modifikator des Eintrags setzt `hidden` — **kein** Constraint-Modifikator, also `causes: []`. |
| **VCC-R11** | **Was nur angeboten oder gar nicht erreichbar ist, schweigt in der Meldungsliste.** Weder die Autor-Meldung des Mercenaries-Eintrags „Manbiters" noch dessen `max 0` erscheinen dort — „Manbiters" ist im Blood-Dragon-Kontingent seit Issue 0156 ueberhaupt nicht mehr angeboten, weil der einzige Wurzel-`entryLink` darauf in der **O&G**-`.cat` steht und ein fremdes Armeebuch kein Angebot mehr verankert. Ebenso wenig steuert ein Angebot eine abgeleitete Grenze bei: das zeigt die Gegenprobe am nur angebotenen „Fell Bats". | Mercenaries-`.cat` → `selectionEntry "Manbiters"` **`0efb-7f63-7932-0655`** mit `modifier type="add" value="Please enable &quot;Allow experimental rules?&quot;" field="error"` und `condition type="lessThan" value="1" field="selections" scope="force" childId="8b76-92c4-23f9-54b1"`, dazu constraint **`30f0-d417-2185-bf4a`** (`max 0`, `scope="parent"`). Der einzige Wurzel-`entryLink` darauf ist der O&G-eigene `e3c2-1778-d3d5-edd1`; dass er unter einem Vampirfuersten-Kontingent kein Angebot mehr verankert, haelt [`offer-and-category-slots`](../offer-and-category-slots/README.md) (OCS-R2) fest. Gegenprobe fuer die abgeleitete Haelfte: **`98c2-b213-2d60-6920`** (`min 3`, `scope="parent"`) am Modell `6dd9-c477-0549-37bb` unterhalb des ebenfalls nur angebotenen „Fell Bats" `a431-097d-4712-eb01` (OCS-R8). |

### Was dieses Szenario bewusst NICHT behauptet

- **`anchorKind` der Budget-Grenze aus VCC-R9.** `f3aa-b530-9b6c-0995` haengt am
  **`forceEntry`** selbst. Die Aufzaehlung der Ankerarten
  (`occupied`/`mandatoryPhantom`/`groupAnchor`/`categoryAnchor`/`offerAnchor`/`roster`)
  kennt keine Art fuer „das Kontingent"; `roster` ist laut Vertrag der
  Budget-Regel aus VCC-R6 vorbehalten. Aus den Katalogdaten laesst sich nicht
  entscheiden, welcher Anker die Meldung traegt — Roster 06 pinnt deshalb alles
  ausser `anchorKind`/`anchorName`.
- **`isValueUnstable`** wird nur dort behauptet, wo die Katalogdaten es eindeutig
  hergeben: an der Tyrant-Grenze (VCC-R3), auf die kein einziger Modifikator
  zeigt. Ueberall sonst (insbesondere in den Rostern ohne `<costLimits>`, wo die
  budget-lesenden Core-Modifikatoren nicht aufloesen koennen — vgl.
  [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), OGB-R3)
  bleibt das Feld unbehauptet.
- **Der Kategorie-Anker als `anchorDefId`.** Der Slot einer Kategorie-Grenze
  gehoert dem `categoryLink` (OCS-R9), dessen Id je Kontingent verschieden ist
  (hier `b508-4bfc-bcb0-3f84`). Roster 01/02 waehlen die Meldung deshalb ueber
  `limitId` und behaupten nur `anchorKind`.
- **Weitere Verletzungen der Roster.** Ueber die genannten Ids hinaus duerfen
  beliebige weitere Grenzen feuern (General-Pflicht, Lord-Pflicht des
  Vampire-Coast-Kontingents, die Pflicht-Ausruestung des Savage Orc Warboss,
  die `max 0`-Grenzen der Sondercharaktere) — die Erwartung ist selektiv.

### Luecken: Was die Fixture-Daten NICHT hergeben

Drei Auspraegungen der Einordnung lassen sich mit diesen vier Katalogen **nicht**
als feuernde Meldung erzeugen. Sie sind hier dokumentiert statt geraten:

| Auspraegung | Befund in den Fixture-Daten |
|-------------|------------------------------|
| `measure: "forceCount"` | **Kein einziges** `<constraint field="forces" …>` in `.gst`, Ogre-, O&G-, VC- und Mercenaries-`.cat`. |
| `isPercent: true` | **Kein einziges** Element mit `percentValue="true"`; jedes Vorkommen des Attributs lautet `percentValue="false"`. Alle Roster behaupten deshalb `isPercent: false`. |
| `scopeKind: "entryId"` | Es gibt genau **vier** `constraint`s mit einer Id in `@scope` — `6afc-566e-34d4-d35c`, `eafe-0b69-c4eb-55e1`, `6d41-0ff2-892c-993f`, `6681-a071-a9f8-4146` (VC-`.cat`, je an einer „Mounts"-Gruppe) — und **alle vier** nennen dieselbe Id `bf30-4ff0-a4d8-3909`, die eine `<categoryEntry>` („Strigoi") ist. Ein `selectionEntry` als `@scope` kommt nicht vor. |
| `scopeKind: "categoryId"` (feuernd) | Dieselben vier Grenzen sind `max 0` und haengen an Charakteren (Master Necromancer, Wight Lord, Wraith, Necromancer), die die Kategorie „Strigoi" nie tragen. Sie **feuern** zu lassen wuerde verlangen, sich die Zaehl-Semantik eines Kategorie-Bezugsrahmens auszudenken — genau das, was die Black-Box-Rolle verbietet. Die **Gegenprobe** (die Grenze darf nicht faelschlich feuern) ist bereits in [`category-scope-bug`](../category-scope-bug/README.md) festgenagelt. |
| `scopeKind: "self"` | Genau **ein** `constraint` mit `scope="self"` in allen Fixtures: `714b-5314-33d4-dd68` (`max 1 field="selections"` an „Allow Mercenaries" `fda5-49b9-b74c-aaf4`, `.gst` Zeile 2354). Ob `field="selections"` unter `scope="self"` die Auswahl selbst oder ihre Kinder zaehlt, sagt weder die Format-Spezifikation noch die `Catalogue.xsd` (dort ist `scope` schlicht `xs:string`, ohne Aufzaehlung). Ohne diese Festlegung laesst sich kein Roster bauen, von dem sich sagen liesse, dass die Grenze feuert. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Roster 01–03
laufen gegen `.gst` + Ogre-`.cat` (+ Mercenaries), Roster 04/05 gegen
`.gst` + O&G-`.cat` (+ Mercenaries), Roster 06/07 gegen `.gst` + VC-`.cat`
(+ O&G bei 07, + Mercenaries) — jeweils per **Roster-Dataset-Override**.

> **Assertion-Fokus:** ausschliesslich die unten genannten Grenz-Ids und die
> daran haengenden Meldungsfelder. Andere Armeeaufbau-Diagnosen treten
> zusaetzlich auf und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kategorie-Untergrenze, Basiswert | Ogre-Kontingent **ohne jede Auswahl**, **ohne** `<costLimits>`. | **VCC-R1 + VCC-R8:** Genau eine Meldung zu `35c2…`: abgeleitet, Schweregrad `error`, Mindestmass auf einer **Anzahl von Auswahlen**, Bezugsrahmen **Kontingent**, Anker die **Kategorie**, Ist **0** von **2**, Differenz **+2** — und **ohne** Ursache, weil der Basiswert unveraendert ist. | [`01-core-min-base.ros`](rosters/01-core-min-base.ros) |
| 02 | Dieselbe Grenze, gesenkt — mit Ursache | Dasselbe Kontingent **plus** „Border Patrols rules" (`4e15…`). | **VCC-R2 + VCC-R7:** Dieselbe Meldung, dieselbe Einordnung, aber Grenze **1** statt 2, Differenz **+1** — und **genau eine** Ursache, die die ausloesende Auswahl beim Namen nennt („Border Patrols rules"), samt Art des Modifikators (`set`) und dem entstandenen Zwischenwert (`1`). | [`02-core-min-lowered-by-border-patrols.ros`](rosters/02-core-min-lowered-by-border-patrols.ros) |
| 03 | Obergrenze an einer belegten Auswahl | **Zwei** Tyrants im selben Kontingent. | **VCC-R3:** `cb1c…` meldet **zweimal** (je Tyrant einmal): Hoechstmass auf einer Anzahl von Auswahlen, Bezugsrahmen **Armee**, Anker die **belegte Auswahl** mit Namen „Tyrant", Ist **2** von **1**, Differenz **−1** (negativ, weil ueberschritten), Wert **stabil**, **ohne** Ursache. | [`03-two-tyrants-max.ros`](rosters/03-two-tyrants-max.ros) |
| 04 | Grenze auf einer Kostensumme | Savage Orc Warboss mit zwei magischen Waffen (75 + 50 pts). | **VCC-R4 + VCC-R5:** `e008…` meldet eine **Kostensumme** (nicht eine Stueckzahl) und nennt die Kostenart **pts**; Bezugsrahmen **Elternauswahl**, Anker die **grenzentragende Gruppe** „Magic Items", Ist **125** von **100**, Differenz **−25**, **ohne** Ursache. | [`04-magic-items-cost-sum.ros`](rosters/04-magic-items-cost-sum.ros) |
| 05 | Armee teurer als das Budget | 30 Orc-Boyz-Modelle (150 pts) bei Budget **100 pts**. | **VCC-R6:** `budget::ecfa-8486-4f6c-c249` meldet die **engine-eigene** Budget-Regel: Messgroesse **Roster-Budget**, Anker **die Roster selbst** (kein Slot), Kostenart **pts**, Ist **150** von **100**, Differenz **−50**, **ohne** Ursache. | [`05-roster-budget-exceeded.ros`](rosters/05-roster-budget-exceeded.ros) |
| 06 | Grenze auf dem eingestellten Budget | Leeres Kontingent „Vampire Coast", Budget **1000 pts**. | **VCC-R9 + VCC-R8:** `f3aa…` misst nicht die Kosten, sondern das **eingestellte Budget**: Mindestmass **2000**, Ist **1000**, Differenz **+1000**, Kostenart **pts**, Bezugsrahmen **Armee** — und **ohne** Ursache, obwohl der hebende Modifikator eine Bedingung hat: die zielt auf ein **Kontingent**, nicht auf eine benennbare Auswahl. | [`06-vampire-coast-budget-limit.ros`](rosters/06-vampire-coast-budget-limit.ros) |
| 07 | Versteckter Pflicht-Anker schweigt, Angebots-Anker schweigt | Kontingent „Clan Blood Dragons" nur mit den beiden „Allow"-Schaltern. | **VCC-R10:** Der effektiv versteckte Pflicht-Anker „Army of Sylvania" erzeugt **keine** Meldung aus seinen beiden unerfuellten Min-Grenzen (`1f2f…`, `e23f…` je **null**mal; Issue 0088). **VCC-R11:** Die Meldungsliste enthaelt **weder** die Autor-Meldung von „Manbiters" **noch** eine Grenze aus einem blossen Angebot (`30f0…`, `98c2…` je **null**mal) — „Manbiters" selbst wird hier seit Issue 0156 gar nicht mehr angeboten. | [`07-phantom-and-offer.ros`](rosters/07-phantom-and-offer.ros) |

### Wie `actual` / `bound` / `delta` hier zustande kommen

`bound` ist der **effektive** Grenzwert nach Modifikatoren, `actual` der Ist-Stand
unter dem Bezugsrahmen des `constraint`, `delta` immer ihre Differenz
`bound - actual`. Die Tabelle ist die Herleitung, nicht selbst eine Assertion:

| Roster | Grenze | Basiswert | greifender Modifikator | `bound` | Zaehlung im Roster | `actual` | `delta` |
|--------|--------|-----------|------------------------|---------|--------------------|----------|---------|
| 01 | `35c2…` `min` | 2 | keiner | 2 | 0 Core-Auswahlen im Kontingent | 0 | +2 |
| 02 | `35c2…` `min` | 2 | `set 1` (Border Patrols rules) | 1 | 0 Core-Auswahlen im Kontingent | 0 | +1 |
| 03 | `cb1c…` `max` | 1 | keiner | 1 | 2 Tyrant-Auswahlen in der Armee | 2 | −1 |
| 04 | `e008…` `max` | 100 | keiner | 100 | 75 + 50 pts unter dem Warboss | 125 | −25 |
| 05 | `budget::…` `max` | — | — | 100 (aus `<costLimits>`) | 30 × 5 pts | 150 | −50 |
| 06 | `f3aa…` `min` | 0 | `set 2000` (Kontingent-Instanz) | 2000 | `<costLimits>` = 1000 | 1000 | +1000 |
| 07 | `1f2f…` / `e23f…` `min` | 1 / 1 | keiner | 1 / 1 | 0 Auswahlen von `b48b…` | 0 / 0 | +1 / +1 |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Element) |
|---------|-----|---------------------------|
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` | Ogre-`.cat` → `<forceEntries>` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` | O&G-`.cat` → `<forceEntries>` |
| Force „Vampire Coast (WD#306-UK)" | `bf46-ee85-7c10-ba98` | VC-`.cat` → `<forceEntries>` |
| Force „Clan Blood Dragons (VC-AB)" | `5e95-7d57-2b9c-d77d` | VC-`.cat` → `<forceEntries>` |
| Kategorie „Core" + Untergrenze `min 2 scope=force` | `64bf-efb4-9978-26df` / `35c2-d478-392a-aeb1` | `.gst` → `<categoryEntries>` |
| `categoryLink` „Core" im Ogre-Kontingent | `b508-4bfc-bcb0-3f84` → `64bf-efb4-9978-26df` | Ogre-`.cat` → `forceEntry 729f…` |
| „Border Patrols rules" (Ursachen-Zeuge, `name` mit gewoehnlichen Leerzeichen) | `4e15-0353-165f-5528` | `.gst` → Wurzel-`<selectionEntries>` |
| Tyrant + Obergrenze `max 1 scope=roster` (modifikatorfrei) | `2679-58f4-1771-662d` / `cb1c-3389-8f55-d6c6` | Ogre-`.cat` → Wurzel-`<selectionEntries>` |
| Savage Orc Warboss / Gruppe „Magic Items" / Grenze `max 100 pts scope=parent` | `ca27-a5f4-4a3e-7aeb` / `5a4a-5944-51b3-2334` / `e008-75cc-80f3-59a7` | O&G-`.cat` |
| Magische Waffen 75 / 50 pts (`entryLink` → Ziel) | `cc2d-39ed-a9f3-31d3` → `ad25-b6b2-7eb8-4181` / `deaf-7f7e-b244-8190` → `cb89-b525-88ef-79d3` | O&G-`.cat` → Gruppe `6d5f-aed3-1c41-d305` |
| Kostenart „pts" | `ecfa-8486-4f6c-c249` | `.gst` → `<costTypes>` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` | keine Katalogquelle — siehe VCC-R6 |
| Orc Boyz (Einheit / Modell a 5 pts) | `ac23-b9d3-4046-23b7` / `cef0-77ce-8158-32d4` | O&G-`.cat` |
| Eigenes Punktelimit des Vampire-Coast-Kontingents (`field="limit::…"`) | `f3aa-b530-9b6c-0995` (`min 0` → `set 2000`) | VC-`.cat` → `forceEntry bf46…` |
| „Army of Sylvania" (Pflicht-Anker) + beide `min 1` | `b48b-4a69-80f1-5d47` — `1f2f-e5cc-d04d-162e` (force) / `e23f-0cea-11ac-9376` (parent) | VC-`.cat` → Wurzel-`<selectionEntries>` |
| „Manbiters" (Autor-Meldung + `max 0`; seit Issue 0156 in diesem Kontingent kein Anker mehr) | `0efb-7f63-7932-0655` — `30f0-d417-2185-bf4a` | Mercenaries-`.cat` → `<sharedSelectionEntries>` |
| Wurzel-`entryLink` auf „Manbiters" (fremdes Armeebuch — verankert im VC-Kontingent kein Angebot) | `e3c2-1778-d3d5-edd1` → `0efb-7f63-7932-0655` | O&G-`.cat` → `<entryLinks>` |
| „Allow experimental rules?" (Schalter der Manbiters-Meldung) | `8b76-92c4-23f9-54b1` | `.gst` |
| „Fell Bats" / Modell „Fell bats" + `min 3 scope=parent` (Gegenprobe) | `a431-097d-4712-eb01` / `6dd9-c477-0549-37bb` — `98c2-b213-2d60-6920` | VC-`.cat` → Wurzel-`<selectionEntries>` |
| Schalter-Traeger „Mercenaries and Regiments of Renown" (+ Wurzel-`entryLink`) | `6a7d-7d85-8d7e-cbce` / `2682-f1d1-ad94-5574` | `.gst` / VC-`.cat` → `<entryLinks>` |
| „Allow Regiments of Renown" / „Allow Mercenaries" | `3d35-6b18-262f-6503` / `fda5-49b9-b74c-aaf4` | `.gst` → in `6a7d…` |
| `catalogueLink` Ogre → Mercenaries / VC → Mercenaries | `a067-78d5-50a2-affe` / `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` | Ogre-`.cat` / VC-`.cat` |
| Nur als Luecke dokumentiert: Kategorie-Bezugsrahmen „Strigoi" | `bf30-4ff0-a4d8-3909` — `6afc-566e-34d4-d35c`, `eafe-0b69-c4eb-55e1`, `6d41-0ff2-892c-993f`, `6681-a071-a9f8-4146` | VC-`.cat` |
| Nur als Luecke dokumentiert: einziges `scope="self"` | `714b-5314-33d4-dd68` an `fda5-49b9-b74c-aaf4` | `.gst` |
