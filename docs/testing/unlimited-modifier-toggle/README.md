# E2E-Regeln & Testkatalog: Unbegrenzt-Sentinel `-1` × `set`-Modifikator

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenarien (direktes `entryId`,
`entryLinkId=""` bzw. `entryLinkId=<Link>` für verlinkte Einträge).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Force **„Standard"** `2bfa-e64a-7123-895f`
- Söldner: `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `b066-2f8e-11ee-1dce` in O&G eingebunden; liefert die Outriders-Einheit)

> **Abgrenzung:** Das Schwester-Szenario
> [`../max-unlimited-violation/`](../max-unlimited-violation/README.md) pinnt
> bereits „Rohwert `-1` feuert nie, solange kein Modifikator greift" (21 Goblins,
> dieselbe Grenze `ad41…`). Dieses Szenario pinnt das **Zusammenspiel mit
> `set`-Modifikatoren** — in beide Richtungen — und dupliziert jenen Fall nicht.

## Worum es geht

In Battlescribe-Daten bedeutet der hingeschriebene Grenzwert **`-1`
„unbegrenzt"**. Das gilt an zwei Stellen:

1. **am Rohwert einer Constraint** (`constraint value="-1"`), und
2. **am Wert eines `set`-Modifikators** (`modifier type="set" value="-1"`),
   der eine konkrete Grenze unter einer Bedingung **aufhebt**.

Beide Richtungen kommen in den Fixtures wörtlich vor:

```
Fall A („Border Patrols"-Muster, O&G):
  Goblins (b403-…) └ Goblin (ec2d-…, model)
    constraint max value=-1 scope=parent   (ad41-8936-7a56-1717)   ← roh unbegrenzt
    modifier  set 25 auf ad41…             ← Bedingung: „Border Patrols rules"
                                             (4e15-…) mind. 1× im Roster

Fall B („Experimental rules"-Muster, Mercenaries):
  Amazon Cold One Outriders (9e4d-…, unit, via entryLink d859-… in O&G)
    constraint max value=0 scope=force     (264b-4c6a-defa-2b3e)   ← roh verboten
    modifier  set -1 auf 264b…             ← Bedingung: „Allow experimental
                                             rules?" (8b76-…) mind. 1× in der Force
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **UMT-R1** | Die Goblin-Modellzahl je Goblins-Einheit ist **roh unbegrenzt**: `max value="-1"` heißt „keine Obergrenze". Ohne erfüllte Modifikator-Bedingung darf die Grenze **nie** feuern, auch nicht bei 26 Modellen. | O&G-`.cat` → `selectionEntry "Goblin"` `ec2d-a00e-8ff8-1dff` (Kind von „Goblins" `b403-b7c6-0008-27d9`) → constraint **`ad41-8936-7a56-1717`** `type=max value=-1 field=selections scope=parent shared=true` (Kommentar `BP`). |
| **UMT-R2** | Liegt **„Border Patrols rules"** im Roster, zieht ein `set`-Modifikator dieselbe Grenze auf **25**: ab dem 26. Goblin-Modell feuert `ad41…` (Ist > 25). | Ebendort → `modifier type="set" value="25" field="ad41-8936-7a56-1717"` mit `condition type="atLeast" value="1" field="selections" scope="roster" childId="4e15-0353-165f-5528" includeChildSelections="true" includeChildForces="true"` (Kommentar `Border Patrols`). |
| **UMT-R3** | Die Einheit **„Amazon Cold One Outriders"** ist **roh verboten**: `max value="0"` je Force. Ohne erfüllte Modifikator-Bedingung feuert die Grenze bei jeder Instanz (Ist ≥ 1 > 0). | Mercenaries-`.cat` → `selectionEntry "Amazon Cold One Outriders"` `9e4d-c653-35ec-1d09` → constraint **`264b-4c6a-defa-2b3e`** `type=max value=0 field=selections scope=force shared=true includeChildSelections=false`. In O&G per `entryLink` `d859-2b00-5a01-35e6` wählbar. |
| **UMT-R4** | Liegt **„Allow experimental rules?"** in derselben Force, **hebt** ein `set`-Modifikator dieselbe Grenze **auf** (`value="-1"` = unbegrenzt): sie feuert dann **nie**, auch bei zwei Einheiten (Ist 2 über dem Rohwert 0). | Ebendort → `modifier type="set" value="-1" field="264b-4c6a-defa-2b3e"` mit `condition type="atLeast" value="1" field="selections" scope="force" childId="8b76-92c4-23f9-54b1" includeChildSelections="true"`. „Allow experimental rules?" ist der `.gst`-Eintrag `8b76-92c4-23f9-54b1`, in O&G per `entryLink` `22a7-2e88-eaf1-49a9` wählbar. |
| **UMT-R5** | **Nicht Teil der Zähl-Assertion:** (a) Die Outriders sind per Basis `hidden="true"` und werden nur unter Bedingung sichtbar (`set hidden=false`, childId `7d87-…`) — Verfügbarkeit, keine zählende Schranke. (b) Ohne „Allow experimental rules?" hängt am Outriders-Eintrag zusätzlich eine **Autor-Meldung** (`add error` „Please enable …") — eigene Herkunft (`authorMessage`), nicht die abgeleitete Grenze. (c) „Border Patrols rules" (`4e15…`) ist selbst `hidden="true"` mit eigener `max 1 scope=parent`-Grenze (`fbfc-…`), die mit `number=1` eingehalten ist. | Mercenaries-`.cat` `9e4d…` → `modifier set hidden=false` (childId `7d87-7436-5341-bbc0`) und `modifier add … field="error"` (`lessThan 1 childId=8b76…`); `.gst` → `selectionEntry` `4e15-0353-165f-5528` mit constraint `fbfc-d43f-396d-09cc`. |

