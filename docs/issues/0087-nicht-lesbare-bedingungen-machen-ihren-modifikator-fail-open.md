---
status: active
branch: claude/87-umsetzen-eodz2h
pr:
---

# Nicht lesbare Bedingungen machen ihren Modifikator fail-open

## Intent

Eine `<condition>`, `<conditionGroup>` oder `<repeat>`, die der Leser nicht
deuten kann, wird mit Diagnose verworfen (`readCondition`,
`src/evaluator/catalogReader.js:317`; analog Repeats und Gruppen) und aus der
Wächterliste des Modifikators **herausgefiltert**. Der Modifikator feuert dann
mit den verbliebenen — im Grenzfall: gar keinen — Wächtern, also **öfter** als
im Katalog kodiert. Das ist die Umkehrung der engine-eigenen
Fail-closed-Konvention (vgl. `UNRESOLVED_BUDGET`: „die Regel feuert nicht",
`src/evaluator/model.js`).

Der Fall ist nicht nur theoretisch: laut vendored XSD ist `field` an einer
Condition **optional**, und bei `instanceOf`/`notInstanceOf` sind `field` und
`value` laut Wiki bedeutungslos („Has no effect where Type is instance
of|not instance of"). Eine schema-konforme Condition ohne `field` fällt heute
durch die Lesbarkeits-Prüfung (`field === undefined || Number.isNaN(value)`);
eine Condition ohne `value` verletzt zwar die XSD (`value` ist dort
`use="required"`, `Catalogue.xsd:427`), ist bei `instanceOf`/`notInstanceOf`
laut Wiki aber ebenso bedeutungslos und fällt heute genauso durch.

Repro (Audit 2026-07-28, gegen die echte Fassade): Condition
`type="greaterThan" childId="…"` ohne `value`-Attribut → Condition verworfen
(Diagnose `unsupportedCondition`), das Kosten-Increment feuert unbedingt →
Verstoß, den es nicht geben dürfte. Gleiches Muster: ein Repeat mit
unlesbarem `value` → Modifikator wird einmal unbedingt angewendet statt
je N.

Verwandt, aber gesondert zu entscheiden: eine nicht lesbare **Constraint**
verschwindet ebenfalls still aus der Auswertung (Grenze weg = alles erlaubt).
Fail-closed hieße dort „Grenze suspendieren und ausweisen" — ob das gewünscht
ist, klärt dieser Lauf als Entscheidung.

Acceptance criteria:

1. Ein Modifikator, von dessen Wächtern (Conditions, Condition-Gruppen,
   Repeats) mindestens einer nicht lesbar ist, feuert nicht (fail-closed);
   die Diagnose bleibt erhalten.
2. Eine `instanceOf`-/`notInstanceOf`-Condition ohne `field`- und/oder
   `value`-Attribut wird ausgewertet statt verworfen.
3. Das Repro aus dem Intent erzeugt keinen Verstoß mehr, und die Diagnose
   benennt den betroffenen Modifikator-Träger.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.
- 2026-07-29 — **Nicht lesbare Constraints bleiben unverändert** (verworfen
  mit `unsupportedConstraint`-Diagnose, die Grenze entfällt). Quelle: Default
  (Mensch abwesend), gestützt auf die Catalogue Guidelines
  (bsdata-Doku §11.1, „Erlauben schlägt Verbieten"): eine entfallene Grenze
  *erlaubt* nur; ein fail-open Modifikator erzeugt dagegen *falsche
  Verstöße*. Fail-closed für Constraints („Grenze suspendieren und
  ausweisen") bliebe eine eigene, gesondert zu beauftragende Änderung.
- 2026-07-29 — **`instanceOf`/`notInstanceOf` ohne `field`** wird wie
  `field="selections"` gewertet; ohne `value` entfällt jede Wert-Prüfung.
  Quelle: bsdata-Doku §7.7 (Wiki: `field`/`value` „has no effect" bei diesen
  Typen — die Instanz-Prüfung selbst ist die Zählung) + Default.
- 2026-07-29 — **Diagnose-Vertrag für Kriterium 3:** Die Diagnosen für
  nicht lesbare Wächter (`unsupportedCondition`, `unsupportedConditionGroup`,
  `unsupportedRepeat`) tragen zusätzlich den Träger des Modifikators als
  `carrierId`/`carrierName` (Id/Name des Elements, an dem der Modifikator
  hängt). Quelle: Default — das Detail-Objekt der Diagnosen ist formfrei
  (`diagnostic()` friert `{kind, ...detail}` ein), die Erweiterung ist
  abwärtskompatibel.

## Log

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Intent präzisiert. Die frühere Formulierung nannte eine Condition ohne
  `field` **und/oder** `value` pauschal „schema-konform"; laut vendored XSD
  ist nur `field` optional, `value` ist `use="required"`. Die Wiki-Semantik
  (bedeutungslos bei `instanceOf`/`notInstanceOf`) gilt für beide Fälle,
  an den Akzeptanzkriterien ändert sich nichts.
- 2026-07-29 — Run gestartet (Branch `claude/87-umsetzen-eodz2h`).
  Researcher-Briefing: Unlesbarkeits-Prädikate in `readCondition`
  (`catalogReader.js:351–373`), `readConditionGroup` (392–403), `readRepeat`
  (433–458); Fail-open-Filter in `readConditions`/`readConditionGroups`/
  `readRepeats` (379–383/409–413/461–465). Feuer-Entscheidung ausschließlich
  in `applyModifier` (`modifiers.js:576–592`) und `applyModifierGroup`
  (615–624); etabliertes Fail-closed-Muster `UNRESOLVED_BUDGET`
  (`model.js:86`). `instanceOf`-Komparatoren ignorieren `value`
  (`modifiers.js:110–111`, `VALUE_FREE_CONDITION_KINDS` 134–137). XSD:
  `field` optional, `value` required (`Catalogue.xsd:425/427`). Keine
  Diagnose trägt bisher den Träger; kein Test prüft `unsupportedCondition`.
- 2026-07-29 — Test-Author (allein aus dem Intent):
  `src/evaluator/modifiers.unreadableGuards.test.js`, 17 Tests — Repro,
  unlesbarer Wächter neben erfülltem lesbaren, unlesbare Condition in
  `or`-Gruppe, `nand`-Gruppe, unlesbares Repeat („kein einziges Mal"),
  `instanceOf`/`notInstanceOf` ohne `field`/`value` (je feuert/feuert
  nicht), Träger-Benennung an allen drei Diagnosen, zwei Positivkontrollen
  gegen Über-Blocken. Beleg: `npx vitest run
  src/evaluator/modifiers.unreadableGuards.test.js` → 15 failed / 2 passed,
  alle 15 an Assertions (Phantom-Verstoß, fehlende Carrier-Felder,
  fälschliches `unsupportedCondition`), keine Import-Fehler.
- 2026-07-29 — Implementer (Commit 92a2611): `catalogReader.js` — neue
  `readGuards`-Hilfe führt pro Modifikator eine `guardHealth` durch alle
  drei Leser (rekursiv durch verschachtelte Gruppen); `readModifier`/
  `readModifierGroup` markieren `hasUnreadableGuard`; `readCondition`
  toleriert fehlendes `field` (→ `selections`) und fehlendes `value`
  (→ `null`) nur bei `instanceOf`/`notInstanceOf`; die drei
  Wächter-Diagnosen tragen `carrierId`/`carrierName` (aus der einen
  `readEntryBase`-Lesestelle, deckt alle Trägerarten). `modifiers.js` —
  beide Feuer-Gates (`applyModifier`, `applyModifierGroup`) brechen bei
  `hasUnreadableGuard` früh ab; `conditionHolds` nimmt die wertfreien
  Mitgliedschafts-Typen vom `expected === null`-Guard aus.
  Belege: `npx vitest run src/evaluator/modifiers.unreadableGuards.test.js`
  17/17, Exit 0. `npx vitest run src/evaluator` 63 Dateien / 790 Tests:
  789 grün, 1 rot, Exit 1 — der eine Rote ist der **vorbestehende**,
  als Issue 0112 getrackte `countIndex.costSumUnderCarrier.test.js`
  (fällt identisch auf `origin/main` a3a0eb2, im sauberen Worktree
  verifiziert; von dieser Änderung unberührt). `npm run lint` Exit 0,
  `npm run typecheck` Exit 0, `npm run depcruise` 0 Errors, Exit 0.
  Kein E2E-Szenario änderte sein Verhalten.
- 2026-07-29 — Review Runde 1 (frischer Kontext, Diff a3a0eb2..HEAD gegen
  Intent): **0 Findings mit Repro**. Alle vier Kriterien bestätigt; Fakten
  vom Reviewer selbst erhoben (`npx vitest run src/evaluator` 789/790 grün,
  Exit 1 nur durch den vorbestehenden 0112-Roten — vom Reviewer am
  Basis-Commit a3a0eb2 selbst reproduziert; neue Testdatei 17/17 Exit 0;
  Lint/Typecheck/Depcruise Exit 0). Test-Unabhängigkeit per `git log
  --follow` belegt (Testdatei nur im Test-Author-Commit 95e1f97 berührt).
  Zwei Beobachtungen außerhalb der Kriterien, keine Defekte dieses Diffs,
  als Issues gefiled: `conditionGroup type="not"` im Vampire-Counts-Fixture
  jetzt fail-closed gesperrt (→ Issue 0115), `modifierGroup` mit direktem
  `<repeats>` weiterhin fail-open (→ Issue 0116). Triage: nichts zu fixen;
  Wiederholungsrunde entfällt, da keine Findings (Konvergenz 0).

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. Kriterien 1–3 decken genau den
  Audit-Fund: Wächter-Lesbarkeit gate-t den Modifikator (fail-closed),
  `instanceOf`/`notInstanceOf` ohne `field`/`value` wird ausgewertet, das
  Repro verliert seinen falschen Verstoß und die Diagnose benennt den
  Träger. Die Constraint-Frage aus dem Intent ist als Entscheidung
  festgehalten (bleibt unverändert), nicht Teil der Kriterien.
- **What surprised me?** (a) Kein bestehender Test prüft
  `unsupportedCondition` — die Lücke war unbeobachtet. (b) Fail-open ist
  richtungsabhängig: in einer `or`-Gruppe *verschärft* eine verworfene
  Condition statt zu lockern — „fail-open" heißt genauer „anders als
  kodiert". (c) Auf Auswertungsebene ist ein unbekannter Komparator
  (`unsupportedComparator`) bereits fail-closed — das Loch liegt allein im
  Leser-Filter. (d) Eine `<conditionGroup>` mit nicht lesbarem Typ und ein
  Modifier-Group-Wächter hängen am selben Filter.
- **What am I assuming without having verified it?** (1) Dass kein realer
  Katalog im Fixture-/E2E-Bestand auf das heutige Fail-open-Verhalten
  angewiesen ist — die Suite und die manifest-getriebenen E2E-Läufe prüfen
  das. (2) Dass `field="selections"` als Default für `instanceOf` ohne
  `field` keine Prozent-/Nenner-Pfade berührt (bei diesen Typen wird kein
  Prozentwert abgeleitet). (3) Dass die Träger-Benennung in den
  Leser-Diagnosen für alle Trägerarten (Entry, Link, Gruppe, CategoryLink,
  ForceEntry) verfügbar ist.

### Before the PR

- **Does this match what was asked?** Ja. Kriterien 1–3 im Review aus
  frischem Kontext bestätigt; Kriterium 4 mit dem dokumentierten Vorbehalt:
  789/790 grün, der eine Rote ist der vorbestehende, als Issue 0112
  getrackte `countIndex.costSumUnderCarrier.test.js` (am Basis-Commit
  identisch rot, von dieser Änderung unberührt). Kein neuer Roter.
- **What surprised me?** (a) Die Änderung verändert reales
  Katalog-Verhalten, das kein E2E-Szenario beobachtet: die zwei
  `conditionGroup type="not"` im Vampire-Counts-Fixture sind unlesbar,
  der Lichemaster-Pflicht-Modifikator feuert jetzt nie (nur erlaubend,
  → Issue 0115). (b) Der Nachbar-Fall `modifierGroup` mit direktem
  `<repeats>` bleibt fail-open (→ Issue 0116).
- **What am I assuming without having verified it?** (1) Dass das
  Unterdrücken der Lichemaster-Pflicht (erlaubend) bis zur Entscheidung
  in 0115 akzeptabel ist — die Alternative wäre das alte, verstoß-
  erzeugende Fail-open gewesen. (2) Dass der Patch-Bump als Default die
  richtige Versionierung ist (Fix, kein Feature); der Mensch kann vor dem
  Merge eine andere Version wählen.

## Retro
