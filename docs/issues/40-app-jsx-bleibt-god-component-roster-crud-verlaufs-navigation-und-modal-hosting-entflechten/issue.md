Status: resolved
Type: refactor
Blocked by: None

## Description

### Problem (Geruch: Divergent Change / God Component)

Restbefund aus der Vier-Achsen-Prüfung des Haupt-Issues 39 (Achse A, Fund 5).

Kind-Issue 39/04 hat die Wurzelkomponente bereits teilweise entflochten: die
PWA-Belange liegen in `src/hooks/usePwaLifecycle.js`, die Ansichtswerte in
`src/constants/views.js`, die Release-Diff-Logik in `src/utils/releaseDiff.js`,
und der redundante Roster-Zustand ist auf `selectedRosterId` als alleinige
Quelle (SSOT) zurückgeführt.

Dennoch ist `src/App.jsx` mit **573 Zeilen** (nicht 581/470 — die Zahlen in
39/04 und im ursprünglichen Befund waren falsch) weiterhin eine God-Component
mit zehn `useState` und ändert sich aus voneinander unabhängigen Gründen:

1. Ansichts-Routing (`view`-Zustand, bedingtes Rendering)
2. Integration des Browser-Verlaufs (`popstate` / `pushState`)
3. PWA-/Offline-Rest (`isOffline`-Listener neben `usePwaLifecycle`)
4. Toast- und Fehlerkanal (`showToast`, `reportError`)
5. Beherbergung der Dialoge (Settings, New-Roster, Lösch-Bestätigung)
6. Roster-Listen-CRUD (create/rename/delete/import/export inkl. inline
   aufgebautem Roster-Literal)
7. **(vom Befund übersehen)** Initiales Daten-Laden und Katalog-Hintergrund-
   Aktualisierung (`loadAllData`, `refreshCatalogInBackground`,
   `handleSystemImported`) — ein eigener Belang, der zwischen den sechs
   benannten sonst heimatlos bliebe.

### Ziel und Grundhaltung

Reines Aufräumen nach dem **Single-Responsibility-Prinzip**: jeder Belang
verlässt App.jsx und bekommt eine eigene, unabhängig testbare Einheit. App.jsx
bleibt als schlanker **Orchestrator** übrig, der diese Einheiten verdrahtet.

