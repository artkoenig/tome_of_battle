# 0003: Battlescribe Domain Rules

- **Status:** Accepted
- **Datum:** 2026-07-22
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Keine

> **Nachtrag (Issue 0205, 2026-08-26).** Die Pfade unter `src/domain/` unten sind historisch: seit [ADR-0042](0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md) gibt es weder `src/domain/` noch `src/data/`, `src/domain/evaluator/` liegt seitdem als `src/contexts/ruleengine/engine/`. Die hier festgehaltene Entscheidung bleibt davon unberührt.

## Kontext und Problemstellung

Die Battlescribe-Kataloge (`.cat` / `.gst`) nutzen ein hochgradig generisches, aber auch komplexes XML-Schema, um Armeen, Einheiten, Ausrüstungsgegenstände, Punktekosten und Validierungsregeln zu definieren. Um verschiedene Spielsysteme (z. B. Warhammer Fantasy, Warhammer 40k) und Völker flexibel in *Tome of Battle* laden zu können, muss die Fachlogik der Engine (`src/domain/evaluator/`, seit Issue 0121; zuvor `src/solver/`) robust und systemunabhängig arbeiten. Hardcodierte Sonderregeln für einzelne Armeen oder sprachspezifische Strings führen schnell zu Fehlern und schränken die Erweiterbarkeit massiv ein.

## Entscheidungsfaktoren (Drivers)

- **Erweiterbarkeit:** Unterstützung beliebiger Spielsysteme ohne Code-Änderungen im Kern.
- **Robustheit:** Zuverlässige Validierung komplexer Verschachtelungen und gegenseitiger Abhängigkeiten.
- **Lokalisierungs-Unabhängigkeit:** Funktionstüchtigkeit unabhängig von der Sprache des Katalogs (Englisch, Deutsch, etc.).

## Entscheidungsergebnis

Die Implementierung der Battlescribe-Fachlogik folgt diesen strikten Prinzipien:

### 1. Keine armeespezifische Logik im Code
Es dürfen keine spezifischen Sonderfälle für bestimmte Völker oder Armeen direkt im Programmcode implementiert werden. Alle Berechnungen und Validierungen müssen rein deklarativ auf Basis des Battlescribe-Modells erfolgen.

### 2. Deklaratives "System Quirks"-Muster
Für unumgängliche Besonderheiten einzelner Spielsysteme gab es die Datei `src/solver/systemQuirks.js`. Sie ist mit Issue 0121 entfallen: ADR-0034 ordnet systemgebundene Sonderfälle und Stichwort-Heuristiken weder der Engine noch dem Bericht zu — sie werden am Datenfehler im Katalog-Fork behoben.
- Alle Ausnahmen werden dort deklarativ, gemappt auf die `.gst`-System-ID, hinterlegt.
- Im Core-Solver (z. B. `rosterValidator.js`) darf es keine `if (systemName === '...')`-Abfragen geben; stattdessen wird das Quirk-Objekt abgefragt.

### 3. Keine sprachabhängigen Strings als Schlüssel
- Parsen, Filtern und Validieren arbeiten ausschließlich mit IDs, nie mit sprachabhängigen (Sub)Strings wie `"General"` oder `"Waffe"`. Das ID-System des Formats beschreibt die [BSData-Doku](../battlescribe-data-format.md) (§3.1, §8).
- Diese Regel gilt **ausnahmslos**. Die vormals hier verzeichnete Ausnahme für die Herleitung von Rüstungs- (`AS`) und Rettungswürfen (`WS`) ist entfallen: das Feature wurde ersatzlos entfernt, weil die Werte aus Regelprosa geraten statt aus Katalogdaten gelesen wurden.

### 3a. Kostenarten: id ist der Schlüssel, name ist reine Anzeige

- Die Format-Semantik der Kostenarten (`cost/@typeId` → `costType/@id`, Namen als reine Anzeige) steht in der [BSData-Doku](../battlescribe-data-format.md) (§7.5). Daraus folgen diese Code-Regeln:
- Die `id` einer Kostenart ist vom Katalog-Autor **frei gewählt und nicht standardisiert**: der WHFB6-Fork und Warpath verwenden GUIDs (`ecfa-8486-4f6c-c249`), Warhammer 40k 9e verwendet `points`. Eine für Punkte reservierte id existiert nicht — das BSData-Wiki führt die Verknüpfung selbst nur als TODO. **Es darf deshalb keine Kostenart-id im Code festgeschrieben werden**, auch nicht als Rückfallwert.
- Maßgeblich ist `roster.costLimitType`; fehlt sie, ist der einzige vertretbare Ersatz die **erste vom Spielsystem deklarierte** Kostenart (`system.costTypes[0].id`). Zentral abgeleitet über `resolveCostLimitTypeId`.
- Fehlt einer Auswahl der Wert der maßgeblichen Kostenart, ist das Ergebnis **0** — nie der Wert einer anderen Kostenart. Ein Punktwert dort, wo nach Zauberwürfeln gefragt wurde, ist kein Rückfallwert, sondern eine falsche Zahl.
- Die **Bezeichnung** stammt unverändert aus `costType/@name` und wird ausschließlich getrimmt. Es findet **keine Übersetzung** statt — auch nicht von `pts` nach `Pkt.`; die Oberfläche zeigt die Katalog-Bezeichnung. Zentral abgeleitet über `resolveCostTypeLabel`.

