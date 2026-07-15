Status: resolved
Blocked by: None

## Description

# PRD: Integration der 6th.whfb.app-Regeltexte in den Armeelisten-Builder

> **Architektur-Entscheidung:** Die grundsätzliche Wahl (Verlinkung/Einbettung
> statt Kopie, build-time Name→URL-Lookup, keine neuen Abhängigkeiten) und ihre
> Trade-offs sind in **[ADR-0012](../../adr/0012-integration-externer-regeltexte-6th-whfb-app.md)**
> festgehalten. Dieses Dokument ist die Feature-Spezifikation.

## Problem Statement

Die App zeigt aktuell Regeltexte (Sonderregeln, Waffenbeschreibungen, Magic Items) nur in der knappen Form an, die in den BattleScribe-Datendateien (`.gst`/`.cat`) enthalten ist – meist ein einzelner Satz oder Stichpunkte. Die vollständigen, durch Errata aktualisierten Regelbuch-Texte mit Tabellen, Querverweisen und Kontext sind nicht verfügbar.

## Solution

Die App bindet externe, vollständige Regeltexte von `https://6th.whfb.app/` ein – einem Contentful-basierten, statisch generierten Online-Regelindex für Warhammer Fantasy 6th Edition. Es werden **keine fremden Inhalte kopiert/gehostet**; die App hält nur ein Name→URL-Mapping und öffnet die Original-Seiten.

Die Anzeige erfolgt clientseitig in **zwei Modi** (siehe ADR-0012):

