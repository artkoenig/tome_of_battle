# E2E-Regeln & Testkatalog: `equalTo` auf ein Kostenlimit mit `scope="force"` (Border Patrol (500pts))

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind
ausschließlich aus den Katalogdaten der *6th Definitive Edition*, aus der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.6/§7.7/§9.5) und aus den bereits verifizierten Schwester-Szenarien abgeleitet;
das Roster-Format ist an deren Fixtures nachgebildet (direktes `entryId`,
`entryLinkId=""`, `number`, `costLimits` mit `typeId`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`,
  rev 1) — Kontingent **„Standard (OG-AB)"** `2bfa-e64a-7123-895f` (Z. 47)
- Abhängigkeit: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`), per `catalogueLink`
  `b066-2f8e-11ee-1dce` aus der O&G-`.cat` deklariert (Z. 14916). Dort liegt der
  Prüfling.
- Punkte-Kostenart: `pts` `ecfa-8486-4f6c-c249`

---

## Worum es geht

`Border Patrol (500pts)` (`2066-082d-a465-4baf`, Mercenaries-`.cat` Z. 9374–9391,
in `<sharedSelectionEntries>`) trägt die **einzige** Bedingung des Korpus mit
`type="equalTo"` auf ein Kostenlimit:

```xml
<selectionEntry type="upgrade" import="true" name="Border Patrol (500pts)" hidden="false" id="2066-082d-a465-4baf">
  <categoryLinks>
    <categoryLink name="Special list rules" hidden="false" id="145d-18ab-7467-6240" targetId="32f1-197f-d719-a393" primary="true"/>
  </categoryLinks>
  <constraints>
    <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="ac2c-85cb-fdd9-9fe0" includeChildSelections="false"/>
    <constraint type="max" value="1" field="selections" scope="force"  shared="true" id="73ff-2023-7f30-cefa" includeChildSelections="false"/>
    <constraint type="min" value="0" field="selections" scope="parent" shared="true" id="1a97-1579-ab05-a6d7" includeChildSelections="false"/>
  </constraints>
  <modifiers>
    <modifier type="set" value="1" field="1a97-1579-ab05-a6d7">
      <conditions>
        <condition type="equalTo" value="500" field="limit::ecfa-8486-4f6c-c249" scope="force" childId="any" shared="true" includeChildSelections="true" includeChildForces="true"/>
      </conditions>
    </modifier>
  </modifiers>
</selectionEntry>
```

Wörtlich aus der Formatreferenz abgeleitet:

- `field="limit::<costTypeId>"` liest laut §7.7 „das **Kostenlimit** der Roster" —
  also das **eingestellte Budget** aus dem `<costLimits>`-Block, **nicht** die
  verplante Summe. Die verplante Summe wäre `field="<costTypeId>"` ohne
  `limit::`-Präfix (§7.6, §9.4).
- `type="equalTo"` hält **genau** bei Gleichheit mit `value`. Das unterscheidet
  es von `atLeast` (hielte auch bei 501) und von `atMost` (hielte auch bei 499).
- `type="set"` mit einer **Constraint-Id** als `field` **ersetzt** deren `value`
  (§7.7). Hält die Bedingung, ist die Untergrenze des Eintrags 1 — er wird zur
  Pflicht; hält sie nicht, bleibt der Basiswert 0.
- `childId="any"` ist bei einer `limit::`-Abfrage ohne zählende Wirkung: gefragt
  ist der Wert des Limits, nicht eine Menge von Auswahlen.

---

## Was die Roster über `scope="force"` sagen können — und was nicht

Das Budget ist im `.ros`-Format eine **Roster**-Einstellung: `<costLimits>` hängt
am `<roster>`-Wurzelelement (`costLimit typeId=… value=…`), und das Format kennt
**keinen** Ort, an dem ein einzelnes `<force>` ein eigenes Kostenlimit
einstellen könnte (weder die Formatreferenz §5.6/§7.6 noch die
`.ros`-Fixtures der bestehenden Szenarien kennen so etwas). Daraus folgt
nüchtern:

- **Nachweisbar ist**, dass die Bedingung das *konfigurierte* Limit liest und
  **exakte Gleichheit** verlangt. Beides trennt dieses Szenario sauber
  (500 ↔ 499 ↔ 501, und 0 verplante Punkte gegen ein Limit von 500).
