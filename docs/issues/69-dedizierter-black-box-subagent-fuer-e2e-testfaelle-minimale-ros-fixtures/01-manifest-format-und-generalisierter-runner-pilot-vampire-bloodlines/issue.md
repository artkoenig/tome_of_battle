Status: needs-triage
Type: chore
Blocked by: None

## Description
Legt den gemeinsamen Vertrag der neuen, datengetriebenen E2E-Absicherung fest und
setzt ihn erstmals in Betrieb.

**Manifest-Vertrag (Quelle der Wahrheit je Szenario).** Jedes Testszenario unter
`docs/testing/` erhaelt eine maschinenlesbare Erwartung. Sie deklariert je
Szenario die Katalog-Inputs (welche `.gst` und welche `.cat`-Dateien) und je
enthaltenem Roster, was der Auswertungsbericht der Fassade `evaluate` erfuellen
muss: welche Constraint-Grenz-Ids mit welchem gezaehlten Ist-Wert und welcher
Grenze feuern muessen und welche Grenz-Ids abwesend sein muessen. Das Format ist
so gestaltet, dass ein Autor es ohne Kenntnis des Evaluator-Codes ausfuellen kann.

**Generalisierter Runner.** Ein einziger, versionierter Testeinstieg entdeckt zur
Laufzeit alle Szenarien unter `docs/testing/`, liest je Szenario das Manifest,
wertet jedes Roster gegen `evaluate` aus und prueft das Ergebnis gegen die
deklarierte Erwartung. Die einzelnen Testfaelle entstehen dynamisch zur Laufzeit
und werden nicht als Quelldateien persistiert.

**Pilot.** Das bestehende Szenario `vampire-bloodlines` wird als erstes in das
Manifest-Format ueberfuehrt und belegt den Runner end-to-end an echten
Definitive-Edition-Katalogdaten. Die uebrigen Szenarien folgen in der Migration
(Child-Issue 03) und sind hier ausdruecklich noch nicht Gegenstand.

Nicht im Scope: die uebrigen Szenarien, der Black-Box-Autor-Agent, das Entfernen
der abgeloesten Testdateien.

## Acceptance Criteria
- [ ] Es existiert ein maschinenlesbares Manifest-Format, das je Szenario die
      Katalog-Inputs und je Roster die erwarteten Bericht-Assertions (feuernde
      Grenz-Id mit Ist/Grenze; abwesende Grenz-Ids) ausdrueckt.
- [ ] Ein einziger versionierter Runner entdeckt alle `docs/testing/`-Szenarien,
      generiert die Testfaelle zur Laufzeit und persistiert keine generierten
      Testdateien.
- [ ] Das Szenario `vampire-bloodlines` liegt im Manifest-Format vor und der
      Runner wertet seine Roster gegen die echten Katalogdaten aus; die
      deklarierten Erwartungen entsprechen dem heute abgesicherten Verhalten.
- [ ] Der Runlauf ist gruen und laeuft im bestehenden Testkommando mit.

## Comments
