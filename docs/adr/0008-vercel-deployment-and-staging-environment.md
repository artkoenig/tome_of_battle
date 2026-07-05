# 0008: Vercel Deployment and Staging Environment

- **Status:** Accepted
- **Datum:** 2026-07-05
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md), [ADR 0009: Branching and Release Train Strategy](0009-branching-and-release-train-strategy.md)

## Kontext und Problemstellung

*Tome of Battle* ist eine reine Client-Side PWA, deren Daten (Kataloge, Armeelisten) lokal in der IndexedDB des Browsers persistiert werden. Um neue Features oder Fehlerbehebungen sicher und unter realen Bedingungen zu testen, bevor sie für Endbenutzer live geschaltet werden, wird eine isolierte Vorab-Umgebung (Staging) benötigt. Diese Staging-Umgebung muss eine stabile URL haben und darf die Live-Datenbanken der Benutzer (Production) nicht beeinflussen. Zudem müssen Entwickler und Benutzer auf einen Blick erkennen können, in welcher Umgebung sie sich befinden.

## Entscheidungsfaktoren (Drivers)

- **Datensicherheit & Isolation:** Keine Beeinflussung von Produktivdaten durch Tests auf Staging.
- **Transparenz:** Visuelle Unterscheidung der Umgebungen (Production vs. Staging vs. Preview).
- **Automatisierung:** Automatische Bereitstellung von Versionen bei Code-Änderungen.

## Betrachtete Optionen

- **Option 1:** Manuelles Hosten einer Staging-Instanz auf einem separaten Server.
- **Option 2:** Verwendung von Vercel Branch Deployments mit automatischer Umgebungserkennung und Origin-Isolierung.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Vercel Branch Deployments)**.

Folgende Richtlinien und Mechanismen wurden etabliert:

### 1. Umgebungs-Mapping
Das Deployment der Git-Branches erfolgt automatisiert über Vercel:
- **Branch `main`** → **Production** (Haupt-Domain, Live-App).
- **Branch `staging`** → feste **Staging-URL** (stabiler Branch-Alias von Vercel: `https://<projekt>-git-staging-<scope>.vercel.app`).
- **Jeder andere Branch/PR** → automatischer **Preview-Deploy** mit dynamischer, zufälliger URL.

### 2. Origin-Isolierung in IndexedDB
Da IndexedDB an die *Same-Origin-Policy* des Browsers gebunden ist, sind die Datenbanken auf Production, Staging und den Preview-URLs durch die unterschiedlichen Domains vollständig voneinander getrennt. Testdaten auf Staging berühren niemals die Live-Daten der Benutzer.

### 3. Visuelle Umgebungserkennung (Staging-Badge)
Der Build-Prozess (`scripts/deployEnv.js`) liest die Vercel-Umgebungsvariable `VERCEL_TARGET_ENV` aus und stellt sie dem React-Client als `import.meta.env.VITE_DEPLOY_ENV` bereit.
- Auf Staging zeigt die App links neben dem Logo einen permanenten Badge mit der Aufschrift `STAGING`.
- Auf Preview-Umgebungen zeigt die App einen Badge mit der Aufschrift `VORSCHAU`.
- Auf Production (und im lokalen Entwicklungsmodus) bleibt der Badge unsichtbar.

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Risikoloses Testen auf einer echten Online-Umgebung.
  - Klare visuelle Trennung verhindert Verwechslungen beim Testen.
  - Vollständig automatisiertes Deployment ohne manuelles Zutun.
- **Negativ:**
  - Preview-URLs verbrauchen Kontingente des Vercel-Hobby-Tarifs.
