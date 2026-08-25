# E2E-Regeln & Testkatalog: `atLeast … childId="model" scope="parent"` — der Eltern-Rahmen als Champion-Tor (Dwarfs)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an **echten Beispiel-Dateien** bestehender Szenarien verifiziert
(`../at-least-self-model-count/rosters/01-ten-models-in-carrier.ros`: direktes
`entryId`, kein `entryLinkId`, verschachtelte `selections` mit `number`,
`costLimits` am Wurzelelement).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Dwarfs (2005) (6th definitive edition).cat`
  (`a505-6b65-703b-4976`, Katalogname „Dwarfs (2006)", rev 1) — Force
  **„Standard (DW2-AB)"** `8bd9-db54-8bdc-cdfa`
- Zusatz: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`),
  von Dwarfs per `catalogueLink` `1a0f-ac09-e659-9629` eingebunden
  (Abhängigkeit des Datensatzes, im Szenario sonst ungenutzt)

## Der gepinnte Mechanismus

Die **Bedingungszelle** `condition | atLeast | parent | selectionCount |
child=model`. Träger ist das Upgrade **„Champion"** (der *Giant Slayer*) in der
Gruppe „Command Group" der Einheit **„Slayers"**:

```
selectionEntry "Slayers" (b454-4868-7ec4-39e8, type=unit, Wurzel-Eintrag der DW-.cat)
  ├ selectionEntry "Slayer" (5869-aa55-953f-ca41, type=model)   min 5 / max 30 (scope=parent)
  ├ selectionEntryGroup "Command Group" (1b9c-8ae4-e9cf-c9b0)   ← ohne eigene Grenzen
  │    ├ "Standard Bearer" (a8a7-2590-e317-a1b1)  max 1  45ad-0c89-924b-b331
  │    ├ "Champion"        (21f9-b4f6-b59e-8892)
  │    │     ├ constraint max 0 selections scope=parent shared   c120-7f3a-9c4d-6d32  ← Basiswert
  │    │     └ modifier increment 1 field=c120-7f3a-9c4d-6d32
  │    │          └ condition atLeast value=1 field=selections scope=parent
  │    │                       childId="model" shared="true"
  │    └ "Musician"        (f941-4b4f-9d2f-7f73)  max 1  0e60-51c2-4346-d540
  └ selectionEntryGroup "Weapons" (9334-7b81-430b-0b51)
       ├ entryLink "Hand Weapon" (aa11-66a6-8b41-11c9 → .gst abdb-bbd0-41b2-5dff)  min 1 / max 1
       └ entryLink "Slayer Axes" (c4f4-0594-1f28-1e45 → DW 5c36-8e8c-6838-df6b)    min 1
```

Drei Aussagen stecken in dieser einen Bedingung, und alle drei sind aus den
Daten ablesbar:

1. **Was gezählt wird** — `childId` trägt kein Ziel, sondern das **Typ-Keyword**
   `model`: gezählt werden Auswahlen, deren (ggf. über einen `entryLink`
   geerbter) roher `type` `model` ist; `field="selections"` macht daraus eine
   Stückzahl ([Formatdoku §7.7](../../battlescribe-data-format.md)). Unter der
   Einheit ist das allein „Slayer" (`type="model"`) — „Champion", „Hand Weapon"
   und „Slayer Axes" sind `type="upgrade"` und zählen **nicht**.
2. **In welchem Rahmen** — `scope="parent"` ist die **Elternauswahl des
   Trägers**. Der Träger ist der Champion-Platz; sein Elternteil im Roster ist
   die Slayers-Auswahl, denn `selectionEntryGroup`s erscheinen in der `.ros`
   **nicht** als eigene `selection` (Formatdoku §4/§7.1) — die Gruppe „Command
   Group" ist also kein Rahmen. Kontingent (`force`) und Roster sind es
   ebensowenig.
