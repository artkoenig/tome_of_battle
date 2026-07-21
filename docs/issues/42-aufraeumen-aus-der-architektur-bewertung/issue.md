Status: resolved
Type: feature
Blocked by: None

## Description

Ergebnis einer erneuten Gesamtbewertung der Anwendung gegen die Architektur- und
Code-Generierungs-Prinzipien (UDF, SSOT, Immutability, OCP, Composition over
Inheritance, Modularisierung, keine leaky abstractions, DI, KISS; sprechende
Namen, SRP, kurze Funktionen mit einer Abstraktionsebene, keine Magic Values,
minimierte Seiteneffekte, DRY, robuste Fehlerbehandlung, FIRST, YAGNI).

Die Bewertung fand nach dem Abschluss von Haupt-Issue 39 statt und misst dessen
Wirkung mit.

`Type: feature`, weil Kind-Issue 01 eine nutzersichtbare Änderung enthält und
das Bündel damit einen Release-Grund hat (Minor-Bump beim Merge). Die übrigen
drei Kinder sind rein strukturell.

### Gesamtbefund

Die Codebasis ist **gesund; die verbliebenen Schwächen sind lokal begrenzt statt
flächig**. Messwerte zum Zeitpunkt der Bewertung: rund 33.300 Zeilen über 111
Testdateien, **999 Tests grün**, `npm run lint` **0 Fehler / 57 Warnungen**,
23 ADRs.

Als Maßstab für den Rest der Codebasis geeignet und ausdrücklich nicht
anzufassen:

- **Die Solver-Fassade** (`src/solver/validator.js`, ADR 0023) ist eine echte,
  nicht durchlässige Abstraktion — und die Lint-Regel `no-restricted-imports`
  macht sie unumgehbar statt sie nur zu empfehlen. Das ist das stärkste
  Einzelmerkmal der Codebasis.
- **SSOT und UDF** sind in der Zustandsgrenze konsequent durchgezogen: die
  Wurzelkomponente hält allein die Auswahl-ID, Roster und System werden daraus
  abgeleitet; Kosten, Validierung und ausgewählte Selection werden im
  Roster-Hook berechnet statt in eigenem Zustand gespiegelt.
- **Sonderfälle als Daten statt als Verzweigungen**: `src/solver/systemQuirks.js`
  setzt OCP mustergültig um.
- **Fehlerbehandlung**: kein `catch` schluckt still; alles erreicht den Nutzer
  über den Toast-Kanal (ADR 0010), die eine bewusste Ausnahme ist an Ort und
  Stelle begründet.

### Die vier Scheiben

| # | Inhalt | Art |
| --- | --- | --- |
| 01 | Rüstungs-/Rettungswurf-Anzeige ersatzlos entfernen, Wundenzähler an ihre Stelle; ADR 0003 wird dadurch ausnahmslos | nutzersichtbar |
| 02 | Zerlegung der Editor-Wurzelkomponente (God Component) | strukturell |
| 03 | Aufteilung des Stylesheets nach Bereichen | strukturell |
| 04 | Toter Code und Lint-Warnungen; kehrt zum Schluss auf | strukturell |

Die Reihenfolge ist die Abhängigkeitsreihenfolge und damit die Merge-Reihenfolge:
01 löscht CSS-Klassen und Code, die 03 sonst mitschleppen und 04 sonst erneut
melden würde.

### Ein korrigierter Befund

Die Bewertung hatte das Keyword-Scraping für Rüstungs- und Rettungswürfe
zunächst als schwersten Prinzipienverstoß eingestuft. Die anschließende
Recherche hat das in zwei Punkten widerlegt:

1. **ADR 0003 §3 sanktioniert die Heuristik ausdrücklich** als einzige
   zugelassene Ausnahme von der Regel „keine sprachabhängigen Strings als
   Schlüssel". Sie war eine dokumentierte Entscheidung, keine übersehene
   Altlast.
2. **Der Blast-Radius war ein Anzeige-Badge**, nicht die Regel-Engine: die
   Werte fließen weder in Validierung noch in Kosten, Konstruktion oder
   Serialisierung ein.

Die Einstufung als Priorität 1 war damit nicht haltbar. Der Maintainer hat
daraufhin entschieden, das Feature ersatzlos zu entfernen statt es umzubauen —
womit der Befund und die ADR-Ausnahme gemeinsam entfallen. Kind-Issue 01 setzt
das um.

### Bewusst nicht enthalten

- **Prop-Bündel der Editor-Komponenten → Editor-Kontext** (Haupt-Issue 36, vom
  Maintainer auf `superseded` gesetzt). Der Data Clump besteht messbar fort;
  die Neubewertung ist an Kind-Issue 02 gekoppelt, weil dessen Zerlegung die
  Zahl der Aufrufstellen bereits senkt.
- **Restpunkte aus Haupt-Issue 28** (tote Suche im Spielmodus). Punkt 3 jenes
  Issues — die überlangen Save-Funktionen — wird durch Kind-Issue 01
  gegenstandslos und ist dort abzuräumen.

## Acceptance Criteria
- [ ] Alle vier Kind-Issues sind geschlossen (`resolved` oder `superseded`).
- [ ] `npm test` ist grün; die Testanzahl ist außerhalb der mit Kind-Issue 01
      bewusst gelöschten Save-Tests nicht gesunken.
- [ ] `npm run lint` meldet 0 Fehler und 0 Warnungen.
- [ ] Außer der in Kind-Issue 01 spezifizierten Änderung der Spielansicht hat
      sich kein Verhalten der Anwendung geändert.
- [ ] Die Version in `package.json` ist vor dem PR um einen Minor-Schritt
      angehoben (`node scripts/release.js minor`).

## Comments
- Entscheidung des Maintainers am 2026-07-21, nach Abschluss aller vier Kind-Issues: (1) KEIN Versions-Bump - die Version bleibt bei 1.4.0. Damit ist Akzeptanzkriterium 5 dieses Issues bewusst nicht erfuellt, nicht vergessen. Folge: der Workflow tag-on-version-bump.yml feuert nach dem Merge nicht, es entsteht kein v-Tag fuer diese Aenderung. Wer spaeter releasen will, muss den Bump nachholen. (2) Der PR wird erst geoeffnet, wenn der separat laufende Task zur Reparatur von scripts/generate_screenshots.js durch ist - dann lassen sich die bei Kind-Issue 01 und 03 offen gebliebenen Screenshot-Kriterien noch erfuellen. Der Branch issue/aufraeumen-aus-der-architektur-bewertung bleibt bis dahin lokal und ungepusht.
