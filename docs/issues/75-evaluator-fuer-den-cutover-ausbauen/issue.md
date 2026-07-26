Status: needs-triage
Type: refactor
Blocked by: None

## Description

# PRD: Reinraum-Engine für den produktiven Cutover ausbauen

## Problem Statement

ADR-0030 hat entschieden, dass die Reinraum-Engine (`src/evaluator/`) die alte,
als fehlerhaft eingestufte Engine (`src/solver/`) vollständig ablöst. Offen ist
allein der Cutover. Er scheitert heute nicht am Willen, sondern an einer
Deckungslücke: die Oberfläche bezieht von der alten Engine 69 verschiedene
Namen, der Bericht der neuen Engine trägt Verletzungen als Zahlen-Tripel,
Fähigkeitsdatensätze je belegtem Slot und Diagnosen — mehr nicht.

Konkret fehlt dem Bericht alles, was die Oberfläche außerhalb der reinen
Constraint-Arithmetik braucht:

1. **Das Angebot.** Fähigkeitsdatensätze entstehen nur für Slots, die im Roster
   existieren, plus Phantom-Anker für Pflichtdefinitionen. Der Editor muss aber
   jede *wählbare* Option anzeigen — auch die mit Anzahl 0 und ohne Pflicht.
2. **Die Einordnung einer Verletzung.** Der Bericht nennt Grenzwert, Ist-Wert und
   Differenz, aber nicht, *welche Art* Grenze an *welcher Art* Anker in welchem
   Bezugsrahmen gerissen ist, welcher Schweregrad gilt, welche Auswahl die
   Ursache war (ADR-0027) und wie eine Autor-Meldung des Katalogs lautet
   (ADR-0028). Ohne diese Einordnung kann die Oberfläche keinen übersetzten Satz
   erzeugen; die Validierungsanzeige fiele auf nackte Zahlen zurück.
3. **Profile und Regeltexte.** Die Engine liest Profile, Regeln, Info-Gruppen und
   Info-Links vollständig ein und löst Verweise auf, gibt sie aber nirgends
   aus. Zusätzlich kennt der Modifikator-Kern keine Charakteristik und keinen
   Namen als Ziel — Werte und Namen, die ein Katalog bedingt verändert, blieben
   nach dem Cutover unverändert stehen. Das ist zugleich der offene Fehler in
   Issue 24.
4. **Katalog-Metadaten ohne Roster.** Kostenarten mit Klartext-Namen, spielbare
   gegenüber reinen Bibliotheks-Katalogen und die anlegbaren Kontingente werden
   gebraucht, *bevor* ein Roster existiert — dafür gibt es keinen Slot und damit
   keinen Fähigkeitsdatensatz.

Solange diese vier Lücken offen sind, kann die Oberfläche nicht umgestellt
werden, und die bewusst als vorübergehend eingegangene Duplikation zweier Engines
(ADR-0030) bleibt bestehen.

## Desired Behavior / Outcome

Nach dieser Änderung trägt der Bericht der Reinraum-Engine alles, was sich aus
Katalogdaten ableiten lässt — die Oberfläche projiziert ihn nur noch und rechnet
nichts selbst nach (`docs/evaluator-architecture.md` §4.8, Leitprinzip 3). Die
Oberfläche selbst wird in dieser Phase **nicht** angefasst; nachweisbar ist das
Ergebnis über die Engine-Fassade und die datengetriebene E2E-Suite.

Im Einzelnen ist die Auswertung dann fähig:

- **Angebot statt nur Bestand.** Für jede im jeweiligen Bezugsrahmen wählbare
  Definition liegt ein Fähigkeitsdatensatz vor, unabhängig davon, ob sie im
  Roster vorkommt. Er sagt: wie viele davon sind gewählt, wie viele sind
  mindestens verlangt, wie viele höchstens erlaubt, wie viele passen noch, ist
  sie gesperrt, ist sie versteckt, welche bedingten Hinweise hängen an ihr.
  Damit ist die Frage „darf diese Einheit ausgehoben werden?" eine Lesefrage an
  den Bericht — nicht mehr ein Vergleich zweier Validierungsläufe.
