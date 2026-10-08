# E2E-Regeln & Testkatalog: Kontingent-gegattertes `set hidden` (Scouts der Dire Wolves)

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
> `isHidden` am **nicht gewählten** Scouts-Slot (`anchorKind: offerAnchor`) —
> exakte Gleichheit auf dem effektiven Sichtbarkeits-Flag. `firing` bleibt leer;
> `absent` pinnt zusätzlich, dass die vier zählenden Grenzen der beteiligten
> Einträge in diesen legalen Aufbauten still bleiben. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit, der
> Pflicht-Anker „Army of Sylvania" `b48b-4a69-80f1-5d47`) dürfen zusätzlich
> auftreten und sind hier ohne Belang (selektive Erwartung).

---

## Was ein `field="hidden"`-Modifikator laut Format tut

Aus [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)
und [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit) der
Formatreferenz, wörtlich abgeleitet:

- `hidden` blendet eine Entität aus; per Modifier `field="hidden"` wird die
  Sichtbarkeit **dynamisch**.
- `type="set"` → der `value` **ersetzt** den Feldwert. Für `field="hidden"`
  heißt das: solange die Bedingungen des Modifikators halten, trägt der Träger
  **exakt** den Boolean des Modifikators — der Basiswert des Attributs ist dann
  ohne Belang.
- Halten die Bedingungen **nicht**, greift der Modifikator nicht: der Träger
  behält seinen **Basiswert** aus dem `hidden`-Attribut.
- Ein `hidden`-Modifikator schlägt beide Basiswerte (Verweis **und**
  Definition); hier trägt allerdings die **Definition selbst** den Modifikator —
  die einfachste Form des in §8 beschriebenen Gatter-Musters
  (`hidden="true"` an der Definition + bedingter `set hidden="false"`).
