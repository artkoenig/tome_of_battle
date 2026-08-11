# E2E-Regeln & Testkatalog: `atLeast` mit `scope="self"` — der Träger ist der Zählrahmen, in jeder Tiefe

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschließlich aus den Katalogdaten** der *6th Definitive
Edition* und aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**; die Roster-Gestalt ist an bestehenden Szenario-Fixtures
verifiziert (direktes `entryId`, `entryLinkId=""` beim Wurzeleintrag,
verschachtelte `selections` mit `number` — vgl.
[`less-than-parent-parry-save`](../less-than-parent-parry-save/rosters/04-light-armour-shield-no-great-weapon-sv-4.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Bretonnia (6th definitive edition).cat` (`a5c3-073c-b4e8-4284`,
  rev 1) — Kontingent **„Standard (BR-AB)"** `3a8b-8c11-beff-0534` (`.cat` Z. 5743);
  der Katalog deklariert per `catalogueLink 99a3-c59a-d610-9847` (Z. 5848) die
  Bibliothek `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) als Abhängigkeit; im Szenario selbst wird sie nicht benutzt.
- Getesteter Träger: der Wurzel-`selectionEntry` **„Bretonnian Lord"**
  `bf54-da29-921a-e457` (`.cat` Z. 9, `type="unit"`).

## Worum es geht

Eine `<condition type="atLeast">` mit `scope="self"` fragt: *„Trägt die Auswahl,
an der ich hänge, mindestens `value` Stück des in `childId` genannten Eintrags?"*
Drei Aussagen stecken darin, und alle drei stehen in den Daten:

1. **Der Rahmen ist der Träger der Query selbst** — nicht die Elternauswahl
   (`parent`), nicht das Kontingent (`force`), nicht die Roster (`roster`). Das
   Format-Dokument führt `self` in der Scope-Aufzählung (§7.6, §13.1); der `scope`
   bestimmt, in welchem Rahmen summiert wird (§7.7).
2. **Gezählt wird, was *unter* dem Träger steht** — die Quelle beschreibt den
   `scope` als die Entität, die *„all `field`'s values **of descendant selections**"*
   aufsummiert (§7.6, Regel-Kasten). Mit `includeChildSelections="true"` zählen
   dabei auch Auswahlen mit, die **tiefer** als die direkten Kinder hängen (§7.7:
   *„werden auch unterhalb des Scope-Ziels verschachtelte Auswahlen mitgezählt,
   nicht nur dessen direkte Kinder"*).
3. **`atLeast` ist einschließlich** — `value = 1` heißt „mindestens eins",
   d. h. die Bedingung kippt genau beim Erscheinen des ersten Stücks.

Am **Bretonnian Lord** ist das die Rüstungsrechnung: sein Rüstungswurf ist der im
Profil geschriebene Basiswert, vermindert um jedes Ausrüstungsteil, das
**irgendwo unter ihm** steht — auch um das Barding, das nicht am Lord, sondern am
**Pferd** hängt.

### Der getestete Ausschnitt des Katalogs

```
selectionEntry "Bretonnian Lord" (bf54-da29-921a-e457, type=unit)     Z. 9
 ├ infoLink "Bretonnian Lord" (c2cae708-…, type=profile → 58b5-…)     Z. 245   Basis Sv 7
 │    └ modifiers: 4× decrement auf f1be-e66c-d5e1-673c (Sv),
 │         je gegattert durch GENAU EINE condition
 │         type="atLeast" value="1" field="selections" scope="self"
 │         shared="true" includeChildSelections="true"                Z. 247–270
 ├ entryLinks
 │    ├ "Hand Weapon"    50dd-… → abdb-…      min 1 (1d32-…) / max 1 (ce85-…)   Z. 209
 │    ├ "Shield"         3ce7-… → 50e2-…      max 1 (5d7c-…)                    Z. 223  ← Auslöser 1
 │    ├ "Heavy Armour"   d0d1-… → dde4-…      min 1 (fbf1-…) / max 1 (8df7-…)   Z. 231  ← Auslöser 4
 │    └ "General"        46de-… → 1b7c-…                                        Z. 237
 └ selectionEntryGroups
     ├ "Vow"    4533-…    min 1 (5352-…) / max 1 (d7b1-…)                       Z. 15
     │    └ entryLink "Knights Vow" 1858-… → e432-…                             Z. 21
     └ "Mounts" 99f3-…    min 1 (8f92-…) / max 1 (bb04-…)                       Z. 99
          ├ selectionEntry "On Foot" 12c4-…   (max 07ff-…, dynamisch auf 0)     Z. 105
          └ entryLink "Bretonnian Warhorse" cf12-… → adc2-…  max 1 (25d8-…)     Z. 129  ← Auslöser 3
               └ entryLink "Barding" d815-… → 3211-…                            Z. 134  ← Auslöser 2
                                                     ↑ eine Ebene TIEFER als die
                                                       direkten Kinder des Lords
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ASES-R1** | Der Träger der vier Queries ist der **`infoLink`** am Bretonnian Lord — und damit die Lord-Auswahl, an der er hängt. Alle vier Bedingungen tragen dieselbe Gestalt: `type="atLeast" value="1" field="selections" scope="self" shared="true" includeChildSelections="true"`; sie unterscheiden sich **nur** in `childId`. | `Bretonnia….cat` Z. 245: `<infoLink id="c2cae708-0b6f-4553-9adc-754be21e3d2e" name="Bretonnian Lord" targetId="58b5-73df-d1c1-7387" type="profile">` mit `<modifiers>` Z. 246–271. |
| **ASES-R2** | **Basiswert:** Das Profil `58b5-73df-d1c1-7387` schreibt **Sv 7**. Es gibt **keinen** unbedingten Modifikator auf diesem Feld — ohne greifende Bedingung bleibt der Wert unverändert. | `.cat` Z. 5340–5356; Z. 5351: `<characteristic name="Sv" typeId="f1be-e66c-d5e1-673c">7</characteristic>`. `.gst` Z. 84: `characteristicType id="f1be-e66c-d5e1-673c" name="Sv" defaultValue="7"` (7 = „kein Rüstungswurf"). |
| **ASES-R3** | **Auslöser 1 — Schild:** `decrement 1` auf Sv, gegattert durch `atLeast 1 childId="50e2-1873-a856-03e7"` (`childName="Shield"`). Der Schild hängt als `entryLink` **direkt** am Lord. | Modifikator `.cat` Z. 247–252 (Bedingung Z. 249, `<comment>Shield</comment>`); `entryLink 3ce7-533e-9043-8a77` Z. 223; Zieleintrag `.gst` Z. 964 (`selectionEntry "Shield"`, `type="upgrade"`). |
| **ASES-R4** | **Auslöser 2 — Barding:** `decrement 1` auf Sv, gegattert durch `atLeast 1 childId="3211-d836-02f1-01d0"` (`childName="Barding"`). Das Barding ist **nicht** am Lord verlinkt, sondern **unter** dem Warhorse-Link — eine Ebene tiefer. Nur weil die Bedingung `includeChildSelections="true"` trägt, ist es aus der Sicht des Lords überhaupt zählbar. | Modifikator `.cat` Z. 253–258 (Bedingung Z. 255, `<comment>Barding</comment>`); `entryLink d815-1f70-6690-1f14` Z. 134 — geschachtelt in `entryLink cf12-1619-f359-4462` Z. 129; Zieleintrag `.gst` Z. 1019. |
| **ASES-R5** | **Auslöser 3 — Bretonnian Warhorse:** `decrement 1` auf Sv, gegattert durch `atLeast 1 childId="adc2-53db-4a9e-b8ea"`. Das Pferd steht in der Gruppe „Mounts"; im Roster erscheint es flach als direktes Kind des Lords, die Gruppenzugehörigkeit steht im `entryGroupId`. | Modifikator `.cat` Z. 259–264 (Bedingung Z. 261, `<comment>Horse</comment>`); `selectionEntryGroup 99f3-9464-d966-2a3b` Z. 99, `entryLink cf12-…` Z. 129; Zieleintrag `.cat` Z. 3483 (geteilter Eintrag der Bretonnia). |
| **ASES-R6** | **Auslöser 4 — Heavy Armour:** `decrement` **2** auf Sv, gegattert durch `atLeast 1 childId="dde4-0ba8-7b3c-57b7"`. Der einzige der vier Modifikatoren mit `value="2"` — der Abzug kommt aus dem Katalog, nicht aus einer pauschalen „1". | Modifikator `.cat` Z. 265–270 (Bedingung Z. 267, `<comment>Heavy armour</comment>`); `entryLink d0d1-a2dc-5164-3b51` Z. 231; Zieleintrag `.gst` Z. 938. |
| **ASES-R7** | **Summenbildung:** Alle vier Modifikatoren liegen auf **demselben** Feld `f1be-e66c-d5e1-673c`. Greifen mehrere, **summieren** sich ihre Abzüge; die Reihenfolge ist für das Ergebnis unerheblich (nur `decrement`). Effektives Sv = 7 − Σ(greifende Abzüge), Minimum bei allen vieren: 7 − 1 − 1 − 1 − 2 = **2**. | Ebd., alle vier `modifier … field="f1be-e66c-d5e1-673c"`. Dieselbe Arithmetik mehrerer Modifikatoren auf einem Feld belegt [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md) (LTP-R5). |
| **ASES-R8** | **Abgrenzung des Rahmens:** `scope="self"` ist **nicht** `force`/`roster`. Ausrüstung, die im selben Kontingent an einer **anderen** Auswahl hängt, darf den Rüstungswurf des Lords nicht verändern — auch dann nicht, wenn es **dieselben Ziel-Ids** sind. | Die Einheit „Knights of the Realm" `3f3b-a058-295e-9046` (`.cat` Z. 1087) trägt als **Pflicht** genau die vier Ziel-Ids: Shield `50e2-…` (Link `e269-…`, `min 1` `b538-…`, Z. 1217), Heavy Armour `dde4-…` (Link `e0d8-…`, `min 1` `4ddd-…`, Z. 1229), Warhorse `adc2-…` (Link `598f-…`, `min 1` `e8f9-…`, Z. 1113) und darunter Barding `3211-…` (Link `85a3-…`, `min 1` `9ecf-…`, Z. 1119). Ihr eigenes Profil `75fa-c423-29c4-cd94` (via `infoLink 33f1d553-…`, Z. 1094) trägt **keinerlei** Modifikatoren und steht auf dem geschriebenen **Sv 2** (Z. 5436). |
| **ASES-R9** | **Der Effekt ist ein Merkmalswert, keine zählende Schranke.** Aus ASES-R1…R8 wird **keine** feuernde Grenze erwartet; die Aussagen laufen über `expect.capabilities[].infoElements[].characteristics`, die `firing`-Liste ist in **allen** Rostern leer. | Der Verletzungsbericht kodiert Zähl-Grenzen (`constraint`), nicht Profilwerte — dieselbe Feststellung wie in [`modifier-characteristic-value`](../modifier-characteristic-value/README.md), [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md) (LTP-R7) und [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R6). Das Profil kommt über einen `infoLink` herein; das geprüfte Vorkommen ist deshalb die **Verweis-Id** `c2cae708-…`, nicht die Profil-Id (Manifest-Vertrag: *„bei einem Info-Verweis die Id des VERWEISES"*, so auch in [`modifier-characteristic-value`](../modifier-characteristic-value/scenario.json), Roster 03). |

### Die Rechnung im Detail

Basis-`characteristics` des Profils `58b5-73df-d1c1-7387` („Bretonnian Lord",
`typeId=a54a-7f00-29bf-12b1`, Z. 5340–5356):

```
Mv 4 | WS 6 | BS 3 | S 4 | T 4 | W 3 | I 6 | A 4 | Ld 9 | Sv 7 | Sv+ 7 | US 1 | Base 20x20
```

Die vier Modifikatoren auf `f1be-e66c-d5e1-673c` (Sv), in Katalogreihenfolge:

| # | Operation | Bedingung (`atLeast 1`, `scope="self"`, `includeChildSelections="true"`) | Wo das Ziel unter dem Lord hängt | Beleg |
|---|-----------|--------------------------------------------------------------------------|----------------------------------|-------|
| M1 | `decrement 1` | Shield `50e2-1873-a856-03e7` | direktes Kind (`entryLink 3ce7-…`) | Z. 247–252 |
| M2 | `decrement 1` | Barding `3211-d836-02f1-01d0` | **Enkel** — unter dem Warhorse-Link (`d815-…`) | Z. 253–258 |
| M3 | `decrement 1` | Bretonnian Warhorse `adc2-53db-4a9e-b8ea` | direktes Kind aus der Gruppe „Mounts" | Z. 259–264 |
| M4 | `decrement 2` | Heavy Armour `dde4-0ba8-7b3c-57b7` | direktes Kind (`entryLink d0d1-…`) | Z. 265–270 |

| Roster | Ausrüstung unter dem Lord | M1 | M2 | M3 | M4 | **Sv** |
|--------|---------------------------|----|----|----|----|--------|
| 01 | — | – | – | – | – | **7** |
| 02 | **Schild** | −1 | – | – | – | **6** |
| 03 | **Schwere Rüstung** | – | – | – | −2 | **5** |
| 04 | **Pferd** | – | – | −1 | – | **6** |
| 05 | **Pferd + Barding** (Barding eine Ebene tiefer) | – | **−1** | −1 | – | **5** |
| 06 | Vow, Handwaffe, **Schild**, **Schwere Rüstung**, **Pferd + Barding** | −1 | −1 | −1 | −2 | **2** |
| 07 | — (die vier Teile hängen an einer **anderen** Einheit derselben Force) | – | – | – | – | **7** |

**Die Messpaare:**

- **04 ↔ 05** ist das **Tiefen-Paar**: einziger Unterschied ist das Barding, und
  es hängt **nicht** am Lord, sondern am Pferd. Liest eine Auswertung
  `includeChildSelections="true"` nicht — zählt sie also nur die direkten Kinder
  des Trägers —, bliebe Roster 05 fälschlich bei **6**.
- **01 ↔ 07** ist das **Rahmen-Paar**: der Lord ist in beiden Rostern identisch
  (nackt), in 07 stehen aber alle vier Ziel-Ids im selben Kontingent an einer
  anderen Einheit. Fasst eine Auswertung `self` zu weit (`force`/`roster`), fiele
  Sv in Roster 07 auf 2 statt 7.
- **02/03/04** isolieren je **einen** Auslöser; 03 belegt zusätzlich den
  `value="2"`, 06 die Summenbildung aller vier auf einem Feld.

Als **Kontrollwerte** prüfen alle Roster zusätzlich **Sv+ 7**
(`d4a9-0ed4-d041-e54b`), **WS 6** (`f95b-da01-0578-3bdc`) und **T 4**
(`8712-f56f-5b22-a720`) mit: am Verweis-Vorkommen hängen ausschließlich die vier
Sv-Modifikatoren, alle anderen Merkmale bleiben in **jedem** Roster auf Basis.

---

## Was dieses Szenario bewusst **nicht** festnagelt

- **Die Roster 01–05 sind absichtlich nicht katalogkonform.** Der Lord verlangt
  `min 1` in der Vow-Gruppe (**`5352-910f-fe13-a8f5`**, Z. 17), `min 1` in der
  Mounts-Gruppe (**`8f92-2c89-5335-8ce8`**, Z. 102), `min 1` Hand Weapon
  (**`1d32-3280-ccc4-5f89`** am Link, Z. 211; dazu dieselbe Pflicht am Zieleintrag,
  **`bdef-ba9b-d6ce-5b14`**, `.gst` Z. 1034) und `min 1` Heavy Armour
  (**`fbf1-0ef9-150e-90da`**, Z. 234). Ein Lord **ohne** Schwere Rüstung ist im
  Katalog gar nicht baubar — der **Basiswert Sv 7** und die Isolation der
  einzelnen Auslöser wären ohne diesen Regelbruch nicht sichtbar. Diese fünf Ids
  stehen in den Rostern 01–05 und 07 deshalb **weder in `firing` noch in
  `absent`**: ob eine Mindestgrenze auf einer *nicht vorhandenen* Auswahl gemeldet
  wird, ist eine Frage des Pflicht-Ankers (vgl.
  [`parent-scope-missing-mandatory`](../parent-scope-missing-mandatory/README.md))
  und **nicht** Gegenstand dieses Szenarios. Das **katalogkonforme** Gegenstück
  liefert Roster 06 — dort stehen alle fünf Mindestgrenzen in `absent`.
- **„On Foot" statt Pferd wäre keine Alternative.** Der Eintrag `12c4-dfe3-e7ad-4d0c`
  (Z. 105) trägt eine `max`-Grenze **`07ff-a7ec-2f75-bfd0`** (Basis `-1`), die per
  `set 0` auf **0** gezogen wird, solange der Lord **keine** „Virtue of Empathy"
  `7253-c4c4-e42b-fc1a` führt (Z. 112–116). Ein Fußlord ist im Datensatz also nur
  mit dieser Tugend baubar; die Mounts-Pflicht in den Rostern 01–03 offen zu
  lassen ist der kleinere und klarer lesbare Regelbruch.
- **Die Abgrenzung `self` ↔ `unit`.** Der Träger der Query ist selbst ein
  `selectionEntry type="unit"`; dort fallen `scope="self"` und `scope="unit"`
  (§7.7: der nächste Vorfahre mit `type="unit"`, den Träger **eingeschlossen**)
  zusammen. Gepinnt wird deshalb die Abgrenzung gegen `force`/`roster`/`parent`
  (Roster 07) — dieselbe Lücke wie in
  [`at-least-self-model-count`](../at-least-self-model-count/README.md).
- **`shared="true"`.** Alle vier Bedingungen tragen es, aber kein Roster stellt
  denselben Träger **zweimal** ins Kontingent; die Instanz-Frage wird hier also
  nicht entschieden. Roster 07 zeigt lediglich, dass eine **andere Definition**
  mit demselben Ziel nicht in den Rahmen fällt.
- **Die `formatRules` des Merkmals Sv.** Die `.gst` definiert für
  `f1be-e66c-d5e1-673c` drei Anzeigeregeln (`^([1-6])$` → `$1+`, `^7+$` → `-`,
  `^$` → `-`; Z. 85–95). Das ist **Darstellung**; geprüft wird der **gerechnete
  Rohwert** (`"7"`, `"6"`, `"5"`, `"2"`) — dieselbe Konvention wie in
  [`modifier-characteristic-value`](../modifier-characteristic-value/README.md)
  und [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md).
- **Fremde Armeeaufbau-Diagnosen.** Die Erwartung ist laut Runner-Vertrag
  **selektiv**. Zusätzlich feuern dürfen (und sind hier ohne Belang): die
  General-Pflicht `1077-7379-f142-f382` (`min 1`, `.gst`), die punkteskalierte
  Core-Pflicht `35c2-d478-392a-aeb1` sowie die Lord-Grenze des Kontingents
  **`d7e7-599d-12cf-1fd1`** (`max`, `scope=force`, `.cat` Z. 5757; Basis 0, per
  Modifikatoren am Punktelimit skaliert). Alle Roster tragen `costLimit` **2000**
  und bleiben mit ≈110–260 Punkten weit darunter, damit keine Budget-Diagnose
  dazwischenfunkt.
- **Kosten.** `capabilities` kennt keine Kosten-Aussage. Der `entryLink` „Bretonnian
  Warhorse" des Lords überschreibt die Kosten des Zieleintrags (21 statt 14 pts,
  Z. 130–132), der Barding-Link setzt sie auf 0 (Z. 135–137) — dokumentiert,
  aber unassertiert.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle benutzen das
Kontingent „Standard (BR-AB)" `3a8b-8c11-beff-0534` und tragen `costLimit` 2000.

> **Assertion-Fokus:** der **Sv**-Wert des Lord-Profils je Roster, die drei
> Kontrollmerkmale sowie die in `absent` genannten Grenzen. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Lord-Kontingent, Punktelimit)
> können zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Zählung unter dem Träger (`scope="self"`) | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------|-------------------------------------------------------|---------|
| 01 | Grundlinie: nackter Lord | Nur der Bretonnian Lord, **keine** Kindauswahl. | Shield 0, Barding 0, Pferd 0, Heavy Armour 0 → **keine** Bedingung hält. | Der Lord hat **Sv 7** — der geschriebene Basiswert, kein Abzug greift. Sv+ 7, WS 6, T 4 unverändert. | [`01-lord-bare-sv-7.ros`](rosters/01-lord-bare-sv-7.ros) |
| 02 | Nur Schild | Bis auf den **Schild** identisch mit 01. | Shield **1** → hält; die übrigen drei bleiben 0. | Der Lord hat **Sv 6**: genau ein Abzug von 1. Der Schwellenwert 1 wird exakt erreicht — `atLeast` schließt ihn ein. | [`02-lord-shield-sv-6.ros`](rosters/02-lord-shield-sv-6.ros) |
| 03 | Nur Schwere Rüstung | Bis auf die **Schwere Rüstung** identisch mit 01. | Heavy Armour **1** → hält; die übrigen drei bleiben 0. | Der Lord hat **Sv 5** — zwei Punkte, nicht einer: der Modifikator trägt `value="2"`. | [`03-lord-heavy-armour-sv-5.ros`](rosters/03-lord-heavy-armour-sv-5.ros) |
| 04 | Nur Pferd | Bis auf das **Bretonnian Warhorse** (Gruppe „Mounts") identisch mit 01. | Pferd **1** → hält; Barding bleibt **0** (nicht gewählt). | Der Lord hat **Sv 6**. Erste Hälfte des Tiefen-Paares. | [`04-lord-warhorse-sv-6.ros`](rosters/04-lord-warhorse-sv-6.ros) |
| 05 | **Pferd mit Barding** | **Bis auf das Barding identisch mit 04** — und das Barding hängt **unter dem Pferd**, nicht am Lord. | Pferd **1** → hält; Barding **1** → hält, obwohl es ein *Enkel* des Trägers ist. | Der Lord hat **Sv 5** — genau ein Punkt besser als 04. Der Fingerabdruck von `includeChildSelections="true"`: zählte die Auswertung nur direkte Kinder, stünde hier 6. | [`05-lord-warhorse-barding-sv-5.ros`](rosters/05-lord-warhorse-barding-sv-5.ros) |
| 06 | Alle vier zugleich (katalogkonform) | Knights Vow, Handwaffe, Schild, Schwere Rüstung, Pferd **mit** Barding. Erfüllt jede Grenze des Lords. | Alle vier Ist-Werte **1** → alle vier Bedingungen halten. | Der Lord hat **Sv 2**: `7 − 1 − 1 − 1 − 2`. Vier Modifikatoren summieren sich auf **einem** Feld. Zusätzlich: **keine** Mindestgrenze des Lords feuert. | [`06-lord-all-four-sv-2.ros`](rosters/06-lord-all-four-sv-2.ros) |
| 07 | Ausrüstung an der **falschen** Einheit | Der nackte Lord aus 01 **plus** eine voll ausgerüstete Einheit *Knights of the Realm* (5 Modelle, Gallant, Handwaffe, Lanze, Schild, Schwere Rüstung, Pferd + Barding) im selben Kontingent. | Unter dem **Lord**: alle vier Ist-Werte **0**. Kontingent-/rosterweit dagegen: alle vier **≥ 1**. | Der Lord hat **Sv 7** — unverändert. Der schärfste Nachweis, dass `scope="self"` den **Träger** meint. Kontrolle: das Ritter-Profil steht auf seinem geschriebenen **Sv 2**, denn sein Verweis trägt keine Modifikatoren. | [`07-bare-lord-beside-equipped-knights-sv-7.ros`](rosters/07-bare-lord-beside-equipped-knights-sv-7.ros) |

**Beweisführung in beide Richtungen:** Die Roster 02–06 schlagen fehl, wenn die
Auswertung eine haltende Bedingung übersieht (Sv bliebe zu hoch) oder den
`decrement`-Wert falsch liest. Roster 05 schlägt zusätzlich fehl, wenn sie nur
direkte Kinder zählt. Roster 01 und 07 schlagen fehl, wenn sie den Rahmen zu weit
fasst (`force`/`roster`) oder Bedingungen ohne Beleg halten lässt — dann fiele Sv
unter 7.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (BR-AB)" (Bretonnia) | `3a8b-8c11-beff-0534` (Lord-Grenze des Kontingents `d7e7-599d-12cf-1fd1`) |
| Katalog Bretonnia / `catalogueLink` → Bibliothek Mercenaries | `a5c3-073c-b4e8-4284` / `99a3-c59a-d610-9847` → `fc47-8392-a6c8-452a` |
| Träger: SelectionEntry *Bretonnian Lord* (`type="unit"`) | `bf54-da29-921a-e457` — Kategorien Lord `d024-d25b-a9b4-73b6` (primär) / Characters `7a1c-d611-c2dc-def1` |
| InfoLink *Bretonnian Lord* (Träger der vier Sv-Modifikatoren) | `c2cae708-0b6f-4553-9adc-754be21e3d2e` → Profil `58b5-73df-d1c1-7387` (`profileType` „Profile" `a54a-7f00-29bf-12b1`, Basis **Sv 7**) |
| Merkmal Sv (Subjekt) / Sv+, WS, T (Kontrolle) | `f1be-e66c-d5e1-673c` / `d4a9-0ed4-d041-e54b`, `f95b-da01-0578-3bdc`, `8712-f56f-5b22-a720` |
| Auslöser 1 *Shield* (`.gst`-Eintrag) | `50e2-1873-a856-03e7` — Lord-`entryLink` `3ce7-533e-9043-8a77` (`max 1` `5d7c-add5-0e19-7649`), Ziel-`max 1` `61e6-14a6-8422-d83a` |
| Auslöser 2 *Barding* (`.gst`-Eintrag, **unter dem Pferd** verlinkt) | `3211-d836-02f1-01d0` — `entryLink` `d815-1f70-6690-1f14`, Ziel-`max 1` `ffd4-6f1b-e014-6708` |
| Auslöser 3 *Bretonnian Warhorse* (geteilter Bretonnia-Eintrag) | `adc2-53db-4a9e-b8ea` — Lord-`entryLink` `cf12-1619-f359-4462` (`max 1` `25d8-9ea5-9936-d44c`), Ziel-`max 1` `d1fd-8f42-122a-e2b6` |
| Auslöser 4 *Heavy Armour* (`.gst`-Eintrag, `decrement 2`) | `dde4-0ba8-7b3c-57b7` — Lord-`entryLink` `d0d1-a2dc-5164-3b51` (`min 1` `fbf1-0ef9-150e-90da`, `max 1` `8df7-8f2d-4b60-a938`), Ziel-`max 1` `40c1-e17a-2dd8-fba6` |
| Gruppe „Mounts" (`defaultSelectionEntryId=cf12-…`) / Eintrag „On Foot" | `99f3-9464-d966-2a3b` (`min 1` `8f92-2c89-5335-8ce8`, `max 1` `bb04-e762-5ef0-a6bc`) / `12c4-dfe3-e7ad-4d0c` (dyn. `max` `07ff-a7ec-2f75-bfd0`) |
| Gruppe „Vow" / *Knights Vow* | `4533-c439-9afd-8a27` (`min 1` `5352-910f-fe13-a8f5`, `max 1` `d7b1-1663-7bd9-d8c4`) / `e432-4d78-0f50-1e35` (Link `1858-1a94-5453-9f62`, Ziel-`max 1` `dde3-d464-c6d0-8ec8`) |
| *Hand Weapon* (Pflichtausrüstung des Lords) | `abdb-bbd0-41b2-5dff` (Link `50dd-7a6f-a038-a90b`; `min 1` `1d32-3280-ccc4-5f89` / `max 1` `ce85-f523-bccd-ba01` am Link, `min 1` `bdef-ba9b-d6ce-5b14` / `max 1` `e28e-dbb4-b8ad-d4ab` am Ziel) |
| Gegenprobe-Einheit *Knights of the Realm* (Core) | `3f3b-a058-295e-9046` (Eigen-`min` `f9c2-08f7-b725-fc4f`) — Modell `b464-becf-ab59-782b` (`min 5` `4290-e0b1-7133-af5e`, `max 15` `9ed7-1760-ae79-5bf9`) |
| … ihr Profil (**ohne** Modifikatoren, Sv 2) | `75fa-c423-29c4-cd94` via `infoLink 33f1d553-c707-4d02-8afb-decba0bfda79` |
| … ihre Pflichtausrüstung (dieselben Ziel-Ids wie die vier Auslöser) | Shield `e269-8701-6156-a43a` (`b538-0c35-164b-f2fc`/`40af-b071-49ff-bcf2`), Heavy Armour `e0d8-3973-ca75-9b5b` (`4ddd-2080-b7b3-45c4`/`2a22-b99c-6fc1-a325`), Hand Weapon `01e2-983b-7eed-3214` (`69fe-0a04-43da-2add`/`be7d-a70d-b7a8-9844`), Lance `e9c2-fb34-aa90-40a4` (`0649-26da-b091-2e85`/`749f-9bd8-9e4c-6aef`), Warhorse `598f-56c2-4c66-8a65` (`e8f9-12ba-284b-0e66`/`f135-8299-0871-ee77`), Barding `85a3-1df7-e4e7-ae16` (`9ecf-1fbe-13d8-d602`/`2350-1fb7-a7ff-186b`) |
| … Gruppe „Weapons and Armour" / „Command group" mit *Gallant* | `fedc-6549-515c-2492` / `7d5f-dc8d-9d0e-e83f` mit `2a70-0a02-d33a-df61` (`min 1` `26c6-cd4f-cbda-df74`, `max 1` `35e2-2056-4819-ce26`) |
| Fremde Pflichten (nicht Gegenstand): General / Core | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` |
| Kostenart „pts" (`costLimit` 2000 in allen Rostern) | `ecfa-8486-4f6c-c249` |
