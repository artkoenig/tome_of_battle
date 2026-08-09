# E2E-Regeln & Testkatalog: Kontingent-Instanz-gegatete Umbenennung (`instanceOf` gegen eine `forceEntry`)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7,
Kasten *„`instanceOf`/`notInstanceOf` gegen eine `forceEntry`"*) abgeleitet; das
Roster-Format ist an den bereits verifizierten Szenarien (direktes `entryId`,
`entryLinkId=""`, verschachtelte `selections` mit `number`) nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`,
  rev 1), dazu die per `catalogueLink` (Z. 29511) benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Dieses Szenario prüft **keine** zählenden Grenzen. Jede
> Erwartung ist ein `expect.capabilities[]`-Eintrag (`defId` + effektiver `name`,
> beim Info-Vorkommen `infoElements[].name`). `firing`/`absent` bleiben leer;
> andere Armeeaufbau-Diagnosen (General-/Core-Pflicht aus der `.gst`, die
> Lichemaster-eigene Lord-Pflicht `760d-2352-9fac-0e46`, die per Modifier auf 1
> gehobene Kemmler-Pflicht `8461-3eab-e5ac-1636`, die im Lichemaster-Kontingent
> auf 1 gehobene Heavy-Armour-Untergrenze `34e8-061e-a32a-4134`) dürfen
> zusätzlich auftreten und sind hier ohne Belang (selektive Erwartung).

---

## Die geprüfte Formatregel (§7.7)

Eine `condition` mit `type="instanceOf"`, `scope="force"` und einer
**`forceEntry`-Id** in `childId` ist die **kanonische** Kodierung der
Kontingent-Instanzprüfung: sie hält genau dann, wenn das Kontingent, das die
tragende Auswahl enthält, eine **Instanz jenes `forceEntry`** ist — keine
selektionsweise Zählung. Ein so gegateter Modifikator wirkt also nur auf
Auswahlen **innerhalb** eines Kontingents dieses `forceEntry` und in keinem
anderen Kontingent. (Formatreferenz §7.7; dieselbe kanonische Kodierung nutzt
das „eigene Punktelimit" der Vampire-Counts-Sonderheere, §5.6.)

Genau diese Zelle — `condition | instanceOf | force | selectionCount |
child=<forceEntry-Id>` — pinnt dieses Roster-Paar: zwei bis auf die
Force-`entryId` identische Roster, einmal hält die Bedingung, einmal nicht.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Alle Belege aus `Vampire Counts (6th definitive edition).cat`. Das Gate ist in
allen Fällen wörtlich dieselbe Bedingung:

```xml
<condition type="instanceOf" value="1" field="selections" scope="force"
           childId="f37a-a93e-fa22-61a8" shared="true" includeChildSelections="true"/>
