Status: resolved
Type: feature
Blocked by: None

## Description
Prefactoring für die Mehrsprachigkeit (siehe Main-Issue 58-i18n): Der
Puppeteer-E2E-Test (`src/solver/ui.test.js`) und das Screenshot-Skript
(`scripts/generate_screenshots.js`) finden UI-Elemente heute über sichtbare
deutsche Wörter (z. B. `openUnitActionAndClick(page, 'Löschen')`, Wort-Regex
`/schlacht|spielen|play/`). Jede spätere Sprachumschaltung bricht dieses
Tooling.

Beide werden auf sprachunabhängige Selektoren umgestellt: bevorzugt
ARIA-Rollen/`aria-label`-unabhängige stabile `data-testid`-Attribute an den
betroffenen Bedienelementen. Sichtbares Text-Matching auf App-Chrome-Wörter
verschwindet vollständig aus dem Tooling; Matching auf Katalog-Inhalte
(Einheitennamen wie "Orc") ist davon unberührt, denn Katalogsprache ist
Pass-through und sprachstabil.

Das Verhalten der App ändert sich nicht; hinzukommen dürfen nur
`data-testid`-Attribute.

## Acceptance Criteria
- [ ] `src/solver/ui.test.js` enthält kein Matching mehr auf sichtbare deutsche
      App-Chrome-Texte; alle Klickziele werden über `data-testid` oder Rollen
      gefunden.
- [ ] `scripts/generate_screenshots.js` enthält kein Wort-Regex-Matching mehr
      auf App-Chrome-Texte (insb. `/schlacht|spielen|play/` entfällt).
- [ ] `npm test` ist grün; `node scripts/generate_screenshots.js` erzeugt
      unverändert alle Screenshots.
- [ ] Kein sichtbarer UI-Text wurde geändert (nur Attribute ergänzt).

## Comments
- E2E-Test und Screenshot-Skript auf sprachunabhängige data-testid-Selektoren umgestellt; alle App-Chrome-Wort-Matches (inkl. /schlacht|spielen|play/) entfernt. Nur data-testid-Attribute ergänzt, kein sichtbarer UI-Text geändert.
