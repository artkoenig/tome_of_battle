# E2E-Regeln & Testkatalog: `add info` / `add warning` am Kampagnen-Schalter

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind aus
den Katalogdaten der *6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
abgeleitet; das Eingabeformat der Roster folgt den bereits verifizierten
Fixtures (direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit
`number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f`
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`), per `catalogueLink` `b066-2f8e-11ee-1dce` aus dem
  Orcs-Katalog gefordert

## Worum es geht

Ein `<modifier type="add" field="info">` bzw. `field="warning"` traegt **keinen
Feldwert**, sondern einen **Klartext-Hinweis an den Spieler**; der Text steht im
`value`-Attribut ([Format-Doku
§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat),
Kasten *„`field="error"`/`"warning"`/`"info"` — Klartext-Hinweise an den
Spieler"*). `error` verhaelt sich wie ein regulaerer Regelverstoss, `warning`
und `info` sind **rein informativ**. Die Meldung erreicht den Bericht **genau
dann**, wenn die `<conditions>`/`<conditionGroups>` des Modifikators (bzw. seiner
`modifierGroup`) halten.

Der geteilte Eintrag **„0-1 Amazon Serpent Priestess"** (`9ddd-69c8-644d-abc2`,
Mercenaries-`.cat` Z. 4702, in `<sharedSelectionEntries>`) traegt **alle drei**
Schweregrade — und die `info`- und die `warning`-Meldung haengen an den
**komplementaeren Haelften desselben Schalters**, des `.gst`-Eintrags
**„Campaign: A Dark Conspiracy - 30th anniversary"** (`7d87-7436-5341-bbc0`):

```
info      atLeast  1  selections  scope=force  childId=7d87-7436-5341-bbc0
warning   lessThan 1  selections  scope=force  childId=7d87-7436-5341-bbc0   (+ oder-Gruppe primary-catalogue)
```

Ein und dasselbe Kontingent, variiert **nur** um diese eine Auswahl, muss also
einmal die `info` und einmal die `warning` zeigen — und jeweils die andere
nicht. Genau das pinnen Roster 01 und 02. Roster 03 nimmt zusaetzlich den
`error`-Schalter heraus.

### Warum das Kontingent aus dem Orcs-Katalog stammen muss

Die `warning`-Klammer haengt zusaetzlich an einer `conditionGroup type="or"` aus
**sieben** `condition type="instanceOf" … scope="primary-catalogue"`
(Mercenaries-`.cat` Z. 4827–4837). `primary-catalogue` ist **kein Zaehlrahmen**,
sondern eine **Identitaetspruefung auf das Armeebuch des umschliessenden
Kontingents** ([Format-Doku, Kasten
`scope="primary-catalogue"`](../../battlescribe-data-format.md#scope-primary-catalogue));
das Armeebuch kommt aus der **Herkunft der Force-Definition**, nicht aus dem
`catalogueId`-Attribut der `.ros`. Von den sieben genannten Katalog-Wurzel-Ids
sind in diesem Fixture-Satz nur zwei ueberhaupt ladbar:

| `childId` der `or`-Gruppe | Katalog | im Fixture-Satz? |
|---------------------------|---------|------------------|
| `4d73-5ab0-9020-403c` | Vampire Counts | ja |
| **`4049-c46d-7f80-44fb`** | **Orcs and Goblins** | **ja — hier gewaehlt** |
| `c817-890f-8aac-4ea5`, `d4c0-4f0c-4a89-40fc`, `6b83-a975-a500-41c3`, `cac6-5f02-f95d-a403`, `9945-8537-0944-c67b` | — | nein |

Gewaehlt ist die Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`, die im
Orcs-Katalog `4049-c46d-7f80-44fb` **deklariert** ist (Orcs-`.cat` Z. 47) — die
`or`-Gruppe haelt damit in allen drei Rostern. Dieselbe Force ist bereits in
[`primary-catalogue-scope`](../primary-catalogue-scope/README.md) (Roster 03)
als aufloesbarer `primary-catalogue`-Rahmen belegt.

### Bindung der Auswahl: direkt an die geteilte Definition

Die Priesterin wird per `entryId="9ddd-69c8-644d-abc2"` mit leerem
`entryLinkId` gebunden. Der Orcs-Katalog fuehrt zwar einen Wurzel-`entryLink`
auf sie (`338f-d678-568d-8d6b`, Orcs-`.cat` Z. 14849), aber der ist ein
**leeres** Element ohne eigene `constraints`, `costs` oder `modifiers` — es geht
durch die direkte Bindung nichts verloren. Umgekehrt gewinnt die Aussage: der
Slot traegt dann eindeutig die Definitions-Id `9ddd-69c8-644d-abc2`, an der die
Meldungs- und Namens-Modifikatoren haengen. Dasselbe Muster nutzen die Roster
von [`primary-catalogue-scope`](../primary-catalogue-scope/README.md) fuer
Mercenaries-Einheiten in fremden Armeebuechern.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **AIW-R1** | **`add info` erscheint genau dann, wenn seine Bedingung haelt.** Steht der Kampagneneintrag `7d87-7436-5341-bbc0` im Kontingent, liegt an der Priesterin **eine** Meldung vom Schweregrad **`info`** mit dem Wortlaut des `value`-Attributs an. Steht er nicht darin, liegt sie **nicht** an. | Mercenaries-`.cat` Z. 4784–4788: `<modifier type="add" value="During &quot;A Dark Conspiracy&quot; campaign, {this} if 3+ other Amazons, it may consume 2 Heroes (&lt;2000 pts) or Lord slot (2000+ pts)" field="info">` mit **genau einer** `<condition type="atLeast" value="1" field="selections" scope="force" childId="7d87-7436-5341-bbc0" shared="true" includeChildSelections="true"/>`. Der Modifikator steht in `<modifiers>`, also **ohne** weitere Klammer-Bedingung. |
| **AIW-R2** | **`add warning` erscheint genau dann, wenn die Bedingungen seiner `modifierGroup` halten** — hier: der Kampagneneintrag ist **nicht** gewaehlt **und** das Armeebuch des Kontingents ist eines der sieben genannten. Dann liegt an der Priesterin eine Meldung vom Schweregrad **`warning`** an. | Mercenaries-`.cat` Z. 4814–4841: `<modifierGroups><modifierGroup type="and">` mit `<modifier type="add" value="You need to provide another {this} for your opponent at no cost too (still takes Hero+Rare choice)" field="warning"/>`; Klammer-Bedingung `conditionGroup type="and"` aus `<condition type="lessThan" value="1" … scope="force" childId="7d87-7436-5341-bbc0" …/>` **und** der `conditionGroup type="or"` der sieben `instanceOf … scope="primary-catalogue"`. Eine `and`-Gruppe haelt nur, wenn **alle** Mitglieder halten ([Format-Doku §7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)). |
| **AIW-R3** | **`info` und `warning` sind komplementaer.** Beide Gatter pruefen **dasselbe** `childId` im **selben** Rahmen (`selections`, `scope="force"`), einmal mit `atLeast 1`, einmal mit `lessThan 1`. In keinem Kontingent koennen daher beide zugleich anliegen, und in einem Kontingent aus einem der sieben Armeebuecher liegt **immer genau eine** von beiden an. | dieselben zwei Bedingungen wie AIW-R1/R2. |
| **AIW-R4** | **Dieselbe Klammer bewegt zugleich den Namen.** In derselben `modifierGroup` wie die `warning`-Meldung steht `<modifier type="append" value="*" field="name"/>` — **ohne** `join`. Nach der Entscheidung dieses Projekts wird ohne Trennzeichen zusammengefuegt; der wirksame Anzeigename ist damit `0-1 Amazon Serpent Priestess*`, wenn die Klammer haelt, und `0-1 Amazon Serpent Priestess`, wenn nicht. | Mercenaries-`.cat` Z. 4817; Basisname Z. 4702 `name="0-1 Amazon Serpent Priestess"`. Die Regel „fehlt `join`, kein implizites Leerzeichen" samt Widerspruch zum BSData-Wiki steht in der [Format-Doku §7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) — sie nennt **genau diesen** Modifikator als den einen sichtbaren Fall im ganzen Fixture-Satz. Der Eintrag traegt **keinen** weiteren `field="name"`-Modifikator. |
| **AIW-R5** | **`{this}` wird durch den wirksamen Anzeigenamen des tragenden Eintrags ersetzt.** In der `info`-Meldung (Klammer haelt nicht) also durch `0-1 Amazon Serpent Priestess`, in der `warning`-Meldung (Klammer haelt) durch `0-1 Amazon Serpent Priestess*`. Die rohe Fassung mit `{this}` darf **nie** erscheinen. | Beide `value`-Attribute enthalten das Token (Mercenaries-`.cat` Z. 4784 / 4819). Die Aufloesungsstufe ist **nicht** aus den Katalogdaten ableitbar; sie folgt dem Manifest-Vertrag — siehe [„Entscheidung: wirksamer Name"](#entscheidung-wirksamer-name-im-token). |
| **AIW-R6** | **Der `error`-Modifikator desselben Eintrags ist ein dritter, unabhaengiger Schalter.** Er haengt an `lessThan 1` des `.gst`-Schalters „Allow special characters?" (`8923-5946-7b10-8957`, `scope="force"`). Ist der Schalter gewaehlt, schweigt er — deshalb steht er in Roster 01/02 im Kontingent. Sein Text traegt **kein** Token und bleibt woertlich. | Mercenaries-`.cat` Z. 4779–4783: `<modifier type="add" value="Please enable &quot;Allow special characters?&quot;" field="error">` mit `<condition type="lessThan" value="1" field="selections" scope="force" childId="8923-5946-7b10-8957" shared="true" includeChildSelections="true"/>`. Schalter-Definition: `.gst` Z. 1935, Wurzel-`selectionEntry`, `hidden="false"`. |
| **AIW-R7** | **Derselbe Schalter hebt die einzige zaehlende Grenze des Eintrags.** Die Priesterin traegt `max 0` (`scope="force"`), das per `set 1` auf 1 gehoben wird, sobald „Allow special characters?" im Kontingent steht. Mit Schalter ist **eine** Priesterin zulaessig (Ist 1, Grenze 1 — feuert nicht), ohne Schalter nicht (Ist 1, Grenze 0 — feuert). | Mercenaries-`.cat` Z. 4770–4772: `<constraint type="max" value="0" field="selections" scope="force" shared="true" id="f706-5d39-7bf7-5f7b" includeChildSelections="false"/>`; Z. 4774–4778: `<modifier type="set" value="1" field="f706-5d39-7bf7-5f7b">` mit `<condition type="atLeast" value="1" … childId="8923-5946-7b10-8957"/>`. |
| **AIW-R8** | **Der Eintrag ist in diesen Rostern nicht versteckt.** Sein Basiswert ist `hidden="false"`; der einzige `field="hidden"`-Modifikator setzt `true`, sobald „Border Patrols rules" (`4e15-0353-165f-5528`) **im Roster** steht. Diese Auswahl kommt in keinem der drei Roster vor. | Mercenaries-`.cat` Z. 4808–4812: `<modifier type="set" value="true" field="hidden">` mit `<condition type="atLeast" value="1" … scope="roster" childId="4e15-0353-165f-5528" … childName="Border Patrols rules"/>`. Da direkt an die Definition gebunden wird, gibt es keinen `entryLink`, dessen `hidden` sich per ODER dazumischen koennte ([Format-Doku §8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)). |

### Byte-Genauigkeit der behaupteten Texte

Katalogtexte dieser Datensaetze enthalten stellenweise **geschuetzte
Leerzeichen** (U+00A0). Jeder hier behauptete Text wurde deshalb mit einem
Suchmuster aus **ausschliesslich gewoehnlichen** Leerzeichen gegen die
Fixture-Datei geprueft und genau einmal gefunden:

| Behaupteter Baustein | Geprueftes Muster | Treffer |
|----------------------|-------------------|---------|
| AIW-R1 (`info`) | `During &quot;A Dark Conspiracy&quot; campaign, {this} if 3+ other Amazons, it may consume 2 Heroes (&lt;2000 pts) or Lord slot (2000+ pts)` | 1 (Mercenaries-`.cat`) |
| AIW-R2 (`warning`) | `value="You need to provide another {this} for your opponent at no cost too (still takes Hero+Rare choice)" field="warning"` | 1 (Mercenaries-`.cat`) |
| AIW-R4 (Basisname) | `name="0-1 Amazon Serpent Priestess"` | 1 (Mercenaries-`.cat`) |

Die XML-Entitaeten sind wie ueblich aufzuloesen: `&quot;` → `"`, `&lt;` → `<`.
Der Text der `info`-Meldung enthaelt also echte Anfuehrungszeichen um
*A Dark Conspiracy* und ein echtes `<` in `(<2000 pts)`.

#### Entscheidung: „wirksamer Name" im Token

Ob `{this}` den **Katalog**-`name` oder den **wirksamen** Namen (nach allen
greifenden `field="name"`-Modifikatoren) einsetzt, ist aus den Katalogdaten
**nicht** ableitbar — weder die `Catalogue.xsd` noch das BSData-Wiki noch die
Format-Doku sagen dazu etwas; das Token selbst ist nur durch die Daten belegt.
Das Schwester-Szenario
[`author-message-tokens`](../author-message-tokens/README.md) hat den Fall
deshalb als **dokumentierte Luecke** offengelassen und dabei genau diesen
Eintrag (`9ddd-69c8-644d-abc2`) als den einzigen Fixture-Fall benannt, an dem
sich beide Lesarten unterscheiden lassen.

Dieses Szenario schliesst die Luecke — und zwar in der Richtung, die der
**Manifest-Vertrag** vorschreibt: `messages[].text` ist dort „der Katalogtext,
Text-Tokens wie `{this}` durch den **effektiven** Namen ersetzt", und
`capabilities[].name` ist „der effektive Anzeigename **nach allen
Namens-Modifikatoren**". Daraus folgt fuer Roster 02/03 zwingend die
**gesternte** Fassung, denn `append "*"` und die `warning`-Meldung stehen in
**derselben** `modifierGroup` und halten damit immer gemeinsam.

Beide Lesarten sind im Manifest gegeneinander gestellt, nicht nur die gewaehlte:
die gesternte Fassung wird als **anliegend** behauptet, die ungesternte
**und** die rohe (`{this}`) mit `count: 0` als **abwesend**. Die Aussage ist
damit trennscharf und faellt sichtbar, falls die Engine den Katalog-Namen
einsetzt — das ist beabsichtigt, denn der Vertrag ist hier die Norm, nicht die
Beobachtung.

### Was dieses Szenario bewusst NICHT behauptet

- **Die Kostenwirkung derselben Klammer.** Die `modifierGroup` enthaelt neben
  `append "*"` und der `warning`-Meldung auch
  `<modifier type="set" value="0" field="ecfa-8486-4f6c-c249"/>` (Mercenaries-`.cat`
  Z. 4818), setzt die Punktekosten der Priesterin also von 235 auf 0 —
  passend zum Wortlaut *„for your opponent at no cost too"*. Der
  Manifest-Vertrag kennt zu einem Slot **keine** Kosten-Aussage
  (`capabilities[]` fuehrt `name`, `current`, `effectiveMin`/`Max`, `headroom`,
  `isHidden`, `isBlocked`, `isMandatoryUnmet`, `authorMessages`,
  `infoElements`); die zweite beobachtbare Wirkung der Klammer wird deshalb
  ueber **`name`** gepinnt und nicht ueber die Kosten. Ein Umweg ueber ein
  punktebezogenes Limit scheidet aus: der Eintrag traegt keine Kosten-Grenze,
  und die Roster setzen kein `costLimit`.
- **`capabilities[].authorMessages` bei token-behafteten Texten.** Der Vertrag
  beschreibt `capabilities[].authorMessages[].text` als „Katalogtext",
  `messages[].text` dagegen ausdruecklich als aufgeloesten Text. Ob beide
  Projektionen denselben Aufloesungsstand fuehren, ist offen; die
  Token-Aussagen stehen deshalb — wie in
  [`author-message-tokens`](../author-message-tokens/README.md) — ausschliesslich
  in `messages`.
- **Der `add category`-Modifikator der Priesterin.**
  `<modifier type="add" value="e94b-6a54-8779-cd60" field="category">`
  (Mercenaries-`.cat` Z. 4789–4807) haengt an einer `and`-Gruppe, deren
  Punktebedingung `atLeast 2000 limit::ecfa-8486-4f6c-c249 scope="roster"`
  in diesen Rostern nicht erfuellt ist (kein `costLimit` gesetzt). Er ist nicht
  Gegenstand des Szenarios und wird weder behauptet noch bestritten.
- **Die Pflicht-Aufwertung „Magic Level 3".** Der `entryLink`
  `66e3-7fc6-9f78-5535` unter der Priesterin traegt
  `min 1 scope="parent"` (`e1a9-04b4-cd05-0ca5`). Die Roster waehlen ihn nicht;
  die Grenze darf zusaetzlich feuern, ohne einen Fall zu brechen. Sie steht
  bewusst weder in `firing` noch in `absent` — die Roster sollen die
  Meldungs-Gatter isoliert zeigen.
- **Sichtbarkeit als Verletzung.** `hidden` (AIW-R8) gehoert nicht in den
  Verletzungsbericht; die Aussage steht als `isHidden` am
  Faehigkeits-Datensatz, **nicht** als feuernde Grenze.
- **Weitere Armeeaufbau-Diagnosen.** General-/Core-Pflicht des Orcs-Kontingents
  und aehnliche Grenzen treten zusaetzlich auf und sind hier ohne Belang.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle drei laufen
gegen `.gst` + Orcs-`.cat` + Mercenaries-`.cat`; es gibt keinen
Dataset-Override.

> **Assertion-Fokus:** die beiden Meldungen, der Slot-Name und die Grenze
> `f706-5d39-7bf7-5f7b`. Andere Diagnosen treten zusaetzlich auf.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kampagne gewaehlt → `info` | OG-Kontingent mit Schalter „Allow special characters?", Kampagneneintrag und **einer** Priesterin. | **AIW-R1/R3/R5:** An der Priesterin liegt genau die **`info`**-Meldung an, `{this}` durch **„0-1 Amazon Serpent Priestess"** ersetzt. Die **`warning`** liegt **nicht** an — weder gesternt noch ungesternt noch roh. Der Slot heisst schlicht „0-1 Amazon Serpent Priestess" (**AIW-R4**), die Force-Grenze feuert nicht (**AIW-R7**), die `error`-Meldung schweigt (**AIW-R6**). | [`01-campaign-selected-info-fires.ros`](rosters/01-campaign-selected-info-fires.ros) |
| 02 | Kampagne nicht gewaehlt → `warning` | **Dasselbe** Kontingent, **nur** ohne den Kampagneneintrag. | **AIW-R2/R3/R4/R5:** An der Priesterin liegt genau die **`warning`**-Meldung an, `{this}` durch **„0-1 Amazon Serpent Priestess\*"** ersetzt; der Slot-Name traegt dasselbe `*`. Die **`info`** liegt **nicht** an. Force-Grenze und `error` verhalten sich wie in 01. | [`02-campaign-absent-warning-fires.ros`](rosters/02-campaign-absent-warning-fires.ros) |
| 03 | Kontrolle: `error` + `warning` zugleich | Nur die Priesterin — weder Kampagneneintrag noch Schalter. | **AIW-R6/R7:** Am selben Slot liegen **zwei** Meldungen an: die blockierende **`error`**-Meldung (woertlich, ohne Token) **und** die informative **`warning`**. Zusaetzlich feuert die Force-Obergrenze `f706-5d39-7bf7-5f7b` mit **Ist 1 / Grenze 0**, weil der hebende `set 1` denselben Schalter verlangt. Die **`info`** schweigt. | [`03-no-toggle-error-and-warning.ros`](rosters/03-no-toggle-error-and-warning.ros) |

### Herleitung je Roster

Die Tabelle ist die Begruendung der Erwartung, nicht selbst eine Assertion:

| Roster | Gatter | Bedingung (aus den Katalogdaten) | Zaehlung im Roster | haelt? | Wirkung |
|--------|--------|----------------------------------|--------------------|--------|---------|
| 01 | `add info` | `atLeast 1` `selections` `scope=force` `childId=7d87-7436-5341-bbc0` | 1 | **ja** | `info`-Meldung, `{this}` → „0-1 Amazon Serpent Priestess" |
| 01 | `modifierGroup` (`append`/`set 0`/`add warning`) | `and(` `lessThan 1` auf `7d87…`, `or(7× instanceOf primary-catalogue)` `)` | 1 bzw. Armeebuch `4049…` | **nein** (erste Haelfte faellt) | kein `*`, keine `warning`, Kosten bleiben 235 |
| 01 | `add error` | `lessThan 1` `scope=force` `childId=8923-5946-7b10-8957` | 1 | nein | keine `error`-Meldung |
| 01 | `set 1` auf `f706-5d39-7bf7-5f7b` | `atLeast 1` auf `8923…` | 1 | ja | Grenze max 0 → **max 1**; Ist 1 ⇒ feuert nicht |
| 02 | `add info` | wie oben | 0 | nein | keine `info`-Meldung |
| 02 | `modifierGroup` | wie oben | 0 bzw. Armeebuch `4049…` | **ja** (beide Haelften) | `*` am Namen, `warning`-Meldung, `{this}` → „0-1 Amazon Serpent Priestess\*", Kosten 0 (nicht behauptet) |
| 02 | `add error` / `set 1` | wie oben | 1 | nein / ja | keine `error`-Meldung; Grenze max 1, Ist 1 ⇒ feuert nicht |
| 03 | `add info` | wie oben | 0 | nein | keine `info`-Meldung |
| 03 | `modifierGroup` | wie oben | 0 bzw. Armeebuch `4049…` | **ja** | `*` am Namen, `warning`-Meldung |
| 03 | `add error` | wie oben | 0 | **ja** | `error`-Meldung, woertlich |
| 03 | `set 1` auf `f706-5d39-7bf7-5f7b` | `atLeast 1` auf `8923…` | 0 | nein | Grenze bleibt **max 0**; Ist 1 ⇒ **feuert** (Ist 1 / Grenze 0) |

Die Zaehlung „Ist 1" der Grenze `f706-5d39-7bf7-5f7b` folgt der im Korpus
belegten Lesart einer eintragseigenen `scope="force"`-Grenze: gezaehlt werden
die Instanzen **dieses Eintrags** im Kontingent (vgl.
[`primary-catalogue-scope`](../primary-catalogue-scope/README.md), Roster 07:
`47d7-b2ed-39e9-0e60` feuert mit Ist 2 bei zwei Einheiten).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Element) |
|---------|-----|---------------------------|
| Force „Standard (OG-AB)" (bestimmt das Armeebuch des `primary-catalogue`-Rahmens) | `2bfa-e64a-7123-895f` | Orcs-`.cat` → `<forceEntries>` (Z. 47) |
| Katalog-Wurzel Orcs and Goblins (Treffer der `or`-Gruppe) | `4049-c46d-7f80-44fb` | Orcs-`.cat` → `<catalogue>` (Z. 2) |
| Katalog-Wurzel Mercenaries (`library="true"`) | `fc47-8392-a6c8-452a` | Mercenaries-`.cat` → `<catalogue>` (Z. 2) |
| `catalogueLink` Orcs → Mercenaries | `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` | Orcs-`.cat` (Z. 14916) |
| „0-1 Amazon Serpent Priestess" (Traeger aller drei Meldungen) | `9ddd-69c8-644d-abc2` | Mercenaries-`.cat` → `<sharedSelectionEntries>` (Z. 4702) |
| `modifier add` `field="info"` (Wortlaut mit `{this}`) | — (Modifikatoren tragen keine Id) | Mercenaries-`.cat` Z. 4784–4788 |
| `modifierGroup type="and"` mit `append "*"` / `set 0` auf `ecfa-8486-4f6c-c249` / `modifier add` `field="warning"` | — | Mercenaries-`.cat` Z. 4814–4841 (Modifikatoren Z. 4817/4818/4819) |
| `conditionGroup type="or"` aus 7× `instanceOf … scope="primary-catalogue"` | — (`childId`s u. a. `4d73-5ab0-9020-403c`, `4049-c46d-7f80-44fb`) | Mercenaries-`.cat` Z. 4827–4837 |
| `modifier add` `field="error"` (token-freier Wortlaut) | — | Mercenaries-`.cat` Z. 4779–4783 |
| Force-Obergrenze der Priesterin (`max 0`, per `set 1` gehoben) | `f706-5d39-7bf7-5f7b` | Mercenaries-`.cat` Z. 4771 (Modifikator Z. 4774–4778) |
| Kampagnen-Schalter „Campaign: A Dark Conspiracy - 30th anniversary" (Wurzel-Eintrag, `hidden="false"`) | `7d87-7436-5341-bbc0` | `.gst` → Wurzel-`<selectionEntries>` (Z. 2313) |
| Dessen eigene Obergrenzen (nicht verletzt) | `1dce-916d-88c8-bada` (`max 1`, `scope=parent`) / `c654-8498-0ed5-e41a` (`max 1`, `scope=force`) | `.gst` Z. 2315–2316 |
| Schalter „Allow special characters?" (Wurzel-Eintrag, `hidden="false"`) | `8923-5946-7b10-8957` | `.gst` → Wurzel-`<selectionEntries>` (Z. 1935) |
| Dessen Roster-Obergrenze (nicht verletzt) | `5036-e10c-2fd8-f135` (`max 1`, `scope=roster`) | `.gst` Z. 1937 |
| „Border Patrols rules" (Schalter des `hidden`-Modifikators; in keinem Roster gewaehlt) | `4e15-0353-165f-5528` | Mercenaries-`.cat` Z. 4810 (`childName="Border Patrols rules"`) |
| Wurzel-`entryLink` der Priesterin im Orcs-Katalog (leer; **nicht** gebunden) | `338f-d678-568d-8d6b` → `9ddd-69c8-644d-abc2` | Orcs-`.cat` → `<entryLinks>` (Z. 14849) |
| Nicht behauptet: Pflicht-`entryLink` „Magic Level 3" unter der Priesterin | `66e3-7fc6-9f78-5535`, Grenze `e1a9-04b4-cd05-0ca5` (`min 1`, `scope=parent`) | Mercenaries-`.cat` Z. 4716–4723 |
| Nicht behauptet: `add category` der Priesterin (Punktebedingung ≥ 2000 nicht erfuellt) | Ziel-Kategorie `e94b-6a54-8779-cd60` | Mercenaries-`.cat` Z. 4789–4807 |
| Kategorien der Priesterin (im Roster gespiegelt) | `ee09-9a50-ad78-9c32` (primaer), `0644-bfcd-32c2-21dc`, `c16b-f319-2c62-2c12`, `7a1c-d611-c2dc-def1`, `892e-1d2b-85e9-47f5` | Mercenaries-`.cat` Z. 4708–4714 |
