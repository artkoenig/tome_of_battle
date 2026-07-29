---
status: done
branch: claude/offene-issues-cy79fe
pr: https://github.com/artkoenig/tome_of_battle/pull/174
---

# Min-Grenzen versteckter Entitäten werden validiert

## Intent

`docs/battlescribe-data-format.md` §5.6: „Ein `forceEntry` bzw. `categoryLink`
mit `hidden="true"` (oder dynamisch per Modifier `field="hidden"` …) darf dem
Nutzer **nicht** als Option angeboten und dessen Mindestgrenzen dürfen
**nicht** validiert werden."

Die Engine konsultiert die effektive Sichtbarkeit bei der Constraint-Auswertung
nirgends: `evaluateConstraints` (`src/evaluator/constraints.js:118`) wertet
`limitsOf(node.def)` an jedem Knoten aus, `report.js` filtert nur nach
`isReportable`/`satisfied`; `isHidden` ist ein reines Capability-Flag. Eine
versteckte Entität mit `min ≥ 1` erzeugt so einen blockierenden Verstoß, den
der Nutzer nie beheben kann — das dynamische `hidden` ist aber genau der
WHFB6-Mechanismus für Armee-Varianten (Bloodlines etc.).

Einordnung der Quelle: §5.6 formuliert das Validierungsverbot wörtlich nur
für `forceEntry` und `categoryLink`; über Min-Grenzen versteckter
`selectionEntries`/Gruppen schweigen Doku und Wiki. Die Ausdehnung auf alle
Ankerarten (AC 2) folgt derselben Ratio — ein unbehebbarer Verstoß — und ist
eine Entscheidung dieses Laufs, kein Doku-Fakt; bei Umsetzung ist §5.6/§8
der Doku entsprechend nachzuziehen.

Repros (Audit 2026-07-28, gegen die echte Fassade): `selectionEntry
hidden="true"` mit `min=1 scope="roster"`, leeres Roster → Verstoß; Force mit
`categoryLink hidden="true"` + `min=2 scope="force"`, leere Force → Verstoß am
Kategorie-Anker.

Die Gegenrichtung aus dem Wiki (*Data structure overview*, „Props: Hidden":
bereits gewählte, effektiv versteckte Auswahlen erzeugen einen Fehler in der
Fehlerliste) fehlt ebenfalls; ob sie in diesen Lauf gehört, ist eine
Entscheidung des Laufs.

Acceptance criteria:

1. Eine Entität, deren **effektive** Sichtbarkeit versteckt ist (Basis-Attribut
   oder `hidden`-Modifier), erzeugt aus ihren Min-Grenzen keinen Verstoß.
2. Das gilt für alle Ankerarten, an denen Min-Grenzen hängen: Pflicht-Phantom,
   Kategorie-Anker (verdeckter `categoryLink`), Gruppen-Anker, belegter Knoten
   und `forceEntry`.
3. Wird die Entität durch einen Modifier wieder sichtbar, feuert ihre
   Min-Grenze wieder (beide Repros aus dem Intent kippen nachweisbar mit der
   Sichtbarkeit).
4. Max-Grenzen bleiben von der Sichtbarkeit unberührt (keine stillen
   Lockerungen als Nebenwirkung).
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführten Repros gegen die echte Fassade.
- **Gegenrichtung nicht in diesem Lauf** (Default, 2026-07-29): Die
  Wiki-Regel „bereits gewählte, effektiv versteckte Auswahlen erzeugen einen
  Fehler" ist ein eigenes Feature mit eigener Semantik; sie wird als eigenes
  Issue gefiled und wartet auf ihren eigenen Lauf.
- **Doku wird im selben Lauf nachgezogen** (aus dem Intent, 2026-07-29): Die
  Verallgemeinerung von §5.6 auf alle Ankerarten mit Min-Grenzen wird in
  `docs/battlescribe-data-format.md` (§5.6/§8) als Projektentscheidung
  dokumentiert, mit Verweis auf dieses Issue.
- **Mechanismus: `isReportable`, nicht Unterdrückung** (2026-07-29, aus dem
  Researcher-Briefing): Der Filter sitzt in `evaluateLimit`
  (`src/evaluator/constraints.js`) als Zusatz zum bestehenden
  `isReportable`-Feld — `limit.kind === MIN && effective.isHidden(node)` ⇒
  nicht meldbar. Die Grenze wird weiter voll ausgewertet (Capabilities wie
  `effectiveMin`/`isMandatoryUnmet` bleiben vollständig), analog zum
  Angebots-Anker-Präzedenzfall (ADR 0035). `report.js` filtert bereits über
  `isReportable`. Kein Reihenfolge-Problem: `evaluateConstraints` läuft nach
  Fixpunktschleife und Anker-Nachlauf, `effective.isHidden` ist dort final.
