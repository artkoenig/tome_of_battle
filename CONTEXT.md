# Army Builder

Ein WHFB6-Armeelisten-Builder als PWA. Dieser Glossar-Abschnitt hält Begriffe fest, die im Projekt sonst leicht verwechselt werden.

## Language / Glossary

**Release**:
Der bewusste, manuelle Akt, eine neue Versionsnummer zu setzen (`package.json` + Git-Tag `vX.Y.Z`) und den zugehörigen `main`-Commit in Vercel auf Production zu promoten.
_Avoid_: Deployment (siehe unten — nicht jedes Deployment ist ein Release).

**Deployment**:
Jeder von Vercel gebaute Build (bei Push auf `main` oder einen anderen Branch). Ein Deployment ist noch kein Release — es wird erst durch manuelles Promoten in Vercel produktiv.

**Version**:
Die Semver-Nummer (`vX.Y.Z`) in `package.json`, die einen Release eindeutig identifiziert und in den App-Einstellungen angezeigt wird.

**Release Notes** ("Chronik der Veränderungen"):
Die nutzersichtbare Liste der `feat:`/`fix:`-Commit-Subjects seit der zuletzt installierten Version, angezeigt im PWA-Update-Dialog. Datenquelle ist die Git-Commit-Historie, nicht der Issue-Tracker.
_Avoid_: Changelog (technischer Begriff für dieselbe Sache — `changelog.json` als Dateiname bleibt, aber im Nutzerkontext heißt es Release Notes / "Chronik der Veränderungen").

**Production** (Domain):
Die vom Nutzer aufgerufene Live-Domain, auf die zuletzt ein Deployment manuell promotet wurde (siehe Release). Nicht gleichzusetzen mit "der `main`-Build" — ein Deployment vom `main`-Branch (z. B. die Vercel-Branch-Alias-URL) ist erst nach dem manuellen Promoten tatsächlich Production, siehe [ADR 0021](docs/adr/0021-preview-badge-laufzeit-hostname-erkennung.md).
_Avoid_: "main-Build" als Synonym für Production — seit ADR 0019 sind das zwei verschiedene Zustände.

**Zustandsbericht**:
Die bei jedem Push auf `main` neu erzeugte HTML-Seite über den Zustand des Projekts — Healthcheck (Qualitäts-Gates mit ihrer tatsächlichen Wirksamkeit, Kennzahlen, eingeordnete Befunde) und die offenen Vorgänge des lokalen Trackers. Er ist eine Momentaufnahme über das *Projekt*, richtet sich an den Maintainer und wird über GitHub Pages veröffentlicht (siehe [ADR 0025](docs/adr/0025-pages-quelle-auf-github-actions-mit-jekyll-build.md)).

Sein Veröffentlichen heißt **Veröffentlichung des Zustandsberichts** — es ist ausdrücklich kein *Deployment*, kein *Release* und erreicht keine *Production*: Diese drei Begriffe bleiben exklusiv an die Auslieferung der **Anwendung** über Vercel gebunden. Der Bericht enthält keinen Anwendungscode, hat keine Versionsnummer und kein Freigabe-Gate.
_Avoid_: "Pages-Deployment", "Report-Release", "Doku-Production" — jede Übertragung der Auslieferungsbegriffe auf den Bericht verwässert sie.
