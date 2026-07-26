# Zentrale Query-Engine für Constraint-, Condition- und Repeat-Auswertung

- **Status:** Proposed
- **Datum:** 2026-07-24
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** Schreibt ADR-0022 (UI-Verfügbarkeit
  leitet sich aus dem Validator ab) fort und weitet ihr Prinzip auf **alle**
  Constraint-Entscheidungen der Oberfläche aus; setzt ADR-0003 (Battlescribe
  Domain Rules) um; respektiert ADR-0023 (Solver-Fassade als exklusive
  Schnittstelle) und ADR-0027 (Validierungs-Ursachen am Fehlerobjekt).

## Kontext und Problemstellung

Die Auswertung von BSData-Regeln — Grenzen (Constraints), Bedingungen
(Conditions) und Wiederholungen (Repeats) — ist über den Solver verstreut. Die
harten Teilprobleme *Schwellenwert* (`getModifiedConstraintValue`),
*Kostensumme* (`getSelectionTotalCost`) und *Aushebe-Verfügbarkeit*
(`entryAvailability` als Validator-Diff, ADR-0022) sind bereits zentralisiert.
Die **Auflösung des Bezugsrahmens** einer Query — „welche Selektionen zählt
dieser Scope?" — ist es nicht: sie existiert in fünf unabhängigen
Implementierungen, und der `parent`-Baumlauf ist viermal ausgeschrieben.

Dieselbe Frage wird dabei **strukturell verschieden** beantwortet: teils über
einen vorberechneten Count-Index, teils über einen Live-Baumlauf. Bei
Prozent-Grenzen speisen sich Zähler und Nenner sogar aus verschiedenen dieser
Engines. Zwei „ist Selektion eine Instanz des Ziels?"-Matcher stehen
nebeneinander. Und die Oberfläche baut mehrere dieser Entscheidungen
(radio-vs-checkbox, „Pflicht", „wie viele noch erlaubt", effektives
Kategorie-Max) ein zweites Mal von Hand nach — an mehreren Stellen und teils
inkonsistent zueinander.

Der gemeinsame Nenner der Daten ist eindeutig: Constraint, Condition und Repeat
sind im XSD **dieselbe `QueryBase`** — sie teilen `field`/`scope`/`value`/
`shared`/`includeChildSelections`/`childId` und unterscheiden sich nur darin,
was mit dem gezählten Wert geschieht. Das Roster ist ein sauberer, einwurzeliger
Baum, und ein generisches, Vorfahren-tragendes Traversal existiert bereits. Die
Fragmentierung ist also nicht durch die Daten erzwungen, sondern historisch
gewachsen.

## Entscheidungsfaktoren (Drivers)

- **Single Source of Truth:** eine Frage („zählt dieser Scope diese Selektion?")
  darf genau eine Antwortstelle haben — sonst driftet die Auswertung.
- **Format-Korrektheit:** maßgeblich ist die BSData-Semantik (Datenformat-Doku
  §7.6/§7.7, vendored XSD nach ADR-0016), nicht die Deckung mit heutigem
  Ist-Verhalten.
- **System-Agnostik (ADR-0003):** keine armee- oder spielspezifische Sonderlogik.
- **Erklärbarkeit:** die Auswertung muss menschenlesbare Gründe/Ursachen (ADR-0027)
  von selbst liefern.
- **Angemessene Performance (ADR-0005):** interaktive Neubewertung nach jeder
  Nutzeraktion, ohne den Aushebe-Dialog spürbar zu bremsen.

## Betrachtete Optionen

- **Option 1 — Status quo lassen, punktuell härten:** die fünf Resolver behalten,
  einzelne Divergenzen (Prozent) von Hand angleichen.
- **Option 2 — Zentrale Query-Engine:** ein einziges Zähl-Primitiv trägt alle
  drei Query-Arten und alle Bezugsrahmen; Validierung *und* Oberfläche lesen aus
  einem gemeinsamen Ergebnis.
- **Option 3 — Regeln auf einen SAT/CSP-Solver kompilieren:** Gültigkeit als
  Erfüllbarkeitsproblem lösen.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Zentrale Query-Engine)**, weil sie die einzige ist,
