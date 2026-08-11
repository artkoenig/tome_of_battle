# E2E-Regeln & Testkatalog: `append` auf ein **Merkmal** (`field` = `characteristicType`-Id) mit `join`

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln, IDs und
Erwartungstexte sind **ausschliesslich** aus den Katalogdaten der *6th Definitive
Edition*, aus der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.3 / §7.7)
und aus der vendorten [`Catalogue.xsd`](../../../src/parser/schema/Catalogue.xsd)
abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
(direktes `entryId`, `entryLinkId`, `entryGroupId` an Gruppen-Mitgliedern,
verschachtelte `selections` mit `number`) nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1),
  dazu die per `catalogueLink` (`ef73-f9bd-e250-54d2`, Z. 29511) benoetigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Merkmalstexte sind **keine** zaehlende Schranke; sie erscheinen
> nicht im Verletzungsbericht. Die Kernaussage ist je Roster ein
> `expect.capabilities[].infoElements[].characteristics[]`-Eintrag — exakte
> Zeichenkettengleichheit auf dem **effektiven** Merkmalswert. `firing` bleibt in
> beiden Rostern leer; `absent` pinnt nur jene Grenzen, die in diesen Aufbauten
> nachweislich still bleiben. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht,
> die unerfuellten Pflicht-Unterauswahlen beider Zauberer, Punktelimit) duerfen
> zusaetzlich auftreten und sind hier ohne Belang (selektive Erwartung).

---

## Was die Formatspezifikation ueber `append` + `join` sagt

Woertlich aus [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat),
Tabelle *`modifier`-Attribut*:

- `type="append"` ist eine **Text**-Operation; `value` ist „der anzufuegende Text".
- `field` darf eine `<characteristicTypeId>` sein — dann ist das Ziel der Wert
  genau dieses Merkmals (§5.4 definiert die Ids, §7.3 den Merkmalstext als
  **Textinhalt** des `<characteristic>`).
- `join` ist das „Trennzeichen zwischen dem bestehenden Namen und dem
  angehaengten/vorangestellten Text. **Wird verbatim uebernommen, nicht
  angenommen**". Fehlt es, wird ohne Trennzeichen zusammengefuegt.
- Ein Modifikator greift nur, wenn seine `<conditions>` halten.

