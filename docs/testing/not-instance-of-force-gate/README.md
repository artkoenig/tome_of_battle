# E2E-Regeln & Testkatalog: `notInstanceOf` gegen eine `forceEntry` (`scope="force"`, kanonische Kodierung)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition*
(`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §5.6 /
§7.6 / §7.7 / §8) abgeleitet; die Roster-Form ist an den bereits verifizierten
Szenarien nachgebildet (direktes `entryId`, `entryLinkId` als leeres Attribut bzw.
als Verweis-Id, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Ogre Kingdoms (6th definitive edition).cat` (`731d-5b13-2a92-5427`,
  rev 2, Z. 2)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) — per `catalogueLink a067-78d5-50a2-affe` benötigt (Z. 3087)
  und Heimat der Ziel-Definition `sharedSelectionEntry "Ogre Bulls"`
  (`7754-8b3d-df99-d2d5`).

> **Assertion-Form:** Je Roster ein `expect.capabilities[]`-Eintrag auf dem
> Ogre-Bulls-Slot (`defId` = der Verweis, `frameDefId` = das Kontingent) mit
> `current` / `effectiveMin` / `isMandatoryUnmet` / `isHidden`, dazu
> `expect.firing` / `expect.absent` für die Grenze `32ed-26da-3f27-5c04`. Die
> `condition` selbst ist **keine** zählende Grenze und taucht im
> Verletzungsbericht nie auf; beobachtbar ist allein ihre Wirkung auf den
> Constraint-Wert. Weitere Armeeaufbau-Diagnosen (General-/Core-Pflicht,
> Punktelimit) dürfen zusätzlich auftreten — die Erwartung ist selektiv.

---

## Abgrenzung zum Zwillings-Szenario

[`root-entrylink-mandatory-catalogue-scope`](../root-entrylink-mandatory-catalogue-scope/README.md)
benutzt **denselben** Träger (`entryLink d82e-111e-89b9-2be1`, constraint
`32ed-26da-3f27-5c04`), variiert aber den **Katalog** des Kontingents (Ogre
Kingdoms vs. Vampire Counts vs. Orcs and Goblins) und lässt das Ogre-Kontingent
dabei stets auf `Standard (OK-AB)` — die `notInstanceOf`-Bedingung wird dort also
**nur auf ihrer wahren Seite** ausgeübt und ist als Regel gar nicht isoliert.

Dieses Szenario variiert **genau das Gegenteil**: derselbe Katalog, derselbe
Träger, dieselbe Grenze — nur das **Kontingent innerhalb des Katalogs** wechselt.
Es übernimmt **keine** Assertion des Zwillings; sein Gegenstand ist die
Bedingungszelle, nicht die Katalog-Eigentümerschaft.

---

## Was die Formatspezifikation über die Zelle sagt

