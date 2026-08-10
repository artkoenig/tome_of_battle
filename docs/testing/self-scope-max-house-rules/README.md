# E2E-Regeln & Testkatalog: `scope="self"` an einer Max-Grenze (House rules unter „Allow Mercenaries")

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln,
IDs, Ist-Werte und Grenzen sind allein aus den Katalogdaten der *6th Definitive
Edition* und der Formatdokumentation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.5/§7.6/§8)
abgeleitet; die Roster-Form (direktes `entryId`, `entryLinkId=""`, verschachtelte
`selections` mit `number`) ist an den bestehenden Szenarien
[`set-primary-category-membership`](../set-primary-category-membership/README.md)
und [`violation-classification`](../violation-classification/README.md) verifiziert,
die denselben Trägereintrag auswählen.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — hier stehen **alle** hier geprüften Einträge
  und Grenzen (`sharedSelectionEntries`).
- Armee: `Ogre Kingdoms (6th definitive edition).cat` (`731d-5b13-2a92-5427`, rev 2)
  — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`; sie zieht den geteilten
  Eintrag als **Wurzel-`entryLink`** `254b-aa03-1b8c-90f8` herein und ist per
  `catalogueLink` `a067-78d5-50a2-affe` von `Mercenaries (…).cat`
  (`fc47-8392-a6c8-452a`) abhängig.

## Die gemessene Zelle

Gepinnt wird `constraint|max|selectionCount|self|s=true|ics=false|icf=false|pct=false`
— also eine **Höchstgrenze auf `field="selections"` mit `scope="self"`**,
`shared="true"`, `includeChildSelections="false"`. Das Szenario ist so gebaut, dass
in **jedem** Roster die parent-skopierte Schwestergrenze desselben Eintrags stumm
bleibt: das Paar „feuert / feuert nicht" misst damit den **`self`-Rahmen** und
sonst nichts.

## Aufbau im Katalog (`.gst`, Zeilen 2345–2398)

```
selectionEntry "Mercenaries and Regiments of Renown" (6a7d-7d85-8d7e-cbce)   ← Wurzel-Selektion der Force
  │   categoryLink "Special list rules" 32f1-197f-d719-a393 (primary)
  │   max 1 scope=parent  fae4-595f-7b39-1909 · max 1 scope=force 993f-eb11-5986-8b3e
  │   min 0 scope=parent  ee4d-e870-a60d-dae8 · min 0 scope=force 2d83-161b-9f18-1a31   (No-ops)
  ├ selectionEntry "Allow Regiments of Renown" (3d35-6b18-262f-6503)   max 1 scope=parent b536-105e-b1da-d5c5
  └ selectionEntry "Allow Mercenaries" (fda5-49b9-b74c-aaf4)
        │   max 1 field=selections scope=self   shared=true ics=false   ← 714b-5314-33d4-dd68  (die gemessene Zelle)
        │   max 1 field=selections scope=parent shared=true ics=false   ← 1df9-8159-156a-641f  (die Kontrollgrenze)
        ├ selectionEntry "House rule: All generic DoW are Special" (713c-28b1-0861-1ffd)  hidden="true"
        │     max 1 scope=parent 046e-1c8a-1c6d-ae5f
        └ selectionEntry "House rule: Category Upgrade" (698e-c660-5c99-d481)             hidden="true"
              max 1 scope=parent c522-d36c-d18d-c7ec
