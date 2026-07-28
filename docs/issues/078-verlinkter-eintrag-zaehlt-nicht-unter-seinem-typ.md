---
status: backlog
branch:
pr:
---

# Verlinkter Eintrag zählt nicht unter seinem Typ

## Intent

Ein Eintrag zählt unter seinem rohen `type`-Attribut mit (`model`, `unit`, …) —
das ist es, was die Bedingung `childId="model"` liest. Ein **verlinkter**
Eintrag tut das nicht.

Ursache: `readEntry` liest `type` (`src/evaluator/catalogReader.js`),
`readEntryLink` liest es nicht. Die Zähl-Schicht kennt das Ziel deshalb ohne
seinen Typ (`src/evaluator/countIndex.js`, `targetsOf`).

Folge: Dieselbe Einheit zählt unterschiedlich, je nachdem ob sie direkt steht
oder über einen `entryLink` hereingezogen wird. Eine
`childId="model"`-Bedingung sieht im zweiten Fall 0 Modelle.

Acceptance criteria:

1. Ein über einen `entryLink` gesetzter Eintrag zählt unter demselben Typ wie
   derselbe Eintrag direkt gesetzt.
2. Eine `childId="model"`-Bedingung liefert in beiden Fällen dasselbe Ergebnis.
3. Ein Szenario an echten Katalogdaten deckt genau diesen Unterschied ab
   (ADR 0033, verfasst vom Black-Box-Autor).
4. Die übrige E2E-Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt —, und jede geänderte Erwartung ist einzeln begründet.

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/78-verlinkter-eintrag-zaehlt-nicht-unter-seinem-type/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Gefunden bei der Standards-Prüfung von Alt-Issue 75. Dort nur
  dokumentiert (JSDoc von `targetsOf`), nicht geändert: Die Behebung ändert
  Zählungen und damit Verletzungslisten quer durch die E2E-Suite und gehört in
  einen eigenen Schnitt.
- **Verwandt mit `076`** (Pflichtgrenze am entryLink): beide fragen, unter
  welchen Ids ein über einen Verweis gesetztes Vorkommen zählbar ist. Zusammen
  anzufassen ist vermutlich billiger als nacheinander.

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
