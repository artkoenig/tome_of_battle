Status: resolved
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
- Umgesetzt: das **Angebot** und die **Kategorie-Knoten** im Bericht (ADR-0035).

Neues Modul `offer.js` bestimmt, wer in welchem Rahmen waehlbar ist, und haengt die
Angebots-Anker in einer **zweiten Baumphase** nach der Konvergenz als Blaetter an;
`resolver.js` liefert dafuer die Kandidatenmenge auf Armee-Ebene als eigene Sicht.
Jeder Knoten traegt jetzt seine **Ankerart** (`AnchorKind`: belegt / Pflicht-Phantom /
Gruppen-Anker / Kategorie-Anker / Angebots-Anker); der Bericht fuehrt einen
Faehigkeitsdatensatz fuer **jeden** Slot statt nur fuer reale Knoten und
MIN-tragende Phantome — eine ausgeblendete Kategorie ist damit erstmals sichtbar
(die offene Grenze aus ADR-0030). Ein Grenzen-Ergebnis sagt neu, ob es
**berichtsfaehig** ist: am Angebots-Anker speist es nur den Datensatz, nie die
Verletzungsliste. Die bestehende E2E-Suite ist unveraendert gruen — der gewachsene
Baum aendert keine einzige Zahl.

**Aufwandsmessung (`node scripts/measure-evaluator.js`), gegen die Grundlinie aus 02:**

| Fall | Knoten (real/synth.) | iterierte Auswertung | Nach-Durchlauf | Grenzen+Bericht | Gesamt |
| --- | --- | --- | --- | --- | --- |
| klein — Grundlinie | 23 (6/17) | 1,3 ms | 0,0 ms | 0,1 ms | 363,1 ms |
| klein — jetzt | 139 (6/133) | 0,9 ms | 1,5 ms | 1,1 ms | 341,8 ms |
| Mehrkatalog — Grundlinie | 49 (5/44) | 1,4 ms | 0,0 ms | 0,3 ms | 845,0 ms |
| Mehrkatalog — jetzt | 319 (5/314) | 1,0 ms | 2,2 ms | 2,2 ms | 909,3 ms |
| groesster — Grundlinie | 42 (3/39) | 1,0 ms | 0,0 ms | 0,3 ms | 956,6 ms |
| groesster — jetzt | 304 (3/301) | 0,8 ms | 2,5 ms | 2,0 ms | 1066,6 ms |

Ankerarten im groessten Fall: occupied=3, mandatoryPhantom=24, groupAnchor=4,
categoryAnchor=11, offerAnchor=262. Alle drei Faelle konvergieren weiterhin (2/2/1
Runden).

**Der Befund, um dessentwillen die Trennung (b)/(c) eingefuehrt wurde:** der Baum
waechst um das 6- bis 7-Fache, die **iterierte Auswertung bleibt dabei flach**
(1,3→0,9 / 1,4→1,0 / 1,0→0,8 ms). Der gesamte Zuwachs liegt im Nach-Durchlauf
(0,0→1,5–2,5 ms) und in Grenzen+Bericht (0,1–0,3→1,1–2,2 ms). Der Nach-Durchlauf
haelt das Angebot damit nachweislich aus der Fixpunktschleife heraus.

Die Gesamtzeiten sind weiterhin vom Katalog-Vorlauf dominiert (98,9–99,4 %, mit
jsdom gemessen) und schwanken zwischen Laeufen um mehr als der ganze Zuwachs
ausmacht — die interaktive Obergrenze von 100 ms bleibt gerissen, unveraendert
zur Grundlinie und aus demselben Grund (Baustein 8 entscheidet).
- Geteilte Kontrakte fuer die Folge-Slices: SlotCapability traegt neu `anchorKind`, `frame: {path, defId}|null` (Kontingent bzw. Eltern-Auswahl) und `targetDefId` (worauf ein Verweis-Slot zeigt — die Kategorie eines Kategorie-Ankers). Ein Constraint-Ergebnis traegt `isReportable`. `selectableSlotsOf` liefert jetzt alle Knoten. `evalTree` baut in zwei Phasen; die Wurzel traegt die Quelle der Rahmen-Identitaeten. `extendBaseEffectiveState` traegt nachtraeglich entstandene Knoten in den Effektiv-Zustand nach. Der E2E-Manifest-Runner unterstuetzt `targetDefId`/`anchorKind`/`frameDefId` als Slot-Auswahl und die Zustandsfelder als Erwartung.
