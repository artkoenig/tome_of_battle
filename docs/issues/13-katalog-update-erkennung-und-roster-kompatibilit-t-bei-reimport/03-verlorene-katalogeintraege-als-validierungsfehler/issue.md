Status: ready-for-agent
Blocked by: None

## Description
Rosters speichern laut ADR-0011 keine Kosten, sondern nur strukturelle Referenzen auf
Katalogeinträge, die bei jedem Lesevorgang aufgelöst werden. Findet der Roster-Sync einen
referenzierten Eintrag nicht mehr, tut er heute **nichts**: kein Flag, keine Warnung. Die
Auswahl bleibt mit ihrem gespeicherten Namen sichtbar — das ist die von ADR-0011 gewollte
Resilienz — zählt aber 0 Punkte. Der Nutzer sieht eine plausible Liste mit falscher Summe.

Eine Auswahl, deren Katalogeintrag nicht mehr auflösbar ist, soll künftig als
**Validierungsfehler** erscheinen: dort, wo der Nutzer ohnehin nach Problemen seiner Liste
schaut. Genutzt wird die bestehende Fehler-Naht (`ValidationError` mit `{ type, message,
severity }`), erweitert um eine neue `type`-Ausprägung mit Schweregrad `error`.

Die Meldung wirkt unabhängig von der Ursache — ein Katalog-Update ist nur eine davon.

**Dieses Issue ist das Sicherheitsnetz für Issue 06 und muss vorher landen.** Der PRD
entscheidet bewusst, dass ein Katalog-Update auch dann läuft, wenn dadurch Roster-Einträge
unauflösbar werden; der Nutzer erfährt es über die Validierung. Ohne dieses Netz würde das
Update genau den stillen Schaden anrichten, den die Gesamtmaßnahme beheben soll.

Nicht Teil dieses Issues: eine Reparatur gebrochener Roster. Ein verlorener Eintrag wird
*gemeldet*, nicht automatisch auf einen Nachfolge-Eintrag umgebogen.

Kontext: [PRD](../../../PRD-katalog-updates-und-roster-kompatibilitaet.md) (Requirement 2,
Seam 3), [ADR 0011](../../../adr/0011-roster-referenzmodell-und-serialisierungs-adapter.md).

## Acceptance Criteria
- [ ] Ein System, dem ein referenzierter Eintrag fehlt, erzeugt bei der Roster-Validierung
      genau einen Fehler der neuen Klasse
- [ ] Ein vollständiges System erzeugt keinen solchen Fehler
- [ ] Der Fehler trägt Schweregrad `error` und benennt die betroffene Auswahl verständlich
- [ ] Der Fehler erscheint in der bestehenden Validierungs-Anzeige, ohne neue UI-Naht
- [ ] Die Auswahl bleibt sichtbar (ADR-0011-Resilienz bleibt unangetastet) — sie wird nicht
      entfernt und nicht umgebogen

## Comments