- Die `instanceOf`-Prüfung mit `scope="force"` und einer `forceEntry`-Id in
  `childId` ist die in §7.7 als **kanonisch** dokumentierte Kodierung der Frage
  „ist das umschließende Kontingent eine Instanz dieses `forceEntry`?".

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **SHF-R1** | **Bedingung hält → `set` ersetzt das Flag:** In einem Kontingent, das das `forceEntry` „Army of Sylvania (SoC)" instanziiert, ist die Aufwertung **Scouts** der Dire Wolves **sichtbar** (`isHidden` = `false`), obwohl ihr Basiswert `hidden="true"` ist. | VC-`.cat` Z. 949 (`selectionEntry "Scouts"` `ff2c-a7c6-4cab-b0fd`, `type="upgrade"`, `hidden="true"`, direktes Kind der Wurzel-Einheit `"Dire Wolves"` `3c0f-28ce-0807-81fa`, Z. 885) → Z. 955–959: `<modifier type="set" value="false" field="hidden">` mit einziger Bedingung `<condition type="instanceOf" value="1" field="selections" scope="force" childId="4072-c3b8-84c4-a097" shared="true" includeChildSelections="true"/>`; `4072-c3b8-84c4-a097` ist das `forceEntry "Army of Sylvania (SoC)"` (Z. 29418) **derselben** Katalogdatei. |
| **SHF-R2** | **Bedingung hält nicht → Basiswert bleibt:** In einem Kontingent aus dem `forceEntry` „Standard (VC-AB)" greift der Modifikator nicht — Scouts behält den Basiswert und ist **verborgen** (`isHidden` = `true`). | Dieselbe `selectionEntry` (Z. 949): das `hidden="true"`-Attribut ist der Basiswert; der **einzige** `field="hidden"`-Modifikator des Eintrags ist der aus SHF-R1 (Z. 954–965 enthält daneben nur den Kosten-`increment`, siehe SHF-R4). `e989-15b8-7eb6-9668` ist das `forceEntry "Standard (VC-AB)"` (Z. 29297) — eine andere Id als die `childId` der Bedingung, die `instanceOf`-Prüfung schlägt fehl. |
| **SHF-R3** | **Der Träger Dire Wolves selbst ist in beiden Kontingenten sichtbar und regulär wählbar** (Kategorie *Core*), das Sichtbarkeits-Gatter betrifft also isoliert den Scouts-Slot. | Einheit `3c0f-28ce-0807-81fa` (Z. 885, `hidden="false"`, `categoryLink` *Core* `333e-ebd4-f9cd-c7f8` → `64bf-efb4-9978-26df` primär, Z. 900). Ihr eigener `set hidden=true`-Modifikator (Z. 995–1004) ist auf die Kontingente *Lichemaster* (`f37a-a93e-fa22-61a8`) und *Clan Blood Dragons* (`5e95-7d57-2b9c-d77d`) bedingt — **keines** der beiden hier genutzten. Beide `forceEntry`s führen den `categoryLink` *Core* (Standard Z. 29305, Sylvania Z. 29426). |
| **SHF-R4** | **Nicht Gegenstand dieses Szenarios:** Scouts trägt außerdem zwei `max`-Grenzen (parent max 1 `030c-f5ce-18d3-0f75`, force max 1 `c8c4-2b87-6016-548b`, Z. 951–952) und einen Kosten-`increment` (+1 pts je Dire-Wolf-Modell, Z. 960–964). Da Scouts in beiden Rostern **nicht gewählt** ist (Ist 0), darf keine der Grenzen feuern; der Kostenwert wird nicht behauptet. | `selectionEntry` `ff2c-a7c6-4cab-b0fd`, Z. 950–965. Beide Grenzen stehen in `absent`. |
| **SHF-R5** | **Legale Mindestbesetzung der Einheit:** 5 Dire-Wolf-Modelle erfüllen `min 5` und unterschreiten `max 20` — die Modell-Grenzen bleiben still, das Sichtbarkeits-Verhalten ist damit keiner Verletzung zuzuschreiben. | Modell `"Dire Wolf"` `21df-2721-6900-1ea3` (Z. 903): constraints `da84-9ad9-d3e9-1d46` (`min 5, scope=parent`) und `3b26-cf11-a8b7-d9ec` (`max 20, scope=parent`), Z. 905–906. Beide stehen in `absent`. |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| Scouts als **gewählte** Selektion, die durch Kontingentwechsel verborgen würde | Ein `.ros` trägt sein Kontingent fest; „dieselbe Auswahl wird nachträglich unsichtbar" ist kein durch zwei statische Roster abbildbarer Zustand. Der Angebots-Slot (offerAnchor) trägt dasselbe `isHidden`-Flag und pinnt die Modifikator-Zelle vollständig. |
| Der Kosten-`increment` der Scouts (`+1` pts je Dire Wolf, `repeat` auf `21df…`) | Eigene Modifikator-Zelle (`increment` auf eine Kostenart mit `repeats`), nicht `set hidden`. Gehört in ein eigenes Szenario. |
| Die beiden `max`-Grenzen der Scouts als **feuernde** Grenzen | Dazu müsste Scouts mehrfach gewählt werden — das prüft Zähllogik, nicht das `hidden`-Gatter. Hier nur als `absent` gepinnt. |
| `set hidden` via `entryLink`-Träger (Verweis-Seite des ODER aus §8) | Scouts ist ein **inline**-Kind der Dire Wolves, kein `entryLink`-Ziel; die Komposition Verweis⊕Ziel ist an diesem Eintrag nicht beobachtbar. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster sind
**bis auf die `entryId`/`name` des Kontingents identisch**: eine Einheit Dire
Wolves (`3c0f…`, primär *Core*) mit 5 Dire-Wolf-Modellen (`21df…`, `number="5"`),
Scouts nicht gewählt. Genau der eine Unterschied ist der Auslöser — die
Sichtbarkeitsänderung lässt sich keiner anderen Ursache zuschreiben.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Bedingung hält → Scouts sichtbar | Kontingent **„Army of Sylvania (SoC)"** (`4072…`), Dire Wolves + 5 Modelle. | **SHF-R1:** Der Scouts-Angebots-Slot (`ff2c…`, offerAnchor unter `3c0f…`) meldet `isHidden: false` — der `set`-Modifikator ersetzt den Basiswert `hidden="true"` durch `false`. Keine der vier Grenzen aus SHF-R4/R5 feuert. | [`01-sylvania-force-scouts-visible.ros`](rosters/01-sylvania-force-scouts-visible.ros) |
| 02 | Bedingung hält nicht → Basiswert bleibt | **Derselbe** Aufbau im Kontingent **„Standard (VC-AB)"** (`e989…`). | **SHF-R2:** Der Scouts-Angebots-Slot meldet `isHidden: true` — kein Modifikator greift, der Basiswert `hidden="true"` gilt. Keine der vier Grenzen aus SHF-R4/R5 feuert. | [`02-standard-force-scouts-hidden.ros`](rosters/02-standard-force-scouts-hidden.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **SHF-R1** — ob die `instanceOf`-`forceEntry`-Prüfung in der kanonischen
   Kodierung (`scope="force"`, `forceEntry`-Id in `childId`) erkannt wird und
   der `set` das `isHidden` des **Angebots**-Slots (nicht nur besetzter Slots)
   ersetzt.
2. **SHF-R2** — ob der Basiswert `hidden="true"` ohne greifenden Modifikator
   unverändert durchgereicht wird (kein „Angebot ist immer sichtbar"-Kurzschluss).
3. Die Slot-Adressierung: `defId ff2c…` + `frameDefId 3c0f…` muss den
   Scouts-Slot **eindeutig** treffen (nur eine Dire-Wolves-Einheit im Roster).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Army of Sylvania (SoC)" (Ziel der `instanceOf`-Bedingung) | `4072-c3b8-84c4-a097` (Z. 29418) |
| Force „Standard (VC-AB)" (Gegenprobe) | `e989-15b8-7eb6-9668` (Z. 29297) |
| Dire Wolves, Wurzel-Einheit (Rahmen des Scouts-Slots) | `3c0f-28ce-0807-81fa` (Z. 885) |
| Scouts, Aufwertung mit Basis `hidden="true"` + `set hidden=false`-Gatter | `ff2c-a7c6-4cab-b0fd` (Z. 949, Modifikator Z. 955–959) |
| Dire Wolf, Modell-Slot (min 5 / max 20) | `21df-2721-6900-1ea3` — constraints `da84-9ad9-d3e9-1d46` / `3b26-cf11-a8b7-d9ec` |
| Scouts-Grenzen (nicht Gegenstand, als `absent` gepinnt) | `030c-f5ce-18d3-0f75` (parent max 1) / `c8c4-2b87-6016-548b` (force max 1) |
| Kategorie *Core* (primär an Dire Wolves; `categoryLink` in beiden Forces) | `64bf-efb4-9978-26df` (Link an der Einheit: `333e-ebd4-f9cd-c7f8`) |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
