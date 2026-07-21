Status: resolved
Type: fix
Blocked by: [01]

## Description

Befund K2. Das BSData-Attribut `shared` steuert, wie weit eine Beschränkung
oder Bedingung zählt:

- **geteilt**: gezählt werden alle Instanzen des betreffenden Eintrags im
  gesamten Roster
- **nicht geteilt**: gezählt wird nur die eine Instanz, an der die Beschränkung
  hängt

Der Parser liest das Attribut an Beschränkungen und an Bedingungen aus, doch
kein Konsument greift darauf zu. Faktisch verhält sich die App durchgehend so,
als wäre alles geteilt, und zählt immer aggregiert.

Jede nicht geteilte Beschränkung wird dadurch systematisch überzählt. Der
Validator meldet Verletzungen, die es nicht gibt — und weil die
Aushebe-Verfügbarkeit nach ADR 0022 aus demselben Validator abgeleitet wird,
sind Einträge gesperrt, die wählbar sein müssten.

In den vorliegenden WHFB6-Daten ist „geteilt" der Normalfall, weshalb der
Fehler bisher nicht aufgefallen ist. Nach ADR 0016 soll das Format aber generisch
unterstützt werden, nicht nur die heute vorliegenden Daten.

Ein geparster, aber unbenutzter Wert ist die schlechteste der Varianten: er
sieht nach Unterstützung aus, ohne welche zu sein. Sollte sich die Auswertung
als nicht sinnvoll umsetzbar erweisen, ist die Lücke stattdessen in ADR 0003
als bewusste Entscheidung festzuhalten und der tote Parserwert zu entfernen.

## Acceptance Criteria
- [ ] Eine nicht geteilte Beschränkung zählt nur die Instanz, an der sie hängt, nicht alle Vorkommen im Roster
- [ ] Eine geteilte Beschränkung zählt weiterhin über alle Instanzen im Roster
- [ ] Dasselbe gilt für Bedingungen, an denen das Attribut ebenfalls geparst wird
- [ ] Der Validator meldet für nicht geteilte Beschränkungen keine Verletzungen mehr, die aus der Überzählung entstanden
- [ ] Einträge, die dadurch fälschlich gesperrt waren, sind im Aushebe-Dialog wieder wählbar
- [ ] Tests decken beide Varianten ab und schlagen gegen den alten Stand fehl
- [ ] Falls die Auswertung nicht umgesetzt wird: ADR 0003 hält die Lücke begründet fest und der unbenutzte Parserwert ist entfernt

## Comments
- Das BSData-Attribut shared wird jetzt ausgewertet: isSharedQuery (battlescribeConstants.js) ist die einzige Auslegung, der Validator (resolveEntryConstraintCount) und die Bedingungsauswertung (evaluateCondition) zaehlen bei shared=false nur die Instanz, an der die Query haengt. Der Parser setzt zudem den XSD-Vorgabewert true fuer ein fehlendes Attribut. ADR 0003 Abschnitt 4 haelt die Regel fest.
