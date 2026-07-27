Status: resolved
Type: fix
Blocked by: [01]

## Description

Dies ist die Scheibe, die den gemeldeten Fehler behebt.

Eine gespeicherte Armeeliste benennt jede getroffene Auswahl mit **zwei** Ids:
dem Eintrag, der gewaehlt wurde, und dem Verweis, ueber den er hereinkam (leer,
wenn er direkt gewaehlt wurde). Der Leser der Testumgebung wertet nur die erste
aus und wirft die zweite weg. Damit gilt alles, was am Verweis selbst deklariert
ist, im Test nie.

Beobachtete Folge: eine Pflichtgrenze, die am Verweis haengt, findet die ueber
diesen Verweis gesetzte Auswahl nicht und meldet die Pflicht als unerfuellt,
obwohl sie erfuellt ist — Ist 0 gegen Mindestens 1. Zwei Faelle sind belegt, beide
Pflichtausruestung aus dem Soeldner-Katalog (Handwaffe, leichte Ruestung).

Zwei weitere Dinge gehoeren in dieselbe Scheibe, weil sie ohne einander
widerspruechlich waeren:

**Eine Kohaerenzpruefung.** Sobald beide Ids getragen werden, koennen sie
einander widersprechen — der genannte Verweis zeigt auf ein anderes Ziel als das
genannte. Kataloge werden zur Laufzeit aktualisiert, eine gespeicherte Liste kann
also veralten. Das ist zu melden, nicht stillschweigend zu erraten; im Zweifel
gilt der Verweis, weil er die tragenden Regeln haelt.

**Die bindende Grenze im Bericht.** Nach dieser Aenderung traegt derselbe Knoten
Grenzen aus zwei Quellen: die am Ziel deklarierten und die am Verweis
deklarierten. Sie ueberschreiben einander nicht, sie kommen zusammen. Der
Bericht fuehrt je Knoten aber nur **eine** Untergrenze und **eine** Obergrenze —
bisher gewann schlicht die zuletzt gesehene. Kuenftig muss die **bindende**
gewinnen: bei Untergrenzen die mit dem groessten Fehlbetrag, bei Obergrenzen die
mit dem geringsten Spielraum.

**Aufraeumen.** Drei Auswahlen in zwei Szenarien schreiben heute die Verweis-Id
in **beide** Felder — eine bewusste Umgehung genau dieses Fehlers, die von dem
abweicht, was das echte Werkzeug schreibt. Sie sind auf die reale Form
zurueckzufuehren, sonst verdecken sie den Fix.

## Acceptance Criteria
- [ ] Eine Auswahl, die ueber einen Verweis gesetzt wurde, traegt beide Ids; am Verweis deklarierte Regeln wirken auf sie.
- [ ] Die beiden belegten Pflichtgrenzen (Handwaffe, leichte Ruestung) melden keine Verletzung mehr, und das betroffene Szenario nimmt sie wieder in seine Erwartung auf.
- [ ] Widersprechen sich die beiden Ids einer Auswahl, wird das als Diagnose gemeldet statt geraten; die Auswertung laeuft weiter.
- [ ] Traegt ein Knoten mehrere Unter- oder Obergrenzen, weist der Bericht die bindende aus — groesster Fehlbetrag bei Untergrenzen, geringster Spielraum bei Obergrenzen.
- [ ] Die drei Auswahlen, die heute die Verweis-Id in beide Felder schreiben, tragen wieder die reale Form.
- [ ] Die uebrige Testsuite bleibt gruen; jede geaenderte Erwartung ist einzeln aus den Katalogdaten begruendet und im README des jeweiligen Szenarios belegt — nicht aus der Ausgabe der geaenderten Engine abgelesen.

## Comments
- Gemessener Wirkungsradius aus der Architektur-Planung: 11 von 100 Szenario-Rostern in 6 Szenarien tragen ueberhaupt eine Verweis-Id; bei 6 Rostern in 3 Szenarien deklariert der gebundene Verweis eigene Inhalte, dort aendert sich die Auswertung fachlich. Keiner der 11 gebundenen Verweise deklariert eigene Kosten oder Kategoriezuordnungen — Punktesummen und Kategorien der Suite bleiben unberuehrt.
- Der Zahlenwert im Beschreibungstext des Main-Issues ("13 von 102 Rostern in 4 Szenarien") stammt aus einer Schaetzung und ist durch diese Messung ersetzt.
- Der .ros-Adapter bindet eine Auswahl jetzt an den Verweis (entryLinkId) und fuehrt die Ziel-Id nur als Pruefdatum mit (expectedTargetDefId); die Join-Schicht meldet eine Abweichung als ENTRY_LINK_TARGET_MISMATCH und folgt weiter dem Verweis. Der Bericht waehlt je Slot und Grenzenart die bindende Grenze (groesster Fehlbetrag bei MIN, geringster Spielraum bei MAX) statt der zuletzt ausgewerteten. Die drei Auswahlen, die die Verweis-Id in beide Felder schrieben, sind auf die reale BattleScribe-Form zurueckgefuehrt; modifier-characteristic-value fuehrt dfd9-3e46-eda5-be8b und feb1-c10d-9318-dbda wieder in absent, aus den Katalogdaten im README begruendet.
