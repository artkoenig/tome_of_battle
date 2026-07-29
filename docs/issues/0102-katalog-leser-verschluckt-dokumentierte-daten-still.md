---
status: active
branch: claude/102-umsetzen-3sr4df
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

Module und Verträge (2026-07-29):

- **`src/evaluator/catalogReader.js`** — trägt die neuen Lesungen:
  - `readBoolean` akzeptiert die xs:boolean-Kurzformen `"1"`/`"0"` (Punkt 6);
    dieselbe Deutung gilt für die drei direkten
    `percentValue === 'true'`-Vergleiche (Constraint/Condition/Repeat) — eine
    gemeinsame Deutungsstelle, kein zweiter Boolean-Leser.
  - `readEntryBase` liest zusätzlich `publicationId` und `page` (XSD:
    `PublicationRefAttGroup` an `EntryBase`, Catalogue.xsd:43-46, 111) —
    `null`, wenn nicht gesetzt (Punkt 1).
  - Die Wurzel liest `<publications>` als Liste `{ id, name }` in ein neues
    Feld `publications` des Dokuments (Punkt 1).
  - `readEntry`/`readGroup`/`readEntryLink` lesen `collective` und `import`
    (XSD `SelectionEntryBase`, Default je `false`, Catalogue.xsd:283-284)
    als `isCollective`/`isImport` (Punkte 3, 4).
  - `readGroup` liest `defaultSelectionEntryId` (`null`, wenn nicht gesetzt;
    Punkt 2).
  - `readCategoryLink` liest `infos: readInfos(...)` (XSD: `categoryLink`
    erbt von `ContainerEntryBase`; Punkt 5).
  - `readCosts` bekommt den `diagnostics`-Kanal: ein `<cost>` ohne lesbaren
    `value` (oder ohne `typeId`) erzeugt die neue Diagnose
    `UNREADABLE_COST` mit `{ costTypeId, value }` statt still zu entfallen
    (Punkt 7).
  - `readModifier` meldet ein gesetztes `scope`-Attribut als Diagnose
    `UNSUPPORTED_MODIFIER_SCOPE` (Punkt 9, siehe Decisions).
- **`src/evaluator/model.js`** — die zwei neuen `DiagnosticKind`-Werte.
- **`src/evaluator/catalogSet.js`** — `costTypes` und `publications` wandern
  in `MERGED_COLLECTIONS`, damit das Aggregat sie führt (Punkte 8, 1).
- **`src/evaluator/resolver.js`** — `buildTargetSymbolTable` bekommt
  zusätzlich die deklarierten `costTypes` des Aggregats und registriert jede
  Kostenart-Id als COST-Ziel: ein Modifier auf eine deklarierte, aber
  nirgends bepreiste Kostenart ist kein `DANGLING_MODIFIER_TARGET` mehr
  (Punkt 8).
- **`src/evaluator/infoProjection.js`** (+ Aufrufer in `report.js`) — die
  Projektion bekommt neben den Profiltypen die `publications` des Aggregats;
  Profil- und Regel-Einträge tragen `publication: { id, name|null, page|null }
  | null` aus `publicationId`/`page` des Inhalts (Punkt 1, „die
  Info-Projektion kann eine Buchquelle nennen").

Nicht-offensichtliche Wahl: Punkt 9 wird diagnostiziert statt gelesen —
Begründung in den Decisions.

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
- **Auflösung je Punkt (2026-07-29, Defaults — Mensch abwesend, keiner der
  Punkte ändert einen öffentlichen Vertrag über die Issue-Intent hinaus):**
  Punkte 1–5 werden **gelesen und getragen** (1 bis in die Info-Projektion,
  2–5 bis in den aufbereiteten Datensatz), Punkt 6 ist der Lesefehler-Fix,
  Punkte 7 und 9 werden **diagnostiziert**, Punkt 8 wird durch Merge +
  Symboltabellen-Registrierung **gelesen**.
- **Punkt 9 = Diagnose, keine Semantik (Default):** Ein `<modifier>` trägt
  laut vendored XSD gar kein `scope`-Attribut (nur `QueryBase` hat eines,
  Catalogue.xsd:426); es gibt genau 1 reales Vorkommen in den Fixtures, und
  dessen Ziel-Kategorie-Id ist obendrein nirgends definiert — der Modifikator
  wäre auch mit Semantik wirkungslos. „Wirkt auf die Einheit statt den
  Träger" umzusetzen wäre ein eigener Semantik-Ausbau ohne belegten Nutzen.
  Ein gesetztes `scope` wird deshalb als `UNSUPPORTED_MODIFIER_SCOPE`
  sichtbar gemeldet, nicht gedeutet. Der Nebenbefund (hängende Kategorie-Id)
  ist durch die bestehende `DANGLING_MODIFIER_TARGET`/`DANGLING_CATEGORY_LINK`-
  Mechanik abgedeckt und braucht hier nichts Eigenes.
- **Punkt 7 erweitert um fehlendes `typeId` (Default):** `readCosts` ließ
  auch ein `<cost>` ohne `typeId` still fallen — derselbe Fehlerpfad, dieselbe
  Diagnose `UNREADABLE_COST`.
- **XSD-Defaults für `import`/`collective`:** beide `false` (vendored
  Catalogue.xsd:283-284) — die Doku-Tabelle §7.1 beschreibt nur die Bedeutung,
  reale Kataloge schreiben die Attribute ohnehin explizit.

## Log

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Punkt 9 korrigiert — das eine reale `scope`-Vorkommen hängt am
  `selectionEntry` „Mark of Slaanesh (Hero) [DARK ELVES]" (`Vampire Counts
  (…).cat:16888`), nicht an „Aura of Slaanesh" (dieser Name kommt in keiner
  Fixture-Datei vor). Nebenbefund ergänzt: dessen Ziel-Kategorie-Id ist in
  den Fixtures nirgends definiert (hängender Verweis).

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja — jeder der 9 Punkte bekommt genau
  eine der drei erlaubten Auflösungen (lesen/diagnostizieren/begründeter
  Verzicht ist nicht nötig, kein Punkt bleibt still), Kriterien 2 und 3 sind
  direkt geplant, Kriterium 4 läuft über die Suite.
- **What surprised me?** (a) Das eine reale Modifier-`scope`-Vorkommen zielt
  auf eine nirgends definierte Kategorie — der Modifikator ist ohnehin inert.
  (b) Punkt 6 ist breiter als `readBoolean`: `percentValue` wird an drei
  Stellen per striktem `=== 'true'` gelesen, `percentValue="1"` fiele dort
  ebenso still auf false. (c) Die vendored XSD setzt den `import`-Default auf
  `false`, obwohl reale Kataloge fast durchgängig `import="true"` schreiben.
- **What am I assuming without having verified it?** (a) Dass kein
  bestehender Test darauf baut, dass `hidden="1"` als sichtbar gilt oder dass
  unlesbare Kosten diagnosefrei entfallen — die Suite wird es zeigen. (b) Dass
  die Info-Projektion die `publications` des Aggregats über den bestehenden
  Registry-Mechanismus erreichen kann, ohne den Berichts-Vertrag zu brechen
  (neue Felder sind additiv). (c) Dass die Kostenart-Registrierung in der
  Symboltabelle keine `MODIFIER_TARGET_COLLISION` in den Fixtures auslöst.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
