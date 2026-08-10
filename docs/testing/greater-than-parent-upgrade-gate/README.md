# E2E-Regeln & Testkatalog: greaterThan-Bedingung mit scope=parent (Aufwertungs-Gatter am Vampire Thrall)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an den **verifizierten Beispiel-Rostern** der bestehenden Szenarien
orientiert (direktes `entryId`, `entryLinkId` für verlinkte Aufwertungen,
`entryGroupId` für die tragende Gruppe).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard (VC-AB)"** `e989-15b8-7eb6-9668`
  (+ die per `catalogueLink` `ef73-f9bd-e250-54d2` benötigte `Mercenaries`-`.cat`)

**Gepinnte Zelle:** `condition|greaterThan|parent|selectionCount|child=id` — eine
`condition type="greaterThan"` mit `field="selections"`, `scope="parent"` und
einer Eintrags-Id in `childId` hält **genau dann**, wenn die Zahl der Selektionen
dieses Eintrags im **Eltern-Rahmen** der Bedingung **echt größer** als `value`
ist (Formatdoku [§7.6](../../battlescribe-data-format.md#76-constraint) /
[§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)).
Wo sie hält, greift **jeder** von ihr gegatete Modifier auf seinen Träger — hier
sowohl dessen `hidden`-Flag als auch der Wert seiner **eigenen** Mindestgrenze;
wo sie nicht hält, behält der Träger seine **geschriebenen Basiswerte**.

Die Fundstelle ist bewusst gewählt: Es sind die **einzigen beiden**
`greaterThan`/`scope="parent"`-Modifier des Fixture-Korpus **ohne** `<repeats>`
— der Wiederholungsfaktor kann die Wirkung hier also nicht überlagern.

## Die Struktur im Katalog (wichtig)

Träger der Zelle ist ein `entryLink` **unmittelbar unter** dem Wurzel-Unit
**„Vampire Thrall"**; der Eltern-Rahmen der Bedingung ist damit die
Thrall-Selektion selbst:

```
selectionEntry "Vampire Thrall" (e37b-c827-99ac-b706, type=unit)     ← der Eltern-Rahmen (scope="parent")
  ├ selectionEntry "Handweapon" (9dfd-134c-53c1-7181)                min 1 / max 1 (parent)
  ├ entryLink "Magic selection" (2e0c-… → Gruppe 53e8-…)
  │    └ entryLink "Bloodline" (85fb-… → Gruppe 0719-…)
  │         └ entryLink "Vampiric Powers" (fb5e-…, Basis hidden=true → Gruppe 8627-…,
  │           eingeblendet per atLeast 1 childId=5017-… [Clan Necrarch] scope=force)
  │              └ entryLink "Nehekhara’s Noble Blood" (75e7-… → 32d0-a151-94a3-aa54)   ← der Gate-Zeuge
  └ entryLink "Magic Level 1" (86d1-3bd6-6cb2-711d → 158f-…)         ← der TRÄGER der Zelle
       Basis: hidden="true", constraint c195-d40a-1c54-f572 = min 0 (parent)
       modifier set hidden="false"            ┐ beide gegatet durch dieselbe, EINE Bedingung
       modifier set c195-…="1"                ┘ greaterThan 0 / selections / parent / childId=32d0-…
```

> **Alle vier Stufen der Zeugen-Kette sind `selectionEntryGroup`s.** Gruppen
> erscheinen in der `.ros` nicht als eigene `selection`; „Nehekhara's Noble
> Blood" steht dort deshalb als **direktes Kind** der Thrall-Selektion (mit
> `entryLinkId="75e7-…"` und `entryGroupId="8627-…"`), genau wie im
> Nachbarszenario [`at-least-unit-upgrade-gate`](../at-least-unit-upgrade-gate/README.md).
> Konsequenz: `includeChildSelections="true"` an dieser Bedingung ist hier
> **nicht separat beobachtbar** — der Zeuge liegt ohnehin direkt im Rahmen
> (siehe „Bewusst nicht gepinnte Facetten").

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **GTP-R1** | Die Bedingung `type="greaterThan" value="0" field="selections" scope="parent" childId="32d0-a151-94a3-aa54"` zählt die Noble-Blood-Selektionen im **Eltern-Rahmen** ihres Trägers — der Träger ist ein `entryLink` direkt unter dem Vampire Thrall, der Rahmen also **diese Thrall-Selektion**. Sie hält bei **echt größer** als 0, d. h. **ab der ersten** Noble-Blood-Selektion im Rahmen; bei 0 hält sie **nicht** (`0 > 0` ist falsch). | VC-`.cat`, entryLink `86d1-3bd6-6cb2-711d` unter `selectionEntry e37b-c827-99ac-b706`: `<condition type="greaterThan" value="0" field="selections" scope="parent" childId="32d0-a151-94a3-aa54" shared="true" percentValue="false" includeChildSelections="true" includeChildForces="true"/>` (zweimal wortgleich, je einmal an jedem der beiden Modifier). |
| **GTP-R2** | **Basiszustand des Trägers:** „Magic Level 1" ist am Thrall **verborgen** (`hidden="true"` am Verweis; das `.gst`-Ziel `158f-…` trägt `hidden="false"`, und beide wirken per ODER — Formatdoku [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)) und hat ein **Mindestmaß 0**. | VC-`.cat`, `<entryLink import="true" name="Magic Level 1" hidden="true" id="86d1-3bd6-6cb2-711d" targetId="158f-d753-59e2-9ad2">` mit `<constraint type="min" value="0" field="selections" scope="parent" shared="true" id="c195-d40a-1c54-f572" includeChildSelections="false"/>`; `.gst`, `selectionEntry 158f-d753-59e2-9ad2` (`hidden="false"`, max 1 parent `105e-0c33-0099-b999`). |
| **GTP-R3** | **Wo die Bedingung hält, greifen BEIDE Modifier auf denselben Träger:** `set hidden="false"` macht den Slot sichtbar **und** `set value="1" field="c195-d40a-1c54-f572"` hebt dessen **eigene** Mindestgrenze von 0 auf **1**. Der Link trägt genau diese zwei Modifier, jeder mit genau **einer** Bedingung und **ohne** `<repeats>` — es gibt keinen Wiederholungsfaktor und keine weitere Klammer. | VC-`.cat`, `<modifiers>` des entryLinks `86d1-3bd6-6cb2-711d` (Zeilen `set false hidden` / `set 1 c195-d40a-1c54-f572`); kein `<modifierGroups>`, kein `<repeats>`. |
| **GTP-R4** | **Wo sie nicht hält, bleiben die geschriebenen Basiswerte:** verborgen (`isHidden` true) und Mindestmaß **0**. Ein Mindestmaß 0 ist bei Ist 0 erfüllt; zusätzlich wird das Mindestmaß einer **effektiv versteckten** Entität ohnehin nicht validiert (Formatdoku [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments)/[§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit), Issue 0088). Die Grenze `c195-…` feuert also **nicht**. | Basiswerte wie GTP-R2; Validierungsverbot laut Formatdoku (beide Gründe zeigen hier in dieselbe Richtung — siehe „Bewusst nicht gepinnte Facetten"). |
| **GTP-R5** | **Wo sie hält, wird die angehobene Grenze auch geprüft:** der Slot ist durch denselben Bedingungstreffer **nicht mehr versteckt**, das Validierungsverbot aus Issue 0088 greift also nicht. „Magic Level 1" ist im Roster **nicht gewählt** ⇒ die Mindestgrenze `c195-d40a-1c54-f572` ist mit **Ist 0** gegen **Grenze 1** unerfüllt und feuert. Gezählt wird `field="selections"` im `scope="parent"` (der Thrall), `includeChildSelections="false"`. | Grenze `c195-d40a-1c54-f572` (Basis min 0) + `set`-Modifier auf 1 (GTP-R3); Zählregel Formatdoku [§7.6](../../battlescribe-data-format.md#76-constraint). |

**Hinweis zum Mechanismus:** Diese Zelle ist der Fall, in dem ein
`hidden`-Gatter **und** eine zählende Schranke am **selben** Träger und an
**derselben** Bedingung hängen. Die Sichtbarkeit ist Verfügbarkeit und erscheint
nicht im Verletzungsbericht — sie wird über `expect.capabilities[].isHidden`
festgehalten; die angehobene Mindestgrenze dagegen ist eine zählende Schranke
und erscheint in `firing`.

**Hinweis zum Roster-Aufbau:** Beide Roster enthalten **Bloodlines → Clan
Necrarch** (`a56a-…` → `5017-…`). Das erfüllt zum einen die force-weite Pflicht
`4a0a-b107-e726-da32` (min 1), zum anderen blendet es die Necrarch-Gruppe
„Vampiric Powers" (`fb5e-…`, force-gegatet) ein, in der Noble Blood überhaupt
angeboten wird. Das Delta zwischen den beiden Rostern ist **ausschließlich** die
Noble-Blood-Selektion; alle Necrarch-Nebenwirkungen auf den Thrall (Namens-Anhang
„of Clan Necrarch", WS −2, Ausblenden der Waffen-/Rüstungsoptionen, die
dynamische Pflicht „Necrarch additional casting dice") sind in **beiden** Rostern
identisch und werden **nicht** behauptet.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide
referenzieren `.gst` + Vampire-Counts-`.cat` (+ `Mercenaries`-`.cat`).

> **Assertion-Fokus:** der `isHidden`/`effectiveMin`-Zustand des
> „Magic Level 1"-Slots am Thrall und die Grenze `c195-d40a-1c54-f572`. Andere
> Armeeaufbau-Diagnosen (General-Pflicht, Core-Pflicht, Punktelimit, die
> Necrarch-Pflicht `c30e-56ff-1881-340f`) können zusätzlich auftreten und sind
> hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Ohne Noble Blood: Basiswerte | Bloodlines (Necrarch) + Vampire Thrall (Pflicht-Handweapon), **keine** Noble-Blood-Selektion. | GTP-R1 hält nicht (Ist 0, `0 > 0` falsch): **„Magic Level 1" verborgen** (`isHidden` true) und **Mindestmaß 0** (`effectiveMin` 0, `isMandatoryUnmet` false). Die Grenze `c195-…` **feuert nicht** (GTP-R4). | [`01-thrall-without-noble-blood.ros`](rosters/01-thrall-without-noble-blood.ros) |
| 02 | Mit Noble Blood: Gatter kippt Sichtbarkeit **und** Mindestmaß | **Identischer** Aufbau + **Nehekhara's Noble Blood** unter demselben Vampire Thrall. | GTP-R1 hält (Ist 1, `1 > 0` wahr, Schwellwert **genau** überschritten): **„Magic Level 1" sichtbar** (`isHidden` false) und **Mindestmaß 1** (`effectiveMin` 1, `isMandatoryUnmet` true). Da der Slot leer ist, **feuert** `c195-d40a-1c54-f572` mit **Ist 0 / Grenze 1** (GTP-R3/R5). | [`02-thrall-with-noble-blood.ros`](rosters/02-thrall-with-noble-blood.ros) |

**Abwesend behauptete Grenzen (beide Roster):** die Ziel-Obergrenze von „Magic
Level 1" `105e-0c33-0099-b999` (max 1 parent, Ist 0), die Noble-Blood-Obergrenze
`e8e0-d7f1-f9a4-a8c0` (max 1 parent, Ist 0 bzw. 1), die Handweapon-Pflicht des
Thralls `e2bd-1d63-464c-5b6a` (min 1, erfüllt) und die Bloodlines-Pflicht
`4a0a-b107-e726-da32` (min 1 force, erfüllt). In Roster 01 zusätzlich
`c195-d40a-1c54-f572` selbst.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Vampire Thrall (Wurzel-Unit, Hero; der Eltern-Rahmen) | `e37b-c827-99ac-b706` — constraints `d72d-5648-1e88-add3` (min 0 force) / `4369-4ef3-2a81-0ba9` (max −1 pts parent) |
| „Handweapon" des Thralls (Pflicht-Kind) | `9dfd-134c-53c1-7181` — min `e2bd-1d63-464c-5b6a` / max `a66c-1bfe-738d-e621` |
| **entryLink „Magic Level 1" (Träger der Zelle, Basis `hidden="true"`)** | **`86d1-3bd6-6cb2-711d`** → Ziel `158f-d753-59e2-9ad2` (`.gst`, Basis `hidden="false"`, max 1 parent `105e-0c33-0099-b999`) |
| **Eigene Mindestgrenze des Trägers (Basis min 0 → `set` 1)** | **`c195-d40a-1c54-f572`** (`type=min value=0 field=selections scope=parent shared=true includeChildSelections=false`) |
| Nehekhara’s Noble Blood (Gate-Zeuge, 45 pts) | `32d0-a151-94a3-aa54` — constraint `e8e0-d7f1-f9a4-a8c0` (max 1 parent) |
| Link-Kette zum Zeugen: „Magic selection" → „Bloodline" → „Vampiric Powers" (Necrarch) → Noble Blood | `2e0c-7fa1-642c-54b7` → `53e8-0ce2-eaf6-0163`; `85fb-0691-1ee6-37f8` → `0719-24b8-19d4-c832`; `fb5e-133e-b364-6b28` → `8627-7a0f-231c-7572`; `75e7-b83e-a2b3-13af` → `32d0-…` |
| Bloodlines / Bloodline of Clan Necrarch (Kontext, in beiden Rostern) | `a56a-eb32-5a45-16fd` (Pflicht `4a0a-b107-e726-da32`) / `5017-296d-edef-4562` |
| „Necrarch additional casting dice" (Necrarch-Nebenwirkung, **nicht** gepinnt) | `ac9b-9b9e-629b-3229` → `68c7-4c56-8f0b-ad91`; min `c30e-56ff-1881-340f` / max `07af-27f2-a2b3-7859`, beide per Necrarch-`modifierGroup` von 0 auf 1 gesetzt |

### Bewusst nicht gepinnte Facetten

- **`includeChildSelections="true"` an dieser Bedingung.** Die gesamte
  Zeugen-Kette besteht aus `selectionEntryGroup`s; „Nehekhara's Noble Blood"
  liegt in der `.ros` deshalb zwangsläufig als **direktes** Kind im Rahmen. Ein
  Roster, in dem der Zeuge **tiefer** als eine Ebene unter dem Rahmen hängt,
  lässt sich mit diesem Zeugen nicht bauen — die Flag-Wirkung ist an dieser
  Zelle latent und wird weder als feuernd noch als abwesend behauptet.
- **Der Grund der Nicht-Verletzung in Roster 01 ist überbestimmt.** Dort ist das
  Mindestmaß 0 (bei Ist 0 erfüllt) **und** der Slot versteckt (Issue-0088-
  Validierungsverbot). Beide Modifier hängen an derselben Bedingung; die zwei
  Gründe lassen sich mit dieser Fundstelle nicht trennen. Behauptet wird nur das
  Ergebnis: die Grenze feuert nicht.
- **Necrarch-Nebenwirkungen auf den Thrall** (Name, WS −2, Kategorie-Umbau,
  ausgeblendete Waffen/Rüstung, die dynamische Pflicht `c30e-56ff-1881-340f`):
  in beiden Rostern identisch, deshalb ohne Aussagekraft für das Delta — weder
  in `firing` noch in `absent`.
- **Wie die Engine den Slot einordnet** (`anchorKind`): Da sich das Mindestmaß
  zwischen den Rostern ändert, wird die Herkunft des Slots (Angebot vs.
  Pflicht-Anker) bewusst **nicht** behauptet; ausgewählt wird der Slot allein
  über `defId` + `targetDefId`.
