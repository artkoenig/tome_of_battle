# E2E-Regeln & Testkatalog: `repeat scope="parent" childId="model" includeChildSelections="true"`

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* und der Format-Doku [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`, rev 1)
  — Kontingent **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`
- Mitgeladen: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) — der
  O&G-Katalog deklariert sie per `<catalogueLink targetId="fc47-8392-a6c8-452a"/>`
  (Zeile 14916) und sein Kontingent verlinkt die Kategorie „Mercenaries"; ohne den
  Katalog waere der Datensatz unvollstaendig.

## Regel (In-World)

Orkjungs koennen in **jede Hand eine Zusatzwaffe** nehmen: die Einheit
**„Savage Orc Boyz"** (6 Punkte je Modell, mindestens 10 Modelle, nach oben
unbegrenzt) darf ein **„Additional Hand Weapon"** waehlen. Es kostet **2 Punkte
je Modell der Einheit** — bei 12 Modellen also 24 Punkte.

## Die untersuchte Zelle

```xml
<selectionEntry id="2099-eac8-a45d-b4b6" name="Additional Hand Weapon"
                hidden="false" collective="false" import="true" type="upgrade">
  <modifiers>
    <modifier type="increment" field="ecfa-8486-4f6c-c249" value="2">
      <repeats>
        <repeat field="selections" scope="parent" value="1" percentValue="false"
                shared="true" includeChildSelections="true" includeChildForces="false"
                childId="model" repeats="1" roundUp="false"/>
      </repeats>
    </modifier>
  </modifiers>
  <costs>
    <cost name="pts" typeId="ecfa-8486-4f6c-c249" value="0"/>
    …
  </costs>
</selectionEntry>
```

(`Orcs and goblins (6th definitive edition).cat`, Zeilen 3531–3543; der Eintrag ist
Mitglied der Gruppe **„Weapons"** `2213-9b27-662a-9aba` (`max 1`,
`4629-28f2-6398-f27a`) der Wurzel-Einheit **„Savage Orc Boyz"** `e4d9-143c-2cf3-6615`.)

Lesart der Attribute — jede Zeile allein aus Format-Doku + Katalog:

- **`field="ecfa-8486-4f6c-c249"`** am `modifier` ist die **pts-Kostenart** der `.gst`
  (§5.3/§7.7): geaendert werden die **Kosten** des Traegers, kein Constraint.
