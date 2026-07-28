---
status: backlog
branch:
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
