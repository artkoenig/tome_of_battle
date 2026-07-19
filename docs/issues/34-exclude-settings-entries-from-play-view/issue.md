Status: resolved
Type: fix
Blocked by: None

## Description
# PRD: Listenkonfigurationen korrekt erkennen und darstellen

## Problem Statement / Bug Description
Battlescribe-Kataloge (z. B. die WHFB6 Definitive Edition) modellieren listenweite
Regel-Schalter wie „Allow experimental rules?" oder „Allow special characters?"
als ganz normale `selectionEntry` vom Typ `upgrade` — keine spielbaren Einheiten.
`PlayMode.jsx` (Spieleansicht) und `RosterEditor.jsx` (Heerlager-Editor) gruppieren
Selections aber rein nach Kategorie-Zugehörigkeit, ohne je den aufgelösten Typ zu
prüfen. Dadurch erscheinen diese Schalter fälschlich wie Einheiten: in der
Spieleansicht als vollwertige, aber leere Einheitenkarte; im Editor als
`UnitSelectionCard`, optisch nicht von einer echten Einheit unterscheidbar
(Kosten-Badge nur zufällig unterdrückt, weil 0 Pkt.; leerer Profil-Umschalter;
Kopieren-/Löschen-Aktionen wie bei einer Einheit).

Aktuell: Listenkonfigurationen werden wie Einheiten gerendert.
Erwartet: Sie werden als eigener Begriff „Listenkonfiguration" erkannt (siehe
`CONTEXT.md`) und in beiden Ansichten entsprechend anders behandelt.

## Solution
Ein gemeinsames, datengetriebenes Kriterium bestimmt, ob eine Selection eine
Listenkonfiguration ist — generisch über alle Kataloge/Datenquellen hinweg
(ADR-0003), nicht auf Kategorienamen oder Fraktionen hartkodiert. Damit wird:

- die Spieleansicht so gefiltert, dass Listenkonfigurationen dort vollständig
  ausgeblendet bleiben;
- der Editor so erweitert, dass die Selections einer Kategorie, die ausschließlich
  Listenkonfigurationen sind, statt als Einheitenkarten als eine einzige
  aufklappbare Karte je Kategorie erscheinen — Kartentitel dynamisch der echte
  Kategoriename, darin jeder Haupteintrag als Unterkategorie mit seinen Optionen
  als direkt klickbaren Radio-Zeilen.

## User Stories / Requirements
1. Als Spieler in der Spieleansicht möchte ich, dass listenweite Regel-Schalter
   nicht als Einheiten erscheinen, damit dort nur tatsächlich spielbare Einheiten
   sichtbar sind.
2. Als Listenbauer im Editor möchte ich listenweite Regel-Schalter optisch und
   strukturell von Einheiten unterschieden sehen, damit ich sie nicht mit
   spielbaren Modellen verwechsle, aber trotzdem sehen und ändern kann, welche
   Regelquelle aktiv ist.
3. Als Listenbauer möchte ich die gewählte Option eines Schalters direkt per Klick
   auf eine Options-Zeile ändern, ohne einen einheitentypischen Konfigurations-
   Dialog zu öffnen.

## Technical Decisions
- Affected Modules: `src/components/PlayMode.jsx`, `src/components/RosterEditor.jsx`,
  `src/solver` (neues Prädikat), `CONTEXT.md` (Begriff „Listenkonfiguration",
  bereits ergänzt).
