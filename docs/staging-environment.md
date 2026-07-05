# Staging-Umgebung

Die App ist ein reiner Client (kein Backend), das Deployment läuft über **Vercel**
und baut bei jedem Push. Production ist der Branch **`main`**. Die Staging-Umgebung
ist ein dedizierter Branch **`staging`**, den Vercel auf eine eigene, feste URL
deployt – zum Testen von Änderungen, bevor sie live gehen.

## Wie es funktioniert

- **`main`** → Production (Live-App), wird getaggt und veröffentlicht.
- **`staging`** → feste Staging-URL, kein Release-Tag.
- **jeder andere Branch/PR** → automatischer Vercel-Preview mit zufälliger URL.

Der Build bestimmt die Umgebung (`scripts/deployEnv.js`) und stellt sie der App
als `import.meta.env.VITE_DEPLOY_ENV` bereit. Auf Staging und Preview zeigt die
App oben links neben dem Logo einen Umgebungs-Badge (`STAGING` bzw. `VORSCHAU`),
damit sie nicht mit der Live-App verwechselt wird. Auf Production und im lokalen
Dev-Betrieb bleibt der Badge unsichtbar.

Die Erkennung bevorzugt Vercels `VERCEL_TARGET_ENV` (nennt die – auch benutzer-
definierte – Umgebung zuverlässig) und fällt sonst auf den Branch-Namen zurück.
`VERCEL_ENV` wird bewusst **nicht** genutzt, weil es bei benutzerdefinierten
Pre-Prod-Umgebungen auf `preview` steht.

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

### Optional: echte Vercel Custom Environment (Pro/Enterprise)

Vercel bietet für dauerhafte Vorab-Umgebungen offiziell **Custom Environments**
(nur Pro/Enterprise). Damit bekommt „Staging" eine eigene Domain **und** eigene
Environment-Variablen, getrennt von Production/Preview:

- Projekt → **Settings → Environments** → Custom Environment `staging` anlegen.
- Branch-Regel `equals staging` setzen → Pushes auf `staging` landen dort.
- Domain und ggf. eigene Env-Variablen zuweisen.

Unser `staging`-Branch passt direkt auf diese Regel. Weil die App-Erkennung
`VERCEL_TARGET_ENV` bevorzugt, zeigt der Badge auch dann korrekt „STAGING", wenn
die Umgebung über eine solche Custom Environment (statt nur über den Branch-
Namen) definiert ist. Auf dem Hobby-Plan gibt es keine Custom Environments – dort
ist der Branch-Alias oben der richtige Weg.

## Arbeitsablauf

1. Feature-Branch von `main` abzweigen und entwickeln.
2. Zum Testen nach `staging` mergen → auf der Staging-URL prüfen (mit Badge).
3. Passt alles, den Feature-Branch nach `main` mergen → Production-Release.

`staging` ist ein reiner Test-Branch und wird **nicht** getaggt; die
Versionierung/Changelog-Logik reagiert weiterhin nur auf `main`.
