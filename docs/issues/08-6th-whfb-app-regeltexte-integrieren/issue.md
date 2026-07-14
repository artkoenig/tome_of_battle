Status: ready-for-agent
Blocked by: None

## Description

# PRD: Integration der 6th.whfb.app-Regeltexte in den Armeelisten-Builder

## Problem Statement

Die App zeigt aktuell Regeltexte (Sonderregeln, Waffenbeschreibungen, Magic Items) nur in der knappen Form an, die in den BattleScribe-Datendateien (`.gst`/`.cat`) enthalten ist – meist ein einzelner Satz oder Stichpunkte. Die vollständigen, durch Errata aktualisierten Regelbuch-Texte mit Tabellen, Querverweisen und Kontext sind nicht verfügbar.

## Solution

Die App bindet externe, vollständige Regeltexte von `https://6th.whfb.app/` ein – einem Contentful-basierten, statisch generierten Online-Regelindex für Warhammer Fantasy 6th Edition.

Die Integration erfolgt clientseitig per **Iframe-Einbettung** in einem modalen Dialog (`?minimal=true`-Parameter zum Ausblenden der Seitennavigation), analog zur Integration von `tow.whfb.app` im [old-world-builder](https://github.com/nthiebes/old-world-builder).

**Datenfluss:**
1. Ein Build-Skript generiert aus dem Inhaltsverzeichnis von 6th.whfb.app ein Name→URL-Mapping als `rules-index.json`.
2. Ein handgepflegtes `synonyms.js` korrigiert Namensabweichungen zwischen BSData-Einträgen und 6th.whfb.app-Seitentiteln.
3. Zur Laufzeit sucht ein Lookup (`rulesLookup.js`) den Namen eines Regel-/Upgrade-Eintrags im Mapping + Synonyms und liefert die URL.
4. Bei bekanntem Mapping öffnet ein Klick auf den entsprechenden Chip einen `RulesIndexDialog` mit Iframe.
5. Bei unbekanntem Mapping bleibt das bisherige Verhalten (Detail-Anzeige im BottomSheet) erhalten – kein Broken Link.

## User Stories / Requirements

1. **Als Spieler** möchte ich auf einer Sonderregel (z. B. "Regeneration") klicken können, um den vollständigen Regeltext aus dem Regelbuch in einem Dialog zu sehen.
2. **Als Spieler** möchte ich auf eine Waffenbezeichnung (z. B. "Halberd") klicken können, um die Waffenregeln inkl. Tabellen angezeigt zu bekommen.
3. **Als Spieler** möchte ich auf einen Magic Item-Namen (z. B. "Sword of Might") klicken können, um die Item-Beschreibung auf 6th.whfb.app zu sehen.
4. **Als Spieler** möchte ich im Spielmodus einen "Regelbuch"-Button haben, der das digitale Regelbuch (`/digital-rulebook`) auf 6th.whfb.app öffnet.
5. **Als Entwickler** möchte ich das Name→URL-Mapping per Skript automatisch generieren und bei Bedarf aktualisieren können, um neuen Inhalten auf 6th.whfb.app zu folgen.
6. **Als Administrator/Entwickler** möchte ich Namensabweichungen zwischen BSData und 6th.whfb.app manuell in einer Synonyms-Datei korrigieren können, ohne das Mapping-Skript anpassen zu müssen.

## Technical Decisions

### Betroffene Module

| Modul | Änderung |
|-------|----------|
| **Neu: `scripts/generate-rules-index.js`** | CLI-Skript (manuell gestartet, `node scripts/generate-rules-index.js`). Ruft das Inhaltsverzeichnis von 6th.whfb.app ab, parst alle `<a href>`-Links mit Seitentiteln, filtert Index-Seiten heraus, schreibt `src/data/rules-index.json`. UTM-Parameter (`utm_source=6th-builder&utm_medium=referral`) werden in den gespeicherten URLs abgelegt. |
| **Neu: `src/data/rules-index.json`** | Auto-generierte Datei, wird eingecheckt. Format: `{ "Rule Name": "/section/page-slug?minimal=true&utm_source=6th-builder&utm_medium=referral", ... }`. |
| **Neu: `src/data/synonyms.js`** | Handgepflegt. Exportiert ein Objekt `{ "BSData Name": "Canonical Name from rules-index" }`. |
| **Neu: `src/data/rulesLookup.js`** | Exportiert `getRuleUrl(name) → string | null`. Konsultiert zuerst die Synonyms, dann `rules-index.json` (Case-insensitive). Gibt `null` zurück, wenn kein Mapping existiert. |
| **Neu: `src/components/RulesIndexDialog.jsx`** | Modal-Dialog (eigenständige Komponente, kein `ConfirmationDialog`-Reuse). Props: `ruleName`, `isOpen`, `onClose`. Rendert einen Iframe mit `https://6th.whfb.app${path}`. Zeigt Spinner beim Laden und eine Fehlermeldung bei Verbindungsfehler. Baut auf der gleichen Dialog-Stilistik auf wie das bestehende BottomSheet (ADR-0010: lokaler State, kein globaler Context). |
| **Bestehend: `src/components/editor/UnitChips.jsx`** (`UnitRulesChips`, `UnitUpgradesChips`) | Klick-Handler wird erweitert: Vor dem Öffnen des Detail-BottomSheets wird `getRuleUrl(ruleName)` geprüft. Bei Treffer: RulesIndexDialog öffnen statt Detail-BottomSheet. Bei keinem Treffer: bestehendes Verhalten. Ein neuer Callback `onShowRule(ruleName)` wird als Prop ergänzt. |
| **Bestehend: `src/components/editor/SelectionConfigurator.jsx`** | Upgrade-Einträge (Optionen mit Beschreibung) erhalten denselben Mechanismus: Klick auf einen Eintragsnamen prüft zuerst auf `getRuleUrl`. Ein neuer Callback `onShowRule` wird ergänzt und analog zu den Chips behandelt. |
| **Bestehend: `src/components/PlayMode.jsx`** | Erhält einen neuen "Regelbuch"-Button (mit `BookOpen`-Icon aus Lucide, bereits importiert) in der Toolbar. Klick öffnet `RulesIndexDialog` mit `ruleName="digital-rulebook"` (bzw. direkt `${DIGITAL_RULEBOOK_PATH}`). |
| **Bestehend: `src/components/play/PlayUnitDetails.jsx`** | `UnitUpgradesChips` und `UnitRulesChips` erhalten den neuen `onShowRule`-Callback von `PlayMode`, der den `RulesIndexDialog` steuert. |

### Technische Klärungen / Architekturentscheidungen

- **Dialog-State:** Lokaler State in den aufrufenden Komponenten (`RosterEditor.jsx`, `PlayMode.jsx`), kein globaler Context – gemäß etabliertem Muster (ADR-0010).
- **Mapping-Aktualisierung:** Das Skript wird manuell bei Bedarf gestartet (z. B. nach einem Release von 6th.whfb.app). Das generierte JSON wird ins Repo eingecheckt. Kein automatischer Crawl zur Build- oder Runtime.
- **Offline-Verhalten:** Der Iframe zeigt nativ die Browser-Fehlerseite bei fehlender Netzwerkverbindung. Der `RulesIndexDialog` zeigt einen benutzerfreundlichen Hinweis ("Keine Verbindung zu 6th.whfb.app"). Der Rest der App bleibt voll funktionsfähig.
- **UTM-Parameter:** `utm_source=6th-builder&utm_medium=referral` zur Traffic-Attribution für den Betreiber von 6th.whfb.app.
- **CORS / Embedding:** 6th.whfb.app unterstützt `X-Frame-Options`-freies Embedding und den `?minimal=true`-Parameter (verifiziert). Es ist kein Server-Proxy erforderlich.
- **Umfang des automatischen Mappings:** Nur globale Regeln mit eigener Seite (Special Rules, Weapons, Characteristics, Magic Items, Spells). Armee-spezifische Regeln (die nur als Anker auf Armee-Seiten existieren) werden nicht automatisch gecrawlt; sie können bei Bedarf manuell in `synonyms.js` ergänzt werden.
- **Keine Abhängigkeiten:** Für den Iframe-Dialog und das Crawl-Skript werden keine neuen npm-Pakete benötigt. Das Crawl-Skript verwendet `fetch` (Node 18+) und integrierte String-Parsing.

### API Contracts / Data Models

```js
// src/data/rules-index.json  (auto-generiert)
{
  "Killing Blow": "/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral",
  "Regeneration": "/special-rules/regeneration?minimal=true&utm_source=6th-builder&utm_medium=referral",
  "Halberd": "/weapons/halberd?minimal=true&utm_source=6th-builder&utm_medium=referral",
  "Great Weapon": "/weapons/great-weapon?minimal=true&utm_source=6th-builder&utm_medium=referral",
  ...
}

// src/data/synonyms.js
export const SYNONYMS = {
  "Hand Weapon": "Hand Weapon (Fighting with a Hand Weapon and a Shield)",
  ...
};

// src/data/rulesLookup.js
export function getRuleUrl(name) {
  const canonical = SYNONYMS[name] || name;
  return RULES_INDEX[canonical] || null;
}
```

## Testing Decisions

### Module to Test

| Test | Art | Beschreibung |
|------|-----|-------------|
| `rulesLookup.test.js` | Unit | Bekannte Regel → URL; unbekannte Regel → null; Synonym-Auflösung; Case-Insensitivity |
| `RulesIndexDialog.test.jsx` | Komponente | Iframe mit korrekter URL; Spinner beim Laden; Fehlermeldung bei Fehler; Schließen-Button |
| `UnitChips.test.jsx` (Erweiterung) | Integration | Klick auf bekannten Regelnamen öffnet Dialog; Klick auf unbekannten Namen öffnet BottomSheet |
| `generate-rules-index.test.js` | Skript-Test | Ausgabe ist gültiges JSON; enthält erwartete Mindestanzahl Einträge; URLs haben `minimal=true` |

### Test Interfaces (Seams)

1. **`getRuleUrl(ruleName)`** (exportiert aus `rulesLookup.js`) – zentrale Lookup-Funktion.
2. **`RulesIndexDialog`** (React-Komponente) – Props: `ruleName`, `isOpen`, `onClose`, `baseUrl`.
3. **Chip-Klick-Callbacks** (`onShowRule`) – neuer Prop auf `UnitRulesChips`, `UnitUpgradesChips`, und `SelectionConfigurator`.
4. **`generate-rules-index.js`** – CLI-Skript, dessen Output als JSON validiert wird.

## Out of Scope

- **Text-Scraping für Tooltips** (wie in old-world-builder): Der Hover auf einen Chip zeigt weiterhin nur den BSData-Kurztext. Volltext-Tooltips sind nicht vorgesehen.
- **Runtime-Crawling:** Das Mapping wird nicht zur Laufzeit aktualisiert; nur per manuell gestartetem Build-Skript.
- **Integration armee-spezifischer Anker-Regeln** (z. B. "Animosity" auf `/army/orcs-and-goblins#animosity`): Können später über `synonyms.js` manuell ergänzt werden, aber kein tiefer Crawl der Armee-Seiten in V1.
- **Änderungen am PWA-Service-Worker:** Der externe Iframe-Inhalt wird nicht gecached. Die Offline-Fähigkeit der App bleibt unverändert.
- **Neue Abhängigkeiten:** Es werden keine neuen npm-Pakete installiert.

## Acceptance Criteria
- [ ] Regel-Chips (UnitRulesChips, UnitUpgradesChips) öffnen bei bekanntem Mapping den RulesIndexDialog mit der Iframe-URL von 6th.whfb.app
- [ ] Bei unbekanntem Mapping öffnen Chips weiterhin den bestehenden Detail-BottomSheet
- [ ] SelectionConfigurator-Upgrade-Namen öffnen bei bekanntem Mapping den RulesIndexDialog
- [ ] PlayMode hat einen "Regelbuch"-Button, der das digitale Regelbuch öffnet
- [ ] PlayUnitDetails-Chips integrieren denselben onShowRule-Mechanismus
- [ ] generate-rules-index.js crawlt das ToC und gibt ein gültiges rules-index.json aus
- [ ] rulesLookup.js löst Namen (inkl. Synonyms, Case-insensitive) korrekt auf
- [ ] Alle neuen Module haben Unit-Tests

## Comments
