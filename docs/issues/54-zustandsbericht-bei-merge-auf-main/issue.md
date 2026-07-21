Status: ready-for-agent
Type: chore
Blocked by: None

## Description

# PRD: Zustandsbericht bei Merge auf main

## Problem Statement

Der Zustand des Projekts — laufen die Qualitäts-Gates, wo ist die Prüfung dünn,
was steht offen — ist heute nur zu ermitteln, indem jemand die Werkzeugkette von
Hand laufen lässt und die Ergebnisse zusammenträgt. Das ist aufwendig genug, dass
es selten passiert, und das Ergebnis veraltet ab der nächsten Änderung.

Konkret sichtbar wurde das an zwei Befunden, die eine solche Erhebung zutage
förderte und die zwischen den Läufen niemandem auffielen: `dependency-cruiser`
brach seit seiner Einführung auf Node 25 ab, ohne je eine Regel zu prüfen (jetzt
Issue 53), und mehrere `issue/`-Branches tragen Nummern, die auf `main` längst
vergeben sind. Beides sind Zustände, die ein regelmäßig erzeugter Bericht sofort
zeigt und die sonst still weiterlaufen.

Ergänzend: Der `docs/`-Baum wird bereits über GitHub Pages als Website
ausgeliefert (Quelle Branch `main`, Ordner `/docs`, Jekyll-Alt-Build). Das ist im
Repo nirgends dokumentiert, hat keinen Index (Wurzel-URL liefert 404) und wird
offenbar nicht bewusst genutzt.

## Solution

Ein Generator-Skript erhebt den Zustand und erzeugt daraus eine
eigenständige HTML-Seite. Ein eigener Workflow lässt es bei jedem Push auf `main`
laufen und veröffentlicht das Ergebnis über GitHub Pages.

Die Seite hat zwei Bereiche auf einer URL:

- **Healthcheck** — Qualitäts-Gates mit ihrer tatsächlichen Wirksamkeit
  (blockierend vs. nur Hinweis), Kennzahlen, Testabdeckung je Modul, längste
  Funktionen, Strukturfakten (Zyklen, Schichtung, Abhängigkeiten) und die
  eingeordneten Befunde.
- **Issues** — die offenen Vorgänge des lokalen Trackers, jeder mit seinem
  vollständigen Inhalt (Beschreibung, Akzeptanzkriterien), nicht nur als
  Titelzeile.

Messung und Urteil werden getrennt: Kennzahlen und Grafiken entstehen
automatisch, die Befund-Einordnung liegt in einer versionierten, von Hand
gepflegten Datei daneben. Das ist die zentrale Entscheidung dieses Vorhabens —
ein Werkzeug meldet „26 Befunde", während die eigentliche Erkenntnis lautet, dass
19 davon Fassaden-Re-Exporte nach ADR 0023 sind und keine Schuld. Ohne diese
Trennung müsste diese Sortierarbeit bei jedem Lauf neu geleistet werden.

## User Stories / Requirements

1. Als Maintainer möchte ich nach jedem Merge auf `main` eine aktuelle Seite
   vorfinden, um den Projektzustand zu sehen, ohne die Werkzeugkette selbst zu
   starten.
2. Als Maintainer möchte ich erkennen, ob ein Gate nur grün meldet oder
   tatsächlich prüft, um blinde Wächter zu bemerken, statt ihnen zu vertrauen.
3. Als Maintainer möchte ich die offenen Issues mit Beschreibung und
   Akzeptanzkriterien lesen, um den Rückstand zu erfassen, ohne die
   `issue.md`-Dateien einzeln zu öffnen.
4. Als Maintainer möchte ich, dass der Bericht seine eigenen Blindstellen
   benennt, damit eine unvollständige Angabe nicht als vollständige gelesen wird.

## Technical Decisions

- **Betroffene Bereiche:** neues Generator-Skript unter `scripts/` nach
  bestehender Konvention (reine Logik getrennt von I/O, `.test.js`-Schwesterdatei,
  ESM, CLI-Guard); ein neuer Workflow unter `.github/workflows/`; eine
  versionierte Datei für die Befund-Einordnung; `docs/adr/` und `CONTEXT.md`.

