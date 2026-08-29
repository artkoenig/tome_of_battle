# E2E-Regeln & Testkatalog: Top-Level-`conditionGroup type="or"` als Kontingent-Gatter (0-1 Bat Swarm)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7 und §8)
abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`)
nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1),
  dazu die per `catalogueLink` (`ef73-f9bd-e250-54d2`, Z. 29511) benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Dieses Szenario prüft **keine** zählenden Grenzen als
> feuernd. Die Kernaussage ist je Roster ein `expect.capabilities[]`-Eintrag mit
> `isHidden` am **gewählten** Bat-Swarm-Einheiten-Slot (`anchorKind: occupied`) —
> exakte Gleichheit auf dem effektiven Sichtbarkeits-Flag, einmal `true`, einmal
> `false`. `firing` bleibt leer; `absent` pinnt zusätzlich, dass die drei
> zählenden Grenzen der beteiligten Einträge in diesen Aufbauten still bleiben.
> Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit) dürfen
> zusätzlich auftreten und sind hier ohne Belang (selektive Erwartung).

---

## Was eine `or`-Gruppe laut Format tut

Aus [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)
(„`conditionGroup` — Verknüpfung mehrerer Bedingungen") und §8 der Formatreferenz,
wörtlich abgeleitet:

- Ein `conditionGroup` gruppiert Bedingungen mit `type="and"` oder `type="or"`.
  Eine **`or`-Gruppe hält, wenn mindestens eines** ihrer Mitglieder (Bedingungen
  *und* Untergruppen) hält. Ein einziges wahres Mitglied genügt also; die
  übrigen dürfen alle falsch sein.
- Hält die Gruppe, greift der von ihr gegatterte Modifikator **genau dann**;
  hält sie nicht (kein Mitglied wahr), greift er nicht und der Träger behält
  seinen Basiswert.
- `type="set"` auf `field="hidden"` **ersetzt** das Sichtbarkeits-Flag durch den
  `value` des Modifikators, solange die Bedingungen halten — hier also
  `hidden="false"` (Basis) → effektiv `true`.
- Die `instanceOf`-Prüfung mit `scope="force"` und einer `forceEntry`-Id in
  `childId` ist die in §7.7 als **kanonisch** dokumentierte Kodierung der Frage
  „ist das umschließende Kontingent eine Instanz dieses `forceEntry`?".
- Nach der Sichtbarkeits-Regel des Formats bleiben **`max`-Grenzen verborgener
  Entitäten geprüft**, während **`min`-Grenzen verborgener Entitäten nicht
  geprüft** werden. Beide Roster halten sich von dieser Kante fern: die internen
  Mindestmaße der Einheit sind in beiden Rostern **erfüllt** (siehe CGO-R5).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **CGO-R1** | **Ein wahres Mitglied genügt → Gruppe hält → `set hidden=true` greift:** In einem Kontingent, das das `forceEntry` „Clan Necrarch (VC-AB)" instanziiert, ist die Wurzel-Einheit **0-1 Bat Swarm** **verborgen** (`isHidden` = `true`), obwohl ihr Basiswert `hidden="false"` ist. Genau **ein** Mitglied der or-Gruppe hält (das zweite, `childId="91ad-…"`), die vier anderen sind falsch — das pinnt, dass ein einziges wahres Mitglied ausreicht. | VC-`.cat` Z. 821 (`selectionEntry "0-1 Bat Swarm"` `3161-6d02-8903-b0c4`, `type="unit"`, `hidden="false"`) → Z. 853–865: `<modifier type="set" value="true" field="hidden">` mit einziger Gatter-Struktur `<conditionGroups><conditionGroup type="or">` und fünf Mitgliedern `<condition type="instanceOf" value="1" field="selections" scope="force" childId="…"/>`: `d3af-1add-4e99-b977` (Necromancer's Army, Z. 857), **`91ad-b36a-5c77-c4b5` (Clan Necrarch, Z. 858)**, `5e95-7d57-2b9c-d77d` (Clan Blood Dragons, Z. 859), `f37a-a93e-fa22-61a8` (Army of the Lichemaster, Z. 860), `bf46-ee85-7c10-ba98` (Vampire Coast, Z. 861). Alle fünf `forceEntry`s sind in **derselben** Katalogdatei deklariert (Z. 29342 / 29327 / 29357 / 29441 / 29471). |
| **CGO-R2** | **Kein Mitglied hält → Gruppe hält nicht → Basiswert bleibt:** In einem Kontingent aus dem `forceEntry` „Standard (VC-AB)" hält keines der fünf Mitglieder — der Modifikator greift nicht, die Einheit behält `hidden="false"` und ist **sichtbar** (`isHidden` = `false`). | `forceEntry "Standard (VC-AB)"` `e989-15b8-7eb6-9668` (Z. 29297) — seine Id ist **keine** der fünf `childId`s aus CGO-R1. Der Modifikator Z. 853–865 ist der **einzige** `field="hidden"`-Modifikator des Eintrags (die `<modifiers>` Z. 852–866 enthalten nur ihn). |
| **CGO-R3** | **Die Zelle `conditionGroup\|or\|top`:** Die or-Gruppe ist das **einzige, oberste** Gatter des Modifikators — sie steht direkt in dessen `<conditionGroups>`, **ohne** ein daneben liegendes nacktes `<conditions>` und ohne Verschachtelung in eine weitere Gruppe. Das Halten des Modifikators ist damit **exakt** das Halten der or-Gruppe. | Z. 853–865: der `modifier` trägt genau `<conditionGroups>` mit **einer** `conditionGroup type="or"` (Z. 855–863), kein `<conditions>`-Geschwister, keine Untergruppen in der Gruppe. |
| **CGO-R4** | **Keine Nebenwirkungen in den gewählten Kontingenten:** Der zweite Modifikator-Block des Eintrags — die `modifierGroup` „Clan Von Carstein" (`set` der max-Grenze auf 2, Umbenennung in „0-2 Bat Swarm") — ist auf die Kontingente *Army of Sylvania* (`4072-c3b8-84c4-a097`) und *Clan Von Carstein* (`b1e4-e1cf-9bd6-2438`) gegattert, **keines** der beiden hier genutzten. Der Name bleibt in beiden Rostern „0-1 Bat Swarm", die max-Grenze bleibt 1. | Z. 867–883 (`modifierGroup type="and"`, Kommentar „Clan Von Carstein", eigene or-Gruppe mit `childId` `4072-…`/`b1e4-…`, Z. 877–878). Weder `91ad-…` (Necrarch) noch `e989-…` (Standard) kommt darin vor. |
| **CGO-R5** | **Zählende Grenzen bleiben still — auf beiden Ästen:** Die Einheit trägt selbst `max 1, scope=roster` (`dc57-c7c0-f8d4-3407`) — mit **einer** gewählten Einheit (Ist 1) nicht verletzt; laut Format bleibt eine `max`-Grenze auch an einer **verborgenen** Entität geprüft, ihr Schweigen in Roster 01 ist also eine echte Aussage. Das Modell „Bat Swarm" trägt `min 1` / `max 5, scope=parent` (`f78f-67d3-4667-e601` / `c354-71d0-3103-c593`) — mit `number="1"` ist das Mindestmaß **erfüllt**, die „min verborgener Entitäten wird nicht geprüft"-Kante spielt keine Rolle: die Grenze wäre so oder so still. | Z. 822–824 (Unit-Constraint `dc57-…`, `type="max" value="1" scope="roster"`); Z. 835–845 (Modell `56d6-c9fc-c071-1915`, Constraints Z. 837–838, Kosten 60 pts). Alle drei Ids stehen in `absent`. |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| **Mehrere gleichzeitig wahre Mitglieder** | Die fünf Mitglieder sind `instanceOf`-Prüfungen auf das **umschließende** Kontingent (`scope="force"`) — ein Kontingent instanziiert genau **ein** `forceEntry`, mehr als ein Mitglied kann je Force nie gleichzeitig halten. Der Fall „oder mit ≥2 wahren Mitgliedern" ist an diesem Gatter nicht konstruierbar. |
| **`and`-/`not`-Gruppen und Verschachtelung** | Eigene Zellen mit eigener Semantik; die `not`-Kette dieses Katalogs pinnt bereits [`condition-group-not`](../condition-group-not/README.md). Hier ist die Gruppe bewusst die flache Top-Level-or-Form (CGO-R3). |
| **Die Von-Carstein-`modifierGroup` (max 2, Umbenennung)** | Eigenes Konstrukt (`modifierGroup` als bedingte Klammer, `set` auf eine Grenzen-Id); hier nur als Nicht-Nebenwirkung ausgeschlossen (CGO-R4). Gehört in ein eigenes Szenario. |
| **Ein dritter Roster je weiterem wahren Mitglied (Necromancer's Army, Blood Dragons, …)** | Die or-Semantik ist mit „genau ein wahres Mitglied ⇒ hält" (Roster 01, nicht-erstes Mitglied) und „kein wahres Mitglied ⇒ hält nicht" (Roster 02) vollständig gepinnt; weitere Kontingente wiederholten denselben Zweig. Roster 01 nutzt bewusst das **zweite** Mitglied, damit auch die Reihenfolge-Unabhängigkeit sichtbar ist. |
| **Die `min`-verborgen-Kante** (verborgene Einheit mit unerfülltem Mindestmaß) | Ausdrücklich vermieden: beide Roster erfüllen die internen Mindestmaße (CGO-R5), damit die Sichtbarkeitsaussage nicht mit der Sonderregel „min verborgener Entitäten wird nicht geprüft" verschränkt wird. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster sind
**bis auf die `entryId`/`name` des Kontingents identisch**: eine gewählte Einheit
0-1 Bat Swarm (`3161…`, primär *Core*, `categoryLink` Z. 832) mit einem
Bat-Swarm-Modell (`56d6…`, `number="1"`, 60 pts). Genau der eine Unterschied ist
der Auslöser — die Sichtbarkeitsänderung lässt sich keiner anderen Ursache
zuschreiben. Beide Kontingente führen den `categoryLink` *Core*
(`64bf-efb4-9978-26df`; Standard Z. 29305, Clan Necrarch Z. 29335), die Einheit
ist also in beiden regulär aufstellbar.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Ein wahres or-Mitglied → Einheit verborgen | Kontingent **„Clan Necrarch (VC-AB)"** (`91ad…`), Bat Swarm + 1 Modell. | **CGO-R1:** Der besetzte Einheiten-Slot (`3161…`, occupied) meldet `isHidden: true` — die or-Gruppe hält, weil ihr zweites Mitglied hält; die vier anderen sind falsch. Keine der drei Grenzen aus CGO-R5 feuert (die roster-max-1 bleibt trotz Verborgenheit geprüft und still). | [`01-necrarch-force-batswarm-hidden.ros`](rosters/01-necrarch-force-batswarm-hidden.ros) |
| 02 | Kein wahres or-Mitglied → Basiswert bleibt | **Derselbe** Aufbau im Kontingent **„Standard (VC-AB)"** (`e989…`). | **CGO-R2:** Der besetzte Einheiten-Slot meldet `isHidden: false` — kein Mitglied hält, der Modifikator greift nicht, der Basiswert `hidden="false"` gilt. Keine der drei Grenzen aus CGO-R5 feuert. | [`02-standard-force-batswarm-visible.ros`](rosters/02-standard-force-batswarm-visible.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **CGO-R1** — ob eine **Top-Level-or-Gruppe** als Gatter erkannt und mit
   „mindestens ein Mitglied hält" ausgewertet wird, auch wenn das wahre Mitglied
   **nicht das erste** der Liste ist (Kurzschluss-Reihenfolge darf das Ergebnis
   nicht ändern).
2. **CGO-R2** — ob eine or-Gruppe, deren Mitglieder **alle** nicht halten, den
   Modifikator sauber **nicht** anwendet (kein „Gruppe unbekannt ⇒ wende an"-
   und kein „leer/falsch ⇒ trotzdem wahr"-Fehlschluss); der Slot muss den
   Basiswert `hidden="false"` behalten.
3. Die Slot-Adressierung: `defId 3161…` + `anchorKind occupied` +
   `frameDefId <forceEntry>` muss den **gewählten** Einheiten-Slot eindeutig
   treffen (nur eine Bat-Swarm-Einheit im Roster); `current: 1` und der
   unveränderte Name „0-1 Bat Swarm" (CGO-R4) hängen mit daran.
4. **CGO-R5** — dass die roster-skopierte `max 1` der Einheit in Roster 01
   **geprüft, aber still** ist (Ist 1 ≤ 1), obwohl die Einheit verborgen ist.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| 0-1 Bat Swarm, Wurzel-Einheit (Basis `hidden="false"`, Träger des Gatters) | `3161-6d02-8903-b0c4` (Z. 821; Modifikator Z. 853–865) |
| Bat Swarm, Modell-Slot (min 1 / max 5, 60 pts) | `56d6-c9fc-c071-1915` — constraints `f78f-67d3-4667-e601` / `c354-71d0-3103-c593` (Z. 837–838) |
| Unit-Grenze „0-1" (max 1, scope=roster; nicht Gegenstand, als `absent` gepinnt) | `dc57-c7c0-f8d4-3407` (Z. 823) |
| Force „Clan Necrarch (VC-AB)" (das eine wahre or-Mitglied, Roster 01) | `91ad-b36a-5c77-c4b5` (Z. 29327; or-Mitglied Z. 858) |
| Force „Standard (VC-AB)" (Gegenprobe, kein Mitglied) | `e989-15b8-7eb6-9668` (Z. 29297) |
| Übrige or-Mitglieder: Necromancer's Army / Clan Blood Dragons / Army of the Lichemaster / Vampire Coast | `d3af-1add-4e99-b977` (Z. 29342) / `5e95-7d57-2b9c-d77d` (Z. 29357) / `f37a-a93e-fa22-61a8` (Z. 29441) / `bf46-ee85-7c10-ba98` (Z. 29471) |
| Von-Carstein-`modifierGroup` (Nicht-Nebenwirkung, CGO-R4): Sylvania / Clan Von Carstein | `4072-c3b8-84c4-a097` (Z. 29418) / `b1e4-e1cf-9bd6-2438` (Z. 29312); Gruppe Z. 867–883 |
| Kategorie *Core* (primär an der Einheit; `categoryLink` in beiden Forces) | `64bf-efb4-9978-26df` (Link an der Einheit: `d3c7-e140-85aa-a033`, Z. 832) |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` (Z. 29511) |
