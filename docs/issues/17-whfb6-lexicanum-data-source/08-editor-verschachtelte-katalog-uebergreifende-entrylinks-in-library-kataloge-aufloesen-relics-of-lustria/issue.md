Status: needs-triage
Type: feature
Blocked by: None

## Description

### Problem
Der Lexicanum-Fork lagert geteilte Inhalte in einen Library-Katalog (`Mercenaries`,
`library="true"`) aus, den jeder Armee-Katalog per `catalogueLink` referenziert. Faktions-
Magiegegenstände (z. B. „Relics of Lustria") werden von dort per **mehrstufig verschachtelten,
katalog-übergreifenden `entryLink`s** in die Armeen gezogen. Diese Cross-Catalogue-Links werden
im Editor nicht aufgelöst/angezeigt, sodass die Gegenstände an berechtigten Einheiten fehlen.

Vom Nutzer gemeldet als: „Gegenstände, die an bestimmte Listen gekoppelt sind (z. B. Relics of
Lustria)" werden nicht ausgewertet.

### Bestätigter Befund (Daten + Code)
- **Daten:** „Relics of Lustria" ist eine `sharedSelectionEntryGroup` (`hidden="true"`) im
  `Mercenaries`-Library-Katalog. Von dort geht es mehrstufig weiter: Gruppe → 6 Untergruppen
  (Enchanted Items, Magic Armour, Arcane Items, Magic Banners, Magic Weapons, Magic Talismans
  — jeweils „(Relics of Lustria)") → einzelne Items. Armee-Kataloge (z. B. High Elves) ziehen
  die Wurzelgruppe per `entryLink type="selectionEntryGroup" import="true"` herein; der
  `catalogueLink` jedes Armee-Katalogs zeigt auf die Mercenaries-Library
  (`targetId=fc47-8392-a6c8-452a`).
- **Code:** `findEntryInSystem` besitzt einen katalog-übergreifenden Fallback, `optionsCollector`
  reicht `activeCatalogueId` durch und rekursiert über `entryLink`-Gruppen — die Auflösung
  *sollte* also greifen. Der genaue Grund, warum sie es im Editor nicht tut (Kandidaten:
  `hidden`-Handling der Library-Gruppe vs. `hidden="false"` am `entryLink`; `activeCatalogueId`-
  Weiterreichung über Katalog-Grenzen; Tiefe der Rekursion), ist per E2E zu bestätigen.

### Gewünschtes Verhalten
Per `catalogueLink` eingebundene, mehrstufig verschachtelte `entryLink`s in einen Library-
Katalog werden im Editor vollständig aufgelöst: die geteilten Magiegegenstand-Gruppen
erscheinen an den berechtigten Einheiten (Charakteren) und sind konfigurierbar.

### Hinweise
- **App-Fähigkeitslücke**, kein Datenfehler — die Daten sind BattleScribe-konform.
- Import-Verfügbarkeit der Library ist bereits durch Child-Issue 03 abgesichert; hier fehlt
  ausschließlich die **Auflösung/Anzeige** im Editor.
- Der `issue-implementer` reproduziert zuerst E2E (Import High Elves + Mercenaries, Charakter
  aushebeln, Magiegegenstände prüfen) und lokalisiert den exakten Auflösungs-Codepfad, bevor
  er fixt.

## Acceptance Criteria
- [ ] Beim Import eines Armee-Katalogs samt `Mercenaries`-Library werden per `catalogueLink` +
  verschachtelten `entryLink`s eingebundene geteilte Gruppen (Beispiel: „Relics of Lustria")
  im Editor an berechtigten Einheiten angezeigt und sind auswählbar.
- [ ] Die mehrstufige Verschachtelung (Wurzelgruppe → Untergruppen → Items) wird vollständig
  aufgelöst, nicht nur die erste Ebene.
- [ ] `hidden`-Zustände werden korrekt beachtet (versteckte Library-Gruppe wird über den
  `entryLink` sichtbar, wenn dieser es vorsieht).
- [ ] Regressionsschutz: bestehende, katalog-interne `entryLink`-Auflösung bleibt unverändert.

## Comments
