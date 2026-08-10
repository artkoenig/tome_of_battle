# E2E-Regeln & Testkatalog: `atLeast … childId="model" scope="self"` — der Träger ist der Rahmen

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an **echten Beispiel-Dateien** bestehender Szenarien verifiziert
(`../entrylink-raw-type-counting/rosters/01-two-direct-units-silent.ros`:
direktes `entryId`, kein `entryLinkId`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard (VC-AB)"** `e989-15b8-7eb6-9668`
- Zusatz: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`),
  von Vampire Counts per `catalogueLink` `ef73-f9bd-e250-54d2` eingebunden
  (Abhängigkeit des Datensatzes, im Szenario sonst ungenutzt).

## Worum es geht: `scope="self"` zählt den Träger, nicht seine Umgebung

Eine `condition` mit `type="atLeast" field="selections" childId="model"` und
`scope="self"` fragt: *„Trägt die Auswahl, an der ich hänge, mindestens `value`
Modelle?"* Drei Aussagen stecken darin, und alle drei sind aus den Daten
ablesbar (`docs/battlescribe-data-format.md` §7.7 und §13.2):

1. **Was gezählt wird** — `childId` trägt kein Ziel, sondern das **Typ-Keyword**
   `model`: gezählt werden Auswahlen, deren (ggf. über einen `entryLink` geerbter)
   roher `type` `model` ist. `field="selections"` macht daraus eine Stückzahl.
2. **In welchem Rahmen** — `scope="self"` ist der **Träger der Query selbst**,
   also die Auswahl, an deren Modifikator die Bedingung hängt. Nicht das
   Kontingent (`force`), nicht das Roster (`roster`), nicht die Elternauswahl
   (`parent`). Mit `includeChildSelections="true"` zählen auch tiefer
   verschachtelte Auswahlen unterhalb des Trägers mit.
3. **Wann sie hält** — `atLeast` ist **einschließlich**: Ist = `value` genügt,
   Ist = `value − 1` genügt nicht. Der Schwellenwert selbst ist damit der
   stärkste Zeuge.

Das Konstrukt kommt in den Fixture-Katalogen **32×** vor (15× Orcs and goblins,
14× Vampire Counts, 3× Ogre Kingdoms) und **immer** in derselben Gestalt: als
erste Bedingung einer `conditionGroup type="and"`, die den Modifikator
`add category 6ad6-f54e-1867-00a7` („BP Infantry 10+") gattert; zweite Bedingung
ist stets `atLeast 1 childId="4e15-0353-165f-5528" scope="roster"`. Dieses
Szenario hält die zweite Bedingung über alle Roster **konstant** (jedes Roster
führt „Border Patrols rules") und variiert allein die Modellzahl des Trägers.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ASMC-R1** | Der Träger `Ghouls` erhält die Kategorie „BP Infantry 10+", wenn er **mindestens 10 Modelle** führt **und** das Roster „Border Patrols rules" enthält. Beide Bedingungen stehen in einer `and`-Gruppe, halten müssen also beide. | VC-`.cat` → `selectionEntry type="unit"` „Ghouls" `6b45-b2ad-dcdf-d3f4` (Zeile 713) → `modifier type="add" value="6ad6-f54e-1867-00a7" field="category"` (Zeile 808) → `conditionGroup type="and"` mit `condition type="atLeast" value="10" field="selections" scope="self" childId="model" shared="true" includeChildSelections="true"` (Zeile 813) **und** `condition type="atLeast" value="1" field="selections" scope="roster" childId="4e15-0353-165f-5528" includeChildForces="true"` (Zeile 814). |
| **ASMC-R2** | Der Zählrahmen ist der **Träger**: gezählt werden nur die Modelle *dieser* Ghouls-Einheit. Modelle anderer Einheiten desselben Kontingents zählen **nicht** mit — auch dann nicht, wenn sie in Summe die Schwelle erreichen. | Ebd., `scope="self"`. Formatspezifikation `docs/battlescribe-data-format.md` §7.6 (Scope-Aufzählung: `self` neben `parent`/`force`/`roster`/`unit`) und §7.7 (der `scope` bestimmt den Bezugsrahmen der Zählung). |
| **ASMC-R3** | Die Schwelle ist **einschließlich**: 10 Modelle genügen, 9 nicht. | Ebd., `type="atLeast" value="10"`. Vergleichstypen-Tabelle §13.1: `atLeast` ist die untere Schranke mit Gleichheit (im Gegensatz zu `greaterThan`). |
| **ASMC-R4** | Gezählt wird der **rohe `type`** der Kindauswahlen: das Kind `Ghouls` (`c11f-8aaf-5c69-4066`, `type="model"`) zählt mit seiner `number`, das Kind `Handweapon` (`38ed-0cf0-ac63-31f5`, `type="upgrade"`) **nicht**. | VC-`.cat` → Kinder von `6b45…`: `selectionEntry type="model"` `c11f-8aaf-5c69-4066` (Zeile 725), `selectionEntry type="upgrade"` `38ed-0cf0-ac63-31f5` (Zeile 736). Format §13.2: `childId` = Typ-Keyword `model`/`unit`/`upgrade`. |
| **ASMC-R5** | Die gegatterte Wirkung ist eine **Kategoriezugehörigkeit**, keine zählende Grenze. Beobachtbar wird sie über die **Autor-Meldung** des Spielsystems, die genau diese Kategorie kontingentweit zählt: fehlt sie, meldet der Katalogautor *„You must include at least ONE infantry unit of 10+ models."* (Schweregrad *error*). | `.gst` → `selectionEntry type="upgrade"` „Border Patrols rules" `4e15-0353-165f-5528` (Zeile 17584) → `modifier type="add" field="error"` (Zeile 17611) mit `condition type="lessThan" value="1" field="selections" scope="force" childId="6ad6-f54e-1867-00a7" includeChildSelections="true"`. Die Kategorie selbst (`.gst` Zeile 796, `categoryEntry name="BP Infantry 10+" hidden="true"`) trägt **keine** `constraints`. |
| **ASMC-R6** | „Border Patrols rules" ist per Basis verborgen und wird sichtbar, wenn das Punktelimit des Rosters **genau 500** beträgt. Alle Roster tragen deshalb `costLimit` 500. | `.gst` → `4e15…` → `modifier type="set" value="false" field="hidden"` mit `condition type="equalTo" value="500" field="limit::ecfa-8486-4f6c-c249" scope="roster"` (Zeile 17595–17597). |
| **ASMC-R7** | Am selben Slot hängt eine **zweite** Autor-Meldung: die Force muss 2–4 Auswahlen vom Rohtyp `unit` enthalten. Alle Roster dieses Szenarios führen genau **zwei** Einheiten, damit diese Meldung kontrolliert still bleibt und die Beobachtung nicht stört. | `.gst` → `4e15…` → `modifier add error` „The army must consist of at least TWO units but no more than FOUR units" mit `conditionGroup or`: `greaterThan 4` bzw. `lessThan 2`, je `field="selections" scope="force" childId="unit" includeChildSelections="false"` (Zeile 17600–17610). |
| **ASMC-R8** | Die Modellzahl darf zwischen 5 und 20 frei variieren, ohne eine Grenze des Trägers zu reißen; die Pflichtausrüstung „Handweapon" ist auf **genau 2** festgenagelt und bleibt in allen Rostern konstant. | VC-`.cat` → `c11f-8aaf-5c69-4066` → constraints `8e34-4788-81a6-74f2` `min 5 scope="parent"` und `f257-5a4e-76a2-4fe3` `max 20 scope="parent"` (Zeile 727–728); `38ed-0cf0-ac63-31f5` → constraints `ef46-30ad-181b-49c4` `min 2` und `d07c-fd6a-46ed-ab4e` `max 2`, je `scope="parent"` (Zeile 738–739). |

**Warum keine `firing`-Limit-IDs für die Regel selbst:** In den Fixtures trägt
**kein** `constraint` ein `childId` — die Typ-Keyword-Zählung existiert
ausschließlich in `condition`s. Die Wirkung dieser Bedingung ist zudem ein
`add category` auf eine Kategorie **ohne** eigene Grenzen (ASMC-R5). Als
zählende Grenze ist die Regel also grundsätzlich nicht beobachtbar; der
Manifest-Vertrag bietet dafür `expect.messages` mit `origin: "authorMessage"`,
und genau darüber wird sie hier gepinnt — mit `count` als Ja/Nein-Aussage je
Roster. Die `absent`-Liste jedes Rosters führt dagegen die vier Grenzen des
Trägers (ASMC-R8) und belegt, dass die variierte Modellzahl **keine** von ihnen
reißt.

**Nicht prüfbare Facette (bewusst ausgelassen):** Die Aussage „der Rahmen ist der
Träger, **nicht die umschließende Einheit**" lässt sich an diesem Datensatz
nicht von der Aussage „…nicht das Kontingent" trennen: alle geprüften Träger des
Konstrukts sind selbst `selectionEntry type="unit"`, dort fallen `scope="self"`
und `scope="unit"` (§7.7: nächster Vorfahre mit `type="unit"`, den Träger
**eingeschlossen**) zusammen. Gepinnt wird deshalb die Abgrenzung gegen
`force`/`roster`/`parent` (Roster 02 und 03); die Abgrenzung gegen `unit` wäre
nur mit einem Träger unterhalb einer Einheit zu zeigen, den die Fixtures für
dieses Konstrukt nicht hergeben.

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + VC-`.cat` + Mercenaries-`.cat`, alle tragen `costLimit`
500 (ASMC-R6), alle führen „Border Patrols rules" (zweite Bedingung der
`and`-Gruppe, konstant gehalten) und alle bestehen aus genau **zwei**
Ghouls-Einheiten mit je 2× „Handweapon" (ASMC-R7/R8). Einziger Unterschied
zwischen den Rostern: die **Modellzahl** je Träger.

> **Assertion-Fokus:** die beiden Autor-Meldungen am Slot `4e15…` sowie die
> Abwesenheit der vier Ghouls-Grenzen. Andere Armeeaufbau-Diagnosen
> (General-Pflicht, Kategorie-Kontingente der 500-Punkte-Force) können
> zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Zählung `childId="model"` je Träger (`scope="self"`) | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|------------------------------------------------------|-------------------------------------------------------|---------|
| 01 | Schwelle exakt erreicht | BP rules + Ghouls A mit **10** Modellen + Ghouls B mit 5 Modellen. | A: Ist **10** / Schwelle 10 → hält. B: Ist 5 → hält nicht. | A erhält „BP Infantry 10+"; die Infanterie-Meldung am Slot `4e15…` bleibt **still**. Da `atLeast` den Schwellenwert einschließt, ist dies der scharfe Nachweis der Inklusivität. Auch die Einheitenzahl-Meldung bleibt still (2 Einheiten). | [`01-ten-models-in-carrier.ros`](rosters/01-ten-models-in-carrier.ros) |
| 02 | Ein Modell zu wenig | Wie 01, nur hat Ghouls A **9** statt 10 Modelle. | A: Ist **9** / Schwelle 10 → hält nicht. B: Ist 5 → hält nicht. | Kein Träger erhält die Kategorie → die Infanterie-Meldung feuert **genau einmal** (*error*, Slot `4e15…`). Zugleich Gegenprobe zum Rahmen: kontingentweit stünden hier **14** Modelle; wäre der Rahmen die Force, bliebe die Meldung fälschlich still. | [`02-nine-models-in-carrier.ros`](rosters/02-nine-models-in-carrier.ros) |
| 03 | Schwelle nur in der Summe | BP rules + Ghouls A mit **5** + Ghouls B mit **5** Modellen. | A: Ist **5**, B: Ist **5** — beide unter der Schwelle 10. | Kein Träger erhält die Kategorie → die Infanterie-Meldung feuert **genau einmal**. Kontingent-/rosterweit sind es exakt **10** Modelle: der schärfste Nachweis, dass gezählt wird, was *ein* Träger führt, nicht was das Kontingent summiert. | [`03-ten-models-split-across-carriers.ros`](rosters/03-ten-models-split-across-carriers.ros) |

**Beweisführung in beide Richtungen:** Roster 01 schlägt fehl, wenn die Engine
`atLeast` **exklusiv** liest (10 ≥ 10 müsste halten) oder die Modelle des
Trägers gar nicht findet — dann erschiene die Meldung fälschlich. Roster 02 und
03 schlagen fehl, wenn sie den Rahmen zu weit fasst (Force/Roster statt Träger)
oder die Schwelle um eins verrutscht — dann bliebe die Meldung fälschlich aus.
Das Paar 01/02 unterscheidet sich **nur** in der Zahl `10` vs. `9` an derselben
Modell-Auswahl.

**Punktekontrolle (nicht Teil der Assertion):** Ghouls-Modell 8 pts, Handweapon
0, Einheit 0, „Border Patrols rules" 0. Roster 01: 15 Modelle = 120 pts,
Roster 02: 14 = 112 pts, Roster 03: 10 = 80 pts — alle deutlich unter dem
500er-Limit, damit keine Budget-Diagnose dazwischenfunkt.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Katalog Vampire Counts / `catalogueLink` → Mercenaries | `4d73-5ab0-9020-403c` / `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
| Träger: Einheit „Ghouls" (`type="unit"`, trägt `add category` mit `atLeast 10 childId="model" scope="self"`) | `6b45-b2ad-dcdf-d3f4` |
| Modell „Ghouls" (`type="model"`, 8 pts) — min 5 / max 20 `scope="parent"` | `c11f-8aaf-5c69-4066` — `8e34-4788-81a6-74f2` / `f257-5a4e-76a2-4fe3` |
| „Handweapon" (`type="upgrade"`, zählt **nicht** als Modell) — min 2 / max 2 `scope="parent"` | `38ed-0cf0-ac63-31f5` — `ef46-30ad-181b-49c4` / `d07c-fd6a-46ed-ab4e` |
| Optionale Kommandogruppe „Command" / „Ghast" (in keinem Roster gewählt) | `7a69-63fe-fcb7-e4a3` / `6d6d-f1b2-ae25-c77c` |
| Kategorie „BP Infantry 10+" (`hidden="true"`, **ohne** eigene Grenzen) | `6ad6-f54e-1867-00a7` |
| „Border Patrols rules" (GST-Eintrag, Träger beider Autor-Meldungen; `max 1 scope="parent"`) | `4e15-0353-165f-5528` — `fbfc-d43f-396d-09cc` |
| Kostenart „pts" (Sichtbarkeitsgatter `limit::…` = 500) | `ecfa-8486-4f6c-c249` |
