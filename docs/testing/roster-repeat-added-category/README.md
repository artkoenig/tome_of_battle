# E2E-Regeln & Testkatalog: `repeat` mit `scope="roster"` auf eine **per Modifikator vergebene** Kategorie — „eine Gnoblar-Einheit je Ogre-Bulls-Einheit"

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.2/§7.5/§7.6/§7.7/§8) abgeleitet. Die Roster-Form folgt den bereits
verifizierten Szenario-Fixtures (direktes `entryId`, `entryLinkId=""`,
geschachtelte `selections` mit `number`; für den Ogre-Wurzel-Verweis die in
[`author-message-tokens`](../author-message-tokens/README.md) verifizierte
Verweis-Form `entryId = entryLinkId = d82e-…`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2, `:2`) — Kontingent **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044` (`:3090`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`)
  — per `catalogueLink` `a067-78d5-50a2-affe` eingebundene Abhängigkeit des
  Ogre-Katalogs (`:3087`); dort liegt das Ziel `7754-8b3d-df99-d2d5` des
  Ogre-Bulls-Verweises (`:3438`)

---

## Der gepinnte Mechanismus

Ein `modifier` mit einer `<repeats>`-Liste wird **einmal je gezähltem Treffer**
angewendet ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)).
Die hier gepinnte Zelle zählt mit `field="selections"`, **`scope="roster"`** und
einem **Kategorie-Ziel** in `childId` — und die Besonderheit gegenüber
[`roster-repeat-category-count`](../roster-repeat-category-count/README.md) ist:
**diese Kategorie hat im gesamten Fixture-Satz keinen einzigen `categoryLink`.**
Ihr einziger Träger erhält sie zur Laufzeit über einen
`modifier type="add" field="category"` ([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)).
Die Frage, die dieses Szenario stellt: **zählt der `repeat` eine solche
Mitgliedschaft mit?**

```
forceEntry "Standard (OK-AB)" (729f-9246-5cd3-5044, :3090)
  ├ entryLink "Ogre Bulls" (d82e-111e-89b9-2be1, :3133 → 7754-8b3d-df99-d2d5, Mercenaries :3438)
  │    ├ <modifiers> modifier add category 735e-2da1-6356-2fdb   (:3165, UNBEDINGT)
  │    │      ← der EINZIGE Träger der Kategorie "Bully Bully" im ganzen Satz
  │    ├ constraint min 0 selections scope=force  32ed-26da-3f27-5c04  (:3162)
  │    └ modifierGroup "Standard" → set 1 auf 32ed-…               (:3140)
  ├ selectionEntry "Gnoblars" (1e26-0d1a-bb3c-f47a, :16, type=unit, Core primär)
  │    ├ constraint max 0 selections scope=parent  a177-82fc-0b76-5b73  (:41)
  │    └ modifier increment +1 field=a177-…                          (:18)
  │         └ repeat field=selections scope=roster value=1 repeats=1
  │               childId=735e-2da1-6356-2fdb roundUp=false          ← DIESE ZELLE (:20)
  └ selectionEntry "Gnoblar Trappers" (041b-7d95-6ff9-754a, :121, type=unit)
       ├ constraint max 1 selections scope=parent  28cd-8b7f-3d0f-1546 (:141)
       └ modifier increment +1 field=28cd-… mit demselben repeat        (:123/:125)
```

Netto-Semantik der Daten: **Gnoblars sind von Haus aus verboten (max 0) — jede
armeeweit gezählte Ogre-Bulls-Einheit erlaubt genau eine.** Mit N Ogre Bulls ist
das effektive Maximum **0 + N**. Anwendungszahl des `repeat`:
`floor(Treffer / value) × repeats` = `floor(N / 1) × 1` = N.

