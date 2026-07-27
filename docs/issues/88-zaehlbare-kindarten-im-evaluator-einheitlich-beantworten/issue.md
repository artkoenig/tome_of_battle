Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Die Frage "welche Kinder einer Definition sind Auswahlpunkte?" wird im Evaluator
an zwei Stellen unabhaengig beantwortet — mit verschiedenen Antworten. Keine der
Abweichungen wirkt sich heute aus, aber jede kuenftige Kindart muss an beiden
Stellen bedacht werden, und die Beschreibungen stimmen mit keiner von beiden
ueberein.

Gefunden bei der abschliessenden Standards-Pruefung von Main-Issue 76, dessen
eigene Arbeit bereits vollstaendig nachgebessert ist. Die folgenden Punkte
gehoeren bewusst NICHT mehr in jenes Main-Issue: sie sind Konsistenz- und
Beschreibungsfragen der Umgebung, keine offenen Enden seines Auftrags.

**1. Ein Verweis auf eine Gruppe traegt ihre Id doch in die Mitgliederliste.**
Die Beschreibung der Mitglieder-Aufloesung sagt ausdruecklich, die Ids einer
Untergruppe blieben draussen. Fuer eine direkt verschachtelte Gruppe stimmt das;
fuer eine ueber einen Verweis eingebundene nicht — dort landen sowohl der Verweis
als auch die Gruppe in der Liste, obwohl keiner von beiden einen Auswahlpunkt
bezeichnet. Folgenlos nur deshalb, weil eine Abfrage in einem anderen Modul
Knoten ohne Instanz ueberspringt. Zu entscheiden: die Ids eines aufgeloesten
Gruppen-Ziels ebenfalls auslassen und nur rekursieren, oder die Beschreibung auf
das zuruecknehmen, was der Code tatsaechlich tut.

**2. Zwei Traversierungen, zwei Antworten.** Die Mitglieder-Aufloesung zaehlt
Eintraege und Verweise als Auswahlpunkte, die Baum-Traversierung zusaetzlich
Kategorie-Verweise — und Letztere folgt keinem Verweis auf eine Gruppe.
Vermutlich sind beide Abweichungen gewollt, begruendet ist nur eine. Die
Beschreibung der zweiten verschweigt ausserdem die Kategorie-Verweise, die sie
liefert.

**3. Ein verwaister und inhaltlich falscher Beschreibungsblock.** Die
Beschreibung des Kind-Lesers im Katalog-Leser haengt an der falschen Funktion und
nennt nur drei Kindarten, obwohl der Leser seit laengerem auch Kategorie-Verweise
liest. Ausgerechnet diese Tatsache ist die Grundlage von Punkt 1 und 2 — sie
steht falsch da, wo man sie sucht.

**4. Keine strukturelle Absicherung der Messgroessen-Rangfolge.** Seit
Main-Issue 76 ist der Laufzeit-Abbruch die einzige Zusicherung, dass jede an
einem Slot erreichbare Messgroesse in der Rangfolge steht — und er trifft jetzt
jedes Ergebnis. Eine neu hinzugefuegte Messgroesse besteht die vorhandene
Zweiweg-Pruefung, fehlt aber in der Rangfolge; dann bricht jeder Bericht zur
Laufzeit, statt dass ein Test rot wird. Das Haus-Muster fuer solche
Vollstaendigkeits-Pruefungen existiert bereits, nur nicht fuer diese Tabelle.

**5. Ein irrefuehrender Name auf Doku-Ebene.** Das Architektur-Dokument sagt jetzt
ausdruecklich, ein bestimmter Nachschlagewert bedeute *nicht* "eine weitere
Auswahl ist zulaessig" — er heisst aber genau so. Der Vorbehalt ist richtig
dokumentiert, der Name blieb stehen.

**6. Ein Test, der an seinen eigenen Konstanten haengt.** Ein Test des Berichts
baut einen Attrappen-Baum und verlaesst sich darauf, dass eine bestimmte Schicht
auf diesem Weg nie gelesen wird; verschiebt sich die Reihenfolge, schlaegt er mit
einer sachfremden Meldung fehl. Eine seiner Zusicherungen prueft ausserdem nur
seine eigenen Konstanten, nicht den Prueflings-Code.

## Acceptance Criteria
- [ ] Die Frage, welche Kinder einer Definition Auswahlpunkte sind, wird an einer Stelle beantwortet; beide heutigen Traversierungen nutzen sie oder ihre Abweichung ist begruendet.
- [ ] Ein ueber einen Verweis eingebundenes Gruppen-Ziel wird genauso behandelt wie eine direkt verschachtelte Gruppe — oder die Beschreibung sagt, warum nicht.
- [ ] Jede Beschreibung nennt die Kindarten, die ihre Funktion tatsaechlich behandelt, und steht an der Funktion, die sie beschreibt.
- [ ] Eine an einem Slot erreichbare Messgroesse, die in der Rangfolge fehlt, faellt als roter Test auf, nicht erst zur Laufzeit.
- [ ] Der irrefuehrende Name des Nachschlagewerts ist entweder korrigiert oder sein Vorbehalt steht unmittelbar an ihm.
- [ ] Der genannte Test prueft den Prueflings-Code statt seiner eigenen Konstanten und haengt nicht an der Auswertungsreihenfolge.
- [ ] Kein Verhaltenswechsel an echten Katalogdaten; die Testsuite bleibt gruen, keine Erwartung unter docs/testing/ wird abgeschwaecht.

## Comments
- Entstehung: dies ist die vierte Fundrunde der Standards-Achse an Main-Issue 76. Die drei vorangegangenen wurden innerhalb des Main-Issues behoben (Scheiben 04 und 05). Diese Runde wurde bewusst ausgelagert: der beauftragte Fehler ist behoben und belegt, und die Achse prueft ganze Dateien statt nur des Diffs — sie findet daher auch bei sauberem Stand weiter Umgebungs-Befunde. Weiterpolieren im Main-Issue haette dessen Abschluss verhindert, ohne den Auftrag zu verbessern.
- Weiterer Konsistenz-Befund aus der Standards-Pruefung von Main-Issue 77: die Aufbereitung des Datensatzes fuehrt sowohl die Katalog-Dokumente als auch die daraus abgeleitete Menge ihrer Ids und reicht beide an die Kohaerenzpruefung durch. Die zweite ist aus der ersten herleitbar; beide koennen auseinanderlaufen. Moeglicherweise bewusst als Zwischenspeicher gewaehlt — dann gehoert das hingeschrieben.
