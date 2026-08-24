# E2E-Regeln & Testkatalog: `decrement` auf eine Kostenart — der Blood-Dragon-Rabatt auf Casting Dice

**Rolle:** Black-Box-Test (kein Blick in den Quellcode der Engine). Alle Regeln,
IDs und Erwartungswerte sind **ausschliesslich** aus den Katalogdaten des
**upstream**-Fixture-Satzes (`src/tests/__fixtures__/whfb6/`) und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
(§7.5/§7.6/§7.7) abgeleitet. Die Roster-Form folgt der an genau diesem Satz und
genau dieser Einheit bereits verifizierten Gestalt (direktes `entryId`,
`entryLinkId=""`, verschachtelte `selections` mit `number`) aus
[`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md).

- Spielsystem: `Warhammer Fantasy Battle 6th edition.gst`
  (`6d8e-38d9-3c69-febf`, rev 8) — einziges Kontingent: `forceEntry`
  **„Standard "** `7d9d-6c8d-4ea0-b7ad` (`.gst:61`; das Schluss-Leerzeichen im
  Namen steht so im Katalog). Kostenart **„ Casting Dice"**
  `fcec-2340-6368-a2ba` (`.gst:8`, `defaultCostLimit="-1.0"`; das
  Anfangs-Leerzeichen im Namen steht so in der `.gst`, während die `.cat` ihre
  `<cost>`-Zeilen `name="Casting Dice"` schreibt — gerechnet wird ohnehin über
  die `typeId`, nie über den Namen, §3.1).
- Armeebuch: `Vampire Counts.cat` (`ea4b-9294-3427-1fc1`, rev 10,
  `gameSystemId="6d8e-38d9-3c69-febf"`, `gameSystemRevision="8"`).
- **Keine** weitere `.cat`: der upstream-Vampire-Counts-Katalog trägt **kein**
  `<catalogueLinks>` (0 Treffer im ganzen Satz), anders als die Definitive
  Edition mit ihrer Mercenaries-Abhängigkeit.

> **Ein Satz, nicht zwei.** Dieses Szenario läuft gegen den **upstream**-Satz.
> Die Definitive Edition modelliert dieselbe Einheit anders; ein Manifest nennt
> immer die Dateien **eines** Satzes und mischt nie.

## Worum es geht

Ein `<modifier type="decrement" …>` kann als `field` — wie sein Zwilling `set`
— eine **Kostenart-Id** tragen
([§7.5](../../battlescribe-data-format.md#75-cost--cost-type) /
[§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)).
Dann **senkt** er die Kosten **seines Trägers** in genau dieser Kostenart um
seinen `value`, solange seine Bedingung hält. Hält sie nicht, bleibt der
**hingeschriebene** `<cost>`-Wert stehen. Anders als `set` (dort gepinnt:
[`set-cost-value-force-gate`](../set-cost-value-force-gate/README.md), SCV-R1)
ist er kein Ersatz, sondern eine **Differenz** — und die Roster dieses Szenarios
sind so gebaut, dass genau dieser Unterschied messbar wird.

In-World: eine Zauberstufe unter einem **Blood-Dragon**-Vampir kostet **einen
Casting Die weniger** als dieselbe Zauberstufe unter jeder anderen Blutlinie.

```
selectionEntry "Vampire Lord"  b77b-88d5-5e80-e178  (unit, 285 pts, 0 Casting Dice)
  ├ selectionEntryGroup "Bloodline"     01b8-338b-6b92-e37f   min 1 / max 1 (scope=parent)
  │    ├ "Blood Dragon"  0158-ed16-cbbf-6a78  → categoryLink 85db-… → Kategorie 4cae-a20e-8374-b6cb
  │    │     └ "Full plate armour" 64f1-879e-d9d4-7d78  (Pflicht, min 1)
  │    ├ "Strigoi"       ef7a-5896-8856-076b  → categoryLink 261b-… → Kategorie bf30-4ff0-a4d8-3909
  │    └ Von Carstein / Necrach / Lahmia
  └ selectionEntryGroup "Wizard Level"  b8ff-7e47-2614-1ecd   min 1 / max 1 (scope=parent)
       ├ "Wizard level 2"  42d9-cebe-18d5-cdbd
       │     <cost name="Casting Dice" typeId="fcec-2340-6368-a2ba" value="2.0"/>   ← geschrieben
       │     <modifier type="decrement" field="fcec-2340-6368-a2ba" value="1.0">    ← Gate: 4cae… unter parent
       └ "Wizard level 3"  649a-8bc1-fb66-ed73
             <cost name="Casting Dice" typeId="fcec-2340-6368-a2ba" value="3.0"/>   ← geschrieben
             <modifier type="decrement" field="fcec-2340-6368-a2ba" value="1.0">    ← wortgleich
```

Das Gate im Wortlaut (`Vampire Counts.cat:1877-1881`, wortgleich `:1894-1898`):

```xml
<modifier type="decrement" field="fcec-2340-6368-a2ba" value="1.0">
  <conditions>
    <condition field="selections" scope="parent" value="0.0" percentValue="false"
               shared="true" includeChildSelections="true" includeChildForces="false"
               childId="4cae-a20e-8374-b6cb" type="greaterThan"/>
  </conditions>
</modifier>
```

---

## Der Rahmen der Bedingung: `scope="parent"` ist der Vampir, nicht die Gruppe

Die vom Auftrag angemerkte Frage — reicht diese Bedingung bis zur Blutlinie
**unterhalb** des Vampirs? — ist an den Daten und der Formatspezifikation
entscheidbar, und die Antwort ist **ja**. Die Begründung, Schritt für Schritt:

1. **Der Rahmen ist eine Auswahl, keine Gruppe.** Eine `.ros` kennt nur
   `force → selection → selection …`
   ([§4](../../battlescribe-data-format.md#4-das-objektmodell-im-überblick):
   *„In einer Roster spiegelt sich das als `Roster → Force[] → Selection[]`
   (rekursiv) wider"*). Ein `selectionEntryGroup` hat im Roster-Baum **kein**
   Gegenstück — die gewählte Option hängt direkt unter der Einheit (so schreiben
   es auch alle verifizierten Fixtures dieses Verzeichnisses). Die Elternauswahl
   des Trägers „Wizard level 2" ist deshalb der **Vampire Lord**.
2. **Der Zähler steigt zu allen Nachfahren des Rahmens ab.**
   `includeChildSelections="true"` heisst laut
   [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat):
   *„werden auch **unterhalb** des Scope-Ziels verschachtelte Auswahlen
   mitgezählt, nicht nur dessen direkte Kinder"*. Die Blutlinie ist ein
   **direktes Kind** des Vampirs und damit erst recht erfasst.
3. **Gezählt wird ein Kategorie-Ziel.** `childId="4cae-a20e-8374-b6cb"` ist ein
   `categoryEntry` desselben Katalogs (`:12`); die Blutlinie „Blood Dragon"
   trägt sie per `categoryLink` `85db-e156-f433-69e1` (`:1604`). Der Vergleich
   `greaterThan value="0"` hält also genau dann, wenn unter dem Vampir
   mindestens eine Blood-Dragon-Auswahl steht.
4. **Die Gegenlesart macht den Modifikator unerreichbar.** Läse man `parent` als
   *die Gruppe* „Wizard Level", könnte unter ihr nie eine Blutlinie stehen — der
   `decrement` wäre in **jedem** baubaren Roster toter Code. Die Datenlage
   spricht dagegen: derselbe Katalog stellt diese Frage in dieser Bauform
   dreizehnmal, und die Nachbarszenario-Analyse desselben Elements liest sie
   ebenso (siehe unten).

Der **Kontrast** zu den Merkmals-Modifikatoren derselben Einheit ist der
eigentliche Witz der Datenlage und in
[`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md)
(CISI-R1…R4) ausführlich gepinnt: dort steht die Clan-Kategorie im **`scope`**
(`scope="4cae-a20e-8374-b6cb" childId="model"`), der Rahmen ist damit ein
**Vorfahre** — und der löst nie auf, weil die Blutlinie immer *unter* dem
Vampir steht. Jenes Szenario schreibt über genau die hier benutzte Stelle:

> „Dort zählt `scope="parent"` **einschliesslich verschachtelter Auswahlen** die
> Blood-Dragon-Kategorie unter dem Vampir — und **trifft**. Bei den
> Merkmals-Modifikatoren am `infoLink` hat der Autor Rahmen und Ziel
> vertauscht."

Dieses Szenario ist damit die **positive** Hälfte desselben Befundes: dieselbe
Frage, richtig herum kodiert, wirkt — und zwar auf die Kosten.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **DCB-R1** | **`decrement` auf eine Kostenart senkt um `value`.** Hält die Bedingung, ist die Kostenart des Trägers *geschriebener Wert − `value`*. „Wizard level 2" kostet dann **1** statt 2 Casting Dice. | VC-`.cat` → `selectionEntry "Wizard level 2"` **`42d9-cebe-18d5-cdbd`** (`:1875`, `type="upgrade"`): `<cost name="Casting Dice" typeId="fcec-2340-6368-a2ba" value="2.0"/>` (`:1888`) und `<modifier type="decrement" field="fcec-2340-6368-a2ba" value="1.0">` (`:1877`). Semantik von `decrement` auf ein numerisches Feld: [§7.7-Tabelle](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). |
| **DCB-R2** | **Das Gate ist „hat *dieser* Vampir die Blutlinie Blood Dragon?"** — `scope="parent"` (die Elternauswahl = die Einheit), `includeChildSelections="true"` (Nachfahren zählen mit), `childId="4cae-a20e-8374-b6cb"` (Kategorie-Ziel), `type="greaterThan" value="0"`. | `condition` in `:1879`. Kategorie `4cae-a20e-8374-b6cb` = `categoryEntry` „Blood Dragon" (`:12`); getragen wird sie vom Blutlinien-Upgrade `0158-ed16-cbbf-6a78` (`:1602`) per `categoryLink` `85db-e156-f433-69e1` (`:1604`). Herleitung des Rahmens: Abschnitt oben, [§4](../../battlescribe-data-format.md#4-das-objektmodell-im-überblick) + [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat); Präzedenz CISI-R1…R4. |
| **DCB-R3** | **Hält das Gate nicht, bleibt der geschriebene Wert unangetastet.** Unter jeder anderen Blutlinie — hier **Strigoi** `ef7a-5896-8856-076b` (Kategorie `bf30-4ff0-a4d8-3909`, `:1765`) — kostet „Wizard level 2" die geschriebenen **2** Casting Dice. Es gibt keine zweite Quelle: der Eintrag trägt **genau einen** Modifikator, und der ist dieser. | `:1876-1882` vollständig gelesen: `<modifiers>` enthält genau ein `<modifier>`; danach folgen `<constraints>` (`5c3a-0288-a6ed-6884`, `max 1 scope=parent`) und `<costs>`. Strigoi trägt **nur** `bf30…`, nie `4cae…` (`:1763-1766`). |
| **DCB-R4** | **Der Abzug wird nicht vervielfacht.** Beide Kosten-`decrement` tragen **kein** `<repeats>`; der Betrag ist fest 1, unabhängig von der Zahl der Blood-Dragon-Auswahlen unter dem Vampir. | `:1876-1882` und `:1893-1899`: Kind des Modifikators ist ausschliesslich `<conditions>`. [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) (`repeat`: *„bewirkt, dass der Modifier **mehrfach** angewendet wird"*) — ohne `repeat` also einmal. |
| **DCB-R5** | **Zweiter Zeuge, anderer Ausgangswert.** „Wizard level 3" `649a-8bc1-fb66-ed73` trägt den **wortgleichen** Modifikator bei geschriebenen **3** Casting Dice → **2** unter Blood Dragon. Das trennt „senke um 1" von „setze auf 1". | VC-`.cat` `:1892-1908`: `<cost name="Casting Dice" … value="3.0"/>` (`:1905`), `<modifier type="decrement" field="fcec-2340-6368-a2ba" value="1.0">` (`:1894`) mit zeichengleicher `condition` (`:1896`). |
| **DCB-R6** | **Dritter Zeuge, andere Einheit:** dieselbe Bauform steht in der Wizard-Level-Gruppe des **Vampire Count** — „Wizard level 1" `3c1a-3350-04ae-7a3f` (geschrieben **1** Casting Die → **0** unter Blood Dragon) und „Wizard level 2" `c2b8-e61d-9a73-0b21` (geschrieben 2). *Korrektur zur Aufgabenstellung:* `3c1a…` hängt **nicht** unter dem Vampire Lord, sondern unter dem Vampire Count. | VC-`.cat` `:2302-2342`: Gruppe „Wizard Level" `7ab1-d9dc-6124-443f` (`defaultSelectionEntryId="3c1a-3350-04ae-7a3f"`, `min 1` `19ba-de18-6ad7-2825` / `max 1` `436d-44fa-86cf-bf42`) innerhalb von `selectionEntry "Vampire Count"` `6822-0110-a7c9-cbb0` (`:1921-2353`). Modifikatoren `:2310` und `:2327`, zeichengleich zu `:1877`. |
| **DCB-R7** | **Der gesenkte Wert ist es, mit dem weitergerechnet wird.** Jede Summe über die Kostenart benutzt die gesenkten Kosten. Beobachtbar ist das an der **engine-eigenen Budget-Regel** `budget::fcec-2340-6368-a2ba`; die Grenze ist der `<costLimit>`-Wert der Roster. | Messgröße `rosterBudget` und Grenz-Id `budget::<costType-Id>` sind aus den Daten festgenagelt in [`violation-classification`](../violation-classification/README.md) (VCC-R6) und [`set-cost-value-force-gate`](../set-cost-value-force-gate/README.md) (SCV-R5). Kostenart: `.gst:8` → `costType id="fcec-2340-6368-a2ba" name=" Casting Dice"`. |
| **DCB-R8** | **Kein `constraint` des Satzes misst diese Kostenart.** Im gesamten upstream-Satz gibt es **keinen einzigen** `constraint` mit `field="fcec-2340-6368-a2ba"` oder `field="limit::fcec-2340-6368-a2ba"` — weder in der `.gst` noch in einer `.cat`. Die gesenkten Kosten sind deshalb **nicht** als feuernde Katalog-Grenze zu beobachten, sondern **nur** über die Budget-Regel aus DCB-R7. | Vollständige Fundstellenprüfung `constraint … field="(limit::)?fcec-2340-6368-a2ba"` über `src/tests/__fixtures__/whfb6/`: 0 Treffer. Die 802 Vorkommen der Id verteilen sich auf `<costType>`, `<cost>` und die fünf Kosten-`modifier` der VC-`.cat`. |
| **DCB-R9** | **Die Summe ist sauber, weil alles andere 0 Casting Dice kostet.** Vampire Lord `0` (`:1917`), Handweapon `6abf…` `0` (`:1351`), Lord hero choice extra cost `42c5…` `0` (`:1366`), Blood Dragon `0158…` `0` (`:1759`), Full plate armour `64f1…` `0` (`:1622`), Strigoi `ef7a…` `0` (`:1779`), Vampire Count `0` (`:2350`), dessen Handweapon `7b76…` `0` (`:1968`), dessen Blood Dragon `60a4…` `0` (`:2132`) und dessen Full plate armour `1e5a…` `0` (`:2090`), Strigoi des Count `30ba…` `0` (`:2152`). Die Roster-Summe ist damit **exakt** die wirksame Casting-Dice-Zahl der gewählten Zauberstufe(n). | Die genannten `<costs>`-Blöcke, je Zeile geprüft. |
| **DCB-R10** | **Nur die fünf Kosten-Modifikatoren der VC-`.cat` berühren diese Kostenart überhaupt** — die vier `decrement` der Zauberstufen (`:1877`, `:1894`, `:2310`, `:2327`) und ein `increment 1` am **Vampire Thrall** `e37b-c827-99ac-b706` (`:2356`), gegated auf `childId="32d0-a151-94a3-aa54"`. Kein Thrall steht in einem dieser Roster, der `increment` ist damit ohne Belang. | Fundstellenprüfung `modifier … field="fcec-2340-6368-a2ba"` in der VC-`.cat`: genau 5 Treffer, Zeilen wie genannt. |

### Die Bloodline-Wahl selbst ist keine Kostenaussage

Blutlinien-Upgrades kosten in diesem Katalog **nichts** (pts 0, Casting Dice 0,
Dispel Dice 0) — der Unterschied zwischen den Roster-Paaren stammt also
**ausschliesslich** aus dem `decrement`, nicht aus dem Preis der Blutlinie.
Ebenso ist das Pflicht-Kind „Full plate armour" der Blood-Dragon-Blutlinie
kostenneutral. Das ist der Grund, warum ein Paar „gleiche Zauberstufe, andere
Blutlinie" die Wirkung des Modifikators **isoliert**.

---

## Wie `actual` / `bound` hier zustande kommen

Die Tabelle ist die **Herleitung aus den Katalogdaten**, nicht selbst eine
Assertion. `bound` ist der `<costLimit>`-Wert der jeweiligen Roster, `actual` die
Casting-Dice-Summe aus DCB-R1/R3/R5/R6/R9.

| Roster | Vampire | Blutlinie(n) | Zauberstufe(n) | greift der `decrement`? | wirksame Casting Dice | Summe = `actual` | `costLimit` = `bound` | Budget-Regel |
|--------|---------|--------------|----------------|--------------------------|------------------------|------------------|------------------------|--------------|
| 01 | Lord | Strigoi | level 2 (geschr. 2) | **nein** | 2 | **2** | 1 | feuert, `delta` −1 |
| 02 | Lord | **Blood Dragon** | level 2 (geschr. 2) | **ja** | 2 − 1 = 1 | **1** | 1 | feuert **nicht** |
| 03 | Lord | **Blood Dragon** | level 2 (geschr. 2) | **ja** | 1 | **1** | 0 | feuert, `delta` −1 |
| 04 | Lord | Strigoi | level 3 (geschr. 3) | **nein** | 3 | **3** | 2 | feuert, `delta` −1 |
| 05 | Lord | **Blood Dragon** | level 3 (geschr. 3) | **ja** | 3 − 1 = 2 | **2** | 2 | feuert **nicht** |
| 06 | Lord | **Blood Dragon** | level 3 (geschr. 3) | **ja** | 2 | **2** | 1 | feuert, `delta` −1 |
| 07 | Lord + Count | **Blood Dragon** / Strigoi | level 2 / level 1 (geschr. 1) | **nur beim Lord** | 1 + 1 | **2** | 1 | feuert, `delta` −1 |
| 08 | Lord + Count | **Blood Dragon** / **Blood Dragon** | level 2 / level 1 | **bei beiden** | 1 + 0 | **1** | 1 | feuert **nicht** |

**Die drei Klammern.**

- **Kreuzung (01 gegen 02):** dasselbe Budget, derselbe Aufbau, dieselbe
  Zauberstufe — nur die Blutlinie wechselt, und die Grenze kippt. Ohne den
  `decrement` müssten beide feuern.
- **Untere Klammer (02 gegen 03):** Roster 02 allein sagte bloss „höchstens 1".
  Mit Roster 03 (Budget 0) ist die Summe **exakt 1** — der Abzug ist also genau
  1 und nicht 2. Ein `costLimit` von `0` ist eine gewöhnliche Grenze; der
  Sentinel für „unbegrenzt" wäre `-1`
  ([§7.6, Sentinel-Kasten](../../battlescribe-data-format.md#76-constraint):
  `-1` gilt u. a. *„am eingestellten Roster-`costLimit`"*).
- **Dieselbe Klammer ohne jede Null (04/05/06):** Summe > 1 und ≤ 2, also exakt
  2. Der zweite Zeuge trägt die Kernaussage damit **ohne** die Null-Grenze —
  fiele Roster 03 aus, bliebe der Befund vollständig.
- **Rahmen-Klammer (07 gegen 08):** identischer Aufbau, identisches Budget,
  geändert ist allein die Blutlinie des **zweiten** Vampirs. Der Rabatt folgt
  dem Vampir, nicht der Armee.

### Was eine Fehl-Lesart produzieren würde

| Fehl-Lesart | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 |
|---|---|---|---|---|---|---|---|---|
| `decrement` wird gar nicht angewandt (geschriebener Wert bleibt) | still | **2 > 1 — fällt auf** | still (1 gegen 2 verfehlt) | still | **3 > 2 — fällt auf** | still | still | **2 > 1 — fällt auf** |
| `decrement` wirkt wie `set 1` | still | still | still | still | **1 ≤ 2, aber Roster 06 zeigt 1 ≤ 1 — fällt auf** | **fällt auf** | still | still |
| Abzug doppelt gerechnet (`repeat` unterstellt) | still | **0 ≤ 0, Roster 03 schweigt — fällt auf** | **fällt auf** | still | still | **1 ≤ 1, Roster 06 schweigt — fällt auf** | still | still |
| Bedingung hält immer (Gate ignoriert) | **1 ≤ 1, Roster 01 schweigt — fällt auf** | still | still | **2 ≤ 2, Roster 04 schweigt — fällt auf** | still | still | **1 ≤ 1 — fällt auf** | still |
| Rahmen kontingent-/rosterweit statt Elternauswahl | still | still | still | still | still | still | **1 ≤ 1, Roster 07 schweigt — fällt auf** | still |
| Rahmen = die Gruppe „Wizard Level" (Blutlinie unerreichbar) | still | **2 > 1 — fällt auf** | **fällt auf** | still | **fällt auf** | still | still | **fällt auf** |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle acht laufen
gegen **denselben** Datensatz (`.gst` + `Vampire Counts.cat`) und **dasselbe**
Kontingent `7d9d-6c8d-4ea0-b7ad`.

**Die Pflicht-Kinder beider Vampire sind in jedem Roster besetzt**, damit ausser
der Kostenrechnung nichts wackelt:

| Einheit | Pflicht | Grenze | im Roster |
|---|---|---|---|
| Vampire Lord `b77b…` | „Handweapon" `6abf-e08f-6480-cd58` | `min 1` `d830-89e1-7573-92e7` | 1 × |
| | „Lord hero choice extra cost" `42c5-9ebc-7493-89ef` | `min 1` `0780-5a76-9d51-e9ea` | 1 × |
| | Gruppe „Bloodline" `01b8-338b-6b92-e37f` | `min 1` `e251-f353-704b-836a` / `max 1` `6c3a-e4ae-3667-440f` | genau 1 (die Variable) |
| | Gruppe „Wizard Level" `b8ff-7e47-2614-1ecd` | `min 1` `9c66-4f74-2201-82ec` / `max 1` `efbf-d87a-fa58-aa0f` | genau 1 (die zweite Variable) |
| | „Full plate armour" `64f1-879e-d9d4-7d78` unter Blood Dragon | `min 1` `5615-adeb-c92c-4022` | in 02/03/05/06/07/08 |
| Vampire Count `6822…` | „Handweapon" `7b76-de50-6c9b-60c3` | `min 1` `4c68-90d8-4b3a-544f` | 1 × (Roster 07/08) |
| | Gruppe „Bloodline" `63e7-ac1b-014b-3b28` | `min 1` `56c1-3e68-6f24-3768` / `max 1` `6d0c-37c1-e5f6-b88d` | genau 1 |
| | Gruppe „Wizard Level" `7ab1-d9dc-6124-443f` | `min 1` `19ba-de18-6ad7-2825` / `max 1` `436d-44fa-86cf-bf42` | genau 1 |
| | „Full plate armour" `1e5a-fe4d-e5ca-5445` unter dessen Blood Dragon `60a4…` | `min 1` `6cb4-bb72-321d-fabb` | in Roster 08 |

**Warum ein pts-Budget von 2000 in allen acht Rostern?** Ohne ein
`limit::ecfa-8486-4f6c-c249` stünden die punkteskalierenden Kategoriegrenzen der
`.gst` in ihrem Unter-2000-Zweig — namentlich der `set 0` auf die
Lord-Obergrenze `ffea-b24a-0cdf-781e` (`.gst:75`), der jede Lord-Auswahl zur
Verletzung machte und das Bild mit sachfremden Meldungen zustellte. Bei genau
2000 greift dieser `set` nicht (er verlangt `lessThan 2000`), und die Grenze
bleibt auf ihrem Basiswert `-1` = unbegrenzt (`.gst:84`; Arithmetik auf einer
unbegrenzten Grenze lässt sie unbegrenzt,
[§7.6-Sentinel-Kasten](../../battlescribe-data-format.md#76-constraint)).
Zugleich bindet das pts-Budget nie: die teuerste Liste kostet 490 pts
(Lord 285 + Count 205; „Wizard level 3" schlägt in 04–06 mit 50 pts zu Buche,
Summe 335). Damit ist die **Casting-Dice-Grenze die einzige Variable**.

> **Assertion-Fokus:** ausschliesslich die Budget-Grenze
> `budget::fcec-2340-6368-a2ba`. Andere Armeeaufbau-Diagnosen dürfen zusätzlich
> auftreten und sind hier ohne Belang — namentlich die roster-weite
> General-Pflicht `1077-7379-f142-f382` (`.gst:56`; der optionale
> General-`entryLink` `943e-5789-86d0-1f2d` ist bewusst weggelassen), die
> Core-Pflicht `9636-e6ed-b522-1f4a` (`.gst:136`, `min 2`, bei 2000 pts um 1
> erhöht) und die Characters-Obergrenze `9ecc-0180-3f98-d6c2` (`.gst:247`).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Gate: die geschriebenen Casting Dice bleiben stehen | Vampire Lord, Blutlinie **Strigoi**, **Wizard level 2**, Casting-Dice-Budget **1**. | **DCB-R3 + DCB-R7:** Die Liste braucht **2** Casting Dice und sprengt das Budget um 1. | [`01-wizard2-strigoi-full-cost.ros`](rosters/01-wizard2-strigoi-full-cost.ros) |
| 02 | Gate greift: dieselbe Zauberstufe bleibt im Budget | **Identischer** Aufbau, nur Blutlinie **Blood Dragon** (+ Pflicht-Kind Full plate armour); Budget unverändert **1**. | **DCB-R1 + DCB-R2:** Die Zauberstufe kostet jetzt **1** statt 2 — dieselbe Wahl bleibt **innerhalb** desselben Budgets, die Budget-Regel feuert **nicht**. | [`02-wizard2-blood-dragon-discount.ros`](rosters/02-wizard2-blood-dragon-discount.ros) |
| 03 | Der Abzug ist exakt 1, nicht 2 | Wie 02, nur Budget **0**. | **DCB-R4:** Die Summe ist **1** und überschreitet die 0 um 1 — die verbilligten Kosten sind auf den Punkt festgenagelt. | [`03-wizard2-blood-dragon-exact-one.ros`](rosters/03-wizard2-blood-dragon-exact-one.ros) |
| 04 | Zweiter Zeuge ohne Gate | Vampire Lord, **Strigoi**, **Wizard level 3**, Budget **2**. | **DCB-R5:** **3** Casting Dice, 1 über dem Budget. | [`04-wizard3-strigoi-full-cost.ros`](rosters/04-wizard3-strigoi-full-cost.ros) |
| 05 | Zweiter Zeuge mit Gate | Wie 04, nur **Blood Dragon** (+ Full plate armour); Budget unverändert **2**. | **DCB-R5:** **2** Casting Dice — das Budget wird exakt eingehalten, die Regel feuert **nicht**. Zusammen mit 02 zeigt das: der Abzug ist eine **Differenz**, kein `set`. | [`05-wizard3-blood-dragon-discount.ros`](rosters/05-wizard3-blood-dragon-discount.ros) |
| 06 | Die Klammer ohne Null-Grenze | Wie 05, nur Budget **1**. | **DCB-R4/R5:** Die Summe ist **2** und überschreitet die 1 um 1 — verbilligt heisst hier 3 → 2, nicht 3 → 1. | [`06-wizard3-blood-dragon-exact-two.ros`](rosters/06-wizard3-blood-dragon-exact-two.ros) |
| 07 | Der Rabatt folgt dem Vampir, nicht der Armee | Vampire Lord (**Blood Dragon**, Wizard level 2) **und** Vampire Count (**Strigoi**, Wizard level 1); Budget **1**. | **DCB-R2/R6:** Nur der Lord wird verbilligt (1), der Count zahlt seinen geschriebenen 1 — Summe **2**, 1 über dem Budget. Eine kontingentweite Lesart des Rahmens ergäbe 1 und schwiege. | [`07-two-vampires-only-blood-dragon-discounts.ros`](rosters/07-two-vampires-only-blood-dragon-discounts.ros) |
| 08 | Beide Vampire Blood Dragon | **Identisch** zu 07, nur die Blutlinie des Count wechselt auf **Blood Dragon** (+ dessen Full plate armour); Budget **1**. | **DCB-R6:** Jetzt wird auch die Zauberstufe des Count verbilligt (1 → **0**) — Summe **1**, die Regel feuert **nicht**. | [`08-two-vampires-both-blood-dragon.ros`](rosters/08-two-vampires-both-blood-dragon.ros) |

### Was dieses Szenario bewusst NICHT behauptet

- **Keine feuernde Katalog-Grenze auf der Kostensumme.** Nach DCB-R8 gibt es im
  ganzen upstream-Satz keinen `constraint`, der Casting Dice summiert. Eine
  Erwartung `measure="costSum"` liesse sich hier nur erfinden — das verbietet die
  Black-Box-Rolle. Beobachtbar bleibt allein die Budget-Regel.
- **Kein Kostenwert im Fähigkeits-Datensatz.** Die Slot-Aussagen des
  Manifest-Vertrags (`name`, `current`, `effectiveMin`, `effectiveMax`,
  `headroom`, `isHidden`, `isBlocked`, `isMandatoryUnmet`, `authorMessages`,
  `infoElements`) kennen **kein** Feld für Kosten; die gesenkten Kosten sind dort
  nicht pinnbar. Gleiche Auslassung und Begründung wie SCV-R8 in
  [`set-cost-value-force-gate`](../set-cost-value-force-gate/README.md).
- **Keine Aussage über `causes` der Budget-Meldung.** Die Budget-Regel entspringt
  keinem `<constraint>` und damit keinem Modifikator-Pfad (VCC-R6); ob die
  gegateten **Kosten**-Modifikatoren dort als Ursache erscheinen könnten, ist aus
  den Katalogdaten nicht zu entscheiden.
- **Keine Aussage über `anchorKind`/`anchorName`/`messages`** über das in
  [`violation-classification`](../violation-classification/README.md) (VCC-R6)
  bereits Festgenagelte hinaus. Das Manifest dieses Szenarios beschränkt sich
  deshalb auf `firing`/`absent`.
- **Keine Aussage über Profilwerte.** Die Blutlinie ändert am **upstream**-Satz
  faktisch **keine** Merkmalswerte (die Modifikatoren existieren, ihr Rahmen löst
  aber nicht auf) — das ist Gegenstand von
  [`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md)
  und hier bewusst ausgeklammert. Der Verletzungsbericht kodiert ohnehin keine
  Profilwerte (VBL-R6).
- **Keine Aussage über die Dispel Dice.** „Wizard level 2" trägt auch
  `Dispel Dice` (`6001-b2bf-4529-c07d`) `1`, „Wizard level 3" `2` — auf **diese**
  Kostenart wirkt **kein** Modifikator (0 Treffer `modifier … field="6001-…"` an
  den Zauberstufen). Sie ist deshalb keine Aussage über den `decrement` und in
  keinem Roster budgetiert.
- **Keine Aussage über den Casting-Dice-`increment` des Vampire Thrall**
  (`:2356`). Er gehört zur Gegenrichtung desselben Feldtyps, verlangt aber eine
  ganz andere Einheit und ein anderes Gate (`childId="32d0-a151-94a3-aa54"`); das
  wäre ein eigenes Szenario.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Zeile) |
|---------|-----|---------------------------|
| Spielsystem „Warhammer Fantasy Battle 6th edition" (rev 8) | `6d8e-38d9-3c69-febf` | `.gst:2` |
| Katalog „Vampire Counts" (rev 10, ohne `catalogueLinks`) | `ea4b-9294-3427-1fc1` | `.cat:2` |
| Kontingent „Standard " (einziges des Satzes) | `7d9d-6c8d-4ea0-b7ad` | `.gst:61` |
| Kostenart „ Casting Dice" (`defaultCostLimit="-1.0"`) | `fcec-2340-6368-a2ba` | `.gst:8` |
| Kostenart „pts" / „ Dispel Dice" | `ecfa-8486-4f6c-c249` / `6001-b2bf-4529-c07d` | `.gst:7` / `.gst:9` |
| Einheit „Vampire Lord" (285 pts, 0 Casting Dice) | `b77b-88d5-5e80-e178` | `.cat:1301`, Kosten `:1915-1919` |
| — Pflicht-Kind „Handweapon" (`min` / `max`) | `6abf-e08f-6480-cd58` — `d830-89e1-7573-92e7` / `b157-2f40-f533-4d60` | `.cat:1341` |
| — Pflicht-Kind „Lord hero choice extra cost" (`min` / `max`) | `42c5-9ebc-7493-89ef` — `0780-5a76-9d51-e9ea` / `b4f7-612f-aac4-65e6` | `.cat:1355` |
| — Pflicht-Gruppe „Bloodline" (`max` `:1374` / `min` `:1375`) | `01b8-338b-6b92-e37f` — `6c3a-e4ae-3667-440f` / `e251-f353-704b-836a` | `.cat:1372` |
| — — „Blood Dragon" mit `categoryLink` → `4cae…` | `0158-ed16-cbbf-6a78` — `85db-e156-f433-69e1` | `.cat:1602`, `:1604`, Kosten `:1757-1761` |
| — — — Pflicht-Kind „Full plate armour" (`max` / `min`) | `64f1-879e-d9d4-7d78` — `616c-b4f1-bd23-8306` / `5615-adeb-c92c-4022` | `.cat:1607`, Kosten `:1620-1624` |
| — — „Strigoi" mit `categoryLink` → `bf30…` (Kontrolle) | `ef7a-5896-8856-076b` — `261b-6e13-782f-68c1` | `.cat:1763`, Kosten `:1777-1781` |
| — Pflicht-Gruppe „Wizard Level" (`defaultSelectionEntryId="42d9…"`; `min` / `max`) | `b8ff-7e47-2614-1ecd` — `9c66-4f74-2201-82ec` / `efbf-d87a-fa58-aa0f` | `.cat:1869-1873` |
| — — **Träger** „Wizard level 2" (geschrieben 2 Casting Dice, 0 pts) | `42d9-cebe-18d5-cdbd` | `.cat:1875`, Kosten `:1886-1890` |
| — — — dessen Kosten-`decrement` **1** auf `fcec…`, Gate `4cae…` | `modifier type="decrement" field="fcec-2340-6368-a2ba" value="1.0"` → `condition greaterThan 0 field="selections" scope="parent" childId="4cae-a20e-8374-b6cb" includeChildSelections="true"` | `.cat:1877` / `:1879` |
| — — — dessen eigene Zählgrenze | `5c3a-0288-a6ed-6884` (`max 1 scope=parent`) | `.cat:1884` |
| — — **Träger** „Wizard level 3" (geschrieben 3 Casting Dice, 50 pts) | `649a-8bc1-fb66-ed73` — Zählgrenze `d4da-3dc6-c395-14be` | `.cat:1892`, Modifikator `:1894`, Kosten `:1903-1907` |
| — optionaler `entryLink` „General" (bewusst weggelassen) | `943e-5789-86d0-1f2d` → `1b7c-2c90-6d96-28c9` | `.cat:1913` |
| Einheit „Vampire Count" (205 pts, 0 Casting Dice) | `6822-0110-a7c9-cbb0` | `.cat:1921`, Kosten `:2348-2352` |
| — Pflicht-Kind „Handweapon" (`max` / `min`) | `7b76-de50-6c9b-60c3` — `bad3-87a3-e648-6993` / `4c68-90d8-4b3a-544f` | `.cat:1958` |
| — Pflicht-Gruppe „Bloodline" (`max` / `min`) | `63e7-ac1b-014b-3b28` — `6d0c-37c1-e5f6-b88d` / `56c1-3e68-6f24-3768` | `.cat:1974-1978` |
| — — „Blood Dragon" des Count mit `categoryLink` → `4cae…` | `60a4-751a-19aa-35dc` — `cdd9-6f83-2229-d974` | `.cat:2070`, `:2072`, Kosten `:2130-2134` |
| — — — dessen Pflicht-Kind „Full plate armour" (`max` / `min`) | `1e5a-fe4d-e5ca-5445` — `b65a-0e4a-e934-ccd9` / `6cb4-bb72-321d-fabb` | `.cat:2075`, Kosten `:2088-2092` |
| — — „Strigoi" des Count (Kontrolle) | `30ba-e15f-9acd-7663` — `0c7d-e8ac-6810-9962` | `.cat:2136`, Kosten `:2150-2154` |
| — Pflicht-Gruppe „Wizard Level" (`defaultSelectionEntryId="3c1a…"`; `min` / `max`) | `7ab1-d9dc-6124-443f` — `19ba-de18-6ad7-2825` / `436d-44fa-86cf-bf42` | `.cat:2302-2305` |
| — — **Träger** „Wizard level 1" (geschrieben 1 Casting Die, 0 pts) | `3c1a-3350-04ae-7a3f` — Zählgrenze `5c8d-73ef-defc-a6c7` | `.cat:2308`, Modifikator `:2310`, Kosten `:2319-2323` |
| — — „Wizard level 2" des Count (nicht benutzt, geschrieben 2, 35 pts) | `c2b8-e61d-9a73-0b21` | `.cat:2325`, Modifikator `:2327` |
| `categoryEntry` „Blood Dragon" (die `childId` des Gates) | `4cae-a20e-8374-b6cb` | `.cat:12` |
| `categoryEntry` „Strigoi" / „Necrach" / „Von Carstein" / „Lahmia" | `bf30-4ff0-a4d8-3909` / `fc4b-a86d-5897-9e4c` / `ff24-ca11-afd5-865b` / `c872-4b18-1aad-6953` | `.cat:13`, `:11`, `:10`, `:14` |
| Kategorie „Lord" / „Characters" | `d024-d25b-a9b4-73b6` / `7a1c-d611-c2dc-def1` | `.gst:45` / `:51` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::fcec-2340-6368-a2ba` | keine Katalogquelle — siehe DCB-R7 |
| Zusatz-Diagnosen ohne Belang: General-Pflicht / Core-Pflicht / Lord-Obergrenze / Characters-Obergrenze | `1077-7379-f142-f382` / `9636-e6ed-b522-1f4a` / `ffea-b24a-0cdf-781e` / `9ecc-0180-3f98-d6c2` | `.gst:56` / `:136` / `:84` / `:247` |
| Nicht benutzter Casting-Dice-`increment` (Vampire Thrall) | `e37b-c827-99ac-b706` → `modifier type="increment" field="fcec-2340-6368-a2ba" value="1.0"` (Gate `32d0-a151-94a3-aa54`) | `.cat:2354`, `:2356` |