die die eigentliche Ursache — mehrere parallele Scope-Auflösungen — beseitigt,
statt sie zu verwalten. Option 1 zementiert die Divergenz; Option 3 passt nicht
zu Daten, die zählen/schwellwerten und imperative, reihenfolgesensitive
Modifikatoren tragen, und verschlechtert Erklärbarkeit und Determinismus.

Die Engine ist eine **reine Funktion** `(Instanzbaum, Katalog-Graph) →
Ergebnis` ohne verborgenen Zustand. Ihr Aufbau:

1. **Auswertungs-Kontext (Vorlauf, einmal je System/Liste, memoisiert).** Ein
   read-only Index löst IDs im Katalog-Kontext auf (Vergleich gegen aufgelöste
   **Ziel-IDs**, nicht Verweis-IDs) und hält die listenweiten Zähltabellen. Er
   macht die faktische Zweiphasigkeit (erst Index, dann Lauf) zu einem benannten
   Vertrag statt zu implizitem Wissen jeder Aufrufstelle.

2. **Ein Zähl-Primitiv, scope-agnostisch.** Der Rechenkern bekommt den zu
   prüfenden Bereich als **Parameter** (einen aufgelösten Anker) und zählt/
   summiert darüber, ohne die Scope-Schlüsselwörter selbst zu kennen. Die einzige
   Stelle, die die geschlossene Scope-Liste kennt, ist ein kleiner Resolver *vor*
   dem Kern, der ein Scope-Token auf einen Anker abbildet: `roster`/`force`/`parent`
   erhalten je einen eigenen Anker-Zweig; `self` sowie eine Eintrags-/Kategorie-ID
   teilen sich den Instanz-/Eintrags-Anker (`self` = die eine tragende Instanz,
   deckungsgleich mit dem bisherigen Verhalten). Der `parent`-Lauf existiert danach
   einmal. Der Kern liefert ein **reiches Ergebnis** (`{ Wert, gezählte
   Selektionen, Ursachen }`), aus dem die Ursachen nach ADR-0027 direkt folgen.

   **Zähl-Frame nach Ziel-Typ (nicht nach Query-Art).** Der `force`-Zweig
   entscheidet den Bezugsrahmen am **Ziel-Typ**: ein **Eintrags**-Ziel zählt pro
   Kontingent (`forceSelectionCounts[force.id]`), ein **Kategorie**-Ziel dagegen
   **armeeweit** über alle Forces aggregiert (`isCategoryTargetId` →
   `selectionCounts`); `roster` zählt immer armeeweit. Das gilt **einheitlich für
   Constraint, Condition und Repeat** — die XSD (`QueryBase`) gibt für eine
   Unterscheidung nach Query-Art nichts her, also ist der Ziel-Typ maßgeblich. Die
   §7.7-Domänenregel („Kategorie-Zähler über alle Forces aggregiert") ist damit an
   genau dieser einen Stelle kodiert. Bei Ein-Force-Rostern (der Regelfall der App)
   sind beide Frames identisch; die Unterscheidung wirkt nur auf Multi-Force-Roster.
   Diese Vereinheitlichung — Conditions, Repeats *und* der Profil-Statwert-Pfad
   (`profileCollector`) laufen jetzt über denselben `resolveScopeAnchor` und
   denselben Repeat-Zähler statt über eigene Inline-Auflösungen — wurde in Issue 63,
   Slices 06/07 nachgezogen.

3. **Drei dünne Adapter.** Grenze = Wert gegen (modifier-angepassten)
   Schwellenwert; Bedingung = Wert per Komparator gegen einen Vergleichswert →
   Wahrheitswert; Wiederholung = Wert ganzzahlig durch den Wert geteilt. Der
   Schwellenwert bleibt `getModifiedConstraintValue` (einzige Quelle);
   Modifikatoren wirken als geordneter Fold in Dokumentreihenfolge (ADR-0003).
   Der Prozent-Nenner läuft durch dasselbe Primitiv — Zähler/Nenner-Divergenz
   entfällt.

4. **Zählung über den Kern, Pflicht-Absenz definitionsseitig.** Die
   Per-Selektions-Constraints werden weiterhin über den Instanzbaum-Lauf
   (`checkSelectionTree`/`traverseSelectionTree`) erreicht; neu ist, dass ihre
   Zählung über den Kern (`measureOver`) statt über eigene Scope-Logik läuft.
   Der Sonderfall „Pflicht-Eintrag fehlt" wird — wo ein fehlender Eintrag im
   Instanzbaum gar nicht vorkommt — in einem späteren Ausbau durch **Phantom-Knoten** 
   (`evalTree.js`) erfasst. Der Evaluator synthetisiert für weggelassene 
   Pflicht-Auswahlen (roster-, force- und parent-weit) künstliche Phantom-Knoten 
   im Instanzbaum. Dadurch werden Pflicht-Absenzen auf *allen* Ebenen generisch 
   vom Auswertungs-Kern gefunden. Die frühere Lücke („parent-/gruppenweite Pflicht-Absenz
   wird nicht erfasst") ist damit architektonisch geschlossen.

5. **Ein Ergebnis, zwei Sichten.** Validierung ist der Filter auf Verstöße
   (ungültige Listen werden markiert, nicht hart verhindert). Die **UI-
   Verfügbarkeit** bleibt der Diff zweier Läufe (Kandidat inklusive seiner
   Pflicht-Kinder, ADR-0022). Zusätzlich liefert derselbe Lauf ein **UI-
   Verhaltensmodell** je Option/Gruppe (radio-vs-checkbox, „Pflicht", „wie viele
   noch", effektives Kategorie-Max); die Oberfläche rendert es nur noch und
   wertet keine Constraint selbst mehr aus. Das ist ADR-0022, konsequent auf die
   ganze UI ausgeweitet.

6. **Einmaliger Durchlauf; beschränkte Stabilisierung als vorgemerkte
   Absicherung (nicht umgesetzt).** Die Engine wertet in einem geordneten
   Durchlauf aus, wie zuvor. Für die eine theoretische Kopplung — ein Modifikator
   ändert die effektive Kategorie, eine kategoriezählende Bedingung hängt davon
   ab — wäre eine beschränkte Stabilisierung (harte Iterationsschranke,
   deterministischer Abbruch) die Absicherung. Sie ist **bewusst nicht
   implementiert**: die real vorkommenden Kataloge konvergieren in einem
   Durchlauf, und ein Iterations-Loop gegen ein nicht belegtes pathologisches
   Muster wäre spekulative Verallgemeinerung (YAGNI). Der Haken bleibt hier
   vermerkt, damit die Absicherung nachgezogen werden kann, sobald ein Katalog
   sie tatsächlich verlangt. Kein allgemeiner Fixpunkt-Solver.

### Konsequenzen (Auswirkungen)

- **Positiv:** eine Antwortstelle je Frage; Divergenzen (u. a. Prozent
  Zähler/Nenner, Kategorie-Cap zwischen Sidebar und Sektion) verschwinden
  strukturell; neue Constraint-Klassen wirken automatisch bis in die UI; die
  Oberfläche kennt keine Constraint-Semantik mehr.
- **Negativ:** die Auswertung wird vollständig neu berechnet (memoisiert); der
  Aushebe-Dialog behält den bewusst in Kauf genommenen Diff-Aufwand je Kandidat
  (ADR-0022). Als Format-korrekte Zusammenführung kann sie einzelne heutige
  Validierungsergebnisse **ändern** (latente Bugs mitkorrigieren) — gewollt.
- **Neutral:** das Roster-/Katalog-Schema bleibt unverändert; die Fassade
  (ADR-0023) bleibt die exklusive Schnittstelle.

## Architektur im Detail

### Leitidee: „Alles ist eine Query"

Eine **Query** misst eine Zahl `n` — *was* (`field`: Anzahl Selektionen oder
Summe einer Kostenart) in *welchem Bezugsrahmen* (`scope` + `shared` +
`includeChildSelections` + `childId`). Die drei Regelkonstrukte sind Queries plus
eine dünne Reaktion auf `n`:

| Query-Art | Reaktion auf den gemessenen Wert `n` |
|---|---|
| Constraint (min/max) | Vergleich `n` gegen effektiven Schwellenwert → erfüllt / Verstoß (+ Ursachen) |
| Condition (`lessThan`, `atLeast`, `instanceOf`, …) | Vergleich `n` gegen `value` → Wahrheitswert |
| Repeat | `floor/ceil(n / value) · repeats` → Wiederholungszahl |

### Schichten

```
                         ┌───────────────────────────────────────────┐
  (roster, system)  ──►  │  L1  EvaluationContext (einmaliger Vorlauf)│
                         │      • Count-Index (computeRosterCounts)   │
                         │      • System-/Definitions-Resolver-Index  │
                         │      • Kostenart-Auflösung (costLimitType) │
                         │      versioniert & memoisiert (ADR 0005)   │
                         └───────────────────┬───────────────────────┘
                                             │
                         ┌───────────────────▼───────────────────────┐
   Query + Subjekt  ──►  │  L2  measureQuery(query, subject, ctx) → n │
                         │  ┌─────────────────────────────────────┐  │
                         │  │ L2a resolveScopeAnchor(scope, …)     │  │  ◄── EINZIGE
                         │  │     scope-Token → Anker (Node-Set /  │  │      scope-BEWUSSTE
                         │  │     Count-Bucket). Nur HIER lebt die │  │      Stelle
                         │  │     geschlossene Scope-Liste.        │  │
                         │  └──────────────┬──────────────────────┘  │
                         │  ┌──────────────▼──────────────────────┐  │
                         │  │ L2b measureOver(anchor, field, opts) │  │  ◄── VÖLLIG
                         │  │     zählt/summiert über den Anker.   │  │      scope-AGNOSTISCH
                         │  │     Kennt kein "roster"/"force".     │  │      (Anker = Parameter)
                         │  │     EIN Ziel-Matcher, honoriert      │  │
                         │  │     shared/childId/includeChild…     │  │
                         │  └─────────────────────────────────────┘  │
                         └───────────────────┬───────────────────────┘
                                             │
        ┌────────────────────┬───────────────┼───────────────────┬─────────────────┐
        ▼                    ▼                                    ▼                 ▼
  evaluateConstraint   evaluateCondition                    evaluateRepeat   (Prozent-Nenner:
  → {ok, n, thr,       → Wahrheitswert                      → Wiederholung    dieselbe measureQuery
     causes}           (Komparator)                                           statt 2. Engine)
        │                                                                     
        ▼  L3  Konsumenten (dünn)                                            
  ┌───────────────────────────────────────────────────────────────────────────────────┐
  │  L4  Treiber: Instanzbaum-Lauf (checkSelectionTree/traverseSelectionTree) für die  │
  │      Per-Selektions-Constraints; Zählung je Constraint über L3/Kern.                │
  │      Pflicht-Absenz (Eintrag fehlt) wird generisch über Phantom-Knoten im Instanz-  │
  │      baum (`evalTree.js`) abgebildet. Jede Pflicht-Absenz erreicht so den Kern.     │
  └───────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼  L5  EIN Ergebnis → alles abgeleitet
  validateRoster (Verstöße) ─┬─► entryAvailability (Diff, ADR 0022) ── bleibt
                             ├─► NEU: SelectionBehaviorModel pro Option/Gruppe
                             │        (radio/checkbox, mandatory, binär, „n noch erlaubt",
                             │         Gruppen-Fehler, effektives Kategorie-Max)
                             └─► UI rendert nur noch dieses Modell (keine Auswertung mehr)
```

- **L1 — `EvaluationContext`:** einmal pro `(roster, system)`-Version gebaut und
  memoisiert; bündelt Count-Maps, Definitions-Resolver und Kostenart-Auflösung.
  Macht die faktische Zweiphasigkeit zu einem *benannten Vertrag* statt zu
  implizitem Wissen jeder Aufrufstelle.
- **L2 — `measureQuery`, geteilt in scope-bewusst vs. scope-agnostisch:** `L2a
  resolveScopeAnchor` ist die *einzige* Stelle, die die geschlossene Scope-Liste
  kennt und ein Scope-Token auf einen Anker abbildet; `L2b measureOver` zählt/
  summiert über den Anker als **Parameter**, ohne die Scope-Wörter zu kennen.
  Ersetzt die fünf heutigen Resolver; der `parent`-Lauf existiert danach einmal.
- **L3 — drei dünne Adapter:** `evaluateConstraint`/`evaluateCondition`/
  `evaluateRepeat`. Schwellenwert weiter über `getModifiedConstraintValue`; der
  Prozent-Nenner ruft dieselbe `measureQuery` → Zähler/Nenner-Divergenz entfällt.
- **L4 — Instanzbaum-getriebene Zählung + definitionsseitige Pflicht-Absenz**
  (siehe Entscheidung Punkt 4, samt der bekannten Grenze).
- **L5 — ein Ergebnis, alles abgeleitet:** Verstöße, Aushebe-Verfügbarkeit (Diff,
  ADR 0022) und das UI-Verhaltensmodell stammen aus einem Lauf.

### Randbedingungen, die die Engine als Eingaben behandelt

1. **Zwei Bäume, per ID verbunden.** Der Instanzbaum trägt keine Regeln; jede
   Selektion löst ihre Definition per ID auf. Die Engine braucht einen read-only
   System-Index (L1) und vergleicht gegen aufgelöste **Ziel-IDs**, nicht Verweis-IDs.
2. **Globaler Count-Vorlauf ist Pflicht.** `force`/`roster`/`category`-Scopes werden
   aus vorberechneten Zähltabellen beantwortet, nicht aus dem lokalen Teilbaum —
   die Auswertung ist zweiphasig (Index bauen → laufen), kein reiner Single-Walk.
3. **Nicht alle Constraints hängen primär am Instanzbaum.** Pflicht-Grenzen, die feuern,
   wenn ein Eintrag *fehlt*, werden durch Phantom-Knoten (`evalTree.js`) künstlich in den 
   Instanzbaum projiziert. Dadurch ist die ursprüngliche Lücke (parent-weite Pflicht-Absenz) 
   mittlerweile geschlossen und jede Absenz erreicht den Evaluator auf normalem Wege.
   verschachtelte Forces ein (ADR 0011 §5), sodass `includeChildForces` die
   dokumentierte Näherung „ganzes Roster" bleibt — isoliert in L2a.

### Unabhängige Bestätigung (Clean-Room)

Ein externer Software-Architekt hat ohne Sicht auf Code, Doku oder diesen Entwurf
blind eine Architektur aus Problem + Datenform entworfen. Deckungsgleich bestätigt:
das **eine Zähl-Primitiv** für alle Konstrukte und Rahmen, die **Scope-als-
Parameter**-Trennung, die **reine Auswertungsfunktion mit einem Ergebnis-Modell**
für Validierung *und* UI, Verfügbarkeit als **Diff zweier Läufe**, sowie
Prozent-Zähler und -Nenner aus demselben Kernel. Von den Schärfungen des
Reviewers ist die **definitionsseitige Pflicht-Absenz** (Punkt 4) für Force-/
Roster-Scope umgesetzt; die **beschränkte Stabilisierung** (Punkt 6) ist als
Absicherung vorgemerkt, aber bewusst nicht implementiert (YAGNI). SAT/CSP-Solver
und ein generelles reaktives Abhängigkeitsdiagramm hat der Reviewer aus denselben
Gründen verworfen wie hier.

## Vor- und Nachteile der Optionen

### Option 1 — Status quo lassen, punktuell härten
- **Gut, weil** kein großer Umbau nötig ist.
- **Schlecht, weil** die doppelte Wahrheitsquelle bleibt und bei jeder künftigen
  Constraint-Änderung erneut driftet — genau das wiederkehrende Muster (ADR-0022).

### Option 2 — Zentrale Query-Engine
- **Gut, weil** eine einzige Engine über Zählen, Validierung und UI-Verhalten
  urteilt (SSOT), system-agnostisch, mit von selbst anfallenden Ursachen.
- **Schlecht, weil** der Umbau tief in Solver und UI reicht und Voll-
  Neuberechnung als Basis wählt (durch Memoisierung abgefedert).

### Option 3 — SAT/CSP-Solver
- **Gut, weil** formale Gültigkeit elegant ausdrückbar wäre.
- **Schlecht, weil** die Daten imperativ und reihenfolgesensitiv sind, die UI
  „einfügen und sehen" braucht statt „finde eine gültige Belegung", und
  Erklärbarkeit/Determinismus leiden.
