Status: ready-for-agent
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
- [ ] Ein Pflichteintrag (min>0), der im Roster fehlt, erzeugt eine MIN-Verletzung,
      verankert an einem Phantomknoten.
- [ ] Die Absenz wird armeeweit und pro Kontingent erkannt, je nachdem, welchen
      Bezugsrahmen die Grenze vorgibt.
- [ ] Ein Phantomknoten trägt 0 zu Zählungen bei (er bläht keine Zählung auf).
- [ ] Ist der Pflichteintrag in ausreichender Zahl vorhanden, wird keine solche
      Verletzung erzeugt.

## Comments