- **Sichtbarkeits-Begriff: eigenes effektives hidden** (Default, 2026-07-29):
  Gefiltert wird über `effective.isHidden(node)` des Grenzen-Trägers — Basis-
  Attribut inkl. Link→Ziel-Vererbung (Issue 0099) plus `hidden`-Modifier.
  Eine Fortpflanzung über versteckte **Vorfahren** (sichtbarer Träger unter
  verstecktem Elternknoten) ist nicht Teil dieses Laufs; dieselbe Ratio
  (unbehebbarer Verstoß) spräche dafür — als mögliches Folge-Issue notiert.
- **Kein Versions-Bump** (Antwort des Menschen, 2026-07-29): Die Version
  bleibt 1.9.1; der PR geht ohne Versionsänderung raus.

## Log

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Intent ergänzt um die Einordnung, dass §5.6 nur `forceEntry`/`categoryLink`
  deckt und die Verallgemeinerung auf alle Ankerarten eine Projektentscheidung
  ist, die im Lauf zu protokollieren und in die Doku zu heben ist.
- 2026-07-29 — Researcher-Briefing eingeholt: Sichtbarkeit liefert
  `EffectiveState#isHidden` (`effectiveState.js:187`), Constraint-Auswertung
  läuft nach Fixpunkt + Anker-Nachlauf (`evaluator.js:162-168`) — kein
  Reihenfolge-Problem; Meldbarkeits-Pfad `isReportable` existiert bereits
  (Angebots-Anker). Folge-Issue 0115 (Gegenrichtung) gefiled.
- 2026-07-29 — Test-Author: `src/evaluator/constraints.hiddenMin.test.js`,
  18 Tests (`npx vitest run src/evaluator/constraints.hiddenMin.test.js`,
  Exit 1: 8 failed, 10 passed). Die 8 roten pinnen die neue Semantik je
  Ankerart + Rand (min+max verletzt, versteckt ⇒ nur Max); die 10 grünen
  sind Kipp-Nachweise und Max-Pins. Alle roten scheitern an der
  Verstoß-Assertion bei leeren `diagnostics` — Fixtures gesund. Offen
  gelassen vom Test-Author (bewusst): kein expliziter Min-Filter-Test für
  Link→Ziel-hidden-Vererbung (bereits gepinnt in
  `effectiveState.baseHiddenInheritance.test.js`), keine Capability-Pins
  (würde Mechanik spiegeln).
- 2026-07-29 — Implementer (Commit 7a702b1): Filter in `evaluateLimit`
  (`constraints.js`) am `isReportable`-Feld, exakt nach Design-Entscheidung,
  keine Abweichung. Doku §5.6/§8 nachgezogen. Vier Bestandsstellen pinnten
  die alte Semantik an effektiv versteckten Trägern und wurden angepasst
  (einzeln begründet): `fixpoint.test.js` (Anker-Selbstzählung jetzt über
  Capability belegt), `docs/testing/offer-and-category-slots` (2 firing→
  absent, Capability-Pins unverändert grün), `docs/testing/
  violation-classification` Roster 07 (firing→absent; Korrektur aus dem
  Review: bei offer-and-category-slots betrifft das die zwei Grenz-Ids in
  allen drei Rostern des Szenarios, also sechs Erwartungszeilen). Fakten:
  `constraints.hiddenMin.test.js` 18/18 Exit 0; `npx vitest run
  src/evaluator` 791 Tests, 790 grün, 1 rot = vorbestehend auf main
  (`countIndex.costSumUnderCarrier.test.js`, per Checkout des Merge-Base
  und stash verifiziert — bereits gefiled als Issue 0112); `npm run lint`
  Exit 0; `npm run typecheck` Exit 0. Nebenbefund im README von
  violation-classification vermerkt: VCC-R10 verliert den scopeKind-Beleg,
  Ersatz-Szenario wäre Aufgabe des e2e-testcase-author.
- 2026-07-29 — Review Runde 1 (frischer Kontext): 1 Befund, geringfügig,
  außerhalb der Kriterien — der Beweiskraft-Verlust an VCC-R10 (scopeKind-
  E2E-Beleg) war nur im README notiert statt gefiled. Triage: sofort
  behoben durch Filing von Issue 0116. Alle 5 AC bestätigt; alle Fakten
  unabhängig reproduziert (Suite 791/790/1 mit per Worktree verifiziertem
  Vorbestand = Issue 0112; Lint/Typecheck Exit 0; Testdatei des
  Test-Authors seit efdf0bb unverändert). Nebenbefund außerhalb des
  Branches: doppelte Issue-Nummern 0110/0112 auf main.
