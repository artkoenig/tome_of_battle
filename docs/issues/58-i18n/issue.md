Status: resolved
Type: feature
Blocked by: None

## Description
# PRD: Mehrsprachigkeit (i18n) — Deutsch/Englisch

## Problem Statement / Bug Description
Die App-Oberfläche von "Tome of Battle" ist ausschließlich deutsch, alle Texte
sind hartkodiert (niedrige Hunderte Strings in ~24 Komponenten plus ~15
dynamische Validierungsmeldungen). Nicht-deutschsprachige Nutzer können die App
nicht sinnvoll verwenden. Zusätzlich sind die öffentlichen Oberflächen heute
sprachlich uneinheitlich: App deutsch, Landing Page englisch, Zustandsbericht
deutsch, PWA-Manifest gemischt (Name englisch, Beschreibung deutsch).
Validierungsmeldungen sind außerdem numerus-falsch ("1 Auswahlen").

## Solution
Ein kleines eigenes Übersetzungsmodul ohne neue Laufzeit-Abhängigkeit
([ADR 0026](../../adr/0026-i18n-eigenloesung-json-und-intl-ohne-library.md)):
Key-Value-JSON pro Sprache (Deutsch, Englisch), Nachschlagefunktion mit
Platzhaltern, `Intl.PluralRules` für Numerus, `Intl.NumberFormat` für Zahlen.
Englisch ist Fallback-Sprache; weitere Sprachen entstehen später als reine
Übersetzungsdateien. Die UI-Sprache wird beim ersten Start aus der
Browser-Sprache abgeleitet (Deutsch → Deutsch, sonst Englisch); ein manueller
Umschalter in den Einstellungen übersteuert das dauerhaft (lokal gespeichert,
pro Oberfläche getrennt). Katalogtexte bleiben unübersetzter Pass-through
(Katalogsprache, siehe CONTEXT.md). Die Landing Page wird zweisprachig mit
eigenem Umschalter; der Zustandsbericht wird einmalig einsprachig englisch
(kein Umschalter, bleibt maintainer-gerichtet); das PWA-Manifest wird
einheitlich englisch. Die fehlende Pluralisierung der Validierungsmeldungen
wird im Zuge der Umstellung mitkorrigiert — bewusste Verhaltensänderung auch
im Deutschen ("1 Auswahl" statt "1 Auswahlen").

## User Stories / Requirements
1. Als nicht-deutschsprachiger Nutzer möchte ich die App vollständig auf
   Englisch bedienen (Buttons, Menüs, Dialoge, Toasts, Fehlermeldungen,
   Validierungsmeldungen), um Armeelisten ohne Sprachbarriere zu bauen.
2. Als Nutzer möchte ich, dass die App beim ersten Start automatisch in meiner
   Browser-Sprache erscheint (Deutsch → Deutsch, alles andere → Englisch).
3. Als Nutzer möchte ich die Sprache in den Einstellungen manuell umstellen
   können; meine Wahl bleibt dauerhaft gespeichert und übersteuert die
   Automatik.
4. Als Nutzer sehe ich Katalog-Inhalte (Einheitennamen, Regeln, Profile,
   Optionsnamen) immer unverändert in der Katalogsprache — unabhängig von der
   UI-Sprache.
5. Als Nutzer erhalte ich numerus-korrekte Meldungen in beiden Sprachen
   ("1 Auswahl" / "2 Auswahlen", "1 selection" / "2 selections").
6. Als Besucher der Landing Page kann ich zwischen Deutsch und Englisch
   umschalten; die Seite merkt sich meine Wahl unabhängig von der App.
7. Als Installierender sehe ich ein sprachlich konsistentes, englisches
   PWA-Manifest.
8. Als Maintainer lese ich den Zustandsbericht künftig auf Englisch
   (einsprachig, ohne Umschalter).
9. Als Übersetzer einer künftigen Sprache muss ich nur eine neue
   JSON-Sprachdatei gegen den englischen Schlüsselbestand anlegen.

