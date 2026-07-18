Status: resolved
Type: feature
Blocked by: None

## Description
# PRD: Manueller Release- und Versionierungs-Workflow

### Problem Statement / Bug Description
Aktuell berechnet der Build-Prozess die angezeigte App-Version automatisch aus
dem höchsten vorhandenen Git-Tag (nächste Minor-Version), unabhängig davon, ob
dieser Tag tatsächlich gesetzt wurde. `package.json`s Versionsfeld ist
ungenutzt und veraltet (`"0.0.0"`). Seit das automatische Vercel-Deployment auf
`main` deaktiviert wurde (manuelles Promoten stattdessen), passt dieses
automatische, git-tag-basierte Vorhersagemodell nicht mehr zum tatsächlichen,
jetzt manuell gesteuerten Release-Prozess. Zusätzlich zeigt eine Analyse, dass
der bestehende Release-Notes-Mechanismus (Issue 03) nur 9 von 60 realen
Commit-Messages als release-relevant erkennt, weil Hauptissue-PRs entgegen
ADR 0009 tatsächlich per echtem Merge (nicht Squash) zusammengeführt werden und
Commit-Subjects nicht zuverlässig dem erwarteten `feat:`/`fix:`-Format folgen.

### Solution
`package.json` wird zur alleinigen Quelle für die angezeigte App-Version (siehe
[ADR 0019](../../adr/0019-manuelle-versionierung-und-release-freigabe.md)).
Nach dem Merge eines Hauptissues vom Typ `feature` oder `fix` fragt der Agent,
ob eine neue Version gesetzt werden soll, schlägt sie vor (Patch bei `fix`,
Minor bei `feature`) und lässt eine eigene Nummer oder "unverändert lassen" zu;
bei Bestätigung aktualisiert er `package.json`, committet, setzt einen Git-Tag
`vX.Y.Z` auf genau diesem Commit und pusht beides nach `main` — als ein
einziger, explizit bestätigter Vorgang.

Hauptissue-PRs werden ab sofort wie in ADR 0009 vorgeschrieben tatsächlich per
Squash-Merge zusammengeführt, mit einem Commit-Subject, dessen Präfix aus dem
Hauptissue-`Type` abgeleitet wird (`feat:`/`fix:`/`refactor:`/`chore:`),
verfasst auf Englisch. Der bestehende commit-basierte Release-Notes-Mechanismus
(Issue 03) bleibt architektonisch unverändert, funktioniert dadurch aber
erstmals zuverlässig.

Das `VORSCHAU`-Badge entfällt; Nicht-`main`-Builds bleiben stattdessen über
einen Versions-Hash-Zusatz (`<Version>+<Kurz-Hash>`) unterscheidbar.

### User Stories / Requirements
1. Als **Maintainer** möchte ich nach Abschluss eines nutzerrelevanten
   Hauptissues gefragt werden, ob eine neue Version gesetzt werden soll, mit
   einem sinnvollen Vorschlag, damit ich Releases bewusst und ohne manuelles
   Nachschlagen der aktuellen Version steuern kann.
2. Als **Maintainer** möchte ich die vorgeschlagene Versionsnummer
   überschreiben oder die Version unverändert lassen können, damit ich mehrere
   Hauptissues zu einem Release bündeln oder bewusst von Semver-Konventionen
   abweichen kann.
3. Als **Nutzer der App** möchte ich weiterhin eine korrekte, dem aktuellen
   Release entsprechende Versionsnummer in den Einstellungen sehen,
   unabhängig davon, wie sie zustande kam.
4. Als **Tester eines Preview-Builds** möchte ich weiterhin erkennen können,
   von welchem Commit mein Build stammt, auch ohne das bisherige Badge.
5. Als **Nutzer der App** möchte ich beim Update eine vollständige,
   verständliche Liste der seit meiner Version hinzugekommenen
   Features/Bugfixes sehen — nicht nur einen Bruchteil davon.

