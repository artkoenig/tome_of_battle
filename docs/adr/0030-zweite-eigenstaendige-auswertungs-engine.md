# Zweite, räumlich getrennte Auswertungs-Engine als Reinraum-Realisierung

- **Status:** Accepted — umgesetzt mit Issue 0121 (Cutover vollzogen, `src/solver/` gelöscht)
- **Datum:** 2026-07-25 (revidiert; ursprünglich 2026-07-24)
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** grenzt sich ab von ADR-0023 (Solver-Fassade
  als exklusive Schnittstelle) und ADR-0029 (Zentrale Query-Engine für
  Constraint-Auswertung); realisiert den Referenz-Entwurf in
  [`docs/evaluator-architecture.md`](../evaluator-architecture.md); respektiert
  ADR-0003 (Battlescribe Domain Rules) und ADR-0016 (vendored XSD).

> **Nachsatz (Issue 0121, 2026-07-30).** Der hier beschlossene Ersatz ist vollzogen:
> die Oberfläche liest ausschließlich den Bericht dieser Engine, und `src/solver/`
> ist gelöscht. Die verworfene Option 3 (dauerhafter Laufzeit-Umschalter) wurde
> nie gebaut — der Cutover war ein Schnitt. Was am Solver rein strukturell war
> (Selektions-Fabrik, Baum-Editing, Katalog-Auflösung, Roster-Abgleich), ist als
> App-Schreibmodell `src/domain/roster/` erhalten und in beide Richtungen von dieser
> Engine getrennt (blockierende Regeln in `.dependency-cruiser.cjs` und
> `.oxlintrc.json`).

## Revision (2026-07-25) — verbindliche Klarstellung

Diese ADR wurde neu formuliert, um jedes Missverständnis auszuräumen. Es gilt
ausdrücklich und ohne Ausnahme:

1. **Die alte Engine unter `src/solver/` ist fehlerhaft und nicht tragfähig.**
   Sie liefert nachweislich falsche Auswertungen und wird nicht mehr als
   Referenz für korrektes Verhalten behandelt.
2. **Ihr Code ist bei Auswertung, Analyse und Planung nicht zu beachten.** Weder
   Entwurf noch Spezifikation noch Fehlersuche dürfen sich auf `src/solver/`
   stützen oder es als Paritäts-Vorlage heranziehen. Grundlage für die neue
   Engine sind allein die BattleScribe-Daten (`.cat`/`.gst`/XSD, ADR-0003,
   ADR-0016) und ihr eigenes Reinraum-Modell.
3. **Die neue Engine unter `src/domain/evaluator/` wird mit dem erklärten Ziel
   entwickelt, die alte vollständig zu ersetzen.** Der produktive Cutover ist
   damit nicht mehr offen — er ist die beschlossene Richtung. Bis zum Cutover
   bleibt die App auf `src/solver/`, aber jede neue Arbeit dient dem Ersatz,
   nicht der Koexistenz.

Die Abschnitte unten sind im Licht dieser Revision zu lesen: Passagen, die die
Engine ursprünglich als reines, dauerhaft danebenstehendes Experiment
beschrieben, sind durch diese Klarstellung überschrieben.

## Kontext und Problemstellung

Die bisher produktive Regel-Engine liegt in rund zwanzig verzahnten Modulen unter
`src/solver/` hinter einer Fassade (ADR-0023). Sie hat sich als fehlerhaft und
nicht tragfähig erwiesen; ihr Verhalten ist keine verlässliche Grundlage mehr.
Parallel beschrieb ADR-0029 einen In-Solver-Umbau zu einer zentralen Query-Engine
und verwies auf eine unabhängige Reinraum-Bestätigung durch einen externen
Architekten. Dieser Reinraum-Entwurf (jetzt als `docs/evaluator-architecture.md`
gesichert) geht in zwei Punkten bewusst über ADR-0029 hinaus: er stützt sich auf
eine **Fixpunktschleife** (Iteration bis Konvergenz mit harter Rundenobergrenze)
und auf synthetische **Phantomknoten** als Auswertungsanker — beides hat ADR-0029
§6 als YAGNI *weggelassen*.

