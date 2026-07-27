Status: resolved
Type: fix
Blocked by: [03]

## Description

Nachbesserung an der eigenen Arbeit dieses Main-Issues, gefunden bei seiner
Standards-Pruefung.

Scheibe 02 hat eingefuehrt, dass ein Slot die **bindende** Grenze ausweist, wenn
er mehrere traegt — bei Untergrenzen die mit dem groessten Fehlbetrag, bei
Obergrenzen die mit dem geringsten Spielraum. Verglichen wird dafuer der Abstand
zwischen Grenzwert und Ist-Stand.

Dieser Abstand traegt aber eine **Einheit**: er zaehlt das, was die Grenze zaehlt
— Auswahlen, Modelle oder Punkte. Der Vergleich beachtet das nicht. Da Verweis-
und Ziel-Grenzen mit **verschiedenen** Kennungen nebeneinander bestehen bleiben,
koennen an einem Slot Grenzen mit verschiedenen Messgroessen zusammentreffen.
Eine Obergrenze von 2 Auswahlen und eine von 100 Punkten werden dann als 2 gegen
100 verglichen, und die Punktegrenze gewinnt — obwohl die Auswahlgrenze bindet.

Der Slot meldet danach Grenzwert, Ist-Stand und Spielraum der falschen Grenze.
Die Verletzungsliste ist nicht betroffen, sie stammt aus der vollstaendigen
Ergebnisliste; betroffen ist der Faehigkeitsdatensatz, aus dem sich die
Oberflaeche speist (ADR-0035).

Das Ergebnisobjekt fuehrt die noetige Unterscheidung bereits mit — die
Messgroesse steht als eigenes Feld daran. Der Vergleich liest sie nur nicht.

Drei kleinere Befunde derselben Pruefung, alle im Code dieses Main-Issues und
deshalb hier statt in einem eigenen Issue:

1. **Die Identitaets-Quelle ist nicht ganz zusammengefuehrt.** Die Auflösung der
   Gruppen-Mitglieder baut dieselbe Drei-Id-Menge noch einmal von Hand, statt das
   neue Modul zu nutzen. Wuerde die Identitaets-Regel dort verschaerft, bliebe
   dieser Pfad still unberuehrt.
2. **Eine Ausdrucks-Dopplung ist neu hinzugekommen.** Die Ermittlung der
   aufgeloesten Ziel-Id steht jetzt an zwei Stellen wortgleich; eine davon hat
   Scheibe 02 eingefuehrt. Sie gehoert in das Identitaets-Modul.
3. **Kommentar und Code widersprechen sich bei Gruppen.** Der neue Kommentar
   sagt, die Identitaet einer Eintragsgruppe sei kein Zaehlziel; die Pruefung
   testet aber nur die eigene Art der Definition. Ein Verweis, der auf eine
   Gruppe zeigt, kommt daran vorbei und traegt die Gruppen-Id doch bei.

## Acceptance Criteria
- [ ] Die bindende Grenze wird nur unter Grenzen derselben Messgroesse bestimmt; Grenzen verschiedener Messgroesse werden nicht gegeneinander verglichen.
- [ ] Traegt ein Slot Grenzen mehrerer Messgroessen, ist definiert und begruendet, welche er ausweist — und ein Test haelt das fest.
- [ ] Die Auflösung der Gruppen-Mitglieder nutzt die eine Identitaets-Quelle statt einer eigenen Kopie.
- [ ] Die Ermittlung der aufgeloesten Ziel-Id steht an einer Stelle.
- [ ] Kommentar und Verhalten bei Eintragsgruppen stimmen ueberein — auch wenn ein Verweis auf eine Gruppe zeigt.
- [ ] Die Testsuite bleibt gruen; keine Erwartung unter docs/testing/ wird abgeschwaecht.

## Comments
- Belegt bei der PO-Sichtung: constraints.js:87 bildet den Abstand als bound - actual und traegt bei :98 ausdruecklich ein measure-Feld; report.js:113-115 vergleicht nur den Abstand. evalTree.js:194-201 (limitsOf) fuehrt Verweis- und Ziel-Grenzen nach Kennung zusammen, sodass Grenzen mit verschiedenen Kennungen — und damit moeglicherweise verschiedenen gezaehlten Feldern — beide bestehen bleiben.
- In den heutigen Fixture-Katalogen tritt der Fall nicht auf: dort deklarieren Verweis und Ziel dieselben Werte. Der Fehler ist deshalb an echten Daten nicht beobachtbar und gehoert in einen Modultest.
- Die bindende Grenze wird jetzt nur noch unter Grenzen derselben Messgroesse ueber den Abstand bestimmt; ueber Messgroessen hinweg entscheidet ein erklaerter Vorrang (selectionCount vor forceCount vor costSum vor budgetLimit), begruendet in der JSDoc von report.js und in docs/evaluator-architecture.md §4.8. Dazu: collectGroupMemberIds nutzt identityIdsOf, die doppelte Ziel-Id-Ermittlung liegt als resolvedTargetIdOf in identity.js, und hasCountableIdentity sieht fuer die Gruppenregel auch hinter einen entryLink (Code an den Kommentar angeglichen).
