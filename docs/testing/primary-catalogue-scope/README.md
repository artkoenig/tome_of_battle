# E2E-Regeln & Testkatalog: `primary-catalogue` — der Armee-Katalog des Kontingents

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln
sind aus den Katalogdaten der *6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md` §7.7](../../battlescribe-data-format.md#primary-catalogue--der-armee-katalog-des-kontingents)
abgeleitet, nicht aus einem Engine-Lauf.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee A: `Ogre Kingdoms (6th definitive edition).cat` (`731d-5b13-2a92-5427`, rev 2)
  — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
- Armee B: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`, rev 1)
  — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`
- Gemeinsame Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — hier steht die geprüfte Regel

> **Id-Falle, ausdrücklich geprüft.** Im Repo liegen **zwei** eingefrorene
> Katalog-Ausschnitte. Maßgeblich für die Reinraum-Engine ist
> `src/evaluator/__fixtures__/whfb6-definitive/`. Der alte Solver-Ausschnitt
> `src/solver/__fixtures__/whfb6/` (laut [ADR 0030](../../adr/0030-zweite-eigenstaendige-auswertungs-engine.md)
> **keine** Referenz für die Reinraum-Engine) trägt für dieselben Armeen fast
> identische Ids — die Ogre-Wurzel endet dort auf **…5426**, hier auf **…5427**.
> Jede Id dieses Szenarios ist an Zeile 2 der jeweiligen Definitive-Datei bzw. an
> ihrer Fundstelle in `Mercenaries (6th definitive edition).cat` nachgeschlagen.

---

## Warum ein einzelnes Roster hier nichts belegt

Eine Bedingung mit diesem Bezugsrahmen fragt „ist der Armee-Katalog **dieses
Kontingents** der Katalog X?" (bzw. „ist er **nicht** X?"). Ein einzelnes Roster,
das zeigt „die Regel feuert nicht", unterscheidet nicht zwischen den zwei völlig
verschiedenen Gründen dafür:

1. der Rahmen wurde gelesen und die Antwort war „ja, also greift die Ausnahme", oder
2. der Rahmen wurde gar nicht gelesen und die Bedingung fiel still durch.

Beide Zustände sehen im Bericht gleich aus. **Der Nachweis ist deshalb das
Paar:** dieselbe Auswahl aus der gemeinsamen Mercenaries-Bibliothek, derselbe
Datensatz, dieselbe Anzahl — einmal in einer Armee, die das Kriterium erfüllt,
einmal in einer, die es nicht erfüllt, mit **gegenläufigem** Ergebnis. Die beiden
Roster 01 und 02 unterscheiden sich in **genau zwei Attributen**: dem `entryId`
und dem `catalogueId` ihres `<force>`-Elements. Ein Ergebnis, bei dem beide
Roster dasselbe sagen, kann dieses Szenario nicht bestehen.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PCS-R1** | `scope="primary-catalogue"` ist **kein Zählrahmen**, sondern die Frage nach dem Armee-Katalog des Kontingents; `childId` trägt die **Wurzel-`id` einer `.cat`**. `field="selections" value="1"` ist dabei die kanonische Schreibweise der Identitätsfrage. | Alle **27** Vorkommen im Definitive-Satz sind `<condition>` (18 × `instanceOf`, 9 × `notInstanceOf`), alle mit `field="selections" value="1" shared="true"`. Von 14 distinkten `childId` lösen genau die 3 im Satz vorhandenen auf **Katalog-Wurzeln** auf: `731d-5b13-2a92-5427` (Ogre), `4d73-5ab0-9020-403c` (VC), `4049-c46d-7f80-44fb` (O&G). Die Bibliotheks-Id `fc47-8392-a6c8-452a` und die Spielsystem-Id `0d13-7737-ea86-4662` kommen als `childId` **nie** vor. (Format-Dokument §7.7, Tabelle.) |
| **PCS-R2** | Die Söldner-Einheit **„Rhinox Riders"** trägt eine Kontingent-Obergrenze **max 1**. In einer **Ogre-Kingdoms**-Armee wird diese Grenze auf **unbegrenzt** gehoben. | `Mercenaries …cat` Z. 4058: `selectionEntry type="unit" name="Rhinox Riders" id="5e33-e510-ba45-933e"`. Z. 4269: `constraint type="max" value="1" field="selections" scope="force" shared="true" id="47d7-b2ed-39e9-0e60"`. Z. 4271-4276: `modifier type="set" value="-1" field="47d7-b2ed-39e9-0e60"` mit `condition type="instanceOf" field="selections" scope="primary-catalogue" childId="731d-5b13-2a92-5427"`. |
| **PCS-R3** | Der Sonderwert **`-1`** an einer Grenze bedeutet „unbegrenzt"; eine so gesetzte Obergrenze feuert nie. | Format-Dokument §7.6, Zeile „Ein `modifier type="set" value="-1"` greift auf eine **endliche** Grenze → ab dann unbegrenzt". Bereits festgenagelt im Szenario [`unlimited-sentinel`](../unlimited-sentinel/README.md), Roster 03. |
| **PCS-R4** | Der Katalog sagt dieselbe Regel auch in Prosa: außerhalb einer Ogre-Kingdoms-Armee ist **eine einzige** Einheit erlaubt. | `Mercenaries …cat` Z. 4258-4260, Regel „Dogs of War" `3c87-934f-1498-7fa3`: *„Units of Rhinox Riders may be included in non-Ironskin Ogre Kingdoms armies … **A single unit** may be included in **non-Ogre Kingdoms armies** too …"* |
| **PCS-R5** | **Spiegel-Paar in der Sichtbarkeit.** Zwei Unter-Einträge derselben Einheit werden über **dasselbe** Kriterium **gegenläufig** ein- bzw. ausgeblendet: „Extra Special choice" nur **in** einer Ogre-Armee, „Extra Rare choice" nur **außerhalb**. | `Mercenaries …cat` Z. 4079: `selectionEntry name="Extra Special choice" hidden="true" id="6c8d-f6f3-823e-e6a5"` → `modifier set hidden="false"` in einer `and`-Gruppe aus `notInstanceOf scope="parent" childId="7ff5-9e55-c594-4b40"` (Kategorie „Ironskin") **und** `instanceOf scope="primary-catalogue" childId="731d-5b13-2a92-5427"` (Z. 4101/4102). Z. 4109: `selectionEntry name="Extra Rare choice" hidden="true" id="a97e-5cc9-264b-74f4"` → `modifier set hidden="false"` mit `notInstanceOf scope="primary-catalogue" childId="731d-5b13-2a92-5427"` (Z. 4129). |
| **PCS-R6** | Der Rahmen wird **je Kontingent** beantwortet, nicht je Roster und nicht je Datensatz. `catalogueId` ist ein `<force>`-Attribut der `.ros`. | Format-Dokument §7.7, Abschnitt „Je Kontingent, nicht je Roster"; dazu „Was der Bezugsrahmen *nicht* bezeichnet": nicht den Datensatz, nicht das Spielsystem, nicht die Bibliothek, nicht den Katalog, in dem die Bedingung steht (die 20 Mercenaries-Vorkommen stehen in der Bibliothek, fragen aber nach der Armee). |
| **PCS-R7** | Beide Kontingente tragen eine **auflösbare** Angabe: `catalogueId` verweist auf eine Katalog-Wurzel, die im Datensatz geladen ist. Der Rahmen ist damit entscheidbar — auch die Antwort „nein, diese Armee ist **nicht** Ogre Kingdoms" ist eine Antwort und keine Unauflösbarkeit. Eine Diagnose „Bezugsrahmen nicht auflösbar" gehört hier **nicht** in den Bericht. | Roster-`<force catalogueId="731d-5b13-2a92-5427">` bzw. `="4049-c46d-7f80-44fb"`; beide `.cat` sind im `dataset.catalogues` des Manifests geladen (Z. 2 der jeweiligen Datei = Katalog-Wurzel). Die drei hier geprüften Bedingungen (PCS-R2 sowie PCS-R5 zweimal) nennen alle **dieselbe** `childId` `731d-5b13-2a92-5427`. |

### Warum die Einheit in **beiden** Armeen wählbar ist

Der Eintrag `5e33-e510-ba45-933e` ist ein Wurzel-`selectionEntry` der geteilten
Bibliothek und wird von **allen drei** Armee-Katalogen des Ausschnitts per
`entryLink` eingebunden:

| Armee | `entryLink` | Ziel |
|-------|-------------|------|
| Ogre Kingdoms (Z. 3235) | `c8d5-1198-3d4a-8a67` | `5e33-e510-ba45-933e` |
| Orcs and Goblins (Z. 14847) | `d38d-cf82-1161-dce5` | `5e33-e510-ba45-933e` |
| Vampire Counts (Z. 29617) | `7fd7-c08c-b5bf-86eb` | `5e33-e510-ba45-933e` |

Die Roster wählen bewusst **direkt die Ziel-`entryId`** (`entryLinkId=""`, wie in
den übrigen Szenarien), damit in beiden Fällen buchstäblich **dieselbe** Kennung
im Roster steht und der einzige Unterschied das Kontingent ist. Die primäre
Kategorie der Einheit ist „Regiment of Renown" (`ee09-9a50-ad78-9c32`), die
sekundäre „Rare" (`e94b-6a54-8779-cd60`); **beide** benutzten `forceEntry` führen
beide Kategorien (Ogre Z. 3100-3102, O&G Z. 57-59) — die Einheit ist also in
beiden Armeelisten regulär vorgesehen.

### Warum `number="2"` und nicht zwei Auswahl-Knoten

Die Rechenregel des Formats (§7.5) multipliziert `child.number * parent.number`
für Kosten **und** Constraint-Zählungen. Eine Auswahl mit `number="2"` zählt für
`field="selections"` also als **2** — festgenagelt in
[`army-standard-bearer`](../army-standard-bearer/README.md), Roster 03. Ein
einziger Auswahl-Knoten hält zugleich das Angebot unter der Einheit eindeutig,
sodass die `capabilities`-Aussagen zu PCS-R5 genau **einen** Slot treffen.

### Was dieses Szenario bewusst **nicht** behauptet

- **Die beiden `min`-Modifikatoren derselben Stelle.** „Extra Rare choice" hebt
  seine Untergrenze `e575-a5af-7fb3-5930` von 0 auf 1, wenn die Armee **nicht**
  Ogre ist; „Extra Special choice" tut dasselbe mit `b830-0538-045e-ee90` in der
  Ogre-Armee. Diese Grenzen können nur feuern, wenn der betroffene Eintrag im
  Roster **fehlt** — genau der Fall, den
  [`parent-scope-missing-mandatory`](../parent-scope-missing-mandatory/README.md)
  als bekannte Engine-Grenze festhält. Sie stehen deshalb **weder** in `firing`
  **noch** in `absent`; sie dürfen auftreten oder ausbleiben, ohne einen Fall zu
  brechen.
- **Die übrigen Pflichten des Armeeaufbaus.** General-/Core-Mindestzahlen und die
  Pflichtgruppen der Einheit („Weapons" `e3c5-f40e-68af-b94b` mit dem `min 1` der
  „Ogre Club" `554b-25d7-e51d-5998`, „Armour" `bb09-2c8c-3360-e742`) bleiben in
  allen drei Rostern unbesetzt. Sie feuern in **beiden** Armeen gleich und sind
  für den Kontrast ohne Belang — die Erwartung ist selektiv.
- **Kein Pauschal-Verbot unaufgelöster Bezugsrahmen.** Die Diagnose-Abwesenheit
  ist über das **Ziel** eingegrenzt: `diagnostics.absent` fordert
  `{ "kind": "UNRESOLVED_SCOPE", "targetId": "731d-5b13-2a92-5427" }` — die
  Ogre-Katalog-Wurzel, die alle drei hier geprüften Bedingungen als `childId`
  nennen. Damit bindet die Aussage genau den Rahmen, um den es geht. Ein nicht
  auflösbarer Rahmen **anderer** Art — etwa das in Issue 83 beschriebene
  `scope="unit"`, das im Definitive-Satz 130-mal vorkommt — trägt niemals eine
  Katalog-Wurzel als Ziel und bleibt deshalb unberührt: er darf weiterhin
  gemeldet werden, ohne dieses Szenario aus einem fremden Grund rot zu halten.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + Ogre-`.cat` + O&G-`.cat` + Mercenaries-`.cat`. **Der Datensatz ist in
allen drei Fällen identisch** — das ist Absicht: er enthält beide Armee-Kataloge,
sodass die Antwort unmöglich aus „welcher Katalog ist geladen?" stammen kann,
sondern nur aus der Angabe des Kontingents.

> **Assertion-Fokus:** die Grenze `47d7-b2ed-39e9-0e60`, die Sichtbarkeit der
> beiden Unter-Einträge `6c8d-f6f3-823e-e6a5` / `a97e-5cc9-264b-74f4` und die
> Abwesenheit einer `UNRESOLVED_SCOPE`-Diagnose auf das Ziel
> `731d-5b13-2a92-5427`. Andere Armeeaufbau-Diagnosen dürfen zusätzlich
> auftreten. Quelle der Wahrheit ist [`scenario.json`](scenario.json).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|-----------|----------------|----------------------------------------------------|---------|
| 01 | Armee **ist** Ogre Kingdoms → Grenze unbegrenzt | Kontingent „Standard (OK-AB)" mit `catalogueId="731d-5b13-2a92-5427"`, darin „Rhinox Riders" `number="2"` (+ 1 Modell) | **PCS-R2/R3:** der `set -1`-Modifikator greift, die Obergrenze ist unbegrenzt → `47d7-b2ed-39e9-0e60` **absent**. **PCS-R5:** „Extra Special choice" `isHidden=false`, „Extra Rare choice" `isHidden=true`. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose auf `731d-5b13-2a92-5427`. | [`01-ogre-force-unlimited.ros`](rosters/01-ogre-force-unlimited.ros) |
| 02 | Armee ist **nicht** Ogre Kingdoms → Grenze 1 | **Identische** Auswahl, nur Kontingent „Standard (OG-AB)" mit `catalogueId="4049-c46d-7f80-44fb"` | **PCS-R2/R4:** der Modifikator greift nicht, die deklarierte Grenze 1 bleibt → `47d7-b2ed-39e9-0e60` **feuert** (Ist 2, Grenze 1). **PCS-R5 gegenläufig:** „Extra Special choice" `isHidden=true`, „Extra Rare choice" `isHidden=false`. **PCS-R7:** ebenfalls keine `UNRESOLVED_SCOPE`-Diagnose auf `731d-5b13-2a92-5427` — „nein" ist eine Antwort. | [`02-orcs-and-goblins-force-limited.ros`](rosters/02-orcs-and-goblins-force-limited.ros) |
| 03 | Beide Kontingente in **einem** Roster | Ogre-Kontingent **und** O&G-Kontingent, jedes mit „Rhinox Riders" `number="2"` (+ 1 Modell) | **PCS-R6:** `47d7-b2ed-39e9-0e60` feuert **genau einmal** (`count: 1`, Ist 2, Grenze 1) — nur im O&G-Kontingent. Eine je-Roster- oder je-Datensatz-Antwort ergäbe zwangsläufig 0 oder 2 Verletzungen. **PCS-R7:** keine `UNRESOLVED_SCOPE`-Diagnose auf `731d-5b13-2a92-5427`. | [`03-two-forces-frame-per-contingent.ros`](rosters/03-two-forces-frame-per-contingent.ros) |

### Der Kontrast, explizit

| Aussage | Roster 01 (Ogre) | Roster 02 (O&G) | gegenläufig? |
|---------|------------------|-----------------|--------------|
| `47d7-b2ed-39e9-0e60` | feuert **nicht** (unbegrenzt) | feuert (Ist 2 / Grenze 1) | **ja** |
| `6c8d-f6f3-823e-e6a5` „Extra Special choice" | `isHidden=false` | `isHidden=true` | **ja** |
| `a97e-5cc9-264b-74f4` „Extra Rare choice" | `isHidden=true` | `isHidden=false` | **ja** |
| `UNRESOLVED_SCOPE` auf `731d-5b13-2a92-5427` | keine | keine | (gleich, absichtlich) |

Drei unabhängige Aussagen kippen zwischen den beiden Rostern. Ein Bericht, der
für beide Kontingente dieselbe Antwort liefert — gleich in welche Richtung —
verletzt mindestens eine davon.

> **Dieses Szenario entsteht vor der Engine-Änderung und ist bis dahin erwartbar
> rot.** Das ist gewollt: es wurde allein aus den Katalogdaten und dem
> Format-Dokument verfasst und beschreibt, was die Daten verlangen — nicht, was
> die Engine heute tut.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (Definitive Edition) | `0d13-7737-ea86-4662` |
| Katalog-Wurzel Ogre Kingdoms (Z. 2, rev 2) | `731d-5b13-2a92-5427` |
| Katalog-Wurzel Orcs and Goblins (Z. 2, rev 1) | `4049-c46d-7f80-44fb` |
| Katalog-Wurzel Vampire Counts (Z. 2, nur als Beleg für PCS-R1) | `4d73-5ab0-9020-403c` |
| Katalog-Wurzel Mercenaries (`library="true"`, nie `childId`) | `fc47-8392-a6c8-452a` |
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| „Rhinox Riders" (Einheit, Mercenaries Z. 4058) | `5e33-e510-ba45-933e` |
| „Rhinox Riders" (Modell, min 1 / max 3 scope=parent) | `c7a1-044e-39f1-9ad8` |
| **Geprüfte Grenze** — max 1, `field=selections`, `scope=force` (Z. 4269) | `47d7-b2ed-39e9-0e60` |
| „Extra Special choice" (sichtbar nur in der Ogre-Armee) | `6c8d-f6f3-823e-e6a5` |
| „Extra Rare choice" (sichtbar nur außerhalb der Ogre-Armee) | `a97e-5cc9-264b-74f4` |
| Kategorie „Ironskin" (zweite Bedingung von PCS-R5, hier nie gesetzt) | `7ff5-9e55-c594-4b40` |
| `forceEntry` „Ironskin Tribe" (setzt „Ironskin" — hier **nicht** benutzt) | `8711-ed16-2a44-7251` |
| Regel „Dogs of War" (Prosa-Beleg PCS-R4) | `3c87-934f-1498-7fa3` |
| Kategorie „Regiment of Renown" / „Rare" | `ee09-9a50-ad78-9c32` / `e94b-6a54-8779-cd60` |
| Nicht asserted: min-Grenzen der beiden Unter-Einträge | `e575-a5af-7fb3-5930` / `b830-0538-045e-ee90` |
