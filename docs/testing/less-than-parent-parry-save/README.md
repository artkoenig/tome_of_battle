# E2E-Regeln & Testkatalog: `lessThan` mit `scope="parent"` — die Parier-Regel des Söldner-Zwergs

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschließlich aus den Katalogdaten** der *6th Definitive
Edition* und aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Kontingent **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044` (`.cat` Z. 3090); es bindet per
  `catalogueLink a067-78d5-50a2-affe` (Z. 3087) die Bibliothek
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) ein.
- Getestete Einheit: die Söldner-Einheit **„Dwarfs"** `59b2-d9d4-f797-9649`
  (`Mercenaries…cat` Z. 6759, in `sharedSelectionEntries`), am Katalog-Wurzel von
  Ogre Kingdoms als `entryLink 9bb3-73fa-a6c6-bfdf` verlinkt (`.cat` Z. 3337).

## Worum es geht

Eine `<condition type="lessThan">` mit `scope="parent"` und einer **Eintrags-Id**
in `childId` ist die **„diese Option ist *nicht* gewählt"**-Hälfte eines Gatters:
sie hält genau so lange, wie die Elternauswahl **weniger als** die genannte Zahl
dieses Eintrags führt — und sie hört in dem Moment auf zu halten, in dem die
Option erscheint. Das Format-Dokument führt `lessThan` in der Vergleichsliste der
Condition (§7.7) und beschreibt `scope="parent"` als Bezugsrahmen, der über
**aufgelöste Ziel-Ids** vergleicht, nicht über `entryLinkId`s (§3.4/§7.6).

Im Söldner-Profil **„Dwarf"** ist das die **Parier-Regel des Schilds**: ein
Zwergenmodell mit Schild bekommt einen zusätzlichen Punkt Rüstungswurf, aber
**nur solange es keine Zweihandwaffe führt** — zusätzlich zu dem, was seine
Rüstungsteile ihm geben.

### Der getestete Ausschnitt des Katalogs

```
selectionEntry "Dwarfs" (59b2-d9d4-f797-9649, type=unit)          ← Wurzel-entryLink 9bb3-…
 ├ selectionEntries
 │   └ selectionEntry "Dwarf" (216c-6851-789d-4904, type=model)   min 10 (ed40-…)
 │        └ profile "Dwarf" (c69e-8fe4-ad3d-3b7d)                 Basis Sv 6
 │             └ modifiers: 4 bedingte + 1 unbedingter auf f1be-… (Sv)
 └ selectionEntryGroups
     └ "Weapons and Armour" (80b0-e44d-ed5e-5dd7)                 keine Grenzen
          ├ "Armour" (ec46-018a-ef42-7c0c)   min 1 (400c-…) / max 1 (8d83-…)
          │    ├ entryLink "Heavy Armour" 19ec-… → dde4-0ba8-7b3c-57b7
          │    └ entryLink "Light Armour" 4f49-… → 055f-8e4e-f170-35d2   (default)
          ├ entryLink "Crossbow"     8b36-… → 4c50-…            max 1 (3dee-…)
          ├ entryLink "Great Weapon" 0dab-… → 1eb7-3f36-8cf7-e0ba  max 1 (e8c1-…)
          ├ entryLink "Hand Weapon"  c3b1-… → abdb-bbd0-41b2-5dff  min 1 (8fe0-…) / max 1 (6acc-…)
          └ entryLink "Shield"       85b7-… → 50e2-1873-a856-03e7  min 0 (6329-…) / max 1 (cb43-…)
