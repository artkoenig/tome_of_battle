# Scenario: explorer-category-constraints

Prüft die Auswertung von MAX-Constraints an einem categoryLink innerhalb eines forceEntry.

## Details
In Orcs and Goblins (Mountain or Troll Country Waaagh!) besitzt der categoryLink für 'Goblin Character' (targetId: `6b1c-cce4-a402-a6e4`) ein MAX-Limit id `0298-fc5a-a995-cbae`, das per Modifikator auf 2 gesetzt wird. Ein Roster mit 3 Goblin Characters muss diese Verletzung feuern.

## Rosters
- `01-exceeds-goblin-character-max.ros`: Roster mit 3 Goblin Characters (Goblin Warboss, Goblin Bigboss, Goblin Shaman). Erwartet Violation `0298-fc5a-a995-cbae` (actual: 3, bound: 2).
