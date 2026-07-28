---
status: active
branch: claude/offene-issues-5swrom
pr:
---

# Sentinel -1 als „unbegrenzt" wird auf dem wirksamen Grenzwert gedeutet

## Intent

`src/evaluator/constraints.js` deutet einen Grenzwert von `-1` als
„unbegrenzt" und lässt die Grenze fallen. Zwei Probleme daran:

1. **Der Wert ist an dieser Stelle bereits der wirksame**, also der nach allen
   Modifikatoren (`resolveBound`). Eine MAX-Grenze, die ein
   `decrement`-Modifikator auf `-1` herunterzieht, bedeutet fachlich „nichts
   erlaubt" — sie wird aber still als „unbegrenzt" gelesen. Das ist die
   denkbar größte Verwechslung: Aus der schärfsten Grenze wird gar keine.
2. **Der Sentinel ist bereits benannt.** `catalogReader.js` führt ihn als
   `NO_DEFAULT_COST_LIMIT`, und die zugehörige Dokumentation sagt
   ausdrücklich, der Leser bilde ihn weg, *damit kein Leser den Sentinel als
   Zahl weiterrechnet*. `constraints.js` tut genau das — mit einem harten
   Literal.

Zu klären ist zuerst, wo `-1` in den Katalogdaten überhaupt als „unbegrenzt"
gemeint ist: am Basiswert einer Grenze, an `defaultCostLimit`, oder an beidem.
Die Antwort gehört an die Daten und an das Format-Dokument.

Acceptance criteria:

1. Aus den Katalogdaten und dem Format-Dokument ist belegt, an welchen Stellen
   `-1` „unbegrenzt" bedeutet.
2. Der Sentinel wird dort gedeutet, wo er als Rohwert steht, nicht auf dem
   wirksamen Wert.
3. Eine Grenze, die ein Modifikator auf einen negativen Wert zieht, wird nicht
   als unbegrenzt gelesen.
4. Kein hartes `-1`-Literal mehr in der auswertenden Schicht; der benannte
   Sentinel ist die eine Quelle.
5. Ein Szenario an echten Katalogdaten deckt beide Fälle ab (ADR 0033,
   verfasst vom Black-Box-Autor).

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/79-sentinel-1-als-unbegrenzt-wird-auf-dem-wirksamen-grenzwert-gedeutet/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Vorbestehend (Commit `15219dc` auf `main`), nicht durch
  Alt-Issue 75 entstanden; dort bei der Standards-Prüfung gefunden.
- **Deutung des Sentinels (Default, aus den Daten abgeleitet, unbeantwortet):**
  `-1` ist Sentinel überall dort, wo er als *hingeschriebener* Wert steht —
  am Constraint-Rohwert **und** am Wert eines `set`-Modifikators auf eine
  Grenze. Ein *errechneter* negativer Wert (increment/decrement/multiply)
  ist nie unbegrenzt. Begründung: Die echten Kataloge nutzen beide
  Richtungen — 11 × `set value="-1"` hebt ein Limit auf, ~100 × wird ein
  Rohwert `-1` per `set` auf einen konkreten Deckel gezogen (Border
  Patrols). Nur diese Lesart erfüllt Kriterium 2/3, ohne reale Daten zu
  brechen; „Rohwert" in Kriterium 2 schließt den hingeschriebenen
  Modifikatorwert ein.
- **Arithmetik auf „unbegrenzt" (Default):** increment/decrement/multiply
  auf einer unbegrenzten Grenze lässt sie unbegrenzt; ein späterer `set`
  überschreibt. Kein Fall in den Fixtures widerspricht dem.
- **Kriterium 5, Umfang des Szenarios (Default):** „Beide Fälle" = (a)
  Rohwert `-1` bleibt unbegrenzt bzw. wird per `set` zum konkreten Deckel,
  (b) `set value="-1"` hebt ein Limit auf. Der Fall „Modifikator zieht
  rechnerisch ins Negative" ist in den echten Katalogen nicht
  instanziiert und kann vom Black-Box-Autor daher nicht als Szenario
  belegt werden; ihn decken Unit-Tests ab.

## Log

- Recherche (researcher, Session 2026-07-28): Format-Dokument
  `docs/battlescribe-data-format.md` belegt `-1` = unbegrenzt an
  Constraint-`value` (Z. 626), `defaultCostLimit` (Z. 230–238) und
  Kategorie-Grenzen (Z. 324–328); die Doku-Lücken-Tabelle (Z. 1213) nennt
  den Sentinel als upstream undokumentiert und verweist auf dieses Issue.
  XSD: `defaultCostLimit` hat Default `-1`, Constraint-`value` ist required
  ohne Default — der Sentinel an Constraints ist Konvention. Fixture-Zählung:
  118 × `constraint value="-1"` (alle `max`), 3 × `defaultCostLimit="-1"`.
  Ist-Zustand: `constraints.js:63` prüft `bound === -1` nach `resolveBound`
  (wirksamer Wert, hartes Literal); `catalogReader.js` bildet
  `NO_DEFAULT_COST_LIMIT` nur für Cost-Types auf `null` ab, Constraint-Werte
  laufen ungefiltert durch. Einziger weiterer Treffer im
  Evaluator-Produktivcode: keiner (Solver deutet negativ=unbegrenzt auf dem
  Finalwert, ist aber laut ADR 0030 keine Referenz).
- Es existiert bereits `docs/testing/max-unlimited-violation/` (Rohwert `-1`
  feuert nie); ein Border-Patrols-Szenario (Rohwert `-1` → `set` 25) fehlt.

## Checkpoints

### Before implementation

- Does this match what was asked? Ja — mit einer Präzisierung: „Rohwert"
  in Kriterium 2 schließt den hingeschriebenen Wert eines
  `set`-Modifikators ein, sonst bräche die Änderung 11 reale
  Limit-Aufhebungen. Als Default in Decisions festgehalten.
- What surprised me? Die Kataloge nutzen den Sentinel in beide Richtungen
  (set → `-1` und `-1` → set auf Deckel); der im Issue befürchtete Fall
  (decrement erreicht `-1`) ist in den Fixtures gar nicht instanziiert —
  der einzige Constraint-decrement endet bei 0.
- What am I assuming without having verified it? Dass ein rechnerisch
  negativer Max-Wert fachlich „nichts erlaubt" heißt (aus dem Issue-Intent
  übernommen, nicht gegen die BattleScribe-Referenz-App verifiziert), und
  dass Arithmetik auf „unbegrenzt" unbegrenzt lässt (kein Fixture-Fall
  vorhanden).

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
