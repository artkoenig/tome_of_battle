# E2E-Regeln & Testkatalog: Roster-weites `atLeast`-Gatter (Border Patrols verbirgt den Black Coach)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7)
abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`costLimits` mit `typeId`) nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1),
  dazu die per `catalogueLink` (`ef73-f9bd-e250-54d2`) benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Die Kernaussage je Roster ist ein
> `expect.capabilities[]`-Eintrag mit `isHidden` an der **besetzten**
> Black-Coach-Auswahl (`anchorKind: occupied`) — exakte Gleichheit auf dem
> effektiven Sichtbarkeits-Flag, je nachdem ob die roster-weit gezählte
> `atLeast`-Bedingung hält. Als **zweiten Zeugen derselben Bedingungszelle**
> pinnt `firing` die Core-Pflicht (`35c2-d478-392a-aeb1`): ohne Border Patrols
> feuert sie mit `bound 2` (Basiswert), mit Border Patrols mit `bound 1`
> (derselbe `atLeast`-Trigger als `set`-Modifikator auf den Grenzwert).
> Andere Armeeaufbau-Diagnosen — die General-Pflicht (`1077-7379-f142-f382`)
> in beiden Rostern, die beiden Autor-Fehlermeldungen des
> Border-Patrols-Eintrags („mind. ZWEI, höchstens VIER Einheiten",
> „mind. EINE Infanterie-Einheit mit 10+ Modellen") im Umschalter-Roster —
> dürfen zusätzlich auftreten und sind hier ohne Belang (selektive Erwartung).

> **Verortungs-Korrektur gegenüber der Aufgabenstellung:** Der zitierte
> Modifikator `set hidden=true` mit der `atLeast/roster`-Bedingung auf
> „Border Patrols rules" sitzt **nicht** auf der Option „Great Weapon"
> (`11a1-6a7d-bea8-c35e`) — dieser Eintrag (VC-`.cat` Z. 1869–1882) trägt
> **keinerlei** Modifikatoren (geprüft in `<modifiers>` **und**
> `<modifierGroups>`, vgl. den Fallstrick-Kasten in §7.7 der Formatreferenz).
> Träger ist die umschließende **Wurzel-Einheit „0-1 Black Coach"**
> (`dd09-e6e8-38ea-c6f4`, Modifikator Z. 1914–1918). Das Szenario pinnt darum
> das Gatter an der Einheit und den Great-Weapon-Slot als **unveränderte
> Gegenprobe** (`isHidden false` im Basisroster).

---

## Was eine `atLeast`-Bedingung mit `scope="roster"` laut Format tut

Aus [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)
der Formatreferenz, wörtlich abgeleitet:

- `type="atLeast"` vergleicht den im Bezugsrahmen gezählten Wert mit `value`:
  die Bedingung hält, sobald der Zähler `value` **erreicht** (hier: ≥ 1).
- `field="selections"` + `childId="<id>"` zählt die **Selektionen** des in
  `childId` benannten Eintrags; `scope="roster"` spannt den Zählrahmen über das
  **gesamte Roster**, `includeChildForces="true"` über **alle Kontingente**,
  `includeChildSelections="true"` auch über verschachtelte Auswahlen. Wo die
  Border-Patrols-Selektion steht, ist damit unerheblich — sie zählt immer.
- `type="set"` am Modifikator → der `value` **ersetzt** den Feldwert. Für
  `field="hidden"` heißt das: hält die Bedingung, trägt der Träger **exakt**
  `true`; hält sie nicht, behält er seinen **Basiswert** aus dem
  `hidden`-Attribut (hier `hidden="false"`).
- Derselbe Bedingungsbaustein kann auch eine **Grenze** umwerten: ein
  `set`-Modifikator mit einer Constraint-Id als `field` ersetzt deren `value`
  (§7.7) — genau so senkt Border Patrols die Core-Pflicht von 2 auf 1.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **BPG-R1** | **Bedingung hält nicht → Basiswert bleibt:** In einem Roster **ohne** „Border Patrols rules"-Selektion zählt die `atLeast/roster`-Bedingung 0 < 1 — der `set hidden=true`-Modifikator greift nicht, die Einheit „0-1 Black Coach" behält `hidden="false"` (`isHidden` = `false`). | VC-`.cat` Z. 1827 (`selectionEntry "0-1 Black Coach"` `dd09-e6e8-38ea-c6f4`, `hidden="false"`, `type="unit"`, primär *Rare* `98b8-f1ec-806f-eb29`→`e94b-6a54-8779-cd60`, Z. 1837) → Z. 1914–1918: `<modifier type="set" value="true" field="hidden">` mit einziger Bedingung `<condition type="atLeast" value="1" field="selections" scope="roster" childId="4e15-0353-165f-5528" shared="true" includeChildSelections="true" includeChildForces="true" childName="Border Patrols rules"/>`. |
| **BPG-R2** | **Bedingung hält → `set` ersetzt das Flag:** Enthält das Roster **irgendwo** genau eine „Border Patrols rules"-Selektion, zählt die Bedingung 1 ≥ 1 — der Modifikator ersetzt das Flag, die (weiterhin gewählte) Black-Coach-Auswahl ist verborgen (`isHidden` = `true`). Verborgen-aber-gewählt ist **Verfügbarkeit**, keine zählende Grenze — es wird keine zusätzliche feuernde Grenze erwartet. | Dieselben Zeilen wie BPG-R1; das gezählte Ziel ist der Wurzeleintrag der `.gst` Z. 17584 (`selectionEntry "Border Patrols rules"` `4e15-0353-165f-5528`, `type="upgrade"`, Basis `hidden="true"`, primäre Kategorie *Special list rules* `fd54-fb51-2021-d3cd`→`32f1-197f-d719-a393`, Z. 17592). |
| **BPG-R3** | **Der Umschalter selbst ist bei costLimit 500 legitim sichtbar:** Sein eigenes Gatter `set hidden=false` hält genau bei `limit::pts` **gleich** 500. Beide Roster tragen deshalb `costLimit` 500 pts — sie unterscheiden sich **ausschließlich** in der Anwesenheit der Border-Patrols-Selektion; seine `max 1`-Grenze (parent) ist mit einer Selektion erfüllt. | `.gst` Z. 17595–17599: `<modifier type="set" value="false" field="hidden">` mit `<condition type="equalTo" value="500" field="limit::ecfa-8486-4f6c-c249" scope="roster" childId="any" …/>`; Grenze `fbfc-d43f-396d-09cc` (`max 1`, `scope="parent"`, Z. 17586). |
| **BPG-R4** | **Zweiter Zeuge derselben Bedingungszelle (zählende Grenze):** Die Core-Pflicht der `.gst` (`min 2`, force-scope) wird durch einen `set value=1`-Modifikator mit **exakt derselben** `atLeast/roster`-Bedingung gesenkt. Beide Roster enthalten 0 Core-Auswahlen: ohne Border Patrols feuert `35c2…` mit Ist 0 gegen **bound 2**, mit Border Patrols gegen **bound 1**. | `.gst` Z. 372–433 (`categoryEntry "Core"` `64bf-efb4-9978-26df`): Constraint `35c2-d478-392a-aeb1` (`min 2`, `scope="force"`, Z. 374) → Modifikator Z. 377–382 (`set value=1`, Bedingung identisch zu BPG-R1). Die Punkteband-Modifikatoren desselben Constraints (Z. 383–430) verlangen alle `atLeast 2000` — bei Limit 500 wirkungslos. Das Kontingent „Standard (VC-AB)" führt den *Core*-`categoryLink` (VC-`.cat` Z. 29305). |
| **BPG-R5** | **Great Weapon ist modifikatorlos — die Gegenprobe:** Die Option „Great Weapon" (Kind des Wraith im Black Coach) trägt keinerlei Modifikatoren; im Basisroster meldet ihr besetzter Slot `isHidden false`. Ihre eigenen `min 1`/`max 1`-Grenzen (parent) sind mit genau einer Selektion still. | VC-`.cat` Z. 1869–1882: `selectionEntry "Great Weapon"` `11a1-6a7d-bea8-c35e` (`hidden="false"`), Grenzen `71a3-92d2-888a-e315` (`min 1`) / `09b6-246f-f2d4-b9c5` (`max 1`), Z. 1871–1872. Kein `<modifiers>`/`<modifierGroups>`-Element am Eintrag. |
| **BPG-R6** | **Alles Übrige am Black Coach bleibt inert:** Der andere `set hidden=true`-Modifikator der Einheit ist auf vier fremde Kontingente `instanceOf`-bedingt, der Kosten-`set 175` und die beiden `modifierGroups` (Von-Carstein-Umbenennung/`max 2`, Sylvania-Kategorien) auf Von Carstein/Sylvania — im Kontingent „Standard (VC-AB)" (`e989-15b8-7eb6-9668`) greift nichts davon; der Name bleibt „0-1 Black Coach". Volle Besetzung (Modell 1, Nightmares 2, Wraith 1) erfüllt alle Kind-Pflichten; 1 Rare ≤ `max 1` (Rare-Kategorie, beide Roster: mit Border Patrols und 0 *Special* setzt das BP-Gatter die Grenze ebenfalls auf 1). | VC-`.cat` Z. 1897–1908 (`instanceOf` auf `f37a…`, `3c87…`, `d3af…`, `bf46…`), Z. 1909–1913 (Sylvania `4072…`), Z. 1920–1947 (`modifierGroups`, Bedingungen `b1e4…`/`4072…`); Kinder Z. 1841–1889 (Grenzen `9108…`/`26fd…`, `81d7…`/`1ba4…`, `fe68…`/`e9be…`); Roster-Grenze der Einheit `2274-81fb-2e22-c00c` (`max 1`, `scope="roster"`, Z. 1829); `.gst` Z. 544–639 (`categoryEntry "Rare"`, Constraint `0a44-2d3f-adfe-f3a1` Z. 546, BP-Modifikatoren Z. 567–588); Kontingent Z. 29297. |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `isHidden` des Great-Weapon-Slots im **Border-Patrols-Roster** | Ob das `hidden` eines Elternteils auf die Slot-Projektion der **Kinder** durchschlägt, ist in der Formatreferenz nicht spezifiziert (§8 beschreibt nur, dass verborgene Einträge samt Kindern nicht **angeboten** werden). Eine Behauptung wäre aus den erlaubten Quellen nicht ableitbar — im Roster 02 wird der Great-Weapon-Slot darum nicht behauptet. |
| Die Autor-Fehlermeldungen des Border-Patrols-Eintrags (`.gst` Z. 17600–17615) | Eigene Zelle (`add field="error"`), bereits vom Szenario `author-message-severity`/`author-message-tokens` gepinnt. Im Roster 02 feuern beide (1 Einheit < 2; keine „BP Infantry 10+") — toleriert, nicht behauptet. |
| Sichtbarkeit des Border-Patrols-**Angebots** (`equalTo`-Gatter auf `limit::pts`) | Eigene Bedingungszelle (`equalTo` auf ein Kostenlimit), hier nur Aufbau-Voraussetzung (BPG-R3): beide Roster tragen dasselbe Limit 500, damit der Umschalter kein Störfaktor ist. |
| `atLeast/roster` über **mehrere** Kontingente (`includeChildForces` beobachtbar machen) | Bräuchte ein Zwei-Kontingent-Roster; die Zählweise „irgendwo im Roster" ist mit einem Kontingent bereits eindeutig gepinnt, die Mehr-Force-Aggregation ist eine eigene Facette. |
| Weitere BP-Umwertungen (`Chariot max 1` `4b43…`, `Special max` `16f0…`, `Lord max` `fda5…`, BSB `2a1d…`) | Alle in beiden Rostern still (1 Streitwagen ≤ 1; 0 Special/Lord/BSB gewählt) — dieselbe Bedingungszelle, aber ohne beobachtbaren Unterschied in diesen Aufbauten. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster sind
**bis auf die eine Wurzel-Selektion „Border Patrols rules" identisch**:
Kontingent „Standard (VC-AB)", `costLimit` 500 pts, eine vollständig besetzte
Einheit 0-1 Black Coach (Modell ×1, Nightmares ×2, Wraith ×1 mit Great Weapon ×1,
zusammen 200 pts). Genau der eine Unterschied ist der Auslöser — Flag-Wechsel
und `bound`-Wechsel lassen sich keiner anderen Ursache zuschreiben.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Ohne Border Patrols → Black Coach sichtbar, Core-Pflicht 2 | Standard-Kontingent, 500 pts, Black Coach voll besetzt, **keine** Border-Patrols-Selektion. | **BPG-R1/R5:** Besetzter Black-Coach-Slot `isHidden: false`, Great-Weapon-Slot `isHidden: false`. **BPG-R4:** `35c2…` feuert mit Ist 0 gegen bound 2. Alle Grenzen der Einheit und `fbfc…`/`0a44…` still. | [`01-no-border-patrols-coach-visible.ros`](rosters/01-no-border-patrols-coach-visible.ros) |
| 02 | Mit Border Patrols → Black Coach verborgen, Core-Pflicht 1 | **Derselbe** Aufbau plus genau eine Wurzel-Selektion „Border Patrols rules". | **BPG-R2:** Besetzter Black-Coach-Slot `isHidden: true` — die roster-weit gezählte Bedingung hält, der `set` ersetzt den Basiswert. **BPG-R4:** `35c2…` feuert mit Ist 0 gegen den **modifizierten** bound 1. Autor-Fehlermeldungen des Umschalters toleriert. | [`02-border-patrols-coach-hidden.ros`](rosters/02-border-patrols-coach-hidden.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **BPG-R2** — ob die `atLeast`-Zählung mit `scope="roster"` +
   `includeChildForces="true"` die Wurzel-Selektion eines **anderen**
   (`.gst`-)Eintrags im selben Kontingent findet und der `set` das `isHidden`
   der **besetzten** Auswahl ersetzt (nicht nur von Angeboten).
2. **BPG-R4** — ob der `set`-Modifikator auf die **Constraint-Id** den
   gemeldeten `bound` der feuernden Grenze tatsächlich auf 1 senkt (nicht den
   Basiswert 2 meldet).
3. Die Slot-Adressierung: `defId dd09…` + `anchorKind occupied` muss die eine
   Black-Coach-Auswahl eindeutig treffen; `defId 11a1…` + `frameDefId 3f40…`
   den Great-Weapon-Slot unter dem Wraith.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| 0-1 Black Coach, Wurzel-Einheit mit dem `atLeast/roster`-Gatter (`set hidden=true`, Z. 1914–1918) | `dd09-e6e8-38ea-c6f4` (VC-`.cat` Z. 1827) |
| Border Patrols rules, gezähltes Ziel (`.gst`-Wurzeleintrag, Basis `hidden="true"`) | `4e15-0353-165f-5528` (`.gst` Z. 17584) |
| Border-Patrols-Grenze (parent max 1, als `absent` gepinnt) | `fbfc-d43f-396d-09cc` (Z. 17586) |
| Kategorie *Special list rules* (primär am Umschalter) | `32f1-197f-d719-a393` (Link `fd54-fb51-2021-d3cd`, Z. 17592) |
| Core-Pflicht mit BP-gegattertem `set value=1` (feuernder Zweitzeuge) | `35c2-d478-392a-aeb1` (`.gst` Z. 374, Modifikator Z. 377–382) |
| Great Weapon, modifikatorlose Gegenprobe (min/max 1 als `absent`) | `11a1-6a7d-bea8-c35e` — Grenzen `71a3-92d2-888a-e315` / `09b6-246f-f2d4-b9c5` |
| Wraith (Rahmen des Great-Weapon-Slots; min/max 1 als `absent`) | `3f40-b847-1d27-c746` — Grenzen `fe68-a9f4-b57a-3785` / `e9be-aa80-be02-5f0e` |
| Black Coach, Modell (min/max 1 als `absent`) | `5224-1c99-47c9-043e` — Grenzen `9108-5b84-ac06-5581` / `26fd-2e7f-fe24-3267` |
| Nightmares (min/max 2 als `absent`) | `b54d-14f5-fea0-777f` — Grenzen `81d7-e159-0557-56ed` / `1ba4-aeb1-9498-e7e6` |
| Roster-Grenze der Einheit (max 1, als `absent`) | `2274-81fb-2e22-c00c` (Z. 1829) |
| Kategorie *Rare* (primär am Black Coach; force max 1, als `absent`) | `e94b-6a54-8779-cd60` — Constraint `0a44-2d3f-adfe-f3a1` (`.gst` Z. 546) |
| Kategorie *General* (min 1, toleriert — nicht Gegenstand) | `a37e-7207-de6d-acb0` — Constraint `1077-7379-f142-f382` (`.gst` Z. 724) |
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` (VC-`.cat` Z. 29297) |
| Kostenart Punkte (`costLimit`-`typeId` beider Roster) | `ecfa-8486-4f6c-c249` |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
