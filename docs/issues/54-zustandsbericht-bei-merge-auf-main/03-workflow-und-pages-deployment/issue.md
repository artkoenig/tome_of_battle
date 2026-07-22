Status: resolved
Type: chore
Blocked by: [01, 02]

## Description

Der Bericht entsteht bei jedem Push auf `main` und wird über GitHub Pages
veröffentlicht.

**Eigener Workflow**, nicht ein weiterer Job in `ci.yml` — entsprechend dem in
ADR 0007 erkennbaren Muster „ein Workflow je fokussiertem Zweck". Er braucht
`pages: write` und `id-token: write`, die heute in keinem Workflow gesetzt sind.

### Was der Lauf braucht

- **Vollständige Historie und alle Remote-Refs.** Der Issue-Teil liest den
  Tracker über mehrere Branches; ein flacher Standard-Checkout genügt nicht.
- **Die Gates tatsächlich ausführen**, um ihre echten Ergebnisse zu erheben —
  einschließlich des Falls, dass eines gar nicht anläuft. Ein solcher Abbruch
  darf den Berichtslauf nicht scheitern lassen, sondern ist das zu meldende
  Ergebnis.

### Erhalt des bisherigen Pages-Inhalts

Entscheidung des Maintainers: Die heute erreichbaren ADR-Adressen bleiben
bestehen. Pages kennt nur **eine** Quelle je Repository, daher wird von
„Branch `main` / Ordner `/docs`" auf „GitHub Actions" umgestellt — der Workflow
führt den Jekyll-Build über `docs/` jedoch mit und legt den Bericht daneben.

Gemessener Ausgangszustand: `/adr/` und einzelne ADR-Seiten liefern **200**,
Wurzel und `/issues/` liefern **404**. Nach der Umstellung müssen die
ADR-Adressen weiter 200 liefern; die Wurzel liefert künftig den Bericht.

**Die Umstellung der Pages-Quelle ist eine manuelle Repository-Einstellung.**
Kein Workflow-Code bewirkt sie. Sie bleibt dem Maintainer vorbehalten; dieser
Schnitt liefert alles Übrige und benennt den nötigen Handgriff.

### Kein Commit auf `main`

Der Bericht ist Build-Ausgabe und geht direkt ins Pages-Deployment, analog zu
`dist/`. Er wird nicht committet — damit bleibt die Regel „`main` kommt nur über
PR-Merges voran" unangetastet.

## Acceptance Criteria
- [ ] Ein Push auf `main` erzeugt und veröffentlicht den Bericht ohne Eingriff.
- [ ] Der Workflow ist eigenständig und setzt `pages: write` und
      `id-token: write`.
- [ ] Der Checkout stellt vollständige Historie und die Remote-Refs bereit, die
      der Issue-Teil braucht.
- [ ] Ein Gate, das nicht anläuft, lässt den Berichtslauf nicht scheitern,
      sondern erscheint im Bericht als „nicht angelaufen".
- [ ] Nach dem Deployment liefern `/adr/` und mindestens eine einzelne ADR-Seite
      weiterhin 200; die Wurzel liefert den Bericht statt 404.
- [ ] CI committet nichts auf `main`.
- [ ] Der manuelle Schritt „Pages-Quelle auf GitHub Actions umstellen" ist
      dokumentiert und dem Maintainer benannt.

## Comments
- Orchestrator scripts/project-state/generate.js (I/O-Rand: Gates ausfuehren, coverage-final.json/ci.yml/Produktivcode/Importgraph/Tracker-Refs lesen) baut ueber die reine buildReportModel.js das ReportModel und schreibt via renderReport die HTML-Seite; CLI-Guard am Ende. Eigener Workflow .github/workflows/status-report.yml (push:main, pages:write + id-token:write, fetch-depth 0 + expliziter origin/*-Fetch) fuehrt jekyll-build-pages ueber docs/ mit und legt den Bericht als _site/index.html daneben, deployt via deploy-pages. Ein nicht anlaufendes Gate laesst den Lauf nicht scheitern (Gate-Ergebnisse sind Daten; Generator exit 0), sondern erscheint als 'nicht angelaufen'. Bericht wird nicht committet (.report/ gitignored). Manueller Pages-Quell-Schritt im Workflow-Header dokumentiert. yaml als explizite devDependency ergaenzt (CI-Parsing). Neu: buildReportModel.test.js (9 Tests).
