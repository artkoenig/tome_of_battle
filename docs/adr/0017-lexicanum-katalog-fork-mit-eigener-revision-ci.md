# 0015: Wechsel des Katalog-Forks zu Lexicanum Imperialis mit eigener Revision-CI

- **Status:** Accepted
- **Datum:** 2026-07-17
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Amendet [ADR 0014](0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md) (Kataloge als externes Fork-Repo mit Laufzeit-Abruf)

## Kontext und Problemstellung

ADR-0014 hat den Katalog-Fork [artkoenig/Warhammer-Fantasy-6th-edition](https://github.com/artkoenig/Warhammer-Fantasy-6th-edition) (Fork von `Ergofarg/Warhammer-Fantasy-6th-edition`) als alleinige, fest verdrahtete Laufzeit-Datenquelle festgelegt. Ein Vergleich mit
[lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition](https://github.com/lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition)
(Karak Norn Wargaming Club) zeigt einen inhaltlich deutlich reichhaltigeren, aktiv gepflegten Datensatz (mehr Fraktionen inkl. Kislev, integrierte Errata/FAQ, deutlich mehr Sonderfiguren und Alternativlisten).

Ein vollständiger Test-Import des neuen Datensatzes durch den bestehenden Parser (`src/parser/xmlParser.js`) zeigte, dass alle 18 Kataloge strukturell kompatibel sind, deckte aber zwei App-seitige Parser-Lücken auf (unabhängig von der Quellenwahl, aber erst durch das reichhaltigere Schema sichtbar): `parseRules()` verwirft `sharedRules`, wenn zusätzlich ein Geschwister-`<rules>`-Element existiert, und `infoGroup`-Elemente werden gar nicht geparst.

Zusätzlich erfüllt `lexicanum-imperialis` zwei Annahmen von ADR-0014 nicht, die dort stillschweigend an „ein BSData-Fork" geknüpft waren:

1. **Kein `catpkg.json`.** ADR-0014s Update-Mechanismus baut auf diesem von `BSData/publish-catpkg` erzeugten Index auf. Er existiert im neuen Repo nicht.
2. **Keine Revision-Disziplin.** Empirisch verifiziert: `Skaven.cat` erhielt zwischen den Releases `0.0.6` (2026-06-18) und `0.0.6.20260711` (2026-07-12) einen neuen `entryLink` (Ice Trolls) — eine echte inhaltliche Änderung —, aber das `revision`-Attribut blieb in beiden Versionen `"1"`. Stichproben über mehrere Kataloge zeigten durchgängig `revision="1"`, obwohl das Repo bereits zwei Releases mit unterschiedlichem Inhalt veröffentlicht hat. Ohne Gegenmaßnahme würde ADR-0014s „revision, higher wins"-Mechanismus ein bereits importiertes System nie als veraltet erkennen.

## Entscheidungsfaktoren (Drivers)

- **Datenqualität:** Der neue Datensatz ist inhaltlich klar überlegen (Fraktionsabdeckung, Errata-Integration, Pflegeaktivität).
- **Wirksamkeit von Datenfixes bleibt erhalten:** ADR-0014s Kernnutzen — Updates erreichen Nutzer ohne Zutun — darf durch den Quellenwechsel nicht verloren gehen.
- **Kein Eigenformat:** Wie in ADR-0014 soll kein App-eigenes Katalogformat entstehen.

## Betrachtete Optionen

- **Option 1 (Nur manueller Import):** ADR-0014 unangetastet lassen, Lexicanum-Daten nur über den bestehenden manuellen ZIP-Upload nutzbar machen. Kein Architektur-Eingriff, aber kein Auto-Update, keine Standardquelle.
- **Option 2 (Fork-Ziel tauschen, Revision-Problem ignorieren):** Fork von Lexicanum anlegen und `CATALOG_REPO_RAW_BASE_URL` umstellen, aber ADR-0014s Update-Erkennung faktisch wirkungslos lassen, da `revision` nie steigt.
- **Option 3 (Fork-Ziel tauschen, eigene Revision-CI):** Fork von Lexicanum anlegen; eine eigene GitHub Action im Fork erkennt bei jedem Upstream-Sync inhaltliche Änderungen je Datei und zählt `revision` entsprechend hoch, plus Generierung von `catpkg.json` im selben Format wie bisher.

## Entscheidungsergebnis

Gewählte Option: **Option 3**, weil sie die einzige ist, die sowohl die bessere Datenqualität übernimmt als auch ADR-0014s zentralen Nutzen (automatische, unbemerkte Datenfixes für bestehende Nutzer) erhält. Option 1 verzichtet auf genau diesen Nutzen für den neuen Datensatz. Option 2 würde ADR-0014s eigene Begründung („das revision-Feld sagt wieder die Wahrheit") direkt unterlaufen und stünde im Widerspruch zur dort dokumentierten Entscheidung.

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Nutzer erhalten den inhaltlich reichhaltigeren Datensatz inklusive automatischer Updates.
  - ADR-0014s Update-Mechanismus bleibt vollständig funktionsfähig, auch ohne Mitwirken von Lexicanum.
- **Negativ:**
  - Zusätzlicher, laufender Pflegeaufwand: Der neue Fork braucht eine eigene, selbst gebaute CI (Revision-Bumping + `catpkg.json`-Generierung), die es beim Ergofarg-Fork nicht brauchte, weil Ergofarg die Revision selbst disziplinierte.
  - Der „Fixes zurückgeben"-Vorteil aus ADR-0014 überträgt sich nur eingeschränkt: Lexicanum ist kein Upstream, von dem wir ursprünglich abgezweigt haben, sondern ein unabhängiges, aber inhaltlich verwandtes Projekt (das selbst Ergofargs Vorarbeit würdigt). Rückgabe eigener Fixes per PR bleibt möglich (Lexicanum nennt GitHub Issues/PRs als bevorzugten Kanal), ist aber nicht Teil dieser Entscheidung.
- **Neutral:**
  - Bereits importierte Systeme aus der alten Ergofarg-Quelle (andere `gameSystemId`) bleiben unverändert nutzbar, erhalten aber keine Updates mehr, da der Index nur noch den neuen Fork beschreibt (passives Auslaufen, keine Migrations-UI).

## Vor- und Nachteile der Optionen

### Option 1 (Nur manueller Import)

- **Gut, weil** kein Eingriff in ADR-0014, jederzeit reversibel, minimaler Aufwand.
- **Schlecht, weil** der reichhaltigere Datensatz nie zur automatisch aktualisierten Standardquelle wird — widerspricht dem Ziel, ihn produktiv zu nutzen.

### Option 2 (Fork-Ziel tauschen, Revision-Problem ignorieren)

- **Gut, weil** am wenigsten zusätzlicher Aufwand beim Fork-Setup.
- **Schlecht, weil** es ADR-0014s dokumentierte Begründung direkt untergräbt und Datenfixes bei bestehenden Nutzern nie ankommen — der Fehler, den ADR-0014 ursprünglich beheben sollte, kehrt durch die Hintertür zurück.

### Option 3 (Fork-Ziel tauschen, eigene Revision-CI)

- **Gut, weil** einzige Option, die Datenqualität und Update-Zuverlässigkeit gleichzeitig liefert.
- **Schlecht, weil** zusätzliche CI-Infrastruktur in einem zweiten Repository selbst gebaut und gepflegt werden muss.
