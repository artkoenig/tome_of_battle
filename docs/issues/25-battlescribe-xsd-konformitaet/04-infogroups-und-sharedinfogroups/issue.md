Status: resolved
Type: fix
Blocked by: [01]

## Description
Deckt Lücke #4 aus Main-Issue 19 ab. Konsumiert InfoLinkKind aus dem SSOT
(Kind-Issue 01).

Der Parser erfasst `infoGroups` und `sharedInfoGroups` sowie
`infoLink type="infoGroup"` — heute werden diese Container und die darin
gebündelten Profile/Regeln komplett verworfen. Die Bridge zur Anzeige
(Profil-/Regel-Sammlung pro Einheit) löst infoGroup-Verweise auf, sodass die
gebündelten Profile und Regeln an der jeweiligen Einheit erscheinen.

Nachweis an einer generischen, schema-gültigen Fixture mit mindestens einer
`infoGroup` inkl. `sharedInfoGroups` + `infoLink`-Verweis (nicht an WHFB6).

## Acceptance Criteria
- [ ] `infoGroups` und `sharedInfoGroups` werden geparst; verschachtelte/verlinkte Profile und Regeln gehen nicht verloren
- [ ] `infoLink type="infoGroup"` wird aufgelöst
- [ ] In einer infoGroup gebündelte Profile/Regeln erscheinen an der Einheit in der UI
- [ ] Generische, schema-gültige Fixture belegt das End-to-End-Verhalten

## Comments
- Parser now captures infoGroups/sharedInfoGroups (incl. nested infoGroups + infoLinks) on entries and at catalogue/gameSystem roots; catalogResolver flattens inline infoGroups and infoLink type=infoGroup (consuming InfoLinkKind SSOT) into the entry's profiles/rules, so bundled profiles and rules surface on the unit via collectUnitProfilesAndRules. Added a generic, XSD-validated fixture and end-to-end tests.
