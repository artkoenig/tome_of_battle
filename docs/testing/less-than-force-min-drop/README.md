# E2E-Regeln & Testkatalog: `lessThan`-Force-Gate senkt eine Pflicht auf 0 (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenarien (direktes `entryId`,
`entryLinkId=""`, verlinkte Auswahl als `entryId=<targetId>` +
`entryLinkId=<linkId>`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard (VC-AB)"** `e989-15b8-7eb6-9668`
  (+ `Mercenaries (6th definitive edition).cat` via `catalogueLink`
  `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a`)

**Gepinnte Condition-Zelle:** `condition|lessThan|force|selectionCount|child=id` —
eine `condition type="lessThan" value="1" field="selections" scope="force"
childId="<Eintrags-Id>" includeChildSelections="true"` haelt genau dann, wenn die
Force **strikt weniger als 1** Selektion dieses Eintrags zaehlt (verschachtelte
Selektionen eingeschlossen), und der gated `set`-Modifier greift genau dann
(`docs/battlescribe-data-format.md` §7.7).

## Wo die Grenze im Katalog haengt (verifizierte Position)

Der **einzige** Traeger der Power ist die Special-Character-Einheit
**„Neferata, the Queen of Mysteries"** (`bf10-ef49-c0e1-492b`, Wurzel-Eintrag
des VC-Katalogs, Basis `hidden="false"`, Primaerkategorie „Special Characters"
`0644-bfcd-32c2-21dc` — in der Standard-Force per `categoryLink`
`bc57-c34a-0f49-84eb` angeboten). Struktur:

```
selectionEntry "Neferata, the Queen of Mysteries" (bf10-…)     ← Force-Selection
  └ selectionEntryGroup "Bloodline Powers" (959d-47af-2ebc-5f40, hidden="false")
       └ entryLink "Seduction, Domination, Transfix and Beguile."
         (ee9f-42bf-a6b8-7fe7, hidden="false",
          eigene Link-Pflicht min 1: 330a-d0d9-2177-a87f)
            → sharedSelectionEntry adfd-d46e-23ff-3d61 (hidden="false")
                 constraint max 1 scope=parent  fcd6-9468-122a-173b
                 constraint min 1 scope=parent  10a1-ac7b-4b9c-0e12   ← das Gated
                 modifier set 0 → field=10a1-…
                   condition lessThan 1 selections scope=force
                             childId=4f07-e982-6665-70b7 (Lahmia)
                             shared=true includeChildSelections=true
```

Neferata traegt selbst nur `hidden`-Modifier fuer die Sonderheer-Forces
(`5e95…`, `91ad…`, `4072…`, `3c87…`, `b1e4…`, `d3af…`, `f37a…`, `bf46…`) und die
Border-Patrols-Regel (`4e15-0353-165f-5528`) — die Standard-Force `e989…` ist
**nicht** darunter, im Szenario bleibt sie also sichtbar und ihre Min-Grenzen
werden validiert (Sichtbarkeitsregel aus §5.6/§8, Issue 0088). Das geteilte Ziel
`adfd…` und der Link `ee9f…` sind ohnehin per Basis sichtbar und tragen keine
`hidden`-Modifier.