3. **Wie tief** — das Element schreibt **kein** `includeChildSelections`; die
   XSD-Vorgabe an `QueryBase` ist `false` (`src/platform/battlescribe/schema/Catalogue.xsd:430`).
   Gezählt werden damit nur die **direkten** Selektionen des Rahmens
   („just `scope`'s `field`", Formatdoku §7.6) — die Modelle *dieser* Einheit,
   nicht die einer verschachtelten Unterauswahl.

`shared="true"` ist hier **nicht beobachtbar**: der Champion ist ein
inline-`selectionEntry` genau einer Gruppe und über keinen `entryLink`
erreichbar (die Id `21f9-b4f6-b59e-8892` kommt im gesamten Fixture-Satz genau
einmal vor), und `childId="model"` ist ein Typ-Keyword ohne Instanzen, die
geteilt werden könnten.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **APMCG-R1** | Der geschriebene Champion-Deckel einer Slayers-Einheit ist **max 0** — ohne Freischaltung ist der Champion nirgends legal wählbar. | `Dwarfs (2005) (6th definitive edition).cat`, `selectionEntry "Champion"` `21f9-b4f6-b59e-8892` (Zeile 3082) → constraint **`c120-7f3a-9c4d-6d32`** (`type="max" value="0" field="selections" scope="parent" shared="true" includeChildSelections="false"`, Zeile 3084). |
| **APMCG-R2** | Hält die Einheit **mindestens ein** Modell, wird dieser Deckel **um genau 1 angehoben** — auf 1, nicht auf „unbegrenzt". | Ebd. (Zeile 3103) → `modifier type="increment" value="1" field="c120-7f3a-9c4d-6d32"` mit `condition type="atLeast" value="1" field="selections" scope="parent" childId="model" shared="true"` (Zeile 3105). **Kein `<repeats>`** am Modifier, also genau eine Anwendung; `increment` rechnet auf dem Basiswert (0 + 1 = 1). |
| **APMCG-R3** | **Kein weiterer** Modifier im Datensatz adressiert `c120-7f3a-9c4d-6d32`. Der Deckel ist damit vollständig durch R1+R2 bestimmt. | Volltextsuche über `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`: genau zwei Fundstellen der Id — die Constraint (Zeile 3084) und der `increment` (Zeile 3103). |
| **APMCG-R4** | Der Zählrahmen ist die **umschließende Einheiten-Auswahl**, nicht die Optionsgruppe und nicht das Kontingent. Modelle einer *anderen* Slayers-Einheit desselben Kontingents heben den Deckel **nicht**. | Ebd., `scope="parent"`; [Formatdoku §7.6/§7.7](../../battlescribe-data-format.md) (der `scope` bestimmt den Bezugsrahmen; `parent` vergleicht die aufgelösten Ziel-Ids der Elternauswahl) und §4/§7.1 (Gruppen sind Katalogstruktur und erscheinen in der Roster nicht als Auswahl). |
| **APMCG-R5** | Gezählt wird der **rohe `type`** der direkten Kindauswahlen: „Slayer" (`type="model"`) zählt mit seiner `number`, „Champion"/„Hand Weapon"/„Slayer Axes" (`type="upgrade"`) zählen nicht. | DW-`.cat`: `selectionEntry type="model"` `5869-aa55-953f-ca41` (Zeile 3026); `type="upgrade"` `21f9-b4f6-b59e-8892` (3082); `.gst` `abdb-bbd0-41b2-5dff` `type="upgrade"` (Zeile 1032); DW-`.cat` `5c36-8e8c-6838-df6b` `type="upgrade"` (Zeile 6384). |
| **APMCG-R6** | **Pflichtstärke der Einheit:** jede Slayers-Einheit braucht **min 5** Slayer-Modelle und darf höchstens **30** führen. Eine Einheit ohne Modellauswahl verletzt also nicht nur den Champion-Deckel. | DW-`.cat` → `5869-aa55-953f-ca41` → constraints **`a619-c7e4-50f4-156d`** (`min 5`, Zeile 3043) und **`8306-da59-2f34-318b`** (`max 30`, Zeile 3042), beide `scope="parent" shared="true" includeChildSelections="false"`. Der einzige Modifier auf `8306…` (`set 25`) ist an „Border Patrols rules" `4e15-0353-165f-5528` gegatet — kein Roster dieses Szenarios führt diesen Eintrag. Auf `a619…` wirkt **kein** Modifier. |
| **APMCG-R7** | **Pflichtbewaffnung:** jede Slayers-Einheit braucht genau eine „Hand Weapon" und mindestens eine „Slayer Axes". Alle Roster führen beide, damit diese Untergrenzen kontrolliert still bleiben. | DW-`.cat`, Gruppe „Weapons" `9334-7b81-430b-0b51`: `entryLink` `aa11-66a6-8b41-11c9` → **`05cf-7952-768d-2983`** (`min 1`) / **`d522-c96e-aaca-21b5`** (`max 1`); `entryLink` `c4f4-0594-1f28-1e45` → **`f7c1-43d3-45ac-6b4c`** (`min 1`). Am Ziel: `.gst` `abdb-bbd0-41b2-5dff` → **`bdef-ba9b-d6ce-5b14`** (`min 1`) / **`e28e-dbb4-b8ad-d4ab`** (`max 1`); DW-`.cat` `5c36-8e8c-6838-df6b` → **`318a-87b8-ecbd-6dff`** (`max 1`). Alle `scope="parent"`. Die Roster-Selektion trägt die **Ziel**-Id — `scope="parent"` vergleicht aufgelöste Ziel-Ids, nicht `entryLinkId`s (Formatdoku §3.4/§7.6). |
| **APMCG-R8** | Im Kontingent **„Standard (DW2-AB)"** ist die Slayers-Einheit **nicht verborgen** und behält ihre Kategorie „Special"; alle ihre Sichtbarkeits- und Umgliederungs-Modifikatoren bleiben inert. | DW-`.cat` → `b454-4868-7ec4-39e8` → `modifier set hidden="true"` nur bei `instanceOf` der Forces „Royal Clan" `fe66-8f64-704f-dc84` bzw. „Guild Expedition" `37f8-30a3-8720-6b2c` (Zeilen 3139–3148); drei `modifierGroup`s gattern Namens-/Kategorienwechsel auf die Forces `da11-3c95-580e-1a4f`, `d18e-88cd-44b8-f527`, `f130-ff1b-2f7b-e49f`. Alle Roster nutzen `8bd9-db54-8bdc-cdfa`. |
| **APMCG-R9** | Die Geschwister im „Command Group" tragen **max 1** und sind in keinem Roster gewählt — der `max 0`-Basiswert des Champions ist die Ausnahme, nicht die Regel der Gruppe. Die Gruppe selbst trägt **keine** Grenze. | DW-`.cat`, Gruppe `1b9c-8ae4-e9cf-c9b0` (Zeile 3063, ohne `<constraints>`): „Standard Bearer" → **`45ad-0c89-924b-b331`** (`max 1`), „Musician" → **`0e60-51c2-4346-d540`** (`max 1`). |

**Ableitung des Erwartungsbilds (aus den Daten, nicht aus einem Engine-Lauf):**
`bound` ist der Wert der Grenze **nach** Anwendung des einzigen Modifiers
(R2/R3): **0**, solange der Eltern-Rahmen 0 Modelle zählt, sonst **1**.
`actual`/`current` ist die Summe der `number` aller Champion-Selektionen im
selben Rahmen. Daraus:

| Rahmenzustand | Zählung `childId="model"` | Deckel `c120…` | Champions | Ergebnis |
|---------------|---------------------------|----------------|-----------|----------|
| 5 Modelle, 1 Champion | 5 ≥ 1 → hält | 0 + 1 = **1** | 1 | still, `effectiveMax=1`, Spielraum 0 |
| 0 Modelle, 1 Champion | 0 < 1 → hält nicht | **0** | 1 | feuert **Ist 1 / Grenze 0**, `effectiveMax=0` |
| 5 Modelle, 2 Champions | 5 ≥ 1 → hält | **1** | 2 | feuert **Ist 2 / Grenze 1** |
| 0 Modelle (Nachbareinheit hat 5), 1 Champion | 0 < 1 → hält nicht | **0** | 1 | feuert **Ist 1 / Grenze 0**, und zwar **genau einmal** |

Der **Anzeigename** des Platzes bleibt in allen Rostern „Champion": der einzige
`set … field="name"`-Modifikator des Eintrags steht **innerhalb** des
`<infoLink>` `70d7-f22a-7396-c9fe` und benennt damit das dort bezogene *Profil*
(„Giant Slayer"), nicht den Eintrag selbst (Formatdoku §7.2: ein Modifier am
Verweis ändert die Eigenschaften des **Ziels**). Deshalb assertiert das Manifest
`name: "Champion"`.

**Bewusst nicht Gegenstand dieses Szenarios:**

- **Profilwirkung des Champions:** Der `infoLink` `70d7-f22a-7396-c9fe` auf das
  Profil `463e-2eae-8cc7-95e7` setzt Profilname „Giant Slayer", A 2, S 4, WS 5,
  Ld 10. Das ist eine **Profiländerung**, keine zählende Grenze — sie erscheint
  **nicht** im Verletzungsbericht und wird hier nicht assertiert (dieselbe
  Abgrenzung wie VBL-R6 in
  [`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md)).
- **`hidden`:** Die Sichtbarkeits-Modifikatoren der Slayers-Einheit (R8) sind in
  allen Rostern inert; Verfügbarkeit wäre ohnehin keine feuernde Grenze. Am
  Champion-Platz wird `isHidden=false` nur als Kontrolle mitgeführt, damit
  sichtbar bleibt: das Tor ist ein **Deckel**, kein Verstecken.
- **Kategorie „BP Infantry 10+":** Der `add category`-Modifier der Slayers-Einheit
  (`6ad6-f54e-1867-00a7`) hängt an einer `and`-Gruppe mit „Border Patrols rules"
  `4e15-0353-165f-5528`; kein Roster führt diesen Eintrag, der Modifier bleibt
  aus. Diese Zelle pinnt bereits
  [`../at-least-self-model-count/`](../at-least-self-model-count/README.md).
- **Armeeaufbau-Diagnosen:** General-/Core-Pflichten des Kontingents,
  Kategorie-Kontingente und das Punktebudget (alle Roster: `costLimit` 2000 pts,
  verbraucht 15–85 pts) können zusätzlich melden und sind ohne Belang.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Dwarfs-`.cat` + Mercenaries-`.cat`, alle nutzen die Force
„Standard (DW2-AB)" (`8bd9-db54-8bdc-cdfa`), alle tragen `costLimit` 2000 und in
jeder Slayers-Einheit die Pflichtbewaffnung (R7). Einziger Unterschied zwischen
den Rostern: **wo Modelle und Champions stehen**.

> **Assertion-Fokus:** die gegatete Grenze `c120-7f3a-9c4d-6d32` (feuert /
> feuert nicht, mit `actual`/`bound`) und das effektive Maximum des
> Champion-Platzes (`expect.capabilities`, Feld `effectiveMax`). Dazu die
> Pflichtstärke `a619-c7e4-50f4-156d`, die in den modelllosen Einheiten
> mitfeuert (R6), und die Stille der übrigen Einheiten-Grenzen (R7/R9). Andere
> Armeeaufbau-Diagnosen können zusätzlich auftreten und sind ohne Belang.

| # | Testtitel | Roster-Zustand | Zählung `childId="model"` im Eltern-Rahmen | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|--------------------------------------------|-------------------------------------------------------|---------|
| 01 | Modelle da: Deckel steht auf 1 | 1 Slayers-Einheit: 5 Slayer, 1 Champion, Pflichtwaffen. | **5** ≥ 1 → hält | **APMCG-R2:** Der `increment` greift, `c120…` steht auf **1**; der eine Champion hält ihn exakt ein → **keine** Verletzung, Platz meldet `effectiveMax=1`, `current=1`, Spielraum 0, `isBlocked=true`. Alle übrigen Grenzen der Einheit sind erfüllt (R6/R7/R9). | [`01-models-present-cap-raised-to-one.ros`](rosters/01-models-present-cap-raised-to-one.ros) |
| 02 | Keine Modelle: Deckel bleibt 0 | Wie 01, **ohne** die Slayer-Auswahl — das einzige Delta. | **0** < 1 → hält nicht | **APMCG-R1:** Der `increment` bleibt aus, `c120…` behält **max 0** und feuert (**Ist 1 / Grenze 0**); Platz meldet `effectiveMax=0`. Zusätzlich feuert die Pflichtstärke `a619…` (**Ist 0 / Grenze 5**, R6). `8306…` (max 30) bleibt bei Ist 0 still. | [`02-no-models-cap-stays-zero.ros`](rosters/02-no-models-cap-stays-zero.ros) |
| 03 | Angehobener Deckel gerissen | Wie 01, aber die Champion-Selektion trägt `number="2"`. | **5** ≥ 1 → hält | **APMCG-R2 (Gegenprobe):** Der Deckel ist **1**, nicht „unbegrenzt" — zwei Champions reißen ihn (**Ist 2 / Grenze 1**), Platz meldet `effectiveMax=1` bei `current=2`. Ohne diesen Fall bliebe offen, ob der `increment` den Deckel nur *irgendwie* hebt. | [`03-models-two-champions-raised-cap-exceeded.ros`](rosters/03-models-two-champions-raised-cap-exceeded.ros) |
| 04 | Der Rahmen trennt | Einheit **A**: Champion, **keine** Modelle. Einheit **B**: 5 Modelle, **kein** Champion. Beide im selben Kontingent. | A: **0** → hält nicht. B: **5** → hält | **APMCG-R4:** Kontingent-/rosterweit stünden 5 Modelle neben dem Champion — wäre der Rahmen `force` oder `roster`, läge As Deckel bei 1 und die Grenze bliebe fälschlich still. Sie feuert **genau einmal** (**Ist 1 / Grenze 0**, `count: 1`), und zwar an A; Bs (ungewählter) Champion-Platz meldet `effectiveMax=1`, `current=0`, Spielraum 1. Dieselbe Definition, zwei Rahmen, zwei Deckel. Die Pflichtstärke `a619…` feuert für A (Ist 0 / Grenze 5) und ist für B erfüllt. | [`04-models-in-other-unit-frame-separated.ros`](rosters/04-models-in-other-unit-frame-separated.ros) |

**Beweisführung in beide Richtungen:** Roster 01 schlägt fehl, wenn die Engine
die Bedingung gar nicht hält (dann feuerte `c120…` fälschlich) oder den
`increment` zu großzügig anwendet. Roster 02 schlägt fehl, wenn sie den Rahmen
zu weit fasst oder `type="upgrade"`-Auswahlen als Modelle zählt (dann bliebe die
Grenze fälschlich still). Roster 03 schlägt fehl, wenn `increment` als „Grenze
aufheben" gelesen wird. Roster 04 trennt schließlich `parent` von `force` und
`roster`: dort ist die Modellzahl im weiteren Rahmen ausreichend und im engeren
nicht. Das Paar 01/02 unterscheidet sich **nur** in der Existenz der
Modell-Selektion.

**Punktekontrolle (nicht Teil der Assertion):** Slayer 11 pts, Champion 15 pts,
Hand Weapon 0, Slayer Axes 0, Einheit 0. Roster 01: 70 pts, Roster 02: 15 pts,
Roster 03: 85 pts, Roster 04: 70 pts — alle weit unter `costLimit` 2000, damit
keine Budget-Diagnose dazwischenfunkt.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (DW2-AB)" | `8bd9-db54-8bdc-cdfa` |
| Katalog Dwarfs / `catalogueLink` → Mercenaries | `a505-6b65-703b-4976` / `1a0f-ac09-e659-9629` → `fc47-8392-a6c8-452a` |
| Einheit „Slayers" (`type="unit"`, Wurzel-`selectionEntry`, ohne eigene Grenzen) | `b454-4868-7ec4-39e8` |
| Modell „Slayer" (`type="model"`, 11 pts) — min 5 / max 30 `scope="parent"` | `5869-aa55-953f-ca41` — `a619-c7e4-50f4-156d` / `8306-da59-2f34-318b` |
| Gruppe „Command Group" (**ohne** eigene Grenzen — kein Rahmen in der `.ros`) | `1b9c-8ae4-e9cf-c9b0` |
| Upgrade „Champion" (`type="upgrade"`, 15 pts) — Träger von Grenze **und** Bedingung | `21f9-b4f6-b59e-8892` |
| — max 0 `scope="parent"` (Ziel des `increment 1`) | constraint `c120-7f3a-9c4d-6d32` |
| — Profil-`infoLink` „Giant Slayer" (Profiländerung, **nicht** assertiert) | `70d7-f22a-7396-c9fe` → `463e-2eae-8cc7-95e7` |
| Geschwister „Standard Bearer" / „Musician" (je max 1, nie gewählt) | `a8a7-2590-e317-a1b1` (`45ad-0c89-924b-b331`) / `f941-4b4f-9d2f-7f73` (`0e60-51c2-4346-d540`) |
| Gruppe „Weapons" | `9334-7b81-430b-0b51` |
| `entryLink` „Hand Weapon" → Ziel (`.gst`, `type="upgrade"`, 0 pts) | `aa11-66a6-8b41-11c9` → `abdb-bbd0-41b2-5dff` |
| — min 1 / max 1 am Verweis; min 1 / max 1 am Ziel | `05cf-7952-768d-2983` / `d522-c96e-aaca-21b5`; `bdef-ba9b-d6ce-5b14` / `e28e-dbb4-b8ad-d4ab` |
| `entryLink` „Slayer Axes" → Ziel (DW-`.cat`, `type="upgrade"`) | `c4f4-0594-1f28-1e45` → `5c36-8e8c-6838-df6b` |
| — min 1 am Verweis; max 1 am Ziel | `f7c1-43d3-45ac-6b4c`; `318a-87b8-ecbd-6dff` |
| Forces, die Slayers verbergen würden (gemieden) | `fe66-8f64-704f-dc84` (Royal Clan), `37f8-30a3-8720-6b2c` (Guild Expedition) |
| Forces, die Slayers umgliedern/umbenennen würden (gemieden) | `da11-3c95-580e-1a4f`, `d18e-88cd-44b8-f527`, `f130-ff1b-2f7b-e49f` |
| „Border Patrols rules" (in keinem Roster enthalten; würde max 30 → 25 setzen) | `4e15-0353-165f-5528` |
| Kategorie „Special" (Primärkategorie der Slayers) / „BP Infantry 10+" (inert) | `43cc-fc3f-35a7-8d03` / `6ad6-f54e-1867-00a7` |
| Kostenart „pts" (`costLimit` 2000 in allen Rostern) | `ecfa-8486-4f6c-c249` |