- **Pages-Quelle wird von „Branch `main`/`docs`" auf „GitHub Actions"
  umgestellt.** Pages kennt nur eine Quelle je Repository; beide Betriebsarten
  schließen sich aus. Folge: Die bisher erreichbaren Adressen unterhalb von
  `/adr/` und `/issues/` entfallen. Sie sind undokumentiert, ohne Index und über
  GitHub selbst weiterhin lesbar. Die Umstellung ist eine manuelle
  Repository-Einstellung, die kein Workflow-Code allein bewirkt. Das ist eine
  schwer umkehrbare, überraschende Entscheidung mit echtem Abwägungscharakter und
  gehört daher in eine ADR.

- **Eigener Workflow statt eines weiteren Jobs in `ci.yml`,** entsprechend dem in
  ADR 0007 erkennbaren Muster „ein Workflow je fokussiertem Zweck". Er braucht
  `pages: write` und `id-token: write`, die heute in keinem Workflow gesetzt sind,
  sowie vollständige Historie und alle Remote-Refs für den Issue-Teil.

- **Der Bericht wird nicht committet.** Er entsteht als Build-Ausgabe und geht
  direkt ins Pages-Deployment, analog zu `dist/` und `.screenshots/`. Damit
  entfällt jeder Commit auf `main` durch CI, was die Regel „`main` kommt nur über
  PR-Merges voran" unangetastet lässt.

- **Der Issue-Teil zeigt nur gepushte Branches.** Ein CI-Läufer sieht keine rein
  lokalen Branches. Statt diese Lücke zu verschweigen, weist der Bericht sie
  ausdrücklich aus.

- **Begriffe:** Der Vorgang ist weder *Deployment* noch *Release* noch
  *Production* im Sinne des bestehenden Glossars — diese sind dort exklusiv an
  die Auslieferung der Anwendung gebunden. `CONTEXT.md` erhält einen eigenen
  Begriff für den Bericht, damit das vorhandene Vokabular nicht verwässert.

- **Markdown-Aufbereitung:** Die Issue-Inhalte sind Markdown und werden zur
  Bauzeit zu HTML gerendert, damit die veröffentlichte Seite ohne Laufzeit-Logik
  auskommt. Dafür ist eine devDependency vorzusehen; sie wird nicht mit der
  Anwendung ausgeliefert und berührt die sechs Laufzeit-Abhängigkeiten nicht.

## Testing Decisions

- **Zu testende Bereiche:** die reine Auswertungs- und Aufbereitungslogik. Kein
  Test startet `git`, `vitest` oder einen Netzzugriff; die I/O-Seite wird
  injiziert, wie es `versioning.js`/`deployEnv.js` vormachen.

- **Testschnitte (Seams):**
  - `parseIssueMarkdown(text)` → Status, Typ, Blocked-by, Abschnitte
  - `collectOpenIssues(refs, showFile)` → offene Issues bei injiziertem
    Git-Zugriff, inklusive der Regel, dass auf `main` bereits geschlossene
    Einträge nicht als offen zählen
  - `aggregateCoverage(coverageFinal)` → Kennwerte je Modul
  - `findLongFunctions(source)` → Funktionslängen
  - `findCycles(graph)` → Zyklen im Importgraphen
  - `renderReport(model)` → HTML aus einem reinen Datenmodell

## Out of Scope

- **Verlauf und Trends.** Der Bericht bleibt eine Momentaufnahme; kein
  persistenter Speicher für Zeitreihen.
- **Geschlossene Issues.** Der Issue-Bereich zeigt vorerst nur offene Vorgänge.
- **Bau bei Pull Requests.** Der Bericht entsteht ausschließlich bei Push auf
  `main`.
- **Aktualisierung des bestehenden claude.ai-Artifacts.** Dieses kann von CI
  nicht bespielt werden und bleibt eine manuelle Momentaufnahme.
- **Behebung der gemeldeten Befunde.** Der Bericht zeigt sie; ihre Behebung ist
  eigene Arbeit (z. B. Issue 53 für die Node-Version).
- **Der in ADR 0007 beschriebene, aber nicht existierende Workflow
  `doc-drift-check.yml`.** Bei der Recherche aufgefallener Widerspruch zwischen
  Dokumentation und Repo; eigener Vorgang.

