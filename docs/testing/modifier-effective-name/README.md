# E2E-Regeln & Testkatalog: Effektiver Anzeigename via `field="name"`-Modifikator

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7)
abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`)
nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Kataloge: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`),
  `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`),
  dazu die von beiden per `catalogueLink` benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Dieses Szenario prüft **keine** zählenden Grenzen. Jede
> Erwartung ist ein `expect.capabilities[]`-Eintrag mit `defId` + `name` — exakte
> Gleichheit auf dem Namen **nach** allen greifenden Namens-Modifikatoren.
> `firing`/`absent` bleiben leer; andere Armeeaufbau-Diagnosen (General-/Core-
> Pflicht, Pflicht-Untereinträge der gewählten Einheiten, Punktelimit) dürfen
> zusätzlich auftreten und sind hier ohne Belang.

---

## Was ein `field="name"`-Modifikator laut Format tut

Aus [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)
der Formatreferenz, wörtlich abgeleitet:

- `type="set"` → der `value` **ersetzt** den Namen.
- `type="append"` / `type="prepend"` → der `value` wird **hinten** bzw. **vorn**
  angefügt.
- `join` (nur bei `append`/`prepend`) → das Trennzeichen zwischen bestehendem
  Namen und angefügtem Text. Es wird **verbatim** übernommen; **fehlt das
  Attribut, wird ohne Trennzeichen zusammengefügt**.
- Ein Modifikator greift nur, wenn seine `<conditions>`/`<conditionGroups>`
  halten (ein Modifikator ganz ohne Bedingungen greift immer).

**Träger = das Element, an dem der Modifikator hängt.** Die Modifikatorliste ist
in der XSD ein Kind des jeweiligen Elements, nicht eine globale Liste — hängt sie
an einer `<selectionEntry>`, einem `<selectionEntryGroup>` oder einem
`<entryLink>`, meint sie den Namen **dieser Auswahl**; hängt sie an einem
`<infoLink>`, meint sie den Namen **jenes Info-Vorkommens** (Profil-/Regel-
Instanz), nicht den der tragenden Einheit.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **MEN-R1** | **`append` + `join=" "` an einer `selectionEntry`:** Ist in der Force eine „Bloodline of Clan Blood Dragon" gewählt, hängt der Modifikator „of Clan Blood Dragon" — getrennt durch ein Leerzeichen — an den Namen des Trägers an. | VC-`.cat` Z. 3433 (`selectionEntry "Vampire Count"` `6822-0110-a7c9-cbb0`) und Z. 3878 (`selectionEntry "Vampire Thrall"` `e37b-c827-99ac-b706`): `<modifier type="append" value="of Clan Blood Dragon" field="name" join=" "/>` in einer `modifierGroup` mit `<condition type="atLeast" value="1" field="selections" scope="force" childId="9fd9-e05c-ffcb-2c4d" includeChildSelections="true"/>`. |
| **MEN-R2** | **Bedingung hält nicht → Katalogname bleibt.** Ohne „Bloodlines"-Selektion ist der Force-Zähler für jede der fünf Clan-`childId`s **0**, also `0 < 1` — keine der fünf `modifierGroup`s greift, der Name bleibt unverändert. | Dieselben `modifierGroup`s (VC-`.cat` Z. 3422–3496 für den Count, Z. 3867–3940 für den Thrall). Die Basisnamen stehen im `name`-Attribut der `selectionEntry`: `"Vampire Count"` (Z. 3124) bzw. `"Vampire Thrall"` (Z. 3500). |
| **MEN-R3** | **`set` an einer `selectionEntry`:** Ist das Kontingent eine Instanz des `forceEntry` „Army of Sylvania (SoC)", ersetzt `set` den Namen der Einheit *Skeletons* durch „Sylvanian Militia" und den ihres Modell-Slots durch „Skeleton Militia". | VC-`.cat` Z. 391 (`selectionEntry "Skeletons"` `9ac2-f4c1-bcc3-3aee`): `<modifier type="set" value="Sylvanian Militia" field="name">`; VC-`.cat` Z. 112 (verschachtelte `selectionEntry "Skeletons"` `eaa1-c6a6-9aae-ae9a`, `type="model"`): `<modifier type="set" value="Skeleton Militia" field="name">`. Beide mit `<condition type="instanceOf" value="1" field="selections" scope="force" childId="4072-c3b8-84c4-a097"/>` — die in §7.7 als *kanonisch* dokumentierte `forceEntry`-Instanzprüfung; `4072-c3b8-84c4-a097` ist das `forceEntry "Army of Sylvania (SoC)"` (Z. 29418). |
| **MEN-R4** | **`set` **und** `append` am selben Träger:** Ist eine „Bloodline of Clan Lahmia" in der Force, greifen am *Vampire Count* **beide** Namens-Modifikatoren. In Dokumentreihenfolge (erst der `<modifiers>`-Block, dann `<modifierGroups>`) entsteht „Vampire Countess of Clan Lahmia". | VC-`.cat` Z. 3411: `<modifier type="set" value="Vampire Countess" field="name">` mit `conditionGroup type="or"` aus `instanceOf … childId="2102-34f1-c876-98c5"` (`forceEntry "Clan Lahmia (VC-AB)"`, Z. 29403) **oder** `atLeast 1 … childId="4f07-e982-6665-70b7" scope="force"`. VC-`.cat` Z. 3447: `<modifier type="append" value="of Clan Lahmia" field="name" join=" "/>` mit derselben `atLeast`-Bedingung. |
| **MEN-R5** | **Träger `<infoLink>` ≠ Einheitenname.** Der unbedingte `append`-Modifikator am `infoLink` auf das geteilte *Wolf*-Profil benennt **nur jenes Info-Vorkommen** um („Wolf" → „Wolf (x3)"). Der Name der tragenden Auswahl *Grom's Chariot* — und erst recht der der Einheit *Grom the Paunch* — bleibt unverändert. | O&G-`.cat` Z. 8522–8526: `<infoLink name="Wolf" id="1d19-b8f5-3ca4-9701" type="profile" targetId="82b6-8aaa-c0a3-356b">` mit `<modifier type="append" value="(x3)" field="name" join=" "/>` **ohne** `<conditions>`. Der Träger-`selectionEntry` `"Grom's Chariot"` `7283-f5ba-6826-ff1a` (Z. 8511) und die Einheit `"Grom the Paunch of Misty Mountain"` `5653-1e8a-640d-fc56` (Z. 8397) haben **keinen** eigenen `field="name"`-Modifikator (verifiziert über alle 38 `field="name"`-Vorkommen der O&G-`.cat` — im Bereich Z. 8397–8638 existiert nur Z. 8524). |