**Hinweis zu Nebengeräuschen (Assertion bleibt selektiv):** Andere
Armeeaufbau-Diagnosen können zusätzlich auftreten und sind hier ohne Belang —
insbesondere die General-/Core-Pflichten des `.gst` (die Goblins-Einheit ist
die einzige Core-Auswahl; die Core-Untergrenze `35c2-…` fällt mit Border
Patrols von 2 auf 1) sowie die bedingte Untergrenze `d67f-…` an „Allow
experimental rules?" (wird `min 1`, sobald eine Auswahl der Kategorie
„Experimental rules" in der Force liegt — in Roster 05 durch die vorhandene
Auswahl erfüllt). Behauptet werden ausschließlich die zwei genannten
Grenzen-IDs.

**Hinweis zu den Pflicht-Kindern der Outriders:** Damit die Roster außer der
gepinnten Grenze nichts Unnötiges reißen, tragen beide Outriders-Einheiten ihre
datenseitigen Pflicht-Kinder: 5 Noblewomen (`min 5` `4b82-…`), Cold One
(`min 1` `5d7d-…`), Spear (Mounted)/Shield/Hand Weapon (je `min 1`
`959c-…`/`c706-…`/`16df-…`).

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + O&G-`.cat` + die per `catalogueLink` benötigte
Mercenaries-`.cat`.

