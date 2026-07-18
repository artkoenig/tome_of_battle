Status: ready-for-agent
Type: feature
Blocked by: None

## Description

### Problem
Im Import-Dialog zeigt die Spielsystem-Auswahl für beide parallel angebotenen
WHFB6-Quellen (Child-Issue 09) ein kurzes, abgekürztes Label statt des echten
Namens aus den Katalogdaten selbst. Der Nutzer möchte stattdessen den
tatsächlichen Katalognamen sehen.

### Bestätigter Kontext
- Die Kurz-Labels wurden bewusst eingeführt, weil die echten Namen der beiden
  Quellen einander zum Verwechseln ähnlich sind:
  - Ergofarg: „Warhammer Fantasy Battle 6th edition"
  - Lexicanum: „Warhammer Fantasy Battles (6th definitive edition)"
- Nutzerentscheidung (bestätigt): Trotz dieser Nähe soll ausschließlich der
  echte Katalogname angezeigt werden, **ohne** jeden zusätzlichen Quellzusatz.
  Die beiden Einträge dürfen im Dropdown also nahezu identisch aussehen.
- Betroffen ist ausschließlich die Anzeige im Import-Dialog. Andernorts (z. B.
  Kopfzeile des Roster-Editors, Auswahl der Armeeliste) wird bereits jetzt der
  echte Name genutzt, nicht das Kurz-Label — dort ist nichts zu ändern.

### Gewünschtes Verhalten
Der Import-Dialog zeigt für jedes Spielsystem exakt den Namen aus dessen
Katalogdaten (`name`-Attribut des `.gst`), ohne Kürzung und ohne
Quellzusatz. Die interne Zuordnung eines Systems zu seiner Abruf-Quelle
(Ergofarg/Lexicanum, für den Laufzeit-Update-Pfad) bleibt unverändert
funktionsfähig — nur die für Nutzer sichtbare Beschriftung ändert sich.

### Hinweise
- Prüfen, ob das kurze Label (`CATALOG_SOURCES[].label` /
  `resolveSystemDisplayLabel`) noch an anderer Stelle als reine
  Quell-Identifikation gebraucht wird (z. B. intern/Logging) oder ob es nach
  dieser Änderung ganz entfällt — nicht spekulativ vorbauen, nur das entfernen
  bzw. anpassen, was tatsächlich noch für Anzeige-Zwecke existiert.
- Der `issue-implementer` reproduziert zuerst E2E (Import-Dialog öffnen, beide
  WHFB6-Systeme in der Spielsystem-Auswahl sehen), bevor er ändert.

## Acceptance Criteria
- [ ] Im Import-Dialog zeigt die Spielsystem-Auswahl für beide WHFB6-Quellen
  den echten Katalognamen (`.gst`-`name`-Attribut), nicht das WHFB-Kurzlabel.
- [ ] Kein zusätzlicher Quellzusatz (kein „(Ergofarg)"/„(Lexicanum)" o. Ä.) wird
  angehängt.
- [ ] Der Laufzeit-Update-Pfad (Zuordnung eines importierten Systems zu seiner
  Abruf-Quelle über `gameSystemId`) funktioniert unverändert.
- [ ] Regressionsschutz: bereits an der echten Katalogbezeichnung orientierte
  Anzeigen (Roster-Editor-Kopfzeile, Armeeliste) bleiben unverändert korrekt.

## Comments
