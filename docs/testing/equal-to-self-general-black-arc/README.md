# E2E-Regeln & Testkatalog: `equalTo … scope="self"` — „Captain of the Black Arc"

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.6/§7.7)
abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
nachgebildet (direktes `entryId` mit `entryLinkId=""` für eine eigene Definition,
`entryId="<Ziel>" entryLinkId="<Verweis>"` für eine verlinkte Aufwertung —
vgl. [`equal-to-unit-inner-circle-markup`](../equal-to-unit-inner-circle-markup/rosters/02-blazing-sun-with-inner-circle-5pts.ros)
und [`set-unresolved-target-inert-lord-slot`](../set-unresolved-target-inert-lord-slot/rosters/04-vampire-coast-luthor-lord-min-silent.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Dark Elves (6th definitive edition).cat` (`d4c0-4f0c-4a89-40fc`, rev 1)
  — Kontingente **„The Raiding Army (DE-AB)"** `4b5b-aebb-1526-91bb` (Z. 10109)
  und **„Standard (DE-AB)"** `26bc-729f-a188-f285` (Z. 10081)
- Zusatz: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`), von
  Dark Elves per `catalogueLink` `4301-a1ec-729b-b898` (Z. 10152) eingebunden —
  Abhängigkeit des Datensatzes, im Szenario sonst ungenutzt.

> **Assertion-Form:** Dieses Szenario prüft die Regel **nicht** als zählende
> Grenze — ein Name ist ein `modifier`-Effekt, keine Schranke, und der
> Verletzungsbericht kodiert keine Namen (vgl. [`vampire-bloodlines`](../vampire-bloodlines/README.md),
> VBL-R4/R6). Jede Regel-Aussage ist ein `expect.capabilities[]`-Eintrag
> (`defId` + effektiver `name`). Die `firing`/`absent`-Listen dienen nur der
> **Kontrolle des Rosterzustands** (genau ein bzw. kein General, Pflicht-Handwaffe
> erfüllt). Andere Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier
> ohne Belang (selektive Erwartung) — namentlich:
> - die Core-Pflicht der `.gst` (`35c2-d478-392a-aeb1`, min 2; die Roster führen
>   bewusst nur die zwei Charaktere),
> - die Pflicht-Untergrenze der Highborn-Gruppe „Character options"
>   (`a8f3-c5ec-4979-8f97`, min 1, bewusst nicht bestückt),
> - in **Roster 01** zusätzlich die Sea-Dragon-Cloak-Untergrenze
>   `8601-3e39-2e5b-28b6`: sie steht per Basis auf 0 und wird von einem
>   `set 1`-Modifikator gehoben, dessen `and`-Gruppe (Z. 300–309) genau dann hält,
>   wenn das Kontingent `4b5b-…` ist **und** der Elternteil den General trägt —
>   also exakt in Roster 01. Das ist eine **zählende** Nebenfacette desselben
>   Gates (siehe „Bewusst nicht abgedeckte Facetten") und wird hier weder
>   behauptet noch ausgeschlossen.

---

## Die geprüfte Formatregel

Zwei voneinander unabhängige Aussagen stecken in der Bedingung

```xml
<condition type="equalTo" value="1" field="selections" scope="self"
           childId="7a1e-c134-434e-3313" shared="true" includeChildSelections="true"/>
```

1. **Der Rahmen** — `scope="self"` ist der **Träger der Query selbst**: gezählt
   wird ausschließlich *innerhalb* der Auswahl, an deren Modifikator die Bedingung
   hängt (`includeChildSelections="true"` zieht auch tiefer verschachtelte
   Auswahlen darunter mit ein). Nicht das Kontingent (`force`), nicht das Roster
   (`roster`), nicht die Elternauswahl (`parent`). Formatreferenz: Scope-Aufzählung
   §7.6 (`self` neben `parent`/`force`/`roster`/`unit`) und §7.7 (der `scope`
   bestimmt den Bezugsrahmen der Zählung); dieselbe Lesart pinnt bereits
   [`at-least-self-model-count`](../at-least-self-model-count/README.md) (ASMC-R2).
2. **Der Vergleich** — `equalTo` hält **nur beim exakt geschriebenen Wert**: bei
   Ist 1 gegen `value="1"` ja, bei Ist 0 nein, bei Ist 2 nein. Es ist keine
   Schwelle wie `atLeast` (Vergleichstypen §7.7). Beobachtbar sind auf diesen
   Daten die Fälle **1** und **0**; der Fall **2** ist nicht baubar (→ ETSG-R5).

Die zweite Bedingung derselben `and`-Gruppe ist die **kanonische**
`forceEntry`-Instanzprüfung (`scope="force"` + `forceEntry`-Id in `childId`,
§7.7-Kasten) — dieselbe Zelle, die
[`force-instance-gated-rename`](../force-instance-gated-rename/README.md) isoliert
festhält. Hier dient sie als **zweites** Mitglied der `and`-Gruppe: Roster 04
zeigt, dass die self-skopierte Bedingung allein nicht genügt.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Alle Belege aus `Dark Elves (6th definitive edition).cat`, sofern nicht anders
vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ETSG-R1** | **Highborn:** Der Anzeigename des `selectionEntry "Highborn"` wird um **„Captain of the Black Arc"** ergänzt (Trenner: ein Leerzeichen), wenn **beide** Bedingungen halten. Ergebnis: **„Highborn Captain of the Black Arc"**. | `selectionEntry "Highborn"` `79af-7092-a9a9-393d` (Z. 13, Root-`<selectionEntries>`) → `<modifier type="append" value="Captain of the Black Arc" field="name" join=" ">` (Z. 377) mit `conditionGroup type="and"` (Z. 379) aus `equalTo 1 … scope="self" childId="7a1e-c134-434e-3313"` (Z. 381) **und** `instanceOf 1 … scope="force" childId="4b5b-aebb-1526-91bb"` (Z. 382). `join=" "` wird **verbatim** übernommen (§7.7). |
| **ETSG-R2** | **Noble:** byte-gleicher Modifikator und byte-gleiche Gruppe an einem **zweiten** Träger — nur die `childId` der `equalTo`-Bedingung benennt **seinen eigenen** General-Verweis. Ergebnis: **„Noble Captain of the Black Arc"**. | `selectionEntry "Noble"` `bd43-41c0-298e-22be` (Z. 948) → `<modifier type="append" … join=" ">` (Z. 1271) mit `equalTo 1 … scope="self" childId="030a-4b09-0210-225c"` (Z. 1275) und derselben `instanceOf`-Bedingung (Z. 1276). |
| **ETSG-R3** | **Was gezählt wird:** die `childId` ist jeweils der **`entryLink`** „General" *unter dem jeweiligen Charakter* — beim Highborn `7a1e-c134-434e-3313` (Z. 364), beim Noble `030a-4b09-0210-225c` (Z. 1263). Beide zeigen auf **dieselbe** geteilte Aufwertung `1b7c-2c90-6d96-28c9` der `.gst` (Z. 1191). Im Roster steht eine solche Auswahl als `entryId="1b7c-…" entryLinkId="<Verweis>"`. | ebd.; `.gst` `selectionEntry "General"` `1b7c-2c90-6d96-28c9` (Z. 1191) mit `categoryLink` auf die Kategorie „General" `a37e-7207-de6d-acb0` (Z. 1197). |
| **ETSG-R4** | **Der `self`-Rahmen (Kernaussage):** Ein Geschwister-Charakter **im selben Kontingent**, der die General-Aufwertung **nicht selbst** trägt, behält seinen Katalognamen — obwohl ein General in der Force existiert. Der Zähler des Nicht-Trägers ist **0**, nicht 1. | `scope="self"` an beiden Bedingungen (Z. 381 / Z. 1275). Der Katalog stellt für diese Aussage genau die nötigen **zwei** Träger bereit (Highborn = Lord, Noble = Held), sodass sie ohne zwei Instanzen derselben Definition beobachtbar ist. |
| **ETSG-R5** | **`equalTo` ist exakt:** bei Zähler **0** hält die Bedingung nicht (Roster 03). Der Fall Zähler **> 1** ist auf diesen Daten **nicht legal baubar**: die geteilte Aufwertung trägt `max 1 scope="parent"` **und** `max 1 scope="force"`. Er bekommt daher — wie im Schwester-Szenario `equal-to-unit-inner-circle-markup` — **bewusst kein Roster**. | `.gst` `1b7c-2c90-6d96-28c9` → `constraint max 1 field="selections" scope="force" id="fc6d-21e4-3da5-17f9"` (Z. 1193) und `constraint max 1 field="selections" scope="parent" id="a830-88fc-15ba-9584"` (Z. 1194); zusätzlich die Kategorie „General" `a37e-…` mit `max 1 scope="force"` `d818-c60d-b1f8-8aaa` (Z. 723) und `max 1 scope="parent"` `54c9-b217-e67c-bd60` (Z. 725). |
| **ETSG-R6** | **Die `and`-Gruppe braucht beide Mitglieder:** derselbe Aufbau in einem Kontingent, das **nicht** `4b5b-…` instanziiert, lässt beide Namen unverändert — auch mit gewählter General-Aufwertung. | `conditionGroup type="and"` (Z. 379 / Z. 1273): eine `and`-Gruppe hält nur, wenn **alle** Mitglieder halten (§7.7). Gegenprobe-Kontingent: `forceEntry "Standard (DE-AB)"` `26bc-729f-a188-f285` (Z. 10081), das dieselben Kategorie-Verweise („Lord" `d024-…`, „Heroes" `c16b-…`) trägt wie `4b5b-…` (Z. 10115/10116) — die beiden Charaktere sind dort gleichermaßen wählbar. |
| **ETSG-R7** | **Kein anderer Namens-Modifikator stört:** Der Highborn trägt außerdem `set "City Commander"` (gegatet auf `forceEntry "City Garrison (AN-02)"` `77cd-dafb-16af-93c0`) und `set hidden=true` (gegatet auf `forceEntry "Cult of Slaanesh (SoC)"` `5013-f9f4-e03b-94d5`). Beide Gatter sind in **beiden** hier benutzten Kontingenten geschlossen. Der Noble trägt gar keinen weiteren `field="name"`-Modifikator. | Highborn-Modifikatoren Z. 371–398: `set "City Commander"` Z. 372 (Bedingung Z. 374), `append` Z. 377, `set hidden` Z. 387 (Bedingung Z. 389), `set 125` auf die BP-Punktgrenze Z. 392 (Bedingung: „Border Patrols rules" `4e15-0353-165f-5528` im Roster — in keinem Roster gewählt). Noble-Modifikatoren Z. 1270–1287: nur `append` (Z. 1271) und derselbe BP-`set` (Z. 1281). `forceEntry`-Ids: `77cd-…` Z. 10096, `5013-…` Z. 10137 — beide ≠ `4b5b-…` (Z. 10109) und ≠ `26bc-…` (Z. 10081). |
| **ETSG-R8** | **Namen sind keine zählende Grenze.** Die Regel erscheint deshalb **nicht** als feuernde Limit-Id, sondern ausschließlich als `expect.capabilities[].name`. | Der `append`-Modifikator adressiert `field="name"`, nicht die `id` eines `constraint`s (§7.7: nur ein `set` auf eine Constraint-`id` verändert eine Grenze). |

### Wie scharf trennt das Roster-Paar die Rahmen?

Ehrlichkeitshalber, weil es aus den Daten folgt und nicht aus dem Testwunsch:
Die `childId` jeder Bedingung benennt den **`entryLink` des eigenen Trägers**.
Damit trennt das Paar 01/02 zwei Lesarten **sicher**, eine dritte nur bedingt:

| Lesart des Zählers | Verhalten in Roster 01 | vom Szenario unterschieden? |
|--------------------|------------------------|------------------------------|
| `self` + verweis-genaue `childId` (Daten-Lesart) | Highborn 1 → Beiname; Noble 0 → kein Beiname | **das ist die Erwartung** |
| `force`/`roster` + über das **Ziel** aufgelöste `childId` („irgendwo steht ein General") | Highborn 1 **und** Noble 1 → **beide** benannt | **ja** — Roster 01/02 fallen sofort auf |
| `force`/`roster` + verweis-genaue `childId` | Highborn 1, Noble 0 → wie die Daten-Lesart | **nein** — auf diesen Daten nicht von `self` trennbar, weil jeder Träger seinen *eigenen* Verweis benennt und dieser genau einmal im Roster vorkommt |

Die dritte Zeile ist keine Lücke der Roster, sondern der Daten: eine Trennung
verlangte **zwei Instanzen derselben Träger-Definition** in einem Kontingent
(zwei Highborn) — die verhindert die Lord-Obergrenze `fda5-91c2-e17f-774c`
(`max 1 scope="parent"` an der Kategorie „Lord", per Modifier bei 2000–2999 pts
auf 1 gesetzt, `.gst` Z. 252/363); und ein zweiter General-Träger im selben
Kontingent risse die force-weite Obergrenze `fc6d-21e4-3da5-17f9`. Das Szenario
pinnt daher, was baubar ist, und benennt die verbleibende Ununterscheidbarkeit
statt sie zu verschweigen.

### Warum alle Roster ein Punktelimit von 2000 tragen

Die `.gst`-Kategorie „Lord" `d024-d25b-a9b4-73b6` wird **verborgen**, sobald das
Roster-Punktelimit **unter 2000** liegt (`<modifier type="set" value="true"
field="hidden">` mit `condition lessThan 2000 field="limit::ecfa-8486-4f6c-c249"
scope="roster"`, `.gst` Z. 222–227). Bei genau 2000 hält `lessThan` nicht — der
Highborn ist regulär wählbar, und die Lord-Obergrenze `fda5-91c2-e17f-774c` steht
auf 1 (`.gst` Z. 252–263). Alle vier Roster deklarieren deshalb
`<costLimit>` 2000 pts; die Summe (Highborn 125 + Noble 70 + General 0) liegt mit
195 pts weit darunter, ein Budget-Verstoß ist ausgeschlossen.

### Bewusst nicht abgedeckte Facetten

| Facette | Beleg | Warum ausgelassen |
|---------|-------|--------------------|
| Zähler **> 1** (`equalTo` „von oben" gerissen) | `a830-88fc-15ba-9584` / `fc6d-21e4-3da5-17f9` (`.gst` Z. 1193–1194) | Nicht legal baubar; ein Roster dafür wäre eine erfundene Datenlage. Dieselbe Entscheidung wie in [`equal-to-unit-inner-circle-markup`](../equal-to-unit-inner-circle-markup/README.md). |
| `set hidden=true` des Highborn im Cult of Slaanesh | Z. 387–391 | Verfügbarkeit (`hidden`) ist nicht Teil des Verletzungsberichts (vgl. `vampire-bloodlines`, VBL-R4/R5); als `capabilities[].isHidden` prüfbar, aber hier nicht Gegenstand. |
| `set "City Commander"` im City Garrison | Z. 372–376 | Gleiche Namens-Mechanik, aber ein `instanceOf`-Gate ohne `self`-Anteil — das pinnt [`force-instance-gated-rename`](../force-instance-gated-rename/README.md). Hier nur als Störquelle geprüft (ETSG-R7: still). |
| Sea-Dragon-Cloak-Untergrenze 0 → 1, wenn Raiding Army **und** General am Elternteil | `<modifier type="set" value="1" field="8601-3e39-2e5b-28b6">` (Z. 300) mit `instanceOf force 4b5b-…` (Z. 304) **und** `atLeast 1 … scope="parent" childId="7a1e-c134-434e-3313"` (Z. 305) | Modifikator auf einen **Constraint-Wert** — zählende Facette einer anderen Szenario-Familie; zudem hängt das Feuern einer `min`-Grenze am Seeding-Verhalten. Beachtenswert: diese Schwester-Bedingung benennt denselben Verweis mit `scope="parent"` statt `self` — der Katalog nutzt beide Rahmen nebeneinander. In Roster 01 greift der `set`; die Roster wählen keinen Sea Dragon Cloak, die Folge-Grenze wird weder behauptet noch ausgeschlossen. |
| Profilwerte der beiden Charaktere | `infoLink` Z. 16–63 / Z. 1289–1341 | Profilwerte sind nicht Gegenstand dieses Szenarios (vgl. `vampire-bloodlines`, VBL-R6). |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle vier Roster
tragen **denselben** Kern: ein Highborn `79af…` und ein Noble `bd43…` in **einem**
Kontingent, jeder mit seiner Pflicht-Handwaffe (Highborn `5dc5-1087-8483-1d9b`,
min `ad31-faa2-6dd0-c8ff`; Noble `2378-4502-c0b0-c8b0`, min `5d7c-d550-cae0-f61c`),
Punktelimit 2000. Variiert wird **nur**, wo (bzw. ob) die General-Aufwertung hängt
— und in Roster 04 zusätzlich die `entryId` der Force.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | General am Highborn → nur der Highborn wird benannt | Kontingent **„The Raiding Army (DE-AB)"**; General (`entryLinkId="7a1e…"`) **nur** am Highborn. | **ETSG-R1 + ETSG-R4:** `79af…` heißt **„Highborn Captain of the Black Arc"**, `bd43…` bleibt **„Noble"**. Der General-Slot `7a1e…` ist belegt (Ist 1). | [`01-raiding-army-general-on-highborn.ros`](rosters/01-raiding-army-general-on-highborn.ros) |
| 02 | General am Noble → nur der Noble wird benannt (Spiegelbild) | Gleiches Kontingent; General (`entryLinkId="030a…"`) **nur** am Noble. | **ETSG-R2 + ETSG-R4:** `bd43…` heißt **„Noble Captain of the Black Arc"**, `79af…` bleibt **„Highborn"**. | [`02-raiding-army-general-on-noble.ros`](rosters/02-raiding-army-general-on-noble.ros) |
| 03 | Kein General → kein Beiname | Gleiches Kontingent, **keine** General-Aufwertung. | **ETSG-R5 (untere Seite):** beide Charaktere behalten ihren Katalognamen. Zusätzlich gepinnt: die force-skopierte General-Pflicht `1077-7379-f142-f382` feuert mit Ist 0 / Grenze 1. | [`03-raiding-army-no-general.ros`](rosters/03-raiding-army-no-general.ros) |
| 04 | Richtiger General, falsches Kontingent → kein Beiname | Aufbau wie 01, aber Kontingent **„Standard (DE-AB)"** `26bc…`. | **ETSG-R6:** trotz `equalTo`-Treffer im `self`-Rahmen bleibt es bei **„Highborn"** und **„Noble"** — die `and`-Gruppe verlangt auch die Kontingent-Instanz. | [`04-standard-force-general-on-highborn.ros`](rosters/04-standard-force-general-on-highborn.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Namen treffen die Engine erst im
**Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **Löst die Auswertung `childId` verweis-genau oder über das Ziel auf?** Fällt
   sie auf das Ziel (`1b7c-2c90-6d96-28c9`) zurück *und* zählt sie in einem
   weiteren Rahmen als `self`, erhielte in Roster 01 auch der **Noble** den
   Beinamen — der sichtbarste denkbare Fehlschlag dieses Szenarios.
2. **Bleibt der `self`-Rahmen wirklich am Träger?** Ein Rückfall auf `force`
   oder `roster` ist genau das, was Roster 01/02 aufdecken sollen (in der oben
   benannten Grenze).
3. **Ist `equalTo` exakt?** Würde es wie `atLeast` gelesen, bliebe Roster 03
   unverändert korrekt — die untere Seite trennt `equalTo` von `atLeast` **nicht**.
   Die obere Seite ist auf diesen Daten nicht baubar (ETSG-R5); wer `equalTo`
   gegen `atLeast` scharf trennen will, braucht ein Konstrukt mit legal
   erreichbarem Zähler ≥ 2.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „The Raiding Army (DE-AB)" (Ziel der `instanceOf`-Prüfung) | `4b5b-aebb-1526-91bb` (DE-`.cat` Z. 10109) |
| Force „Standard (DE-AB)" (Gegenprobe Roster 04) | `26bc-729f-a188-f285` (Z. 10081) |
| Force „City Garrison (AN-02)" / „Cult of Slaanesh (SoC)" (Störquellen, still) | `77cd-dafb-16af-93c0` (Z. 10096) / `5013-f9f4-e03b-94d5` (Z. 10137) |
| Highborn (Träger 1, `append "Captain of the Black Arc"` Z. 377) | `79af-7092-a9a9-393d` (Z. 13) |
| Noble (Träger 2, byte-gleicher `append` Z. 1271) | `bd43-41c0-298e-22be` (Z. 948) |
| `entryLink` „General" unter dem Highborn (`childId` seiner `equalTo`-Bedingung) | `7a1e-c134-434e-3313` (Z. 364) |
| `entryLink` „General" unter dem Noble (`childId` seiner `equalTo`-Bedingung) | `030a-4b09-0210-225c` (Z. 1263) |
| Geteilte Aufwertung „General" (Ziel beider Verweise) | `1b7c-2c90-6d96-28c9` (`.gst` Z. 1191) |
| General: `max 1 scope="force"` / `max 1 scope="parent"` | `fc6d-21e4-3da5-17f9` (`.gst` Z. 1193) / `a830-88fc-15ba-9584` (Z. 1194) |
| Kategorie „General": `max 1 force` / `min 1 force` / `max 1 parent` | `d818-c60d-b1f8-8aaa` (`.gst` Z. 723) / `1077-7379-f142-f382` (Z. 724) / `54c9-b217-e67c-bd60` (Z. 725) |
| Hand Weapon Highborn (Pflicht min 1 / max 1) | `5dc5-1087-8483-1d9b` (Z. 70) — `ad31-faa2-6dd0-c8ff` / `c62a-9089-2b02-e959` (Z. 72/73) |
| Hand Weapon Noble (Pflicht min 1 / max 1) | `2378-4502-c0b0-c8b0` (Z. 954) — `5d7c-d550-cae0-f61c` / `9190-f95b-692c-bced` (Z. 956/957) |
| Kategorie „Lord" (verborgen unter 2000 pts; `max 1 parent`) | `d024-d25b-a9b4-73b6` (`.gst` Z. 220) — `fda5-91c2-e17f-774c` (Z. 363) |
| Kategorie „Heroes" (Noble, `max -1` = unbegrenzt) | `c16b-f319-2c62-2c12` (`.gst` Z. 366) — `7fca-63fb-63d2-9dad` (Z. 368) |
| Nicht behauptet, darf zusätzlich feuern: Core-Pflicht / „Character options" des Highborn / Sea Dragon Cloak | `35c2-d478-392a-aeb1` (`.gst` Z. 374) / `a8f3-c5ec-4979-8f97` (DE-`.cat` Z. 101) / `8601-3e39-2e5b-28b6` (Z. 289) |
| Punktkostenart „pts" | `ecfa-8486-4f6c-c249` |
| `catalogueLink` Dark Elves → Mercenaries | `4301-a1ec-729b-b898` → `fc47-8392-a6c8-452a` (Z. 10152) |
