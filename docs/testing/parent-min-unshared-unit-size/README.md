# E2E-Regeln & Testkatalog: Einheitenmindeststärke als `parent`-min mit `shared="false"`

**Rolle:** Black-Box-Test (kein Blick in den Engine-Quellcode). Alle Regeln,
Grenz-Ids, Ist- und Grenzwerte sind **aus den Katalogdaten** der *6th Definitive
Edition* abgeleitet — nicht aus einem Engine-Lauf. Das Roster-Eingabeformat folgt
der in bestehenden Szenarien verifizierten Form (direktes `entryId`, leeres
`entryLinkId`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat` (id `4049-c46d-7f80-44fb`,
  rev 1) — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (id `fc47-8392-a6c8-452a`),
  per `catalogueLink` aus der O&G-`.cat` deklariert.

## Worum es geht

Die Mindeststärke einer Einheit steht in diesen Katalogen **nicht** an der Einheit,
sondern als `min`-Grenze am **Modell-Eintrag** unterhalb der Einheit, mit
`scope="parent"` und `shared="false"`:

```
selectionEntry "Goblins"  (b403-b7c6-0008-27d9, type=unit, categoryLink → Core, primary)
  └ selectionEntry "Goblin" (ec2d-a00e-8ff8-1dff, type=model)
       └ constraint 7156-0a0f-aa05-582a   type=min value=20
                                          field=selections scope=parent shared=false
                                          includeChildSelections=false includeChildForces=false
```

Der Bezugsrahmen ist damit die **eine** umschließende Einheiten-Auswahl (§7.6:
`scope="parent"` bezeichnet den Eltern-Container, und `shared="false"` rechnet
je Verweis-Instanz). Beide Angaben zeigen in dieselbe Richtung: gezählt werden
die „Goblin"-Modelle **dieser einen** „Goblins"-Einheit — nie die Summe des
Modell-Eintrags über das ganze Roster. Genau das trennt dieses Szenario ab.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PMU-R1** | Eine „Goblins"-Einheit muss **für sich** mindestens **20** „Goblin"-Modelle enthalten. | O&G-`.cat`, `selectionEntry` „Goblin" `ec2d-a00e-8ff8-1dff` (`type=model`) unter `selectionEntry` „Goblins" `b403-b7c6-0008-27d9` (`type=unit`) → constraint **`7156-0a0f-aa05-582a`** `type=min value=20 field=selections scope=parent shared=false includeChildSelections=false includeChildForces=false`. |
| **PMU-R2** | Der Bezugsrahmen ist die **einzelne Einheiten-Instanz**, nicht das Kontingent und nicht das Roster. Zwei „Goblins"-Einheiten zu je 15 Modellen sind **zwei** Unterschreitungen (je Ist 15 / Grenze 20) und werden **nicht** zu einer erfüllten Summe 30 verrechnet. | `scope="parent"` = der Eltern-Container ([BSData-Doku §7.6](../../battlescribe-data-format.md#76-constraint), §3.4: „`scope="parent"` vergleicht aufgelöste Ziel-IDs"); `shared="false"` = „je Verweis-Instanz" (ebd., Attributtabelle). Beide Angaben stehen an **derselben** Grenze `7156-0a0f-aa05-582a` und widersprechen sich nicht. |
| **PMU-R3** | Je unterschreitender Einheiten-Instanz entsteht **eine** Meldung. Zwei unterschreitende Einheiten ⇒ **zwei** Meldungen mit je Ist 15; eine erfüllte plus eine unterschreitende Einheit ⇒ **eine** Meldung mit Ist 15. | Folgt aus PMU-R2: der Rahmen ist die Instanz, also gibt es je Instanz einen Anker. Formatseitig dieselbe Form wie die „ein Anker je Kontingent"-Vervielfachung, die der Manifest-Vertrag mit `count` abbildet (vgl. `../ogre-kingdoms/scenario.json`, Roster 06/08). Im Manifest als `count` festgehalten. |
| **PMU-R4** | Die parallele **Obergrenze** desselben Modell-Eintrags ist unbegrenzt und darf nie feuern, solange der Border-Patrols-Schalter nicht gewählt ist. | Constraint **`ad41-8936-7a56-1717`** `type=max value=-1 field=selections scope=parent shared=true` (Kommentar `BP`) plus `modifier type="set" value="25"` auf dieses Feld, `condition atLeast 1 childId="4e15-0353-165f-5528"` („Border Patrols rules", `scope=roster`). In **keinem** Roster dieses Szenarios ist `4e15-…` gewählt ⇒ Rohwert `-1` = „unbegrenzt" (§7.6, Sentinel-Kasten). |
| **PMU-R5** | Dieselbe Konstruktion steht ein zweites Mal, unabhängig, an den Wolfsreitern: eine „Goblin Wolf Riders"-Einheit braucht **für sich** mindestens **5** „Goblin Wolf rider"-Modelle. | O&G-`.cat`, `selectionEntry` „Goblin Wolf rider" `b94a-ac63-6afa-7a79` unter `selectionEntry` „Goblin Wolf Riders" `3e13-7d88-fc17-1ecb` → constraint **`e603-749c-713c-3d36`** `type=min value=5 field=selections scope=parent shared=false`. |
| **PMU-R6** | **Sichtbarkeit:** Beide getesteten Einheiten sind in der Force „Standard (OG-AB)" sichtbar — ihre Mindestgrenzen sind also zu validieren. | „Goblins" `b403…` trägt `hidden="false"` und einen `modifier set hidden="true"`, dessen `or`-Gruppe **ausschließlich** die Sonderheere `a2fa-6a0e-8c17-373c`, `c248-eea0-b5c1-857b`, `1f55-c922-66d8-08ef`, `03cc-8a3f-abd4-3c03`, `1821-fbd1-0d96-2d88`, `9f70-0506-b8c7-f2c4` nennt — **nicht** `2bfa-e64a-7123-895f`. Für „Goblin Wolf Riders" `3e13…` gilt dieselbe Liste ohne `c248`/`1f55`. Die Modell-Einträge selbst tragen `hidden="false"` ohne `hidden`-Modifikator. |
| **PMU-R7** | **Nicht geprüft (bewusst):** die beiden Vorkommen derselben Konstruktion unter **basis-versteckten** Einheiten. | „Goblin Spider Riders" `cedf-b7e5-a05d-8685` (`hidden="true"`) → Modell `0447-ccba-01bf-be77`, constraint `5a60-3286-fcec-1d18` (min 5); „Night Goblins Stickas" `6d3c-f028-28f4-1f6f` (`hidden="true"`) → Modell `d9f5-91ff-6e58-4df3`, constraint `b9d6-4edd-12a3-be94` (min 10). Siehe die Lücken-Notiz unten. |

### Warum `15 + 15 ≠ 30` die entscheidende Messung ist

Für Roster 04 (zwei „Goblins"-Einheiten zu je 15) liefern die drei denkbaren
Lesarten **unterscheidbare** Berichte:

| Lesart | Bericht zu `7156-0a0f-aa05-582a` |
|--------|----------------------------------|
| **je Instanz** (aus den Daten abgeleitet, PMU-R2/R3) | **zweimal** feuern, je Ist **15** / Grenze **20** |
| roster-/force-weite Summe | **still** (30 ≥ 20) |
| ein Anker, zusammengefasste Summe | **einmal** feuern mit Ist **30** |

Das Manifest fordert deshalb `count: 2` **zusammen mit** `actual: 15` — erst
beides zusammen schließt die beiden Gegenlesarten aus. Roster 05 (20 + 15) legt
dieselbe Trennung von der anderen Seite fest: `count: 1` bei Ist 15, d. h. die
erfüllte Instanz erzeugt **keine** Meldung, während die unterschreitende genau
eine erzeugt.

### Zahlenbasis der Roster

Jede „Goblins"-/„Goblin Wolf Riders"-Auswahl trägt `number="1"`, die Modell-
Auswahl darunter die volle Stückzahl (`number="15"` usw.). Damit ist die in
[§7.5](../../battlescribe-data-format.md#75-cost--cost-type) benannte Lücke
(„ist `.ros`-`number` per-Eltern-relativ oder absolut?") für dieses Szenario
**folgenlos**: `15 × 1 = 15` in beiden Lesarten. Das Szenario misst allein den
Bezugsrahmen, nicht die Zahlenbasis.

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + O&G-`.cat` (+ die per `catalogueLink` benötigte `Mercenaries`-`.cat`).

> **Assertion-Fokus:** ausschließlich die genannten Grenz-Ids. Andere
> Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne Belang —
> insbesondere die Kontingent-Pflichten „General" `1077-7379-f142-f382` (min 1)
> und „Core" `35c2-d478-392a-aeb1` (min 2) sowie die Waffen-Gruppenpflicht der
> Goblins-Einheit `ed51-66fa-8caa-0000` (min 1, Gruppe „Weapons"
> `b417-417b-dedd-fbd5`). Die Roster bleiben bewusst minimal: sie enthalten nur
> die Einheiten und Modelle, die die Grenze unter Test zum Feuern bringen bzw.
> erfüllen.

| # | Roster-Zustand | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|----------------|---------------------------------------------------|---------|
| 01 | **Eine** „Goblins"-Einheit mit **20** „Goblin"-Modellen | **PMU-R1 erfüllt:** `7156-0a0f-aa05-582a` feuert **nicht** (Ist 20 / Grenze 20). | [`01-one-unit-at-minimum-legal.ros`](rosters/01-one-unit-at-minimum-legal.ros) |
| 02 | **Eine** „Goblins"-Einheit mit **15** Modellen | **PMU-R1 verletzt:** `7156-0a0f-aa05-582a` feuert **genau einmal**, Ist **15** / Grenze **20**. `e603-749c-713c-3d36` bleibt still — ohne „Goblin Wolf Riders"-Instanz gibt es keinen Eltern-Rahmen, in dem gezählt werden könnte. | [`02-one-unit-below-minimum.ros`](rosters/02-one-unit-below-minimum.ros) |
| 03 | **Eine** „Goblins"-Einheit mit **25** Modellen | **PMU-R1 übererfüllt:** `7156-…` still. **PMU-R4:** `ad41-8936-7a56-1717` still (Rohwert `-1` = unbegrenzt; der `set 25`-Modifikator ist ohne `4e15-0353-165f-5528` nicht aktiv). | [`03-one-unit-above-minimum-legal.ros`](rosters/03-one-unit-above-minimum-legal.ros) |
| 04 | **Zwei** „Goblins"-Einheiten, **je 15** Modelle *(der unterscheidende Fall)* | **PMU-R2/R3:** `7156-…` feuert **genau zweimal**, jede Meldung Ist **15** / Grenze **20**. Die roster-weite Summe 30 macht **keine** der beiden Einheiten legal. | [`04-two-units-each-below-minimum.ros`](rosters/04-two-units-each-below-minimum.ros) |
| 05 | „Goblins" mit **20** Modellen **+** „Goblins" mit **15** Modellen | **PMU-R3:** `7156-…` feuert **genau einmal**, Ist **15** / Grenze **20** — die beiden Instanzen werden sichtbar getrennt beurteilt. | [`05-one-unit-at-minimum-one-below.ros`](rosters/05-one-unit-at-minimum-one-below.ros) |
| 06 | **Zwei** „Goblin Wolf Riders"-Einheiten, **je 3** Modelle | **PMU-R5 (unabhängige Gegenprobe):** `e603-749c-713c-3d36` feuert **genau zweimal**, je Ist **3** / Grenze **5**, obwohl die roster-weite Summe 6 die Grenze überschreitet. `7156-…` bleibt still (keine „Goblins"-Einheit). | [`06-two-wolf-rider-units-each-below-minimum.ros`](rosters/06-two-wolf-rider-units-each-below-minimum.ros) |

### Nicht als feuernde Grenze erwartet

- **Sichtbarkeit (`hidden`) selbst** ist keine zählende Schranke und erscheint
  nicht im Verletzungsbericht (Konvention der bestehenden Szenarien, vgl.
  [`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md)). PMU-R6
  wird deshalb **nicht** als Grenze asseriert, sondern nur als Vorbedingung
  benutzt: weil „Goblins" und „Goblin Wolf Riders" in der Force
  `2bfa-e64a-7123-895f` **nicht** versteckt sind, sind ihre `min`-Grenzen
  überhaupt zu validieren (§5.6/§8: Mindestgrenzen einer effektiv versteckten
  Entität werden nicht validiert).
