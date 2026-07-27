Status: resolved
Type: refactor
Blocked by: [05, 07]

## Description

Wiederholt die Messung aus Slice 02 am gewachsenen Auswertungsbaum und
entscheidet damit, was die PRD offen gelassen hat: ob der aufbereitete Datensatz
wiederverwendet wird und die Fassade deshalb zweistufig ausfaellt, oder ob eine
einstufige genuegt.

Die Entscheidung faellt an Zahlen, nicht an einer Vermutung.

## Acceptance Criteria
- [ ] Die Messung aus Slice 02 ist am gewachsenen Baum wiederholt und den Grundlinienwerten gegenuebergestellt.
- [ ] Der Anteil der Datensatz-Vorbereitung an einer Auswertung ist getrennt ausgewiesen.
- [ ] Der Entscheid ein- gegen zweistufige Fassade ist getroffen, an den vorab festgelegten Schwellen begruendet und im Issue festgehalten.
- [ ] Faellt der Entscheid zweistufig aus, ist die Fassade entsprechend geschnitten und die Behauptung aus docs/evaluator-architecture.md ueber das gecachte Aufloesungs-Ergebnis erstmals wahr.
- [ ] Faellt er einstufig aus, ist die anderslautende Aussage in docs/evaluator-architecture.md korrigiert statt stehen gelassen.

## Comments
- Belegter Bedarfsnachweis fuer die zweistufige Fassade aus dem echten Verbraucher: Der E2E-Manifest-Runner (src/evaluator/e2e.testcatalog.test.js) memoisiert nur die rohen XML-Strings, nicht die Aufbereitung — jeder der 94 Faelle parst denselben Datensatz erneut. Seit Slice 06 blockiert das den Vitest-Worker so lange synchron, dass dessen Reporter-Kanal einen unhandled error 'Timeout calling onTaskUpdate' wirft (vitest/dist/chunks/rpc, nicht Produktivcode). Nachgewiesen: bei Commit 16a39c4 (vor Slice 06) 635 Tests ohne Fehler, mit Slice 06 658 Tests mit dem Fehler; isoliert reproduziert er in e2e.testcatalog.test.js allein (94 Tests, 62 s). Alle Tests bestehen, aber Vitest warnt ausdruecklich vor falsch-positiven Ergebnissen. Der Fehler ist damit kein Zufallsbefund, sondern die Kostenmessung in Testform: 99 % der Laufzeit ist Aufbereitung. Slice 08 soll ihn nicht separat wegkonfigurieren, sondern durch die zweistufige Fassade beheben — der Runner bereitet den Datensatz je Szenario einmal auf und wertet die Roster dagegen aus.
- Offene Frage aus Slice 06, die in die Entscheidung ueber die Berichtsform gehoert: Das Spielsystem deklariert formatRules an den Charakteristik-Typen (Beispiel Sv: '^7+$' → '-'). Die Engine liefert derzeit die Rohwerte. Zu entscheiden ist, ob der Bericht die Formatierung anwendet oder die Oberflaeche — ADR-0034 stellt den Bericht als alleinige Quelle, Formatierung ist aber eine Darstellungsfrage.
- NACHMESSUNG am gewachsenen Baum (node scripts/measure-evaluator.js, 15 Wiederholungen, Median, jsdom-DOMParser) gegen die Grundlinie aus Slice 02:

| Fall | Knoten (Grundlinie -> jetzt) | Vorbereitung | Iteriert | Nach-Durchlauf | Grenzen+Bericht | Gesamt |
|---|---|---|---|---|---|---|
| klein, 1 Armee-Katalog | 23 -> 139 | 359,8 ms (99,2 %) | 0,9 ms | 1,4 ms | 1,2 ms | 362,8 ms (Grundlinie 363,1) |
| VC + Mercenaries | 49 -> 319 | 904,0 ms (99,1 %) | 1,1 ms | 2,4 ms | 3,4 ms | 912,4 ms (Grundlinie 845,0) |
| 3 Armee-Kataloge | 42 -> 304 | 984,2 ms (99,5 %) | 0,8 ms | 2,2 ms | 2,6 ms | 989,1 ms (Grundlinie 956,6) |

