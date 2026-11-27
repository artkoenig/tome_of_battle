# E2E-Regeln & Testkatalog: `atLeast` mit `scope="self"` und `childId="any"` (Experimental-Warnung der War Hydra)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind aus
den Katalogdaten der *6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) abgeleitet;
das Eingabeformat der Roster folgt den bereits verifizierten Fixtures
(direktes `entryId`, `entryGroupId` an einer Auswahl aus einer Gruppe, der
Verweis im `entryLinkId` — siehe [„Bindung der Auswahl"](#bindung-der-auswahl)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Dark Elves (6th definitive edition).cat`
  (`d4c0-4f0c-4a89-40fc`, rev 1) — Kontingent **„Standard (DE-AB)"**
  `26bc-729f-a188-f285` (+ die per `catalogueLink` `4301-a1ec-729b-b898`
  geforderte `Mercenaries`-`.cat` `fc47-8392-a6c8-452a`)
- Punktelimit aller Roster: 2000 pts (`costLimit` der pts-Kostenart
  `ecfa-8486-4f6c-c249`)

## Worum es geht

Die Gruppe **„War Hydras of Naggaroth"** (`7f4e-4b7b-fbc4-a138`, Dark-Elves-`.cat`
Z. 3031) traegt einen Meldungs-Modifikator (Z. 3200–3212):

```xml
<modifier type="add" value="{this} is an experimental rule that requires permission from your opponen!
Check &quot;Allow experimental rules?&quot; to disable this message." field="warning">
  <conditionGroups>
    <conditionGroup type="and">
      <conditions>
        <condition type="atLeast"  value="1" field="selections" scope="self"  childId="any"                  shared="true" includeChildSelections="true"/>
        <condition type="lessThan" value="1" field="selections" scope="force" childId="e28d-f278-f209-63bd"  shared="true" includeChildSelections="true"/>
      </conditions>
    </conditionGroup>
  </conditionGroups>
</modifier>
```

Gegenstand ist die **erste** Bedingung. `scope="self"` macht den **Traeger der
Abfrage** zu ihrem eigenen Zaehlrahmen: gezaehlt wird, was der tragende Knoten
selbst haelt. Traeger ist hier ein `selectionEntryGroup`, also zaehlen **die aus
dieser Gruppe gewaehlten Mitglieder** — und nichts sonst: weder der Bestand der
umschliessenden Einheit noch der des Kontingents oder des Rosters. `childId="any"`
schraenkt nicht auf eine bestimmte Definition ein („irgendeine Auswahl"),
`includeChildSelections="true"` nimmt deren verschachtelte Auswahlen mit (die
drei Mitglieder haben keine).

Das ist die genaue Entsprechung zur Zaehlregel des Formats: eine Grenze an einer
Gruppe zaehlt **ihre Mitglieder**, nicht die Gruppe
([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) — *„which entity should
sum up all `field`'s values of descendant selections of this constraint's parent
entry"*). Die Gruppe belegt das an sich selbst: ihre eigene Grenze
`c36b-249d-d86e-b3f2` (`max 1`, `field="selections"`, `scope="parent"`, Z. 3033)
ist genau die „waehle hoechstens eine Variante"-Grenze ueber denselben drei
Mitgliedern.

Die **zweite** Bedingung ist der Schalter „Allow experimental rules?“; sie wird
hier nur als Konstante mitgefuehrt bzw. in Roster 04 bewusst umgelegt, damit die
`and`-Verknuepfung nachweisbar ist. Sie selbst ist Gegenstand des
Schwester-Szenarios
[`at-least-force-toggle-gate`](../at-least-force-toggle-gate/README.md).

### Bindung der Auswahl

- **Gruppenmitglieder** tragen zusaetzlich zu `entryId` das Attribut
  `entryGroupId="7f4e-4b7b-fbc4-a138"` — die Gruppe selbst ist im Roster kein
  eigener Knoten, ihre Mitglieder haengen unter dem Traeger-`selectionEntry`
  `3bfb-7e21-80b0-3b13`. (Dieselbe Form wie in
  [`group-max-increment-on-choice`](../group-max-increment-on-choice/README.md).)
- **„Allow experimental rules?"** (Roster 04) nennt die Bedingung als `childId`
  den **Wurzel-`entryLink`** `e28d-f278-f209-63bd` des Dark-Elves-Katalogs, nicht
  dessen Ziel. Die Auswahl benennt deshalb **beides**: das Ziel
  `8b76-92c4-23f9-54b1` im `entryId` und den Verweis im `entryLinkId`. Damit
  greift die Zaehlung unabhaengig davon, ob der Rahmen ueber die Verweis-Id oder
  ueber die aufgeloeste Ziel-Id gebildet wird.
- **„Two Hand Weapons"** (Roster 03) analog: Ziel `36a8-7bbb-d204-0314`
  (`.gst` Z. 999) im `entryId`, der Verweis `c3ca-c3ce-f6be-f830`, der die
  `min 1`-Grenze `8e9f-6150-7d65-248b` traegt, im `entryLinkId`.

### Warum das Kontingent „Standard (DE-AB)"

Die Einheit `424f-9a77-2a02-4cec` traegt einen `modifier type="set" value="true"
field="hidden"` mit einer `conditionGroup type="or"`, deren vier `instanceOf`-
Bedingungen genau die uebrigen vier Dark-Elves-Kontingente nennen
(`77cd-dafb-16af-93c0`, `4b5b-aebb-1526-91bb`, `ff5e-f712-03ce-bb85`,
`5013-f9f4-e03b-94d5`; Z. 3256–3268) — sowie einen zweiten hidden-Modifikator,
der auf „Border Patrols rules" `4e15-0353-165f-5528` gated ist (Z. 3275–3279).
Im gewaehlten Kontingent greift keiner von beiden. `field="name"`-Modifikatoren
gibt es weder an der Einheit noch am Upgrade noch an der Gruppe; der wirksame
Anzeigename der Gruppe ist damit ihr Katalog-`name` **„War Hydras of
Naggaroth"**.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ASA-R1** | **`scope="self"` zaehlt den Bestand des Traegers.** Haelt die Gruppe `7f4e-4b7b-fbc4-a138` mindestens **eine** Auswahl und fuehrt das Kontingent **kein** „Allow experimental rules?", liegt an der Gruppe **genau eine** Autor-Meldung an: Schweregrad **warning**, Text aus dem `value`-Attribut. | Dark-Elves-`.cat` Z. 3200–3212: `modifier type="add" … field="warning"` mit `conditionGroup type="and"` aus `condition type="atLeast" value="1" field="selections" scope="self" childId="any" shared="true" includeChildSelections="true"` und `condition type="lessThan" value="1" … scope="force" childId="e28d-f278-f209-63bd"`. |
| **ASA-R2** | **Gegenprobe zum Traeger-Rahmen.** Bei sonst **identischem** Aufbau (gleiches Kontingent, gleiche Einheit, gleiches Pflicht-Upgrade, weiterhin kein Schalter) und **leerer** Gruppe steht die Zaehlung auf 0, `atLeast 1` haelt nicht, und an der Gruppe liegt **keine** Autor-Meldung an (`authorMessages: []` — eine vollstaendige Aussage ueber den Slot). Damit unterscheidet allein die Semantik der Bedingung die beiden Faelle. | dasselbe Element; die Gruppe hat **keine** `min`-Grenze, ein leerer Zustand ist also regelkonform (nur `c36b-249d-d86e-b3f2`, `max 1`, Z. 3033). |
| **ASA-R3** | **Der Rahmen ist die Gruppe, nicht die Einheit / das Kontingent / das Roster.** Haelt die umschliessende Einheit weitere Auswahlen (Pflicht-Upgrade + zwei „Beastmaster Apprentices" mit je einer Waffe) und die Gruppe **keine**, bleibt die Meldung aus. Ein Rahmen `unit`, `force` oder `roster` wuerde diese Geschwister mitzaehlen (`childId="any"`, `includeChildSelections="true"`) und die Meldung ausloesen. | Geschwister des Gruppentraegers: `selectionEntry id="d78e-d405-73e7-d3f5" name="Beastmaster Apprentices"` (Z. 3223) unter derselben Einheit; die Gruppe haengt dagegen unter `3bfb-7e21-80b0-3b13` (Z. 2997). |
| **ASA-R4** | **Die zweite Bedingung ist ein echtes UND.** Ist ein Gruppenmitglied gewaehlt **und** fuehrt das Kontingent „Allow experimental rules?", schweigt die Meldung. Die self/any-Bedingung allein loest sie also nicht aus. | `condition type="lessThan" value="1" field="selections" scope="force" childId="e28d-f278-f209-63bd"` (Z. 3207) gegen `entryLink id="e28d-f278-f209-63bd" targetId="8b76-92c4-23f9-54b1" defaultAmount="1"` (Z. 10168). |
| **ASA-R5** | **Eine Mindestbedingung wird von einem Ueberlauf nicht falsch.** Haelt die Gruppe **zwei** Mitglieder, feuert ihre eigene Grenze `c36b-249d-d86e-b3f2` mit Ist 2 gegen Grenze 1 — die Meldung liegt trotzdem weiterhin **genau einmal** an (`atLeast 1` ist bei 2 wahr, und der Traeger des Modifikators ist die Gruppe, nicht das Mitglied). | `constraint type="max" value="1" field="selections" scope="parent" id="c36b-249d-d86e-b3f2"` (Z. 3033); Mitglieder `af9a-6364-8ab3-efea` (Z. 3036) und `86e7-cf9a-d4af-8b81` (Z. 3130). |
| **ASA-R6** | **`{this}` wird durch den Anzeigenamen des Traegers ersetzt** — hier also durch den **Gruppennamen** „War Hydras of Naggaroth", denn der Modifikator haengt am `selectionEntryGroup`. Die rohe Fassung mit `{this}` darf **nicht** erscheinen. | Konvention aus [`author-message-tokens`](../author-message-tokens/README.md) (AMT-R1/R2); Traegername: `selectionEntryGroup name="War Hydras of Naggaroth"` (Z. 3031), ohne jeden `field="name"`-Modifikator. |

### Zeilenumbruch im `value`-Attribut — und wie der erwartete Text daraus folgt

Der Meldungstext steht in einem **Attribut** und enthaelt dort einen echten
Zeilenumbruch (Dark-Elves-`.cat` Z. 3201/3202). Die Datei verwendet reines LF
(0 `CR`-Treffer). Zwei Festlegungen bestimmen daraus den erwarteten Wortlaut:

1. XML normalisiert in **Attributwerten** jedes `#xD`/`#xA`/`#x9` zu einem
   **Leerzeichen** (XML 1.0, *Attribute-Value Normalization*). Alle Dateien des
   Formats sind XML ([§1](../../battlescribe/overview.md#1-überblick-was-ist-bsdata)).
2. Die Formatdoku bestaetigt das indirekt: eine `rule` ist *„die **einzige**
   mehrzeilige Textentitaet — Zeilenumbrueche im `<description>` bleiben
   erhalten"* ([§7.4](../../battlescribe/building-blocks/profile-and-rule.md#74-rule)). Ein
   Attributwert ist keine solche Entitaet.

Erwarteter Wortlaut nach Aufloesung von `&quot;` und des Tokens:

```
War Hydras of Naggaroth is an experimental rule that requires permission from your opponen! Check "Allow experimental rules?" to disable this message.
```

Der Tippfehler „opponen!" bleibt **so stehen** — Katalogtext ist Katalogtext,
keine Prosa.

> **Restrisiko, offen benannt.** Diese eine Assertion (`messages[].text` in
> Roster 01) ruht auf der XML-Normalisierung, nicht auf einer ausdruecklichen
> Aussage der Projekt-Formatdoku. Sie steht deshalb **nur in Roster 01**; Roster
> 05 pinnt dieselbe Meldung ohne `text` (ueber Herkunft, Anker, Schweregrad und
> Anzahl), und alle Schweige-Roster pinnen ueber den **Anker** statt ueber den
> Text — diese Aussagen sind von der Normalisierung unabhaengig. Zusaetzlich
> fordert Roster 01 `count: 0` fuer die **rohe** Fassung in **beiden**
> Normalisierungen (mit Leerzeichen und mit `\n`), damit „Token aufgeloest" nicht
> versehentlich dadurch gruen wird, dass die gesuchte Variante gar nicht
> existiert.

### Byte-Genauigkeit der behaupteten Texte

Katalogtexte dieser Datensaetze enthalten stellenweise geschuetzte Leerzeichen
(U+00A0). Jeder hier behauptete Baustein wurde deshalb mit einem Suchmuster aus
**ausschliesslich gewoehnlichen** Leerzeichen gegen die Fixture-Dateien geprueft:

| Behaupteter Baustein | Geprueftes Muster | Treffer |
|----------------------|-------------------|---------|
| Meldung, Zeile 1 | `value="{this} is an experimental rule that requires permission from your opponen!` (Zeilenende) | 1 (Dark-Elves-`.cat`) |
| Meldung, Zeile 2 | `to disable this message." field="warning">` | 1 (Dark-Elves-`.cat`) |
| Gesamttext | `is an experimental rule that requires permission from your opponen!` | 1 im gesamten Fixture-Satz |
| Zeilenenden | Suche nach `\r` in der Dark-Elves-`.cat` | 0 (reines LF) |

---

## Herleitung der Bedingungen je Roster

Die Tabelle ist die Begruendung der Erwartung, nicht selbst eine Assertion:

| Roster | Auswahlen der Gruppe `7f4e…` | 1. Bedingung `atLeast 1 / self / any` | Auswahl `e28d…` im Kontingent | 2. Bedingung `lessThan 1 / force` | `and` | Wirkung |
|--------|------------------------------|----------------------------------------|-------------------------------|-----------------------------------|-------|---------|
| 01 | 1 (Veteran) | haelt (1 ≥ 1) | 0 | haelt (0 < 1) | wahr | Warnung an der Gruppe |
| 02 | 0 | haelt **nicht** (0 < 1) | 0 | haelt | falsch | keine Meldung |
| 03 | 0 (Einheit haelt 5 Auswahlen) | haelt **nicht** — Geschwister zaehlen im Rahmen `self` nicht mit | 0 | haelt | falsch | keine Meldung |
| 04 | 1 (Veteran) | haelt | 1 | haelt **nicht** (1 < 1 ist falsch) | falsch | keine Meldung |
| 05 | 2 (Veteran + Royal) | haelt (2 ≥ 1) | 0 | haelt | wahr | Warnung an der Gruppe, **einmal** |

### Zaehlende Grenzen der Umgebung — je Roster erklaert

Alle folgenden Ids stehen im Manifest, entweder unter `firing` (mit Ist/Grenze)
oder unter `absent`:

| Grenze | Deklaration | 01 | 02 | 03 | 04 | 05 |
|--------|-------------|----|----|----|----|----|
| `a3ce-55af-2de8-23be` — Einheit „War Hydra" | `max 1`, `selections`, `scope=parent` (Z. 2988) | Ist 1 → still | 1 | 1 | 1 | 1 |
| `f210-5b8b-86c7-9466` — Punktebudget der Einheit | `max -1` (= unbegrenzt, [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint)), `field=pts`, `scope=parent` (Z. 2989); der `set 125`-Modifikator ist auf „Border Patrols rules" gated und greift nicht | still | still | still | still | still |
| `547a-41b7-dff9-d382` / `656d-017e-a719-4a57` — Pflicht-Upgrade „War Hydra" | `min 1` / `max 1`, `scope=parent` (Z. 3219/3220) | Ist 1 → beide still | 1 | 1 | 1 | 1 |
| `c36b-249d-d86e-b3f2` — Gruppe „War Hydras of Naggaroth" | `max 1`, `scope=parent` (Z. 3033) | Ist 1 → still | 0 | 0 | 1 | **Ist 2 → feuert (Grenze 1)** |
| `cf55-5fd5-ebc5-f6fd` / `24c5-418f-a665-89ca` — Veteran / Royal, je `max 1` `scope=parent` (Z. 3132/3038) | | Ist 1 → still | 0 | 0 | 1 | je 1 → still |
| `a75b-49a6-1dde-c444` — „Beastmaster Apprentices" | `min 2`, `scope=parent` (Z. 3225) | **Ist 0 → feuert (Grenze 2)** | feuert | Ist 2 → still | feuert | feuert |
| `d4f4-51a7-906f-0c42` — dieselbe Einheit | `max 2`, `scope=parent` (Z. 3226) | Ist 0 → still | still | Ist 2 → still | still | still |
| `8e9f-6150-7d65-248b` — Verweis „Two Hand Weapons" | `min 1`, `scope=parent`, **am Verweis** `c3ca-c3ce-f6be-f830` (Z. 3240) | — | — | Ist 1 je Apprentice → still | — | — |
| `b302-93b6-3d1d-13d6` — „Allow experimental rules?" | `max 1`, `scope=force` (`.gst` Z. 1838) | — | — | — | Ist 1 → still | — |

Die Roster 01, 02, 04 und 05 verzichten bewusst auf die „Beastmaster
Apprentices": ihre `min 2` ist die einzige Grenze, die dadurch feuert, sie ist
sichtbar (`hidden="false"`) und damit gueltig zu pruefen, und der Verzicht haelt
die Roster auf das Notwendige beschraenkt. Roster 03 braucht sie ohnehin, weil
genau sie den Rahmen fuellen, den `scope="self"` **nicht** sieht.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fuenf laufen
gegen `.gst` + Dark-Elves-`.cat` (+ Mercenaries); es gibt keinen Dataset-Override.

> **Assertion-Fokus:** die genannten Grenzen-Ids, der Gruppen-Slot und die
> Autor-Meldung an ihm. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht,
> Punktelimit, Kategorie-Slots) treten zusaetzlich auf und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Traeger haelt eine Auswahl → Warnung | War Hydra mit Pflicht-Upgrade und **einer** Veteran-Variante, **ohne** „Allow experimental rules?". | **ASA-R1/R6:** An der Gruppe liegt genau **eine** Autor-Meldung an, Schweregrad **warning**, mit **„War Hydras of Naggaroth"** anstelle des Tokens. Die rohe Fassung kommt **nullmal** vor. Der Gruppen-Slot meldet Stand 1 bei Hoechstmass 1. | [`01-veteran-hydra-warning-fires.ros`](rosters/01-veteran-hydra-warning-fires.ros) |
| 02 | Gegenprobe: Traeger leer | Derselbe Aufbau **ohne** die Gruppenauswahl. | **ASA-R2:** An der Gruppe liegt **keine** Autor-Meldung an (`[]`); Stand 0 bei Hoechstmass 1. | [`02-group-empty-warning-silent.ros`](rosters/02-group-empty-warning-silent.ros) |
| 03 | Rahmen besetzt, Traeger leer | Einheit mit Pflicht-Upgrade **und** zwei Beastmaster Apprentices (je mit Waffe); Gruppe leer. | **ASA-R3:** weiterhin **keine** Meldung — die Geschwister der Gruppe zaehlen in ihrem Rahmen nicht mit. Die `min 2`/`max 2` der Apprentices schweigen jetzt. | [`03-frame-populated-group-empty-silent.ros`](rosters/03-frame-populated-group-empty-silent.ros) |
| 04 | Zweites Konjunkt umgelegt | Aufbau von 01 **plus** „Allow experimental rules?" im Kontingent. | **ASA-R4:** **keine** Meldung, obwohl die Gruppe ihr Mitglied fuehrt — die beiden Bedingungen sind ein UND. | [`04-experimental-toggle-warning-silent.ros`](rosters/04-experimental-toggle-warning-silent.ros) |
| 05 | Ueberlauf im Traeger | Aufbau von 01 **plus** einer zweiten Variante (Royal). | **ASA-R5:** Die Gruppengrenze feuert (Ist 2, Grenze 1) — und die Warnung liegt **weiterhin genau einmal** an der Gruppe an. | [`05-two-hydra-variants-group-max-fires.ros`](rosters/05-two-hydra-variants-group-max-fires.ros) |

---

## Was dieses Szenario bewusst NICHT behauptet

- **`self` gegen `parent` ist an dieser Stelle nicht trennbar.** Der Elternknoten
  der Gruppe ist das Upgrade `3bfb-7e21-80b0-3b13`, und dessen **einziger**
  Kind-Container ist genau diese Gruppe (Z. 2997–3214). Ein `scope="parent"`
  wuerde hier dieselbe Menge zaehlen wie `scope="self"`; die Katalogdaten geben
  am Traeger nichts her, was beide trennen koennte. Getrennt werden hier
  `self` von **`unit`**, **`force`** und **`roster`** (Roster 03). Die Gruppe
  selbst belegt die Deckungsgleichheit: ihre eigene Grenze
  `c36b-249d-d86e-b3f2` zaehlt mit `scope="parent"` genau ihre Mitglieder.
- **Die `min`-Grenzen von „Allow experimental rules?"** (`.gst` Z. 1839/1840:
  `badf-a1a1-372c-9baf`, `scope=force`, und `d67f-4b65-a832-1e1b`,
  `scope=parent`, beide `min 0`) werden von je einem `set 1`-Modifikator
  angehoben, sobald das Kontingent **irgendeine** Auswahl der Kategorie
  „Experimental rules" `4fed-b911-e6e0-927b` fuehrt (`.gst` Z. 1855–1866). Genau
  diese Kategorie vergibt das Pflicht-Upgrade `3bfb-7e21-80b0-3b13` per
  `categoryLink fc40-7563-596c-0b7c` (Z. 3216) — **jedes** War-Hydra-Roster ohne
  Schalter loest sie also aus. Das ist eine reale Nebenfolge der Katalogdaten,
  aber nicht Gegenstand dieses Szenarios: sie steht in **keinem** Roster unter
  `firing` oder `absent`.
- **`authorMessages` im Faehigkeits-Datensatz bei token-behaftetem Text.** Der
  Manifest-Vertrag beschreibt `capabilities[].authorMessages[].text` als
  „Katalogtext", `messages[].text` dagegen ausdruecklich als „Katalogtext,
  Text-Tokens wie `{this}` durch den effektiven Namen ersetzt". Ob beide
  Projektionen denselben Aufloesungsstand fuehren, ist offen (dokumentierte
  Luecke in [`author-message-tokens`](../author-message-tokens/README.md)).
  `authorMessages` wird hier deshalb **nur** dort behauptet, wo die Liste **leer**
  ist (Roster 02/03/04).
- **Sichtbarkeit und Profile.** Die hidden-Modifikatoren der Einheit (Z. 3256–3279)
  und die Profil-/Regelunterschiede der drei Hydra-Varianten sind **keine**
  zaehlenden Grenzen und erscheinen deshalb nicht als feuernde Limits. Sie werden
  hier nur zur Wahl des Kontingents herangezogen.
- **`shared="true"` der Bedingung.** Ob die Zaehlung ueber alle Instanzen eines
  geteilten Eintrags oder je Verweis-Instanz laeuft, ist mit diesem Aufbau nicht
  trennbar: die Gruppe kommt im Datensatz genau **einmal** vor (kein
  `entryLink type="selectionEntryGroup"` auf `7f4e-4b7b-fbc4-a138`), es gibt also
  nie zwei Instanzen desselben Traegers.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Element) |
|---------|-----|---------------------------|
| Kontingent „Standard (DE-AB)" | `26bc-729f-a188-f285` | Dark-Elves-`.cat` → `<forceEntries>` (Z. 10081) |
| Rare-Einheit „War Hydra" | `424f-9a77-2a02-4cec` | Dark-Elves-`.cat` → Wurzel-`<selectionEntries>` (Z. 2986) |
| Pflicht-Upgrade „War Hydra" (Traeger der Gruppe, Traeger der Kategorie „Experimental rules") | `3bfb-7e21-80b0-3b13` | Dark-Elves-`.cat` (Z. 2997); `categoryLink fc40-7563-596c-0b7c` (Z. 3216) |
| **Gruppe „War Hydras of Naggaroth"** (Traeger der self/any-Abfrage und der Meldung) | `7f4e-4b7b-fbc4-a138` | Dark-Elves-`.cat` (Z. 3031); `<modifiers>` Z. 3200–3212 |
| Eigene Grenze der Gruppe | `c36b-249d-d86e-b3f2` (`max 1`, `selections`, `scope=parent`) | Dark-Elves-`.cat` (Z. 3033) |
| Mitglied „Royal War Hydra" (+ eigene `max 1`) | `af9a-6364-8ab3-efea` (+ `24c5-418f-a665-89ca`) | Dark-Elves-`.cat` (Z. 3036/3038) |
| Mitglied „Spellsthirster War Hydra" (nicht verwendet) | `d687-3810-b689-e16f` | Dark-Elves-`.cat` (Z. 3083) |
| Mitglied „Veteran War Hydra" (+ eigene `max 1`) | `86e7-cf9a-d4af-8b81` (+ `cf55-5fd5-ebc5-f6fd`) | Dark-Elves-`.cat` (Z. 3130/3132) |
| Grenzen des Pflicht-Upgrades | `656d-017e-a719-4a57` (`max 1`) / `547a-41b7-dff9-d382` (`min 1`) | Dark-Elves-`.cat` (Z. 3219/3220) |
| Einheit „Beastmaster Apprentices" (+ `min 2` / `max 2`) | `d78e-d405-73e7-d3f5` (+ `a75b-49a6-1dde-c444` / `d4f4-51a7-906f-0c42`) | Dark-Elves-`.cat` (Z. 3223–3227) |
| Verweis „Two Hand Weapons" (+ `min 1` am Verweis) → Ziel | `c3ca-c3ce-f6be-f830` (+ `8e9f-6150-7d65-248b`) → `36a8-7bbb-d204-0314` | Dark-Elves-`.cat` (Z. 3238–3242) / `.gst` (Z. 999) |
| Grenzen der Einheit | `a3ce-55af-2de8-23be` (`max 1`) / `f210-5b8b-86c7-9466` (`max -1` pts) | Dark-Elves-`.cat` (Z. 2988/2989) |
| Wurzel-`entryLink` „Allow experimental rules?" (die `childId` der zweiten Bedingung) → Ziel | `e28d-f278-f209-63bd` → `8b76-92c4-23f9-54b1` | Dark-Elves-`.cat` (Z. 10168) / `.gst` (Z. 1836) |
| Grenzen des Schalters (nur `b302…` behauptet) | `b302-93b6-3d1d-13d6` (`max 1`, `scope=force`); nicht behauptet: `badf-a1a1-372c-9baf`, `d67f-4b65-a832-1e1b` | `.gst` (Z. 1837–1840, Modifikatoren Z. 1855–1866) |
| Kategorie „Experimental rules" (ohne eigene Grenzen) | `4fed-b911-e6e0-927b` | `.gst` → `<categoryEntries>` (Z. 209) |
| Kategorie „Rare" (Slot der Einheit; nicht behauptet) | `e94b-6a54-8779-cd60` (Grenze `0a44-2d3f-adfe-f3a1`, punkteskaliert) | `.gst` (Z. 544–547) |
| Nicht gewaehlte Kontingente, die die Einheit ausblenden wuerden | `77cd-dafb-16af-93c0`, `4b5b-aebb-1526-91bb`, `ff5e-f712-03ce-bb85`, `5013-f9f4-e03b-94d5` | Dark-Elves-`.cat` (Z. 3256–3268 / 10096–10149) |
| `catalogueLink` Dark Elves → Mercenaries | `4301-a1ec-729b-b898` → `fc47-8392-a6c8-452a` | Dark-Elves-`.cat` (Z. 10152) |
