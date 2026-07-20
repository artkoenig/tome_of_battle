Status: resolved
Type: fix
Blocked by: None

## Description

# PRD: Special list rules als schaltbare Ankreuzliste (Checkbox)

## Problem Statement / Bug Description

Die Katalog-„Special list rules" sind Wurzel-Einträge einer Force vom Typ
`type="upgrade"` mit `import="true"` (z. B. „Allow experimental rules?",
„Allow special characters?", „Campaign/Scenario rules", „Mercenaries and
Regiments of Renown"). In den Daten gibt es zwei Ausprägungen:

- **Leerer Schalter** ohne Kindeinträge (z. B. „Allow special characters?"): In
  Battlescribe ist allein die **Anwesenheit** des Eintrags das Signal „an".
- **Behälter** mit Unteroptionen (z. B. „Campaign/Scenario rules").

Diese Wurzel-Tore steuern über Battlescribe-`conditions`/`modifiers` andere
Inhalte (z. B. `atLeast 1 … childId=<rule-id>` hebt eine Einheit von `max 0`
auf `max 1`, kippt `hidden`, erzeugt/entfernt Hinweis-Fehler; allein das Muster
„Allow special characters?" wird ~163-mal über 17 Kataloge referenziert).

**Aktuelles Verhalten (nach Issue 34):** Alle Listenregeln werden beim Laden
**auto-materialisiert** (dauerhaft präsent), „+"-Adder und Löschen-Menü sind
ausgeblendet. Dadurch sind die leeren Schalter in **jeder** Liste permanent
„an" — ihr nachgelagerter Effekt ist eine Konstante statt einer
Nutzerentscheidung. Der Solver liest die Auswahlen korrekt
(`rosterCounter` → `modifierEvaluator` → `rosterValidator`/`entryVisibility`);
der Fehler liegt darin, dass die Materialisierung den „gewählt"-Zustand
erzwingt. Der Nutzer kann eine Regel weder abschalten noch erkennen, dass sie
bereits aktiv ist (die als Frage formulierte Beschriftung wirkt unbeantwortet).

**Erwartetes Verhalten:** Der An/Aus-Zustand jeder Listenregel ist eine echte,
sichtbare Nutzerentscheidung. Aktivieren einer Regel beeinflusst die Liste
(schaltet gesperrte Einheiten/Optionen frei); Deaktivieren sperrt sie wieder.

## Solution

Die Auto-Materialisierung entfällt. Die „Special list rules"-Gruppe rendert
statt materialisierter Karten eine **flache Ankreuzliste**:

- Je ein **Ankreuzfeld** pro Listenregel des Katalogs (datengetrieben
  aufgezählt, ob vorhanden oder nicht), **angehakt ⇔ im Roster präsent**.
- **Anhaken fügt den Eintrag hinzu, Abhaken entfernt ihn** — das Ankreuzfeld ist
  Hinzufügen und Entfernen in einem und ersetzt damit sowohl den „+"-Adder als
  auch das ⋮-/Löschen-Menü.
- **Vorgabe: leer** (alle Regeln „aus") = der echte Battlescribe-Standard.
- **Behälter-Regeln** zeigen ihre Unteroptionen **direkt und eingerückt unter
  ihrer Ankreuz-Zeile** als schlichte Options-Steuerelemente — **kein**
  ausklappbarer Behälter, **keine** Karte, **keine** „Optionen & Ausrüstung
  konfigurieren"-Überschrift, **kein** separater Ausklapp-Knopf.

Die äußere „Special list rules"-**Gruppe** bleibt wie aus Issue 34 ein
**einklappbarer Abschnitt, per Vorgabe zugeklappt** — nur ihr *Inhalt* wird zur
Ankreuzliste. Da Listenregeln damit keine Einheiten-Karten mehr sind, entfallen
für sie auch die `UnitUpgradesChips` (Badges) inhärent — ohne Sonderfall.

Es ist **kein Migrationscode** für bestehende Listen nötig: Das Ankreuzfeld
leitet seinen Zustand rein aus der Roster-Präsenz ab. Bestehende Listen (Regel
enthalten) erscheinen angehakt, neue Listen leer — dieselbe Darstellungslogik,
nicht-destruktiv.

## User Stories / Requirements

1. Als Listenbauer möchte ich jede Listenregel per Ankreuzfeld an- und
   ausschalten, um zu steuern, welche Sonderregeln meine Liste nutzt.
2. Als Listenbauer möchte ich auf einen Blick sehen, welche Listenregeln aktiv
   sind (angehaktes Feld), damit als Frage formulierte Regeln nicht
   unbeantwortet wirken.
3. Als Listenbauer möchte ich, dass das Aktivieren einer Regel die Liste
   tatsächlich beeinflusst (z. B. Spezial-Charaktere freischaltet) und das
   Deaktivieren sie wieder sperrt.
4. Als Listenbauer möchte ich die Unteroptionen einer Behälter-Regel direkt
   unter ihrem Ankreuzfeld konfigurieren, sobald sie aktiv ist.
5. Als Listenbauer möchte ich die „Special list rules"-Gruppe weiterhin
   eingeklappt vorfinden und im Spielmodus gar nicht sehen.

## Technical Decisions

- **Betroffene Module:** `src/solver/listRules.js` (Aufzählung + Zustand;
  Entfernung von `materializeListRules`), `src/hooks/useRoster.js` (Entfernung
  des Materialisierungs-`useEffect`), `src/components/RosterEditor.jsx`
  (Ankreuzlisten-Rendering für Listenregel-Gruppen), neue
  Ankreuzlisten-Komponente unter `src/components/editor/`, ggf. Rückbau der
  `isListRule`-Sonderpfade in `UnitSelectionCard.jsx`/`SelectionConfigurator.jsx`,
  `CategoryUnitAdder.jsx` (Adder für Listenregel-Gruppen entfällt).
- **Architektonische Entscheidungen:**
  - Datengetriebene Erkennung bleibt bindend (ADR 0003): keine hartkodierten
    Regelnamen/-ids; leer-vs-Behälter und binär-vs-nicht-binär werden aus der
    Katalogstruktur/den Constraints abgeleitet.
  - **Einheitliches Ankreuzfeld = Präsenz des Wurzel-Eintrags**, mit
    datengetriebenem **Rückfall auf den Mengen-Adder**, falls eine Listenregel
    eine echte nicht-binäre Beschränkung (`max>1`/Zahlenwert) trägt (bei den
    Wurzel-Toren bislang nirgends belegt).
  - **ADR 0011** ist zu aktualisieren: Die in Issue 34 dokumentierte Ausnahme
    „auto-materialisierte Listenregeln" entfällt, da die Materialisierung
    zurückgebaut wird; Listenregeln folgen wieder dem Referenzmodell (Roster
    hält nur Nutzer-Entscheidungen).
- **Datenmodell:** Unverändertes Roster-Schema/`.ros`; eine aktive Regel ist
  schlicht eine vorhandene Selection. Kein neues Feld, keine Serialisierungs-
  änderung.

## Testing Decisions

- **Zu testende Module:** `listRules.js`, die neue Ankreuzlisten-Komponente, der
  Solver-Rand (`rosterValidator`/`entryVisibility`), PlayMode (Regression).
- **Test-Nähte (Seams):**
  - **A —** `listRules.js` reine Logik: Aufzählung der Listenregeln einer
    Kategorie samt `{ entry, categoryId, resolvedId, checked, isBinary }`;
    Entfall von `materializeListRules` (Funktion + Tests). Gemockter Resolver.
  - **B —** Ankreuzlisten-Komponente (vitest/RTL): rendert ein Ankreuzfeld pro
    Katalog-Listenregel; angehakt ⇔ präsent; An-/Abhaken ruft
    Hinzufügen/Entfernen; Behälter zeigt Unteroptionen inline bei „an";
    nicht-binäre Regel fällt auf den Mengen-Adder zurück.
  - **C —** Nachgelagerte Wirksamkeit (die in Issue 34 fehlende Deckung): Am
    Solver-Rand beweisen, dass *Präsenz* einer Listenregel einen dahinter
    gesperrten Eintrag freischaltet (`max 0→1`/`hidden`-Flip) und *Abwesenheit*
    ihn sperrt. Nutzt `src/solver/__fixtures__/whfb6-lexicanum/special-characters-hint.cat.xml`.
  - Unverändert grün: PlayMode-Tests (Listenregeln bleiben ausgeblendet).

## Out of Scope

- Änderung des Roster-Schemas oder des `.ros`-Serialisierungsformats.
- Aktive Bereinigung/Migration bereits gespeicherter Listen (nicht-destruktiv;
  vorhandene Regel-Selections bleiben, erscheinen angehakt).
- Änderung der Solver-Auswertungslogik selbst (`modifierEvaluator`/`condition`-
  Auswertung) — sie ist korrekt; nur der ihr zugeführte Zustand wird zur echten
  Nutzerentscheidung.
- Darstellung/Interaktion der Listenregeln im Spielmodus (bleibt ausgeblendet).
- Neue Systemquirks o. Ä.

## Acceptance Criteria
- [ ] Beim Laden eines Rosters werden keine Listenregeln mehr auto-materialisiert; `materializeListRules` und der zugehörige `useEffect` in `useRoster` sind entfernt.
- [ ] Die „Special list rules"-Gruppe rendert eine flache Ankreuzliste: je ein Ankreuzfeld pro Katalog-Listenregel der Kategorie (datengetrieben aufgezählt, auch wenn nicht präsent), angehakt genau dann, wenn der Eintrag im Roster präsent ist.
- [ ] Anhaken fügt den Regel-Eintrag der Liste hinzu; Abhaken entfernt ihn. „+"-Adder und ⋮-/Löschen-Menü erscheinen für Listenregeln nicht mehr.
- [ ] Vorgabezustand einer neuen Liste: alle Listenregeln aus (kein Eintrag präsent).
- [ ] Das Aktivieren einer reinen Schalter-Regel beeinflusst die Liste nachweislich (ein dahinter gesperrter Eintrag wird von `max 0` auf `max 1` freigeschaltet bzw. `hidden` kippt); Deaktivieren sperrt ihn wieder (Seam C, Fixture `whfb6-lexicanum/special-characters-hint`).
- [ ] Ist eine Behälter-Regel angehakt, erscheinen ihre Unteroptionen direkt und eingerückt unter ihrer Zeile — ohne Karte, ohne „Optionen & Ausrüstung konfigurieren"-Überschrift, ohne separaten Ausklapp-Knopf.
- [ ] Eine nicht-binäre Listenregel (`max>1`/Zahlenwert) fällt datengetrieben auf den Mengen-Adder zurück statt auf ein Ankreuzfeld (kein hartkodierter Regelname/-id; ADR 0003).
- [ ] Die äußere „Special list rules"-Gruppe bleibt ein einklappbarer Abschnitt, per Vorgabe zugeklappt.
- [ ] Für Listenregeln werden keine `UnitUpgradesChips` (Badges) mehr gerendert; für gewöhnliche Einheiten unverändert.
- [ ] Im Spielmodus bleiben Listenregeln ausgeblendet (unverändert).
- [ ] Bestehende gespeicherte Listen werden nicht verändert oder bereinigt; bereits enthaltene Regel-Einträge erscheinen angehakt.
- [ ] ADR 0011 ist aktualisiert: die Ausnahme „auto-materialisierte Listenregeln" ist als aufgehoben vermerkt/entfernt.
- [ ] Roster-Schema und `.ros`-Serialisierung sind unverändert.
- [ ] `npm run lint` und `npm test` sind grün; Seams A/B/C abgedeckt; die `materializeListRules`-Tests sind entfernt; PlayMode-Tests bleiben grün.

## Comments
- Umgesetzt: Auto-Materialisierung entfernt; 'Special list rules' rendern eine datengetriebene Ankreuzliste (ListRuleChecklist) — angehakt ⇔ Präsenz, Behälter-Optionen inline, nicht-binäre Regeln als Mengen-Adder, Gruppe eingeklappt per Vorgabe, Badges/Karten für Regeln entfallen. Solver-Zustand ist wieder eine echte Nutzerentscheidung (Seam C beweist max 0→1). ADR 0011-Ausnahme aufgehoben; Schema/.ros unverändert. Vier-Achsen-Prüfung grün (Standards/Spec/Tests/Docs), Lint sauber, 740 Tests grün; E2E umgebungsbedingt (Sandbox-Netz) übersprungen. Standards-Befunde #1/#4/#5/#6 behoben; #2/#3 als Issues 36/37 abgetrennt. Version 1.3.0 → 1.3.1.
