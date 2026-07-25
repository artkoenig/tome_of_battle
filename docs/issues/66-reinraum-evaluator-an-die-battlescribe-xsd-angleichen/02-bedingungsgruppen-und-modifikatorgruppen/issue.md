Status: resolved
Type: refactor
Blocked by: [01]

## Description
Der Evaluator liest und wertet verschachtelte **Bedingungsgruppen**
(`conditionGroup`, ConditionGroupKind `and`/`or`) und **Modifikatorgruppen**
(`modifierGroup`) aus. Eine Bedingungsgruppe verknüpft mehrere Bedingungen
und/oder weitere Bedingungsgruppen mit `and`/`or` zu einem einzigen Wahrheitswert.
Eine Modifikatorgruppe bündelt mehrere Modifikatoren unter einer gemeinsamen
Bedingung bzw. Bedingungsgruppe, sodass sie gemeinsam greifen oder gemeinsam
entfallen.

Baut auf der in 01 hergestellten XSD-konformen Lesart (`type`/`field`,
SSOT-Enums) auf. Beliebige Verschachtelungstiefe wird korrekt aufgelöst.

## Acceptance Criteria
- [x] Eine `and`-Bedingungsgruppe ist genau dann wahr, wenn alle enthaltenen
      Bedingungen/Untergruppen wahr sind; eine `or`-Gruppe genau dann, wenn
      mindestens eine wahr ist.
- [x] Verschachtelte Bedingungsgruppen (Gruppe in Gruppe) werden über beliebige
      Tiefe korrekt zum Gesamt-Wahrheitswert aufgelöst.
- [x] Die Modifikatoren einer Modifikatorgruppe greifen gemeinsam, wenn deren
      Gruppen-Bedingung erfüllt ist, und entfallen gemeinsam, wenn nicht.
- [x] Bedingungs-/Modifikatorgruppen erscheinen nicht als UNSUPPORTED-Diagnose.
- [x] Die Engine-Testsuite deckt beide Gruppenarten inkl. Verschachtelung ab und
      ist grün.

## Comments
- Bedingungsgruppen (and/or, rekursiv) und Modifikatorgruppen umgesetzt: catalogReader liest conditionGroup/modifierGroup (SSOT-Kind), modifiers.js wertet Gruppen rekursiv aus und wendet Gruppen-Modifikatoren gemeinsam an; resolver loest auch Gruppen-Modifikator-Ziele auf. Neue groups.test.js deckt and/or, Verschachtelung und gemeinsames Greifen/Entfallen ab. Suite gruen (157 Evaluator-Tests, 1748 gesamt).
- Nachtrag aus Review: Verschachtelte Modifikatorgruppen greifen jetzt vollstaendig (readModifierGroup liest modifierGroups rekursiv, applyModifierGroup wertet Untergruppen mit effektivem Gate AND(Eltern-Gate, eigenes Gate) aus; resolver loest auch Ziele innerer Gruppen-Modifikatoren auf). Ein Gruppen-<repeats> wird nicht still verworfen, sondern als UNSUPPORTED_MODIFIER_GROUP_REPEAT diagnostiziert (bewusste sichtbare Grenze). groups.test.js deckt die Verschachtelung ab.
