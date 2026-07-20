Status: ready-for-agent
Type: refactor
Blocked by: [01, 02]

## Description

**Geruch:** Long Function, OCP-Verstoß, Primitive Obsession, DRY-Verstoß.

Die Funktion, mit der der Roster-Hook Unter-Selections ändert, umfasst rund
90 Zeilen und verzweigt in einer `if/else`-Kette über **sechs Aktions-Strings**
für Hinzufügen, Entfernen sowie Erhöhen und Verringern — je einmal für
Instanzen und einmal für Options-Definitionen.

Vier konkrete Schäden:

1. **Union-Parameter.** Derselbe Parameter ist je nach Zweig mal eine ID, mal
   ein Options-Objekt. Der Parametername gesteht das ein, statt es aufzulösen —
   welcher Typ zu welcher Aktion gehört, ist nirgends kodiert.
2. **Duplizierte Kernlogik.** Die Instanz-Zweige und die Basis-Zweige
   wiederholen die Erhöhen-/Verringern-Logik nahezu wörtlich, inklusive der
   Regel „bei Erreichen von null aus der Liste entfernen". Eine Änderung daran
   muss an beiden Stellen erfolgen.
3. **Offen/Geschlossen verletzt.** Jede neue Operation zwingt zu einem weiteren
   Zweig in derselben Funktion.
4. **Seiteneffekt über die Rekursion.** Ein Flag in der umschließenden Closure
   steuert den Abbruch des Baumdurchlaufs, wodurch die Durchlauffunktion nicht
   rein ist. Zusätzlich täuscht eine lokale Konstante mit dem Wert 1 eine
   Konfigurierbarkeit vor, die es nicht gibt.

**Vorgeschlagene Behebung:** Auftrennen in benannte Operationen mit je eigener,
eindeutiger Signatur — Hinzufügen einer Option, Entfernen einer Instanz,
Ändern einer Anzahl. Die Aktions-Strings entfallen dadurch ersatzlos. Der
Baumdurchlauf kommt aus den Primitiven von Kind-Issue 01.

## Acceptance Criteria
- [ ] Die Aktions-Strings sind ersatzlos entfallen; die Aufrufer rufen benannte
      Operationen mit eindeutigen Parametertypen auf
- [ ] Kein Parameter ist mehr ein Union aus ID und Objekt
- [ ] Die Erhöhen-/Verringern-Logik inklusive der Null-Regel existiert genau
      einmal
- [ ] Der Baumdurchlauf nutzt die Primitiven aus Kind-Issue 01; kein Flag in
      einer umschließenden Closure steuert den Abbruch
- [ ] Die bestehenden Tests des Roster-Hooks bleiben inhaltlich gültig und grün
- [ ] `npm run lint` und `npm test` bleiben grün; kein verändertes Verhalten

## Comments

Übernommen aus Issue 28 (Punkt 6 betreffend inkonsistente Union-Shapes,
soweit er diese Funktion betrifft).
