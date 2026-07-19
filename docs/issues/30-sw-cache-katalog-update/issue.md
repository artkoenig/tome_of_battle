Status: needs-triage
Type: fix
Blocked by: None

## Description
# PRD: Service-Worker-Cache umgeht Katalog-Revisionsvergleich

## Problem Statement / Bug Description

**Aktuelles Verhalten:** Der Service Worker (`public/sw.js`) behandelt Requests an `raw.githubusercontent.com` — sowohl den Katalog-Index (`catpkg.json`) als auch einzelne `.cat`/`.gst`-Dateien — mit einer Cache-First-Strategie: Existiert bereits eine gecachte Antwort, wird sie sofort zurückgegeben; der echte Netzwerk-Request aktualisiert den Cache nur im Hintergrund für den *nächsten* Aufruf, nicht für den aktuellen. Zusätzlich hält `loadCatalogIndex` (`src/db/catalogUpdate.js`) einen eigenen, unabhängigen In-Memory-Cache über die gesamte Seiten-Session.

Beide Layer unterlaufen den Revisionsvergleichsmechanismus aus ADR-0014 ("higher wins", `deriveRevisionState`/`isOutdated`), der implizit voraussetzt, dass ein `fetch()` gegen den Fork immer den echten aktuellen Serverstand liefert. Konkret beobachtet: Nach einer CI-bedingten Revisionskorrektur im Lexicanum-Fork (fälschlich auf 3 hochgezählt, kurz danach auf 2 zurückkorrigiert) zeigte der Import-Screen weiterhin Revision 3 — sowohl als "verfügbare" Revision im Katalog-Dropdown als auch nach explizitem manuellem Reimport über den "Importieren"-Button.

**Erwartetes Verhalten:** Der Import-Screen zeigt jederzeit den tatsächlichen aktuellen Serverstand. Ein Klick auf "Importieren" überschreibt die lokalen Daten zuverlässig mit dem echten aktuellen Stand des Forks — nicht mit veralteten, gecachten Bytes.

## Solution

`raw.githubusercontent.com` (Katalog-Index und Katalogdateien) wird vollständig von jeglichem Caching ausgenommen — sowohl im Service Worker als auch in `loadCatalogIndex`s In-Memory-Cache. Jeder Katalog-Request geht garantiert ans Netzwerk (network-only), analog zum bereits bestehenden Ausschluss von `rules-index.json` im Service Worker. Die Entscheidung wird als Amendment zu ADR-0014 dokumentiert ([ADR-0020](../../adr/0020-katalogdaten-network-only-kein-service-worker-cache.md)).

Bereits importierte Systeme bleiben davon unberührt: Sie liegen vollständig in IndexedDB und benötigen für Anzeige/Nutzung kein Netzwerk. Nur der Import-/Update-Screen selbst (Browsen verfügbarer Systeme, Neu-/Reimport) verliert seine Offline-Verfügbarkeit — laut ADR-0014s eigener ursprünglicher Begründung war das ohnehin nie der unterstützte Anwendungsfall ("der erste Import brauchte immer schon Netzwerk").

Der Revisionsvergleich selbst (`isOutdated`/`deriveRevisionState`, "higher wins") bleibt unverändert — er war nie fehlerhaft, nur seine Datengrundlage war durch die Caches verfälscht.

## User Stories / Requirements

1. Als Nutzer möchte ich, dass der Import-Screen immer die tatsächlich aktuelle, vom Fork ausgelieferte Revision anzeigt, damit ich verlässlich erkenne, ob ein Update verfügbar ist.
2. Als Nutzer möchte ich, dass ein Klick auf "Importieren" meine lokalen Katalogdaten garantiert mit dem echten aktuellen Serverstand überschreibt, nicht mit veralteten zwischengespeicherten Daten.
3. Als Nutzer, der ein bereits importiertes System offline nutzt, möchte ich, dass diese Nutzung von der Änderung unberührt bleibt (keine Offline-Regression für bereits importierte Systeme).

## Technical Decisions

- **Affected Modules:**
  - `public/sw.js` — Fetch-Handler, Ausschluss von `raw.githubusercontent.com` aus der Cache-Regel.
  - `src/db/catalogUpdate.js` — Entfernung des In-Memory-Index-Caches (`loadCatalogIndex`, `catalogIndexCache`, `getCachedIndexByUrl`, `clearCatalogIndexCache`).
- **Technical Clarifications / Architectural Decisions:**
  - Amendment zu ADR-0014, dokumentiert in ADR-0020: Katalogdaten werden network-only geladen, kein SW-Cache.
  - `isOutdated`/`deriveRevisionState` sowie `updateSystemFromCatalogIndex` (Silent-Update-Pfad) und `Importer.jsx`s `buildRevisionDisplay`/`handleImportBundle` (manueller Import) bleiben in ihrem Vertrag unverändert — sie profitieren nur von verlässlich frischen Eingabedaten.
- **API Contracts / Data Models:**
  - `loadCatalogIndex(fetchText, indexUrl)` ändert seinen Vertrag: zwei Aufrufe mit identischen Argumenten rufen `fetchText` künftig zweimal auf (bisher: einmal, danach Cache-Hit).
  - Keine Änderung an gespeicherten Datenstrukturen (IndexedDB-Schema, `system.revision`, `catalogue.revision`) oder an Komponenten-Props.

## Testing Decisions

- **Modules to Test:** `public/sw.js` (Fetch-Handler-Verhalten für `raw.githubusercontent.com`), `src/db/catalogUpdate.js` (`loadCatalogIndex` ohne Cache).
- **Test Interfaces (Seams):**
  - `public/sw.js`s `fetch`-Event-Handler: Für einen Request an `raw.githubusercontent.com` darf weder `caches.match()` gelesen noch `cache.put()` geschrieben werden; die Anfrage geht unverändert ans Netzwerk (Mock von `self`/`caches`/`fetch`).
  - `loadCatalogIndex(fetchText, indexUrl)`: Zwei aufeinanderfolgende Aufrufe mit identischen Argumenten rufen den injizierten `fetchText` zweimal auf.
  - Bestehende Tests (`src/solver/pwa.test.js`, `src/db/catalogUpdate.test.js`) werden angepasst, soweit sie das alte Cache-Verhalten voraussetzen (z. B. `clearCatalogIndexCache`-Aufrufe in Testsetups).

## Out of Scope

- Änderungen an der Revisionsvergleichslogik selbst (`isOutdated`/`deriveRevisionState`).
- Eine Network-First-mit-Cache-Fallback-Strategie für Offline-Browsing des Import-Screens (siehe ADR-0020, Option 1, verworfen).
- Rückwirkende Korrektur bereits lokal gespeicherter, potenziell veralteter Katalogdaten (kein automatisches Zwangs-Reimport bestehender Systeme).
- Änderungen an den beiden Katalog-Fork-Quellen selbst (Ergofarg/Lexicanum) oder deren Revisions-CI.

## Acceptance Criteria
- [ ]

## Comments
