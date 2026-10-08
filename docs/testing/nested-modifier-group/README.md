# E2E-Regeln & Testkatalog: die verschachtelte `modifierGroup` — Klammer in der Klammer

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`), der vendorten
`Catalogue.xsd` und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7)
abgeleitet. Die Roster-Form folgt der in den bestehenden Szenarien verifizierten
Gestalt (direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit
`number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Kontingent **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668` (`:29297`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`)
  — per `catalogueLink` `ef73-f9bd-e250-54d2` (`Vampire Counts (…).cat:29511`)
  eingebundene Abhängigkeit des Vampire-Counts-Katalogs; ohne sie meldet die
  Datensatz-Vorbereitung eine fehlende Abhängigkeit.

---

## Die Regel (In-World)

Ein `<modifierGroup>` erweitert dieselbe Basis wie ein `<modifier>`
(`ModifierBase`, `Catalogue.xsd:469-479`: `<repeats>`, `<conditions>`,
`<conditionGroups>`), enthält aber statt eines Feldwerts wieder `<modifiers>`
**und beliebig tief geschachtelte `<modifierGroups>`**
(`Catalogue.xsd:523-538`). Die Formatreferenz sagt zur Klammer:

> Die Bedingungen der Klammer gelten für **alle** Modifier darin; die Klammer ist
> damit die Kurzform für „dieselbe Bedingung an mehreren Modifiern" — semantisch
> gleichwertig dazu, sie an jedem einzelnen zu wiederholen.
> — [§7.7, Abschnitt `modifierGroup`](../../battlescribe/building-blocks/modifier.md#modifiergroup--eine-bedingte-klammer-um-mehrere-modifier)

Auf zwei Ebenen angewandt ergibt das eine **Konjunktion über die ganze Kette**:
ein Modifikator in der inneren Klammer wirkt genau dann, wenn die Bedingungen
der äusseren Klammer **und** die der inneren Klammer **und** seine eigenen
halten. Schlägt die äussere fehl, wirkt nichts darin — gleichgültig wie wahr die
inneren sind.

> **Fallstrick beim Lesen (§7.7):** `<conditions>`/`<conditionGroups>` einer
> Gruppe dürfen in Dokumentreihenfolge **hinter** ihren `<modifiers>` bzw.
> `<modifierGroups>` stehen (die XSD ordnet umgekehrt, die realen Kataloge
> halten sich nicht daran). Eine Klammer ist deshalb nur dann bedingungslos,
> wenn keines dieser Elemente **irgendwo** als ihr direktes Kind auftaucht — und
> eine Bedingung, die einer Klammer *innerhalb* gehört, ist keine Bedingung der
> äusseren. Die hier verwendete äussere Klammer wurde über das **gesamte**
> Gruppenelement (`Vampire Counts (…).cat:3047-3121`) geprüft.

---

## Die Datenlage: wo im Korpus überhaupt geschachtelt wird

Im gesamten eingefrorenen Datensatz (5 Dateien, 86 `<modifierGroups>`-Elemente:
1 in der `.gst`, 40 in Vampire Counts, 23 in Orcs and goblins, je 11 in
Mercenaries und Ogre Kingdoms) ist ein `<modifierGroups>` **genau dreimal**
direktes Kind eines `<modifierGroup>`. Ermittelt über die Nachbarschaft jedes
schliessenden `</modifierGroups>`: nur an drei Stellen folgt ihm ein
`</modifierGroup>` (die verschachtelte Klammer ist dort jeweils letztes Kind);
an keiner Stelle folgt ihm `<conditions>`, `<conditionGroups>` oder `<repeats>`,
und alle übrigen 83 stehen auf Entitätsebene (gefolgt von `</selectionEntry>`,
`</entryLink>`, `</infoLink>`, `<constraints>`, `<costs>`, `<entryLinks>`,
`<infoLinks>` oder einem `<modifiers>` **derselben** Einrückungstiefe).

| Datei / Zeilen | Träger (`selectionEntry`) | Äussere Klammer | Innere Klammern |
|---|---|---|---|
| `Vampire Counts (…).cat:3046-3122` | **„0-1 Vampire Lord "** `b77b-88d5-5e80-e178` (`:2713`) | `:3047-3121`, `type="and"`, Kinder: `<comment>BLOODLINE</comment>` + `<modifierGroups>` — **keine** `<conditions>`, `<conditionGroups>`, `<repeats>` | 5 (`:3050`, `:3064`, `:3078`, `:3092`, `:3106`), je **eine** eigene `<condition>` |
| `Vampire Counts (…).cat:3422-3498` | „Vampire Count" `6822-0110-a7c9-cbb0` (`:3124`) | `:3423-3497`, gleich gebaut, ebenfalls **bedingungslos** | 5 (`:3426`, `:3440`, `:3454`, `:3468`, `:3482`) |
| `Vampire Counts (…).cat:3867-3943` | „Vampire Thrall" `e37b-c827-99ac-b706` | `:3868-3942`, gleich gebaut, ebenfalls **bedingungslos** | 5 (`:3871`, `:3885`, `:3899`, `:3913`, `:3927`) |

**Der Befund, der dieses Szenario prägt:** Alle drei äusseren Klammern des
Korpus sind **bedingungslos**. Die Konjunktion ist damit an ihrer äusseren
Stelle mit dem neutralen Element besetzt — was die Regel nicht entwertet,
sondern die Aussage schärft: *die äussere Ebene darf weder unterdrücken noch
pauschal freischalten*. Die Gegenrichtung („äussere Bedingung schlägt fehl") ist
im Datensatz **nicht baubar**; siehe unten,
[Lücke](#lücke-die-äussere-bedingung-schlägt-fehl-ist-im-datensatz-nicht-baubar).

---

## Der Träger: die `BLOODLINE`-Klammer des `0-1 Vampire Lord`

`Vampire Counts (…).cat:3046-3122` (gekürzt auf zwei der fünf inneren Klammern):

```xml
<selectionEntry id="b77b-88d5-5e80-e178" name="0-1 Vampire Lord " …>
  …
  <modifierGroups>                          <!-- :3046 -->
    <modifierGroup type="and">              <!-- :3047  AEUSSERE Klammer -->
      <comment>BLOODLINE</comment>          <!-- :3048  einziges weiteres Kind -->
      <modifierGroups>                      <!-- :3049  VERSCHACHTELUNG -->
        <modifierGroup type="and">          <!-- :3050  innere Klammer 1 -->
          <modifiers>
            <modifier type="remove" value="bf30-4ff0-a4d8-3909" field="category"/>
            <modifier type="add"    value="4cae-a20e-8374-b6cb" field="category"/>
            … (remove c872…, fc4b…, ff24…)
            <modifier type="append" value="of Clan Blood Dragon" field="name" join="&#160;"/>
          </modifiers>
          <comment>Main Bloodline: Blood Dragon</comment>
          <conditions>                       <!-- :3060  NACH den modifiers! -->
            <condition type="atLeast" value="1" field="selections" scope="force"
                       childId="9fd9-e05c-ffcb-2c4d" shared="true"
                       includeChildSelections="true"/>
          </conditions>
        </modifierGroup>
        <modifierGroup type="and">          <!-- :3078  innere Klammer 3 -->
          <modifiers>
            <modifier type="add"    value="bf30-4ff0-a4d8-3909" field="category"/>
            <modifier type="remove" value="4cae-a20e-8374-b6cb" field="category"/>
            …
            <modifier type="append" value="of Clan Strigoi" field="name" join="&#160;"/>
          </modifiers>
          <conditions>
            <condition type="atLeast" value="1" field="selections" scope="force"
                       childId="ddfa-0d72-8557-6906" …/>
          </conditions>
        </modifierGroup>
        … (Lahmia :3064, Necrarch :3092, Von Carstein :3106)
      </modifierGroups>                      <!-- :3120 -->
    </modifierGroup>                         <!-- :3121 -->
  </modifierGroups>                          <!-- :3122 -->
</selectionEntry>                            <!-- :3123 -->
```

Beobachtbar ist das über zwei voneinander unabhängige Wege:

1. **Direkt** — der `append`-Modifikator der inneren Klammer schlägt auf den
   **effektiven Anzeigenamen** des Slots durch (`expect.capabilities[].name`).
2. **Mittelbar** — der `add category`-Modifikator derselben inneren Klammer wird
   von den Merkmals-Modifikatoren am `infoLink` `e0f2-8568-15f0-a384`
   (`:2718-2762`) gelesen, deren Bedingungen `instanceOf …
   scope="b77b-88d5-5e80-e178"` auf die Clan-Kategorien zeigen. Sichtbar als
   **Merkmalswerte** des Profil-Vorkommens
   (`expect.capabilities[].infoElements[].characteristics`).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **NMG-R1** | Ein `<modifierGroup>` darf wieder `<modifierGroups>` enthalten; die Verschachtelung ist beliebig tief. Ein Bericht, der nur die `<modifiers>` einer Klammer liest, verliert **alles** unterhalb der zweiten Ebene. | `Catalogue.xsd:523-532` (`ModifierGroup` = `ModifierBase` + `modifiers?` + `modifierGroups?`), `:534-538` (`ModifierGroupList`). Realer Fall: die äussere Klammer `VC-.cat:3047-3121` trägt **überhaupt keine** eigenen `<modifiers>` — ihr ganzer Inhalt steckt in `<modifierGroups>` `:3049-3120`. |
| **NMG-R2** | Die Bedingungen der Klammern **komponieren als Konjunktion**: ein Modifikator wirkt, wenn äussere Klammer **und** innere Klammer **und** er selbst halten. | §7.7: die Klammer ist „semantisch gleichwertig dazu, [ihre Bedingung] an jedem einzelnen zu wiederholen" — zweimal angewandt ergibt das ein UND über die Kette. `ModifierBase` (`Catalogue.xsd:469-479`) ist für beide Ebenen dasselbe Element, also gilt für beide dieselbe Lesart. |
| **NMG-R3** | Die **äussere** Klammer ist hier bedingungslos (neutrales Element der Konjunktion) — sie darf ihre Kinder weder unterdrücken noch pauschal anwenden. Es entscheidet allein die Bedingung der **inneren** Klammer. | `VC-.cat:3047-3121` vollständig gelesen: Kinder sind `<comment>` (`:3048`) und `<modifierGroups>` (`:3049-3120`), sonst nichts. Kein `<conditions>`, kein `<conditionGroups>`, kein `<repeats>` — auch nicht **hinter** den Kindern (Fallstrick §7.7). |
| **NMG-R4** | Jede der fünf inneren Klammern hat **ihre eigene** Bedingung; sie sind unabhängige Konjunktionen, keine Alternativen einer Auswahl. | `:3060-3062` (Blood Dragon `9fd9-e05c-ffcb-2c4d`), `:3074-3076` (Lahmia `4f07-e982-6665-70b7`), `:3088-3090` (Strigoi `ddfa-0d72-8557-6906`), `:3102-3104` (Necrarch `5017-296d-edef-4562`), `:3116-3118` (Von Carstein `f557-097a-d26b-9363`) — je `type="atLeast" value="1" field="selections" scope="force" includeChildSelections="true"`. Halten **zwei** davon, wirken **beide** (Roster 04). |
| **NMG-R5** | `append` + `join`: das Trennzeichen wird **verbatim** übernommen. Das `join` dieser fünf Modifikatoren ist ein **geschütztes Leerzeichen U+00A0**, kein gewöhnliches U+0020. Der Katalogname des Trägers endet zudem selbst auf ein gewöhnliches Leerzeichen. | `:3057`, `:3071`, `:3085`, `:3099`, `:3113` — `join` verifiziert per Byte-Suche `join="\x{00A0}"`: 5 Treffer im Lord-Block, 15 über die drei `BLOODLINE`-Klammern, 20 im ganzen Katalog. Trägername `name="0-1 Vampire Lord "` (`:2713`) — ebenfalls per Byte-Suche verifiziert: Schlusszeichen ist `\x{0020}`, die Suche nach `\x{00A0}` an dieser Stelle findet **nichts**. Format: [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat), „Wird verbatim übernommen, nicht angenommen". Präzedenz: die Korrektur am Ende von [`modifier-effective-name`](../modifier-effective-name/README.md). |
| **NMG-R6** | Der `add category`-Modifikator der inneren Klammer ändert die **effektiven** Kategorien des Trägers; Bedingungen, die danach fragen, lesen diesen Stand. | `:3053` (`add 4cae-a20e-8374-b6cb`), `:3080` (`add bf30-4ff0-a4d8-3909`). Gelesen von `:2722-2746` — fünf Merkmals-Modifikatoren am `infoLink` `e0f2-8568-15f0-a384` mit `condition type="instanceOf" field="selections" scope="b77b-88d5-5e80-e178" childId="<Clan-Kategorie>"`. Rahmen-Regel: [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) („`scope` … oder eine Vorfahren-Id"), effektive statt roher Kategorien: [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit). |
| **NMG-R7** | `instanceOf` ist eine **Identitätsprüfung**, kein Zahlvergleich — das `value` der Bedingung ist ohne Wirkung. | §7.6/§7.7. Aus den Daten belegt: für dieselbe Absicht stehen beide Werte nebeneinander — `value="0"` bei Blood Dragon (`:2724`) und Necrarch (`:2729`), `value="1"` bei Strigoi (`:2734`). Ein Zahlvergleich läse „**keine** Blood-Dragon-Kategorie ⇒ Blood-Dragon-Bonus". |
| **NMG-R8** | Die Merkmals-Ausgangswerte sind die des geteilten Profils. | `:26958-26974`, `profile ff43-329c-048a-f374` „Vampire Lord": Mv 6, **WS 8**, BS 6, S 5, T 5, W 4, I 8, **A 5**, Ld 10, **Sv 7**, **Sv+ 7**, US 1. |
| **NMG-R9** | Die Gruppengrenze der Blutlinienwahl zählt die **Mitglieder der Gruppe**: `max 1`. Zwei Blutlinien ⇒ Ist 2 / Grenze 1. | `selectionEntryGroup "Vampiric Bloodline"` `5655-13ba-8980-bd1c` (`:5099`) mit `constraint type="max" value="1" field="selections" scope="parent" includeChildSelections="false" id="39c7-f615-17db-7016"` (`:5101`). Regel: [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) („Eine Grenze an einer `selectionEntryGroup` zählt … **ihre Mitglieder**"). Präzedenz: VBL-R2 in [`vampire-bloodlines`](../vampire-bloodlines/README.md), USIC-R7 in [`unit-scope-instance-of-category`](../unit-scope-instance-of-category/README.md). |

### Herleitung der erwarteten Namen (NMG-R5)

| Roster | Rechnung | Erwarteter `name` (`␠` = U+0020, `␣` = U+00A0) |
|---|---|---|
| 01 | Katalogname unverändert | `0-1 Vampire Lord␠` |
| 02 | `"0-1 Vampire Lord␠"` + `␣` + `"of Clan Blood Dragon"` | `0-1 Vampire Lord␠␣of Clan Blood Dragon` |
| 03 | `"0-1 Vampire Lord␠"` + `␣` + `"of Clan Strigoi"` | `0-1 Vampire Lord␠␣of Clan Strigoi` |
| 04 | dito, zweimal in Dokumentreihenfolge (`:3057` vor `:3085`) | `0-1 Vampire Lord␠␣of Clan Blood Dragon␣of Clan Strigoi` |

Im Manifest stehen diese Zeichen als echte Codepoints; die scheinbare
Doppel-Leerstelle nach „Lord" ist **kein Tippfehler**, sondern das
Katalog-Schlussleerzeichen plus das `join`-NBSP.

Der konkurrierende `set`-Modifikator der Einheit (`:3035`,
`value="0-1 Vampire Lady"`) greift in keinem der vier Roster: seine
`or`-Bedingungsgruppe verlangt das Kontingent „Clan Lahmia (VC-AB)"
`2102-34f1-c876-98c5` **oder** eine Lahmia-Blutlinie `4f07-e982-6665-70b7`
(`:3036-3043`) — beides kommt hier nicht vor. Ebenso greift der
`set hidden="true"` der Einheit (`:3024-3034`) nicht: er verlangt eines der
Kontingente `d3af-1add-4e99-b977`, `f37a-a93e-fa22-61a8` oder
`bf46-ee85-7c10-ba98`, gebaut wird aber in „Standard (VC-AB)".

### Herleitung der erwarteten Merkmalswerte (NMG-R6/R8)

Am `infoLink` `e0f2-8568-15f0-a384` hängen fünf je eigen-bedingte Modifikatoren
(`:2722-2746`):

| Modifikator | Bedingung (`childId`) | Roster 01 | Roster 02 (Blood Dragon) | Roster 03 (Strigoi) |
|---|---|---|---|---|
| `increment` WS `f95b-…` +2 (`:2722`) | Blood Dragon `4cae-…` | — | **greift** | — |
| `decrement` WS `f95b-…` −2 (`:2727`) | Necrarch `fc4b-…` | — | — | — |
| `increment` A `6b9f-…` +1 (`:2732`) | Strigoi `bf30-…` | — | — | **greift** |
| `set` Sv+ `d4a9-…` „5+" (`:2737`) | Strigoi `bf30-…` | — | — | **greift** |
| `set` Sv+ `d4a9-…` „5+" (`:2742`) | Blood Dragon `4cae-…` | — | **greift** | — |
| **Ergebnis** | | WS 8, A 5, Sv 7, Sv+ 7 | **WS 10**, A 5, Sv 7, **Sv+ 5+** | WS 8, **A 6**, Sv 7, **Sv+ 5+** |

Sv `f1be-…` wird von **keinem** dieser Modifikatoren adressiert und bleibt in
allen drei Fällen 7 — die Gegenprobe dazu, dass nicht „irgendetwas" gesetzt wird.
Der Name des Profil-Vorkommens bleibt „Vampire Lord": der einzige Namens-`set`
am `infoLink` (`:2751`, `value="0-1 Vampire Lady"`) hängt an derselben
Lahmia-Bedingungsgruppe wie oben.

---

### Was eine Fehl-Lesart der Verschachtelung produzieren würde

| Fehl-Lesart | Roster 01 | Roster 02 | Roster 03 | Roster 04 |
|---|---|---|---|---|
| **Verschachtelung ignoriert** (nur `<modifiers>` der äusseren Klammer gelesen — die ist leer) | still (korrekt, aber unbewiesen) | Name ohne Clan-Zusatz, WS 8, Sv+ 7 — **fällt auf** | Name ohne Zusatz, A 5, Sv+ 7 — **fällt auf** | Name ohne Zusatz — **fällt auf** |
| **Bedingungslose äussere Klammer = „nie erfüllt"** | still | wie oben — **fällt auf** | wie oben — **fällt auf** | **fällt auf** |
| **Innere Bedingungen fallen gelassen** (alle inneren Modifikatoren wirken, weil die äussere Klammer unbedingt ist) | Name trüge alle fünf Clan-Zusätze, WS 8 (+2−2), A 6, Sv+ 5+ — **fällt auf** | Name trüge fünf Zusätze — **fällt auf** | **fällt auf** | **fällt auf** |
| **Innere Bedingungen ver-UND-et statt je Klammer** | still | nichts wirkt — **fällt auf** | nichts wirkt — **fällt auf** | nichts wirkt — **fällt auf** |
| **Innere Klammern als Alternativen** (nur die erste haltende wirkt) | still | still | still | nur ein Zusatz statt zwei — **fällt auf** |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle vier laufen
gegen denselben Datensatz (`.gst` + Vampire-Counts-`.cat` + die per
`catalogueLink` benötigte `Mercenaries`-`.cat`) und dasselbe Kontingent
„Standard (VC-AB)" `e989-15b8-7eb6-9668`.

> **Assertion-Fokus:** der Slot des `0-1 Vampire Lord` (`expect.capabilities`:
> effektiver Name, Info-Projektion, Merkmalswerte) sowie in Roster 04 die
> Gruppengrenze `39c7-f615-17db-7016`. Andere Armeeaufbau-Diagnosen dürfen
> zusätzlich auftreten und sind hier ohne Belang — namentlich die
> General-/Core-Pflicht des Kontingents, die Bloodlines-Pflicht
> `4a0a-b107-e726-da32` (`:5194`, in Roster 01 unerfüllt) und die bewusst
> weggelassenen Pflicht-Unterauswahlen des Vampire Lord („Lord hero choice extra
> cost" `0780-5a76-9d51-e9ea`, „Handweapon" `d830-89e1-7573-92e7`, Gruppe
> „Wizard Level" `769e-ff2d-6795-86cb`, „Lore of Necromancy"
> `cb1b-2918-1f65-8ae1`). Die Roster bleiben minimal, damit die Verschachtelung
> isoliert sichtbar ist.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Innere Bedingungen halten alle nicht | `0-1 Vampire Lord`, **keine** Bloodlines-Selektion | **NMG-R3/R4:** Kein Modifikator der Verschachtelung wirkt. Der Slot heisst weiterhin `0-1 Vampire Lord␠`, das Profil-Vorkommen trägt die Katalogwerte WS 8, A 5, Sv 7, Sv+ 7. Die bedingungslose äussere Klammer darf **nichts** auslösen. Gruppengrenze `39c7…` und die Eigengrenze `a7c9-5fec-592a-3716` (max 1 Vampire Lord je Roster) bleiben **absent**. | [`01-vampire-lord-no-bloodline.ros`](rosters/01-vampire-lord-no-bloodline.ros) |
| 02 | Genau die erste innere Klammer hält | Bloodlines + **Blood Dragon** + Vampire Lord | **NMG-R1/R5/R6:** Name `0-1 Vampire Lord␠␣of Clan Blood Dragon` — **ein** Zusatz, nicht fünf. Über die gesetzte Kategorie `4cae…`: WS 8+2=**10**, Sv+ **`5+`**; A bleibt 5 und Sv bleibt 7 (die Strigoi- und Necrarch-Modifikatoren bleiben stumm). `39c7…`/`a7c9…` **absent**. | [`02-vampire-lord-blood-dragon.ros`](rosters/02-vampire-lord-blood-dragon.ros) |
| 03 | Genau die dritte innere Klammer hält | Bloodlines + **Strigoi** + Vampire Lord | **NMG-R4:** Name `0-1 Vampire Lord␠␣of Clan Strigoi`. Über die gesetzte Kategorie `bf30…`: A 5+1=**6**, Sv+ **`5+`**; WS bleibt **8** und Sv bleibt 7. Einziger Unterschied zu 02 ist die gewählte Blutlinie — die Umschaltung lässt sich damit keiner anderen Ursache zuschreiben. `39c7…`/`a7c9…` **absent**. | [`03-vampire-lord-strigoi.ros`](rosters/03-vampire-lord-strigoi.ros) |
| 04 | Zwei innere Klammern derselben äusseren halten zugleich | Bloodlines mit **Blood Dragon *und* Strigoi** + Vampire Lord (bewusst regelwidrig) | **NMG-R4/R5:** Der Name trägt **beide** Anhänge in Dokumentreihenfolge: `0-1 Vampire Lord␠␣of Clan Blood Dragon␣of Clan Strigoi`. Die innere Ebene ist also kein Auswahlschalter, sondern fünf unabhängige Konjunktionen. **NMG-R9:** `39c7-f615-17db-7016` feuert **Ist 2 / Grenze 1**; `a7c9…` bleibt **absent**. | [`04-vampire-lord-two-bloodlines.ros`](rosters/04-vampire-lord-two-bloodlines.ros) |

**Warum die vier erst zusammen tragen:** 01 fällt, wenn die Klammer ihre Kinder
pauschal anwendet; 02/03 fallen, wenn die Verschachtelung gar nicht betreten
oder die bedingungslose äussere Klammer als „nie erfüllt" gelesen wird; 02 gegen
03 fällt, wenn die inneren Bedingungen der falschen Ebene zugeordnet werden;
04 fällt, wenn die inneren Klammern als Alternativen statt als unabhängige
Konjunktionen behandelt werden.

---

## Lücke: „die äussere Bedingung schlägt fehl" ist im Datensatz nicht baubar

Die dritte, entscheidende Zeile der Regel — *schlägt die äussere Klammer fehl,
wirkt nichts darin, gleichgültig wie wahr die inneren sind* — lässt sich an
diesen Katalogdaten **nicht** prüfen. Der Grund ist der Befund oben: der Korpus
enthält **genau drei** verschachtelte `<modifierGroups>` (Vampire Lord, Vampire
Count, Vampire Thrall), und **alle drei** hängen in einer äusseren Klammer, die
weder `<conditions>` noch `<conditionGroups>` noch `<repeats>` trägt. Es gibt im
ganzen Datensatz keine äussere Klammer, deren Bedingung ein Roster zum
Fehlschlagen bringen könnte.

Geprüft wurde das über **alle** 86 `<modifierGroups>`-Vorkommen der fünf
Dateien, nicht nur über die drei Fundstellen: an keiner Stelle folgt einem
schliessenden `</modifierGroups>` ein `<conditions>`, `<conditionGroups>` oder
`<repeats>` — die in §7.7 gewarnte Reihenfolge „Bedingung hinter den Kindern"
kommt bei den äusseren Klammern also gar nicht vor, und die drei gefundenen
äusseren Klammern sind auch nach vollständiger Lektüre ihres Elements
bedingungslos.

Ein Roster für diesen Fall müsste eine Klammer **erfinden**. Das wäre kein Test
an echten Katalogdaten mehr und ist deshalb bewusst unterlassen. Bekommt der
Fixture-Satz je einen Träger mit bedingter äusserer Klammer, gehört hier ein
fünftes Roster ergänzt: gleiche Blutlinienwahl wie in 02, aber ein
Kontingent/Zustand, in dem die äussere Bedingung fehlschlägt — die Erwartung
wäre dann Zeichen für Zeichen die von Roster 01.

---

## Bewusst **nicht** Gegenstand dieses Szenarios

| Facette | Warum nicht |
|---------|-------------|
| **Kategoriezugehörigkeit als eigene Aussage** (`add`/`remove category` der inneren Klammern) | Der Verletzungsbericht kodiert zählende Grenzen, keine Mitgliedschaften. Die Kategorie tritt hier nur als **Ursache** der Merkmalsänderung auf (NMG-R6). Die vier kategorie-skopierten Grenzen des Katalogs (`6afc-566e-34d4-d35c` und Geschwister) hängen an Einträgen, die diese Kategorie nie tragen — Beleg und Begründung in [`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md). |
| **Reihenfolge konkurrierender `add`/`remove category`** (in Roster 04 halten zwei innere Klammern, deren Kategorie-Modifikatoren einander überschreiben) | Bereits gepinnt in [`unit-scope-instance-of-category`](../unit-scope-instance-of-category/README.md) (USIC-R6: „remove nach add gewinnt"). Roster 04 behauptet deshalb **nur** den Namen und die Gruppengrenze, keine Merkmalswerte. |
| **Sichtbarkeit (`hidden`)** — die Mounts-Gruppe `212e-af66-2d81-aa6a` des Vampire Lord wird per `instanceOf … scope="unit" childId="bf30-…"` verborgen, sobald die innere Strigoi-Klammer die Kategorie gesetzt hat (`:2791-2797`) | Verfügbarkeit, keine zählende Schranke — und ein `selectionEntryGroup` ist im Manifest nur über einen Slot adressierbar, dessen `defId` aus den erlaubten Quellen nicht ableitbar ist (dieselbe Auslassung wie in [`modifier-effective-name`](../modifier-effective-name/README.md)). |
| **Die bedingungslose Klammer als solche** (eine Klammer ohne eigene Bedingungen ist eine blosse Klammer) | Gehört zu [`unconditional-modifier-group`](../unconditional-modifier-group/README.md). Hier ist die Bedingungslosigkeit der **äusseren** Ebene nur der Datenbefund, der die Konjunktion auf die innere Ebene reduziert. |
| **Der `<repeats>` einer Klammer** (Multiplikation des Wiederholungsfaktors in die Kinder) | Gehört zu [`modifier-group-repeats`](../modifier-group-repeats/README.md); keine der drei verschachtelten Stellen trägt `<repeats>`. |
| **Die beiden Schwester-Träger** (Vampire Count `6822-…`, Vampire Thrall `e37b-…`) | Wortgleich gebaut und oben als Beleg geführt, aber nicht als eigene Roster: sie brächten keinen neuen Fall. Ihre Namensform ist ausserdem in [`modifier-effective-name`](../modifier-effective-name/README.md) (MEN-R1/R2/R4) bereits gepinnt — genau deshalb ist der Träger hier der **Vampire Lord**, der dort nicht vorkommt. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog „Vampire Counts" | `4d73-5ab0-9020-403c` |
| Bibliothek „Mercenaries" (per `catalogueLink` `ef73-f9bd-e250-54d2`, `:29511`) | `fc47-8392-a6c8-452a` |
| Kontingent „Standard (VC-AB)" (`:29297`) | `e989-15b8-7eb6-9668` |
| Einheit „0-1 Vampire Lord " (`:2713`) — Träger der verschachtelten Klammer | `b77b-88d5-5e80-e178` |
| — Eigengrenze max 1 je Roster (`:2715`) | `a7c9-5fec-592a-3716` |
| — `infoLink` „Vampire Lord" (`:2718`) → geteiltes Profil (`:26958`) | `e0f2-8568-15f0-a384` → `ff43-329c-048a-f374` |
| — äussere `modifierGroup` `BLOODLINE`, bedingungslos (`:3047-3121`) | — (`modifierGroup` trägt keine `id`) |
| — innere `modifierGroup`s (`:3050`, `:3064`, `:3078`, `:3092`, `:3106`) | — (dito) |
| — Gruppe „Mounts" (nur als Abgrenzung erwähnt, `:2787`) | `212e-af66-2d81-aa6a` |
| Auswahl „Bloodlines" (`:5094`) — Pflicht je Kontingent (`:5194`) | `a56a-eb32-5a45-16fd` — Grenze `4a0a-b107-e726-da32` |
| — Gruppe „Vampiric Bloodline" (`:5099`) mit `max 1` (`:5101`) | `5655-13ba-8980-bd1c` — Grenze `39c7-f615-17db-7016` |
| „Bloodline of Clan Blood Dragon" (`:5104`) | `9fd9-e05c-ffcb-2c4d` |
| „Bloodline of Clan Strigoi" (`:5153`) | `ddfa-0d72-8557-6906` |
| „Bloodline of Clan Lahmia" / „… Necrarch" / „… Von Carstein" (Bedingungen der übrigen inneren Klammern) | `4f07-e982-6665-70b7` / `5017-296d-edef-4562` / `f557-097a-d26b-9363` |
| Clan-Kategorie „Blood Dragon" (`:40`) | `4cae-a20e-8374-b6cb` |
| Clan-Kategorie „Strigoi" (`:41`) | `bf30-4ff0-a4d8-3909` |
| Clan-Kategorie „Necrarch" (`:39`) / „Lahmia" (`:42`) / „Von Carstein" (`:38`) | `fc4b-a86d-5897-9e4c` / `c872-4b18-1aad-6953` / `ff24-ca11-afd5-865b` |
| Profil-Typ „Profile" | `a54a-7f00-29bf-12b1` |
| Merkmal WS / A / Sv / Sv+ | `f95b-da01-0578-3bdc` / `6b9f-c8fe-8998-27e3` / `f1be-e66c-d5e1-673c` / `d4a9-0ed4-d041-e54b` |
| Kategorie „Lord" (Roster-Snapshot des Vampire Lord) | `d024-d25b-a9b4-73b6` |
| Kategorie „Special list rules" (Roster-Snapshot der Bloodlines) | `32f1-197f-d719-a393` |
| Schwester-Träger derselben Verschachtelung: „Vampire Count" (`:3124`) / „Vampire Thrall" | `6822-0110-a7c9-cbb0` / `e37b-c827-99ac-b706` |
