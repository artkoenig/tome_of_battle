# Der primäre Katalog einer Auswertung kommt aus dem Roster-Kontingent, nicht aus dem Datensatz

- **Status:** Accepted
- **Datum:** 2026-07-27
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** ergänzt **ADR-0032** (global-by-ID-Auflösung), berührt **ADR-0035** (Verfügbarkeit aus Fähigkeitsdatensätzen)

## Kontext und Problemstellung

BattleScribe kennt einen Bezugsrahmen `scope="primary-catalogue"`. An den
eingefrorenen Katalogdaten der Definitive Edition nachgezählt kommt er **27 Mal**
vor: 20 Mal in `Mercenaries (6th definitive edition).cat`, 7 Mal in der
Spielsystemdatei — und ausschließlich in Bedingungen, 18 Mal als `instanceOf`,
9 Mal als `notInstanceOf`. Er ist damit kein Randfall, sondern der Mechanismus,
über den die gemeinsame Söldner-Bibliothek entscheidet, welche Armee welche
Söldner anheuern darf.

Der Reinraum-Evaluator konnte diesen Rahmen nicht auflösen. Er meldete das zwar
als Diagnose, wertete die Regel aber trotzdem — und zwar **fail-open**: ein nicht
auflösbarer Rahmen lieferte die Zahl null, und eine Bedingung der Art „ist keine
Instanz von" liest null als „trifft zu". Jede Ausschlussregel hielt also, auch in
genau der Armee, die sie ausschließen sollte. An einem einzelnen Roster gemessen
waren es 9 Diagnosen, über alle 112 Szenario-Roster 725.

Die eigentliche Frage dahinter war nie gestellt worden: **welcher Katalog ist
„der primäre"?** ADR-0032 hat das offen gelassen — und zwar begründet. Sein
Beschluss 2 mischt alle mitgegebenen Quellen in **eine einzige flache
Symboltabelle** und baut ausdrücklich keinen Kontext-Stack. Ein so
zusammengeführter Datensatz hat damit gar keinen ausgezeichneten Katalog: alle
Ids liegen gleichrangig nebeneinander. Solange nur aufgelöst wurde, war das
vollständig; sobald eine Regel nach dem primären Katalog fragt, fehlt eine
Antwort, die der Datensatz strukturell nicht geben kann.

## Entscheidungsfaktoren (Drivers)

- **Die Antwort muss aus den Daten kommen, nicht aus einer Annahme.** Der
  Bezugsrahmen wird von Kataloginhalten benutzt, die niemand aus diesem Projekt
  geschrieben hat.
- **Ein Roster mit mehreren Kontingenten darf nicht auf eine Antwort verkürzt
  werden.** Verbündeten-Kontingente sind im Format vorgesehen.
- **Der öffentliche Vertrag der Auswertung wächst.** Was hier entschieden wird,
  muss jeder künftige Roster-Leser füllen — auch der der Anwendung, sobald der
  Cutover kommt (ADR-0034).
- **Kein Widerspruch zu ADR-0032.** Die flache Auflösung ist gesetzt und soll
  nicht rückgängig gemacht werden.
- **Nicht auswertbar darf nicht wie erfüllt aussehen.** Das ist der Fehler, der
  überhaupt erst zu dieser Entscheidung geführt hat.

## Betrachtete Optionen

- **Option 1 — Herkunft aus dem Roster:** der primäre Katalog ist der
  Armee-Katalog des **Kontingents**, in dem der auswertende Knoten steht
  (`<force catalogueId="…">` der `.ros`).
- **Option 2 — Herkunft aus der Definition:** primär ist der Katalog, in dem die
  auswertende Regel geschrieben steht.
- **Option 3 — Herkunft aus dem Datensatz:** ein Katalog der mitgegebenen Liste
  wird zum primären erklärt, etwa der erste oder der einzige, der kein
  `catalogueLink`-Ziel ist.

## Entscheidungsergebnis

Gewählt: **Option 1 — der primäre Katalog kommt aus dem Roster-Kontingent.**

Ein Roster mit zwei Kontingenten hat damit **zwei verschiedene primäre Kataloge
gleichzeitig**, je nachdem, wo der auswertende Knoten steht. Das ist kein
Sonderfall der Umsetzung, sondern die Aussage selbst.

Der Wert wird bei der Erzeugung jedes Kontingent-Knotens gebunden und dabei gegen
die Wurzel-Ids der mitgegebenen `.cat` geprüft. Die Menge dieser Ids ist eine
**Pflichteingabe** des Baumbaus: eine still ergänzte leere Menge ließe jedes
Kontingent als unauflösbar gelten und sähe wie ein Datenmangel aus, obwohl sie
ein Programmierfehler wäre.