### Hinweis zu MEN-R4 (Reihenfolge zweier Namens-Modifikatoren)

Weder die Formatreferenz noch die vendorte `Catalogue.xsd` legen eine
Auswertungsreihenfolge zwischen dem `<modifiers>`- und dem
`<modifierGroups>`-Block eines Elements fest. Die erwartete Zeichenkette ist
daher aus der **Dokumentreihenfolge** der Katalogdatei abgeleitet (`<modifiers>`
Z. 3400–3421 steht **vor** `<modifierGroups>` Z. 3422–3496) — verstärkt durch die
Absicht des Katalogautors: liefe der `set` **nach** dem `append`, wäre der
eigens für Lahmia hinterlegte Append-Modifikator (Z. 3447) wirkungslos und
damit toter Katalog-Inhalt. Weicht die Engine hiervon ab, ist das eine zu
**untersuchende** Abweichung, keine anzupassende Erwartung.

### Nicht abgedeckte Facetten der Regel (Lücken in den Fixture-Daten)

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `type="prepend"` | Kommt in den Fixture-Katalogen **kein einziges Mal** vor (Suche nach `type="prepend"` über alle fünf Datendateien: 0 Treffer). Aus den erlaubten Quellen nicht festnagelbar. |
| `append` **ohne** `join` (Verkettung ohne Trennzeichen) | Einziges Vorkommen ist `Mercenaries`-`.cat` Z. 4817 (`<modifier type="append" value="*" field="name"/>`). Seine `modifierGroup` (Z. 4815–4841) hängt an verschachtelten `conditionGroup`s — u. a. `scope="primary-catalogue"` (Z. 4829–4835) und ein `limit::`-Punktelimit —, die ein *minimales* Roster nicht sauber treffen bzw. verfehlen kann. Bewusst ausgelassen. **Nachtrag (Issue 077):** der Rahmen `primary-catalogue` ist inzwischen auflösbar — er benennt das Armeebuch des umschließenden Kontingents, die sieben `instanceOf`-Bedingungen halten also für ein Kontingent aus Vampire Counts oder Orcs and Goblins. Die Auslassung steht damit nur noch auf dem `limit::`-Punktelimit und der Gruppen-Verschachtelung, nicht mehr auf einem unbekannten Bezugsrahmen. |
| `join="  + "` (zwei Leerzeichen, Plus, Leerzeichen) | Alle **30** Vorkommen in den Fixtures (VC 12, O&G 14, Ogre Kingdoms 4) hängen an einem **`selectionEntryGroup`** — jeder dieser Modifikatoren steht in einem `<modifiers>`-Block auf Einrückungstiefe 6, also direkt unter einer `selectionEntryGroup` in `<sharedSelectionEntryGroups>` (z. B. `"Magic Talismans (VC)"` `70c0-82cd-31ec-e269`, VC-`.cat` Z. 20947, oder `"Magic Armour (Orc)"` `0953-e235-772f-9575`, O&G-`.cat` Z. 12711). Eine Gruppe wird in einer `.ros` nicht als eigene `<selection>` materialisiert, ein `capabilities[].defId` benennt aber einen Roster-Slot. Aus den erlaubten Quellen ist nicht ableitbar, unter welcher `defId` — falls überhaupt — ein Gruppen-Träger adressierbar wäre. Deshalb ausgelassen statt geraten. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Bedingung hält nicht → Katalogname | Standard-Kontingent (VC), Vampire Count + Vampire Thrall, **ohne** „Bloodlines". | **MEN-R2:** Kein Namens-Modifikator greift. `6822…` heißt „Vampire Count", `e37b…` heißt „Vampire Thrall". | [`01-vampires-no-bloodline-base-names.ros`](rosters/01-vampires-no-bloodline-base-names.ros) |
| 02 | `append` mit `join=" "` | Wie 01, zusätzlich „Bloodlines" mit **Blood Dragon**. | **MEN-R1:** `6822…` heißt „Vampire Count of Clan Blood Dragon", `e37b…` heißt „Vampire Thrall of Clan Blood Dragon" — inklusive des Leerzeichens aus `join=" "`. | [`02-blood-dragon-append-join-space.ros`](rosters/02-blood-dragon-append-join-space.ros) |
| 03 | `set` **und** `append` am selben Träger | Standard-Kontingent, „Bloodlines" mit **Lahmia** + Vampire Count. | **MEN-R4:** `6822…` heißt „Vampire Countess of Clan Lahmia" (erst ersetzt, dann angehängt). | [`03-lahmia-set-then-append.ros`](rosters/03-lahmia-set-then-append.ros) |
| 04 | `set`-Bedingung hält nicht | Standard-Kontingent, Einheit *Skeletons* mit 10 Modellen. | **MEN-R3 (Gegenprobe):** `9ac2…` und `eaa1…` heißen beide „Skeletons". | [`04-skeletons-standard-force-base-names.ros`](rosters/04-skeletons-standard-force-base-names.ros) |
| 05 | `set` ersetzt den Namen | **Derselbe** Aufbau im Kontingent **„Army of Sylvania (SoC)"** (`4072…`). | **MEN-R3:** `9ac2…` heißt „Sylvanian Militia", `eaa1…` heißt „Skeleton Militia". | [`05-skeletons-sylvania-force-set.ros`](rosters/05-skeletons-sylvania-force-set.ros) |
| 06 | Träger `<infoLink>` lässt den Einheitennamen unberührt | O&G-Standardkontingent, *Grom the Paunch* mit der Mount-Auswahl *Grom's Chariot*. | **MEN-R5:** Der unbedingte `append "(x3)"` am `infoLink` `1d19…` benennt nur das Wolf-Info-Vorkommen um. `5653…` heißt weiterhin „Grom the Paunch of Misty Mountain", `7283…` weiterhin „Grom's Chariot". | [`06-infolink-name-not-unit-name.ros`](rosters/06-infolink-name-not-unit-name.ros) |

