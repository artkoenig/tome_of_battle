---
status: done
branch: claude/aufgaben-ubersicht-84fkjz
pr: https://github.com/artkoenig/tome_of_battle/pull/147
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
- **Kein Versionssprung.** Die CLAUDE.md-Regel verlangt den Vorschlag nur für
  benutzersichtbare Änderungen; der Reinraum-Evaluator hat keinen Importeur
  außerhalb von `src/evaluator/` und erreicht den Nutzer noch nicht.
  Default, unbeantwortet.

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
- Implementierung fertig (Implementer-Bericht): `targetsOf` zählt
  ENTRY_LINK-Knoten zusätzlich unter `def.resolved?.type` (JSDoc-Notiz des
  alten Defekts ersetzt); `rosParser` bindet `entryLinkId || entryId`;
  Testkatalog `docs/testkatalog-evaluator-e2e.md` um das neue Szenario
  ergänzt (104 → 107 Fälle). Belege: Issue-Tests 4/4 exit 0; Runner 107
  Fälle exit 0; `npm test` 209 Dateien / 2116 Tests + UI-E2E exit 0;
  `npm run lint`, `npm run typecheck`, `npm run depcruise` je exit 0
  (depcruise: 1 vorbestehende warn-only-Warnung im alten Solver).
- Stopp-Regel griff nicht: kein bestehendes Szenario wurde durch die
  Link-ID-Bindung rot; der Issue-76-Defekt blieb unsichtbar. Keine
  bestehende Erwartung geändert — die AC-4-Begründungsliste ist leer.
- Nebenfund (vorbestehend, nicht angefasst): im Testkatalog fehlen die
  per-Szenario-Sektionen zu `violation-classification` und
  `author-message-tokens`, obwohl beide in der Übersicht stehen.
- Tracker-Pflege: Issue 076 (zweite Fundstelle) auf den neuen
  rosParser-Stand nachgezogen — die Adapter-Seite ist durch diesen Schnitt
  behoben, offen bleibt dort die Engine-Seite.
- Review-Runde 1 (frischer Kontext): **0 Befunde**, alle vier Kriterien
  erfüllt. Kern der Prüfung: Revert-Gegenprobe — countIndex-Fix
  zurückgenommen → 3/3 Unit-Tests und genau die beiden Link-Roster des
  Szenarios rot, Grundlinie grün; rosParser-Bindung zurückgenommen → der
  Parser-Test rot (Runner bleibt grün: die dokumentierte Maskierung).
  Szenario-Erwartungen stichprobenhaft gegen `.gst`/`.cat` verifiziert.
  Fakten (vom Reviewer selbst gelaufen): `npm test` 209 Dateien / 2116
  Tests + UI-E2E exit 0; lint/typecheck exit 0; depcruise 391 Module,
  0 Errors, 1 vorbestehende warn-only-Warnung. Trend: 0 (Runde 1) —
  konvergiert, keine weitere Runde nötig.

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

- Does this match what was asked? Ja — alle vier Kriterien vom frischen
  Reviewer als erfüllt beurteilt, mit Revert-Gegenprobe statt bloßem
  Grün-Blick. Keine bestehende Erwartung geändert, kein Scope-Creep.
- What surprised me? (1) Die Stopp-Regel griff nicht: die Link-ID-Bindung
  machte den Issue-76-Defekt in keinem bestehenden Szenario sichtbar.
  (2) Der lokale `main` war veraltet; maßgeblich war `origin/main`.
- What am I assuming without having verified it? Dass kein Versionssprung
  fällig ist: der Reinraum-Evaluator hat keinen Importeur außerhalb von
  `src/evaluator/` (per Grep verifiziert), die Änderung ist also noch nicht
  benutzersichtbar — als Default entschieden, der Mensch kann beim Merge
  anders entscheiden.

## Log (nach PR-Eröffnung)

- **Doku-Abgleich auf Wunsch des Menschen:** `main` trägt seit Issue 076 das
  BSData-Wiki als Submodul und eine erweiterte
  `docs/battlescribe-data-format.md`. Deren §15 führt genau unsere Frage —
  erbt ein Verweis den Typ seines Ziels? — als **Lücke der Quelle** und
  verweist auf dieses Issue als die Projekt-Entscheidung. Die Implementierung
  widerspricht keiner dokumentierten Regel; „`scope="parent"` vergleicht
  aufgelöste Ziel-IDs, nicht `entryLinkId`s" stützt das Durchschau-Muster.
- **Parallel-Merge:** Issue 076 wurde in einer anderen Session implementiert
  und als PR #148 gemerged — inklusive einer semantisch identischen
  rosParser-Umstellung (`entryLinkId || entryId`) und einem Grenzen-Fix in
  `constraints.js` (Link-Anker zählen unter der aufgelösten Ziel-ID).
  `origin/main` in diesen Branch gemergt; Konflikte in `rosParser.js`
  (Fassung von `main` übernommen, `defIdOf`-Helfer) und im Testkatalog
  (beide Szenario-Zeilen vereint, Summe 111). Die 076-Notiz zur „zweiten
  Fundstelle" korrigiert (076 hat den Adapter selbst gefixt, nicht 078) und
  das 076-Frontmatter auf den Merge-Stand nachgezogen (done, PR #148).
- Fakten nach dem Merge: `npm test` 209 Dateien / 2120 Tests + UI-E2E exit 0
  (darin der Manifest-Runner mit 111 Fällen inkl. beider neuer Szenarien);
  `npm run lint` exit 0; `npm run typecheck` exit 0; `npm run depcruise`
  391 Module, 0 Errors, 1 vorbestehende warn-only-Warnung. Mein Typ-Zählen
  und der 076-Fix vertragen sich — keine Erwartung musste angepasst werden.

## Retro

- **Gut gelaufen:** Die Recherche vor Checkpoint 1 hat zwei Fallen entschärft,
  die eine naive Umsetzung gekostet hätten — die falsche Semantik des
  `type`-Attributs am Link und die Maskierung des Defekts durch die
  Ziel-ID-Bindung des Harness. Die vorab notierte Stopp-Regel (Issue-76-Rot →
  anhalten) machte die riskante rosParser-Umstellung entscheidbar, ohne den
  Menschen zu blockieren; sie griff dann nicht. Review-Runde 1 mit
  Revert-Gegenprobe: 0 Befunde, konvergiert sofort.
- **Im Weg:** Wenig. Der lokale `main` war veraltet; der Reviewer musste
  selbst auf `origin/main` ausweichen. Lehre: vor dem Review-Dispatch den
  Default-Branch fetchen und die Merge-Base im Auftrag nennen.
- **Cross-Issue-Kopplung:** Die rosParser-Bindung war als „zweite Fundstelle"
  in Issue 76 dokumentiert, wurde aber hier gebraucht (Kriterium 3 sonst
  unerfüllbar). Als Schnitt-Bestandteil gezogen und 76 nachgezogen — das
  Muster (Fundstelle wandert in den Schnitt, der sie braucht; Rest bleibt
  offen) hat funktioniert und darf so bleiben. Kein Metis-Regel-Fehlgriff.