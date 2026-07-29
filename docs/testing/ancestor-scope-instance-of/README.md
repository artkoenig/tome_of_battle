# E2E-Regeln & Testkatalog: `scope="ancestor"` — `instanceOf` gegen die Vorfahrenkette

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs
und Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* **abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Kataloge: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`) mit dem
  Kontingent **„Standard (VC-AB)"** `e989-15b8-7eb6-9668` und allen benutzten Eintraegen,
  dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink` eingebundene
  Abhaengigkeit des VC-Katalogs).

## Regel (In-World)

Eine `instanceOf`-Condition mit `scope="ancestor" childId="<Kategorie-Id>"` haelt genau
dann, wenn **irgendein Vorfahre** der tragenden Auswahl auf das Ziel aufloest — nicht nur
der direkte Elternteil. In den realen Daten sind alle solchen Ziele **Kategorie-Ids**.
Zwei Auspraegungen aus dem Vampire-Counts-Katalog:

1. **Tiranoc Chariot [HIGH ELVES]** ist als eigenstaendiges Gespann 1–2 Wagen stark
   (min 1 / max 2). **Als Reittier eines Charakters** („As characters mount", so der
   Autoren-Kommentar) gilt: hoechstens 1 Wagen, keine Pflicht.
2. **Steed of Slaanesh [DARK ELVES]** ist grundsaetzlich verboten (max 0) und waere nur
   fuer einen Traeger erlaubt, dessen Vorfahre zur Kategorie „Slaanesh [DARK ELVES]"
   gehoert — diese Kategorie wird im Datensatz **nirgends vergeben**, die Bedingung kann
   also nie halten.

## Beleg (Katalog-Daten)

### ASI-R1/R2: Tiranoc Chariot — Grenzsenkung, wenn ein Vorfahre „Characters" ist

Aus `Vampire Counts (6th definitive edition).cat`, geteilter Eintrag
`selectionEntry type="model"` „Tiranoc Chariot [HIGH ELVES]" (`9ee68772-6b2d-42a2-b24a-0dce060be729`):

```xml
<constraints>
  <constraint type="max" value="2" field="selections" scope="parent" shared="true"
              id="b79661e2-c983-45b3-a6dc-f8544ac9ce9e" .../>
  <constraint type="min" value="1" field="selections" scope="parent" shared="true"
              id="042be4cb-667d-467d-8ada-c89436f2f248" .../>
</constraints>
...
<modifierGroups>
  <modifierGroup type="and">
    <comment>As characters mount</comment>
    <modifiers>
      <modifier type="set" value="1" field="b79661e2-c983-45b3-a6dc-f8544ac9ce9e"/>
      <modifier type="set" value="0" field="042be4cb-667d-467d-8ada-c89436f2f248"/>
    </modifiers>
    <conditions>
      <condition type="instanceOf" value="1" field="selections" scope="ancestor"
                 childId="7a1c-d611-c2dc-def1" shared="true"/>
    </conditions>
  </modifierGroup>
</modifierGroups>
```

`childId="7a1c-d611-c2dc-def1"` ist die Kategorie **„Characters"** aus der `.gst`
(`<categoryEntry id="7a1c-d611-c2dc-def1" name="Characters">`).

Die Vorfahrenkette im Roster 01: Chariot → **Commander [HIGH ELVES]**
(`d8e205ee-ee8d-4c18-afc8-cce2dde3f4ff`, traegt **keinen** Characters-Link) → **Swain**
(`b920-b398-dc26-7f4d`, traegt `categoryLink` `bfa2-7b7b-011a-04d3` →
`7a1c-d611-c2dc-def1` Characters) → Kontingent. Die Bedingung haelt also erst ueber den
**Grossvater** — das pinnt die transitive Vorfahren-Suche, nicht nur den Elternblick.
Der Chariot steht unter dem Commander ueber den `entryLink`
`1e5f8bfa-1bd4-41b5-81e4-c727e5c40ee5` (Gruppe „Mounts").

Mit **2 Wagen** unter dem Commander: effektives max = `set 1` → `b79661e2-…` feuert mit
**Ist 2 / Grenze 1** (die Grenze zaehlt `selections` im Eltern-Rahmen, beide
Chariot-Auswahlen zusammen). Die Pflicht `042be4cb-…` ist per `set 0` aufgehoben und
bleibt still. Eine Engine **ohne** ancestor-Aufloesung liesse max auf 2 stehen
(2 ≤ 2 → kein Verstoss) — Roster 01 wuerde rot.

### ASI-R3: Steed of Slaanesh — Basisgrenze 0 bleibt, wenn kein Vorfahre passt

Aus demselben Katalog, „Noble [DARK ELVES]" (`a16d445b-ea00-48d6-a02a-376711f5c51c`)
→ Gruppe „Mounts" (`54c8dce9-2f75-4ae8-a52c-8d51fea876a9`) → `entryLink`
„Steed of Slaanesh [DARK ELVES]" (`d86ebdbb-c14f-45d6-80d3-b7466a1f3db0`, Ziel
`7368a8ab-886c-488a-8570-c8009ee7514f`):

