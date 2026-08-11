# E2E-Regeln & Testkatalog: `notEqualTo` auf `limit::<costTypeId>` (`scope="roster"`, `childId="any"`) — die 500-Punkte-Klammer am Paladin Battle Standard Bearer

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte (`actual`/`bound`, `effectiveMin`) sind
**ausschliesslich** aus den Katalogdaten der *6th Definitive Edition*
(`src/evaluator/__fixtures__/whfb6-definitive/`) und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§5.6 / §7.6 / §7.7 / §8 / §13.2) abgeleitet — nicht aus einem Engine-Lauf. Die
Roster-Form ist an den bereits verifizierten Szenarien nachgebildet (direktes
`entryId` mit `entryLinkId=""`, verlinkte Auswahlen mit `entryId` = Ziel und
`entryLinkId` = Verweis, verschachtelte `selections` mit `number`, `costLimits`
mit `typeId`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Bretonnia (6th definitive edition).cat` (`a5c3-073c-b4e8-4284`,
  rev 1, Z. 2) — Kontingent **„Standard (BR-AB)"** `3a8b-8c11-beff-0534`
  (Z. 5743)
- Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`) — per `catalogueLink 99a3-c59a-d610-9847` deklarierte
  Abhaengigkeit (Z. 5848) und deshalb im Datensatz mitgefuehrt.

> **Assertion-Form:** Je Roster ein `expect.capabilities[]`-Eintrag auf dem Slot
> der Einheit (`defId` = `2f57-db88-56b5-180f`, `frameDefId` = das Kontingent)
> mit `current` / `effectiveMin` / `effectiveMax` / `headroom` / `isHidden` /
> `isMandatoryUnmet`, dazu `expect.firing` / `expect.absent` fuer die gegatterte
> Grenze `49e3-c542-6bff-9805`. Die `condition` selbst ist **keine** zaehlende
> Grenze und taucht im Verletzungsbericht nie auf; beobachtbar ist allein ihre
> Wirkung auf den Constraint-Wert. Weitere Armeeaufbau-Diagnosen
> (General-Pflicht, Core-Pflicht, Autor-Meldungen des Border-Patrols-Eintrags)
> duerfen zusaetzlich auftreten — die Erwartung ist selektiv.

---

## Das Konstrukt am Eintrag (Bretonnia-`.cat` Z. 2513, 2701–2730)

```xml
<selectionEntry id="2f57-db88-56b5-180f" name="Paladin Battle Standard Bearer"
                hidden="false" collective="false" import="true" type="unit">
  …
  <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="60"/>…</costs>
  <constraints>
    <constraint type="min" value="0" field="selections" scope="force"
                shared="true" id="49e3-c542-6bff-9805"
                includeChildSelections="false"/>
  </constraints>
  <modifiers>
    <modifier type="set" value="true" field="hidden">                    <!-- (1) -->
      <conditions>
        <condition type="atLeast" value="1" field="selections" scope="force"
                   childId="4e15-0353-165f-5528" shared="true"
                   includeChildSelections="true" childName="Border Patrols rules"/>
      </conditions>
    </modifier>
    <modifier type="set" value="0" field="49e3-c542-6bff-9805">          <!-- (2) -->
      <conditions>
        <condition type="atLeast" value="1" field="selections" scope="force"
                   childId="4e15-0353-165f-5528" shared="true"
                   includeChildSelections="true" childName="Border Patrols rules"/>
      </conditions>
    </modifier>
    <modifier type="set" value="1" field="49e3-c542-6bff-9805">          <!-- (3) -->
      <conditionGroups>
        <conditionGroup type="or">
          <conditions>
            <condition type="notEqualTo" value="500"
                       field="limit::ecfa-8486-4f6c-c249" scope="roster"
                       childId="any" shared="true" includeChildSelections="true"
                       childName="Border Patrols rules" includeChildForces="true"/>
            <condition type="lessThan" value="1" field="selections" scope="force"
                       childId="4e15-0353-165f-5528" shared="true"
                       includeChildSelections="true" childName="Border Patrols rules"/>
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifier>
  </modifiers>
</selectionEntry>
```

Der Eintrag traegt **keine** `<modifierGroups>` — beide Orte sind geprueft
(Fallstrick-Kasten §7.7). Die drei Modifikatoren oben sind vollstaendig; die
weiteren Modifikatoren des Eintrags haengen an seinem `<infoLink>` „Paladin"
(Z. 2732–2753) und rechnen nur am Ruestungswurf des Profils.

### Wie die Formatreferenz diese Teile liest

- **`field="limit::<costTypeId>"`** ist laut §7.7 (Tabelle `condition`) und
  §13.2 das **Kostenlimit (Budget) der Roster** — der eingestellte Wert aus
  `<costLimits>`, **nicht** die verplante Summe. `scope="roster"` +
  `includeChildForces="true"` spannt den Rahmen ueber die ganze Roster;
  `childId="any"` benennt kein Zaehlziel, weil an einem Budget nichts zu
  zaehlen ist.
- **`notEqualTo`** ist laut §7.7 ein Vergleichstyp neben `equalTo`,
  `lessThan`, `greaterThan`, `atLeast`, `atMost`. Es ist die exakte Negation
  von `equalTo`: es haelt bei **jedem** Wert ausser dem geschriebenen — bei 499
  **und** bei 501, nicht nur unterhalb oder nur oberhalb.
