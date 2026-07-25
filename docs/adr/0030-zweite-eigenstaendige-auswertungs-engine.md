# Zweite, räumlich getrennte Auswertungs-Engine als Reinraum-Realisierung

- **Status:** Accepted
- **Datum:** 2026-07-24
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** grenzt sich ab von ADR-0023 (Solver-Fassade
  als exklusive Schnittstelle) und ADR-0029 (Zentrale Query-Engine für
  Constraint-Auswertung); realisiert den Referenz-Entwurf in
  [`docs/evaluator-architecture.md`](../evaluator-architecture.md); respektiert
  ADR-0003 (Battlescribe Domain Rules) und ADR-0016 (vendored XSD).

## Kontext und Problemstellung

Die produktive Regel-Engine liegt in rund zwanzig verzahnten Modulen unter
`src/solver/` hinter einer Fassade (ADR-0023). Parallel beschreibt ADR-0029 den
laufenden In-Solver-Umbau zu einer zentralen Query-Engine — und verweist auf eine
unabhängige Reinraum-Bestätigung durch einen externen Architekten. Dieser
Reinraum-Entwurf (jetzt als `docs/evaluator-architecture.md` gesichert) geht in
zwei Punkten bewusst über ADR-0029 hinaus: er stützt sich auf eine
**Fixpunktschleife** (Iteration bis Konvergenz mit harter Rundenobergrenze) und
auf synthetische **Phantomknoten** als Auswertungsanker — beides hat ADR-0029 §6
als YAGNI *weggelassen*, weil kein realer Katalog es heute erzwingt.

Der Wunsch ist, diesen vollen Reinraum-Entwurf als eigenständige Engine zu
erproben, **ohne** die produktive Engine oder den ADR-0029-Pfad anzufassen —
gleichzeitig existierend und räumlich getrennt.

## Entscheidungsfaktoren (Drivers)

- **Risikofreiheit für die Produktion:** die laufende App und der ADR-0029-Umbau
  dürfen durch das Experiment nicht berührt werden.
- **Echter Reinraum:** der Entwurf soll unverfälscht realisierbar sein, inklusive
  der Teile, die ADR-0029 verworfen hat — sonst verliert der Vergleich seinen Wert.
- **Erosionsfeste Trennung:** „räumlich getrennt" muss maschinell greifen, nicht
  auf Disziplin beruhen (analog zur Durchsetzungslogik von ADR-0023).
- **Wahrhaftigkeit der Doku:** eine zweite Engine neben der per ADR-0023 als „die
  eine" deklarierten Fassade würde einen künftigen Leser ohne Kontext verwirren.

## Betrachtete Optionen

- **Option 1 — In `src/solver/` integrieren / ADR-0029 ablösen.** Den vollen
  Entwurf an die Stelle des laufenden Umbaus setzen. Verworfen: berührt die
  Produktion direkt, macht den Vergleich unmöglich, entwertet die schon gebaute
  Query-Engine.
- **Option 2 — Eigene, isolierte Engine `src/evaluator/`.** Ein zu `src/solver/`
  paralleler Top-Level-Ordner mit eigener Fassade, eigenem Parser, eigenem
  Datenmodell und eigenem Report; harte Import-Isolation gegen `src/solver/` in
  beide Richtungen; von außen nur über die eigene Fassade. Reine Bibliothek, nicht
  in den App-Pfad verdrahtet.
- **Option 3 — Vergleichs-Harness / Laufzeit-Umschalter.** Beide Engines zur
  Laufzeit gegeneinander laufen lassen. Verworfen als aktueller Umfang: bindet die
  neue Engine an den Produktivpfad, den sie gerade *nicht* berühren soll.

## Entscheidungsergebnis

Gewählte Option: **Option 2.** Die neue Engine lebt in `src/evaluator/`,
Geschwister zu `src/solver/`, nicht darin — `src/solver/` bleibt per ADR-0023 „die
eine" produktive Engine. `src/evaluator/` bekommt eine **eigene Fassade** als
einzige legale Außenschnittstelle (das Fassaden-Muster aus ADR-0023, auf die
zweite Engine gespiegelt). Neue, maschinell geprüfte Regeln (`.oxlintrc.json`,
`.dependency-cruiser.cjs`, ADR-0024) trennen die beiden Engines **hart in beide
Richtungen**: `src/evaluator/` importiert nie aus `src/solver/` und umgekehrt.
Import aus `src/parser/` bleibt erlaubt — der Evaluator liest jedoch entpacktes
`.cat`/`.gst`-XML **mit eigenem Parser** (Resolver-Umfang: IDs/Importe/Link-Ketten/
Dokumentreihenfolge → aufgelöste Definitionen; **ohne** ZIP-Entpacken, XSD-Gate,
Katalog-Editor — das bleibt Import-Pipeline).

**Bewusste Abweichung von ADR-0029:** Die Engine **baut** die Fixpunktschleife
(Konvergenz, `MAX_FIXPOINT_ROUNDS`, Nichtkonvergenz-Diagnose) und die
Phantomknoten. Das ist kein Widerspruch, sondern der Zweck: ADR-0029 ließ beides
für die produktive Engine aus YAGNI-Gründen weg; diese separate Engine existiert
gerade, um den vollen Entwurf als Robustheitsgarantie (Zyklen werden *sichtbar*
statt still falsch) zu realisieren.

### Konsequenzen (Auswirkungen)

- **Positiv:** die Produktion und der ADR-0029-Umbau bleiben unberührt; der volle
  Reinraum-Entwurf ist eigenständig prüfbar; die Trennung erodiert nicht still.
- **Positiv:** ein künftiger Leser findet in dieser ADR die Erklärung, warum es
  eine zweite Engine gibt und warum sie eine von ADR-0029 verworfene Schleife
  trägt — statt es für einen Fehler zu halten und „aufzuräumen".
- **Negativ:** bewusst in Kauf genommene Duplikation (eigener Parser, eigenes
  Datenmodell, eigene Fixtures) als Preis des echten Reinraums.
- **Negativ:** `src/evaluator/` ist zunächst im App-Bundle toter Code (getreeshaked);
  die `no-orphans`-Regel muss den nur test-importierten Zustand tolerieren.
- **Neutral:** über einen späteren produktiven Cutover ist hier **nichts**
  entschieden — der wäre eine eigene, nutzer-sichtbare `feature`-Entscheidung.

**Umsetzungsstand und bewusste Grenzen (Issue 65).** Die Engine ist vollständig
gebaut (Resolver, Join/Phantomknoten, Index, Query-Primitiv, Modifikatoren mit
Fixpunkt, Constraints, Bericht inkl. Fähigkeitsdatensatz) und mit eigener
Testsuite plus eigenen, an der Definitive Edition (WHFB6) modellierten Fixtures
abgedeckt. Bewusst offen geblieben, ehrlich dokumentiert statt vorgetäuscht:
(1) der eigene Parser liest für Bedingungen/Modifikatoren das **eigene** Vokabular
(`op`/`operation`/`targetKind`) statt der rohen BattleScribe-Attribute (`type`) —
ein realer `.cat`-Smoke-Test übt daher nur Grenzen aus, echte Bedingungen/
Modifikatoren erscheinen als Diagnosen (**diese Grenze wird von ADR-0031
geschlossen**: der Evaluator liest inzwischen die kanonische XSD-Syntax und teilt
die Enum-SSOT aus `src/parser/schema/`); (2) es wird ein **Einzelkatalog** gelesen —
katalogübergreifende Importe/Link-Ketten und die Inkrementalisierung
(Architektur §4.9) sind vorgemerkte Zukunft.
