Status: needs-triage
Type: feature
Blocked by: None

## Description

Der Evaluator baut seine Fähigkeitsdatensätze (Verfügbarkeit/Sichtbarkeit je
Auswahlpunkt) nur über **Auswahl-Slots** — reale Instanzknoten plus
Phantom-Pflichtslots. Ein **Kategorie**-Knoten (z. B. „Lord") ist kein
Auswahl-Slot und taucht deshalb nie im Bericht auf. Wird die Sichtbarkeit einer
Kategorie durch einen (z. B. budget-gesteuerten) Modifikator umgeschaltet
(`hidden`), ist das im Bericht **nicht** als Verfügbarkeit sichtbar.

Folge: Budget-gesteuerte Kategorie-Sichtbarkeit — die reale Vorzeigeszene „Lord
unter 2000 Punkten ausgeblendet" (`Warhammer Fantasy Battles (6th definitive
edition).gst`, `categoryEntry name="Lord"`) — wird auf Feld-/Modifikator-Ebene
zwar korrekt aufgelöst (siehe Issue 70), aber nicht end-to-end als „Kategorie
nicht verfügbar" im Bericht abgebildet.

Dies ist eine **vorbestehende** Lücke, unabhängig von der Budget-Auflösung;
aufgedeckt beim Review von Issue 70. Gewünschtes Verhalten: die Sichtbarkeit
einer Kategorie (`hidden`) fließt so in den Bericht ein, dass budget-gesteuerte
Kategorie-Verfügbarkeit end-to-end auf echten Katalogdaten beobachtbar ist.

## Acceptance Criteria
- [ ]

## Comments