- **Einzelne Regel/Waffe/Magic Item** → Iframe-Dialog (`RulesIndexDialog`) auf der `?minimal=true`-Seite, angelehnt an die Integration von `tow.whfb.app` im [old-world-builder](https://github.com/nthiebes/old-world-builder).
- **Gesamtes Regelbuch** → neuer Browser-Tab auf `https://6th.whfb.app/` (kein Iframe).

**Datenfluss:**
1. Ein Build-Skript generiert aus den Sektions-Index-Seiten von 6th.whfb.app ein Name→URL-Mapping als `rules-index.json`.
2. Ein handgepflegtes `synonyms.js` korrigiert Namensabweichungen zwischen BSData-Einträgen und 6th.whfb.app-Seitentiteln.
3. Zur Laufzeit sucht ein Lookup (`rulesLookup.js`) den Namen eines Regel-/Upgrade-Eintrags im Mapping + Synonyms und liefert die absolute URL.
4. Bei bekanntem Mapping trägt der Chip ein `BookOpen`-Icon; ein Klick öffnet den `RulesIndexDialog` mit Iframe.
5. Bei unbekanntem Mapping bleibt das bisherige Verhalten (Detail-Anzeige im BottomSheet, `Info`-Icon) erhalten – kein Broken Link.

## User Stories / Requirements

1. **Als Spieler** möchte ich auf einer Sonderregel (z. B. "Regeneration") klicken können, um den vollständigen Regeltext aus dem Regelbuch in einem Dialog zu sehen.
2. **Als Spieler** möchte ich auf eine Waffenbezeichnung (z. B. "Halberd") klicken können, um die Waffenregeln inkl. Tabellen angezeigt zu bekommen.
3. **Als Spieler** möchte ich auf einen Magic Item-Namen (z. B. "Sword of Might") klicken können, um die Item-Beschreibung auf 6th.whfb.app zu sehen.
4. **Als Spieler** möchte ich im Spielmodus einen "Regelbuch"-Button haben, der das digitale Regelbuch auf 6th.whfb.app öffnet.
5. **Als Entwickler** möchte ich das Name→URL-Mapping per Skript automatisch generieren und bei Bedarf aktualisieren können, um neuen Inhalten auf 6th.whfb.app zu folgen.
6. **Als Administrator/Entwickler** möchte ich Namensabweichungen zwischen BSData und 6th.whfb.app manuell in einer Synonyms-Datei korrigieren können, ohne das Mapping-Skript anpassen zu müssen.

## Technical Decisions

### Betroffene Module

| Modul | Änderung |
|-------|----------|
| **Neu: `scripts/generate-rules-index.js`** | CLI-Skript (manuell gestartet, `node scripts/generate-rules-index.js`). Crawlt die Index-Seiten der Sektionen `special-rules`, `weapons`, `magic-items`, `spell-lists`, `characteristics`, parst je `<a href>`-Links mit Seitentiteln und schreibt `src/data/rules-index.json`. UTM-Parameter (`utm_source=6th-builder&utm_medium=referral`) werden in den gespeicherten Pfaden abgelegt. Node 18+ `fetch`, keine Dependencies. |
| **Neu: `src/data/rules-index.json`** | Auto-generierte Datei, wird eingecheckt (~845 Einträge). Format: `{ "Rule Name": "/section/page-slug?minimal=true&utm_source=6th-builder&utm_medium=referral", ... }`. |
| **Neu: `src/data/synonyms.js`** | Handgepflegt. Exportiert `SYNONYMS = { "BSData Name": "Canonical Name from rules-index" }`. |
| **Neu: `src/data/rulesLookup.js`** | Exportiert `getRuleUrl(name) → string | null`. Konsultiert zuerst die Synonyms, dann `rules-index.json` (case-insensitive) und stellt `BASE_URL` (`https://6th.whfb.app`) voran. Gibt `null` zurück, wenn kein Mapping existiert. |
| **Neu: `src/components/RulesIndexDialog.jsx`** | Modal-Dialog (eigenständige Komponente, kein `ConfirmationDialog`-Reuse). Props: `ruleName`, `url`, `isOpen`, `onClose`. Rendert einen Iframe mit der übergebenen `url`. Zeigt einen Spinner beim Laden, sperrt `body`-Scroll und schließt bei `Escape`/Overlay-Klick. Lokaler State, kein globaler Context (ADR-0010). **Fehlerzustand:** Lade-Timeout (15 s) + `onError` → Meldung „Keine Verbindung zu 6th.whfb.app" mit „Erneut versuchen" (remountet den Iframe per `key`). |
| **Neu: `src/components/editor/RuleChipIcon.jsx`** | Gemeinsame Komponente für das End-Icon eines Chips/Eintrags. Zentralisiert die **Link-Priorität**: bei `getRuleUrl(name)` → `BookOpen` (Klick → `onShowRule`), sonst bei `hasInfo` → `Info` (Hover/Click-Handler injiziert), sonst nichts. Von allen Aufruforten genutzt → konsistentes Verhalten. |
| **Neu: `src/components/editor/upgradeDetails.jsx`** | Gemeinsame `renderUpgradeDetails(res, system)` (zuvor identisch in UnitChips, SelectionConfigurator und OptionGroup dupliziert). Einzige Quelle für die Katalog-Detailansicht. |
| **Bestehend: `src/components/editor/UnitChips.jsx`** (`UnitRulesChips`, `UnitUpgradesChips`) | Chips nutzen `RuleChipIcon`. Bei Treffer: `BookOpen` und Klick ruft `onShowRule(name)`. Ohne Treffer, aber mit Beschreibung: `Info` (Hover-Tooltip / BottomSheet). Neuer Prop `onShowRule`. |
| **Bestehend: `src/components/editor/SelectionConfigurator.jsx`** | Standalone-Optionen nutzen `RuleChipIcon` (gleicher Mechanismus). Reicht `onShowRule` an `OptionGroup` durch. |
| **Bestehend: `src/components/editor/OptionGroup.jsx`** | **Gruppierte** Optionen (Magic Items/Waffen in Gruppen) nutzen jetzt ebenfalls `RuleChipIcon` und öffnen bei Mapping den Dialog. Neuer Prop `onShowRule`. |
| **Bestehend: `src/components/RosterEditor.jsx`** | Hält den Dialog-State (`rulesDialogRule`), reicht `onShowRule` an die Chips/Configurator durch und rendert `RulesIndexDialog` mit `url={getRuleUrl(rulesDialogRule)}`. |
| **Bestehend: `src/components/PlayMode.jsx`** | Neuer **"Regelbuch"-Button** (`BookOpen`-Icon) in der Toolbar. Klick öffnet `https://6th.whfb.app/?utm_source=6th-builder&utm_medium=referral` **in einem neuen Tab** (`window.open(..., '_blank')`). Hält zusätzlich den `rulesDialogRule`-State für die Chip-Dialoge und rendert `RulesIndexDialog`. |
| **Bestehend: `src/components/play/PlayUnitDetails.jsx`** | `UnitUpgradesChips` und `UnitRulesChips` erhalten den `onShowRule`-Callback von `PlayMode`. |

### Technische Klärungen / Architekturentscheidungen

Vollständig in **[ADR-0012](../../adr/0012-integration-externer-regeltexte-6th-whfb-app.md)**. Kurzfassung:

- **Zwei Öffnungs-Verhalten:** Einzelregel → Iframe-Dialog (`?minimal=true`); Gesamt-Regelbuch → neuer Tab. Die ursprünglich geplante Iframe-Einbettung des Gesamt-Regelbuchs (`/digital-rulebook`) wurde bewusst zugunsten des neuen Tabs revidiert (bessere Navigation außerhalb des beengten Modals).
- **Dialog-State:** Lokaler State in `RosterEditor`/`PlayMode`, kein globaler Context (ADR-0010).
- **Mapping-Aktualisierung:** Manuell per Skript, generiertes JSON wird eingecheckt. Kein Crawl zur Build- oder Laufzeit.
- **Offline-Verhalten:** Der Iframe zeigt nativ die Browser-Fehlerseite; der Rest der App bleibt voll funktionsfähig. Kein Service-Worker-Caching externer Inhalte (ADR-0002).
- **UTM-Parameter** zur Traffic-Attribution an alle Ziel-URLs.
- **CORS / Embedding:** 6th.whfb.app unterstützt `X-Frame-Options`-freies Embedding und den `?minimal=true`-Parameter (verifiziert). Kein Server-Proxy nötig.
- **Umfang des automatischen Mappings:** Nur globale Regeln mit eigener Seite. Armee-spezifische Anker-Regeln werden nicht automatisch gecrawlt; bei Bedarf manuell über `synonyms.js`.
- **Keine neuen Abhängigkeiten.**

### API Contracts / Data Models

```js
// src/data/rules-index.json  (auto-generiert)
{
  "Killing Blow": "/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral",
  "Halberd": "/weapons/halberd?minimal=true&utm_source=6th-builder&utm_medium=referral",
  ...
}

// src/data/synonyms.js
export const SYNONYMS = {
  'Short Bow': 'Shortbow',
  'Long Bow': 'Longbow',
  ...
};

// src/data/rulesLookup.js
export function getRuleUrl(name) {
  if (!name) return null;
  const canonical = synonymIndex.get(name.toLowerCase()) || name; // Synonyms case-insensitiv
  const path = index.get(canonical.toLowerCase());                // aus rules-index.json
  return path ? `https://6th.whfb.app${path}` : null;
}
```

> Hinweis: Regelnamen mit Sonderzeichen (z. B. `Cloak & Dagger`) werden im
> Crawl-Skript HTML-entity-dekodiert, damit die Schlüssel den literalen
> BSData-Namen entsprechen.

## Testing Decisions

### Module to Test

| Test | Art | Beschreibung |
|------|-----|-------------|
| `rulesLookup.test.js` | Unit | Bekannte Regel → URL; unbekannte Regel → null; Synonym-Auflösung (inkl. case-insensitiv); Case-Insensitivity |
| `RuleChipIcon.test.jsx` | Komponente | Link-Priorität (BookOpen statt Info); `onShowRule` bei Klick; Info-Fallback; nichts ohne Link/Info |
| `RulesIndexDialog.test.jsx` | Komponente | Iframe mit korrekter `url`; Spinner; **Fehler nach Timeout**; **Retry**; Schließen (Button/Escape/Overlay) |
| `OptionGroup.test.jsx` | Integration | Gruppierte Option mit Mapping zeigt Rule-Link und ruft `onShowRule`; Link-Priorität in Gruppen |
| `generate-rules-index.test.js` | Skript-Test | Gültiges JSON; Mindestanzahl Einträge; `minimal=true`; **keine undekodierten HTML-Entities in Keys** |

### Test Interfaces (Seams)

1. **`getRuleUrl(ruleName)`** (aus `rulesLookup.js`) – zentrale Lookup-Funktion.
2. **`RulesIndexDialog`** – Props: `ruleName`, `url`, `isOpen`, `onClose`.
3. **Chip-Klick-Callback** (`onShowRule`) – neuer Prop auf `UnitRulesChips`, `UnitUpgradesChips`, `SelectionConfigurator` und `OptionGroup`.
5. **`RuleChipIcon`** – gemeinsame Icon-Komponente, die die Link-Priorität kapselt.
4. **`generate-rules-index.js`** – CLI-Skript, dessen Output als JSON validiert wird.

## Out of Scope

- **Text-Scraping für Tooltips** (wie in old-world-builder): Der Hover auf einen Chip zeigt weiterhin nur den BSData-Kurztext. Volltext-Tooltips sind nicht vorgesehen.
- **Runtime-Crawling:** Das Mapping wird nicht zur Laufzeit aktualisiert; nur per manuell gestartetem Build-Skript.
- **Integration armee-spezifischer Anker-Regeln** (z. B. "Animosity" auf `/army/orcs-and-goblins#animosity`): Können später über `synonyms.js` manuell ergänzt werden, aber kein tiefer Crawl der Armee-Seiten in V1.
- **Änderungen am PWA-Service-Worker:** Der externe Iframe-Inhalt wird nicht gecached. Die Offline-Fähigkeit der App bleibt unverändert.
- **Neue Abhängigkeiten:** Es werden keine neuen npm-Pakete installiert.
- **GUI-Pflege der Mappings:** Der begleitende Editor ist als eigenes Werkzeug spezifiziert (siehe `docs/PRD-rules-url-editor.md`), nicht Teil dieses Features.