```

Damit hat der Grenzenträger „Allow Mercenaries" **genau zwei** direkte Kinder —
mehr kann sein `self`-Rahmen unter `includeChildSelections="false"` gar nicht
enthalten. Der Maximalwert des Zählers ist also 2, die Grenze 1: das Datenmodell
gibt exakt einen Verstoßfall her (Ist 2 / Grenze 1) und drei Erfüllungsfälle
(Ist 0 und zweimal Ist 1).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **SSM-R1** | Eine `max`-Grenze mit `scope="self"` macht die **Trägerselektion selbst** zum Zählrahmen: gezählt werden die Auswahlen **unterhalb** genau dieser Selektion. Unter „Allow Mercenaries" dürfen daher höchstens 1 Auswahl liegen. | `.gst` `selectionEntry "Allow Mercenaries"` `fda5-49b9-b74c-aaf4` → constraint **`714b-5314-33d4-dd68`** `type=max value=1 field=selections scope=self shared=true includeChildSelections=false`. Zählregel aus der Formatdoku §7.6: *„Gezählt werden die Auswahlen unterhalb des Trägers der Grenze, nicht der Träger selbst. Der `scope` sagt nur, in welchem Rahmen summiert wird."* Für `self` ist dieser Rahmen der Träger. |
| **SSM-R2** | `includeChildSelections="false"` zählt **nur die direkten Kinder** des Rahmens („just `scope`'s `field`"), nicht die ganze Tiefe. | Dieselbe constraint `714b-…`, Attribut `includeChildSelections="false"`; Formatdoku §7.6, Tabellenzeile `includeChildSelections`. **Im Datensatz nicht unterscheidbar** — siehe „Bewusst nicht geprüft" unten. |
| **SSM-R3** | Unter „Allow Mercenaries" liegen **genau zwei** wählbare direkte Kinder, beide `hidden="true"`. Zwei davon zugleich reißen SSM-R1 (Ist 2 / Grenze 1), eines oder keines nicht. | `.gst` Kinder von `fda5-…`: `713c-28b1-0861-1ffd` „House rule: All generic DoW are Special" (`hidden="true"`, `defaultAmount="0"`) und `698e-c660-5c99-d481` „House rule: Category Upgrade" (`hidden="true"`, `defaultAmount="0"`). Weitere Kinder gibt es nicht. |
| **SSM-R4** | **Max-Grenzen gelten unabhängig von der Sichtbarkeit.** Dass beide House rules `hidden="true"` tragen, setzt `714b-…` nicht aus. | Formatdoku §5.6/§8: *„Die Min-Grenzen einer effektiv versteckten Entität werden nicht validiert … **Max-Grenzen gelten unabhängig von der Sichtbarkeit**."* Beide Kinder tragen keinen `hidden`-Modifier — ihr `hidden="true"` ist statisch. |
| **SSM-R5** | Die **parent**-skopierte Schwestergrenze desselben Eintrags zählt etwas **anderes**: wie viele „Allow Mercenaries" unter dem Träger „Mercenaries and Regiments of Renown" stehen. Da dieser selbst per `max 1 scope=parent`/`scope=force` einmalig ist und jedes Roster hier genau **eine** „Allow Mercenaries" führt, bleibt sie durchweg stumm (Ist 1 bzw. 0). | `.gst` `fda5-…` → constraint **`1df9-8159-156a-641f`** `type=max value=1 field=selections scope=parent shared=true includeChildSelections=false`; Träger `6a7d-…` → `fae4-595f-7b39-1909` (max 1 parent) und `993f-eb11-5986-8b3e` (max 1 force). §7.6: `scope="parent"` vergleicht aufgelöste **Ziel-IDs**. |
| **SSM-R6** | Gezählt wird die **Stückzahl**, nicht die Knotenzahl: ein einziges Kind mit `number="2"` füllt den `self`-Rahmen ebenso auf 2. | Formatdoku §7.5 (Rechenregel: `number` geht in Kosten- **und** Constraint-Zählungen ein; der Evaluator liest `number` als absolute Gesamtstückzahl). Gleiche Konvention wie in [`army-standard-bearer`](../army-standard-bearer/README.md), Roster 03. |
| **SSM-R7** | „Allow Mercenaries" ist im Datensatz ein **Schalter**, kein Zählobjekt mit Kosten: er deckt die Kategorie „Mercenaries" auf. Das erklärt, warum seine Grenzen reine Deckel ohne Punktebezug sind. | `Mercenaries (…).cat` `categoryEntry "Mercenaries"` `b640-7e9c-3054-c1ce` → `modifier set hidden=true` mit `condition lessThan 1 selections scope=force childId="fda5-49b9-b74c-aaf4"`. Nur Kontext, **keine** geprüfte Zählregel. |

### Bewusst nicht geprüft

- **`includeChildSelections="false"` als solches (SSM-R2).** Die beiden
  House-rule-Einträge tragen **keine eigenen Kind-Einträge** (nur `constraints`,
  `comment` und `rules`) — der Datensatz gibt an dieser Stelle **keinen Enkel**
  her, dessen Mitzählen `false` von `true` unterscheiden würde. Ein Roster mit
  einem erfundenen Enkel wäre keine Ableitung aus den Daten mehr; deshalb pinnt
  dieses Szenario den **Rahmen** (`self`), nicht das Tiefen-Flag. Wer `ics` messen
  will, braucht einen Trägereintrag mit mindestens dreistufiger Kette.
- **`shared="true"` über mehrere Instanzen.** Der Träger `6a7d-…` ist per
  `max 1 scope=parent` **und** `max 1 scope=force` je Kontingent einmalig; eine
  zweite „Allow Mercenaries" im selben Rahmen ließe zwangsläufig die
  Kontrollgrenze `1df9-…` mitfeuern und würde die Messung des `self`-Rahmens
  verunreinigen. Ob `shared="true"` den `self`-Rahmen über mehrere Kontingente
  hinweg zusammenzieht, ist aus den erlaubten Quellen **nicht** entscheidbar
  (die Formatdoku beschreibt `shared` nur für die Zählung „aller Auswahlen dieses
  shared entry im Roster") und wird deshalb **nicht** behauptet.
- **Sichtbarkeit (`hidden`).** Dass die beiden House rules `hidden="true"` sind,
  ist **Verfügbarkeit**, keine zählende Schranke. Der Verletzungsbericht kodiert
  keine (Un-)Sichtbarkeit — analog zu VBL-R4/R5 in
  [`vampire-bloodlines`](../vampire-bloodlines/README.md). Erwartet wird hier
  **nur**, dass die Max-Grenze trotz `hidden` feuert (SSM-R4); ein eigener
  „hidden"-Befund wird **nicht** als feuernde Grenze erwartet.
- **Regeltexte (`rule`) der House rules.** Beide Einträge hängen nur einen
  Regeltext an (`e8cf-65f4-00e8-4b5f`, `9adc-93c2-ebbb-4972`); Regeltexte sind
  kein Bestandteil des Verletzungsberichts.

---

## Testkatalog

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle nutzen
dieselbe Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`, `costLimit` 1000 pts
und dieselbe Kette `6a7d-…` → `fda5-…`; variiert wird **allein**, was unter der
„Allow Mercenaries" liegt.

