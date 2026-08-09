# E2E-Regeln & Testkatalog: `atLeast`-Bedingung (scope=force, childId=Eintrag) als Freischalt-Tor (Ogre Kingdoms)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044`
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` aus der OK-`.cat` eingebunden)

## Der gepinnte Mechanismus

Die **Bedingungszelle** `condition | atLeast | force | selectionCount | child=id`:
eine `condition type="atLeast"` mit `scope="force"` und einer `childId`, die
einen **Eintrag** benennt, zählt die Selektionen des umschließenden Kontingents,
die sich auf diese Id auflösen — über die **Link-Id oder deren aufgelöstes
Ziel** ([§7.7/§9.7 der Formatdoku](../../battlescribe-data-format.md): der
`childId` einer `condition` kann die Ziel-ID *oder* die lokale Link-ID sein,
beide Fälle sind abzugleichen) — und hält, sobald die Zahl den `value` der
Bedingung erreicht. Ein damit gegateter Modifier wirkt **genau dann**. Träger
ist hier der Sondercharakter **Greasus Goldtooth**:

```
selectionEntry "Greasus Goldtooth, Overtyrant of the Ogre Kingdoms"
               (47f3-befb-e32e-0b4a, type=unit, Wurzel-Eintrag der OK-.cat)
  ├ constraint max 0 selections scope=force shared   cef8-c3b1-7850-85bc   ← Basiswert
  └ modifier set 1 field=cef8-c3b1-7850-85bc
       └ condition atLeast value=1 field=selections scope=force
            childId=9e50-7486-65ab-c449 includeChildSelections=true

entryLink "Allow special characters?" (9e50-7486-65ab-c449, Wurzel-entryLink der OK-.cat)
  └ targetId=8923-5946-7b10-8957  →  selectionEntry "Allow special characters?"
       (.gst, type=upgrade) mit constraint max 1 selections scope=roster
       (5036-e10c-2fd8-f135) und zwei min-0-No-ops
