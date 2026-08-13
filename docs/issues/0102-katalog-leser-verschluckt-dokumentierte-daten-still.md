---
status: active
branch: claude/issue-102-3gcm6x
pr:
---

# Katalog-Leser verschluckt dokumentierte Daten still

## Intent

Sammel-Issue für die kleinen, gleichartigen Parser-Lücken aus dem
Engine-Audit (2026-07-28): der Leser übergeht dokumentierte Attribute,
Elemente und Fehlerfälle **ohne Diagnose** — gegen den eigenen Grundsatz
„nichts wird still verschluckt" (`docs/evaluator-architecture.md` §4). Eine
Änderung: der Leser liest, was die Doku benennt, oder diagnostiziert es.

Die Einzelfälle (alle am Code verifiziert, `src/evaluator/catalogReader.js`
bzw. `catalogSet.js`/`resolver.js`):

1. **`publications` / `publicationId` / `page`** werden komplett verworfen —
   die Info-Projektion kann keine Buchquelle nennen
   (`battlescribe-data-format.md` §5.2, §13.3).
2. **`defaultSelectionEntryId`** an Gruppen wird nicht gelesen — die in §7.1
   dokumentierten Vorbelegungs-Regeln sind aus dem aufbereiteten Datensatz
   nicht ableitbar.
3. **`import`** (§7.1) wird nicht gelesen.
4. **`collective`** wird nicht gelesen (das Attribut fehlt im Datenmodell);
   die Zähl-Mathematik ist laut §10 bewusst unabhängig davon (dokumentierter
   Cut). Die **Synchron-Regel** des Wikis ist eigenständig als Issue 0104
   geführt — hier geht es nur um das Lesen-oder-Diagnostizieren des
   Attributs.
5. **Info-Kinder von `categoryLink`s** (XSD: `ContainerEntryBase`) werden
   verworfen — eine Regel an einem Kategorie-Link erreicht die
   Info-Projektion nie.
6. **`readBoolean`** akzeptiert nur `"true"`/`"false"`; `xs:boolean` erlaubt
   auch `"1"`/`"0"` — `hidden="1"` gilt still als sichtbar.
7. **Kosten ohne lesbaren `value`** werden kommentarlos fallengelassen
   (`readCosts`).
8. **`costTypes` fehlen im Merge** (`catalogSet.js`), Modifier-Kosten-Ziele
   werden nur aus `<cost>`-Vorkommen aufgelöst — ein Modifier auf eine
   deklarierte, aber nirgends bepreiste Kostenart wird als
   `DANGLING_MODIFIER_TARGET` verworfen.
