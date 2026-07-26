Status: claimed
Type: refactor
Blocked by: [02]

## Description

Heute laeuft die Fixpunktschleife inklusive Konvergenzvergleich ueber **alle**
Knoten, synthetische Anker eingeschlossen. Das ist unnoetig: ein Anker traegt
keine Instanz, geht in keine Zaehlung ein und kann den ausgewerteten Zustand
deshalb nicht veraendern. Mit dem in Slice 05 wachsenden Baum wuerde es zugleich
teuer und zur Quelle einer falschen Nichtkonvergenz-Meldung.

Der Slice steht **bewusst vor** dem Angebot: der Mechanismus, der den grossen
Baum tragen soll, wird am kleinen gebaut, wo sein Verhalten gegen die heute
gruene E2E-Suite exakt gleich bleiben muss. Umgekehrt kaeme der Umbau unter der
Last des grossen Baums, und ein Fehler waere nicht mehr zuzuordnen.

Dazu kommt die Behandlung nicht konvergierender Daten: heute gibt es eine
einzige globale Meldung. Eine global gefuehrte Liste wird in der Oberflaeche
uebersehen — die Unsicherheit gehoert an den betroffenen Knoten.

## Acceptance Criteria
- [ ] Die iterierte Auswertung laeuft nur ueber reale Knoten; die synthetischen Anker bekommen ihre wirksamen Werte in **einem** Durchlauf danach.
- [ ] Ein Anker traegt danach dieselben wirksamen Werte wie zuvor: sein Hoechstmass ist modifikator-bewusst, seine Sichtbarkeit und seine bedingten Hinweise stimmen.
- [ ] Ein synthetischer Anker geht nachweislich nie in die Zaehlung ein — als Modultest festgehalten, nicht nur als Zusicherung im Text.
- [ ] Oszillation (ein frueherer Zustand kehrt wieder) und erschoepftes Rundenbudget werden als **zwei verschiedene** Befunde gemeldet; bei Oszillation ist die Zykluslaenge Teil der Meldung.
- [ ] Ein Slot, dessen Wert nicht stabil ist, ist als solcher erkennbar — die Unsicherheit steht am Slot, nicht nur in der globalen Liste.
- [ ] Bei konvergierenden Daten aendert sich am Ergebnis nichts: die bestehende E2E-Suite bleibt unveraendert gruen.

## Comments
