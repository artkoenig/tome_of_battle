---
status: active
branch: claude/new-session-jnwa1m-0090
pr:
---

# `percentValue` an Condition und Repeat wird still ignoriert

## Intent

Das BSData-Wiki (*Data structure overview*, Abschnitte *Condition* und
*Repeat*) dokumentiert `percentValue` für beide: „if checked, `Value` will be
interpreted as percentage". Die vendored XSD führt das Attribut an der
gemeinsamen `QueryBase` — es gilt also für Constraint, Condition **und**
Repeat.

Der Leser liest es nur an Constraints (`readConstraint`,
`src/evaluator/catalogReader.js:259`); `readCondition` und `readRepeat`
übergehen das Attribut **ohne Diagnose**. Eine Prozent-Condition wird damit
als Absolutwert verglichen: `condition type="greaterThan" value="25"
percentValue="true" field="<pts>"` („mehr als 25 % der Punkte") feuert ab 26
Punkten, unabhängig von der Armeegröße. Das widerspricht dem engine-eigenen
Grundsatz „nichts wird still verschluckt" (`docs/evaluator-architecture.md`
§4).

In den Fixture-Katalogen kommt `percentValue="true"` an Conditions/Repeats
derzeit nicht vor (grep-verifiziert) — der Fehler ist latent, aber ein
importierter Community-Katalog kann ihn jederzeit auslösen.

Acceptance criteria:

1. Eine Condition mit `percentValue="true"` vergleicht gegen den Prozentsatz
   des im Rahmen gezählten Nenners (dieselbe Nenner-Konvention wie bei
   Prozent-Grenzen, inkl. Null-Nenner-Behandlung) statt gegen den
   Absolutwert.
2. Ein Repeat mit `percentValue="true"` leitet seine Schrittzahl entsprechend
   prozentual ab.
3. Solange die Auswertung Prozent an Condition/Repeat nicht trägt, entsteht
   stattdessen eine Diagnose — nie eine stille Absolut-Deutung. (Volle
   Unterstützung erfüllt dieses Kriterium trivial.)
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

Volle Unterstützung (AC 1+2), kein Diagnose-Fallback nötig — AC 3 ist damit
trivial erfüllt. Der Leser liest `percentValue` an Condition und Repeat
(wie an Constraints, `catalogReader.js`); die Auswertung spiegelt die
Grenzen-Konvention aus `constraints.js` (resolveBound): Nenner =
`query(ctx, field, scope, null, flags)` — gleiches Feld, gleicher Rahmen,
gleiche Flags, Ziel „alles im Rahmen" —, wirksamer Vergleichswert =
`roundHalfUp(nenner * wert / 100)` (Rundung zentral in `rounding.js`).
Repeat analog: wirksames `perValue` prozentual abgeleitet, Schrittlogik
unverändert. Der QueryContext an `conditionHolds`/`repeatCount` trägt alles
Nötige bereits.

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Codepfad verifiziert, Vorkommen in Fixtures per grep
  ausgeschlossen (latent).
