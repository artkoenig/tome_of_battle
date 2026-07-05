# 0001: Record Architecture Decisions

- **Status:** Accepted
- **Datum:** 2026-07-05
- **Beteiligte:** Entwickler, KI-Assistenten (Claude, Gemini Antigravity)
- **Zugehörige ADRs:** Keine

## Kontext und Problemstellung

Bei der Weiterentwicklung der Anwendung werden laufend wichtige Architekturentscheidungen getroffen (z. B. bezüglich Datenfluss, Synchronisierung, Styling, Framework-Spezifika). Bisher waren diese Entscheidungen verstreut in Dokumenten wie `CLAUDE.md`, `.agents/AGENTS.md` oder mussten direkt aus dem Quellcode erschlossen werden. Dies führt bei neuen Entwicklern oder KI-Assistenten leicht zu Missverständnissen, Architekturbrüchen (z. B. Umgehung des Repository-Patterns, Einführung von Inline-Styles) und unnötigem Code-Churn.

Es wird eine einheitliche, versionierte und leicht zugängliche Struktur benötigt, um Architekturentscheidungen festzuhalten und fortzuschreiben.

## Entscheidungsfaktoren (Drivers)

- **Transparenz:** Klare Nachvollziehbarkeit, *warum* eine bestimmte Architektur gewählt wurde.
- **Konsistenz:** Verhinderung von abweichenden Implementierungen im Projekt.
- **Agenten-Kompatibilität:** Bereitstellung strukturierter Vorgaben, die KI-Assistenten parsen und einhalten können.
- **Wartungsaufwand:** Das System sollte leichtgewichtig sein und direkt im Git-Repository gepflegt werden können.

## Betrachtete Optionen

- **Option 1:** Pflege in einer zentralen Dokumentation (z. B. in einer großen `ARCHITECTURE.md`).
- **Option 2:** Verwendung eines dezentralen ADR-Systems (`docs/adr/`) mit fortlaufend nummerierten Markdown-Dateien auf Basis eines Standard-Templates.
- **Option 3:** Ausschließlich informelle Dokumentation in PRs und Commit-Nachrichten.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Dezentrales ADR-System)**.

### Details des ADR-Prozesses
1. **Speicherort:** Alle ADRs werden unter `docs/adr/` als `.md`-Dateien abgelegt.
2. **Format:** Dateinamen folgen dem Schema `XXXX-titel.md` (z. B. `0001-record-architecture-decisions.md`).
3. **Template:** Neue Dokumente basieren auf der Vorlage `docs/adr/template.md`.
4. **Zentraler Index:** Die Datei `docs/adr/README.md` listet alle ADRs mit ihrem aktuellen Status und Änderungsdatum auf.
5. **Status-Lebenszyklus:**
   - `Proposed`: Die Entscheidung ist vorgeschlagen und steht zur Diskussion.
   - `Accepted`: Die Entscheidung ist freigegeben und für das Projekt bindend.
   - `Rejected`: Die Entscheidung wurde nach Diskussion abgelehnt.
   - `Deprecated`: Die Entscheidung ist veraltet und nicht mehr aktiv anzuwenden.
   - `Superseded`: Die Entscheidung wurde durch ein neueres ADR (z. B. ADR 0010 ersetzt ADR 0002) abgelöst.

### WICHTIG: Synchronisation mit Agenten-Konfigurationen
Da KI-Assistenten (`Gemini Antigravity`, `Claude Code`) eine zentrale Rolle bei der Code-Generierung in diesem Projekt spielen, gilt folgende zwingende Regel:
- **Synchronisationspflicht:** Sobald ein ADR den Status `Accepted` erhält oder aktualisiert wird, müssen die entsprechenden Abschnitte in den Konfigurationsdateien für Agenten (`.agents/AGENTS.md` und `CLAUDE.md`) synchronisiert bzw. aktualisiert werden. So ist garantiert, dass die LLMs stets nach den aktuellsten Architekturrichtlinien arbeiten.

### Konsequenzen (Auswirkungen)

- **Positiv:** Architekturentscheidungen sind direkt im Code-Repository versioniert und verlinkt. Neue Entwickler und Agenten finden sofort eine strukturierte Richtlinie vor.
- **Negativ:** Minimaler Mehraufwand bei der Dokumentation neuer Entscheidungen und beim synchronen Aktualisieren der Agenten-Konfigurationsdateien.
