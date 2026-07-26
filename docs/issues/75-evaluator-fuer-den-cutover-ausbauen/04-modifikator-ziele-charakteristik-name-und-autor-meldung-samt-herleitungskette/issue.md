Status: resolved
Type: refactor
Blocked by: [03]

## Description

Die Ziel-Aufloesung eines Modifikators kennt heute Kategorie und Sichtbarkeit
als Schluesselwoerter und Kostenart bzw. Grenze ueber die Symboltabelle — **jeder
andere Text wird zum Hinweis-Ziel**. Damit fallen drei Dinge still durch: ein
Modifikator auf einen Merkmalswert, einer auf einen Namen, und die Meldungen der
Katalog-Autoren (sie landen im Kategorie-Zweig und werden als nicht
unterstuetzt verworfen).

Zusaetzlich soll ein Grenzwert seine **Herleitung** tragen: Basiswert, dann je
Schritt welcher Modifikator ihn wie veraendert hat und welche Auswahl der Zeuge
fuer dessen erfuellte Bedingung war. Damit faellt die Ursache nach ADR-0027 exakt
an, statt hinterher aus dem Endzustand rekonstruiert zu werden.

Ziele und Kette liegen in **einem** Slice, weil beide denselben Schreibpfad der
wirksamen Werte anfassen; sie zweimal aufzumachen waere doppelte Arbeit am
selben Nadeloehr.

## Acceptance Criteria
- [ ] Ein bedingter Modifikator auf einen Merkmalswert wirkt sich auf den wirksamen Wert aus.
- [ ] Ein bedingter Modifikator auf einen Namen wirkt sich auf den wirksamen Namen aus.
- [ ] Eine Autor-Meldung des Katalogs wird als solche erkannt, mit ihrem Schweregrad gefuehrt und nicht mehr als nicht unterstuetzt verworfen.
- [ ] Ein wirksamer Grenzwert traegt seine Herleitung: Basiswert, die einzelnen Schritte mit Art, Wert und Wiederholungsfaktor, und je bedingtem Schritt den Zeugen.
- [ ] Was die Engine weiterhin nicht deuten kann, meldet sie sichtbar — kein stilles Auffangen mehr in ein Hinweis-Ziel.
- [ ] Die bestehenden E2E-Erwartungen sind dort nachgezogen, wo bisher eine Diagnose stand, die jetzt einer echten Wirkung weicht; die Aenderung ist je Szenario begruendet.
- [ ] Neue Szenarien decken Merkmals-Modifikator, Namens-Modifikator und Autor-Meldung an echten Katalogdaten ab (ADR-0033, verfasst vom Black-Box-Autor).

## Comments
- Fachfrage geklaert (Charakteristik-Ziel und Profil-Zuordnung): Ein Merkmals-Modifikator trifft **genau das Profil, an dem er haengt** — nie 'alle Profile eines Knotens'. Beleg aus den Fixture-Katalogen (whfb6-definitive, alle .cat + .gst): von 101 Modifikatoren, deren field eine characteristicType-ID nennt, haengen 30 an einem <profile> und 71 an einem <infoLink>; **keiner** an einer selectionEntry, einem entryLink, einer selectionEntryGroup, einer categoryEntry oder einem forceEntry. Der Knoten ist also nie Traeger eines solchen Modifikators, und die Frage 'alle oder eines' beantwortet sich aus den Daten: der Traeger ist die Zuordnung. Fuehrt ein Knoten mehrere Profile mit demselben Charakteristik-Typ, bleiben die uebrigen unberuehrt. Die XSD stuetzt das: alle Info-Elemente erben von EntryBase (Catalogue.xsd:102-115) und tragen daher eigene <modifiers>. Umgesetzt ueber einen Traeger-Schluessel (Knoten, Traeger) in der Effektiv-Werte-Schicht; ein infoLink ist dabei selbst der Traeger (das Vorkommen des verlinkten Profils) und erbt Merkmale und Modifikatoren seines Ziels. Dokumentiert in docs/evaluator-architecture.md §3.4.
- Umgesetzt: (1) Modifikator-Ziele CHARACTERISTIC / NAME / MESSAGE (error|warning|info mit Schweregrad) samt Charakteristik-Typ-IDs in der Symboltabelle und join-Trennzeichen; das Auffang-Ziel NOTE ist ersatzlos entfallen — ein nicht deutbares field meldet jetzt UNSUPPORTED_MODIFIER_TARGET. (2) Modifikatoren werden auch an Info-Elementen gelesen und angewendet (EntryBase, Catalogue.xsd:102-115), wirkend auf ihren Traeger. (3) Grenzwerte entstehen als Herleitungskette (Basiswert + Schritte mit Art, rohem Wert, Faktor, Zwischenwert, bedingt-Flag und Zeugen); sie ist die einzige Quelle des Endwerts und erreicht ueber constraints.js die Verletzung im Bericht. (4) Basis-hidden aus dem XML fliesst erstmals in die effektive Sichtbarkeit. (5) Der Faehigkeitsdatensatz traegt defId, effektiven Namen, Autor-Meldungen und effektive Merkmalswerte; der Manifest-Runner kann sie per expect.capabilities pruefen. Drei neue E2E-Szenarien vom Black-Box-Autor: modifier-characteristic-value, modifier-effective-name, author-message-severity.
