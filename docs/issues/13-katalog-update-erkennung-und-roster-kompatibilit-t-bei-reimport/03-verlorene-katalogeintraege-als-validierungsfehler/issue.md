Status: resolved
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
- Umgesetzt: checkSelectionTree() in src/solver/rosterValidator.js erzeugt jetzt einen Fehler vom Typ 'unresolved-entry' (severity 'error'), wenn eine Auswahl auf keinen Katalogeintrag mehr auflösbar ist (findEntryInSystem/resolveEntry liefern null). Die Meldung nennt den gespeicherten Namen der Auswahl; die Auswahl selbst bleibt unverändert im Roster (ADR-0011-Resilienz). Kinder der unauflösbaren Auswahl werden weiterhin rekursiv geprüft. Die Fehler-Anzeige (RosterSidebar/UnitSelectionCard) filtert bereits generisch nach selectionId, daher keine neue UI-Naht nötig.

Tests: zwei neue Fälle in src/solver/validator.test.js (genau ein Fehler bei fehlendem Eintrag; kein Fehler bei vollständigem System). Dabei eine vorbestehende Testdaten-Lücke behoben: die überall referenzierte 'General'-Auswahl (id 1b7c-2c90-6d96-28c9) existierte in keinem der Mock-Systeme, wurde bisher aber stillschweigend ignoriert -- mit der neuen Prüfung schlug das breit fehl. Als 'General'-selectionEntry in mockSystem, mockSystemRepeatable und mockSystemNested ergänzt, damit diese Fixtures tatsächlich vollständig auflösen.

Verifiziert: volle Vitest-Suite (32 Dateien, 365 Tests, 2 skipped) gruen; E2E-Smoke-Test (node src/solver/ui.test.js) komplett gruen.