```

`f37a-a93e-fa22-61a8` ist das `forceEntry "Army of the Lichemaster (WD#309-UK)"`
(Z. 29441).

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **FIG-R1** | **Einheiten-Name:** Im Lichemaster-Kontingent heißt die Einheit *Grave Guard* **„Barrow Guardians"** (Plural!). | `selectionEntry "Grave Guard"` `92ee-2ebf-c6c0-71ff` (Z. 1012, Root-`<selectionEntries>`): entry-eigener `<modifier type="set" value="Barrow Guardians" field="name">` (Z. 1266) mit dem obigen Gate (Z. 1268). |
| **FIG-R2** | **Modell-Slot-Name:** Der verschachtelte Modell-Slot heißt dort **„Barrow Guard"** (Singular). | verschachtelte `selectionEntry "Grave Guard"` `4d29-67e8-1d93-a404` (`type="model"`, Z. 1029): `<modifier type="set" value="Barrow Guard" field="name">` (Z. 1048) mit dem obigen Gate (Z. 1050). |
| **FIG-R3** | **Info-Vorkommen:** Der `infoLink` der Einheit auf das geteilte Grave-Guard-Profil benennt dort **nur jenes Profil-Vorkommen** in „Barrow Guard" um (Träger = der Verweis, nicht die Einheit — dieselbe Träger-Regel wie im Szenario [`modifier-effective-name`](../modifier-effective-name/README.md)). | `infoLink "Grave Guard"` `f319-4efb-0f5c-6733` (Z. 1014, Ziel: geteiltes Profil `b6e4-c268-5a16-378d`, Z. 26781): `<modifier type="set" value="Barrow Guard" field="name">` (Z. 1016) mit dem obigen Gate (Z. 1018). |
| **FIG-R4** | **Gegenprobe:** In einem Kontingent, das **kein** Lichemaster-`forceEntry` instanziiert — hier `forceEntry "Standard (VC-AB)"` `e989-15b8-7eb6-9668` (Z. 29297) —, hält die Bedingung nicht: Einheit, Modell-Slot und Info-Vorkommen behalten den Katalognamen **„Grave Guard"**. Kein anderer Namens-Modifikator greift im Standard-Kontingent: der einzige weitere `field="name"`-Kandidat existiert nicht, die übrigen Modifikatoren der Einheit gaten auf andere `forceEntry`s (`hidden` auf Strigoi `3c87…`/Vampire Coast `bf46…`, Kategorie-Umbau auf Blood Dragons `5e95…`, Punktpreis auf Necromancer's Army `d3af…`). | Basisnamen in den `name`-Attributen: `92ee…` Z. 1012, `4d29…` Z. 1029, `f319…` Z. 1014. Modifikator-Inventar der Einheit: Z. 1042–1059 (Modell), Z. 1243–1282 (Einheit), Z. 1015–1021 (infoLink). |

**Zur Erwartungshöhe von FIG-R1:** Der auftraggebende Regeltext schreibt der
Einheit `92ee…` den Zielnamen „Barrow Guard" zu — die Katalogdaten sagen es
genauer: der **entry-eigene** Modifikator der Einheit setzt **„Barrow
Guardians"** (Z. 1266); „Barrow Guard" (Singular) setzen der **Modell-Slot**
(Z. 1048) und das **Profil-Vorkommen** (Z. 1016). Erwartet wird das, was die
Daten belegen.

### Warum beide Roster ein Punktelimit von 2000 tragen

Das Lichemaster-`forceEntry` trägt eine `min`-Grenze auf dem
Roster-Punktelimit (`field="limit::ecfa-8486-4f6c-c249"`, Constraint
`8f3f-ffa8-387b-0bf9`, Z. 29461), deren Wert ein — mit **demselben**
`instanceOf`-Gate versehener — Modifier auf **2000** hebt (Z. 29464). Beide
Roster deklarieren daher `<costLimit>` 2000 pts, damit diese Nebenregel im
Lichemaster-Roster erfüllt ist und die Roster **exakt symmetrisch** bleiben:
der einzige Unterschied des Paars ist die `entryId` der Force.

### Bewusst nicht abgedeckte Facetten desselben Gates

Dasselbe `instanceOf`-Gate steuert an der Grave Guard im Lichemaster-Kontingent
noch weitere, **nicht**-Namens-Effekte. Sie gehören zu anderen
Szenario-Familien (Constraint-Wert-Modifikation, `hidden`-Verfügbarkeit) und
werden hier absichtlich nicht behauptet:

| Facette | Beleg | Warum ausgelassen |
|---------|-------|--------------------|
| Heavy-Armour-Untergrenze 0 → 1 | `<modifier type="set" value="1" field="34e8-061e-a32a-4134">` (Z. 1153) | Modifier auf einen **Constraint-Wert** — zählende Facette; zudem hängt das Feuern einer `min`-Grenze am Seeding-Verhalten. Beide Roster wählen Heavy Armour, sodass die Grenze in keinem der beiden Fälle feuert. |
| Halberd wird verborgen (`hidden=true`, Z. 1167), Great Weapon wird eingeblendet (`hidden=false`, Z. 1228) | ebd. | Verfügbarkeit (`hidden`) ist nicht Teil des Verletzungsberichts (vgl. [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5); als `capabilities[].isHidden` prüfbar, aber hier nicht Gegenstand. |
| Crypt Keeper → „Dread Guardian" (Z. 1128, plus Profil-Vorkommen Z. 1114) | ebd. | Gleiche Namens-Mechanik wie FIG-R1–R3, brächte keine neue Zelle; das Roster bleibt ohne Command-Aufwertungen minimal. |
| **Selbst-gegatete** Kodierung (`scope="<forceId>"`, `childId="any"`) | Formatreferenz §7.7, Kasten (O&G „Mountain or Troll Country Waaagh!") | Andere Kodierung derselben Semantik — eigener Testfall, nicht dieses Paar. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster
sind **bis auf die `entryId`/`name` der Force identisch**: Einheit Grave Guard
`92ee…` mit 10 Modellen `4d29…` (Untergrenze `4eb4…` min 10 erfüllt),
Handweapon `6cb6…` (Pflicht `c1ea…` min 1 erfüllt) und Heavy Armour `3d69…`;
Punktelimit 2000. Genau dieser eine Unterschied ist der Auslöser — die
Namensänderung lässt sich keiner anderen Ursache zuschreiben.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Kontingent instanziiert das gegatete `forceEntry` → Umbenennung | Grave Guard im Kontingent **„Army of the Lichemaster (WD#309-UK)"** (`f37a…`). | **FIG-R1–R3:** Die Einheit `92ee…` heißt **„Barrow Guardians"**, der Modell-Slot `4d29…` **„Barrow Guard"**, das Profil-Vorkommen `f319…` **„Barrow Guard"**. | [`01-lichemaster-force-renames.ros`](rosters/01-lichemaster-force-renames.ros) |
| 02 | Anderes Kontingent → Katalognamen | **Derselbe** Aufbau im Kontingent **„Standard (VC-AB)"** (`e989…`). | **FIG-R4:** Alle drei Slots/Vorkommen heißen **„Grave Guard"**. | [`02-standard-force-base-names.ros`](rosters/02-standard-force-base-names.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Namen treffen die Engine erst im
**Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heikle Stelle: erkennt die Auswertung die
**kanonische** `forceEntry`-Instanzprüfung (`scope="force"`, Id in `childId`)
als Instanzprüfung — statt in eine selektionsweise Zählung zurückzufallen, die
im Lichemaster-Roster fälschlich `0 ≥ 1` ergäbe und **keinen** Namen ändern
würde? Die Formatreferenz §7.7 verlangt Ersteres.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Army of the Lichemaster (WD#309-UK)" (Ziel der Instanzprüfung) | `f37a-a93e-fa22-61a8` (Z. 29441) |
| Force „Standard (VC-AB)" (Gegenprobe) | `e989-15b8-7eb6-9668` (Z. 29297) |
| Grave Guard, Einheit (`set "Barrow Guardians"`) | `92ee-2ebf-c6c0-71ff` (Z. 1012; Modifier Z. 1266) |
| Grave Guard, Modell-Slot (`set "Barrow Guard"`, min 10 `4eb4-459b-b01c-766d`) | `4d29-67e8-1d93-a404` (Z. 1029; Modifier Z. 1048) |
| `infoLink` „Grave Guard" (`set "Barrow Guard"` am Info-Vorkommen) | `f319-4efb-0f5c-6733` (Z. 1014; Ziel: geteiltes Profil `b6e4-c268-5a16-378d`, Z. 26781) |
| Kategorie „Special" (primär; in beiden Forces per `categoryLink` erlaubt: Standard Z. 29306, Lichemaster Z. 29457) | `43cc-fc3f-35a7-8d03` |
| Handweapon (Pflicht min 1 `c1ea-f061-0147-d585`) | `6cb6-4b58-d77c-4781` |
| Heavy Armour (Untergrenze `34e8-061e-a32a-4134`, im Lichemaster per Modifier auf 1) | `3d69-3741-1b94-8e3e` |
| Lichemaster-Punktelimit-Untergrenze (per Modifier auf 2000) | Constraint `8f3f-ffa8-387b-0bf9` (Z. 29461–29468) |
| Punktkostenart „pts" | `ecfa-8486-4f6c-c249` |
