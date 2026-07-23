# Validierungs-Ursachen als optionales, sprachfreies Feld am Fehlerobjekt

- **Status:** Accepted
- **Datum:** 2026-07-23
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** Schreibt ADR-0026 (strukturierte,
  sprachfreie Fehler) fort; respektiert ADR-0003 (keine katalogspezifische Logik)
  und ADR-0022 (App- vs. Autor-Meldung, UI leitet sich aus dem Validator ab).

## Kontext und Problemstellung

Mechanische Validierungsmeldungen sagen nur *dass* ein Limit verletzt ist, nicht
*warum*. Der häufige, für Nutzer verwirrende Fall: ein Limit steht auf einem Wert
(z. B. Max 0), weil eine *andere* Auswahl über einen bedingten Modifier diesen
Wert verändert hat („weil Battle Standard Bearer gewählt ist → Weapons-Max = 0").

Die dafür nötige Herkunft (welcher Modifier, welche Bedingung, welche auslösende
Auswahl) liegt zum Prüfzeitpunkt vor: `getModifiedConstraintValue` filtert die
aktiv greifenden Modifier, **reduziert sie aber sofort per `.reduce()` auf eine
nackte Zahl**. Am erzeugten Verstoß kommt nur noch Ist-Wert vs. Grenzwert an — die
Ursache ist verloren.

Wir wollen die auslösende(n) Auswahl(en) anzeigen, ohne dabei die zwei tragenden
Prinzipien zu verletzen: der Solver bleibt sprachfrei (ADR-0026), und es entsteht
keine katalog-/regelspezifische Sonderlogik (ADR-0003).

## Entscheidungsfaktoren (Drivers)

- **Sprachfreiheit des Solvers** (ADR-0026): keine fertigen Sätze im Solver.
- **Generik** (ADR-0003): Herleitung nur aus Constraint/Modifier/Condition-Daten,
  kein Bezug auf konkrete Kataloge/Einträge.
- **Abwärtskompatibilität:** bestehende Meldungen, Tests und der Aushebe-Pfad
  dürfen sich ohne Ursachen exakt wie bisher verhalten.
- **Ehrlichkeit vor Vollständigkeit:** eine nicht sauber benennbare Ursache lieber
  weglassen als kryptisch anzeigen.

## Betrachtete Optionen

- **Option 1 — Ursache im Solver zum fertigen Satz bauen.** Der Validator
  formuliert „… weil X gewählt ist" direkt aus.
- **Option 2 — Optionales, sprachfreies Ursachen-Feld am `ValidationError`.** Der
  Solver hängt die aufgelösten auslösenden Auswahlen (als IDs/Katalognamen, kein
  Satz) an den Verstoß; die UI baut daraus den Anzeige-Block je Sprache.
- **Option 3 — Anzeige-Schicht leitet die Ursache selbst her.** Die UI wertet
  Modifier/Conditions erneut aus.

## Entscheidungsergebnis

Gewählte Option: **Option 2**, weil sie die etablierte Trennung von ADR-0026
(Solver liefert Struktur + Schlüssel/Parameter, UI bildet den Satz) auf die
Ursache überträgt: Der Solver reicht die **beitragenden, bedingten** Modifier
(gefiltert vor dem `.reduce()`) heraus und löst deren Bedingung auf eine
benennbare auslösende Auswahl auf; das Ergebnis ist ein optionales, sprachfreies
Feld am `ValidationError`. Die UI rendert daraus den „Ursachen"-Block je Sprache.

Konkretes Modell:

- **Ursache = bedingter Modifier mit erfüllter Bedingung, der den Wert
  verändert.** Unbedingte Modifier und reine Basiswerte sind keine Ursache.
- **Ganze Kette:** alle beitragenden bedingten Modifier werden aufgeführt.
- **Nur benennbare Auslöser:** löst die Bedingung auf eine wählbare Auswahl auf,
  wird deren Katalog-ID/Name geführt (Pass-through, ADR-0003). Nicht sauber
  auflösbare Bedingungen erzeugen **keine** Ursache — fehlt danach jede Ursache,
  entfällt das Feld ganz.
- **An den Fehlertyp nicht gebunden:** die Auslösebedingung ist „Wert wurde
  bedingt modifiziert", nicht `max`/`min`.
- **Nur App-Meldungen:** Autor-Meldungen (`modifier-*`) bleiben ohne Ursachen-Feld.

Option 1 verletzt ADR-0026 (Sätze im Solver, nicht mehrsprachfähig). Option 3
dupliziert die Regel-Auswertung in der UI und bricht ADR-0022 (UI leitet sich aus
dem Validator ab, keine zweite Regel-Implementierung).

### Konsequenzen (Auswirkungen)

- **Positiv:** Ursache ist mehrsprachfähig, testbar an einem framework-freien
  Seam, und die Anzeige bleibt Single-Source-of-Truth über das Fehlerobjekt.
- **Positiv:** Additiv und abwärtskompatibel — ohne Ursachen ändert sich nichts.
- **Negativ:** Die Constraint-Auswertung muss die beitragenden Modifier
  mitliefern (Erweiterung neben dem reinen Zahlwert) und IDs zu Namen auflösen —
  ein Pfad, den der Validator heute nicht hat.
- **Neutral:** Bei mehreren zusammenwirkenden Modifiern ist „die Ursache" bewusst
  eine Liste, keine einzelne Aussage.

## Vor- und Nachteile der Optionen

### Option 1 — Satz im Solver

- **Gut, weil** direkt und ohne neues Feld.
- **Schlecht, weil** es ADR-0026 bricht (Solver wird sprachgebunden, nicht
  mehrsprachfähig, schwer testbar).

### Option 2 — Optionales sprachfreies Feld am Fehlerobjekt

- **Gut, weil** konsistent mit ADR-0026/0022, mehrsprachfähig, additiv,
  framework-frei testbar.
- **Schlecht, weil** ein zusätzlicher Herleitungs-/Auflösungspfad im Solver
  entsteht.

### Option 3 — UI leitet Ursache selbst her

- **Gut, weil** kein neues Solver-Feld.
- **Schlecht, weil** es die Regel-Auswertung in der UI dupliziert und ADR-0022
  bricht (zwei Wahrheiten).
</content>
