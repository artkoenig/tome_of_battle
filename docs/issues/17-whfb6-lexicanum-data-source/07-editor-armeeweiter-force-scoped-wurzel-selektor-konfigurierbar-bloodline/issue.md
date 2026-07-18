Status: needs-triage
Type: feature
Blocked by: None

## Description

### Problem
Der Lexicanum-Fork modelliert armeeweite Pflichtwahlen als `selectionEntry` **an der
Katalog-Wurzel** mit einem `scope="force"`-Constraint. Der Editor der App kennt aber nur
„Einheit über ihre primäre Kategorie aushebeln" — es gibt kein Konzept für einen armee-/
force-weiten Selektor. Solche Wurzel-Selektoren erscheinen daher nirgends im Editor
(„globaler Schalter" fehlt), und die von ihnen abhängigen `scope="force"`-Conditions auf
Einheiten laufen ins Leere.

Vom Nutzer gemeldet als: „bei Vampieren die Bloodline als globaler Schalter in der Liste"
wird nicht ausgewertet.

### Bestätigter Befund (Daten + Code)
- **Daten (Vampire Counts):** `selectionEntry` „Bloodlines" liegt direkt unter
  `catalogue > selectionEntries` (nicht unter einer Einheit), mit
  `constraint type=min field=selections scope="force" value=1` (armeeweite Pflichtwahl,
  genau eine von 5 Clan-Bloodlines). Die gewählte Bloodline schaltet Einheiten-Powers frei
  über `condition type=atLeast/instanceOf field=selections scope="force" childId=<Clan>`.
- **Code:** Der Editor fügt Selektionen ausschließlich über die primäre Kategorie hinzu
  (Kategorie-Adder filtert `catalogue.selectionEntries` nach `categoryLink.primary`). Es
  existiert kein Pfad, über den ein force-scoped Wurzel-`selectionEntry` in den Editor
  gelangt. `modifierEvaluator` kennt `scope="force"/"roster"` nur teilweise.

### Gewünschtes Verhalten
Ein armeeweiter, force-scoped Wurzel-`selectionEntry` wird im Editor als armee-/listenweiter
Konfigurator angeboten (nicht als Einheit), seine `scope="force"`-Constraints (Pflicht/Max)
werden validiert, und die davon abhängigen `scope="force"`-Conditions/Modifiers auf Einheiten
werden korrekt ausgewertet (z. B. schaltet die gewählte Vampir-Bloodline die passenden
Vampiric Powers an den Einheiten frei).

### Hinweise
- Dies ist eine **App-Fähigkeitslücke**, kein Datenfehler — die Daten sind
  BattleScribe-konform. Nicht durch Daten-Downgrade „lösen".
- Import-Verfügbarkeit der Kataloge ist bereits durch Child-Issue 03
  (Abhängigkeitsschutz für Library-Kataloge) abgesichert.
- Verwandt/zu berücksichtigen: bestehende Issues `14` (fehlende Condition-Typen im
  Evaluator) und `05` (Fehlvalidierung bei bloodline-gated Option) — überschneidet sich mit
  der force-scoped Condition-Auswertung hier.
- Der `issue-implementer` reproduziert zuerst E2E (Import Vampire Counts + Mercenaries,
  Editor öffnen) und bestätigt den exakten Editor-Codepfad, bevor er fixt.

## Acceptance Criteria
- [ ] Ein force-scoped Wurzel-`selectionEntry` (Beispiel: Vampire „Bloodlines") ist im
  Editor als armeeweiter Selektor sicht- und konfigurierbar.
- [ ] Das `scope="force"`-Pflicht-/Max-Constraint des Selektors wird validiert (genau eine
  Bloodline erforderlich).
- [ ] Von der Auswahl abhängige `scope="force"`-Conditions auf Einheiten werden ausgewertet
  (gewählte Bloodline schaltet die passenden Powers/Optionen frei, andere bleiben verborgen).
- [ ] Regressionsschutz: bestehende Einheiten-Optionen und die Fälle aus Issues `05`/`14`
  bleiben korrekt.

## Comments