- **Profilwerte** kommen in diesem Szenario als Regel nicht vor.

### Bewusst offen gelassene Lücke (PMU-R7)

Die beiden übrigen Vorkommen derselben Konstruktion sitzen unter Einheiten mit
`hidden="true"` — „Goblin Spider Riders" `cedf-b7e5-a05d-8685`
(`5a60-3286-fcec-1d18`, min 5) und „Night Goblins Stickas" `6d3c-f028-28f4-1f6f`
(`b9d6-4edd-12a3-be94`, min 10). Sie sind hier **nicht** asseriert, weder als
feuernd noch als abwesend, weil die Datenformat-Dokumentation die dafür nötige
Frage nicht beantwortet: §5.6/§8 sagen, dass die Mindestgrenzen einer effektiv
**versteckten Entität** nicht validiert werden, und §8 sagt ausdrücklich, dass
eine versteckte `selectionEntryGroup` ihre Mitglieder mitversteckt — für ein
verstecktes **`selectionEntry`** und die `min`-Grenzen seiner selbst nicht
versteckten Kind-Einträge trifft keine der beiden Quellen eine Aussage. Diese
Frage gehört in ein eigenes Szenario mit eigener Herleitung; sie hier zu raten,
hieße die Erwartung an der Engine statt an den Daten zu bilden.