- **Default — Null-Nenner an Condition/Repeat** („dieselbe
  Null-Nenner-Behandlung" aus AC 1, übersetzt): Bei Grenzen heißt Nenner 0
  „keine Aussage" (SUSPENDED + `zeroDenominator`-Diagnose, Annahme A4).
  Für ein Gate heißt keine Aussage: die Condition hält **nicht** (Modifier
  bleibt aus), ein Repeat liefert **0 Schritte** — jeweils mit
  `zeroDenominator`-Diagnose, nie still.
- **Default — `limit::`-Feld als Prozent-Nenner:** löst der Nenner auf
  `UNRESOLVED_BUDGET`, gilt fail-closed (Condition hält nicht, Repeat 0),
  gespiegelt an `constraints.js` (SUSPENDED-Pfad).
- **Keine Wirkung bei `instanceOf`/`notInstanceOf`** (Wiki explizit: „has
  no effect") — Wert wird dort ohnehin ignoriert; bleibt so.
- **Referenzlage:** Der alte Solver kann Prozent nur an Constraints —
  für Prozent-Conditions gibt es im Repo keine Verhaltensreferenz; Referenz
  sind Wiki-Text plus die eigene Grenzen-Konvention (Researcher §6).
- **Default — prozentual abgeleitete Schrittweite 0** (Frage des
  Test-Autors): ergibt die Ableitung `roundHalfUp(nenner * wert / 100)` an
  einem Repeat 0, liefert das Repeat 0 Schritte — gespiegelt am
  bestehenden Laufzeit-Guard `perValue === 0`. Keine neue Diagnose: ein
  degenerierter abgeleiteter Wert, kein verschlucktes Attribut. Gepinnt
  im Testfile.

## Log

- 2026-07-29 Researcher: Grenzen-Konvention vollständig kartiert
  (`constraints.js` resolveBound: Nenner über dieselbe Query, `roundHalfUp`,
  Null-Nenner → SUSPENDED + Diagnose; Unlimited-Kurzschluss VOR dem
  Nenner). XSD: `percentValue` an `QueryBase` (Catalogue.xsd:428) — gilt
  für Constraint, Condition, Repeat; Wiki-Zitate an allen dreien.
  Fixtures: `percentValue` kommt ausschließlich als `"false"` vor, 0 ×
  `"true"` — latent wie behauptet. (Korrigiert nach Review-Runde 1: die
  ursprünglich notierte Zahl 6.178 reproduzierte nicht — je nach
  Dateimenge 3.432–7.172 Vorkommen; der tragende Teil „0 × true" ist
  reviewer-verifiziert exakt.) `conditionHolds`/`repeatCount` (`modifiers.js`) erhalten
  denselben QueryContext wie resolveBound — Nenner ohne Plumbing
  verfügbar. Diagnose-Präzedenz für Nicht-Unterstützung existiert
  (`UNSUPPORTED_MODIFIER_GROUP_REPEAT`), wird aber nicht gebraucht.

- 2026-07-29 test-author: `src/evaluator/modifiers.percentCondition.test.js`,
  16 Tests — 9 ROT (Divergenz in beide Richtungen, Half-up-Kanten gegen
  floor UND ceil an Condition und Repeat, Null-Nenner hält nicht selbst
  bei lessThan + Diagnose, Repeat-Prozentschritte), 7 grüne
  Kontrollen/Pins (instanceOf/notInstanceOf ignorieren das Attribut,
  false/fehlend absolut, Null-Nenner-Kontrolle absolut ohne Diagnose,
  abgeleitete-0-Schrittweite → 0 Schritte ohne Diagnose). Belegt:
  Zielfile 9 failed / 7 passed Exit 1; Vitest gesamt 221 Dateien /
  2256 Tests (vor dem 16. Test), nur das neue File rot. Offen gelassen
  mit Absicht: `limit::`-Nenner (Default protokolliert, ungepinnt — für
  den PR); Prozent-Grenzen-Kontrolle übersprungen (constraints.test.js
  pinnt sie bereits).
- 2026-07-29 implementer: ohne Plan-Abweichung. Leser liest `isPercent`
  an ConditionDef/RepeatDef (`catalogReader.js`, LimitDef-Präzedenz);
  `modifiers.js` bekommt den geteilten Helfer `resolvePercentValue`
  (Nenner-Query wie resolveBound, `roundHalfUp` aus `rounding.js`,
  Nenner 0 → `zeroDenominator` `{ field, scope }` + keine Aussage,
  UNRESOLVED_BUDGET fail-closed still — query diagnostiziert selbst);
  `conditionHolds` leitet den Erwartungswert ab außer bei den wertfreien
  instanceOf-Arten, `repeatCount` leitet die Schrittweite VOR dem
  0-Guard ab (abgeleitete 0 → bestehender 0-Schritte-Pfad). Doku:
  Architektur (§4.6, Records), Datenformat §7.7, rounding.js-Kopf.
  Zeugen/Fixpunkt brauchten nichts: Wegwerf-Listen und
  Letzte-Runde-Konvention greifen von selbst. Belegt: Zielfile 16/16
  Exit 0; Vitest 221 Dateien / 2257 Tests Exit 0; Puppeteer-E2E Exit 0;
  lint/typecheck/depcruise Exit 0; knip Exit 1 vorbestehend,
  Befundmenge byte-identisch; measure-evaluator Exit 1 vorbestehend,
  Wiederverwendungs-Zeiten 4,0/7,0/10,9 ms ohne Ausreißer. Notiert als
  bewusste Nicht-Änderung: strukturelle Parallele
  resolveBound/resolvePercentValue (`PERCENT_DIVISOR` doppelt) —
  Refactoring läge außerhalb des Intents.
- 2026-07-29 review Runde 1 (frischer Kontext): **1 Befund**, nur
  Tracker-Protokoll (Researcher-Zahl 6.178 nicht reproduzierbar — oben
  korrigiert). Alle 4 Kriterien erfüllt; Rot-Beweis eigenständig
  reproduziert (9/7 auf `324f448`); alle Exit-Codes unabhängig erhoben;
  Byte-Identitäts-Sonde über alle Szenario-Roster: vollständiger Bericht
  auf main und HEAD **byte-identisch** (31.241.330 Bytes) — der
  Nicht-Prozent-Pfad zahlt nachweislich nichts. Zeugen-Wiederauswertung
  emittiert nicht in den echten Strom; Fixpunkt hält die
  Letzte-Runde-Konvention; fail-closed-Richtung Condition/Repeat
  konsistent. **Waiver:** Der Fix betrifft nur das Issue-Protokoll —
  keine Datei, um die es in den Kriterien geht; die Wiederholungsrunde
  entfällt nach der Regel im Rulebook, hiermit protokolliert.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — Prozent-Semantik an Condition und
  Repeat in der Konvention der Prozent-Grenzen (gleicher Nenner, gleiche
  Rundung, übersetzte Null-Nenner-Behandlung); AC 3 durch volle
  Unterstützung trivial.
- What surprised me? Kein Plumbing nötig: der QueryContext an den
  Auswertungsstellen ist derselbe wie bei resolveBound. Und der alte
  Solver ignoriert `percentValue` an Conditions ebenfalls — es gibt keine
  In-Repo-Verhaltensreferenz, nur Wiki plus eigene Grenzen-Konvention.
- What am I assuming without having verified it? Dass „keine Aussage" bei
  Nenner 0 für ein Gate „hält nicht" bedeutet (recorded Default — bei
  `lessThan`-artigen Typen ist das nicht offensichtlich konservativ);
  dass die Diagnose-Multiplizität über Fixpunkt-Runden und
  Zeugen-Wiederauswertung (0101, Wegwerf-Diagnosen) beherrschbar bleibt —
  der Test-Autor pinnt Präsenz, nicht Anzahl.

### Before the PR

- Does this match what was asked? Yes — volle Prozent-Semantik an
  Condition und Repeat in der Grenzen-Konvention, AC 3 trivial durch
  volle Unterstützung; Review-Runde 1 fand nur einen
  Tracker-Zahlenfehler.
- What surprised me? Die Byte-Identitäts-Sonde des Reviewers (31 MB
  Berichts-Dump über alle Szenarien, main vs. HEAD identisch) — ein
  stärkerer Nichts-kaputt-Beleg als jede Testliste. Und dass Zeugen- und
  Fixpunkt-Konventionen die neuen Diagnosen gratis richtig behandeln.
- What am I assuming without having verified it? Dass der ungepinnte
  `limit::`-Nenner-Default (fail-closed) so bleiben darf — im PR für den
  Menschen markiert; dass die Payload-Wahl `{ field, scope }` für
  `zeroDenominator` an Gates trägt (Conditions haben keine Id — bei
  Bedarf später anreicherbar). Kein Versions-Bump: Evaluator nicht
  UI-angebunden (Sitzungs-Präzedenz).

## Retro
