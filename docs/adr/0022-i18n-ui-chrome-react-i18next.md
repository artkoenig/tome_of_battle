# 0022: Internationalisierung der UI-Chrome via react-i18next, Content bleibt außen vor

- **Status:** Accepted
- **Datum:** 2026-07-19
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs (falls vorhanden):** Betrifft [ADR-0004: Styling Conventions](0004-styling-conventions.md) (variable Textlängen); grenzt sich ab von [ADR-0018: Katalog-Mehrquellenbetrieb](0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md) (Content-Sprache)

## Kontext und Problemstellung

Die App soll neben Deutsch auch Englisch anbieten. Das Battlescribe-Datenmodell
(`xmlParser.js`) hält pro Element genau einen `name`/`description`-String ohne
Sprachvarianten; Katalogquellen sind zudem 1:1 pro Spielsystem gebunden
(ADR-0018). Eine Übersetzung der Spielinhalte (Einheiten-, Waffen-, Regelnamen)
wäre daher ein eigenständiges, deutlich größeres Vorhaben (separate
Katalogquelle pro Sprache oder eine Overlay-Architektur) und keine Nebensache
dieser Änderung.

## Entscheidungsergebnis

Der Scope wird bewusst auf die **UI-Chrome** begrenzt (Buttons, Dialoge, Labels,
Erklärtexte der App selbst) — Battlescribe-Inhalte und die extern verlinkten
Regeltexte (ADR-0012, `6th.whfb.app`) bleiben einsprachig (Deutsch bzw.
Englisch, je nach Quelle) und damit unverändert. Als Bibliothek wird
**`react-i18next`** eingeführt — eine bewusste Abweichung von der in ADR-0012
genannten Zurückhaltung bei neuen Abhängigkeiten, da es sich hier um
Infrastruktur (Pluralisierung, Namespace-Splitting, Fallback-Verkettung)
handelt statt um Duplizierung von Fremdinhalt. Deutsch bleibt die vollständige
Ausgangssprache; **Englisch ist die global konfigurierte Fallback-Sprache**
(`fallbackLng: 'en'`) sowohl für nicht unterstützte Browser-Sprachen als auch
für einzelne fehlende Übersetzungsschlüssel.

### Konsequenzen (Auswirkungen)

- **Positiv:** Robuste Pluralisierung/Interpolation und triviales Nachrüsten
  weiterer Sprachen später, ohne Eigenbau-Sonderfälle.
- **Negativ:** Erste externe i18n-Abhängigkeit im Projekt; variable
  Textlängen pro Sprache müssen innerhalb der festen Typografie-Klassen aus
  ADR-0004 funktionieren.
- **Neutral:** Spielinhalte (Katalogdaten) bleiben vollständig außerhalb
  dieses Mechanismus — eine künftige Content-Übersetzung wäre eine eigene,
  separate Entscheidung.
