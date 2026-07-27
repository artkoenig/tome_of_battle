Status: superseded
Type: fix
Blocked by: None

## Description

Ein Eintrag zaehlt unter seinem rohen `type`-Attribut mit (`model`, `unit`, …) —
das ist es, was die Bedingung `childId="model"` liest. Ein **verlinkter** Eintrag
tut das nicht.

Ursache: `readEntry` liest `type` (`src/evaluator/catalogReader.js`),
`readEntryLink` liest es nicht. Die Zaehl-Schicht kennt das Ziel deshalb ohne
seinen Typ (`src/evaluator/countIndex.js`, `targetsOf`).

Folge: dieselbe Einheit zaehlt unterschiedlich, je nachdem ob sie direkt steht
oder ueber einen `entryLink` hereingezogen wird. Eine `childId="model"`-Bedingung
sieht im zweiten Fall 0 Modelle.

Gefunden bei der Standards-Pruefung von Main-Issue 75. Dort nur dokumentiert
(JSDoc von `targetsOf`), **nicht** geaendert: die Behebung aendert Zaehlungen und
damit Verletzungslisten quer durch die E2E-Suite und gehoert in einen eigenen
Schnitt.

Verwandt mit Issue 76 (Verweis-Identitaet in der Zaehlung): beide fragen, unter
welchen Ids ein ueber einen Verweis gesetztes Vorkommen zaehlbar ist. Zusammen
anzufassen ist wahrscheinlich billiger als nacheinander.

## Acceptance Criteria
- [ ] Ein ueber einen `entryLink` gesetzter Eintrag zaehlt unter demselben Typ wie derselbe Eintrag direkt gesetzt.
- [ ] Eine `childId="model"`-Bedingung liefert in beiden Faellen dasselbe Ergebnis.
- [ ] Ein Szenario an echten Katalogdaten deckt genau diesen Unterschied ab (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
- superseded: Aufgegangen in Main-Issue 81 (Verweis-Identitaet in der Zaehlung), das Symptom 2 unveraendert uebernimmt. Issue 78 empfahl diese Zusammenlegung selbst.