### Technical Decisions
- **Affected Modules:**
  - `package.json`: Versionsfeld wird echte, gepflegte Quelle statt totem
    Metadatum.
  - `scripts/versioning.js`: Versionsermittlung liest künftig `package.json`
    statt Git-Tags vorherzusagen; Patch-/Minor-Vorschlagslogik bleibt
    (wiederverwendet für den neuen interaktiven Prompt), Hash-Suffix-Logik für
    Nicht-`main`-Builds bleibt erhalten.
  - Neues, kleines Release-Skript: schreibt `package.json`, liefert den zu
    setzenden Tag-Namen; wird vom Agenten im Resolve-Workflow aufgerufen.
  - `vite.config.js`: `computeRelease()` vereinfacht (kein
    Git-Tag-Prognose-Pfad mehr für die eigene Version; die
    `tags`/`commits`-Ermittlung für den Release-Notes-Diff bleibt unverändert).
  - `src/components/SettingsDialog.jsx`: Versionsanzeige erweitert um
    Hash-Suffix auf Nicht-`main`-Builds.
  - `src/App.jsx`: `EnvBadge`-Einbindung entfernt.
  - `src/components/EnvBadge.jsx`, `isFlaggedEnv` in `scripts/deployEnv.js`:
    entfernt (tot nach Badge-Wegfall); `resolveDeployEnv` bleibt, Konsument
    ist jetzt die Hash-Suffix-Logik statt das Badge.
  - `docs/agents/issue-tracker.md`: neuer dokumentierter Schritt im
    Resolve-Ablauf für Hauptissues vom Typ `feature`/`fix`.
  - PR-Merge-Praxis: Hauptissue-PRs werden per Squash-Merge gemergt (ADR 0009
    wieder eingehalten), Commit-Subject-Präfix aus `Type` abgeleitet,
    Beschreibung auf Englisch.
- **Technical Clarifications / Architectural Decisions:**
  - Versions-Prompt feuert **nach** dem Merge des Hauptissue-PRs, auf `main`
    selbst — nicht auf dem Feature-Branch — damit der gesetzte Tag auf einen
    tatsächlich in `main`s Historie erreichbaren Commit zeigt.
  - Versions-Prompt erscheint nur bei Hauptissues vom Typ `feature`/`fix`; bei
    `refactor`/`chore` entfällt er.
  - Beantwortung des Prompts (Patch-/Minor-Vorschlag bestätigen, eigene
    Version eingeben, oder unverändert lassen) gilt als einstufige, explizite
    Freigabe für Commit **und** Push von `package.json`-Änderung und Tag —
    keine separate Rückfrage danach.
  - Commit-Präfix-Mapping: `feature` → `feat:`, `fix` → `fix:`, `refactor` →
    `refactor:`, `chore` → `chore:`. Nur `feat:`/`fix:` erscheinen in den
    Release Notes (bestehender Filter, unverändert).
  - Git-Tag-Format bleibt `v<package.json-Version>` (z. B. `v1.3.0`),
    konsistent mit bestehender Tag-Historie und der bestehenden
    Tag-zu-Hash-Auflösung im Release-Notes-Diff.
  - Diese Automatisierung bleibt army_builder-lokal (dokumentiert in
    `docs/agents/issue-tracker.md`), nicht im geteilten `~/.agents`
    Issue-Tracker-Skill (`tracker.py`).
  - Die separate, bereits beschlossene ADR-0008/0007-Korrektur zum
    automatischen Deploy-Trigger ist explizit **nicht** Teil dieses
    Hauptissues (eigenes Hauptissue).
- **API Contracts / Data Models:**
  - `changelog.json`-Schema unverändert (siehe Issue 03).
  - `package.json.version`: reiner Semver-String ohne `v`-Präfix
    (npm-Konvention), z. B. `"1.3.0"`.

### Testing Decisions
- **Modules to Test:**
  - `scripts/versioning.js` (erweiterte Versionsermittlung, Patch-/
    Minor-Vorschlag, Hash-Suffix)
  - Neues Release-Skript (reine Versions-/Tag-Berechnung, nicht der I/O-Teil)
  - `SettingsDialog.jsx` (Versionsanzeige inkl. Hash-Suffix)
  - `App.jsx` (Badge-Entfernung)
  - `scripts/deployEnv.js` (verbleibende `resolveDeployEnv`-Tests,
    `isFlaggedEnv`-Tests entfernt)
