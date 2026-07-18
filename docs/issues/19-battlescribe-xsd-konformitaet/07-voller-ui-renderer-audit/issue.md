Status: resolved
Type: fix
Blocked by: [03, 04, 05, 06]

## Description
Deckt Solution D aus Main-Issue 19 ab. Läuft, nachdem die Parser-/Evaluator-
Slices (03–06) gemerged sind, damit deren Ausgaben tatsächlich in der Anzeige
geprüft werden können.

Systematischer, **endlicher** Durchgang als Checkliste: jedes anzeige-relevante
XSD-Konstrukt → sein zuständiger Renderer → Soll/Ist-Abgleich. Wo die Anzeige
hinter dem korrekt geparsten/ausgewerteten Stand zurückbleibt, wird der Renderer
gefixt, sodass neu und korrekt verarbeitete Daten auch wirklich erscheinen. Die
Checkliste (Konstrukt → Renderer → Status) wird als Artefakt committet, damit die
Vollständigkeit nachvollziehbar ist.

Abgrenzung: kein neues Parsing/keine neue Auswertung hier (das leisten 03–06) —
ausschließlich die Anzeige-Schicht.

## Acceptance Criteria
- [ ] Vollständige Checkliste aller anzeige-relevanten XSD-Konstrukte mit Renderer-Zuordnung und Soll/Ist-Status als committetes Artefakt
- [ ] Jedes als lückenhaft identifizierte Konstrukt wird korrekt gerendert (Render-Fix + Test)
- [ ] Die Ausgaben der Slices 03–06 (Attribute, infoGroups, Constraints, Modifier/Kategorien) erscheinen sichtbar in der UI
- [ ] Renderer-Tests decken die auditierten Konstrukte ab

## Comments
- UI-Renderer-Audit (Solution D) durchgefuehrt: endliche Checkliste Konstrukt->Renderer->Soll/Ist als Artefakt docs/battlescribe-ui-renderer-audit.md committet. Einzige echte Anzeige-Luecke: percentValue-Constraints wurden als nackte Zahl gerendert; behoben via gemeinsamem formatConstraintLimit (constraintScope.js) in RosterEditor/RosterSidebar/OptionGroup. Uebrige Konstrukte (infoGroups, dynamische Kategorien, hidden costTypes, Profil-Typ-Gruppierung) erschienen bereits ueber die zentralen Bruecken. Renderer-Tests ergaenzt: RosterSidebar (Prozent + hidden costTypes), PlayUnitDetails.infogroups (echte Bruecke, kein Solver-Mock), constraintScope (Formatter).
