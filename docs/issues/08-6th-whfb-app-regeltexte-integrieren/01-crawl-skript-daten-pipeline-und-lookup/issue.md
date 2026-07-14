Status: resolved
Blocked by: None

## Description

Baue die Daten-Pipeline zur automatischen Generierung des Name→URL-Mappings von 6th.whfb.app.

Enthält:
- **`scripts/generate-rules-index.js`**: CLI-Skript (manuell gestartet). Ruft das Inhaltsverzeichnis von 6th.whfb.app ab, parst alle `<a href>`-Links mit Seitentiteln, filtert Index-Seiten heraus, schreibt `src/data/rules-index.json`. UTM-Parameter (`utm_source=6th-builder&utm_medium=referral`) werden in die URLs eingebettet. Nutzt `fetch` (Node 18+), keine neuen npm-Pakete.
- **`src/data/rules-index.json`**: Auto-generiert, wird eingecheckt. Format: `{ "Rule Name": "/section/page-slug?minimal=true&utm_source=6th-builder&utm_medium=referral", ... }`
- **`src/data/synonyms.js`**: Handgepflegte Datei, exportiert `SYNONYMS = { "BSData Name": "Canonical Name" }`. Enthält initial bekannte Abweichungen (z. B. `"Hand Weapon": "Hand Weapon (Fighting with a Hand Weapon and a Shield)"`).
- **`src/data/rulesLookup.js`**: Exportiert `getRuleUrl(name) → string | null`. Konsultiert zuerst Synonyms, dann `rules-index.json` (Case-insensitive). Gibt `null` bei unbekanntem Namen.

Tests: `rulesLookup.test.js` und `generate-rules-index.test.js`.

## Acceptance Criteria
- [ ] `node scripts/generate-rules-index.js` crawlt das ToC von 6th.whfb.app und schreibt `src/data/rules-index.json`
- [ ] Generiertes JSON enthält nur globale Regel-Seiten (special-rules, weapons, magic-items, spells, characteristics), keine Index-Seiten
- [ ] Alle URLs enthalten `?minimal=true` und UTM-Parameter
- [ ] `getRuleUrl("Killing Blow")` gibt die korrekte URL zurück
- [ ] `getRuleUrl("killing blow")` (Case-insensitive) gibt dieselbe URL zurück
- [ ] `getRuleUrl("Shield")` löst das Synonym auf (falls in synonyms.js)
- [ ] `getRuleUrl("Unbekannte Regel")` gibt `null` zurück
- [ ] `rulesLookup.test.js` testet alle obigen Fälle
- [ ] `generate-rules-index.test.js` validiert JSON-Struktur und Mindestanzahl Einträge

## Comments
- Implementiert: generate-rules-index.js crawlt die Sektions-Übersichtsseiten von 6th.whfb.app und erzeugt rules-index.json (843 Einträge). rulesLookup.js mit Synoym-Unterstützung und Case-Insensitivity. 16 Tests grün, kein Breakage.