- **Test Interfaces (Seams):**
  1. `scripts/versioning.js` — reine Funktionen für Versionsermittlung aus
     `package.json`, Patch-/Minor-Vorschlag, Hash-Suffix; vollständig
     unit-testbar wie bisher (`scripts/versioning.test.js`).
  2. Neues Release-Skript — reine Versions-/Tag-Berechnung wird getestet, der
     I/O-Teil (Datei schreiben, `git tag`) bleibt dünn und ungetestet.
  3. `vite.config.js` — `computeRelease()` vereinfacht; kein eigener Unit-Test
     (wie bisher, nur die ausgelagerte reine Logik in 1. wird getestet).
  4. `SettingsDialog.jsx` — bestehender Test (`SettingsDialog.test.jsx`,
     nutzt `vi.stubEnv('VITE_APP_VERSION', ...)`) wird um Hash-Suffix
     erweitert.
  5. `App.jsx` — `EnvBadge`-Einbindung entfernt.
  6. `EnvBadge.jsx` + `isFlaggedEnv` in `scripts/deployEnv.js` — komplett
     entfernt inkl. zugehöriger Tests in `deployEnv.test.js`; `resolveDeployEnv`
     bleibt und wird jetzt vom Hash-Suffix konsumiert.
  7. `docs/agents/issue-tracker.md` — neuer dokumentierter Schritt; kein
     Code-Test, wird über Doku-Review geprüft.

### Out of Scope
- Automatisches Setzen/Pushen von Tags ohne menschliche Bestätigung.
- Versionierungs-Prompt-Automatisierung im globalen `~/.agents`-Issue-Tracker
  (`tracker.py`) — bleibt army_builder-lokal dokumentiert.
- Korrektur der veralteten Auto-Deploy-Aussagen in ADR 0007/0008 — eigenes,
  separates Hauptissue.
- Technische Durchsetzung (z. B. `commit-msg`-Hook) der `feat:`/`fix:`-
  Konvention — vorerst nur dokumentiert, keine zusätzliche Infrastruktur.
- Major-Versions-Bumps über den Vorschlagsmechanismus — bleiben ausschließlich
  manuell über die "eigene Version eingeben"-Option.
- Rückwirkende Korrektur/Neugenerierung der Release-Notes-Einträge für bereits
  vergangene, nicht korrekt präfixierte Commits.

## Acceptance Criteria
- [x] `package.json` ist die Quelle der angezeigten App-Version; auf `main`
      unverändert, auf anderen Branches mit `+<Kurz-Hash>` ergänzt.
- [x] `scripts/release.js` berechnet Patch-/Minor-Versionsvorschläge und
      schreibt die bestätigte Version in `package.json`.
- [x] `docs/agents/issue-tracker.md` dokumentiert Squash-Merge mit
      Type-abgeleitetem Commit-Präfix sowie den Versions-Prompt nach dem
      Merge eines `feature`/`fix`-Hauptissues.
- [x] Das `VORSCHAU`-Badge ist entfernt; Nicht-`main`-Builds bleiben über den
      Versions-Hash-Zusatz unterscheidbar.
- [x] ADR 0019 dokumentiert die Entscheidung; ADR 0008 ist im
      Badge-Abschnitt korrigiert.
- [x] Vollständige Testsuite (554 Tests) sowie Lint sind grün.

## Comments
- Umgesetzt ohne Zerlegung in Child-Issues (auf Nutzerwunsch). package.json ist jetzt Quelle der App-Version (scripts/versioning.js, vite.config.js); neues scripts/release.js berechnet Patch-/Minor-Vorschlaege und schreibt package.json; docs/agents/issue-tracker.md dokumentiert Squash-Merge mit Type-Praefix sowie den Versions-Prompt nach dem Merge eines feature/fix-Hauptissues; VORSCHAU-Badge entfernt (EnvBadge.jsx, isFlaggedEnv), Nicht-main-Builds bleiben ueber Versions-Hash-Suffix unterscheidbar; ADR 0019 neu, ADR 0008 im Badge-Abschnitt korrigiert. 554 Unit-/Component-Tests und E2E gruen, Lint sauber, visuell im Browser verifiziert.
