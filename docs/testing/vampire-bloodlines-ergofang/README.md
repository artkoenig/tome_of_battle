# E2E-Regeln & Testkatalog: Vampire Bloodlines — **ergofang-Katalog**

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten abgeleitet; das Roster-Format ist an einer **echten
Beispiel-Datei** (`Test2.rosz`) verifiziert.

> **Warum ein zweites Set?** Es gibt im Repo **zwei** Vampire-Counts-Kataloge,
> die Bloodlines **grundlegend verschieden** modellieren:
>
> | | **Definitive Edition** (`../vampire-bloodlines/`) | **ergofang** (dieses Set) |
> |---|---|---|
> | Katalog | `Vampire Counts (6th definitive edition).cat` `4d73-5ab0-9020-403c` (Fixtures der neuen Engine, `src/evaluator/__fixtures__/whfb6-definitive/`) | `Vampire Counts.cat` `ea4b-9294-3427-1fc1` (`src/solver/__fixtures__/whfb6/`) |
> | Spielsystem | `0d13-7737-ea86-4662` „6th definitive edition" | `6d8e-38d9-3c69-febf` „Warhammer Fantasy Battle 6th edition" |
> | Bloodline liegt … | als **eine** Selektion auf **Force-Ebene**, armeeweit | als **Gruppe in jedem Vampir** einzeln |
> | Kardinalität | min 1 / max 1 je Bloodlines-Selektion (force) | **min 1 UND max 1 je Charakter** (parent) |
> | Mischung | ganze Armee teilt **eine** Bloodline | jeder Vampir kann eine **andere** wählen |
> | Profilwerte | ändern sich (Clan-Kategorie + `instanceOf`-Modifikatoren) | **keine** Profil-Modifikatoren; Bloodline schaltet **Ausrüstung/Powers** frei |
> | Blood-Dragon-ID | `9fd9-…` (Force-Selektion) | `60a4-…`/`0158-…`/`3ce4-…` (3 Kopien, je Charakter) |
>
> Beide Kataloge sind reale Engine-Eingaben (die zwei Beispiel-Roster des Nutzers
> nutzen je einen davon). Dieses Set deckt die **ergofang**-Variante ab.

- Spielsystem: `6d8e-38d9-3c69-febf`, rev 1
- Armee: `Vampire Counts.cat` `ea4b-9294-3427-1fc1`, rev 1 — Force **„Standard"** `7d9d-6c8d-4ea0-b7ad`

## Wie eine Bloodline im ergofang-Katalog gewählt wird (wichtig)

Die Bloodline ist eine **Aufwertung direkt im Vampir-Charakter**, mit leerem
`entryLinkId`. Jeder Vampir-Held (Lord / Count / Thrall) hat eine **eigene**
Gruppe „Bloodline"; die freigeschaltete Ausrüstung/Power hängt **verschachtelt
unter der gewählten Bloodline**. Struktur (am Beispiel Vampire Count):

