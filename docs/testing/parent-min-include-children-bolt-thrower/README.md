# E2E-Regeln & Testkatalog: `min`-Grenze mit `scope="parent"` und `includeChildSelections="true"` (Reaper Bolt Thrower, Dark Elves)

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln
sind aus den Katalogdaten der *6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
abgeleitet; das Eingabeformat der Roster folgt den bereits verifizierten
Szenario-Fixtures (direktes `entryId`, `entryLinkId` des Verweises,
`entryGroupId` für Gruppen-Mitglieder, geschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Dark Elves (6th definitive edition).cat`
  (`d4c0-4f0c-4a89-40fc`, rev 1) — Kontingent **„Standard (DE-AB)"**
  `26bc-729f-a188-f285` (Z. 10081)
- Dazu `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`), per
  `catalogueLink` `4301-a1ec-729b-b898` aus der Dark-Elves-`.cat` gefordert
  (Z. 10152)
- Punktelimit aller Roster: 2000 pts (`costLimit` der pts-Kostenart
  `ecfa-8486-4f6c-c249`)

## Der gepinnte Mechanismus

Träger der Grenze ist das **Pflicht-Modell selbst** — der inline deklarierte
`selectionEntry` **„Reaper Bolt Thrower team"** (`8d99-db74-0051-4a45`,
`type="model"`, 100 pts) innerhalb der Rare-Einheit **„Reaper Bolt Thrower"**
(`a757-462a-11d5-9636`). Er trägt zwei Zählgrenzen mit **identischen Flags** und
gegenläufiger Richtung — die gepinnte Zelle ist die untere:

```
selectionEntry "Reaper Bolt Thrower" (a757-462a-11d5-9636, type=unit, Rare)   ← Z. 3612
  └ selectionEntry "Reaper Bolt Thrower team" (8d99-db74-0051-4a45, type=model, 100 pts)   ← Z. 3620
       ├ constraint 41ec-bee5-0865-0448  type=min value=1 field=selections scope=parent   ← gepinnte Zelle, Z. 3623
       │     shared=true includeChildSelections=true includeChildForces=false percentValue=false
       ├ constraint ccf9-fefc-71c8-bd73  type=max value=2 field=selections scope=parent   ← Nachbargrenze, Z. 3622
       │     shared=true includeChildSelections=true includeChildForces=false percentValue=false
       ├ selectionEntry "Crew" (60b3-aed5-bac2-0bd4, type=upgrade)                        ← Z. 3626
       │    ├ constraint aa66-b894-062c-6c9e  min 2  scope=parent  includeChildSelections=false   ← Z. 3629
       │    ├ constraint d242-c938-19d7-0dde  max 2  scope=parent  includeChildSelections=false   ← Z. 3628
       │    └ selectionEntryGroup "Weapons and Armour" (f3eb-28b5-64be-28bd)              ← Z. 3656
       │         ├ constraint d779-0b84-3daf-34b5 / f7bb-1fdb-d454-9d4d  min 2 / max 2 scope=parent
       │         ├ entryLink 381e-0653-e9c9-dc6a ──▶ "Light Armour" 055f-8e4e-f170-35d2 (.gst Z. 951)
       │         │     entryLink-constraint 6652-8c5e-4cf7-9a58  min 1 scope=parent
       │         │     Ziel-constraint      6f1a-1be1-6660-d9a6  max 1 scope=parent (.gst Z. 953)
       │         └ selectionEntry "Hand Weapon" (ef5d-1234-9f7f-7f69)
       │               constraints bdc0-54df-68c2-418b / 07a8-2fa1-c38a-77b8  min 1 / max 1 scope=parent
       └ selectionEntry "Reaper" (0137-be86-e4e7-d374, type=upgrade)                      ← Z. 3684
             constraints 56a0-90c8-64dc-0303 / bf18-8f9f-a473-9acd  min 1 / max 1 scope=parent
```

Der **Bezugsrahmen** (`scope="parent"`) ist damit die **Eltern-Auswahl** des
Trägers, also die einzelne Einheiten-Instanz; gezählt wird `field="selections"`
mit dem Träger als Bezug — die Zahl der Team-Instanzen in genau diesem Rahmen
([§7.6](../../battlescribe-data-format.md#76-constraint): *„`scope="parent"`
vergleicht aufgelöste Ziel-IDs"*, und der `scope` benennt die Entität, die
summiert). Die Crew-Grenzen eine Ebene tiefer haben denselben `scope="parent"`,
aber einen **anderen Rahmen**: dort ist die Eltern-Auswahl das Team.

### Warum das Kontingent „Standard (DE-AB)"

Die Einheit `a757-462a-11d5-9636` trägt zwei Kontingent-abhängige Klammern:

- `<modifier type="set" value="true" field="hidden">` mit
  `condition instanceOf … scope="force" childId="ff5e-f712-03ce-bb85"`
  („Watchtower Patrol (WD#259-UK)", Z. 3755–3761). Nur dort wäre die Einheit
  versteckt — und die Min-Grenzen einer effektiv versteckten Entität werden
  **nicht** validiert ([§5.6/§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit),
  Issue 0088). Im Standard-Kontingent greift der Modifikator nicht.
- eine `modifierGroup` (Z. 3737–3754), die die Einheit in den Kontingenten
  „City Garrison (AN-02)" `77cd-dafb-16af-93c0` und „The Raiding Army (DE-AB)"
  `4b5b-aebb-1526-91bb` per `add`/`set-primary`/`remove category` von **Rare**
  `e94b-6a54-8779-cd60` nach **Special** `43cc-fc3f-35a7-8d03` umgliedert.
  Im Standard-Kontingent bleibt sie Rare.

Ein `field="name"`-Modifikator liegt weder an der Einheit noch am Team; der
wirksame Anzeigename des Trägers ist sein Katalog-`name`.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PMICB-R1** | Unterhalb **eines** Eltern-Rahmens muss der Träger **mindestens einmal** vorkommen. `bound` ist der geschriebene Wert **1**. | Dark-Elves-`.cat`, `selectionEntry` `8d99-db74-0051-4a45` → constraint **`41ec-bee5-0865-0448`** (`type=min value=1 field=selections scope=parent shared=true includeChildSelections=true includeChildForces=false percentValue=false`, Z. 3623). |
| **PMICB-R2** | `actual` ist die Zahl der **Instanzen des Trägers** im Rahmen — nicht die Zahl aller Auswahlen im Rahmen. Kein Team ⇒ `actual=0` und Verstoß gegen PMICB-R1; ein Team ⇒ `actual=1` und Erfüllung. | Ebd.; `field="selections"` mit dem Träger als Bezug. Roster 01 (kein Team) gegen Roster 02 (ein Team, dessen Rahmen **acht** Auswahlen bis Tiefe 3 hält). |
| **PMICB-R3** | Die **Nachbar-Obergrenze** desselben Trägers erlaubt bis zu **zwei** Teams je Rahmen. Sie ist die obere Klammer um dieselbe Zählung. | Ebd. → constraint **`ccf9-fefc-71c8-bd73`** (`type=max value=2`, sonst identische Flags, Z. 3622). |
| **PMICB-R4** | Die **Randlagen** des Paars: 0 verletzt die Untergrenze, 1 und 2 halten beide Grenzen ein, 3 verletzt die Obergrenze. Kein Wert dazwischen ist strittig, weil beide Grenzen ganzzahlige Selektionszählungen sind. | `value="1"` (min) bzw. `value="2"` (max) an denselben zwei Elementen; Roster 01/02/03/04 bilden genau die vier Fälle ab. |
| **PMICB-R5** | Der Rahmen ist die **Eltern-Auswahl**, nicht das Kontingent und nicht das Roster: ein Team in einer **anderen** Reaper-Bolt-Thrower-Einheit desselben Kontingents erfüllt die Pflicht der leeren Einheit **nicht**. Die Grenze feuert dann **genau einmal**. | Ebd. (`scope="parent"`). Roster 05: Einheit A mit Team (Ist 1), Einheit B ohne (Ist 0). Vergleichsfall derselben Konstruktion mit `shared="false"`: [`parent-min-unshared-unit-size`](../parent-min-unshared-unit-size/README.md). |
| **PMICB-R6** | `shared="true"` verengt den Rahmen **nicht** zu einer Verweis-Instanz — es weitet die Summe auf **alle** Auswahlen des Eintrags **innerhalb** des Rahmens. Der Rahmen bleibt der von `scope` benannte. | Attribut `shared="true"` an beiden Grenzen ([§7.6](../../battlescribe-data-format.md#76-constraint): *„die Summe umfasst **alle** Auswahlen dieses shared entry"*). Roster 03/04 notieren 2 bzw. 3 Teams als getrennte Geschwister-Selektionen; ihre Summe je Rahmen ist 2 bzw. 3. |
| **PMICB-R7** | `includeChildSelections="true"`: der Rahmen umfasst **auch tiefer geschachtelte** Auswahlen. Gezählt werden darin weiterhin **nur Kopien des Trägers** — andere tiefe Auswahlen erhöhen `actual` **nicht**. | Attribut an beiden Grenzen ([§7.6/§7.7](../../battlescribe-data-format.md#76-constraint)). Roster 02: der Rahmen hält 1 Team + 2 Crew + 2 Hand Weapon + 2 Light Armour + 1 Reaper = 8 Auswahlen bis Tiefe 3, und `ccf9` (max 2) bleibt **still** — bei einer Zählung „alle Auswahlen im Rahmen" müsste sie feuern. Roster 04: `actual=3` (Träger-Instanzen), nicht 24 (alle Auswahlen). |
| **PMICB-R8** | Beide Grenzen behalten ihren **geschriebenen** Wert — im gesamten Fixture-Datensatz adressiert **kein** `modifier` die Ids `41ec-bee5-0865-0448` oder `ccf9-fefc-71c8-bd73`. Dasselbe gilt für alle übrigen hier behaupteten Ids (`aa66…`, `d242…`, `56a0…`, `bf18…`, `d779…`, `f7bb…`, `bdc0…`, `07a8…`, `6652…`, `6f1a…`). | Verifiziert über alle Dateien in `src/domain/evaluator/__fixtures__/whfb6-definitive/`: jede dieser Ids kommt ausschließlich als `constraint id` vor, nie als `modifier field`. |
| **PMICB-R9** | Die **Pflichtgrenzen des Teilbaums** unterhalb eines Teams sind ein eigener Rahmen je Team: Crew `min 2`/`max 2` (Rahmen = das Team), Reaper `min 1`/`max 1` (Rahmen = das Team), Gruppe „Weapons and Armour" `min 2`/`max 2` sowie Hand Weapon `min 1`/`max 1` und Light Armour `min 1` (Verweis) / `max 1` (Ziel) (Rahmen = die jeweilige Crew). Jedes Team der Roster 02–05 erfüllt sie exakt. | Dark-Elves-`.cat` Z. 3628/3629 (Crew), 3710/3711 (Reaper), 3678/3679 (Gruppe), 3672/3673 (Hand Weapon), 3660 (Verweis Light Armour); `.gst` Z. 953 (Ziel Light Armour). |

### Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf)

`bound` ist der geschriebene `value`: **1** für `41ec-bee5-0865-0448`, **2** für
`ccf9-fefc-71c8-bd73` (PMICB-R8: kein Modifikator ändert sie). `actual` folgt
aus der Roster-Struktur unter dem jeweiligen Rahmen — die Zahl der
Team-Selektionen unter der jeweiligen Einheiten-Instanz: 0 (Roster 01, Roster 05
Einheit B), 1 (Roster 02, Roster 05 Einheit A), 2 (Roster 03), 3 (Roster 04).
`effectiveMin`/`effectiveMax` des Team-Slots sind dieselben 1 und 2, weil beide
Grenzen am Träger hängen und keine sie verändert; `headroom` ist
`effectiveMax − current`, `isMandatoryUnmet` gilt bei unerfülltem Mindestmaß,
`isBlocked` bei ausgeschöpftem Höchstmaß.

**Notation der Stückzahlen:** alle Selektionen tragen `number="1"`; mehrere
Exemplare stehen als **Geschwister-Selektionen** nebeneinander. Das ist Absicht:
diese Notation ist unabhängig davon, ob `number` als absolute Gesamtstückzahl
oder als „Anzahl je Eltern-Instanz" zu lesen ist — eine offene Frage des Formats
([§7.5](../../battlescribe-data-format.md#75-cost--cost-type),
[§15](../../battlescribe-data-format.md)). Ein Team mit `number="3"` und zwei
Crew darunter wäre in den Crew-Grenzen mehrdeutig (2 oder 6); die
Geschwister-Notation ist es nicht.

---

## Ist `includeChildSelections="true"` an dieser Fundstelle beobachtbar?

**Nur zur Hälfte — und das ist eine Aussage über die Daten, keine Vermutung
über die Engine.**

- **Belegbare Hälfte:** der Rahmen *enthält* tiefer geschachtelte Auswahlen, und
  `actual` bleibt trotzdem die Zahl der Träger-Instanzen. Roster 02 und 04
  pinnen genau das (PMICB-R7).
- **Nicht belegbare Hälfte:** der stärkste denkbare Zeuge wäre eine **zweite
  Kopie des Trägers auf größerer Tiefe unterhalb desselben Rahmens** — sie
  zählte nur dann mit, wenn die Tiefe zählt. Dieser Aufbau ist hier
  **katalog-seitig nicht baubar**:
  - Die Id `8d99-db74-0051-4a45` kommt im **gesamten** eingefrorenen
    Fixture-Satz **genau einmal** vor, nämlich als diese inline-Deklaration
    (Z. 3620). Es gibt **keinen** `entryLink` mit `targetId="8d99-db74-0051-4a45"`
    — der Träger ist nirgends sonst verlinkt.
  - Sein einziger Elternknoten ist die Einheit `a757-462a-11d5-9636`; er ist
    damit **immer** ein direktes Kind des Rahmens, nie ein Enkel.
  - Keine Auswahl unterhalb des Teams (Crew `60b3…`, Reaper `0137…`, die Gruppe
    `f3eb…`, der Verweis „Mark of Slaanesh (troops)" `65e0-81d8-eb67-ded5`)
    bietet den Träger an.

Ein Roster, das eine zweite Kopie unter eine Unter-Auswahl hängt, die sie im
Katalog gar nicht anbietet, wäre eine **erfundene** Struktur und damit kein
zulässiger Beleg. **`includeChildSelections="true"` gegen `"false"` ist an
dieser Fundstelle also nicht trennbar** — die Grenze zählt so oder so genau die
direkten Team-Kinder der Einheit. Die Lücke wird hier festgehalten, nicht
geraten.

Ebenso **nicht trennbar** ist `includeChildForces="false"`: alle fünf Roster
führen genau **ein** Kontingent, untergeordnete Kontingente kommen im
Datensatz an dieser Stelle nicht vor.

---

## Bewusst nicht assertiert

- **Die Crew-/Teilbaum-Grenzen in den Rostern 01 und 05.** Dort fehlt in
  mindestens einer Einheit das Team **vollständig**. Damit existiert der Rahmen,
  in dem `aa66-b894-062c-6c9e` (Crew `min 2`) zu zählen wäre, gar nicht. Ob eine
  Auswertung für ein fehlendes Pflicht-Kind eine **Kette** von Pflicht-Ankern
  bis in die Tiefe erzeugt (und damit auch die Crew-Untergrenze meldet) oder nur
  den obersten, ist aus den Katalogdaten **nicht** ableitbar. Diese Ids stehen
  in Roster 01 und 05 deshalb **weder** unter `firing` **noch** unter `absent`.
  In den Rostern 02–04 sind sie sämtlich erfüllt und stehen unter `absent`.
- **Der Fähigkeits-Datensatz der Roster 03 und 04.** Dort stehen zwei bzw. drei
  **strukturgleiche** Team-Slots im selben Rahmen (gleiche `defId`, gleiche
  `frameDefId`, gleiche Herkunft). Der Slot-Selektor des Manifests muss **genau
  einen** Slot treffen; ein `path`-Wert wäre nötig, dessen Format der Vertrag
  offen lässt (kein Szenario im Repo nutzt ihn). `expect.capabilities` steht
  deshalb nur dort, wo der Selektor eindeutig ist: Roster 01 (Pflicht-Anker),
  Roster 02 (ein belegter Slot) und Roster 05 (zwei Slots, getrennt über
  `anchorKind` — belegt gegen Pflicht-Anker).
- **Die Rare-Obergrenze `0a44-2d3f-adfe-f3a1`** (`.gst` Z. 546, `max 1`,
  `field=selections`, `scope=force`, am `categoryEntry` „Rare"). Sie wird per
  `modifier set 2` auf **2** gehoben, sobald das Punktelimit zwischen 2000 und
  2999 liegt und keine „Border Patrols rules" gewählt sind (`.gst` Z. 589–600) —
  bei 2000 pts also in allen fünf Rostern. Ist 1 (Roster 01–04) bzw. 2
  (Roster 05) hält diese Grenze ein; sie ist aber Gegenstand eigener Szenarien
  zu punkteskalierten Kategoriegrenzen und steht hier in keiner Erwartung.
- **Sichtbarkeit, Kategorie-Umgliederung, Profile.** Die `hidden`- und
  `category`-Modifikatoren der Einheit (Z. 3737–3761) und die Profile von Crew
  (`f7ee-c3ac-077f-7f44`) und Reaper (`84b2-db11-8b53-8de6`) sind **keine**
  zählenden Grenzen; sie erscheinen deshalb **nicht** als feuernde Limits. Sie
  dienen hier allein der Wahl des Kontingents.
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht, Core-Mindestzahl, Punkte-
  budget) können zusätzlich auftreten; die Erwartung ist selektiv und macht
  darüber keine Aussage.

---

## Testkatalog (E2E-Szenarien der Reinraum-Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf nutzen
dasselbe Kontingent „Standard (DE-AB)" `26bc-729f-a188-f285`, dasselbe
Punktelimit (2000 pts) und denselben Träger; sie unterscheiden sich nur in Zahl
und Rahmen der Team-Instanzen.

> **Assertion-Fokus:** die Grenzen `41ec-bee5-0865-0448` (min 1) und
> `ccf9-fefc-71c8-bd73` (max 2) sowie — in den Rostern mit vollständigem
> Teilbaum — die Pflichtgrenzen darunter; dazu der Slot-Zustand des Teams über
> `expect.capabilities` (`current`, `effectiveMin`, `effectiveMax`, `headroom`,
> `isMandatoryUnmet`, `isBlocked`).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Team (unzulässig) | Eine Reaper-Bolt-Thrower-Einheit **ohne** jede Unterauswahl. | **PMICB-R1/R2:** `41ec-bee5-0865-0448` feuert **genau einmal** mit **Ist 0 / Grenze 1**; `ccf9` bleibt still. Der Slot des Teams ist ein **Pflicht-Anker**: Stand 0, Mindestmaß 1, Höchstmaß 2, Spielraum 2, Pflicht unerfüllt, nicht ausgeblendet. | [`01-unit-without-team-min-fires.ros`](rosters/01-unit-without-team-min-fires.ros) |
| 02 | Ein Team (legal) | Dieselbe Einheit mit **einem** Team samt vollständigem Pflicht-Teilbaum (2 × Crew mit Hand Weapon + Light Armour, 1 × Reaper). | **PMICB-R2/R7/R9:** keine der beteiligten Grenzen feuert. Der Rahmen hält acht Auswahlen bis Tiefe 3 und `ccf9` (max 2) bleibt trotzdem still — gezählt werden nur Träger-Instanzen. Slot: Stand 1, Mindestmaß 1, Höchstmaß 2, Spielraum 1. | [`02-one-team-min-satisfied.ros`](rosters/02-one-team-min-satisfied.ros) |
| 03 | Zwei Teams (legal, obere Randlage) | Dieselbe Einheit mit **zwei** Teams (Geschwister-Selektionen, je vollständig). | **PMICB-R3/R4/R6:** weiterhin **keine** Verletzung — `41ec` übererfüllt, `ccf9` mit Ist 2 exakt ausgeschöpft. | [`03-two-teams-max-satisfied.ros`](rosters/03-two-teams-max-satisfied.ros) |
| 04 | Drei Teams (unzulässig) | Dieselbe Einheit mit **drei** Teams. | **PMICB-R3/R4/R7:** `ccf9-fefc-71c8-bd73` feuert **genau einmal** mit **Ist 3 / Grenze 2**; `41ec` bleibt still. Der Ist-Wert 3 (nicht 24) belegt, dass nur Träger-Instanzen zählen. | [`04-three-teams-max-fires.ros`](rosters/04-three-teams-max-fires.ros) |
| 05 | Team in der **anderen** Einheit (unzulässig) | **Zwei** Reaper-Bolt-Thrower-Einheiten: A mit vollständigem Team, B leer. | **PMICB-R5/R6:** `41ec-bee5-0865-0448` feuert **genau einmal** mit **Ist 0 / Grenze 1** — für Rahmen B. Rahmen A ist erfüllt. Zwei Slots derselben Definition: belegt (Stand 1) in A, Pflicht-Anker (Stand 0, Pflicht unerfüllt) in B. | [`05-team-in-other-unit-min-still-fires.ros`](rosters/05-team-in-other-unit-min-still-fires.ros) |

### Herleitung je Roster (Begründung, nicht selbst Assertion)

| Roster | Team-Instanzen je Rahmen | `41ec` (min 1) | `ccf9` (max 2) | Teilbaum-Pflichten |
|--------|--------------------------|----------------|----------------|--------------------|
| 01 | Einheit: 0 | **feuert** (Ist 0) | still (0 ≤ 2) | kein Rahmen ⇒ nicht assertiert |
| 02 | Einheit: 1 | still (1 ≥ 1) | still (1 ≤ 2) | je Team erfüllt ⇒ `absent` |
| 03 | Einheit: 2 | still (2 ≥ 1) | still (2 ≤ 2) | je Team erfüllt ⇒ `absent` |
| 04 | Einheit: 3 | still (3 ≥ 1) | **feuert** (Ist 3) | je Team erfüllt ⇒ `absent` |
| 05 | Einheit A: 1, Einheit B: 0 | **feuert genau einmal** (Rahmen B, Ist 0) | still in beiden Rahmen | A erfüllt, B ohne Rahmen ⇒ nicht assertiert |

---

## Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Element) |
|---------|-----|---------------------------|
| Spielsystem (`.gst`) | `0d13-7737-ea86-4662` | `.gst`-Wurzel |
| Dark-Elves-Katalog (`.cat`) | `d4c0-4f0c-4a89-40fc` | `.cat`-Wurzel (Z. 2) |
| `catalogueLink` Dark Elves → Mercenaries | `4301-a1ec-729b-b898` → `fc47-8392-a6c8-452a` | Dark-Elves-`.cat` (Z. 10152) |
| Kontingent „Standard (DE-AB)" | `26bc-729f-a188-f285` | Dark-Elves-`.cat` → `<forceEntries>` (Z. 10081) |
| Rare-Einheit „Reaper Bolt Thrower" (der **Rahmen**) | `a757-462a-11d5-9636` | Dark-Elves-`.cat` → Wurzel-`<selectionEntries>` (Z. 3612) |
| — `categoryLink` „Rare" (primär) | `1af7-1157-b950-41b1` → `e94b-6a54-8779-cd60` | Dark-Elves-`.cat` (Z. 3617) |
| — hidden-Modifikator (nur Kontingent `ff5e-f712-03ce-bb85`) | — | Dark-Elves-`.cat` (Z. 3755–3761) |
| — Umgliederung nach „Special" (nur `77cd…` / `4b5b…`) | `43cc-fc3f-35a7-8d03` | Dark-Elves-`.cat` (Z. 3737–3754) |
| **Träger:** „Reaper Bolt Thrower team" (model, 100 pts) | `8d99-db74-0051-4a45` | Dark-Elves-`.cat` (Z. 3620) |
| — **gepinnte Grenze** (`min 1`, `scope=parent`, `shared`, `includeChildSelections=true`, `includeChildForces=false`) | `41ec-bee5-0865-0448` | Dark-Elves-`.cat` (Z. 3623) |
| — Nachbar-Obergrenze (`max 2`, sonst identische Flags) | `ccf9-fefc-71c8-bd73` | Dark-Elves-`.cat` (Z. 3622) |
| — `categoryLink` „War Machine" (nicht Rare) | `55b9-f633-a11d-8a0b` → `f672-d9d4-a601-479a` | Dark-Elves-`.cat` (Z. 3721) |
| — nicht gewählter Verweis „Mark of Slaanesh (troops)" | `65e0-81d8-eb67-ded5` → `fdca-8baf-a3cb-dc25` | Dark-Elves-`.cat` (Z. 3724) |
| „Crew" (upgrade) + `min 2` / `max 2` (`includeChildSelections=false`) | `60b3-aed5-bac2-0bd4` + `aa66-b894-062c-6c9e` / `d242-c938-19d7-0dde` | Dark-Elves-`.cat` (Z. 3626/3629/3628) |
| Gruppe „Weapons and Armour" + `min 2` / `max 2` | `f3eb-28b5-64be-28bd` + `d779-0b84-3daf-34b5` / `f7bb-1fdb-d454-9d4d` | Dark-Elves-`.cat` (Z. 3656/3678/3679) |
| „Hand Weapon" (Gruppenmitglied) + `min 1` / `max 1` | `ef5d-1234-9f7f-7f69` + `bdc0-54df-68c2-418b` / `07a8-2fa1-c38a-77b8` | Dark-Elves-`.cat` (Z. 3665/3672/3673) |
| Verweis „Light Armour" (+ `min 1` am Verweis) → Ziel (+ `max 1` am Ziel) | `381e-0653-e9c9-dc6a` (+ `6652-8c5e-4cf7-9a58`) → `055f-8e4e-f170-35d2` (+ `6f1a-1be1-6660-d9a6`) | Dark-Elves-`.cat` (Z. 3658/3660) / `.gst` (Z. 951/953) |
| „Reaper" (upgrade) + `min 1` / `max 1` | `0137-be86-e4e7-d374` + `56a0-90c8-64dc-0303` / `bf18-8f9f-a473-9acd` | Dark-Elves-`.cat` (Z. 3684/3710/3711) |
| Kategorie „Rare" + punkteskalierte Force-Grenze (nicht behauptet) | `e94b-6a54-8779-cd60` + `0a44-2d3f-adfe-f3a1` | `.gst` (Z. 544–600) |
| pts-Kostenart | `ecfa-8486-4f6c-c249` | `.gst` → `<costTypes>` |
| Nicht gewählte Kontingente (Sichtbarkeit / Umgliederung) | `77cd-dafb-16af-93c0`, `4b5b-aebb-1526-91bb`, `ff5e-f712-03ce-bb85`, `5013-f9f4-e03b-94d5` | Dark-Elves-`.cat` (Z. 10096–10149) |
