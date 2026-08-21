---
status: done
branch: claude/riese-aushebedialog-fehlt-qh0hk2
pr: 248
---

# Riese im Aushebedialog der O&G Definitive Edition anbieten

## Goal

Der Riese ist im Aushebedialog der Armee "Orcs & Goblins" (Definitive Edition) unter der Kategorie "Selten" auswählbar; heute fehlt der Eintrag im Dialog vollständig, obwohl die Katalogdaten ihn führen.

## Acceptance criteria

- AC1: Aus den Katalogdaten der O&G Definitive Edition ist belegt, unter welchem Mechanismus (Entry Link, Selection Entry Group, Kategorie-Zuordnung, Modifier oder Constraint) der Riese als seltene Auswahl angeboten wird; das Ergebnis steht in der Issue-Datei unter "Befund".
- AC2: Der Aushebedialog listet den Riesen für die O&G Definitive Edition unter "Selten" als auswählbaren Eintrag.
- AC3: Ein aus den Katalogdaten abgeleitetes Testszenario nagelt fest, dass der Riese als seltene Auswahl der O&G Definitive Edition angeboten wird, und schlägt gegen den heutigen Stand fehl. | verify: forge-test
- AC4: Alle Checks laufen grün. | verify: forge-test && forge-lint && forge-typecheck && forge-build

## Befund

Belegt an `src/evaluator/__fixtures__/whfb6-definitive/` (Definitive Edition):

- Der Riese ist **kein eigener Eintrag des O&G-Armeebuchs**. Die einzige
  Definition `selectionEntry id="7645ed71-72bd-4b72-89ab-22571a0a8b0c" name="Giant"`
  steht im **Bibliothekskatalog** `Mercenaries (6th definitive edition).cat`
  (`library="true"`, Katalog-Id `fc47-8392-a6c8-452a`) und traegt dort die
  Kategorie „Regiment of Renown" (`ee09-9a50-ad78-9c32`).
- O&G bietet ihn ueber einen **Wurzel-`entryLink`** an:
  `entryLink id="f6b3-0b56-7a09-2dc5" name="Giant" targetId="7645ed71-…"`, ganz
  unten in `Orcs and goblins (6th definitive edition).cat`, aufgeloest ueber den
  `catalogueLink id="b066-2f8e-11ee-1dce" targetId="fc47-8392-a6c8-452a"`.
- Die Kategorie „Selten" kommt **nicht vom Ziel, sondern aus den `modifiers` des
  Links selbst**: `remove` von `ee09-9a50-ad78-9c32` und `set-primary` auf
  `e94b-6a54-8779-cd60` („Rare"). Eine `modifierGroup` verschiebt ihn in einem
  „Mountain or Troll Country Waaagh!"-Kontingent nach „Special"
  (`43cc-fc3f-35a7-8d03`), ein weiterer Modifier setzt ihn in einem
  „Nomadic Badlands Waaagh!"-Kontingent auf `hidden`. Die `forceEntry`
  „Standard (OG-AB)" (`2bfa-e64a-7123-895f`) verlinkt „Rare" regulaer.
- **Ursache des Fehlers:** vier weitere Armeebuecher des Korpus fuehren je einen
  eigenen Wurzel-`entryLink` auf dasselbe Riesen-Ziel (Dunkelelfen
  `fc28-6f24-99a2-4419`, Skaven `8224-8d4f-0747-658f`, Imperium
  `3db0-c8a2-4a5f-e643`, Vampirfuersten `35a6-42c9-a3d3-8dc5`) — alle ohne
  Kategorie-Modifikatoren. Weil ein Wurzel-`entryLink` vom Katalog-Bezugsrahmen
  ausgenommen ist (der „Regiments of Renown"-Weg) und `attachOfferAnchors` ueber
  die **Ziel-Id** entdoppelt, verankerte im vollstaendigen Datensatz der
  alphabetisch erste dieser Links (Dunkelelfen) — mit Primaerkategorie
  „Regiment of Renown" und fremder Herkunft. Der O&G-eigene Link kam gar nicht
  mehr zum Zug, und der Herkunftsfilter des Aushebe-Dialogs entfernte den
  verbliebenen fremden Slot: der Riese fehlte vollstaendig. Mit nur O&G +
  Mercenaries im Datensatz trat der Fehler nicht auf — deshalb faehrt der Test
  den **ganzen** Korpus.
- **Behebung:** `candidatesFor` (`src/evaluator/offer.js`) laesst einen fremden
  Wurzel-`entryLink` weichen, sobald das Armeebuch **dieses** Kontingents selbst
  einen Link auf dasselbe Ziel fuehrt; wo es keinen fuehrt, bleibt das fremde
  Angebot bestehen.

## Out of scope

- Andere Armeen und andere Katalog-Editionen; die Ursache wird generisch behoben, aber nur O&G Definitive wird als Testfall festgenagelt.
- Regeln, Punktekosten und Profilwerte des Riesen.
- Umbau des Aushebedialogs über den zur Behebung nötigen Umfang hinaus.
