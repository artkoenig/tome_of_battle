Status: resolved
Type: fix
Blocked by: None

## Description

Der Zustandsbericht (Main-Issue 54, live unter der Pages-Wurzel) hat drei
Mängel, die zusammen den Berichts-Renderer betreffen und daher in einem Zug
behoben werden.

### 1. Die Seite widerspricht sich selbst (Kernfehler)

Der Bericht mischt automatisch gemessene Zahlen mit **hand-gepflegten**
Einordnungen aus `scripts/project-state/assessment.js`. Diese Handtexte veralten,
sobald sich die gemessene Realität ändert — und tun es bereits: die Gate-Tabelle
zeigt `dependency-cruiser` als **bestanden** (läuft auf Node 24 durch), während
Gesamturteil und Befundliste denselben Cruiser weiterhin als „bricht ab / nicht
angelaufen" führen (Alttext aus der Node-25-Zeit, Verweis auf Issue 53). Die
Seite behauptet an einer Stelle das Gegenteil der anderen.

### Entscheidung: der Bericht wird vollständig dynamisch

Jeder angezeigte Inhalt leitet sich aus der **Live-Messung** ab; es gibt keinen
hand-gepflegten Text mehr, der veralten kann. Das entspricht dem Prinzip aus
ADR 0022 (Anzeige leitet sich aus der Quelle ab, schließt Drift strukturell aus).

- `scripts/project-state/assessment.js` und seine Test-Schwesterdatei entfallen
  ersatzlos.
- Das **Gesamturteil** wird aus den gemessenen Fakten erzeugt (z. B. Anzahl
  blockierender Gates grün, Anzahl nur-Hinweis-Befunde, Anzahl nicht angelaufener
  Gates), statt hand-formuliert zu sein.
- Die **Befunde** zeigen ausschließlich gemessene Rohzahlen, ohne Deutung,
  welche davon „Absicht" sind. (Bewusst gewählt: knip ist ein nur-Hinweis-Gate;
  seine Zahl erscheint ungedeutet.)
- Der depcruise-„bricht ab"-Text verschwindet damit von selbst. Ein *echter*
  künftiger Abbruch wird weiterhin live erkannt — das leistet die
  Drei-Zustands-Klassifikation in `gates.js` automatisch; die Handnotiz war dafür
  nie nötig.

### 2. Nicht mobil-tauglich

Die Seite reagiert nicht auf schmale Viewports. Sie muss auf einem Telefon ohne
horizontales Scrollen und ohne überlaufende Tabellen lesbar sein.

### 3. Issues zu lang, nicht ausklappbar

Der Issue-Bereich zeigt jeden offenen Vorgang mit vollem Text und wird dadurch
sehr lang. Stattdessen: eine **kompakte** Zeile je Vorgang (Titel, Status), die
sich für die Details (Beschreibung, Akzeptanzkriterien) **aufklappen** lässt.
Native `<details>`/`<summary>`-Elemente, damit die Seite weiterhin ohne
JavaScript auskommt (in sich geschlossen, kein Script — bestehende Vorgabe aus
Main-Issue 54).

## Technical Decisions

- **Betroffene Bereiche:** `scripts/project-state/renderReport.js` (Layout/CSS,
  Issue-Darstellung, Urteils-Erzeugung), `buildReportModel.js` (Urteil aus
  Messwerten statt aus `assessment.js`), `generate.js` (kein `assessment.js`-Import
  mehr); Entfernen von `assessment.js` + `assessment.test.js`. Kein Eingriff in
  die reinen Erhebungsmodule (`gates.js`, `coverage.js`, `functions.js`,
  `graph.js`, `issues.js`) und nicht in den Workflow.
- **Kein neues Laufzeit- oder Dev-Paket.** `<details>` ist nativ; das
  Urteil-Template ist reine Zeichenkettenlogik.
- **Reine Funktionen bleiben rein und getestet** (ADR 0006): das erzeugte Urteil
  und die Issue-Darstellung werden über ein reines Datenmodell getestet, ohne
  Datei-/Netzzugriff.

## Testing Decisions

- Die Tests von `renderReport` und `buildReportModel` werden angepasst: das
  Gesamturteil ist jetzt aus dem Modell abgeleitet (Testfall je Zustandsmix),
  die Issue-Darstellung nutzt `<details>` (Assertion auf kompakte Zeile +
  aufklappbaren Detailteil). Der Wegfall von `assessment.js` entfernt dessen
  Test.
- Regressionsprüfung, dass kein hand-gepflegter Text mehr im erzeugten HTML
  auftaucht (kein Pfad, der `assessment` referenziert).

## Out of Scope

- Der bereits behobene Node-Abbruch selbst (Issue 53) — hier wird nur der
  veraltete *Text darüber* entfernt.
- Verlauf/Trends, geschlossene Issues, Bau bei Pull Requests — bleibt wie in
  Main-Issue 54 abgegrenzt.
- Das claude.ai-Artifact (manuelle Momentaufnahme).

## Acceptance Criteria
- [ ] Der Bericht enthält keinen hand-gepflegten Text mehr; `assessment.js` und
      seine Testdatei sind entfernt, kein Modul importiert sie noch.
- [ ] Das Gesamturteil wird aus den gemessenen Fakten erzeugt und widerspricht
      der Gate-Tabelle nicht mehr (kein „bricht ab", wenn das Gate bestanden ist).
- [ ] Die Befunde zeigen gemessene Rohzahlen ohne hand-gepflegte Deutung.
- [ ] Ein echtes nicht-angelaufenes Gate wird weiterhin als „nicht angelaufen"
      dargestellt (live aus `gates.js`, nicht aus Handtext).
- [ ] Die Seite ist auf schmalem Viewport (~375 px) ohne horizontales Scrollen
      und ohne überlaufende Tabellen lesbar.
- [ ] Jeder offene Vorgang erscheint als kompakte Zeile (Titel, Status) und lässt
      die Details per `<details>`/`<summary>` aufklappen; die Seite kommt weiterhin
      ohne JavaScript und ohne externe Ressourcen aus.
- [ ] `npm run lint`, `npm run typecheck` und `npx vitest run` sind grün; der
      Generator läuft lokal durch und erzeugt eine HTML-Datei.

## Comments
- Berichts-Renderer voll dynamisch: assessment.js + Test entfernt; Gesamturteil in buildReportModel.deriveOverallAssessment aus gemessenen Gate-Zustaenden abgeleitet (kein Handtext, kein Widerspruch zur Gate-Tabelle). Seite mobil-tauglich (Tabellen in overflow-x-Containern, relative Einheiten, Media Query fuer schmale Viewports); offene Vorgaenge als native <details>/<summary> ohne JavaScript.
