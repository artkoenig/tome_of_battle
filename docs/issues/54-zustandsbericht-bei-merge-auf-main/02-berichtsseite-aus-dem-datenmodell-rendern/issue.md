Status: resolved
Type: chore
Blocked by: [01]

## Description

Aus dem Datenmodell aus Schnitt 01 entsteht eine eigenständige HTML-Seite mit
zwei Bereichen unter einer URL.

- **Healthcheck** — Gates mit ihrer tatsächlichen Wirksamkeit, Kennzahlen,
  Testabdeckung je Modul, längste Funktionen, Strukturfakten, eingeordnete
  Befunde.
- **Issues** — jeder offene Vorgang mit vollständigem Inhalt (Beschreibung,
  Akzeptanzkriterien), nicht nur als Titelzeile. Die Inhalte sind Markdown und
  werden **zur Bauzeit** zu HTML gerendert, damit die Seite ohne Laufzeit-Logik
  auskommt. Die dafür nötige Abhängigkeit ist eine devDependency und berührt die
  Laufzeit-Abhängigkeiten der Anwendung nicht.

### Trennung von Messung und Urteil

Die zentrale Entscheidung des Vorhabens. Kennzahlen entstehen automatisch; die
**Einordnung** der Befunde liegt in einer versionierten, von Hand gepflegten
Datei daneben und wird beim Rendern dazugemischt.

Der Anlass ist konkret: `knip` meldet 26 Befunde, aber 19 davon sind
Fassaden-Re-Exporte nach ADR 0023 und damit Absicht, keine Schuld. Ohne diese
Trennung müsste jemand diese Sortierarbeit nach jedem Lauf neu leisten. Die
Einordnung muss einen Neulauf des Generators unverändert überleben.

### Darstellung

Die Seite wird gelesen, um den Zustand **auf einen Blick** zu beurteilen. Sie
braucht daher ein Gesamturteil vor den Einzelheiten, und der Zustand eines Gates
muss auch ohne Farbe erkennbar sein. Die Seite ist in sich geschlossen: kein
Nachladen von Schriften, Skripten oder Daten. Helles und dunkles Erscheinungsbild
werden beide bedient.

Der bereits erzeugte Bericht dient als inhaltliche Vorlage; die Blindstelle aus
Schnitt 01 (nur gepushte Branches) ist sichtbar auszuweisen.

## Acceptance Criteria
- [ ] Aus einem Datenmodell entsteht eine vollständige, in sich geschlossene
      HTML-Seite ohne externe Ressourcen.
- [ ] Die Seite trägt Healthcheck und Issues unter einer URL.
- [ ] Der Healthcheck weist je Gate aus, ob es blockiert oder nur warnt, und
      stellt ein nicht angelaufenes Gate als solches dar — nicht als grün.
- [ ] Jeder offene Vorgang erscheint mit Beschreibung und Akzeptanzkriterien,
      aus Markdown zur Bauzeit gerendert.
- [ ] Die Seite weist sichtbar aus, dass nur gepushte Branches erfasst sind.
- [ ] Die Befund-Einordnung stammt aus einer versionierten Datei und überlebt
      einen Neulauf des Generators unverändert.
- [ ] Der Zustand eines Gates ist ohne Farbunterscheidung erkennbar.
- [ ] `renderReport(model)` ist über ein reines Datenmodell getestet, ohne
      Dateisystem- oder Netzzugriff im Test.
- [ ] `npm run lint`, `npm run typecheck` und `npx vitest run` sind grün.

## Comments
- renderReport(model) erzeugt eine in sich geschlossene HTML-Seite (Gesamturteil, Healthcheck mit Gates/Wirksamkeit/drittem Zustand not-run, Abdeckung, laengste Funktionen, Struktur, eingeordnete Befunde; Issues als Markdown-Volltext zur Bauzeit gerendert). Blindstelle 'nur gepushte Branches' ausgewiesen. Befund-Einordnung in versionierter Hand-Datei scripts/project-state/assessment.js. Markdown->HTML via devDependency marked. lint/typecheck/vitest gruen (1272 Tests).