Der Baum ist um Faktor 6-7 gewachsen (Angebots-Anker: 116/270/262), die Gesamtdauer praktisch nicht. Der Nach-Durchlauf, der den Zuwachs aus der Fixpunktschleife heraushaelt, kostet 1,4-2,4 ms.

BROWSER GEGEN JSDOM (neu: node scripts/measure-evaluator-browser.js, beide Reihen gleichzeitig auf derselben Maschine, 15 Wiederholungen). Der native DOMParser ist rund 4x schneller als der von jsdom, der ANTEIL der Vorbereitung bleibt praktisch gleich:

| Fall | Gesamt jsdom | Gesamt Chrome | Anteil Vorbereitung jsdom / Chrome | bei wiederverwendetem Datensatz Chrome |
|---|---|---|---|---|
| klein | 472,4 ms | 104,2 ms | 97,1 % / 96,3 % | 3,9 ms |
| VC + Mercenaries | 1142,3 ms | 264,9 ms | 99,4 % / 97,9 % | 5,5 ms |
| 3 Armee-Kataloge | 1346,9 ms | 283,6 ms | 99,3 % / 98,0 % | 5,7 ms |

Knotenzahl und Fixpunktausgang stimmen zwischen beiden Laufzeitumgebungen exakt ueberein (das Messgeraet bricht sonst ab) - die Zeiten sind also dieselbe Arbeit, nur mit anderem XML-Leser.

ENTSCHEID: ZWEISTUFIGE FASSADE. Die vorab in design.md und als benannte Konstante TWO_STAGE_PREPARATION_SHARE festgeschriebene Schwelle lautet: macht der Katalog-Vorlauf mehr als die Haelfte einer vollstaendigen Auswertung aus, wird die Fassade zweistufig. Gemessen sind 96,3-99,5 % - die Schwelle wird nicht knapp, sondern um Groessenordnungen gerissen, in beiden Laufzeitumgebungen und in allen drei Faellen. Das bestaetigt ADR-0036 ('die Frage nach der Form der Fassade entscheidet sich am Parsen, nicht am Baum'): der gewachsene Baum hat den Anteil nicht verschoben. Zwei weitere Belege in dieselbe Richtung: der E2E-Runner als erster echter Verbraucher (siehe erster Kommentar) und die im Cutover absehbare Probeeinfuegung, die denselben Datensatz ein zweites Mal auswertet (design.md, 'Die containerseitige Grenze').

Die zweite Schwelle (interaktive Obergrenze 100 ms) ist unveraendert bewertet und wird von einer Auswertung EINSCHLIESSLICH Vorlauf weiterhin gerissen (Chrome 104-284 ms). Genau diesen Vorlauf traegt eine Roster-Aenderung jetzt aber nicht mehr: mit wiederverwendetem Datensatz kostet sie im Browser 3,9-5,7 ms. Der Vorlauf wird damit zu einer einmaligen Kosten beim Laden des Datensatzes; die Messung weist ihn getrennt aus ('bei wiederverwendetem Datensatz').

SCHNITT DER FASSADE: prepareDataset(datensatz) -> aufbereiteter Datensatz; evaluate(aufbereiteter Datensatz, roster) -> Bericht; describeDataset(aufbereiteter Datensatz) -> Beschreibung. Der aufbereitete Datensatz ist ein undurchsichtiger Griff (Klasse PreparedDataset mit privatem Feld, engine-intern ueber PreparedDataset.contentsOf ausgepackt): der Aufrufer haelt ihn und gibt ihn zurueck, erfaehrt aber nichts ueber den inneren Aufbau der Engine (ADR-0034). Es gibt genau EINEN Weg, aus XML eine aufgeloeste Sicht zu machen; ein roher Datensatz an evaluate/describeDataset faellt mit einer Meldung auf, die den Aufruffehler benennt. Kein Zwischenspeicher in der Engine - die Wiederverwendung liegt beim Aufrufer, damit evaluate eine reine Funktion bleibt (Leitprinzip 1).
- ENTSCHIEDEN: formatRules (offene Frage aus Slice 06). Die Formatierung gehoert in den BERICHT, also in die Engine - nicht in die Oberflaeche. Umgesetzt wird sie NICHT in diesem Main-Issue, sondern zusammen mit ihrem ersten Verbraucher im Cutover; die Begruendung fuer beides:

Was die Katalogdaten wirklich deklarieren (nachgesehen, nicht vermutet): formatRule-Elemente stehen 94x in 'Warhammer Fantasy Battles (6th definitive edition).gst' und 0x in allen vier .cat-Dateien. Sie haengen an den characteristicType-Deklarationen des Spielsystems und sind regulaere Ausdruecke mit Ersetzung, z. B. am Typ Sv (id f1be-e66c-d5e1-673c, defaultValue 7) drei Regeln: '^([1-6])$' -> '$1+', '^7+$' -> '-', '^$' -> '-'. Es ist also eine vom Katalogautor deklarierte Wertabbildung, keine Anzeigekonvention der Anwendung.

Warum die Engine: ADR-0034 zieht die Grenze mit dem Kriterium 'steht die Antwort in den Katalogdaten, beantwortet sie die Engine'. Sie steht dort. Die Ausschlussliste derselben ADR nennt zwar 'wie eine Zahl formatiert wird' als aussen liegend - gemeint ist damit aber die Formatierung OHNE Katalog-Grundlage (Locale, Zahlenformat, Reihenfolge). Wuerde die Oberflaeche die formatRules anwenden, muesste sie dafuer die characteristicType-Deklarationen des Datensatzes selbst lesen: das waere die zweite Lesart derselben Katalogdaten und die zweite Rechenstelle, die ADR-0034 gerade ausschliesst. Hinzu kommt, dass erst die Engine den EFFEKTIVEN Merkmalswert kennt (nach den Charakteristik-Modifikatoren aus Slice 04) - nur sie kann die Regel auf den richtigen Wert anwenden.

Wo genau: in der Berichtsschicht (infoProjection), NICHT in der Effektiv-Werte-Ebene. Ein Modifikator wie 'increment' rechnet auf dem Rohwert; formatierte man frueher, rechnete der naechste Modifikator auf '3+' statt auf 3. Die Formatierung ist der letzte Schritt vor dem Bericht.

Warum nicht jetzt: (a) Die Akzeptanzkriterien dieses Slices verlangen sie nicht, und der Kontrakt 'Faehigkeitsdatensatz' in design.md fordert ausdruecklich den 'effektiven Wert', nicht den formatierten - eine Aenderung dieses Kontrakts ohne Verbraucher waere YAGNI. (b) Die Oberflaeche wird in dieser Phase nicht angefasst (design.md), es gibt also niemanden, der den formatierten Wert liest. (c) formatRule steht NICHT in der vendored XSD (src/parser/schema/Catalogue.xsd kennt am Typ CharacteristicType nur id und name) - es ist wie das join-Attribut eine Erweiterung ausserhalb der Enum-/Syntax-SSOT aus ADR-0031. Sie zu lesen ist damit eine eigene, benennbare Entscheidung ueber eine vendored Erweiterung und gehoert als solche in den Umfang des Cutovers, nicht in einen Nebensatz dieses Slices.

Offen bleibt genau eine Detailfrage fuer die Umsetzung: ob der Bericht neben dem formatierten auch den rohen Wert traegt. Aus heutiger Sicht nein (keine Bedingung liest je eine Charakteristik, design.md 'Kernentscheidungen'), aber das entscheidet der erste Verbraucher.
- Umgesetzt: (1) Nachmessung wiederholt und der Grundlinie gegenuebergestellt, plus neues Messgeraet scripts/measure-evaluator-browser.js, das dieselben Faelle im echten Browser misst und beide Reihen nebeneinanderstellt (Messfaelle und Ausgabe dafuer als scripts/lib/evaluator-measurement-cases.js bzw. -output.js herausgezogen, damit beide Laeufe exakt dieselben Faelle fahren). (2) Fassade zweistufig geschnitten: prepareDataset -> PreparedDataset (undurchsichtiger Griff), evaluate(prepared, roster), describeDataset(prepared). (3) Der E2E-Manifest-Runner bereitet den Datensatz je Szenario einmal auf; der unhandled error 'Timeout calling onTaskUpdate' ist damit verschwunden (vorher 714 Tests in 72,3 s mit dem Fehler, jetzt 722 Tests in 26,0 s ohne ihn) - behoben durch die Ursache, nicht wegkonfiguriert. (4) docs/evaluator-architecture.md sagt jetzt die Wahrheit ueber die Wiederverwendung der aufgeloesten Sicht (§2, §3, §3.1, §4.2).
