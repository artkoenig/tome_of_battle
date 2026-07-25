Status: claimed
Type: chore
Blocked by: None

## Description

# PRD: Alternative Auswertungs-Engine als eigenständige Reinraum-Bibliothek

## Problem Statement

Die produktive Regelauswertung lebt in rund zwanzig verzahnten Modulen unter
`src/solver/` hinter einer Fassade (ADR-0023). ADR-0029 baut sie gerade
schrittweise zu einer zentralen Query-Engine um, hat dabei aber die
**Fixpunkt-Stabilisierung** und die **Phantomknoten** bewusst weggelassen (YAGNI,
ADR-0029 §6). Es fehlt ein Ort, an dem sich der **vollständige** Reinraum-Entwurf
([`docs/evaluator-architecture.md`](../../evaluator-architecture.md)) — gerade
inklusive dieser weggelassenen Teile — unverfälscht und risikofrei erproben lässt,
ohne die Produktion oder den ADR-0029-Pfad anzufassen.

## Desired Behavior / Outcome

Eine eigenständige, räumlich getrennte Auswertungs-Bibliothek erzeugt aus einem
**Katalog** (Battlescribe `.gst`/`.cat`) und einem **Roster** einen **Bericht** —
als reine Funktion, ohne Seiteneffekte, ohne UI, ohne Bezug zur bestehenden Engine.
Der Bericht enthält, in Domänenbegriffen:

- **Verletzungen:** je ausgewertete **Grenze** das volle Tripel *Ist-Wert /
  effektiver Grenzwert / Delta* samt Bezugsinstanz — nie nur „verletzt ja/nein".
- **Fähigkeitsdatensatz je Auswahlpunkt:** effektives min/max, aktueller Stand,
  Restspielraum, Pflicht-/Gesperrt-/Versteckt-Flag, bedingte Hinweise.
- **Diagnosen:** Auflösungsprobleme (mehrdeutige/fehlende IDs), Nichtkonvergenz,
  Null-Nenner bei Prozentgrenzen.

Verhalten, das stimmen muss (Domänenregeln, ADR-0003 / BSData-Format):

- **Grenze**, **Bedingung** und **Wiederholung** werden als dieselbe Frage
  beantwortet: „zähle `field` im **Bezugsrahmen** `scope`, gefiltert auf das
  **Ziel**, unter `flags`" — genau eine Zählstelle.
- Bezugsrahmen `roster`/`force`/`parent`/`self` sowie Eintrags- und Kategorie-IDs
  werden korrekt aufgelöst; Kategorie-Ziele zählen **armeeweit über alle Forces**,
  Eintrags-Ziele **pro Kontingent** (BSData §7.7).
- **Modifikatoren** wirken **in Dokumentreihenfolge** auf effektive Werte (Kosten,
  Kategorien, Grenzwerte, Sichtbarkeit); Basisdefinitionen bleiben unverändert.
- Zählen und Modifizieren können sich gegenseitig beeinflussen; die Auswertung
  **konvergiert** (Fixpunkt) oder meldet **Nichtkonvergenz als Diagnose**, statt
  still falsch zu rechnen.
- Eine Grenze, die *gerade beim Fehlen* einer Pflichtauswahl greift, hat einen
  Auswertungsanker (**Phantomknoten**) und wird erkannt — auch armee-/kontingentweit.
- **Prozentgrenzen** mit leerem Bezugsrahmen (Nenner 0) gelten als **suspendiert**,
  nicht als verletzt.

## User Stories / Requirements

1. Als Entwickler will ich `evaluate(katalog, roster)` als reine Funktion aufrufen
   und einen Bericht (Verletzungen, Fähigkeiten, Diagnosen) erhalten, um die
   Reinraum-Architektur ohne UI und ohne die bestehende Engine zu prüfen.
2. Als Entwickler will ich, dass die Engine echte Definitive-Edition-Fälle (WHFB6,
   z. B. die Ogerbullen-Pflichteinheit) korrekt auswertet, um sie an realistischen
   Mustern zu prüfen.
3. Als Wartender will ich, dass die Engine **hart von `src/solver/` getrennt** ist
   (in beide Richtungen), damit keine der beiden Engines still in die andere leckt.
4. Als Wartender will ich, dass zyklische/pathologische Kataloge eine sichtbare
   Nichtkonvergenz-Diagnose erzeugen statt eines still falschen Ergebnisses.

## Constraints & Settled Decisions

- **Zweite, isolierte Engine unter `src/evaluator/`** mit eigener Fassade; harte
  Import-Trennung zu `src/solver/` in beide Richtungen; Parser-Import erlaubt, aber
  **eigener Parser**. Reine Bibliothek, nicht in den App-Pfad verdrahtet. → ADR-0030.
