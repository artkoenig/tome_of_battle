# Die Solver-Fassade ist die exklusive Schnittstelle zur Regel-Engine

- **Status:** Accepted
- **Datum:** 2026-07-21
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** ergänzt ADR-0003 (Battlescribe Domain Rules), berührt ADR-0006 (Testing and Automation)

## Kontext und Problemstellung

Die Regel-Engine der Anwendung liegt in rund zwanzig Modulen unter `src/solver/`.
`src/solver/validator.js` trug seit jeher einen Kopfkommentar, der sich als
alleinige Schnittstelle dieser Schicht bezeichnete — Komponenten und Hooks
sollten den Solver ausschließlich über diese Fassade ansprechen.

Die Gesamtbewertung der Anwendung (Issue 39) förderte zutage, dass dieser
Anspruch unwahr war: **zwölf Stellen** in Komponenten und Hooks importierten an
der Fassade vorbei direkt aus fünf Fachmodulen (`optionsCollector`,
`rulesEvaluator`, `constants`, `systemQuirks`, `selectionFactory`). Der
Kopfkommentar beschrieb damit einen Wunsch, kein Faktum — und da nichts die
Regel prüfte, wuchs die Zahl der Umgehungen mit jeder Änderung still weiter.

Ein Anspruch, den nichts durchsetzt, ist schlimmer als gar kein Anspruch: er
erzeugt bei jedem Leser des Kommentars ein falsches Bild der tatsächlichen
Abhängigkeiten.

## Entscheidungsfaktoren (Drivers)

- **Wahrhaftigkeit der Dokumentation** — der Code darf nicht behaupten, was er
  nicht einhält.
- **Wartbarkeit** — eine Schicht, deren Grenze frei durchlässig ist, kann nicht
  unabhängig umgebaut werden; jede Änderung an einem Fachmodul wird potenziell
  zur Shotgun Surgery über die Oberfläche.
- **Erosionsfestigkeit** — die Regel muss maschinell greifen, nicht auf
  Aufmerksamkeit beim Review beruhen.
- **Angemessenheit** — eine Fassade, die Namen durchreicht, die niemand braucht,
  wäre spekulative Verallgemeinerung (YAGNI).

## Betrachtete Optionen

- **Option 1: Anspruch aufgeben.** Den Kopfkommentar streichen und den direkten
  Zugriff auf die Fachmodule als legitim erklären. `validator.js` wäre dann eine
  Bequemlichkeits-Sammlung, keine Schicht.
- **Option 2: Fassade durchsetzen.** Die zwölf Umgehungen auf die Fassade
  umstellen, die fehlenden Namen dort re-exportieren und die Regel durch eine
  Lint-Regel maschinell verankern.

## Entscheidungsergebnis

Gewählte Option: **Option 2 — Fassade durchsetzen**, weil die Prüfung der zwölf
Umgehungen ergab, dass **keine einzige** auf echte Interna zugriff. Alle holten
sich Namen, welche die Fassade ebenso gut tragen kann. Die Umgehungen waren
folglich kein Hinweis auf eine unpassende Schicht, sondern schlichte
Nachlässigkeit. Den Anspruch aufzugeben hätte eine intakte Schichtung geopfert,
um Nachlässigkeit nachträglich zu legitimieren.

Die Fassade re-exportierte bereits fünfzehn Geschwistermodule; die fünf
hinzugekommenen vervollständigen das bestehende Muster, statt es zu überdehnen.
Ergänzt wurden ausschließlich die fünfzehn Namen, die tatsächlich verwendet
werden — nicht die vollständige Oberfläche der fünf Module.

Verankert ist die Regel über `no-restricted-imports` in `.oxlintrc.json`. Ihre
Wirksamkeit wurde durch eine absichtlich eingepflanzte Verletzung nachgewiesen:
eine Lint-Regel, die nur grün durchläuft und nie beim Fehlschlagen beobachtet
wurde, belegt nichts.

**Testdateien sind ausgenommen.** Sie mocken einzelne Nahtstellen der Engine und
müssen dafür das jeweilige Fachmodul benennen können. Diese Ausnahme steht
sowohl in der Lint-Konfiguration als auch im Kopfkommentar der Fassade, damit
dieser weiterhin den tatsächlichen Zustand beschreibt.

### Konsequenzen (Auswirkungen)

- **Positiv:** Die Abhängigkeiten der Oberfläche zur Regel-Engine verlaufen
  nachweislich über genau eine Datei. Ein Fachmodul kann umbenannt, geteilt oder
  ersetzt werden, ohne dass Komponenten davon berührt werden. Der Kopfkommentar
  der Fassade ist erstmals wahr.
- **Positiv:** Die Regel erodiert nicht mehr still — ein Verstoß bricht den
  Lint-Lauf. Dies bewährte sich unmittelbar: beim Zusammenführen der
  Geschwister-Issues importierte ein frisch entstandenes Solver-Modul direkt in
  einen Hook, was die Regel prompt abfing.
- **Negativ:** Ein neues Solver-Modul, dessen Namen die Oberfläche braucht,
  erfordert einen zusätzlichen Handgriff — den Re-Export in der Fassade. Der
  Lint-Fehler weist mit seiner Meldung explizit darauf hin.
- **Negativ:** Die Fassade wächst mit der Oberfläche der Engine. Sollte sie
  eines Tages den Großteil aller Solver-Namen durchreichen, wäre das ein Anlass,
  die Schichtung neu zu bewerten — nicht, die Regel aufzuweichen.
- **Neutral:** Tests umgehen die Fassade weiterhin bewusst. Sie prüfen die
  Fachmodule direkt, was der Schnittweise der Testdateien entspricht
  (siehe ADR-0006).

## Vor- und Nachteile der Optionen

### Option 1 — Anspruch aufgeben

- **Gut, weil** der dokumentierte Zustand ohne jede Codeänderung sofort wahr
  gewesen wäre.
- **Gut, weil** neue Solver-Module keinen zusätzlichen Handgriff erfordert
  hätten.
- **Schlecht, weil** die Schicht damit ersatzlos entfallen wäre — obwohl kein
  einziger Aufrufer sie tatsächlich gesprengt hatte.
- **Schlecht, weil** jede spätere Umstrukturierung der Engine wieder die
  Oberfläche mit anfasst.

### Option 2 — Fassade durchsetzen

- **Gut, weil** die Schichtgrenze belegbar statt behauptet ist.
- **Gut, weil** die Durchsetzung maschinell erfolgt und nicht von der
  Aufmerksamkeit des Prüfers abhängt.
- **Gut, weil** der Aufwand gering war: keine Umgehung benötigte echte Interna.
- **Schlecht, weil** die Fassade eine zusätzliche, mitzupflegende Datei ist.
