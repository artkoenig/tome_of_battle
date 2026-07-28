---
status: backlog
branch:
pr:
---

# Zwei Grenzen am Doppelverweis feuern nicht

## Intent

Zwei Grenzen aus `Vampire Counts (6th definitive edition).cat` feuern nicht,
obwohl das Roster den begrenzten Gegenstand zweimal enthält. Die Ursache ist
offen; dieses Issue soll sie klären.

Zwei belegte Fälle, beide aus `Vampire Counts (6th definitive edition).cat`,
beide beim Bau des Szenarios `shared-target-two-entrylinks` aufgefallen:

| Grenze | Deklariert an | Erwartet | Beobachtet |
|---|---|---|---|
| `0aa08f91-b271-402b-98aa-32c51f3beae7` (max 1, `scope="roster"`) | Zieleintrag `d612998a-…`, Z. 20051 | Ist 2 / Grenze 1 | feuert nicht |
| `76e2c1c8-8320-4bc2-a370-cc3e95c7fd2c` (max 1, `scope="parent"`) | Gruppe „Magic Armour" `847028b2-…`, Z. 23462 | Ist 2 / Grenze 1 | feuert nicht |

Reproduzierbar mit den Rostern 03 und 04 aus
`docs/testing/shared-target-two-entrylinks/`: das Roster nimmt denselben
Gegenstand zweimal, beide Grenzen schweigen. Die Ids sind dort aus der
Erwartung genommen und bewusst **nicht** nach `absent` verschoben — das
Manifest macht über sie derzeit keine Aussage.

**Eine naheliegende Erklärung ist bereits widerlegt.** Beide Grenzen tragen
`includeChildSelections="false"` und `includeChildForces="false"`, und die
Zählschicht summiert bei dieser Kombination nur den Basis-Eimer ihres
Bezugsrahmens (`src/evaluator/countIndex.js`), an dem keine Auswahl liegt. Das
kann es aber nicht allein sein: `f25f23c2-f5f1-4bd0-8c7a-0ce617302c7e` (Z. 20050)
trägt **dieselben zwei Flags** und feuert in Roster 03 mit Ist 2 gegen Grenze 1.

Was die Fälle unterscheidet, ist ihr Bezugspunkt:

| Grenze | Anker | Rahmen | feuert |
|---|---|---|---|
| `f25f23c2` | Zieleintrag `d612998a` | `parent` | ja |
| `0aa08f91` | derselbe Zieleintrag | `roster` | nein |
| `76e2c1c8` | Gruppe `847028b2` (zählt ihre Mitglieder) | `parent` | nein |

Zu klären ist damit zweierlei, jeweils an den Katalogdaten und an
`docs/battlescribe-data-format.md` statt an einer Annahme: Was zählt eine
`scope="roster"`-Grenze, und zählt eine Grenze an einer
`selectionEntryGroup` die Gruppe selbst oder ihre Mitglieder?

Acceptance criteria:

1. Aus den Katalogdaten und dem Format-Dokument ist belegt, was eine
   `scope="roster"`-Grenze zählt und was eine Grenze an einer
   `selectionEntryGroup` zählt.
2. Eine Grenze, die nach dieser Deutung feuern muss, feuert.
3. Die beiden belegten Fälle sind entschieden: entweder feuern sie, oder es
   ist belegt, dass ihr Schweigen richtig ist.
4. Das Szenario `shared-target-two-entrylinks` nimmt beide Ids wieder in seine
   Erwartung auf — auf der Seite, die die Untersuchung ergibt.
5. Die übrige E2E-Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt —, und jede geänderte Erwartung ist einzeln begründet.

## Plan

## Tasks

## Decisions

- **Herkunft:** Aufgefallen beim Bau des Szenarios
  `shared-target-two-entrylinks` in Issue 076. Der Black-Box-Autor leitete
  beide Grenzen aus den Katalogdaten als feuernd ab; die Engine schweigt.
- **Erste Ursachenvermutung verworfen.** Dieses Issue nannte zunächst die
  beiden `include`-Flags als Ursache. Review-Runde 3 von Issue 076 hat das
  am selben Szenario widerlegt (`f25f23c2` trägt dieselben Flags und feuert).
  Titel und Intent sind entsprechend korrigiert.
- **Vorbestehend, nicht durch 076 entstanden:** Auf einem Worktree des
  Standes vor dem Fix verhalten sich beide Grenzen identisch.
- **Kriterium 1 ist eine Fachfrage, keine Implementierungsaufgabe.** Fällt die
  Antwort so aus, dass das Schweigen richtig ist, ist das ein legitimes
  Ergebnis und die übrigen Kriterien ändern ihre Form.

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
