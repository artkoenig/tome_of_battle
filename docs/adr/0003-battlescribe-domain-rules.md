# 0003: Battlescribe Domain Rules

- **Status:** Accepted
- **Datum:** 2026-07-21
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Keine

## Kontext und Problemstellung

Die Battlescribe-Kataloge (`.cat` / `.gst`) nutzen ein hochgradig generisches, aber auch komplexes XML-Schema, um Armeen, Einheiten, Ausrüstungsgegenstände, Punktekosten und Validierungsregeln zu definieren. Um verschiedene Spielsysteme (z. B. Warhammer Fantasy, Warhammer 40k) und Völker flexibel in *Tome of Battle* laden zu können, muss die Fachlogik im "Solver" (`src/solver/`) robust und systemunabhängig arbeiten. Hardcodierte Sonderregeln für einzelne Armeen oder sprachspezifische Strings führen schnell zu Fehlern und schränken die Erweiterbarkeit massiv ein.

## Entscheidungsfaktoren (Drivers)

- **Erweiterbarkeit:** Unterstützung beliebiger Spielsysteme ohne Code-Änderungen im Kern.
- **Robustheit:** Zuverlässige Validierung komplexer Verschachtelungen und gegenseitiger Abhängigkeiten.
- **Lokalisierungs-Unabhängigkeit:** Funktionstüchtigkeit unabhängig von der Sprache des Katalogs (Englisch, Deutsch, etc.).

## Entscheidungsergebnis

Die Implementierung der Battlescribe-Fachlogik folgt diesen strikten Prinzipien:

### 1. Keine armeespezifische Logik im Code
Es dürfen keine spezifischen Sonderfälle für bestimmte Völker oder Armeen direkt im Programmcode implementiert werden. Alle Berechnungen und Validierungen müssen rein deklarativ auf Basis des Battlescribe-Modells erfolgen.

### 2. Deklaratives "System Quirks"-Muster
Für unumgängliche Besonderheiten einzelner Spielsysteme (z. B. Vererbung von Kategorie-Limits oder Erkennung des Generals) existiert die Datei `src/solver/systemQuirks.js`.
- Alle Ausnahmen werden dort deklarativ, gemappt auf die `.gst`-System-ID, hinterlegt.
- Im Core-Solver (z. B. `rosterValidator.js`) darf es keine `if (systemName === '...')`-Abfragen geben; stattdessen wird das Quirk-Objekt abgefragt.

### 3. Keine sprachabhängigen Strings als Schlüssel
- Es dürfen keine deutschen oder englischen (Sub)Strings (wie `"General"`, `"Leader"`, `"Waffe"`) als Identifikatoren fürs Parsen, Filtern oder Validieren genutzt werden.
- Relationen müssen über eindeutige IDs (`categoryLinks`, `selectionEntryId`, etc.) aufgelöst werden.
- Diese Regel gilt **ausnahmslos**. Die vormals hier verzeichnete Ausnahme für die Herleitung von Rüstungs- (`AS`) und Rettungswürfen (`WS`) ist entfallen: das Feature wurde ersatzlos entfernt, weil die Werte aus Regelprosa geraten statt aus Katalogdaten gelesen wurden.

### 3a. Kostenarten: id ist der Schlüssel, name ist reine Anzeige

- `cost/@typeId` verweist **immer** auf `costType/@id`, niemals auf `costType/@name`. Beide dürfen nie miteinander verglichen oder füreinander eingesetzt werden.
- Die `id` einer Kostenart ist vom Katalog-Autor **frei gewählt und nicht standardisiert**: der WHFB6-Fork und Warpath verwenden GUIDs (`ecfa-8486-4f6c-c249`), Warhammer 40k 9e verwendet `points`. Eine für Punkte reservierte id existiert nicht — das BSData-Wiki führt die Verknüpfung selbst nur als TODO. **Es darf deshalb keine Kostenart-id im Code festgeschrieben werden**, auch nicht als Rückfallwert.
- Maßgeblich ist `roster.costLimitType`; fehlt sie, ist der einzige vertretbare Ersatz die **erste vom Spielsystem deklarierte** Kostenart (`system.costTypes[0].id`). Zentral abgeleitet über `resolveCostLimitTypeId`.
- Fehlt einer Auswahl der Wert der maßgeblichen Kostenart, ist das Ergebnis **0** — nie der Wert einer anderen Kostenart. Ein Punktwert dort, wo nach Zauberwürfeln gefragt wurde, ist kein Rückfallwert, sondern eine falsche Zahl.
- Die **Bezeichnung** stammt unverändert aus `costType/@name` und wird ausschließlich getrimmt (die Namen tragen im Katalog teils führende Leerzeichen: `" Casting Dice"`, bei wh40k-9e `" PL"`). Es findet **keine Übersetzung** statt — auch nicht von `pts` nach `Pkt.`; die Oberfläche zeigt die Katalog-Bezeichnung. Zentral abgeleitet über `resolveCostTypeLabel`.

