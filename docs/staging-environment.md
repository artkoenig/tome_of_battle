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

## Arbeitsablauf (Release-Train)

```
feature/xyz ──PR──▶ staging ──(auf Staging-URL testen)──▶ PR ──▶ main ──▶ Production + Release-Tag
```

1. Feature-Branch von `main` abzweigen und entwickeln.
2. **PR gegen `staging`** öffnen. CI (Lint + Tests) läuft automatisch (siehe
   unten). Nach dem Merge auf der stabilen Staging-URL prüfen (mit Badge,
   isolierte IndexedDB). Feature-PRs am besten **squash-mergen** – dann ist ein
   Feature = ein sauberer Commit, und der PR-Titel wird später die Changelog-
   Zeile (deshalb als deutschen Endnutzer-Satz formulieren).
3. Zum Veröffentlichen einen **PR `staging` → `main`** öffnen und als **normalen
   Merge** mergen (**kein Squash**). Push auf `main` → Release-Tag + „Was ist
   neu"-Toast.

**Warum kein Squash bei `staging → main`:** Der Changelog = die Commit-Subjects
auf `main` seit dem letzten Release-Tag. Ein Squash der Promotion würde alle
Features zu einer einzigen Changelog-Zeile zusammenfalten.

**Divergenz vermeiden:** Immer die *ganze* `staging` promoten, nichts
cherry-picken. Einen Hotfix direkt auf `main` danach nach `staging` zurückmergen,
sonst laufen die Branches auseinander.

`staging` wird **nicht** getaggt; die Versionierung/Changelog-Logik reagiert nur
auf `main`.

## Continuous Integration

> Eine vollständige Referenz **aller** Workflows (CI, Release-Tagging,
> PR-Automatisierung, Issue-Agent) und des Vercel-Deploys steht in
> [`docs/ci-cd.md`](./ci-cd.md).

`.github/workflows/ci.yml` läuft bei jedem **PR gegen `staging` oder `main`**
(und bei Pushes auf diese Branches) und führt `npm run lint` sowie die Unit-/
Component-Tests (`npx vitest run`) aus.

**Auto-PRs auf `staging` umbiegen:** Claude-Code öffnet neue PRs immer gegen den
Default-Branch (`main`). Der Workflow `.github/workflows/retarget-claude-prs.yml`
stellt beim Öffnen eines `claude/*`-PRs die Basis automatisch von `main` auf
`staging` um (via `pull_request_target`, damit es auch für ältere Branches greift
und Schreibrechte hat – es wird kein PR-Code ausgeführt). Wird die Basis danach
bewusst wieder auf `main` gesetzt, bleibt sie so. Der Workflow ist erst aktiv,
sobald er selbst auf `main`/`staging` liegt.

Der Puppeteer-E2E (`src/solver/ui.test.js`) läuft **automatisch auf Staging**:
in einem eigenen `e2e`-Job, aber nur bei **PRs gegen `staging`** und **Pushes auf
`staging`**. Der Job installiert Chromium (`npx puppeteer browsers install chrome`)
und spielt den vollen Import→Build→Play-Smoke-Test durch. So wird jede Änderung
vor der Promotion nach `main` einmal end-to-end geprüft, ohne jeden Feature-PR
(gegen andere Ziele) mit dem langsamen Browser-Lauf auszubremsen. Lokal läuft er
weiterhin über `npm test`.
