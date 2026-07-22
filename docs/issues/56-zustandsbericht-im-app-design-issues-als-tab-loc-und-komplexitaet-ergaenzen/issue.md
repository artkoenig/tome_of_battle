Status: ready-for-agent
Type: feature
Blocked by: None

## Description

Der Zustandsbericht bekommt fünf Verbesserungen. Vier davon betreffen den
Berichts-Generator unter `scripts/project-state/` (Design, Tabs, LOC,
Komplexität); die fünfte verlegt den veröffentlichten Bericht von der
Pages-Wurzel auf die Unterseite `/status` und macht die Wurzel zu einer
Platzhalter-Seite (später die echte Projektseite).

### 1. Design an die App angleichen

Die Seite trägt heute ein neutrales Standard-Design. Sie soll den Look der
Anwendung aufnehmen — das Gothic-/Tabletop-Thema aus ADR 0004: Pergament, Gold,
Obsidian-Dunkel.

- Palette aus `src/styles/01-tokens.css` als Vorbild: dunkle Flächen
  (`--bg-dark #08080a`, `--bg-panel #131319`, `--bg-card #31313b`), Pergament
  (`--bg-parchment #f5efe0`, `--text-parchment #ece2cc`), Gold-Akzente
  (`--border-gold #d0a52c`, `--text-gold #ecc157`), Status-Farben
  (`--color-success/-warning/-danger/-info`). Die Werte werden in den Bericht
  kopiert, nicht importiert (der Bericht bleibt eine eigenständige Datei).
- **Schriften self-contained** (Entscheidung des Maintainers): kein Nachladen
  von Google Fonts. Der Bericht nutzt den Fallback-Serifen-Stack der App
  (`Georgia`/`Garamond`, Serifen). Der App-Look wird über Palette, Gold und
  Layout getragen, nicht über Cinzel/Lora selbst.
- Helles und dunkles Erscheinungsbild bleiben beide bedient und tragen beide die
  App-Palette (dunkel: Obsidian + Gold; hell: Pergament + Gold).

### 2. Issues in einen eigenen Tab

Healthcheck und Issues liegen heute als zwei Abschnitte auf einer langen Seite.
Sie werden zu **echten Tabs**: Es ist immer nur einer sichtbar, oben ein
Umschalter (Healthcheck | Issues).