- **Nicht nachweisbar ist**, dass `scope="force"` hier etwas **anderes** meint
  als `scope="roster"`. Ein Ein-Kontingent-Roster kann die beiden Rahmen
  grundsätzlich nicht trennen — und selbst ein Mehr-Kontingent-Roster könnte es
  nicht, weil beide Kontingente dasselbe roster-weite Budget sähen. Das
  Szenario behauptet über den Force-Rahmen darum **nur** das eine, was aus den
  Daten folgt: er muss auflösen (kein `UNRESOLVED_BUDGET_LIMIT`, kein stilles
  0-Ergebnis) und liefert denselben Wert wie das Roster-Budget. Für die Aussage
  „`scope="force"` ≠ `scope="roster"`" gibt es im Korpus **keine** beobachtbare
  Konstellation; das ist eine Lücke der Daten, keine der Prüfung.
- Die `.gst` nutzt für dieselbe Größe durchgehend `scope="roster"`
  (Kategoriegrenzen, Z. 224–359, 377–430, 439–540, 549–636, 647–718). Die
  Mercenaries-`.cat` ist das einzige Vorkommen mit `scope="force"`. Dass beide
  denselben Wert liefern **müssen**, ist damit implizit auch die Lesart des
  Katalogautors.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **EQF-R1** | **Gleichheit hält → das eigene Minimum wird angehoben.** Bei einem eingestellten `pts`-Budget von **exakt 500** hält `equalTo 500` auf `limit::ecfa-8486-4f6c-c249`; der `set`-Modifikator ersetzt den Wert von `1a97-1579-ab05-a6d7` durch **1**. Der besetzte Slot des Eintrags meldet `effectiveMin` **1**. | Mercenaries-`.cat` Z. 9374 (`selectionEntry "Border Patrol (500pts)"` `2066-082d-a465-4baf`, `hidden="false"`, `type="upgrade"`), Grenze Z. 9382 (`min 0`, `field="selections"`, `scope="parent"`, `shared="true"`), Modifikator Z. 9385–9389 (`set value="1" field="1a97-1579-ab05-a6d7"` mit der einzigen Bedingung Z. 9387). |
