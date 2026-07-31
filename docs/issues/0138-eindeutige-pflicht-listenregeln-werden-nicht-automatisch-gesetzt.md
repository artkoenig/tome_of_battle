---
status: done
branch: claude/vampire-list-laws-undeath-3ooflh
pr: https://github.com/artkoenig/tome_of_battle/pull/193
---

# Eindeutige Pflicht-Listenregeln (min≥1) werden nicht automatisch gesetzt

> **In Teilen überholt durch Issue 0140.** Die Bedingung „keine Kosten in
> irgendeiner Kostenart" aus Kriterium 1 — und die daraus folgende Aussage in
> Kriterium 2, ein kostenpflichtiger Wurzeleintrag werde nicht automatisch
> gesetzt — gilt nicht mehr. Kosten spielen für die Pflicht-Erkennung keine
> Rolle. Ebenfalls präzisiert: die Checkbox einer Pflichtregel (Kriterium 5)
> ist nur gesperrt, solange die Regel tatsächlich vorhanden ist. Alles Übrige
> in dieser Akte gilt unverändert; sie bleibt der historische Datensatz ihres
> eigenen Laufs.

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
   handelt. Dieser Hinweis ist über dasselbe Info-Symbol erreichbar, über das
   diese Datei an anderer Stelle bereits Katalog-Beschreibungstexte zeigt
   (Hover auf breiten, Tipp auf schmalen Viewports — keine separate,
   nur-Hover-Mechanik) — er nutzt, wo der Katalog einen liefert, den echten
   Beschreibungstext des Eintrags und hängt den Pflicht-Hinweis dahinter an.
   Das gilt unabhängig davon, ob für den Eintrag zusätzlich ein externer
   Regel-Link (6th.whfb.app) auflösbar wäre — der Pflicht-Hinweis darf davon
   nie verdrängt werden.
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
- `src/components/editor/ListRuleChecklist.jsx` — rendert `disabled` für
  `state.mandatory`-Zeilen; der Hinweis wandert von der (deaktivierten)
  Checkbox auf ein Info-Symbol neben dem Regelnamen (Revision nach
  Prüfrunde 1, F2 — siehe unten).
- `src/components/editor/RuleChipIcon.jsx` — neuer optionaler Prop, der die
  BookOpen-Link-Priorität für eine Zeile unterdrückt, deren Info-Inhalt nie
  von einem externen Regel-Link verdrängt werden darf (Revision nach
  Prüfrunde 1, F2).
- `src/i18n/locales/de.json`, `en.json` — Schlüssel
  `editor.listRules.mandatoryTooltip` bleibt, ändert Bedeutung: nicht mehr
  alleiniger Tooltip-Inhalt, sondern an den Katalog-Beschreibungstext
  angehängter Zusatz.

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
   (Container- und reine Schalter-Zeile) `disabled` zu setzen.

3a. **Revision nach Prüfrunde 1 (F2), ersetzt den ursprünglichen
    Hover-only-Ansatz von Contract 3:** Der sichtbare Hinweis sitzt nicht
    mehr auf der Checkbox, sondern auf einem Info-Symbol neben
    `state.name` — demselben Baustein, den `SelectionConfigurator.jsx`
    bereits für Katalog-Beschreibungen von Unteroptionen einsetzt
    (`RuleChipIcon`, `hasInfo`/`onInfoClick`/`onInfoEnter`/`onInfoMove`/
    `onInfoLeave`, gespeist aus `resolveEntry(system, state.entry,
    activeCatalogue?.id)` + `renderUpgradeDetails(res, system)`). Für eine
    Pflichtzeile gilt zusätzlich: das Symbol erscheint **immer** (nicht nur
    wenn `renderUpgradeDetails` etwas liefert), und sein Inhalt ist
    `renderUpgradeDetails(res, system)` gefolgt vom bestehenden
    `t('editor.listRules.mandatoryTooltip')`-Satz. Erreichbarkeit folgt der
    in dieser Datei etablierten Mechanik unverändert: Hover +
    `GothicTooltip` auf breiten, Tap + `BottomSheet` (`activeInfo`) auf
    schmalen Viewports — dieselbe `handleMouseEnter`/`setActiveInfo`-Mechanik,
    die diese Datei bereits an `SelectionConfigurator` durchreicht, jetzt
    zusätzlich für die eigene Zeile selbst genutzt. Der
    `list-rule-checkbox-slot`-Wrapper und seine dedizierten
    `handleMandatoryMouse*`-Handler entfallen wieder: sie waren nur nötig,
    weil ein `disabled`-Input keine Maus-Events zustellt — das Info-Symbol
    ist kein deaktiviertes Element und braucht den Umweg nicht.

