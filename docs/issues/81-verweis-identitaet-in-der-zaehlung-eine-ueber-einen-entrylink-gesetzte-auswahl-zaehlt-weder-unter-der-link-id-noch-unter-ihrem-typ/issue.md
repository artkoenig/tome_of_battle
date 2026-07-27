Status: claimed
Type: fix
Blocked by: None

## Description

Ein Vorkommen, das ueber einen `entryLink` in ein Roster hereingezogen wird, ist
in der Zaehlung der Reinraum-Engine **nicht dasselbe** wie dasselbe Vorkommen
direkt gesetzt. Es fehlt ihm zweierlei: die Id des Verweises, unter dem es
hereinkam, und der Typ, den es von seinem Ziel erbt. Beide Luecken haben
dieselbe Wurzel — der Verweis wird als reine Durchleitung behandelt statt als
Traeger einer eigenen, zaehlbaren Identitaet — und beide aendern dieselben
Verletzungslisten der E2E-Suite. Sie werden deshalb zusammen behoben.

### Symptom 1: eine am Verweis deklarierte Grenze zaehlt ihre eigene Auswahl nicht

Eine Grenze, die **nicht an der Auswahl-Definition, sondern an dem `entryLink`
deklariert ist, der sie hereinzieht**, zaehlt die eigene Auswahl nicht mit. Sie
meldet eine Pflicht als unerfuellt, obwohl die Auswahl im Roster gesetzt ist.

Ursache an den Daten: ein Roster benennt eine so bezogene Auswahl mit **zwei**
Ids — `entryId` (das Ziel) und `entryLinkId` (der Verweis). Der Zaehlindex
registriert die Instanz unter der Ziel-Id, die Grenze fragt aber nach der
Link-Id. Ergebnis: Ist 0 gegen `min 1`.

Zwei belegte Faelle, beide aus `Mercenaries (…).cat`, beide `min`/`scope="parent"`:

| Grenze | Deklariert an | Beobachtet |
|---|---|---|
| `dfd9-3e46-eda5-be8b` (min 1 *Hand Weapon*) | `entryLink b581-8a9e-9d0c-b7c8`, Z. 7462–7464 | Ist 0 / Grenze 1 |
| `feb1-c10d-9318-dbda` (min 1 *Light Armour*) | `entryLink d3dc-56c1-9565-889a`, Z. 4352–4354 | Ist 0 / Grenze 1 |

Gefunden als Nebenbefund beim E2E-Szenario `modifier-characteristic-value`
(Issue 75/04); dort ausfuehrlich dokumentiert. Die beiden Ids sind in jenem
Szenario aus der `absent`-Liste **entfernt** und bewusst **nicht** nach `firing`
verschoben — das wuerde das falsche Verhalten als gewollt festschreiben. Das
Manifest macht ueber sie derzeit also schlicht keine Aussage; diese Luecke
schliesst erst dieser Fix.

### Symptom 2: ein verlinkter Eintrag zaehlt nicht unter seinem Typ

Ein Eintrag zaehlt unter seinem rohen `type`-Attribut mit (`model`, `unit`, …) —
das ist es, was die Bedingung `childId="model"` liest. Ein **verlinkter** Eintrag
tut das nicht: der Leser des Verweises uebernimmt den Typ des Ziels nicht, und
die Zaehl-Schicht kennt das Ziel deshalb ohne seinen Typ.

Folge: dieselbe Einheit zaehlt unterschiedlich, je nachdem ob sie direkt steht
oder ueber einen `entryLink` hereingezogen wird. Eine `childId="model"`-Bedingung
sieht im zweiten Fall 0 Modelle.

Gefunden bei der Standards-Pruefung von Main-Issue 75. Dort nur dokumentiert,
**nicht** geaendert: die Behebung aendert Zaehlungen und damit Verletzungslisten
quer durch die E2E-Suite und gehoert in einen eigenen Schnitt.

### Dieselbe Wurzel auf der Fixture-Seite

