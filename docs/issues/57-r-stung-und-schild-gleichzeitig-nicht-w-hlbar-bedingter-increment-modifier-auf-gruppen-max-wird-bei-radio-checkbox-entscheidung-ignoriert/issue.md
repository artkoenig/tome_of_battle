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

### Lösungsrichtung
Die Radio-/Checkbox-Entscheidung (und analog die Binär-/Einzelwahl-Logik) muss
auf dem **effektiven, modifier-angepassten** Gruppen-Max basieren, nicht auf dem
rohen Katalogwert. Der bestehende Sonderfall, der ein erhöhtes Gruppen-Max
berücksichtigt, greift hier nicht: Er ist auf `increment`-Modifier mit `<repeat>`
auf dasselbe Item beschränkt (Muster "mehrere gleiche Items", z. B. Bannrollen).
Der hier vorliegende Modifier hat kein `<repeat>` und ist an eine **andere**
Schwester-Auswahl (Schild) gekoppelt — ein bisher nicht abgedecktes Muster.

Am Solver (`modifierEvaluator.js`) ist nichts zu ändern; er berechnet das
effektive Max bereits korrekt. Der Fix liegt allein in der Ableitung der
Darstellung (Radio/Checkbox) aus dem effektiven Max.

### Betroffene Katalog-Quellen
Beide Quellen (Ergofarg-Fork und Definitive-Edition/Lexicanum-Fork) modellieren
den Captain identisch mit diesem bedingten Modifier. Kein Katalog-Fix nötig.

### Doku-Lücke
`docs/battlescribe-data-format.md` dokumentiert bislang nur das
`increment`+`<repeat>`-Muster (mehrere gleiche Items). Das hier vorliegende
Muster "bedingter increment auf Gruppen-Max, an eine andere Auswahl in der
Gruppe gekoppelt" sollte im Zuge des Fixes dort ergänzt werden.

## Acceptance Criteria
- [ ] In einer Auswahlgruppe mit `max=1` plus einem bedingten
      `increment`-Modifier auf die Gruppen-Max-Constraint, dessen effektives Max
      (bei erfüllter Bedingung) > 1 ist, rendern die Optionen als Checkboxen,
      nicht als sich ausschließende Radiobuttons.
- [ ] Konkret am Empire-Captain: eine Rüstung (Full Plate / Heavy / Light) und
      ein Schild lassen sich gleichzeitig auswählen; das Gruppen-Label zeigt nach
      Schild-Wahl das erhöhte Max (2) an.
- [ ] Die Radio-/Checkbox- bzw. Binär-Entscheidung und das angezeigte "Max: N"
      leiten sich konsistent aus demselben (effektiven, modifier-angepassten)
      Wert ab.
- [ ] Bestehende Fälle bleiben unverändert korrekt: eine echte `max=1`-Gruppe
      ohne max-erhöhenden Modifier bleibt Radio (gegenseitiger Ausschluss); das
      `increment`+`<repeat>`-Muster (mehrere gleiche Items, z. B. Bannrollen)
      funktioniert weiterhin.
- [ ] Ein Regressionstest deckt den bedingten-Increment-auf-Gruppen-Max-Fall ab
      (E2E entlang des realen Nutzerpfads: Schild wählen → Rüstung bleibt wählbar).
- [ ] `docs/battlescribe-data-format.md` beschreibt das neue Muster.

## Comments
- Implementierungshinweis (verifiziert, Stand Analyse): Die kaputte Stelle ist die isRadio-Ableitung in src/components/editor/OptionGroup.jsx (~Z. 235), die c.value === 1 aus der rohen Constraint liest statt aus dem effektiven Max. Das effektive Max liefert getModifiedConstraintValue (src/solver/modifierEvaluator.js), wie es das Label bereits nutzt (OptionGroup.jsx ~Z. 104 / 173-175). Der bestehende Max-Erhoehungs-Sonderfall isRepeatableWithinGroup (OptionGroup.jsx ~Z. 92-101) greift nicht, da er ein <repeat> auf dasselbe Item verlangt. Konkreter Katalog-Beleg: Empire Captain, Armour-Gruppe, Modifier type=increment field=3abf-ef75-7480-0e27 mit Bedingung childId=Shield (equalTo 1). Zeilennummern koennen driften - vor dem Fix am aktuellen Stand verifizieren.