## Acceptance Criteria
- [ ] Ein Push auf `main` erzeugt eine aktualisierte, öffentlich erreichbare
      Berichtsseite, ohne dass jemand eingreift.
- [ ] Die Seite trägt die beiden Bereiche Healthcheck und Issues unter einer URL.
- [ ] Der Healthcheck weist je Gate aus, ob es blockiert oder nur warnt, und
      erkennt ein Gate, das gar nicht erst anläuft, als solches — nicht als grün.
- [ ] Der Issue-Bereich zeigt jeden offenen Vorgang mit Beschreibung und
      Akzeptanzkriterien, nicht nur mit Titel.
- [ ] Der Issue-Bereich weist sichtbar aus, dass nur gepushte Branches erfasst
      sind.
- [ ] Einträge, die auf `main` bereits geschlossen sind, erscheinen nicht als
      offen, auch wenn ein älterer Branch sie noch offen führt.
- [ ] Die Befund-Einordnung stammt aus einer versionierten Datei und überlebt
      einen Neulauf des Generators unverändert.
- [ ] CI committet nichts auf `main`.
- [ ] Die reine Auswertungslogik ist über die genannten Seams getestet, ohne
      `git`, `vitest` oder Netzzugriff im Test.
- [ ] Eine ADR hält die Umstellung der Pages-Quelle samt entfallender
      `/adr/`- und `/issues/`-Adressen fest.
- [ ] `CONTEXT.md` führt den neuen Begriff, ohne *Deployment*, *Release* oder
      *Production* umzudeuten.

## Comments
- Faktenpruefung der Pages-Annahme (2026-07-21, verifiziert per gh api + curl):

Pages ist aktiv: build_type=legacy (Jekyll), source=Branch main / Ordner /docs, status=built,
URL https://artkoenig.github.io/tome_of_battle/

Tatsaechlich erreichbar (HTTP-Codes gemessen):
  404  /
  200  /adr/
  200  /adr/0023-solver-fassade-als-exklusive-schnittstelle.html
  404  /issues/
  404  /adr/README.html

Korrektur am PRD: Die ADR-Seiten sind NICHT nur 'ueber GitHub weiterhin lesbar' — sie werden
heute unter stabilen oeffentlichen Adressen ausgeliefert und /adr/ hat sehr wohl einen Index.
Der Verlust bei einer Quell-Umstellung waere also groesser als im PRD beschrieben; /issues/
dagegen war nie erreichbar.

Daraus folgt eine Option, die das PRD nicht betrachtet: Die Actions-Quelle muss den bisherigen
Inhalt nicht opfern. Der Workflow kann docs/ mit actions/jekyll-build-pages bauen, den Bericht
in die Ausgabe legen und alles gemeinsam deployen. Das erhaelt /adr/*, behebt nebenbei den
404 der Wurzel und macht den Zielkonflikt der ADR weitgehend gegenstandslos.

Offene Entscheidung fuer den Maintainer: Erhalt der ADR-Adressen (Jekyll-Build im Workflow
mitfuehren) oder bewusster Verzicht (nur der Bericht wird deployed).
- Entscheidung des Maintainers (2026-07-21): Die ADR-Adressen bleiben erhalten.

Der Workflow fuehrt den Jekyll-Build ueber docs/ mit und legt den Bericht daneben, statt den
bisherigen Pages-Inhalt zu ersetzen. Damit bleiben /adr/ und /adr/<name>.html erreichbar, und
der 404 der Wurzel wird durch den Bericht als Index abgeloest.

Dies ersetzt das letzte Akzeptanzkriterium des PRD ('Eine ADR haelt die Umstellung der
Pages-Quelle samt entfallender /adr/- und /issues/-Adressen fest.'). Neu gilt:
  - Eine ADR haelt die Umstellung der Pages-Quelle von 'Branch main /docs' auf 'GitHub Actions'
    fest, samt der Entscheidung, den Jekyll-Build mitzufuehren, damit /adr/* erhalten bleibt.
  - Nach dem Deployment liefern /adr/ und mindestens eine einzelne ADR-Seite weiterhin 200,
    und die Wurzel liefert den Bericht statt 404.
