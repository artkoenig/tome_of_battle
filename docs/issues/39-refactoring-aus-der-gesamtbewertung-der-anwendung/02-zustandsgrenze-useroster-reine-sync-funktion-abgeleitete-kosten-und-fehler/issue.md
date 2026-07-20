Status: ready-for-agent
Type: refactor
Blocked by: [01]

## Description

**Geruch:** Immutability-Verstoß und SSOT-Verstoß an derselben Nahtstelle —
dem Autosave-Effekt des Roster-Hooks. Beide werden gemeinsam behoben, weil sie
in demselben Effekt sitzen.

### Teil A — In-place-Mutation des React-Zustands

Die Funktion, die gespeicherte Roster mit dem System abgleicht, mutiert das
übergebene Roster direkt (Setzen des Namens, Löschen des veralteten
`costs`-Feldes) und meldet per Rückgabewert lediglich, dass etwas geändert
wurde. Aufgerufen wird sie mit dem **aktuellen React-State**.

Die anschließende Reparatur durch eine flache Kopie des Rosters greift zu kurz:
die tatsächlich mutierten Objekte liegen tief im Baum und behalten ihre
Referenz-Identität. Zwei konkrete Folgen:

- Jede Memoisierung, die auf einer Selection-Referenz vergleicht, sieht die
  Namensänderung nicht und rendert sie nicht nach.
- Der Undo-Stack enthält Einträge, deren Inhalt sich nachträglich verändert
  hat — ein Undo führt dann nicht mehr zu dem Zustand zurück, der zum
  Zeitpunkt der Aufzeichnung gezeigt wurde.

### Teil B — Abgeleiteter Zustand wird als State gespiegelt

Kosten und Validierungsfehler werden in eigenem State gehalten und in einem
verzögerten Effekt gefüllt, obwohl beide reine Ableitungen aus Roster und
System sind.

Dadurch zeigt die Oberfläche nach jeder Änderung für die Dauer der Verzögerung
die Kosten und Validierungsfehler des *vorherigen* Rosters. Das ist nicht
kosmetisch: die Aushebe-Verfügbarkeit leitet sich laut ADR-0022 aus dem
Validator ab — im Zeitfenster kann der Aushebe-Dialog eine Einheit als
verfügbar anbieten, die es nicht mehr ist.

**Vorgeschlagene Behebung:** Die Abgleichsfunktion pur machen — sie gibt ein
neues Roster zurück (oder signalisiert „unverändert"), statt zu mutieren; die
Traversierungs-Primitive aus Kind-Issue 01 liefern das immutable Abbilden.
Kosten und Validierungsfehler werden berechnet statt gespiegelt. Die
Verzögerung bleibt ausschließlich um das Persistieren bestehen — das ist der
einzige Grund, aus dem sie existiert.

## Acceptance Criteria
- [ ] Die Abgleichsfunktion mutiert ihr Argument nicht mehr, sondern liefert
      ein neues Roster; ein Test prüft die Unversehrtheit der Eingabe
- [ ] Kosten und Validierungsfehler werden aus Roster und System abgeleitet,
      nicht mehr in eigenem State gehalten
- [ ] Nach einer Änderung zeigt die Oberfläche unmittelbar die zugehörigen
      Kosten und Validierungsfehler — kein Zeitfenster mit veralteten Werten
- [ ] Die Verzögerung wirkt weiterhin auf das Persistieren, nicht auf Anzeige
      oder Validierung
- [ ] Ein Test belegt, dass ein aufgezeichneter Undo-Zustand sich nachträglich
      nicht mehr verändert
- [ ] `npm run lint` und `npm test` bleiben grün

## Comments