> **Assertion-Fokus:** nur die Grenzen `ad41-8936-7a56-1717` (Fall A) und
> `264b-4c6a-defa-2b3e` (Fall B). `firing` nennt Ist/Grenze; `absent` fordert
> Nicht-Feuern.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Rohwert `-1` bleibt unbegrenzt (ohne Bedingung) | Goblins mit **26** Goblin-Modellen, **ohne** Border Patrols. | **Keine** Verletzung von `ad41…`: die Bedingung des `set 25` hält nicht, der Rohwert `-1` heißt unbegrenzt — 26 > 25 ist irrelevant (UMT-R1). | [`01-goblins-26-no-bp-unlimited.ros`](rosters/01-goblins-26-no-bp-unlimited.ros) |
| 02 | `set 25` deckelt den Rohwert `-1` | Dieselben 26 Goblin-Modelle, **plus** „Border Patrols rules". | **Verletzung von UMT-R2:** `ad41…` feuert mit **Ist 26 / Grenze 25** — die per Modifikator gesetzte Grenze ersetzt den Sentinel. | [`02-goblins-26-bp-capped-illegal.ros`](rosters/02-goblins-26-bp-capped-illegal.ros) |
| 03 | Gesetzte Grenze exakt eingehalten | **25** Goblin-Modelle, plus „Border Patrols rules". | **Keine** Verletzung: Ist 25 ≤ 25 (Randfall der gesetzten Grenze). | [`03-goblins-25-bp-legal.ros`](rosters/03-goblins-25-bp-legal.ros) |
| 04 | Rohwert `0` feuert (ohne Bedingung) | **Eine** Outriders-Einheit (voll besetzt), **ohne** „Allow experimental rules?". | **Verletzung von UMT-R3:** `264b…` feuert mit **Ist 1 / Grenze 0**. (Die zusätzliche Autor-Meldung „Please enable …" ist eigene Herkunft und hier nicht behauptet, UMT-R5.) | [`04-outriders-no-experimental-illegal.ros`](rosters/04-outriders-no-experimental-illegal.ros) |
| 05 | `set -1` hebt den Rohwert `0` auf | **Zwei** Outriders-Einheiten, **plus** „Allow experimental rules?" in derselben Force. | **Keine** Verletzung von `264b…`: die Bedingung hält, `set -1` heißt unbegrenzt — Ist 2 über dem Rohwert 0 ist irrelevant (UMT-R4). Zwei Einheiten belegen: **aufgehoben, nicht bloß angehoben.** | [`05-outriders-two-units-experimental-legal.ros`](rosters/05-outriders-two-units-experimental-legal.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard" (O&G) | `2bfa-e64a-7123-895f` |
| Goblins (Core-Einheit, O&G) | `b403-b7c6-0008-27d9` |
| Goblin (Modell; Träger von Fall A) | `ec2d-a00e-8ff8-1dff` — constraint **`ad41-8936-7a56-1717`** (`max -1 scope=parent`), Modifier `set 25` |
| Goblin-Mindestzahl (in 01–03 erfüllt) | `7156-0a0f-aa05-582a` (`min 20 scope=parent`) |
| „Border Patrols rules" (`.gst`-Wurzel-Eintrag, Bedingungs-Schalter Fall A) | `4e15-0353-165f-5528` — eigene constraint `fbfc-d43f-396d-09cc` (`max 1 scope=parent`) |
| Amazon Cold One Outriders (Mercenaries; Träger von Fall B) | `9e4d-c653-35ec-1d09` — constraint **`264b-4c6a-defa-2b3e`** (`max 0 scope=force`), Modifier `set -1` |
| entryLink Outriders in O&G | `d859-2b00-5a01-35e6` |
| „Allow experimental rules?" (`.gst`-Eintrag, Bedingungs-Schalter Fall B) | `8b76-92c4-23f9-54b1` — constraints `b302-93b6-3d1d-13d6` (`max 1 scope=force`), `d67f-4b65-a832-1e1b` (`min 0→1` bedingt) |
| entryLink „Allow experimental rules?" in O&G | `22a7-2e88-eaf1-49a9` |
| Noblewoman (Modell, `min 5`) | `c113-0228-0463-892d` — constraint `4b82-c697-cc92-f2db` |
| Cold One (Mount, `min 1`) | Ziel `4795-db29-0fe7-1834`, Link `6239-a5c6-0208-8671`, Gruppe `6c42-29dc-3684-d728` |
| Spear (Mounted) / Shield / Hand Weapon (je `min 1`/`max 1`) | Ziele `027b-31d2-b3e2-23a4` / `50e2-1873-a856-03e7` / `abdb-bbd0-41b2-5dff`, Links `d1ff-dfad-fe3b-6638` / `6955-7253-8cb2-5395` / `b3c4-cbf0-bdc2-173d`, Gruppe `fa29-fc5c-cbd4-f538` |
| catalogueLink O&G → Mercenaries | `b066-2f8e-11ee-1dce` (Ziel `fc47-8392-a6c8-452a`) |