```
selectionEntry "Vampire Count" (6822-0110-a7c9-cbb0)         ← Einheit
  ├ selectionEntryGroup "Wizard Level" (7ab1-…)   min 1 / max 1  (Pflicht)
  └ selectionEntryGroup "Bloodline"    (63e7-…)   min 1 / max 1  (Pflicht, scope=parent)
       ├ "Blood Dragon" (60a4-…)   → nested: Magic and Traits, Full plate armour, …
       ├ "Von Carstein" (1d4e-…)   → nested: Magic and Traits, Weapons, …
       ├ "Necrach"      (a8be-…)   → nested: Magic and Traits, Mounts
       ├ "Strigoi"      (30ba-…)   → nested: NUR Magic and Traits
       └ "Lahmia"       (1c3b-…)   → nested: Magic and Traits, Mounts
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ERG-R1** | **Jeder** Vampir-Charakter (Lord / Count / Thrall) muss **genau eine** Bloodline führen. | Je-Charakter-Gruppe „Bloodline" trägt **`min=1`** und **`max=1`** `field=selections scope=parent`. Count-Gruppe `63e7-ac1b-014b-3b28` → constraints `min` `56c1-3e68-6f24-3768` / `max` `6d0c-37c1-e5f6-b88d`. Ebenso Lord `01b8-338b-6b92-e37f` und Thrall `0b26-88e3-b6e1-335c`. |
| **ERG-R2** | Die Bloodline ist **pro Charakter**. Zwei Vampire derselben Armee dürfen **verschiedene** Bloodlines haben — es gibt **keine** armee-/force-weite Bloodline-Schranke. | Jede „Bloodline"-Gruppe ist in *ihrer* Einheit verschachtelt (scope=parent); **kein** Constraint mit force-/roster-Scope auf Bloodlines. |
| **ERG-R3** | **Ausrüstung ist clan-spezifisch** (Verfügbarkeit). **Strigoi** bekommt **nur** „Magic and Traits" (keine Waffen/Rüstung/Mounts); „Weapons" nur bei **Von Carstein / Blood Dragon**; „Mounts" nicht bei Strigoi. | (a) **Strukturell:** die nested Gruppen existieren nur unter den erlaubten Clans (Gruppennamen sagen es wörtlich: „Mounts (Stirgoi cannot chose this)", „Weapons for Carstein and Blooddragons"). (b) **Zusätzlich Constraint:** viele Optionen tragen `constraint max=0 field=selections scope=bf30-4ff0-a4d8-3909` (Kategorie **Strigoi**) → für Strigoi gesperrt. |
| **ERG-R4** | **„Full plate armour"** ist ausschließlich unter **Blood Dragon** wählbar (bei Lord/Count als direkte Unterwahl; beim Thrall über dessen „Armour"-Gruppe, die nur Blood Dragon/Von Carstein haben). | „Full plate armour" `1e5a-fe4d-e5ca-5445` ist direktes Kind der Blood-Dragon-Option `60a4-…` (Count) bzw. `0158-…` (Lord). Unter Strigoi/Necrach/Lahmia existiert es nicht. |
| **ERG-R5** | **Befund (kein Verbot):** Die **Magie-Stufe** ist im ergofang-Katalog **nicht** an die Bloodline gekoppelt. Die Pflicht-Gruppe „Wizard Level" (min 1 / max 1) sitzt auf der Einheit, unabhängig vom Clan → ergofang **erlaubt** z. B. **Blood Dragon + Wizard level**, obwohl das am Tisch (6th-ed-Regel) unzulässig wäre. | „Wizard Level"-Gruppe Count `7ab1-d9dc-6124-443f` (min 1 / max 1 scope=parent) trägt **keine** clan-abhängige Bedingung; das Nutzer-Beispiel `Test2.rosz` kombiniert Blood Dragon + Wizard level 1. |

**Hinweis zur Verfügbarkeits-Mechanik (ERG-R3/R4):** Wie beim `hidden`-Mechanismus
des Definitive-Katalogs ist die Clan-Ausrüstung als **Verfügbarkeit** modelliert
(Struktur + `max 0 scope=Strigoi`), nicht überall als zählende Punktschranke. Ob
der Evaluator ein Roster, das eine für den Clan **nicht angebotene** Option trägt,
als unzulässig meldet, hält Test **e05** fest.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
den **ergofang**-Katalog (`ea4b…`) + dessen Spielsystem (`6d8e…`). Format wie die
verifizierte Beispiel-Datei `Test2.rosz` (direktes `entryId`, `entryLinkId=""`,
Bloodline im Charakter verschachtelt).

> **Assertion-Fokus:** nur die genannten Bloodline-Regeln. Andere Diagnosen
> (Pflicht-Wizard-Level, General/Core-Pflicht, Punktelimit) können zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|-------------------------------------|---------|
| e01 | Eine Bloodline je Charakter (legal) | Vampire Count mit **einer** Bloodline (Blood Dragon) + Pflicht-Wizard-Level. | **Keine** Bloodline-Verletzung: ERG-R1 erfüllt (genau 1). | [`e01-bloodline-legal.ros`](rosters/e01-bloodline-legal.ros) |
| e02 | Charakter ohne Bloodline (unzulässig) | Vampire Count **ohne** Bloodline (nur Wizard-Level). | **Verletzung ERG-R1:** die Pflicht `min 1` (`56c1…`) der Bloodline-Gruppe ist unerfüllt (Ist 0). | [`e02-missing-bloodline-illegal.ros`](rosters/e02-missing-bloodline-illegal.ros) |
| e03 | Zwei Bloodlines an einem Charakter (unzulässig) | Vampire Count mit **Blood Dragon** *und* **Lahmia**. | **Verletzung ERG-R1:** `max 1` (`6d0c…`) schlägt an (Ist 2, Grenze 1). | [`e03-two-bloodlines-on-one-character-illegal.ros`](rosters/e03-two-bloodlines-on-one-character-illegal.ros) |
| e04 | Verschiedene Bloodlines auf zwei Charakteren (legal) | Vampire Count = **Blood Dragon**, Vampire Thrall = **Strigoi**. | **Keine** Verletzung (ERG-R2): pro Charakter genau eine Bloodline; keine armeeweite Schranke. | [`e04-mixed-bloodlines-legal.ros`](rosters/e04-mixed-bloodlines-legal.ros) |
| e05 | Strigoi mit Full plate armour (nicht verfügbar) | Vampire Count = **Strigoi**, darunter **Full plate armour** (`1e5a…`, die nur Blood Dragon anbietet). | **ERG-R3/R4:** Die Rüstung ist für Strigoi **nicht angeboten** (strukturell) bzw. via `max 0 scope=Strigoi` gesperrt → unzulässig/nicht verfügbar. *Verfügbarkeits-Test — siehe Hinweis oben.* | [`e05-strigoi-with-armour-unavailable.ros`](rosters/e05-strigoi-with-armour-unavailable.ros) |
| e06 | Blood Dragon mit Rüstung **und** Magie (im ergofang legal) | Replik von `Test2.rosz`: Vampire Count = **Blood Dragon** + Full plate armour + Red Fury + **Wizard level 1** + Handweapon. | **ERG-R4** (Rüstung für Blood Dragon verfügbar) **und ERG-R5** (Magie nicht per Bloodline gesperrt): **keine** Verletzung. Pinnt die Modellierungs-Differenz zum Tischregelwerk. | [`e06-blood-dragon-armour-and-magic-legal.ros`](rosters/e06-blood-dragon-armour-and-magic-legal.ros) |

## Engine-Lauf: tatsächliches Verhalten (verifiziert)

Alle Fixtures wurden **durch die Engine-Fassade `evaluate`** gegeben (Black-Box:
Roster rein → Bericht raus; Instanzbaum aus dem `.ros` abgeleitet). Ergebnis:

| Regel | Skopus | Engine meldet es? | Beleg |
|-------|--------|-------------------|-------|
| **ERG-R1** (Bloodline min 1 je Charakter) | **parent/Gruppe** | **NEIN** | Test e02: `56c1-3e68-6f24-3768` feuert nicht (Count ohne Bloodline). |
| **ERG-R1** (Bloodline max 1 je Charakter) | **parent/Gruppe** | **NEIN** | Test e03: `6d0c-37c1-e5f6-b88d` feuert nicht — auch nicht mit Gruppen-Zwischenknoten `63e7…`. |
| **ERG-R2** (mischbar) | — | **legal (keine Verletzung)** | Test e04: zwei Charaktere, verschiedene Clans → keine Bloodline-Verletzung. |
| **ERG-R3/R4** (clan-spezifische Ausrüstung) | Verfügbarkeit | **NEIN** | Test e05: keine Verletzung — Verfügbarkeit ist nicht als Verletzung kodiert. |
| **ERG-R5** (Magie nicht gekoppelt) | — | **legal** | Test e06: keine Verletzung. |

**Befund:** identisch zum Definitive-Set — **parent-/gruppen-skopierte**
Selektions-Zähl-Constraints (hier die per-Charakter-Bloodline min/max) werden über
die `evaluate`-Fassade **nicht** als Verletzung gemeldet; verfügbarkeitsbasierte
Regeln (ERG-R3/R4) erscheinen nicht im Verletzungsbericht. Die Fixtures halten
genau das fest. (Der einzige gemeldete Befund in allen ergofang-Rostern ist die
force-weite „General"-Pflicht `1077-7379-f142-f382` — ohne Belang für die
Bloodline-Regeln.)

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard" (ergofang VC) | `7d9d-6c8d-4ea0-b7ad` |
| Vampire Count (Lord) | `6822-0110-a7c9-cbb0` — Bloodline-Gruppe `63e7-ac1b-014b-3b28` (min `56c1-3e68-6f24-3768` / max `6d0c-37c1-e5f6-b88d`), Wizard-Level-Gruppe `7ab1-d9dc-6124-443f` |
| Vampire Lord | `b77b-88d5-5e80-e178` — Bloodline-Gruppe `01b8-338b-6b92-e37f` |
| Vampire Thrall | `e37b-c827-99ac-b706` — Bloodline-Gruppe `0b26-88e3-b6e1-335c` |
| Bloodline-Optionen Count: Blood Dragon / Von Carstein / Necrach / Strigoi / Lahmia | `60a4-751a-19aa-35dc` / `1d4e-dcc1-f62a-c578` / `a8be-2466-4c0c-d453` / `30ba-e15f-9acd-7663` / `1c3b-07da-b7f9-4b22` |
| Bloodline-Optionen Thrall: Strigoi | `c14f-1bd4-3d59-fc4e` |
| Kategorie „Strigoi" (Ausschluss-Scope `max 0`) | `bf30-4ff0-a4d8-3909` |
| Full plate armour (nur Blood Dragon) | `1e5a-fe4d-e5ca-5445` |
| Red Fury (Vampiric Power) | `d846-d67c-02c6-6856` |
| Wizard level 1 (Count, Pflicht-Gruppe) | `3c1a-3350-04ae-7a3f` |
| Handweapon (Count) | `7b76-de50-6c9b-60c3` |

*Die Clan-**Kategorie**-IDs sind in beiden Katalogen identisch
(Blood Dragon `4cae…`, Necrach `fc4b…`, Strigoi `bf30…`, Lahmia `c872…`,
Von Carstein `ff24…`) — verschieden ist nur, **wie** die Bloodline gewählt wird
und **was** sie bewirkt.*