- Technical Clarifications / Architectural Decisions:
  - Kriterium „Listenkonfiguration": `resolved.type === 'upgrade'` **und** der
    gesamte Teilbaum (Eintrag + alle `selectionEntries`-Kinder) ist durchgehend
    profil- und kostenlos **und** der Eintrag hängt direkt an der Armeeliste
    (Top-Level-Selection einer Force, nicht verschachtelt unter einer Einheit).
  - Das Kriterium muss generisch/datengetrieben bleiben (Schema-Typ + Struktur-
    prüfung), keine Kategorie-ID-/Namens-Sonderfälle (ADR-0003). Verifiziert: hat
    keinen Effekt auf die Ergofarg-Datenquelle (dort existieren aktuell keine
    solchen Einträge) und erkennt beide bekannten WHFB6-Definitive-Edition-Fälle
    korrekt („Allow experimental rules?", „Allow special characters?").
  - Spieleansicht: erkannte Listenkonfigurationen werden vollständig ausgeblendet
    — keine ersatzweise Sichtbarkeit (z. B. „aktive Regeln"-Leiste).
  - Editor: eine aufklappbare Karte je Kategorie, deren Selections ausschließlich
    Listenkonfigurationen sind; Kartentitel = echter, dynamischer Kategoriename
    (kein erfundener Sammelbegriff, kein „x von y aktiv"-Zähler); eingeklappt
    zeigt die Karte die aktuell gewählten Optionen als Badges (gleicher visueller
    Stil wie die bestehenden `upgrade-badge`/`rule-badge`-Chips auf Einheitenkarten,
    nur mit der Info-Akzentfarbe statt Gold) — ein Haupteintrag ohne Auswahl
    („Keine") erzeugt keine Badge; aufgeklappt listet die Karte die Optionen aller
    Haupteinträge direkt untereinander als klickbare Radio-Zeilen (inkl. „Keine"
    je Haupteintrag) — ohne die Namen der Haupteinträge als Zwischenüberschriften;
    Klick auf eine Zeile wählt sie direkt, kein separater Dialog; kein Kosten-Slot,
    keine Kopieren-/Löschen-Aktionen.
- API Contracts / Data Models: keine neuen — nutzt bestehende `resolveEntry()`
  und das bestehende Selection-/Roster-Modell.

## Testing Decisions
- Modules to Test: neues Klassifikations-Prädikat (isoliert gegen Fixture-Daten),
  `PlayMode.jsx`, `RosterEditor.jsx`.
- Test Interfaces (Seams):
  - `isListConfiguration({ system, force, selection, catalogueId })` — neues
    reines Solver-Prädikat.
  - `PlayMode.jsx` → `getGroupedAndSortedSelections` — schließt zutreffende
    Selections aus den Gruppen aus.
  - `RosterEditor.jsx`-Kategorie-Rendering — wechselt zur neuen aufklappbaren
    Karte, wenn eine Kategorie ausschließlich Listenkonfigurationen enthält.

## Out of Scope
- Änderungen an `CategoryUnitAdder.jsx` (Aushebe-Dialog) — gruppiert bereits
  heute korrekt nach echtem Kategorienamen.
- Quellenspezifische Sonderbehandlung für Ergofarg — Prädikat ist generisch,
  Quelle hat aktuell keine passenden Einträge.
- Eine Sichtbarkeits-Leiste für ausgeblendete Listenkonfigurationen in der
  Spieleansicht — bewusst nicht Teil dieser Änderung.
- Versions-Bump / Release — folgt dem üblichen Projekt-Workflow erst bei
  Auflösung des Main-Issues.

## Acceptance Criteria
- [ ]

## Comments
- Vier-Achsen-Verifikation (2 Durchläufe) grün: Standards-Gate PASS, Spezifikation erfüllt (keine fehlenden Anforderungen/Scope-Creep von Belang), Vitest 75/75 Dateien grün, Docs konsistent. E2E-Puppeteer-Test bleibt rot durch vorbestehende Sandbox-Netzwerkeinschränkung (gegen unveränderten origin/main-Baseline verifiziert, kein Bezug zum Diff). Nachbesserungen aus Runde 1 (tote Imports in PlayMode.jsx, RosterEditor-Coverage für Armeeweite-Auswahl/Sonstiges-Buckets, README/Audit-Doku/ADR-0003-Ergänzung, PRD-Signatur-Korrektur) gemergt. Version auf 1.2.1 gebumpt.