9. **Modifier-`scope`-Attribut** (1 reales Vorkommen in den Fixtures:
   `selectionEntry` „Mark of Slaanesh (Hero) [DARK ELVES]" in `Vampire
   Counts (…).cat:16888`, `scope="unit"` an einem Kategorie-Modifier) wird
   ignoriert — der Modifikator wirkt auf den Träger statt auf die Einheit.
   (Nebenbefund: die Ziel-Kategorie-Id `4990-1770-2328-effd` dieses
   Modifiers ist in keiner Fixture-Datei definiert — zusätzlich ein
   hängender Kategorie-Verweis.)

Acceptance criteria:

1. Für jeden der Punkte 1–9 gilt: der Leser liest den Wert und die Engine
   trägt ihn (mindestens bis in den aufbereiteten Datensatz bzw. Bericht),
   **oder** der Fall erzeugt eine Diagnose, **oder** der Verzicht ist als
   Entscheidung im Issue festgehalten und dort begründet — kein Fall bleibt
   still.
2. `hidden="1"` wirkt wie `hidden="true"` (Punkt 6 ist ein Lesefehler, kein
   Verzichts-Kandidat).
3. Eine Kostenangabe ohne lesbaren `value` erzeugt eine Diagnose (Punkt 7).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

Eine Änderung an einer Stelle: der Katalog-Leser (`src/evaluator/catalogReader.js`)
liest, was die Dokumentation benennt, oder meldet es als Diagnose. Was er liest,
aber bewusst nicht auswertet, trägt er trotzdem in den aufbereiteten Datensatz —
so bleibt der Verzicht ein benannter statt eines stillen Verlusts.

## Tasks

- [x] **P1 `publications` / `publicationId` / `page`.** Wurzel-`<publications>` als
  Datensatz-Angabe neben `costTypes`/`profileTypes` gelesen; `publicationId`/`page`
  an der gemeinsamen `EntryBase`, also an jedem Element. Weg bis in den Bericht:
  Leser → `mergeCatalogues` → Resolver → `buildReport` → Info-Projektion, wo jedes
  Profil und jede Regel eine `source` tragen (Buch-Id, Klartext-Name, Seite; `null`
  ohne Angabe). Den Klartext-Namen stellen allein die `<publication>`-Deklarationen.
- [x] **P2 `defaultSelectionEntryId`.** An der Gruppe gelesen (`null` ohne Angabe),
  nicht ausgewertet: Vorbelegen ist eine Regel des Bearbeitens, nicht des Prüfens.
- [x] **P4 `collective`.** An Eintrag, Gruppe und Verweis gelesen (`isCollective`,
  XSD-Vorgabe `false`), nicht ausgewertet — die Synchron-Regel bleibt Issue 0104.
- [x] **P6 `readBoolean` liest `1`/`0`.** Die eine Lesestelle deckt jetzt beide
  lexikalischen Formen von `xs:boolean` ab; `percentValue` und `primary` hatten
  daneben je einen eigenen `=== 'true'`-Vergleich und gehen jetzt durch dieselbe.
- [x] **P7 Kosten ohne lesbaren Wert.** Neue Diagnose `unreadableCost` mit Rohwert,
  Kostenart und Träger — auch für eine `<cost>` ohne `typeId`.
- [x] **P9 `modifier/@scope`.** Neue Diagnose `unsupportedModifierScope` mit Träger,
  Feld, Wert und Rahmen; der rohe Wert steht als `scope` am Modifikator im
  Datensatz. Der Modifikator wirkt weiterhin am Träger — sichtbar falsch statt
  still falsch.
- [x] Dokumentation nachgezogen: `docs/battlescribe-data-format.md` §5.2, §7.1,
  §7.7, §10, §13.3 und die Datensatz-Verträge in `docs/evaluator-architecture.md`.
- [x] Suite grün: `npx vitest run src/evaluator` → 97 Dateien, 1758 Tests, Exit 0
  (vor den neuen Tests). Die Änderung berührt nur `src/evaluator/`, deshalb genügt
  dieser Lauf (CLAUDE.md).

## Decisions

- **AC 2 and AC 3 win over the scope cut for P6 and P7, 2026-08-13.** The cut below
  lists P6 and P7 as "not to be worked", but AC 2 and AC 3 demand exactly them, and
  AC 2 says outright that P6 "is a read error, not a waiver candidate". The
  maintainer settled the contradiction: build P6 and P7 as well. Both are two-liners
  and carry no risk. **Worked: P1, P2, P4, P6, P7, P9.** Still waived, with the
  reason below: P3 (`import`), P5 (info children on a `categoryLink`), P8
  (declared-but-never-priced cost types) — no real catalogue reaches them.

- **Scope cut to the measured subset, 2026-08-12.** In scope: P1
  (`publications`/`publicationId`/`page`), P2 (`defaultSelectionEntryId`), P4
  (`collective`), P9 (`modifier/@scope`). Out of scope and not to be worked: P3,
  P5, P6, P7, P8 — zero occurrences across the 36 real catalogue files. The
  "read it or diagnose it" principle still applies to the four that stay.

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28). Als ein Issue geschnitten, weil alle Punkte dieselbe
  Änderung sind: Lesen-oder-Diagnostizieren im Katalog-Leser.
- **Punkt 6 verschärft (Review-Runde 2 von Issue 0099, 2026-07-28):** seit
  0099 hat die `readBoolean`-Lücke eine zweite Konsequenz — ein `entryLink`
  mit `hidden="0"` (explizit gesetztes false in xs:boolean-Kurzform) liest
  sich als „nicht gesetzt" und **erbt** damit das Basis-`hidden="true"`
  seines Ziels, statt es zu überschreiben. Repro in der Review von 0099
  dokumentiert (Fassade: `isHidden: true` statt false). Reale
  Kataloge/BattleScribe schreiben `true`/`false`; Exposition derzeit nil.

## Log

- 2026-08-13 (implementation) — **The issue's side-finding on P9 is wrong: the target
  category is not dangling.** The file claims the target id `4990-1770-2328-effd` of
  the `scope="unit"` category modifiers "is defined in no fixture file". It is:
  `Dark Elves (6th definitive edition).cat:10239` declares
  `<categoryEntry name="Slaanesh" id="4990-1770-2328-effd" hidden="false"/>`. The
  earlier probe evidently searched for `<categoryEntry id=`, and that catalogue
  writes `name` first. There is no second, hidden defect here — the only defect at
  those eight modifiers is the ignored `scope`. The claim has been dropped from the
  documentation rather than repeated.

- 2026-08-13 (implementation) — Counted on the 12 frozen fixture catalogues, not on
  the 36-document corpora (they are not in this repo): **8** `modifier/@scope`
  (7 `unit`, 1 `force`), **86** non-empty `defaultSelectionEntryId`, **5**
  `collective="true"`, **100** `<publication>` declarations — and **0** boolean
  attributes written `1`/`0`, across all eleven boolean attributes of the format.
  That last count confirms the 2026-08-12 sweep: P6 is real as a read error but has
  no exposure in real data.

- 2026-08-12 (real-data sweep) — **Reproduces, but only in four of the nine
  points; the other five have no data behind them.** Counted over both
  complete upstream corpora —
  `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition` (19 files) and
  `artkoenig/Warhammer-Fantasy-6th-edition` (17 files), 36 catalogue documents
  in total, cloned at their current heads:
  - **P1 publications / `publicationId` / `page` — 150 publication declarations,
    4,626 elements carrying `publicationId`, 4,237 carrying `page`.** By far the
  largest of the nine, and the one a user would notice: no book source can ever
  be shown.
  - **P2 `defaultSelectionEntryId` — 172 non-empty occurrences.** Real.
  - **P4 `collective="true"` — 9 occurrences.** Real, small.
  - **P9 `modifier/@scope` — 8 occurrences** (7 `unit`, 1 `force`). Real, small.
  - P3 `import="false"` — **0**. P5 `categoryLink` carrying rules/profiles/
    infoLinks — **0**. P6 boolean attributes written `1`/`0` — **0** (every
    boolean in both corpora is spelled `true`/`false`). P7 `<cost>` with an
    unreadable `value` — **0**. P8 declared-but-never-priced cost types — **0 of
    4**. None of these five can be reached from real catalogue data.
  This corrects the earlier reading of this file: P6 and P7 were the two points
  that looked like they hurt most (a hidden entry shown as visible, a unit priced
  too low), and neither occurs in any real catalogue.

- 2026-08-12 (re-check, independent probe) — **Eight of the nine points verified
  directly; none is silent-free.** Points 1-5 and 8 at the reader, 6, 7 and 9
  through the facade.
  1.-4. `publications`, `publicationId`, `page`, `defaultSelectionEntryId`,
     `import` and `collective` appear nowhere in `catalogReader.js` (zero hits
     each), so they are neither read nor diagnosed.
  5. `categoryLink` children are read for `targetId` and `primary` only
     (`catalogReader.js:363-384`); no `readInfos`, no constraints/modifiers —
     info children are discarded without a diagnostic. (The facade control for
     this point was inconclusive: a `<rule>` at the `categoryEntry` reaches no
     unit slot either, so the reader evidence is what carries the point.)
  6. `hidden="1"` -> `isHidden: false`, `hidden="true"` -> `true`
     (`readBoolean`, `catalogReader.js:274-279`).
  7. `<cost value="abc"/>` is dropped, `costTotals` reads 0 and
     `report.diagnostics` is empty.
  8. `catalogSet.js` mentions `costType`/`costTypes` **not once** — declared
     cost types are absent from the merge.
  9. `modifier type="add" field="category" scope="unit"` at an upgrade puts the
     category on the carrier (`mark: ["cat-extra"]`), not on the unit
     (`unit: ["cat-base"]`); no diagnostic.

- 2026-08-12 — Reproduced on the current tree: **all nine points still hold.**
  One synthetic catalogue per point through the facade; points 1-4 measured
  against the prepared dataset, 5-9 against the report.
  1. `<publications>`, `publicationId` and `page` appear nowhere in the prepared
     dataset, no diagnostic.
  2. `defaultSelectionEntryId` on a group appears nowhere.
  3. `import` appears nowhere.
  4. `collective` appears nowhere.
  5. A `<rule>` at a `categoryLink` reaches no capability. Control in the same
     run: the same rule at the `forceEntry` and at the `categoryEntry` does
     reach the report, so the probe measures the gap and not an absent
     projection.
  6. `hidden="1"` yields `isHidden: false`, `hidden="true"` yields `true`
     (`readBoolean`, `src/evaluator/catalogReader.js:274-279`).
  7. `<cost value="abc"/>` is dropped and `report.diagnostics` stays empty.
  8. A modifier on a declared but nowhere-priced `costType` is discarded with
     `{"kind":"unsupportedModifierTarget","field":"unpriced"}` — so it is not
     silent, but the declared cost type is still not a resolvable target.
  9. `modifier type="add" field="category" scope="unit"` at an upgrade lands the
     category on the **carrier** (`mark: ["cat-extra"]`) and not on the unit
     (`unit: []`) — the `scope` attribute is ignored.

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Punkt 9 korrigiert — das eine reale `scope`-Vorkommen hängt am
  `selectionEntry` „Mark of Slaanesh (Hero) [DARK ELVES]" (`Vampire Counts
  (…).cat:16888`), nicht an „Aura of Slaanesh" (dieser Name kommt in keiner
  Fixture-Datei vor). Nebenbefund ergänzt: dessen Ziel-Kategorie-Id ist in
  den Fixtures nirgends definiert (hängender Verweis).

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