## Technical Decisions
- Affected Modules: alle UI-Komponenten mit sichtbaren Texten, Solver-Validator
  (Meldungserzeugung), Import-/Serialisierungs-Fehlermeldungen,
  Einstellungen (Umschalter), `index.html`/Manifest, Landing Page,
  Zustandsbericht-Generator, E2E-Test und Screenshot-Skript.
- Technical Clarifications / Architectural Decisions:
  - Eigenlösung statt i18n-Library: [ADR 0026](../../adr/0026-i18n-eigenloesung-json-und-intl-ohne-library.md).
  - Begriffe UI-Sprache, Fallback-Sprache, Katalogsprache: CONTEXT.md.
  - Fehlender Schlüssel in der aktiven Sprache → englischer Text (Fallback);
    die Schlüssel-Parität wird zusätzlich per Test erzwungen.
  - Zahlenausgabe über `Intl.NumberFormat` der aktiven UI-Sprache; das
    `lang`-Attribut des Dokuments folgt der aktiven Sprache.
  - Sprachwahl-Persistenz lokal, pro Oberfläche getrennt (App und Landing
    Page speichern unabhängig; der Zustandsbericht hat keine Sprachwahl).
  - Meldungen aus dem Solver/Validator dürfen nicht als fertige deutsche
    Sätze entstehen: die Schicht liefert strukturierte Meldungen
    (Schlüssel + Parameter), die Übersetzung passiert an der Oberfläche —
    sonst bliebe die tiefste Schicht sprachgebunden.
- API Contracts / Data Models: Übersetzungsfunktion `t(key, params)` als
  einziges öffentliches API des Moduls; Sprachdateien als flaches
  Key-Value-JSON mit Pluralvarianten je Schlüssel.

## Testing Decisions
- Modules to Test: Übersetzungsmodul, Spracherkennung/-persistenz,
  Validator-Meldungen, App-Rendering in beiden Sprachen.
- Test Interfaces (Seams):
  1. Übersetzungsmodul (`t(key, params)`): Platzhalter, Pluralformen,
     Fallback bei fehlendem Schlüssel.
  2. Paritätstest: DE- und EN-Sprachdatei haben exakt dieselben Schlüssel.
  3. Spracherkennung als reine Funktion (Browser-Sprache + gespeicherte Wahl
     → aktive Sprache).
  4. Bestehende Komponenten-/Validator-Tests laufen mit fest gepinnter
     Sprache Deutsch weiter; Anpassung nur, wo die Plural-Korrektur Texte
     ändert. Wenige Smoke-Tests für englisches Rendering.
  5. Puppeteer-E2E und Screenshot-Skript selektieren sprachunabhängig
     (`data-testid`/Rollen statt sichtbarer Wörter).
  6. Landing Page: leichtgewichtige Prüfung per Screenshot in beiden
     Sprachen, kein eigenes Testgerüst.

## Out of Scope
- Übersetzung der Battlescribe-Katalogdaten (Einheitennamen, Regeln, Profile,
  Optionsnamen) — Katalogsprache bleibt Pass-through.
- Weitere Sprachen über Deutsch/Englisch hinaus (Struktur sieht sie vor,
  geliefert werden sie nicht).
- RTL-Schreibrichtung und sprachspezifisches Layout.
- Ein DE/EN-Umschalter für den Zustandsbericht (er wird einsprachig englisch).
- Übersetzungs-Workflow-Tooling (Übersetzungsmanagement, Extraktions-Tools).

## Acceptance Criteria
- [ ]

## Comments
- Mehrsprachigkeit umgesetzt: eigenes i18n-Modul (ADR 0026, t() + Intl, DE/EN, EN-Fallback), Spracherkennung + Umschalter in den Einstellungen, alle App-Texte inkl. Validator (strukturierte Meldungen, Plural-Korrektur) extrahiert, Landing Page zweisprachig, Manifest & Zustandsbericht englisch, E2E/Screenshots sprachunabhängig. Vier-Achsen-Verifikation grün (1426 Tests + E2E).