- **`type="set"` auf `field="<constraint-id>"`** ersetzt den Wert dieses
  Constraints (§7.6/§7.7: „Modifier adressieren einen Constraint ueber dessen
  `id`", „der `value` **ersetzt** den Feldwert"). Halten die Bedingungen nicht,
  bleibt der **geschriebene** Rohwert stehen — hier `0`.
- **Zwei `set` auf dieselbe Grenze werden in Dokumentreihenfolge angewandt.**
  §7.6 haelt fuer den Sentinel-Fall ausdruecklich fest: „ein **spaeterer** `set`
  auf einen konkreten Wert **ueberschreibt**". Halten also (2) und (3)
  gleichzeitig, gewinnt (3) — das ist genau die Lage bei Border Patrols mit
  Budget 499/501.
- **`conditionGroup type="or"`** haelt, wenn **mindestens ein** Mitglied haelt
  (§7.7).
- **`constraint … scope="force"`** an einem Wurzel-`selectionEntry` mit
  **Eintrags**-Ziel zaehlt dieses Ziel **pro Kontingent** (Ziel-Typ-Regel §7.7 /
  ADR 0029). Gezaehlt werden die Auswahlen dieser Einheit im Kontingent.
- **Sichtbarkeit vor Mindestmass:** Die Min-Grenzen einer effektiv versteckten
  Entitaet werden **nicht** validiert — die §5.6-Regel, per Projektentscheidung
  (Issue 0088) in §8 auf **alle** Ankerarten verallgemeinert, ausdruecklich
  einschliesslich `selectionEntry`. Max-Grenzen bleiben davon unberuehrt.

### Warum die Klammer „Border Patrols rules" braucht

