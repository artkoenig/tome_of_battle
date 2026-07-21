Status: resolved
Type: chore
Blocked by: None

## Description

Die Entscheidungen dieses Vorhabens schriftlich verankern.

### ADR: Pages-Quelle und Erhalt der ADR-Adressen

Festzuhalten ist die Umstellung der Pages-Quelle von „Branch `main` /
Ordner `/docs`" auf „GitHub Actions" — samt der Entscheidung, den Jekyll-Build
im Workflow mitzuführen, damit die heute erreichbaren ADR-Adressen bestehen
bleiben.

Der Abwägungscharakter gehört in die ADR: Pages kennt nur eine Quelle je
Repository, die beiden Betriebsarten schließen sich aus, und die Umstellung ist
eine manuelle Repository-Einstellung. Der gemessene Ausgangszustand (`/adr/` und
einzelne ADR-Seiten 200, Wurzel und `/issues/` 404) gehört als Beleg hinein,
ebenso die verworfene Alternative, den bisherigen Inhalt fallenzulassen.

Zu prüfen ist außerdem, ob ADR 0007 und 0008 durch den neuen Workflow eine
Ergänzung brauchen, damit die Workflow-Landschaft dort vollständig bleibt.

### Glossar

Der Vorgang ist weder *Deployment* noch *Release* noch *Production* im Sinne des
bestehenden `CONTEXT.md` — diese Begriffe sind dort exklusiv an die Auslieferung
der Anwendung gebunden. Der Bericht braucht einen eigenen Begriff, damit das
vorhandene Vokabular nicht verwässert.

### Abgrenzung

Dieser Schnitt schreibt Dokumentation, keinen Code. Er hängt an keinem anderen
Schnitt: die Entscheidungen stehen bereits fest.

## Acceptance Criteria
- [ ] Eine ADR hält die Umstellung der Pages-Quelle fest, samt der Entscheidung,
      den Jekyll-Build mitzuführen, damit `/adr/*` erhalten bleibt.
- [ ] Die ADR nennt den gemessenen Ausgangszustand und die verworfene
      Alternative.
- [ ] Die ADR benennt, dass die Quell-Umstellung eine manuelle
      Repository-Einstellung ist.
- [ ] `CONTEXT.md` führt einen eigenen Begriff für den Bericht, ohne
      *Deployment*, *Release* oder *Production* umzudeuten.
- [ ] Der ADR-Index ist ergänzt; ADR 0007/0008 sind auf Ergänzungsbedarf geprüft
      und bei Bedarf nachgezogen.

## Comments
- ADR 0025 angelegt (Pages-Quelle auf GitHub Actions, Jekyll-Build wird mitgefuehrt), ADR-Index ergaenzt, ADR 0007 um den Zustandsbericht-Workflow und ADR 0008 um die Abgrenzung zu Pages erweitert. CONTEXT.md fuehrt den neuen Begriff 'Zustandsbericht'; Deployment/Release/Production bleiben unveraendert an die Anwendungsauslieferung gebunden.
