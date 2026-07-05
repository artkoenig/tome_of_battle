# Custom Agent Rules - Tome of Battle
Diese Anwendung ist zum Erstellen von Armeelisten für Tabletop-Spiele auf Grundlage von Battlescribe-Dateien.

## 1. Architektur-Richtlinien (ADRs)
* **Kanonische Quelle:** Alle Architekturentscheidungen und Richtlinien für dieses Projekt sind unter `docs/adr/` dokumentiert (siehe [README.md](file:///Users/artkoenig/Workspace/army_builder/docs/adr/README.md) für den Index).
* **Verpflichtung für Agenten:** Du **MUSST** vor jeder Code-Änderung oder -Generierung die relevanten ADRs unter `docs/adr/` einlesen (z. B. ADR 0002 für Datenbanken, ADR 0003 für Fachlogik, ADR 0004 für Styling). Sie dienen als deine primäre Arbeitsanweisung.
* **Keine Duplikation:** Richtlinien werden ausschließlich in den ADRs gepflegt. Diese Datei (`AGENTS.md`) enthält keine Detailregeln mehr.

## 2. Debugging & Umgebung
* **Local (macOS):** `browser_subagent` / `open_browser_url` funktionieren nicht. **Nutze Puppeteer** in `scripts/` via `run_command` (z. B. `node scripts/debug_ui.js`). Siehe [ADR 0006](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0006-testing-and-automation.md).
* **Cloud (Linux):** Nutze `/browser` und `browser_subagent` (voll unterstützt).

## 3. Git & PRs
* PRs werden immer gegen den `staging`-Branch erstellt (siehe [ADR 0009](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0009-branching-and-release-train-strategy.md)).
* Pushes auf Remote-Repositories erfolgen lokal (macOS) nur bei expliziter Aufforderung.

## 4. UI/UX Reviews & Feature-Inspiration
* **Ablauf bei UI/UX Review-Anfragen:**
  1. Führe das Skript `node scripts/generate_screenshots.js` aus, um das aktuelle Interface visuell zu erfassen.
  2. Nutze die Screenshots zur Analyse und als kreatives Sprungbrett.
* **Fokus:** Suche nach Redundanzen und UI-Ballast. Achte auf visuelle Harmonie und Konsistenz.

## 5. Monitoring & Crons
* **Monitoring Crons:** Geplante Monitoring-Crons müssen strikt in einem Intervall von **max. 3 Minuten** ausgeführt werden, um den Systemstatus und die Integrität der Hintergrundprozesse zeitnah zu überwachen.
