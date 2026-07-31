---
status: active
branch: claude/vampire-list-laws-undeath-3ooflh
pr:
---

# Eindeutige Pflicht-Listenregeln (min≥1) werden nicht automatisch gesetzt

## Intent

Eine „Special list rules"-Kategorie kann Einträge vom Typ `upgrade` enthalten,
die keine echte Wahl sind, sondern per Katalogdaten Pflicht: ein eigener
`min`-Constraint ≥ 1 mit `scope="force"` bzw. `scope="roster"` direkt am
Wurzeleintrag — kein `categoryLink`, keine Alternative, kein zweiter
Katalogeintrag, der dieselbe Grenze erfüllen könnte (das Muster aus
`docs/battlescribe-data-format.md` §9.9, „Armeeweite Pflichteinheit"). Beispiel:
„The Laws of Undeath" im Vampire-Counts-Katalog (6th Definitive Edition,
`Vampire Counts (6th definitive edition).cat:11640-11652`), `min=1 max=1
scope=force`.

Der bestehende `ListRuleChecklist`-Mechanismus (`src/roster/listRules.js`,
`src/components/editor/ListRuleChecklist.jsx`) behandelt so einen Eintrag
heute identisch zu einer echten Ein/Aus-Einstellung mit `min=0` (z. B. „Allow
experimental rules?"): `checked` liest sich ausschließlich aus der
Roster-Präsenz, ohne Rücksicht auf den `min`-Wert des Eintrags — beide starten
unchecked. Vergisst der Nutzer, eine echte Pflicht anzuhaken, meldet der
Evaluator einen blockierenden Fehler (jede unerfüllte Katalog-Grenze ist laut
ADR-0034 immer `severity=error`), obwohl der Eintrag eindeutig feststeht und
gar keine Wahl ist.

Historischer Kontext: eine pauschale Auto-Materialisierung aller „Special list
rules"-Einträge gab es bereits (Issue 34) und wurde eine Version später wieder
zurückgebaut (Issue 35, siehe `docs/adr/0011-roster-referenzmodell-und-serialisierungs-adapter.md:60-73`),
weil sie auch echte `min=0`-Einstellungen fest anschaltete und nicht mehr
abwählbar machte. Diese Issue grenzt sich davon bewusst ab: betroffen sind
ausschließlich Einträge, die selbst `min≥1` tragen — echte Pflicht, kein
Schalter mit legitimem Aus-Zustand.

Acceptance criteria:

1. In einem **neu angelegten** Kontingent ist ein Listenregel-Eintrag (Typ
   `upgrade`) automatisch in `force.selections` vorhanden, wenn sein
   aufgelöster Katalogeintrag **alle** folgenden Merkmale erfüllt: ein eigener
   `min`-Constraint ≥ 1 mit `scope="force"` oder `scope="roster"` direkt am
   Eintrag/Link (nicht über eine Kategorie oder Gruppe mit mehreren möglichen
   Trägern), keine Kosten in irgendeiner Kostenart, keine eigenen
   Unterauswahlen (keine `selectionEntries`/`entryLinks`/`selectionEntryGroups`),
   und der Eintrag ist zu diesem Zeitpunkt nicht ausgeblendet (`hidden`).
2. Ein Listenregel-Eintrag, der diese Merkmale nicht alle erfüllt — eine
   Kategorie mit mehreren möglichen Trägern (z. B. „General"), ein
   kostenpflichtiger Wurzeleintrag (z. B. „Ogre Bulls", ein `entryLink` mit
   eigenen Kosten und Ausrüstungs-Unteroptionen), oder ein Eintrag mit eigener
   Folgewahl (z. B. „Bloodlines", das zusätzlich eine von mehreren
   Blutlinien verlangt) — wird **nicht** automatisch gesetzt; er bleibt wie
   heute manuell anzuhaken bzw. eine Meldung im Bericht.
3. Wird eine bislang ausgeblendete Listenregel, die Kriterium 1 erfüllt, durch
   eine andere Wahl **innerhalb derselben Liste** sichtbar und pflichtig (z. B.
   „Army of Sylvania" bei Vampire Counts, das erst nach Wahl eines
   von-Carstein-Generals aus dem Versteck kommt), wird sie im selben Zug
   automatisch gesetzt — nicht erst beim nächsten Neuanlegen eines
   Kontingents.
4. Ein **vor Einführung dieses Verhaltens bereits bestehendes** Roster wird
   beim Öffnen **nicht** rückwirkend verändert; eine bei ihm fehlende
   Pflichtregel bleibt ein manuell zu behebender Fehler wie bisher.
5. Die Checkbox einer automatisch gesetzten Pflichtregel ist in der
   Ankreuzliste deaktiviert (nicht abwählbar), solange der Eintrag pflichtig
   und nicht ausgeblendet ist, und trägt einen sichtbaren Hinweis
   (Tooltip/Text), der erklärt, dass es sich um eine Pflichtregel dieser Liste
   handelt.
6. Wird ein automatisch gesetzter Eintrag später ausgeblendet (z. B. weil das
   Kontingent auf „Army of the Lichemaster" wechselt), verschwindet seine
   Zeile aus der Ankreuzliste wie bei jedem anderen ausgeblendeten Eintrag
   heute schon; seine Selektion wird nicht automatisch aus dem Roster
   entfernt.
7. Existieren in einem Kontingent mehrere Listenregeln, die Kriterium 1
   erfüllen, gleichzeitig, wird jede unabhängig automatisch gesetzt.

## Plan

**Module list**

- `src/roster/listRules.js` — neues exportiertes Prädikat, neuer exportierter
  Sweep, `buildListRuleStates` um `mandatory` erweitert.
- `src/hooks/useRosterList.js` — merkt sich (rein im Speicher, nicht
  persistiert), welche Roster-Ids in dieser Sitzung neu angelegt wurden.
- `src/App.jsx` — reicht die Frisch-Markierung als Prop an `RosterEditor`
  durch.
- `src/components/RosterEditor.jsx` — reicht sie an `useRoster` durch.
- `src/hooks/useRoster.js` — neuer Effekt (Auto-Add), gated auf die
  Frisch-Markierung.
- `src/components/editor/ListRuleChecklist.jsx` — rendert `disabled` +
  Tooltip für `state.mandatory`-Zeilen.
- `src/i18n/locales/de.json`, `en.json` — neuer Schlüssel
  `editor.listRules.mandatoryTooltip`.

**Contracts**

1. `listRules.js`, neu:
   `export function isUnconditionalMandatoryListRule(resolved)`. Spiegelt das
   Lesemuster von `isBinaryListRule` (MAX), aber für MIN: sucht eine
   `constraint` mit `type === ConstraintKind.MIN` **und**
   `scope === ConstraintScope.FORCE || scope === ConstraintScope.ROSTER`
   (kein `!c.scope`-Fallback), liest ihren effektiven Wert über
   `getModifiedConstraintValue(minConstraint, getEffectiveModifiers(resolved), {})`,
   verlangt `>= 1`, verlangt `!isContainerListRule(resolved)` und verlangt
   Kostenfreiheit über alle Einträge von `resolved.costs`.

2. `listRules.js`, neu:
   `export function findMissingMandatoryListRuleSelections(system, catalogue, force)`
   → `Array<{ entry, resolved, categoryId }>`. Durchsucht dieselben
   Wurzel-Pools wie `collectPrimaryCategoryEntries`
   (`catalogue.selectionEntries`/`entryLinks`/`sharedSelectionEntries`) nach
   `upgrade`-Einträgen, für die `isUnconditionalMandatoryListRule(resolved)`
   gilt, die nicht `isSelectionEntryHidden` sind und für die
   `findPresentSelection` in `force.selections` nichts findet.

3. `buildListRuleStates` bekommt je `ListRuleState` ein Feld
   `mandatory: boolean` (`isUnconditionalMandatoryListRule(resolved)`).
   `ListRuleChecklist` liest `state.mandatory`, um an beiden Checkbox-Stellen
   (Container- und reine Schalter-Zeile) `disabled` plus einen Tooltip zu
   setzen — über die in dieser Datei bereits verdrahtete `GothicTooltip`
   /`hoveredInfo`-Mechanik, nicht über ein neues Tooltip-Mittel.

4. `useRosterList` bekommt neuen In-Memory-Zustand
   `const [freshRosterIds, setFreshRosterIds] = useState(() => new Set())`,
   ergänzt um `roster.id`, sobald `createRoster` erfolgreich ist (vor
   `setRosters`). Der Hook liefert eine Abfragefunktion (z. B.
   `isFreshRoster(id)`) zurück. Nicht persistiert — bewusst außerhalb von
   `Roster`/`Force` und IndexedDB, damit es nie durch Speichern/Laden oder
   `.rosz`-Export/Import wandert.

5. `App.jsx` reicht `isFreshRoster={isFreshRoster(selectedRoster?.id)}` an
   `RosterEditor` durch, das es an
   `useRoster(initialRoster, system, saveRosterCallback, reportError, isFreshRoster)`
   (neuer 5. Parameter) weiterreicht.

6. `useRoster.js` bekommt einen neuen `useEffect` neben dem bestehenden
   Katalog-Sync-Effekt, gated auf `isFreshRoster`: pro Force ruft er
   `findMissingMandatoryListRuleSelections(system, aktiverKatalogDerForce, force)`,
   baut Treffer über den vorhandenen `createSelectionFromDef`-Wrapper zu
   Selektionen und übernimmt sie — falls welche gefunden wurden — über
   `replaceRoster` (kein Undo-Schritt, wie der Sync-Effekt). Abhängigkeiten:
   `[roster, system, isFreshRoster, replaceRoster]`; keine Endlosschleife,
   weil ein einmal hinzugefügter Eintrag im nächsten Durchlauf von
   `findMissingMandatoryListRuleSelections` nicht mehr als fehlend gilt.

**Nicht-offensichtliche Entscheidungen**

- **`replaceRoster`, nicht `setRoster`, für den Auto-Add-Commit** — ein
  Eintrag, den der Nutzer nie angeklickt hat, soll ihm keinen Undo-Schritt
  kosten; folgt dem bestehenden Muster des Katalog-Sync-Effekts.
- **Frisch-Markierung lebt ausschließlich im Speicher, nie im persistierten
  `Roster`/`Force`-Schema** — Kriterium 4 verlangt „neu vs. bestehend“ zu
  unterscheiden, wofür es heute kein Feld gibt; das ins Schema aufzunehmen
  wäre eine Rückwärtskompatibilitäts-Änderung, die niemand verlangt hat.
- **Das Prädikat verlangt einen explizit geschriebenen `scope`
  (`force`/`roster`), anders als `isBinaryListRule`s `!c.scope`-Kulanz** —
  ein Wurzeleintrag mit ungeschriebenem `scope` meint etwas anderes (die
  eigene Instanzgrenze), das als armeeweite Pflicht zu lesen würde den
  Auto-Add auf Fälle auslösen, die §9.9 nicht beschreibt.
- **Der Sweep durchsucht die Wurzel-Pools direkt statt kategorienweise über
  `resolveListRuleGroup` zu gehen** — Kriterium 1 erwähnt keine
  Kategorie-Zugehörigkeit, nur „nicht ausgeblendet“; eine Bindung an
  `resolveListRuleGroup`s „reine Listenregel-Kategorie“-Rahmen würde einen
  sonst zulässigen Eintrag in einer gemischten Kategorie stillschweigend
  übersehen.
- **Die Oberflächen-Sperre nutzt die in `ListRuleChecklist.jsx` bereits
  verdrahtete `GothicTooltip`-Mechanik statt eines schlichten
  `title=`-Attributs** — die Datei bindet diese Komponente schon für ihre
  Info-Popups ein; sie zu erweitern hält ein einziges Tooltip-Mittel in
  dieser Datei statt ein zweites daneben einzuführen.

## Tasks

## Decisions

- **Mechanismus: vollautomatisch, keine Rückfrage.** *(Mensch, in der
  Konversation vor der Grill-Befragung, als Antwort auf die Frage, ob ein
  eindeutiger Pflicht-Wurzeleintrag automatisch, per Ein-Klick-Vorschlag oder
  gar nicht ergänzt werden soll → „Automatisch ohne Rückfrage".)*
- **Geltungsbereich: nur echte Pflicht-Checkboxen (min≥1) ohne Kosten,**
  keine kostenpflichtigen Wurzeleinheiten wie „Ogre Bulls". *(Mensch, Antwort
  auf Rückfrage „Wie weit soll der Auto-Add gehen, damit er nicht denselben
  Fehler wie die zurückgebaute Auto-Materialisierung wiederholt?" →
  „Nur echte Pflicht-Checkboxen (min≥1)".)*
- **Bestandslisten werden nicht rückwirkend repariert.** Nur neu angelegte
  Kontingente sind betroffen. *(Mensch, Antwort auf Rückfrage → „Nur für neu
  angelegte Kontingente ab jetzt".)* Konsequenz: die ursprünglich gemeldete
  Vampire-Counts-Liste des Menschen bleibt von dieser Änderung unberührt, bis
  sie neu angelegt wird.
- **Checkbox wird gesperrt, solange die Regel pflichtig und sichtbar ist.**
  *(Mensch, Antwort auf Rückfrage „Bleibt die Checkbox abwählbar?" →
  „Gesperrt, solange die Regel nicht ausgeblendet ist".)*
- **Mit sichtbarer Erklärung an der gesperrten Checkbox.** *(Mensch, Antwort
  auf Rückfrage → „Mit sichtbarer Erklärung".)*
- **Einträge mit eigener Folgewahl (z. B. „Bloodlines") bleiben
  ausgeschlossen.** Auto-Add darf nicht einen Fehler durch einen anderen
  (die dann offene Unterauswahl) ersetzen. *(Mensch, Antwort auf Rückfrage →
  „Nur Einträge ohne Folgewahl".)*
- **Laufendes Nachtriggern statt einmaliger Prüfung beim Anlegen.** Eine
  Regel, die erst durch eine spätere Wahl (z. B. den General) sichtbar und
  pflichtig wird, muss im selben Zug gesetzt werden, nicht erst bei einem
  neuen Kontingent. *(Mensch, Antwort auf Rückfrage zum „Army of
  Sylvania"-Fall → „Laufend reagieren".)*
- **Automatisch gesetzte, später ausgeblendete Einträge werden nicht
  automatisch wieder entfernt** — nur Hinzufügen ist im Geltungsbereich, nie
  automatisches Entfernen. *(Default, unanswered — nicht ausdrücklich
  gefragt; kleinerer, sichererer Eingriff als eine Entfernen-Automatik.)*

## Log

- 2026-07-31: Angelegt aus einer Konversation, die mit der Frage begann,
  warum eine fehlende „The Laws of Undeath"-Auswahl bei Vampire Counts als
  Fehler gemeldet wird. Recherchiert (siehe Konversation für Details):
  - Der `min=1/max=1 scope=force`-Constraint sitzt direkt am
    `selectionEntry` „The Laws of Undeath"
    (`Vampire Counts (6th definitive edition).cat:11640-11652`), nicht an
    einer Kategorie — das dokumentierte Muster aus
    `docs/battlescribe-data-format.md` §9.9.
  - Jede unerfüllte Katalog-Grenze wird vom Evaluator unbedingt als
    `severity=error` eingestuft (`src/evaluator/violationClassification.js:34-44`,
    ADR-0034) — das ist keine Fehleinstufung, sondern Absicht.
  - `resolveListRuleGroup`/`buildListRuleStates` in `src/roster/listRules.js`
    leiten den Checkbox-Zustand ausschließlich aus der Roster-Präsenz ab
    (`checked: !!selection`, Zeile 153) — ohne den `min`-Wert des einzelnen
    Eintrags zu betrachten. Deshalb starten „The Laws of Undeath" (`min=1`)
    und „Allow experimental rules?" (`min=0`) identisch unchecked.
  - Genau diese pauschale Gleichbehandlung wurde einmal umgekehrt gebaut:
    Issue 34 materialisierte alle „Special list rules"-Einträge automatisch
    und entfernte ihre Bedienelemente; Issue 35 baute das eine Version später
    zurück, weil dadurch auch echte `min=0`-Schalter dauerhaft angeschaltet
    waren (`docs/adr/0011-...md:60-73`).
  - Weitere Instanzen desselben Datenmusters in den Fixture-Katalogen
    (`src/evaluator/__fixtures__/whfb6-definitive/`): „Gnoblar Army special
    rules" (Ogre Kingdoms, gleiche Form wie Laws of Undeath, bedingt
    ausgeblendet), „Army of Sylvania" (Vampire Counts, standardmäßig
    ausgeblendet, erst mit bestimmtem General pflichtig), „Bloodlines"
    (Vampire Counts, `min=1` aber mit eigener 5er-Wahlgruppe — Gegenbeispiel
    zu „keine Folgewahl"), „Ogre Bulls" (Ogre Kingdoms, root `entryLink` mit
    eigenen Kosten und Ausrüstungsoptionen — Gegenbeispiel zu „keine
    Kosten").
  - Architekturgrenze: `src/evaluator/` ist ein reiner Reinraum (ADR-0034),
    darf das Roster nicht mutieren (ADR-0030, per depcruise erzwungen); jede
    Umsetzung muss im Roster-/UI-Layer ansetzen, das den Bericht liest, nicht
    im Evaluator selbst.
  - Der Bericht ist synchron ab dem ersten Render verfügbar
    (`useEvaluation`, `src/evaluation/useEvaluation.js:49-51`, ein reines
    `useMemo`), es gibt aber noch keinen Mechanismus, der beim Anlegen eines
    Kontingents (`buildRoster`, `src/utils/createRoster.js:23-43`) reagiert —
    `forces[].selections` startet dort als leeres Array.

- 2026-07-31: **Tests geschrieben** (`test-author`, ohne Sicht auf eine
  Implementierung — es gibt noch keine). 55 Tests über 5 Dateien:
  `src/roster/listRules.mandatoryPredicate.test.js` (30, ungemockt gegen
  echte `catalogResolver.js`/`entryVisibility.js`/`modifierEvaluator.js`),
  `src/roster/listRules.mandatoryState.test.js` (5, gemockt wie das
  bestehende `listRules.test.js`), `src/hooks/useRoster.mandatoryAutoAdd.test.js`
  (7), `src/hooks/useRosterList.freshRosterIds.test.js` (5),
  `src/components/editor/ListRuleChecklist.mandatory.test.jsx` (8). Alle 82
  Tests der vier bestehenden Geschwisterdateien bleiben unverändert grün.
  Fehlschlag für jedes der 7 Kriterien belegt (`is not a function` bzw.
  falsche Assertion-Werte, siehe Testdateien).
  **Befund dabei:** das reale „Army of Sylvania"
  (`Vampire Counts (6th definitive edition).cat:10079-10120`), das dieses
  Issue als Beispiel für Kriterium 3 nennt, erfüllt Kriterium 1 selbst
  nicht — es trägt eine eigene `<selectionEntries>`-Unterauswahl
  („Grave markers") und wäre damit laut `isContainerListRule` kein
  zulässiges Ziel. Der `test-author` hat das erkannt und für den
  Kriterium-3-Test stattdessen eine isolierte, gegen die echte
  `entryVisibility.js` verifizierte Fixture gebaut, statt die Diskrepanz
  stillschweigend zu übernehmen. Ändert kein Kriterium — der reale
  Vampire-Counts-Katalog liefert nur kein Beispiel, das Kriterium 3 in
  freier Wildbahn zeigt; die Fähigkeit bleibt trotzdem gefordert. Ebenso
  geklärt: das reale „General" ist ein `selectionEntry` ohne `min`
  (nicht die vermutete Kategorie) und das reale „Ogre Bulls" scheitert
  schon am `type="unit"`-Filter, nicht primär an Kosten/Unterauswahl — beide
  wurden mit dem realen Datensatz statt einer Vermutung getestet.

- 2026-07-31: **Implementiert** (`implementer`, gegen die vorgeschriebenen
  Tests, ohne sie zu verändern). `listRules.js` bekam
  `isUnconditionalMandatoryListRule` und `findMissingMandatoryListRuleSelections`
  sowie ein `mandatory`-Feld in `buildListRuleStates`; `useRosterList.js`
  ein In-Memory-`freshRosterIds`/`isFreshRoster`; `useRoster.js` den neuen,
  auf `isFreshRoster` gegateten Effekt (Commit über `replaceRoster`);
  `RosterEditor.jsx`/`App.jsx` reichen `isFreshRoster` durch;
  `ListRuleChecklist.jsx` sperrt die Checkbox einer Pflichtzeile und zeigt
  die Erklärung über die bestehende `GothicTooltip`-Mechanik — die
  Hover-Listener mussten dafür von der (jetzt `disabled`) Checkbox auf ein
  umschließendes `&lt;span&gt;` wandern, weil deaktivierte Formularelemente in
  Browser und jsdom gleichermaßen keine Maus-Events mehr auslösen (empirisch
  mit drei Wegwerf-Tests verifiziert). Neuer i18n-Schlüssel
  `editor.listRules.mandatoryTooltip` (de/en).
  **Fakten:** `npx vitest run` der 5 neuen plus 4 Geschwisterdateien:
  140/140, exit 0. `npm test` (voller Lauf, 2793 Vitest-Tests über 268
  Dateien plus Puppeteer-E2E) zweimal grün, exit 0. `lint`/`typecheck`/
  `depcruise` je exit 0 (ein bereits vorbestehender, unveränderter
  Circular-Dependency-Hinweis in `depcruise`, `listRules.js` ist nicht Teil
  davon; keine Evaluator-Roster-Grenzverletzung). `knip` exit 1, aber
  ausschließlich dieselben 5 vorbestehenden Meldungen wie auf `main`.
  **Angenommen, nicht von einem Test erzwungen:** `findMissingMandatoryListRuleSelections`
  trägt laut Vertrag keinen `roster`-Parameter; die reaktive
  `hidden`-Auswertung (Kriterium 3) läuft deshalb über einen synthetischen
  Ein-Force-Roster-Ausschnitt statt über den echten, mehrere Kontingente
  umfassenden Roster — korrekt für den getesteten Ein-Force-Fall, eine
  unbewiesene Engstelle für eine hypothetische, roster-weite
  `scope="roster"`-Bedingung über mehrere Kontingente hinweg.
  **Kein Screenshot beigelegt:** die Offline-Fixtures von
  `scripts/generate_screenshots.js`/der E2E-Harness (`src/__fixtures__/whfb6/`)
  enthalten keinen §9.9-förmigen Pflicht-Listenregel-Eintrag; eine neue
  Fixture allein dafür erschien unverhältnismäßig zum Auftrag. Verhalten ist
  auf DOM-Ebene durch `ListRuleChecklist.mandatory.test.jsx` belegt.

- 2026-07-31: **Live im Browser verifiziert**, mit den echten
  Katalogdateien (`Warhammer Fantasy Battles (6th definitive edition).gst` +
  `Vampire Counts (6th definitive edition).cat`) über den echten
  Import-Weg der App (`Importer.jsx`, Datei-Upload, keine
  Test-Hooks). Frisch angelegte Vampire-Counts-Liste zeigt „The Laws of
  Undeath" in „Special list rules" automatisch angehakt, sichtbar gesperrt
  (goldene Optik, abweichend von den übrigen — unveränderten — Regeln wie
  „Bloodlines"/„Allow experimental rules?"), mit Tooltip beim Hover. DOM
  direkt geprüft: `checked: true, disabled: true`. Screenshots dem Menschen
  geschickt.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. Der Plan setzt genau den in der
  Grill-Befragung festgelegten Geltungsbereich um (nur kostenfreie
  Checkbox-Regeln ohne Folgewahl, nur `scope="force"/"roster"` direkt am
  Eintrag, laufendes Nachtriggern, gesperrte Checkbox mit Erklärung, nur neu
  angelegte Kontingente) und nutzt dafür, wo möglich, bestehende Muster
  (Katalog-Sync-Effekt, `GothicTooltip`) statt neuer Mechanik.
- **What surprised me?** Drei Dinge: (a) genau dieses Feature —
  Auto-Materialisierung von „Special list rules" — gab es schon einmal
  (Issue 34) und wurde eine Version später bewusst zurückgebaut (Issue 35),
  ein sehr naher Präzedenzfall, den ich vor der Recherche nicht kannte;
  (b) das „Ausgeblendet"-Filtern und das laufende Nachtriggern (Kriterien 3
  und 6) fallen praktisch kostenlos aus der bestehenden reinen
  Neuberechnung in `listRules.js` heraus — keine eigene
  „auf Sichtbarkeitswechsel horchen"-Mechanik nötig; (c) es gibt im
  gesamten Datenmodell heute kein Merkmal, das „in dieser Sitzung neu
  angelegt" von „bestehend" unterscheidet — das musste als neuer, bewusst
  nicht-persistierter Zustand entworfen werden und ist der unsicherste Teil
  des Plans.
- **What am I assuming without having verified it?** Dass jeder vom Sweep
  gefundene Pflichteintrag in einer „reinen" Listenregel-Kategorie sitzt,
  die `ListRuleChecklist` auch tatsächlich rendert — verifiziert für die
  Beispiele in Vampire Counts/Ogre Kingdoms, nicht bewiesen für jede
  denkbare Katalogstruktur (ein Treffer in einer gemischten Kategorie würde
  still zu `force.selections` hinzugefügt, ohne je eine sichtbare Checkbox
  zu bekommen — verletzt keines der sieben Kriterien, ist aber nicht
  ausdrücklich bedacht). Dass das Durchreichen von `isFreshRoster` über
  `App.jsx` → `RosterEditor` → `useRoster` der unaufdringlichste Weg ist —
  nicht geprüft, ob es an anderer Stelle im Code bereits ein
  Kontext-Muster für sitzungsweite Merkmale gibt, das dem vorzuziehen wäre.
  Dass die Kostenfreiheits-Prüfung über `resolved.costs` so einfach ist wie
  „jeder Wert 0 oder die Map leer" — die genaue Form von `resolved.costs`
  wurde nicht am echten Katalog verifiziert, nur aus der Recherche
  übernommen.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
