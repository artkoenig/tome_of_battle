# Wegwerf-Skripte

Ein Reproduktions- oder Diagnose-Skript ist eine temporäre Datei und gehört nach der
Harness-Regel ins Scratchpad-Verzeichnis. Für Node-Skripte, die Projektcode importieren,
funktioniert das nicht.

- Node sucht `node_modules` vom **Verzeichnis des Skripts** aufwärts. Ein `.mjs` unter
  `/tmp/.../scratchpad` findet die Abhängigkeiten des Repos nie — auch dann nicht, wenn es mit
  absoluten Pfaden aus `/home/user/tome_of_battle` importiert. Der Fehler nennt
  `getPackageJSONURL` / `packageResolve` und liest sich wie ein fehlendes Paket.
- `npm ci` heilt das nicht: es installiert ins Repo, nicht neben das Skript. Wer es an dieser
  Stelle laufen lässt, hat eine Runde verloren, nicht das Problem gelöst.
- Deshalb: ein Skript, das aus `src/` importiert, wird **im Repo-Wurzelverzeichnis** abgelegt und
  von dort ausgeführt. Reine Datenskripte ohne solche Importe (`python3` über eine `.cat`, `curl`,
  `jq`) bleiben im Scratchpad.
- Was im Repo landet, muss vor dem Commit wieder weg. `git status --porcelain` vor jedem Commit;
  untracked `*.mjs`, `*.ros` oder `*.tmp.*` in der Wurzel sind Reste, kein Liefergegenstand.
- Vor dem eigenen Skript prüfen, ob ein Runner die Frage schon beantwortet:
  `forge-test --run <pattern>` oder ein Szenario unter `docs/testing/` ist billiger als eine
  selbstgebaute Auswertung und läuft in der Umgebung, die auch die Tests benutzen.
