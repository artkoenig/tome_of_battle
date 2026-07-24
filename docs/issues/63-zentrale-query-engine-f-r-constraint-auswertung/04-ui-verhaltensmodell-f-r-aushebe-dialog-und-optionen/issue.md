Status: ready-for-agent
Type: refactor
Blocked by: [02, 03]

## Description
Der Auswertungslauf liefert zusätzlich ein **Verhaltensmodell** je Option/Gruppe
(siehe [ADR 0029](../../../adr/0029-zentrale-query-engine-fuer-constraint-auswertung.md),
L5). Aushebe-Dialog, Options-Gruppe, Auswahl-Konfigurator und Autofill-Vorschläge
rendern nur noch dieses Modell, statt Constraints selbst nachzurechnen. Damit wird
das Prinzip aus ADR 0022 (UI leitet sich aus dem Validator ab) von der reinen
Aushebe-Verfügbarkeit auf alle Constraint-Entscheidungen der Oberfläche
ausgeweitet.

Beobachtbares Verhalten: „wählbar" und „legal nach dem Ausheben" fallen über alle
Constraint-Klassen zusammen, und die Options-Darstellung (Mehrfach vs.
Radiobutton, Pflicht, verbleibende Menge) ist über alle vier Oberflächen
konsistent.

## Acceptance Criteria
- [ ] „Im Aushebe-Dialog wählbar" bedeutet für alle Constraint-Klassen „nach dem Ausheben legal"; ein gesperrter Eintrag wird als nicht verfügbar mit Grund angezeigt.
- [ ] Mehrfachauswahl-vs-Radiobutton, „Pflicht" und „wie viele noch erlaubt" stimmen über Aushebe-Dialog, Options-Gruppe, Konfigurator und Autofill überein — nachweisbar an einem Szenario mit bedingtem Modifier auf ein Gruppen-Max (z. B. Rüstung + Schild).
- [ ] Die Anwendbarkeit einer eintragsbezogenen Grenze auf die aktuelle Einheit wird über alle vier Oberflächen gleich beurteilt (kein Verhaltensunterschied zwischen ihnen).
- [ ] Keine dieser Oberflächen ermittelt eine Constraint-Entscheidung selbst; sie zeigen ausschließlich das vom Solver gelieferte Verhaltensmodell an.

## Comments
