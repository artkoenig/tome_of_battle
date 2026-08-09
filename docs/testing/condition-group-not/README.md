# E2E-Regeln & Testkatalog: `conditionGroup type="not"` — die Negation

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/evaluator/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.6/§7.7)
abgeleitet. Die Roster-Form ist an den bestehenden Szenarien verifiziert
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`entryId`=Ziel-Id + `entryLinkId`=Verweis-Id bei einem `entryLink`,
`<costLimits><costLimit …/></costLimits>` für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1)
  — Kontingent **„Army of the Lichemaster (WD#309-UK)"** `f37a-a93e-fa22-61a8`
  (`:29441`), Kontrast-Kontingent **„Clan Von Carstein (VC-AB)"**
  `b1e4-e1cf-9bd6-2438` (`:29312`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `ef73-f9bd-e250-54d2` eingebundene Abhängigkeit des
  Vampire-Counts-Katalogs (`Vampire Counts (…).cat:29511`).

---

## Die Regel (In-World)

Eine `<conditionGroup type="not">` hält genau dann, wenn **keines** ihrer
Mitglieder hält — Bedingungen wie Untergruppen gleichermaßen. Sie ist die
De-Morgan-Duale zu `or` und damit die strengere der beiden denkbaren Lesarten:

> **Entscheidung dieses Projekts (Issue 0115):** eine `not`-Gruppe hält genau
> dann, wenn **keines** ihrer Mitglieder hält — die exakte De-Morgan-Duale zu
> `or`. […] Auf den realen Daten ist die Wahl **nicht beobachtbar**: beide
> Fundstellen tragen genau *ein* Mitglied (eine `and`-Untergruppe), wo jede
> Lesart dieselbe schlichte Negation ergibt.
> — [§7.7, Kasten `type="not"`](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen)

Das Szenario prüft deshalb genau das, was auf den realen Daten **beobachtbar**
ist: die schlichte Negation einer einzigen `and`-Untergruppe. Es unterscheidet
insbesondere „Negation" von den naheliegenden Fehl-Lesarten „Gruppe ignoriert",
„Gruppe wie ein gewöhnliches `and`-Mitglied gelesen" und „Gruppe immer falsch"
(vgl. die Kreuztabelle unten).

`type="not"` ist upstream **nicht** spezifiziert (weder BSData-Wiki noch eine
bekannte `BSData/schemas`-Version); die vendorte `Catalogue.xsd` dieses Projekts
wurde bewusst und dokumentiert um ihn erweitert
([ADR 0016](../../adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)).
Belegt ist er allein durch reale Kataloge.

---

## Die Datenlage im Fixture-Satz

Im gesamten eingefrorenen Datensatz (5 Dateien) kommt `type="not"` **genau
zweimal** vor, beide Male in `Vampire Counts (…).cat` und beide Male wortgleich
am `set`-Modifikator, der die Pflicht-Untergrenze einer Lichemaster-Einheit hebt:

| Träger (`selectionEntry`) | Id | Grenze | `set`-Modifikator | `not`-Gruppe |
|---|---|---|---|---|
| „Heinrich Kemmler (WD#309-UK)" (`:10536`) | `595f-a4e4-5cbc-dab4` | `8461-3eab-e5ac-1636` (`:10806`) | `:10772` | `:10779` |
| „Krell, King of Wights (WD#309-UK)" (`:12305`) | `2d17-c7be-5fd6-f1a3` | `60a8-5b49-6b81-7c84` (`:12313`) | `:12373` | `:12380` |

Die Struktur, hier am Kemmler-Vorkommen (`:10772-10792`):

```xml
<modifier type="set" value="1" field="8461-3eab-e5ac-1636">
  <conditionGroups>
    <conditionGroup type="and">                                   <!-- (A) -->
      <conditions>
        <condition type="instanceOf" value="1" field="selections" scope="force"
                   childId="f37a-a93e-fa22-61a8" …/>              <!-- (A1) -->
      </conditions>
      <conditionGroups>
        <conditionGroup type="not">                               <!-- (N)  -->
          <conditionGroups>
            <conditionGroup type="and">                           <!-- (B)  -->
              <conditions>
                <condition type="lessThan" value="2000"
                           field="limit::ecfa-8486-4f6c-c249" scope="roster" …/>   <!-- (B1) -->
                <condition type="atLeast" value="1" field="selections" scope="force"
                           childId="14fb-dd39-08e7-cbde" includeChildSelections="true" …/>  <!-- (B2) -->
              </conditions>
            </conditionGroup>
          </conditionGroups>
        </conditionGroup>
      </conditionGroups>
    </conditionGroup>
  </conditionGroups>
</modifier>
```

Und die Grenze selbst (`:10806`, wortgleich `:12313` für Krell):

```xml
<constraint type="min" value="0" field="selections" scope="force" shared="true"
            id="8461-3eab-e5ac-1636" includeChildSelections="false"/>
```

Netto-Lesart: *„Im Lichemaster-Heer sind Kemmler und Krell Pflicht — außer in der
Kampagnenvariante unter 2000 Punkten."* Der Basiswert `min 0` ist ein No-op; erst
der `set 1` macht daraus eine Pflicht.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **CGN-R1** | Der Basiswert beider Grenzen ist `min 0` — ohne den `set`-Modifikator ist die Grenze **wirkungslos**, nicht „immer verletzt". | `Vampire Counts (…).cat:10806` bzw. `:12313` — `constraint type="min" value="0" field="selections" scope="force" shared="true" includeChildSelections="false"`. |
| **CGN-R2** | Beide Grenzen zählen `field="selections"` im `scope="force"`, also die Auswahlen des Trägers **im Kontingent**. `bound` ist der wirksame `value` (0 bzw., nach `set`, 1), `actual` die Zahl der Auswahlen des Trägers im Kontingent. | Wie CGN-R1; Ziel-Typ-Regel für `scope="force"` mit **Eintrags**-Ziel = pro Detachment ([§7.6-Regelkasten](../../battlescribe-data-format.md#76-constraint), ADR 0029). Alle Roster haben genau ein Kontingent. |
| **CGN-R3** | Der `set 1` greift **nur**, wenn die äußere `and`-Gruppe (A) hält, also **beide** ihre Mitglieder: die Bedingung (A1) und die Untergruppe (N). | `:10774` `conditionGroup type="and"`; [§7.7](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen): *„Eine `and`-Gruppe hält, wenn **alle** ihre Mitglieder (Bedingungen *und* Untergruppen) halten"*. |
| **CGN-R4** | (A1) hält genau im Kontingent „Army of the Lichemaster". | `:10776` `condition type="instanceOf" scope="force" childId="f37a-a93e-fa22-61a8"`. Kanonische Kodierung einer `forceEntry`-Instanzprüfung (`scope="force"` + Id in `childId`), siehe [§7.7-Kasten](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). `f37a…` ist der `forceEntry` (`:29441`). |
| **CGN-R5** | Die `not`-Gruppe (N) hat **genau ein** Mitglied: die `and`-Untergruppe (B). Sie hält also genau dann, wenn (B) **nicht** hält. | `:10779-10788` — `<conditionGroup type="not">` enthält ausschließlich `<conditionGroups>` mit einer einzigen `<conditionGroup type="and">`, keine eigenen `<conditions>`. |
| **CGN-R6** | (B) hält genau dann, wenn **beides** gilt: das eingestellte Punktebudget der Roster ist < 2000 **und** im Kontingent steht mindestens eine Auswahl der Kampagne `14fb-dd39-08e7-cbde`. | `:10783` `condition type="lessThan" value="2000" field="limit::ecfa-8486-4f6c-c249" scope="roster"` — `ecfa-8486-4f6c-c249` ist die `costType` „pts" (`.gst`), `limit::` das **Kostenlimit** der Roster ([§7.7, Condition-Tabelle](../../battlescribe-data-format.md#condition--eine-voraussetzung)). `:10784` `condition type="atLeast" value="1" field="selections" scope="force" childId="14fb-dd39-08e7-cbde" includeChildSelections="true"`. |
| **CGN-R7** | `14fb-dd39-08e7-cbde` ist ein **`entryLink`** der `.gst` unter dem Eintrag „Campaign/Scenario rules" `4b25-4c70-afd8-5729`, Ziel `7d87-7436-5341-bbc0`. Im Roster steht er deshalb als `entryId="7d87-…" entryLinkId="14fb-…"` **unterhalb** von `4b25-…`; `includeChildSelections="true"` erfasst diese Verschachtelung. | `.gst:2288` (`entryLink`), `.gst:2278` (Träger `4b25-4c70-afd8-5729`), `.gst:2313` (Ziel `7d87-7436-5341-bbc0`). Dass beide Kodierungen im Datensatz dieselbe Kampagne meinen, zeigt `Orcs and goblins (…).cat:12699 ff.`, das dieselbe Prüfung mit `childId="7d87-7436-5341-bbc0"` schreibt. |
| **CGN-R8** | Kemmler und Krell sind per Basis `hidden="true"` und werden **genau im Lichemaster-Kontingent** aufgedeckt; ihre Min-Grenzen werden dort also validiert. | `:10536` / `:12305` (`hidden="true"`), `:10757-10761` / `:12358-12362` (`modifier set hidden="false"` mit derselben `instanceOf`-Bedingung auf `f37a…`). [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) / Issue 0088: Min-Grenzen einer **effektiv versteckten** Entität werden nicht validiert — im Lichemaster-Kontingent ist die Entität nicht versteckt. |
| **CGN-R9** | Die beiden Autor-Meldungen an denselben Trägern (`field="error"`) sind **keine** zählenden Grenzen und stehen nicht in der Erwartung dieses Szenarios. | `:10762` („Please enable &quot;Allow special characters?&quot;", Bedingung `lessThan 1` auf `8923-5946-7b10-8957`) und `:10793` („{this} is both mandatory and not allowed under 2k games…", Bedingung: Budget < 2000 **und** *keine* Kampagnen-Auswahl). Autor-Meldungen tragen `origin="authorMessage"`, keine `limitId` — das eigene Szenario dafür ist [`author-message-severity`](../author-message-severity/README.md). |

### Was eine falsche Lesart der `not`-Gruppe produzieren würde

(A1) hält in den Rostern 01–05 (Lichemaster-Kontingent) und scheitert in 06.
Die Wahrheitswerte von (B1) „Budget < 2000" und (B2) „Kampagne im Kontingent"
sind über die Roster hinweg **kreuzweise** variiert:

| Roster | (B1) | (B2) | (B) = `and` | korrekt: (N) = `not` | `set 1` greift? | Grenzen |
|---|---|---|---|---|---|---|
| 01 (3000, ohne Kampagne) | ✗ | ✗ | ✗ | **✓** | **ja** | feuern 0/1 |
| 02 (3000, ohne Kampagne, beide gewählt) | ✗ | ✗ | ✗ | **✓** | **ja** | erfüllt (1 ≥ 1) |
| 03 (**1500, mit Kampagne**) | ✓ | ✓ | **✓** | **✗** | **nein** | still (min 0) |
| 04 (1500, ohne Kampagne) | ✓ | ✗ | ✗ | **✓** | **ja** | feuern 0/1 |
| 05 (3000, mit Kampagne) | ✗ | ✓ | ✗ | **✓** | **ja** | feuern 0/1 |

Daraus die Fehl-Lesarten und wo sie auffallen:

| Fehl-Lesart | Roster 01 | Roster 03 | Roster 04 | Roster 05 |
|---|---|---|---|---|
| (N) **ignoriert** (Untergruppe übersprungen, (A) hängt nur an (A1)) | konform | Grenzen feuern → **fällt auf** | konform | konform |
| (N) wie ein gewöhnliches **`and`**-Mitglied gelesen (also (B) statt ¬(B)) | Grenzen feuern **nicht** → **fällt auf** | Grenzen feuern → **fällt auf** | Grenzen feuern **nicht** → **fällt auf** | Grenzen feuern **nicht** → **fällt auf** |
| (N) **immer falsch** (fail-closed missverstanden) | Grenzen feuern **nicht** → **fällt auf** | konform | Grenzen feuern **nicht** → **fällt auf** | Grenzen feuern **nicht** → **fällt auf** |
| (B) als **`or`** statt `and` gelesen ⇒ ¬(B) = ¬(B1) ∧ ¬(B2) | konform | konform | Grenzen feuern **nicht** → **fällt auf** | Grenzen feuern **nicht** → **fällt auf** |
| `limit::…` als **Summe der Kosten** statt als eingestelltes Budget gelesen (die Kostensumme liegt in allen Rostern weit unter 2000, (B1) wäre also stets wahr) | konform | konform | konform | (B) hielte ⇒ Grenzen feuern **nicht** → **fällt auf** |

Roster **03** ist der schärfste Fall: er ist der einzige, in dem die Negation die
Pflicht **abschaltet**. Roster **04** und **05** zeigen, dass dafür **beide**
Hälften von (B) nötig sind — weder das Budget noch die Kampagnen-Auswahl allein
genügt. Roster **02** belegt, dass die Grenzen überhaupt ausgewertet werden.
Roster **06** ist die grobe Gegenprobe über (A1).

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Vampire Counts `.cat` + Mercenaries `.cat`).
Das `catalogueId`-Attribut einer `<force>` ist Roster-Beiwerk; welcher Katalog das
Kontingent deklariert hat, kommt aus der Herkunft der Force-**Definition**
(PCS-R5 in [`primary-catalogue-scope`](../primary-catalogue-scope/README.md)).

> **Assertion-Fokus:** nur die beiden Constraint-Ids `8461-3eab-e5ac-1636` und
> `60a8-5b49-6b81-7c84`. Andere Armeeaufbau-Diagnosen dürfen zusätzlich auftreten
> und sind hier ohne Belang — namentlich die General-/Core-/Lord-Pflichten
> (das Lichemaster-Kontingent trägt `min 1` auf seinem Lord-`categoryLink`,
> `760d-2352-9fac-0e46`, `:29452`), die Pflicht-Kinder von Kemmler in Roster 02
> (u. a. `entryLink` „Magic Level 4" `5a5b-c983-a881-b72b` sowie die Magic-Items
> `c55a-6071-d632-8ff2`, `d24b-eefe-114d-1e5c`, `8afc-6249-ca78-881d`, …) und die
> von Krell (`dae0-be51-cf67-002f`, `3618-ea5e-e092-5ca5`, `117a-38bc-6350-8e22`),
> die Autor-Meldungen aus CGN-R9 sowie — in den Rostern 03 und 04 — die
> **Eigengrenze des Kontingents** `8f3f-ffa8-387b-0bf9` (`:29461`, per Modifikator
> `:29464` auf `min 2000` für `limit::pts` gesetzt), die bei Budget 1500 unerfüllt
> bleibt.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Pflicht greift: leeres Lichemaster-Heer über 2000 Punkten | Kontingent `f37a…`, Budget **3000**, **keine** Auswahl. | **CGN-R3/R5/R6:** (B) scheitert doppelt ⇒ (N) hält ⇒ `set 1` greift. `8461-3eab-e5ac-1636` feuert **Ist 0 / Grenze 1**, `60a8-5b49-6b81-7c84` feuert **Ist 0 / Grenze 1**. | [`01-lichemaster-3000-empty-both-mandatory.ros`](rosters/01-lichemaster-3000-empty-both-mandatory.ros) |
| 02 | Pflicht erfüllt: Kemmler und Krell gewählt | Wie 01, zusätzlich **Heinrich Kemmler** `595f…` und **Krell** `2d17…`, je `number="1"`. | Der `set 1` greift weiterhin, aber Ist 1 ≥ Grenze 1: beide Grenzen **absent**. Belegt, dass die Grenzen ausgewertet werden. | [`02-lichemaster-3000-kemmler-and-krell.ros`](rosters/02-lichemaster-3000-kemmler-and-krell.ros) |
| 03 | **Die Negation hält nicht** — Kampagnenvariante unter 2000 | Kontingent `f37a…`, Budget **1500**, „Campaign/Scenario rules" `4b25…` mit der Kampagne `7d87…`/`14fb…` darunter. | **CGN-R5/R6:** (B1) und (B2) halten ⇒ (B) hält ⇒ (N) hält **nicht** ⇒ (A) scheitert ⇒ kein `set`. Beide Grenzen bleiben bei `min 0` und sind **absent**. Der Fall, der „Negation" von „ignoriert" trennt. | [`03-lichemaster-1500-with-campaign-not-fails.ros`](rosters/03-lichemaster-1500-with-campaign-not-fails.ros) |
| 04 | Nur Budget < 2000, keine Kampagne | Kontingent `f37a…`, Budget **1500**, **keine** Auswahl. | (B2) scheitert ⇒ (B) scheitert ⇒ (N) hält ⇒ `set 1`. Beide Grenzen feuern **Ist 0 / Grenze 1**. | [`04-lichemaster-1500-without-campaign.ros`](rosters/04-lichemaster-1500-without-campaign.ros) |
| 05 | Nur Kampagne, Budget ≥ 2000 | Kontingent `f37a…`, Budget **3000**, Kampagne `7d87…`/`14fb…` gewählt. | (B1) scheitert ⇒ (B) scheitert ⇒ (N) hält ⇒ `set 1`. Beide Grenzen feuern **Ist 0 / Grenze 1**. | [`05-lichemaster-3000-with-campaign.ros`](rosters/05-lichemaster-3000-with-campaign.ros) |
| 06 | Anderes Kontingent — schon (A1) scheitert | Kontingent **„Clan Von Carstein (VC-AB)"** `b1e4-e1cf-9bd6-2438`, Budget 3000, leer. | **CGN-R4:** kein `set`, weil (A1) scheitert — unabhängig davon, was (N) sagt. Beide Grenzen bleiben bei `min 0`, **absent**. | [`06-von-carstein-force-instanceof-fails.ros`](rosters/06-von-carstein-force-instanceof-fails.ros) |

### Herleitung der Zahlen

- **`bound`** ist der wirksame `value` der Grenze. Katalogwert ist in beiden Fällen
  `0` (`:10806`, `:12313`); greift der `set`-Modifikator, ist er `1`
  (`modifier type="set" value="1"`, `:10772` bzw. `:12373`). In den Rostern 01,
  04 und 05 gilt also `bound = 1`; in 03 und 06 bleibt er `0`.
- **`actual`** ist die Zahl der Auswahlen des Trägers im Kontingent
  (`field="selections"`, `scope="force"`). Roster 01/04/05: **0** — weder Kemmler
  noch Krell stehen im Kontingent, die Grenze feuert an einem Pflicht-Phantom
  (dieselbe Feinheit wie VBL-R1 in [`vampire-bloodlines`](../vampire-bloodlines/README.md),
  Test 02). Roster 02: **1** je Träger ⇒ 1 ≥ 1, still.
- In den Rostern 03 und 06 gilt `actual 0 ≥ bound 0` — die Grenze ist erfüllt und
  erscheint nicht im Bericht. Die Erwartung lautet dort deshalb `absent`, ohne
  `actual`/`bound`.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| **Sichtbarkeit (CGN-R8)** — Kemmler und Krell sind per Basis `hidden="true"` und werden nur im Lichemaster-Kontingent aufgedeckt (`:10757`, `:12358`); ein weiterer Modifikator versteckt sie unter „Border Patrols rules" wieder (`:10767`, `:12368`). | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke. Der Verletzungsbericht kodiert zählende Grenzen; Sichtbarkeit liest man an der Capability-Projektion ab (gleiche Abgrenzung wie VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md)). In Roster 06 ist die Stille der Grenzen **doppelt** bestimmt — (A1) scheitert *und* die Träger sind dort verborgen; der Fall ist deshalb die grobe Gegenprobe, nicht der scharfe. |
| **Die beiden Autor-Meldungen (CGN-R9)** an Kemmler und Krell. | `field="error"`-Meldungen tragen `origin="authorMessage"` und keine `limitId`; sie gehören nicht in `firing`/`absent`. Dass die „…not allowed under 2k games"-Meldung in Roster 04 anschlägt und in Roster 03 (Kampagne gewählt) schweigt, ist eine **zusätzliche**, hier nicht geprüfte Beobachtung — ihr eigenes Szenario ist [`author-message-severity`](../author-message-severity/README.md). |
| **Die Eigengrenze des Kontingents** `8f3f-ffa8-387b-0bf9` (`min` auf `limit::ecfa-8486-4f6c-c249`, per Modifikator auf 2000 gesetzt), die in den Rostern 03 und 04 bei Budget 1500 unerfüllt bleibt. | Sie ist echtes Beiwerk des gewählten Budgets und gehört einem anderen Mechanismus (`forceEntry`-eigene Grenze, [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments)). Ihr `actual` müsste über die Messgröße des Budgets hergeleitet werden, die die Formatspezifikation für den Bericht nicht festlegt — die Erwartung bleibt deshalb selektiv. |
| **Eine `not`-Gruppe mit mehr als einem Mitglied** (der Fall, in dem sich `NOT(OR(…))` und `NOT(AND(…))` unterscheiden). | Im Fixture-Satz **nicht baubar**: beide Fundstellen tragen genau ein Mitglied. Die Formatspezifikation sagt das selbst („Auf den realen Daten ist die Wahl **nicht beobachtbar**"). Ein solcher Fall müsste erfunden werden — das wäre kein Test an echten Katalogdaten mehr. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Vampire Counts** | `4d73-5ab0-9020-403c` |
| Bibliothek **Mercenaries** (per `catalogueLink` `ef73-f9bd-e250-54d2`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst`) — Nenner von `limit::…` | `ecfa-8486-4f6c-c249` |
| ForceEntry „Army of the Lichemaster (WD#309-UK)" (`:29441`) | `f37a-a93e-fa22-61a8` |
| — dessen Lord-`categoryLink` mit `min 1` (`:29452`) | `760d-2352-9fac-0e46` |
| — dessen Eigengrenze `limit::pts` (`:29461`), per `set 2000` (`:29464`) | `8f3f-ffa8-387b-0bf9` |
| ForceEntry „Clan Von Carstein (VC-AB)" (`:29312`) — Kontrast | `b1e4-e1cf-9bd6-2438` |
| SelectionEntry „Heinrich Kemmler (WD#309-UK)" (`:10536`, `hidden="true"`) | `595f-a4e4-5cbc-dab4` |
| — dessen Pflichtgrenze (`min 0`, `scope="force"`, `:10806`) | **`8461-3eab-e5ac-1636`** |
| — deren `set 1`-Modifikator mit `and`/`not`/`and` (`:10772-10792`) | (unbenannt, `field="8461-3eab-e5ac-1636"`) |
| — dessen `set hidden="false"` im Lichemaster-Kontingent (`:10757`) | (unbenannt) |
| SelectionEntry „Krell, King of Wights (WD#309-UK)" (`:12305`, `hidden="true"`) | `2d17-c7be-5fd6-f1a3` |
| — dessen Pflichtgrenze (`min 0`, `scope="force"`, `:12313`) | **`60a8-5b49-6b81-7c84`** |
| — deren `set 1`-Modifikator mit `and`/`not`/`and` (`:12373-12393`) | (unbenannt, `field="60a8-5b49-6b81-7c84"`) |
| SelectionEntry „Campaign/Scenario rules" (`.gst:2278`) | `4b25-4c70-afd8-5729` |
| — dessen `entryLink` „Campaign: A Dark Conspiracy - 30th anniversary" (`.gst:2288`) | `14fb-dd39-08e7-cbde` |
| — dessen Ziel (`.gst:2313`) | `7d87-7436-5341-bbc0` |
| SelectionEntry „Allow special characters?" (`.gst:1935`) — Wächter der Autor-Meldung | `8923-5946-7b10-8957` |
