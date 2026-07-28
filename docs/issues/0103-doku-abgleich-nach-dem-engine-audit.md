---
status: backlog
branch:
pr:
---

# Doku-Abgleich nach dem Engine-Audit

## Intent

Das Engine-Audit (2026-07-28) hat drei Stellen gefunden, an denen die
Dokumente selbst driften oder einander widersprechen. Reines Doku-Issue;
kein Produktivcode.

1. **`docs/evaluator-architecture.md` §4.1 ist stale:** das
   `CountedField`-Enum nennt `FORCE_COUNT` nicht, obwohl die eigene
   `LimitMeasure`-Aufzählung und der Code (`model.js`, `field="forces"`) ihn
   führen. Der Code ist richtig, die Doku hinkt.
2. **`append`-Trennzeichen:** das BSData-Wiki sagt „a space is implicitly
   added", `docs/battlescribe-data-format.md` §7.7 sagt „ohne `join` wird
   ohne Trennzeichen zusammengefügt". Die Engine folgt der Projekt-Doku
   (reale Daten setzen `join` immer explizit, 62 Vorkommen). Der Widerspruch
   gehört in der Projekt-Doku benannt und entschieden.
3. **Rechenregel §7.5 (`child.number * parent.number`):** die Engine
   multipliziert Stückzahlen nicht durch die Elternkette
   (`countIndex.js`, `contributionOf`). Mit absoluten `.ros`-Stückzahlen ist
   das konsistent — die `.ros`-Semantik ist laut §15 aber selbst eine
   Doku-Lücke. Die Regel gehört präzisiert: für welche Zahlenbasis
   (Katalog-Constraints vs. `.ros`-`number`) sie gilt und was die Engine
   voraussetzt; hängt am Roster-Vertrag (Issue 084).
4. **§3.2/§7.2 erwähnen den ADR-0032-Override nicht:** §3.2 verlangt
   Kontext-Threading („der `catalogueId`-Kontext muss mitgeführt werden"),
   §7.2 die Katalog-Lokalität des Link-Ziels. ADR-0032 überstimmt beides
   bewusst (Global-by-ID über eine flache Tabelle, Kollisions-Guard als
   Sicherheitsnetz) — die Format-Doku nennt den Override an diesen Stellen
   aber nicht. Nach der Projektregel „wenn Dokument und Entscheidung
   auseinanderlaufen, ist das Dokument veraltet" gehört der Verweis in beide
   Abschnitte.

Acceptance criteria:

1. `docs/evaluator-architecture.md` §4.1 führt `FORCE_COUNT` (und stimmt
   damit mit `LimitMeasure` und dem Code überein).
2. `docs/battlescribe-data-format.md` §7.7 benennt den Wiki-Widerspruch zum
   `append`-Trennzeichen und die geltende Entscheidung samt Beleg.
3. §7.5 sagt eindeutig, auf welche Zahlenbasis sich die Rechenregel bezieht
   und was die Engine vom `.ros`-`number` voraussetzt; der Querverweis auf
   Issue 084 steht dabei.
4. §3.2 und §7.2 benennen den bewussten ADR-0032-Override (Global-by-ID
   statt Kontext-Threading/Katalog-Lokalität) mit Verweis auf das ADR und
   dessen Kollisions-Diagnose.
5. Kein Produktivcode ändert sich (Diff-Beleg); es gibt nichts auszuführen —
   die Review des Diffs gegen dieses Intent ist die einzige Prüfung.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28).

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