Die `or`-Gruppe hat zwei Zweige. Der zweite („weniger als 1 Border-Patrols-
Auswahl im Kontingent") haelt in **jeder** Roster ohne diesen Schalter — dort
steht das Mindestmass also **immer** auf 1, unabhaengig vom Budget. Die
Budget-Klammer ist folglich **nur** in Rostern beobachtbar, die „Border Patrols
rules" fuehren: erst dann faellt der zweite Zweig aus, und der erste
(`notEqualTo 500`) entscheidet allein. Genau deshalb tragen die Roster 01–03
und 05 diese Auswahl und die Roster 04/06 nicht.

Der Schalter ist ein **Wurzel-`selectionEntry` der `.gst`**
(`4e15-0353-165f-5528`, Z. 17584) mit der Primaerkategorie *Special list rules*
(`32f1-197f-d719-a393`); das Kontingent „Standard (BR-AB)" fuehrt genau diese
Kategorie (`categoryLink 35a2-da12-8848-e83a`, Z. 5746) — die Auswahl gehoert
also in diese Force. Dass er bei Budget 499/501 durch sein **eigenes** Gatter
(`equalTo 500` auf `limit::…`) verborgen ist, aendert nichts daran, dass er im
Roster steht und gezaehlt wird; die Nachbarszenarien
[`border-patrols-rules-unit-count-gate`](../border-patrols-rules-unit-count-gate/README.md)
(BPU-R7) und
[`at-least-roster-border-patrols-gate`](../at-least-roster-border-patrols-gate/README.md)
pinnen dieselbe Lage.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Zeilenangaben ohne Dateipraefix beziehen sich auf
`Bretonnia (6th definitive edition).cat`.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **NETR-R1** | **Der Traeger und seine eine Grenze.** Die Wurzel-Einheit „Paladin Battle Standard Bearer" (`type="unit"`, `hidden="false"`, 60 pts) traegt auf ihrer Wurzelebene **genau einen** Constraint: `type="min" value="0" field="selections" scope="force" shared="true" includeChildSelections="false"`. Der **geschriebene** Wert ist `0` — ohne Modifikator ist das Mindestmass dieses Slots also 0, nicht „keines". Ein **Hoechstmass** gibt es nicht ⇒ `effectiveMax`/`headroom` = `null`. | `selectionEntry 2f57-db88-56b5-180f` Z. 2513 (direktes Kind des Wurzel-`<selectionEntries>`, Z. 8–3441); `constraint 49e3-c542-6bff-9805` Z. 2707; `costs` Z. 2701–2705. |
| **NETR-R2** | **Die Bedingung liest das konfigurierte Budget.** `field="limit::ecfa-8486-4f6c-c249"` benennt das Kostenlimit der Punkte-Kostenart, `scope="roster"` + `includeChildForces="true"` den ganzen Roster-Rahmen, `childId="any"` kein Zaehlziel. Verglichen wird der Wert aus `<costLimits>`, nicht die Summe der Auswahlen. | `condition` Z. 2724; Kostenart `costType "pts" ecfa-8486-4f6c-c249` (`.gst` `<costTypes>`); Format §7.7 (`limit::<costTypeId>` = „das **Kostenlimit** der Roster") und §13.2. |
| **NETR-R3** | **`notEqualTo 500` haelt bei 499 und bei 501, nicht bei 500.** Der Vergleich ist die exakte Negation von `equalTo` — beidseitig scharf, also weder `lessThan 500` noch `greaterThan 500` noch `atMost`/`atLeast`. | `condition type="notEqualTo" value="500"` Z. 2724; Format §7.7 (Vergleichstypen). |
| **NETR-R4** | **Border Patrols senkt das Mindestmass auf 0.** Modifikator (2) — `set value="0" field="49e3-c542-6bff-9805"` — haelt, sobald mindestens **eine** Auswahl `4e15-0353-165f-5528` im Kontingent steht. | Modifikator Z. 2715–2719, Bedingung Z. 2717; Schalter `.gst` Z. 17584. |
| **NETR-R5** | **Der spaetere `set 1` gewinnt.** Modifikator (3) steht **nach** (2) in denselben `<modifiers>`. Halten beide (Border Patrols vorhanden **und** Budget ≠ 500), ist der Endwert **1**. §7.6 haelt genau das fest: „ein spaeterer `set` auf einen konkreten Wert ueberschreibt". | Modifikatoren Z. 2715 und Z. 2720 in Dokumentreihenfolge; Format §7.6 (Sentinel-Kasten) und §7.7 (`set` ersetzt). |
| **NETR-R6** | **Die `or`-Gruppe hat einen zweiten, budget-unabhaengigen Zweig.** `lessThan 1` auf dieselbe Border-Patrols-Auswahl im Kontingent haelt in jeder Roster **ohne** den Schalter. Bei Budget exakt 500 **ohne** Border Patrols ist damit der erste Zweig falsch, der zweite wahr — die Grenze steht auf **1**. | `conditionGroup type="or"` Z. 2722–2727 mit den Bedingungen Z. 2724 (`notEqualTo`) und Z. 2725 (`lessThan 1`); Format §7.7 (`or` haelt bei mindestens einem Mitglied). |
| **NETR-R7** | **Derselbe Ausloeser verbirgt die Einheit.** Modifikator (1) — `set hidden="true"` — haengt an **derselben** Bedingung wie (2). In jeder Roster mit Border Patrols ist die Einheit also effektiv versteckt (`isHidden` **true**), in jeder anderen behaelt sie ihren Basiswert `hidden="false"`. | Modifikator Z. 2710–2714, Basis `hidden="false"` Z. 2513; Format §8 (`set hidden` ersetzt, sonst gilt der Basiswert). |
| **NETR-R8** | **Deshalb wird das gehobene Mindestmass in den Border-Patrols-Rostern nicht gemeldet.** §5.6 verbietet die Validierung der Mindestgrenzen einer effektiv versteckten Entitaet; §8 verallgemeinert das (Issue 0088) auf **jede** Ankerart, `selectionEntry` eingeschlossen: „ein Verstoss ueber etwas, das nicht angeboten wird, waere fuer den Nutzer unbehebbar". `49e3-c542-6bff-9805` steht in den Rostern 01/02/03/05 darum in `absent`; der **Faehigkeitsdatensatz** traegt den verschobenen Wert trotzdem und wird dort ueber `effectiveMin` behauptet. | Format §5.6 (Kasten „Regeln zur Auswertung") und §8 (dritter Aufzaehlungspunkt); dieselbe Konstellation ist im Nachbarszenario [`offer-and-category-slots`](../offer-and-category-slots/README.md) als **OCS-R7** gepinnt („Army of Sylvania": versteckter Wurzeleintrag mit `min 1` ⇒ Grenzen in `absent`, `effectiveMin 1` am Slot). |
| **NETR-R9** | **Ohne Border Patrols ist die Einheit sichtbar — dort feuert die Grenze.** Modifikator (1) bleibt aus, `hidden` bleibt `false`, die Min-Grenze ist validierbar. Mit **null** Auswahlen der Einheit im Kontingent gilt Ist **0** gegen Grenze **1**. | Modifikator Z. 2710–2714 (Bedingung nicht erfuellt); Constraint Z. 2707 mit `set 1` aus Z. 2720; Zaehlrahmen `scope="force"` (§7.7 / ADR 0029). |
| **NETR-R10** | **Die Einheit ist im Kontingent „Standard (BR-AB)" ueberhaupt platzierbar.** Ihre einzige (primaere) Kategorie ist *Heroes*, und das Kontingent fuehrt genau diesen `categoryLink`. Die Kategorie *Heroes* traegt nur `max -1` (= unbegrenzt) und keine Untergrenze, kann das Bild also nicht verfaelschen. | `categoryLink 3db5-b68e-4f7c-3f18 → c16b-f319-2c62-2c12` Z. 2515; `forceEntry 3a8b-8c11-beff-0534` mit `categoryLink 3397-7096-b838-dc92 → c16b…` Z. 5780; `.gst` `categoryEntry "Heroes" c16b-f319-2c62-2c12` Z. 366 mit `constraint 7fca-63fb-63d2-9dad` (`max -1`, `scope="force"`, ohne Modifikatoren) Z. 368. |
| **NETR-R11** | **Es gibt genau einen Slot fuer diese Definition.** In den drei Dateien des Datensatzes kommt die Id `2f57-db88-56b5-180f` **einmal** vor (die Definition selbst) — kein `entryLink` zeigt auf sie. `defId` + `frameDefId` trifft den Slot also eindeutig. Ebenso ist `49e3-c542-6bff-9805` nur dreimal belegt: als Constraint-Id und als `field` der beiden `set`-Modifikatoren. | Volltextsuche ueber `src/evaluator/__fixtures__/whfb6-definitive/`: 4 Treffer, alle in der Bretonnia-`.cat` (Z. 2513, 2707, 2715, 2720). |
| **NETR-R12** | **Die Pflichtbausteine der Einheit (nur Roster 06).** Wird die Einheit gewaehlt, verlangt sie: Gruppe *Vow* `min 1`/`max 1`, Gruppe *Mounts* `min 1`/`max 1`, `entryLink` Hand Weapon `min 1`/`max 1`, `entryLink` Heavy Armour `min 1`/`max 1`, `entryLink` Battle Standard Bearer `min 1`, und unterhalb des Warhorse der `entryLink` Barding `min 1`/`max 1`. Die Gruppe *Magic items and Virtues* hat **keine** Untergrenze (nur `max 50` Punkte) und bleibt leer. Roster 06 erfuellt alle; sie stehen darum in `absent`. | Gruppe *Vow* `4b79-3757-d1d4-9a17` Z. 2518 (`0c47-2ef9-e407-8b7b` / `d8cf-9e06-e8c2-9424`, Z. 2520/2521), Gruppe *Magic items and Virtues* `00be-ff08-988e-b7c3` Z. 2537 (`a4c9-58d6-78d6-c00e`, `max 50 pts`, Z. 2539), Gruppe *Mounts* `9e31-9ef0-c80e-9f13` Z. 2622 (`2cfb-d87d-9c5c-9bf1` / `95ad-0ada-c201-8d16`, Z. 2624/2625), Hand Weapon `bf9f-df49-03bb-18b6` Z. 2677 (`8656…` / `202d…`), Heavy Armour `a26f-1032-b1e9-31ba` Z. 2683 (`d3ae…` / `7a16…`), BSB-Verweis `266c-d6c8-c9cf-4ec6` Z. 2689 (`e1ff-e836-5a85-1e4f`, Z. 2694), Barding-Verweis `324e-6dd8-2afa-e687` Z. 2657 (`b8cd…` / `498b…`). |
| **NETR-R13** | **Der gewaehlte Bannertraeger reisst in Roster 06 keine Grenze.** Der Pflicht-Verweis zieht den geteilten `.gst`-Eintrag „Battle Standard Bearer" samt seiner Kategorie *Battle standard bearer* herein. Dessen Grenzen sind `max 1` (roster), `max 1` (parent) sowie an der `categoryEntry` `max 1` (parent) und `max 1` (force). Roster 06 fuehrt **keine** Border-Patrols-Auswahl, die Force-Grenze bleibt also bei 1 und ist mit einem Bannertraeger eingehalten. | `.gst` `selectionEntry e9ad-f1ce-aebf-6d23` Z. 799 (`082b-067c-b983-c393` Z. 801, `01a5-106d-f6e8-560b` Z. 802, `categoryLink 9968-62a6-6d39-ac81` Z. 810); `categoryEntry 2ef7-3efe-a448-423f` Z. 728 (`6935-5f06-39d4-5f45` Z. 730, `2a1d-03a1-b48c-64ad` Z. 731) mit `modifier set 0` unter `atLeast 1 childId="4e15…"` Z. 734–739 — hier **nicht** ausgeloest. |
| **NETR-R14** | **Kein Punkteverstoss, keine Lord-Ueberschreitung.** Verplant sind 0 pts (01–04), 50 pts (05: 10 Modelle à 5 pts, Ausruestung je 0 pts) und 74 pts (06: 60 Einheit + 14 Warhorse; Barding, Hand Weapon, Heavy Armour und der BSB-Verweis tragen **am Link** 0 pts) — jeweils weit unter 499/500/501. Die Lord-Grenze des Kontingents steht bei diesen Budgets auf `max 0` (ihre Modifikatoren verlangen ≥ 1000 bzw. ≥ 2000 Punkte oder ein negatives Budget) und wird mit **null** Lord-Auswahlen nicht gerissen. | Kosten: Z. 2702 (60), Z. 3493 (Warhorse 14), Z. 2663 (Barding-Verweis 0 — die Definition kostet 6, `.gst` Z. 1024, doch die Kosten liegen am Link, §9.3), Z. 2691 (BSB-Verweis 0 — Definition 25, `.gst` Z. 805), `.gst` Z. 1041/946 (Hand Weapon / Heavy Armour 0), Z. 3465 (Knights Vow 0), Z. 1259 (Men-at-Arms-Modell 5), Z. 1392 (Men-at-Arms-Einheit 0), `.gst` Z. 959/969/1014 (Light Armour / Shield / Halberds 0). Lord: `categoryLink d1d3-6362-e2f7-23c9` mit `constraint d7e7-599d-12cf-1fd1` (`max 0`) Z. 5755–5757, Modifikatoren Z. 5760–5777. |
| **NETR-R15** | **Beiwerk in Roster 05.** Die Einheit „Men at Arms" ist primaer *Core*; unter Border Patrols senkt ein `.gst`-Modifikator die Core-Pflicht von `min 2` auf `min 1`, die mit dieser einen Einheit erfuellt ist. Ihre Modell-Obergrenze ist roh `-1` und wird unter Border Patrols auf `25` gesetzt — 10 Modelle halten sie ein, die Untergrenze `min 10` ist exakt erfuellt. Die Kategorie-Umhaengung Core→Special der Einheit haengt an `equalTo 1` Auswahlen von „Louen Leoncoeur" und bleibt aus. | `selectionEntry fcdd-429a-3b79-7e8d` Z. 1245, `categoryLink ff2d-a7a9-3e82-9e93 → 64bf…` Z. 1250; Modell `da0d-5502-7555-866c` Z. 1253 (`fa95-2d58-682d-de1f` `min 10` Z. 1255, `97c4-7637-0263-8fdf` `max -1` Z. 1256, `set 25` unter Border Patrols Z. 1283–1288); `modifierGroup` Core→Special Z. 1396–1409 (`equalTo 1` auf `a52d-f77d-1227-be91`); `.gst` `categoryEntry "Core" 64bf-efb4-9978-26df` Z. 372 mit `35c2-d478-392a-aeb1` (`min 2`) Z. 374 und `set 1` unter Border Patrols Z. 377–382. |

### Warum `effectiveMin: 0` und nicht `null`

Der Manifest-Vertrag liest `effectiveMin: null` als „**kein** Mindestmass". In
den Rostern 01 und 05 existiert aber sehr wohl eines — der Katalog schreibt
`type="min" value="0"` hin (NETR-R1), und Modifikator (2) setzt es auf denselben
Wert `0`. Die Daten fordern deshalb `0`. Der Sentinel `-1` („unbegrenzt") gilt
laut §7.6 nur dort, wo er **hingeschrieben** steht, und ist hier nirgends
geschrieben; eine Normalisierung „min 0 ⇒ kein Mindestmass" ist im Format nicht
belegt. Dieselbe Ableitung traegt das Nachbarszenario
[`not-instance-of-force-gate`](../not-instance-of-force-gate/README.md).
Meldet die Engine `null`, ist das eine **Abweichung zum Untersuchen**, nicht zum
Wegdefinieren (ADR 0033).

### Welcher Kanal je Roster traegt — Verletzung oder `effectiveMin`?

| Roster | Einheit effektiv sichtbar? | behauptet ueber |
|--------|-----------------------------|------------------|
| 01 (BP, 500) | nein (`isHidden true`, NETR-R7) | `effectiveMin 0` **und** `absent` — die Grenze ist ohnehin erfuellt, die Abwesenheit haengt also nicht an der Sichtbarkeitsregel |
| 02 (BP, 499) | nein | **nur** `effectiveMin 1`; `49e3…` steht in `absent`, weil §5.6/§8 die Min-Meldung eines versteckten Traegers verbietet (NETR-R8) |
| 03 (BP, 501) | nein | wie 02 |
| 04 (ohne BP, 500) | **ja** (`isHidden false`) | **feuernde Grenze** `49e3…` Ist 0 / Grenze 1 (NETR-R9) **und** `effectiveMin 1` |
| 05 (BP, 500, 50 pts verplant) | nein | `effectiveMin 0` **und** `absent` (wie 01) |
| 06 (ohne BP, 500, Einheit gewaehlt) | **ja** | `effectiveMin 1` bei Ist 1 ⇒ `absent`, ohne Sichtbarkeitsvorbehalt |

Die Aussage „ein Punkt Budget kippt das Mindestmass" wird also in der
Border-Patrols-Familie **ausschliesslich** ueber `effectiveMin` getragen
(01 ↔ 02/03, 01 ↔ 05); die Aussage „eine gehobene Pflicht ist eine echte,
meldepflichtige Grenze" traegt Roster 04, und Roster 06 zeigt, dass dieselbe
Grenze durch eine Auswahl erfuellbar ist.

### Bewusst ausgelassene Facetten

| Facette | Warum nicht behauptet |
|---------|------------------------|
| Die `condition` selbst als Bericht-Eintrag | Eine `condition` ist keine `constraint`; der Verletzungsbericht kodiert zaehlende Grenzen, keine Bedingungen. Beobachtbar ist allein der gesetzte Constraint-Wert. |
| Der `set hidden=true`-Modifikator als eigene Zelle | Das Sichtbarkeits-Gatter auf denselben Ausloeser ist Gegenstand von [`at-least-roster-border-patrols-gate`](../at-least-roster-border-patrols-gate/README.md). Hier wird `isHidden` nur **mitgepinnt**, weil es entscheidet, ob eine Min-Grenze ueberhaupt gemeldet werden darf (NETR-R8). |
| `anchorKind` des Slots | Ob ein Slot mit gehobener Pflicht als `mandatoryPhantom` und derselbe Slot mit `min 0` als `offerAnchor` gefuehrt wird, ist eine Aussage ueber die Slot-Taxonomie der Engine, nicht ueber die Katalogdaten. Das Manifest benennt den Slot deshalb ueber `defId` + `frameDefId`. |
| Die scharfe Gegenprobe „Budget ≠ 500 **bei exakt 500 verplanten Punkten**" | Sie wuerde die Budget-Lesart in die **andere** Richtung einklemmen, verlangt aber eine punktgenaue 500er-Liste im Bretonnia-Katalog. Roster 05 erreicht dieselbe Trennung mit 50 verplanten Punkten bei Budget 500: unter der Summen-Lesart waere die Bedingung dort wahr und `effectiveMin` 1 statt 0. |
| Die Autor-Meldungen des Border-Patrols-Eintrags (2–4 Einheiten, Infanterie 10+) | Eigenes Szenario ([`border-patrols-rules-unit-count-gate`](../border-patrols-rules-unit-count-gate/README.md)); sie sind keine zaehlenden Grenzen und stehen darum weder in `firing` noch in `absent`. |
| Die General-Pflicht (`1077-7379-f142-f382`, `min 1` an der `categoryEntry`) und die Core-Pflicht in den Rostern ohne Core-Auswahl | Beide feuern erwartungsgemaess, sind aber Armeeaufbau-Rauschen und nicht Gegenstand dieses Szenarios; die Erwartung ist selektiv. Wo die Core-Pflicht **erfuellt** ist (Roster 05), wird sie ausdruecklich als abwesend gepinnt. |
| `scope="force"` ueber **mehrere** Kontingente | Alle Roster haben genau ein Kontingent. Ob ein `scope="force"`-Eintragsziel pro Detachment zaehlt, ist eine eigene Facette (§7.7 / ADR 0029). |
| Der Eintrag „On Foot" (`f037-166c-233d-fa02`) als Mount in Roster 06 | Seine Obergrenze `9d8d-10e9-acdd-cd98` (roh `-1`) wird per `set 0` gesenkt, sobald die Einheit **keine** „Virtue of Empathy" (`7253-c4c4-e42b-fc1a`) fuehrt (Z. 2635–2639) — ein eigenes Muster. Roster 06 nimmt deshalb den Bretonnian Warhorse (14 pts) samt Pflicht-Barding. |

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen
gegen **denselben** Datensatz (`.gst` + Bretonnia + Mercenaries) und dasselbe
Kontingent „Standard (BR-AB)" (`3a8b-8c11-beff-0534`).

| # | Testtitel | Roster-Zustand | Zweig / Auswertung | Erwartetes Ergebnis | Fixture |
|---|-----------|----------------|--------------------|---------------------|---------|
| 01 | Budget **500** mit Border Patrols → Mindestmass **0** | `costLimit` 500, genau eine Auswahl „Border Patrols rules", sonst leer | `notEqualTo`: 500 = 500 ⇒ **haelt nicht**; `lessThan 1` BP: 1 ⇒ **haelt nicht** ⇒ (3) bleibt aus, (2) setzt 0 | `49e3…` **absent**; Slot: `current 0`, `effectiveMin` **0**, `isHidden true`, `isMandatoryUnmet false` | [`01-border-patrols-budget-500-min-stays-0.ros`](rosters/01-border-patrols-budget-500-min-stays-0.ros) |
| 02 | Budget **499** → Mindestmass **1** | **Identisch** zu 01, nur `costLimit` 499 | `notEqualTo`: 499 ≠ 500 ⇒ **haelt** ⇒ (3) ueberschreibt (2) | `49e3…` **absent** (versteckter Traeger, NETR-R8); Slot: `effectiveMin` **1**, `isMandatoryUnmet true`, `isHidden true` | [`02-border-patrols-budget-499-min-raised-1.ros`](rosters/02-border-patrols-budget-499-min-raised-1.ros) |
| 03 | Budget **501** → Mindestmass **1** | **Identisch** zu 01, nur `costLimit` 501 | 501 ≠ 500 ⇒ **haelt**; zusammen mit 02 beidseitig eingeklemmt | wie 02 | [`03-border-patrols-budget-501-min-raised-1.ros`](rosters/03-border-patrols-budget-501-min-raised-1.ros) |
| 04 | Budget **500 ohne** Border Patrols → Mindestmass **1**, Grenze feuert | `costLimit` 500, **leeres** Kontingent | erster Zweig falsch (500 = 500), **zweiter** Zweig wahr (0 BP-Auswahlen) ⇒ (3) setzt 1; (1) bleibt aus ⇒ sichtbar | `49e3…` **feuert** Ist **0** / Grenze **1**; Slot: `effectiveMin 1`, `isHidden false`, `isMandatoryUnmet true` | [`04-no-border-patrols-budget-500-min-raised-1.ros`](rosters/04-no-border-patrols-budget-500-min-raised-1.ros) |
| 05 | Budget **500**, **50 Punkte verplant** → Mindestmass **0** | wie 01 plus eine Einheit „Men at Arms" (10 Modelle + Pflichtausruestung, 50 pts) | Budget bleibt 500 ⇒ `notEqualTo` haelt nicht. Unter der **Summen**-Lesart waere der Vergleich 50 ≠ 500 und das Mindestmass 1 | `49e3…` **absent**; Slot: `effectiveMin` **0**; zusaetzlich als abwesend gepinnt: Core-Pflicht (auf 1 gesenkt, erfuellt) und alle Grenzen der Einheit | [`05-border-patrols-budget-500-spent-50-min-stays-0.ros`](rosters/05-border-patrols-budget-500-spent-50-min-stays-0.ros) |
| 06 | Gehobene Pflicht **erfuellt** (positive Kontrolle zu 04) | `costLimit` 500, **kein** Border Patrols, **ein** vollstaendig ausgeruesteter „Paladin Battle Standard Bearer" (74 pts) | Mindestmass wie in 04 auf **1**, Ist **1** | `49e3…` **absent**, `isMandatoryUnmet false`; Slot: `current 1`, `effectiveMin 1`, `isHidden false` | [`06-no-border-patrols-budget-500-paladin-selected.ros`](rosters/06-no-border-patrols-budget-500-paladin-selected.ros) |

### Die Matrix, die das Szenario aufspannt

Zelle = `effectiveMin` / `current` / feuert `49e3-c542-6bff-9805`:

| Budget | **mit** „Border Patrols rules" | **ohne** |
|--------|--------------------------------|----------|
| 499 | 02: **1** / 0 / nein (versteckt) | — |
| **500** | 01: **0** / 0 / nein · 05: **0** / 0 / nein (50 pts verplant) | 04: **1** / 0 / **ja** · 06: **1** / 1 / nein |
| 501 | 03: **1** / 0 / nein (versteckt) | — |

**Paarbildung der Kernaussagen** — jedes Paar unterscheidet sich in **genau
einer** Eigenschaft:

| Aussage | still / 0 | kippt / 1 | Einziger Unterschied |
|---------|-----------|-----------|----------------------|
| `notEqualTo` ist beidseitig scharf | 01 (`effectiveMin 0`) | 02 und 03 (`effectiveMin 1`) | der `<costLimits>`-Wert (500 vs. 499 / 501) |
| gelesen wird das **Budget**, nicht die Summe | 05 (`effectiveMin 0` bei 50 verplanten pts) | 02 (`effectiveMin 1` bei 0 verplanten pts, Budget 499) | Budget bzw. verplante Summe |
| die `or`-Klammer | 01 (`effectiveMin 0`) | 04 (`effectiveMin 1`, Grenze feuert) | die eine Auswahl „Border Patrols rules" |
| die gehobene Pflicht ist erfuellbar | 06 (Ist 1, still) | 04 (Ist 0, feuert) | die gewaehlte Einheit |

**Punktekontrolle (nicht Teil der Assertion):** Roster 01–04 verplanen 0 pts,
Roster 05 exakt 50 pts (10 × 5 pts Modell; Hand Weapon, Light Armour, Shield,
Halberds und die Einheit selbst je 0 pts), Roster 06 exakt 74 pts (60 Einheit +
14 Warhorse; Knights Vow, Barding, Hand Weapon, Heavy Armour und der
BSB-Verweis tragen am Link je 0 pts). Alle liegen unter jedem der drei Budgets
(NETR-R14).

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehoert (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemaess heiklen Stellen:

1. **NETR-R2** — ob `limit::<costTypeId>` das **eingestellte** Budget liest und
   nicht die verplante Summe. Roster 05 macht den Unterschied maximal (50 vs.
   500), Roster 01 zeigt ihn schon bei 0 verplanten Punkten.
2. **NETR-R3** — ob `notEqualTo` **beidseitig** scharf ist. Eine Lesart als
   `lessThan` liesse Roster 03 (501) auf `effectiveMin 0` fallen, eine als
   `greaterThan` Roster 02 (499).
3. **NETR-R5** — ob zwei `set` auf dieselbe Grenze in **Dokumentreihenfolge**
   angewandt werden. In der umgekehrten Reihenfolge stuenden die Roster 02/03
   auf `effectiveMin 0`.
4. **NETR-R8** — ob die Min-Grenze eines effektiv **versteckten** Traegers
   wirklich unterdrueckt wird (§5.6/§8, Issue 0088) **und** der
   Faehigkeitsdatensatz sie trotzdem traegt. Meldet der Bericht `49e3…` in 02/03
   als Verletzung, widerspricht das §8; fehlt umgekehrt der Slot ganz, ist das
   verschobene Mindestmass unbeobachtbar — beides waere zu untersuchen.
5. **NETR-R9** — ob die gehobene Grenze im **sichtbaren** Fall (Roster 04) mit
   `actual 0` / `bound 1` feuert; sie ist die einzige Verletzung, die dieses
   Szenario positiv fordert.
6. Die Slot-Adressierung `defId 2f57-db88-56b5-180f` + `frameDefId
   3a8b-8c11-beff-0534` muss **genau einen** Slot treffen (NETR-R11).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort |
|---------|-----|---------|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` | `.gst` Wurzel |
| Katalog **Bretonnia** (rev 1) | `a5c3-073c-b4e8-4284` | `.cat` Z. 2 |
| Bibliothek **Mercenaries** (per `catalogueLink` `99a3-c59a-d610-9847`) | `fc47-8392-a6c8-452a` | `.cat` Z. 5848 |
| Kontingent „Standard (BR-AB)" (Rahmen aller Roster) | `3a8b-8c11-beff-0534` | `.cat` Z. 5743 |
| **Traeger:** Wurzel-`selectionEntry` „Paladin Battle Standard Bearer" (`type="unit"`, `hidden="false"`, 60 pts) | `2f57-db88-56b5-180f` | `.cat` Z. 2513 |
| **Die gegatterte Grenze** (`min`, Rohwert 0, `field="selections"`, `scope="force"`, `shared="true"`, `includeChildSelections="false"`) | `49e3-c542-6bff-9805` | `.cat` Z. 2707 |
| Modifikator (1) `set hidden="true"` (Border-Patrols-Gatter) | — | `.cat` Z. 2710–2714 |
| Modifikator (2) `set value="0"` auf `49e3…` | — | `.cat` Z. 2715–2719 |
| Modifikator (3) `set value="1"` auf `49e3…` mit `or`-Gruppe | — | `.cat` Z. 2720–2729 |
| **Die `notEqualTo`-Bedingung** (`value="500"`, `field="limit::ecfa-8486-4f6c-c249"`, `scope="roster"`, `childId="any"`, `includeChildForces="true"`) | — | `.cat` Z. 2724 |
| Der zweite `or`-Zweig (`lessThan 1`, `scope="force"`, `childId="4e15…"`) | — | `.cat` Z. 2725 |
| Kostenart Punkte (Ziel von `limit::…` und der `costLimits`) | `ecfa-8486-4f6c-c249` | `.gst` `<costTypes>` |
| Schalter „Border Patrols rules" (`.gst`-Wurzeleintrag, Basis `hidden="true"`, `defaultAmount="1"`) | `4e15-0353-165f-5528` | `.gst` Z. 17584 |
| Eigene Grenze des Schalters (`max 1`, `scope="parent"`; als `absent`) | `fbfc-d43f-396d-09cc` | `.gst` Z. 17586 |
| Kategorie *Special list rules* (Primaerkategorie des Schalters; vom Kontingent gefuehrt) | `32f1-197f-d719-a393` (Links `fd54-fb51-2021-d3cd` / `35a2-da12-8848-e83a`) | `.gst` Z. 17592 / `.cat` Z. 5746 |
| Kategorie *Heroes* (Primaerkategorie der Einheit, `max -1`, ohne Modifikatoren; als `absent`) | `c16b-f319-2c62-2c12` — `7fca-63fb-63d2-9dad` | `.gst` Z. 366–369; Links `3db5-b68e-4f7c-3f18` (`.cat` Z. 2515) / `3397-7096-b838-dc92` (`.cat` Z. 5780) |
| Lord-Grenze des Kontingents (`max 0` bei Budgets < 1000; als `absent`) | `d7e7-599d-12cf-1fd1` | `.cat` Z. 5757 |
| Kategorie *Core* (`min 2`, unter Border Patrols `set 1`; in Roster 05 als `absent`) | `64bf-efb4-9978-26df` — `35c2-d478-392a-aeb1` | `.gst` Z. 372–382 |
| Gruppe *Vow* (`min 1`/`max 1`) und Option „Knights Vow" (0 pts) | `4b79-3757-d1d4-9a17` — `0c47-2ef9-e407-8b7b` / `d8cf-9e06-e8c2-9424`; `e432-4d78-0f50-1e35` (Verweis `3b2b-03e2-f4a8-3341`) | `.cat` Z. 2518–2524, 3457 |
| Gruppe *Mounts* (`min 1`/`max 1`), „Bretonnian Warhorse" (14 pts) mit Pflicht-„Barding" (0 pts am Link) | `9e31-9ef0-c80e-9f13` — `95ad-0ada-c201-8d16` / `2cfb-d87d-9c5c-9bf1`; `adc2-53db-4a9e-b8ea` (Verweis `1c57-1f3b-1548-9c09`); `3211-d836-02f1-01d0` (Verweis `324e-6dd8-2afa-e687`, `498b-b365-9935-5879` / `b8cd-247a-ff7f-b24e`) | `.cat` Z. 2622–2667 |
| Gruppe *Magic items and Virtues* (nur `max 50` Punkte, **keine** Untergrenze; als `absent`) | `00be-ff08-988e-b7c3` — `a4c9-58d6-78d6-c00e` | `.cat` Z. 2537–2539 |
| Pflicht-Verweise der Einheit: Hand Weapon / Heavy Armour / Battle Standard Bearer | `bf9f-df49-03bb-18b6` (`8656-36c0-be51-1596` / `202d-b37d-1be0-c756`), `a26f-1032-b1e9-31ba` (`d3ae-da4f-41e3-76c1` / `7a16-fe05-5f2f-ca9a`), `266c-d6c8-c9cf-4ec6` (`e1ff-e836-5a85-1e4f`) | `.cat` Z. 2677–2699 |
| Geteilter Eintrag „Battle Standard Bearer" (25 pts in der `.gst`, **0 pts am Bretonnia-Link**) samt Kategorie | `e9ad-f1ce-aebf-6d23` — `082b-067c-b983-c393` / `01a5-106d-f6e8-560b`, `categoryLink 9968-62a6-6d39-ac81 → 2ef7-3efe-a448-423f` (`6935-5f06-39d4-5f45` / `2a1d-03a1-b48c-64ad`) | `.gst` Z. 799–811, 728–740 |
| Einheit „Men at Arms" (Roster 05) mit Modell und Pflichtausruestung | `fcdd-429a-3b79-7e8d`; Modell `da0d-5502-7555-866c` (`fa95-2d58-682d-de1f` / `97c4-7637-0263-8fdf`); Verweise `22bb-d598-fe64-b69c` (`dff3…`/`d506…`), `5dcb-bb36-3782-fb40` (`fafd…`/`d325…`), `e536-f8de-d029-404d` (`bbc0…`/`4acc…`), Gruppe `b780-703d-62f4-2964` (`38bc-c48b-a7d8-445c`) mit `a800-5a70-1027-80ac` (`183d-963f-d395-3a34`) | `.cat` Z. 1245–1390 |
| Geteilte Ausruestungsdefinitionen (je 0 pts; ihre eigenen Grenzen als `absent`) | Hand Weapon `abdb-bbd0-41b2-5dff` (`bdef-ba9b-d6ce-5b14` / `e28e-dbb4-b8ad-d4ab`), Heavy Armour `dde4-0ba8-7b3c-57b7` (`40c1-e17a-2dd8-fba6`), Light Armour `055f-8e4e-f170-35d2` (`6f1a-1be1-6660-d9a6`), Shield `50e2-1873-a856-03e7` (`61e6-14a6-8422-d83a`), Halberds `b3f3-a133-2869-0be8` | `.gst` Z. 938–1018 |
| Roster-Budget-Regel (als `absent`) | `budget::ecfa-8486-4f6c-c249` | — |
