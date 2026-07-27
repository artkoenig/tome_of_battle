# Ein über einen Verweis gesetztes Vorkommen trägt den Verweis als seine Definition

- **Status:** Accepted
- **Datum:** 2026-07-27
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** setzt ADR-0032 (Evaluator löst
  Mehr-Katalog-Datensätze global-by-ID auf) fort und schärft dessen
  Verweis-Auflösung um die Frage der *Zähl-Identität*; berührt ADR-0035
  (Verfügbarkeit aus Fähigkeitsdatensätzen) und ADR-0036 (Angebots-Anker), deren
  Verweis-Slots dieselbe Lesart tragen; gilt allein für die Reinraum-Engine nach
  ADR-0030 und bindet die E2E-Erwartungen nach ADR-0033.

## Kontext und Problemstellung

BattleScribe-Katalogdaten kennen zwei Wege, auf denen ein wählbarer Eintrag an
eine Stelle des Baums gelangt: er steht dort direkt, oder ein `entryLink` zieht
eine anderswo stehende Definition herein. Der Verweis hat dabei eine **eigene,
von seinem Ziel verschiedene Id** und darf selbst Grenzen, Modifikatoren, Kosten,
Kategorien und Info-Elemente tragen, die *an dieser Position* gelten.

Ein gespeichertes Roster benennt ein so entstandenes Vorkommen deshalb mit
**zwei** Ids: `entryId` (das Ziel) und `entryLinkId` (der Verweis).

Die Engine behandelte den Verweis bislang als reine Durchleitung: sie band das
Vorkommen an die Zieldefinition und verwarf die Verweis-Id. Zwei Fehler folgten
daraus, beide an echten Katalogdaten belegt:

1. Eine Grenze, die **am Verweis** deklariert ist, fand ihr eigenes Vorkommen
   nicht. Sie fragte nach der Verweis-Id, der Zählindex kannte die Instanz aber
   nur unter der Ziel-Id. Ergebnis: Ist 0 gegen `min 1`, also eine gemeldete
   Pflichtverletzung für eine Auswahl, die im Roster gesetzt ist. Belegt an
   `Mercenaries (6th definitive edition).cat` für *Hand Weapon*
   (`dfd9-3e46-eda5-be8b`) und *Light Armour* (`feb1-c10d-9318-dbda`).
2. Ein verlinkter Eintrag zählte **nicht unter seinem Typ**. Der Typ (`model`,
   `unit`, …) hing an der Zieldefinition; die Zählschicht kannte das Ziel ohne
   ihn. Eine Bedingung `childId="model"` sah bei einem über einen Verweis
   bezogenen Modell 0 Modelle — dieselbe Einheit zählte also unterschiedlich, je
   nachdem auf welchem Weg sie in den Baum kam.

Die eigentliche Frage hinter beiden: **Was identifiziert ein Vorkommen, wenn es
über einen Verweis entstanden ist?**

## Entscheidungsfaktoren (Drivers)

- Dieselbe Einheit muss gleich zählen, unabhängig vom Weg, auf dem sie in den
  Baum kam. Alles andere ist für den Nutzer nicht erklärbar.
- Am Verweis deklarierte Angaben müssen für das Vorkommen gelten — sonst ist die
  Möglichkeit, an einem Verweis zu deklarieren, in den Daten wirkungslos, obwohl
  die Katalogautoren sie tragend benutzen.
- Zwei verschiedene Verweise auf dasselbe Ziel müssen unterscheidbar bleiben.
- Die Zählung läuft in einer Fixpunktschleife und wird sehr häufig abgefragt; die
  Lösung muss billig sein und die 100-ms-Messschwelle halten.
- Die Erwartungsdaten der E2E-Suite werden nach ADR-0033 black-box aus den
  Katalogdaten abgeleitet. Eine Engine-Semantik, die dem Format-Dokument
  widerspricht, erzeugt dauerhaft „unerklärliche" Abweichungen.

## Betrachtete Optionen

1. **Ziel-getragen, Verweis verworfen** — der Zustand vor dieser Entscheidung.
2. **Ziel-getragen, Verweis als Zusatzfeld** am Instanzknoten mitführen.
3. **Verweis-getragen, mengenwertige Zähl-Identität** — die hier gewählte Option.
4. **Verweis-getragen, ausschließlich unter der Verweis-Id zählen.**

## Entscheidungsergebnis

**Option 3.** Die Entscheidung besteht aus drei untrennbaren Teilen:

1. **Das Vorkommen trägt den Verweis.** Die Definition eines Vorkommens ist der
   Verweis, wenn das Roster einen nennt und dieser auflöst; sonst das Ziel. Der
   Verweis ist kein Durchleitungsknoten, sondern Träger einer eigenen Identität.
   Damit greifen alle an ihm deklarierten Angaben ohne Zusatzarbeit, weil jeder
   vorhandene Verweis-Pfad der Engine ohnehin schon von einer Verweis-Definition
   ausgeht — genauso wie bei einem Pflicht-Phantom oder einem Angebots-Anker auf
   denselben Verweis.

2. **Gezählt wird mengenwertig.** Ein Vorkommen ist unter der eigenen Id **und
   unter jedem Glied seiner Verweiskette bis einschließlich des Ziels** benennbar.
   Zwei Definitionen benennen dasselbe Vorkommen, wenn ihre Id-Mengen sich
   schneiden. Eine mengenwertige Identität ist der Kern: ein Skalar kann die Frage
   „unter was zählt es" und die Frage „welches ist es" nicht gleichzeitig
   beantworten. Doppelzählung entsteht dabei nicht, weil jede Abfrage genau einen
   Schlüssel nennt — der Index beantwortet „wie viele Vorkommen tragen Schlüssel
   k", nicht „Summe über Schlüssel". Id-Schlüssel und Typ-Schlüssel bleiben
   voneinander unterscheidbar, damit eine Katalog-Id niemals als Vokabelwort
   gelesen werden kann.

3. **Getypt wird nach dem Ziel.** Der gezählte Typ eines Vorkommens ist das rohe
   `type`-Attribut der tragenden Definition, bei einem Verweis also das seines
   aufgelösten Ziels. Er wird **einmal** an einer Stelle bestimmt und **nie** in
   der Abfrage: eine typbezogene Bedingung darf nicht wissen, ob ein Verweis im
   Spiel war. Ausdrücklich **nicht** aus `entryLink/@type` gelesen — die XSD
   besetzt dieses Attribut mit der *Art des Verweisziels*
   (`selectionEntry`/`selectionEntryGroup`), nicht mit dem Eintragstyp.

Ergänzend gilt: **eine an einem Verweis verankerte Grenze zählt unter der
aufgelösten Ziel-Id.** `docs/battlescribe-data-format.md` §3.4 und §7.6 halten
zweimal ausdrücklich fest, dass `scope="parent"` aufgelöste Ziel-Ids vergleicht
und nicht `entryLinkId`s, weil verschiedene Verweise auf dasselbe Ziel zeigen
können. Dieses Dokument ist die Quelle, aus der der Black-Box-Autor seine
Erwartungen ableitet; die Engine folgt ihm. Die Verweis-Id bleibt trotzdem
Zählschlüssel, damit eine Bedingung, die den Verweis benennt, ihn findet.

**Nicht Teil dieser Entscheidung:** die Deutung von `shared` (bleibt
Rahmen-Einschränkung nach ADR-0003 §4) und das Erraten eines Verweises, den das
Roster verschweigt. Nennt ein Roster nur `entryId` und zeigen mehrere Verweise auf
dieses Ziel, ist der Verweis nicht ableitbar; dann bleibt es beim Ziel, und die am
Verweis deklarierten Angaben gelten nicht. Das ist eine bewusste, dokumentierte
Grenze und kein Heuristikgriff nach dem „ersten passenden" Verweis.

### Unabhängige Bestätigung

