Status: ready-for-agent
Type: chore
Blocked by: None

## Description
`.antigravity/config.json` ist im Git getrackt, obwohl `.antigravity/` im
`.gitignore` steht (die Datei wurde vor der Ignore-Regel committet;
`.gitignore` untrackt bestehende Einträge nicht rückwirkend). Der Inhalt ist
eine persönliche Konfiguration eines fremden KI-Tools ohne Projektbezug.

## Acceptance Criteria
- [ ] `.antigravity/config.json` ist per `git rm --cached` aus dem Tracking
      entfernt (Datei bleibt lokal bestehen, ist weiterhin ignoriert)
- [ ] `git status` zeigt die Datei danach nicht mehr als getrackt

## Comments
