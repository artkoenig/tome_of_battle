---
status: backlog
branch:
pr:
---

# CATEGORY-Referenzwege über Katalogbezugsrahmen hinweg lückenlos erkennen

## Intent

Issue 0098 (`docs/issues/0098-wurzel-eintraege-aller-kataloge-werden-katalogfremd-gepoolt.md`)
führte einen Katalog-Bezugsrahmen (`catalogueScope`) ein, der Wurzel-Definitionen
katalog-lokal filtert. Ein frischer Reviewer, der ausschließlich anhand von
Issue 0098s eigenen, wörtlich formulierten Akzeptanzkriterien (die nur
Wurzel-`selectionEntry`/`forceEntry` nennen) und dem Diff prüfte, fand über
**vier aufeinanderfolgende Review-Runden** hinweg, dass `CATEGORY`-Definitionen
einen breiteren "wird diese Kategorie von etwas Realem und Anwesendem im Roster
referenziert?"-Test brauchen, als die Kriterien beschreiben — und jede Runde
deckte einen weiteren, bis dahin übersehenen Referenzweg auf:

- Runde 1: eine Kategorie, die per `categoryLink` an einem **Kontingent**
  (`forceEntry`) referenziert wird, verlor ihre eigene Grenze zu Unrecht.
- Runde 2: die Runde-1-Ausnahme war zu breit — sie schaltete die Filterung
  für **jede** Kategorie ab, auch für eine völlig unbezogene.
- Runde 3: eine Kategorie, die nur per `categoryLink` an einer bereits
  **belegten Auswahl** (`selectionEntry`), nicht am Kontingent selbst,
  referenziert wird, wurde von der Runde-1/2-Erkennung übersehen.
- Runde 4: Kategorie-Zugehörigkeit, die nur **dynamisch** per
  `modifier type="add"/"remove" field="category"`
  (`docs/battlescribe-data-format.md` §8) vergeben wird, ist für die
  `referencedCategoryIdsUnder`-Hilfsfunktion (`src/evaluator/evalTree.js`,
  aus Runde 1–3) unsichtbar — die Kategorie-eigene MIN/MAX-Grenze kann
  über eine Katalog-Grenze hinweg still unbemerkt bleiben (kein Verstoß,
  keine Diagnose).

Der Mensch hat mitten in der Issue-0098-Sitzung (2026-07-30) entschieden, das
Verfolgen weiterer Referenzwege **innerhalb** von Issue 0098 zu stoppen — vier
aufeinanderfolgende Runden mit demselben Fundmuster ("noch eine Stelle
übersehen") sind ein Wiederholungssignal nach dem Metis-Regelwerk, und das
Thema liegt ohnehin außerhalb von Issue 0098s wörtlichen Kriterien (die nur
Wurzel-`selectionEntry`/`forceEntry` nennen, keine `CATEGORY`) — und
stattdessen dieses eigenständige Issue anzulegen.

Alle bisherigen Runden waren **latent**: keiner der vier Funde bricht echte
WHFB6-Katalogdaten, jeder wurde per eigens gebauter, minimaler Reproduktion
demonstriert (Details, exakte defIds/Zeilennummern und Reproduktionscode: siehe
`## Log` in Issue 0098, datiert 2026-07-30, Runden 1–4). Dieses Issue
dupliziert diese Details nicht, sondern verweist darauf.

Acceptance criteria:

1. Wenn die einzige Beziehung eines Roster-Mitglieds zu einer
   katalogfremden `CATEGORY` ein `modifier type="add" field="category"`
   ist (bedingt oder unbedingt), der auf diese Kategorie zielt, und die
   Kategorie eine roster- oder kontingent-skopierte MIN/MAX-Grenze trägt,
   wird die Grenze ausgewertet (sie feuert oder ist erfüllt, verschwindet
   aber nicht stillschweigend) — genauso wie bei einem statischen
   `categoryLink`.
2. Es wird gezielt geprüft, ob noch ein weiterer struktureller Mechanismus
   (z. B. ein eigener `categoryLink` an einer `selectionEntryGroup`, eine
   per `infoLink` vermittelte Kategorie-Zuordnung, oder ein anderes
   BSData-Konstrukt, das ein reales Roster-Mitglied an eine Kategorie
   bindet) von der Referenz-Erkennung weiterhin übersehen wird — jeder
   wird entweder abgedeckt oder mit einer genannten Begründung explizit
   ausgeschlossen (Runde 4 des Reviewers hat `selectionEntryGroup` bereits
   als über `realNodes` strukturell unerreichbar eingestuft — dieser Fund
   wird überprüft und entweder bestätigt oder revidiert, nicht neu
   hergeleitet).
3. Die bestehenden Katalog-Bezugsrahmen-Regressionswachen aus Issue 0098
   (der Fall der völlig unbezogenen Kategorie, der Kontingent-Link-Fall,
   der Auswahl-Link-Fall) bleiben grün — dieses Issue ergänzt nur
   Abdeckung, es verhandelt Issue 0098s bestehende Entscheidungen nicht neu.

## Plan

## Tasks

## Decisions

- 2026-07-30 — Dieses Issue entstand aus den Review-Runden 1–4 von Issue
  0098 (`docs/issues/0098-wurzel-eintraege-aller-kataloge-werden-katalogfremd-gepoolt.md`,
  `## Log`, Einträge datiert 2026-07-30). Technische Details der bisherigen
  vier Funde — exakte Reproduktionsdaten, betroffene Funktionen und
  Codestellen, defIds — stehen dort, nicht hier dupliziert. Der Mensch
  entschied, das Verfolgen weiterer Referenzwege nicht in Issue 0098
  fortzusetzen (Wiederholungssignal nach vier Runden desselben Fundmusters,
  plus: das Thema liegt außerhalb von Issue 0098s wörtlichen Kriterien),
  sondern in diesem eigenständigen Issue zu bündeln.

## Log

- 2026-08-12 (re-check, independent probe) — **Reproduces, and the narrowing
  holds: it is a cross-catalogue defect only.** Category `cat-banned` with
  `max 0 scope="force"`, membership granted solely by
  `modifier type="add" field="category"`:
  - category in the same catalogue as the unit -> `banned-max` fires, error,
    actual 1, bound 0;
  - category declared in a second catalogue the roster does not name ->
    **silent**, no diagnostic;
  - control in the same run, same foreign catalogue, membership by a static
    `categoryLink` -> fires, actual 1, bound 0.
  Criterion 1 is to be read as "across a catalogue boundary".

- 2026-08-12 — Round 4 reproduced, and **narrowed**: it is a cross-catalogue
  defect only. Category `cat-banned` carries `max 0 scope="force"`; a unit is
  granted that category solely by `modifier type="add" field="category"`.
  - Both in one catalogue: the limit **fires** (`banned-max error actual=1
    bound=0`), same as with a static `categoryLink`. The dynamic membership is
    counted correctly.
  - Category declared in a second catalogue the roster does not name: the limit
    is **silent**, no diagnostic. Control in the same run — the same foreign
    category reached by a static `categoryLink` at the unit **does** fire
    (`actual=1 bound=0`).
  So the hole is precisely `referencedCategoryIdsUnder`
  (`src/evaluator/evalTree.js:490-500`), which builds its reference set from
  `linkedCategoryIdsOf` — static `categoryLink` children only — and is what
  `synthesizeMandatoryPhantoms` consults to decide whether a foreign category
  is in scope. Criterion 1 should be read as "across a catalogue boundary";
  within one catalogue there is nothing to fix.

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
