Status: ready-for-agent
Type: fix
Blocked by: None

## Description

### Symptom
In einer Rüstungs-Auswahlgruppe lassen sich eine Rüstung **und** ein Schild
nicht gleichzeitig wählen. Die Optionen verhalten sich als sich gegenseitig
ausschließende Radiobuttons; das Anwählen des Schilds wirft die zuvor gewählte
Rüstung wieder heraus. Beobachtet am Empire-**Captain** (Optionen: Full Plate /
Heavy / Light Armour + Shield). Andere Tools (NewRecruit) erlauben die
Kombination korrekt.

### Erwartetes Verhalten
Eine Rüstung plus ein Schild müssen zusammen wählbar sein, wenn die
Katalog-Daten das vorsehen. Die Referenz-Tools zeigen die Gruppe dann als
"(2/2)" und beide Optionen als angehakte Checkboxen.

### Ursache (verifiziert)
Es ist ein **App-Fehler**, nicht ein Daten-Fehler. Der Katalog modelliert den
Fall korrekt: Die Rüstungsgruppe hat `max=1`, plus einen bedingten Modifier
`type="increment"` auf die Gruppen-Max-Constraint, dessen Bedingung an die
Schild-Auswahl gekoppelt ist ("wenn ein Schild in der Gruppe gewählt ist, erhöhe
das Gruppen-Max um 1"). Das effektive Max ist also 1 ohne Schild und 2 mit
Schild — genau so lassen sich eine Rüstung + Schild kombinieren.

Der Solver wertet diesen Modifier bereits **richtig** aus: das angezeigte
"Max: N"-Label nutzt den modifier-angepassten Wert. Aber die Entscheidung
**Radio vs. Checkbox** in der Options-Gruppen-Komponente leitet sich vom
**rohen** Katalogwert der Max-Constraint ab (`=== 1`) statt vom effektiven,
modifier-angepassten Max. Ergebnis: Die Gruppe rendert immer als Radiobuttons.

Dadurch entsteht ein Teufelskreis: Weil es Radiobuttons sind, deselektiert das
Anwählen des Schilds die Rüstung — womit die Bedingung des Modifiers ("Schild
ist gewählt") über die UI nie stabil erfüllt werden kann und das Max nie auf 2
springt.

Sekundär: Label (angepasster Wert) und Radio-Entscheidung (roher Wert) leiten
sich uneinheitlich aus derselben Constraint ab und widersprechen sich.

### Umfang (verallgemeinert — verifiziert über beide Katalog-Quellen)
Das Muster "bedingter Modifier verändert ein **Gruppen-Max/Min**" ist kein
Empire-Spezialfall, sondern durchgängig in fast allen Armeebüchern beider Forks
(Ergofarg + Definitive Edition). Klassen (deduplizierte Vorkommen über beide
Forks):
- **64×** Gruppen-Max +1 wenn ein schild-artiges Item gewählt ist
  (Armour / Magic Armour, ~30 Gruppen, ~10 Armeebücher je Fork) — der
  Rüstung+Schild-Fall.
- **4×** Gruppen-Max bedingt **reduziert** (z. B. Weapons max 2 → 1 bei Battle
  Standard Bearer) — der **umgekehrte** Fall: Checkboxen müssen zu Radio werden.
- **13×** Gruppen-Max bedingt auf 0 (Gruppe deaktivieren).
- **24×** sonstige bedingte Max-Änderungen (Punkte-/Größen-Caps, Honors).
- **29×** Gruppen-Min bedingt erhöht (erzwingt eine Pflichtwahl).
- **116×** `increment`+`<repeat>` (mehrere gleiche Items) — bereits korrekt
  behandelt, muss unverändert weiterlaufen.

Die Katalog-Daten sind in allen Fällen **korrekt**; kein Katalog-Fix nötig.

### Ursache generalisiert
Der Solver berechnet effektive Constraint-Werte korrekt über den kanonischen
Helfer `getModifiedConstraintValue` (`src/solver/modifierEvaluator.js`), und die
Validatoren nutzen ihn bereits. Aber die **UI-Auswahl- und
Recruit-/Autofill-Logik** entscheidet an vielen Stellen aus **rohen**
Constraint-Werten statt aus effektiven. Betroffene Stellen (Zeilen können
driften — vor dem Fix am aktuellen Stand verifizieren):
- `src/components/editor/OptionGroup.jsx`: `minLimitOption`, `maxLimitOption`,
  `isRadio`, `isExplicitlyMulti`, `isBinary`, `isMandatory` (~Z. 226–242).
- `src/components/editor/SelectionConfigurator.jsx`: `minLimit`/`maxLimit`/
  `isMandatory`/`isBinary` und die Klammerungen der Count-Handler (~Z. 191–241).
- `src/components/editor/AutoFillSuggestions.jsx`: Auto-Select-/Mengenlogik
  (~Z. 91–104).
- `src/solver/optionsCollector.js`: `isOptionRosterUnique` (~Z. 210/220).
- `src/solver/listRules.js`: `isBinaryListRule` (~Z. 88–89).
- `src/solver/rosterCounter.js` (~Z. 105/113/123), `selectionFactory.js`
  (~Z. 10; hier ist **kein** `ctx` verfügbar → Kontext muss durchgereicht
  werden), `profileCollector.js` (~Z. 201) — jeweils die **Min**-Seite.

### Entscheidungen (mit Nutzer abgestimmt)
1. **Radio vs. Checkbox:** Eine Gruppe rendert als Checkboxen mit Live-Zähler
   (N/M), sobald ein Modifier ihr Max über 1 heben **kann** — nicht erst wenn
   das aktuelle effektive Max > 1 ist (sonst Teufelskreis: ohne Schild wäre das
   Max 1 → Radio → Schild nie wählbar). Nur echte, fix auf 1 gedeckelte Gruppen
   **ohne** solchen Modifier bleiben Radios. Verhalten wie NewRecruit ("2/2").
2. **Umfang:** Alle oben gelisteten rohe-Wert-Stellen werden in einem Zug auf
   effektive Werte umgestellt (inkl. Kontext-Durchreichung in
   `selectionFactory.js`).

### Doku
`docs/battlescribe-data-format.md` dokumentiert bislang nur das
`increment`+`<repeat>`-Muster. Es muss um das Muster "bedingter Modifier auf
Gruppen-Max/Min, an eine andere Auswahl oder einen Scope gekoppelt" ergänzt
werden, inkl. der Regel "Max-hebbar ⇒ Mehrfachauswahl".

## Acceptance Criteria
- [ ] **Rüstung + Schild (Hauptfall):** Am Empire-Captain lassen sich eine
      Rüstung (Full Plate / Heavy / Light) und ein Schild gleichzeitig auswählen;
      nach Schild-Wahl zeigt das Gruppen-Label das erhöhte Max (2). Gilt generisch
      für alle Armour-/Magic-Armour-Gruppen mit diesem Modifier.
- [ ] **Max-hebbar ⇒ Checkbox:** Eine Gruppe, deren Max durch irgendeinen
      Modifier über 1 gehoben werden kann, rendert als Mehrfachauswahl mit
      Live-Zähler — auch **bevor** die Bedingung erfüllt ist (kein Teufelskreis).
- [ ] **Umgekehrter Fall:** Eine Gruppe, deren effektives Max bedingt auf 1
      **sinkt** (z. B. Weapons bei Battle Standard Bearer), erzwingt dann
      gegenseitigen Ausschluss / verhindert eine zweite Auswahl.
- [ ] **Deaktivierung:** Eine Gruppe, deren Max bedingt auf 0 sinkt, ist dann
      nicht mehr auswählbar.
- [ ] **Min-Seite:** Ein bedingt erhöhtes Gruppen-Min wird konsistent als
      Pflichtwahl behandelt (Recruit/Autofill/Anzeige/Validierung).
- [ ] **Keine Regression:** Echte fix-`max=1`-Gruppen ohne max-hebenden Modifier
      bleiben Radios (Ausschluss); das `increment`+`<repeat>`-Muster (mehrere
      gleiche Items, z. B. Bannrollen) funktioniert unverändert.
- [ ] **Konsistenz:** Radio-/Checkbox-/Binär-/Mandatory-Entscheidung, der
      angezeigte "Max/Min: N", die Count-Klammerungen, `isOptionRosterUnique`,
      Autofill und die Solver-Min-Sites leiten sich alle aus **effektiven**
      (modifier-angepassten) Werten ab — kein roher Constraint-Wert steuert mehr
      eine dieser Entscheidungen.
- [ ] **E2E-Regressionstests** entlang des echten Nutzerpfads decken ab:
      Rüstung+Schild (hebbar), Weapons−BSB (senkend), fix-`max=1` bleibt Radio,
      `increment`+`<repeat>` bleibt Mehrfach.
- [ ] `docs/battlescribe-data-format.md` beschreibt die neuen Muster inkl. der
      "Max-hebbar ⇒ Mehrfachauswahl"-Regel.
- [ ] `npm test`, Lint und Typecheck sind grün.

## Comments
- Implementierungshinweis (verifiziert, Stand Analyse): Die kaputte Stelle ist die isRadio-Ableitung in src/components/editor/OptionGroup.jsx (~Z. 235), die c.value === 1 aus der rohen Constraint liest statt aus dem effektiven Max. Das effektive Max liefert getModifiedConstraintValue (src/solver/modifierEvaluator.js), wie es das Label bereits nutzt (OptionGroup.jsx ~Z. 104 / 173-175). Der bestehende Max-Erhoehungs-Sonderfall isRepeatableWithinGroup (OptionGroup.jsx ~Z. 92-101) greift nicht, da er ein <repeat> auf dasselbe Item verlangt. Konkreter Katalog-Beleg: Empire Captain, Armour-Gruppe, Modifier type=increment field=3abf-ef75-7480-0e27 mit Bedingung childId=Shield (equalTo 1). Zeilennummern koennen driften - vor dem Fix am aktuellen Stand verifizieren.
- Analyse-Ergebnis (Katalog + Code), Verallgemeinerung. KATALOG (beide Forks): Muster 'bedingter Modifier auf Gruppen-Max' ist weit verbreitet: 64 Vorkommen 'Max +1 wenn Schild-artiges Item gewaehlt' ueber 30 versch. Gruppen (Armour/Magic Armour in ~10 Armeebuechern je Fork; Beispiele: Empire, Chaos/Forces of Chaos, Skaven, Dogs of War, Kislev, Vampire Counts, Chaos Dwarfs, Orcs&Goblins, Wood Elves, Tomb Kings). Weitere Klassen: 13x Max bedingt=0 (Gruppe deaktivieren); 4x Max bedingt reduziert (z.B. Weapons -1 bei Battle Standard Bearer -> UMGEKEHRT: Checkbox muss zu Radio werden); 24x sonstige Max-Caps; 29x Min bedingt erhoeht (Pflichtwahl). 116x increment+repeat sind bereits korrekt behandelt. CODE-AUDIT: rohe-statt-effektive Constraint-Werte an vielen Stellen: OptionGroup.jsx (226 minOption, 227 maxOption, 235 isRadio, 241 isExplicitlyMulti, 242 isBinary), SelectionConfigurator.jsx (191-194 min/max/isMandatory/isBinary, 224/230/241 clamps), AutoFillSuggestions.jsx (91-98,104), optionsCollector.js (210/220 isOptionRosterUnique), listRules.js (88-89), rosterCounter.js (105/113/123 min), selectionFactory.js (10 min, kein ctx verfuegbar), profileCollector.js (201 min). Kanonischer Helfer: getModifiedConstraintValue (modifierEvaluator.js:418); Validatoren nutzen ihn bereits korrekt. DESIGN-HAKEN: Radio/Checkbox darf nicht am AKTUELLEN effektiven Max haengen (ohne Schild=1 -> Teufelskreis), sondern daran, ob ein Modifier das Max ueber 1 heben KANN -> dann Checkboxen mit Live-Zaehler (wie NewRecruit 2/2).
- Alle drei Child-Issues resolved (01 Solver-Fundament, 02 Umstellung auf effektive Werte = eigentlicher Fix, 03 Doku + konsolidierte Regression). Gesamt-Suite gruen: oxlint, tsc --noEmit, vitest (1348 Tests) und Puppeteer-E2E. Verhalten am Empire-Captain verifiziert (Ruestung + Schild gleichzeitig, Armour 2/2). Version 1.5.0. Bereit fuer PR.
- Wiedereroeffnet: PR #112 noch offen; neues Child 04 (Barding/Upgrade-Mount-Fehl-Zuweisung) wird laut Nutzer im selben PR bearbeitet. Bewusste Abweichung von 1-Issue-1-PR.
- Child 04 (verschachtelte Unter-Option gruppierter Upgrade-Mount, Barding) resolved und in den PR-Branch gemergt. Gesamt-Suite gruen (oxlint, tsc, vitest 1353 Tests, Puppeteer-E2E). Alle vier Child-Issues resolved. Wieder resolved; PR #112 wird aktualisiert.
