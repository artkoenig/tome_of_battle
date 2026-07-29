# E2E-Regeln & Testkatalog: Text-Tokens in Autor-Meldungen (`{this}`)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind aus
den Katalogdaten der *6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) abgeleitet;
das Eingabeformat der Roster folgt den bereits verifizierten Fixtures
(direktes `entryId`; bei einem verlinkten Eintrag steht der **Verweis** im
`entryId` — siehe [„Bindung der Auswahl"](#bindung-der-auswahl-der-entrylink-steht-im-entryid)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
  (+ die per `catalogueLink` `a067-78d5-50a2-affe` geforderte
  `Mercenaries`-`.cat` `fc47-8392-a6c8-452a`)

## Worum es geht

Das Schwester-Szenario
[`author-message-severity`](../author-message-severity/README.md) haelt bereits
fest, **dass** ein `modifier type="add" field="error"|"warning"|"info"` eine
Meldung des Katalog-Autors ist, dass ihr Schweregrad der Name des `field` ist und
dass ihr Text der Inhalt des `value`-Attributs ist — **unveraendert und in
Katalogsprache**. Es hat dabei alle Faelle mit dem BattleScribe-Text-Token
`{this}` ausdruecklich ausgeklammert.

Dieses Szenario schliesst diese Luecke, soweit die Katalogdaten es hergeben. Es
gilt weiterhin: der Text wird **nicht** uebersetzt, **nicht** umformuliert,
**nicht** ergaenzt. Die einzige Veraenderung ist die Aufloesung des Tokens
`{this}` zum **Anzeigenamen des Eintrags, an dem die Meldung haengt** — also zu
dem Namen, den auch der Faehigkeits-Datensatz des Slots als `name` fuehrt.

In allen fuenf Fixture-Dateien kommt `{this}` **genau siebenmal** vor, und jedes
Mal in `modifier/@value` eines Meldungs-Modifikators:

| # | Datei / Zeile | `field` | `value` (roh) |
|---|---------------|---------|----------------|
| 1 | Ogre-`.cat` 23 | `error` | `You cannot have more units of {this} than you have units of Ogre Bulls` |
| 2 | Mercenaries-`.cat` 4784 | `info` | `During "A Dark Conspiracy" campaign, {this} if 3+ other Amazons, …` |
| 3 | Mercenaries-`.cat` 4819 | `warning` | `You need to provide another {this} for your opponent at no cost too (still takes Hero+Rare choice)` |
| 4 | Mercenaries-`.cat` 5344 | `error` | `{this} requires 1+ Tilean regiments.` |
| 5 | Mercenaries-`.cat` 6220 | `error` | `{this} requires 1+ selections of Truthsayer or Dark Emissary` |
| 6 | VC-`.cat` 10793 | `error` | `{this} is both mandatory and not allowed under 2k games.` + Folgezeile |
| 7 | VC-`.cat` 12394 | `error` | wortgleich zu 6 |

Gepinnt wird **#1** — der klarste Fall: kurzer, einzeiliger Text, Traeger ohne
jeden Namens-Modifikator — samt Gegenprobe, in der die Bedingung nicht mehr
haelt. Dazu kommt eine token-freie Meldung als Kontrolle, dass ein Text ohne
Token voellig unangetastet bleibt.

Der einzige Fixture-Fall, an dem sich **wirksamer** gegen **Katalog**-Namen
abgrenzen liesse, ist **#3**; er ist mit diesen Katalogdaten nicht pruefbar —
siehe [„Dokumentierte Luecke"](#dokumentierte-luecke-wirksamer-name-im-token-nicht-pruefbar).

### Bindung der Auswahl: der `entryLink` steht im `entryId`

Roster **02** benennt im `entryId` seiner zweiten Auswahl **nicht** das Ziel des
Verweises, sondern den `entryLink` selbst (`entryId` = `entryLinkId` = Id des
Verweises). Grund: eine Auswahl wird ueber ihr `entryId` an eine Definition
gebunden. Nennt sie das Ziel, ist der Verweis selbst nicht Teil der Bindung — und
damit faellt alles weg, was **am `entryLink`-Element** deklariert ist (dessen
eigene `modifiers`, `modifierGroups`, `constraints`, `costs`). Genau diese
link-eigene Deklaration ist hier der Gegenstand: der Verweis traegt den
**unbedingten**
`<modifier type="add" value="735e-2da1-6356-2fdb" field="category"/>`, der direkt
im `<modifiers>`-Block des Ogre-Bulls-Verweises `d82e-111e-89b9-2be1` steht
(Ogre-`.cat`, Z. 3164–3166) — **nicht** in einer der beiden bedingten
`modifierGroup`s darueber (Z. 3134–3160). Ohne Bindung an den Verweis vergibt die
Einheit die Kategorie „Bully Bully" nie, und die Gegenprobe AMT-R3 waere gar nicht
ausloesbar.

Roster **01** und **03** brauchen das nicht: „Gnoblars" (`1e26-0d1a-bb3c-f47a`)
und Skrag (`82a9-0281-ffa1-2290`) sind Wurzel-`selectionEntry`s der Ogre-`.cat`,
werden also direkt per `entryId` mit leerem `entryLinkId` benannt.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **AMT-R1** | **`{this}` wird durch den Namen des tragenden Eintrags ersetzt.** Enthaelt das Kontingent eine **Gnoblars**-Einheit und **keine** Auswahl der Kategorie „Bully Bully", liegt an dieser Einheit die `error`-Meldung `You cannot have more units of Gnoblars than you have units of Ogre Bulls` an. Der Eintrag traegt **keinen** `field="name"`-Modifikator, sein wirksamer Anzeigename ist also identisch mit seinem Katalog-`name`. | Ogre-`.cat`, Z. 16/23/25: `selectionEntry name="Gnoblars" id="1e26-0d1a-bb3c-f47a" type="unit"` → `modifier type="add" value="You cannot have more units of {this} than you have units of Ogre Bulls" field="error"` mit `condition type="lessThan" value="1" field="selections" scope="force" childId="735e-2da1-6356-2fdb" shared="true" includeChildSelections="true"`. Die einzigen weiteren Modifikatoren des Eintrags sind ein `increment` auf `a177-82fc-0b76-5b73` und ein `add`/`category` — **kein** `field="name"`. |
| **AMT-R2** | **Die rohe Fassung darf nicht erscheinen.** In derselben Meldungsliste darf **keine** Meldung mit dem unaufgeloesten Text (`… units of {this} than …`) stehen. Das ist die eigentliche Aussage von AMT-R1 — ohne sie waere „Text unveraendert uebernommen" und „Token ersetzt" nicht zu unterscheiden. | dasselbe `value`-Attribut wie AMT-R1. |
| **AMT-R3** | **Gegenprobe: haelt die Bedingung nicht, gibt es gar keine Meldung.** Steht eine Auswahl der Kategorie „Bully Bully" im Kontingent, ist die Zaehlung 1, `lessThan 1` ist falsch, und an der Gnoblars-Einheit liegt **keine** Autor-Meldung an (`authorMessages: []`, eine vollstaendige Aussage ueber den Slot). Traeger der Kategorie ist der Wurzel-`entryLink` „Ogre Bulls", der sie **unbedingt** per Modifikator vergibt — die Zaehlung muss also die **wirksamen** Kategorie-Links lesen ([`battlescribe-data-format.md`](../../battlescribe-data-format.md) §8). | Ogre-`.cat`, Z. 3133–3167: `entryLink name="Ogre Bulls" id="d82e-111e-89b9-2be1" targetId="7754-8b3d-df99-d2d5"` mit `<modifiers><modifier type="add" value="735e-2da1-6356-2fdb" field="category"/></modifiers>` (**ohne** `<conditions>`). Kategorie: Ogre-`.cat`, Z. 9: `categoryEntry id="735e-2da1-6356-2fdb" name="Bully Bully"`. Ziel des Verweises: Mercenaries-`.cat`, Z. 3438: `selectionEntry name="Ogre Bulls" id="7754-8b3d-df99-d2d5"`. Das Roster bindet an den **Verweis** (siehe oben). |
| **AMT-R4** | **Ein Text ohne Token bleibt woertlich.** Skrag the Slaughterer traegt die token-freie `error`-Meldung `Please enable "Allow special characters?"`. Sie erscheint Zeichen fuer Zeichen wie im `value`-Attribut (nach Aufloesung von `&quot;`) — sowohl im Faehigkeits-Datensatz des Slots als auch in der Meldungsliste. | Ogre-`.cat`, Z. 1001/1049: `selectionEntry name="Skrag the Slaughterer, Prohet of the Great Maw" id="82a9-0281-ffa1-2290"` → `modifier type="add" value="Please enable &quot;Allow special characters?&quot;" field="error"` mit `condition type="lessThan" value="1" field="selections" scope="force" childId="8923-5946-7b10-8957" includeChildSelections="true"`. (Derselbe Fall ist in [`author-message-severity`](../author-message-severity/README.md), AMS-R1/R6, bereits am Faehigkeits-Datensatz gepinnt; hier kommt die Aussage ueber die **Meldungsliste** dazu.) |

### Byte-Genauigkeit der behaupteten Texte

Katalogtexte dieser Datensaetze enthalten stellenweise **geschuetzte Leerzeichen**
(U+00A0), die von gewoehnlichen Leerzeichen nicht zu unterscheiden sind. Jeder
hier behauptete Text wurde deshalb mit einem Suchmuster aus **ausschliesslich
gewoehnlichen** Leerzeichen gegen die Fixture-Datei geprueft und genau einmal
gefunden:

| Behaupteter Baustein | Geprueftes Muster | Treffer |
|----------------------|-------------------|---------|
| AMT-R1/R2 | `value="You cannot have more units of {this} than you have units of Ogre Bulls" field="error"` | 1 (Ogre-`.cat`) |
| AMT-R1 (Name) | `name="Gnoblars" hidden="false" collective="false" import="true" type="unit"` | 1 (Ogre-`.cat`) |
| AMT-R4 (Name) | `id="82a9-0281-ffa1-2290"` → `name="Skrag the Slaughterer, Prohet of the Great Maw"` | 1 (Ogre-`.cat`) |

Der Tippfehler „Prohet" im Katalognamen bleibt **so stehen** — Namen sind
Katalogdaten, keine Prosa.

### Was dieses Szenario bewusst NICHT behauptet

- **`authorMessages` im Faehigkeits-Datensatz bei token-behafteten Texten.** Der
  Manifest-Vertrag beschreibt `capabilities[].authorMessages[].text` als
  „Katalogtext", `messages[].text` dagegen ausdruecklich als „Katalogtext,
  Text-Tokens wie `{this}` durch den effektiven Namen ersetzt". Ob beide
  Projektionen denselben Aufloesungsstand fuehren, ist damit **offen** — dieses
  Szenario behauptet `authorMessages` deshalb nur dort, wo der Text **kein**
  Token enthaelt (Roster 03) oder wo die Liste **leer** ist (Roster 02). Die
  Token-Aussage steht ausschliesslich in `messages`.
- **Die uebrigen sechs `{this}`-Vorkommen.** #2 und #3 haengen an der Amazone
  `9ddd-69c8-644d-abc2` und sind aus dem unten beschriebenen Grund nicht
  pruefbar; #4/#5 haengen an Eintraegen ohne Namens-Modifikator und wuerden
  AMT-R1 nur wiederholen; #6/#7 sind **mehrzeilige** Texte, deren Zeilenumbruch
  im `value`-Attribut steht und deren Bedingung zusaetzlich ein Punktebudget
  unter 2000 verlangt — sie waeren als byte-genaue Assertion unnoetig fragil.
- **Ein unbekanntes Token.** In allen fuenf Fixture-Dateien gibt es **kein**
  anderes Token als `{this}` (geprueft ueber `value="…{<Buchstabe>` — sieben
  Treffer, alle `{this}`). Die Regel „ein unbekanntes Token bleibt woertlich
  stehen" ist mit diesen Katalogdaten daher **nicht** pruefbar; sie wird hier
  weder behauptet noch widerlegt.
- **Die zaehlenden Grenzen der beteiligten Eintraege.** Gnoblars
  (`a177-82fc-0b76-5b73`, `max 0 scope=parent`) und Skrag
  (`2e16-3ee1-477f-acf5`, `max 0 scope=force`) feuern zusaetzlich. Ebenso die
  Grenze `32ed-26da-3f27-5c04`, die der Ogre-Bulls-Verweis selbst mitbringt. Das
  ist Thema von
  [`violation-classification`](../violation-classification/README.md); hier steht
  in jedem Roster `firing: []` und `absent: []`.

#### Dokumentierte Luecke: „wirksamer Name" im Token nicht pruefbar

Die Aussage „`{this}` nimmt den **wirksamen** Anzeigenamen (also den Namen nach
allen greifenden `field="name"`-Modifikatoren) und nicht den Katalog-`name`"
laesst sich mit diesen Fixtures **nicht** end-to-end pinnen. Sie wird hier weder
behauptet noch bestritten.

Grund: In allen fuenf Fixture-Dateien gibt es genau **einen** Fall, in dem ein
`field="name"`-Modifikator und eine `{this}`-Meldung in **derselben**
`modifierGroup` liegen — also zwingend unter derselben Bedingung stehen und
dadurch ueberhaupt gegeneinander messbar waeren: die Amazone
`9ddd-69c8-644d-abc2` („0-1 Amazon Serpent Priestess", Mercenaries-`.cat`
Z. 4702). Die Gruppe (Mercenaries-`.cat` Z. 4814–4841) enthaelt
`<modifier type="append" value="*" field="name"/>` und
`<modifier type="add" value="You need to provide another {this} …" field="warning"/>`.

Ihre Bedingung enthaelt jedoch eine `conditionGroup type="or"` (Z. 4827–4837),
deren **alle sieben** `condition`s `scope="primary-catalogue"` tragen:

```xml
<condition type="instanceOf" value="1" field="selections"
           scope="primary-catalogue" childId="4d73-5ab0-9020-403c" shared="true"/>
```

**Der urspruengliche Grund dieser Luecke ist mit Issue 077 entfallen.** Bis dahin
galt: `primary-catalogue` sei kein Bezugsrahmen, den die Datenlage aufloesen
koenne — es stand in keiner Aufzaehlung, und in den Fixtures gibt es auch kein
Element mit `id="primary-catalogue"` (0 Treffer). Daraus folgte, die
`modifierGroup` schweige in **jedem** Kontingent, gleich welcher Armeekatalog
fuehrt. Das trifft nicht mehr zu: der Rahmen bezeichnet das **Armeebuch des
umschliessenden Kontingents** und wird ausgewertet
([`battlescribe-data-format.md`](../../battlescribe-data-format.md),
§ „Constraint", Kasten *`scope="primary-catalogue"`*). Die sieben `condition`s
halten also genau dann, wenn das Kontingent aus einem der sieben genannten
Armeebuecher stammt (u. a. Vampire Counts, Orcs and Goblins, Tomb Kings) — von
denen in diesem Fixture-Satz nur Vampire Counts und Orcs and Goblins ueberhaupt
geladen sind.

Offen bleibt die Luecke trotzdem, aber aus einem **anderen** Grund: die
`modifierGroup` haengt an weiteren verschachtelten `conditionGroup`s — neben der
`or`-Gruppe u. a. an einem `limit::`-Punktelimit —, und ob ein Roster sie
zusammen sauber trifft, ist an den Daten noch nicht nachgewiesen. Das gehoert in
die Autorenschaft des Szenarios (ADR 0033), nicht in diese Notiz; sie behauptet
nur nicht mehr, der Fall sei **grundsaetzlich** nicht herstellbar.

Frueher lagen hier zwei Roster (`04-amazon-token-with-name-modifier` und
`05-amazon-plain-name-in-ogre`), die den Fall zu pinnen versuchten. Sie sind
entfernt: Roster 04 war gegen diese Katalogdaten nicht belegbar, und Roster 05
war zwar gruen, aber aus dem falschen Grund — es begruendete das Schweigen der
Gruppe mit der Katalog-Aufzaehlung (Ogre Kingdoms `731d-5b13-2a92-5427` fehlt
darin), waehrend sie damals am unaufloesbaren Scope schwieg. Heute waere gerade
diese Begruendung die richtige: mit einem Ogre-Kontingent haelt keine der sieben
`instanceOf`-Bedingungen, weil `731d-5b13-2a92-5427` nicht unter ihren `childId`s
steht.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle drei laufen
gegen `.gst` + Ogre-`.cat` (+ Mercenaries); es gibt keinen Dataset-Override.

> **Assertion-Fokus:** ausschliesslich die unten genannten Slots, Wortlaute und
> Schweregrade. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit,
> die `max 0`-Grenzen) treten zusaetzlich auf und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Token wird ersetzt | Ogre-Kontingent mit **einer Gnoblars-Einheit**, ohne „Bully Bully"-Auswahl. | **AMT-R1/R2:** An der Gnoblars-Einheit liegt **genau eine** Meldung des Katalog-Autors an: Schweregrad **error**, Text mit **„Gnoblars"** an der Stelle des Tokens. Die rohe Fassung mit `{this}` kommt **nullmal** vor. Der Slot heisst weiterhin schlicht „Gnoblars". | [`01-gnoblars-token-rendered.ros`](rosters/01-gnoblars-token-rendered.ros) |
| 02 | Gegenprobe: Bedingung faellt | Dasselbe Kontingent **plus** eine Einheit **Ogre Bulls**, gebunden an den Verweis `d82e-111e-89b9-2be1`, der per eigenem Modifikator die Kategorie „Bully Bully" traegt. | **AMT-R3:** An der Gnoblars-Einheit liegt **keine** Autor-Meldung mehr an (`[]`); **weder** die gerenderte **noch** die rohe Textfassung kommt in der Meldungsliste vor. | [`02-gnoblars-token-silent.ros`](rosters/02-gnoblars-token-silent.ros) |
| 03 | Text ohne Token bleibt woertlich | Ogre-Kontingent mit **Skrag**, ohne „Allow special characters?". | **AMT-R4:** Derselbe Wortlaut steht **sowohl** im Faehigkeits-Datensatz des Slots **als auch** in der Meldungsliste, beide Male Zeichen fuer Zeichen wie im Katalog — inklusive der Anfuehrungszeichen. | [`03-plain-message-untouched.ros`](rosters/03-plain-message-untouched.ros) |

### Herleitung der Bedingungen je Roster

Die Tabelle ist die Begruendung der Erwartung, nicht selbst eine Assertion:

| Roster | Modifikator | Bedingung (aus den Katalogdaten) | Zaehlung im Roster | haelt? | Wirkung |
|--------|-------------|----------------------------------|--------------------|--------|---------|
| 01 | `add error` an `1e26…` | `lessThan 1` `selections` `scope=force` `childId=735e-2da1-6356-2fdb` | 0 | ja | Meldung, `{this}` → „Gnoblars" |
| 02 | dieselbe | dieselbe | 1 (Ogre Bulls traegt die Kategorie per Modifikator **am Verweis**) | nein | keine Meldung |
| 03 | `add error` an `82a9…` | `lessThan 1` `selections` `scope=force` `childId=8923-5946-7b10-8957` | 0 | ja | Meldung, unveraenderter Text |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Element) |
|---------|-----|---------------------------|
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` | Ogre-`.cat` → `<forceEntries>` |
| Einheit „Gnoblars" (Traeger von `{this}`-Fall #1, **ohne** Namens-Modifikator) | `1e26-0d1a-bb3c-f47a` | Ogre-`.cat` → Wurzel-`<selectionEntries>` (Z. 16) |
| Kategorie „Bully Bully" (Schalter der Gnoblars-Meldung) | `735e-2da1-6356-2fdb` | Ogre-`.cat` → `<categoryEntries>` (Z. 9) |
| Wurzel-`entryLink` „Ogre Bulls" (vergibt „Bully Bully" **unbedingt**; im Roster 02 als `entryId` gebunden) → Ziel | `d82e-111e-89b9-2be1` → `7754-8b3d-df99-d2d5` | Ogre-`.cat` → `<entryLinks>` (Z. 3133; eigener `<modifiers>`-Block Z. 3164–3166) / Mercenaries-`.cat` (Z. 3438) |
| Eigene Grenze des Ogre-Bulls-Verweises (nicht behauptet) | `32ed-26da-3f27-5c04` (`min 0`, `scope=force`; per `set 1` der ersten `modifierGroup`) | Ogre-`.cat` → `<entryLinks>` (Z. 3161–3163) |
| Skrag the Slaughterer (Traeger der token-freien Meldung) | `82a9-0281-ffa1-2290` | Ogre-`.cat` → Wurzel-`<selectionEntries>` (Z. 1001) |
| „Allow special characters?" (Schalter der Skrag-Meldung) | `8923-5946-7b10-8957` | `.gst` |
| **Beleg der Luecke:** „0-1 Amazon Serpent Priestess" (einziger Traeger von `field="name"`-Modifikator **und** `{this}`-Meldung in derselben `modifierGroup`; **nicht** gepinnt) | `9ddd-69c8-644d-abc2` | Mercenaries-`.cat` → `<sharedSelectionEntries>` (Z. 4702), `modifierGroup` Z. 4814–4841 |
| **Beleg der Luecke:** `conditionGroup type="or"` aus sieben `condition … scope="primary-catalogue"` (der Rahmen ist seit Issue 077 aufloesbar — er benennt das Armeebuch des Kontingents; offen ist die Kombination mit den uebrigen Gruppen) | — (Bedingungen tragen keine Id; `childId`s u. a. `4d73-5ab0-9020-403c`, `4049-c46d-7f80-44fb`) | Mercenaries-`.cat` → Z. 4827–4837 |
| `catalogueLink` Ogre → Mercenaries | `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` | Ogre-`.cat` |
| Nicht behauptet: `max 0`-Grenzen Gnoblars / Skrag | `a177-82fc-0b76-5b73` / `2e16-3ee1-477f-acf5` | Ogre-`.cat` |
