# Staging-Umgebung

Die App ist ein reiner Client (kein Backend), das Deployment läuft über **Vercel**
und baut bei jedem Push. Production ist der Branch **`main`**. Die Staging-Umgebung
ist ein dedizierter Branch **`staging`**, den Vercel auf eine eigene, feste URL
deployt – zum Testen von Änderungen, bevor sie live gehen.

## Wie es funktioniert

- **`main`** → Production (Live-App), wird getaggt und veröffentlicht.
- **`staging`** → feste Staging-URL, kein Release-Tag.
- **jeder andere Branch/PR** → automatischer Vercel-Preview mit zufälliger URL.

Der Build erkennt die Umgebung anhand des Branches (`scripts/deployEnv.js`) und
stellt sie der App als `import.meta.env.VITE_DEPLOY_ENV` bereit. Auf Staging und
Preview zeigt die App oben links neben dem Logo einen Umgebungs-Badge
(`STAGING` bzw. `VORSCHAU`), damit sie nicht mit der Live-App verwechselt wird.
Auf Production und im lokalen Dev-Betrieb bleibt der Badge unsichtbar.

Weil Staging unter einer **anderen URL/Origin** läuft, sind seine IndexedDB
(importierte Systeme und Rosters) und sein Service-Worker-Cache vollständig von
Production getrennt – Testdaten auf Staging berühren die Live-Daten nicht.

## Einmalige Einrichtung

1. **`staging`-Branch anlegen** (von `main` aus):

   ```bash
   git checkout main && git pull
   git checkout -b staging
   git push -u origin staging
   ```

2. **Im Vercel-Dashboard eine feste URL auf `staging` legen**
   (Vercel-Config lässt sich nicht aus dem Repo setzen, das geht nur im Dashboard):

   - Projekt → **Settings → Domains**.
   - Eine Subdomain hinzufügen, z. B. `staging.<deine-domain>`.
   - Bei dieser Domain als **Git Branch** `staging` auswählen (statt `main`).
   - Speichern. Ab jetzt deployt jeder Push auf `staging` auf diese feste URL.

   > Ohne eigene Domain kannst du alternativ Vercels stabilen Branch-Alias nutzen
   > (`<projekt>-git-staging-<scope>.vercel.app`), der ebenfalls immer auf den
   > letzten `staging`-Deploy zeigt.

## Arbeitsablauf

1. Feature-Branch von `main` abzweigen und entwickeln.
2. Zum Testen nach `staging` mergen → auf der Staging-URL prüfen (mit Badge).
3. Passt alles, den Feature-Branch nach `main` mergen → Production-Release.

`staging` ist ein reiner Test-Branch und wird **nicht** getaggt; die
Versionierung/Changelog-Logik reagiert weiterhin nur auf `main`.
