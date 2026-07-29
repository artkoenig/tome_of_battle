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

**Die Fremddokumentation ist inzwischen eingeholt** und engt die Frage stark
ein. Das [BSData-Wiki, *Data structure
overview*](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview)
beschreibt das `shared`-Attribut einer Grenze so: ist es gesetzt, *„the
constrained value is a sum of all selections of this shared entry in roster in
total"*; ist es nicht gesetzt, *„the sum is calculated for a given entry link
instance"*.

Alle drei Grenzen tragen `shared="true"`. Für `0aa08f91` (`scope="roster"`,
`max 1`) heißt das wörtlich: gezählt werden **alle** Vorkommen des Eintrags im
Roster. Roster 03 und 04 enthalten zwei — die Grenze muss feuern. Damit ist ihr
Schweigen mit hoher Wahrscheinlichkeit ein echter Engine-Fehler und keine
Fehldeutung des Autors.

Die Flags heißen im Wiki *„And all child selections?"* und *„And all child
forces?"*; unangekreuzt zählt die Grenze *„just `scope`'s `field`"* bzw.
*„only from parent force selections"* — von „gar nichts" ist keine Rede. Auch
das spricht gegen die verworfene Flag-Erklärung.

Auch die zweite Hälfte ist inzwischen belegt. Die Quelle beschreibt den
Bezugsrahmen einer Grenze so: der `scope` entscheide, *„which entity should sum
up all `field`'s values **of descendant selections of this constraint's parent
entry**"*. Gezählt werden also die Auswahlen **unterhalb** des Trägers der
Grenze. Für `76e2c1c8`, die an der Gruppe „Magic Armour" hängt, heißt das: ihre
Mitglieder. Zwei gewählte Mitglieder ergeben Ist 2 — die Grenze muss feuern.
Unsere Engine zählt stattdessen die eigene Id des Gruppenknotens und kommt auf
1.

Damit sind **beide** Fälle belegte Fehler, nicht offene Fachfragen. Die
Belegstellen stehen in
[`docs/battlescribe-data-format.md`](../battlescribe-data-format.md) §7.6; die
Quelle selbst liegt als Submodul unter
`docs/bsdata-catalogue-development-wiki/Data-structure-overview.md`.

Acceptance criteria:

1. Die Engine zählt für eine Grenze die Auswahlen **unterhalb ihres Trägers**,
   im Rahmen des `scope` — nicht die eigene Id des Trägers.
2. Eine Grenze, die nach dieser Deutung feuern muss, feuert.
3. Die beiden belegten Fälle feuern: `0aa08f91` und `76e2c1c8` jeweils mit
   Ist 2 gegen Grenze 1.
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
- **Die Fachfrage ist beantwortet, bevor der Lauf beginnt.** Die
  BSData-Dokumentation belegt beide Fälle als Fehler (siehe Intent). Dieses
  Issue ist damit eine Implementierungsaufgabe, keine Untersuchung.

## Log

- **2026-07-28, Ursachenanalyse aus dem Engine-Audit** (Intensiv-Prüfung der
  Reinraum-Engine gegen die BSData-Doku, mit ausgeführten Repros gegen die
  echte Fassade). Die beiden Fälle haben **zwei verschiedene Ursachen**:
  - **`76e2c1c8` (Gruppe „Magic Armour", `scope="parent"`):** Die Gruppe
    erreicht ihre Träger über einen `entryLink type="selectionEntryGroup"`.
    `groupDefinitionsWithLimits` (`src/evaluator/evalTree.js:369`) steigt beim
    Einsammeln aber nur in Kinder mit `kind === GROUP` ab und überspringt
    einen Link, dessen aufgelöstes Ziel eine Gruppe ist. Folge: für verlinkte
    Gruppen entsteht **kein Gruppen-Anker und keine Member-Annotation** —
    `max` feuert nie, und ein `min` einer verlinkten Pflichtgruppe feuert
    stets mit „Ist 0", auch wenn ein Member gewählt ist (beide Richtungen im
    Audit per Minimal-Katalog reproduziert; Inline-Gruppe als Kontrolle
    feuert korrekt).
  - **`0aa08f91` (Zieleintrag, `scope="roster"`):** Die im Intent verworfene
    Flag-Erklärung war nur in ihrer pauschalen Form falsch. Die Eimer-Zuteilung
    ist **relativ zum Rahmen** (`indexNodeContribution`,
    `src/evaluator/countIndex.js:149`): liegt zwischen Beitragendem und Rahmen
    ein Selektionsknoten, landet der Beitrag im SELECTION-Eimer, den
    `includeChildSelections="false"` ausschließt. Die unter Charakteren
    geschachtelten Gegenstände sind für den `parent`-Rahmen direkte Kinder
    (BASE-Eimer → `f25f23c2` feuert), für den `roster`-Rahmen aber
    geschachtelt (SELECTION-Eimer → `0aa08f91` liest 0). Das erklärt genau
    die Beobachtungstabelle im Intent. Laut der im Intent zitierten
    Wiki-Semantik („shared=true: Summe **aller** Vorkommen im Roster";
    unangekreuzt zählt „just `scope`'s `field`", nicht „nichts") zählt die
    Referenz solche Vorkommen dennoch — die wörtliche Eimer-Lesart der Engine
    weicht hier vom Referenzverhalten ab.
- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  alle Zitate und Katalog-Datenangaben des Issues verifiziert (Ids, Zeilen,
  Flags — korrekt). Ein Hinweis für den Implementierer: das Wiki trägt hier
  eine **unaufgelöste innere Spannung**. Der `shared="true"`-Satz stützt für
  den Eintrags-Fall (`0aa08f91`) „zählt alle eigenen Vorkommen im Roster";
  der `scope`-Satz („descendant selections of this constraint's parent
  entry") ergäbe wörtlich genommen Ist 0 (nur Nachfahren, nie der Träger
  selbst). AC 1 und AC 3 sind nur unter der `shared`-Lesart für
  Eintrags-Träger vereinbar; das Wiki löst den Konflikt nirgends auf —
  die Entscheidung gehört als Decision in den Lauf.

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