- **Auch Kategorien sind im Bericht sichtbar.** Eine Kategorie ist kein
  Auswahl-Slot, wird von der Oberfläche aber als eigener Abschnitt mit eigenen
  Grenzen dargestellt. Der Bericht sagt deshalb auch für Kategorien, welches
  Mindest- und Höchstmaß gilt, wie viel davon belegt ist und ob sie versteckt
  ist — womit eine budget-gesteuert ausgeblendete Kategorie („Lord unter 2000
  Punkten") als nicht verfügbar beobachtbar wird. Das war bislang eine
  ausdrücklich offene Grenze von ADR-0030 und ist als Issue 71 getrennt geführt
  worden; es ist Teil dieser Spezifikation.
- **Verletzungen sind fachlich eingeordnet.** Jede Verletzung nennt sprachfrei
  ihre Art der Grenze, ihren Bezugsrahmen, die Art des Ankers, Ist-Wert, Grenze
  und Differenz, ihren Schweregrad sowie die auslösenden Auswahlen als Ursache
  im Sinne von ADR-0027. Eine Autor-Meldung des Katalogs kommt als Katalogtext
  mit aufgelösten Text-Tokens (ADR-0028). Aus dieser Einordnung lässt sich
  eindeutig und ohne Rateschritt ein Anzeigetext bestimmen.
- **Profile, Regeln und Namen stimmen.** Zu jedem Slot liefert der Bericht die
  für ihn geltenden Profile und Regeltexte, einschließlich der aus
  Unter-Auswahlen geerbten und ohne die versteckten. Bedingte Modifikatoren auf
  Charakteristiken und auf Namen wirken sich dabei aus.
- **Der Datensatz ist beschreibbar.** Ohne dass ein Roster existiert, lässt sich
  dem aufbereiteten Datensatz entnehmen, welche Kostenarten es mit welchem Namen
  gibt, welche Kataloge spielbar und welche reine Bibliotheken sind, und welche
  Kontingente sich anlegen lassen.
- **Systemfremde Sonderfälle gibt es nicht.** Die Engine bleibt systemagnostisch:
  keine hartkodierten Katalog-IDs, keine Stichwort-Heuristiken auf Namen.

## User Stories / Requirements

1. Als Spieler will ich im Aushebe-Dialog sehen, welche Einheiten ich noch
   aufstellen darf und warum eine gesperrt ist, damit ich nicht raten muss.
2. Als Spieler will ich zu jeder Auswahl alle wählbaren Optionen sehen — auch
   die, die ich noch nicht gewählt habe — samt der Anzahl, die noch hineinpasst.
3. Als Spieler will ich Validierungsmeldungen in meiner Sprache lesen, mit der
   Angabe, welche Auswahl die Überschreitung ausgelöst hat.
4. Als Spieler will ich eine Autor-Meldung meines Katalogs im Wortlaut des
   Katalogs sehen, mit aufgelösten Platzhaltern.
5. Als Spieler will ich im Spielmodus die Werte einer Einheit so sehen, wie sie
   nach allen greifenden Katalog-Modifikatoren tatsächlich gelten — einschließlich
   veränderter Charakteristiken und veränderter Namen.
6. Als Spieler will ich beim Anlegen einer Liste nur die tatsächlich spielbaren
   Kataloge, die anlegbaren Kontingente und meine Kostenart im Klartext
   angeboten bekommen.
7. Als Wartender will ich, dass die Auswertung eine reine Funktion über Datensatz
   und Roster bleibt, damit ihr Verhalten reproduzierbar prüfbar ist.

## Constraints & Settled Decisions

- **Der Bericht ist die alleinige Quelle der Oberfläche.** Alles, was sich aus
  Katalogdaten ableitet, gehört in den Bericht; die Oberfläche projiziert ihn und
  rechnet nichts nach. Ausgenommen bleiben reine Anzeige-Entscheidungen — welcher
  übersetzte Satz zu welcher Verletzungsart gehört, wie eine Zahl formatiert
  wird. Begründung: eine zweite Rechenstelle in der Oberfläche ist genau die
  Erosion, die ADR-0023 für die alte Engine mühsam zurückbauen musste.
- **Verfügbarkeit ergibt sich aus dem Fähigkeitsdatensatz, nicht aus einem
  Validierungs-Diff.** Weil künftig jede wählbare Definition einen Slot hat,
  entfällt das hypothetische Hinzufügen mit anschließendem Vergleich gegen eine
  Baseline. **Das löst ADR-0022 ab** — der ADR ist mit dieser Änderung zu
  revidieren.
- **Die Engine bleibt sprachfrei und kennt keine Meldungsschlüssel.** Sie ordnet
  eine Verletzung fachlich ein; welchen i18n-Schlüssel die Oberfläche daraus
  wählt, ist ein Vertrag der Oberfläche (ADR-0026). Begründung: Meldungsschlüssel
  sind eine UI-Angelegenheit und hätten im Reinraum-Kern nichts verloren.
- **Das Eingabe-Widget folgt dem aktuellen effektiven Stand.** Die Engine rechnet
  nicht über mögliche Welten. Hebt ein bedingter Modifikator ein Gruppen-Maximum
  an, wechselt die Darstellung mit dem nächsten Bericht. Bekanntes Restrisiko:
  eine Gruppe, deren Maximum nur durch eine Auswahl steigt, die die
  Einzelauswahl-Darstellung selbst verhindert, wäre nicht erreichbar; ein solcher
  Katalogfall ist nicht bekannt, aber nicht ausgeschlossen.
- **Systemgebundene Sonderfälle werden an der Datenquelle repariert, nicht in der
  Engine.** Der heutige Vererbungs-Sonderfall (eine Kategorie erbt ein fehlendes
  Maximum von einer anderen) wird in den Katalog-Forks korrigiert (ADR-0014,
  ADR-0017); weil beide Quellen parallel laufen (ADR-0018), in beiden. Bis die
  Korrektur ausgeliefert ist, erzwingt die Anwendung dieses gemeinsame Maximum
  nicht — bewusst hingenommen. **Externe Abhängigkeit außerhalb dieses
  Repositories.**
- **Die alte Engine ist kein Sollwert.** Abweichungen im Auswertungsergebnis sind
  gewollt und werden nicht untersucht (ADR-0030). Das gilt ausdrücklich auch für
  die in ADR-0032 dokumentierten Unterschiede.
- **Der Katalog-Vorlauf wird gemessen, bevor er optimiert wird.** Die Aufbereitung
  des Datensatzes (lesen, zusammenführen, auflösen) geschieht heute bei jeder
  Auswertung neu; durch das erweiterte Angebot wächst zudem der
  Auswertungsbaum. Ob und wie ein Zwischenergebnis wiederverwendet wird — und
  damit, ob die Fassade ein- oder zweistufig ist — entscheidet eine Messung an
  echten Katalogdaten, nicht eine Vermutung. Die Messung ist Abnahmebedingung.
- Relevante ADRs: **ADR-0034** (Bericht als alleinige Quelle der Oberfläche —
  hält die Grenze fest), **ADR-0035** (Verfügbarkeit aus Fähigkeitsdatensätzen,
  **ersetzt ADR-0022**), ADR-0030 (Reinraum-Engine als Nachfolger), ADR-0032
  (Mehrkatalog-Auflösung), ADR-0031 (XSD-Syntax, geteilte Enum-SSOT), ADR-0033
  (manifest-getriebene E2E-Autorenschaft), ADR-0027, ADR-0028, ADR-0026,
  ADR-0011, ADR-0003, ADR-0016.

## Testing Decisions

- **Zu prüfendes Verhalten:** dass eine wählbare, aber nicht gewählte Option im
  Bericht mit korrektem Mindest-, Höchstwert und Restspielraum erscheint; dass
  eine ausgeschöpfte Grenze die betroffene Option als gesperrt ausweist; dass
  eine versteckte Option als versteckt erscheint; dass eine Verletzung ihre Art,
  ihren Bezugsrahmen, ihren Ankertyp, ihren Schweregrad und ihre Ursache trägt;
  dass eine Autor-Meldung mit aufgelösten Platzhaltern erscheint; dass ein
  bedingter Modifikator auf eine Charakteristik und auf einen Namen im Bericht
  sichtbar wird; dass sich Kostenarten, spielbare Kataloge und anlegbare
  Kontingente ohne Roster ermitteln lassen.
- **Nahtstellen:**
  1. die Engine-Fassade — Auswertung und Datensatz-Beschreibung, geprüft über
     neue Szenarien der datengetriebenen E2E-Suite an echten Katalogdaten
     (ADR-0033), verfasst durch den Black-Box-Autor;
  2. die bestehenden Modul-Tests der Engine für die neuen Modifikator-Ziele;
  3. ein reproduzierbares Messverfahren für den Katalog-Vorlauf, dessen Ergebnis
     die zurückgestellte Wiederverwendungs-Entscheidung trägt.

## Out of Scope

- **Die Umstellung der Oberfläche und das Entfernen der alten Engine.** Das ist
  das unmittelbare Folge-Main-Issue („Cutover"): den Adapter zwischen
  App-Roster und Engine-Roster bauen, die 22 Dateien der Oberfläche auf den
  Bericht umstellen, die Projektion von Verletzungsart auf Meldungsschlüssel
  anlegen, die anwendungsweiten Puppeteer-Tests aus dem Solver-Ordner umziehen
  und `src/solver/` samt seiner Testsuite löschen. Grund für die Trennung: diese
  Phase ist ohne Wirkung auf den Nutzer und für sich prüfbar; der Cutover ist es
  nicht.
- Die Korrektur der Katalogdaten in den Fork-Repositories.
- Import, ZIP-Entpacken, XSD-Gate, Katalog-Editor und Update-Erkennung — sie
  bleiben Aufgabe der Import-Pipeline (ADR-0030).
- Die Umstellung der Anwendung auf eine geänderte Roster-Datenstruktur; das
  Referenzmodell aus ADR-0011 bleibt unangetastet.
- Inkrementelle Neuauswertung nur geänderter Teilbäume.

## Acceptance Criteria
- [ ]

## Comments
