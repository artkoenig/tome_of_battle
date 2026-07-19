# 0021: Preview-Badge über Laufzeit-Hostname-Vergleich

- **Status:** Accepted
- **Datum:** 2026-07-19
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0008: Native Vercel Integration](0008-vercel-deployment.md) (ergänzt Abschnitt 2), [ADR 0019: Manuelle Versionierung und Release-Freigabe](0019-manuelle-versionierung-und-release-freigabe.md) (Hash-Suffix bleibt bestehen, deckt diesen Fall aber nicht ab)

## Kontext und Problemstellung

Seit ADR 0019 wird ein `main`-Branch-Deployment erst durch manuelles Promoten
zur echten Production. Bis dahin ist derselbe Build bereits über eine feste
Vercel-Branch-Alias-URL (`army-builder-git-main-neardy.vercel.app`) erreichbar.

Das bestehende Nicht-`main`-Signal aus ADR 0008/0019 (`VITE_DEPLOY_ENV` bzw.
der Versions-Hash-Suffix `<Version>+<Kurz-Hash>`) wird zur **Build-Zeit** aus
dem Git-Branch abgeleitet: ein Build vom `main`-Branch gilt darin bereits als
"production". Die Alias-URL und die später promotete Produktions-Domain
teilen sich jedoch denselben `main`-Build — das bestehende Signal kann beide
strukturell nicht unterscheiden. Dadurch ist die Preproduction-Instanz auf
der Alias-URL aktuell optisch nicht von der echten Production zu
unterscheiden.

## Entscheidungsergebnis

Ein kleines Preview-Badge im Header (Wiedereinführung, siehe unten) vergleicht
zur Laufzeit `window.location.hostname` gegen die als benannte Konstante
hinterlegte Produktions-Domain und wird angezeigt, sobald der Vergleich
negativ ausfällt. Der bestehende Versions-Hash-Suffix (ADR 0019) bleibt im
Einstellungen-Dialog für Detail-Diagnose erhalten — beide Signale schließen
sich nicht aus, sie beantworten unterschiedliche Fragen: der Hash-Suffix
"welcher Commit genau", das Badge "bin ich auf der echten
Produktions-Domain".

Damit wird die in ADR 0008 Abschnitt 2 getroffene Entscheidung, auf ein
separates UI-Element zu verzichten, für den Hostname-Fall revidiert — die
damalige Begründung (Hash-Suffix reicht aus) galt für die Unterscheidung nach
Branch, nicht nach ausgelieferter Domain.

### Betrachtete Optionen

- **Generische Negativ-Erkennung** ("alles außer der Produktions-Domain",
  z. B. über eine Liste bekannter Hostnames). Verworfen zugunsten von YAGNI —
  aktuell existiert nur eine einzige relevante Preproduction-URL.
- **Wiederverwendung des bestehenden Build-Zeit-Signals** (`VITE_DEPLOY_ENV`).
  Verworfen, da es strukturell nicht zwischen Alias-URL und promoteter
  Produktions-Domain unterscheiden kann — beides ist derselbe `main`-Build.

### Konsequenzen

- **Positiv:** Sichtbare Unterscheidung genau dort, wo sie heute fehlt, ohne
  die bestehende Build-Infrastruktur (`scripts/deployEnv.js`,
  Versions-Hash-Suffix) anzufassen.
- **Negativ:** Die Produktions-Domain liegt als Konstante im Client-Code vor;
  bei einem Domain-Wechsel (z. B. Custom-Domain) muss diese Konstante manuell
  nachgezogen werden.