| **EQF-R2** | **Ein Punkt darunter hält nicht** — `equalTo` ist kein `atMost`. Bei Budget **499** greift der Modifikator nicht; die Grenze behält ihren **Basiswert** `min 0`, der Slot meldet `effectiveMin` **0**. | Dieselben Zeilen; `value="500"` an der Bedingung Z. 9387. Kein zweiter Modifikator adressiert `1a97-1579-ab05-a6d7` (genau **eine** weitere Fundstelle der Id im gesamten Korpus: der `field`-Verweis Z. 9385). |
| **EQF-R3** | **Ein Punkt darüber hält ebenfalls nicht** — `equalTo` ist kein `atLeast`. Bei Budget **501** bleibt es bei `min 0` / `effectiveMin` **0**. Erst 02 **und** 03 zusammen klemmen die Gleichheit beidseitig ein. | Wie EQF-R2. |
| **EQF-R4** | **Gelesen wird das konfigurierte Budget, nicht die verplante Summe.** Der Eintrag trägt **kein** `<costs>`-Element; die vier Roster verplanen zusammen **0** Punkte. Trotzdem ist das Minimum bei Budget 500 angehoben. Würde die Bedingung die Summe lesen, wäre der Vergleich `0 = 500` und nie erfüllt. Das `limit::`-Präfix ist genau dieser Unterschied. | Mercenaries-`.cat` Z. 9374–9391: keine `<costs>` am Eintrag. Formatreferenz §7.7 (`limit::<costTypeId>` = „das Kostenlimit der Roster") gegen §7.6/§9.4 (`field="<costTypeId>"` = Kostensumme). Gegenprobe im Szenario [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), OGB-R2: die **Summe** wird von der engine-eigenen Grenze `budget::ecfa-8486-4f6c-c249` geprüft — sie ist hier in allen Rostern still (0 ≤ 499/500/501). |
| **EQF-R5** | **Budget ist gesetzt → keine `UNRESOLVED_BUDGET_LIMIT`-Diagnose.** Alle vier Roster tragen einen `<costLimits>`-Block für `ecfa-8486-4f6c-c249`; die `limit::`-lesende Bedingung ist damit auflösbar. Die fail-closed-Diagnose darf nicht auftreten. | `<costLimits><costLimit typeId="ecfa-8486-4f6c-c249" …/></costLimits>` in jedem Roster; Gegenfall (ohne Block) ist OGB-R3 des Szenarios [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md). |
| **EQF-R6** | **Die beiden Obergrenzen bleiben still und markieren „ausgeschöpft".** Mit genau **einer** Auswahl ist `max 1` (parent `ac2c…`) und `max 1` (force `73ff…`) erreicht, aber nicht überschritten: keine Verletzung, `current 1`, `effectiveMax 1`, `headroom 0`, `isBlocked true`. | Mercenaries-`.cat` Z. 9380/9381. Slot-Semantik wie in [`offer-and-category-slots`](../offer-and-category-slots/README.md), OCS-R6. |
| **EQF-R7** | **Der Eintrag ist nicht versteckt.** Er trägt `hidden="false"` und **keinen** `hidden`-Modifikator — weder in `<modifiers>` noch in einem `<modifierGroups>` (der Eintrag hat gar keine `modifierGroups`, vgl. den Fallstrick-Kasten in §7.7). Sein Slot meldet `isHidden false`, seine Min-Grenze wäre also berichtspflichtig (Issue 0088 greift nicht). | Mercenaries-`.cat` Z. 9374–9391: einziges `<modifiers>`-Element ist Z. 9384–9390, einziger Modifikator adressiert `1a97-1579-ab05-a6d7`. |
| **EQF-R8** | **Ohne Auswahl entsteht kein Anker — die angehobene Pflicht bleibt unbeobachtbar.** Die Definition liegt in `<sharedSelectionEntries>` (Mercenaries-`.cat` Z. 88–9525) und wird im **gesamten** Datensatz von **keinem** `entryLink` referenziert; die Mercenaries-`.cat` hat überhaupt keine Wurzel-`<selectionEntries>`/`<entryLinks>` (Top-Level: `publications` 3, `categoryEntries` 37, `sharedSelectionEntries` 88, `sharedRules` 9526, `sharedProfiles` 9878, `sharedSelectionEntryGroups` 10855). Damit ist sie im Kontingent **nicht wählbar**, bekommt weder Angebots- noch Pflicht-Anker und wird nicht ausgewertet: `1a97-1579-ab05-a6d7` bleibt in Roster 04 **still**. | Wählbarkeits-Definition und der ausdrücklich gleich gelagerte Fall „Manbiters" (ebenfalls Mercenaries-`<sharedSelectionEntries>`, ins Angebot nur über den Wurzel-`entryLink` `e3c2-1778-d3d5-edd1` der O&G-`.cat`) in [`offer-and-category-slots`](../offer-and-category-slots/README.md), Abschnitt „Worum es geht", OCS-R1/R2/R7. Grep-Beleg: `2066-082d-a465-4baf` kommt im Fixture-Korpus **genau einmal** vor — als Definition. |
| **EQF-R9** | **Die Kategorie steht der Wählbarkeit nicht im Weg** — sie ist es also nicht, woran EQF-R8 scheitert. Die einzige Basiskategorie des Eintrags ist *Special list rules* `32f1-197f-d719-a393`, und genau die führt das Kontingent „Standard (OG-AB)". Die Kategorie selbst ist grenzen- und modifikatorlos, beeinflusst also keine Zählung. | Mercenaries-`.cat` Z. 9377 (`categoryLink 145d-18ab-7467-6240 → 32f1-197f-d719-a393`, `primary="true"`); O&G-`.cat` Z. 50 (`categoryLink 0636-2809-bf71-0f02 → 32f1…` im `forceEntry 2bfa-e64a-7123-895f`); `.gst` Z. 210 (`categoryEntry "Special list rules"`, `hidden="false"`, ohne `constraints`/`modifiers`). |
| **EQF-R10** | **Budgetunabhängige Kontrolle: die Core-Pflicht.** `min 2` auf der Kategorie *Core* (`scope="force"`) wird nur durch „Border Patrols rules" (`set 1`) oder durch Budgets ab 2000 pts umgewertet — beides trifft hier auf **keines** der vier Roster zu. Sie feuert in **allen** vieren identisch mit **Ist 0 / Grenze 2**. Damit ist maschinell festgehalten, dass die reine Budget-Änderung 499 ↔ 500 ↔ 501 sonst nichts verschiebt. | `.gst` Z. 372–433: `categoryEntry "Core"` `64bf-efb4-9978-26df`, Constraint `35c2-d478-392a-aeb1` (Z. 374), Modifikatoren Z. 377–430 (einer auf `atLeast 1` von `4e15-0353-165f-5528`, die übrigen auf `atLeast 2000`). `2066-082d-a465-4baf` ist **nicht** `4e15-0353-165f-5528`. |
| **EQF-R11** | **Was sich zwischen 499 und 500 sonst ändert, sind ausschließlich Obergrenzen ohne Auswahl — und bleibt still.** Die `.gst`-Kategoriegrenzen kennen ein Band „200 ≤ Budget < 500": *Lord* `fda5…` wird dort auf **0** gesetzt (sonst Basis 1), *Special* `16f0…` auf **2** (sonst Basis 3), *Characters* `c3c3…` auf **2** (sonst Basis 3), *Rare* `0a44…` auf **1** (= Basis). Bei 500 und 501 greift keiner dieser Modifikatoren mehr. Alle vier sind `max`-Grenzen, und die Roster enthalten **keine** Auswahl dieser Kategorien → Ist 0, alle still. *Heroes* `7fca…` ist `max -1` (unbegrenzt) und modifikatorlos. | `.gst`: Lord Z. 220/234–245/363; Special Z. 434/436/445–457/528–540; Rare Z. 544/546/555–566; Characters Z. 641/644/653–664; Heroes Z. 366/368. Alle Punkteband-Modifikatoren oberhalb dieser Bänder verlangen `atLeast 2000`. |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| **Ein feuerndes `1a97-1579-ab05-a6d7` mit Ist 0 / Grenze 1** | Fachlich wäre der Eintrag bei Budget 500 Pflicht — beobachtbar ist das im vorliegenden Korpus aber **nicht**, weil die Definition keinen Weg in ein Kontingent hat (EQF-R8). Roster 04 hält den Fall fest und fordert darum das **Gegenteil** (`absent`). Siehe den Abschnitt „Datenlücke" unten. |
| `scope="force"` gegen `scope="roster"` | Im `.ros`-Format gibt es nur ein roster-weites Budget; die beiden Rahmen sind für eine `limit::`-Abfrage prinzipiell nicht trennbar (siehe oben). |
| Die `General`-Pflicht `1077-7379-f142-f382` (`min 1`, force) | Feuert in allen vier Rostern mit Ist 0 — budgetunabhängig und nicht Gegenstand. Toleriert (selektive Erwartung), nicht behauptet. |
| Pflicht-Anker anderer Wurzel-Einträge der O&G-`.cat`/`.gst` | Können zusätzlich feuern; die Erwartung ist selektiv und macht darüber keine Aussage. |
| `percentValue` an der Bedingung | Das Attribut fehlt an Z. 9387; §7.7 setzt es damit auf `false`. Kein eigener Prüfgegenstand. |
| `includeChildSelections`/`includeChildForces` der Bedingung | Beide `true`, bei einer `limit::`-Abfrage aber ohne Zählwirkung (es wird kein `field="selections"` summiert). Nicht beobachtbar, nicht behauptet. |

---

## Datenlücke: der Eintrag ist im Katalog verwaist

Der Prüfling ist der einzige Träger dieser Bedingungszelle — und er ist im
Datensatz **nicht erreichbar**:

- `2066-082d-a465-4baf` kommt im gesamten Fixture-Korpus **genau einmal** vor:
  als Definition in `<sharedSelectionEntries>` der Mercenaries-`.cat` (Z. 9374).
- Kein `entryLink` in `.gst`, `Orcs and goblins`, `Ogre Kingdoms`,
  `Vampire Counts` oder `Mercenaries` zeigt darauf.
- Die Mercenaries-`.cat` ist ein reiner Bibliothekskatalog (`library="true"`)
  **ohne** Wurzel-`<selectionEntries>`/`<entryLinks>`.

Ein Roster kann den Eintrag trotzdem benennen (die Engine löst
global-by-ID auf, ADR 0032, Formatreferenz §3.2) — genau das tun die Roster
01–03. Ohne diese Nennung entsteht aber kein Knoten, und die angehobene
Untergrenze hat nichts, woran sie hängen könnte. Die eigentliche Regel des
Katalogautors („bei genau 500 Punkten ist Border Patrol Pflicht") ist im
Datensatz deshalb **nicht** als feuernde Grenze abbildbar; abbildbar ist nur
ihre Wirkung auf den **gewählten** Eintrag. Für die inhaltlich gleiche
Border-Patrol-Mechanik nutzt die `.gst` einen **anderen**, wurzelnahen Eintrag:
`Border Patrols rules` `4e15-0353-165f-5528` (`.gst` Z. 17584), dessen eigenes
Sichtbarkeits-Gatter ebenfalls `equalTo 500` liest, dort aber mit
`scope="roster"` — gepinnt im Schwester-Szenario
[`at-least-roster-border-patrols-gate`](../at-least-roster-border-patrols-gate/README.md)
(BPG-R3).

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Die Roster 01–03
sind **bis auf die eine Zahl im `<costLimits>`-Block identisch**: Kontingent
„Standard (OG-AB)", genau eine Wurzel-Auswahl `Border Patrol (500pts)`
(`number="1"`), 0 verplante Punkte. Genau diese eine Zahl ist der Auslöser —
der Wechsel von `effectiveMin` lässt sich keiner anderen Ursache zuschreiben.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Budget **exakt 500** → Pflicht | 500 pts, Eintrag gewählt (1×). | **EQF-R1/R4:** Slot meldet `effectiveMin 1` (angehoben), `current 1`, `effectiveMax 1`, `headroom 0`, `isBlocked true`, `isHidden false`, `isMandatoryUnmet false`. **EQF-R6:** beide `max 1` still. **EQF-R10:** Core feuert Ist 0 / Grenze 2. **EQF-R5:** keine `UNRESOLVED_BUDGET_LIMIT`. | [`01-budget-500-selected-min-raised.ros`](rosters/01-budget-500-selected-min-raised.ros) |
| 02 | Budget **499** → keine Pflicht (`equalTo` ≠ `atMost`) | Identisch, nur 499 pts. | **EQF-R2:** Slot meldet `effectiveMin 0` — der Basiswert. Sonst alles wie 01. | [`02-budget-499-selected-min-unraised.ros`](rosters/02-budget-499-selected-min-unraised.ros) |
| 03 | Budget **501** → keine Pflicht (`equalTo` ≠ `atLeast`) | Identisch, nur 501 pts. | **EQF-R3:** Slot meldet `effectiveMin 0`. Sonst alles wie 01. | [`03-budget-501-selected-min-unraised.ros`](rosters/03-budget-501-selected-min-unraised.ros) |
| 04 | Budget **exakt 500**, Eintrag **nicht** gewählt | Leeres Kontingent, 500 pts. | **EQF-R8:** Die angehobene Untergrenze `1a97-1579-ab05-a6d7` feuert **nicht** — die Definition ist im Kontingent nicht wählbar, es entsteht kein Anker. **EQF-R10:** Core unverändert Ist 0 / Grenze 2. | [`04-budget-500-unselected-no-anchor.ros`](rosters/04-budget-500-unselected-no-anchor.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen, absteigend nach Risiko:

1. **EQF-R8 (Roster 04, `absent`).** Die riskanteste Behauptung des Szenarios.
   Sie folgt aus der in
   [`offer-and-category-slots`](../offer-and-category-slots/README.md)
   festgehaltenen Wählbarkeits-Definition (nur **wurzelnahe**
   `<selectionEntries>`/`<entryLinks>` eines Katalogs kommen als Angebots- bzw.
   Pflicht-Anker in ein Kontingent) plus dem Grep-Befund, dass auf
   `2066-082d-a465-4baf` **kein** `entryLink` zeigt. Feuert die Grenze
   trotzdem, ist die Wählbarkeits-Regel der Engine weiter als dort dokumentiert
   (sie zöge dann auch `<sharedSelectionEntries>` heran) — dann widersprechen
   sich zwei Szenarien, und das ist der Befund, nicht ein Anpassungsgrund.
2. **`effectiveMin: 0` in 02/03.** Die Daten sagen `min 0`; ein Minimum ist also
   **vorhanden** und hat den Wert 0. Meldet die Engine hier `null`, folgt sie
   der Konvention „min 0 = kein Minimum" — das ist eine eigene, dokumentierbare
   Entscheidung (vgl. `parent-repeat-item-count`, wo `effectiveMin: null` mit
   dem **Fehlen** jeder `min`-Grenze begründet ist) und wäre zu klären, nicht
   still zu übernehmen.
3. **`effectiveMax: 1` / `headroom: 0` / `isBlocked: true`.** Der Eintrag trägt
   **zwei** `max 1`-Grenzen mit verschiedenen Rahmen (`parent`, `force`). Beide
   liefern denselben Wert, die Aussage ist also unabhängig davon, welche der
   beiden der Slot ausweist.
4. **Die Slot-Adressierung.** `defId 2066-082d-a465-4baf` + `anchorKind
   occupied` muss die eine Wurzel-Auswahl eindeutig treffen; ein `frameDefId`
   ist bewusst nicht angegeben (wie beim Wurzel-Slot in
   `at-least-roster-border-patrols-gate`).
5. **EQF-R10 (`bound: 2`).** Belegt zugleich, dass `2066-082d-a465-4baf` nicht
   mit `4e15-0353-165f-5528` verwechselt wird — sonst stünde dort `bound: 1`.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort |
|---------|-----|---------|
| Prüfling „Border Patrol (500pts)" (`type="upgrade"`, `hidden="false"`) | `2066-082d-a465-4baf` | Mercenaries-`.cat` Z. 9374 (`<sharedSelectionEntries>` Z. 88–9525) |
| Untergrenze mit dem `equalTo`-Gatter (`min 0`, `scope="parent"`, `shared="true"`) | `1a97-1579-ab05-a6d7` | Mercenaries-`.cat` Z. 9382; `set 1` Z. 9385, Bedingung Z. 9387 |
| Obergrenze parent (`max 1`, als `absent` gepinnt) | `ac2c-85cb-fdd9-9fe0` | Mercenaries-`.cat` Z. 9380 |
| Obergrenze force (`max 1`, als `absent` gepinnt) | `73ff-2023-7f30-cefa` | Mercenaries-`.cat` Z. 9381 |
| Kategorie *Special list rules* (primär am Prüfling; ohne Grenzen/Modifikatoren) | `32f1-197f-d719-a393` (Link `145d-18ab-7467-6240`) | `.gst` Z. 210 / Mercenaries-`.cat` Z. 9377 |
| Kontingent „Standard (OG-AB)" (führt *Special list rules*) | `2bfa-e64a-7123-895f` (`categoryLink 0636-2809-bf71-0f02`) | O&G-`.cat` Z. 47 / Z. 50 |
| `catalogueLink` O&G → Mercenaries | `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` | O&G-`.cat` Z. 14916 |
| Kostenart Punkte (`limit::`-Ziel und `costLimit`-`typeId` aller Roster) | `ecfa-8486-4f6c-c249` | `.gst` `<costTypes>` |
| Kategorie *Core* / Pflicht `min 2` (feuernde Kontrolle) | `64bf-efb4-9978-26df` — Constraint `35c2-d478-392a-aeb1` | `.gst` Z. 372 / Z. 374 |
| Kategorie *Lord* / `max` mit Band „200–499" (als `absent` gepinnt) | `d024-d25b-a9b4-73b6` — Constraint `fda5-91c2-e17f-774c` | `.gst` Z. 220 / Z. 363, Modifikator Z. 234–245 |
| Kategorie *Special* / `max` mit Band „200–499" (als `absent` gepinnt) | `43cc-fc3f-35a7-8d03` — Constraint `16f0-6e5b-55d0-4102` | `.gst` Z. 434 / Z. 436 |
| Kategorie *Rare* / `max` (als `absent` gepinnt) | `e94b-6a54-8779-cd60` — Constraint `0a44-2d3f-adfe-f3a1` | `.gst` Z. 544 / Z. 546 |
| Kategorie *Characters* / `max` mit Band „200–499" (als `absent` gepinnt) | `7a1c-d611-c2dc-def1` — Constraint `c3c3-a80c-e026-200f` | `.gst` Z. 641 / Z. 644 |
| Kategorie *Heroes* / `max -1` unbegrenzt, modifikatorlos (als `absent` gepinnt) | `c16b-f319-2c62-2c12` — Constraint `7fca-63fb-63d2-9dad` | `.gst` Z. 366 / Z. 368 |
| Kategorie *General* / `min 1` (toleriert, nicht Gegenstand) | `a37e-7207-de6d-acb0` — Constraint `1077-7379-f142-f382` | `.gst` Z. 721 / Z. 724 |
| Engine-eigene Budget-Grenze (als `absent` gepinnt; 0 verplante Punkte) | `budget::ecfa-8486-4f6c-c249` | Kein Katalog-Constraint — Regel OGB-R2 des Szenarios [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) |
| „Border Patrols rules" — der **andere**, wurzelnahe Border-Patrol-Schalter (nicht Gegenstand) | `4e15-0353-165f-5528` | `.gst` Z. 17584 |
