# E2E-Regeln & Testkatalog: Streitwagen-Pflicht durch ein Charakter-Reittier (Orcs and Goblins)

**Rolle:** Black-Box-Test (kein Blick in den Engine-Quellcode). Alle Regeln sind
**aus den Katalogdaten** der *6th Definitive Edition* abgeleitet — nicht aus einem
Engine-Lauf. Das Roster-Eingabeformat folgt der in bestehenden Szenarien
verifizierten Form (direktes `entryId`, leeres `entryLinkId`, verschachtelte
`selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (id `4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (id `fc47-8392-a6c8-452a`),
  per `catalogueLink` aus der O&G-`.cat` deklariert.

## Wie die Regel im Katalog modelliert ist

Die Regel „nimmt ein Charakter einen Streitwagen als Reittier, muss die Armee eine
Streitwagen-Einheit enthalten" ist **nicht** als Bedingung geschrieben, sondern als
**dynamische Untergrenze**: eine roster-skopierte `min`-Grenze mit dem geschriebenen
Wert **0** (also von sich aus wirkungslos), die ein `increment`-Modifier **je
armeeweit gezählter Merkmals-Selektion** um 1 anhebt. Die Kopplung läuft über eine
tag-artige Kategorie (`primary="false"`), die allein das Reittier trägt:

```
selectionEntry "Orc Bigboss" (6279-4d0a-6dce-f2f3)             ← Force-Selection (Heroes)
  └ selectionEntryGroup "Mounts" (6a02-d336-e192-56fd)         max 1 (scope=parent), min 0
       ├ "Boar"    (bb3a-135f-90e4-2fe1)                       ← ohne Merkmal
       └ "Chariot" (5cc1-2650-9e36-3c62)                       ← categoryLink a087-… → „orc needs chariot"
                                                                  (a85e-af08-5fea-41bd)

selectionEntry "Orc Boar Chariot" (5678-6ad3-0e79-2233)        ← Force-Selection (Special)
  ├ constraint  1d06-5b8c-0443-5979   min, value 0, field=selections, scope=roster
  └ modifier    increment +1 auf 1d06-…, repeat über childId=a85e-… (scope=roster)
```

Netto: **Grenze = 0 + (Anzahl der Selektionen mit der Kategorie „orc needs chariot"
im gesamten Roster)**; gezählt wird gegen die Anzahl der `Orc Boar Chariot`-
Selektionen im Roster.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RSMC-R1** | Die Einheit **„Orc Boar Chariot"** trägt eine **roster-skopierte** Untergrenze mit dem geschriebenen Wert **0** — für sich genommen ein No-op. | O&G-`.cat`, `selectionEntry` „Orc Boar Chariot" `5678-6ad3-0e79-2233` → constraint **`1d06-5b8c-0443-5979`** `type=min value=0 field=selections scope=roster shared=true includeChildSelections=false includeChildForces=false`. |
| **RSMC-R2** | Diese Grenze steigt **um 1 je Selektion der Kategorie „orc needs chariot"** im **gesamten Roster** (Wiederholung, nicht Bedingung). | Am selben `selectionEntry`: `<modifier type="increment" field="1d06-5b8c-0443-5979" value="1">` mit `<repeat field="selections" scope="roster" value="1" childId="a85e-af08-5fea-41bd" repeats="1" roundUp="false" shared="true" includeChildSelections="true" includeChildForces="true"/>`. |
| **RSMC-R3** | Träger des Merkmals ist **genau eine** Selektion des Katalogs: die Reittier-Option **„Chariot"** des **Orc Bigboss**. | `categoryEntry` „orc needs chariot" `a85e-af08-5fea-41bd`; einziger `categoryLink` darauf: `a087-57ac-ea59-6140` in `selectionEntry` „Chariot" `5cc1-2650-9e36-3c62`, gelegen in `selectionEntryGroup` „Mounts" `6a02-d336-e192-56fd` unter `selectionEntry` „Orc Bigboss" `6279-4d0a-6dce-f2f3`. Volltextsuche über den eingefrorenen Korpus (5 Dateien): die Id `a85e-…` kommt **5×** vor — 1× Definition, 1× dieser `categoryLink`, 3× als `childId` eines `repeat` (RSMC-R2/R6/R7). **Kein** `modifier type="add" field="category"` fügt sie zur Laufzeit hinzu. |
| **RSMC-R4** | Die **gleichnamigen** Reittier-Optionen anderer Charaktere lösen die Pflicht **nicht** aus. Der O&G-Katalog kennt **elf** `selectionEntry`s mit `name="Chariot"`; nur `5cc1-…` trägt das Merkmal, die übrigen zehn tragen ausschließlich die allgemeine Kategorie „Chariot" `d36d-5455-9f4d-3100`. | z. B. `fd09-1ed9-f010-04dc` (Black Orc Bigboss `febe-2170-775b-0d13`), `9dd7-774b-decb-f938` (Orc Shaman `e4cf-8043-5127-dd26`), `42d3-5897-ca27-8bf3` (Goblin Bigboss `8c8f-3fba-e337-fd2f`) — je nur `categoryLink → d36d-…`. Folgt aus derselben Volltextsuche wie RSMC-R3. |
| **RSMC-R5** | Die **Mounts-Gruppe** erlaubt **höchstens ein** Reittier je Charakter (`max 1`, scope=parent) und fordert **keines** (`min 0`); die Reittier-Option „Chariot" selbst ist auf **max 1** je Elternauswahl begrenzt. | Gruppe `6a02-d336-e192-56fd` → constraints **`d429-1ba5-7bbe-a0ef`** (`max 1`, scope=parent) und **`bdd7-3caf-c4ac-4832`** (`min 0`, scope=parent). Letzterer wird nur per `modifier set 1` gehoben, wenn das Kontingent das Sonderheer **„Nomadic Badlands Waaagh!"** `1f55-c922-66d8-08ef` ist — in diesem Szenario nie. „Chariot" `5cc1-…` → constraint **`e26e-eb83-442c-2cc9`** (`max 1`, scope=parent). |
| **RSMC-R6** | Dasselbe Konstrukt trägt die Einheit **„Savage Orc Boar Chariot"** — sie ist im Kontingent „Standard (OG-AB)" jedoch **ausgeblendet** und daher **keine erfüllbare Pflicht**. | `selectionEntry` `91b0-2e81-0087-8e72` ist `hidden="true"`; der einzige `set hidden=false`-Modifier ist auf `instanceOf force childId="59e1-efd7-af88-55a1"` („Savage Orc Horde") gegattert. Constraint **`c21a-df75-9aa7-fd31`** (`min 0`, scope=roster) + identischer `increment`-`repeat` über `a85e-…`. **Nicht als feuernde Grenze erwartet** (Sichtbarkeitsregel, s. u.). |
| **RSMC-R7** | Dasselbe Konstrukt trägt ein **zweiter, gleichnamiger** „Orc Boar Chariot" — er liegt jedoch unter `<sharedSelectionEntries>` und wird **von keinem `entryLink` im gesamten Korpus** referenziert, ist also in keinem Kontingent wählbar. | `selectionEntry` `ca2a-ff41-6666-8155` (Zeile im Block `<sharedSelectionEntries>`), constraint **`065f-9ab7-97df-7791`** (`min 0`, scope=roster) + identischer `increment`-`repeat` über `a85e-…`. Volltextsuche über alle 5 Fixture-Dateien: die Id `ca2a-…` kommt **1×** vor (die Definition selbst), es gibt also **kein** `targetId="ca2a-…"`. **Nicht als feuernde Grenze erwartet** (Angebotsregel, s. u.). |
| **RSMC-R8** | Die Einheit „Orc Boar Chariot" `5678-…` ist im Kontingent „Standard (OG-AB)" **sichtbar** — ihre Untergrenze wird also validiert. | Ihr `set hidden=true`-Modifier ist auf die Sonderheere `59e1-…`, `c248-…`, `a2fa-…`, `b26c-…`, `03cc-…`, `9f70-…` gegattert; `2bfa-e64a-7123-895f` steht **nicht** in dieser Liste. |

### Warum RSMC-R6 und RSMC-R7 **nicht** feuern dürfen

Beide Fundstellen tragen wörtlich dasselbe Konstrukt wie RSMC-R1/R2 und würden bei
naivem Lesen mitfeuern. Aus den Daten und der kanonischen Formatdokumentation folgt
das Gegenteil:

- **RSMC-R6 (ausgeblendet):** „Die Min-Grenzen einer effektiv versteckten Entität
  werden **nicht** validiert" — die Regel aus
  [`docs/battlescribe-data-format.md` §5.6/§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit)
  (Projektentscheidung Issue 0088, verallgemeinert auf **jede** Ankerart), begründet
  damit, dass ein Verstoß über etwas, das gar nicht angeboten wird, für den Nutzer
  unbehebbar wäre. Die „Savage Orc Boar Chariot" ist im Kontingent „Standard" genau
  das.
- **RSMC-R7 (nicht verlinkt):** Ein `sharedSelectionEntry` ist laut
  [§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link)
  **ausschließlich** über einen `entryLink` erreichbar. Ohne einen einzigen Verweis
  im Korpus existiert für diesen Eintrag in keinem Kontingent ein Angebot — dieselbe
  Unbehebbarkeit wie oben, nur noch strenger. Der Eintrag ist ein Dublettenrest der
  Katalogpflege (namensgleich zu `5678-…`).

Beide Ids stehen deshalb in **jedem** Roster dieses Szenarios auf der `absent`-Liste;
sie sind der eigentliche Härtetest des Szenarios.

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + O&G-`.cat` + die per `catalogueLink` benötigte `Mercenaries`-`.cat`, alle
nutzen die Force „Standard (OG-AB)" `2bfa-e64a-7123-895f` und ein Punktelimit von
2000.

> **Assertion-Fokus:** nur die genannten Grenz-Ids. Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht des Spielsystems, Punktelimit, Pflicht-Ausrüstung der
> Charaktere) können zusätzlich auftreten und sind hier ohne Belang. Die Ist-Werte
> (`actual`) und Grenzen (`bound`) sind **aus den Katalogdaten und dem Roster-Aufbau
> gerechnet**, nicht aus einem Engine-Lauf übernommen.

| # | Roster-Zustand | Merkmalsträger armeeweit | Grenze `1d06-…` | Erwartetes Ergebnis | Fixture |
|---|----------------|--------------------------|-----------------|---------------------|---------|
| 01 | Ein Orc Bigboss, **kein** Reittier | 0 | 0 + 0 = **0** | **Keine** Verletzung: die geschriebene Grenze 0 ist erfüllt (Ist 0). | [`01-bigboss-no-mount.ros`](rosters/01-bigboss-no-mount.ros) |
| 02 | Ein Orc Bigboss mit Reittier **„Boar"** `bb3a-…` | 0 | **0** | **Keine** Verletzung — Kontrollfall: das Geschwister-Reittier derselben Gruppe trägt das Merkmal nicht (RSMC-R3). | [`02-bigboss-boar-mount.ros`](rosters/02-bigboss-boar-mount.ros) |
| 03 | Ein Orc Bigboss mit Reittier **„Chariot"** `5cc1-…`, **keine** Streitwagen-Einheit | 1 | 0 + 1 = **1** | **RSMC-R1/R2 feuern:** `1d06-5b8c-0443-5979`, Ist **0**, Grenze **1**. | [`03-bigboss-chariot-mount-no-unit.ros`](rosters/03-bigboss-chariot-mount-no-unit.ros) |
| 04 | Wie 03, zusätzlich **eine** Einheit „Orc Boar Chariot" `5678-…` | 1 | **1** | **Keine** Verletzung: Ist **1** ≥ Grenze **1** — die Pflicht ist eingelöst. | [`04-bigboss-chariot-mount-with-unit.ros`](rosters/04-bigboss-chariot-mount-with-unit.ros) |
| 05 | **Zwei** Orc Bigbosses, je mit Reittier „Chariot", **keine** Streitwagen-Einheit | 2 | 0 + 1 + 1 = **2** | **Wiederholung messbar:** `1d06-…` feuert mit Ist **0**, Grenze **2**. | [`05-two-chariot-mounts-no-unit.ros`](rosters/05-two-chariot-mounts-no-unit.ros) |
| 06 | Wie 05, zusätzlich **eine** Einheit „Orc Boar Chariot" | 2 | **2** | `1d06-…` feuert weiterhin: Ist **1**, Grenze **2** — teilweise eingelöst reicht nicht. | [`06-two-chariot-mounts-one-unit.ros`](rosters/06-two-chariot-mounts-one-unit.ros) |
| 07 | Wie 05, zusätzlich **zwei** Einheiten „Orc Boar Chariot" | 2 | **2** | **Keine** Verletzung: Ist **2** ≥ Grenze **2**. | [`07-two-chariot-mounts-two-units.ros`](rosters/07-two-chariot-mounts-two-units.ros) |

**Zählweise im Roster (bewusst eindeutig gehalten):** Zwei Merkmalsträger stehen
als **zwei getrennte Geschwister-Selektionen** mit je `number="1"` in der Liste,
nicht als eine Selektion mit `number="2"`. Damit hängt das Szenario nicht an der
Frage, ob `number` als absolute Stückzahl oder als Multiplikator je Eltern-Instanz
gelesen wird ([§7.5, „Zahlenbasis"](../../battlescribe/building-blocks/cost.md#75-cost--cost-type)
— eine dokumentierte Lücke der Quelle). Ebenso trägt jede Einheit „Orc Boar Chariot"
ihr pflichtiges Modell „Orc Chariot" `29ae-542a-a624-a552` (`min 1`, scope=parent,
constraint `0662-8289-4527-fea0`), damit die Rosters für sich genommen vollständig
sind.

### Nicht als feuernde Grenze erwartet

| Facette | Warum nicht im `firing`-Satz |
|---------|------------------------------|
| `hidden`/Sichtbarkeit (RSMC-R6, RSMC-R8) | Der Verletzungsbericht kodiert **zählende** Grenzen, keine (Un-)Sichtbarkeit. Die Sichtbarkeit wirkt hier nur **mittelbar**: sie entscheidet, ob eine Min-Grenze überhaupt validiert wird. `c21a-df75-9aa7-fd31` steht deshalb auf `absent`, nicht auf `firing`. |
| Nicht verlinkter shared entry (RSMC-R7) | `065f-9ab7-97df-7791` gehört zu einer Definition, die in keinem Kontingent angeboten wird — `absent`. |
| Kategorie „Chariot" `d36d-5455-9f4d-3100` | Ihre Grenze `4b43-5d4e-94ca-1fd5` ist `max=-1` (unbegrenzt) und wird nur bei einer „Border Patrols rules"-Selektion `4e15-0353-165f-5528` auf 1 gesetzt — in keinem Roster dieses Szenarios vorhanden. Nicht asseriert. |
| Punktekosten / Profile | Kommen in dieser Regel nicht vor. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (gst) | `0d13-7737-ea86-4662` |
| Katalog „Orcs and Goblins" | `4049-c46d-7f80-44fb` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| Merkmals-Kategorie „orc needs chariot" | `a85e-af08-5fea-41bd` |
| Einheit „Orc Boar Chariot" (Special) / **Pflicht-Grenze min (roster)** | `5678-6ad3-0e79-2233` / **`1d06-5b8c-0443-5979`** |
| Pflichtmodell „Orc Chariot" darunter / constraint min 1 (parent) | `29ae-542a-a624-a552` / `0662-8289-4527-fea0` |
| Charakter „Orc Bigboss" (Heroes) | `6279-4d0a-6dce-f2f3` |
| Gruppe „Mounts" / max 1 (parent) / min 0 (parent) | `6a02-d336-e192-56fd` / `d429-1ba5-7bbe-a0ef` / `bdd7-3caf-c4ac-4832` |
| Reittier „Chariot" (Merkmalsträger) / `categoryLink` / max 1 (parent) | `5cc1-2650-9e36-3c62` / `a087-57ac-ea59-6140` / `e26e-eb83-442c-2cc9` |
| Reittier „Boar" (Kontrollfall, ohne Merkmal) | `bb3a-135f-90e4-2fe1` |
| Einheit „Savage Orc Boar Chariot" (ausgeblendet) / Grenze | `91b0-2e81-0087-8e72` / `c21a-df75-9aa7-fd31` |
| shared entry „Orc Boar Chariot" (nirgends verlinkt) / Grenze | `ca2a-ff41-6666-8155` / `065f-9ab7-97df-7791` |
| Sonderheer „Savage Orc Horde (OG-AB)" (deckt `91b0-…` auf) | `59e1-efd7-af88-55a1` |
| Sonderheer „Nomadic Badlands Waaagh! (OG-AB)" (hebt `bdd7-…` auf 1) | `1f55-c922-66d8-08ef` |
| Allgemeine Kategorie „Chariot" (gst) / Grenze max -1 | `d36d-5455-9f4d-3100` / `4b43-5d4e-94ca-1fd5` |
| `catalogueLink` → Mercenaries-Katalog | `fc47-8392-a6c8-452a` |
