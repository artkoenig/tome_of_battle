Status: resolved
Blocked by: None

## Description
Magische Gegenstände und Standarten sind in den WHFB-6th-Katalogen praktisch immer als
`selectionEntryGroup` modelliert (z. B. "Magic Banners", "Arcane Items", "Talismans").
Solche gruppierten Optionen werden von der Options-Auswahl-Komponente an die
Untergruppen-Komponente delegiert. Diese Untergruppen-Komponente hat nie die
Regel-URL-Lookup-Logik (Icon-Umschaltung zwischen Doku-Link und reinem Info-Icon)
erhalten, die ihre Schwesterkomponenten (Chips auf dem gebauten Roster,
und der "standalone"-Options-Zweig ohne Gruppierung) bereits besitzen. Sie zeigt bei
vorhandener Beschreibung deshalb ausnahmslos das Info-Icon an, unabhängig davon, ob der
Regel-Index eine passende URL enthält.

Ergebnis: In der App sieht man bei Magic Items/Standarten durchgängig nur das (i)-Icon
statt eines klickbaren Doku-Links, obwohl der Regel-Index für viele dieser Namen
tatsächlich einen Treffer hätte.

Fix: Die Untergruppen-Komponente muss dieselbe Lookup-/Icon-Umschaltung erhalten wie ihre
Schwesterkomponenten, inklusive Weiterreichen des "Regel anzeigen"-Callbacks von der
übergeordneten Options-Auswahl-Komponente.

## Acceptance Criteria
- [ ] Bei einer Option innerhalb einer gruppierten Auswahl (z. B. eines Magic-Banner- oder
      Talisman-Eintrags), für die der Regel-Index eine URL liefert, wird das Doku-Link-Icon
      angezeigt statt des Info-Icons, und ein Klick öffnet den Regel-Dialog wie bei den
      bestehenden Chips/Standalone-Optionen.
- [ ] Bei einer Option innerhalb einer gruppierten Auswahl, für die der Regel-Index keine
      URL liefert, aber ein Beschreibungstext vorhanden ist, bleibt das bisherige
      Info-Icon-Verhalten (Detail-Anzeige) erhalten.
- [ ] Manueller Test in der App: Ein Magic Item oder eine Standarte mit bekanntem
      Regel-Index-Eintrag (z. B. "War Banner" oder "Dispel Scroll") zeigt in der
      Options-Auswahl das Doku-Link-Icon und öffnet beim Klick den externen Regeltext.

## Comments
- Implementiert: OptionGroup.jsx importiert nun getRuleUrl (../../data/rulesLookup) und BookOpen (lucide-react), erhält onShowRule als neue Prop und zeigt bei vorhandenem Regel-Index-Treffer das BookOpen-Icon statt Info (Klick ruft onShowRule(res.name) auf), exakt wie in SelectionConfigurator.jsx/UnitChips.jsx. SelectionConfigurator.jsx reicht onShowRule beim Rendern von OptionGroupComponent durch. Neue Unit-Tests in OptionGroup.test.jsx (Test 21) decken BookOpen-vs-Info-Umschaltung und den onShowRule-Klick ab. Alle 302 Tests gruen, Lint sauber (keine neuen Warnings). Manuelle Verifikation im Browser (Bretonnia-Heer, Banner of the Lady) wurde begonnen, aber auf Nutzerwunsch abgebrochen zugunsten des naechsten Issues.