## Acceptance Criteria
- [x] Regel-Chips (UnitRulesChips, UnitUpgradesChips) öffnen bei bekanntem Mapping den RulesIndexDialog mit der Iframe-URL von 6th.whfb.app und zeigen ein `BookOpen`-Icon
- [x] Bei unbekanntem Mapping öffnen Chips weiterhin den bestehenden Detail-BottomSheet/Tooltip (`Info`-Icon)
- [x] SelectionConfigurator-Upgrade-Namen öffnen bei bekanntem Mapping den RulesIndexDialog
- [x] PlayMode hat einen "Regelbuch"-Button, der 6th.whfb.app in einem neuen Tab öffnet
- [x] PlayUnitDetails-Chips integrieren denselben onShowRule-Mechanismus
- [x] generate-rules-index.js crawlt die Sektions-Indizes und gibt ein gültiges rules-index.json aus
- [x] rulesLookup.js löst Namen (inkl. Synonyms, case-insensitive) korrekt auf
- [x] Alle neuen Module haben Unit-Tests

## Comments
- Umgesetzt und gemergt in PR #39. Architektur-Entscheidung dokumentiert in ADR-0012.
- Abweichung von der Erstplanung: Das Gesamt-Regelbuch öffnet in einem neuen Tab statt als Iframe-Dialog (`/digital-rulebook`); Chips unterscheiden sichtbar zwischen verlinkter Regel (`BookOpen`) und reiner Beschreibung (`Info`).
- Parallel in einem zweiten Branch (`rules-index-coverage-issues`, Unterprobleme siehe [06](06-doku-link-icon-bookopen-fehlt-in-optiongroup-f-r-magic-items-und-standarten/issue.md) und [07](07-regel-index-lookup-scheitert-bei-rund-einem-f-nftel-der-magic-item-namen/issue.md)) wurde die Datenqualität der Namensauflösung deutlich verbessert und beim Merge dieses Branches nach main übernommen: `rules-index.json` per Vollcrawl auf 2662 Einträge erweitert (10 Sektionen statt 5, u. a. Psychology/Movement/Chariots/Close-Combat), `rulesLookup.js` auf NFKD-Normalisierung + Faction-Suffix-Fallback umgestellt, diverse O&G-Katalog-Tippfehler direkt in den `.cat`-Dateien korrigiert (bestätigt durch jeweils eigene Regel-Referenz im Katalog) sowie gezielte Synonyme für echte Orky-Schreibvarianten ergänzt. Die HTML-Entity-Dekodierung aus diesem PR wurde dabei in `scripts/rules-crawler.js` übernommen (unser Crawler-Modul, das `generate-rules-index.js` hier ersetzt).
