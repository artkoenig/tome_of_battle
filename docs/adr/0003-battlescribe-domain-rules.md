# 0003: Battlescribe Domain Rules

- **Status:** Accepted
- **Datum:** 2026-07-03
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
- **Ausnahme:** Die Berechnung und Normalisierung von Rüstungswürfen (`AS` / Armour Save) und Rettungswürfen (`WS` / Ward Save) darf charakteristische Strings (z. B. `4+`, `-1`, `+1`) analysieren, um Modifikatoren korrekt anzuwenden.

### 4. Berechnungen, Validierung und UI-Zuordnung

- **Kosten- und Einschränkungsmultiplikation:** Bei verschachtelten Auswahlen muss die Menge immer als `child.number * parent.number` berechnet werden. Das Flag `collective` in Battlescribe bestimmt lediglich, wie Instanzen in der UI zusammengefasst dargestellt werden, hat aber keinen Einfluss auf die mathematische Berechnung der Gesamtzahl oder der Kosten.
- **Constraints (Einschränkungen):**
  - Einschränkungen mit dem Scope `force` werden **pro Kontingent (Detachment / Force)** und nicht armeeweit ausgewertet.
  - Einschränkungen mit dem Scope `parent` müssen die aufgelösten **Ziel-IDs (Target IDs)** vergleichen und nicht die Link-IDs, da unterschiedliche Links auf dieselbe physische Auswahl verweisen können.
- **Top-Level Parent Fallback:** Eine Condition mit `scope="parent"` muss auch dann greifen, wenn kein übergeordnetes Element existiert (z. B. bei einer Top-Level-Einheit). In diesem Fall dient die Selektion selbst als ihr eigener Bezugs-Parent. Dies gilt sowohl für die Condition-Evaluation als auch für die Auswertung von Wiederholungen (`repeat`).
- **Mutually-Exclusive Choices (Radio-Buttons):** Auswahlgruppen (Selection Groups) mit `max="1"` stellen eine sich gegenseitig ausschließende Auswahl dar (Radiobutton-Semantik), nicht die quantitative Einschränkung eines zählbaren Gegenstandes auf maximal 1.
- **Optionale Upgrades:** Profile und Regeln von optionalen Upgrades (Mindestmenge = 0) dürfen erst dann auf das Profil der Haupteinheit aufaddiert oder angezeigt werden, wenn der Spieler diese Ausrüstung auch tatsächlich ausgewählt hat.
- **Auswahl-Kategorien in der UI:** Die Kategorie mit `primary="true"` bestimmt, in welcher Kategorie-Gruppe (Sektion) eine Einheit in der UI einsortiert wird. Kategorien mit `primary="false"` dienen als unsichtbare Schlagworte für Validierungsregeln (z. B. zur Einschränkung, wer ein Reittier wählen darf). Die UI darf Einheiten niemals nach hardcodierten Kategorienamen gruppieren.
- **Rüstungs- und Rettungswurf-Modifikatoren:** Bei der Auswertung von Rüstungswürfen (`AS`) und Rettungswürfen (`WS`) müssen Werte per Regex in feste Basiswerte (z. B. `4+`) und Modifikatoren (z. B. `-1`/`+1`) unterschieden werden. Es muss verhindert werden, dass Boni doppelt angewendet werden (Double-Dipping), wenn beispielsweise ein namensbasierter Keyword-Bonus bereits denselben Effekt gewährt.


### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Die App kann jeden validen Battlescribe-Katalog fehlerfrei importieren und verarbeiten.
  - Fehlerbehebungen im Solver kommen automatisch allen Spielsystemen zugute.
- **Negativ:** 
  - Hohe Komplexität bei der Auflösung von Constraints und Modifikatoren im Solver, da verschachtelte Pfade und dynamische Bedingungen zur Laufzeit evaluiert werden müssen.