> **Assertion-Fokus:** nur die beiden genannten Constraint-IDs. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit, in Roster 06
> zusätzlich `046e-1c8a-1c6d-ae5f`) können auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Ist / Grenze im `self`-Rahmen | Erwartetes Ergebnis | Fixture |
|---|-----------|----------------|-------------------------------|---------------------|---------|
| 01 | Beide House rules (unzulässig) | „Allow Mercenaries" hält **beide** Kinder (`713c` + `698e`, je `number=1`). | **2 / 1** | **Verstoß gegen SSM-R1:** `714b-5314-33d4-dd68` feuert mit Ist 2 / Grenze 1. `1df9-8159-156a-641f` bleibt **stumm** (eine „Allow Mercenaries" unter dem Träger). | [`01-both-house-rules-self-max-fires.ros`](rosters/01-both-house-rules-self-max-fires.ros) |
| 02 | Eine House rule — DoW Special (legal) | Nur `713c-28b1-0861-1ffd`. | **1 / 1** | Keine Verletzung: `714b-…` **stumm**, obwohl das Kind `hidden="true"` ist (SSM-R4). `1df9-…` stumm. | [`02-single-house-rule-dow-special-silent.ros`](rosters/02-single-house-rule-dow-special-silent.ros) |
| 03 | Eine House rule — Category Upgrade (legal) | Nur `698e-c660-5c99-d481`. | **1 / 1** | Keine Verletzung. Gegenprobe zu 02: die 2 in Test 01 stammt aus der **Anzahl** der Kinder, nicht aus einem bestimmten Eintrag. | [`03-single-house-rule-category-upgrade-silent.ros`](rosters/03-single-house-rule-category-upgrade-silent.ros) |
| 04 | Keine House rule (Nullpunkt) | „Allow Mercenaries" ohne Kind. | **0 / 1** | Keine Verletzung. Belegt zugleich, dass der **Träger sich nicht selbst mitzählt** — sonst stünde hier Ist 1 und der Nullpunkt wäre nicht von Test 02 unterscheidbar. | [`04-no-house-rule-silent.ros`](rosters/04-no-house-rule-silent.ros) |
| 05 | Schwester-Schalter außerhalb des Rahmens (legal) | Träger `6a7d-…` hält **zwei** direkte Kinder (`3d35` + `fda5`), die „Allow Mercenaries" selbst nur **eines** (`713c`). | **1 / 1** | Keine Verletzung. **Rahmen-Abgrenzung:** würde `714b-…` im Rahmen des *Eltern*-Eintrags zählen, käme sie auf 2 und feuerte. `1df9-…` zählt weiterhin genau eine „Allow Mercenaries" → stumm. | [`05-sibling-switch-outside-self-frame-silent.ros`](rosters/05-sibling-switch-outside-self-frame-silent.ros) |
| 06 | Ein Kind mit `number=2` (unzulässig) | Nur `713c-…`, aber `number="2"`. | **2 / 1** | **Verstoß gegen SSM-R1 via SSM-R6:** `714b-…` feuert mit Ist 2 / Grenze 1 — der Rahmen summiert **Stückzahlen**, nicht Knoten. `1df9-…` stumm. (`046e-…` feuert zusätzlich, nicht behauptet.) | [`06-single-house-rule-number-two-self-max-fires.ros`](rosters/06-single-house-rule-number-two-self-max-fires.ros) |

