Status: ready-for-agent
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
- [ ] Eine `and`-Bedingungsgruppe ist genau dann wahr, wenn alle enthaltenen
      Bedingungen/Untergruppen wahr sind; eine `or`-Gruppe genau dann, wenn
      mindestens eine wahr ist.
- [ ] Verschachtelte Bedingungsgruppen (Gruppe in Gruppe) werden über beliebige
      Tiefe korrekt zum Gesamt-Wahrheitswert aufgelöst.
- [ ] Die Modifikatoren einer Modifikatorgruppe greifen gemeinsam, wenn deren
      Gruppen-Bedingung erfüllt ist, und entfallen gemeinsam, wenn nicht.
- [ ] Bedingungs-/Modifikatorgruppen erscheinen nicht als UNSUPPORTED-Diagnose.
- [ ] Die Engine-Testsuite deckt beide Gruppenarten inkl. Verschachtelung ab und
      ist grün.

## Comments
