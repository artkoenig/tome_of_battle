Status: claimed
Type: fix
Blocked by: None

## Description

Ein Eintrag kann an einer Stelle direkt stehen oder ueber einen Verweis von
anderswo hereingezogen werden. Beide Wege benennen dasselbe Vorkommen, aber unter
verschiedenen Ids: der Verweis hat eine eigene, und Regeln koennen an beiden
haengen — am Ziel wie am Verweis.

Heute beantworten mehrere Stellen der Auswertung unabhaengig voneinander die
Frage "ist dieses Vorkommen dasjenige, das die Regel meint?" — die Zaehlung, der
Auswertungsbaum, die Abfrage-Schicht und die Angebots-Schicht je fuer sich. Sie
koennen deshalb auseinanderlaufen, und sie tun es bereits.

Diese Scheibe legt die Frage an **eine** Stelle: ein Vorkommen traegt eine
**Menge** von Identitaets-Ids (die des Ziels und die der durchlaufenen Verweise),
und eine Regel trifft es, wenn die von ihr genannte Id in dieser Menge liegt.
Mengenzugehoerigkeit, nicht Summierung je Id — sonst zaehlte ein Vorkommen
mehrfach, sobald mehrere seiner Ids im Spiel sind.

Die Richtung ist bewusst einseitig: nennt eine Regel die Ziel-Id, trifft sie das
Vorkommen ueber **jeden** Verweis und auch das direkt gesetzte. Nennt sie eine
Verweis-Id, trifft sie nur die Vorkommen ueber genau diesen Verweis — eine echte
Teilmenge.

Diese Scheibe ist fuer die heutige Suite **verhaltensneutral**: solange der
Roster-Adapter kein Vorkommen an einen Verweis bindet (das tut erst die naechste
Scheibe), traegt kein realer Knoten je mehr als eine Id. Sie schafft nur die
gemeinsame Grundlage.

Verkettete Verweise (ein Verweis, der auf einen Verweis zeigt) kommen in den
Daten nicht vor — die Identitaet endet deshalb bewusst am aufgeloesten Ziel.

## Acceptance Criteria
- [ ] Es gibt genau eine Stelle, die beantwortet, unter welchen Ids ein Vorkommen zaehlbar ist; Zaehlung, Auswertungsbaum, Abfrage- und Angebots-Schicht nutzen sie.
- [ ] Ein Vorkommen wird von einer Regel hoechstens einmal gezaehlt, auch wenn mehrere seiner Ids zutreffen.
- [ ] Eine Regel, die die Ziel-Id nennt, trifft das Vorkommen unabhaengig davon, ob es direkt oder ueber einen Verweis gesetzt wurde.
- [ ] Eine Regel, die eine Verweis-Id nennt, trifft ausschliesslich Vorkommen ueber diesen Verweis.
- [ ] Kein Verhaltenswechsel: die vollstaendige Testsuite bleibt unveraendert gruen, keine Erwartung wird angepasst.
- [ ] Das Architektur-Dokument beschreibt die Identitaets-Regel.

## Comments