Die Lahmia-Blutlinie `4f07-e982-6665-70b7` wird — wie im Szenario
[`vampire-bloodlines`](../vampire-bloodlines/README.md) verifiziert — als
inline-Kind der Gruppe „Vampiric Bloodline" (`5655-13ba-8980-bd1c`) unter der
Force-Selection „Bloodlines" (`a56a-eb32-5a45-16fd`) direkt ueber ihre eigene
`entryId` gewaehlt; dank `includeChildSelections="true"` zaehlt die
force-skopierte Bedingung sie auch verschachtelt.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LTF-R1** | Die Power „Seduction, Domination, Transfix and Beguile." ist unter ihrem Traeger per Basis **Pflicht**: min 1 im Eltern-Rahmen. | VC-`.cat`, shared `selectionEntry` `adfd-d46e-23ff-3d61` → constraint **`10a1-ac7b-4b9c-0e12`** `type=min value=1 field=selections scope=parent shared=true`. |
| **LTF-R2** | **Das Gate:** Zaehlt die Force **strikt weniger als 1** „Bloodline of Clan Lahmia", setzt ein Modifier diese Pflicht auf **0** — das effektive Minimum faellt, die Grenze darf nicht feuern. Zaehlt die Force ≥ 1 Lahmia, haelt die `lessThan`-Bedingung **nicht** (1 ist nicht < 1), der Modifier bleibt aus, die Basis-Pflicht 1 steht. | ebd., `modifier type="set" value="0" field="10a1-ac7b-4b9c-0e12"` mit `condition type="lessThan" value="1" field="selections" scope="force" childId="4f07-e982-6665-70b7" shared="true" includeChildSelections="true"` (der **einzige** Modifier des Eintrags). |
| **LTF-R3** | **Kontroll-Grenze:** Der Verweis auf die Power traegt eine **eigene, unbedingte** Pflicht min 1. Sie feuert in beiden Zwillingen identisch, solange die Power fehlt — sie beweist, dass der Slot instanziiert und validiert wird, und isoliert LTF-R2 als einzige kippende Ursache. | ebd., `entryLink` `ee9f-42bf-a6b8-7fe7` (in Gruppe „Bloodline Powers" `959d-47af-2ebc-5f40`) → constraint **`330a-d0d9-2177-a87f`** `type=min value=1 field=selections scope=parent shared=true` — **ohne** Modifier. |
| **LTF-R4** | Die Power ist hoechstens **einmal** waehlbar; eine einzelne Selektion ist legal. | shared `selectionEntry` `adfd…` → constraint **`fcd6-9468-122a-173b`** `type=max value=1 field=selections scope=parent`. |

**Hinweis zur bewusst NICHT genutzten `capabilities`-Erwartung (`effectiveMin`):**
Ein Pinnen ueber das effektive Mindestmass des Slots (`effectiveMin` 0 ohne /
1 mit Lahmia) waere hier **nicht single-cause**: derselbe Slot traegt neben der
gated Ziel-Pflicht `10a1…` die **unbedingte** Link-Pflicht `330a…` (min 1,
LTF-R3). Welche der beiden das ausgewiesene Slot-Minimum stellt, wenn eine auf 0
faellt, ist eine Aggregationsfrage der Engine, keine Aussage der Katalogdaten —
die Daten sagen nur, welche **einzelne Grenze** feuert. Gepinnt wird deshalb
ueber `firing`/`absent` je Constraint-Id: dort ist die Zuordnung eindeutig
(`limitId`), und die Kontroll-Grenze `330a…` macht den Zwilling beweiskraeftig.

**Hinweis zum Rauschen (nicht Teil der Erwartung):** Neferata traegt weitere
unbedingte Pflicht-Links (General `f2d0…`, Magic Level 3 `2564…`, die uebrigen
Bloodline Powers `6eed…`/`f588…`/`20d4…`/`afa5…`/`0f16…`/`5f5d…`, die Magic
Items `ca2e…`/`ce55…`/`e8ad…`), die in allen drei Rostern **identisch**
unerfuellt bzw. in 03 identisch unerfuellt bleiben; dazu koennen
Armeeaufbau-Diagnosen (General-Pflicht der `.gst`-Kategorie, Core-Slots)
auftreten. Alles davon ist in den Zwillingen deckungsgleich und wird nicht
asserted (selektive Erwartung des Runners). Die versteckte Gruppe „Lores of
Magic" (`6aa1-e04a-70b0-c156`, `hidden="true"`) unterliegt dem
Sichtbarkeits-Validierungsverbot (Issue 0088) und bleibt ebenfalls aussen vor.
Die Autor-Fehlermeldung „Please enable ‚Allow special characters?'"
(`modifier type="add" field="error"` an Neferata, Bedingung `lessThan 1` auf
`8923-5946-7b10-8957` in der Force) wird vermieden, indem jedes Roster die
Toggle-Selektion „Allow special characters?" (`8923…`, `.gst`; in VC per
Wurzel-`entryLink` `6411-4be3-864f-a963` angeboten, max 1 je Roster
`5036-e10c-2fd8-f135`) genau einmal fuehrt.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Vampire-Counts-`.cat` (+ die per `catalogueLink`
benoetigte `Mercenaries`-`.cat`). Die Zwillinge 01/02 unterscheiden sich
**ausschliesslich** in der gewaehlten Clan-Bloodline (Lahmia vs. Necrarch
`5017-296d-edef-4562`) — single cause.

