# Erkenntnisse zur Datenvalidierung (Battlescribe-Format)

Aus der Analyse der vergangenen Projekt-Chats habe ich die wichtigsten Erkenntnisse und Debugging-Resultate speziell zur **Datenvalidierung und Verarbeitung des Battlescribe-Formats** zusammengetragen. 

Hier sind die zentralen architektonischen und fachlichen Lektionen, die beim Debuggen des Solvers und der UI festgestellt wurden:

## 1. Zählweisen und Scopes (Constraints)

* **Scope "force" (Detachment-Limits):**
  Constraints mit dem Scope `force` (z. B. "Maximal X Auswahlen pro Detachment") dürfen nicht über die armeeweite Zählvariable (`selectionCounts`) validiert werden. Es ist zwingend erforderlich, eine auf die Force isolierte Zählung (z. B. `forceSelectionCounts`) zu verwenden, um Limits pro Detachment korrekt auszuwerten.
* **Scope "parent" (Link-zu-Target-Auflösung):**
  Wenn Constraints innerhalb einer Einheit greifen (z. B. "Max. 1 Battle Standard Bearer pro Charakter"), darf der Validator nicht einfach die `entryLinkId` mit der `targetId` vergleichen. Da verschiedene Einheiten über unterschiedliche Links auf dasselbe Target referenzieren, fallen Duplikate sonst nicht auf. Die Validierung muss über Funktionen wie `resolveEntry` immer die tatsächlichen *Target-IDs* der referenzierten Kindelemente evaluieren.
* **Kategorie-Zählung in Conditions:**
  Wenn Limits dynamisch über eine Condition geprüft werden, die auf Kategorie-Limits basiert (z. B. "Maximal 3 Helden"), müssen die Kategorie-Zähler (`forceCategoryCounts`) über alle Forces hinweg korrekt aggregiert ausgelesen werden und nicht als einfaches, eindimensionales Objekt.

## 2. Struktur von Kategorien und Tags

* **Kategorien als Listenbau-Slots vs. Tags (`primary="true"`):**
  Battlescribe unterscheidet nicht strikt durch Hierarchien zwischen Kategorien, sondern nutzt das Attribut `primary`. 
  * **`primary="true"`:** Die Hauptkategorie, nach der eine Einheit im UI einsortiert wird (z. B. "Heroes", "Core").
  * **`primary="false"`:** Sekundäre Kategorien fungieren als "unsichtbare" Keywords/Tags für die Validierungslogik im Hintergrund (z. B. "Characters", um zu prüfen, wer ein Reittier nutzen darf).
* Eine Validierungs-UI darf keine Kategorien rendern, die von keiner Einheit als Primärkategorie (`primary="true"`) genutzt werden. Eine Gruppierung basierend auf hartcodierten Annahmen ist gegen die Architekturregeln.

## 3. Verbot von Hardcoded Strings

* Gemäß den Projektregeln (`AGENTS.md`) ist es nicht gestattet, englische oder deutsche Substrings in Elementnamen (wie `"General"`, `"Hero extra cost"`) zu parsen, um Regeln abzuleiten.
* Das Battlescribe-Format löst solche Zusammenhänge nativ über **CategoryLinks** oder direkte **ID-Referenzen**. Jede Validierungslogik muss rein agnostisch und systemübergreifend durch das Auswerten dieser IDs und Constraints erfolgen.

## 4. Hierarchische Profil- und Optionsauswertung

* **Profile und Regeln in Unterauswahlen:**
  Profilwerte und Sonderregeln sind oft nicht an der "Root"-Einheit (z. B. *Vampire Thrall*) definiert, sondern verschachtelt an Upgrades (z. B. einer *Bloodline*). Die Validierung muss Profile (`collectUnitProfilesAndRules`) rekursiv aus dem Katalog *und* den tatsächlich getroffenen Spielerauswahlen (`selection.selections`) einsammeln.
* **Verschachtelte Optionen (z. B. General-Status):**
  Spezifische Unter-Optionen (wie die Option, General zu sein) sind oft tief in anderen Upgrades versteckt (z. B. in der Necrarch-Blutlinie). Die Options-Sammellogik darf solche Kind-Elemente erst dann zur Auswahl freigeben und validieren, wenn die direkte Eltern-Option (das Upgrade) vom Spieler *aktiv ausgewählt* wurde.

## 5. Umgang mit speziellen Options-Typen

* **Collective Entries (`collective="true"`):**
  Sogenannte "Collective Entries" teilen sich ihre Menge mit der ihres Parents (z. B. Ausrüstung, die jedes Modell einer Einheit erhält). Die Kosten- und Constraint-Evaluierung muss hier dynamisch als Produkt (`parentCount * optionCount`) berechnet werden, da sich die Gesamtzahl ändert, wenn die Größe der Grundeinheit angepasst wird.
* **Exklusive Gruppen (`max="1"`):**
  Wenn Auswahl-Gruppen in Battlescribe das Limit `max="1"` besitzen (z. B. die Wahl der Blutlinie), handelt es sich nicht um limitierte, zählbare Objekte, sondern um *sich gegenseitig ausschließende Optionen*. Diese müssen in der Validierung und im UI als Radio-Buttons/Checkboxes durchgesetzt werden.
