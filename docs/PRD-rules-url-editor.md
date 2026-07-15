# PRD: URL-Mapping-Editor für 6th.whfb.app

> **Kontext:** Begleitwerkzeug zur 6th.whfb.app-Integration
> (Feature-PRD: `docs/issues/08-6th-whfb-app-regeltexte-integrieren/issue.md`,
> Architektur: [ADR-0012](adr/0012-integration-externer-regeltexte-6th-whfb-app.md)).
> Der Editor pflegt `rules-index.json` und `synonyms.js`; er ist **nicht Teil der PWA**.

## Problem Statement

Die Dateien `src/data/rules-index.json` (845 Einträge) und `src/data/synonyms.js` (~12 Einträge) werden aktuell manuell editiert – entweder direkt im Code oder per Crawl-Skript (`scripts/generate-rules-index.js`). Es gibt keine GUI zum Begutachten, Suchen, Ergänzen oder Korrigieren der URL-Mappings oder Synonyme. Jeder Eingriff erfordert einen Editor, Kenntnis der Dateiformate und manuelles JSON-Hantieren.

## Solution

Ein eigenständiger, lokaler Web-Editor (kein Teil der PWA), der:

- Die URL-Mapping-Tabelle als durchsuchbare Tabelle anzeigt
- CRUD-Operationen auf den Einträgen erlaubt
- Die Synonyme als Tabelle verwaltet
- Das Crawl-Skript per Knopfdruck ausführen kann

Der Editor besteht aus einer Node.js-Serverdatei (ca. 20–30 Zeilen) und einer einzelnen HTML-Datei mit eingebettetem JS und CSS – keine Dependencies, kein Build-Schritt.

## User Stories / Requirements

1. **Als Entwickler** möchte ich **alle 845 URL-Mapping-Einträge in einer durchsuchbaren, filterbaren Tabelle sehen**, um schnell einen bestimmten Eintrag zu finden.
2. **Als Entwickler** möchte ich **einen Eintrag in der URL-Mapping-Tabelle bearbeiten (Name und/oder URL-Pfad ändern)**, um Korrekturen an veralteten oder falschen URLs vorzunehmen.
3. **Als Entwickler** möchte ich **einen neuen Eintrag zur URL-Mapping-Tabelle hinzufügen**, um Regeln zu ergänzen, die vom Crawl nicht erfasst wurden.
4. **Als Entwickler** möchte ich **einen Eintrag aus der URL-Mapping-Tabelle löschen**, um nicht mehr benötigte oder fehlerhafte Mappings zu entfernen.
5. **Als Entwickler** möchte ich **alle Synonyme als Tabelle sehen**, um einen Überblick über die BSData-zu-kanonisch-Mappings zu haben.
6. **Als Entwickler** möchte ich **Synonyme hinzufügen, bearbeiten und löschen**, um die Namensauflösung zu pflegen.
7. **Als Entwickler** möchte ich **das Crawl-Skript per Knopfdruck ausführen**, um `rules-index.json` neu zu generieren, und **das Ergebnis im Editor sehen und ggf. nachbearbeiten**.
8. **Als Entwickler** möchte ich **Änderungen explizit speichern**, um zu kontrollieren, wann die JSON-Dateien und synonyms.js auf die Platte geschrieben werden.

## Technical Decisions

### Tool-Struktur

```
tools/rules-editor/
  server.js    – Node.js HTTP-Server (built-in http-Modul)
  index.html   – Single-Page Editor (alles inline: HTML, CSS, JS)
```

### Affected Modules

- `tools/rules-editor/server.js` (neu) – Server-Tool
- `tools/rules-editor/index.html` (neu) – Editor-UI
- `src/data/rules-index.json` (bestehend, wird vom Editor gelesen/geschrieben)
- `src/data/synonyms.js` (bestehend, wird vom Editor gelesen/geschrieben)
- `scripts/generate-rules-index.js` (bestehend, wird vom Server aufgerufen)

### API Contracts

Der Server stellt folgende REST-Endpoints bereit:

| Methode | Endpoint | Request Body | Response | Beschreibung |
|---------|----------|-------------|----------|-------------|
| GET | `/api/data` | – | `{ rulesIndex: {…}, synonyms: {…} }` | Liefert beide Dateien |
| PUT | `/api/rules-index` | `{ name: string, path: string }` (Array oder einzelnes Objekt) | `{ ok: true }` | Aktualisiert/speichert rules-index.json |
| PUT | `/api/synonyms` | `{ from: string, to: string }` (Array oder einzelnes Objekt) | `{ ok: true }` | Aktualisiert/speichert synonyms.js |
| POST | `/api/crawl` | – | `{ rulesIndex: {…}, entriesAdded: number }` | Führt `generate-rules-index.js` aus |

### Dateiformat-Handling

- **rules-index.json**: Wird direkt als JSON gelesen/geschrieben.
- **synonyms.js**: Wird als Text gelesen, der Server extrahiert das Objekt durch Entfernen von `export const SYNONYMS = ` (Prefix) und `;` (Suffix), parst den Rest als JSON. Beim Schreiben serialisiert er das Objekt zurück ins JS-Modul-Format. Formatierung wird beim Schreiben vereinheitlicht (2 Spaces Einrückung).
- **BASE_URL** (`https://6th.whfb.app`) wird beim Lesen der rules-index.json vom Pfad-Präfix entfernt, damit die Tabelle nur den relativen Pfad zeigt. Beim Speichern wird er wieder hinzugefügt.

### Crawl-Integration

Der Server führt `node scripts/generate-rules-index.js` als Child-Process aus. Nach erfolgreichem Crawl wird die aktualisierte rules-index.json geladen und im Editor angezeigt. Ein manuelles Speichern ist nicht nötig – der Crawl schreibt direkt auf die Platte.

### Start

Der Server startet über `node tools/rules-editor/server.js`, öffnet automatisch den Browser auf `http://localhost:3001` (oder frei wählbarem Port). Der Server läuft nur lokal, nicht in der Produktion.

## Testing Decisions

- **Keine automatisierten Tests vorgesehen.** Das Tool ist ein reines Entwickler-Hilfsmittel, kein Teil der PWA.
- **Manuelle Smoke-Tests**: Server starten, Editor im Browser öffnen, Daten lesen, Eintrag ändern, speichern, Datei prüfen, Crawl ausführen.
- **Seam für manuelle Prüfung**: `git diff src/data/rules-index.json src/data/synonyms.js` vor/nach Editor-Operationen.

## Out of Scope

- Kein Teil der PWA – der Editor wird nicht in die Build-Pipeline eingebunden, nicht von Service Workern gecached und nicht auf Vercel deployt.
- Kein Merge/Conflict-Handling: Wenn zwischen Crawl und manuellen Änderungen Konflikte entstehen, überschreibt der letzte Speichervorgang.
- Keine Bulk-Import/Export-Funktion (CSV o.ä.).
- Kein Authentifizierungs-/Autoren-Mechanismus.
- Kein Vorschlagen von URLs für unbekannte Regelnamen.
- Kein automatisches Ausführen des Crawls.