```xml
<modifiers>
  <modifier type="set" value="1" field="530cd595-8c63-435c-b9da-e243e2d4b0f2">
    <conditions>
      <condition type="instanceOf" value="1" field="selections" scope="ancestor"
                 childId="e7350b07-b1b1-41ba-8b02-e303d4461b84" shared="true"
                 includeChildSelections="true"/>
    </conditions>
  </modifier>
</modifiers>
<constraints>
  <constraint type="max" value="0" field="selections" scope="parent" shared="true"
              id="530cd595-8c63-435c-b9da-e243e2d4b0f2" includeChildSelections="false"/>
</constraints>
```

`childId="e7350b07-b1b1-41ba-8b02-e303d4461b84"` ist die Kategorie
**„Slaanesh [DARK ELVES]"** (`categoryEntries` des VC-Katalogs). Diese Kategorie wird im
gesamten Datensatz **nirgends vergeben**: kein `categoryLink` zielt auf sie, und der
einzige Kategorie-Modifikator im Umfeld („Mark of Slaanesh (Hero) [DARK ELVES]",
`3bd3ecde-9891-4cbd-8683-9ac53f4a2731`) fuegt eine **andere** Kategorie hinzu
(`add value="4990-1770-2328-effd" field="category"`). Die Bedingung kann also nie halten;
die Basisgrenze **max 0** bleibt bestehen und feuert mit **Ist 1 / Grenze 0**, sobald das
Steed gewaehlt ist. Eine Engine, die eine nicht haltende (oder nicht unterstuetzte)
ancestor-Bedingung als wahr behandelt, setzte die Grenze faelschlich auf 1 — Roster 02
wuerde rot.

