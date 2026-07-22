# GitHub-Pages-Quelle auf Actions umgestellt, Jekyll-Build wird mitgeführt

- **Status:** Accepted
- **Datum:** 2026-07-21
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** ergänzt [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md); abgegrenzt gegen [ADR 0008: Native Vercel Integration](0008-vercel-deployment.md) — Pages liefert **nicht** die Anwendung aus

## Kontext und Problemstellung

Der Zustandsbericht (siehe Glossar in `CONTEXT.md`) soll bei jedem Push auf
`main` neu erzeugt und öffentlich erreichbar sein. Der naheliegende Weg dorthin
ist GitHub Pages — und genau dort liegt der Konflikt.

**GitHub Pages war im Repository bereits aktiv, ohne dass das irgendwo
dokumentiert war.** Erhoben am 2026-07-21 über `gh api` und `curl`:

- `build_type` = `legacy` (Jekyll), Quelle: Branch `main`, Ordner `/docs`,
  Status `built`
- URL: `https://artkoenig.github.io/tome_of_battle/`

Gemessene HTTP-Codes im Ausgangszustand:

| Adresse | Code |
| :--- | :---: |
| `/` | 404 |
| `/adr/` | 200 |
| `/adr/0023-solver-fassade-als-exklusive-schnittstelle.html` | 200 |
| `/issues/` | 404 |
| `/adr/README.html` | 404 |

Der `docs/`-Baum wird also seit Längerem als Website ausgeliefert: Die ADRs
liegen unter stabilen, öffentlichen Adressen, und `/adr/` hat einen Index. Die
Wurzel dagegen liefert 404, `/issues/` war nie erreichbar.

Das eigentliche Problem: **Pages kennt nur eine Quelle je Repository.** Entweder
ein Branch-Ordner (der heutige Zustand) oder ein Actions-Workflow — beide
Betriebsarten schließen sich aus. Ein Workflow kann den Bericht also nur dann
veröffentlichen, wenn die Quelle umgestellt wird, und diese Umstellung entzieht
dem heutigen Jekyll-Alt-Build die Grundlage. Damit stünden die bestehenden
ADR-Adressen zur Disposition, obwohl sie nachweislich funktionieren.

## Entscheidungsfaktoren (Drivers)

- **Keine toten öffentlichen Adressen.** `/adr/*` liefert heute 200 und kann
  extern verlinkt sein; ein stiller Wegfall wäre ein Verlust ohne Gegenwert.
- **Der Bericht braucht Actions als Quelle.** Er ist Build-Ausgabe und darf nicht
  committet werden, sonst käme `main` an den PR-Merges vorbei voran (siehe
  [ADR 0009](0009-branching-and-release-train-strategy.md)).
- **Die Wurzel-404 ist ein Mangel, kein Merkmal.** Wer die Pages-URL aufruft,
  sollte etwas vorfinden.
- **Der Handgriff muss benannt sein.** Die Quell-Umstellung ist eine
  Repository-Einstellung, die kein Workflow-Code bewirkt; wird sie nicht
  ausdrücklich dokumentiert, läuft der Workflow ins Leere und niemand weiß,
  warum.
- **Abgrenzung zur Anwendungsauslieferung.** Die Anwendung wird von Vercel
  ausgeliefert (ADR 0008). Pages darf dieses Feld nicht betreten und die
  bestehenden Begriffe *Deployment*, *Release* und *Production* nicht verwässern.

## Betrachtete Optionen

- **Option 1: Bei der Branch-Quelle bleiben** und den erzeugten Bericht nach
  `docs/` committen.
- **Option 2: Auf „GitHub Actions" umstellen und nur den Bericht deployen** — der
  bisherige Pages-Inhalt entfällt.
- **Option 3: Auf „GitHub Actions" umstellen und den Jekyll-Build über `docs/`
  im Workflow mitführen**, den Bericht daneben in dieselbe Ausgabe legen und
  beides gemeinsam deployen.

## Entscheidungsergebnis

Gewählte Option: **Option 3 — Actions als Quelle, Jekyll-Build mitgeführt.**

Sie ist die einzige Option, die den Bericht ermöglicht, ohne bestehende Adressen
zu opfern oder gegen die Commit-Regeln von `main` zu verstoßen. Der Zielkonflikt
aus dem Ausgangsproblem — „Bericht **oder** ADR-Adressen" — löst sich damit
weitgehend auf: Was Pages bisher aus dem Branch-Ordner baute, baut künftig der
Workflow mit demselben Werkzeug.