**Warum 01 gegen 02–05 die Zelle isoliert:** Alle sechs Roster tragen dieselbe
Force, denselben Träger und dieselbe eine „Allow Mercenaries". Der einzige
Unterschied ist der Inhalt des `self`-Rahmens (0, 1, 1, 1, 2, 2). Die
Kontrollgrenze `1df9-…` sieht in allen sechs Rostern denselben Wert (1) und ist
überall als **absent** gepinnt — jede Meldung von ihr wäre also eine
Rahmen-Verwechslung und keine Datenlage.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Game System (WHFB 6th definitive) | `0d13-7737-ea86-4662` |
| Katalog „Ogre Kingdoms" / dessen `catalogueLink` auf „Mercenaries" | `731d-5b13-2a92-5427` / `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` |
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` |
| Wurzel-`entryLink` auf den Träger (Ogre Kingdoms) | `254b-aa03-1b8c-90f8` → `6a7d-7d85-8d7e-cbce` |
| „Mercenaries and Regiments of Renown" (geteilt, `.gst`) | `6a7d-7d85-8d7e-cbce` — max 1 parent `fae4-595f-7b39-1909`, max 1 force `993f-eb11-5986-8b3e`, min 0 `ee4d-e870-a60d-dae8` / `2d83-161b-9f18-1a31` |
| Kategorie „Special list rules" (primary am Träger, **ohne** eigene Grenzen) | `32f1-197f-d719-a393` (categoryLink `4cbe-48ad-8126-05f2`) |
| „Allow Mercenaries" (Grenzenträger) | `fda5-49b9-b74c-aaf4` |
| **Gemessene Grenze:** max 1 `field=selections` `scope=self` `shared=true` `ics=false` | **`714b-5314-33d4-dd68`** |
| **Kontrollgrenze:** max 1 `field=selections` `scope=parent` `shared=true` `ics=false` | **`1df9-8159-156a-641f`** |
| „House rule: All generic DoW are Special" (`hidden="true"`) | `713c-28b1-0861-1ffd` — eigene max 1 parent `046e-1c8a-1c6d-ae5f`, Regel `e8cf-65f4-00e8-4b5f` |
| „House rule: Category Upgrade" (`hidden="true"`) | `698e-c660-5c99-d481` — eigene max 1 parent `c522-d36c-d18d-c7ec`, Regel `9adc-93c2-ebbb-4972` |
| „Allow Regiments of Renown" (Schwester-Schalter, Test 05) | `3d35-6b18-262f-6503` — max 1 parent `b536-105e-b1da-d5c5` |
| Kategorie „Mercenaries" (wird von `fda5-…` aufgedeckt — nur Kontext) | `b640-7e9c-3054-c1ce` (`Mercenaries (…).cat`) |
| Kostenart „pts" (Roster-`costLimit`) | `ecfa-8486-4f6c-c249` |
