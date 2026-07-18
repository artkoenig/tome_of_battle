# 0019: Manuelle Versionierung über package.json statt Git-Tag-Prognose

- **Status:** Accepted
- **Datum:** 2026-07-18
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0008: Native Vercel Integration](0008-vercel-deployment.md) (Deploy-Trigger-Teil wird in einem separaten Hauptissue korrigiert), [ADR 0009: Branching and Release Strategy](0009-branching-and-release-train-strategy.md)

## Kontext und Problemstellung

Mit der Umstellung auf manuelles Promoten in Vercel (automatisches Deployment bei Push auf `main` wurde deaktiviert) entfällt die Notwendigkeit, die App-Version bei jedem `main`-Build automatisch aus dem höchsten vorhandenen Git-Tag vorherzuberechnen. Ein Release ist jetzt ein bewusster, manueller Akt, keine Nebenwirkung eines Pushes mehr.

## Entscheidungsergebnis

`package.json` wird zur Single Source of Truth für die angezeigte App-Version. Vor dem Merge eines Hauptissues vom Typ `feature`/`fix` schlägt der Agent eine neue Version vor (Patch bei `fix`, Minor bei `feature`); der Nutzer bestätigt, überschreibt sie, oder lässt die Version unverändert. Bei Bestätigung wird `package.json` noch auf dem `issue/<slug>`-Branch aktualisiert und committet, sodass der Versions-Bump Teil des PRs ist und über den Squash-Merge automatisch in denselben `main`-Commit wandert. Ein direkter Push auf `main` findet dabei nie statt — der `pre-push`-Hook lehnt das kategorisch ab, unabhängig vom Zweck. Erst nach dem Merge wird auf dem aktualisierten `main` der Git-Tag `vX.Y.Z` gesetzt und ausschließlich dieser Tag gepusht (`git push origin vX.Y.Z`), was den Hook nicht betrifft, da er nur Branch-Refs prüft.

Git-Tags dienen weiterhin als historische Marker für die Commit-Diff-Release-Notes (siehe Issue 03), aber nicht mehr als Quelle für die Versionsberechnung selbst.

### Konsequenzen

- **Positiv:** Versionsnummern sind bewusste, menschliche Entscheidungen statt automatischer Vorhersagen; kein Risiko einer "vorhergesagten", aber nie tatsächlich existierenden Tag-Version.
- **Negativ:** Kein automatischer Korrekturmechanismus mehr — wird der Versions-Prompt übersprungen oder falsch beantwortet, bleibt die Version stehen, bis jemand es manuell nachholt.
