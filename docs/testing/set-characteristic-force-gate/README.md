# E2E-Regeln & Testkatalog: `set`-Merkmals-Modifikator am Kontingent-Gate (Tomb stalker)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* und aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1); er zieht per
  `catalogueLink ef73-f9bd-e250-54d2` die Bibliothek
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) herein
  (`.cat` Z. 29511).
- Kontingente: **„Army of the Lichemaster (WD#309-UK)"** `f37a-a93e-fa22-61a8`
  (`.cat` Z. 29441) und **„Standard (VC-AB)"** `e989-15b8-7eb6-9668`
  (`.cat` Z. 29297).

## Worum es geht

Ein `<modifier type="set">`, dessen `field` die **Id eines `<characteristicType>`**
nennt, ersetzt **genau diesen Merkmalswert** des Profils bzw. des
`<infoLink>`-Vorkommens, an dem er haengt — solange seine Bedingung haelt; sonst
gilt der Basiswert des Profils. Das Format-Dokument fuehrt
`<characteristicTypeId>` explizit als zulaessigen `field`-Wert (§7.7, Tabelle
„`modifier`-Attribut") und beschreibt Profile/Merkmale in §7.3; die kanonische
Kodierung der Kontingent-Instanzpruefung (`condition type="instanceOf"
scope="force" childId="<forceEntry-Id>"`) ist im §7.7-Kasten
„`instanceOf`/`notInstanceOf` gegen eine `forceEntry`" festgehalten.

Traeger ist die Wurzeleinheit **„Tomb stalker"**
`f401a3ed-077e-4795-b32d-ee659bd0b37a` (`.cat` Z. 12015–12060, Basis
`hidden="true"`): sie bezieht ihren Statblock ueber den Profil-`infoLink`
**„Tomb Scorpion"** `fe84bf5a-d0f1-4b5e-ae5d-475128f4ee32` (Z. 12017,
`targetId=d2b729f3-3d5d-4d5b-84a8-cb1906d4ba77`), und **dieser Verweis** traegt
den getesteten Merkmals-Modifikator.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **SCF-R1** | Ist das umschliessende Kontingent eine Instanz von **„Army of the Lichemaster"**, ersetzt der `set`-Modifikator das **Mv**-Merkmal des Profil-Vorkommens exakt durch **6**. | `Vampire Counts…cat` Z. 12021–12024: `modifier type="set" value="6" field="0e92-d038-82bf-fb41"` mit einziger Bedingung `condition type="instanceOf" value="1" field="selections" scope="force" childId="f37a-a93e-fa22-61a8"`. `0e92-d038-82bf-fb41` = characteristicType **„Mv"** des profileType „Profile" `a54a-7f00-29bf-12b1` (`.gst` Z. 18–27). |
| **SCF-R2** | Haelt die Bedingung **nicht** (Kontingent „Standard"), steht der **Basiswert** des geteilten Profils: **Mv 7**. | Geteiltes Profil „Tomb Scorpion" `d2b729f3-3d5d-4d5b-84a8-cb1906d4ba77` (Z. 28592–28608): `characteristic name="Mv" typeId="0e92-…">7<`. Das Profil selbst traegt **keine** eigenen `<modifiers>`; der Modifikator haengt allein am Verweis-Vorkommen. |
| **SCF-R3** | Der Modifikator trifft **nur** das im `field` genannte Merkmal — alle uebrigen Merkmale des Vorkommens bleiben in **beiden** Kontingenten auf Basis (Kontrollwerte: WS 4, Sv+ 5). | Die `modifierGroup` des `infoLink` (Z. 12018–12033) enthaelt genau zwei Modifikatoren: den Mv-`set` (SCF-R1) und einen `name`-`set` (SCF-R4). Basis: WS `4` (Z. 28595), Sv+ `5` (Z. 28604). |
| **SCF-R4** | **Begleiteffekt Name:** Dasselbe Gate setzt den Namen des Profil-Vorkommens auf **„Tomb stalker"**; ohne Gate gilt der Katalogname **„Tomb Scorpion"**. | Z. 12026–12029: `modifier type="set" value="Tomb stalker" field="name"` mit identischer `instanceOf`-Bedingung. |
| **SCF-R5** | **Begleiteffekt Sichtbarkeit:** Die Einheit ist per Basis `hidden="true"` und wird **nur** im Lichemaster-Kontingent eingeblendet (`isHidden` false), sonst bleibt sie verborgen (`isHidden` true). | Z. 12015 (`hidden="true"`) und Z. 12049–12053: `modifier type="set" value="false" field="hidden"` mit identischer `instanceOf`-Bedingung. Sichtbarkeit ist **Verfuegbarkeit**, keine zaehlende Schranke — sie erscheint nicht als feuernde Grenze, sondern wird ueber `capabilities[].isHidden` gepinnt. |
| **SCF-R6** | **Begleiteffekt Kosten — anders als vermutet UNBEDINGT:** Der Kosten-Modifikator `set 45` auf die pts-Kostenart traegt **keine** Bedingung; die Einheit kostet in **jedem** Kontingent 45 pts (Basis-`cost` 85 ist damit wirkungslos). | Z. 12044 (`cost pts value="85"`) und Z. 12054: `modifier type="set" value="45" field="ecfa-8486-4f6c-c249"` **ohne** `<conditions>`. Nicht Lichemaster-gegatet. Das Manifest-Feld `capabilities` kennt keine Kosten-Aussage; der Punkt bleibt dokumentiert, aber unassertiert. |

### SCF-R1/R2 im Detail — Basiswerte und Ersetzung

Basis-`characteristics` des geteilten Profils `d2b729f3-3d5d-4d5b-84a8-cb1906d4ba77`
(„Tomb Scorpion", `typeId=a54a-7f00-29bf-12b1`, Z. 28593–28606):

```
Mv 7 | WS 4 | BS 0 | S 5 | T 5 | W 4 | I 3 | A 4 | Ld 8 | Sv 7 | Sv+ 5 | US 3
```

| Roster | Kontingent | `instanceOf f37a-…` | Mv des Vorkommens | Name des Vorkommens | `isHidden` der Einheit |
|--------|------------|----------------------|-------------------|----------------------|-------------------------|
| 01 | Army of the Lichemaster (WD#309-UK) | **haelt** | **6** (`set` ersetzt 7) | „Tomb stalker" | **false** |
| 02 | Standard (VC-AB) | haelt **nicht** | **7** (Basis) | „Tomb Scorpion" | **true** |

Die Merkmale **WS 4** und **Sv+ 5** werden in beiden Rostern als Kontrollwerte
mitgeprueft: sie belegen, dass der `set` **nur** das im `field` genannte Merkmal
ersetzt (SCF-R3), und dass in Roster 02 ueberhaupt kein Merkmal veraendert wird.

---

## Was dieses Szenario bewusst **nicht** festnagelt

- **Zaehlende Grenzen.** Die Einheit „Tomb stalker" traegt **keine** eigenen
  `<constraints>` (Z. 12015–12060); es gibt keine szenario-eigene Grenze, die
  feuern oder schweigen muesste. `firing` und `absent` sind in beiden Rostern
  leer.
- **Fremde Pflicht-Diagnosen der beiden Kontingente.** Die Erwartung ist laut
  Runner-Vertrag **selektiv**; folgende Grenzen koennen zusaetzlich feuern und
  sind hier ohne Belang: Im **Lichemaster**-Kontingent heben `set`-Modifikatoren
  die Pflicht-Untergrenzen von **Heinrich Kemmler** (`8461-3eab-e5ac-1636`,
  Z. 10772/10806) und **Krell** (`60a8-5b49-6b81-7c84`, Z. 12313/12373) auf 1
  (mit einer `not`-Gruppen-Ausnahme fuer die Kampagnenvariante, siehe §7.7 des
  Format-Dokuments); im **Standard**-Kontingent gilt die Bloodlines-Pflicht
  `4a0a-b107-e726-da32` (min 1, scope=force, Z. 5194) — im Lichemaster-Kontingent
  ist der Bloodlines-Eintrag dagegen per `set hidden=true` ausgeblendet
  (Z. 5196–5207). Dazu koennen General-/Core-Pflichten des Spielsystems treten.
  Beide Roster halten sich bewusst an das Experiment-Design „identisch bis auf
  die Force" (wie [`force-instance-gated-rename`](../force-instance-gated-rename/README.md),
  dasselbe Kontingent-Paar): die je Kontingent **verschiedenen** Pflichten
  liessen sich nicht erfuellen, ohne die Roster ueber die Force hinaus zu
  unterscheiden und den Modifikator-Vergleich zu verwaessern.
- **Die uebrigen Lichemaster-Gates der Einheit.** Der Regel-`infoLink`
  „It Came From Below" (`f2c4589b-6786-42a1-9d7b-564ebb881d83`, Z. 12036–12040)
  wird **unbedingt** auf `hidden=true` gesetzt — kein Kontingent-Gate, nicht
  Gegenstand. Die Kosten (SCF-R6) sind mangels Kosten-Aussage im
  `capabilities`-Vertrag nur dokumentiert.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

> **Assertion-Fokus:** die Merkmalswerte, der Vorkommens-Name und `isHidden` der
> genannten Slots. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht,
> Kemmler-/Krell-/Bloodlines-Pflicht, Punktelimit) koennen zusaetzlich auftreten
> und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Gate **haelt**: Mv wird 6 | Kontingent **Army of the Lichemaster**, genau eine Einheit *Tomb stalker*. | Das Profil-Vorkommen des Tomb stalker zeigt **Mv 6** (ersetzt), heisst **„Tomb stalker"**, die Einheit ist **sichtbar**. WS 4 und Sv+ 5 unveraendert. Keine szenario-eigene Grenze. | [`01-lichemaster-force-mv-6.ros`](rosters/01-lichemaster-force-mv-6.ros) |
| 02 | Gate haelt **nicht**: Basis-Mv 7 | **Bis auf die Kontingent-`entryId` identisch**, Kontingent **Standard (VC-AB)**. | Das Vorkommen zeigt den **Basiswert Mv 7**, heisst **„Tomb Scorpion"**, die Einheit bleibt **verborgen** (`isHidden` true). WS 4 und Sv+ 5 unveraendert. Keine szenario-eigene Grenze. | [`02-standard-force-mv-base-7.ros`](rosters/02-standard-force-mv-base-7.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Army of the Lichemaster (WD#309-UK)" | `f37a-a93e-fa22-61a8` |
| ForceEntry „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Katalog Vampire Counts / Bibliothek Mercenaries | `4d73-5ab0-9020-403c` / `fc47-8392-a6c8-452a` (Link `ef73-f9bd-e250-54d2`) |
| SelectionEntry *Tomb stalker* (Wurzeleinheit, Basis `hidden="true"`) | `f401a3ed-077e-4795-b32d-ee659bd0b37a` |
| Profil-`infoLink` *Tomb Scorpion* (Traeger der Modifikatoren) | `fe84bf5a-d0f1-4b5e-ae5d-475128f4ee32` |
| Geteiltes Profil *Tomb Scorpion* (Basis Mv 7) | `d2b729f3-3d5d-4d5b-84a8-cb1906d4ba77` |
| profileType „Profile" (`.gst`) | `a54a-7f00-29bf-12b1` |
| Merkmal Mv (Subjekt) / WS, Sv+ (Kontrolle) | `0e92-d038-82bf-fb41` / `f95b-da01-0578-3bdc`, `d4a9-0ed4-d041-e54b` |
| pts-Kostenart (unbedingter `set 45`, SCF-R6) | `ecfa-8486-4f6c-c249` |
| Kategorie „Special" (primaer am Tomb stalker) | `43cc-fc3f-35a7-8d03` (categoryLink `28e6-126a-bb1e-1cf7`) |
| Fremde Pflichten (nicht Gegenstand): Kemmler / Krell / Bloodlines | `8461-3eab-e5ac-1636` / `60a8-5b49-6b81-7c84` / `4a0a-b107-e726-da32` |
