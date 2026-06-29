# Original User Request

## Initial Request — 2026-06-29T06:37:24Z

Das Ziel ist es, die Architektur der gesamten Anwendung zu analysieren, monolithische Strukturen zu refaktorisieren, Komponenten zu entkoppeln, Testabdeckung zu erhöhen und veralteten Code zu entfernen.

Working directory: /Users/artkoenig/Workspace/army_builder
Integrity mode: development

## Requirements

### R1. Refactoring & Entkopplung
Analysiere die Codebase, um große, monolithische Funktionen und Dateien zu identifizieren. Refaktorisiere diese in kleinere, gut testbare Module und verbessere den Datenfluss zwischen den Komponenten, ohne das bestehende Verhalten der Anwendung zu verändern.

### R2. Testabdeckung erhöhen
Identifiziere Bereiche der Geschäftslogik mit unzureichender Testabdeckung und füge aussagekräftige Unit-Tests hinzu. Bei jeder Änderung der Geschäftslogik muss geprüft werden, ob diese durch Tests abgedeckt ist.

### R3. Dead Code & Abhängigkeiten bereinigen
Analysiere die Anwendung auf ungenutzten Code (Dead Code) und überflüssige Abhängigkeiten und entferne diese sicher.

### R4. Projekt-spezifische Regeln (Fachlogik)
Es dürfen keine (Sub)Strings auf Englisch oder Deutsch als Schlüssel für das Parsen oder Validieren in der Geschäftslogik verwendet werden.

## Acceptance Criteria

### Verifizierung durch Tests
- [ ] Die gesamte Anwendung lässt sich nach den Änderungen fehlerfrei kompilieren/bauen.
- [ ] Alle Unit-Tests (bestehende und neu hinzugefügte) durchlaufen erfolgreich (z. B. via `npm test` oder entsprechendem Test-Kommando).

### Code-Qualität & Bereinigung
- [ ] Ein Bericht oder eine Zusammenfassung des entfernten "Dead Code" und der betroffenen refaktorisierten Komponenten liegt vor.
- [ ] Neue oder modifizierte Parser-/Validierungslogik nutzt keine sprachspezifischen Strings als Schlüssel.
