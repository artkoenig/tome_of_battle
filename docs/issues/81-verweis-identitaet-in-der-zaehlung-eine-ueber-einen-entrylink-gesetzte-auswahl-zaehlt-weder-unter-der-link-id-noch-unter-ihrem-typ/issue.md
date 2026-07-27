Status: needs-triage
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
- [ ] Eine `childId="model"`-Bedingung liefert in beiden Faellen dasselbe Ergebnis.
- [ ] Der `.ros`-Leser der Testumgebung bindet eine Auswahl unter beiden Ids, sodass am Verweis deklarierte Aussagen im Test ueberhaupt greifen koennen.
- [ ] Das Szenario `modifier-characteristic-value` nimmt beide Grenz-Ids wieder in seine Erwartung auf.
- [ ] Ein Szenario an echten Katalogdaten deckt den Typ-Unterschied aus Symptom 2 ab (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Decisions
- `[po]` Issues 76 und 78 zu diesem Main-Issue zusammengefasst. Quelle: die Beschreibung von Issue 78 selbst — 'Verwandt mit Issue 76 (Verweis-Identitaet in der Zaehlung): beide fragen, unter welchen Ids ein ueber einen Verweis gesetztes Vorkommen zaehlbar ist. Zusammen anzufassen ist wahrscheinlich billiger als nacheinander.' Dazu der Kommentar auf Issue 76, der die Fixture-Seite (.ros-Leser) derselben Wurzel zuordnet und ausdruecklich verlangt, beide Stellen zusammen anzufassen. Beide Befunde aendern dieselben Verletzungslisten der E2E-Suite; getrennt umgesetzt wuerde der zweite Schnitt die Erwartungsaenderungen des ersten erneut anfassen. Ein neues Main-Issue statt einer Erweiterung von 76, weil der Slug von 76 nur Symptom 1 benennt und der Zustandsbericht Issue-Titel rendert.
- `[po]` Reinraum-Gegenentwurf eingeholt (clean-room-review, Rolle: Software-Architekt fuer regelauswertende Engines). Der Gutachter stellte keine Rueckfragen und lieferte direkt seinen Entwurf; die Q&A-Tabelle des Skills bleibt daher leer. Der Brief nannte nur Problem, Datenform und harte Randbedingungen — weder unseren Code noch den Befund noch einen Loesungsvorschlag. Tragende Positionen, die in die Abstimmung mit design.md eingehen: (1) Identitaet ist zweiteilig, eine Menge von Zaehl-Schluesseln plus ein Positionspfad; (2) ein Vorkommen zaehlt unter JEDEM Glied der Verweiskette und unter der terminalen Definition, Doppelzaehlung ist unmoeglich weil jede Abfrage genau einen Schluessel nennt; (3) der Typ wird einmalig in der Aufloesungsschicht mit aufgeschriebener Praezedenz entschieden, nie in der Abfrage; (4) Schluessel-Namensraeume trennen Id- von Vokabelwerten; (5) gegen das Auseinanderlaufen von Engine und Testumgebung ist gemeinsamer Code ausdruecklich die falsche Antwort, weil er die Unabhaengigkeit der zweiten Implementierung aufhebt — stattdessen ein normatives Benennungs-Kontraktdokument plus ein Identitaets-Dump, gegen den die Testumgebung ihre Erwartung vergleicht. Punkt 5 stellt das fuenfte Akzeptanzkriterium dieses Issues in Frage und wird beim Abgleich mit dem Modulplan entschieden.

## Comments