> **Hintergrund:** Diese Regel entstand aus einem konkreten Fehler (Issue 47). `rosterCounter.js` prüfte `c.typeId === 'pts'` und verglich damit eine id gegen einen Anzeigenamen — im geladenen Katalog nie wahr. Der als Rückfall gedachte Zweig war im Betrieb toter Code und fiel nur deshalb nicht auf, weil die Testdaten `'pts'` abkürzend als *id* führten: die Suite deckte einen Pfad ab, den die Produktion nie nahm, und blieb dabei grün.

### 4. Berechnungen, Validierung und UI-Zuordnung

- **Kosten- und Mengenberechnung:** folgt der Rechenregel der [BSData-Doku](../battlescribe-data-format.md) (§7.5; `collective`: §10) — keine eigene Herleitung im Code.
- **Constraints (Einschränkungen):** Die Ziel-Typ-Regel für `scope="force"` und der Ziel-ID-Vergleich bei `scope="parent"` stehen in der [BSData-Doku](../battlescribe-data-format.md) (§3.4, §7.6, §7.7). Entscheidung hier: die Ziel-Typ-Regel gilt einheitlich für Constraint, Condition und Repeat und ist in ADR 0029 zentral umgesetzt.
- **Geteilte und nicht geteilte Queries (`shared`):** Die Semantik des Attributs (XSD-Vorgabewert `true`, instanzweise Zählung bei `false`) steht in der [BSData-Doku](../battlescribe-data-format.md) (§7.6, §7.7). Entscheidungen hier:
  - Der Parser setzt den XSD-Vorgabewert explizit — ein als `false` eingelesenes fehlendes Attribut würde jede aggregierende Query stillschweigend in eine instanzweise verwandeln.
  - Der `scope="parent"` bleibt von `shared` unberührt — er ist bereits an genau eine Instanz (den Eltern-Container) gebunden.
  - Die Auslegung des Attributs liegt ausschließlich in `isSharedQuery`; keine zählende Stelle interpretiert `query.shared` selbst. Ein nur geparster, aber nicht ausgewerteter Wert wäre der schlechteste Zustand: Er sähe nach Unterstützung aus, ohne welche zu sein, und ließe jede nicht geteilte Beschränkung systematisch überzählt erscheinen — mit falschen Verstößen und dadurch nach ADR 0022 fälschlich gesperrten Einträgen im Aushebe-Dialog.
  - **Bekannte Grenze:** Constraints, die an einer `selectionEntryGroup` hängen, werden ohnehin immer nur innerhalb der besitzenden Auswahl gezählt (nie armeeweit aggregiert), verhalten sich also unabhängig von `shared` stets instanzweise. Für die vorliegenden Daten ist das folgenlos; eine armeeweit aggregierende Gruppen-Constraint müsste erst umgesetzt werden, wenn ein Katalog sie tatsächlich verlangt.
- **Modifier-Reihenfolge:** Modifier wirken in **Dokumentreihenfolge** — in der Reihenfolge, in der sie im Katalog stehen. Kein Modifier-Typ wird vorgezogen: `increment 2` gefolgt von `set 5` ergibt 5, die umgekehrte Reihenfolge ergibt 7. Diese Regel gilt einheitlich für alle Modifier-Verbraucher (Beschränkungswerte über `getModifiedConstraintValue`, Namen über `getEffectiveName`, Kategorien über `getEffectiveCategoryLinks`). Eine Ausnahme für einzelne Kataloge gibt es nicht; sollte je eine nötig werden, gehört sie als begründeter Sonderfall hierher und nicht in den Solver-Code.
- **Mutually-Exclusive Choices (Radio vs. Mehrfachauswahl):** Die Gruppen-Semantik (`max="1"` als Radio, „Max-hebbar ⇒ Mehrfachauswahl" samt Teufelskreis-Argument und XML-Beispiel) steht in der [BSData-Doku](../battlescribe-data-format.md) (§9.2, [§9.8](../battlescribe-data-format.md#98-bedingter-modifier-auf-ein-gruppen-maxmin-an-eine-andere-auswahl-oder-einen-scope-gekoppelt)). Entscheidungen hier: die statische „hebbar?"-Erkennung ist `canGroupMaxBeRaisedAboveSingleChoice`; das `increment`+`<repeat>`-Muster (mehrere Stück desselben Items, Dispel Scroll) wird gesondert als Mengen-Stepper behandelt; sämtliche Auswahl-, Anzeige- und Recruit-Entscheidungen leiten sich aus den **effektiven** (modifier-angepassten) Constraint-Werten ab, nie aus rohen.
- **Auswahl-Kategorien in der UI:** Die Kategorie-Semantik (`primary`, effektive Kategorie nach `field="category"`-Modifiern) steht in der [BSData-Doku](../battlescribe-data-format.md) (§7.2, §8). Entscheidungen hier: die UI darf Einheiten niemals nach hardcodierten Kategorienamen gruppieren; maßgeblich ist stets die **effektive** Primärkategorie, zentral bestimmt über `getEffectiveCategoryLinks` / `getEffectiveEntryCategoryLinks` und von allen einsortierenden Stellen (Aushebe-Dialog, Sektions-Sichtbarkeit, Armee-weite Selektoren) einheitlich genutzt.


### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Die App kann jeden validen Battlescribe-Katalog fehlerfrei importieren und verarbeiten.
  - Fehlerbehebungen im Solver kommen automatisch allen Spielsystemen zugute.
- **Negativ:** 
  - Hohe Komplexität bei der Auflösung von Constraints und Modifikatoren im Solver, da verschachtelte Pfade und dynamische Bedingungen zur Laufzeit evaluiert werden müssen.