- **`type="increment" value="2"`**: additive Operation — anders als bei `set` **vervielfacht**
  der Wiederholungsfaktor ihre Wirkung (Format-Doku §7.7, Kasten „Ein wiederholter `set`
  waechst nicht").
- **`scope="parent"`** ist der Bezugsrahmen der Wiederholung: die **Eltern-Auswahl des
  Traegers**. Eine `selectionEntryGroup` erzeugt im `.ros` **keinen** eigenen Knoten —
  Gruppenmitglieder haengen als direkte Kinder der umschliessenden Auswahl (belegt an den
  vorhandenen Fixture-Rostern, die Gruppenmitglieder mit `entryGroupId` als Geschwister
  der Modelle fuehren). Eltern-Rahmen ist damit die **Einheiten-Auswahl** selbst.
- **`childId="model"`** ist das Roh-Typ-Schluesselwort (§7.7): gezaehlt werden die Auswahlen
  mit `type="model"` im Rahmen — hier das Modell `e5fb-a639-766e-34e0` (`number="12"` bzw.
  `13`). Choppa, Shield und das AHW selbst sind `type="upgrade"` und zaehlen **nicht**.
- **`field="selections"` + `shared="true"`**: gezaehlt wird die Anzahl Auswahlen, ueber alle
  Vorkommen des Ziels im Rahmen hinweg.
- **`value="1" repeats="1" roundUp="false"`**: je 1 gezaehltem Modell 1 Anwendung —
  `floor(N / 1) × 1 = N` Anwendungen von `increment 2`.
- **`percentValue="false"`**: `value` ist eine Stueckzahl, kein Prozentsatz.
- **`includeChildForces="false"`**: ohne Wirkung, der Rahmen ist eine Auswahl, kein Kontingent.
- **`includeChildSelections="true"`**: gezaehlt werden **alle Nachfahren** des Rahmens, nicht
  nur dessen direkte Kinder (§7.6: `false` zaehlt *„just `scope`'s `field`"*). Zur
  Beobachtbarkeit genau dieser Haelfte siehe den Abschnitt **„Die Tiefen-Haelfte des Flags"**.

### Vorrechnung der Rostersummen

| Auswahl | Quelle der Kosten | 12 Modelle | 13 Modelle | 12 + Shield |
|---------|-------------------|-----------:|-----------:|------------:|
| Einheit „Savage Orc Boyz" (`e4d9-143c-2cf3-6615`) | Eintrag, `value="0"` | 0 | 0 | 0 |
| Modell „Savage Orc Boyz" (`e5fb-a639-766e-34e0`) | Eintrag, `value="6"` | 72 | 78 | 72 |
| Choppa (`456a-16c8-8b31-c422`, Pflicht `min 1`) | Eintrag, `value="0"` | 0 | 0 | 0 |
| Shield (`415a-7627-c819-3b4b`) | Eintrag `0` + N × `increment 1` | — | — | 12 |
| **Additional Hand Weapon** (`2099-eac8-a45d-b4b6`) | Eintrag `0` + N × `increment 2` | **24** | **26** | **24** |
| **Summe** | | **96** | **104** | **108** |

Gewaehlt sind **12** bzw. **13** Modelle — legal (Minimum 10 per
`e2bd-009a-fe28-14aa`, Maximum unbegrenzt per `47dc-e2ce-b495-6256`, `value="-1"`;
der Border-Patrols-Modifikator darauf bleibt ohne die Auswahl „Border Patrols rules"
`4e15-0353-165f-5528` wirkungslos) — und bewusst **nicht** das Minimum: eine Engine,
die statt der echten Zaehlung den `min`-Constraint-Wert 10 einsetzt, rechnet 92 statt
96 und wird von der Klammer unten mitgefangen.

Die Einheit ist im Kontingent **„Standard (OG-AB)"** sichtbar: ihr
`modifier set hidden="true"` ist auf sechs **andere** Kontingent-Ids gegated
(`c248-…`, `a2fa-…`, `b26c-…`, `1f55-…`, `03cc-…`, `1821-…`, `9f70-…`) und greift hier nicht.

## Beobachtbarkeit ueber die Budget-Regel

Die roster-weite Budget-Regel (`budget::ecfa-8486-4f6c-c249`) feuert bei **strikter**
Ueberschreitung des eingestellten Punktelimits (Ist = Summe, Grenze = Limit; Grenzfall
„Summe = Limit" feuert nicht — belegt im Szenario
[`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), Roster 05).

**Klammer 95 / 96 um die Summe 96** (Roster 01/02):

| Fehl-Lesart der Wiederholung | Summe | Limit 95 (Roster 01) | Limit 96 (Roster 02) |
|------------------------------|------:|----------------------|----------------------|
| 0 Anwendungen (Rahmen nicht aufgeloest) | 72 | schweigt faelschlich | — |
| 1 Anwendung (Wiederholung als Bedingung gelesen) | 74 | schweigt faelschlich | — |
| je Modell-**Auswahl** statt je Modell (`number` ignoriert) | 74 | schweigt faelschlich | — |
| `min`-Constraint-Wert 10 statt Zaehlung | 92 | schweigt faelschlich | — |
| **korrekt: 12 Anwendungen** | **96** | **feuert 96/95** | **schweigt** |
| N+1 = 13 Anwendungen | 98 | feuert mit falschem Ist | feuert faelschlich |
| alle Eltern-Kinder statt nur `type="model"` (12+1+1 = 14) | 100 | feuert mit falschem Ist | feuert faelschlich |

**Ein Modell mehr** (Roster 03, byte-gleich zu 02 bis auf `number="13"`): die Summe
steigt um genau **einen Schritt** auf 104 — 6 pts vom Modell selbst, **2 pts vom
Traeger**. Da die Erwartung `actual` exakt prueft, faellt jede eingefrorene oder
verschobene Zaehlung auf (12 Anwendungen: 102; `min`-Wert 10: 98; alle 15 Kinder: 108).

**Die Gegenzelle im selben Rahmen** (Roster 04/05): die Einheit traegt am `Shield`
(`415a-7627-c819-3b4b`) dieselbe Wiederholung mit **`includeChildSelections="false"`**
(Zeile 3471) und `increment 1`. Beide Zellen zaehlen in diesem — flachen — Rahmen
dieselben 12 Modelle: 12 + 24 = 36 Aufschlag, Summe 108. Die Klammer **107 / 108**
legt das fest und faengt eine Engine, die der `true`-Zelle die direkten Kinder
zusaetzlich als Nachfahren anrechnet (24 Anwendungen → AHW 48, Summe 132).

## Die Tiefen-Haelfte des Flags — bewusst **nicht** gepinnt

`includeChildSelections="true"` hat zwei Haelften: *(a)* der Modifikator wird je
gezaehltem Modell einmal angewandt, und *(b)* dabei zaehlen auch Modelle mit, die
**tiefer** als eine Ebene unter dem Rahmen haengen. Dieses Szenario pinnt **(a)**;
**(b)** ist an diesen Daten **nicht beobachtbar**, und zwar ohne erfundene Platzierung
nicht herstellbar:

- Im gesamten Fixture-Korpus (`src/evaluator/__fixtures__/whfb6-definitive/`, 5 Dateien)
  traegt diese Zelle (`scope="parent"` + `childId="model"` + `includeChildSelections="true"`)
  **12 Vorkommen** an **sechs** Traeger-Einheiten:
  „Savage Orc Boyz" `e4d9-143c-2cf3-6615` (Zeilen 3535, 3549),
  „Savage Orc Big 'Uns" `bbd3-eba1-8e8d-39c8` (6874, 6888),
  „Fire Kobold" `8087-11ca-dbe9-1f8e` (10915, 10927),
  „0-1 Hill Goblins" `f23f-1816-93a7-3059` (11217, 11229, 11245, 11263),
  „Troglagob" `3055-5692-b76a-1968` (11437) — alle in `Orcs and goblins ….cat` — sowie
  „Zombie Pirate Gunnery Mob" `f404-a138-25e2-1cc5` (`Vampire Counts ….cat`, 13058).
- **Jede** dieser sechs Einheiten definiert genau **ein** `type="model"`-Kind, und zwar
  als **direktes** Kind der Einheit; alles Weitere unter ihnen ist `type="upgrade"`
  (Kommandogruppe, Waffen, Ruestung). Es gibt dort schlicht keine Katalog-Definition,
  die ein Modell auf einer zweiten Ebene erlauben wuerde — ein solches Roster waere
  erfunden, nicht abgeleitet.
- Rahmen **mit** Modellen auf zwei Ebenen existieren im Korpus durchaus — z. B.
  „Goblin Spear Chukka" `1beb-9007-1c33-7589` → Modell `1806-c3a4-bbf9-9dc1` → Modelle
  `bb1b-7773-042c-2c29` / `dd82-a553-523c-af31`, oder „Goblin Wolf Chariots"
  `5943-b878-61dd-7620` → `df29-1982-ca2a-4064` → `760d-9328-397c-d957` —, aber **keiner**
  von ihnen traegt diese Zelle. Die Wiederholungen dort stehen entweder auf
  `includeChildSelections="false"` (z. B. Zeile 5636) oder fehlen ganz.

Konsequenz fuer die Erwartung: Roster 04/05 stellen die `true`-Zelle und die
`false`-Zelle **nebeneinander** und fordern von beiden **denselben** Faktor 12 — das ist
die Aussage, die die Daten hergeben („im flachen Rahmen unterscheiden sich die beiden
Flag-Werte nicht"). Eine Aussage der Form „das tiefere Modell zaehlt mit" wird hier
**nicht** erhoben. Wer sie pinnen will, braucht einen Katalog, der beide Merkmale in
einem Rahmen vereint; dieser Datensatz tut es nicht.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg / Erwartung |
|----|-------|-------------------|
| **PRMIC-R1** | Der `increment 2` auf die pts-Kostenart des „Additional Hand Weapon" wird **genau einmal je im Eltern-Rahmen gezaehltem Modell** angewandt. Bei 12 Modellen: 24 pts, Rostersumme 96. | `2099-eac8-a45d-b4b6` → `modifier increment 2 field="ecfa-8486-4f6c-c249"` mit `repeat value="1" repeats="1" roundUp="false"`. Limit 95: `budget::ecfa-8486-4f6c-c249` feuert **Ist 96 / Grenze 95**. |
| **PRMIC-R2** | Dieselbe Summe haelt ein Limit von 96 ein (Gleichstand feuert nicht). | Limit 96: Budget **absent**. Ueber-Zaehlung (≥ 98) feuert hier faelschlich. |
| **PRMIC-R3** | Der Aufschlag **waechst mit dem Modellzaehler**: ein Modell mehr = eine Anwendung mehr. 13 Modelle → 26 pts Aufschlag, Summe 104. | Roster 03 unterscheidet sich von 02 nur in `number="13"`. Budget feuert **Ist 104 / Grenze 96**. |
| **PRMIC-R4** | Gezaehlt wird das Roh-Typ-Schluesselwort `model`, **nicht** jede Auswahl im Rahmen. | `childId="model"`; Choppa/Shield/AHW sind `type="upgrade"`. Eine Zaehlung aller Eltern-Kinder ergaebe 14 (bzw. 15) und damit 100 (bzw. 108) statt 96 (bzw. 104) — gefangen von R1–R3. |
| **PRMIC-R5** | Im **flachen** Rahmen liefern `includeChildSelections="true"` (AHW) und `includeChildSelections="false"` (Shield) **dieselbe** Zaehlung 12. | Roster 04/05: `415a-7627-c819-3b4b` (Zeile 3471, `increment 1`, Flag `false`) und `2099-eac8-a45d-b4b6` (`increment 2`, Flag `true`) im selben Rahmen. Klammer 107/108 um die Summe 108. |
| **PRMIC-R6** | Die Wiederholung wird als solche gelesen und ihr Bezugsrahmen ist aufloesbar (der Traeger hat eine Eltern-Auswahl). | Keine Diagnose `UNSUPPORTED_REPEAT`; keine Diagnose `UNRESOLVED_SCOPE` mit `scope="parent"`. |
| **PRMIC-R7** | **Nicht** gepinnt: „Modelle tiefer als eine Ebene zaehlen mit." | Siehe Abschnitt „Die Tiefen-Haelfte des Flags" — kein Traeger dieser Zelle sitzt im Korpus in einem Rahmen, der Modelle auf zwei Ebenen halten kann. Erscheint **nicht** in `firing`/`absent`. |

## Testkatalog (E2E-Szenarien der Reinraum-Engine)

| # | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|----------------|------------------------------------|---------|
| 01 | Savage Orc Boyz: **12** Modelle, Choppa, Additional Hand Weapon. Punktelimit **95**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 96 / Grenze 95**; keine `UNSUPPORTED_REPEAT`, keine `UNRESOLVED_SCOPE` (`scope="parent"`). | [`01-ahw-12-models-over-budget.ros`](rosters/01-ahw-12-models-over-budget.ros) |
| 02 | Derselbe Aufbau, Punktelimit **96**. | Budget **absent** (96 ≤ 96); dieselben Diagnose-Ausschluesse. | [`02-ahw-12-models-within-budget.ros`](rosters/02-ahw-12-models-within-budget.ros) |
| 03 | Wie 02, aber **13** Modelle. Punktelimit **96**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 104 / Grenze 96**; dieselben Diagnose-Ausschluesse. | [`03-ahw-13-models-one-step-more.ros`](rosters/03-ahw-13-models-one-step-more.ros) |
| 04 | 12 Modelle, Choppa, **Shield** (Flag `false`) **und** AHW (Flag `true`). Punktelimit **107**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 108 / Grenze 107**; dieselben Diagnose-Ausschluesse. | [`04-ahw-and-shield-over-budget.ros`](rosters/04-ahw-and-shield-over-budget.ros) |
| 05 | Derselbe Aufbau, Punktelimit **108**. | Budget **absent** (108 ≤ 108); dieselben Diagnose-Ausschluesse. | [`05-ahw-and-shield-within-budget.ros`](rosters/05-ahw-and-shield-within-budget.ros) |

Die Erwartung ist **selektiv**: weitere Armeeaufbau-Verstoesse (General-Pflicht der
`.gst`, Core-Mindestzahl des Kontingents) duerfen zusaetzlich auftreten und sind nicht
Gegenstand dieses Szenarios.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (OG-AB)" (Orcs and Goblins, `hidden="false"`) | `2bfa-e64a-7123-895f` |
| Katalog „Orcs and Goblins" (rev 1) / verlinkter Katalog „Mercenaries" | `4049-c46d-7f80-44fb` / `fc47-8392-a6c8-452a` |
| SelectionEntry Einheit „Savage Orc Boyz" (`type="unit"`, 0 pts) | `e4d9-143c-2cf3-6615` |
| SelectionEntry Modell „Savage Orc Boyz" (6 pts; `min 10`, `max -1`) | `e5fb-a639-766e-34e0` (`e2bd-009a-fe28-14aa` / `47dc-e2ce-b495-6256`) |
| SelectionEntry „Choppa" (Pflicht, 0 pts; `min 1` / `max 1`) | `456a-16c8-8b31-c422` (`2a8b-bff3-9d1d-8963` / `845a-4b5e-064c-781b`) |
| SelectionEntry „Shield" — **Gegenzelle** `includeChildSelections="false"`, `increment 1`, 0 pts, `max 1` | `415a-7627-c819-3b4b` (`5cb1-62e1-14ca-0c7b`) |
| SelectionEntryGroup „Weapons" (`max 1`) | `2213-9b27-662a-9aba` (`4629-28f2-6398-f27a`) |
| **SelectionEntry „Additional Hand Weapon"** — Traeger der untersuchten Zelle, 0 pts | `2099-eac8-a45d-b4b6` |
| Geschwister in derselben Gruppe: „Spears" (Zelle ebenfalls `true`, `increment 1`) / EntryLink „Bow" (Flag `false`, `increment 3`) | `9942-7b31-d264-1a0e` / `2abd-b618-5131-35a5` |
| Kategorien der Einheit (Core primaer / Savage Boyz) | `64bf-efb4-9978-26df` / `5e83-d646-097c-dbee` |
| Auswahl „Border Patrols rules" (nicht gewaehlt — haelt die `max -1` unbegrenzt) | `4e15-0353-165f-5528` |
| pts-Kostenart (`.gst`) | `ecfa-8486-4f6c-c249` |
| Budget-Grenze (Engine-Regel, roster-weit; kein Katalog-Baustein) | `budget::ecfa-8486-4f6c-c249` |