**Der Kategorie-Träger ist ausschließlich der Verweis, nicht sein Ziel.** Der
`add category`-Modifikator steht im **eigenen `<modifiers>`-Block** des
`entryLink` `d82e-…` (`:3164-3166`) — **außerhalb** der beiden `modifierGroup`s
(`:3134-3160`), die die übrigen Kategorie-Änderungen desselben Verweises auf das
Kontingent gaten. Er hat **keine** `conditions`/`conditionGroups` und wirkt daher
in **jedem** Kontingent. Das Ziel `7754-8b3d-df99-d2d5` in der
Mercenaries-Bibliothek trägt selbst nur die `categoryLink`s „Rare" (`:3445`) und
„Regiment of Renown" (`:3446`) — **kein** „Bully Bully".

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RRAC-R1** | Die Einheit „Gnoblars" trägt als **geschriebene** Grenze **max 0** Auswahlen ihrer selbst, gezählt im Rahmen ihres Elternteils (= des Kontingents, denn sie ist ein Wurzel-Eintrag). Ohne Modifier ist sie damit gar nicht wählbar. | `Ogre Kingdoms (…).cat:41` — `constraint field="selections" scope="parent" value="0" type="max" id="a177-82fc-0b76-5b73" shared="true" includeChildSelections="false" includeChildForces="false"` am `selectionEntry` `1e26-0d1a-bb3c-f47a` (`:16`). |
| **RRAC-R2** | **Die Kernaussage:** Je armeeweit gezählter Auswahl der Kategorie **„Bully Bully"** steigt diese Grenze um **+1**. Der `increment`-Modifier trägt genau einen `<repeat>` mit `value="1"`/`repeats="1"`/`roundUp="false"`; mit 1 Treffer ist das effektive Maximum `0+1=1`, mit 2 Treffern greift die Wiederholung **zweimal**: `0+2=2`. | `:18-22` — `modifier type="increment" value="1" field="a177-82fc-0b76-5b73"` mit `<repeat field="selections" scope="roster" value="1" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" childId="735e-2da1-6356-2fdb" repeats="1" roundUp="false"/>` (`:20`). Anwendungszahl je [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). |
| **RRAC-R3** | **Die zweite Kernaussage:** Die gezählte Kategorie wird **nur zur Laufzeit per Modifikator** vergeben. `735e-2da1-6356-2fdb` („Bully Bully") ist ein `categoryEntry` ohne jeden `categoryLink` im gesamten Fixture-Satz; sie kommt dort **genau fünfmal** vor: die Definition (`:9`), die beiden `<repeat childId=…>` (`:20`, `:125`), eine `condition childId=…` (`:25`) und der **eine** `modifier type="add" value="735e-2da1-6356-2fdb" field="category"` am `entryLink` „Ogre Bulls" (`:3165`). Wer nur `categoryLink`s auswertet, zählt hier **immer 0** und lässt die Grenze auf ihrem Basiswert stehen. | `:9` (`categoryEntry id="735e-2da1-6356-2fdb" name="Bully Bully" hidden="false"`), `:3164-3166` (der `<modifiers>`-Block des Verweises `d82e-111e-89b9-2be1`, `:3133`). |
| **RRAC-R4** | Der `add category`-Modifikator ist **unbedingt**: er trägt weder `conditions` noch `conditionGroups` und steht **außerhalb** der beiden `modifierGroup`s des Verweises, die die übrigen Kategorie-Änderungen auf „Standard" bzw. „Ironskin Tribe" gaten. Er wirkt daher in jedem Kontingent — insbesondere im hier benutzten „Standard (OK-AB)". | `:3134-3160` (die beiden gegateten `modifierGroup`s) gegen `:3164-3166` (der ungegatete `<modifiers>`-Block). |
| **RRAC-R5** | Ohne jede Ogre-Bulls-Einheit zählt der `repeat` **0 Treffer**; der Modifier wird **nicht** angewendet (er trägt keine weitere `condition`), die Grenze behält ihren **Basiswert 0**. | `:18-22` — der Modifier hat **keine** `<conditions>`/`<conditionGroups>`, allein der `<repeat>` steuert die Anwendungszahl (`floor(0/1)×1 = 0`). |
| **RRAC-R6** | Die **angehobene** Grenze ist auch die Grenze, die im Verletzungsbericht erscheint: übersteigt die Stückzahl der Gnoblars `0+N`, feuert `a177-82fc-0b76-5b73` mit dem **effektiven** `bound` (0 ohne Ogre Bulls, 1 mit einem, 2 mit zweien) — nicht mit dem geschriebenen Wert. | Im ganzen Fixture-Satz adressieren **genau zwei** Stellen die Id `a177-82fc-0b76-5b73`: die Constraint (`:41`) und das increment (`:18`). Kein weiterer `set`/`decrement` verschiebt sie. |
| **RRAC-R7** | **Zweiter Zeuge, anderer Basiswert:** Dieselbe `repeat`-Zelle sitzt ein zweites Mal an „Gnoblar Trappers" (`041b-7d95-6ff9-754a`) und hebt dort die Grenze `28cd-8b7f-3d0f-1546`, deren geschriebener Basiswert **max 1** (nicht 0) ist. Mit einem Ogre Bulls steht sie auf 2. Auch diese Id wird im ganzen Satz nur von der Constraint (`:141`) und dem increment (`:123`) adressiert. | `:121-127` (`modifier increment +1` mit identischem `<repeat …childId="735e-2da1-6356-2fdb"…/>` in `:125`), `:141` (`constraint … value="1" … type="max"`). |
| **RRAC-R8** | Gezählt wird die **Stückzahl** (`number`) der Auswahlen. Eine Gnoblar-Auswahl mit `number="2"` ist damit „zwei Einheiten" im Sinne der Grenze; zwei Ogre-Bulls-Auswahlen mit je `number="1"` sind zwei gezählte Treffer. | [§7.5, Kasten „Zahlenbasis"](../../battlescribe-data-format.md#75-cost--cost-type): jeder Knoten trägt sein `count` unverrechnet bei, das `number` einer `.ros`-Auswahl ist die **absolute Gesamtstückzahl**. Gleiche Ableitung wie RRCC-R5 in [`roster-repeat-category-count`](../roster-repeat-category-count/README.md). |
| **RRAC-R9** | Im Kontingent „Standard (OK-AB)" ist **mindestens eine** Ogre-Bulls-Einheit Pflicht: der Verweis trägt `constraint min 0 … scope="force"` (`32ed-26da-3f27-5c04`), den ein `set 1` in der `modifierGroup` „Standard" anhebt, sobald die Force **keine** Instanz von „Ironskin Tribe" `8711-ed16-2a44-7251` ist. Genau darum feuert diese Pflicht in den Rostern 01 und 06 (Ist 0, Grenze 1) und schweigt überall sonst. | `:3162` (Constraint), `:3140` (`modifier type="set" value="1" field="32ed-26da-3f27-5c04"`) innerhalb der `modifierGroup` mit `condition type="notInstanceOf" … childId="8711-ed16-2a44-7251"` (`:3144`). Bereits gepinnt in [`not-instance-of-force-gate`](../not-instance-of-force-gate/README.md). |
| **RRAC-R10** | Weder „Gnoblars" noch „Gnoblar Trappers" noch der Ogre-Bulls-Verweis sind im Kontingent „Standard (OK-AB)" ausgeblendet: alle drei tragen `hidden="false"` und **keinen** `field="hidden"`-Modifikator. Die Grenzen sind also validierbar (kein Verbot aus [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments)). | `:16`, `:121`, `:3133` — die einzigen `modifierGroup`s dieser drei Elemente gaten auf „Ironskin Tribe" `8711-ed16-2a44-7251` und ändern ausschließlich **Kategorien** (`:107-119`, `:208-220`, `:3134-3160`). |
| **RRAC-R11** | Die Pflicht-Kinder der Einheiten sind in den Rostern ausgefüllt: **Gnoblars** 20 Modelle (`min 20`, `scope="parent"`), **Hand Weapon** (`min 1`) und **Sharp Stuff** (`min 1`); **Gnoblar Trappers** 8 Modelle, Hand Weapon, Sharp Stuff; **Ogre Bulls** 3 „Bulls"-Modelle (`min 3`) und **Ogre Club** (`min 1`). | Gnoblars: `:53-55` (`bf71-422e-240b-826a`, min `7d69-1827-de87-9e81`), `:89-93` (Verweis `248f-6615-7784-6ee2` → `abdb-bbd0-41b2-5dff`, min `4900-c70c-5758-7677`, max `3f7e-2494-405b-9cc8`), `:95-99` (Verweis `c417-d17b-7230-57bb` → `5545-fcf3-a765-9474`, min `3721-5eca-db0b-f875`, max `10a7-ec54-8963-c662`). Trappers: `:154-156` (`a6fc-a76c-6d8d-31a0`, min `5139-da17-6c0c-5419`), `:190-194`, `:196-200`. Ogre Bulls: `Mercenaries:3449-3451` (`411b-6f5f-06f1-be37`, min `92d9-b5d1-9411-e954`), `Mercenaries:3560-3563` (Verweis `415f-94c9-571c-19c6` → `8768-377c-88da-c3e8`, min `fff8-7da0-1bdc-5bdf`, max `431b-bb5a-8710-7c0c`). |

**Bewusst nicht Gegenstand dieses Szenarios** (in allen Rostern inert bzw. nicht
assertiert):

- **Die Autor-Meldung an „Gnoblars"** (`:23-27`, `modifier type="add"
  field="error"` mit `condition type="lessThan" value="1" field="selections"
  scope="force" childId="735e-2da1-6356-2fdb"`). Sie liest **dieselbe** per
  Modifikator vergebene Kategorie, aber als **Bedingung** und im **force**-Rahmen
  statt als `repeat` im **roster**-Rahmen — eine andere Zelle, die bereits in
  [`author-message-tokens`](../author-message-tokens/README.md) gepinnt ist.
  Dieses Szenario macht über sie **keine** Aussage; in den Rostern 01 und 06
  liegt sie erwartbar an, in den übrigen nicht.
- **Die Einschluss-Flags `includeChildSelections="false"` /
  `includeChildForces="false"`** des `repeat` (`:20`). Alle Roster benutzen **ein**
  Kontingent, und die gezählten Ogre Bulls stehen dort als **Wurzel**-Auswahlen —
  in dieser Lage schränkt keines der beiden Flags die Zählung ein
  ([§7.6](../../battlescribe-data-format.md#76-constraint): `false` zählt „just
  `scope`'s `field`" bzw. „only from parent force selections"). Der Kontrast zu
  `true`/`true` ist in
  [`roster-repeat-category-count`](../roster-repeat-category-count/README.md)
  (Roster 06, zweites Kontingent) gepinnt; hier wäre er ein anderer Testfall.
- **Die Kinder-Grenzen eines *gestapelten* Trägers.** In den Rostern 03–07 steht
  die Gnoblar- bzw. Trapper-Einheit als **eine** Auswahl mit `number` 2 bzw. 3
  (nötig, damit der Capability-Selektor genau **einen** Slot trifft). Ob eine
  `scope="parent"`-Grenze eines Kindes dann gegen `child.number` oder gegen
  `child.number × parent.number` misst, ist die in
  [§7.5](../../battlescribe-data-format.md#75-cost--cost-type) offen benannte
  Frage („Zahlenbasis"). Diese Kinder-Grenzen stehen deshalb **weder** in
  `firing` **noch** in `absent`; nur in den Rostern 01/02 (`number="1"`) sind sie
  eindeutig und werden dort als `absent` gefordert.
- **Die Kinder-Grenzen der Ogre-Bulls-Einheiten** (`92d9-…`, `fff8-…`,
  `431b-…`). Die Auswahl benennt den **Verweis** als `entryId`
  (`entryId = entryLinkId = d82e-…`) — die Form, die die am Verweis deklarierten
  Modifikatoren trägt (verifiziert in
  [`author-message-tokens`](../author-message-tokens/README.md), Roster 02). Wie
  ein so benannter Slot die Kinder seines **Ziels** beherbergt, ist eine
  dokumentierte Lücke der Quelle
  ([§15](../../battlescribe-data-format.md#15-lücken-der-quelle): „welche Id die
  Identität einer Auswahl trägt", „Grenze am Verweis oder am Ziel"). Die
  Pflichtkinder stehen in den Rostern (damit die Einheit fachlich vollständig
  ist), werden aber **nicht** assertiert.
- **`headroom` / `isBlocked` / `isHidden`:** nicht assertiert. In den
  Überschreitungs-Rostern ist aus Daten und Formatdoku nicht ableitbar, ob der
  Restspielraum negativ oder auf 0 geklemmt gemeldet wird; assertiert werden nur
  `name`, `current`, `effectiveMin` und `effectiveMax`.
- **Die „Border Patrols"-Umgliederung** beider Gnoblar-Einheiten (`:28-38`,
  `:128-138`, `add category 6ad6-f54e-1867-00a7`). Ihre `conditionGroup type="and"`
  verlangt zusätzlich **≥ 1** Auswahl „Border Patrols rules"
  (`4e15-0353-165f-5528`) im Roster; keines der Roster enthält sie, die Gruppe
  hält also nirgends. Ebenso inert: die `modifierGroup`s auf „Ironskin Tribe"
  (`8711-ed16-2a44-7251`) — alle Roster benutzen „Standard (OK-AB)".
- **Armeeweite Aufbau-Diagnosen:** die General-Pflicht (`.gst`, Kategorie
  `a37e-7207-de6d-acb0`, `1077-7379-f142-f382`, `min 1`) und die Core-Mindestzahl
  (`35c2-d478-392a-aeb1`, Basis `min 2`) sind in den bewusst minimalen Rostern
  nicht erfüllt und dürfen zusätzlich feuern; die Erwartung ist selektiv und
  macht darüber keine Aussage. Die Roster tragen **kein** `<costLimits>`, also
  greift auch keine punkteskalierende Stufe dieser Grenzen.
- **Kein `<categories>`-Block in den Rostern.** Bewusst weggelassen: die
  Kategoriezugehörigkeit „Bully Bully" muss aus dem **Katalog**-Modifikator
  stammen, nicht aus der Roster-Datei. Stünde sie dort, wäre RRAC-R3 nicht mehr
  prüfbar. Dass die Engine Kategorien aus den Katalogdaten ableitet, zeigen die
  ebenfalls `<categories>`-losen Roster von
  [`ogre-kingdoms`](../ogre-kingdoms/README.md) (dort werden die
  Kategorie-Pflichten General/Core korrekt bewertet).

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Ogre-Kingdoms-`.cat` + Mercenaries-`.cat`) und
benutzen dasselbe Kontingent „Standard (OK-AB)" `729f-9246-5cd3-5044`.

> **Assertion-Fokus:** das effektive Maximum des Gnoblars- bzw.
> Trapper-Slots (`expect.capabilities`, Felder `current`/`effectiveMin`/
> `effectiveMax`) sowie `actual`/`bound` der Grenzen `a177-82fc-0b76-5b73` und
> `28cd-8b7f-3d0f-1546` im Verletzungsbericht; dazu die bewusst deklarierte
> Ogre-Bulls-Pflicht `32ed-26da-3f27-5c04`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Ogre Bulls → Basiswert 0 feuert | 1 × Gnoblars (`number="1"`), **keine** Ogre-Bulls-Einheit. | **RRAC-R1/R5:** Der `repeat` trifft 0-mal, die Grenze bleibt bei **max 0** und feuert mit **Ist 1 gegen Grenze 0**. Slot: `current=1`, `effectiveMax=0`, kein Mindestmaß. Zusätzlich feuert **RRAC-R9** (Ogre-Bulls-Pflicht, Ist 0 / Grenze 1). Die Pflichtkinder-Grenzen der Gnoblars bleiben still. | [`01-no-bulls-gnoblars-max-zero-fires.ros`](rosters/01-no-bulls-gnoblars-max-zero-fires.ros) |
| 02 | Ein Ogre Bulls → Maximum 1 | Wie 01, zusätzlich **1 ×** Ogre Bulls über den Verweis `d82e-…`. | **RRAC-R2/R3:** Die per Modifikator vergebene Kategorie wird gezählt, die Wiederholung greift **einmal** → `effectiveMax=1` bei Ist 1. Keine der genannten Grenzen feuert. | [`02-one-bulls-one-gnoblars-legal.ros`](rosters/02-one-bulls-one-gnoblars-legal.ros) |
| 03 | Zwei Gnoblar-Einheiten gegen Maximum 1 | Wie 02, Gnoblars mit `number="2"`. | **RRAC-R6:** Dieselbe Grenze feuert mit **Ist 2 gegen Grenze 1** — der gemeldete `bound` liegt um genau **einen** Wiederholungsschritt über dem Basiswert aus Test 01. Slot: `current=2`, `effectiveMax=1`. | [`03-one-bulls-two-gnoblars-fires.ros`](rosters/03-one-bulls-two-gnoblars-fires.ros) |
| 04 | **Zwei** Ogre Bulls → Maximum 2 | **2 ×** Ogre Bulls (zwei Auswahlen, je `number="1"`), Gnoblars mit `number="2"`. | **RRAC-R2:** Die Wiederholung greift **zweimal** → `effectiveMax=2` bei Ist 2, die Grenze schweigt. Der Fall, der die **zweite** Wiederholung messbar macht: würde die per Modifikator vergebene Kategorie nur einmal oder gar nicht gezählt, läge `effectiveMax` bei 1 bzw. 0 und die Grenze würde feuern. | [`04-two-bulls-two-gnoblars-legal.ros`](rosters/04-two-bulls-two-gnoblars-legal.ros) |
| 05 | Drei Gnoblar-Einheiten gegen Maximum 2 | Wie 04, Gnoblars mit `number="3"`. | **RRAC-R6:** Die Grenze feuert mit **Ist 3 gegen Grenze 2** — zwei Wiederholungsschritte über dem Basiswert. Damit ist die zweite Wiederholung auch im **Verletzungsbericht** sichtbar, nicht nur im Fähigkeits-Datensatz. | [`05-two-bulls-three-gnoblars-fires.ros`](rosters/05-two-bulls-three-gnoblars-fires.ros) |
| 06 | Zweiter Zeuge: Trapper-Basiswert **1** feuert | 2 × Gnoblar Trappers (`number="2"`), **keine** Ogre-Bulls-Einheit. | **RRAC-R7:** Ohne Treffer bleibt `28cd-…` auf seinem geschriebenen **max 1** und feuert mit **Ist 2 gegen Grenze 1**. Slot: `current=2`, `effectiveMax=1`. Die Gnoblars-Grenze `a177-…` schweigt (keine Gnoblar-Einheit im Roster); **RRAC-R9** feuert wie in Test 01. | [`06-no-bulls-two-trappers-fires.ros`](rosters/06-no-bulls-two-trappers-fires.ros) |
| 07 | Zweiter Zeuge: ein Ogre Bulls → Maximum 2 | Wie 06, zusätzlich **1 ×** Ogre Bulls. | **RRAC-R7:** Dieselbe Wiederholung hebt `28cd-…` von **1 auf 2** → `effectiveMax=2` bei Ist 2, die Grenze schweigt. Beweis, dass die Zelle an beiden Trägern identisch wirkt und sich nur der Basiswert unterscheidet. | [`07-one-bulls-two-trappers-legal.ros`](rosters/07-one-bulls-two-trappers-legal.ros) |

### Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf)

- **`effectiveMax` / `bound`** ist der geschriebene Basiswert der Constraint
  (**0** für `a177-82fc-0b76-5b73`, `:41`; **1** für `28cd-8b7f-3d0f-1546`,
  `:141`) plus `floor(N/1) × 1 × 1` Anwendungen des `increment +1` (`:18` bzw.
  `:123`), wobei **N** die armeeweit gezählte Stückzahl der Auswahlen mit der
  Kategorie `735e-2da1-6356-2fdb` ist (RRAC-R2/R3/R8). Daraus: Roster 01 ⇒ **0**;
  Roster 02/03 ⇒ **1**; Roster 04/05 ⇒ **2**; Roster 06 ⇒ **1**;
  Roster 07 ⇒ **2**.
- **`current` / `actual`** ist die Stückzahl der Gnoblar- bzw. Trapper-Auswahlen
  im Rahmen des Kontingents (`field="selections"`, `scope="parent"` an einem
  Wurzel-Eintrag), also das `number` der einen Träger-Auswahl: 1, 1, 2, 2, 3, 2, 2
  in den Rostern 01…07.
- Wo `actual ≤ bound` liegt, ist die Grenze eingehalten und erscheint nicht im
  Bericht — die Erwartung lautet dort `absent`, ohne `actual`/`bound`
  (Roster 02, 04, 07).
- **`effectiveMin`** ist `null`: beide Einheiten tragen **keine** min-Grenze auf
  sich selbst, und kein Modifier fügt eine hinzu (nur je zwei Fundstellen der
  Constraint-Ids, RRAC-R6/R7). Gegenbeispiel im selben Katalog: der
  Ogre-Bulls-Verweis trägt ein **geschriebenes** `min 0` (`:3162`), das ist
  „Mindestmaß 0", nicht „kein Mindestmaß".
- **`actual` der Ogre-Bulls-Pflicht** `32ed-26da-3f27-5c04` ist die Zahl der
  Ogre-Bulls-Auswahlen im Kontingent (0 in Roster 01/06), **`bound`** der per
  `set` auf **1** gehobene Wert (RRAC-R9).
- Die **effektiven Namen** bleiben die Basisnamen **„Gnoblars"** (`:16`) und
  **„Gnoblar Trappers"** (`:121`): an keinem der beiden Einträge hängt ein
  `field="name"`-Modifikator (unabhängig verifiziert in
  [`author-message-tokens`](../author-message-tokens/README.md), wo `{this}` an
  `1e26-…` zu „Gnoblars" aufgelöst wird).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Ogre Kingdoms** (rev 2, `:2`) | `731d-5b13-2a92-5427` |
| Bibliothek **Mercenaries** (per `catalogueLink` `a067-78d5-50a2-affe`, `:3087`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst`) | `ecfa-8486-4f6c-c249` |
| ForceEntry „Standard (OK-AB)" (`:3090`) | `729f-9246-5cd3-5044` |
| ForceEntry „Ironskin Tribe (WD#309-UK)" (`:3105`) — Gatter der inerten `modifierGroup`s | `8711-ed16-2a44-7251` |
| **CategoryEntry „Bully Bully"** (`:9`) — das gezählte Ziel, **ohne jeden `categoryLink`** | **`735e-2da1-6356-2fdb`** |
| **EntryLink „Ogre Bulls"** (`:3133`, Ziel `7754-8b3d-df99-d2d5` in Mercenaries `:3438`) — einziger Träger der Kategorie | **`d82e-111e-89b9-2be1`** |
| — der **unbedingte** `modifier add category` in seinem eigenen `<modifiers>`-Block (`:3165`) | `value="735e-2da1-6356-2fdb" field="category"` |
| — seine force-skopierte Pflicht `min 0` (`:3162`), per `set 1` gehoben (`:3140`) | `32ed-26da-3f27-5c04` |
| — Pflichtkinder (nicht assertiert): Bulls-Modelle / Ogre Club | `411b-6f5f-06f1-be37` (min `92d9-b5d1-9411-e954`) / `8768-377c-88da-c3e8` via `415f-94c9-571c-19c6` (min `fff8-7da0-1bdc-5bdf`, max `431b-bb5a-8710-7c0c`) |
| **SelectionEntry „Gnoblars"** (`:16`, `type="unit"`, Core primär) — Träger 1 | **`1e26-0d1a-bb3c-f47a`** |
| — **die bewegte Grenze** max 0, `field="selections" scope="parent"` (`:41`) | **`a177-82fc-0b76-5b73`** |
| — `increment +1` auf diese Id mit **der gepinnten `repeat`-Zelle** (`:18-22`) | `childId=735e-2da1-6356-2fdb`, `scope="roster"`, `value=1`, `repeats=1`, `ics=false`, `icf=false` |
| — Autor-Meldung `field="error"` auf dieselbe Kategorie (`:23-27`, nicht assertiert) | `condition lessThan 1 … scope="force" childId="735e-2da1-6356-2fdb"` |
| — Pflichtkinder: Modelle / Hand Weapon / Sharp Stuff (`:53`, `:89`, `:95`) | `bf71-422e-240b-826a` (min `7d69-1827-de87-9e81`) / `abdb-bbd0-41b2-5dff` via `248f-6615-7784-6ee2` (min `4900-c70c-5758-7677`, max `3f7e-2494-405b-9cc8`) / `5545-fcf3-a765-9474` via `c417-d17b-7230-57bb` (min `3721-5eca-db0b-f875`, max `10a7-ec54-8963-c662`) |
| **SelectionEntry „Gnoblar Trappers"** (`:121`, `type="unit"`, Core primär) — Träger 2 | **`041b-7d95-6ff9-754a`** |
| — **die bewegte Grenze** max **1**, `field="selections" scope="parent"` (`:141`) | **`28cd-8b7f-3d0f-1546`** |
| — `increment +1` auf diese Id mit derselben `repeat`-Zelle (`:123-127`) | `childId=735e-2da1-6356-2fdb` |
| — Pflichtkinder: Modelle / Hand Weapon / Sharp Stuff (`:154`, `:190`, `:196`) | `a6fc-a76c-6d8d-31a0` (min `5139-da17-6c0c-5419`) / `abdb-bbd0-41b2-5dff` via `76f8-9d1f-6e05-cef7` / `5545-fcf3-a765-9474` via `2fbc-0257-8771-cf03` |
| Kategorie „Core" (`.gst`) — Primärkategorie beider Gnoblar-Einheiten, `min 2` (nicht assertiert) | `64bf-efb4-9978-26df` — `35c2-d478-392a-aeb1` |
| Kategorie „General" (`.gst`) — armeeweite Pflicht (nicht assertiert) | `a37e-7207-de6d-acb0` — `1077-7379-f142-f382` |
| „Border Patrols rules" — Gatter der inerten `add category`-Modifikatoren | `4e15-0353-165f-5528` (Zielkategorie `6ad6-f54e-1867-00a7`) |