```

Die Optionen sind **Geschwister** des Modells unter derselben Einheit — genau der
Bezugsrahmen, den die `scope="parent"`-Bedingungen des Profils zählen (siehe
LTP-R6). Im Roster erscheinen sie flach als direkte Kinder der Einheit-Auswahl;
die Gruppenzugehörigkeit steht im `entryGroupId`.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LTP-R1** | Eine `condition type="lessThan" value="1" … childId="<Eintrag>"` hält genau dann, wenn der Rahmen **weniger als 1**, also **null** Stück dieses Eintrags führt. Sie ist die Negation von „mindestens eins" und kippt, sobald die Option gewählt wird. | `Mercenaries…cat` Z. 6814: `<condition type="lessThan" value="1" field="selections" scope="parent" childId="1eb7-3f36-8cf7-e0ba" shared="true" childName="Great Weapon" includeChildSelections="true"/>`. Zieleintrag: `.gst` Z. 987, `selectionEntry "Great Weapon"`. |
| **LTP-R2** | Der Parier-Punkt (`decrement 1` auf **Sv**) hängt an einer **`and`-Gruppe** aus **beiden** Bedingungen: „**keine** Zweihandwaffe" **und** „**mindestens ein** Schild". Fehlt eines der beiden Glieder, wirkt der Modifikator nicht. | Z. 6810–6819: `modifier type="decrement" value="1" field="f1be-e66c-d5e1-673c"` mit `conditionGroup type="and"`, darin die `lessThan`-Bedingung (Z. 6814) und `condition type="atLeast" value="1" … childId="50e2-1873-a856-03e7"` (Z. 6815). Eine `and`-Gruppe hält nur, wenn **alle** Mitglieder halten (Format-Dokument §7.7). |
| **LTP-R3** | Basis und unbedingter Zuschlag: Das Profil schreibt **Sv 6** und trägt einen **unbedingten** `increment 1` auf dasselbe Feld. Ohne jede Ausrüstung ergibt das **Sv 7** (im Datensatz der Wert für „kein Rüstungswurf", vgl. `defaultValue="7"` der `.gst`). | Z. 6789: `<characteristic name="Sv" typeId="f1be-e66c-d5e1-673c">6</characteristic>`; Z. 6820: `<modifier type="increment" value="1" field="f1be-e66c-d5e1-673c"/>` **ohne** `<conditions>`. `.gst` Z. 84: `characteristicType id="f1be-e66c-d5e1-673c" name="Sv" defaultValue="7"`. |
| **LTP-R4** | Das **Schild allein** zählt bereits einmal: ein eigener, nur an `atLeast 1 Shield` gebundener `decrement 1`. Er ist von der Zweihandwaffe **unabhängig** — nur der Parier-Punkt (LTP-R2) ist es nicht. | Z. 6800–6804: `modifier type="decrement" value="1" field="f1be-e66c-d5e1-673c"` mit einziger Bedingung `atLeast 1 childId="50e2-1873-a856-03e7" scope="parent" includeChildSelections="true"`. |
| **LTP-R5** | Auf **demselben** Feld liegen zwei weitere Rüstungs-Abzüge: **Heavy Armour → `decrement 2`**, **Light Armour → `decrement 1`**. Mehrere `decrement`/`increment` auf einem Merkmal **summieren** sich; die Reihenfolge ist für das Ergebnis unerheblich. | Z. 6795–6799 (`atLeast 1 childId="dde4-0ba8-7b3c-57b7"`, Heavy Armour) und Z. 6805–6809 (`atLeast 1 childId="055f-8e4e-f170-35d2"`, Light Armour). |
| **LTP-R6** | **Bezugsrahmen:** Alle vier Bedingungen tragen `scope="parent"`. Der Modifikator hängt am Profil des **Modells** `216c-…`; dessen Elternauswahl im Roster ist die **Einheit** `59b2-…`. Gezählt werden also die Ausrüstungs-Auswahlen der Einheit — der Rüstungswurf gilt damit **für die ganze Einheit**, nicht je Modell. | Die Zieleinträge der vier Bedingungen (`dde4-…`, `50e2-…`, `055f-…`, `1eb7-…`) sind ausschließlich als `entryLink`s in den Gruppen unter der **Einheit** deklariert (Z. 6834–6901), nie unter dem Modell. Unter der Lesart „Rahmen = das Modell" wäre **kein** Modifikator jemals wirksam — die Daten wären sinnlos. `scope="parent"` vergleicht dabei aufgelöste **Ziel-Ids** (§3.4/§7.6): das Roster trägt sie im `entryId`, die Link-Id im `entryLinkId`. |
| **LTP-R7** | Der Effekt ist ein **Merkmalswert**, keine zählende Schranke. Es wird deshalb **keine** feuernde Grenze aus LTP-R1…R6 erwartet; die Aussagen laufen über `expect.capabilities[].infoElements[].characteristics`. | Der Verletzungsbericht kodiert Zähl-Grenzen (`constraint`), nicht Profilwerte — dieselbe Feststellung wie in [`modifier-characteristic-value`](../modifier-characteristic-value/README.md) und [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R6). Die `firing`-Liste aller fünf Roster ist leer. |

### Die Rechnung im Detail

Basis-`characteristics` des Profils `c69e-8fe4-ad3d-3b7d` („Dwarf",
`typeId=a54a-7f00-29bf-12b1`, Z. 6779–6793):

```
Mv 3 | WS 4 | BS 3 | S 3 | T 4 | W 1 | I 2 | A 1 | Ld 9 | Sv 6 | Sv+ 7 | US 1 | Base 20x20
```

Die fünf Modifikatoren auf `f1be-e66c-d5e1-673c` (Sv), in Katalogreihenfolge:

| # | Operation | Bedingung | Beleg |
|---|-----------|-----------|-------|
| M1 | `decrement 2` | `atLeast 1` Heavy Armour `dde4-…` | Z. 6795–6799 |
| M2 | `decrement 1` | `atLeast 1` Shield `50e2-…` | Z. 6800–6804 |
| M3 | `decrement 1` | `atLeast 1` Light Armour `055f-…` | Z. 6805–6809 |
| M4 | `decrement 1` | `and`( **`lessThan 1` Great Weapon `1eb7-…`** , `atLeast 1` Shield `50e2-…` ) | Z. 6810–6819 |
| M5 | `increment 1` | **keine** (unbedingt) | Z. 6820 |

| Roster | Ausrüstung der Einheit | M1 | M2 | M3 | **M4 (`lessThan`)** | M5 | **Sv** |
|--------|------------------------|----|----|----|---------------------|----|--------|
| 01 | — | – | – | – | – (kein Schild) | +1 | **7** |
| 02 | Handwaffe, **Schild** | – | −1 | – | **−1** (0 Zweihandwaffen < 1) | +1 | **5** |
| 03 | Handwaffe, **Schild**, **Zweihandwaffe** | – | −1 | – | – (1 Zweihandwaffe, nicht < 1) | +1 | **6** |
| 04 | Handwaffe, Leichte Rüstung, **Schild** | – | −1 | −1 | **−1** | +1 | **4** |
| 05 | Handwaffe, Leichte Rüstung, **Schild**, **Zweihandwaffe** | – | −1 | −1 | – | +1 | **5** |

**Die Messpaare:** 02 ↔ 03 und 04 ↔ 05. In beiden Paaren ist die Zweihandwaffe
der **einzige** Unterschied, und in beiden verschlechtert sie den Rüstungswurf um
**genau einen Punkt** — das ist der beobachtbare Fingerabdruck der
`lessThan`-Bedingung. Das Paar 04/05 zeigt zugleich die Arithmetik mehrerer
Modifikatoren auf einem Feld (LTP-R5).

Als **Kontrollwerte** prüfen alle fünf Roster zusätzlich **Sv+ 7**
(`d4a9-0ed4-d041-e54b`), **T 4** (`8712-f56f-5b22-a720`) und **WS 4**
(`f95b-da01-0578-3bdc`) mit: am Profil hängen ausschließlich die fünf
Sv-Modifikatoren, alle anderen Merkmale bleiben in **jedem** Roster auf Basis.

### Warum Ogre Kingdoms und nicht Vampire Counts

Die Einheit ist aus **beiden** Armeebüchern als Wurzel-`entryLink` erreichbar:
`9bb3-73fa-a6c6-bfdf` (Ogre Kingdoms, Z. 3337) und `0431-e691-c7f3-686d`
(`Vampire Counts…cat` Z. 29646) — beide mit demselben `targetId`
`59b2-d9d4-f797-9649` und **ohne** eigene Modifikatoren am Link, das Ergebnis
wäre also identisch. Gewählt ist **Ogre Kingdoms**, weil es weniger
armeeweites Rauschen mitbringt: Vampire Counts erzwingt zusätzlich die
Bloodlines-Pflicht `4a0a-b107-e726-da32` (`min 1`, `scope=force`), die in jedem
dieser bewusst minimalen Roster feuern würde. Ogre Kingdoms kennt keine
vergleichbare armeeweite Pflicht-Selektion.

---

## Was dieses Szenario bewusst **nicht** festnagelt

- **Roster 01 ist absichtlich nicht katalogkonform.** Die Gruppe „Armour"
  `ec46-018a-ef42-7c0c` verlangt `min 1` (**`400c-aa4e-1507-c61f`**, Z. 6840) und
  der `entryLink` „Hand Weapon" `min 1` (**`8fe0-6808-1e8a-512f`**, Z. 6883; dazu
  dieselbe Pflicht am Zieleintrag selbst, **`bdef-ba9b-d6ce-5b14`**, `.gst`
  Z. 1034). Ein Zwerg **ohne** Ausrüstung ist im Katalog also gar nicht baubar —
  der Wert **Sv 7** wäre ohne diesen Regelbruch nicht sichtbar, weil jede legale
  Variante mindestens eine Rüstung trägt. Die drei Ids stehen in Roster 01 daher
  **weder in `firing` noch in `absent`**: ob eine Mindestgrenze auf einer *nicht
  vorhandenen* Auswahl gemeldet wird, ist eine Frage des Pflicht-Ankers
  (vgl. [`group-scope-missing-mandatory`](../group-scope-missing-mandatory/README.md),
  [`parent-scope-missing-mandatory`](../parent-scope-missing-mandatory/README.md))
  und **nicht** Gegenstand dieses Szenarios. Die Roster **02 und 03** lassen
  ebenfalls die Rüstungs-Pflicht offen — sie isolieren das Messpaar auf „Schild ±
  Zweihandwaffe"; das **katalogkonforme** Gegenstück liefern die Roster 04 und 05.
- **Fremde Armeeaufbau-Diagnosen.** Die Erwartung ist laut Runner-Vertrag
  **selektiv**. Zusätzlich feuern dürfen (und sind hier ohne Belang): die
  General-Pflicht `1077-7379-f142-f382` (`min 1`, `.gst` Z. 724) und die
  punkteskalierte Core-Pflicht `35c2-d478-392a-aeb1` (`min 2`, `.gst` Z. 374,
  bei 2000 pts per `set` auf 3) — die Roster enthalten bewusst nur die eine
  Söldner-Einheit.
- **Warum überhaupt ein Punktelimit von 2000 gesetzt ist.** Die Kategorie „Rare"
  (`e94b-6a54-8779-cd60`, das Zweitetikett der Einheit) trägt `max 1`
  **`0a44-2d3f-adfe-f3a1`** (`scope=force`, `.gst` Z. 546) mit einem `set 0` für
  Listen **unter 200 Punkten** (Z. 549–554) und einem `set 2` für 2000–2999
  Punkte (Z. 589–600). Mit `costLimit 2000` liegt die eine Rare-Einheit sicher
  innerhalb der Grenze; die Punktesumme der Einheit (10 × 7 pts, Zweihandwaffe
  `+2` je Modell) bleibt weit unter dem Limit, das Budget kann nicht feuern.
- **Sichtbarkeit der Kategorie „Mercenaries".** `b640-7e9c-3054-c1ce` wird per
  `set hidden=true` verborgen, solange der `.gst`-Schalter „Allow Mercenaries"
  `fda5-49b9-b74c-aaf4` nicht im Kontingent liegt (`Mercenaries…cat` Z. 76–82).
  Das ist **Verfügbarkeit**, keine zählende Schranke, und die Kategorie trägt
  keine eigenen `constraints` — der Schalter fehlt in den Rostern bewusst (wie in
  [`modifier-characteristic-value`](../modifier-characteristic-value/README.md)),
  ohne Wirkung auf die geprüften Merkmale.
- **Die `formatRules` des Merkmals Sv.** Die `.gst` definiert für
  `f1be-e66c-d5e1-673c` drei Anzeigeregeln (`^([1-6])$` → `$1+`, `^7+$` → `-`,
  `^$` → `-`; Z. 85–95). Das ist **Darstellung**; geprüft wird der **gerechnete
  Rohwert** (`"7"`, `"6"`, `"5"`, `"4"`) — dieselbe Konvention wie in
  [`modifier-characteristic-value`](../modifier-characteristic-value/README.md)
  und [`set-characteristic-force-gate`](../set-characteristic-force-gate/README.md).
- **Der Heavy-Armour-Zweig (`decrement 2`).** Aus den Daten belegt (LTP-R5), aber
  nicht als eigenes Roster ausgeführt: für die `lessThan`-Frage trägt er nichts
  bei, und die Gruppe „Armour" lässt ohnehin nur **eine** Rüstung zu. Rechnerisch
  ergäbe „Heavy Armour + Schild ohne Zweihandwaffe" `6 − 2 − 1 − 1 + 1 = 3`.
- **Kosten.** Der `entryLink` „Great Weapon" trägt einen `increment 2` auf die
  pts-Kostenart je Modell der Einheit (`repeat scope="parent" childId="model"`,
  Z. 6871–6875). Das Manifest-Feld `capabilities` kennt keine Kosten-Aussage; der
  Punkt bleibt dokumentiert, aber unassertiert (Kostenaufschläge je Modell pinnt
  [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md)).

---

## Testkatalog (E2E-Szenarien der neuen Engine)

> **Assertion-Fokus:** der **Sv**-Wert des Dwarf-Profils je Roster, die drei
> Kontrollmerkmale sowie die in `absent` genannten Grenzen. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Rare-Grenze, Punktelimit) können
> zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Grundlinie: nackter Zwerg | Einheit *Dwarfs*, 10 Modelle, **keine** Ausrüstung. | Der Zwerg hat **Sv 7** — kein Rüstungswurf. Kein Abzug greift, auch nicht der Parier-Punkt (das Schild fehlt), nur der unbedingte `+1`. Sv+ 7, T 4, WS 4 unverändert. Keine szenario-eigene Grenze. | [`01-bare-dwarf-sv-7.ros`](rosters/01-bare-dwarf-sv-7.ros) |
| 02 | **Schild, keine Zweihandwaffe** | 10 Modelle + Handwaffe + **Schild**. | Der Zwerg hat **Sv 5**: der Schild-Abzug **und** der Parier-Punkt greifen, weil die Einheit **keine** Zweihandwaffe führt. | [`02-shield-no-great-weapon-sv-5.ros`](rosters/02-shield-no-great-weapon-sv-5.ros) |
| 03 | **Schild + Zweihandwaffe** | **Bis auf die Zweihandwaffe identisch mit 02.** | Der Zwerg hat **Sv 6** — der Parier-Punkt **entfällt**, sobald die Zweihandwaffe in der Einheit steht. Genau ein Punkt schlechter als 02. | [`03-shield-and-great-weapon-sv-6.ros`](rosters/03-shield-and-great-weapon-sv-6.ros) |
| 04 | Legale Variante: Rüstung + Schild, keine Zweihandwaffe | 10 Modelle + Handwaffe + **Leichte Rüstung** + **Schild**. Erfüllt alle Grenzen der Einheit. | Der Zwerg hat **Sv 4**: Schild `−1`, Leichte Rüstung `−1`, Parieren `−1`, unbedingt `+1`. Drei Modifikatoren auf **einem** Feld. | [`04-light-armour-shield-no-great-weapon-sv-4.ros`](rosters/04-light-armour-shield-no-great-weapon-sv-4.ros) |
| 05 | Legale Variante: Rüstung + Schild + Zweihandwaffe | **Bis auf die Zweihandwaffe identisch mit 04.** | Der Zwerg hat **Sv 5** — wieder genau ein Punkt schlechter, diesmal auf einem in jeder Hinsicht katalogkonformen Roster. | [`05-light-armour-shield-great-weapon-sv-5.ros`](rosters/05-light-armour-shield-great-weapon-sv-5.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (OK-AB)" (Ogre Kingdoms) | `729f-9246-5cd3-5044` |
| Katalog Ogre Kingdoms / Bibliothek Mercenaries | `731d-5b13-2a92-5427` / `fc47-8392-a6c8-452a` (Link `a067-78d5-50a2-affe`) |
| SelectionEntry *Dwarfs* (Söldner-Einheit, `sharedSelectionEntries`) | `59b2-d9d4-f797-9649` (Wurzel-`entryLink` OK `9bb3-73fa-a6c6-bfdf`, VC `0431-e691-c7f3-686d`) |
| SelectionEntry Modell *Dwarf* (Träger des Profils) | `216c-6851-789d-4904` — Grenze `min 10` `ed40-d485-6292-84ee` |
| Profil *Dwarf* (Träger der fünf Sv-Modifikatoren) | `c69e-8fe4-ad3d-3b7d` (`profileType` „Profile" `a54a-7f00-29bf-12b1`) |
| Merkmal Sv (Subjekt) / Sv+, T, WS (Kontrolle) | `f1be-e66c-d5e1-673c` / `d4a9-0ed4-d041-e54b`, `8712-f56f-5b22-a720`, `f95b-da01-0578-3bdc` |
| Auslöser *Great Weapon* (`lessThan`-Ziel, `.gst`-Wurzeleintrag) | `1eb7-3f36-8cf7-e0ba` (Dwarfs-`entryLink` `0dab-c8ee-ac8d-ea02`, `max 1` `e8c1-8bb3-8732-7d53`) |
| Auslöser *Shield* (`atLeast`-Ziel) | `50e2-1873-a856-03e7` (Dwarfs-`entryLink` `85b7-e353-51c2-a663`, `min 0` `6329-56a9-5c78-f852`, `max 1` `cb43-ba97-f160-e2ff`) |
| Auslöser *Light Armour* / *Heavy Armour* | `055f-8e4e-f170-35d2` (Link `4f49-f9a6-8846-7be8`) / `dde4-0ba8-7b3c-57b7` (Link `19ec-f936-77c8-f658`) |
| *Hand Weapon* (Pflichtausrüstung) | `abdb-bbd0-41b2-5dff` (Link `c3b1-01d2-85a9-9b83`; `min 1` `8fe0-6808-1e8a-512f` am Link, `bdef-ba9b-d6ce-5b14` am Ziel) |
| Gruppe „Weapons and Armour" / Gruppe „Armour" | `80b0-e44d-ed5e-5dd7` / `ec46-018a-ef42-7c0c` (`min 1` `400c-aa4e-1507-c61f`, `max 1` `8d83-204d-8f58-f004`, `defaultSelectionEntryId=4f49-f9a6-8846-7be8`) |
| Kategorien der Einheit: *Mercenaries* (primär) / *Rare* | `b640-7e9c-3054-c1ce` / `e94b-6a54-8779-cd60` (Rare-Grenze `0a44-2d3f-adfe-f3a1`) |
| Fremde Pflichten (nicht Gegenstand): General / Core | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` |
| Bloodlines-Pflicht der Alternative Vampire Counts (vermieden) | `4a0a-b107-e726-da32` |
