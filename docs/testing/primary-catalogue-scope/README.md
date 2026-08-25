# E2E-Regeln & Testkatalog: `scope="primary-catalogue"` (Armeebuch-Identität)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln allein aus den
Katalogdaten der *6th Definitive Edition*
(`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.6
[Kasten „`scope="primary-catalogue"` — das Armeebuch, kein Zählrahmen"](../../battlescribe-data-format.md#scope-primary-catalogue))
abgeleitet; die Roster-Form ist an den bestehenden Szenarien verifiziert
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebücher: `Ogre Kingdoms (…).cat` (`731d-5b13-2a92-5427`, rev 2),
  `Vampire Counts (…).cat` (`4d73-5ab0-9020-403c`, rev 1),
  `Orcs and goblins (…).cat` (`4049-c46d-7f80-44fb`, rev 1)
- Gemeinsame Bibliothek: `Mercenaries (…).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) — enthält **alle** hier geprüften Einträge und **alle**
  geprüften Bedingungen.

---

## Worum es geht

Eine `condition` mit `scope="primary-catalogue"` fragt **nicht** „wie viele?",
sondern „**ist diese Liste eine Ogerarmee?**" bzw. „ist sie es nicht?". Die in
`childId` genannte Id ist die **Wurzel-Id eines `<catalogue>`** — des Armeebuchs,
aus dem das umschließende Kontingent stammt —, nicht die eines
`selectionEntry`, einer `categoryEntry` oder eines `forceEntry`.

Das Szenario trifft diese Regel an ihrem Kern: **dieselbe Selektion**, einmal in
einem Kontingent, dessen Armeebuch die genannte Id trägt (Ogre Kingdoms), und
einmal in einem Kontingent, dessen Armeebuch eine andere trägt (Vampire Counts,
Orcs and Goblins) — mit **messbar unterschiedlichem** Verletzungsbericht.

### Die Datenlage im Fixture-Satz

27 Vorkommen von `scope="primary-catalogue"`, 7 in der `.gst` und 20 in
`Mercenaries (6th definitive edition).cat`. Drei aus den Daten nachgeprüfte
Beobachtungen:

| Beobachtung | Beleg |
|-------------|-------|
| Alle 27 stehen an einer **`condition`** (`instanceOf`/`notInstanceOf`, `field="selections"`) — **nie** an einem `constraint` oder `repeat`. | Grep über beide Dateien; kein `constraint`/`repeat` trägt `scope="primary-catalogue"`. |
| Jede `childId` ist eine **Katalog-Wurzel-Id**. Für die drei im Fixture-Satz geladenen Bücher lässt sich das direkt zeigen: `id="731d-5b13-2a92-5427"`, `id="4049-c46d-7f80-44fb"` und `id="4d73-5ab0-9020-403c"` kommen im gesamten Satz **ausschließlich** als `<catalogue id=…>` in Zeile 2 der jeweiligen Datei vor. Keine dieser Ids benennt irgendwo einen Eintrag, eine Kategorie oder ein Kontingent. | `Ogre Kingdoms (…).cat:2`, `Orcs and goblins (…).cat:2`, `Vampire Counts (…).cat:2`; alle übrigen Vorkommen dieser Ids sind `childId="…"` in `primary-catalogue`-Bedingungen. |
| Der Autor sagt es selbst: Die Bedingung an `categoryEntry "Chariot"` (`.gst`) trägt `childName="Tomb Kings"` samt Kommentar „*Tomb Kings may have more than one Chariot*"; auch die übrigen `childName` sind **Armeebuch-Namen** (`Dogs of War`). | `.gst:773`; `Mercenaries (…).cat:48`. |

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Alle vier zählenden Regeln hängen an derselben Katalog-Id
`731d-5b13-2a92-5427` (**Ogre Kingdoms**) und sind Mercenaries-Einträge, die
jedes Armeebuch per `catalogueLink` importiert.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PCS-R1** | **Nur in der Ogerarmee Pflicht:** Eine `Rhinox Riders`-Einheit braucht dort zusätzlich einen **Special**-Slot. | `Mercenaries (…).cat:4079-4107` — `selectionEntry "Extra Special choice"` `6c8d-f6f3-823e-e6a5` unter `selectionEntry "Rhinox Riders"` `5e33-e510-ba45-933e`. Rohwert: constraint **`b830-0538-045e-ee90`** `type=min value=0 field=selections scope=parent`. `modifierGroup type="and"` → `modifier set value="1" field="b830-0538-045e-ee90"` (+ `set hidden=false`), Bedingungen: `notInstanceOf … scope="parent" childId="7ff5-9e55-c594-4b40"` (Kategorie *Ironskin*) **und** `instanceOf value=1 field=selections scope="primary-catalogue" childId="731d-5b13-2a92-5427"`. |
| **PCS-R2** | **Nur außerhalb der Ogerarmee Pflicht:** Dieselbe `Rhinox Riders`-Einheit braucht dort stattdessen einen zweiten **Rare**-Slot. | `Mercenaries (…).cat:4109-4132` — `selectionEntry "Extra Rare choice"` `a97e-5cc9-264b-74f4`. Rohwert: constraint **`e575-a5af-7fb3-5930`** `type=min value=0 field=selections scope=parent`. `modifierGroup` → `set value="1" field="e575-a5af-7fb3-5930"` (+ `set hidden=false`), Bedingung: `notInstanceOf … scope="primary-catalogue" childId="731d-5b13-2a92-5427"`. |
| **PCS-R3** | **Obergrenze nur außerhalb der Ogerarmee:** Höchstens **eine** `Rhinox Riders`-Einheit je Kontingent — in einer Ogerarmee ist die Grenze aufgehoben. | `Mercenaries (…).cat:4268-4277` — constraint **`47d7-b2ed-39e9-0e60`** `type=max value=1 field=selections scope=force includeChildSelections=false shared=true` am Eintrag `5e33-e510-ba45-933e`; `modifier set value="-1" field="47d7-b2ed-39e9-0e60"` mit `condition instanceOf … scope="primary-catalogue" childId="731d-5b13-2a92-5427"`. `-1` = unbegrenzt (Sentinel, [§7.6](../../battlescribe-data-format.md#76-constraint)). |
| **PCS-R4** | **Maneaters — zwei gegenläufige Modifikatoren an derselben Katalog-Id:** Außerhalb einer Ogerarmee kostet der Maneater einen **Rare-Slot extra** (`notInstanceOf`); **in** der Ogerarmee ist derselbe Eintrag **verborgen** (`instanceOf`). | `Mercenaries (…).cat:3832-3857` — `selectionEntry "Extra Rare choice"` `ea59-6ea6-b3c9-c34a` unter `selectionEntry "Maneaters"` `b360-ce9c-85d7-ff03`. Constraints: **`0799-afbf-f13f-bdac`** `type=max value=1 scope=parent`, **`9e9f-e78d-6390-accc`** `type=min value=0 scope=parent`. Modifikatoren: `set value="1" field="9e9f-e78d-6390-accc"` mit `notInstanceOf … childId="731d-…"`; `set value="true" field="hidden"` mit `instanceOf … childId="731d-…"`. |
| **PCS-R5** | **Das Armeebuch kommt aus der Herkunft der Force-Definition, nicht aus dem `.ros`.** | Die Forces stehen in den Armeebüchern: `forceEntry "Standard (OK-AB)"` `729f-9246-5cd3-5044` in `Ogre Kingdoms (…).cat:3090`, `forceEntry "Standard (VC-AB)"` `e989-15b8-7eb6-9668` in `Vampire Counts (…).cat:29297`, `forceEntry "Standard (OG-AB)"` `2bfa-e64a-7123-895f` in `Orcs and goblins (…).cat:47`. Das `catalogueId`-Attribut einer `<force>` ist Roster-Beiwerk — bestehende Fixtures tragen dort schon heute Platzhalter (`catalogueId="cat"` in `ogre-kingdoms/rosters/06-two-tyrants.ros`), und die Formatspezifikation entscheidet das ausdrücklich zugunsten der Definitionsherkunft ([§7.6-Kasten](../../battlescribe-data-format.md#scope-primary-catalogue), Issue 077). Roster 10 nagelt das fest. |
| **PCS-R6** | **Sichtbarkeit ist an denselben Bedingungen modelliert** — Maneaters-`Extra Rare choice` wird in der Ogerarmee `hidden=true`; die beiden Rhinox-Zusatz-Slots sind per Basis `hidden="true"` und werden je Seite eingeblendet; `categoryEntry "Regiment of Renown"` wird über `notInstanceOf … childId="fa9c-5f79-ce12-480c"` (*Dogs of War*, im Fixture-Satz gar nicht geladen) verborgen; die `.gst`-Kampagneneinträge werden nur für benannte Armeebücher sichtbar. | `Mercenaries (…).cat:3851-3855`, `:4096`, `:4126`, `:39-48`; `.gst:2294-2333`. **Nicht** als feuernde Grenze zu erwarten — der Verletzungsbericht kodiert zählende Grenzen, keine (Un-)Sichtbarkeit. |
| **PCS-R7** | **Der Rahmen muss *aufgelöst* worden sein:** Für **jedes** dieser Roster steht ein Armeebuch fest (die `<force>`-Definition stammt aus einem geladenen `.cat`), also darf **keine** Diagnose `UNRESOLVED_SCOPE` entstehen. Unbestimmbar wäre das Armeebuch nur ohne umschließende Force oder wenn die Force-Definition aus der `.gst` statt aus einem Armeebuch käme — beides trifft hier auf keines der zehn Roster zu. | [§7.6-Kasten](../../battlescribe-data-format.md#scope-primary-catalogue): „*Lässt sich das Armeebuch nicht bestimmen — keine umschließende Force, oder ihre Definition steht in der `.gst` statt in einem Armeebuch —, meldet die Engine `unresolvedScope` und wertet fail-closed, statt still ein Armeebuch anzunehmen.*" Die drei benutzten `forceEntry` stehen ausweislich PCS-R5 in `Ogre Kingdoms (…).cat`, `Vampire Counts (…).cat` bzw. `Orcs and goblins (…).cat`; alle drei Kataloge sind im `dataset` geladen. |

### Die Wahrheitstabelle je Armeebuch

| Kontingent (Armeebuch) | `b830…` „Extra Special" (PCS-R1) | `e575…` „Extra Rare" (PCS-R2) | `47d7…` Rhinox max (PCS-R3) | `9e9f…` Maneaters „Extra Rare" (PCS-R4) |
|---|---|---|---|---|
| **Ogre Kingdoms** `731d-…` | min **1** → Pflicht | min **0** → No-op | **aufgehoben** (`-1`) | min **0** → No-op (Eintrag verborgen) |
| **Vampire Counts** `4d73-…` | min **0** → No-op | min **1** → Pflicht | **max 1** | min **1** → Pflicht |
| **Orcs and Goblins** `4049-…` | min **0** → No-op | min **1** → Pflicht | **max 1** | min **1** → Pflicht |

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). **Alle** Roster
laufen gegen **denselben** Datensatz (`.gst` + Ogre + Vampire Counts + O&G +
Mercenaries) — nur die `entryId` der `<force>` unterscheidet die Fälle. Die
Selektionen darunter sind byte-gleich; damit ist das Armeebuch die **einzige**
Variable.

> **Assertion-Fokus:** nur die genannten Constraint-Ids — und, für **jedes**
> Roster, die Abwesenheit der Diagnose `UNRESOLVED_SCOPE` (PCS-R7, siehe den
> Abschnitt darunter). Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht,
> Pflicht-Ausrüstung der Einheiten, Punktelimit) können zusätzlich auftreten und
> sind hier ohne Belang — sie sind in beiden Hälften eines Paares identisch und
> stören den Kontrast nicht.

| # | Testtitel | Kontingent (Armeebuch) | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Rhinox Riders in der **Ogerarmee** | `729f…` (Ogre `731d…`) | Eine `Rhinox Riders`-Einheit mit einem Modell. | **PCS-R1 feuert:** `b830-0538-045e-ee90` (Ist 0, Grenze 1) — in der Ogerarmee ist der Special-Slot Pflicht. **PCS-R2 feuert nicht** (`e575…` bleibt min 0), **PCS-R3 feuert nicht** (Grenze aufgehoben). **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose. | [`01-ogre-rhinox-riders.ros`](rosters/01-ogre-rhinox-riders.ros) |
| 02 | **Dieselbe** Einheit in der **Vampirarmee** | `e989…` (VC `4d73…`) | Byte-gleiche Selektion wie 01. | **Umgekehrt:** `e575-a5af-7fb3-5930` feuert (Ist 0, Grenze 1), `b830…` **nicht**. `47d7…` steht auf max 1 und ist mit einer Einheit eingehalten. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose — der Ogre-Zweig wurde *geprüft* und traf nicht zu. | [`02-vampire-rhinox-riders.ros`](rosters/02-vampire-rhinox-riders.ros) |
| 03 | Dieselbe Einheit in der **Orkarmee** | `2bfa…` (O&G `4049…`) | Byte-gleiche Selektion wie 01/02. | Wie 02 — belegt: die Bedingung prüft **Identität mit genau `731d…`**, nicht „Oger gegen Vampire". **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose. | [`03-orcs-rhinox-riders.ros`](rosters/03-orcs-rhinox-riders.ros) |
| 04 | Ogerarmee, Pflicht **erfüllt** | `729f…` (Ogre) | Rhinox Riders **mit** `Extra Special choice` (`6c8d…`). | Keine Verletzung: die per `primary-catalogue` gehobene Untergrenze ist mit Ist 1 erfüllt; die Obergrenze `f873…` (max 1) ebenfalls. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose. | [`04-ogre-rhinox-extra-special-satisfied.ros`](rosters/04-ogre-rhinox-extra-special-satisfied.ros) |
| 05 | Vampirarmee, Pflicht **erfüllt** | `e989…` (VC) | Rhinox Riders **mit** `Extra Rare choice` (`a97e…`). | Spiegelbild zu 04: `e575…` erfüllt (Ist 1), `18c5…` (max 1) eingehalten. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose — die Untergrenze stand durch einen *ausgewerteten* `notInstanceOf`-Treffer auf 1. | [`05-vampire-rhinox-extra-rare-satisfied.ros`](rosters/05-vampire-rhinox-extra-rare-satisfied.ros) |
| 06 | **Zwei** Rhinox Riders in der Ogerarmee | `729f…` (Ogre) | Zwei `Rhinox Riders`-Einheiten. | **PCS-R3:** Der `set -1`-Modifier hebt die force-skopierte Obergrenze auf — trotz Ist 2 über dem Rohwert 1 **keine** Verletzung von `47d7…`. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose. | [`06-ogre-two-rhinox-riders.ros`](rosters/06-ogre-two-rhinox-riders.ros) |
| 07 | **Zwei** Rhinox Riders in der Vampirarmee | `e989…` (VC) | Byte-gleiche Selektion wie 06. | **PCS-R3, Gegenbeweis:** `47d7-b2ed-39e9-0e60` feuert (Ist 2, Grenze 1). Derselbe Aufbau, anderes Armeebuch, anderes Ergebnis. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose. | [`07-vampire-two-rhinox-riders.ros`](rosters/07-vampire-two-rhinox-riders.ros) |
| 08 | Maneaters in der **Ogerarmee** | `729f…` (Ogre) | Eine `Maneaters`-Einheit mit einem Modell. | **PCS-R4, `instanceOf`-Seite:** `9e9f-e78d-6390-accc` bleibt bei min 0 und feuert **nicht**; der Eintrag ist dort ohnehin verborgen (Sichtbarkeit, kein Bericht). `0799…` (max 1) eingehalten. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose. | [`08-ogre-maneaters.ros`](rosters/08-ogre-maneaters.ros) |
| 09 | **Dieselben** Maneaters in der Vampirarmee | `e989…` (VC) | Byte-gleiche Selektion wie 08. | **PCS-R4, `notInstanceOf`-Seite:** `9e9f-e78d-6390-accc` feuert (Ist 0, Grenze 1) — der Maneater kostet außerhalb einer Ogerarmee einen Rare-Slot extra. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose. | [`09-vampire-maneaters.ros`](rosters/09-vampire-maneaters.ros) |
| 10 | Lügendes `catalogueId`-Attribut | `e989…` (VC), `.ros` behauptet Ogre | Wie 02, aber `<force … catalogueId="731d-5b13-2a92-5427" catalogueName="Ogre Kingdoms">`. | **PCS-R5:** Das Ergebnis muss **identisch zu 02** bleiben — `e575…` feuert, `b830…` nicht. Das Armeebuch kommt aus der Herkunft der Force-**Definition**, nicht aus dem Roster-Attribut. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose — das widersprüchliche Attribut darf die Auflösung nicht verhindern. | [`10-vampire-force-with-ogre-catalogueid-attribute.ros`](rosters/10-vampire-force-with-ogre-catalogueid-attribute.ros) |

### Die Zusage „keine `UNRESOLVED_SCOPE`-Diagnose" (PCS-R7) — was sie leistet

Die Verletzungserwartungen allein sind **einseitig scharf**. Fiele der
Bezugsrahmen zurück in „unaufgelöst", zählte er 0 ([§7.6-Kasten](../../battlescribe-data-format.md#scope-primary-catalogue):
Diagnose + fail-closed) — und dann gilt:

| Seite | Bedingung | Bei Zählwert 0 … | Merkt der Verletzungsbericht das? |
|-------|-----------|------------------|------------------------------------|
| **`instanceOf`** (Roster 01, 04, 06, 08) | „ist Ogre Kingdoms" | hält **nicht** → der Ogre-Modifier greift nicht | **Ja.** `b830…` bliebe bei min 0 (01 fiele), `47d7…` bliebe bei max 1 (06 fiele). |
| **`notInstanceOf`** (Roster 02, 03, 05, 07, 09, 10) | „ist *nicht* Ogre Kingdoms" | hält **ebenfalls** → der Nicht-Ogre-Modifier greift wie gewollt | **Nein.** Das Ergebnis wäre zufällig richtig; ein stiller Rückfall auf fail-closed bliebe unbemerkt. |

Genau diese Lücke schließt `expect.diagnostics.absent`: „für dieses Roster
entsteht **keine** `UNRESOLVED_SCOPE`-Diagnose" trennt „*der Rahmen wurde
ausgewertet und traf nicht zu*" von „*der Rahmen ließ sich gar nicht
auflösen*" — zwei Zustände, die im reinen Zählwert ununterscheidbar sind.

**Warum alle zehn Roster die Zusage tragen und nicht nur die sechs der
`notInstanceOf`-Seite:** Die Aussage ist für jedes Roster dieselbe und aus
denselben Daten belegt (PCS-R7) — jede `<force>` stammt aus einem geladenen
Armeebuch, also ist der Rahmen in allen zehn Fällen bestimmbar. Sie nur dort
hinzuschreiben, wo sie das Netz enger zieht, würde suggerieren, für die vier
`instanceOf`-Roster sei ein unaufgelöster Rahmen hinnehmbar. Auch dort ist die
Zusage nicht wertlos: sie unterscheidet „der Ogre-Zweig traf zu" von „der Ogre-
Zweig traf zu, obwohl der Rahmen nebenher als unauflösbar gemeldet wurde".

Die Zusage ist **nicht** auf ein `targetId` eingeengt: sie verbietet die
Diagnose-Art im ganzen Bericht des Rosters. Eine Einengung auf eine Ziel-Id, die
die Diagnose gar nicht trägt, würde die Erwartung stillschweigend leerlaufen
lassen — genau der Zahnlosigkeit, die sie beheben soll.

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|------------------------|
| **Sichtbarkeit (PCS-R6)** — Maneaters-`Extra Rare choice` `hidden=true` in der Ogerarmee, die beiden Rhinox-Zusatz-Slots `hidden=false` je Seite, `categoryEntry "Regiment of Renown"` und die `.gst`-Kampagneneinträge. | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke. Der Verletzungsbericht kodiert zählende Grenzen; Sichtbarkeit liest man an der Capability-Projektion ab, nicht an `violations` (gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). |
| **Kategorie-Umhängungen** — die `entryLink`-Modifikatoren der Armeebücher (`add`/`remove`/`set-primary` auf `field="category"`) an denselben Einträgen. | Kategoriezugehörigkeit, keine Grenze. Die Roster wählen die Einträge über die **Ziel-Id** (`5e33-…`, `b360-…`) statt über einen armeebuch-eigenen `entryLink`; damit bleiben die beiden Hälften eines Paares strukturell identisch und die Kategorie-Modifikatoren außen vor. |
| **`.gst`-Fall `categoryEntry "Chariot"`** (`4b43-5d4e-94ca-1fd5`, `set 1` bei `notInstanceOf … childName="Tomb Kings"` **und** `atLeast 1 Border Patrols rules`). | Als Beleg für „`childId` ist eine Katalog-Wurzel-Id" oben aufgeführt, aber **nicht** als Roster gebaut: die Grenze ist **kategorie**-skopiert und würde den Fall mit einer zweiten, hier nicht gemeinten Achse vermengen (siehe [`category-scope-bug`](../category-scope-bug/)). Der Tomb-Kings-Katalog ist im Fixture-Satz zudem gar nicht enthalten. |
| **Der unauflösbare Rahmen selbst (PCS-R7, Gegenrichtung)** — ein Roster ohne umschließende Force bzw. mit einer `.gst`-eigenen Force-Definition, das die Diagnose `UNRESOLVED_SCOPE` *auslöst*. | Hier bewusst nicht gebaut: Dieses Szenario nagelt die **Identitätsprüfung** fest, und ein solches Roster brächte eine zweite Achse (fehlende/fremde Force-Herkunft) mit. Die zehn Roster fordern die Diagnose deshalb ausschließlich als **Abwesenheit**. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Katalog **Ogre Kingdoms** (die geprüfte `childId`) | `731d-5b13-2a92-5427` |
| Katalog **Vampire Counts** | `4d73-5ab0-9020-403c` |
| Katalog **Orcs and Goblins** | `4049-c46d-7f80-44fb` |
| Bibliothek **Mercenaries** (`library="true"`) | `fc47-8392-a6c8-452a` |
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Force „Standard (OK-AB)" (Ogre) | `729f-9246-5cd3-5044` |
| Force „Standard (VC-AB)" (Vampire Counts) | `e989-15b8-7eb6-9668` |
| Force „Standard (OG-AB)" (Orcs and Goblins) | `2bfa-e64a-7123-895f` |
| Einheit „Rhinox Riders" (Mercenaries) | `5e33-e510-ba45-933e` |
| Modell „Rhinox Riders" | `c7a1-044e-39f1-9ad8` |
| „Extra Special choice" (Rhinox) — Pflicht **nur** in der Ogerarmee | `6c8d-f6f3-823e-e6a5` — constraints `b830-0538-045e-ee90` (min 0→1) / `f873-6cfe-911e-2c46` (max 1) |
| „Extra Rare choice" (Rhinox) — Pflicht **nur außerhalb** | `a97e-5cc9-264b-74f4` — constraints `e575-a5af-7fb3-5930` (min 0→1) / `18c5-ec9f-0857-c0de` (max 1) |
| Force-Obergrenze der Rhinox Riders (`set -1` in der Ogerarmee) | `47d7-b2ed-39e9-0e60` |
| Einheit „Maneaters" (Mercenaries) | `b360-ce9c-85d7-ff03` |
| Modell „Maneaters" | `482e-1ec0-561c-ab93` |
| „Extra Rare choice" (Maneaters) — zwei gegenläufige Modifikatoren | `ea59-6ea6-b3c9-c34a` — constraints `9e9f-e78d-6390-accc` (min 0→1) / `0799-afbf-f13f-bdac` (max 1) |
| Kategorie „Ironskin" (zweite Bedingung von PCS-R1) | `7ff5-9e55-c594-4b40` |
| Kategorie „Regiment of Renown" (nur Sichtbarkeit) | `ee09-9a50-ad78-9c32` |
| Katalog „Dogs of War" — `childId` **ohne** geladenen Katalog im Fixture-Satz | `fa9c-5f79-ce12-480c` |
| Katalog „Tomb Kings" — dito, `.gst`-Chariot-Bedingung | `9945-8537-0944-c67b` |
| `entryLink` „Rhinox Riders" je Armeebuch (Ogre / VC / O&G) | `c8d5-1198-3d4a-8a67` / `7fd7-c08c-b5bf-86eb` / `d38d-cf82-1161-dce5` |
| `entryLink` „Maneaters" je Armeebuch (Ogre / VC / O&G) | `313e-458a-246f-7e88` / `e58d-9561-8347-126e` / `4852-2f36-f843-f437` |

*(Die Diagnose-Art `UNRESOLVED_SCOPE` aus PCS-R7 ist kein Katalog-Baustein,
sondern ein Schlüssel der Diagnose-Aufzählung des Manifest-Vertrags — vgl.
`UNRESOLVED_DEFINITION` in [`ogre-kingdoms`](../ogre-kingdoms/README.md) und
`UNRESOLVED_BUDGET_LIMIT` in [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md).)*
