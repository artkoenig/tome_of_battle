# E2E-Regeln & Testkatalog: Pflichteinheit am Wurzel-`entryLink` (Ogre Bulls)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln und alle
erwarteten Ist/Grenze-Werte unten sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* **abgeleitet** — aus den `.gst`/`.cat`-XML, die auch die
Reinraum-Engine (`src/evaluator/`) als E2E-Fixtures nutzt — sowie aus der
Formatspezifikation [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**§9.9 „Armeeweite Pflichteinheit"**. Sie stammen **nicht** aus einem Engine-Lauf.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat` (`731d-5b13-2a92-5427`) —
  Armeelisten **„Standard (OK-AB)"** `729f-9246-5cd3-5044` und
  **„Ironskin Tribe (WD#309-UK)"** `8711-ed16-2a44-7251`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`, per `catalogueLink` `a067-78d5-50a2-affe` gefordert) — dort liegt
  das **Ziel** der Pflicht als `sharedSelectionEntry`.

## Worum es geht: zwei Kodierungen derselben Pflicht

Die Formatspezifikation (§9.9) nennt **zwei** gleichwertige Wege, eine Pflichteinheit
an einem **Wurzeleintrag des Katalogs** zu kodieren:

- **als `selectionEntry`** — der `min`-Constraint hängt direkt am
  Wurzel-`selectionEntry`;
- **als `entryLink`** — der Katalog referenziert die geteilte Einheit als
  Wurzel-`entryLink`, der Constraint hängt **am Link**: Basis `min="0"`, per
  Link-`modifier` (gegatet auf die Armeevariante) auf **1** angehoben.

§9.9 sagt dazu wörtlich: *„Beide Wurzelformen — `selectionEntry` **und**
`entryLink` — werden eingesammelt und gegen die armeeweite bzw. kontingentweite
Zählung geprüft; fehlt die Zieleinheit ganz, entsteht ein blockierender Verstoß"* —
und weiter: *„Bei der `entryLink`-Form werden die **Constraint und die Modifier des
Links** ausgewertet (nicht die des Ziels), damit die bedingte Anhebung greift."*

Die `selectionEntry`-Form ist bereits durch
[`offer-and-category-slots`](../offer-and-category-slots/README.md) gepinnt
(VC-Wurzeleintrag „Army of Sylvania" `b48b-4a69-80f1-5d47`, Grenze
`1f2f-e5cc-d04d-162e`, `min 1 scope=force`). **Dieses Szenario pinnt die
`entryLink`-Form** — dieselbe Domänenregel, die andere Kodierung.

### Struktur im Katalog

```
Ogre Kingdoms (.cat)  ← Wurzelebene, nach </forceEntries>
└ entryLinks
   └ entryLink "Ogre Bulls" (d82e-111e-89b9-2be1)  type="selectionEntry"
      │   targetId = 7754-8b3d-df99-d2d5   → Mercenaries, sharedSelectionEntries
      ├ constraints
      │   └ constraint min 0  field=selections  scope=force  (32ed-26da-3f27-5c04)
      └ modifierGroups
         ├ [Kommentar "Standard"]  condition notInstanceOf … childId=8711-… (Ironskin)
         │   └ modifier set 1  field="32ed-26da-3f27-5c04"     ← hebt die Pflicht an
         └ [Kommentar "Ironskin Tribe"]  condition instanceOf … childId=8711-…
             └ nur Kategorie-Modifikatoren, KEINE Anhebung der Grenze
```

## Wie Ogre Bulls im Roster gewählt wird (wichtig)

Ogre Bulls gelangt **nur über den Wurzel-`entryLink`** in ein Ogre-Kontingent, denn
das Ziel liegt im Mercenaries-Katalog. Die Roster-`<selection>` trägt deshalb —
wie Battlescribe es real schreibt und wie im Schwester-Szenario
[`entrylink-raw-type-counting`](../entrylink-raw-type-counting/README.md) an einer
echten Beispiel-Datei verifiziert — `entryId` = **Ziel-ID** und `entryLinkId` =
**Link-ID**:

```xml
<selection entryId="7754-8b3d-df99-d2d5" entryLinkId="d82e-111e-89b9-2be1" number="1" type="unit">
  <selections>
    <selection entryId="411b-6f5f-06f1-be37" number="3" type="model"/>                      <!-- Bulls, min 3 -->
    <selection entryId="8768-377c-88da-c3e8" entryLinkId="415f-94c9-571c-19c6" number="1"/> <!-- Ogre Club, min 1 -->
  </selections>
</selection>
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **REM-R1 (Pflicht in der Standardliste)** | Ein Kontingent der Armeeliste „Standard (OK-AB)" muss **mindestens eine** Einheit „Ogre Bulls" enthalten. Fehlt sie, entsteht ein **blockierender Verstoß** mit **Ist 0 / Grenze 1**. | Ogre-`.cat` Zeile 3133 ff., Wurzel-`entryLinks` → `entryLink` „Ogre Bulls" **`d82e-111e-89b9-2be1`** (`type="selectionEntry"`, `targetId="7754-8b3d-df99-d2d5"`). **Eigener** constraint **`32ed-26da-3f27-5c04`** `type=min value=0 field=selections scope=force shared=true includeChildSelections=false` (Zeile 3162). Im `modifierGroup` mit `<comment>Standard</comment>`: `modifier type="set" value="1" field="32ed-26da-3f27-5c04"` (Zeile 3140), gegatet auf `condition type="notInstanceOf" value="1" field="selections" scope="force" childId="8711-ed16-2a44-7251"` (Zeile 3144). Grenze = `value` des Modifikators (1), Ist = Zahl der Ogre-Bulls-Selektionen im Kontingent. |
| **REM-R2 (Ausnahme „Ironskin Tribe")** | In einem Kontingent der Armeeliste **„Ironskin Tribe (WD#309-UK)"** gilt **keine** Pflicht: die Untergrenze bleibt auf ihrem Basiswert **0**, und 0 ≥ 0 ist erfüllt. Es darf **kein** Verstoß entstehen. | Die Bedingung aus REM-R1 ist `notInstanceOf` gegen die `forceEntry`-Id `8711-ed16-2a44-7251` (`forceEntry name="Ironskin Tribe (WD#309-UK)"`, Zeile 3105). Ist das Kontingent diese Instanz, hält sie nicht → der `set→1`-Modifikator greift nicht. Der zweite `modifierGroup` (`<comment>Ironskin Tribe</comment>`, `condition instanceOf …`, Zeilen 3148–3159) enthält **ausschließlich** `category`-Modifikatoren und **keine** Anhebung von `32ed-…`. Die kanonische Form dieser Instanzprüfung (`scope="force"` + `childId="<forceId>"`) ist in der Formatspezifikation §7.7 ausdrücklich am Beispiel *Standard vs. Ironskin Tribe* dokumentiert. |
| **REM-R3 (Bezugsrahmen: je Kontingent)** | `scope="force"` mit einem **Eintrags**-Ziel zählt **je Kontingent**, nicht armeeweit: pro Kontingent ein eigener Anker mit eigener Zählung und eigener effektiver Grenze. | Constraint `32ed-…` trägt `scope="force"`; sein Ziel (`7754-…`) ist ein **Eintrag**, keine Kategorie. Formatspezifikation §7.7, Kasten „Domänenregel (Kategorie-Zähler, Ziel-Typ-Regel)": *„ein `scope="force"`-Eintragsziel zählt pro Detachment, ein Kategorie-Ziel armeeweit"* (ADR-0029). Ebenso trägt `32ed-…` **kein** `includeChildForces`. |
| **REM-R4 (Link, nicht Ziel)** | Ausgewertet werden **Constraint und Modifikatoren des Links**; das Ziel wird nur zur Auflösung/Benennung herangezogen. | Formatspezifikation §9.9. Beleg im Datensatz: der Ziel-Eintrag „Ogre Bulls" `7754-8b3d-df99-d2d5` (Mercenaries-`.cat` Zeile 3438 ff.) trägt **keinen** `min`-Constraint mit `scope="force"`/`scope="roster"` — seine einzigen Pflichten sind kontingent-unabhängig und `scope="parent"` (Modell „Bulls" `411b-…` min 3 `92d9-b5d1-9411-e954`; `entryLink` „Ogre Club" `415f-…` min 1 `fff8-7da0-1bdc-5bdf`). Die kontingentweite Pflicht existiert **nur** am Link. Umgekehrt referenzieren zwei weitere Armeebücher dasselbe Ziel über eigene, **constraint-freie** Wurzel-Verweise (O&G `0612-9f28-e986-2bce`, VC `21f4-c979-396b-c02a`) — dort gibt es folglich keine Pflicht. |
| **REM-R5 (Pflicht-Stelle statt Angebot)** | Fehlt die geforderte Einheit, ist ihr Auswahlpunkt **kein Angebot**, sondern eine **Pflicht-Stelle** mit `current 0`, effektiver Untergrenze 1 und unerfüllter Pflicht. Gilt die Anhebung nicht (Ironskin Tribe), ist derselbe Auswahlpunkt ein **Angebot** ohne unerfüllte Pflicht. | Ableitung aus REM-R1/R2 plus der bereits gepinnten Kodierungs-Schwester: `offer-and-category-slots` führt den Wurzeleintrag „Army of Sylvania" (`b48b-4a69-80f1-5d47`, `min 1 scope=force`) als Pflicht-Stelle (`mandatoryPhantom`, `effectiveMin 1`, `isMandatoryUnmet true`) und den Wurzel-`entryLink` „Manbiters" (Ziel `0efb-7f63-7932-0655`, ohne Anhebung) als Angebot (`offerAnchor`, `isMandatoryUnmet false`). Beides muss für `d82e-…`/`7754-…` genauso gelten — je nachdem, ob der Modifikator greift. |

**Nur eine Grenze, nur ein Modifikator.** Im gesamten Fixture-Satz gibt es **genau
eine** Deklaration von `32ed-26da-3f27-5c04` (Ogre-`.cat` Zeile 3162) und **genau
einen** Modifikator, der dieses Feld schreibt (Zeile 3140). Kein weiterer
Wurzel-`entryLink` der Ogre-`.cat` trägt einen eigenen `<constraints>`-Block. Die
Ist/Grenze-Werte unten sind damit eindeutig.

### Bewusst **nicht** Teil der Erwartung

- **Die `selectionEntry`-Schwesterform im selben Katalog.** Der Wurzel-Eintrag
  „Gnoblar Army special rules" `8e1e-60e8-f125-780d` trägt einen **unbedingten**
  constraint `b45a-3b5f-8d5c-3e93` `min 1 field=selections scope=force`. Er feuert
  in **jedem** Ogre-Kontingent — Standard wie Ironskin — und kann deshalb zwischen
  den hier geprüften Fällen **nichts** unterscheiden. Er ist absichtlich in keiner
  `firing`/`absent`-Liste; er darf zusätzlich auftreten.
- **Verfügbarkeit (`hidden`) und Kategorie-Modifikatoren.** Beide `modifierGroup`s
  des Links schalten daneben Kategorien um (`set-primary`/`add`/`remove` auf
  „Core"/„Rare"/„Regiment of Renown", plus `add category 735e-2da1-6356-2fdb`).
  Diese Umkategorisierung ist **keine** zählende Grenze und wird hier nicht gepinnt
  (dieselbe Abgrenzung wie in `ogre-kingdoms` und `vampire-bloodlines`).
- **Allgemeine Armeeaufbau-Diagnosen.** Die Kontingente sind bewusst **minimal**
  gehalten, damit die Regel isoliert sichtbar ist. General- und Core-Pflichten,
  Punktebudget und weitere Diagnosen können daher zusätzlich auftreten und sind
  ohne Belang (Assertion-Fokus siehe unten).

---

## Testkatalog (E2E-Szenarien)

> **Assertion-Fokus:** ausschließlich die Grenze **`32ed-26da-3f27-5c04`** und die
> namentlich benannten Auswahlpunkte. Andere Armeeaufbau-Diagnosen (General/Core,
> `b45a-…`, Punktelimit) können zusätzlich auftreten. Das Manifest
> [`scenario.json`](scenario.json) pinnt die aus den Katalogdaten abgeleiteten
> Ist/Grenze-Werte.

| # | Kontingent(e) | Ogre Bulls | Effektive Grenze je Kontingent | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|---------------|------------|--------------------------------|---------------------------------------------------|---------|
| 01 | Standard `729f-…` | — | 1 (angehoben) | `32ed-…` feuert **genau einmal**, Ist 0 / Grenze 1. Der Auswahlpunkt ist eine **Pflicht-Stelle** (`mandatoryPhantom`, `effectiveMin 1`, `isMandatoryUnmet true`). | [`01-standard-missing-bulls.ros`](rosters/01-standard-missing-bulls.ros) |
| 02 | Standard `729f-…` | 1 Einheit (3 Bulls + Ogre Club) | 1 (angehoben) | Ist 1 ≥ 1 — **keine** Verletzung. Der Auswahlpunkt ist **belegt** (`occupied`, `current 1`, keine unerfüllte Pflicht). | [`02-standard-with-bulls.ros`](rosters/02-standard-with-bulls.ros) |
| 03 | Ironskin `8711-…` | — | **0** (Basis, nicht angehoben) | 0 ≥ 0 — **keine** Verletzung. Der Auswahlpunkt ist ein **Angebot** (`offerAnchor`, `isMandatoryUnmet false`). Beleg, dass der Modifikator **des Links** gelesen wird. | [`03-ironskin-missing-bulls.ros`](rosters/03-ironskin-missing-bulls.ros) |
| 04 | Standard `729f-…` **+** Ironskin `8711-…` | in keinem | Standard 1 · Ironskin 0 | `32ed-…` feuert **genau einmal** (Ist 0 / Grenze 1) — nur am Standard-Kontingent. | [`04-standard-and-ironskin-both-missing-bulls.ros`](rosters/04-standard-and-ironskin-both-missing-bulls.ros) |
| 05 | Standard `729f-…` **zweimal** | nur im ersten | beide 1 | `32ed-…` feuert **genau einmal** (Ist 0 / Grenze 1) — am zweiten Kontingent. Beleg für REM-R3: die Zählung ist kontingent-, nicht armeeweit. | [`05-two-standard-forces-bulls-in-one.ros`](rosters/05-two-standard-forces-bulls-in-one.ros) |

### Roster → Erwartung (Grenzen / Auswahlpunkte)

| Fixture | firing (limitId → Ist/Grenze) | absent | capabilities (Ziel `7754-…`) |
|---------|-------------------------------|--------|-------------------------------|
| 01 | `32ed-…` 0/1 (count 1) | — | `mandatoryPhantom` im Rahmen `729f-…`: `current 0`, `effectiveMin 1`, `isHidden false`, `isMandatoryUnmet true`, Name „Ogre Bulls" |
| 02 | — | `32ed-…` | `occupied` im Rahmen `729f-…`: `current 1`, `isMandatoryUnmet false` |
| 03 | — | `32ed-…` | `offerAnchor` im Rahmen `8711-…`: `current 0`, `isHidden false`, `isMandatoryUnmet false`, Name „Ogre Bulls" |
| 04 | `32ed-…` 0/1 (count 1) | — | — |
| 05 | `32ed-…` 0/1 (count 1) | — | — |

### Beweisführung in beide Richtungen

- **Wird die `entryLink`-Wurzelform gar nicht eingesammelt**, bleiben 01, 04 und 05
  still — alle drei schlagen fehl.
- **Wird pauschal jede Wurzel-Verweis-Untergrenze zur Pflicht erhoben**, also ohne
  den Modifikator **des Links** und dessen Bedingung zu lesen, feuert `32ed-…` auch
  im Ironskin-Kontingent: 03 schlägt fehl (`absent`), und 04 feuert zweimal statt
  einmal (`count 1`).
- **Wird `scope="force"` als armeeweite Zählung missverstanden**, sieht Roster 05
  eine Ogre-Bulls-Einheit für die ganze Armee und bleibt still — 05 schlägt fehl.
- **Wird die erfüllte Pflicht trotzdem gemeldet**, schlägt 02 fehl (`absent`).

Roster 01, 04 und 05 sind damit die Fälle, die eine fehlende Umsetzung der Regel
aufdecken; 02 und 03 sind die Gegenproben, die eine **zu grobe** Umsetzung
aufdecken. Die `capabilities`-Zeilen von 02 und 03 schärfen deren Aussage über die
blosse Abwesenheit einer Verletzung hinaus: sie verlangen, dass der Auswahlpunkt im
Bericht überhaupt existiert und den richtigen Charakter trägt.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Armeeliste „Standard (OK-AB)" (`forceEntry`, Ogre-`.cat` Z. 3090) | `729f-9246-5cd3-5044` |
| Armeeliste „Ironskin Tribe (WD#309-UK)" (`forceEntry`, Ogre-`.cat` Z. 3105) | `8711-ed16-2a44-7251` |
| Wurzel-`entryLink` „Ogre Bulls" (Ogre-`.cat` Z. 3133) | `d82e-111e-89b9-2be1` |
| Ziel: `sharedSelectionEntry` „Ogre Bulls" (Mercenaries-`.cat` Z. 3438, `type="unit"`) | `7754-8b3d-df99-d2d5` |
| Constraint **am Link**: `min value=0 field=selections scope=force` (Z. 3162) | `32ed-26da-3f27-5c04` |
| Modifikator **am Link**: `set value=1 field="32ed-26da-3f27-5c04"` (Z. 3140) | — |
| Bedingung des Modifikators: `notInstanceOf field=selections scope=force childId=8711-…` (Z. 3144) | — |
| Modell „Bulls" (min 3 `92d9-b5d1-9411-e954`, 35 pts) | `411b-6f5f-06f1-be37` |
| `entryLink` „Ogre Club" (min 1 `fff8-7da0-1bdc-5bdf`) → Ziel | `415f-94c9-571c-19c6` → `8768-377c-88da-c3e8` |
| `catalogueLink` Ogre → Mercenaries | `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` |
| Schwesterform `selectionEntry` im selben Katalog (**nicht** gepinnt) | `8e1e-60e8-f125-780d` / constraint `b45a-3b5f-8d5c-3e93` |
| Schwesterform `selectionEntry` in VC (bereits gepinnt in `offer-and-category-slots`) | `b48b-4a69-80f1-5d47` / constraint `1f2f-e5cc-d04d-162e` |