> **Zu 04/05:** Beide Roster sind bis auf die `entryId` des Kontingents
> identisch. Genau dieser eine Unterschied ist der Auslöser von MEN-R3 — die
> Namensänderung lässt sich damit keiner anderen Ursache zuschreiben.

> **Zu 06:** Das Roster enthält bewusst nur die zwei Auswahlen, die die Regel
> sichtbar machen. Die zahlreichen Pflicht-Untereinträge Groms (Hand Weapon,
> Light Armour, Niblit …) fehlen; die daraus entstehenden `min`-Verletzungen sind
> für dieses Szenario ohne Belang (selektive Erwartung, siehe Kopfhinweis).

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Namen treffen die Engine erst im
**Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die drei erwartungsgemäß heiklen Stellen sind:

1. **MEN-R4** — die Reihenfolge `set` → `append` (siehe Hinweis oben).
2. **MEN-R5** — ob der Engine-Zustand den `infoLink`-Namen sauber vom
   Auswahlnamen trennt.
3. **MEN-R3** — ob die `instanceOf`-`forceEntry`-Prüfung in der *kanonischen*
   Kodierung (`scope="force"`, Id in `childId`) erkannt wird; die
   Formatreferenz §7.7 verlangt genau das.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Force „Army of Sylvania (SoC)" | `4072-c3b8-84c4-a097` |
