Status: claimed
Type: fix
Blocked by: [01]

## Description

Die Auswertung deutet den Wert minus eins als "unbegrenzt" an der falschen
Stelle: sie prueft ihn am **wirksamen** Grenzwert, also nach allen Modifikatoren.

Zwei Folgen, beide falsch:

- Eine Obergrenze, die ein Modifikator ins Negative zieht, bedeutet fachlich
  "nichts erlaubt". Sie wird still als "unbegrenzt" gelesen — aus der
  schaerfsten Grenze wird gar keine.
- Eine Grenze, die mit minus eins deklariert ist und anschliessend hochgezaehlt
  wird, ist nach der Rechnung eine gewoehnliche Zahl. Wird der Sentinel erst am
  Ergebnis geprueft, haengt seine Deutung davon ab, welche Zahl die Rechnung
  zufaellig liefert.

Richtig ist: **die Unbegrenztheit ist eine Eigenschaft der Deklaration, nicht
der Zahl.** Unbegrenzt gilt, wenn der zuletzt *deklarierte* Wert minus eins ist —
also der Grundwert, wenn kein Modifikator ihn setzt, oder der gesetzte Wert des
letzten setzenden Modifikators. Alles, was eine Rechnung erzeugt, ist eine Zahl.

Der Sentinel ist ausserdem bereits benannt, aber nicht geteilt: der Katalog-Leser
fuehrt ihn unter eigenem Namen und dokumentiert ausdruecklich, er bilde ihn weg,
*damit kein Leser ihn als Zahl weiterrechnet* — waehrend die auswertende Schicht
danebensteht und genau das mit einem harten Zahl-Literal tut. Es braucht eine
Quelle fuer den Sentinel, nicht zwei.

Beide Schreibweisen des Wertes kommen in den Daten vor (mit und ohne
Nachkommastelle), der Vergleich muss deshalb numerisch sein, nicht als Zeichenkette.

## Acceptance Criteria
- [ ] Unbegrenztheit wird am zuletzt deklarierten Wert entschieden, nicht am Ergebnis der Modifikator-Rechnung.
- [ ] Eine Grenze, die ein Modifikator ins Negative zieht, gilt nicht als unbegrenzt; ein Modultest haelt diesen Fall fest, da kein Katalog ihn erzeugt.
- [ ] Ein Modifikator, der eine endliche Grenze ausdruecklich auf minus eins setzt, macht sie unbegrenzt.
- [ ] Eine mit minus eins deklarierte und anschliessend hochgezaehlte Grenze liefert eine gewoehnliche Zahl; ein Modultest haelt diesen Fall fest, da der Datensatz des Evaluators ihn nicht enthaelt (122 Grenzen mit minus eins, 36 Ziele arithmetischer Modifikatoren, Schnittmenge leer).
- [ ] Es gibt genau eine benannte Quelle fuer den Sentinel; in der auswertenden Schicht steht kein Zahl-Literal mehr dafuer.
- [ ] Der Vergleich ist numerisch und traegt beide Schreibweisen.
- [ ] Das Szenario aus Slice 01 ist gruen; die uebrige E2E-Suite bleibt gruen, jede geaenderte Erwartung ist einzeln begruendet.
- [ ] Das Format-Dokument und das Architektur-Dokument sagen dasselbe wie der Code darueber, wo minus eins "unbegrenzt" bedeutet.

## Comments
- Belegt: die Deutung darf nicht am Rohwert allein haengen. In den Daten setzen Modifikatoren eine endliche Grenze ausdruecklich auf minus eins (Auspraegung 2) — eine reine Rohwert-Pruefung wuerde diese Faelle verlieren. Umgekehrt traegt die Spielsystem-Datei eine mit minus eins deklarierte Obergrenze, auf der ein Hochzaehlen je Punktmenge liegt (Auspraegung 3) — eine reine Ergebnis-Pruefung verliert diese. Nur "zuletzt deklarierter Wert" traegt beide.
