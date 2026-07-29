---
status: active
branch: claude/offene-issues-cy79fe
pr:
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

## Log

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Intent ergänzt um die Einordnung, dass §5.6 nur `forceEntry`/`categoryLink`
  deckt und die Verallgemeinerung auf alle Ankerarten eine Projektentscheidung
  ist, die im Lauf zu protokollieren und in die Doku zu heben ist.

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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
