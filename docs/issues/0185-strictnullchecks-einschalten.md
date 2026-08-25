---
status: backlog
branch:
pr:
---

# strictNullChecks einschalten

## Goal

Der Typprüfer läuft längst über den ganzen Baum: `tsconfig.json` setzt `allowJs`
und `checkJs`, `forge-typecheck` ist `tsc --noEmit` über `src/**` und
`scripts/**`, und der Gate ist grün. Rund 800 `@param`/`@returns`-Annotationen
tragen ihn. Nur steht daneben `strict: false` — und damit prüft TypeScript
`null` und `undefined` überhaupt nicht. Jedes `@param {Roster|null|undefined}`
in diesem Projekt ist heute Prosa ohne Zusicherung: die Sorgfalt ist
investiert, der Gegenwert kommt nicht an.

Gemessen am Ist-Stand kostet das Nachholen wenig. `tsc --noEmit
--strictFunctionTypes` meldet **0** Fehler, `--strictNullChecks` meldet
**168** in 58 Dateien. Zum Vergleich: `--noImplicitAny` meldet 2658 und bleibt
deshalb ausdrücklich draußen (siehe Out of scope). Die 168 verteilen sich auf
`src/ui/viewmodels` (64), `src/ui/components` (43), `src/domain/evaluator`
(20), `scripts/` (12), `src/domain/evaluation` (9), `src/domain/roster` (5),
`src/data/db` (5), `src/ui/App.jsx` (4), `src/ui/i18n` (3), ein Fixture (2) und
eine Datei in der `src/`-Wurzel (1). Die dichtesten Stellen sind
`useImporter.js` (25), `UnitSelectionCard.jsx` (13), `ListRuleChecklist.jsx`
(11) und `evaluator/resolver.js` (10).

Die Arbeit ist **verhaltensneutral**. Wo der Prüfer eine echte Lücke findet —
ein Wert kann `null` sein und wird ungeprüft gelesen —, ist die Antwort eine
Prüfung oder ein sauberer Vorgabewert, nicht das Wegdrücken der Meldung. Der
Baum trägt heute **keine einzige** `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`
-Zeile; das soll er danach immer noch nicht. Ebenso wenig ist ein
JSDoc-Typ-Cast (`/** @type {X} */ (wert)`) das Mittel der Wahl: 34 davon gibt es,
und die Zahl darf nur dort wachsen, wo eine Behauptung wirklich außerhalb
dessen liegt, was der Prüfer sehen kann.

Findet die Umstellung dabei einen echten Fehler mit sichtbarer Wirkung, wird er
hier **nicht** mitrepariert, sondern als eigenes Issue notiert: dieses Vorhaben
soll ein reiner, nachvollziehbarer Typ-Diff bleiben.

## Acceptance criteria

- AC1: `tsconfig.json` schaltet `strictNullChecks` und `strictFunctionTypes` ein; `strict` bleibt aus, `noImplicitAny` bleibt aus. | verify: `node -e 'const c=JSON.parse(require("fs").readFileSync("tsconfig.json","utf8")).compilerOptions;const bad=[];if(c.strictNullChecks!==true)bad.push("strictNullChecks");if(c.strictFunctionTypes!==true)bad.push("strictFunctionTypes");if(c.strict===true)bad.push("strict darf aus bleiben");if(c.noImplicitAny===true)bad.push("noImplicitAny gehoert nicht in dieses Issue");if(bad.length){console.error(bad.join(", "));process.exit(1)}'`
- AC2: Der Typ-Gate ist mit den neuen Flags grün — alle 168 Meldungen sind abgearbeitet. | verify: `forge-typecheck`
- AC3: Keine Meldung wurde unterdrückt: der Baum trägt weiterhin keine `@ts-ignore`, `@ts-expect-error` oder `@ts-nocheck`. | verify: `bash -c '! grep -rqE "@ts-(ignore|expect-error|nocheck)" src scripts --include=*.js --include=*.jsx'`
- AC4: Typ-Casts sind die Ausnahme geblieben, nicht das Werkzeug: höchstens zehn neue gegenüber den heutigen 34. | verify: `bash -c 'n=$(grep -rEo "/\*\* *@type \{[^}]*\} *\*/ *\(" src scripts --include=*.js --include=*.jsx | wc -l); test "$n" -le 44 || { echo "JSDoc-Casts: $n (Grenze 44)"; exit 1; }'`
- AC5: Niemand ist über `any` ausgewichen: die fünf vorhandenen `any`-Annotationen werden nicht mehr. | verify: `bash -c 'n=$(grep -rEo "@[a-z]+ \{[^}]*\bany\b" src --include=*.js --include=*.jsx | wc -l); test "$n" -le 5 || { echo "any-Annotationen: $n (Grenze 5)"; exit 1; }'`
- AC6: Das Verhalten ist unverändert — die volle Testsuite läuft durch. | verify: `forge-test`
- AC7: Lint und Build bleiben grün. | verify: `bash -c 'forge-lint && forge-build'`
- AC8: `.claude/rules/forge.md` hält fest, was `forge-typecheck` seit dieser Umstellung prüft und dass `noImplicitAny` bewusst noch aussteht, damit die nächste Datei null-sicher entsteht statt die Schuld zu vergrößern. | verify: `bash -c 'grep -q strictNullChecks .claude/rules/forge.md && grep -q noImplicitAny .claude/rules/forge.md'`

## Out of scope

- `noImplicitAny` (2658 Meldungen, davon 1644 `TS7006`). Das ist Annotationslücke,
  nicht Fehlerfund, und gehört ordnerweise nachgezogen — eigenes Vorhaben.
- `strict: true` als Ganzes. Es zieht `noImplicitAny` mit; erst wenn der aus ist,
  ist der Schalter eine Formalie.
- Jede Umstellung von `.js`/`.jsx` auf `.ts`/`.tsx`. Diese Arbeit ist der Grund,
  warum eine solche Umstellung später billiger wird, nicht ihr Anfang.
- Testdateien. `tsconfig.json` schließt `**/*.test.js`, `**/*.test.jsx` und
  `src/tests/test-utils` aus; die 168 Meldungen enthalten sie nicht, und dieses
  Issue ändert den Ausschluss nicht. Die zwei Meldungen in
  `src/tests/__fixtures__/grimdarkSystem.js` fallen an, weil Fixtures nicht
  ausgeschlossen sind — sie werden mit erledigt.
- `tools/rules-editor/`. Liegt außerhalb von `include`.
- Fachliche Korrekturen. Deckt der Prüfer eine echte Lücke mit sichtbarer
  Wirkung auf, wird sie hier notiert und in einem eigenen Issue behoben.
- Ein Versionssprung. Für den Nutzer ändert sich nichts (forge.md: nie für
  Refactoring und Chores).