> **Hintergrund:** Diese Regel entstand aus einem konkreten Fehler (Issue 47). `rosterCounter.js` prüfte `c.typeId === 'pts'` und verglich damit eine id gegen einen Anzeigenamen — im geladenen Katalog nie wahr. Der als Rückfall gedachte Zweig war im Betrieb toter Code und fiel nur deshalb nicht auf, weil die Testdaten `'pts'` abkürzend als *id* führten: die Suite deckte einen Pfad ab, den die Produktion nie nahm, und blieb dabei grün.

### 4. Berechnungen, Validierung und UI-Zuordnung

- **Kosten- und Einschränkungsmultiplikation:** Bei verschachtelten Auswahlen muss die Menge immer als `child.number * parent.number` berechnet werden. Das Flag `collective` in Battlescribe bestimmt lediglich, wie Instanzen in der UI zusammengefasst dargestellt werden, hat aber keinen Einfluss auf die mathematische Berechnung der Gesamtzahl oder der Kosten.
- **Constraints (Einschränkungen):**
  - Einschränkungen mit dem Scope `force` werden **pro Kontingent (Detachment / Force)** und nicht armeeweit ausgewertet.
  - Einschränkungen mit dem Scope `parent` müssen die aufgelösten **Ziel-IDs (Target IDs)** vergleichen und nicht die Link-IDs, da unterschiedliche Links auf dieselbe physische Auswahl verweisen können.
- **Top-Level Parent Fallback:** Eine Condition mit `scope="parent"` muss auch dann greifen, wenn kein übergeordnetes Element existiert (z. B. bei einer Top-Level-Einheit). In diesem Fall dient die Selektion selbst als ihr eigener Bezugs-Parent. Dies gilt sowohl für die Condition-Evaluation als auch für die Auswertung von Wiederholungen (`repeat`).
- **Mutually-Exclusive Choices (Radio-Buttons):** Auswahlgruppen (Selection Groups) mit `max="1"` stellen eine sich gegenseitig ausschließende Auswahl dar (Radiobutton-Semantik), nicht die quantitative Einschränkung eines zählbaren Gegenstandes auf maximal 1.
- **Optionale Upgrades:** Profile und Regeln von optionalen Upgrades (Mindestmenge = 0) dürfen erst dann auf das Profil der Haupteinheit aufaddiert oder angezeigt werden, wenn der Spieler diese Ausrüstung auch tatsächlich ausgewählt hat.
- **Auswahl-Kategorien in der UI:** Die Kategorie mit `primary="true"` bestimmt, in welcher Kategorie-Gruppe (Sektion) eine Einheit in der UI einsortiert wird. Kategorien mit `primary="false"` dienen als unsichtbare Schlagworte für Validierungsregeln (z. B. zur Einschränkung, wer ein Reittier wählen darf). Die UI darf Einheiten niemals nach hardcodierten Kategorienamen gruppieren.
  - **Effektive statt statische Kategorie:** Die maßgebliche Primärkategorie ist die **effektive** — also nach Anwendung der `field="category"`-Modifier (`add` / `remove` / `set-primary` / `unset-primary`) samt ihrer Bedingungen im aktuellen Force-/Roster-Kontext. Ein Katalog kann eine (etwa aus einem verlinkten Bibliothekskatalog importierte) Einheit per `set-primary` in eine andere Kategorie seines Kontingents umgliedern; würde die UI nur die statischen `categoryLinks` lesen, verschwände die Einheit aus jeder Sektion. Die effektive Kategorie wird zentral über `getEffectiveCategoryLinks` / `getEffectiveEntryCategoryLinks` bestimmt und von allen einsortierenden Stellen (Aushebe-Dialog, Sektions-Sichtbarkeit, Armee-weite Selektoren) einheitlich genutzt.


### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Die App kann jeden validen Battlescribe-Katalog fehlerfrei importieren und verarbeiten.
  - Fehlerbehebungen im Solver kommen automatisch allen Spielsystemen zugute.
- **Negativ:** 
  - Hohe Komplexität bei der Auflösung von Constraints und Modifikatoren im Solver, da verschachtelte Pfade und dynamische Bedingungen zur Laufzeit evaluiert werden müssen.
