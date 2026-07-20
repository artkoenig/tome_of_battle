Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

**Geruch:** Magic Values, DRY- und SSOT-Verstoß.

Durch mehrere Befunde der Gesamtbewertung zieht sich dasselbe Muster: es
existiert bereits eine benannte Konstante oder ein exportierter Helfer, und
daneben steht eine handgeschriebene Kopie. Das deutet auf fehlende
Auffindbarkeit, nicht auf Nachlässigkeit — und schließt sich gemeinsam.

### Teil A — Konstanten neben handgeschriebenen Literalen

- Im Modifier-Evaluator existiert eine benannte Liste der Nicht-Eintrags-Scopes
  („parent", „force", „roster"); trotzdem prüft dieselbe Datei diese drei Werte
  an anderer Stelle von Hand einzeln ab. Dasselbe Muster steht mehrfach im
  Roster-Validator.
- Das Präfix für Roster-Limit-Felder ist im Validator als Konstante definiert
  und im Modifier-Evaluator zweimal hart kodiert.
- Die Eintragsarten („model", „unit", „upgrade") umgehen an mehreren Stellen
  das generierte Schema-Enum, das der Parser bereits verwendet.
- Die Vorgabe für das Punktelimit existiert einmal benannt und einmal als
  nacktes Literal; ebenso die Anzeigedauer eines Toasts.

### Teil B — Duplizierte Helfer

- Der Modifier-Evaluator implementiert eine lokale Kopie des Force-Eintrag-
  Lookups, den derselbe Solver bereits exportiert und den der Validator auch
  importiert. Sie ist zudem innerhalb eines Verzweigungszweigs in einer
  geschachtelten Closure definiert und wird daher bei jeder Bedingungsauswertung
  neu erzeugt.
- Die Zähllogik im Modifier-Evaluator existiert zweifach und ist bereits
  auseinandergedriftet: nur eine der beiden Kopien prüft die Kategorie-
  Zugehörigkeit.
- Das Prädikat „eigenständige Untereinheit" ist in der Roster-Synchronisation
  und in der Serialisierung **gegensätzlich** formuliert. Für einen fehlenden
  Wert liefern beide entgegengesetzte Antworten. Dass das heute nicht auffällt,
  hängt allein daran, dass der Parser das Attribut zu einem echten Boolean
  normalisiert — die Übereinstimmung ruht also auf einer Eigenschaft eines
  dritten Moduls, nicht auf den Prädikaten selbst.

**Vorgeschlagene Behebung:** Eine gemeinsame Konstantenquelle im Solver, auf die
beide Module verpflichtet werden; die duplizierten Helfer ersatzlos durch die
vorhandenen Exporte ersetzen; das Prädikat „eigenständige Untereinheit" genau
einmal im Solver definieren.

## Acceptance Criteria
- [ ] Die Scope-Schlüsselwörter, das Limit-Präfix und die Eintragsarten stammen
      an allen Stellen aus einer gemeinsamen Quelle; keine handgeschriebenen
      Literale mehr
- [ ] Die lokale Kopie des Force-Eintrag-Lookups ist entfernt und durch den
      vorhandenen Export ersetzt
- [ ] Die doppelte Zähllogik ist auf eine Umsetzung zurückgeführt; das
      auseinandergedriftete Verhalten ist bewusst entschieden und im Test
      festgehalten
- [ ] Das Prädikat „eigenständige Untereinheit" existiert genau einmal; ein
      Test deckt den Fall eines fehlenden Attributwerts ab
- [ ] Die Vorgabe für das Punktelimit und die Toast-Dauer sind je einmal
      benannt definiert
- [ ] `npm run lint` und `npm test` bleiben grün; kein verändertes Verhalten

## Comments

Übernommen aus Issue 28 (Punkt 3, duplizierte Zähllogik).
