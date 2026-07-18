Status: ready-for-agent
Type: chore
Blocked by: None

## Description
Unter `docs/issues/` sind die Hauptnummern `15`, `17`, `19` und `20` jeweils
mehrfach vergeben (`15-github-issue-triage` / `15-import-revisionen`;
`17-mobile-viewport-duckduckgo` / `17-whfb6-lexicanum-data-source` /
`17-whfb6-link-toggle`; `19-battlescribe-xsd-konformitaet` /
`19-versionsnummer-vom-header-in-den-optionsscreen-verschieben`;
`20-adr-0007-0008-veraltete-auto-deploy-beschreibung-korrigieren` /
`20-manueller-release-und-versionierungs-workflow`). Alle betroffenen
Hauptissues sind `resolved`. Jeweils eines der beiden/dreien Verzeichnisse pro
Nummer wird umbenannt auf die nächste freie Nummer (fortlaufend ab der
aktuell höchsten vergebenen Nummer), damit jede Hauptnummer eindeutig ist und
die Reihenfolge wieder der Tracker-Konvention entspricht. Welches der
Duplikate umbenannt wird, ist beliebig — sinnvollerweise das jeweils später
im Git-Verlauf entstandene.

## Acceptance Criteria
- [ ] Jede Hauptnummer unter `docs/issues/` kommt genau einmal vor
- [ ] Kein `issue.md`-Inhalt geht verloren, nur die Verzeichnisnamen ändern
      sich
- [ ] Keine verbleibenden Verweise (z. B. in `## Comments` anderer Issues)
      auf die alten, jetzt umbenannten Verzeichnisnamen

## Comments
