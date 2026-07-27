Status: resolved
Type: fix
Blocked by: None

## Description

Bevor irgendetwas ausgewertet wird, muss festgeschrieben sein, **was** der
Bezugsrahmen "primaerer Katalog" ueberhaupt bezeichnet. Das Format-Dokument
fuehrt ihn heute nicht.

Die Antwort ist an den Daten belegt: er bezeichnet den **Armeekatalog des
Kontingents**, in dem der Knoten sitzt — also den Katalog, den das Roster fuer
diese Force angibt. Nicht den Datensatz, nicht das Spielsystem, nicht die
gemeinsam genutzte Bibliothek.

Der Beleg, den diese Scheibe im Dokument festhalten soll:

- Alle 27 Vorkommen im Fixture-Satz sind Bedingungen (18 "ist eine Instanz von",
  9 "ist keine Instanz von"), alle mit demselben gezaehlten Feld und Wert.
- Von den 14 verschiedenen genannten Zielen loesen genau die drei im Fixture-Satz
  vorhandenen auf **Wurzel-Ids von Armeekatalogen** auf (Ogerkoenigreiche,
  Vampirfuersten, Orks und Goblins). Die uebrigen elf benennen die restlichen
  Armeen der vollstaendigen Ausgabe; zwei tragen ihren Namen sogar im Klartext
  mit.
- Die Id der gemeinsamen Soeldner-Bibliothek und die Id des Spielsystems kommen
  als Ziel **nie** vor.

Das steht nicht im Widerspruch zu ADR-0032: der *Datensatz* hat weiterhin keinen
ausgezeichneten primaeren Katalog — das *Roster* hat einen, je Kontingent.

Diese Scheibe aendert keinen Code. Sie legt die Bedeutung fest, gegen die die
beiden folgenden Scheiben gebaut und geprueft werden.

## Acceptance Criteria
- [ ] Das Format-Dokument fuehrt den Bezugsrahmen in seinen Aufzaehlungen und erklaert seine Bedeutung an einer eigenen Stelle.
- [ ] Die Bedeutung ist mit Fundstellen aus den Katalogdaten belegt, nicht behauptet.
- [ ] Das Dokument sagt ausdruecklich, was der Bezugsrahmen NICHT bezeichnet (Datensatz, Spielsystem, gemeinsame Bibliothek).
- [ ] Das Verhaeltnis zu ADR-0032 ist benannt: der Datensatz hat keinen primaeren Katalog, das Roster hat einen je Kontingent.

## Comments
- docs/battlescribe-data-format.md: scope="primary-catalogue" in beide Scope-Aufzaehlungen (7.6 Constraint, 7.7 Condition) und die Anhangstabelle 13.1 aufgenommen; neuer Abschnitt in 7.7 haelt die Bedeutung fest (Armee-Katalog des Kontingents, aus <force catalogueId> der .ros) samt Belegtabelle und drei Klartext-Fundstellen aus src/evaluator/__fixtures__/whfb6-definitive/, der Abgrenzung was der Rahmen NICHT bezeichnet, und dem Verhaeltnis zu ADR 0032. Alle Belege gegen die echten Katalogdaten nachgeprueft. Kein Code geaendert; Suite unveraendert gruen.
- Wichtiger Nebenbefund des Umsetzers: die Ogre-Wurzel-Id lautet 731d-5b13-2a92-5426 in src/solver/__fixtures__/whfb6/ und 731d-5b13-2a92-5427 in src/evaluator/__fixtures__/whfb6-definitive/ — ein Zeichen Unterschied. Ein Beleg aus dem falschen Ausschnitt sieht damit richtig aus und ist es nicht. Genau diese Verwechslung ist in dieser Sitzung schon einmal passiert (Sentinel-Beleg ffea-b24a). Der Umsetzer hat einen Warnhinweis in den neuen Abschnitt gesetzt; der Kopf des Dokuments wurde zusaetzlich korrigiert, weil er nur den Solver-Ausschnitt nannte und fuer 'wie das Projekt auswertet' auf src/solver/ verwies — die laut ADR-0030 fehlerhafte Engine.
