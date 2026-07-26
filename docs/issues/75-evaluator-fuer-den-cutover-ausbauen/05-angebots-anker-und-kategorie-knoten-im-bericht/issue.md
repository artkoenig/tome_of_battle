Status: claimed
Type: refactor
Blocked by: [02, 03]

## Description

Faehigkeitsdatensaetze entstehen heute nur fuer belegte Slots und
Pflicht-Anker. Der Editor braucht aber das **Angebot**: jede waehlbare Option,
auch die mit Anzahl 0 und ohne Pflicht. Und die Oberflaeche stellt Kategorien als
eigene Abschnitte mit eigenen Grenzen dar — eine budget-gesteuert ausgeblendete
Kategorie ist heute im Bericht unsichtbar (die offene Grenze aus ADR-0030, zuvor
als Issue 71 gefuehrt).

Der einzige Slice, der den Auswertungsbaum vergroessert. Deshalb nach der
Grundlinienmessung und nach dem Umbau der Schleife, deren Nach-Durchlauf er
schlicht mitbenutzt.

Die Bestimmung von „waehlbar im Bezugsrahmen" steht im Modulplan und ist durch
einen unabhaengigen Reinraum-Entwurf bestaetigt worden: durch Gruppen und
Verweise beliebig tief absteigen, beim ersten Eintrag anhalten; je Kontingent
zusaetzlich die Eintraege, die seine Kategorienliste zulaesst.

## Acceptance Criteria
- [ ] Fuer jede im Bezugsrahmen waehlbare Definition liegt ein Faehigkeitsdatensatz vor, auch wenn sie im Roster nicht vorkommt.
- [ ] Ein Kategorie-Knoten traegt einen Faehigkeitsdatensatz mit Mindest- und Hoechstmass, Belegung und Sichtbarkeit; eine budget-gesteuert ausgeblendete Kategorie ist als nicht verfuegbar erkennbar.
- [ ] Gesperrtes und Ausgeblendetes wird **materialisiert und markiert**, nicht weggelassen — ein fehlender Eintrag waere von einem vergessenen nicht zu unterscheiden.
- [ ] Ein Angebots-Anker erzeugt **keine** Verletzung; die Verletzungsliste bleibt frei von Meldungen ueber nicht Gewaehltes.
- [ ] Kein zweiter Anker entsteht dort, wo im selben Rahmen schon einer fuer dieselbe Definition haengt.
- [ ] Die Kennung eines Slots bleibt ueber Auswertungen hinweg stabil und leitet sich aus seinem Pfad ab, nicht aus einer laufenden Nummer.
- [ ] Neue Szenarien decken das Angebot je Kontingent, die Optionen einer belegten Auswahl und die ausgeblendete Kategorie an echten Katalogdaten ab.

## Comments
