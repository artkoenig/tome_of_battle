Status: resolved
Type: chore
Blocked by: None

## Description

Der Kern des Generators: aus vorhandenen Rohdaten ein **Datenmodell des
Projektzustands** herleiten. Dieser Schnitt liefert die Auswertung, noch keine
Seite und keinen Workflow.

Die Logik ist rein: sie bekommt Rohdaten hereingereicht und gibt ein Datenmodell
zurück. Kein Aufruf von `git`, `vitest` oder Netz innerhalb der zu testenden
Funktionen — die I/O-Seite wird injiziert, wie es `scripts/versioning.js` und
`scripts/deployEnv.js` im Repo bereits vormachen.

### Zu erhebende Größen

- **Qualitäts-Gates** mit ihrer *tatsächlichen* Wirksamkeit. Ein Gate hat drei
  mögliche Zustände, und der dritte ist der Grund für dieses Vorhaben:
  bestanden, gemeldete Befunde, **gar nicht angelaufen**. Ein Werkzeug, das mit
  einem Umgebungsfehler abbricht, darf nie als grün gelten. Ob ein Gate
  blockiert oder nur warnt, ergibt sich aus `continue-on-error` im Workflow und
  gehört zum Modell.
- **Testabdeckung je Modul** aus `coverage-final.json` (Anweisungen, Branches,
  Funktionen).
- **Funktionslängen** über den Produktivcode, mit Grenzwert.
- **Importgraph**: Zyklen und Schichtung.
- **Offene Vorgänge** des Trackers über alle erreichbaren Refs — nicht nur
  `main`. Ein Eintrag, den `main` bereits geschlossen hat, zählt nicht als
  offen, auch wenn ein älterer Branch ihn noch offen führt.
- **Blindstellen**: was die Erhebung nicht sehen konnte (z. B. rein lokale
  Branches), als eigenes Feld im Modell — damit der Bericht es später ausweisen
  kann, statt zu schweigen.

### Testschnitte

- `parseIssueMarkdown(text)` → Status, Typ, Blocked-by, Abschnitte
- `collectOpenIssues(refs, showFile)` → offene Vorgänge bei injiziertem
  Git-Zugriff, inklusive der Regel „auf `main` geschlossen ⇒ nicht offen"
- `aggregateCoverage(coverageFinal)` → Kennwerte je Modul
- `findLongFunctions(source)` → Funktionslängen
- `findCycles(graph)` → Zyklen im Importgraphen
- `classifyGate(result)` → bestanden / Befunde / nicht angelaufen

## Acceptance Criteria
- [ ] Aus injizierten Rohdaten entsteht ein vollständiges Datenmodell des
      Projektzustands, ohne dass die Auswertungsfunktionen selbst `git`,
      `vitest` oder Netz aufrufen.
- [ ] Ein Gate, das mit einem Umgebungsfehler abbricht, wird als „nicht
      angelaufen" klassifiziert und nicht als bestanden.
- [ ] Zu jedem Gate ist erfasst, ob es blockiert oder nur warnt.
- [ ] Offene Vorgänge werden über mehrere Refs gesammelt; ein auf `main`
      geschlossener Eintrag erscheint nicht als offen.
- [ ] Das Modell führt die Blindstellen der Erhebung als eigenes Feld.
- [ ] Jeder genannte Testschnitt ist durch Tests abgedeckt, die ohne `git`,
      `vitest` und Netzzugriff laufen.
- [ ] `npm run lint`, `npm run typecheck` und `npx vitest run` sind grün.

## Comments
- Drei TS2345-Typfehler in coverage.js behoben (Akkumulator-Typedef auf [number, number]-Tupel gezogen, Logik unveraendert). Sechs Auswertungs-Seams mit Vitest-Schwesterdateien abgedeckt: parseIssueMarkdown, collectOpenIssues (inkl. Regel 'auf main geschlossen => nicht offen' bei injiziertem git-Zugriff), aggregateCoverage, findLongFunctions, findCycles, classifyGate (inkl. 'nicht angelaufen' bei Umgebungsabbruch). 61 neue Tests, ohne git/vitest/Netzzugriff. lint, typecheck und vitest run gruen.