Der `.ros`-Leser der Testumgebung bindet eine Auswahl allein ueber `entryId` und
ignoriert `entryLinkId`. Alles, was am `<entryLink>` selbst deklariert ist, gilt
damit im Test nie — im Widerspruch zum Bericht, der den Verweis-Slot
ausdruecklich den Verweis tragen laesst. Belegt an
`Ogre Kingdoms (6th definitive edition).cat:3165`: dort gewaehrt Verweis `d82e`
*Bully Bully* bedingungslos. Betrifft 13 von 102 vorhandenen Rostern in 4
Szenarien.

Engine-Zaehlung und Roster-Adapter benennen eine Auswahl nur dann gleich, wenn
beide Ids tragen — die Fixture-Seite gehoert deshalb in denselben Schnitt.

## Acceptance Criteria
- [ ] Eine am `entryLink` deklarierte Grenze zaehlt die ueber diesen Verweis gesetzte Auswahl mit.
- [ ] Die beiden belegten Faelle (*Hand Weapon*, *Light Armour*) melden keine Pflichtverletzung mehr.
- [ ] Ein ueber einen `entryLink` gesetzter Eintrag zaehlt unter demselben Typ wie derselbe Eintrag direkt gesetzt.
- [ ] Eine Bedingung, die ein Typ-Schluesselwort nennt (`childId="unit"`, `childId="model"`, …), liefert in beiden Faellen dasselbe Ergebnis.
- [ ] Der `.ros`-Leser der Testumgebung bindet eine Auswahl unter beiden Ids, sodass am Verweis deklarierte Aussagen im Test ueberhaupt greifen koennen.
- [ ] Das Szenario `modifier-characteristic-value` nimmt beide Grenz-Ids wieder in seine Erwartung auf.
- [ ] Ein Szenario an echten Katalogdaten deckt den Typ-Unterschied aus Symptom 2 ab (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Decisions
- `[po]` Issues 76 und 78 zu diesem Main-Issue zusammengefasst. Quelle: die Beschreibung von Issue 78 selbst — 'Verwandt mit Issue 76 (Verweis-Identitaet in der Zaehlung): beide fragen, unter welchen Ids ein ueber einen Verweis gesetztes Vorkommen zaehlbar ist. Zusammen anzufassen ist wahrscheinlich billiger als nacheinander.' Dazu der Kommentar auf Issue 76, der die Fixture-Seite (.ros-Leser) derselben Wurzel zuordnet und ausdruecklich verlangt, beide Stellen zusammen anzufassen. Beide Befunde aendern dieselben Verletzungslisten der E2E-Suite; getrennt umgesetzt wuerde der zweite Schnitt die Erwartungsaenderungen des ersten erneut anfassen. Ein neues Main-Issue statt einer Erweiterung von 76, weil der Slug von 76 nur Symptom 1 benennt und der Zustandsbericht Issue-Titel rendert.
- `[po]` Reinraum-Gegenentwurf eingeholt (clean-room-review, Rolle: Software-Architekt fuer regelauswertende Engines). Der Gutachter stellte keine Rueckfragen und lieferte direkt seinen Entwurf; die Q&A-Tabelle des Skills bleibt daher leer. Der Brief nannte nur Problem, Datenform und harte Randbedingungen — weder unseren Code noch den Befund noch einen Loesungsvorschlag. Tragende Positionen, die in die Abstimmung mit design.md eingehen: (1) Identitaet ist zweiteilig, eine Menge von Zaehl-Schluesseln plus ein Positionspfad; (2) ein Vorkommen zaehlt unter JEDEM Glied der Verweiskette und unter der terminalen Definition, Doppelzaehlung ist unmoeglich weil jede Abfrage genau einen Schluessel nennt; (3) der Typ wird einmalig in der Aufloesungsschicht mit aufgeschriebener Praezedenz entschieden, nie in der Abfrage; (4) Schluessel-Namensraeume trennen Id- von Vokabelwerten; (5) gegen das Auseinanderlaufen von Engine und Testumgebung ist gemeinsamer Code ausdruecklich die falsche Antwort, weil er die Unabhaengigkeit der zweiten Implementierung aufhebt — stattdessen ein normatives Benennungs-Kontraktdokument plus ein Identitaets-Dump, gegen den die Testumgebung ihre Erwartung vergleicht. Punkt 5 stellt das fuenfte Akzeptanzkriterium dieses Issues in Frage und wird beim Abgleich mit dem Modulplan entschieden.
- `[po]` Ein Schnitt, in das Main-Issue gefaltet, keine Child-Issues. Quelle: die Ein-Modul-Klassifikation in design.md (Verweis-Identitaet ist eine Zustaendigkeit an einer Stelle, der Bindung) plus dessen Key decision 'Beide Symptome haengen zwingend zusammen': sobald die Bindung den Verweis traegt, liefe jedes verweis-getragene Vorkommen ohne Typ, die Typ-Zaehlung waere fuer 11 Roster schlechter als vorher. Ein Schnitt, der nur Symptom 1 behebt, laesst die Suite schlechter zurueck als er sie vorfand — das ist kein unabhaengig vorzeigbarer Zuwachs. Nach decompose.md Schritt 3a daher direkt im Main-Issue gehalten.
- `[po]` ADR-Kandidat als eigene ADR aufgenommen: ADR-0037. Nicht als Nachtrag zu ADR-0032, weil 0032 die Aufloesung eines Mehr-Katalog-Datensatzes regelt (flache globale Id-Tabelle), waehrend hier die Zaehl-Identitaet eines Vorkommens entschieden wird — ein anderer Belang. Der ADR-Index fuehrt durchgehend eine Entscheidung je ADR. Als po entschieden und nicht eskaliert, weil die Entscheidung aus der vendorierten XSD (entryLink/@type bezeichnet die Art des Verweisziels, nicht den Eintragstyp) und aus docs/battlescribe-data-format.md 3.4/7.6 (scope=parent vergleicht aufgeloeste Ziel-Ids) ableitbar ist, unabhaengig durch den Reinraum-Gegenentwurf bestaetigt wurde, und weder eine Datenmigration noch eine oeffentliche Schnittstelle noch die Produktion beruehrt — die Engine haengt heute an keinem Produktivpfad (kein Nicht-Test-Import ausserhalb src/evaluator/).
- `[po]` Arbeitsteilung an den Manifesten entschieden (offene Frage 5 aus design.md): Erwartungsdaten unter docs/testing/ bearbeitet ausschliesslich der Black-Box-Autor. Der Implementierer darf sie nicht anfassen; er meldet, welche Erwartung sich verschoben hat, mit dem Katalog-Beleg dazu. Herleitung: ADR-0033 legt die Black-Box-Autorenschaft fest, damit die Tests die Engine herausfordern statt sie zu spiegeln, und die Test-vor-Implementierung-Regel verbietet dem Implementierer seine eigenen Akzeptanztests. Ein Implementierer, der eine Erwartung an seine Ausgabe anpasst, prueft seinen Code gegen sich selbst. Ausnahme, die keine ist: die Wiederaufnahme der beiden Grenz-Ids in modifier-characteristic-value steht als Akzeptanzkriterium im Issue und wird deshalb ebenfalls vom Autor geschrieben, nicht vom Implementierer erfunden.
- `[po]` Aggregations-Risiko (offene Frage 2 aus design.md) vorab entschieden: es bleibt bei der Zaehlung unter der aufgeloesten Ziel-Id, auch wenn die Suite einen Fall zeigt, in dem eine max-Grenze dadurch neu feuert. Quelle: docs/battlescribe-data-format.md 3.4 und 7.6 halten zweimal ausdruecklich fest, dass scope=parent aufgeloeste Ziel-Ids vergleicht und nicht entryLinkIds, weil verschiedene Verweise auf dasselbe Ziel zeigen koennen; dieses Dokument ist die Quelle, aus der der Black-Box-Autor ableitet. Zeigt sich ein solcher Fall, ist er als Befund zu melden und wird eine Entscheidung ueber ADR-0037 — der Implementierer kippt die Regel nicht im Lauf.
- `[po]` Akzeptanzkriterium von 'childId=model' auf 'ein Typ-Schluesselwort' verallgemeinert. Der Black-Box-Autor hat an den Daten belegt, dass ein childId=model-Gegenpaar in den Fixture-Katalogen nicht baubar ist: alle 124 childId=model-Vorkommen sind Kosten-/Grenzen-repeats mit scope=parent/unit oder die Border-Patrols-Bedingung mit scope=self; die Modelle aller Einheiten mit einer solchen Query sind inline definierte selectionEntry-Kinder und stehen damit stets direkt; und von den drei ueberhaupt link-faehigen geteilten type=model-Eintraegen traegt keiner. Er hat dieselbe Regel stattdessen am Typ-Schluesselwort 'unit' festgehalten, fuer das die Daten beide Seiten hergeben: direkt Ogre Kingdoms:976 (81b9-e978-56c2-e942, type=unit, Wurzeleintrag) gegen verlinkt Ogre Kingdoms:3343 (entryLink 42d8-7559-6542-15fc auf Mercenaries:7350, type=unit). Die Regel ist keyword-agnostisch — der gezaehlte Typ kommt nach ADR-0037 Punkt 3 aus derselben einen Bestimmung, unabhaengig davon, welches Vokabelwort eine Bedingung nennt. Ein zweites Schluesselwort waere ein zweiter Datenpunkt auf demselben Codepfad, keine zusaetzliche Abdeckung.
- `[po]` Kein Backlog-Eintrag fuer die fehlende childId=model-Abdeckung, obwohl der Autor danach gefragt hat. Begruendung: die Regel ist keyword-agnostisch festgehalten (siehe vorige Entscheidung), ein model-spezifisches Szenario liefe durch denselben Codepfad und brachte keine neue Aussage. Der Fixture-Satz ist nach ADR-0032 bewusst auf 4 der 17 Armeebuecher beschnitten; taucht bei einer Erweiterung ein verlinkter type=model-Eintrag unter einer childId=model-Query auf, ist das eine natuerliche Ergaenzung des Szenarios und kein offener Mangel. Ein Issue dafuer waere Rueckstands-Rauschen. Vermerkt ist die Luecke im README des Szenarios, wo der Autor sie vollstaendig dokumentiert hat.
- `[po]` Szenario-Slug 'linked-entry-type-counting' uebernommen (Frage des Autors); der Auftrag nannte keinen, und der gewaehlte benennt die festgehaltene Regel. Die vom Autor angemahnte Format-Naht ist nachgetragen: docs/battlescribe-data-format.md fuehrt neu einen Abschnitt 3.5, der entryId und entryLinkId als die zwei bedeutungstragenden Id-Attribute einer .ros-selection beschreibt, samt der Folge fuer Zaehlung und Typ und dem Hinweis, dass ein Roster ohne entryLinkId 'ueber einen Verweis gesetzt' nicht ausdrueckt. Damit steht die Naht in einer Autoren-Allow-List-Quelle statt nur in einem Auftrag — das schliesst Risiko 6 aus design.md und die Sorge des Reinraum-Gutachters, Engine und Testumgebung koennten ueber Identitaet still auseinanderlaufen.
- `[po]` Kontrakt-Abweichung angenommen: occurrenceIdsOf nimmt den Id-Nachschlag als zweiten Parameter, entgegen der im Plan notierten Signatur occurrenceIdsOf(def). Begruendung des Implementierers, die ich akzeptiere: die mittleren Glieder einer Verweiskette sind nur ueber ihre Id erreichbar — ein Verweis kennt targetId und sein vom Resolver geliefertes Kettenende, aber keinen Zeiger auf die Objekte dazwischen —, und resolver.js als Eigentuemer der Id-Tabelle lag laut Brief ausserhalb des Umfangs. Ohne den Parameter waeren nur die drei Stichproben moeglich, die der Plan nach der Reinraum-Abstimmung ausdruecklich verwirft. Der Nachschlag haengt am Baum, wo schon nextFrameId hing, und jeder Knoten traegt seine Id-Menge danach als abgelesenes Feld — Index und Query brauchen keinen Nachschlag. design.md ist entsprechend nachgezogen.
- `[po]` Kontrakt 8, gewaehlte Trennung angenommen: ein namensraum-praefigierter Schluessel fuer den Typ-Raum plus die Regel, dass ein rohes Query-Ziel genau dann ein Typ-Ziel ist, wenn es im geschlossenen XSD-Typvorrat steht. Bewusst akzeptiertes Residuum: ein Eintrag, dessen Id woertlich model, unit oder upgrade lautet, ist ueber eine Query nicht mehr als Id erreichbar und zaehlt 0, statt als Typ mitzuzaehlen. Das ist die fail-closed-Richtung, die Kontrakt 8 verlangt, und in diesen Katalogen praktisch unerreichbar, weil Ids Hex-Quadrupel sind. Ein Modultest haelt die Kante fest.
- `[po]` Grenzfall ohne Kontrakt-Vorgabe, wie umgesetzt angenommen: ein besetztes linkDefId, das auf etwas anderes als einen entryLink aufloest, gilt als 'kein Verweis' — es gilt defId, ohne Diagnose, weil die Id ja aufgeloest ist. Nur ein nirgends aufloesendes linkDefId erzeugt UNRESOLVED_DEFINITION. Das ist mit Kontrakt 2 vereinbar, der die Diagnose ausdruecklich nur an die Unaufloesbarkeit bindet.
- `[po]` Meldung des Implementierers zu Risiko 1 zur Kenntnis genommen und nicht als Aenderung behandelt: keine einzige Erwartung musste angepasst werden, alle 108 Rosterfaelle passen unveraendert. Gemessen, aber nirgends asserted ist eine Wertverschiebung in modifier-characteristic-value/rosters/02-ogre-light-armour.ros — die Kostensumme pts am Roster-Rahmen steigt von 105 auf 114, weil der Verweis d824-eb03-77ac-8be2 einen Kosten-Modifikator '+3 je Modell' traegt und die Einheit 3 Modelle hat. Folgenlos, weil dieses Roster kein costLimits traegt und das Szenario Merkmale statt Kosten prueft. Als Kommentar am Szenario-Manifest zu vermerken waere Aufgabe des Black-Box-Autors; hier festgehalten, damit die Information nicht verloren geht, falls dort je eine Kosten- oder Budget-Erwartung ergaenzt wird. Der zweite belegte Fall (Verweis 4983-51a9-3fef-ddf1 setzt e998-b2d3-1333-a37d auf 2) wirkt in der Suite nicht, weil kein Fixture-Roster diese Verweis-Id nennt.
- `[po]` Aggregations-Risiko 2 hat sich nicht materialisiert: der Implementierer hat nicht nur die Suite, sondern die ausloesende Datenlage geprueft — ueber alle docs/testing/*/rosters/*.ros gibt es 0 Faelle von Geschwister-Auswahlen mit demselben entryId bei verschiedenen entryLinkIds. Die Bedingung, unter der eine max-Grenze durch die Aggregation neu feuern koennte, tritt in den Fixtures nicht auf. Die Regel steht wie in ADR-0037 entschieden.
- `[po]` Messung nach der Umsetzung (scripts/measure-evaluator.js, Exitcode 0): kein Effekt bei wiederverwendetem Datensatz — klein 4,1 auf 4,0 ms, Mehrkatalog 10,2 auf 7,8 ms, groesster Datensatz 7,6 auf 6,3 ms; die Schwankung dominiert und geht teils in beide Richtungen. Die 100-ms-Schwelle bleibt in allen drei Reihen gerissen, unveraendert und aus demselben Grund wie vorher: 98,5 bis 99,3 Prozent der Zeit liegen im Katalog-Vorlauf. Risiko 9 aus design.md ist damit abgehakt.

## Comments