Aus dem ursprünglichen Wunsch, diesen vollen Reinraum-Entwurf zunächst
gefahrlos neben der Produktion zu erproben, ist die verbindliche Richtung
geworden, ihn zur **einzigen** produktiven Engine auszubauen und `src/solver/`
abzulösen.

## Entscheidungsfaktoren (Drivers)

- **Korrektheit vor Kontinuität:** die alte Engine ist fehlerhaft; eine korrekte,
  von Grund auf sauber modellierte Engine hat Vorrang vor dem Erhalt des
  bestehenden Codes.
- **Keine Kontamination durch fehlerhaften Code:** Entwurf und Analyse der neuen
  Engine dürfen sich nicht am fehlerhaften Solver orientieren — sonst erbt die
  neue Engine dessen Fehler.
- **Echter Reinraum:** der Entwurf soll unverfälscht realisierbar sein, inklusive
  der Teile, die ADR-0029 verworfen hat.
- **Erosionsfeste Trennung:** die Isolation gegen `src/solver/` muss maschinell
  greifen, nicht auf Disziplin beruhen (analog zur Durchsetzungslogik von
  ADR-0023).
- **Wahrhaftigkeit der Doku:** ein künftiger Leser muss ohne Kontext erkennen,
  dass `src/domain/evaluator/` der designierte Nachfolger ist und `src/solver/` die
  abzulösende, fehlerhafte Alt-Engine.

## Betrachtete Optionen

- **Option 1 — In `src/solver/` integrieren / ADR-0029 ablösen.** Den vollen
  Entwurf in den bestehenden Code setzen. Verworfen: erbt die Fehler und die
  Verflechtung der fehlerhaften Alt-Engine, statt sauber neu aufzusetzen.
- **Option 2 — Eigene, isolierte Engine `src/domain/evaluator/` als Nachfolger.** Ein zu
  `src/solver/` paralleler Top-Level-Ordner mit eigener Fassade, eigenem Parser,
  eigenem Datenmodell und eigenem Report; harte Import-Isolation gegen
  `src/solver/` in beide Richtungen; von außen nur über die eigene Fassade.
  Zunächst noch nicht in den App-Pfad verdrahtet, aber mit dem Ziel entwickelt,
  die alte Engine zu ersetzen.
- **Option 3 — Vergleichs-Harness / dauerhafter Laufzeit-Umschalter.** Beide
  Engines dauerhaft nebeneinander laufen lassen. Verworfen: die alte Engine ist
  fehlerhaft und soll verschwinden, nicht dauerhaft mitlaufen.

## Entscheidungsergebnis

Gewählte Option: **Option 2.** Die neue Engine lebt in `src/domain/evaluator/`,
Geschwister zu `src/solver/`, nicht darin, und wird zum **Nachfolger** ausgebaut.
`src/domain/evaluator/` bekommt eine **eigene Fassade** als einzige legale
Außenschnittstelle (das Fassaden-Muster aus ADR-0023, auf die neue Engine
gespiegelt). Neue, maschinell geprüfte Regeln (`.oxlintrc.json`,
`.dependency-cruiser.cjs`, ADR-0024) trennen die beiden Engines **hart in beide
Richtungen**: `src/domain/evaluator/` importiert nie aus `src/solver/` und umgekehrt.
Diese Trennung schützt die neue Engine ausdrücklich davor, sich auf den
fehlerhaften Alt-Code zu stützen. Import aus `src/data/parser/` bleibt erlaubt — der
Evaluator liest jedoch entpacktes `.cat`/`.gst`-XML **mit eigenem Parser**
(Resolver-Umfang: IDs/Importe/Link-Ketten/Dokumentreihenfolge → aufgelöste
Definitionen; **ohne** ZIP-Entpacken, XSD-Gate, Katalog-Editor — das bleibt
Import-Pipeline).

