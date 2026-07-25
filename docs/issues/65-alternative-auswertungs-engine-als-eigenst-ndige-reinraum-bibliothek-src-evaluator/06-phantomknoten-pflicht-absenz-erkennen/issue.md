Status: resolved
Type: chore
Blocked by: [02, 03]

## Description

Synthetisiert **Phantomknoten** als Auswertungsanker für Definitionen, die Grenzen
tragen, aber keine Instanz haben: Kategorie-Definitionen (je Kontingent und
armeeweit), Kontingent-Definitionen und Pflichteinträge (min>0), die im jeweiligen
Rahmen nicht gewählt wurden. Ein Phantomknoten zählt 0 und ist der Ort, an dem eine
MIN-Grenze *gerade beim Fehlen* der Auswahl anschlägt — auch armee-/
kontingentweite Pflichteinheiten (z. B. der Ogerbullen-Fall).

## Acceptance Criteria
- [x] Ein Pflichteintrag (min>0), der im Roster fehlt, erzeugt eine MIN-Verletzung,
      verankert an einem Phantomknoten.
- [x] Die Absenz wird armeeweit und pro Kontingent erkannt, je nachdem, welchen
      Bezugsrahmen die Grenze vorgibt.
- [x] Ein Phantomknoten trägt 0 zu Zählungen bei (er bläht keine Zählung auf).
- [x] Ist der Pflichteintrag in ausreichender Zahl vorhanden, wird keine solche
      Verletzung erzeugt.

## Comments
- Phantomknoten fuer Pflicht-Absenz umgesetzt: buildEvalTree synthetisiert nach dem realen Baum Phantom-Anker fuer Pflichtdefinitionen (min>0), die im Bezugsrahmen ihrer MIN-Grenze fehlen — armeeweit (scope=roster) ein Anker an der Wurzel, je Kontingent (scope=force) ein Anker im betroffenen Kontingent. Neue Traversierung: realNodes (ohne Phantome, fuer den Index -> Phantome zaehlen nie mit) vs. allNodes (mit Phantomen, fuer Constraint-/Modifikator-/Effektiv-Schicht, §4.6/§4.7). Eine fehlende Pflichteinheit erzeugt so eine MIN-Verletzung mit actual=0 am Phantom. 6 neue Tests (Ogerbullen-Fall) gruen; volle Suite 1686 Tests gruen, evaluator/solver-Isolation intakt.
