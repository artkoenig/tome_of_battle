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
   „Aura of Slaanesh", `scope="unit"` an einem Kategorie-Modifier) wird
   ignoriert — der Modifikator wirkt auf den Träger statt auf die Einheit.

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
