---
status: active
branch: claude/aufgaben-ubersicht-84fkjz
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
- **Fix-Ort: Durchschau in der Zähl-Schicht, nicht Attribut-Kopie im Reader.**
  Das `type`-Attribut am `<entryLink>` trägt eine andere Semantik
  (`selectionEntry`/`selectionEntryGroup`, der Ziel-Diskriminator), nicht
  `model`/`unit`. Der Eintragstyp ist nur über das aufgelöste Ziel
  `def.resolved.type` erreichbar. `targetsOf` (countIndex.js) schaut deshalb
  für ENTRY_LINK-Knoten auf `def.resolved?.type` durch — dasselbe Muster wie
  `effectiveState.js` (costs/categoryIds) und `ownerDefinitionOf`
  (evalTree.js). Quelle: Researcher-Briefing, belegt an Fixture-Katalogdaten.
- **Harness-Bindung: `rosParser` bindet `entryLinkId || entryId`.** Heute
  bindet der Fixture-Parser allein über `entryId` (= Ziel-ID) — damit bekommt
  eine verlinkte Auswahl das Ziel samt Typ als `def`, und der Unterschied
  „direkt vs. verlinkt" ist im E2E-Pfad gar nicht darstellbar. Die App bindet
  bevorzugt über die Link-ID (`optionNesting.js:44`), der Resolver-`lookup`
  indiziert Links unter ihrer eigenen ID, und Issue 76 (zweiter Befund)
  benennt die Link-ID-Bindung als die korrekte. Ohne diese Änderung kann
  Kriterium 3 kein Szenario erfüllen. Default, unbeantwortet — reine
  Harness-Semantik, kein öffentlicher Vertrag.

## Log

- Researcher-Briefing eingeholt (Sitzung 2026-07-28): Ursache bestätigt
  (`readEntryLink` ohne `type`, `targetsOf` prüft `node.def.type`).
  Zwei Nuancen: (1) `type` am `<entryLink>` ist der Ziel-Diskriminator, nicht
  der Eintragstyp; (2) im heutigen E2E-Pfad ist der Defekt nicht auslösbar,
  weil `rosParser` über die Ziel-ID bindet — real wird er bei der
  App-Integration (Link-ID-Bindung). Kein Szenario deckt den verlinkten Fall
  ab; `evaluator-bug-childid-model` deckt nur den direkten.
- Risiko notiert: Die Umstellung der Harness-Bindung auf `entryLinkId` kann in
  bestehenden Szenarien (deren `.ros` bereits `entryLinkId` tragen) den
  Defekt aus Issue 76 sichtbar machen. Tritt das ein: anhalten und
  entscheiden, nicht stillschweigend Erwartungen anpassen.
- Test-Autor fertig: `src/evaluator/countIndex.linkedType.test.js` (3 Tests:
  direkt-vs-verlinkt-Vergleich, Schwellen-Test mit Doppelzähl-Schutz,
  transitive Kette Link→Link→Entry) und
  `src/evaluator/rosParser.entryLinkId.test.js` (Bindung
  `entryLinkId || entryId`, rekursiv). Fehlschlag bewiesen:
  `npx vitest run src/evaluator/countIndex.linkedType.test.js
  src/evaluator/rosParser.entryLinkId.test.js` → Exit 1, 4/4 rot, jeweils am
  erwarteten Defekt (verlinkt sieht 0 Modelle; Parser liest nur `entryId`).
  Diagnostics leer — der Ketten-Fehlschlag ist echtes Nicht-Zählen, kein
  Dangling-Link.
- Black-Box-Szenario fertig (Kriterium 3):
  `docs/testing/entrylink-raw-type-counting/` an der „Border
  Patrols"-Regel des GST (Slot `4e15-0353-165f-5528`, `childId="unit"`-Zählung
  auf Force-Ebene, 2–4 Einheiten). Drei Roster: direkte Grundlinie (stumm),
  direkt+verlinkt (stumm NUR, wenn die verlinkte VC-„Ogre Bulls"-Einheit
  unter `unit` zählt), 4 direkt + 1 verlinkt (die Obergrenze kippt genau
  durch den verlinkten Beitrag → eine Autor-Meldung). Beobachtung über
  `capabilities`→`authorMessages`, weil kein Katalog-Constraint ein `childId`
  trägt — die Rohtyp-Zählung lebt dort nur in Bedingungen. Alle Erwartungen
  aus `.gst`/`.cat` abgeleitet.

## Checkpoints

### Before implementation

- Does this match what was asked? Ja: verlinkte Einträge sollen unter dem Typ
  ihres Ziels zählen; der Schnitt umfasst die Durchschau in `targetsOf`, die
  Harness-Bindung im `rosParser` (ohne sie ist Kriterium 3 unerfüllbar) und
  ein Black-Box-Szenario. Nicht umfasst: Issue 76 (Pflichtgrenze am Link).
- What surprised me? (1) Das `type`-Attribut am `<entryLink>` ist der
  Ziel-Diskriminator, nicht der Eintragstyp — die naheliegende Attribut-Kopie
  wäre falsch. (2) Im heutigen E2E-Pfad ist der Bug nicht auslösbar; er wird
  erst mit Link-ID-Bindung real.
- What am I assuming without having verified it? (1) Dass die Umstellung auf
  Link-ID-Bindung die bestehenden Szenarien nicht rot macht (Risiko 76, im
  Log notiert). (2) Dass `resolved.type` für transitive Link-Ketten genügt —
  `followEntryLink` löst transitiv bis zum Endziel auf, `resolved` ist also
  nie selbst ein Link. (3) Dass kein weiterer Zählpfad den Typ liest.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
