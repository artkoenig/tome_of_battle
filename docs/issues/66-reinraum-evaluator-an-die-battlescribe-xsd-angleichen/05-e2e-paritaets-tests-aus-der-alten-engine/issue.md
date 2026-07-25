Status: resolved
Type: refactor
Blocked by: [01, 02, 03]

## Description
Die „ganze-Pipeline"-E2E-Abdeckung des Reinraum-Evaluators wird um ein
**kuratiertes Kernset an Paritäts-Szenarien** aus der alten Engine (Solver,
`src/solver/`, Seam `validateRoster`) ergänzt. Ziel: belegen, dass die neue
Engine über ihren Seam `evaluate(catalogXml, roster)` dieselben realen
Regel-Situationen korrekt behandelt wie die alte — für die Teilmenge, die im
Zweck des Evaluators liegt (Grenzverletzungen / effektive Werte).

Jedes Szenario wird als **eigenes Evaluator-Fixture** gegen `evaluate` nachgebaut
— **kein Import aus `src/solver/`** (ADR-0030, maschinell erzwungen). Wo der
Evaluator bewusst anders/robuster ist (Fixpunkt, Phantomknoten), ist der
erwartete Wert am tatsächlichen, korrekten Verhalten der neuen Engine
festzumachen, nicht blind aus dem Solver-Test kopiert. Außerhalb des Umfangs
bleiben Szenarien ohne Evaluator-Entsprechung: Autor-Meldungen/Tokens,
Validierungs-Ursachen (ADR-0027), Namen/Profile, UI-Verfügbarkeit (ADR-0022),
i18n, Options-/Selection-Editing, rosterSync.

Die neuen Tests gehören in die E2E-Schicht der Engine (die „ganze-Pipeline"-Ebene
neben `e2e.definitiveEdition.test.js`, z. B. als eigene Paritäts-Testdatei).

## Acceptance Criteria
- [x] **Pflichtselektoren:** roster-weite Pflichteinheit fehlt → MIN-Verletzung,
      vorhanden → keine (Bulls, Issue 62); force-scoped Pflicht je Kontingent →
      Verletzung nur im Kontingent ohne den Eintrag (Issue 17/07); als
      `selectionEntry` UND `entryLink` doppelt codierte Pflicht → genau eine
      Verletzung (Dedupe).
- [x] **Eintrags-Constraints:** Höchstzahl gleicher Einträge je Kontingent
      überschritten → Verletzung; roster-weites Limit über verschiedene
      `entryLink`-Aliase greift; nicht mehr auflösbare Auswahl → Diagnose statt
      Absturz.
- [ ] **Force-/Kategorie-Constraints:** roster-weites Punktelimit überschritten →
      Verletzung; Kategorie-Mindestbesetzung und -Höchstzahl je Kontingent;
      Kategorielimit aus `categoryEntry scope="force"`; `max="-1"` = unbegrenzt
      (keine Verletzung). — teilweise: eine reine Kategorie-**MAX** ohne MIN wird
      **nicht** erzwungen (Befund B1, per Nutzerentscheidung akzeptiert und im Test
      charakterisiert); Punktelimit, Mindestbesetzung und `max="-1"` erfüllt.
- [x] **Gruppen-Constraints:** Punktebudget einer Auswahlgruppe überschritten →
      Verletzung; per Modifikator angehobenes Gruppenlimit wirkt; kategoriegebundenes
      Optionslimit; Gruppengrenze auf einer anderen Kostenart (absolut und Prozent).
- [ ] **forceEntry-eigenes Punktelimit** (Vampire-Counts-Sonderheer) wird erzwungen.
      — nicht direkt ausdrückbar (Befund B2, akzeptiert): Kontingente tragen keine
      Kosten; die Semantik „Heer braucht ≥ N Punkte" ist über eine
      Kategorie-MIN-Kostengrenze erreichbar und so im Test abgebildet.
- [x] **multiply-Modifikator:** „Traditional Army"-Verdopplung fließt in den
      effektiven Wert/die Grenze ein; `multiply` auf einer Nicht-Kosten-Constraint.
- [x] **Bezugsrahmen/Ziel-Typ (§7.7):** Eintrags-Ziel mit `scope="force"` zählt pro
      Kontingent, Kategorie-Ziel zählt armeeweit auch unter `scope="force"`; eine
      nicht geteilte Beschränkung (`shared="false"`) zählt nur die eigene Instanz.
- [x] **Dokumentreihenfolge:** gestapelte, nicht-kommutierende Modifikatoren auf
      demselben Ziel ergeben je nach Reihenfolge unterschiedliche effektive Werte.
- [x] **Prozentgrenze:** eine Prozent-/Kosten-Grenze wird bei Unterschreitung des
      Anteils verletzt, mit kaufmännischer Rundung des Grenzwerts.
- [x] Alle neuen Paritäts-E2E-Tests laufen gegen `evaluate` (kein Solver-Import)
      und sind grün; die gesamte Testsuite bleibt grün.

## Comments
- Neue E2E-Paritaets-Testdatei src/evaluator/e2e.solverParity.test.js: kuratierte reale Szenarien der alten Engine (Solver validateRoster) als eigene Evaluator-Fixtures gegen evaluate() nachgebaut, kein Solver-Import (depcruise 0 errors). Evaluator-Suite gruen (211 Tests). Zwei verifizierte Verhaltensbefunde der neuen Engine dokumentiert und per Nutzerentscheidung akzeptiert (nichts tun, kein Fix, kein Folge-Issue): B1 - eine reine Kategorie-MAX-Grenze ohne begleitende MIN wird nicht erzwungen (Kategoriegrenzen werden nur ueber einen von MIN erzeugten Phantom-Anker ausgewertet; reine MAX ist damit effektiv unbegrenzt, was max=-1 korrekt umsetzt, eine endliche reine MAX aber ungeprueft laesst). B2 - ein forceEntry-eigenes Punktelimit ist nicht direkt ausdrueckbar (Kontingente tragen keine Kosten); Workaround ueber Kategorie-MIN-Kostengrenze. Beide sind vorbestehende Grenzen des Reinraum-Anker-Modells aus Issue 65, keine Regression aus Issue 66. Die betreffenden zwei AC-Punkte bleiben daher ehrlich als teilweise/Workaround markiert.
