Status: resolved
Type: feature
Blocked by: None

## Description
Die Oberflächen neben der App werden sprachlich konsistent gemacht (Spec im
Main-Issue 58-i18n):

- **Landing Page** (GitHub-Pages-Wurzel): wird zweisprachig Deutsch/Englisch
  mit eigenem, unaufdringlichem Umschalter. Erstsprache aus der
  Browser-Sprache (Deutsch → Deutsch, sonst Englisch); die manuelle Wahl wird
  lokal gespeichert — getrennt von der App-Sprachwahl. Die deutschen Texte
  entstehen neu (die Seite ist heute rein englisch); das `lang`-Attribut
  folgt der aktiven Sprache. Als statische Seite braucht sie keine
  Anbindung an das App-i18n-Modul.
- **PWA-Manifest & `index.html`-Meta**: einheitlich englisch — die heute
  deutsche `description` im Manifest wird englisch, Titel/Meta konsistent.
- **Zustandsbericht** (/status): der Generator erzeugt den Bericht künftig
  einsprachig englisch (Überschriften, Urteile, Labels). Kein Umschalter; er
  bleibt maintainer-gerichtet (CONTEXT.md-Definition unverändert). Dynamisch
  abgeleitete Inhalte (Issue-Titel aus dem Tracker, Messwerte) bleiben, wie
  sie sind.

## Acceptance Criteria
- [ ] Landing Page vollständig zweisprachig; Umschalter wirkt sofort, Wahl
      überlebt Reload, Erstbesuch folgt der Browser-Sprache; `lang`-Attribut
      korrekt.
- [ ] `public/manifest.json` und `index.html` enthalten keine deutschen Texte
      mehr; Manifest in sich konsistent englisch.
- [ ] Der generierte Zustandsbericht enthält keine deutschen Generator-Texte
      mehr; `npm test` (inkl. renderReport-Tests) grün.
- [ ] Screenshots der Landing Page in beiden Sprachen als Nachweis.

## Comments
- Landing page made bilingual DE/EN via a standalone landing.js (own DE|EN header toggle, browser-language first visit, choice persisted in localStorage 'tob-landing-lang' separate from the app; lang attribute follows the active language). Manifest description switched to English. Status-report generator (renderReport.js, buildReportModel.js, gates.js labels, generate.js timestamp) now emits English headings, verdicts and labels; tests updated. Full npm test green (1354 tests).