Nicht Teil dieses Szenarios ist außerdem der Fall „‚Goblins'-Einheit **ohne**
jedes ‚Goblin'-Modell" (Ist 0). Er prüft nicht mehr den Bezugsrahmen, sondern
die Frage, ob für einen unbesetzten Pflicht-Eintrag überhaupt ein Anker entsteht
— eine andere Regel (Pflicht-Phantom, vgl. Seeding-Hinweis in
[`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md)).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (`.gst`) | `0d13-7737-ea86-4662` |
| Katalog „Orcs and Goblins" | `4049-c46d-7f80-44fb` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| Einheit „Goblins" (`type=unit`) | `b403-b7c6-0008-27d9` |
| — deren `categoryLink` → Kategorie „Core" (`primary=true`) | `9300-c2e5-b70b-22aa` → `64bf-efb4-9978-26df` |
| Modell „Goblin" (`type=model`) | `ec2d-a00e-8ff8-1dff` |
| **Grenze unter Test:** min 20, `scope=parent`, `shared=false` | **`7156-0a0f-aa05-582a`** |
| parallele Obergrenze desselben Modells (`max -1`, `shared=true`) | `ad41-8936-7a56-1717` |
| Schalter „Border Patrols rules" (in keinem Roster gewählt) | `4e15-0353-165f-5528` |
| Einheit „Goblin Wolf Riders" (`type=unit`) | `3e13-7d88-fc17-1ecb` |
| Modell „Goblin Wolf rider" (`type=model`) | `b94a-ac63-6afa-7a79` |
| **Gegenprobe-Grenze:** min 5, `scope=parent`, `shared=false` | **`e603-749c-713c-3d36`** |
| Sibling (nicht asseriert): „Night Goblins" / Modell „Night Goblin" / min 20 | `79af-55cb-9761-f0be` / `7b95-cfde-8c59-78c3` / `8cb2-bd82-3725-569e` |
| Sibling unter versteckter Einheit (PMU-R7): „Goblin Spider Riders" / Modell / min 5 | `cedf-b7e5-a05d-8685` / `0447-ccba-01bf-be77` / `5a60-3286-fcec-1d18` |
| Sibling unter versteckter Einheit (PMU-R7): „Night Goblins Stickas" / Modell / min 10 | `6d3c-f028-28f4-1f6f` / `d9f5-91ff-6e58-4df3` / `b9d6-4edd-12a3-be94` |
| Umgebungsrauschen, nicht asseriert: Kategorie „General" / „Core" (min je Kontingent) | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` |
| Umgebungsrauschen, nicht asseriert: Gruppe „Weapons" der Goblins (min 1) | `b417-417b-dedd-fbd5` — constraint `ed51-66fa-8caa-0000` |
