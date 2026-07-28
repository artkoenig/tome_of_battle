---
status: done
branch: claude/offene-issues-5swrom
pr: https://github.com/artkoenig/tome_of_battle/pull/150
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
- **Version (Antwort des Menschen, 2026-07-28):** kein Bump — der PR geht
  mit 1.9.0 raus; Vorschlag 1.9.1 abgelehnt.

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
- Test-Autor: `src/evaluator/constraints.unlimitedSentinel.test.js`, 14 Tests
  (Kriterien A–E). `npx vitest run …` → Exit 1, 4 failed / 10 passed. Die 4
  Failures sind die Zielfälle: decrement exakt auf `-1` verschluckt die
  Verletzung; increment/decrement/multiply auf Rohwert `-1` rechnen den
  Sentinel als Zahl weiter. Grüne Tests fixieren A–C gegen Regression.
- Default (Frage des Test-Autors): die Kante „Verletzung bei 0 Auswahlen und
  wirksamem Wert -1" bleibt ungetestet; die bestehende Melde-Semantik
  (Verletzungen nur an belegten Slots) wird von diesem Issue nicht
  angetastet.
- Black-Box-Autor (Kriterium 5): Szenario
  `docs/testing/unlimited-modifier-toggle/` (5 Roster, ein Szenario für
  beide Fälle). Fall A: Goblin-Constraint `ad41-8936-7a56-1717`
  (`max -1` → `set 25` unter Border Patrols) — feuert bei 26 mit Bedingung,
  nicht bei 25, nicht bei 26 ohne Bedingung. Fall B: Outriders-Constraint
  `264b-4c6a-defa-2b3e` (`max 0` → `set -1` unter „Allow experimental
  rules") — feuert ohne Bedingung bei Zählung 1, schweigt mit Bedingung
  bei Zählung 2. Erwartungen selektiv; hidden-Mechanik und Autor-Meldung
  bewusst außerhalb der Assertions (README UMT-R5).
- Implementer: Sentinel-Deutung an genau einer Stelle —
  `model.js` führt `UNLIMITED_SENTINEL = -1` (modul-privat, einziges
  Literal), exportiert `UNLIMITED = Infinity` und `unlimitedFromSentinel()`.
  `catalogReader.js` deutet Constraint-Rohwert und `defaultCostLimit`
  darüber (`NO_DEFAULT_COST_LIMIT` entfernt, Cost-Types weiter → `null`);
  `modifiers.js` deutet den hingeschriebenen `set`-Wert auf Grenzen;
  increment/decrement/multiply rechnen auf `Infinity` von selbst
  unbegrenzt weiter. `constraints.js` prüft `bound === UNLIMITED` mit
  Frühausstieg vor der Prozent-Ableitung. Format-Dokument §7.6 trägt die
  belegte Semantik, §15-Lücke verweist dorthin. Repräsentation `Infinity`
  statt `null`/Symbol: kollidiert nicht mit dem `??`-Fallback und braucht
  keine Arithmetik-Sonderfälle. Bewusste kleine Verhaltensänderung: eine
  unbegrenzte Prozentgrenze mit leerem Bezugsrahmen erzeugt keine
  `ZERO_DENOMINATOR`-Diagnose mehr.
- Exit-Codes (Implementer, von der Session bestätigt):
  `npx vitest run src/evaluator/constraints.unlimitedSentinel.test.js`
  14/14 grün, Exit 0. `npm test` komplett (2139 vitest-Tests, 210 Dateien
  + Puppeteer-E2E) Exit 0. `npm run lint` 0, `npm run typecheck` 0,
  `npm run depcruise` 0 (1 vorbestehende warn-only-Meldung). `npm run
  knip` Exit 1 vorbestehend (per `git stash` gegen den unveränderten Baum
  verifiziert; kein Befund nennt neue Exporte). Grep-Nachweis Kriterium 4:
  einziges `-1`-Sentinel-Literal in `model.js`; `effectiveState.js:302`
  ist ein Sort-Komparator.
- Session-Check: der Manifest-Runner (`e2e.testcatalog.test.js`) entdeckt
  das neue Szenario automatisch; `npx vitest run … -t
  "unlimited-modifier-toggle"` → 5 passed, Exit 0.
- Review Runde 1 (frischer Kontext): alle 5 Kriterien erfüllt, alle
  Exit-Codes unabhängig reproduziert (`npm test` Exit 0, 2139 Tests + E2E;
  lint/typecheck/depcruise Exit 0; knip Exit 1 vorbestehend). Drei Befunde
  mit Reproduktion, alle außerhalb der nummerierten Kriterien:
  (1) `multiply value="0"` auf unbegrenzter Grenze → `Infinity*0=NaN` →
  Verletzung mit `bound: NaN` (widerspricht der Arithmetik-Decision; in
  den Fixtures existiert kein multiply-Modifikator). (2) Der neue
  Prozent-Frühausstieg (`constraints.js:44`) ist ungepinnt — Mutationsprobe
  bleibt grün. (3) Kommentar `catalogReader.js:247` verweist auf §7.5 statt
  §7.6. Triage: alle drei fix now; Tests für (1)+(2) zuerst durch den
  Test-Autor, Fix durch den Implementer.
- Test-Autor Nachtrag: 4 neue Tests in
  `constraints.unlimitedSentinel.test.js` (jetzt 18). F: multiply 0 auf
  Rohwert -1 — 2 Tests, rot mit dem Review-Fehlerbild. G: unbegrenzte
  Prozentgrenze bei Nenner 0 — 2 Tests, grün als Regressions-Pin (bewusst;
  Erwartung aus der Intent-Semantik).
- Implementer-Fix: `modifiers.js` — Wrapper `limitArithmetic(combine)` um
  die LIMIT-Handler von increment/decrement/multiply: bei `UNLIMITED`
  sofort `UNLIMITED`, sonst normal rechnen. Deckt auch multiply mit
  negativem Faktor (vorher `-Infinity`). `catalogReader.js:247` §7.5 →
  §7.6. Exit-Codes: Sentinel-Tests 18/18 Exit 0, `npx vitest run
  src/evaluator` 532 Tests Exit 0, lint 0, typecheck 0.
- Review Runde 2 (frischer Kontext, ganzer Intent): **0 Befunde**, alle 5
  Kriterien erfüllt. Eigene Exit-Codes: `npm test` 2143 Tests + Puppeteer
  Exit 0; lint/typecheck/depcruise Exit 0; knip Exit 1 vorbestehend, ohne
  Bezug zum Diff. Mutationsproben: Prozent-Frühausstieg raus → 1/18 rot,
  `limitArithmetic`-Guard raus → 2/18 rot — beide Runde-1-Pins greifen.
  Szenario-Erwartungen gegen die .cat-Fixtures verifiziert. Trend: 3 → 0.
- Notiz Runde 2 (kein Befund, für den Cutover Issue 75): eine gefeuerte,
  ursprünglich unbegrenzte Grenze trägt `derivation.base = Infinity`;
  `JSON.stringify(Infinity)` → `null` wird erst relevant, wenn der Bericht
  serialisiert/angezeigt wird.
- Notiz Runde 2, vorbestehend und außerhalb dieses Intents: Roster-seitiges
  `costLimit value="-1"` wird in `budget.js` nicht als Sentinel gedeutet →
  zunächst als Issue 085 gefiled, dann zugunsten von 0096 aus dem
  parallel auf main gelandeten Audit-Batch zurückgezogen (0096 deckt
  dasselbe Thema gründlicher ab; unsere Nummer 085 kollidierte zudem mit
  dem neuen 0085).

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

- Does this match what was asked? Ja. Alle 5 Kriterien von der Review in
  frischem Kontext bestätigt; die Präzisierung von Kriterium 2
  („hingeschriebener Wert" statt nur Katalog-Rohwert) ist in Decisions
  begründet und im Format-Dokument §7.6 belegt.
- What surprised me? `Infinity * 0 = NaN` — die IEEE-Arithmetik trug die
  „unbegrenzt bleibt unbegrenzt"-Decision für increment/decrement von
  selbst, für multiply nicht; daraus wurde der benannte
  `limitArithmetic`-Kurzschluss. Außerdem druckt der vitest-Reporter nur
  die langsamsten Tests — der erste Grep nach dem neuen Szenario im
  Suite-Output war deshalb irreführend leer.
- What am I assuming without having verified it? Dass die
  BattleScribe-Referenz-App errechnet-negative Grenzen genauso deutet wie
  wir (nicht verifiziert; unsere Deutung folgt dem Issue-Intent und den
  Daten). Dass `derivation.base = Infinity` beim Cutover sauber
  serialisiert wird — als Notiz im Log an Issue 75 übergeben.

## Retro

- **Was im Weg stand:** Der vitest-Default-Reporter druckt nur die
  langsamsten Tests — der Grep nach dem neuen Szenario im Suite-Output war
  leer, obwohl es lief; erst `-t "unlimited-modifier-toggle"` gab den
  Fakt per Exit-Code. Lehre: Testabdeckung nie aus dem Reporter-Text
  ablesen, immer gezielt filtern.
- **Was gut trug:** Die Recherche vor den Tests hat die Kriterien vor
  einem realen Bruch bewahrt (`set -1` hebt Limits auf — eine Deutung nur
  am Katalog-Rohwert hätte 11 echte Fälle gebrochen); der Default wurde
  ohne Rückfrage festgehalten und hielt. Die Mutationsproben des Reviewers
  (Pin raus → Test rot?) haben in Runde 2 beide Runde-1-Fixes als
  wirklich gepinnt belegt — das Muster lohnt sich als Standard-Handgriff
  für Reviews.
- **Überraschung mit Prozesswert:** Die „unbegrenzt bleibt
  unbegrenzt"-Decision galt für increment/decrement gratis (IEEE), kippte
  aber bei `multiply 0` in `NaN` — eine Invariante, die man von der
  Arithmetik geschenkt bekommt, ist keine; sie braucht einen benannten
  Ort und einen Pin.
- **Regeländerung:** keine nötig; der Lauf folgte dem Rulebook ohne
  Reibung mit den Regeln selbst.
