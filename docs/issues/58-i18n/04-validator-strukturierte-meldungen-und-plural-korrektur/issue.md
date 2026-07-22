Status: ready-for-agent
Type: feature
Blocked by: [02]

## Description
Die Validierungsmeldungen des Solvers (Roster-Validator, ~15 Vorlagen)
entstehen heute als fertige deutsche Template-Sätze tief in der Regel-Engine.
Sie werden auf strukturierte Meldungen umgestellt: die Solver-Schicht liefert
Meldungsschlüssel + Parameter (Zahlen, Katalog-Namen, Prozentwerte), die
Übersetzung in die aktive UI-Sprache passiert erst an der Oberfläche über das
i18n-Modul aus Issue 02. Damit bleibt die Regel-Engine sprachfrei
(Solver-Fassade als exklusive Schnittstelle, ADR 0023, bleibt gewahrt —
nur die Gestalt der Meldungen ändert sich).

Dabei wird die bislang fehlende Pluralisierung mitkorrigiert: Meldungen sind
in beiden Sprachen numerus-korrekt („1 Auswahl" / „2 Auswahlen"). Das ist eine
bewusste Verhaltensänderung auch der deutschen Ausgabe (Spec im Main-Issue
58-i18n); betroffene Test-Assertions werden entsprechend angepasst.
Katalog-abgeleitete Werte in den Meldungen (Namen, Kostenart-Labels) bleiben
unübersetzter Pass-through.

## Acceptance Criteria
- [ ] Kein deutscher Fließtext mehr in der Solver-/Validator-Schicht;
      Meldungen bestehen aus Schlüssel + Parametern und werden erst an der
      Oberfläche übersetzt.
- [ ] Alle Validierungsmeldungen erscheinen in der aktiven UI-Sprache
      (Deutsch und Englisch), Katalog-Namen darin unverändert.
- [ ] Meldungen sind numerus-korrekt in beiden Sprachen; mindestens ein Test
      belegt Singular- und Pluralform derselben Meldung.
- [ ] Bestehende Validator-Tests grün (angepasst nur, wo die
      Plural-Korrektur den Text ändert).
- [ ] Paritätstest weiterhin grün.

## Comments