**Bewusste Abweichung von ADR-0029:** Die Engine **baut** die Fixpunktschleife
(Konvergenz, `MAX_FIXPOINT_ROUNDS`, Nichtkonvergenz-Diagnose) und die
Phantomknoten. Das ist kein Widerspruch, sondern der Zweck: die neue Engine
realisiert den vollen Entwurf als Robustheitsgarantie (Zyklen werden *sichtbar*
statt still falsch).

**Analyse- und Planungsregel (verbindlich):** Bei jeder Auswertung, jedem Entwurf
und jeder Fehlersuche für `src/domain/evaluator/` bleibt `src/solver/` außen vor. Sein
Verhalten ist kein Sollwert, sein Code keine Vorlage. Korrektes Verhalten wird
ausschließlich aus den BattleScribe-Daten und dem Reinraum-Modell abgeleitet.

### Konsequenzen (Auswirkungen)

- **Positiv:** die neue Engine wird von Grund auf korrekt modelliert, ohne die
  Fehler der Alt-Engine zu erben; die Trennung erodiert nicht still.
- **Positiv:** ein künftiger Leser findet in dieser ADR die Erklärung, warum es
  zwei Engines gibt, welche davon der fehlerhafte Vorgänger ist und welche der
  Nachfolger — statt es für einen Fehler zu halten und „aufzuräumen".
- **Negativ:** bewusst in Kauf genommene Duplikation (eigener Parser, eigenes
  Datenmodell, eigene Fixtures) als Preis des echten Reinraums — vorübergehend,
  bis `src/solver/` abgelöst und entfernt ist.
- **Negativ:** `src/domain/evaluator/` ist bis zum Cutover im App-Bundle toter Code
  (getreeshaked); die `no-orphans`-Regel muss den nur test-importierten Zustand
  solange tolerieren.
- **Richtung (nicht mehr offen):** der produktive Cutover — `src/domain/evaluator/`
  ersetzt `src/solver/` — ist das erklärte Ziel dieser Entwicklung. Der Zeitpunkt
  und die schrittweise Verdrahtung sind noch zu planen; das *Ob* nicht mehr.

**Umsetzungsstand und bewusste Grenzen (Issue 65 ff.).** Die Engine ist
vollständig gebaut (Resolver, Join/Phantomknoten, Index, Query-Primitiv,
Modifikatoren mit Fixpunkt, Constraints, Bericht inkl. Fähigkeitsdatensatz) und
mit eigener Testsuite plus eigenen, an der Definitive Edition (WHFB6)
modellierten Fixtures abgedeckt. Auf dem Weg zum vollständigen Ersatz sind
weitere Lücken zu schließen, ehrlich dokumentiert statt vorgetäuscht:
(1) der eigene Parser las anfangs für Bedingungen/Modifikatoren ein **eigenes**
Vokabular statt der rohen BattleScribe-Attribute (**diese Grenze schließt
ADR-0031**: der Evaluator liest inzwischen die kanonische XSD-Syntax und teilt
die Enum-SSOT aus `src/data/parser/schema/`); (2) es wird ein **Einzelkatalog**
gelesen — katalogübergreifende Importe/Link-Ketten und die Inkrementalisierung
(Architektur §4.9) sind vorgemerkte Zukunft; (3) die eingestellte
Roster-Punktgrenze (`limit::<costTypeId>` / `costLimit`/`costLimitType`) fließt
seit Issue 70 in die Auswertung ein: die Engine nimmt das vollständige Roster
inkl. Kostengrenzen entgegen, löst `limit::<costTypeId>` aus dem Roster-Budget
auf (budget-gesteuerte Bedingungen/Modifikatoren wie budgetabhängige
Helden-/Lord-Slots) und meldet Budget-Überschreitungen. Offen für den produktiven
Ersatz bleibt allein der Cutover — die App auf die Engine zu verdrahten. (Bekannte
Grenze außerhalb dieses Umfangs: die Sichtbarkeit einer *Kategorie* wird noch nicht
als Verfügbarkeit im Bericht abgebildet — Kategorie-Knoten sind keine Auswahl-Slots.)
