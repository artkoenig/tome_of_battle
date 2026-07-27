Status: needs-triage
Type: refactor
Blocked by: None

## Description

Sammel-Issue fuer die kleineren Befunde der Standards-Pruefung zu Main-Issue 79.
Keiner davon blockiert etwas; zusammen sind sie ein Nachmittag. Die gewichtigen
Befunde derselben Pruefung liegen als eigene Issues vor (85, 86).

**1. Der Auswertungs-Kontext des Evaluators wird uneinheitlich durchgereicht.**
Dieselben fuenf Werte (Wurzel, Zaehlindex, Kategorie-Ids, Diagnosen, Budget)
reisen durch die ganze Engine — mal als benanntes Objekt
(`src/evaluator/query.js:42`, `src/evaluator/modifiers.js:550`), mal als
Einzelparameter in fester Reihenfolge (`src/evaluator/constraints.js:120` mit
sechs Stellungsparametern, `src/evaluator/modifiers.js:579`,
`src/evaluator/fixpoint.js:186`). Der passende Typ existiert bereits; die
Stellungs-Aufrufe umgehen ihn nur. Zusaetzlich buchstabiert
`src/evaluator/evaluator.js:112,131,134` dieselbe Herleitung dreimal aus.

*Abgrenzung:* Das ist NICHT das abgeloeste Issue 64 — jenes betraf den Kontext
der alten Engine unter `src/solver/`, die laut ADR-0030 ersetzt wird. Dieser
Befund liegt in der neuen Engine und ueberlebt den Cutover.

**2. Exporte, die es nur fuer Tests gibt.** `applyAllModifiers`
(`src/evaluator/modifiers.js:579`) hat produktiv keinen einzigen Aufrufer, auch
nicht in seiner eigenen Datei — der echte Weg laeuft ueber
`applyModifiersOfNodes`. Gleiche Klasse: `MODIFIER_HANDLERS`
(`modifiers.js:370`), `COMPARATORS` (`modifiers.js:92`), `causesOf`
(`src/evaluator/causes.js:68`), `MAX_FIXPOINT_ROUNDS`
(`src/evaluator/fixpoint.js`). Die Pruefung auf ungenutzte Exporte sieht sie
nicht, weil Testdateien als Einstiegspunkte gelten (`knip.json:5`).

**3. Zu breite Exporte ausserhalb der Engine.** `findSelectionById`
(`src/components/editor/optionNesting.js:16`) und `DEFAULT_SHARED_QUERY`
(`src/parser/xmlParser.js:203`) werden nur innerhalb ihrer eigenen Datei benutzt.

**4. Ungenutzte Entwicklungs-Abhaengigkeit.** `@vitest/coverage-v8`
(`package.json:37`) — es gibt keinen Abdeckungs-Block in der Testkonfiguration
und keinen entsprechenden Schalter im Prueflauf.

**5. Doppelte Umwandlung.** `src/evaluator/catalogReader.js:806-808` wandelt
dieselbe Zeichenkette zweimal in eine Zahl. Das Praedikat nimmt auch eine Zahl
entgegen, der bereits umgewandelte Wert genuegt.

## Acceptance Criteria
- [ ] Der Auswertungs-Kontext des Evaluators wird ueberall in derselben Form durchgereicht; die Stellungs-Aufrufe nutzen den vorhandenen Typ.
- [ ] Exporte, die es nur fuer Tests gibt, sind entweder aufgeloest oder als solche kenntlich; die Pruefung auf ungenutzte Exporte kann sie sehen.
- [ ] Die beiden zu breiten Exporte sind auf ihre Datei beschraenkt.
- [ ] Die ungenutzte Entwicklungs-Abhaengigkeit ist entfernt oder ihr Nutzen belegt.
- [ ] Die doppelte Umwandlung im Katalog-Leser entfaellt.
- [ ] Kein Verhaltenswechsel: die Testsuite bleibt gruen, keine Erwartung wird angepasst.

## Comments
- Zwei weitere Befunde derselben Pruefung sind bewusst NICHT hier aufgenommen: (a) src/components/editor/OptionGroup.jsx zieht 25 Symbole aus der Solver-Fassade und rechnet Fachwerte selbst aus — das loest ADR-0034 im Rahmen des Cutovers, nicht ein Einzel-Refactor. (b) src/evaluator/model.js buendelt viele unabhaengige Vokabulare und hat entsprechend hohe Aenderungsrate — der Kopf der Datei erklaert die Buendelung ausdruecklich als gewollt (eine Quelle fuer geteilte Werte). Das ist eine Entscheidung, keine Panne, und gehoert vor den Maintainer statt in ein Aufraeum-Issue.
- Zusatzbefund aus einer spaeteren Standards-Pruefung: die Pruefung auf ungenutzte Exporte beendet sich mit Fehlercode 1, waehrend CLAUDE.md sie als 'warn-only' beschreibt. Entweder stimmt die Beschreibung nicht, oder die Pruefung sollte nicht mit Fehler enden. Gehoert mit in dieses Aufraeumen — es entscheidet, ob die 24 gemeldeten ungenutzten Exporte ein Gate sind oder ein Hinweis.