```

Die Bedingung hängt allein daran, ob das Kontingent mindestens eine
„Allow special characters?"-Selektion enthält — zwei Roster, die sich **nur in
dieser Toggle-Selektion** unterscheiden, isolieren den Mechanismus vollständig.
Dass die Bedingung die **Link-Id** `9e50-…` nennt, die Selektion im Roster aber
(wie in der verifizierten Beispiel-Datei) das **Ziel** `8923-…` als `entryId`
trägt, macht die Link/Ziel-Auflösung zum Teil des Pins.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ALFG-R1** | Greasus' geschriebene Grenze ist **max 0** Selektionen je Kontingent — ohne Freischaltung ist er nirgends legal wählbar. | `Ogre Kingdoms (6th definitive edition).cat`, `selectionEntry` `47f3-befb-e32e-0b4a` → constraint **`cef8-c3b1-7850-85bc`** (`type=max value=0 field=selections scope=force shared=true includeChildSelections=false`). |
| **ALFG-R2** | Enthält das Kontingent **mindestens eine** „Allow special characters?"-Selektion, wird Greasus' Maximum **exakt auf 1 gesetzt**. | Ebd. → `modifier type="set" value="1" field="cef8-c3b1-7850-85bc"` mit `condition type="atLeast" value="1" field="selections" scope="force" childId="9e50-7486-65ab-c449" shared="true" includeChildSelections="true"`. |
| **ALFG-R3** | Die Bedingung zählt Selektionen, die sich **über den Link oder sein Ziel** auf die `childId` auflösen: `childId` ist die Wurzel-**Link**-Id `9e50-…`, die Roster-Selektion trägt das **Ziel** `8923-…` als `entryId` — sie zählt trotzdem. | `entryLink` `9e50-7486-65ab-c449` „Allow special characters?" → `targetId="8923-5946-7b10-8957"` (OK-`.cat`); [Formatdoku §9.7](../../battlescribe-data-format.md): *„Der `childId` von `repeat`/`condition` kann die Ziel-ID … oder die lokale Link-ID sein — beim Zählen beide Fälle abgleichen."* Roster-Form an der verifizierten Fixture `author-message-severity/rosters/02-skrag-error-silent.ros` abgeglichen. |
| **ALFG-R4** | **Eine** Toggle-Selektion ist selbst legal: das Ziel trägt **max 1** (scope=roster) und zwei **min 0**-No-ops. | `.gst`, `selectionEntry` `8923-5946-7b10-8957` → constraints **`5036-e10c-2fd8-f135`** (`type=max value=1 scope=roster`), `3d91-4deb-faa0-9996`/`77da-4055-647c-6978` (`type=min value=0`). |
| **ALFG-R5** | Im Kontingent **„Standard (OK-AB)"** ohne „Border Patrols rules" ist Greasus **nicht verborgen** — seine beiden `hidden`-Modifikatoren bleiben inert. | Ebd. (`.cat`): `modifier set hidden=true` bei `instanceOf` forceEntry **„Ironskin Tribe (WD#309-UK)"** `8711-ed16-2a44-7251` bzw. bei `atLeast 1` von **„Border Patrols rules"** `4e15-0353-165f-5528` (scope=roster). Beide Roster nutzen forceEntry `729f-9246-5cd3-5044` und enthalten keinen Border-Patrols-Eintrag. |

**Ableitung des Erwartungsbilds:** Ohne Toggle ist die Zählung der Bedingung 0
< 1 → der `set 1` wirkt nicht, der Constraint behält den Basiswert **0**; ein
gewählter Greasus (Ist 1) verletzt die Grenze (`actual 1`, `bound 0`), der Slot
meldet `effectiveMax=0`. Mit Toggle ist die Zählung 1 ≥ 1 → der Constraint-Wert
ist **1**; derselbe Greasus (Ist 1) verletzt nichts, der Slot meldet
`effectiveMax=1` (Spielraum 0). Kein weiterer Modifier im Katalog adressiert
`cef8-c3b1-7850-85bc`.

**Bewusst nicht Gegenstand dieses Szenarios** (in beiden Rostern identisch
vorhanden bzw. absichtlich nicht assertiert):

- **Autor-Meldung:** Greasus trägt zusätzlich `modifier add field="error"`
  („Please enable \"Allow special characters?\"", Bedingung `lessThan 1` auf das
  **Ziel** `8923-…`). Diese Meldung pinnt bereits das Szenario
  [`author-message-severity`](../author-message-severity/README.md) (Roster 03);
  hier wird sie nicht assertiert.
- **Ironguts-Folgepflicht:** Der Wurzel-entryLink „Ironguts"
  (`53f2-756c-f086-9da6`) setzt per `set 2` auf die min-0-Grenze
  `3492-eac7-6894-1241` (Mercenaries-`.cat`) eine **min-2-Pflicht**, sobald
  Greasus in der Force ist („At least two units of Ironguts…"). Sie kann in
  **beiden** Rostern zusätzlich feuern (beide enthalten Greasus) und ist hier
  ohne Belang — derselbe Bedingungstyp, aber nicht der Gegenstand des Pins.
- **Greasus' Pflicht-Kinder:** BSB-Link `a517-…` (min 1, `df47-fb82-9e8b-219a`),
  General-Link `8963-…` (min 1, `0d95-3790-905b-fb1f`), Sceptre of the Titans
  `da06-…` (min 1, `ceef-f663-be6a-a648`) und Overtyrant's Crown `6ee9-…`
  (min 1, `d789-807c-b40f-e818`) bleiben in beiden Rostern bewusst unbesetzt
  (Minimalität, wie die verifizierte Fixture `author-message-severity/03`);
  ihre Min-Meldungen treten in beiden Rostern **gleich** auf und werden nicht
  assertiert.
- **Kategorie-Sichtbarkeit:** Die Kategorie „Special Characters" (`0644-…`,
  `.gst`) wird per `lessThan 1` auf `8923-…` verborgen — dieselbe
  Toggle-Mechanik als `hidden`-Gate; sie gehört zur Zelle
  `set hidden` (Szenarien `set-hidden-force-gate`/`offer-and-category-slots`)
  und wird hier nicht assertiert.
- **`headroom` in Roster 01:** Bei Ist 1 über Maximum 0 wäre der Spielraum
  rechnerisch negativ; wie der Bericht das darstellt, ist aus den Katalogdaten
  nicht ableitbar — `headroom` wird dort bewusst nicht assertiert (in Roster 02
  ist er eindeutig 1 − 1 = 0).
- **Punkte/Armeepflichten:** Punktelimit, General-/Core-Pflichten des
  Kontingents können zusätzlich melden und sind ohne Belang.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster
sind **bis auf die Toggle-Selektion identisch**: Kontingent „Standard (OK-AB)"
mit genau einem Greasus Goldtooth.

> **Assertion-Fokus:** die Grenze `cef8-c3b1-7850-85bc` (feuert/feuert nicht)
> und das effektive Maximum des Greasus-Slots (`expect.capabilities`, Feld
> `effectiveMax`: 0 ohne, 1 mit Toggle). Andere Diagnosen (Ironguts-min-2,
> Pflicht-Kinder, Autor-error, Punktelimit) können zusätzlich auftreten und
> sind hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Ohne Toggle: Bedingung hält nicht → max 0 feuert | `.gst` + OK-`.cat` (+ Mercenaries) | Force „Standard (OK-AB)" (`729f-…`), 1× Greasus, **keine** „Allow special characters?"-Selektion. | **ALFG-R1:** Die Zählung der `atLeast`-Bedingung ist 0 — der `set 1` wirkt nicht. Greasus' Grenze `cef8-…` feuert (**Ist 1, Grenze 0**); der Slot (occupied, Rahmen = forceEntry `729f-…`) meldet `effectiveMax=0`, `effectiveMin=null`. Die Toggle-Obergrenze `5036-…` feuert nicht. | [`01-greasus-without-toggle-max0.ros`](rosters/01-greasus-without-toggle-max0.ros) |
| 02 | Mit Toggle: Bedingung hält → max 1, keine Verletzung | wie 01 | **Identischer** Aufbau, zusätzlich 1× „Allow special characters?" (`entryId` = Ziel `8923-…`). | **ALFG-R2/R3:** Die Zählung ist 1 ≥ 1 — der `set 1` wirkt. Derselbe Slot meldet `effectiveMax=1` (Spielraum 0, ausgeschöpft), **keine** Verletzung von `cef8-…`; die Toggle-Obergrenze `5036-…` (max 1) ist mit einer Selektion erfüllt und feuert ebenfalls nicht. | [`02-greasus-with-toggle-max1.ros`](rosters/02-greasus-with-toggle-max1.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
`bound` ist in Test 01 der Constraint-Basiswert **0** (ALFG-R1), das
`effectiveMax` in Test 02 der Modifier-Wert **1** (ALFG-R2). `actual`/`current`
= 1 folgt aus genau einer Greasus-Selektion (`number="1"`) im Kontingent
(`scope=force`, `includeChildSelections="false"` — gezählt werden die
Force-direkten Greasus-Selektionen). `headroom` in Test 02 ist 1 − 1 = 0,
`isBlocked=true` (Maximum ausgeschöpft — in Test 01 mit 1 > 0 erst recht).
`effectiveMin=null`/`isMandatoryUnmet=false`, denn Greasus trägt **keine**
min-Grenze.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` |
| Force „Ironskin Tribe (WD#309-UK)" (würde Greasus verbergen — gemieden) | `8711-ed16-2a44-7251` |
| Greasus Goldtooth (Wurzel-`selectionEntry`, type=unit) | `47f3-befb-e32e-0b4a` |
| — max 0 (scope=force, Ziel des `set 1`) | constraint `cef8-c3b1-7850-85bc` |
| entryLink „Allow special characters?" (Wurzel-Link, `childId` der Bedingung) | `9e50-7486-65ab-c449` |
| Ziel „Allow special characters?" (`.gst`, type=upgrade, `entryId` im Roster) | `8923-5946-7b10-8957` |
| — max 1 (scope=roster, mit einer Selektion erfüllt) | constraint `5036-e10c-2fd8-f135` |
| — min-0-No-ops | constraints `3d91-4deb-faa0-9996` / `77da-4055-647c-6978` |
| „Border Patrols rules" (im Roster bewusst NICHT enthalten) | `4e15-0353-165f-5528` |
| Ironguts-Link (Greasus-gegatete min-2-Folgepflicht, nicht assertiert) | `53f2-756c-f086-9da6` — constraint `3492-eac7-6894-1241` (Mercenaries) |
| Greasus' Pflicht-Kinder (unbesetzt, nicht assertiert) | BSB `a517-a71a-1188-00a8` (`df47-fb82-9e8b-219a`), General `8963-97c6-d60d-dfc4` (`0d95-3790-905b-fb1f`), Sceptre `da06-d127-7f17-3773` (`ceef-f663-be6a-a648`), Crown `6ee9-0840-771f-1e16` (`d789-807c-b40f-e818`) |
| Kategorie „Special Characters" (Toggle-`hidden`-Gate, nicht assertiert) | `0644-bfcd-32c2-21dc` |
| Katalog-Link auf Mercenaries | `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` |