> **Assertion-Fokus:** nur die drei Grenzen der Power (`10a1…`, `330a…`,
> `fcd6…`). Andere Diagnosen (uebrige Neferata-Pflichten, General/Core,
> Punktelimit) koennen zusaetzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Lahmia da, Power fehlt (unzulaessig) | „Bloodlines" mit **Lahmia** + Neferata **ohne** die Power + Toggle. | Die `lessThan`-Bedingung haelt nicht (Ist 1) → Basis-Pflicht steht: **`10a1…` feuert** (Ist 0 / Grenze 1). Kontrolle: **`330a…` feuert** ebenfalls (Ist 0 / Grenze 1). `fcd6…` still. | [`01-lahmia-power-missing.ros`](rosters/01-lahmia-power-missing.ros) |
| 02 | Keine Lahmia, Pflicht faellt auf 0 | **Identisch zu 01**, nur **Necrarch** statt Lahmia. | Die `lessThan`-Bedingung haelt (Ist 0 < 1) → `set 0` greift: **`10a1…` darf NICHT feuern**. Kontrolle: **`330a…` feuert unveraendert** (Ist 0 / Grenze 1) — der Slot wird validiert, nur das Gate kippt. `fcd6…` still. | [`02-no-lahmia-power-missing.ros`](rosters/02-no-lahmia-power-missing.ros) |
| 03 | Lahmia da, Power gewaehlt (legal) | Wie 01, zusaetzlich die Power gewaehlt (`entryId adfd…`, `entryLinkId ee9f…`). | Ist 1 erfuellt die stehende Pflicht `10a1…` und die Link-Pflicht `330a…`, `fcd6…` (max 1) eingehalten: **keine** der drei Grenzen feuert. | [`03-lahmia-power-selected.ros`](rosters/03-lahmia-power-selected.ros) |

**Herleitung von Ist/Grenze (aus Daten + Rosterbau, nicht aus einem Testlauf):**
`bound` ist je der Katalogwert (`value="1"` beider Pflichten). `actual` ist die
Zaehlung des `field=selections` im `scope=parent`-Rahmen des Traegers: in 01/02
steht **keine** `adfd…`-Selektion unter Neferata → Ist 0; in 03 genau eine →
Ist 1. Fuer das Gate zaehlt die Force `4f07…`-Selektionen inkl. Verschachtelung:
01/03 → 1 (Bedingung haelt nicht), 02 → 0 (Bedingung haelt).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" (VC-`.cat`) | `e989-15b8-7eb6-9668` |
| Neferata, the Queen of Mysteries (Wurzel-Eintrag, type=upgrade) | `bf10-ef49-c0e1-492b` |
| Gruppe „Bloodline Powers" (hidden=false) | `959d-47af-2ebc-5f40` |
| entryLink „Seduction, Domination, Transfix and Beguile." | `ee9f-42bf-a6b8-7fe7` — constraint `330a-d0d9-2177-a87f` (min 1, unbedingt) |
| shared „Seduction, Domination, Transfix and Beguile." | `adfd-d46e-23ff-3d61` — constraints `10a1-ac7b-4b9c-0e12` (min 1, gated) / `fcd6-9468-122a-173b` (max 1) |
| Bloodline of Clan Lahmia (childId des Gates) | `4f07-e982-6665-70b7` |
| Bloodline of Clan Necrarch (neutraler Zwillings-Ersatz) | `5017-296d-edef-4562` |
| „Bloodlines" (Force-Selection) / Gruppe „Vampiric Bloodline" | `a56a-eb32-5a45-16fd` / `5655-13ba-8980-bd1c` |
| „Allow special characters?" (`.gst`; VC-Wurzel-Link `6411-4be3-864f-a963`) | `8923-5946-7b10-8957` — max 1 roster `5036-e10c-2fd8-f135` |
| Kategorien Special Characters / Special list rules / Lord / Characters | `0644-bfcd-32c2-21dc` / `32f1-197f-d719-a393` / `d024-d25b-a9b4-73b6` / `7a1c-d611-c2dc-def1` |
| catalogueLink VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
