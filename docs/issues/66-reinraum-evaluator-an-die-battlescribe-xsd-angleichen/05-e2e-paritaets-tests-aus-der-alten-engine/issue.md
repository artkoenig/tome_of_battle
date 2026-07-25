Status: claimed
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
- [ ] **Pflichtselektoren:** roster-weite Pflichteinheit fehlt → MIN-Verletzung,
      vorhanden → keine (Bulls, Issue 62); force-scoped Pflicht je Kontingent →
      Verletzung nur im Kontingent ohne den Eintrag (Issue 17/07); als
      `selectionEntry` UND `entryLink` doppelt codierte Pflicht → genau eine
      Verletzung (Dedupe).
- [ ] **Eintrags-Constraints:** Höchstzahl gleicher Einträge je Kontingent
      überschritten → Verletzung; roster-weites Limit über verschiedene
      `entryLink`-Aliase greift; nicht mehr auflösbare Auswahl → Diagnose statt
      Absturz.
- [ ] **Force-/Kategorie-Constraints:** roster-weites Punktelimit überschritten →
      Verletzung; Kategorie-Mindestbesetzung und -Höchstzahl je Kontingent;
      Kategorielimit aus `categoryEntry scope="force"`; `max="-1"` = unbegrenzt
      (keine Verletzung).
- [ ] **Gruppen-Constraints:** Punktebudget einer Auswahlgruppe überschritten →
      Verletzung; per Modifikator angehobenes Gruppenlimit wirkt; kategoriegebundenes
      Optionslimit; Gruppengrenze auf einer anderen Kostenart (absolut und Prozent).
- [ ] **forceEntry-eigenes Punktelimit** (Vampire-Counts-Sonderheer) wird erzwungen.
- [ ] **multiply-Modifikator:** „Traditional Army"-Verdopplung fließt in den
      effektiven Wert/die Grenze ein; `multiply` auf einer Nicht-Kosten-Constraint.
- [ ] **Bezugsrahmen/Ziel-Typ (§7.7):** Eintrags-Ziel mit `scope="force"` zählt pro
      Kontingent, Kategorie-Ziel zählt armeeweit auch unter `scope="force"`; eine
      nicht geteilte Beschränkung (`shared="false"`) zählt nur die eigene Instanz.
- [ ] **Dokumentreihenfolge:** gestapelte, nicht-kommutierende Modifikatoren auf
      demselben Ziel ergeben je nach Reihenfolge unterschiedliche effektive Werte.
- [ ] **Prozentgrenze:** eine Prozent-/Kosten-Grenze wird bei Unterschreitung des
      Anteils verletzt, mit kaufmännischer Rundung des Grenzwerts.
- [ ] Alle neuen Paritäts-E2E-Tests laufen gegen `evaluate` (kein Solver-Import)
      und sind grün; die gesamte Testsuite bleibt grün.

## Comments
