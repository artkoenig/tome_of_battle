Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

**Geruch:** Divergent Change und DRY-Verstoß.

Die Importer-Komponente umfasst rund 685 Zeilen und ändert sich aus vier
unabhängigen Gründen: Darstellung der Revisionen, Prüfung der
Bibliotheks-Abhängigkeiten, Verarbeitung des Katalogquellen-Index und die
eigentliche Oberfläche.

Das Symptom steht im Code selbst: drei Logikfunktionen werden exportiert,
obwohl nur die Komponente und die Tests sie nutzen. Die Tests wollen an Logik
heran, die nicht in einer Komponente sitzen sollte.

**Zusätzlich — eine inhaltliche Lücke durch Duplikation:** Der Bundle-Import
und der Datei-Upload formulieren den Abschluss des Imports zweimal getrennt
aus (Schema-Warnung, Verarbeitung, Anhängen der Roh-XML, Speichern,
Erfolgsmeldung, Neuladen). Die Prüfung fehlender Bibliotheks-Abhängigkeiten
existiert dabei **nur im Bundle-Pfad**, obwohl ein hochgeladenes Archiv
dieselbe unvollständige Katalogauswahl enthalten kann. Die Zusammenführung
schließt diese Lücke unmittelbar mit.

**Vorgeschlagene Behebung:** Die Index- und Quellenverarbeitung in die
Datenschicht abspalten, die Revisions-Darstellung in ein eigenes Modul; der
Abschluss des Imports wird zu einer gemeinsamen Funktion, die beide Pfade
aufrufen. Die Komponente bleibt reine Darstellung.

## Acceptance Criteria
- [ ] Die Verarbeitung des Katalogquellen-Index liegt in der Datenschicht und
      ist ohne die Komponente testbar
- [ ] Die Revisions-Darstellung liegt in einem eigenen Modul
- [ ] Der Abschluss des Imports existiert genau einmal; beide Importpfade
      rufen ihn auf
- [ ] Die Prüfung fehlender Bibliotheks-Abhängigkeiten greift auch beim
      Datei-Upload; ein Test belegt das
- [ ] Es werden keine Funktionen mehr allein zu Testzwecken aus der Komponente
      exportiert
- [ ] `npm run lint` und `npm test` bleiben grün; abgesehen von der
      geschlossenen Prüflücke kein verändertes Verhalten

## Comments

Berührt dieselben Dateien wie der offene Pull Request zur
UI-Internationalisierung — erst nach dessen Merge bearbeiten.

Die geschlossene Prüflücke beim Datei-Upload ist streng genommen eine
Verhaltensänderung. Sie ist hier bewusst zugelassen, weil sie unmittelbar aus
der Entdopplung folgt und ohne sie eine bekannte Lücke bestehen bliebe.
