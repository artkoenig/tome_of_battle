Status: resolved
Type: refactor
Blocked by: [04, 05]

## Description

Der Katalog-Leser liest Merkmalstabellen, Regeltexte, Info-Gruppen und
Info-Verweise vollstaendig ein und loest sie auf — im Bericht taucht davon
nichts auf. Die Rohdaten liegen also bereits vor; es fehlt allein der Weg in den
Bericht.

Braucht Slice 04 (die wirksamen Merkmalswerte) und Slice 05 (die vollstaendige
Slot-Menge, damit auch ein Angebots-Anker seine Profile traegt).

## Acceptance Criteria
- [ ] Zu jedem Slot liefert der Bericht die fuer ihn geltenden Merkmalstabellen und Regeltexte.
- [ ] Aus Unter-Auswahlen geerbte Merkmalstabellen und Regeltexte sind enthalten, versteckte nicht.
- [ ] Die Wirkung greifender Modifikatoren auf Merkmalswerte und Namen ist im Bericht sichtbar.
- [ ] Ein ueber einen Info-Verweis bezogenes Element erscheint an der Stelle des Verweises.
- [ ] Neue Szenarien decken das an echten Katalogdaten ab.

## Comments
- Neues Modul infoProjection.js liefert je Slot die geltenden Profile und Regeltexte (eigene + aus belegten Unter-Auswahlen geerbte, Verstecktes ausgenommen, Werte und Namen effektiv, ein Info-Verweis an seiner eigenen Stelle). Der Leser liest neu den Regeltext (<description>), infoCarriersOf steigt neu in einen infoLink auf eine infoGroup ab, und die flache characteristics-Liste des Faehigkeitsdatensatzes ist in infoElements aufgegangen.
