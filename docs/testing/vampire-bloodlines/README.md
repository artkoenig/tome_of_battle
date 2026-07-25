# E2E-Regeln & Testkatalog: Vampire Bloodlines (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an einer **echten Beispiel-Datei** (`test.rosz`) verifiziert.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard"** `e989-15b8-7eb6-9668`

> **Zwei Kataloge, zwei Modelle.** Dieses Set gilt für den **Definitive**-Katalog
> (`4d73…`), den die neue Engine als Fixtures nutzt. Der **ergofang**-Katalog
> (`ea4b…`, alter Solver) modelliert Bloodlines völlig anders (pro Charakter statt
> armeeweit, Ausrüstung statt Profil) — dafür gibt es ein eigenes Parallel-Set unter
> [`../vampire-bloodlines-ergofang/`](../vampire-bloodlines-ergofang/README.md).

## Wie eine Bloodline im Roster gewählt wird (wichtig)

Anders als bei verlinkten Aufwertungen (Konvention `linkId::targetId`) werden
Bloodlines **direkt über die eigene `entryId`** gewählt, mit leerem
`entryLinkId`. Die „Bloodline of Clan X"-Einträge sind **inline-`selectionEntry`-
Kinder** der Gruppe „Vampiric Bloodline" — sie erscheinen daher **nie als
`targetId`** im Katalog, sind aber sehr wohl wählbar. Struktur:

```
selectionEntry "Bloodlines" (a56a-eb32-5a45-16fd)          ← Force-Selection
  └ selectionEntryGroup "Vampiric Bloodline" (5655-…)      max 1 (scope=parent)
       ├ "Bloodline of Clan Blood Dragon" (9fd9-…)
       ├ "Bloodline of Clan Lahmia"       (4f07-…)
       ├ "Bloodline of Clan Necrarch"     (5017-…)
       ├ "Bloodline of Clan Strigoi"      (ddfa-…)
       └ "Bloodline of Clan Von Carstein" (f557-…)
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **VBL-R1** | Eine Vampire-Counts-Armee muss **mindestens eine** „Bloodlines"-Selektion enthalten. | `selectionEntry "Bloodlines"` `a56a…` → constraint **`4a0a-b107-e726-da32`** `type=min value=1 field=selections scope=force`. |
| **VBL-R2** | Pro „Bloodlines"-Selektion darf **höchstens eine** Clan-Bloodline gewählt werden. | Gruppe `"Vampiric Bloodline"` `5655…` → constraint **`39c7-f615-17db-7016`** `type=max value=1 field=selections scope=parent`. |
| **VBL-R3** | Es gibt **keine** armee­weite Clan-Eindeutigkeit und **keine** erzwungene Übereinstimmung Charakter↔Armee-Clan. Die Clan-Zugehörigkeit steuert nur **Verfügbarkeit (`hidden`)** und **Namen** (z. B. „Vampire Count" → „Vampire Countess" bei Clan Lahmia). | Gruppe `5655…` hat **kein** force-scope-`max`; die Clan-Einträge haben nur `min=0` (No-op). Modifikatoren an Einheiten setzen `hidden`/`name`, keine zählende Schranke. **Nicht als harte Regel prüfbar.** |
| **VBL-R4** | **Verstecken:** Ist eine **Strigoi**-Bloodline in der Force, wird die Gruppe **„Magic selection"** ausgeblendet → Vampire dieser Armee können **keine magischen Gegenstände** wählen. | Gruppe „Magic selection" `53e8-0ce2-eaf6-0163` (Basis `hidden=false`) → `modifier set hidden=true` mit `condition atLeast 1 childId="ddfa-…" (Strigoi) scope=force`. (Eingebunden in Vampire Lord/Count/Thrall/Fleet Captain.) |
| **VBL-R5** | **Einblenden:** Die Gruppe **„Armour"** des **Vampire Thrall** ist standardmäßig verborgen und wird nur eingeblendet, wenn eine **Blood-Dragon-** oder **Von-Carstein**-Bloodline in der Force ist. | Gruppe „Armour" `66f2-d6a1-420c-5a39` (Basis `hidden=true`) → `modifier set hidden=false` mit `condition atLeast 1 childId="9fd9-…" (Blood Dragon) scope=force` bzw. `9fd9`/`f557` (Von Carstein). |
| **VBL-R6** | **Profilwerte:** Die gewählte Bloodline ändert die **Profilwerte** (WS, Attacken, Rüstungswurf) der Vampir-Charaktere **Vampire Lord / Vampire Count / Vampire Thrall**. Blood Dragon: **WS +2**, Rüstung **Sv 4+**. Necrarch: **WS −2**. Strigoi: **A +1**, schlechterer Rüstungswurf (**Sv+ 5+** Lord/Count, **6+** Thrall). Lahmia & Von Carstein: **keine** Profiländerung (Basiswerte). | Zweistufige Kette (beide Stufen in den Daten verifiziert): **(1)** Wahl der Bloodline in der Force → nested `modifierGroup` je Vampir-Held setzt die **Clan-Kategorie** der Einheit (`add category`) und hängt „of Clan X" an den Namen — Bedingung `atLeast 1 childId=<Bloodline> scope=force`. **(2)** Profil-`modifier` auf der Einheit (`set/increment/decrement` auf WS/A/Sv/Sv+) mit `condition instanceOf … childId=<Clan-Kategorie> scope=<eigene Einheit>`. Kategorien: Blood Dragon `4cae-a20e-8374-b6cb`, Necrarch `fc4b-a86d-5897-9e4c`, Strigoi `bf30-4ff0-a4d8-3909`, Lahmia `c872-4b18-1aad-6953`, Von Carstein `ff24-ca11-afd5-865b`. |

**Hinweis zum `hidden`-Mechanismus (VBL-R4/R5):** Diese Regeln sind — wie bei den
Magie-Items des Standartenträgers — als **Verfügbarkeit** (`hidden`) modelliert,
nicht als zählende/punktende Schranke. Ob der Evaluator eine verfügbarkeits­
bedingte (Un-)Sichtbarkeit meldet bzw. eine bereits gewählte, nun verborgene
Selektion als unzulässig markiert, ist genau das, was die Tests 04–06 festhalten.

**Hinweis zum Auslöser von VBL-R6:** Die Profil-`condition` ist
`instanceOf … value=0/1` — welche exakte Vergleichslogik der Evaluator dahinter
anwendet, ist engine-intern und wird als Black-Box **nicht** unterstellt. Die
Tests 07–09 nehmen daher denselben **Vampire Count** (`6822…`) und variieren
**nur** die Bloodline; die Assertion lautet: die vom Evaluator berechneten
Profilwerte **unterscheiden sich je Bloodline** und entsprechen den in VBL-R6
genannten Richtungen (Blood Dragon ≠ Necrarch ≠ Strigoi; Lahmia = Basis). Die
konkreten Zielzahlen pinnt der Test gegen die tatsächliche Engine-Ausgabe.

### Sichtbarkeit je Bloodline — verifizierte Karte (force-scope)

| Bloodline | blendet **ein** (`hidden=false`) | blendet **aus** (`hidden=true`) |
|-----------|----------------------------------|----------------------------------|
| Blood Dragon | Thrall „Armour" `66f2`, Wight Lord „Armour" `5771`, Vampire Lord/Count „Weapons and Armour" `ac8f`/`06c9` | — |
| Von Carstein | Thrall „Armour" `66f2` | — |
| Strigoi | — | „Magic selection" `53e8` |
| Lahmia / Necrarch | (nur die immer sichtbare Gruppe „Bloodline" `0719`) | — |

*(Die Gruppe „Bloodline" `0719` ist bereits per Basis sichtbar; die Reveal-Modifikatoren aller fünf Clans sind dort effektiv redundant.)*

**Hinweis zu VBL-R1 (Seeding):** `min`-Regeln feuern nur, wenn die betroffene
Definition im Kontingent instanziiert ist. Ob der Evaluator die Force-Untergrenze
auf einer Armee **ohne** „Bloodlines"-Selektion als Verletzung meldet, hängt vom
Seeding-Verhalten ab (dieselbe Feinheit wie bei den mandatorischen Phantom-
Einträgen in Issue 67). Test 02 pinnt genau das fest.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + Vampire-Counts-`.cat` (+ die per `catalogueLink` benötigte
`Mercenaries`-`.cat`). Format wie die verifizierte Beispiel-Datei
(direktes `entryId`, `entryLinkId=""`).

> **Assertion-Fokus:** nur die genannten Bloodline-Constraint-IDs. Andere
> Armeeaufbau-Diagnosen (General/Core-Pflicht, Punktelimit) können zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Eine Bloodline (legal) | `.gst` + VC-`.cat` (+ Mercenaries) | „Bloodlines" mit **einer** Clan-Bloodline (Blood Dragon) + ein Vampire Count. | **Keine** Bloodline-Verletzung: Pflicht (≥1) erfüllt, Clan-Obergrenze (1) erfüllt. | [`01-bloodline-legal.ros`](rosters/01-bloodline-legal.ros) |
| 02 | Keine Bloodline (unzulässig) | wie 01 | Nur ein Vampire Count, **keine** „Bloodlines"-Selektion. | **Verletzung von VBL-R1:** die Force-Pflicht `4a0a…` (min 1) ist unerfüllt (Ist 0). *Siehe Seeding-Hinweis oben — der Test hält fest, ob die Engine dies meldet.* | [`02-missing-bloodline-illegal.ros`](rosters/02-missing-bloodline-illegal.ros) |
| 03 | Zwei Clan-Bloodlines in einer „Bloodlines" (unzulässig) | wie 01 | Eine „Bloodlines" mit **zwei** Clan-Bloodlines (Blood Dragon **und** Lahmia). | **Verletzung von VBL-R2:** die Clan-Obergrenze `39c7…` (max 1, scope=parent) schlägt an (Ist 2, Grenze 1). | [`03-two-clans-in-one-bloodlines-illegal.ros`](rosters/03-two-clans-in-one-bloodlines-illegal.ros) |
| 04 | Strigoi versteckt „Magic selection" | wie 01 | „Bloodlines" mit **Strigoi** + ein Vampire Count. | **VBL-R4:** Die Gruppe „Magic selection" (`53e8…`) ist auf allen Vampiren **verborgen** → keine magischen Gegenstände wählbar. | [`04-strigoi-hides-magic-selection.ros`](rosters/04-strigoi-hides-magic-selection.ros) |
| 05 | Blood Dragon blendet Thrall-„Armour" ein | wie 01 | „Bloodlines" mit **Blood Dragon** + ein Vampire Thrall. | **VBL-R5:** Die standardmäßig verborgene Gruppe „Armour" (`66f2…`) des Thralls wird **sichtbar** → Rüstungsoptionen wählbar. | [`05-blood-dragon-reveals-thrall-armour.ros`](rosters/05-blood-dragon-reveals-thrall-armour.ros) |
| 06 | Neutrale Grundlinie (Lahmia) | wie 01 | „Bloodlines" mit **Lahmia** + Vampire Thrall + Vampire Count. | Weder VBL-R4 noch VBL-R5 greifen: „Magic selection" (`53e8…`) bleibt **sichtbar**, Thrall-„Armour" (`66f2…`) bleibt **verborgen**. | [`06-lahmia-visibility-baseline.ros`](rosters/06-lahmia-visibility-baseline.ros) |
| 07 | Profil: Blood Dragon | wie 01 | **Derselbe** Vampire Count (`6822…`), Bloodline **Blood Dragon**. | **VBL-R6:** Profil zeigt **WS +2** und Rüstung **Sv 4+** ggü. Basis; Name wird „… of Clan Blood Dragon". | [`07-profile-blood-dragon-count.ros`](rosters/07-profile-blood-dragon-count.ros) |
| 08 | Profil: Necrarch | wie 01 | **Derselbe** Vampire Count, Bloodline **Necrarch**. | **VBL-R6:** Profil zeigt **WS −2** ggü. Basis (und ggü. Test 07 deutlich niedriger). | [`08-profile-necrarch-count.ros`](rosters/08-profile-necrarch-count.ros) |
| 09 | Profil: Strigoi | wie 01 | **Derselbe** Vampire Count, Bloodline **Strigoi**. | **VBL-R6:** Profil zeigt **A +1** und schlechteren Rüstungswurf **Sv+ 5+**; WS unverändert. Kontrast zu 07/08 belegt die Bloodline-Abhängigkeit. | [`09-profile-strigoi-count.ros`](rosters/09-profile-strigoi-count.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard" (VC) | `e989-15b8-7eb6-9668` |
| „Bloodlines" (Force-Selection, Pflicht min 1) | `a56a-eb32-5a45-16fd` — constraint `4a0a-b107-e726-da32` |
| Gruppe „Vampiric Bloodline" (max 1 Clan) | `5655-13ba-8980-bd1c` — constraint `39c7-f615-17db-7016` |
| Bloodline of Clan Blood Dragon | `9fd9-e05c-ffcb-2c4d` |
| Bloodline of Clan Lahmia | `4f07-e982-6665-70b7` |
| Bloodline of Clan Necrarch / Strigoi / Von Carstein | `5017-296d-edef-4562` / `ddfa-0d72-8557-6906` / `f557-097a-d26b-9363` |
| Vampire Count (Lord) | `6822-0110-a7c9-cbb0` |
| Vampire Thrall (Hero) | `e37b-c827-99ac-b706` |
| Gruppe „Magic selection" (Strigoi versteckt) | `53e8-0ce2-eaf6-0163` |
| Gruppe „Armour" Vampire Thrall (Blood Dragon/Von Carstein blenden ein) | `66f2-d6a1-420c-5a39` |
| Vampire Lord (Lord) | `b77b-88d5-5e80-e178` |
| Clan-Kategorie Blood Dragon / Necrarch / Strigoi | `4cae-a20e-8374-b6cb` / `fc4b-a86d-5897-9e4c` / `bf30-4ff0-a4d8-3909` |
| Clan-Kategorie Lahmia / Von Carstein (kein Profil-Effekt) | `c872-4b18-1aad-6953` / `ff24-ca11-afd5-865b` |