- **CSS-only, ohne JavaScript** (bestehende „kein Script"-Vorgabe des Berichts):
  Umsetzung über `:target` oder versteckte Radio-Inputs mit Labels, sodass der
  Umschalter ohne Laufzeit-Logik funktioniert. Ein sinnvoller Standard-Tab ist
  beim Laden aktiv.
- Die bestehende Anker-Navigation wird durch den Tab-Umschalter ersetzt.
- Mobil-Tauglichkeit (Issue 55) bleibt erhalten: kein horizontales Scrollen bei
  ~375 px, breite Tabellen scrollen im eigenen Container.

### 3. LOC (Lines of Code) ergänzen

Dem Bericht fehlt die Einschätzung des Codeumfangs. Neu: **Zeilen je Modul**
(`src/solver`, `src/components`, `src/parser`, …) plus Gesamtsumme, als eigene
Kennzahl/Sektion im Healthcheck.

### 4. Code-Komplexität ergänzen

Dem Bericht fehlt eine Komplexitäts-Einschätzung. Neu: **zyklomatische
Komplexität** — je Modul aggregiert (Summe/Durchschnitt der Entscheidungspunkte)
und eine Liste der **komplexesten Funktionen** (parallel zur bestehenden
„längste Funktionen"-Liste). Zyklomatische Komplexität = 1 + Anzahl der
Verzweigungspunkte (`if`, `for`, `while`, `case`, `catch`, `&&`, `||`, `?:`).

### 5. Bericht unter `/status` veröffentlichen, Wurzel wird Platzhalter

Der Bericht liegt heute an der Pages-Wurzel (`/`). Er zieht auf die Unterseite
`/status` um; die Wurzel `/` bekommt eine eigenständige Platzhalter-Seite, die
später zur Projektseite ausgebaut wird und vorerst nur auf den Bericht verlinkt.

- Der Workflow schreibt den Bericht nach `./_site/status/index.html` (statt
  `./_site/index.html`). `generate.js` legt das Zielverzeichnis bereits selbst an
  (`mkdirSync(dirname(outputPath), { recursive: true })`) — **keine
  Generator-Änderung nötig**, nur der Ausgabepfad im Workflow.
- Die Wurzel-Seite ist eine **committete, eigenständige** Datei `docs/index.html`
  (kein Build-Artefakt, da sie später die echte Projektseite wird). Jekyll kopiert
  eine Front-matter-lose `index.html` unverändert nach `_site/index.html`. Sie ist
  in sich geschlossen (kein externes Nachladen), trägt die App-Palette wie der
  Bericht und enthält einen deutlich sichtbaren Link auf `status/`.
- `/adr/` bleibt unverändert erreichbar. Namensraum danach: `/` = Platzhalter,
  `/status` = Bericht, `/adr/` = ADRs.

## Technical Decisions

- **Betroffene Bereiche:** neue reine Erhebungsmodule unter `scripts/project-state/`
  (z. B. `loc.js`, `complexity.js`) mit `.test.js`-Schwesterdateien nach dem
  Muster der bestehenden Module (`functions.js` als Vorlage für das Parsen von
  Produktivcode); Einbindung in `buildReportModel.js` (Modell) und `generate.js`
  (I/O: Produktivcode einlesen); `renderReport.js` (Design, Tabs, Darstellung der
  neuen Kennzahlen).
- **Reine Logik bleibt rein und getestet** (ADR 0006): LOC- und
  Komplexitätsberechnung bekommen injizierte Quelltexte, kein Datei-/Netzzugriff
  im Test. Der Renderer wird über ein reines Datenmodell getestet.
- **Kein neues Laufzeit- oder Dev-Paket.** Palette sind CSS-Werte, Tabs sind
  natives CSS, LOC/Komplexität sind reine Zeichenketten-/AST-freie Zähllogik im
  Stil von `functions.js`.
- **Voll dynamisch bleibt gewahrt** (Issue 55): alle neuen Inhalte leiten sich
  aus der Live-Messung ab; kein hand-gepflegter Text.
- **Item 5 (Deployment, kein Generator-Code):**
  `.github/workflows/status-report.yml` — Ausgabepfad des Berichts auf
  `./_site/status/index.html`, Schrittname und Kommentare entsprechend angepasst;
  neue committete Datei `docs/index.html` (Wurzel-Platzhalter); ADR 0025
  (`0025-pages-quelle-auf-github-actions-mit-jekyll-build.md`) auf die neue
  Aufteilung aktualisiert. Nicht lokal E2E-prüfbar (echtes Pages-Deployment);
  Korrektheit per Inspektion des Workflows und lokalem Öffnen der
  Platzhalter-Datei.

## Testing Decisions

- Neue Seams: `aggregateLoc(files)` (Zeilen je Modul + Summe) und
  `computeComplexity(source)` / `aggregateComplexity(files)` (zyklomatische
  Komplexität je Funktion/Modul), getestet über injizierte Eingaben.
- `renderReport`-Tests: Tab-Struktur (nur ein Panel sichtbar, Umschalter ohne
  `<script>`), LOC- und Komplexitäts-Sektion vorhanden, App-Palette angewandt
  (z. B. Gold-Akzent-Variable gesetzt), Mobil-Regression (kein Overflow-Marker
  verloren).
- `buildReportModel`-Tests: LOC und Komplexität landen im Modell.

## Out of Scope

- Einbetten echter App-Schriften (Cinzel/Lora) — bewusst verworfen zugunsten
  self-contained mit Fallback-Serifen.
- Weitere Metriken (Halstead, Wartbarkeitsindex, Testabdeckung-Trends).
- Änderungen an den reinen Erhebungsmodulen `gates.js`, `coverage.js`,
  `graph.js`, `issues.js` über das Einhängen der neuen Kennzahlen hinaus.
- Ausbau der Wurzel-Seite zur echten Projektseite — vorerst nur Platzhalter mit
  Link auf `/status`.
- Weitere Änderungen am Workflow über Ausgabepfad und Kommentare hinaus (Trigger,
  Permissions, Jekyll-Schritt, Deploy-Job bleiben unangetastet).

## Acceptance Criteria
- [ ] Der Bericht trägt sichtbar die App-Palette (Pergament/Gold/Obsidian) in
      hell und dunkel; Schriften sind der Fallback-Serifen-Stack, ohne Nachladen
      externer Fonts (weiterhin in sich geschlossen, kein `<script>`).
- [ ] Healthcheck und Issues sind echte Tabs: nur einer ist sichtbar, der
      Umschalter funktioniert ohne JavaScript.
- [ ] Der Bericht zeigt LOC je Modul und die Gesamtsumme.
- [ ] Der Bericht zeigt eine Komplexitäts-Einschätzung: zyklomatische
      Komplexität je Modul und eine Liste der komplexesten Funktionen.
- [ ] LOC- und Komplexitätslogik sind reine Funktionen, über injizierte Eingaben
      getestet, ohne `git`/`vitest`/Netz im Test.
- [ ] Mobil (~375 px) weiterhin ohne horizontales Scrollen; breite Inhalte
      scrollen im eigenen Container.
- [ ] Der Workflow legt den Bericht unter `/status` ab
      (`_site/status/index.html`); `/adr/` bleibt erreichbar.
- [ ] Die Wurzel `/` liefert eine eigenständige, in sich geschlossene
      Platzhalter-Seite (`docs/index.html`) mit sichtbarem Link auf `/status`.
- [ ] ADR 0025 und die Workflow-Kommentare beschreiben die neue Aufteilung
      (`/` Platzhalter, `/status` Bericht, `/adr/` ADRs).
- [ ] `npm run lint`, `npm run typecheck` und `npx vitest run` sind grün; der
      Generator läuft lokal durch und erzeugt eine HTML-Datei.

## Comments
