Status: ready-for-agent
Type: feature
Blocked by: None

## Description

### Problem
Der Lexicanum-Fork modelliert armeeweite Pflichtwahlen als `selectionEntry` **an der
Katalog-Wurzel** mit einem `scope="force"`-Constraint. Die davon abhängigen
`scope="force"`-Conditions auf Einheiten-Optionen laufen im Editor ins Leere: eine gewählte
Bloodline schaltet die zugehörigen, standardmäßig verborgenen Einheiten-Optionen nicht frei.

Vom Nutzer gemeldet als: „bei Vampieren die Bloodline als globaler Schalter in der Liste"
wird nicht ausgewertet — alle Vampiric Powers aller Bloodlines erscheinen gleichzeitig,
unabhängig von der gewählten Bloodline.

### Bestätigter Befund (Daten + Code, per E2E-Repro verifiziert)
- **Daten (Vampire Counts):** `selectionEntry` „Bloodlines" liegt direkt unter
  `catalogue > selectionEntries`, trägt aber (anders als ursprünglich angenommen) einen
  primären `categoryLink` auf „Special list rules" — der bestehende Kategorie-Adder im
  Editor kann sie deshalb bereits normal anzeigen und auswählen lassen; das wurde per
  E2E-Repro bestätigt (Bloodline-Auswahl landet korrekt im Roster). Der `min=1`-Constraint
  (armeeweite Pflichtwahl, genau eine von 5 Clan-Bloodlines) selbst wird aber nicht
  validiert. Die gewählte Bloodline soll Einheiten-Powers freischalten über
  `entryLink`s mit `hidden=true` und einem Modifier
  `set hidden=false, condition atLeast 1 selections scope=force childId=<Bloodline-Wahl>`
  — ein für BattleScribe-Daten normales Muster (mehrere gleichnamige, bedingt versteckte
  Options-Gruppen, hier alle „Vampiric Powers" genannt, eine pro Bloodline).
- **Code:** Die Options-Sammlung pro Einheit (liefert die Liste, die der Editor unter einer
  Einheit als „Optionen & Ausrüstung" anzeigt) flacht verschachtelte `entryLink`s/Gruppen
  rekursiv ab, ohne deren `hidden`-Flag oder Modifier-Bedingungen auszuwerten — die dafür
  vorhandene, funktionierende Auswertungslogik (genutzt vom Kategorie-Adder, um Einheiten
  ein-/auszublenden) wird in diesem Codepfad nie aufgerufen. Zusätzlich werden die
  abgeflachten Optionen im Editor **nach Gruppennamen-String** zusammengeführt: da alle 5
  Bloodline-spezifischen Gruppen identisch „Vampiric Powers" heißen, verschmelzen sie zu
  einer einzigen Gruppe, deren Modifier großteils verworfen werden und ohnehin nirgends zur
  Filterung herangezogen werden. Ergebnis: alle Powers aller Bloodlines erscheinen
  gleichzeitig.
- Die Condition-Auswertung selbst (`atLeast`/`atMost`/`notInstanceOf`, `scope="force"`) ist
  bereits korrekt implementiert (Issues `14` und `05`, beide `resolved`) — die Lücke liegt
  spezifisch in der Options-Sammlung/-Gruppierung pro Einheit, nicht im Evaluator.

### Gewünschtes Verhalten
Die Options-Sammlung/-Gruppierung pro Einheit im Editor respektiert `hidden`-Flags und
Modifier-Bedingungen bedingt versteckter Options-Gruppen, statt sie ungeprüft abzuflachen
und gleichnamige Gruppen unterschiedslos zu verschmelzen. Ein armeeweiter, force-scoped
Wurzel-`selectionEntry` ist im Editor als Selektor sicht- und konfigurierbar (für Fälle ohne
passenden `categoryLink` ggf. als eigener armee-/listenweiter Konfigurator), sein
`scope="force"`-Pflicht-Constraint wird validiert, und die davon abhängigen
`scope="force"`-Conditions/Modifiers auf Einheiten-Optionen werden korrekt ausgewertet (z. B.
schaltet die gewählte Vampir-Bloodline nur die passenden Vampiric Powers an den Einheiten
frei, alle anderen bleiben verborgen).

### Hinweise
- Dies ist eine **App-Fähigkeitslücke**, kein Datenfehler — die Daten sind
  BattleScribe-konform. Nicht durch Daten-Downgrade „lösen".
- Import-Verfügbarkeit der Kataloge ist bereits durch Child-Issue 03
  (Abhängigkeitsschutz für Library-Kataloge) abgesichert.
- Verwandt: Issues `14` (fehlende Condition-Typen im Evaluator) und `05` (Fehlvalidierung bei
  bloodline-gated Option) sind bereits `resolved` — die Condition-Auswertung selbst
  funktioniert, die Lücke liegt in der Options-Sammlung/-Gruppierung pro Einheit im Editor.
- Der `issue-implementer` reproduziert zuerst E2E (Vampire Counts, „Vampire Count" als Lord
  hinzufügen, unter „Special list rules" eine Bloodline wählen, prüfen ob „Vampiric Powers"
  korrekt filtert), bevor er fixt.

## Acceptance Criteria
- [ ] Nach Wahl einer Bloodline (z. B. „Bloodline of Clan Blood Dragon" unter „Special list
  rules") zeigt eine Vampire-Einheit im Editor nur noch die Vampiric Powers dieser Bloodline
  an, nicht mehr die aller Bloodlines gleichzeitig.
- [ ] Ohne gewählte Bloodline bleiben die Bloodline-spezifischen Vampiric Powers verborgen.
- [ ] Das `scope="force"`-Pflicht-Constraint des Bloodline-Selektors (genau eine von 5) wird
  validiert.
- [ ] Ein force-scoped Wurzel-`selectionEntry` ohne passenden `categoryLink` ist im Editor
  ebenfalls sicht- und konfigurierbar (nicht nur der Sonderfall mit `categoryLink`).
- [ ] Regressionsschutz: bestehende Einheiten-Optionen und die Fälle aus Issues `05`/`14`
  bleiben korrekt.

## Comments
- Per E2E-Repro verifiziert und Beschreibung präzisiert: Bloodline-Auswahl selbst funktioniert bereits (categoryLink auf 'Special list rules' vorhanden), die Lücke liegt in der ungefilterten Options-Sammlung/-Gruppierung pro Einheit im Editor (hidden/Modifier-Flags werden dort nie ausgewertet, gleichnamige Gruppen werden unterschiedslos verschmolzen). Auf ready-for-agent triagiert.