**Sanfter Ansatz — Verhalten bleibt bit-identisch.** Keine neue Funktionalität
(insbesondere **kein** „Duplizieren", das es heute nicht gibt), keine sichtbare
Änderung, keine Umkehrung akzeptierter Architektur-Entscheidungen:

- **ADR-0005 §5** (Navigation ohne Router-Bibliothek) bleibt gewahrt:
  Navigation bleibt schlichter App-Zustand; sie wird lediglich in einen Hook
  verlagert, **kein** Routing-Paket wird eingeführt.
- **ADR-0010** (Toast/Dialog als *lokaler* State statt React-Context) bleibt
  gewahrt: die Extraktionen erzeugen Hooks bzw. eine Präsentationskomponente,
  **keinen** neuen Context/Provider.
- **ADR-0002** (DB-Zugriff nur über `database.js`) bleibt gewahrt.
- **ADR-0023** (Solver nur über `validator.js`) gilt für jede neue Datei.

### Zielbild (Struktur nach dem Refactoring)

| Belang | Neue Einheit | Art | Vorbild |
| --- | --- | --- | --- |
| 1 + 2 Navigation & Verlauf | `src/hooks/useAppNavigation.js` | Hook | `usePwaLifecycle` |
| 3 Offline-Rest | in `usePwaLifecycle.js` einziehen | Hook | vorhanden |
| 4 Toast/Fehler | `src/hooks/useToast.js` | Hook | `usePwaLifecycle` |
| 5 Dialog-Hosting | `src/components/AppDialogs.jsx` | Präsentations-Komponente | — |
| 6 Listen-CRUD | `src/hooks/useRosterList.js` | Hook | ADR-0002 §4 |
| 6 Roster-Literal | Helfer neben `src/utils/rosterDefaults.js` | reine Funktion | `rosterDefaults.js` |
| 7 Daten-Laden/Refresh | `src/hooks/useAppData.js` | Hook | `usePwaLifecycle` |

Namenshinweis: der CRUD-Hook heißt bewusst **nicht** `useRoster` — dieser Name
ist bereits belegt (`src/hooks/useRoster.js` verwaltet den State *eines
geöffneten* Rosters in `RosterEditor.jsx`, nicht die Listen-Ebene).

### Non-Goals

- Kein Router-Paket, kein React-Context/Provider.
- Keine Verhaltens-, UI- oder API-Änderung; keine neuen Features.
- Kein Umschreiben der Solver- oder DB-Schicht.

### Testnahtstellen (Seams)

- **Verhaltens-Vertrag:** `src/App.test.jsx` (deckt querschnittliche Flüsse ab:
  Umbenennen+Anzeige, Editor→Play-Übergabe, Zurück-Navigation+Wiederherstellung)
  bleibt **unverändert grün**. Das ist der Beweis, dass sich das Außenverhalten
  nicht geändert hat.
- **Neue Einheiten:** jeder neue Hook/Modul erhält eigene, schnelle Unit-Tests
  nach dem Muster von `usePwaLifecycle.test.js` / `releaseDiff.test.js`.
- `npm run lint` bleibt grün (inkl. `no-restricted-imports` für Solver/DB).

## Acceptance Criteria
- [ ] Alle sieben Belange sind aus `App.jsx` in die im Zielbild genannten
  Einheiten ausgelagert; `App.jsx` verdrahtet sie nur noch (deutlich kürzer,
  keine eigene CRUD-/Navigations-/Toast-Logik mehr).
- [ ] Kein neuer React-Context/Provider und kein Router-Paket wird eingeführt
  (ADR-0005 §5 und ADR-0010 gewahrt).
- [ ] Der Listen-CRUD-Hook heißt nicht `useRoster`; das Roster-Literal wird über
  einen reinen Helfer neben `rosterDefaults.js` erzeugt.
- [ ] `src/App.test.jsx` bleibt inhaltlich unverändert und grün (Verhaltens-
  Vertrag); jede neue Einheit hat eigene Unit-Tests.
- [ ] `npm run lint` und die volle Test-Suite (Unit + E2E) sind grün; kein
  direkter Import aus `src/solver/*` oder unter Umgehung von `database.js`.

## Comments

Angelegt am 2026-07-21 aus der Vier-Achsen-Prüfung des Haupt-Issues 39,
Achse A (`standards-reviewer`), Fund 5. Bewusst nicht in Kind-Issue 39/13
aufgenommen, das nur die mechanisch behebbaren Funde 1-4 abdeckt.
- Spezifiziert 2026-07-21 (grill-me-for-spec). Grundhaltung 'sanft': bestehende ADRs (0005 S5, 0010, 0002, 0023) respektiert, kein Context/Router, Verhalten identisch. Zielbild: 7 Belange -> useAppNavigation, usePwaLifecycle (Offline-Rest), useToast, AppDialogs, useRosterList (+ Roster-Literal-Helfer neben rosterDefaults.js), useAppData. Korrektur: App.jsx hat 573 Zeilen (nicht 581/470); 'Duplizieren' existiert nicht. Bereit zur Zerlegung in Kind-Issues (wartet auf Freigabe der Aufteilung).
- Umgesetzt und gemergt: App.jsx 573->261 Zeilen, alle sieben Belange in useRosterList/createRoster, useAppData, useToast, useAppNavigation, usePwaLifecycle (Offline-Rest), AppDialogs ausgelagert. Vier-Achsen-Pruefung: Standards grün (2 minor DRY-Nits, non-blocking), Spezifikation 0 blockierende Befunde (verhaltenserhaltend, App.test.jsx byte-identisch), Tests grün (1188 Unit + E2E), Doku-Drift (ADR-0005/0010/0002, README) nachgezogen. Kein Context/Router; ADRs 0002/0005/0010/0023 gewahrt.
