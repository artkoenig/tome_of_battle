---
status: backlog
branch:
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

## Tasks

## Decisions

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
