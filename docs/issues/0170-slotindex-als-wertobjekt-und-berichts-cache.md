---
status: done
branch: claude/new-session-065uhx
pr: 255
---

# SlotIndex als Wertobjekt und zweiter Berichts-Cache

## Goal
Das Tripel `capabilities` / `pathBySelectionId` / `pathByForceId` wandert überall
gemeinsam und wird überall gemeinsam gelesen — es ist ein Wertobjekt, das noch
keinen Namen hat. `SlotIndex` gibt ihm einen und nimmt die acht Lookups aus
`evaluation/slotLookups.js` als Methoden auf.

## Acceptance criteria
- AC1 `SlotIndex` kapselt die drei Strukturen; die Funktionen aus `slotLookups.js` sind seine Methoden, und kein Aufrufer reicht die drei noch einzeln weiter. | verify: forge-test --run src/evaluation
- AC2 `SlotIndex.fromMaps(...)` erlaubt Tests, einen Index aus handgebauten Maps zu erzeugen; die bestehenden Fixtures gehen darüber, statt einzeln umgeschrieben zu werden. | verify: forge-test
- AC3 Ein Fixture, dem ein von der Anzeige gelesenes Slot-Feld fehlt, fällt beim Bau des Index auf statt still `false` zu liefern. | verify: forge-test --run src/evaluation
- AC4 `evaluate` selbst hat einen Identitäts-Cache, sodass ein zweiter Aufruf mit demselben Roster-Objekt nicht neu rechnet. | verify: forge-test --run src/evaluation
- AC5 Der Helfer, der aus einer Capability ihren Katalog-Eintrag auflöst, existiert einmal statt an jeder Aufrufstelle. | verify: forge-lint
- AC6 Anzeige und Auswertung sind unverändert. | verify: forge-test
- AC7 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Slot-genaue Identitätsstabilität des Berichts — eigenes Thema, siehe ADR-0038.
- Ein Versionssprung: **Patch**, falls AC4 den Editor spürbar entlastet, sonst keiner.
