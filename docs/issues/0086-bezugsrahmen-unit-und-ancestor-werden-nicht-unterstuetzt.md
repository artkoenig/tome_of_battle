---
status: active
branch: claude/86-umsetzen-y6v33w
pr:
---

# Bezugsrahmen `unit` und `ancestor` werden nicht unterstützt

## Intent

Das BSData-Wiki (*Data structure overview*, Abschnitt *Condition*) zählt
`ancestor` als Scope auf; reale Kataloge nutzen zusätzlich `unit`. In den
Fixture-Katalogen der Definitive Edition
(`src/evaluator/__fixtures__/whfb6-definitive/`): `scope="unit"` **130×**,
`scope="ancestor"` **10×**. Die Engine kennt beide nicht: `ScopeKeyword`
(`src/evaluator/model.js:109`) umfasst nur `roster/force/parent/self`; alles
andere fällt in den ID-Zweig von `resolveSharedFrame` (`src/evaluator/query.js:74`),
löst nicht auf und liefert `UNRESOLVED_SCOPE` + Zählwert 0.

Folge: Modifikatoren mit diesen Scopes feuern nie bzw. falsch. Belegtes
Beispiel (Repro aus dem Audit 2026-07-28): das Mercenaries-Idiom „Kostenaufschlag
je Modell" (`<repeat field="selections" scope="unit" childId="model"/>`) zählt
0 — alle so kodierten Pro-Modell-Kostenskalierungen rechnen stumm falsche
Kosten. Bei `lessThan`-/`notInstanceOf`-Conditions wirkt der Zählwert 0 zudem
fail-open.

Nur `primary-catalogue` (27×) ist bereits als Issue 077 erfasst; `unit` und
`ancestor` sind nirgends verzeichnet. Die Semantik laut Referenzprogramm:
`unit` = die umschließende Einheit (der nächste Vorfahre — den Knoten selbst
eingeschlossen — mit `type="unit"`); `ancestor` = die gesamte Vorfahrenkette
(laut Wiki nur mit `instanceOf`/`notInstanceOf` gültig).

Acceptance criteria:

1. Eine Query mit `scope="unit"` löst auf die umschließende Einheit auf: ein
   `repeat`/eine `condition` mit `scope="unit" childId="model"` an einer
   Option innerhalb einer Einheit zählt die Modelle dieser Einheit; der
   Mercenaries-Pro-Modell-Aufschlag rechnet die erwarteten Kosten.
2. Eine `instanceOf`-/`notInstanceOf`-Condition mit `scope="ancestor"` hält
   genau dann, wenn ein Vorfahre (bzw. keiner) auf das benannte Ziel auflöst.
3. Über den Fixture-Datensätzen entsteht für `scope="unit"` und
   `scope="ancestor"` keine `UNRESOLVED_SCOPE`-Diagnose mehr.
4. Ein weiterhin unbekanntes Scope-Schlüsselwort bleibt diagnostiziert (kein
   stilles Raten).
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro und Fixture-Zählung.
- **Abgrenzung:** `scope="primary-catalogue"` bleibt bei Issue 077 und ist
  hier ausdrücklich nicht Gegenstand.
- **Semantik `unit` (Default, unbeantwortet):** Zählrahmen = nächster
  Vorfahre — den Knoten selbst eingeschlossen — mit rohem `type="unit"`; bei
  einem `entryLink` zählt der rohe Typ seines transitiv aufgelösten Ziels
  (dieselbe Regel, mit der der Zählindex Typ-Schlüsselwörter führt). Ohne
  solchen Vorfahren: fail-closed `UNRESOLVED_SCOPE` + 0. `shared="false"`
  behält die engine-einheitliche Bedeutung (Bindung an den eigenen Teilbaum);
  alle 130 Fixture-Vorkommen tragen `shared="true"`.
- **Semantik `ancestor` (Default, unbeantwortet):** kein Zählrahmen, sondern —
  wie `primary-catalogue` — eine Mitgliedschaftsprüfung, hier über die
  gesamte **strikte** Vorfahrenkette (reale Knoten, Kontingente
  eingeschlossen, die definitionslose Wurzel ausgenommen). Ergebnis ist die
  Zahl der passenden Vorfahren; ein Vorfahre passt, wenn die Ziel-Id unter
  den Zielen liegt, unter denen er auch im Zählindex zählbar wäre
  (Definitions-Id, Link-Ziel-Id, effektive Kategorien, roher Typ). Die Flags
  (`shared`, `includeChild…`) sind ohne Wirkung — eine Vorfahrenkette wird
  durch eine Instanz nicht enger. Nur `field="selections"` ist gültig;
  anderes Feld → `UNSUPPORTED_FIELD` (wie `primary-catalogue`). Beleg aus
  den Fixtures: alle 10 Vorkommen sind `instanceOf`-Conditions, und **alle
  10 `childId`s benennen Kategorie-Ids** („Characters", „Battle standard
  bearer", „Slaanesh [DARK ELVES]") — eine reine Definitions-Id-Prüfung
  ginge an den realen Daten vorbei, die Prüfung braucht die effektiven
  Kategorien der Vorfahren.
- **Umsetzungsort:** `ScopeKeyword` und `ScopeKind` wachsen um `UNIT` und
  `ANCESTOR` (die Obermengen-Invariante der Einordnung bleibt dadurch
  bestehen); die Auflösung sitzt ausschließlich im Query-Primitiv
  (`query.js`), das dafür zusätzlich die Effektiv-Werte (`effective`) im
  Query-Kontext braucht — beide Aufrufer (`constraints.js`, `modifiers.js`)
  haben sie bereits zur Hand.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked? — Ja. Die fünf Kriterien sind präzise und
  falsifizierbar; die Semantik-Entscheidungen oben füllen nur die zwei
  Lücken, die der Intent offen lässt (Selbst-Einschluss bei `unit`,
  Matching-Regel bei `ancestor`), als dokumentierte Defaults.
- What surprised me? — (a) Alle 10 `ancestor`-Vorkommen zielen auf
  **Kategorie-Ids**, nicht auf Eintrags-Ids — die Vorfahrenprüfung muss die
  effektiven Kategorien lesen. (b) Der Zählindex kann Typ-Schlüsselwörter
  (`model`, `unit`) längst als Ziele zählen — für `scope="unit"` fehlt
  wirklich nur die Rahmen-Auflösung, keine Index-Erweiterung.
- What am I assuming without having verified it? — (a) `ancestor` schließt
  den Knoten selbst aus (Wortlaut „Vorfahrenkette"); (b) die Flags sind bei
  `ancestor` wirkungslos; (c) in den Fixture-Rostern liegen alle
  `scope="unit"`-Querys tatsächlich innerhalb einer Einheit, sodass
  Kriterium 3 erfüllbar ist. Alle drei prüfen die Tests gegen echte
  Katalogdaten nach.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
