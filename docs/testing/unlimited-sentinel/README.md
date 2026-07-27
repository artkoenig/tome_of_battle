# E2E-Regeln & Testkatalog: „minus eins" als deklarierte Unbegrenztheit (Sentinel)

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln,
Grenzen-IDs und Erwartungswerte (`actual`/`bound`) sind **ausschliesslich aus den
Katalogdaten** der *6th Definitive Edition* und aus der Formatspezifikation
abgeleitet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1)

## Worum es geht

Die Formatspezifikation legt den Wert fest, nicht die Engine:
`docs/battlescribe-data-format.md` §7.6 nennt fuer `constraint/@value`
ausdruecklich **„`-1.0` = unbegrenzt"**. Dieser Wert ist damit ein **Sonderzeichen
in der Deklaration** — nicht eine gewoehnliche Zahl, die man mit `actual`
vergleicht.

Entscheidend ist, **woher** der Wert kommt:

| Herkunft des Wertes | Bedeutung |
|---------------------|-----------|
| Die Grenze ist im Katalog mit `value="-1"` **deklariert** und kein Modifikator aendert sie. | keine Obergrenze |
| Ein Modifikator **setzt** die Grenze ausdruecklich auf `-1`. | ab dann keine Obergrenze |
| Der wirksame Wert entsteht aus einer **Rechnung** (`increment`/`set` auf der Grenze). | gewoehnliche Zahl — sie wird gegen `actual` gemessen |

Der Unterschied haengt an der Deklaration bzw. am Setz-Modifikator, **nicht** am
Ergebnis einer Rechnung.

> **Schreibweise.** Beide Notationen (`-1` und `-1.0`) sind laut Spezifikation
> gleichwertig. Im vorliegenden Fixture-Datensatz kommt **ausschliesslich `-1`**
> vor — eine Volltextsuche nach `"-1.` ueber alle fuenf Fixture-Dateien liefert
> null Treffer. Das Szenario stuetzt sich deshalb auf **keine** der beiden
> Schreibweisen: es nennt nur Grenzen-IDs und die daraus abgeleiteten
> `actual`/`bound`-Werte, nie den Rohtext der Datei.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **US-R1** | Eine Grenze, die von vornherein mit `-1` deklariert ist und von **keinem** Modifikator adressiert wird, ist dauerhaft unbegrenzt. Beliebig viele Auswahlen duerfen sie nicht ausloesen. | `.gst` → `categoryEntry "Heroes"` `c16b-f319-2c62-2c12` → `constraint id="7fca-63fb-63d2-9dad" type="max" value="-1" field="selections" scope="force" includeChildSelections="true"`. **Verifiziert:** die ID `7fca-63fb-63d2-9dad` kommt im gesamten Fixture-Verzeichnis **genau einmal** vor (naemlich in dieser Deklaration) — es existiert also kein `modifier field="7fca-…"`, der sie veraendern koennte. |
| **US-R2** | Ein Modifikator darf eine endliche Grenze ausdruecklich auf `-1` setzen; ab dann ist sie unbegrenzt — auch wenn ihr Basis- bzw. Rechenwert endlich (hier `0`) ist. | `Orcs and goblins (…).cat` → `selectionEntry "Orc Big 'Uns"` `eeb1-a6c4-b57e-f08c` → `constraint id="938b-15b1-f433-e0d5" type="max" value="0" field="selections" scope="roster" includeChildSelections="false"`; am selben Eintrag `modifier type="set" value="-1" field="938b-15b1-f433-e0d5"` mit `condition type="instanceOf" scope="force" childId="1821-fbd1-0d96-2d88"` (Armeeliste „Grimgor's 'Ardboyz (SoC)"). |
| **US-R3** | Dieselbe Grenze `938b-15b1-f433-e0d5` traegt ausserdem einen **Hochzaehl**-Modifikator: `modifier type="increment" value="1"` mit `repeat field="selections" scope="roster" childId="344f-77ef-7238-f157" value="1" repeats="1"`. Der wirksame Wert ist also `0 + (Anzahl Auswahlen der Kategorie „Orc boyz")`. Ohne solche Auswahlen bleibt die Grenze **0** — eine gewoehnliche Zahl, die feuert. | Katalog wie oben; Kategorie `344f-77ef-7238-f157` „Orc boyz" wird z. B. von `selectionEntry "Orc Boyz"` `ac23-b9d3-4046-23b7` per `categoryLink 61ca-d64b-4a52-c623` getragen. |
| **US-R4** | Eine mit `-1` deklarierte Grenze ist **nicht dauerhaft** unbegrenzt: sobald ein Modifikator ihr einen wirksamen Zahlenwert gibt, wird an dieser Zahl gemessen — nicht an „unbegrenzt". | `Orcs and goblins (…).cat` → `selectionEntry "Orc Boyz"` `ac23-b9d3-4046-23b7` → Modell `cef0-77ce-8158-32d4` → `constraint id="2115-87d4-2ead-6ba1" type="max" value="-1" field="selections" scope="parent"`; am selben Modell `modifier type="set" value="25" field="2115-87d4-2ead-6ba1"` mit `condition type="atLeast" value="1" scope="roster" childId="4e15-0353-165f-5528"` („Border Patrols rules", `.gst` `selectionEntry` `4e15-0353-165f-5528`). |

