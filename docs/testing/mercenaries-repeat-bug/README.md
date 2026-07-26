# E2E-Regeln & Testkatalog: Wiederholungen (`<repeat>`) in einem Modifikator

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs
und Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* **abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Kataloge: `Ogre Kingdoms (6th definitive edition).cat` (`49a5-e8f7-aa09-ad96`) — liefert das
  Kontingent **„Standard (OK-AB)"** `729f-9246-5cd3-5044`, das Soeldner zulaesst — und
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) mit der Einheit selbst.

## Regel (In-World)

Die Soeldnereinheit „Toxote's Hellmounts" besteht aus dem Anfuehrer „Toxote", den
Champions „Kylists" und den Truppen „Bucks". Von den Kylists ist zunaechst nur **einer**
erlaubt; je **2** Bucks kommt **einer** hinzu. Bei 4 Bucks sind also 3 Kylists erlaubt.

## Beleg (Katalog-Daten)

Aus `Mercenaries (6th definitive edition).cat`:

```xml
<selectionEntry type="model" name="Kylists (Chaos Centaur Champions)" id="07b6-6c42-d4d5-16e8">
  <constraints>
    <constraint type="min" value="1" field="selections" scope="parent" id="608d-6b9e-583a-0246"/>
    <constraint type="max" value="1" field="selections" scope="parent" id="7200-e796-ecd2-cdaa"/>
  </constraints>
  <modifiers>
    <modifier type="increment" value="1" field="7200-e796-ecd2-cdaa">
      <repeats>
        <repeat value="2" repeats="1" field="selections" scope="parent" childId="5350-812c-57c9-ef45" roundUp="false"/>
      </repeats>
    </modifier>
  </modifiers>
</selectionEntry>
```

`childId="5350-812c-57c9-ef45"` ist der Eintrag „Bucks (Chaos Centaur Troopers)".

Die Wiederholung liest sich direkt aus ihren Attributen: **`value="2"`** ist die
Schrittweite (je 2 Bucks), **`repeats="1"`** die Zahl der Anwendungen je Schritt,
**`roundUp="false"`** rundet den Quotienten ab. Bei 4 Bucks sind das
`floor(4 / 2) × 1 = 2` Anwendungen von `increment 1` → Obergrenze `1 + 2 = 3`.

| ID | Regel | Erwartung |
|----|-------|-----------|
| **MRB-R1** | Bei 4 Bucks erlaubt die Einheit 3 Kylists. Mit genau 3 Kylists ist `7200-e796-ecd2-cdaa` eingehalten. | Grenze feuert **nicht** (`absent`), und **keine** Wiederholung bleibt ungelesen (`UNSUPPORTED_REPEAT` `absent`). |

## Testkatalog (E2E-Szenarien der neuen Engine)

| # | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|----------------|------------------------------------|---------|
| 01 | Kontingent „Standard (OK-AB)" mit Toxote's Hellmounts: 1 Toxote, 4 Bucks, 3 Kylists. | **Keine Verletzung** von `7200-e796-ecd2-cdaa`; keine Diagnose `UNSUPPORTED_REPEAT`. | [`01-repeat.ros`](rosters/01-repeat.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (OK-AB)" (Ogre Kingdoms) | `729f-9246-5cd3-5044` |
| SelectionEntry Toxote's Hellmounts | `1a52-2060-f39b-38ee` |
| SelectionEntry Kylists | `07b6-6c42-d4d5-16e8` |
| SelectionEntry Bucks | `5350-812c-57c9-ef45` |
| Grenze „max Kylists" | `7200-e796-ecd2-cdaa` |
