---
paths:
  - "docs/battlescribe-data-format.md"
  - "docs/bsdata-catalogue-development-wiki/**"
  - "src/parser/**"
  - "src/__fixtures__/**"
  - "**/*.cat"
  - "**/*.gst"
  - "**/*.ros"
---

# BattleScribe-Datenformat (BSData)

`docs/battlescribe-data-format.md` ist die **kanonische** Formatreferenz dieses Projekts. Jeder
Agent liest sie, bevor er formatnahen Code oder Katalogdaten anfasst — auch Subagenten.

- **Vorrang:** Die Formatdoku steht über den ADRs. Widersprechen sich beide, ist die Formatdoku
  richtig und der ADR veraltet — der Formatdoku folgen und den ADR zur Korrektur melden.
- `docs/bsdata-catalogue-development-wiki/` ist ein **Submodul** des BSData-Wikis und damit die
  Upstream-Quelle: nur lesen, nie darin editieren. Leer nach dem Klon → `git submodule update
  --init --recursive` (in Cloud-Sessions erledigt das `.claude/hooks/session-start.sh`); aktuell
  ziehen mit `--remote`.
- §15 „Lücken der Quelle" zählt auf, wo das Wiki schweigt. Dort entscheidet das Projekt selbst —
  jede solche Entscheidung gehört begründet in ein Issue, nie in eine stille Annahme im Code.
- Behauptungen über das Format werden an echten Dateien belegt, nicht aus dem Wiki-Wortlaut
  abgeleitet. Eine neue Formatregel braucht ein reales Vorkommen als Beleg (`grep` über die
  Kataloge), sonst ist sie eine Vermutung.
- **Zwei unabhängige XML-Leser**, absichtlich getrennt: `src/parser/xmlParser.js` (Import
  hochgeladener Dateien, plus advisory XSD-Prüfung `schemaValidator.js`, ADR 0016) und
  `src/evaluator/catalogReader.js` (Auswertung). Eine Formatkorrektur im einen impliziert nie
  automatisch dieselbe im anderen — prüfen, ob beide betroffen sind.
- Die XSD liegt vendored als Konformitätsquelle im Repo (`src/parser/schema/Catalogue.xsd`,
  ADR 0016); der Evaluator teilt deren
  Enum-SSOT (ADR 0031). Ein Enum-Wert wird dort gepflegt, nicht per Hand dupliziert.
- Kataloge liegen **nicht** im Repo: sie kommen zur Laufzeit aus dem externen Fork (ADR 0014,
  0017, 0018). Für Tests gibt es den eingefrorenen Ausschnitt unter `src/__fixtures__/whfb6/` —
  der ist Fixture, kein Datenstand zum Aktualisieren.
- Verweisziele lösen laut ADR 0032 **global über die ID** in einer flachen Tabelle auf, nicht
  katalog-lokal. Die Formatdoku beschreibt an mancher Stelle noch die katalog-lokale Lesart.