### Ableitung der Erwartungswerte

- **`bound`** ist der **wirksame** Wert der Grenze nach Anwendung der Modifikatoren,
  die das jeweilige Roster ausloest — bei einer unbegrenzten Grenze gibt es keinen
  Vergleichswert, deshalb erscheint sie dort in `absent` statt in `firing`.
- **`actual`** ergibt sich aus dem Roster-Aufbau im Bezugsrahmen der Grenze:
  - `938b-15b1-f433-e0d5` hat `scope="roster"` und `includeChildSelections="false"` →
    gezaehlt wird, wie oft `eeb1-a6c4-b57e-f08c` als Auswahl im Roster steht.
  - `2115-87d4-2ead-6ba1` hat `scope="parent"` → gezaehlt wird die `number` der
    Modell-Auswahl `cef0-77ce-8158-32d4` unterhalb der einen Einheit.
  - `7fca-63fb-63d2-9dad` zaehlt ein **Kategorie**-Ziel; nach der Ziel-Typ-Regel
    (`docs/battlescribe-data-format.md` §7.7) wird ein Kategorie-Ziel armeeweit
    aggregiert. Im Roster 01 sind das drei Auswahlen — die Zahl ist hier aber
    ohne Belang, weil die Grenze unbegrenzt ist.

---

## Nicht abgedeckt — und warum

| Fall | Status |
|------|--------|
| **Eine mit `-1` deklarierte Grenze, die zusaetzlich ein `increment` traegt** (also `-1 + n`). | **Im Fixture-Datensatz nicht vorhanden.** Nachgeprueft: alle `constraint`-Elemente mit `value="-1"` in `.gst` + vier `.cat` wurden erhoben und mit den `field`-Zielen **aller** `modifier type="increment"` (sowie `decrement`/`multiply`/`divide`) abgeglichen — die Schnittmenge ist leer. Die real vorhandenen Hochzaehl-Grenzen (`938b-15b1-f433-e0d5`, `186c-6345-5b25-5aa2`, `a177-82fc-0b76-5b73`, `28cd-8b7f-3d0f-1546`) sind saemtlich mit `0` deklariert, nicht mit `-1`. Die naechstliegende belegbare Aussage — „eine mit `-1` deklarierte Grenze, deren wirksamer Wert eine Zahl ist, wird an dieser Zahl gemessen" — pinnt Roster 05 ueber `2115-87d4-2ead-6ba1` (`set 25`) fest. Siehe „Offener Punkt" unten. |
| **Ein Modifikator zieht eine Grenze ins Negative** (z. B. `0 - 1`). | Bewusst **ausgeschlossen**: kein Katalog im Repo erzeugt diesen Fall, und synthetische Katalogdaten dafuer sind nach ADR-0033 nicht zulaessig. Der Fall gehoert in einen Modultest. |
| **Sichtbarkeit (`hidden`) der beteiligten Eintraege.** | Der Verletzungsbericht kodiert keine Verfuegbarkeit. „Orc Big 'Uns" wird per `modifier set hidden=true` in mehreren Armeelisten verborgen — **nicht** jedoch in „Standard (OG-AB)" (`2bfa-e64a-7123-895f`) und **nicht** in „Grimgor's 'Ardboyz" (`1821-fbd1-0d96-2d88`), den beiden hier verwendeten Listen. Das Szenario macht dazu **keine** Erwartungsaussage. |