| Force „Clan Lahmia (VC-AB)" (zweiter `or`-Zweig von MEN-R4) | `2102-34f1-c876-98c5` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| „Bloodlines" (Force-Selection) | `a56a-eb32-5a45-16fd` |
| Bloodline of Clan Blood Dragon / Lahmia | `9fd9-e05c-ffcb-2c4d` / `4f07-e982-6665-70b7` |
| Vampire Count (Träger von MEN-R1/R2/R4) | `6822-0110-a7c9-cbb0` |
| Vampire Thrall (Träger von MEN-R1/R2) | `e37b-c827-99ac-b706` |
| Skeletons, Einheit (Träger von MEN-R3, `set "Sylvanian Militia"`) | `9ac2-f4c1-bcc3-3aee` |
| Skeletons, Modell-Slot (Träger von MEN-R3, `set "Skeleton Militia"`) | `eaa1-c6a6-9aae-ae9a` |
| Grom the Paunch of Misty Mountain | `5653-1e8a-640d-fc56` |
| Grom's Chariot (Träger des `infoLink` aus MEN-R5) | `7283-f5ba-6826-ff1a` |
| `infoLink` „Wolf" mit `append "(x3)" join=" "` | `1d19-b8f5-3ca4-9701` (Ziel: geteiltes Profil `82b6-8aaa-c0a3-356b`) |
| `infoLink` „Vampire Count" (setzt bei Lahmia nur das Info-Vorkommen auf „Vampire Countess") | `a106-4a05-36ea-cb01` (Ziel: `fabd-ef67-72f5-6b3f`) |

## Abgleich mit dem Engine-Lauf: eine Korrektur am Manifest

Beim ersten Runner-Lauf wichen **MEN-R2** und **MEN-R4** ab — scheinbar unerklärlich,
weil erwarteter und tatsächlicher Name Zeichen für Zeichen gleich *aussahen*. Die
Untersuchung an den Katalogdaten (nicht am Engine-Code) zeigte den Grund: das
`join`-Attribut dieser Modifikatoren enthält kein gewöhnliches Leerzeichen (U+0020),
sondern ein **geschütztes Leerzeichen** (U+00A0). Belegt im Rohtext von
`Vampire Counts (6th definitive edition).cat`: jedes der 20 `join`-Attribute an
`field="name"`-Modifikatoren trägt `\xa0` (die `join="  + "`-Variante entsprechend
`\xa0 +\xa0`).

Die Engine reicht das Trennzeichen unverändert durch — das ist richtig so, ein
Katalogtext wird nicht umformatiert. Korrigiert wurde deshalb das **Manifest**: die
erwarteten Namen in `02` und `03` tragen jetzt ebenfalls U+00A0. Das ist keine
Anpassung an die Engine-Ausgabe, sondern die Behebung einer Fehllesung der
Katalogdaten — im Editor sind die beiden Zeichen nicht zu unterscheiden.
