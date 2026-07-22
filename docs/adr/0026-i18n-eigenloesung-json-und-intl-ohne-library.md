# i18n als Eigenlösung: JSON-Sprachdateien + Intl-API, keine i18n-Library

Status: Accepted — 2026-07-22

Die App-Oberfläche wird mehrsprachig (Deutsch/Englisch, Fallback Englisch). Wir
verzichten bewusst auf eine i18n-Library (i18next, react-intl/FormatJS) und
bauen stattdessen ein kleines eigenes Übersetzungsmodul: ein Key-Value-JSON pro
Sprache, eine Nachschlagefunktion mit Platzhalter-Ersetzung sowie die im
Browser eingebauten `Intl.PluralRules` (Numerus) und `Intl.NumberFormat`
(Zahlenformatierung).

Gründe: Das Projekt vermeidet neue Laufzeit-Abhängigkeiten, wo Bordmittel
genügen (gleiches Muster wie ADR 0012/0014); für zwei Sprachen mit einfachen
Platzhaltern und Pluralregeln decken die nativen Intl-APIs den Bedarf
vollständig ab, bei 0 KB Bundle-Zuwachs und voller Offline-Fähigkeit der PWA
(ADR 0002). Wer künftig ICU-MessageFormat-Komplexität, Sprach-Lazy-Loading
über viele Sprachen oder Übersetzungs-Tooling braucht, sollte diese
Entscheidung neu bewerten.

## Verworfene Alternativen

- **i18next (+react-i18next)**: ausgereift, aber neue Runtime-Dependency und
  Bundle-Gewicht für Funktionen (Namespaces, Backends, Detection-Plugins), die
  hier ungenutzt blieben.
- **FormatJS/react-intl**: ICU-Standard, aber die schwerste Option; für zwei
  Sprachen unverhältnismäßig.

## Konsequenzen

- Katalogdaten bleiben unübersetzter Pass-through (bestehende Entscheidung aus
  Issue 47/02) — übersetzt wird ausschließlich App-eigener Text.
- Unit-Tests laufen mit fest gepinnter Sprache Deutsch; ein Paritätstest
  erzwingt identische Schlüsselmengen aller Sprachdateien.
- E2E-Test und Screenshot-Skript selektieren sprachunabhängig
  (`data-testid`/Rollen statt sichtbarer Wörter).