3b. `RuleChipIcon` zeigt statt des Info-Symbols einen externen Regel-Link
    (`BookOpen`), sobald `useRuleUrl` für den Namen eine 6th.whfb.app-URL
    auflöst (bestehende, bewusste Priorität, siehe Docstring der
    Komponente) — für eine Pflichtzeile darf das den Pflicht-Hinweis aber
    nie verdrängen (Kriterium 5, letzter Satz). `RuleChipIcon` bekommt dafür
    einen neuen optionalen Prop (z. B. `forceInfo`), der die Link-Priorität
    für genau diesen Aufruf abschaltet; `ListRuleChecklist` setzt ihn für
    jede `state.mandatory`-Zeile.

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
  verdrahtete `GothicTooltip`/`BottomSheet`-Mechanik statt eines schlichten
  `title=`-Attributs** — die Datei bindet diese Komponente schon für ihre
  Info-Popups ein; sie zu erweitern hält ein einziges Tooltip-Mittel in
  dieser Datei statt ein zweites daneben einzuführen. *(Revidiert nach
  Prüfrunde 1, F2 — siehe Contract 3a: der ursprüngliche Hover-only-Sitz auf
  der Checkbox selbst deckte die Tap-Hälfte dieser Mechanik nicht ab; das
  Info-Symbol-Muster tut es, weil es beide Hälften schon mitbringt.)*
