Status: resolved
Type: chore
Blocked by: None

## Description
Reinraum-Evaluator: gruppen-skopierte Zähl-Constraints (scope=parent auf selectionEntryGroup) auswerten

## Acceptance Criteria
- [ ]

## Comments
- Problem: Zähl-Constraints (min/max, field=selections) auf einer selectionEntryGroup mit scope=parent werden von evaluate() nie gemeldet. Verifiziert per Testlauf: die 3 it.skip-Tests in src/evaluator/e2e.bloodlines.ros.test.js (def-03 max 39c7; erg e02 min 56c1; erg e03 max 6d0c) feuern nicht.

Ursache (Datenfluss evalTree->countIndex->constraints): (1) kein Baumknoten trägt den Gruppen-Def, daher wertet evaluateConstraints die Gruppen-Limits nie aus; (2) Mitgliedschaft ist nicht modelliert — der Index zählt nur unter [null, eigene ID, Kategorien], nie unter der Gruppen-ID; (3) Phantom-Synthese deckt nur roster/force ab, nicht parent.

Lösung (bestätigt: einheitliche Query-Zählstelle; min@0 als Verletzung melden):
- resolver.js: Gruppen-Mitgliedschaft ableiten (Member-IDs je Gruppe inkl. entryLink-Ketten/Untergruppen), analog Solver collectGroupItemIds.
- evalTree.js: pro Eigentümer-Auswahl je Gruppe-mit-Limits einen nicht-zählenden Gruppen-Anker synthetisieren (immer präsent -> min@0 und max feuern); Member-Knoten mit Gruppen-ID annotieren.
- countIndex.js: Gruppen-ID des Members in targetsOf aufnehmen, sodass scope=parent target=Gruppe die Member zählt.
- constraints.js/report.js: unverändert.

Akzeptanz: die 3 it.skip in e2e.bloodlines.ros.test.js entsperren und grün; gesamte src/evaluator-Suite bleibt grün. Referenz: Solver-Sonderpfad checkGroupConstraints (rosterValidator.js:696ff).
