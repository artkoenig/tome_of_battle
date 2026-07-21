Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

**Geruch:** God Component / Divergent Change — `src/components/RosterEditor.jsx`
(525 Zeilen) rendert in **einer** Funktion sieben unabhängige Belange:

1. die Kopfleiste mit Titel, Punktestand, Undo/Redo und Aktionen
2. die Kategorie-Sektionen je Kontingent, samt Sichtbarkeits- und
   Primär-Kategorie-Logik
3. die Constraint-Chips (Min/Max) im Kategorie-Kopf
4. die ein-/ausklappbaren Listenregel-Gruppen
5. die Sektion der armeeweiten Auswahl
6. die Fallback-Sektion „Sonstiges"
7. das Validierungs-Panel („Lagerbericht") mit blockierenden und rein
   informativen Meldungen

Verstärkende Symptome:

- **Inline-IIFEs im JSX** an zwei Stellen — ein Ausdruck, der eine Funktion nur
  deshalb erzeugt und sofort aufruft, weil an der Stelle kein Anweisungsblock
  erlaubt ist. Das ist eine benannte Funktion, die ihren Namen nicht bekommen
  hat.
- **DRY-Verletzung:** dieselbe Einheitenkarte wird mit denselben zwölf Props an
  **drei** Stellen aufgerufen (Kategorie-Sektion, armeeweite Auswahl,
  „Sonstiges"). Ein neuer Prop muss dreifach eingefädelt werden.
- **Beschattete Bindung:** die Hilfsfunktion für die Primär-Kategorie-Prüfung
  deklariert eine lokale Variable, die den gleichnamigen Zustandswert der
  Komponente verdeckt.

**Empfohlene Behebung:** Die Belange in eigene Komponenten heben — mindestens
eine Kontingent-Sektion, eine Kategorie-Gruppe und ein Validierungs-Panel —
sodass die Wurzelkomponente nur noch komponiert. Die dreifach duplizierte
Einheitenkarten-Liste wird dabei zu **einem** Aufruf einer gemeinsamen
Listenkomponente.

**Abgrenzung:** Rein strukturell. Es ändert sich kein Verhalten, kein Styling
und keine Solver-Schnittstelle.

**Kopplung an Haupt-Issue 36 (Editor-Kontext):** Der Maintainer hat 36
(Prop-Bündel durch Editor-Kontext ersetzen) bewusst auf `superseded` gesetzt.
Der Data Clump besteht messbar fort. Die Entscheidung, ob ein — laut der dort
konservierten Analyse zweistufiger — Provider noch nötig ist, wird **nach**
diesem Issue neu getroffen: die Zerlegung reduziert die Zahl der Aufrufstellen
bereits, womit der Nutzen eines Kontextes anders ausfallen kann als bei der
damaligen Bewertung.

## Acceptance Criteria
- [ ] Die Editor-Wurzelkomponente enthält keine Inline-IIFEs mehr im JSX.
- [ ] Die Einheitenkarte wird nur noch an **einer** Stelle mit ihrem Prop-Satz
      aufgerufen.
- [ ] Die beschattete Bindung in der Primär-Kategorie-Prüfung ist beseitigt.
- [ ] Jede herausgelöste Komponente hat genau einen Änderungsgrund und einen
      Namen, der ihn benennt.
- [ ] Die bestehenden Editor-Tests laufen unverändert grün; für die
      herausgelösten Komponenten kommen isolierte Tests hinzu.
- [ ] Ein Vorher/Nachher-Screenshot des Editors belegt, dass sich die Ansicht
      nicht verändert hat.

## Comments