| ID | Regel | Erwartung |
|----|-------|-----------|
| **ASI-R1** | Haelt die ancestor-Bedingung (ein Vorfahre traegt „Characters"), gilt fuer den Chariot max 1 statt 2. | Roster 01: `b79661e2-…` feuert **Ist 2 / Grenze 1**. |
| **ASI-R2** | Die aufgeloeste Bedingung hebt zugleich die Pflicht auf (`set 0` auf die min-Grenze). | Roster 01: `042be4cb-…` **absent**. |
| **ASI-R3** | Haelt die Bedingung nicht (kein Vorfahre in der Ziel-Kategorie), bleibt die Basisgrenze — hier max 0 am Steed-Link. | Roster 02: `530cd595-…` feuert **Ist 1 / Grenze 0**; die eigene Grenze des Steed-Eintrags `d84fb948-…` (max 1, eingehalten) **absent**. |
| **ASI-R4** | Der Rahmen `scope="ancestor"` ist in beiden Rostern aufloesbar (die Traeger haben Vorfahren; ob ein Treffer darunter ist, ist Ergebnis, kein Aufloesungsfehler). | Keine Diagnose `UNRESOLVED_SCOPE` mit `scope="ancestor"`. |

## Testkatalog (E2E-Szenarien der neuen Engine)

| # | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|----------------|------------------------------------|---------|
| 01 | Standard (VC-AB): Swain (Characters) → Commander [HIGH ELVES] → **2 ×** Tiranoc Chariot (je Armour Save, Crew, 2 Elven Steeds). | `b79661e2-…` feuert **Ist 2 / Grenze 1**; `042be4cb-…` absent; keine `UNRESOLVED_SCOPE` (`scope="ancestor"`). | [`01-chariot-under-character-max-lowered.ros`](rosters/01-chariot-under-character-max-lowered.ros) |
| 02 | Standard (VC-AB): Swain → Noble [DARK ELVES] (Hand Weapon) → **1 ×** Steed of Slaanesh. | `530cd595-…` feuert **Ist 1 / Grenze 0**; `d84fb948-…` absent; keine `UNRESOLVED_SCOPE` (`scope="ancestor"`). | [`02-steed-without-slaanesh-ancestor-max-zero.ros`](rosters/02-steed-without-slaanesh-ancestor-max-zero.ros) |

Die Erwartung ist selektiv. Insbesondere feuert in Roster 01 zusaetzlich die Mounts-
Gruppengrenze des Commanders (`aa1491d9-9d50-4d35-a6bf-9351ba3f6939`, max 1 — zwei
Reittiere), und die General-/Core-Pflichten des Kontingents duerfen auftreten; beides ist
nicht Gegenstand dieses Szenarios.

### Bewusst nicht Teil des Verletzungsberichts

- Die uebrigen ancestor-Vorkommen des VC-Katalogs sind **Sichtbarkeits**-Modifikatoren
  (`set hidden=false` auf „…(HoC)"-Gruppen) — Verfuegbarkeit, keine zaehlende Grenze, daher
  hier nicht als feuernde Grenze erwartet.
- Der einzige ancestor-Kandidat in *Orcs and Goblins* („Mork's Spirit-totem",
  `increment 1` auf `field="410e-ed97-ecf8-cfa4"` bei Vorfahre „Battle standard bearer"
  `2ef7-3efe-a448-423f`) wurde **verworfen**: die adressierte Constraint-Id
  `410e-ed97-ecf8-cfa4` existiert **nirgends** im Datensatz (haengender Verweis), der
  Modifikator hat also keine als Grenze beobachtbare Wirkung.
- Swain ist per Basis `hidden="true"` (erst ein Sonderkontingent blendet ihn ein) und das
  Steed of Slaanesh per Modifikator verborgen — Sichtbarkeit ist Verfuegbarkeit und
  verhindert keine Auswertung der Zaehlgrenzen im Roster.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (VC-AB)" (Vampire Counts) | `e989-15b8-7eb6-9668` |
| Kategorie „Characters" (`.gst`) | `7a1c-d611-c2dc-def1` |
| Kategorie „Slaanesh [DARK ELVES]" (VC, nirgends vergeben) | `e7350b07-b1b1-41ba-8b02-e303d4461b84` |
| SelectionEntry „Swain" (traegt Characters via `bfa2-7b7b-011a-04d3`) | `b920-b398-dc26-7f4d` |
| SelectionEntry „Commander [HIGH ELVES]" (ohne Characters-Link) | `d8e205ee-ee8d-4c18-afc8-cce2dde3f4ff` |
| SelectionEntry „Tiranoc Chariot [HIGH ELVES]" (Ziel) / EntryLink beim Commander | `9ee68772-6b2d-42a2-b24a-0dce060be729` / `1e5f8bfa-1bd4-41b5-81e4-c727e5c40ee5` |
| Chariot-Grenzen: max 2 (per Bedingung `set 1`) / min 1 (per Bedingung `set 0`) | `b79661e2-c983-45b3-a6dc-f8544ac9ce9e` / `042be4cb-667d-467d-8ada-c89436f2f248` |
| Chariot-Pflichtkinder: Armour Save 5+ / Crew / Elven Steed (min 2) | `68fa65d7-7e41-45e1-b56a-79e1ca0fff9a` / `1a4051f1-2537-4737-b037-6183c956fb45` / `2f50f622-23ac-482f-99e1-c20d9557db5d` |
| SelectionEntry „Noble [DARK ELVES]" (Hand Weapon min 1: `52ab1dcd-…`) | `a16d445b-ea00-48d6-a02a-376711f5c51c` |
| EntryLink „Steed of Slaanesh [DARK ELVES]" beim Noble (Traeger von max 0) / Ziel | `d86ebdbb-c14f-45d6-80d3-b7466a1f3db0` / `7368a8ab-886c-488a-8570-c8009ee7514f` |
| Steed-Grenzen: max 0 am Link (Bedingung `set 1` haelt nie) / max 1 am Ziel | `530cd595-8c63-435c-b9da-e243e2d4b0f2` / `d84fb948-66a1-49b5-8a32-3904d40c6e54` |
