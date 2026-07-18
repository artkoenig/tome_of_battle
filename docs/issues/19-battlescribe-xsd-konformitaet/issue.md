Status: claimed
Type: fix
Blocked by: None

## Description
# PRD: BattleScribe-XSD-Konformität (generische Formatunterstützung)

### Problem Statement / Bug Description

Parser (`src/parser/xmlParser.js`) und Evaluator (`src/solver/`) unterstützen das
BattleScribe-Datenformat nur so weit, wie die zufällig importierten WHFB6-Daten es
ausreizen — nicht so weit, wie die **offizielle `Catalogue.xsd` (v2.03,
[BSData/schemas](https://github.com/BSData/schemas))** es als gültig definiert. Eine
Gegenüberstellung XSD ↔ Code ergab 9 bestätigte Abweichungen. Da Kataloge seit
ADR-0014 **zur Laufzeit** aus einem Community-Fork geladen werden, kann jede
schema-gültige Datei jedes dieser Konstrukte enthalten; heute werden sie still falsch
oder gar nicht verarbeitet.

**Ist-Verhalten (auf schema-gültigen Dateien):**
1. `modifierGroup`-eigene `conditions`/`repeats` werden verworfen (Parser flacht Gruppen ab) → enthaltene Modifier feuern bedingungslos.
2. `condition`/`repeat`-Attribut `includeChildSelections` wird im Evaluator ausgewertet, aber nie geparst → Kind-Auswahlen werden nie mitgezählt.
3. Modifier-Typen `add`/`remove`/`set-primary`/`unset-primary` werden nirgends behandelt → konditionale Kategorie-Zuordnung wird ignoriert.
4. `infoGroups`/`sharedInfoGroups` und `infoLink type="infoGroup"` werden nicht geparst → darin gebündelte Profile/Regeln gehen verloren.
5. Profil-Typ wird als `profileTypeId`/`profileTypeName` gelesen statt `typeId`/`typeName` → `profileTypeId` ist immer null.
6. Constraint-Attribute `percentValue`/`includeChildSelections`/`includeChildForces` werden nicht geparst → Prozent-Constraints und Kind-Einbeziehung falsch.
7. `catalogueLink@importRootEntries` wird nicht geparst → Library-Import-Semantik unvollständig.
8. `costType@hidden` wird nicht geparst → versteckte Kostenarten werden angezeigt.
9. `publication@publisherUrl` wird als `website` gelesen → immer null.

**Soll-Verhalten:** Jede schema-gültige `.cat`/`.gst` wird korrekt und vollständig
geparst, ausgewertet **und angezeigt** — verifiziert an der offiziellen XSD und an
synthetischen, generischen Fixtures, nicht an WHFB6.

### Solution

Vier Schichten entlang der Verarbeitungs-Pipeline:

- **(A) Korrektheit/Vollständigkeit.** Die 9 Abweichungen in Parser und Evaluator schließen; Datenmodell und Auswertung an die XSD angleichen.
- **(B) XSD als Single Source of Truth.** Die `Catalogue.xsd` versioniert ins Repo vendoren (pinned) und daraus per `npm run generate:schema` ein **committetes** Enum-/Attributnamen-Modul generieren, das Parser und Evaluator konsumieren. Ein Guard-Check erzwingt „committed == aus vendored XSD generiert". Killt die Drift-Klasse hinter #1–#9.
- **(C) Import-Validierung (Advisory).** Jede importierte `.cat`/`.gst` wird vor dem Parsen mit `xmllint-wasm` gegen die vendored XSD validiert; bei Schemaverstoß wird der Import **fortgesetzt** und der Verstoß als maschinell verortbare **Warnung** (Datei + Element/Zeile) sichtbar gemacht — kein Abbruch. Gilt auch für den Laufzeit-Fork-Abruf. (Revision 2026-07-18: ursprünglich als Hard-Gate spezifiziert und in Kind-Issue 02 so umgesetzt; auf Advisory geändert und in Kind-Issue 08 nachgezogen, weil reale, funktionierende Kataloge die strikte XSD-`sequence` verletzen und ein Hard-Gate sie fälschlich ablehnen würde — siehe ADR 0016.)
- **(D) UI-Renderer-Audit.** Systematischer, **endlicher** Durchgang als Checkliste: jedes anzeige-relevante XSD-Konstrukt → sein Renderer → Soll/Ist; Abweichungen werden gefixt, sodass neu/korrekt geparste Daten auch tatsächlich angezeigt werden.

Technologie-/Struktur-Entscheidungen (Vendoring, `xmllint-wasm`, Hard-Gate, Codegen)
sind in **[ADR 0016](../../adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)**
festgehalten. Die Advisory-Prüfung meldet **strukturelle** Abweichungen; „erlauben schlägt
verbieten" betrifft **Roster-Bau-Constraints** (Semantik) — andere Ebene, kein Widerspruch.

### User Stories / Requirements

1. Als **Nutzer** möchte ich einen beliebigen schema-gültigen Community-Katalog importieren und dass **alle** darin definierten Einheiten, Optionen, Profile und Regeln korrekt erscheinen — nicht nur WHFB6-typische Konstrukte.
2. Als **Nutzer** möchte ich, dass konditionale Regeln (modifierGroup-Bedingungen, `includeChildSelections`, dynamische Kategorie-Zuordnung via `add`/`remove`/`set-primary`) korrekt greifen, damit Validierung und Punkte stimmen.
3. Als **Nutzer** möchte ich, dass in `infoGroups` gebündelte Profile/Regeln an der Einheit sichtbar sind.
4. Als **Nutzer** möchte ich beim Import einer **schema-ungültigen** Datei eine klare, verortbare Warnung (Datei + Zeile) erhalten, während der Import fortgesetzt wird — statt stiller Fehlverarbeitung oder Ablehnung funktionierender Daten. (Revision 2026-07-18: Die Warnung wird nicht mehr in der UI angezeigt, sondern nur noch per `console.warn` protokolliert — siehe Kind-Issue 12 und ADR 0016. Grund: Das Rendern der Warnung im Importer verursachte beim Erstimport einen sichtbaren Zwischen-Frame zwischen Ladeoverlay und Heerlager-Ansicht. Der Import bleibt advisory; nur die Sichtbarkeit wechselt von UI-Box auf Konsole.)
5. Als **Entwickler** möchte ich, dass unterstützte Enums/Attributnamen aus der offiziellen XSD generiert werden, damit sie nicht mehr von Hand driften.
6. Als **Entwickler** möchte ich synthetische, generische Fixtures pro Konstrukt, damit Konformität unabhängig von WHFB6 testbar ist.
7. Als **Maintainer** möchte ich, dass ein XSD-Update mit neuen gültigen Werten den Guard-Check laut fehlschlagen lässt, damit die Aktualisierung bewusst erfolgt.

### Technical Decisions

- **Affected Modules:**
  - Parser: `src/parser/xmlParser.js` (Attribut-/Element-Erfassung #1–#9, infoGroups, modifierGroup-Struktur).
  - Evaluator: `src/solver/modifierEvaluator.js` (includeChildSelections, modifierGroup-Gating, neue Modifier-Typen); ggf. `rosterCounter.js`/`rosterValidator.js` (percentValue/includeChildForces).
  - Bridge/Anzeige: `src/solver/profileCollector.js` + Renderer (`PlayUnitDetails`, `UnitSelectionCard`, `SelectionConfigurator`, `upgradeDetails`, `UnitChips`, `OptionGroup`) für (D).
  - Neu: vendored `Catalogue.xsd`, generiertes Enum-Modul, `src/parser/schemaValidator.js`, Codegen-Script + `npm run generate:schema`.
  - Import-Pfad: `src/components/Importer.jsx` / `src/parser/zipExtractor.js` (Gate-Einbindung); der Laufzeit-Fork-Abruf (ADR 0014) muss das Gate passieren.
- **Architektur-Entscheidungen:** siehe **ADR 0016** (Vendoring+Pinning der XSD, `xmllint-wasm`, Hard-Gate, Codegen-SSOT).
- **API Contracts / Data Models:**
  - Neuer Seam `validateAgainstSchema(xmlText, kind)` → `{ valid, errors: [{ line, column, message }] }`; `kind ∈ {catalogue, gameSystem, roster}` (steuert den Namespace-Tausch).
  - Generiertes Enum-Modul exportiert die geschlossenen Mengen (SelectionEntryKind, InfoLinkKind, EntryLinkKind, CatalogueLinkKind, ConstraintKind, ModifierKind, ConditionKind, ConditionGroupKind) + kanonische Attributnamen.
  - Modifier-Semantik (exakte Feld-Zuordnung bei Implementierung gegen Wiki/`wham` bestätigen): `add`/`remove` = Kategorie-Zugehörigkeit hinzufügen/entfernen; `set-primary`/`unset-primary` = Primär-Flag setzen/lösen; alle konditional.

### Testing Decisions

- **Modules to Test:** Parser, Evaluator, profileCollector, rosterValidator/rosterCounter, neuer schemaValidator, Enum-SSOT-Guard, betroffene Renderer.
- **Test Interfaces (Seams):**
  - `parseCatalogueXML` / `parseGameSystemXML` — #1–#9, infoGroups, modifierGroup-Struktur.
  - `evaluateCondition` / `evaluateConditionGroup` / `getModifiedConstraintValue` — includeChildSelections, modifierGroup-Gating, add/remove/set-primary-Effekte.
  - `collectUnitProfilesAndRules` — InfoGroup-Profile/Regeln, Kategorie-Effekte.
  - `validateRoster` / `computeRosterCounts` — Regressionsschutz.
  - `validateAgainstSchema(xml, kind)` — akzeptiert gültig / lehnt ungültig ab / liefert verortbare Fehler.
  - Enum-SSOT-Guard — committed == aus vendored XSD generiert.
  - Renderer-Tests (`*.test.jsx`) — jedes anzeige-relevante Konstrukt rendert.
  - **Fixtures:** neue, synthetische, minimale, **schema-gültige** `.cat`/`.gst` (generisch, nicht WHFB6), eine pro Konstrukt, plus je eine bewusst **ungültige** fürs Gate.

### Out of Scope

- Semantische/referentielle Integritätsprüfung über die XSD-Struktur hinaus (targetId-Auflösbarkeit, Regel-Auswertungssemantik) — leistet die XSD nicht; bleibt `wham`/Engine + bestehenden Tests überlassen.
- Behebung von Datenlücken in konkreten Katalogen — Daten-Pflege im Fork, kein App-Fix (vgl. Memory „prefer catalog data fix").
- Roster-Serialisierungs-Adapter (`.ros`) über den Regressionsschutz hinaus — eigene Baustelle (PRD-roster-serialization-adapter).
- Ältere Formatversionen < 2.03 und `vNext`-Konstrukte; Ziel ist die gepinnte v2.03.
- Migrations-XSLT (`Catalogue_2_0x.xsl`) zur Aufwärtskonvertierung alter Dateien.

## Acceptance Criteria
- [ ] Alle in `## Description` beschriebenen User Stories/Requirements aus dem PRD sind erfüllt
- [ ] Alle Kind-Issues sind resolved

## Comments
- 2026-07-18: PRD via grill-me-for-spec erstellt. Scope A+B+C+D (D = voller UI-Renderer-Audit) auf Nutzerwunsch. Grundlage: XSD-vs-Code-Vergleich mit 9 bestaetigten Luecken; Entscheidungen in ADR 0016. Bereit fuer Decompose in Kind-Issues.
- 2026-07-18: Alle 11 Kind-Issues implementiert und gemergt. Vier-Achsen-Verifikation in 3 Runden: Runde 1 (Smells+Doku) -> Issue 09; Runde 2 (Seam-Adoption unvollstaendig + Doku-Widerspruch, echte Play-Mode-Regression) -> Issue 10; Runde 3 (E2E-Flakiness durch sequenzielle xmllint-wasm-Validierung + triviale Reste) -> Issue 11. Endstand: npm test (vitest 548 + Puppeteer-E2E) grruen und stabil, Standards-Gate PASS, Spec ohne offene Requirements/Scope-Creep, Doku konsistent. Hard-Gate -> Advisory per ADR 0016 Rev. 2026-07-18 (reale Kataloge verletzen strikte XSD-sequence).
- 2026-07-18: Kind-Issue 12 nachgezogen (Erstimport-Flash + Warnungen auf Konsole). Grund: Nutzer meldete sichtbaren Zwischen-Frame zwischen Ladeoverlay und Heerlager beim allerersten Import; E2E-Reproduktion bestaetigte das Timing-Problem. Fix: App.handleSystemImported awaited loadAllData vor navigate; Importer awaitet onSystemImported innerhalb des try-Blocks. Als bewusste Nutzerentscheidung wurde dabei die advisory Schema-Warnung (US4/ADR 0016) von einer sichtbaren UI-Box auf reines console.warn-Logging zurueckgestuft (Revisionseintraege in ADR 0016, dieser Issue.md sowie README/battlescribe-data-format.md ergaenzt). npm test (548 vitest + Puppeteer-E2E) gruen.
