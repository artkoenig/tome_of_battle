---
status: backlog
branch: claude/hochelfen-pure-of-heart-65ormw
pr:
---

# Geteilte Bibliothekseinträge nicht als Wurzelangebote behandeln

## Goal

Ein Eintrag, der nur in der geteilten Bibliothek eines Katalogs steht und dort
allein zum Verlinken existiert, wird vom Kontingent weder automatisch
hinzugefügt noch angeboten; er bleibt ausschließlich dort wählbar, wo ein
`entryLink` ihn tatsächlich einbindet — bei den Hochelfen also „Pure of Heart"
als Honour eines Helden statt als Eintrag der Armeeliste.

## Acceptance criteria

- AC1: Ein Kontingent mit dem Hochelfen-Katalog enthält nach dem Anlegen keine
  Selektion „Pure of Heart"; die Pflicht-Listenregel-Erkennung meldet den
  Eintrag nicht als fehlend. | verify: forge-test --run listRules
- AC2: „Pure of Heart" bleibt beim Helden über die Honours-Gruppe wählbar, und
  die roster-weite Mindestgrenze des Eintrags wird weiterhin ausgewertet —
  ohne eine Auswahl meldet die Auswertung sie als verletzt, mit einer Auswahl
  am Helden nicht mehr. | verify: forge-test --run src/evaluator
- AC3: Die Wurzel-Aufzählung eines Katalogs — sowohl für den „+"-Adder als auch
  für die Pflicht-Listenregeln — beruht allein auf den Wurzelangeboten des
  Katalogs; ein Eintrag der geteilten Bibliothek erscheint dort nur, wenn ein
  Wurzelverweis ihn einbindet. Der Nachweis ist ein Test, der einen nur
  geteilten Eintrag und einen an der Wurzel verlinkten geteilten Eintrag
  unterscheidet. | verify: forge-test --run entryVisibility
- AC4: Eine Kategorie-Sektion des Kontingents erscheint genau dann, wenn der
  Katalog für sie ein Wurzelangebot kennt — deckungsgleich mit dem, was der
  Adder dort anbietet. | verify: forge-test --run RosterCategorySection
- AC5: Der Hochelfen-Katalog liegt als Fixture neben den übrigen Katalogen der
  Definitive Edition, wortgleich aus derselben angepinnten Quelle wie sie, und
  die Herkunftsangabe des Fixture-Satzes nennt ihn. | verify: forge-test
- AC6: Die bestehende Testsuite bleibt grün. | verify: forge-test
- AC7: `docs/battlescribe-data-format.md` hält fest, welche Pools eines Katalogs
  Wurzelangebote sind und welche reine Bibliothek — belegt an den Katalogdaten,
  nicht behauptet.

## Out of scope

- Die Auswertungslogik der Constraints selbst: Mindest- und Höchstgrenzen
  werden nicht umgeschrieben, nur der Kreis der Einträge, den das Kontingent
  überhaupt als eigenes Angebot ansieht.
- Weitere Kataloge der Definitive Edition ins Fixture aufnehmen.
- Das Verhalten der Reinraum-Engine `src/evaluator/` ändern.