---

## Testkatalog (E2E-Szenarien der Reinraum-Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + Orcs-and-Goblins-`.cat`. Format wie die uebrigen verifizierten Fixtures
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`).

> **Assertion-Fokus:** nur die genannten Grenzen-IDs. Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht, Mindestgroessen, Punktelimit) koennen zusaetzlich auftreten
> und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | Grenze von vornherein unbegrenzt | Armeeliste „Standard (OG-AB)", drei Einheiten der Kategorie „Heroes": Orc Bigboss, Goblin Bigboss, Goblin Shaman. | **US-R1:** `7fca-63fb-63d2-9dad` feuert **nicht** — die Grenze ist mit `-1` deklariert und wird von keinem Modifikator im Datensatz angefasst. | [`01-heroes-declared-unlimited.ros`](rosters/01-heroes-declared-unlimited.ros) |
| 02 | Gerechnete Grenze bleibt eine Zahl (Kontrolle zu 03) | Armeeliste „Standard (OG-AB)", **eine** Einheit „Orc Big 'Uns", **keine** Auswahl der Kategorie „Orc boyz". | **US-R3:** `938b-15b1-f433-e0d5` feuert mit `actual: 1`, `bound: 0` — das Hochzaehlen wiederholt sich null Mal, der Basiswert `0` bleibt stehen. | [`02-big-uns-computed-bound-fires.ros`](rosters/02-big-uns-computed-bound-fires.ros) |
| 03 | Modifikator setzt die Grenze auf minus eins | Armeeliste **„Grimgor's 'Ardboyz (SoC)"**, **zwei** Einheiten „Orc Big 'Uns", weiterhin **keine** „Orc boyz"-Auswahl. | **US-R2:** `938b-15b1-f433-e0d5` feuert **nicht**. Ohne den Setz-Modifikator waere die wirksame Grenze `0` und das Roster mit `actual: 2` unzulaessig — die Abwesenheit belegt also genau die Setzung auf „unbegrenzt". | [`03-big-uns-modifier-sets-unlimited.ros`](rosters/03-big-uns-modifier-sets-unlimited.ros) |
| 04 | Deklariert unbegrenzt, Modifikator inaktiv | Armeeliste „Standard (OG-AB)", eine Einheit „Orc Boyz" mit **26** Modellen, **ohne** „Border Patrols rules". | `2115-87d4-2ead-6ba1` feuert **nicht** — die Grenze ist mit `-1` deklariert, ihr einziger Modifikator (`set 25`) ist mangels „Border Patrols rules" nicht wirksam. | [`04-orc-boyz-declared-unlimited.ros`](rosters/04-orc-boyz-declared-unlimited.ros) |
| 05 | Wirksamer Wert ist eine Zahl — nicht „unbegrenzt" | Wie 04, zusaetzlich die Auswahl **„Border Patrols rules"** (`4e15-0353-165f-5528`). | **US-R4:** `2115-87d4-2ead-6ba1` feuert mit `actual: 26`, `bound: 25`. Dieselbe, mit `-1` deklarierte Grenze wird an ihrem **wirksamen** Wert gemessen. | [`05-orc-boyz-border-patrol-finite.ros`](rosters/05-orc-boyz-border-patrol-finite.ros) |

**Die Paare tragen die Aussage:** 02 ↔ 03 zeigen dieselbe Grenze einmal als Zahl
und einmal als „unbegrenzt" — der Unterschied ist allein der Setz-Modifikator.
04 ↔ 05 zeigen dieselbe, mit `-1` deklarierte Grenze einmal als „unbegrenzt" und
einmal als Zahl — der Unterschied ist allein der wirksame Wert. Wer `-1` am
Ergebnis statt an der Deklaration festmacht, bricht mindestens eines der beiden
Paare.

---

## Offener Punkt (Datenluecke, bewusst nicht erfunden)

Die Auftragsbeschreibung nennt fuer die dritte Auspraegung eine konkrete Stelle:
Grenze `ffea-b24a-0cdf-781e` in der Spielsystem-Datei, `max value="-1.0"` an
einem `categoryLink` fuer Kommandanten, mit `increment 1.0` je 1000 Punkten.
**Diese Stelle existiert im Fixture-Datensatz nicht:**

- `ffea-b24a-0cdf-781e` kommt in keiner der fuenf Fixture-Dateien vor.
- Die Schreibweise `-1.0` kommt in keiner der fuenf Fixture-Dateien vor.
- Die punktabhaengigen Kategorie-Grenzen der `.gst` sind **endlich** deklariert
  und werden ueber `set`-Modifikatoren mit Punkteband-Bedingungen gestaffelt —
  nicht ueber `-1` plus `increment`. Konkret: `categoryEntry "Lord"`
  `d024-d25b-a9b4-73b6` traegt `constraint id="fda5-91c2-e17f-774c" type="max"
  value="1"`, `categoryEntry "Core"` `64bf-efb4-9978-26df` traegt
  `constraint id="35c2-d478-392a-aeb1" type="min" value="2"`; beide werden nur
  per `modifier type="set"` je Punkteband veraendert.
- Die einzige Grenze mit einem `repeat` je 1000 Punkten ist
  `186c-6345-5b25-5aa2` („Extra Goblin Hero", `Orcs and goblins (…).cat`) — mit
  Basiswert **`0`**, nicht `-1`.

Das Muster „`-1` deklariert **und** hochgezaehlt" ist in diesem Datensatz also
nicht belegbar. Roster 05 haelt statt dessen den Teil der Regel fest, der belegt
ist: **eine mit `-1` deklarierte Grenze, deren wirksamer Wert eine Zahl ist, wird
an dieser Zahl gemessen und nicht als unbegrenzt gelesen.** Soll zusaetzlich das
Hochzaehlen **auf** einem `-1`-Basiswert festgehalten werden, braucht es einen
Katalog, der es enthaelt — oder einen Modultest, wie ihn das Geschwister-Slice
fuer den Negativ-Fall vorsieht.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| Force „Grimgor's 'Ardboyz (SoC)" | `1821-fbd1-0d96-2d88` |
| Kategorie „Heroes" (`.gst`) | `c16b-f319-2c62-2c12` |
| Grenze „Heroes max" — deklariert `-1`, ohne jeden Modifikator | `7fca-63fb-63d2-9dad` |
| Kategorie „Characters" (`.gst`) | `7a1c-d611-c2dc-def1` |
| SelectionEntry Orc Bigboss (Held) | `6279-4d0a-6dce-f2f3` |
| SelectionEntry Goblin Bigboss (Held) | `8c8f-3fba-e337-fd2f` |
| SelectionEntry Goblin Shaman (Held) | `554e-660d-0005-d122` |
| SelectionEntry „Orc Big 'Uns" | `eeb1-a6c4-b57e-f08c` |
| Grenze „Orc Big 'Uns max je Roster" — Basis `0`, `increment` je „Orc boyz", `set -1` unter Grimgor | `938b-15b1-f433-e0d5` |
| Modell „Big 'Uns" (Kind von „Orc Big 'Uns") | `0d44-66f5-eae1-bb16` |
| Kategorie „Orc boyz" (Zaehlziel des `repeat`) | `344f-77ef-7238-f157` |
| SelectionEntry „Orc Boyz" (Einheit) | `ac23-b9d3-4046-23b7` |
| CategoryLink „Orc boyz" an „Orc Boyz" | `61ca-d64b-4a52-c623` |
| Modell „Orc Boyz" | `cef0-77ce-8158-32d4` |
| Grenze „Orc-Boyz-Modelle max" — deklariert `-1`, `set 25` unter Border Patrols | `2115-87d4-2ead-6ba1` |
| Mindestgroesse „Orc Boyz" (10 Modelle, nur Kontext) | `158f-ed55-76f2-eba0` |
| SelectionEntry „Border Patrols rules" (`.gst`) | `4e15-0353-165f-5528` |
