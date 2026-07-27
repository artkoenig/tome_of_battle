Status: needs-triage
Type: refactor
Blocked by: None

## Description

Die Anwendung wertet Armeelisten heute ausschliesslich mit der alten Engine unter
`src/solver/` aus. ADR-0030 haelt fest, dass diese Engine nachweislich falsche
Ergebnisse liefert und ersetzt wird, und dass der Ersatz beschlossen ist:

> „Die neue Engine unter `src/evaluator/` wird mit dem erklaerten Ziel
> entwickelt, die alte vollstaendig zu ersetzen. Der produktive Cutover ist damit
> nicht mehr offen — er ist die beschlossene Richtung. Bis zum Cutover bleibt die
> App auf `src/solver/`, aber jede neue Arbeit dient dem Ersatz, nicht der
> Koexistenz."
> — ADR-0030, Abschnitt *Revision*, Punkt 3

Der Ausbau der neuen Engine ist mit Main-Issue 75 abgeschlossen. Was fehlt, ist
die Umstellung selbst. Sie war in Main-Issue 75 ausdruecklich ausgeklammert und
dort als unmittelbares Folge-Main-Issue benannt, war aber bisher **nicht als
Issue erfasst** — sie stand nur in Prosa in jener Out-of-Scope-Liste. Dieses
Issue schliesst diese Luecke im Rueckstand; es ist der Traeger des Cutovers.

Der Umfang, wie Main-Issue 75 ihn beschreibt:

> „den Adapter zwischen App-Roster und Engine-Roster bauen, die 22 Dateien der
> Oberflaeche auf den Bericht umstellen, die Projektion von Verletzungsart auf
> Meldungsschluessel anlegen, die anwendungsweiten Puppeteer-Tests aus dem
> Solver-Ordner umziehen und `src/solver/` samt seiner Testsuite loeschen."
> — Main-Issue 75, *Out of Scope*

Aus Nutzersicht ist das Ziel, dass die Anwendung Armeelisten richtig bewertet:
dieselben Rosters, die heute falsche oder fehlende Meldungen erzeugen, muessen
danach die Meldungen zeigen, die die Katalogdaten hergeben — und die Meldungen
muessen fuer den Nutzer verstaendlich bleiben, so wie sie es heute sind.

Dies ist ein grosser, riskanter Schnitt: er tauscht das Herz der Anwendung aus
und ist im Gegensatz zum Ausbau der Engine **nicht** ohne Wirkung auf den Nutzer.
Er braucht deshalb eine eigene Spezifikationsrunde, bevor er geschnitten wird —
insbesondere zu der Frage, was mit Armeelisten geschieht, die die neue Engine
strenger bewertet als die alte, und ob ein Rueckfallpfad vorgesehen wird.

Bekannte, noch offene Korrektheitsdefekte der neuen Engine liegen als eigene
Issues vor. Ob sie den Cutover blockieren oder danach behoben werden, gehoert in
die Triage dieses Issues.

## Acceptance Criteria
- [ ] (offen — zu spezifizieren; dieses Issue steht auf needs-triage)

## Decisions
- `[po]` Neu angelegt, weil dieses Main-Issue in der Prosa der Out-of-Scope-Liste von Main-Issue 75 als 'unmittelbares Folge-Main-Issue' benannt war, im Tracker aber nie erfasst wurde. Quelle: docs/issues/75-evaluator-fuer-den-cutover-ausbauen/issue.md, Abschnitt Out of Scope, sowie ADR-0030, Abschnitt Revision, Punkt 3. Beschreibung loesungsfrei aus diesen beiden Stellen verfasst. Bleibt bewusst auf needs-triage: der Cutover ist im Gegensatz zum Engine-Ausbau fuer den Nutzer wirksam, tauscht den Auswertungskern der Anwendung aus und braucht eine eigene Spezifikationsrunde. Er reitet nicht auf dem laufenden Branch mit.

## Comments
