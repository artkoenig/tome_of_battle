Status: ready-for-agent
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
