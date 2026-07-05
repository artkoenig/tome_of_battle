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

## Einrichtung

Es reicht, den **`staging`-Branch anzulegen** – mehr braucht es nicht:

```bash
git checkout main && git pull
git checkout -b staging
git push -u origin staging
```

Vercel vergibt für einen Branch automatisch einen **stabilen Branch-Alias**, der
immer auf den letzten Deploy dieses Branches zeigt und sich nie ändert:

```
https://<projekt>-git-staging-<scope>.vercel.app
```

Die genaue URL steht nach dem ersten `staging`-Push im Vercel-Dashboard (bzw. im
Vercel-Kommentar an einem PR). Diese URL ist die Staging-Umgebung – bookmarken
und für Tests verwenden.

> **Optional – hübschere URL:** Wer eine eigene Adresse wie
> `staging.<deine-domain>` will, legt sie im Vercel-Dashboard unter
> *Settings → Domains* an und weist ihr als **Git Branch** `staging` zu. Rein
> funktional ist das nicht nötig; der Branch-Alias oben tut dasselbe.

## Arbeitsablauf

1. Feature-Branch von `main` abzweigen und entwickeln.
2. Zum Testen nach `staging` mergen → auf der Staging-URL prüfen (mit Badge).
3. Passt alles, den Feature-Branch nach `main` mergen → Production-Release.

`staging` ist ein reiner Test-Branch und wird **nicht** getaggt; die
Versionierung/Changelog-Logik reagiert weiterhin nur auf `main`.
