---
status: backlog
branch:
pr:
---

# Ankerart `mandatoryPhantom` widerspricht ihrer eigenen Vertragszusage

## Intent

`AnchorKind` in `src/evaluator/model.js:238` sagt über die Ankerart
`MANDATORY_PHANTOM` wörtlich:

> Anker fuer eine Pflichtdefinition (`min > 0`), die im Bezugsrahmen keine
> Instanz hat.

Die Engine hängt diesen Anker aber nicht an `min > 0`, sondern an das
**Vorhandensein** einer MIN-Grenze im Rahmen — unabhängig von ihrem effektiven
Wert. Ein Eintrag, dessen Untergrenze auf 0 steht (per Basiswert oder weil ein
Modifikator sie dorthin gesetzt hat), bekommt denselben Anker wie eine echte
Pflicht.

Belegt am eigenen Probe-Katalog (2026-07-29, ohne jeden `entryLink`):
Wurzel-`selectionEntry` mit `min="0" scope="force"`, ein leeres Kontingent →

```
anchorKind "mandatoryPhantom", effectiveMin 0, isMandatoryUnmet false,
current 0, violations: []
```

Ausgewertet wird also korrekt — es entsteht kein Verstoß. Falsch ist allein die
**Einordnung** des Slots. Für eine Oberfläche ist das der Unterschied zwischen
„das musst du noch aufstellen" und „das kannst du aufstellen": genau die
Unterscheidung, für die `AnchorKind` laut seinem eigenen Kopfkommentar die
einzige Stelle sein soll („ersetzt jedes Raten ueber Namen oder Pfadform").

Vorbestehend, nicht durch einen laufenden Lauf entstanden — der Probe-Katalog
enthält keinen Verweis und trifft nur den `selectionEntry`-Pfad.

Acceptance criteria:

1. Entschieden und begründet ist, welche der beiden Seiten nachgibt: entweder
   trägt ein Slot mit effektiver Untergrenze 0 künftig `OFFER_ANCHOR`, oder der
   Vertragstext an `AnchorKind` beschreibt die tatsächliche Regel („eine
   MIN-Grenze im Rahmen", nicht „`min > 0`").
2. Wird die Einordnung geändert, gilt sie für **beide** Wurzelformen
   gleichermaßen — `selectionEntry` und `entryLink` (Issue 0085, Decision D6).
   Eine Form allein zu ändern, führt genau den Unterschied ein, den D6
   ausschließt.
3. Wird die Einordnung geändert, ist geprüft und berichtet, was dadurch
   berichtsfähig wird oder aufhört es zu sein — `isReportableAnchorKind`
   (`model.js:267`) schließt allein den Angebots-Anker aus, eine Umwidmung
   verschiebt also die Meldungsliste.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Aufgedeckt im Lauf zu Issue 0085 (2026-07-29). Der schwarze
  Kasten des E2E-Autors sagte für einen Slot mit Untergrenze 0 die Ankerart
  `offerAnchor` zu — abgeleitet aus einem beobachteten Präzedenzfall, nicht aus
  den Katalogdaten. Die Engine liefert `mandatoryPhantom`. Die Nachprüfung
  zeigte: die Zusage entsprach dem *Vertragstext*, die Engine ihrem *Verhalten*,
  und beide gehen seit jeher auseinander.
- **In Issue 0085 nicht mitbehoben,** weil außerhalb dessen Absicht: der Fund
  betrifft die `selectionEntry`-Form genauso und wäre dort eine
  Verhaltensänderung ohne Auftrag. Das Szenario `root-entrylink-mandatory` sagt
  die Ankerart für diesen Fall deshalb **gar nicht** zu und verweist hierher.

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
