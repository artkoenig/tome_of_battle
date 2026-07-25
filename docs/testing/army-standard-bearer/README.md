# E2E-Regeln & Testkatalog: Armee-Standartenträger (Battle Standard Bearer)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln unten
sind **ausschließlich aus den Katalogdaten** abgeleitet — der
Spielsystemdatei (`.gst`) und dem Armee-Katalog (`.cat`) der *6th Definitive
Edition*, die auch die neue Engine (`src/evaluator/`) als E2E-Fixtures nutzt.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (id `4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f`

Der „Armee-Standartenträger" ist im Spielsystem als **shared** `selectionEntry`
**„Battle Standard Bearer"** definiert (id `e9ad-f1ce-aebf-6d23`, Typ `upgrade`)
und über eine gleichnamige **Kategorie** `2ef7-3efe-a448-423f` geführt. Die
Armee-Kataloge hängen ihn per `entryLink` an einzelne Helden-Charaktere.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **BSB-R1** | Eine Armee darf **höchstens einen** Standartenträger enthalten. | `.gst` shared entry `e9ad…` → constraint **`082b-067c-b983-c393`** `type=max value=1 scope=roster includeChildSelections=true`; zusätzlich Kategorie `2ef7…` → constraint **`2a1d-03a1-b48c-64ad`** `type=max value=1 scope=force`. |
| **BSB-R2** | **Ein einzelner Charakter** trägt die Standarte höchstens **einmal**. | shared entry `e9ad…` → constraint **`01a5-106d-f6e8-560b`** `type=max value=1 scope=parent`; Kategorie `2ef7…` → constraint **`6935-5f06-39d4-5f45`** `type=max value=1 scope=parent`. |
| **BSB-R3** | Die Aufwertung kostet **25 Punkte** (0 Bann-/Zauberwürfel). | shared entry `e9ad…` → `<cost name="pts" value="25"/>`. |
| **BSB-R4** | Nur **Helden-Charaktere, die den `entryLink` anbieten**, können Träger werden (O&G: die *Bigboss*-Varianten, „Extra Goblin Hero", der Held „Grom"). **Lords** (z. B. Orc Warboss `fde7-8ba8-08c8-7504`) und **Helden ohne den Link** (z. B. Orc Shaman `e4cf-8043-5127-dd26`) bieten ihn nicht an. | Vorhandensein/Fehlen von `entryLink targetId="e9ad…"` je `selectionEntry` (Typ `unit`/`model`). **Nicht als Constraint prüfbar** — siehe Hinweis unten. |
| **BSB-R5** | Der Träger darf **eine** Magische Standarte führen — **zu beliebigen Kosten** (kein Punktelimit) —, darf **dann aber keine anderen magischen Gegenstände** wählen. **Nur bei Orcs & Goblins modelliert**, nicht in Ogre/VC. | (a) BSB-`entryLink` bringt geschachtelt die Gruppe **„Magical Standard"** (`0406-bb04-6134-2ee9`) mit `constraint max=1 scope=parent`; diese Gruppe hat **kein** Punkt-Constraint → beliebiger Wert. (b) Je O&G-Bigboss trägt die Gruppe **„Magic Items"** einen `modifier set field="hidden" value="true"` mit `condition atLeast 1 selections scope=unit childId="0406…"` → wählt der Charakter eine Standarte, wird die **gesamte Magic-Items-Gruppe ausgeblendet**. Gruppen-IDs: Orc `85e5-c24a-91be-160c`, Black Orc `604e-93d6-661c-994a`, Savage Orc `36db-8fa8-21cd-dc7b`. Die 50-Pkt-Obergrenze (`3b44-4b91-94d6-83b1`) sitzt auf der Magic-Items-Gruppe, **nicht** auf der Standarte. |
| **BSB-R6** | **Ausnahme „Border Patrols":** Ist im Force die Selektion **„Border Patrols rules"** (`4e15-0353-165f-5528`) vorhanden, wird die Force-Obergrenze der BSB-Kategorie auf **0** gesetzt → **kein** Standartenträger erlaubt. | Kategorie `2ef7…` → `modifier type=set value=0 field="2a1d-03a1-b48c-64ad"` mit `condition atLeast 1 … childId="4e15-0353-165f-5528" scope=force`. |

**Hinweis zu BSB-R4 (bewusst kein Fixture):** Die Eignung eines Charakters ist
in den Daten **nicht als Constraint** hinterlegt, sondern nur dadurch, ob der
Editor den `entryLink` anbietet. Ein Roster, das den BSB unter einen
ungeeigneten Charakter hängt, verletzt daher **keine** maschinell prüfbare
Regel — die Engine zählt ihn schlicht als 1 Standartenträger. Diese Grenze ist
ein Black-Box-**Befund**, kein Testfall.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Jedes Szenario liefert ein **fertiges Roster** als Engine-Eingabe unter
[`rosters/`](rosters/). Alle Roster referenzieren dieselben Definitive-Edition-
Katalogdateien (`.gst` + O&G-`.cat`, plus die per `catalogueLink` benötigte
`Mercenaries`-`.cat`). Kosten sind bewusst weggelassen — die Engine leitet sie
aus dem Katalog ab (siehe Issue 04).

> **Assertion-Fokus:** Jeder Test prüft **nur** die genannten BSB-Constraint-IDs.
> Andere Armeeaufbau-Diagnosen (fehlender General, Core-Mindestzahl,
> Punktelimit) können in den Minimal-Rostern zusätzlich auftreten und sind für
> das jeweilige BSB-Szenario **ohne Belang**.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Ein legaler Standartenträger | `.gst` + O&G-`.cat` (+ Mercenaries) | Ein **Orc Bigboss** mit **einer** BSB-Aufwertung. | **Keine** BSB-Verletzung: die Armee-Obergrenze (1) und die Charakter-Obergrenze (1) sind erfüllt. | [`01-bsb-single-legal.ros`](rosters/01-bsb-single-legal.ros) |
| 02 | Zwei Standartenträger in einer Armee | wie 01 | **Orc Bigboss** *und* **Goblin Bigboss**, **jeder** mit BSB. | **Verletzung von BSB-R1:** die Armee-Obergrenze `082b…` (Ist 2, Grenze 1) **und** die Force-Kategorie-Obergrenze `2a1d…` (Ist 2, Grenze 1) schlagen an. | [`02-bsb-two-in-army-illegal.ros`](rosters/02-bsb-two-in-army-illegal.ros) |
| 03 | Standarte zweimal an einem Charakter | wie 01 | **Ein** Orc Bigboss, BSB-Aufwertung mit `number=2`. | **Verletzung von BSB-R2:** Charakter-Obergrenze `01a5…`/`6935…` (Ist 2, Grenze 1); zusätzlich schlägt die Armee-Obergrenze `082b…` an (Ist 2, Grenze 1). | [`03-bsb-twice-on-one-character-illegal.ros`](rosters/03-bsb-twice-on-one-character-illegal.ros) |
| 04 | Border-Patrols-Ausnahme | wie 01 | **Ein** Orc Bigboss mit BSB **und** die Force-Selektion **„Border Patrols rules"**. | **Verletzung von BSB-R6:** Der Modifikator setzt die Force-Kategorie-Obergrenze `2a1d…` auf **0**, daher ist der eine BSB unzulässig (Ist 1, Grenze 0). Die Roster-Obergrenze `082b…` bleibt unverändert (1) und **nicht** verletzt. | [`04-bsb-border-patrols-illegal.ros`](rosters/04-bsb-border-patrols-illegal.ros) |
| 05 | Grundlinie: kein Standartenträger | wie 01 | **Ein** Orc Bigboss **ohne** BSB. | **Keine** BSB-Diagnose: eine Obergrenze ohne zugehörige Untergrenze erzeugt bei Ist 0 keinen Befund. | [`05-no-bsb-baseline.ros`](rosters/05-no-bsb-baseline.ros) |
| 06 | Nur magische Standarte (legal) | wie 01 | **Ein** Orc Bigboss als BSB mit **einer** magischen Standarte („War Banner"), **kein** weiteres Magie-Item. | **Keine** Verletzung: die Standarte ist zulässig (max 1 erfüllt); sie unterliegt **keiner** Punkt-Obergrenze. | [`06-bsb-magic-standard-only-legal.ros`](rosters/06-bsb-magic-standard-only-legal.ros) |
| 07 | Standarte **und** weiteres Magie-Item (unzulässig) | wie 01 | **Ein** Orc Bigboss als BSB mit magischer Standarte **und** zusätzlich „Sword of Might" aus der Magic-Items-Gruppe. | **Verletzung von BSB-R5:** Weil die Standarte gewählt ist, wird die „Magic Items"-Gruppe per Modifikator ausgeblendet → das zusätzliche Item ist **unzulässig/nicht verfügbar**. **Achtung Mechanik:** Die Sperre ist als `hidden=true` (Verfügbarkeit) modelliert, **nicht** als zählende Schranke — dieser Test hält fest, ob der Evaluator eine verfügbarkeitsbedingte Unzulässigkeit überhaupt meldet (analog zum Befund BSB-R4). | [`07-bsb-magic-standard-plus-item-illegal.ros`](rosters/07-bsb-magic-standard-plus-item-illegal.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| Orc Bigboss (Held, bietet BSB) | `6279-4d0a-6dce-f2f3`, BSB-Link `4280-e373-746b-438f` |
| Goblin Bigboss (Held, bietet BSB) | `8c8f-3fba-e337-fd2f`, BSB-Link `c312-e4d9-02b1-65c5` |
| Orc Warboss (Lord, **kein** BSB) | `fde7-8ba8-08c8-7504` |
| Orc Shaman (Held, **kein** BSB) | `e4cf-8043-5127-dd26` |
| BSB shared entry / Kategorie | `e9ad-f1ce-aebf-6d23` / `2ef7-3efe-a448-423f` |
| „Border Patrols rules" | `4e15-0353-165f-5528` |
| Magical-Standard-Gruppe (via BSB-Link `9165…`) | `0406-bb04-6134-2ee9` |
| War Banner (Standarten-Option) | Link `c4cd-b9c1-77d9-7b57` → `f327-567f-ef99-0403` |
| Magic-Items-Gruppe Orc Bigboss (ausgeblendet bei Standarte) | `85e5-c24a-91be-160c` |
| Sword of Might (Magie-Item-Option) | Link `c06b-fd39-882b-a3c4` → `8c56-9be1-c4a9-5afe` |

Der `entryId` einer per Link importierten Aufwertung folgt der Roster-Konvention
**`<entryLinkId>::<targetId>`** (z. B. `4280-e373-746b-438f::e9ad-f1ce-aebf-6d23`).
Alle IDs wurden gegen die Katalogdateien als auflösbar verifiziert.
