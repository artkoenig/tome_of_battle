# docs — Index der Verzeichnisse

Was jeder Ordner unter `docs/` enthält. Die Rangfolge bei Widerspruch steht in
`.claude/rules/areas/docs.md`, die Karte des übrigen Repos in
[`project-map.md`](project-map.md).

- [`adr/`](adr/) — die Architekturentscheidungen: Datenbank, Styling, Tests, Deployment.
  [`adr/README.md`](adr/README.md) führt sie alle mit Status und Datum in einer Tabelle. Vor
  einer Codeänderung die einschlägigen lesen.

- [`battlescribe/`](battlescribe/) — die kanonische Formatreferenz, Kapitel für Kapitel.
  [`battlescribe-data-format.md`](battlescribe-data-format.md) ist ihr Index und benennt jedes
  Kapitel; die Paragraphennummern, die der Rest des Repos zitiert, gelten dort weiter. Über den
  Index gehen, nicht über den Ordner.

- [`bsdata-catalogue-development-wiki/`](bsdata-catalogue-development-wiki/) — das BSData-Wiki
  als Submodul und damit die Upstream-Quelle der Referenz oben: nur lesen, nie darin editieren.
  Leer nach dem Klon → `git submodule update --init --recursive`.

- [`issues/`](issues/) — je ein Record pro Vorgang, offen wie geschlossen. Format und Kommandos
  in `.claude/skills/issue-backend/SKILL.md`; nie von Hand umsetzen, das tut `/forge:issue`.
  Geschlossene Records sind Historie: ihre Datei- und Zeilenangaben werden nicht nachgezogen.

- [`testing/`](testing/) — je ein Ordner pro E2E-Szenario des Evaluators (Roster, ein README,
  das die Erwartung aus dem Katalog-XML herleitet, und die `scenario.json` für den Runner).
  Daneben `constraint-matrix.md` als Abdeckungskarte, `worklist.json` und `covered-cells.json`
  für das Offene und `campaign-state.json`, das die rot erlaubten Szenarien festhält.

- [`assets/`](assets/) — keine Doku: Bilder, CSS und JS der GitHub-Pages-Landing-Page
  (`index.html`).