- **Das Info-Symbol zeigt den echten Katalog-Beschreibungstext statt nur
  eines festen Satzes** — derselbe Mechanismus, den
  `SelectionConfigurator.jsx` für jede andere Unteroption schon nutzt
  (`resolveEntry` + `renderUpgradeDetails`); ein Pflicht-Listenregel-Eintrag
  wie „The Laws of Undeath" trägt in der Praxis eigene `infoLinks` vom Typ
  `rule` (verifiziert an `Vampire Counts (6th definitive edition).cat:11640-11652`,
  die `resolveEntry` bereits in `res.rules` auflöst) — diesen Text zu
  ignorieren und nur den generischen Pflicht-Satz zu zeigen, wäre
  informationsärmer als das, was jede andere Zeile im selben Panel schon
  bietet. *(Mensch, Antwort in der Konversation zum F2-Fix → „in den
  Katalogdaten stehen wahrscheinlich Beschreibungstexte zu diesen
  Einträgen. Diese sollen wie an anderer Stelle per Info-Symbol erreichbar
  gemacht werden. Die Nicht-Abwählbarkeit des Eintrags kann hinter dem
  Beschreibungstext hinzugefügt werden".)*
- **Das Info-Symbol einer Pflichtzeile fällt nie auf den externen
  `BookOpen`-Regel-Link zurück, selbst wenn `useRuleUrl` einen fände** —
  `RuleChipIcon`s bestehende Priorität (Link vor Info) ist für gewöhnliche
  Unteroptionen richtig, würde für eine Pflichtzeile aber den in Kriterium 5
  verlangten Hinweis unerreichbar machen, sobald ein Katalog-Eintrag zufällig
  einen 6th.whfb.app-Mapping-Treffer hat. Kein realer Treffer für „The Laws
  of Undeath" in der aktuellen `rulesLookup.js` (verifiziert), aber das
  Feature gilt katalogweit, nicht nur für dieses eine Beispiel.

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
- **F2-Fix (Kriterium 5) zeigt den echten Katalog-Beschreibungstext über das
  bestehende Info-Symbol-Muster, statt eine Tap-Alternative allein für den
  festen Pflicht-Satz nachzurüsten.** Der ursprünglich beauftragte
  `implementer`-Fix (reine Tap-Erweiterung der bisherigen
  Hover-only-Checkbox-Lösung) wurde deshalb abgebrochen, bevor er fertig
  war. *(Mensch, in der Konversation nach Prüfrunde 1 → „in den
  Katalogdaten stehen wahrscheinlich Beschreibungstexte zu diesen
  Einträgen. Diese sollen wie an anderer Stelle per Info-Symbol erreichbar
  gemacht werden. Die Nicht-Abwählbarkeit des Eintrags kann hinter dem
  Beschreibungstext hinzugefügt werden".)*

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

- 2026-07-31: **Prüfrunde 1** (frischer Kontext, `db89d9c..eda4edf`),
  3 Befunde. Fakten der Runde: `npm test` exit 0 (268 Dateien / 2793 Tests
  plus Puppeteer-E2E), `lint`/`typecheck`/`depcruise` je exit 0 (ein neues,
  nicht-fatales oxlint-`exhaustive-deps`-Warning im neuen Effekt, kosmetisch
  — die fehlenden Deps sind nicht memoisiert, ändern also nichts am
  Verhalten), `knip` warn-only mit denselben 5 vorbestehenden Meldungen wie
  auf `main`.
  - *F1 (kein Kriterium verletzt): zur Kenntnis genommen, nicht behoben.*
    Der bestehende Katalog-Sync-Effekt und der neue Pflicht-Auto-Add-Effekt
    in `useRoster.js` können sich im selben Renderzyklus gegenseitig
    überschreiben, weil `replaceRoster` keinen funktionalen Updater
    unterstützt. Selbstheilend über 2–3 Renderzyklen, kein Datenverlust,
    kein fehlerhafter persistenter Zustand (der Autosave läuft nur aus dem
    „nichts zu reparieren"-Zweig des Sync-Effekts, der bei einem
    Zwischenstand übersprungen wird). Verdoppelt die Angriffsfläche eines
    vorbestehenden Musters (nicht-komponierbare `replaceRoster`-Dispatches);
    keine Kriteriumsverletzung, deshalb kein Fix in diesem Durchgang —
    als Beobachtung stehengelassen.
  - *F2 (Kriterium 5): bestätigt, wird behoben.* Der Erklärungstext der
    gesperrten Checkbox ist rein Hover-basiert; unter der im Projekt
    etablierten Mobil-Schwelle (`window.innerWidth <= 900`) liefert
    `handleMouseEnter` in `ListRuleChecklist.jsx` gar keinen Tooltip, und
    anders als das eigene Geschwister-Muster dieser Datei
    (`SelectionConfigurator.jsx`/`RuleChipIcon.jsx`, Tap-Alternative über
    `onInfoClick`/`BottomSheet`) fehlt eine Tap-Alternative komplett. Auf
    einem schmalen Viewport sieht der Nutzer eine gesperrte Checkbox ganz
    ohne Erklärung — Kriterium 5 verlangt „einen sichtbaren Hinweis“, der
    dort tatsächlich fehlt.
  - *F3 (kein Kriterium verletzt): bestätigt als Nicht-Problem.* Die vom
    `implementer` selbst geflaggte Ein-Force-Roster-Näherung in
    `findMissingMandatoryListRuleSelections` ist harmlos, weil `isFreshRoster`
    strukturell nur für frisch über `buildRoster` erzeugte Roster gilt, die
    immer genau eine Force haben — es gibt aktuell keinen Codepfad, der
    einem als frisch markierten Roster eine zweite Force hinzufügt.

- 2026-07-31: **F2-Fix umgeplant, bevor der erste Ansatz fertig war.** Der
  zunächst beauftragte `implementer`-Lauf (reine Tap-Erweiterung der
  bestehenden Hover-only-Checkbox-Erklärung, siehe Contract 3 alt) wurde vom
  Menschen unterbrochen zugunsten eines saubereren Ansatzes: das Info-Symbol
  wiederverwenden, das `SelectionConfigurator.jsx` bereits für
  Katalog-Beschreibungen von Unteroptionen einsetzt, statt eine
  zweite, feste Tooltip-Zeichenkette um eine eigene Tap-Mechanik zu
  ergänzen. Vor der Umsetzung selbst recherchiert (siehe Decisions/Contract
  3a-3b oben):
  - `state.entry` (roh, unaufgelöst) ist bereits Teil von `ListRuleState`
    (`src/roster/listRules.js:229`) — `resolveEntry(system, state.entry,
    activeCatalogue?.id)` liefert denselben `res`, den
    `SelectionConfigurator.jsx` für jede Unteroption auflöst.
  - „The Laws of Undeath" trägt im echten Katalog drei `infoLinks` vom Typ
    `rule` (u. a. auf sich selbst, `targetId="4f19-ae5c-1eb4-9f02"`,
    `Vampire Counts (6th definitive edition).cat:11640-11652`);
    `resolveEntry` löst diese bereits in `res.rules` auf
    (`catalogResolver.js:253-, 304-338`), `renderUpgradeDetails(res,
    system)` liest sie direkt — kein neuer Auflösungscode nötig.
  - `RuleChipIcon.jsx` zeigt statt des Info-Symbols einen externen
    `BookOpen`-Link, sobald `useRuleUrl(name)` eine 6th.whfb.app-URL findet
    (bewusste Priorität, siehe Docstring) — für eine Pflichtzeile würde das
    den in Kriterium 5 verlangten Hinweis komplett verdrängen. Kein Treffer
    für „The Laws of Undeath" in der aktuellen `src/data/rulesLookup.js`
    (verifiziert per Grep), aber das Feature gilt katalogweit; die Priorität
    muss für Pflichtzeilen deshalb ausdrücklich abschaltbar sein (neuer
    `RuleChipIcon`-Prop, Contract 3b).
  - Der unfertige Zwischenstand des abgebrochenen Laufs (Hover-Handler auf
    `.list-rule-checkbox-slot`, teilweise Tap-Erweiterung) wurde vor dieser
    Umplanung verworfen (`git checkout --`, ungetrackte Arbeit, nie
    committet).
  Nächster Schritt: `test-author` erneut beauftragen, diesmal für den
  Info-Symbol-Ansatz — die beiden bestehenden F2-Testdateien
  (`ListRuleChecklist.mandatory.test.jsx`,
  `ListRuleChecklist.mandatoryNarrowViewport.test.jsx`) decken die
  verworfene Checkbox-Hover/Tap-Mechanik ab und müssen auf den neuen Ansatz
  umgeschrieben werden.

- 2026-07-31: **Tests für den Info-Symbol-Ansatz umgeschrieben**
  (`test-author`, ohne Sicht auf eine Implementierung). Beide Dateien
  überarbeitet: `ListRuleChecklist.mandatory.test.jsx` (16 Tests, Desktop/
  Hover-Hälfte plus die Checkbox-Sperre als Regression), `ListRuleChecklist.mandatoryNarrowViewport.test.jsx`
  (7 Tests, Tap/`BottomSheet`-Hälfte). Deckung: Info-Symbol erscheint bei
  einer Pflichtzeile unbedingt (auch ohne Katalog-Beschreibung), Hover
  (breiter Viewport) und Tap (`<=900px`, Grenzfall exakt 900 mitgetestet)
  zeigen denselben kombinierten Inhalt — echter Beschreibungstext gefolgt
  vom `mandatoryTooltip`-Satz, per Reihenfolge-Assertion belegt —, der
  Hinweis bleibt erreichbar, selbst wenn `useRuleUrl` einen 6th.whfb.app-Link
  für den Namen fände (`RuleChipIcon`s BookOpen-Priorität greift für eine
  Pflichtzeile nicht), die Checkbox-Sperre bleibt unverändert bestehen, und
  eine nicht-pflichtige Zeile bekommt weder Symbol noch Tap-Verhalten
  (Nicht-Regression). Konvention aus `RuleChipIcon.test.jsx`/`UnitChips.test.jsx`
  übernommen: `lucide-react`s `Info`/`BookOpen` sowie `getRuleUrl`/`useSettings`
  gemockt, `RuleChipIcon` selbst nicht — seine Link-vs-Info-Priorität (und
  deren Aushebelung für Pflichtzeilen) läuft dadurch echt mit.
  `resolveEntry` wird ebenfalls nicht gemockt; die Fixtures tragen ihre
  Beschreibung direkt in `entry.rules[].description`, was `resolveEntry`
  bei einem `system={}}`-Stub nachweislich unverändert durchreicht (in
  diesem Log verifiziert: `resolveEntry` fasst einen Eintrag ohne
  `targetId` lediglich per Spread zusammen und liest `system` sonst nur für
  Publikationsreferenzen, die bei fehlender `publicationId`/`page` früh mit
  `''` zurückkehren, ohne `system` anzufassen).
  **Fakten:** `npx vitest run` der beiden Dateien: 13 fehlgeschlagen/10
  bestanden (23) — jeder Fehlschlag entweder „`icon-info`
  nicht gefunden" (Symbol existiert im alten Design noch nicht) oder ein
  unerwartetes `.gothic-tooltip` (alte Hover-auf-Checkbox-Mechanik feuert
  noch) —, nie ein Import-/Tippfehler; die 10 bestehenden Checkbox-Sperr-
  und Nicht-Regressions-Tests bleiben grün. Selbst nachvollzogen (gleiches
  Ergebnis).
  **Offene Frage des `test-author`, hier beantwortet:** ob das Info-Symbol
  auch auf nicht-pflichtige Listenregel-Zeilen gehören sollte — nein, außerhalb
  des Geltungsbereichs dieser Issue; „an anderer Stelle" in der
  menschlichen Vorgabe bezog sich auf die bereits bestehenden
  `SelectionConfigurator`-Unteroptionen, nicht auf eine Erweiterung der
  Ankreuzliste selbst. Der `test-author` hat das richtig so gelesen und
  entsprechend eine Nicht-Regressions-Assertion für nicht-pflichtige Zeilen
  ergänzt.

- 2026-07-31: **F2 implementiert** (`implementer`, gegen die umgeschriebenen
  Tests, ohne sie zu verändern). `ListRuleChecklist.jsx`: die
  `.list-rule-checkbox-slot`-Wrapper samt `handleMandatoryMouse*`-Handlern
  entfallen; ein neues `renderMandatoryInfoIcon(state)` rendert für
  `state.mandatory`-Zeilen ein `RuleChipIcon` neben `state.name` (beide
  Checkbox-Stellen), gespeist aus `mandatoryInfoContent(state)` —
  `resolveEntry(system, state.entry, activeCatalogue?.id)` gefolgt von
  `renderUpgradeDetails(res, system)` plus dem bestehenden
  `t('editor.listRules.mandatoryTooltip')`-Satz —, verdrahtet über die
  bereits vorhandenen `handleMouseEnter`/`handleMouseMove`/`handleMouseLeave`/
  `setActiveInfo`-Funktionen dieser Datei (dieselben, die schon an
  `SelectionConfigurator` durchgereicht werden). Die Checkbox selbst bleibt
  unverändert `disabled={state.mandatory}`, trägt aber keine
  Interaktions-Handler mehr. `RuleChipIcon.jsx` bekam den neuen optionalen
  Prop `forceInfo` (Default `false`): erzwingt das Info-Symbol unabhängig
  von `hasInfo` und unterdrückt die sonstige BookOpen-Link-Priorität — alle
  bestehenden Aufrufstellen (`OptionGroup.jsx`, `UnitChips.jsx`,
  `SelectionConfigurator.jsx`) lassen ihn weg und bleiben unverändert.
  `33-list-rule-checklist.css` verlor die nun ungenutzte
  `.list-rule-checkbox-slot { display: contents; }`-Regel.
  **Fakten** (vom `implementer` berichtet, stichprobenartig selbst
  nachvollzogen): `npx vitest run` der beiden Zieldateien 23/23, exit 0
  (vorher 13 fehlgeschlagen/10 bestanden); zusätzlich mit
  `ListRuleChecklist.test.jsx` + `RuleChipIcon.test.jsx` zusammen 40/40,
  exit 0 (selbst nachvollzogen). `npm test` (voller Lauf, 269 Dateien/2808
  Tests plus Puppeteer-E2E) exit 0. `lint`/`typecheck`/`depcruise` je exit 0
  (selbst nachvollzogen für `lint`/`typecheck`: ausschließlich dieselben
  vorbestehenden Meldungen wie zuvor, keine in den geänderten Dateien).
  `knip` exit 1, unverändert 9 vorbestehende Meldungen.
  **Angenommen, nicht von einem Test erzwungen:** `hasInfo`/`onShowRule`
  werden am Pflicht-Symbol zusätzlich zu `forceInfo` mitgegeben, rein zur
  Formangleichung an die anderen `RuleChipIcon`-Aufrufstellen (von `tsc`s
  JSDoc-Prop-Typprüfung verlangt) — funktional trägt `forceInfo` allein
  bereits das gesamte Verhalten. Der kombinierte Popup-Inhalt entsteht über
  ein React-Fragment statt eines manuellen String-Joins, wie an
  `SelectionConfigurator`s eigener Verwendung derselben Felder bereits
  vorgemacht — kein Test bindet die genaue DOM-Form über die
  Reihenfolgen-Assertion hinaus.

- 2026-07-31: **Prüfrunde 2** (frischer Kontext, `db89d9c..4d6bb32`, damit
  erstmals über den gesamten Feature-Diff inklusive F2-Fix). Fakten der
  Runde, selbst ausgeführt statt aus dem Log übernommen: `npm test` exit 0
  (269 Dateien/2808 Tests plus Puppeteer-E2E), `lint`/`typecheck` je exit 0
  (nur dieselben vorbestehenden Warnungen), `depcruise` exit 0 (dieselbe
  eine vorbestehende, themenfremde Zirkelbeziehung, keine
  Reinraum-Grenzverletzung), `knip` exit 1 mit denselben 9 Meldungen wie
  auf dem Merge-Base (per Diff gegen einen `db89d9c`-Worktree verifiziert).
  Alle 7 Kriterien einzeln gegen den vollständigen Diff erneut geprüft:
  1–4, 6, 7 erfüllt; Kriterium 5 erfüllt für beide von echten Katalogdaten
  belegten Checkbox-Formen (Behälter- und Schalter-Zeile).
  - *F4 (Kriterium 5, Lücke im Wortlaut, kein bekannter Auslöser in echten
    Katalogdaten): zur Kenntnis genommen, nicht behoben.* `isUnconditionalMandatoryListRule`
    prüft nur den MIN-Constraint, unabhängig vom (vorbestehenden,
    unveränderten) `isBinaryListRule`, das nur den MAX-Constraint prüft —
    ein Eintrag mit `min≥1` **und** `max>1` wäre technisch als
    `{mandatory: true, isBinary: false}` erreichbar. Der
    `!state.isBinary`-Zweig in `ListRuleChecklist.jsx` (Mengen-Adder statt
    Checkbox) liest `state.mandatory` nirgends — eine solche Zeile bekäme
    weder Sperre noch Hinweis, ein Wortlautverstoß gegen Kriterium 5. Kein
    Katalog-Fund für diese Kombination; `isBinaryListRule`s eigener
    Docstring nennt einen nicht-binären Listenregel-Eintrag ohnehin
    „bislang nirgends belegt" — unabhängig von Pflicht. Weder Kriterium 1
    (das nur `upgrade`-Typ, Kostenfreiheit, fehlende Unterauswahlen und
    `hidden` nennt) noch Contract 3 (das ausdrücklich nur „beiden
    Checkbox-Stellen" — die zwei binären Formen — meint) entscheiden diesen
    Fall. Kein Fix in diesem Durchgang: eine geratene Erwartung für eine
    Form, die kein reales Katalogdatum zeigt, wäre genau die Art
    Übergriff, den dieses Issue bei Issue 34 bewusst vermeiden wollte;
    dokumentiert hier als bekannte, akzeptierte Lücke, zu beheben, sobald
    ein realer Katalog-Fund sie zeigt.
  - Keine weiteren Befunde. `RuleChipIcon`s neuer `forceInfo`-Prop lässt
    alle drei anderen Aufrufstellen (`OptionGroup.jsx`, `UnitChips.jsx`,
    `SelectionConfigurator.jsx`) nachweislich unverändert (Default `false`,
    beide Bedingungen reduzieren sich exakt auf ihre alte Form). Der
    Wegfall von `.list-rule-checkbox-slot` ist ein Netto-Null-Diff der CSS
    gegen den Merge-Base (Klasse in diesem Branch hinzugefügt und wieder
    entfernt); Zeilenstruktur und Platzierung des neuen Symbols entsprechen
    dem bereits an `OptionGroup.jsx` etablierten Muster.

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

- **Does this match what was asked?** Ja, einschließlich einer Kurskorrektur
  unterwegs: Prüfrunde 1 fand, dass der gesperrten Checkbox auf schmalen
  Viewports jede Erklärung fehlte (F2, Kriterium 5); der Mensch hat den
  zunächst beauftragten Reparaturansatz (eine bloße Tap-Erweiterung der
  Hover-only-Mechanik) noch während der Umsetzung gestoppt und stattdessen
  verlangt, das bereits bestehende Info-Symbol-Muster wiederzuverwenden und
  den echten Katalog-Beschreibungstext zu zeigen. Das umgesetzte Ergebnis
  entspricht dieser zweiten, präziseren Vorgabe; Prüfrunde 2 hat es gegen
  den vollständigen Diff und alle sieben Kriterien erneut bestätigt.
- **What surprised me?** Dass die naheliegendere, letztlich gewählte Lösung
  (echtes Info-Symbol statt fester Tooltip-Zeichenkette) so nah an
  bestehendem Code lag, dass sie den Dateiumfang gegenüber dem ersten
  Reparaturversuch sogar verringerte (der `.list-rule-checkbox-slot`-Umweg
  entfiel komplett) statt ihn zu vergrößern — eine Korrektur, die zugleich
  einfacher wurde. Ebenso, dass Prüfrunde 2 eine bislang unbedachte
  MIN/MAX-Unabhängigkeit im Prädikat aufdeckte (F4: ein technisch
  erreichbarer, aber in keinem bekannten Katalog belegter
  Pflicht-plus-nicht-binär-Fall, der durch das Ankreuzfeld-Raster fällt) —
  ein Wortlaut-Randfall, den weder die Akzeptanzkriterien noch der Plan
  entscheiden.
- **What am I assuming without having verified it?** Dass F4 tatsächlich
  folgenlos bleibt, bis ein realer Katalog-Fund es zeigt — nicht durch eine
  Suche über alle vier Fixture-Kataloge hinaus verifiziert, nur durch
  `isBinaryListRule`s eigenen Docstring gestützt. Alles Übrige aus dem
  „Before implementation"-Checkpoint gilt unverändert fort (insbesondere:
  keine Suche nach einem bereits bestehenden sitzungsweiten
  Kontext-Muster als Alternative zu `isFreshRoster`s Props-Durchreichung).

## Retro

Eine reguläre Prüfrunde (F2) hat einen Entwurfsfehler früh genug gefunden,
um ihn vor dem PR zu korrigieren, statt ihn als Nacharbeit zu verschleppen —
das Verfahren hat hier genau das geleistet, wofür es gedacht ist. Die
eigentliche Lehre liegt aber davor: der erste beauftragte Fix-Versuch (eine
Tap-Erweiterung der bestehenden Mechanik) hätte AC5 zwar formal erfüllt,
wäre aber informationsärmer als der Rest der Oberfläche geblieben — das hat
erst der Mensch bemerkt, nicht die Testabdeckung, weil kein Akzeptanzkriterium
verlangt, den *echten* Katalogtext zu zeigen, nur „einen sichtbaren Hinweis“.
Für künftige Oberflächen-Kriterien lohnt sich deshalb die Zusatzfrage: „gibt
es an anderer Stelle im selben Bildschirm bereits ein Muster für diese Art
Information, das die Erwartung genauer fassen sollte, als das Kriterium es
tut?“ — bevor der erste Reparaturansatz startet, nicht erst danach.
