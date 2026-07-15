Status: resolved
Blocked by: None

## Description
Wirft das Neu-Parsen eines gespeicherten Systems beim App-Start einen Fehler, wird das alte,
unmigrierte System still weiterverwendet — protokolliert nur als `console.error`. Der Nutzer
arbeitet damit auf veralteten Daten, ohne es zu erfahren.

Eine fehlgeschlagene **Verarbeitung** eines vorhandenen Systems soll dem Nutzer gemeldet
werden.

Abzugrenzen ist das scharf von einem fehlgeschlagenen **Abruf** (offline, Rate-Limit,
GitHub-Ausfall): Der ist ausdrücklich *kein* Fehlerfall für den Nutzer — die App arbeitet dann
mit dem gespeicherten Stand weiter, und die Listen bleiben offline nutzbar. Gemeldet wird nur,
wenn vorhandene Daten nicht verarbeitet werden konnten.

Für die Meldung wird das bestehende Dialog-/Toast-System nach ADR-0010 genutzt, keine neue
Anzeigenaht.

Kontext: [PRD](../../../PRD-katalog-updates-und-roster-kompatibilitaet.md) (Requirement 6,
Problem-Befund 3), [ADR 0002](../../../adr/0002-data-flow-and-indexeddb-storage.md) (§6
Migrations-Pipeline), [ADR 0010](../../../adr/0010-einheitliches-dialog-und-toast-system.md).

## Acceptance Criteria
- [ ] Scheitert die Verarbeitung eines gespeicherten Systems, erhält der Nutzer eine
      verständliche Meldung statt nur eines `console.error`
- [ ] Die Meldung benennt das betroffene System
- [ ] Die App bleibt bedienbar; das alte System wird nicht gelöscht
- [ ] Ein fehlgeschlagener Netzabruf löst diese Meldung **nicht** aus
- [ ] Die Meldung nutzt das bestehende Toast-/Dialog-System (ADR-0010)
- [ ] Der Fehlerpfad ist testgedeckt

## Comments
- Umgesetzt: src/db/migrations.js::runSystemMigrations() gibt jetzt { systems, failures } statt eines nackten Arrays zurueck. failures listet { id, name } jedes Systems, dessen Re-Parsing der gespeicherten rawXmls fehlschlug (weiterhin console.error geloggt); das alte, unmigrierte System bleibt in der Liste erhalten (wird nicht geloescht). runSystemMigrations() macht dabei nie einen Netzabruf -- es verarbeitet ausschliesslich bereits lokal gespeicherte rawXmls --, daher kann ein fehlgeschlagener Fetch (offline, Rate-Limit, GitHub-Ausfall) diesen Pfad strukturell nicht ausloesen.

src/App.jsx::loadAllData() zeigt bei nichtleeren failures einen Toast ueber das bestehende showToast()-System (ADR-0010, severity 'error', roter Rand), der die betroffenen Systemnamen nennt. App.test.jsx-Mock an die neue Rueckgabeform angepasst.

Tests: neue Datei src/db/migrations.test.js (4 Faelle: erfolgreiche Migration ohne failures, System ohne rawXmls unveraendert durchgereicht, ein fehlschlagendes System wird gemeldet/bleibt erhalten/wird nicht gespeichert, ein kaputtes System beeinflusst die Migration der uebrigen nicht).

Verifiziert: volle Vitest-Suite (33 Dateien, 369 Tests, 2 skipped) gruen; E2E-Smoke-Test gruen; manuell im Browser mit einem in IndexedDB geseedeten kaputten System reproduziert -- Toast erscheint mit korrektem Fehlerstil und Systemnamen, App bleibt bedienbar, Testdaten danach wieder entfernt.