Der Entwurf wurde vor der Umsetzung gegen einen Reinraum-Gegenentwurf gestellt
(`clean-room-review`): ein Architekt, der weder den Code noch den Befund noch
diesen Plan sah, entwarf dasselbe Problem aus Problemstellung, Datenform und
Randbedingungen allein. Er kam auf dieselbe mengenwertige Identität, dieselbe
Zählung unter Verweis und Ziel, dieselbe einmalige Typbestimmung außerhalb der
Abfrage — und verwarf ausdrücklich beide naiven Varianten (nur Ziel-Id: „zwei
Verweise auf dasselbe Ziel werden ununterscheidbar"; nur Verweis-Id:
„Definitions-Grenzen und Typbedingungen verlieren alle über Verweise entstandenen
Vorkommen — die spiegelbildliche Variante desselben Fehlers"). Zwei seiner
Verbesserungen sind eingearbeitet: das vollständige Auslaufen der Verweiskette
statt dreier Stichproben, und die Unterscheidbarkeit von Id- und Typ-Schlüsseln.

### Konsequenzen (Auswirkungen)

- **Die Wirkung reicht über die zwei behobenen Symptome hinaus.** Mit dem
  verweis-getragenen Vorkommen greifen erstmals *alle* am `entryLink`
  deklarierten Angaben, auch Kosten und Modifikatoren. Belegt in den
  Fixture-Daten: der Light-Armour-Verweis `d824-eb03-77ac-8be2` trägt einen
  Kosten-Modifikator „+3 je Modell"; der Gorger-Verweis `4983-51a9-3fef-ddf1` an
  Skrag setzt die Mindestgrenze `e998-b2d3-1333-a37d` des Modells auf 2. Beides
  wirkte vorher nicht. Verletzungslisten, Kostensummen und Budget-Meldungen
  mehrerer Szenarien ändern sich dadurch — das ist die Behebung, nicht ein
  Fehler. Jede geänderte Erwartung braucht ihre eigene Begründung aus den
  Katalogdaten und darf nach ADR-0033 **nicht** an die Engine-Ausgabe getunt
  werden.
- **Im Bericht ändern sich Werte, nicht die Form.** An verweis-getragenen Slots
  ist `defId` künftig die Verweis-Id und `targetDefId` die Ziel-Id. Das ist
  genau die Lesart, die der Manifest-Vertrag ohnehin dokumentiert; Runner und
  Manifest-Schema bleiben unangetastet.
- **Die Roster-Form der Fassade wächst um ein Feld** (`linkDefId` neben `defId`).
  Leerer String und fehlendes Feld bedeuten gleichermaßen „direkt gesetzt";
  Kontingente tragen es nicht. Damit die Testumgebung und die Engine über
  Identität nicht auseinanderlaufen können, wird diese Naht im Format-Dokument
  beschrieben — vorher konnte ein Szenario-Autor „über einen Verweis gesetzt"
  nicht ausdrücken.
- **Ein Bezugsrahmen, der eine Eintrags-Id nennt, trifft einen Vorfahren unter
  jeder seiner Identitäts-Ids.** Ohne diese Regel fände ein `scope="<Ziel-Id>"`
  seinen Rahmen nicht mehr, sobald der Rahmenknoten die Verweis-Id trägt. In den
  Fixture-Daten ist dieser Pfad latent und wird von keinem E2E-Fall erreicht; er
  braucht einen Modultest.
- **Eine `max`-Grenze aggregiert über mehrere Verweise auf dasselbe Ziel** im
  selben Rahmen. In den Fixture-Daten kein belegter Fall. Zeigt die Suite einen,
  ist das eine Entscheidung über diese ADR, nicht eine Anpassung im
  Implementierungslauf.
- **Keine neue Diagnose-Art.** Ein besetztes, nirgends auflösbares `linkDefId`
  fällt auf die Ziel-Id zurück und erzeugt eine `UNRESOLVED_DEFINITION`-Diagnose.
- Die Zählschlüssel je realem Knoten wachsen um eins bis zwei. Der Effekt ist
  klein, die 100-ms-Schwelle aber hart — nach der Umsetzung ist einmal zu messen.

## Vor- und Nachteile der Optionen

### Option 1 — Ziel-getragen, Verweis verworfen

- **Dagegen:** genau die beiden belegten Fehler. Am Verweis deklarierte Grenzen,
  Kosten und Modifikatoren sind wirkungslos, obwohl die Daten sie tragend nutzen;
  zwei Verweise auf dasselbe Ziel sind ununterscheidbar.

### Option 2 — Ziel-getragen, Verweis als Zusatzfeld

- **Dafür:** ändert die bestehende Bindung nicht.
- **Dagegen:** zieht eine Signaturänderung durch alle Verweis-Pfade nach sich,
  verdoppelt die Erb-Regel an jeder Stelle, die sie liest — und widerspricht dem
  Berichtsvertrag, der den Verweis-Slot ausdrücklich den Verweis tragen lässt.
  Zwei Kopien derselben Regel driften.

### Option 3 — Verweis-getragen, mengenwertige Zähl-Identität

- **Dafür:** eine Zuständigkeit an einer Stelle (die Bindung); alle vorhandenen
  Verweis-Pfade greifen ohne Zusatzarbeit; Verweise auf dasselbe Ziel bleiben
  unterscheidbar; unabhängig bestätigt.
- **Dagegen:** die Wirkung reicht weiter als die zwei Symptome, mit
  entsprechendem Aufwand an den Erwartungsdaten. Der gezählte Typ muss vom Ziel
  geholt werden, was ohne die XSD-Kenntnis kontraintuitiv aussieht.

### Option 4 — Verweis-getragen, nur unter der Verweis-Id zählen

- **Dafür:** die einfachste Zählregel.
- **Dagegen:** widerspricht dem Format-Dokument, das für `scope="parent"`
  ausdrücklich aufgelöste Ziel-Ids vergleicht. Definitions-Grenzen und
  Typbedingungen verlören alle über Verweise entstandenen Vorkommen — die
  spiegelbildliche Variante von Option 1.