- 2026-07-29 — **Waiver:** Die Behebung des einzigen Befunds berührt nur
  den Tracker (neues Issue 0116, Log-Präzisierung), keine Datei, um die es
  in den Kriterien geht — die Wiederholungsrunde des Reviews entfällt nach
  der Regelbuch-Ausnahme.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja — der Lauf setzt genau die fünf
  Kriterien des Intents um: Min-Unterdrückung bei effektivem hidden über alle
  fünf Ankerarten, Kippbarkeit per Modifier, Max unberührt, Suite grün. Die
  Doku-Nachführung (§5.6/§8) ist Teil des Intents.
- **What surprised me?** Kein Reihenfolge-Problem — die Constraint-Auswertung
  läuft nach Fixpunkt und Anker-Nachlauf, effektives hidden ist dort final.
  Und der „nicht melden"-Pfad existiert schon (Angebots-Anker via
  `isReportable`), der Eingriff ist damit klein.
- **What am I assuming without having verified it?** (1) Dass
  `effective.isHidden(node)` für jeden Anker den richtigen Träger prüft
  (Kategorie-Anker tragen den Link; Link→Ziel-Vererbung greift) — die Tests
  müssen das je Ankerart belegen. (2) Dass kein Aufrufer die Meldung eines
  versteckten Min braucht (Repros im Intent sagen: der Nutzer kann sie nie
  beheben). (3) Vorfahren-hidden bleibt außen vor (als Default protokolliert).

### Before the PR

- **Does this match what was asked?** Ja — alle fünf Kriterien vom Reviewer
  aus frischem Kontext bestätigt, je Ankerart Unterdrückungs- und
  Kipp-Nachweis über die echte Fassade; Doku §5.6/§8 nachgezogen;
  Gegenrichtung (0115) und scopeKind-Ersatzbeleg (0116) sind gefiled statt
  eingeschmuggelt.
- **What surprised me?** Die Suite trägt einen vorbestehenden Roten auf
  main (Issue 0112) — „Suite grün" heißt hier: kein auf main grüner Test
  wurde rot, die 18 neuen laufen Exit 0. Außerdem: die vier
  Bestandsanpassungen hingen alle am selben versteckten Träger (Army of
  Sylvania) — die alte Semantik war tief in die E2E-Erwartungen gepinnt.
- **What am I assuming without having verified it?** Dass die Unterdrückung
  eines `limit::`-Min an einem versteckten forceEntry (Muster „eigenes
  Punktelimit") gewollt ist — §5.6 nennt forceEntry ausdrücklich, der
  Reviewer hat den Pfad geprüft; ein realer Katalogfall mit verstecktem
  Sonderheer-Punktelimit wurde aber nicht durchgespielt.

## Retro

- **Was gut lief:** Das Researcher-Briefing vor dem Schreiben irgendeiner
  Zeile hat den Lauf klein gehalten — der befürchtete Reihenfolge-Konflikt
  (hidden-Modifier vs. Fixpunkt) existierte nicht, und der
  `isReportable`-Präzedenzfall machte die Implementierung zu zwei Zeilen.
  Review Runde 1 → 1 Befund (prozessual) → sofort behoben; konvergiert.
- **Was im Weg stand:** Die alte Semantik war an vier Bestandsstellen
  gepinnt, alle am selben versteckten Fixture-Träger (Army of Sylvania) —
  E2E-Erwartungen, die eine falsche Engine-Semantik spiegeln, sind teurer
  zu korrigieren als der Fix selbst. Der `e2e-testcase-author`-Prozess
  (Erwartungen nur aus Katalogdaten) hätte das verhindert; die betroffenen
  Szenarien stammen offenbar aus der Zeit davor.
- **Fürs Regelwerk/Projekt:** (1) `npm install` fehlte im frischen
  Container, bevor vitest lief — ein Setup-Schritt im SessionStart-Hook
  würde jedem Subagenten diesen Stolperer ersparen. (2) Auf main liegen
  doppelte Issue-Nummern (0110, 0112) — die Filing-Regel „höchste Nummer
  + 1" braucht den Blick auf die ganze Liste; als Aufräum-Kandidat beim
  Menschen angemeldet.