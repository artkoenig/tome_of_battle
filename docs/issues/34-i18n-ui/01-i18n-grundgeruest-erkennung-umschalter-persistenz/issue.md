Status: resolved
Type: feature
Blocked by: None

## Description
Legt das technische Fundament für Mehrsprachigkeit: `react-i18next` wird
eingerichtet (siehe ADR-0022), `SettingsContext` wird um `{ locale, setLocale }`
erweitert (siehe ADR-0023, revidiert ADR-0015). Beim ersten Aufruf wird die
Browsersprache erkannt; ist sie nicht Deutsch oder Englisch, greift Englisch
als globale Fallback-Sprache. Ein manueller Sprachumschalter in den
Einstellungen überschreibt die automatische Erkennung dauerhaft; die Wahl wird
im bestehenden `settings`-Object-Store persistiert (ADR-0002) und bei
erneutem App-Start gelesen. Fehlt für den aktuell gewählten Locale ein
Übersetzungsschlüssel, wird der englische Wert verwendet (still, ohne
sichtbaren Platzhalter; im Entwicklungsmodus zusätzlich eine
Konsolen-Warnung). Dieses Issue übersetzt noch keine konkreten UI-Bereiche
inhaltlich vollständig — es liefert die Infrastruktur, an der die
nachfolgenden Übersetzungs-Issues (02-05) andocken, demonstriert aber bereits
end-to-end sichtbar an der Einstellungen-UI und der App-Navigation.

## Acceptance Criteria
- [ ] Bei erstem Aufruf mit englischer Browsersprache zeigt die App die
      Einstellungen-UI und die App-Navigation auf Englisch.
- [ ] Bei erstem Aufruf mit einer nicht unterstützten Browsersprache (z. B.
      Französisch) zeigt die App Englisch (Fallback), nicht Deutsch.
- [ ] Ein manueller Sprachumschalter in den Einstellungen wechselt sofort und
      sichtbar zwischen Deutsch und Englisch (reaktiv, kein Reload nötig).
- [ ] Die manuell gewählte Sprache bleibt nach Neuladen der Seite erhalten
      (persistiert im `settings`-Store) und überschreibt die
      Browser-Erkennung dauerhaft.
- [ ] Ein fehlender Übersetzungsschlüssel in der aktuell gewählten Sprache
      löst zum englischen Wert auf, ohne Fehler oder Platzhaltertext in der
      UI.
- [ ] Bestehende Komponententests laufen unverändert grün (Testumgebung fix
      auf Deutsch).

## Comments
- i18n-Grundgerüst umgesetzt: react-i18next-Instanz (de/en, fallbackLng en, synchron initialisiert, Dev-Warnung bei fehlendem Key), SettingsContext zum Mehr-Werte-Store erweitert ({ whfb6LinkingEnabled, locale, setWhfb6LinkingEnabled, setLocale }, ADR-0023), Browsersprachen-Erkennung mit Fallback auf Englisch, Persistenz der manuellen Wahl im settings-Store (getLocale/setLocale). Sprachumschalter in der Einstellungen-UI und übersetzte App-Navigation demonstrieren es end-to-end. Testumgebung via setupFile fix auf Deutsch.
- Nachtrag: Der Puppeteer-E2E-Test (src/solver/ui.test.js) prüfte hart auf deutsche Strings, war aber nicht auf Deutsch gepinnt wie die Vitest-Suite. Mit aktiver Browsererkennung rendert Headless-Chromium (Default-Locale meist nicht Deutsch) die App auf Englisch, der Test schlug fehl. Behoben durch page.evaluateOnNewDocument(), das navigator.language/languages vor dem Laden auf Deutsch fixiert. Vitest (74/74, 736/736) und E2E jetzt beide grün.