Aus dem Kasten
[„`instanceOf`/`notInstanceOf` gegen eine `forceEntry` — zwei Kodierungen"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)
sowie §7.6/§7.7 und §5.6/§8, wörtlich abgeleitet:

- **Kanonische Kodierung:** `scope` trägt das Literal-Keyword `force`, die
  `forceEntry`-Id steht in `childId` (`scope="force" childId="<forceId>"`).
  Erkannt wird die Instanzprüfung daran, dass `scope` **oder** `childId` auf eine
  reale `forceEntry`-Id auflöst; das Literal `"force"` tut das nicht.
- Die Spezifikation nennt genau diesen Datensatz als Beleg der kanonischen Form:
  „so gatet die ,Definitive Edition' z. B. ihre Standard-vs.-Ironskin-Tribe-Regeln
  (`notInstanceOf` Ironskin Tribe)".
- Es ist eine **Identitätsprüfung, kein Zählrahmen**. `instanceOf` hält, wenn das
  umschließende Kontingent eine Instanz der benannten `forceEntry` ist;
  `notInstanceOf` ist dazu **invers** — es hält in jedem anderen Kontingent. Die
  Zähl-Flags engen das nicht ein (`percentValue` ist bei `instanceOf` laut Wiki
  „has no effect"; `shared`, `includeChildSelections`, `includeChildForces` und
  `value` beschreiben eine Summe, die hier nicht gebildet wird).
- `type="set"` auf `field="<constraint-id>"` **ersetzt** den Wert dieses
  Constraints, solange die Bedingungen halten; halten sie nicht, bleibt der
  **geschriebene** Rohwert stehen (§7.7 / §7.6).
- Eine `modifierGroup` ist die Klammer „dieselbe Bedingung an mehreren
  Modifiern" — semantisch gleichwertig dazu, sie an jedem einzelnen zu
  wiederholen (§7.7). Wer fragt „gattert der Katalog das überhaupt?", muss
  `<modifiers>` **und** `<modifierGroups>` durchsuchen (Fallstrick-Kasten §7.7).
- **Sichtbarkeit vor Mindestmaß:** Die Min-Grenzen einer effektiv versteckten
  Entität werden **nicht** validiert (§5.6, verallgemeinert in §8). `hidden` an
  Verweis und Ziel wirken **ODER**. Bevor ein Mindestmaß behauptet wird, muss
  also feststehen, dass weder `entryLink` noch Ziel in dem betreffenden
  Kontingent versteckt sind — siehe **NIF-R7**.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Zeilenangaben ohne Dateipräfix beziehen sich auf
`Ogre Kingdoms (6th definitive edition).cat`.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **NIF-R1** | **Der Träger und seine Grenze.** Der Katalog-Wurzel-`entryLink` „Ogre Bulls" `d82e-111e-89b9-2be1` (`targetId="7754-8b3d-df99-d2d5"`, `type="selectionEntry"`, `hidden="false"`) trägt genau **eine** eigene Grenze: `<constraint type="min" value="0" field="selections" scope="force" shared="true" id="32ed-26da-3f27-5c04" includeChildSelections="false"/>`. Der **geschriebene** Wert ist `0` — ohne Modifikator ist das Mindestmaß dieses Slots also 0, nicht „keines". | Z. 3133 (`entryLink`, in `<entryLinks>` direkt unter dem Katalog-Wurzelelement, Geschwister von `<forceEntries>`), Z. 3162 (`constraint`). |
| **NIF-R2** | **Die Bedingung ist die kanonisch kodierte Instanzprüfung gegen ein reales `forceEntry`.** `<condition type="notInstanceOf" value="1" field="selections" scope="force" childId="8711-ed16-2a44-7251" shared="true" includeChildSelections="true"/>`. `8711-ed16-2a44-7251` ist die Id des `forceEntry "Ironskin Tribe (WD#309-UK)"` desselben Katalogs — sie benennt **kein** `selectionEntry`, keine Kategorie und keinen Verweis. | Bedingung Z. 3144 (in der `modifierGroup` mit `<comment>Standard</comment>`, Z. 3135–3147). `forceEntry` Z. 3105. |
| **NIF-R3** | **Hält die Bedingung, wird die Grenze auf 1 gesetzt.** In derselben `modifierGroup` steht `<modifier type="set" value="1" field="32ed-26da-3f27-5c04"/>` — `field` nennt die Constraint-Id aus NIF-R1. Das effektive Mindestmaß ist damit **1** in jedem Kontingent, das keine Instanz von `8711-…` ist. | `set`-Modifier Z. 3140; die Klammerbedingung Z. 3144 gilt für **alle** fünf Modifier der Gruppe (Z. 3137–3141). |
| **NIF-R4** | **Die komplementäre Gruppe rührt den Wert nicht an.** Die zweite `modifierGroup` (`<comment>Ironskin Tribe</comment>`) ist auf `type="instanceOf"` **derselben** `childId` gegattert und enthält **nur** vier `field="category"`-Modifier — **keinen** Modifikator auf `32ed-26da-3f27-5c04`. Im Ironskin-Kontingent bleibt der Rohwert `0` also unverändert stehen. | `modifierGroup` Z. 3148–3159, Bedingung Z. 3150, Modifier Z. 3154–3157 (`remove e94b…`, `add 64bf…`, `set-primary 64bf…`, `remove ee09…`). |
| **NIF-R5** | **`notInstanceOf` ist die Inverse, nicht „irgendein anderes benanntes Kontingent".** Die beiden Zweige benennen dieselbe **eine** Id. Es gibt im Katalog drei `forceEntry`s; in zweien (`729f…`, `9746…`) hält der `notInstanceOf`-Zweig, in genau einem (`8711…`) der `instanceOf`-Zweig. Die Regel ist damit an **zwei unabhängigen** Nicht-Ironskin-Kontingenten prüfbar. | `forceEntry "Standard (OK-AB)"` `729f-9246-5cd3-5044` (Z. 3090), `"Ironskin Tribe (WD#309-UK)"` `8711-ed16-2a44-7251` (Z. 3105), `"[WIP] Gnoblar Horde (WD#310-UK)"` `9746-73c4-6ea2-578a` (Z. 3118) — alle drei `hidden="false"`. |
| **NIF-R6** | **Die Zähl-Flags engen die Prüfung nicht ein.** Die Bedingung trägt `field="selections"`, `value="1"`, `shared="true"`, `includeChildSelections="true"`. Trotzdem hält sie in einem **völlig leeren** Kontingent: Roster 01 und 03 enthalten keine einzige `selection`, und die gehobene Grenze feuert dort. Eine zählende Lesart käme dort zwangsläufig auf 0 gezählte Auswahlen — die Unterscheidung ist maximal. | Attributsatz Z. 3144 gegen den Roster-Zustand (Kontingent ohne jede `selection`). Format: §7.7, „Identitätsprüfung, kein Zählrahmen". |
| **NIF-R7** | **Der Slot ist in keinem der drei Kontingente versteckt** — das Mindestmaß ist also überhaupt validierbar (§5.6/§8). Der Verweis trägt `hidden="false"` und hat **keinen** `field="hidden"`-Modifikator (weder in `<modifiers>` noch in einer `<modifierGroup>`); das Ziel trägt ebenfalls `hidden="false"` und keinen `hidden`-Modifikator auf sich selbst. Das ODER aus §8 ergibt in allen drei Kontingenten `isHidden=false`. | Verweis Z. 3133 (`hidden="false"`), seine gesamten Modifikatoren Z. 3134–3166: fünf `field="category"`, ein `field="32ed-…"`, sonst nichts. Ziel `Mercenaries (…).cat:3438` (`hidden="false"`), Eintrag Z. 3438–3581 ohne `hidden`-Modifikator auf der Wurzelebene. Kontrast im selben Katalog: `entryLink "Rhinox Riders"` `c8d5-1198-3d4a-8a67` besitzt sehr wohl einen `set hidden=true` (Z. 3262) — das Muster fehlt hier also nicht aus Nachlässigkeit. |
| **NIF-R8** | **Das Ziel bringt keine eigene Grenze mit,** die das Bild verfälschen könnte: `selectionEntry "Ogre Bulls"` `7754-8b3d-df99-d2d5` hat **kein** `<constraints>`-Element auf seiner Wurzelebene. Alle Grenzen des Slots stammen ausschließlich vom Verweis (NIF-R1) — es gibt insbesondere **kein** Höchstmaß. | `Mercenaries (…).cat:3438–3581`: `infoLinks`, `categoryLinks`, `selectionEntries`, `selectionEntryGroups`, `entryLinks`, `costs` — kein `constraints`. Zum Vergleich trägt der Nachbar `selectionEntry "Ironguts"` `3e16-db9e-8507-029a` sehr wohl eines (`Mercenaries (…).cat:3624`, `min 0 scope=force`, `3492-eac7-6894-1241`). |
| **NIF-R9** | **Der Slot wird in allen drei Kontingenten angeboten** — die Bedingung nimmt ihm nur die Pflicht, nicht die Wählbarkeit. Beide Modifikator-Zweige enden mit derselben effektiven Primärkategorie **Core** (`64bf-efb4-9978-26df`), und jedes der drei `forceEntry` führt einen `categoryLink` auf Core. Basis-Primärkategorie des Ziels ist „Regiment of Renown" (`ee09-…`), die beide Zweige entfernen. | Zweig „Standard": `set-primary 64bf` (Z. 3137), `remove e94b` (Z. 3138), `add 64bf` (Z. 3139), `remove ee09` (Z. 3141). Zweig „Ironskin Tribe": Z. 3154–3157, gleicher Netto-Effekt. `categoryLink` Core je Force: `b508-4bfc-bcb0-3f84` (Z. 3098), `6a19-fae1-1d57-a4a5` (Z. 3113), `2beb-5f77-ed7d-0a9d` (Z. 3126). Basis-`categoryLinks` des Ziels: `Mercenaries (…).cat:3445–3446` (`e94b…` Rare, `ee09…` RoR `primary="true"`). |
| **NIF-R10** | **Die Zelle ist im Korpus neunfach belegt** — das Muster ist kein Einzelfall dieses einen Verweises. Vier Vorkommen im Ogre-Katalog (alle gegen `8711-…`), fünf im Vampire-Counts-Katalog (gegen `4072-c3b8-84c4-a097` bzw. `5e95-7d57-2b9c-d77d`). Alle neun tragen denselben Flag-Satz `value="1" shared="true" includeChildSelections="true"` ohne `includeChildForces`. | `Ogre Kingdoms (…).cat` Z. 3144, 3178, 3241, 3279; `Vampire Counts (…).cat` Z. 300, 324, 377, 554, 625. |
| **NIF-R11** | **Zeugen im selben Roster (nur Prosa, keine Assertion).** Dieselbe Ironskin-/Standard-Klammer gattert im selben `<entryLinks>`-Block drei weitere Verweise: „Leadbelchers" `c487-0350-e5cf-0c0a`, „Rhinox Riders" `c8d5-1198-3d4a-8a67`, „Ironguts" `53f2-756c-f086-9da6`. Sie schalten aber **ausschließlich** `field="category"` — **keiner** von ihnen setzt einen Constraint-Wert. Sie stützen die Lesart der Bedingung, sind über den Verletzungsbericht bzw. `capabilities` aber nicht als Zahl beobachtbar. | Leadbelchers Z. 3168 (Bedingungen Z. 3178 / Z. 3184), Rhinox Riders Z. 3235 (Z. 3241 / Z. 3249), Ironguts Z. 3269 (Z. 3279). |

### Warum `effectiveMin: 0` und nicht `null`

Der Manifest-Vertrag liest `effectiveMin: null` als „**kein** Mindestmaß". Im
Ironskin-Kontingent existiert aber sehr wohl eines — der Katalog schreibt
`type="min" value="0"` hin (NIF-R1), und kein Modifikator ändert daran etwas
(NIF-R4). Die Daten fordern deshalb `0`. Der Sentinel `-1` („unbegrenzt") gilt
laut §7.6 nur dort, wo er **hingeschrieben** steht, und ist hier nirgends
geschrieben; eine Normalisierung „min 0 ⇒ kein Mindestmaß" ist im Format nicht
belegt. Meldet die Engine hier `null`, ist das eine **Abweichung zum
Untersuchen**, nicht zum Wegdefinieren (ADR 0033).

### Bewusst ausgelassene Facetten

| Facette | Warum nicht als feuernde Grenze / Assertion erwartet |
|---------|------------------------------------------------------|
| Die `condition` selbst | Eine `condition` ist keine `constraint`. Der Verletzungsbericht kodiert zählende Grenzen, keine Bedingungen — die Zelle ist nur mittelbar über den gesetzten Constraint-Wert beobachtbar. |
| Die **Kategorie-Umhängung** beider Zweige (`set-primary`/`add`/`remove` auf `field="category"`, sowie das unbedingte `add "Bully Bully"` `735e-2da1-6356-2fdb`, Z. 3165) | Kategoriezugehörigkeit ist keine zählende Grenze. Sie ist zudem in **beiden** Zweigen netto gleich (NIF-R9) und taugt deshalb gar nicht zur Unterscheidung. Kategorie-Slots sind Gegenstand von [`offer-and-category-slots`](../offer-and-category-slots/README.md). |
| **`shared` / `includeChildSelections` als Verengung** | An allen neun Fundstellen stehen dieselben, permissiven Werte (NIF-R10); der Datensatz kennt keine kontrastierende Variante. Was die Roster stattdessen pinnen, ist die stärkere Aussage: dass eine **zählende Lesart überhaupt** ausgeschlossen ist (NIF-R6, leeres Kontingent). |
| **`anchorKind` des Slots** | Ob ein Slot mit gehobener Pflicht als `mandatoryPhantom` und derselbe Slot mit `min 0` als `offerAnchor` geführt wird, ist eine Aussage über die Slot-Taxonomie der Engine, nicht über die Katalogdaten. Das Manifest benennt den Slot deshalb über `defId` + `frameDefId` und behauptet die Herkunftsart nicht. |
| **Die Mindestgröße der Einheit** (`min 3` auf dem Modell „Bulls", `92d9-b5d1-9411-e954`) und die **Pflichtwaffe** (`min 1` auf `entryLink "Ogre Club"` `415f-94c9-571c-19c6`, `fff8-7da0-1bdc-5bdf`) | In den Rostern 04/05 bereits erfüllt (drei Modelle, ein Ogre Club) — sie sind nur Beiwerk, damit die gewählte Einheit in sich stimmig ist. |
| **`primary-catalogue`-Identitätsprüfungen** | Eigenes Muster mit eigenem Kasten (§7.6) und eigenem Szenario ([`primary-catalogue-scope`](../primary-catalogue-scope/README.md)). Hier steht `scope="force"`; eine `UNRESOLVED_SCOPE`-Diagnose ist deshalb nicht Gegenstand dieses Szenarios. |

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Ogre Kingdoms + Mercenaries) und **denselben**
Katalog. Rosterpaar 01/02 bzw. 04/05 unterscheidet sich jeweils in **genau einem**
Attribut: dem `entryId` des Kontingents.

| # | Testtitel | Kontingent | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|------------|-----------------|--------------------------------------------------------|---------|
| 01 | Bedingung hält → Pflicht 1 | `729f…` „Standard (OK-AB)" | Leeres Kontingent. | **NIF-R2/R3/R6:** `32ed-26da-3f27-5c04` feuert (Ist 0, Grenze 1); der Slot meldet `effectiveMin 1`, `current 0`, `isMandatoryUnmet true`, `isHidden false`. | [`01-standard-force-min-raised.ros`](rosters/01-standard-force-min-raised.ros) |
| 02 | Bedingung hält nicht → Rohwert 0 | `8711…` „Ironskin Tribe (WD#309-UK)" | **Derselbe** leere Aufbau. | **NIF-R4:** `32ed-26da-3f27-5c04` darf **nicht** feuern; der Slot meldet `effectiveMin 0`, `current 0`, `isMandatoryUnmet false`. Der einzige Unterschied zu 01 ist das Kontingent. | [`02-ironskin-force-min-stays-zero.ros`](rosters/02-ironskin-force-min-stays-zero.ros) |
| 03 | Zweiter Nicht-Ironskin-Zeuge | `9746…` „[WIP] Gnoblar Horde (WD#310-UK)" | **Derselbe** leere Aufbau. | **NIF-R5:** Die Bedingung nennt dieses Kontingent nirgends und hält trotzdem — Ergebnis identisch zu 01. Schützt davor, dass die Wirkung fälschlich an „Standard" statt an „nicht Ironskin" hängt. | [`03-gnoblar-horde-force-min-raised.ros`](rosters/03-gnoblar-horde-force-min-raised.ros) |
| 04 | Gehobene Pflicht erfüllbar | `729f…` „Standard (OK-AB)" | Eine „Ogre Bulls"-Einheit (Verweis `d82e…`) mit drei „Bulls"-Modellen und einem „Ogre Club". | Positive Kontrolle: `effectiveMin` bleibt **1**, `current 1`, `isMandatoryUnmet false`, die Grenze feuert nicht. Belegt, dass die Abwesenheit in 02 an der gefallenen Grenze liegt, nicht an einem gar nicht bewerteten Slot. | [`04-standard-force-bulls-selected.ros`](rosters/04-standard-force-bulls-selected.ros) |
| 05 | Angebot bleibt trotz fehlender Pflicht | `8711…` „Ironskin Tribe (WD#309-UK)" | **Derselbe** Aufbau wie 04. | **NIF-R9:** Die fehlgeschlagene Bedingung nimmt dem Slot nur die *Pflicht*, nicht das *Angebot*: `effectiveMin 0`, `current 1`, keine Verletzung. | [`05-ironskin-force-bulls-selected.ros`](rosters/05-ironskin-force-bulls-selected.ros) |

Die Matrix, die das Szenario aufspannt (Zelle = `effectiveMin` / `current` /
feuert `32ed-26da-3f27-5c04`):

| Kontingent | ohne Ogre Bulls | mit Ogre Bulls |
|------------|------------------|-----------------|
| `729f…` Standard (**nicht** `8711`) | 01: **1** / 0 / **ja** | 04: **1** / 1 / nein |
| `9746…` Gnoblar Horde (**nicht** `8711`) | 03: **1** / 0 / **ja** | — |
| `8711…` Ironskin Tribe (**ist** `8711`) | 02: **0** / 0 / nein | 05: **0** / 1 / nein |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **NIF-R2/R6** — ob `scope="force"` + `childId="<forceEntry-Id>"` überhaupt als
   Instanzprüfung erkannt wird, statt in eine selektionsweise Zählung
   zurückzufallen. Im leeren Kontingent (01/03) unterscheidet sich beides
   maximal: die Identitätslesart liefert „hält" (Grenze 1, feuert), jede
   Zähllesart „hält nicht" (Grenze 0, feuert nicht).
2. **NIF-R4/R5** — ob die Inversion sauber kippt: 02 muss schweigen, 01 **und**
   03 müssen feuern. Ein „im Ogre-Katalog feuert es immer"-Kurzschluss fiele an
   02 auf, ein „nur Standard"-Kurzschluss an 03.
3. **`effectiveMin: 0`** im Ironskin-Kontingent (siehe Kasten oben) — `null`
   statt `0` wäre eine Normalisierung, die das Format nicht deckt.
4. **NIF-R7** — meldet ein Kontingent `isHidden: true`, wäre das Mindestmaß nach
   §5.6/§8 gar nicht zu validieren und die ganze Aussage von 01/03 stünde auf
   anderem Grund. Die Flags werden deshalb mitgepinnt.
5. Die Slot-Adressierung `defId` (= der **Verweis** `d82e…`) + `frameDefId`
   (= die `forceEntry`-Id) muss den Slot **eindeutig** treffen — im Datensatz
   dieses Szenarios gibt es genau **einen** Wurzel-`entryLink` auf
   `7754-8b3d-df99-d2d5`.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Ogre Kingdoms** (rev 2) | `731d-5b13-2a92-5427` (Z. 2) |
| Bibliothek **Mercenaries** (`library="true"`) | `fc47-8392-a6c8-452a` |
| `catalogueLink` Ogre Kingdoms → Mercenaries | `a067-78d5-50a2-affe` (Z. 3087) |
| Force „Standard (OK-AB)" (Bedingung hält) | `729f-9246-5cd3-5044` (Z. 3090) |
| Force „Ironskin Tribe (WD#309-UK)" (Ziel der `childId`; Bedingung hält **nicht**) | `8711-ed16-2a44-7251` (Z. 3105) |
| Force „[WIP] Gnoblar Horde (WD#310-UK)" (zweiter Nicht-Ironskin-Zeuge) | `9746-73c4-6ea2-578a` (Z. 3118) |
| Katalog-Wurzel-`entryLink` „Ogre Bulls" (Träger der Grenze; `defId` des Slots) | `d82e-111e-89b9-2be1` → `7754-8b3d-df99-d2d5` (Z. 3133) |
| Die gegatterte Grenze (`min`, Rohwert 0, `field="selections"`, `scope="force"`) | `32ed-26da-3f27-5c04` (Z. 3162) |
| `set`-Modifier auf diese Grenze (`value="1"`) | Z. 3140, in der `modifierGroup` „Standard" (Z. 3135–3147) |
| Die `notInstanceOf`-Bedingung (kanonisch: `scope="force"`, `childId="8711-…"`) | Z. 3144 |
| Die komplementäre `instanceOf`-Bedingung (ohne Constraint-Modifikator) | Z. 3150, in der `modifierGroup` „Ironskin Tribe" (Z. 3148–3159) |
| Ziel `sharedSelectionEntry "Ogre Bulls"` (`hidden="false"`, **ohne** eigene `constraints`) | `7754-8b3d-df99-d2d5` (`Mercenaries (…).cat:3438–3581`) |
| Modell „Bulls" (`min 3` / `max -1`, Beiwerk in 04/05) | `411b-6f5f-06f1-be37` — `92d9-b5d1-9411-e954` / `d5f9-2bf9-c174-f44e` |
| `entryLink "Ogre Club"` (`min 1`/`max 1`, Beiwerk in 04/05) | `415f-94c9-571c-19c6` → `8768-377c-88da-c3e8` — `fff8-7da0-1bdc-5bdf` / `431b-bb5a-8710-7c0c` |
| Kategorie *Core* (effektive Primärkategorie in beiden Zweigen) | `64bf-efb4-9978-26df` — `categoryLink` je Force: `b508-4bfc-bcb0-3f84` / `6a19-fae1-1d57-a4a5` / `2beb-5f77-ed7d-0a9d` |
| Kategorien *Rare* / *Regiment of Renown* (Basis des Ziels, von beiden Zweigen entfernt) | `e94b-6a54-8779-cd60` / `ee09-9a50-ad78-9c32` |
| Kategorie „Bully Bully" (unbedingtes `add` am Verweis, Z. 3165) | `735e-2da1-6356-2fdb` (Z. 9) |
| Weitere Vorkommen der Zelle im Ogre-Katalog (nur Kategorie-Modifier, nicht getestet) | Z. 3178 (`c487-0350-e5cf-0c0a`), Z. 3241 (`c8d5-1198-3d4a-8a67`), Z. 3279 (`53f2-756c-f086-9da6`) |
| Vorkommen der Zelle im Vampire-Counts-Katalog (anderer Träger, nicht getestet) | `Vampire Counts (…).cat` Z. 300, 324, 377, 554, 625 (`childId` `4072-c3b8-84c4-a097` bzw. `5e95-7d57-2b9c-d77d`) |