- **Voller Reinraum-Entwurf** ist die Grundlage, inkl. **Fixpunktschleife** (mit
  Rundenobergrenze + Nichtkonvergenz-Diagnose) und **Phantomknoten** — bewusste
  Abweichung von ADR-0029, das beide weglässt. → ADR-0030,
  `docs/evaluator-architecture.md`.
- **Eigener Parser mit Resolver-Umfang:** entpacktes `.cat`/`.gst`-XML lesen,
  IDs/Importe/Link-Ketten/Dokumentreihenfolge auflösen. **Ohne** ZIP-Entpacken,
  XSD-Gate, Katalog-Editor.
- **Eigenes Datenmodell und eigener Bericht;** kein Interop mit dem bestehenden
  `ValidationError`-Modell.
- Domänenregeln bleiben verbindlich: ADR-0003 (system-agnostisch, IDs statt Namen,
  Dokumentreihenfolge, Kostenart per ID).
- **Relevant ADRs:** ADR-0030 (dieser Entscheid), ADR-0029 (abgegrenzt), ADR-0023
  (abgegrenzt), ADR-0003, ADR-0016, ADR-0024.

## Testing Decisions

- **Behavior to verify:** die unter „Desired Behavior" gelisteten Verhaltensweisen
  — Query-Semantik über alle Flag-/Bezugsrahmen-Kombinationen, Modifikator-
  Dokumentreihenfolge, Fixpunkt-Konvergenz und Nichtkonvergenz-Diagnose,
  Phantomknoten-Pflichtabsenz, Prozent-Suspendierung, korrekter Bericht
  (Verletzungs-Tripel, Fähigkeitsdatensatz, Diagnosen).
- **Test Interfaces (Seams):**
  1. `evaluate(katalog, roster) → Bericht` — die Fassade; End-to-End gegen eigene
     Fixtures.
  2. **Das Query-Primitiv** — Matrix-Testsuite über `shared ×
     includeChildSelections × includeChildForces ×` Bezugsrahmen-Arten, ein Fall je
     Zelle, als ausführbare Spezifikation.
- **Fixtures:** eigene, minimale `.cat`/`.gst`-Testdaten, **modelliert an realen
  Definitive-Edition-/WHFB6-Fällen** (nicht die Fixtures der alten Engine
  wiederverwendet). Die realen WHFB6-Dateien können später als zusätzlicher
  Smoke-Test dienen.

## Out of Scope

- Jede Verdrahtung in App/UI (`useRoster`, Aushebe-Dialog, Feature-Flags).
- Vergleichs-Harness / Oracle-Diff gegen die bestehende Engine.
- Produktiver Cutover oder Ablösung von `src/solver/` bzw. ADR-0029.
- ZIP-Entpacken, XSD-/Schema-Validierung, Katalog-Editor (bleiben Import-Pipeline).
- Interop mit dem bestehenden `ValidationError[]`-Format.
- Inkrementalisierung (Architektur §4.9) — erst falls die Voll-Neuauswertung
  nachweislich zu langsam ist (YAGNI).

## Acceptance Criteria
- [ ]

## Comments
- Architektur-Abgleich Slice 01 sauber (0 fehlende Anforderungen, 0 Scope-Creep, Isolation verifiziert). Zwei bewusst zurückgestellte, additiv nachziehbare Nähte für spätere Slices: (1) evaluate() nimmt derzeit einen Einzelkatalog-String statt catalogs[] mit Import-Ketten (§3.1/§4.2) – beim Multi-Katalog-Resolver-Slice zu weiten; (2) Diagnosen flach statt per ResolvedDef.resolutionLog (§4.1) – beim Cross-Katalog-Resolver nachzuziehen.
- Architektur-Abgleich Slice 03: 1 Fund behoben – Ziel-Typ-Regel (Kategorie→armeeweit) galt fälschlich für jeden shared-Scope; auf scope=force eingeschränkt (ADR-0003/0029) + Regressionstest. Sonst konform; Vier-Eimer-Index als valide Realisierung von §4.4 bestätigt.
- Architektur-Abgleich Slice 04: konform, keine blockierenden Funde (Dokumentreihenfolge, frische Basiskopie/keine Drift, effektive Werte verdrahtet – alle verifiziert). Offener Punkt für Slice 08: CompareOp.INSTANCE_OF (§4.1) noch nicht implementiert; Semantik gegen echte Definitive-Edition-Daten nachziehen statt raten.
- Architektur-Abgleich Slice 05: 0 Funde, exakt konform zu §3.5/§4.2 (Loop, countRelevantEqual=Kosten+Kategorien, MAX_FIXPOINT_ROUNDS=5, NO_CONVERGENCE, finaler Index). Oszillationstest als echter A/B-Zyklus verifiziert. Tests grün.
