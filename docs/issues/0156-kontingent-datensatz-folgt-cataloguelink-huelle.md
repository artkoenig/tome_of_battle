---
status: backlog
branch:
pr:
---

# Kontingent-Datensatz und Wurzel-Angebot folgen der catalogueLink-Hülle

## Goal
Ein Kontingent wird ausschließlich gegen sein eigenes Armeebuch, die transitive
`catalogueLink`-Hülle dieses Buchs und das Spielsystem ausgewertet — ein fremdes
Armeebuch liefert weder Definition noch Angebot mehr hinein.

## Acceptance criteria
- AC1 Der Auswertungsumfang eines Kontingents ist genau sein Armeebuch, dessen transitive `catalogueLink`-Hülle und das Spielsystem; eine Definition aus einem Katalog außerhalb davon erreicht dieses Kontingent nicht mehr. | verify: forge-test --run src/evaluator
- AC2 Ein Wurzel-Eintrag wird einem Kontingent nur angeboten, wenn der ihn deklarierende Katalog in diesem Umfang liegt. Die bisherige Ausnahme, die den Wurzel-`entryLink` eines FREMDEN Armeebuchs unabhängig von der Herkunft als Angebot verankerte, entfällt ersatzlos. | verify: forge-test --run src/evaluator
- AC3 Der Riese der O&G Definitive Edition steht weiterhin im Aushebedialog unter "Selten", jetzt über den O&G-eigenen Wurzel-`entryLink`. | verify: forge-test --run CategoryUnitAdder.giantRare
- AC4 Ein Roster, das eine Auswahl außerhalb des Umfangs seines Kontingents enthält, erzeugt eine Diagnose oder Verletzung — nie einen stillen Absturz und nie eine stille Teil-Auswertung. | verify: forge-test --run src/evaluator
- AC5 Die Szenarien `docs/testing/violation-classification` und `docs/testing/offer-and-category-slots` bleiben inhaltlich unverändert und laufen gegen den neuen Stand; das dadurch entstehende Rot ist mit Begründung als bekannte Ausnahme festgehalten, sodass der Prüflauf ein definiertes Ergebnis hat.
- AC6 ADR-0032 hält die geänderte Rolle des `catalogueLink` fest — Umfangs- und Auflösungsgrenze statt reiner Abhängigkeits-Deklaration — als Nachtrag oder Nachfolge-ADR, samt der widerrufenen Begründung "weil alle benötigten Kataloge gemeinsam als Quellen übergeben werden".
- AC7 Alle Checks grün, abgesehen von der unter AC5 festgehaltenen Ausnahme. | verify: forge-test && forge-lint && forge-typecheck && forge-build

## Out of scope
- Die Katalog- und Fixture-Daten selbst: kein `.cat`, `.gst` oder `.ros` wird geändert.
- Der Herkunftsfilter des Aushebedialogs bleibt als zweite Sicherung bestehen.
- Kein Version-Bump — der wird vor dem Merge separat entschieden.