**Zweiter Beschluss derselben Entscheidung: eine Abfrage ohne Antwort liefert
einen eigenen Wert, und zwar genau einen.** Nicht die Zahl null — die ist eine
gültige Antwort und war die Ursache des fail-open. Und nicht einen Wert je
Herkunft, sondern **einen** für alle: unauflösbarer Bezugsrahmen, nicht
budgetierte Kostenart, unentscheidbarer primärer Katalog, nicht unterstütztes
Feld. Zwei Werte für dieselbe Aussage laden dazu ein, einen zu prüfen und den
anderen zu vergessen — genau so ist der Fehler entstanden, den diese ADR
beschreibt.

Gemeldet wird eine fehlgeschlagene Bindung erst, **wenn eine Regel fragt**.
Einem Kontingent, in dem kein Bezugsrahmen dieser Art vorkommt, ist die fehlende
Angabe folgenlos vorzuwerfen; und die Unentscheidbarkeit trifft nicht nur
Kontingente, sondern auch Knoten, über denen gar keines steht.

### Konsequenzen (Auswirkungen)

- **Positiv:** Die Söldner-Regeln der Definitive Edition wirken, und zwar in
  beide Richtungen — belegt durch ein Kontrast-Paar an echten Katalogdaten
  (dieselbe Auswahl in zwei Armeen, gegenläufiges Ergebnis, `docs/testing/primary-catalogue-scope/`).
  Über alle 112 Szenario-Roster gemessen fällt die Diagnose zu diesem
  Bezugsrahmen von 725 auf 0. Der eine gemeinsame Wert für „keine Antwort"
  schließt dieselbe Lücke zugleich für jeden anderen Rahmen.
- **Negativ:** Der öffentliche Roster-Vertrag ist um ein Feld gewachsen
  (`forces[i].catalogueId`, optional), das jeder künftige Roster-Leser füllen
  muss. Die Entscheidung ist dadurch schwer umkehrbar. Regeln, die bisher still
  falsch *hielten*, greifen jetzt — Erwartungen bestehender Szenarien haben sich
  entsprechend verschoben.
- **Neutral:** Die Verschärfung wirkt allgemein, nicht nur für diesen einen
  Rahmen. Sichtbar wird dadurch auch, dass der Bezugsrahmen `unit` bis heute gar
  nicht als Schlüsselwort geführt wird — er fällt jetzt auf, statt still falsch
  zu wirken.

## Vor- und Nachteile der Optionen

### Option 1 — Herkunft aus dem Roster

- **Gut, weil** das Format es so vorsieht: `<force catalogueId="…">` steht in
  jeder `.ros` und benennt genau den Armee-Katalog, aus dem das Kontingent
  aufgestellt wird.
- **Gut, weil** sie mit mehreren Kontingenten umgehen kann, ohne eine davon zu
  bevorzugen.
- **Gut, weil** sie ADR-0032 unberührt lässt: der Datensatz bleibt flach und
  ohne Auszeichnung; ausgezeichnet ist der Katalog je Kontingent, und die
  Auszeichnung stammt vom Roster.
- **Schlecht, weil** sie den öffentlichen Vertrag der Fassade erweitert und den
  Wert damit von einer Eingabe abhängig macht, die ein Aufrufer vergessen kann.

### Option 2 — Herkunft aus der Definition

- **Gut, weil** sie ohne jede Vertragsänderung auskäme.
- **Schlecht, weil** sie die Regeln, um die es geht, ins Gegenteil verkehrt: die
  27 Vorkommen stehen in der Söldner-Bibliothek und in der Spielsystemdatei. Ihr
  „primärer Katalog" wäre damit immer Mercenaries beziehungsweise das
  Spielsystem — nie die Armee, nach der sie fragen. Die Regel „nur, wenn dies
  nicht Armee X ist" wäre nicht mehr formulierbar.

### Option 3 — Herkunft aus dem Datensatz

- **Gut, weil** sie ohne Roster-Angabe auskommt und rein aus den Katalogen
  herleitbar wäre.
- **Schlecht, weil** sie ADR-0032 widerspricht: dessen flache Symboltabelle
  kennt bewusst keine Rangfolge, und die Stern-Struktur der Definitive Edition
  (jeder Armee-Katalog verweist auf dieselbe Mercenaries-`.cat`) macht die
  Auszeichnung nur scheinbar eindeutig — bei einem Datensatz mit zwei
  Armee-Katalogen ist sie es nicht mehr.
- **Schlecht, weil** sie bei Verbündeten-Kontingenten strukturell nur eine
  Antwort geben kann, wo es zwei gibt.
