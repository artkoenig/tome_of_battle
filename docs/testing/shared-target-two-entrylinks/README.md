# E2E-Regeln & Testkatalog: Zwei `entryLink`s auf dasselbe Ziel (Shared Target)

**Rolle:** Black-Box-Test (kein Blick in den Engine-Quellcode). Alle Regeln,
IDs und Zahlen sind aus den Katalogdaten der *6th Definitive Edition* und dem
Formathandbuch [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
abgeleitet; das Roster-Format ist von bestehenden Szenarien uebernommen
(direktes `entryId` + `entryLinkId`, verschachtelte `selections`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Clan Lahmia (VC-AB)"**
  `2102-34f1-c876-98c5`

## Worum es geht

Ein `selectionEntry` wird im Katalog **einmal** definiert und ueber
`entryLink`s an vielen Stellen wiederverwendet ([§3.2](../../battlescribe-data-format.md)).
Nichts hindert einen Katalogautor daran, **zwei** Links auf **dasselbe** Ziel
unter **einem** Elternteil zu legen — im Vampire-Counts-Katalog ist genau das
passiert: die Gruppe „Magic Armour" der HIGH-ELVES-Magieitems enthaelt den
Eintrag „Armour of Heroes" **doppelt verlinkt**.

Die Frage, die dieses Szenario festnagelt: Zaehlt eine `constraint`, die am
**gemeinsamen Ziel** haengt (nicht an einem der Links), die ueber **beide**
Links eingebrachten Selektionen **zusammen**? Zwei Tueren sind zwei Wege in
denselben Raum, nicht zwei Raeume.

Das Formathandbuch beantwortet das eindeutig und ist damit die normative
Quelle dieses Szenarios:

> `constraint`s mit `scope="parent"` vergleichen aufgelöste **Ziel-IDs**, nicht
> `entryLinkId`s (verschiedene Links können auf dasselbe Ziel zeigen).
> — [§3.4 Kontext-Threading](../../battlescribe-data-format.md), wortgleich
> wiederholt in der Regelbox zu [§7.6 Constraint](../../battlescribe-data-format.md).

## Der Pfad im Katalog (verifiziert)

Alle Zeilenangaben beziehen sich auf
`src/evaluator/__fixtures__/whfb6-definitive/Vampire Counts (6th definitive edition).cat`.

```
selectionEntry "Swain" b920-b398-dc26-7f4d              (Z. 5210, unit, hidden=true)
 └ selectionEntryGroup "Hero from another faction" 09bf-a395-daf9-7e25   (Z. 5216, max 1 parent)
    └ selectionEntryGroup "High Elves" 6bb3-dd06-5788-b4f7               (Z. 8776)
       └ selectionEntry "Commander [HIGH ELVES]" d8e205ee-…              (Z. 8778, unit)
          └ selectionEntry "Magic Items and Honours" 86633839-…          (Z. 8802, upgrade)
             └ selectionEntryGroup "Magic and Honors" 5025cb30-…         (Z. 8807, max 50 pts parent)
                └ selectionEntryGroup "Magical Items" 826f57f0-…         (Z. 8812, max -1 = unbegrenzt)
                   └ entryLink ff36ea9b-… → selectionEntryGroup          (Z. 8825)
                      "Magic Armour" 847028b2-…                          (Z. 23460, max 1 parent)
                       ├ entryLink def42370-a8f8-499d-a06e-0e60c1cbda9d  (Z. 23465)  ┐ beide
                       └ entryLink 8f3d6ee5-cce7-4d85-9ed9-973bfc06c800  (Z. 23467)  ┘ targetId=
                            → selectionEntry "Armour of Heroes [HIGH ELVES]"
                              d612998a-3131-45c6-94e0-4e016d5110e4       (Z. 20048)
```

Im Roster erscheinen nur `selectionEntry`s als `<selection>`; die
`selectionEntryGroup`s dazwischen sind reine Katalogstruktur. Die Kette im
`.ros` ist daher: **Swain → Commander → Magic Items and Honours → Armour of
Heroes** (je einmal pro benutzter Tuer, mit dem jeweiligen `entryLinkId`).

**Warum die Force „Clan Lahmia (VC-AB)"?** „Swain" traegt `hidden="true"`
(Z. 5210) und wird durch einen eigenen `modifier` (`set hidden=false`,
Z. 10057–10062) genau dann sichtbar, wenn die Bedingung
`instanceOf … scope="force" childId="2102-34f1-c876-98c5"` gilt — also in der
Force „Clan Lahmia (VC-AB)" (`forceEntry` Z. 29403, mit `categoryLink`
„Heroes" `c16b-f319-2c62-2c12`, Z. 29410). In dieser Force ist das Roster also
eine Liste, die der Katalog selbst zulaesst; Sichtbarkeit ist damit **kein**
Stoerfaktor dieses Szenarios.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **STL-R1** | Zwei verschiedene `entryLink`s unter **einem** Elternteil koennen auf **dasselbe** `selectionEntry` zeigen. | VC-`.cat` Z. 23465 (`entryLink` `def42370-a8f8-499d-a06e-0e60c1cbda9d`) und Z. 23467 (`entryLink` `8f3d6ee5-cce7-4d85-9ed9-973bfc06c800`), beide `targetId="d612998a-3131-45c6-94e0-4e016d5110e4"`, beide Kinder der Gruppe „Magic Armour" `847028b2-d9b5-4b6f-b862-8081a0408270` (Z. 23460). Beide Links sind leer (self-closing) — sie tragen **weder eigene `constraints` noch eigene `costs`**. |
| **STL-R2** | Die Obergrenze haengt am **Ziel**, nicht am Link: „Armour of Heroes" darf **je Elternteil hoechstens einmal** gewaehlt werden — egal, durch welche Tuer. | `selectionEntry` „Armour of Heroes [HIGH ELVES]" `d612998a…` (Z. 20048) → constraint **`f25f23c2-f5f1-4bd0-8c7a-0ce617302c7e`** `type=max value=1 field=selections scope=parent`. Zaehl-Regel: `scope="parent"` vergleicht **aufgeloeste Ziel-IDs**, nicht `entryLinkId`s (Handbuch §3.4 / §7.6). ⇒ Zwei Selektionen desselben Ziels unter einem Elternteil ergeben **Ist 2** gegen **Grenze 1**. |
| **STL-R3** | Derselbe Eintrag ist zusaetzlich **armeeweit** auf 1 begrenzt (klassisches „0-1 magisches Item"). | Dasselbe `selectionEntry` `d612998a…` → constraint **`0aa08f91-b271-402b-98aa-32c51f3beae7`** `type=max value=1 field=selections scope=roster`. ⇒ Zwei Stueck im Roster ergeben **Ist 2** gegen **Grenze 1**, unabhaengig davon, ob sie an einem oder an zwei Traegern haengen. |
| **STL-R4** | Auch die **Gruppe** „Magic Armour" erlaubt je Elternteil nur **eine** ihrer Mitgliedsauswahlen — und beide Links sind Mitglieder derselben Gruppe. | `selectionEntryGroup` „Magic Armour" `847028b2…` (Z. 23460) → constraint **`76e2c1c8-8320-4bc2-a370-cc3e95c7fd2c`** `type=max value=1 field=selections scope=parent`. ⇒ Zwei ueber die beiden Links gewaehlte Mitglieder ergeben **Ist 2** gegen **Grenze 1**. |
| **STL-R5** | `scope="parent"` bindet die Zaehlung an den **Traeger**: zwei Exemplare an **zwei verschiedenen** Commandern verletzen STL-R2/STL-R4 **nicht** — wohl aber die roster-skopierte STL-R3. | Vergleich der `scope`-Attribute: `f25f23c2…`/`76e2c1c8…` = `parent`, `0aa08f91…` = `roster` (Z. 20050/20051/23462). Beide Traeger sind eigene `Swain`-Selektionen; die Gruppe „Hero from another faction" `09bf-a395-daf9-7e25` erlaubt `max 1` je `Swain` (Z. 5218), also braucht der zweite Commander einen zweiten `Swain`. |
| **STL-R6** | Das umgebende Punktebudget wird durch zwei Exemplare **nicht** gerissen. | Gruppe „Magic and Honors" `5025cb30…` → constraint **`7eaade17-79eb-493c-85e7-867000e4beb7`** `type=max value=50 field=ecfa-8486-4f6c-c249 (pts) scope=parent`. „Armour of Heroes" kostet **25 pts** (Z. 20058), die Links ueberschreiben die Kosten nicht ⇒ 2 × 25 = **50 pts = Grenze**, also **keine** Verletzung. Diese Grenze steht in allen Faellen unter `absent` — sie darf in keinem Roster feuern. |
| **STL-R7** | Kein weiteres Maximum stoert die Zaehlung. | Gruppe „Magical Items" `826f57f0…` traegt `constraint 6e84dd18-… max value=-1` (= unbegrenzt, Z. 8821); der `modifier`, der sie auf 0 setzt, ist an `childId="a42f9f6b-48ca-43f5-86f0-ad4a3407e802"` („Magic Banners", Z. 23687) gebunden — in keinem Roster dieses Szenarios gewaehlt. „Magic Items and Honours" traegt `0918bd42-2d7e-4aa9-9baa-36e8d81eb8f1` (`max 1 scope=parent`) und ist je Commander genau einmal gewaehlt ⇒ erfuellt. |

**Nicht Teil der feuernden Menge (bewusst):** Die `hidden`-Eigenschaft von
„Swain" (Z. 5210 + Modifier Z. 10057) ist **Verfuegbarkeit**, keine zaehlende
Grenze — sie taucht im Verletzungsbericht nicht auf und wird hier nur benutzt,
um die Force-Wahl zu begruenden (siehe oben). Ebenso nicht assertiert: die
Namensgleichheit der beiden Links („Armour of Heroes [HIGH ELVES]" in beiden
Zeilen) — sie ist ein Hinweis auf den Autorenfehler im Katalog, aber **niemals**
ein Schluessel fuer Logik (Handbuch §3.1: Namen sind kein Schluessel).

**Selektive Assertion.** Geprueft werden nur die oben genannten Constraint-IDs.
Andere Armeeaufbau-Diagnosen (Pflicht-Bloodline `4a0a-b107-e726-da32`, Core-,
General- oder Punkteregeln der Force „Clan Lahmia") duerfen zusaetzlich
auftreten und sind hier ohne Belang.

---

## Testkatalog

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Nur Tuer A (legal) | Ein Commander mit **einer** „Armour of Heroes", gewaehlt ueber Link **A** (`def42370…`). | **Keine** der vier Grenzen feuert: je Traeger 1, armeeweit 1, Gruppe 1, 25 von 50 Punkten. | [`01-link-a-only-legal.ros`](rosters/01-link-a-only-legal.ros) |
| 02 | Nur Tuer B (legal) | Identisch, aber ueber Link **B** (`8f3d6ee5…`). | Ebenfalls **keine** Verletzung — beide Links fuehren auf denselben Eintrag, und ein Exemplar ist erlaubt. Zeigt, dass das Feuern in Test 03 nicht am einzelnen Link haengt. | [`02-link-b-only-legal.ros`](rosters/02-link-b-only-legal.ros) |
| 03 | Beide Tueren, **ein** Traeger (unzulaessig) | **Ein** Commander nimmt „Armour of Heroes" **einmal ueber Link A und einmal ueber Link B**. | **STL-R2 + STL-R3 + STL-R4:** Der Traeger hat **zwei** Exemplare desselben Gegenstands, also feuern `f25f23c2…` (parent, am Ziel), `0aa08f91…` (roster, am Ziel) und `76e2c1c8…` (parent, an der Gruppe „Magic Armour") — jede mit **Ist 2 / Grenze 1**. Das Punktebudget `7eaade17…` (50 von 50) feuert **nicht**. | [`03-both-links-same-parent-illegal.ros`](rosters/03-both-links-same-parent-illegal.ros) |
| 04 | Beide Tueren, **zwei** Traeger | Zwei Swains mit je einem Commander; der erste nimmt den Gegenstand ueber Link A, der zweite ueber Link B. | **STL-R5:** Die parent-skopierten `f25f23c2…` und `76e2c1c8…` feuern **nicht** (je Traeger bzw. je Gruppe 1) — der Unterscheider gegen Roster 03. Die armeeweite `0aa08f91…` (STL-R3) feuert mit **Ist 2 / Grenze 1**: sie zaehlt alle Vorkommen im Roster, auch verschachtelte. | [`04-both-links-two-parents.ros`](rosters/04-both-links-two-parents.ros) |

**Was 03 gegen 01/02/04 beweist.** 01 und 02 schliessen aus, dass eine der
Grenzen *immer* feuert; 04 schliesst aus, dass die parent-skopierten Grenzen in
Wahrheit armeeweit zaehlen. Uebrig bleibt genau die Aussage, um die es geht:
**zwei Links unter einem Elternteil werden als dasselbe Ding zusammengezaehlt.**

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Clan Lahmia (VC-AB)" (VC-`.cat`, Z. 29403) | `2102-34f1-c876-98c5` |
| „Swain" (Traeger des Soeldner-Helden, Z. 5210) | `b920-b398-dc26-7f4d` |
| Gruppe „Hero from another faction" (max 1 parent, Z. 5216/5218) | `09bf-a395-daf9-7e25` — constraint `2e71-b752-12d3-5100` |
| Gruppe „High Elves" (Z. 8776) | `6bb3-dd06-5788-b4f7` |
| „Commander [HIGH ELVES]" (Z. 8778) | `d8e205ee-ee8d-4c18-afc8-cce2dde3f4ff` |
| „Magic Items and Honours" (Z. 8802) | `86633839-75c9-46fd-9627-400229927ab5` — constraint `0918bd42-2d7e-4aa9-9baa-36e8d81eb8f1` |
| Gruppe „Magic and Honors" (Punktebudget 50, Z. 8807/8809) | `5025cb30-12fb-4436-a0d0-47a561597f25` — constraint `7eaade17-79eb-493c-85e7-867000e4beb7` |
| Gruppe „Magical Items" (max -1 = unbegrenzt, Z. 8812/8821) | `826f57f0-5ccf-4e49-9de5-4c90fb7e8f6a` — constraint `6e84dd18-4558-4e29-84ca-3dc079e924c8` |
| `entryLink` auf die Gruppe „Magic Armour" (Z. 8825) | `ff36ea9b-d813-44b3-89dd-2649593d9f79` |
| Gruppe „Magic Armour" (max 1 parent, Z. 23460/23462) | `847028b2-d9b5-4b6f-b862-8081a0408270` — constraint `76e2c1c8-8320-4bc2-a370-cc3e95c7fd2c` |
| **Link A** auf „Armour of Heroes" (Z. 23465) | `def42370-a8f8-499d-a06e-0e60c1cbda9d` |
| **Link B** auf „Armour of Heroes" (Z. 23467) | `8f3d6ee5-cce7-4d85-9ed9-973bfc06c800` |
| **Gemeinsames Ziel** „Armour of Heroes [HIGH ELVES]" (Z. 20048, 25 pts) | `d612998a-3131-45c6-94e0-4e016d5110e4` |
| … max 1 `scope=parent` (Z. 20050) | `f25f23c2-f5f1-4bd0-8c7a-0ce617302c7e` |
| … max 1 `scope=roster` (Z. 20051) | `0aa08f91-b271-402b-98aa-32c51f3beae7` |
| Kostenart „pts" | `ecfa-8486-4f6c-c249` |

## Abgleich mit dem Engine-Lauf: zwei Grenzen zurueck in der Erwartung (Issue 083)

Zwei Grenzen waren zwischenzeitlich **ganz aus der Erwartung genommen** (weder
`firing` noch `absent`), weil sie entgegen der Katalog-Ableitung nicht feuerten
und die Ursache offen war:

| Grenze | Deklariert an | Erwartet |
|---|---|---|
| `0aa08f91-b271-402b-98aa-32c51f3beae7` (max 1, `scope="roster"`) | Zieleintrag `d612998a`, Z. 20051 | Ist 2 / Grenze 1 |
| `76e2c1c8-8320-4bc2-a370-cc3e95c7fd2c` (max 1, `scope="parent"`) | Gruppe „Magic Armour" `847028b2`, Z. 23462 | Ist 2 / Grenze 1 |

Die Untersuchung (Issue 083) hat die Semantik entschieden, dokumentiert im
Formathandbuch ([§7.6](../../battlescribe-data-format.md), Regelbox): eine
Grenze zaehlt die Auswahlen **unterhalb ihres Traegers** im vom `scope`
benannten Rahmen — nie die Vorkommen der Traeger-Id selbst. Eine Grenze an
einer `selectionEntryGroup` zaehlt damit **ihre Mitglieder**, und
`shared="true"` mit `scope="roster"` zaehlt **alle** Vorkommen des Eintrags im
Roster, auch verschachtelte — `includeChildSelections="false"` heisst *„just
scope's field"*, nicht „nichts".

Das Manifest nimmt beide Ids deshalb wieder in die Erwartung auf:

- **Roster 03** (beide Tueren, ein Traeger): `0aa08f91` und `76e2c1c8` feuern
  **beide** mit Ist 2 gegen Grenze 1 — zusaetzlich zur schon immer feuernden
  `f25f23c2`.
- **Roster 04** (beide Tueren, zwei Traeger): `0aa08f91` feuert mit Ist 2 gegen
  Grenze 1 (armeeweit zwei Vorkommen); `76e2c1c8` steht unter `absent` (je
  Traeger nur ein Gruppen-Mitglied), wie `f25f23c2`.
- **Roster 01/02** (je ein Exemplar): beide Ids stehen unter `absent` — Ist 1
  gegen Grenze 1 ist legal (Randwert).

Die tragende Aussage des Szenarios ist davon unberührt: `f25f23c2` feuert in
Roster 03 mit Ist 2 gegen Grenze 1 und schweigt in 01, 02 und 04.
