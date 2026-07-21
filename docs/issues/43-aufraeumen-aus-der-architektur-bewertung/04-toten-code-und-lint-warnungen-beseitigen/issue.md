Status: resolved
Type: refactor
Blocked by: [01, 02, 03]

## Description

**Geruch:** Toter Code und abgestumpftes Werkzeug. `npm run lint` meldet
**0 Fehler, aber 57 Warnungen**. Warnungen, die niemand mehr liest, verlieren
ihre Funktion als Signal: die 58. Warnung — die echte — fällt dann nicht mehr
auf. Entweder die Befunde werden behoben, oder die jeweilige Regel wird für
ihren Geltungsbereich bewusst und begründet abgeschaltet; ein Dauerzustand
dazwischen ist die schlechteste Variante.

### Nachweislich toter Code

- **Unerreichbarer Toast im Roster-Editor.** Ein Zustandspaar wird angelegt,
  dessen Setter nie aufgerufen wird — der zugehörige Toast-Block im JSX kann
  daher nie rendern. App-weite Toasts laufen längst über die Wurzelkomponente
  (ADR 0010). Zustand und Block gehören ersatzlos entfernt.
- **`if`-Block mit ausschließlich Kommentaren im Rumpf** im Roster-Editor:
  eine Bedingung wird ausgewertet, deren Zweig nichts tut. Der Kommentar
  beschreibt eine Absicht, die der Code nicht umsetzt — beides klären und
  entfernen.
- **Ungenutzte Props am Heerlager-Dashboard.** Zwei Installations-Props werden
  von der Wurzelkomponente übergeben, aber nicht verwendet; die Installation
  wird tatsächlich in der Kopfleiste angeboten. Prop und Übergabe entfallen.
- **Ungenutzter Keyword-Import** in der Regel-Auswertung.

### Warnungs-Aufkommen

Rund 35 der 57 Warnungen liegen in Testdateien (ungenutzte Importe und
Parameter aus Mock-Signaturen). Sie sind harmlos, aber genau deshalb das
eigentliche Rauschen. Für Mock-Parameter, die eine Signatur erfüllen müssen und
absichtlich ungenutzt bleiben, ist die vom Linter selbst vorgeschlagene
Unterstrich-Konvention der richtige Weg.

Zusätzlich unterdrückt ein Modal-Dialog die Abhängigkeitsprüfung eines Effekts
**ohne Begründungskommentar**. Eine Unterdrückung ohne Begründung ist nicht
nachprüfbar: entweder die Abhängigkeit ergänzen oder in einem Satz festhalten,
warum sie hier falsch wäre.

**Abgrenzung:** Die überlangen Funktionen in der Regel-Auswertung sind **nicht**
Teil dieses Issues. Kind-Issue 01 löscht sie ersatzlos mitsamt den zugehörigen
Schlüsselwort-Listen und dem ungenutzten Import — deshalb ist dieses Issue durch
`Blocked by: [01, 02, 03]` ans Ende gestellt: es kehrt auf, was die drei
vorangehenden Scheiben übrig lassen, statt Warnungen zu beheben, die mit ihnen
ohnehin verschwinden.

### Nachträge (nach Merge von 01–03 ergänzt)

Der Stand nach den drei vorangehenden Scheiben ist **0 Fehler, 56 Warnungen**;
der Toast, der leere `if`-Zweig und der Keyword-Import sind bereits dort
entfernt worden. Zusätzlich freigegeben wurde:

- **Tote CSS-Klassen.** `.roster-header-editor` (samt Mobile-Overrides) und
  `.roster-editor-points` haben nach dem Merge von Kind-Issue 02 keine
  Verwendung mehr im JSX und entfallen.
- **`vitest` sammelt Worktree-Kopien mit.** Agenten-Worktrees liegen unter
  `.claude/worktrees/` innerhalb des Repos, die Projektkonvention sieht
  zusätzlich `.worktrees/` vor. Ohne Ausschluss zählt jeder Lauf im
  Hauptcheckout die Testdateien aller offenen Worktrees mit (gemessen 2729
  statt 1036 Tests), womit jede Testzahl bei paralleler Arbeit wertlos wird.
  Beide Muster gehören in das `exclude`-Array von `vitest.config.js`.
- **JSX-IIFEs in `src/components/editor/RosterSidebar.jsx`** (Zeilen 52, 77,
  106) — dieselbe Art Befund, die Kind-Issue 02 in `RosterEditor.jsx` behoben
  hat: sofort aufgerufene Funktionsausdrücke sind Funktionen ohne Namen. Sie
  werden zu benannten Funktionen bzw. kleinen Komponenten gehoben, im Schnitt
  von `CategoryCountBadge.jsx`/`RosterValidationPanel.jsx`. Reines
  Refactoring: Verhalten, Markup und Klassennamen bleiben identisch,
  `RosterSidebar.test.jsx` bleibt unverändert grün.

## Acceptance Criteria
- [ ] `npm run lint` meldet 0 Fehler **und** 0 Warnungen.
- [ ] Jede Regel, die statt einer Behebung abgeschaltet wurde, ist in der
      Lint-Konfiguration auf ihren Geltungsbereich begrenzt und mit einer
      Begründung versehen.
- [ ] Jede verbleibende Inline-Unterdrückung trägt einen Kommentar, der sie
      begründet.
- [ ] Der unerreichbare Toast, der leere `if`-Zweig, die ungenutzten
      Dashboard-Props und der ungenutzte Import sind entfernt.
- [ ] `npm test` ist grün; die Testanzahl ist nicht gesunken.

## Comments
- 56 Lint-Warnungen auf 0 gebracht: toter Code entfernt (PlayMode-Suchfilter samt Zustand, ungenutzte Importe/Props, tote CSS-Klassen, costTypeLabel-Prop-Kette bis OptionGroup, Debug-Skript-Helfer), Mock-Signatur-Parameter auf _-Konvention umgestellt, react/only-export-components fuer src/contexts/** begruendet begrenzt, beide exhaustive-deps-Unterdrueckungen (NewRosterModal, Importer) mit Begruendung versehen. Nachtraege: vitest.config.js schliesst .claude/** und .worktrees/** aus (empirisch belegt), die drei JSX-IIFEs in RosterSidebar.jsx sind zu benannten Funktionen/Komponenten gehoben.