Dazu §7.7, Kasten
[`scope="unit"`/`scope="ancestor"`](../../battlescribe-data-format.md#scope-unit-ancestor):
`unit` ist der **naechste Vorfahre mit `type="unit"`** — den Traeger der Query
eingeschlossen; Gruppen und Verweise unterbrechen die Suche nicht. `instanceOf`
ist eine **Pruefung**, keine Zaehlung; die Zaehl-Flags (`shared`,
`includeChildSelections`) verengen sie nicht, und `percentValue` ist laut Wiki
bei `instanceOf` wirkungslos.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Alle Zeilenangaben beziehen sich auf `Vampire Counts (6th definitive edition).cat`,
sofern nicht anders vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ACZ-R1** | **Beide `append`-Konstrukte auf einem Merkmalsfeld sitzen am selben geteilten Profil.** Das Spruchprofil *1. Invocation of Nehek* liegt in `<sharedProfiles>` und traegt drei eigene `<modifiers>`; zwei davon sind `type="append"` auf ein Merkmalsfeld. | `profile name="1. Invocation of Nehek" typeId="07eb-6084-5f84-a505" typeName="Spell" id="6484-4a1a-e62b-2ce1"` (Z. 27094–27124). `<modifiers>` Z. 27107–27123: `set "24\"" field="42e6-553f-842f-0b91"` (Z. 27108), `append field="7d21-349e-b0a8-fc7d"` (Z. 27113), `append field="f1e6-8816-26e0-8a70"` (Z. 27118). |
| **ACZ-R2** | **Beide sind auf dieselbe einzige Bedingung gegatet: die umschliessende Einheit muss Zacharias sein.** | Z. 27115 und Z. 27120, zeichengleich: `<condition type="instanceOf" value="1" field="selections" scope="unit" childId="1c05-5813-2f0c-f878" shared="true" includeChildSelections="false"/>`. `1c05-5813-2f0c-f878` ist `selectionEntry name="Zacharias the Everliving" … type="unit"` (Z. 4851). Der Traeger der Query ist das Profil-Vorkommen; sein naechster `unit`-Vorfahre ist die Einheit, unter der die *Lore of Necromancy* haengt. |
| **ACZ-R3** | **Der `join`-Trenner ist ein gewoehnliches Leerzeichen (U+0020), kein NBSP.** Er wird verbatim uebernommen — genau **ein** Zeichen. | Eine Suche nach `join=` in dieser Datei liefert **34** Fundstellen. Genau **2** davon tragen ein gewoehnliches Leerzeichen (`join=" "`, U+0020): Z. 27113 und Z. 27118. Die uebrigen 32 tragen ein geschuetztes Leerzeichen (U+00A0) — 20-mal allein stehend (`join="&#160;"`), 12-mal als `join="&#160;+&#160;"` — und haengen an `field="name"`. Keine dieser 32 Fundstellen liegt im Bereich Z. 27094–27124. Die Datei enthaelt **kein** `\r`: die Zeilenenden sind LF, mehrzeilige Merkmalstexte also mit `\n` getrennt. |
| **ACZ-R4** | **Der Basistext des Merkmals *Effect* endet NICHT mit einem Zeilenumbruch.** Die letzte Tabellenzeile wird unmittelbar von `</characteristic>` beendet. Folglich landet die angehaengte 15+-Zeile **in derselben Textzeile** wie die 11+-Zeile, getrennt nur durch das eine Leerzeichen. | Z. 27101–27105: das `<characteristic name="Effect" typeId="7d21-349e-b0a8-fc7d">` oeffnet in Z. 27101 direkt vor `\|Casting Value\|…` und schliesst in Z. 27105 direkt hinter `…\|3 Wounds\|`. Kein fuehrender/nachfolgender Leerraum; die Fortsetzungszeilen 27102–27105 stehen ohne Einrueckung in Spalte 0. |
| **ACZ-R5** | **`append` veraendert genau das im `field` genannte Merkmal.** Alle uebrigen Merkmale desselben Vorkommens bleiben auf ihrem Basiswert. | Am Profil haengen ausser den beiden `append`s nur der `set`-Modifikator auf *Range* (Z. 27108). Der `infoLink cb2b-7a42-2b40-f03d` (Z. 13735) ist ein leeres Element **ohne** eigene `<modifiers>`; das Vorkommen erbt also keine weiteren Merkmals-Modifikatoren. |
| **ACZ-R6** | **Kontrolle *Range*: der Nachbar-`set` haelt in keinem der beiden Roster.** Seine Bedingung ist `atLeast 1 field="selections" scope="unit" childId="e5b7-4a3d-b074-24ad"`; `e5b7-4a3d-b074-24ad` ist der `entryLink "Master of the Black Arts"` in Zacharias' Gruppe *Bloodline (Necrarch)*. Keines der beiden Roster waehlt ihn (beim Necromancer existiert er gar nicht) → Ist 0 < 1. *Range* bleibt in beiden Rostern `18"`. | Bedingung Z. 27110; `entryLink import="true" name="Master of the Black Arts" … id="e5b7-4a3d-b074-24ad" targetId="e980-978b-d5c6-b04a"` Z. 5008 in der Gruppe `6d91-a6ae-2f91-20fd` (Z. 4985). Basiswert `<characteristic name="Range" …>18&quot;</characteristic>` Z. 27097. |
| **ACZ-R7** | **Beide Roster erreichen dasselbe Profil-Vorkommen ueber denselben Weg.** Der Eintrag *Lore of Necromancy* traegt eine `infoGroup`, deren `infoLink` auf das Profil zeigt; das Vorkommen wird damit unter der Id des **Verweises** gefuehrt. | `selectionEntry type="upgrade" name="Lore of Necromancy" id="f7e9-c0a4-549e-33e0"` (Z. 13722) → `infoGroup name="Spells rules" id="4489-d8e2-ff78-1a27" hidden="false"` (Z. 13727) → `infoLink name="1. Invocation of Nehek" id="cb2b-7a42-2b40-f03d" hidden="false" type="profile" targetId="6484-4a1a-e62b-2ce1"` (Z. 13735). Zacharias zieht den Eintrag per `entryLink 8634-66c5-4d08-03fb` (Z. 4901), der Necromancer per `entryLink 9958-1cdd-fdc9-3781` (Z. 2589) herein. |
| **ACZ-R8** | **Der Necromancer ist ein sauberes Gegenstueck.** Er ist `type="unit"`, traegt dieselbe Lore und ist im Kontingent *Standard (VC-AB)* nicht versteckt; seine Definitions-Id, seine Kategorien und sein roher Typ sind allesamt nicht `1c05-5813-2f0c-f878`. | `selectionEntry id="b5d8-db21-a4b7-9e94" name="Necromancer" … type="unit"` (Z. 2485), `categoryLinks` Z. 2508–2509 (`Heroes` `c16b-f319-2c62-2c12` primaer, `Characters` `7a1c-d611-c2dc-def1`). Sein `set hidden="true"`-Modifikator (Z. 2687–2698) ist auf vier **andere** Kontingente gegatet; `e989-15b8-7eb6-9668` ist keines davon. |
| **ACZ-R9** | **Zacharias ist im Roster legal waehlbar.** Seine armeeweite Grenze `max 0` wird durch den Schalter *Allow special characters?* auf 1 gehoben; damit ist Ist 1 = Grenze 1. | `constraint field="selections" scope="roster" value="0" … id="f74f-ffa2-0ea8-22cb" type="max"` (Z. 4853) und `modifier type="set" value="1" field="f74f-ffa2-0ea8-22cb"` mit `condition atLeast 1 scope="force" childId="6411-4be3-864f-a963"` (Z. 5061–5065). `6411-4be3-864f-a963` ist der VC-Wurzel-`entryLink` auf den `.gst`-Eintrag `8923-5946-7b10-8957` (Z. 29575; `.gst` Z. 1935); seine eigene Grenze `9149-ce10-44d6-2d99` ist `min 0` (Z. 29577). Das Roster fuehrt die Auswahl mit `entryId="8923-5946-7b10-8957"` **und** `entryLinkId="6411-4be3-864f-a963"`, trifft also beide Schreibweisen der `childId`. |
| **ACZ-R10** | **Das von keiner Quelle spezifizierte Attribut `position="-1"` ist wirkungslos.** Der zweite `append` verhaelt sich exakt so, wie §7.7 es fuer `type="append"` beschreibt — Basistext + `join` + `value` —, als traege er das Attribut nicht. Auf *Cast* ergibt das bei Zacharias `3+/7+/11+ /15+`. | `modifier type="append" value="/15+" field="f1e6-8816-26e0-8a70" join=" " position="-1"` (Z. 27118), Basiswert `<characteristic name="Cast" typeId="f1e6-8816-26e0-8a70">3+/7+/11+</characteristic>` (Z. 27096). Grundlage der Regel ist der Wartungsentscheid vom **2026-08-11** (siehe Abschnitt *Das Attribut `position="-1"`*), nicht eine Fundstelle in Formatdoku, Wiki oder XSD — dort ist das Attribut unbekannt. |

### ACZ-R3/R4 im Detail — die erwarteten Zeichenketten

**Basistext des Merkmals *Effect*** (`7d21-349e-b0a8-fc7d`, Z. 27101–27105), Zeichen
fuer Zeichen; `⏎` markiert ein LF, `␣` ein einzelnes U+0020 an einer sonst schwer
lesbaren Stelle:

```
|Casting Value|Models Created|Wounds Restored|⏎
|---|---|---|⏎
| 3+|D6 Skeletons or D6+1 Zombies␣|1 Wound|⏎
| 7+|2D6 Skeletons or 2D6+2 Zombies|2 Wounds|⏎
| 11+|3D6 Skeletons or 3D6+3 Zombies|3 Wounds|
```

Beachtenswert und aus den Rohdaten uebernommen: in der `3+`-Zeile steht **vor**
`|1 Wound|` ein zusaetzliches Leerzeichen (`Zombies |1 Wound|`), in den beiden
anderen Datenzeilen nicht. Nach `|3 Wounds|` folgt **kein** Zeilenumbruch, sondern
unmittelbar `</characteristic>`.

**Anzuhaengender Text** (Z. 27113): `| 15+|4D6 Skeletons or 4D6+4 Zombies|4 Wounds|`
**Trenner**: `join=" "` → ein einzelnes U+0020.

**Ergebnis bei Zacharias** — der neue Eintrag setzt die letzte Zeile fort, er
beginnt **keine** neue:

```
|Casting Value|Models Created|Wounds Restored|⏎
|---|---|---|⏎
| 3+|D6 Skeletons or D6+1 Zombies |1 Wound|⏎
| 7+|2D6 Skeletons or 2D6+2 Zombies|2 Wounds|⏎
| 11+|3D6 Skeletons or 3D6+3 Zombies|3 Wounds| | 15+|4D6 Skeletons or 4D6+4 Zombies|4 Wounds|
```

Als Markdown-Tabelle gelesen ist das **kaputt** — die vierte Datenzeile haengt an
der dritten. Das ist trotzdem die Erwartung: `join` wird verbatim uebernommen und
ist hier ein Leerzeichen, kein `\n`. Waere ein Zeilenumbruch gemeint, muesste er
im `join` stehen. Eine Engine, die stattdessen einen Umbruch einfuegt (etwa weil
sie den Zieltext als Tabelle erkennt), waere zu **untersuchen**, nicht die
Erwartung anzupassen.

---

## Das Attribut `position="-1"` — Befund und Entscheid

Der zweite `append` (Z. 27118) lautet vollstaendig:

```xml
<modifier type="append" value="/15+" field="f1e6-8816-26e0-8a70" join=" " position="-1">
```

### Der Befund: keine Quelle kennt das Attribut

| Quelle | Befund |
|--------|--------|
| [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) §7.7 | Die Attributtabelle des `modifier` kennt `type`, `field`, `value`, `join`. `position` kommt im ganzen Dokument nicht vor. |
| BSData-Catalogue-Development-Wiki (Submodul) | Ein einziger Treffer fuer „position", und der steht im *Data-Admin-Guide* ueber die alphabetische Einsortierung eines Repository-Links — nichts zum Datenformat. |
| Vendorte [`Catalogue.xsd`](../../../src/parser/schema/Catalogue.xsd) | `complexType "Modifier"` (Z. 482–495) deklariert **genau vier** Attribute: `type`, `field`, `value` (alle `use="required"`) und das laut ADR 0016 bewusst ergaenzte `join` (`use="optional"`). Es gibt **kein** `anyAttribute`. Das Element ist damit gegen die Konformitaetsquelle schema-**ungueltig**; der Schema-Schritt ist laut §2 beratend und blockiert den Import nicht. |
| Die Fixture-Kataloge selbst | `position` als Attribut kommt in allen fuenf Datendateien **genau einmal** vor: in dieser Zeile. Es gibt keine zweite Fundstelle, aus der sich die Bedeutung durch Vergleich erschliessen liesse. |

### Der Entscheid (2026-08-11)

Der Maintainer hat entschieden — und dieser Entscheid ist ab hier Teil der Regel,
aus der dieses Szenario ableitet:

> `position="-1"` ist ein **Datenfehler**. Die Auswertung ignoriert das Attribut
> vollstaendig. Der `append` wirkt damit **genau so**, wie
> [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) §7.7 es
> fuer `type="append"` beschreibt: der `value` des Modifikators wird an den Text
> des im `field` genannten Merkmals des Profil-Vorkommens angehaengt, an dem der
> Modifikator haengt, getrennt durch das **verbatim** uebernommene `join`. Die
> vendorte `Catalogue.xsd` bleibt unveraendert.

Die hinzugefuegte Zusicherung pinnt damit eine Aussage, die staerker ist als „wir
haben uns fuer eine Lesart entschieden": **ein Attribut, das keine Quelle
spezifiziert, ist inert** — es darf die Auswertung in **keiner** Weise
veraendern, weder den Zieltext noch die Reihenfolge der Modifikatoren.

### Die abgeleitete Zeichenkette fuer *Cast*

| Bestandteil | Wert | Beleg |
|-------------|------|-------|
| Basiswert des Merkmals *Cast* | `3+/7+/11+` | Z. 27096: `<characteristic name="Cast" typeId="f1e6-8816-26e0-8a70">3+/7+/11+</characteristic>` — kein fuehrender/nachfolgender Leerraum, Textinhalt beginnt direkt hinter `>` und endet direkt vor `</characteristic>`. |
| Trenner | ein einzelnes U+0020 | Z. 27118: `join=" "` — dieselbe Sorte Leerzeichen wie beim *Effect*-`append` (ACZ-R3), **kein** NBSP. |
| Anzuhaengender Text | `/15+` | Z. 27118: `value="/15+"` — vier Zeichen, keine Entity-Ersetzung noetig. |
| Attribut `position="-1"` | wirkungslos | Entscheid 2026-08-11, ACZ-R10. |

Daraus folgt Zeichen fuer Zeichen (`␣` = U+0020):

```
3+/7+/11+␣/15+
```

- **Roster 01 (Zacharias, Bedingung haelt):** `3+/7+/11+ /15+` — vierzehn Zeichen.
- **Roster 02 (Necromancer, Bedingung haelt nicht):** `3+/7+/11+` — der
  unveraenderte Basiswert; ein Modifikator, dessen Bedingung nicht haelt,
  veraendert nichts.

Gelesen als Aufzaehlung von Sprungwerten ist `3+/7+/11+ /15+` — mit dem
Leerzeichen mitten in der Liste — **unschoen**, genau wie die kaputte
*Effect*-Tabelle aus ACZ-R4. Auch hier gilt: `join` wird verbatim uebernommen.
Eine Engine, die das Leerzeichen unterdrueckt (etwa weil sie den Zieltext als
Werteliste erkennt) oder die `/15+` wegen `position="-1"` an anderer Stelle
einfuegt, ist zu **untersuchen**, nicht die Erwartung anzupassen.

Auf das Merkmal *Effect* wirkt sich die Frage ohnehin **nicht** aus: sein `append`
(Z. 27113) traegt kein `position`, und die beiden Modifikatoren adressieren
verschiedene Merkmale, koennen sich also auch ueber keine Reihenfolge-Lesart
beeinflussen.

Damit ist der zweite `append` **vollstaendig** abgedeckt: seine **Bedingung**
(greift / greift nicht) ueber den Vergleich beider Roster, seine **Wirkung** ueber
die *Cast*-Zusicherung in Roster 01.

---

## Bewusst nicht festgenagelte Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `isHidden` der *Lore of Necromancy*-Slots | Beide Traegergruppen — `3240-32da-ecd5-ee0f` (Zacharias, Z. 4896) und `82b0-b07e-fc26-a50a` (Necromancer, Z. 2584) — sind `hidden="true"`. Nach §8 versteckt eine verborgene `selectionEntryGroup`, was sie haelt; die Slots waeren also in **beiden** Rostern verborgen. Das ist Sichtbarkeitslogik und Gegenstand von `unit-scope-instance-of-category`, nicht dieses Szenarios — deshalb keine `isHidden`-Aussage. Der `infoLink` selbst ist `hidden="false"` (Z. 13735), sein Vorkommen darf also in der Info-Projektion stehen. |
| Die **Bedeutung** von `position` als Attribut | Das Szenario pinnt nur, dass das Attribut **inert** ist (ACZ-R10). Es sagt nichts darueber, wie ein `position` mit anderem Wert oder an einem anderen Modifikatortyp zu behandeln waere — dafuer gibt es weder eine Quelle noch eine zweite Fundstelle im Korpus. |
| `type="prepend"` auf ein Merkmalsfeld | Kommt in den Fixture-Katalogen kein einziges Mal vor. |
| `append` **ohne** `join` auf ein Merkmalsfeld | Der einzige `join`-lose `append` des Korpus haengt an `field="name"` (`Mercenaries`-`.cat`); auf einem Merkmalsfeld existiert keiner. |
| Die unerfuellten Pflicht-Unterauswahlen beider Zauberer | Beide Roster sind bewusst minimal (siehe Kommentare in den `.ros`). Die entstehenden `min`-Verletzungen sind fuer die Merkmalsaussagen ohne Belang und stehen weder in `firing` noch in `absent`. |
| Der Verletzungsbericht als Traeger der Regel | Ein Merkmalstext ist keine zaehlende Schranke; aus ACZ-R1…R10 wird **keine** feuernde Grenze erwartet. `firing` ist in beiden Rostern leer. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster sind
**bis auf die tragende Einheit identisch**: Kontingent *Standard (VC-AB)*
(`e989-15b8-7eb6-9668`), der Schalter *Allow special characters?* und ein Zauberer
mit genau einer Unterauswahl, der *Lore of Necromancy*. Genau dieser eine
Unterschied ist der Ausloeser.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Bedingung **haelt** → beide `append`s greifen | **Zacharias the Everliving** (`1c05-5813-2f0c-f878`) mit *Lore of Necromancy*. | **ACZ-R2/R3/R4:** Das Merkmal *Effect* des Spruchprofils traegt die vierte Tabellenzeile — angehaengt an die 11+-Zeile, getrennt durch **ein** Leerzeichen, **ohne** Zeilenumbruch. **ACZ-R10:** *Cast* steht auf `3+/7+/11+ /15+`; `position="-1"` bleibt wirkungslos. **ACZ-R6:** *Range* bleibt `18"`. Keine der gepinnten Grenzen feuert. | [`01-zacharias-append-fires.ros`](rosters/01-zacharias-append-fires.ros) |
| 02 | Bedingung **haelt nicht** → Basistext | **Necromancer** (`b5d8-db21-a4b7-9e94`) mit derselben *Lore of Necromancy*. | **ACZ-R8:** Der `scope="unit"`-Rahmen ist der Necromancer, beide `instanceOf`-Bedingungen halten nicht. *Effect* steht auf dem fuenfzeiligen Basistext, *Cast* auf `3+/7+/11+`, *Range* auf `18"`. Keine der gepinnten Grenzen feuert. | [`02-necromancer-append-silent.ros`](rosters/02-necromancer-append-silent.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Texte treffen die Engine erst im
**Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehoert (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemaess heiklen Stellen:

1. **ACZ-R4** — ob der Trenner wirklich verbatim ein Leerzeichen bleibt und nicht
   zu einem Zeilenumbruch „verschoenert" wird. Das Ergebnis ist als Markdown-Tabelle
   sichtbar defekt; genau das steht aber in den Daten.
2. **ACZ-R2** — ob die `instanceOf`-Pruefung mit `scope="unit"` eine `childId`
   aufloest, die eine **Einheiten-Definitions-Id** ist (nicht, wie in
   `unit-scope-instance-of-category`, eine Kategorie-Id).
3. **ACZ-R6** — ob der nicht gewaehlte, aber per `min 1` **pflichtige** Eintrag
   *Master of the Black Arts* (`e5b7-4a3d-b074-24ad`) im `scope="unit"`-Rahmen als
   **0** zaehlt. Ein Pflicht-Platzhalter ist keine getroffene Auswahl; zaehlte er
   mit, spraenge *Range* faelschlich auf `24"`.
4. **ACZ-R9** — ob die `childId` einer Bedingung auch dann greift, wenn sie die
   Id eines `entryLink`s (`6411-4be3-864f-a963`) statt der Ziel-Id nennt; das
   Roster fuehrt beide Ids an derselben Auswahl.
5. **ACZ-R10** — ob das unbekannte Attribut `position="-1"` tatsaechlich spurlos
   ignoriert wird. Weicht *Cast* in Roster 01 von `3+/7+/11+ /15+` ab, wertet die
   Engine ein Attribut aus, das keine Quelle spezifiziert — das waere ein Befund
   an der Engine, kein Anlass, die Erwartung zu aendern.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Kontingent „Standard (VC-AB)" | `e989-15b8-7eb6-9668` (Z. 29297) |
| Geteiltes Profil „1. Invocation of Nehek" (Traeger beider `append`s) | `6484-4a1a-e62b-2ce1` (Z. 27094) |
| `profileType` „Spell" (`.gst`) | `07eb-6084-5f84-a505` (`.gst` Z. 197) |
| Merkmal *Cast* / *Range* / *Effect* (`.gst`) | `f1e6-8816-26e0-8a70` (Z. 199) / `42e6-553f-842f-0b91` (Z. 200) / `7d21-349e-b0a8-fc7d` (Z. 204) |
| Basiswert des Merkmals *Cast* am Profil | `3+/7+/11+` (Z. 27096) |
| `append` auf *Effect*, `join=" "` | Z. 27113, Bedingung Z. 27115 |
| `append` auf *Cast*, `value="/15+"`, `join=" "` **und** `position="-1"` (wirkungslos, ACZ-R10) | Z. 27118, Bedingung Z. 27120 |
| `set "24\""` auf *Range* (Kontrolle) | Z. 27108, Bedingung Z. 27110 (`childId="e5b7-4a3d-b074-24ad"`) |
| Einheit „Zacharias the Everliving" (`childId` beider Bedingungen) | `1c05-5813-2f0c-f878` (Z. 4851) |
| Einheit „Necromancer" (Gegenprobe) | `b5d8-db21-a4b7-9e94` (Z. 2485) |
| Eintrag „Lore of Necromancy" (Traeger der `infoGroup`) | `f7e9-c0a4-549e-33e0` (Z. 13722), Grenze `max 1 parent` = `17fe-00e4-f83e-ad6e` (Z. 13724) |
| `infoGroup` „Spells rules" / `infoLink` auf das Spruchprofil | `4489-d8e2-ff78-1a27` (Z. 13727) / `cb2b-7a42-2b40-f03d` (Z. 13735) |
| `entryLink` Lore bei Zacharias (Slot-`defId` Roster 01) | `8634-66c5-4d08-03fb` (Z. 4901), eigene Grenze `min 1 parent` = `629d-e0ba-6ead-f0ef` (Z. 4903) |
| Gruppe „Lores of Magic" bei Zacharias (`hidden="true"`, `max 1`) | `3240-32da-ecd5-ee0f` (Z. 4896) — Grenze `1f96-fe8f-c0cc-9bc7` (Z. 4898) |
| `entryLink` Lore beim Necromancer (Slot-`defId` Roster 02) | `9958-1cdd-fdc9-3781` (Z. 2589) |
| Gruppe „Lores of Magic" beim Necromancer (`hidden="true"`, `max 1`) | `82b0-b07e-fc26-a50a` (Z. 2584) — Grenze `8229-3e03-bacd-24db` (Z. 2586) |
| Zacharias' Sonderchakter-Grenze (`max 0`, per `set` auf 1) | `f74f-ffa2-0ea8-22cb` (Z. 4853), Modifikator Z. 5061 |
| „Allow special characters?" (`.gst`-Ziel / VC-Wurzel-`entryLink`) | `8923-5946-7b10-8957` (`.gst` Z. 1935) / `6411-4be3-864f-a963` (Z. 29575), Grenze `min 0 force` = `9149-ce10-44d6-2d99` (Z. 29577) |
| „Master of the Black Arts" (`entryLink`, Ausloeser des *Range*-`set`) | `e5b7-4a3d-b074-24ad` (Z. 5008) |
| Kategorien Special Characters / Lord / Characters / Necrarch / Heroes | `0644-bfcd-32c2-21dc` / `d024-d25b-a9b4-73b6` / `7a1c-d611-c2dc-def1` / `fc4b-a86d-5897-9e4c` / `c16b-f319-2c62-2c12` |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` (Z. 29511) |