### Aufbau

Der Berichts-Workflow (siehe [ADR 0007](0007-ci-cd-workflow.md)) baut `docs/` mit
`actions/jekyll-build-pages`, legt den erzeugten Bericht als Wurzel-Dokument
daneben und deployt beides als **ein** Pages-Artefakt. Der Bericht wird nicht
committet; er existiert nur als Build-Ausgabe, analog zu `dist/`.

### Manueller Schritt — einmalig, durch den Maintainer

**Die Umstellung der Pages-Quelle bewirkt kein Workflow-Code.** Sie ist eine
Repository-Einstellung und muss von Hand vorgenommen werden:

> GitHub → Repository **Settings** → **Pages** → **Build and deployment** →
> **Source**: von „Deploy from a branch" (`main` / `/docs`) auf **„GitHub
> Actions"** umstellen.

Solange dieser Schritt aussteht, läuft der Workflow zwar, sein Deployment wird
von Pages aber nicht übernommen. Der Schritt ist einmalig und über dieselbe
Einstellung reversibel.

### Zielzustand der Adressen

| Adresse | vorher | nachher |
| :--- | :---: | :---: |
| `/` | 404 | 200 (Zustandsbericht) |
| `/adr/` | 200 | 200 |
| `/adr/<name>.html` | 200 | 200 |
| `/issues/` | 404 | 404 |

`/issues/` war nie erreichbar und bleibt es nicht — die offenen Vorgänge
erscheinen stattdessen im Issues-Bereich des Berichts.

### Konsequenzen (Auswirkungen)

- **Positiv:** Der Zustandsbericht wird ohne Eingriff und ohne CI-Commit auf
  `main` veröffentlicht.
- **Positiv:** Die heute erreichbaren ADR-Adressen bleiben unverändert bestehen;
  die Wurzel liefert erstmals Inhalt statt 404.
- **Positiv:** Der bislang undokumentierte Pages-Betrieb ist damit überhaupt
  erst festgehalten und bewusst gemacht.
- **Negativ:** Der Workflow trägt jetzt Verantwortung für einen Jekyll-Build, den
  zuvor GitHub unsichtbar übernahm. Bricht dieser Schritt, fallen die
  ADR-Adressen mit dem Bericht zusammen aus.
- **Negativ:** Ein manueller, im Code unsichtbarer Schritt bleibt als
  Vorbedingung bestehen — ein frisch geklontes oder neu aufgesetztes Repository
  hat ihn nicht automatisch.
- **Neutral:** Pages und Vercel bleiben getrennte Auslieferungswege mit
  getrennten Zwecken: Pages veröffentlicht Projektdokumentation und den Bericht,
  Vercel die Anwendung (ADR 0008). Der Pages-Vorgang ist kein *Deployment* im
  Sinne des Glossars.

## Vor- und Nachteile der Optionen

### Option 1 — Branch-Quelle behalten, Bericht committen

- **Gut, weil** die bestehenden Adressen ohne jede Änderung erhalten blieben und
  kein manueller Handgriff nötig wäre.
- **Schlecht, weil** CI dafür auf `main` committen müsste — das verletzt die
  Regel, dass `main` ausschließlich über PR-Merges vorankommt.
- **Schlecht, weil** ein generierter Bericht in der Versionsgeschichte bei jedem
  Push Rauschen erzeugt, ohne dass diese Historie irgendjemand liest.

### Option 2 — Actions-Quelle, nur der Bericht

- **Gut, weil** der Workflow minimal bliebe: erzeugen, deployen, fertig.
- **Schlecht, weil** `/adr/` und alle einzelnen ADR-Seiten ersatzlos 404
  lieferten — nachweislich funktionierende öffentliche Adressen würden ohne Not
  abgeschaltet.
- **Schlecht, weil** dieser Verlust nicht umkehrbar wäre, sobald externe Links
  darauf zeigen.

### Option 3 — Actions-Quelle, Jekyll-Build mitgeführt

- **Gut, weil** sie Bericht und bestehende Adressen zugleich liefert, statt
  zwischen ihnen zu wählen.
- **Gut, weil** sie den Wurzel-404 nebenbei behebt.
- **Gut, weil** der Bau von `docs/` damit sichtbar im Repository steht statt in
  einer GitHub-Einstellung.
- **Schlecht, weil** der Workflow einen zusätzlichen Bauschritt trägt und damit
  eine zusätzliche Fehlerquelle für die ADR-Adressen darstellt.
