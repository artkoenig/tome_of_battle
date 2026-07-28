---
status: backlog
branch:
pr:
---

# Pflichtgrenze am entryLink zählt ihre eigene Auswahl nicht

## Intent

Eine Grenze, die nicht an der Auswahl-Definition, sondern an dem `entryLink`
deklariert ist, der sie hereinzieht, zählt die eigene Auswahl nicht mit. Sie
meldet eine Pflicht als unerfüllt, obwohl die Auswahl im Roster gesetzt ist.

Ursache an den Daten: Ein Roster benennt eine so bezogene Auswahl mit zwei Ids
— `entryId` (das Ziel) und `entryLinkId` (der Verweis). Der Zählindex
registriert die Instanz unter der Ziel-Id, die Grenze fragt aber nach der
Link-Id. Ergebnis: Ist 0 gegen `min 1`.

Zwei belegte Fälle, beide aus `Mercenaries (…).cat`, beide `min` /
`scope="parent"`:

| Grenze | Deklariert an | Beobachtet |
|---|---|---|
| `dfd9-3e46-eda5-be8b` (min 1 *Hand Weapon*) | `entryLink b581-8a9e-9d0c-b7c8`, Z. 7462–7464 | Ist 0 / Grenze 1 |
| `feb1-c10d-9318-dbda` (min 1 *Light Armour*) | `entryLink d3dc-56c1-9565-889a`, Z. 4352–4354 | Ist 0 / Grenze 1 |

Die beiden Ids sind im Szenario `modifier-characteristic-value` aus der
`absent`-Liste entfernt und bewusst **nicht** nach `firing` verschoben — das
würde das falsche Verhalten als gewollt festschreiben. Das Manifest macht über
sie derzeit also schlicht keine Aussage; diese Lücke schließt erst dieser Fix.

Acceptance criteria:

1. Eine am `entryLink` deklarierte Grenze zählt die über diesen Verweis
   gesetzte Auswahl mit.
2. Die beiden belegten Fälle (*Hand Weapon*, *Light Armour*) melden keine
   Pflichtverletzung mehr.
3. Das Szenario `modifier-characteristic-value` nimmt beide Ids wieder in
   seine Erwartung auf.
4. Die übrige E2E-Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt —, und jede geänderte Erwartung ist einzeln begründet.

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/76-pflichtgrenze-am-entrylink-zaehlt-ihre-eigene-auswahl-nicht/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Nebenbefund beim E2E-Szenario `modifier-characteristic-value`
  (Alt-Issue 75, Slice 04); dort ausführlich dokumentiert. Nicht in einen
  laufenden Slice von 75 aufgenommen, weil die Behebung die Verletzungsliste
  an mehreren Stellen der Suite ändert.
- **Zweite Fundstelle derselben Wurzel, gefunden in Slice 75/07:** Der
  `.ros`-Leser der Testumgebung (`src/evaluator/__fixtures__/rosParser.js`)
  band eine Auswahl allein über `entryId` und ignorierte `entryLinkId`. Alles,
  was am `<entryLink>` selbst deklariert ist, galt damit im Test nie — im
  Widerspruch zu `report.js`, das den Verweis-Slot ausdrücklich den Verweis
  tragen lässt. Belegt an `Ogre Kingdoms (6th definitive edition).cat:3165`:
  dort gewährt Verweis `d82e` „Bully Bully" bedingungslos. Betrifft 13 von 102
  vorhandenen Rostern in 4 Szenarien. **Inzwischen behoben durch Issue 078:**
  `rosParser` bindet seit dessen Schnitt `entryLinkId || entryId`; die Suite
  blieb dabei grün, dieser Defekt hier wurde dadurch nicht sichtbar. Offen
  bleibt die Engine-Seite: die Pflichtgrenze am Link selbst.
- **Verwandt mit `078`** (verlinkter Eintrag zählt nicht unter seinem Typ):
  beide fragen, unter welchen Ids ein über einen Verweis gesetztes Vorkommen
  zählbar ist. Zusammen anzufassen ist vermutlich billiger als nacheinander.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
