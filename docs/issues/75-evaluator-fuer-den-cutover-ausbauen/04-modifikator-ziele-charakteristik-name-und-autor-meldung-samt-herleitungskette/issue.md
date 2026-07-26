Status: ready-for-agent
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
