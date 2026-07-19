# Katalogdaten werden network-only geladen, kein Service-Worker-Cache

- **Status:** Accepted
- **Datum:** 2026-07-19
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Amendet [ADR 0014](0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md) (Kataloge als externes Fork-Repo mit Laufzeit-Abruf)

## Kontext und Problemstellung

ADR-0014 hat `raw.githubusercontent.com` bewusst der Service-Worker-Cache-Regel hinzugefügt, mit der Begründung, dass dies keine Offline-Regression sei — der erste Import brauche ohnehin schon Netzwerk. Der Service Worker (`public/sw.js`) setzt das als Stale-While-Revalidate um: eine gecachte Antwort wird sofort zurückgegeben, der echte Netzwerk-Request aktualisiert den Cache nur im Hintergrund für den *nächsten* Aufruf.

Das kollidiert mit ADR-0014s eigenem Kernmechanismus, dem Revisionsvergleich („higher wins", `deriveRevisionState`/`isOutdated` in `src/db/catalogUpdate.js`), der stillschweigend voraussetzt, dass ein `fetch()` gegen den Fork immer den echten aktuellen Serverstand liefert. Beobachtet: Nach einer CI-bedingten Revisions-Korrektur im Lexicanum-Fork (fälschlich auf 3 hochgezählt, dann auf 2 zurückkorrigiert) zeigte der Import-Screen weiterhin die veraltete Revision 3 — sowohl als „verfügbare" Revision aus dem gecachten `catpkg.json` als auch nach explizitem manuellem Reimport, der denselben SW-interceptierten Fetch-Pfad nutzt.

ADR-0014s eigene Begründung trennt nicht zwischen zwei unterschiedlichen Nutzungen: (a) ein bereits importiertes System soll offline weiter nutzbar sein — das ist bereits vollständig durch IndexedDB gewährleistet und braucht keinen SW-Cache; (b) der Import-/Update-Screen soll den *aktuellen* Serverstand zeigen — genau das verletzt ein Cache-First-SW strukturell.

## Entscheidungsfaktoren (Drivers)

- **Korrektheit der Revisionsanzeige:** Der Import-Screen muss den echten aktuellen Serverstand zeigen, sonst ist der gesamte „higher wins"-Mechanismus aus ADR-0014 wirkungslos.
- **Einfachheit:** Keine Sonderbehandlung für Silent-Update- vs. manuellen Import-Pfad nötig.
- **Kein Offline-Verlust für bereits importierte Systeme:** Deren Daten liegen vollständig in IndexedDB; die SW-Cache-Kopie war dafür nie erforderlich.

## Betrachtete Optionen

- **Option 1 (Network-First mit Cache-Fallback):** SW versucht zuerst das Netzwerk, fällt bei Fehler auf den Cache zurück. Erhält eine gewisse Offline-Verfügbarkeit des Import-Screens, aber weiterhin Sonderfall-Logik und ein zweiter Cache-Layer (`loadCatalogIndex`s In-Memory-Cache) bliebe ebenfalls ein Störfaktor.
- **Option 2 (Network-only, kein SW-Cache für `raw.githubusercontent.com`):** Analog zum bestehenden Ausschluss von `rules-index.json` (`sw.js:43`) wird der Host komplett aus der SW-Cache-Regel entfernt. Jeder Katalog-Request geht garantiert ans Netzwerk.

## Entscheidungsergebnis

Gewählte Option: **Option 2**, weil sie die einzige ist, die die Korrektheitsgarantie des Revisionsvergleichs unbedingt wiederherstellt, ohne Sonderfall-Unterscheidung zwischen Silent-Update und manuellem Reimport. ADR-0014s eigene Begründung trägt diese Entscheidung bereits mit: Sie hatte für den Offline-Fall nie den *Import-Screen selbst* im Blick, sondern nur bereits importierte Systeme — und die bleiben durch IndexedDB unverändert offline nutzbar.

### Konsequenzen (Auswirkungen)

- **Positiv:** Die Revisionsanzeige und jeder Reimport liefern zuverlässig den echten aktuellen Serverstand; „higher wins" funktioniert wieder wie in ADR-0014 vorgesehen.
- **Negativ:** Der Import-Screen (Liste verfügbarer Systeme/Kataloge, `catpkg.json`) ist ohne Netzwerkverbindung nicht mehr nutzbar. Das betrifft nur das erstmalige Browsen/Importieren, nicht bereits importierte Systeme.
- **Neutral:** `loadCatalogIndex`s In-Memory-Session-Cache (`src/db/catalogUpdate.js`) entfällt im selben Zug vollständig, da er denselben Fehlklassentyp (session-lange Staleness) unabhängig vom SW erzeugt hätte.

## Vor- und Nachteile der Optionen

### Option 1 (Network-First mit Cache-Fallback)

- **Gut, weil** der Import-Screen auch offline zumindest die letztbekannte Liste zeigen könnte.
- **Schlecht, weil** zusätzliche Komplexität für einen Anwendungsfall (Katalog-Browsing offline), den ADR-0014 selbst nie als Anforderung formuliert hatte.

### Option 2 (Network-only)

- **Gut, weil** einfachste, robusteste Lösung ohne Sonderfälle; stellt die Korrektheitsgarantie des bestehenden Revisionsvergleichs vollständig wieder her.
- **Schlecht, weil** der Import-Screen offline nicht mehr nutzbar ist — akzeptiert, da dies laut ADR-0014 nie der unterstützte Anwendungsfall war.
