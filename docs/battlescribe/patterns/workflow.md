[BSData-Formatreferenz](../../battlescribe-data-format.md) › Praxis

# 12. Workflow: Erstellen, Versionieren, Veröffentlichen

*(Aus Data Author Guide / Getting Started.)*

## 12.1 Werkzeuge

- **BattleScribe Data Editor** (bzw. der **New Recruit Editor**, <https://www.newrecruit.eu/download/>) —
  bearbeitet die Datendateien in einer grafischen Oberfläche, sodass man das rohe XML (oft hunderte
  Zeilen) nicht von Hand editieren muss.
- **GitHub Desktop** oder ein beliebiger git-Client.
- Ein **Daten-Repository auf GitHub** (eigenes oder ein Fork).

## 12.2 Mitwirken

- **Aktive Repos:** Repo **forken**, Änderungen machen, als **Pull Request** einreichen — vorab die
  Maintainer kontaktieren, um Doppelarbeit zu vermeiden.
- **Weniger aktive Repos:** Nach Absprache Schreibrechte anfragen und direkt committen.

## 12.3 Entwicklungszyklus

1. Repo als „Current repository" wählen, **synchronisieren** (immer auf der neuesten Version
   arbeiten!).
2. Issues durchsehen (Labels/Milestones filtern) oder ein neues Issue anlegen.
3. Bearbeiten. Zum Reverse-Engineering ruhig bei etablierten Repos abschauen, wie Bedingungen/
   Modifier dort umgesetzt sind.
4. Auf Fehler prüfen, `revision` hochzählen.
5. Committen — im Commit die **Issue-Nummer erwähnen** (`Goblin fix #1234`); Keywords wie
   `closes #93` schließen das Issue automatisch.
6. **Synchronisieren** — erst dadurch landen die Änderungen auf GitHub.

## 12.4 Releasing & Versionierung

Nutzer mit Auto-Update-Link laden das **letzte Release** (ein getaggter Stand). Konvention `vMAJOR.MINOR.PATCH`:

- **MAJOR** — ändert sich selten (neues Regelbuch / grundlegend Neues für alle).
- **MINOR** — mehr als nur Bugfixes/Kleinkram (z. B. neuer Katalog). Setzt PATCH auf 0 zurück.
- **PATCH** — häufigste Änderung (Bugfixes). Ein Release „kostet nichts" außer einer Minute.

> Nach einem Release kann es **bis zu ~12 Stunden** dauern, bis der Daten-Cache der
> Auslieferungsinfrastruktur aktualisiert und das Update für die Nutzer verfügbar ist.
