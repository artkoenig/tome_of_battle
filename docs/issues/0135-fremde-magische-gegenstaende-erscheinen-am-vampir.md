---
status: active
branch: claude/vampire-editor-unwanted-items-syfq8s
pr:
---

# Fremde Sonderlisten-Gegenstände erscheinen im Editor am Vampir

## Intent

Im Editor bietet ein gewöhnlicher Vampir (Kontingent „Standard (VC-AB)") Gegenstände
an, die nur einer Sonderarmeeliste gehören — gemeldet vom Maintainer am Beispiel
**„Bloody Nora"**, einem Magiewaffen-Eintrag der Vampire-Coast-Liste (WD#306-UK).
Dieselbe Ursache betrifft eine ganze Klasse: „Ship's Colours", „Dead Man's Chest",
„Wharf Rats", „Dirty Serpent", die vier Gruppen „… (Vampire Coast)", „… (CoU)",
„Talismans of Ulric", „Drakenhof Banner", „Wolf Lord", „Sky Chariot", in den
Söldner-/O&G-Katalogen die „(Relics of Lustria)"-Gruppen und die
„[DOGS OF WAR]"-Gegenstände.

Der Katalog gattert diese Inhalte nach **einem** Muster: der *geteilte* Eintrag bzw.
die *geteilte* Gruppe trägt `hidden="true"` und einen bedingten Modifikator
`set hidden="false"`, der nur in der passenden Armeeliste greift; der `entryLink`,
über den die Einheit sie einbindet, trägt `hidden="false"`. Belegt an den
DE-Katalogen der Fixtures (`src/evaluator/__fixtures__/whfb6-definitive/`):
22 der 27 geteilten Definitionen mit `hidden="true"` tragen genau diesen
Aufdeck-Modifikator, und **kein einziger** der 2302 `entryLink`s dieser Dateien lässt
das `hidden`-Attribut weg — Battlescribe schreibt es immer.

Daraus folgen zwei Defekte in der Reinraum-Engine:

**(A) Das Basis-`hidden` des Verweisziels wird vom `hidden="false"` des Verweises
geschlagen.** `baseHiddenOf` (`src/evaluator/effectiveState.js`) wendet die Erb-Regel
„eigene Angaben vor geerbten" an (Issue 0099, Kriterium 2). Weil reale Kataloge das
Attribut am Link *immer* schreiben, erreicht das `hidden="true"` des Ziels ein
Vorkommen damit nie — die Vererbung aus 0099 ist an echten Daten wirkungslos, und
jedes so gegatterte Angebot ist immer sichtbar. Richtig ist die
**Oder-Verknüpfung**: versteckt ist ein Vorkommen, wenn der Verweis **oder** sein
Ziel versteckt ist; Modifikatoren schlagen weiterhin beide Basiswerte. Das ist
zugleich die Regel, die das Schreibmodell der App längst anwendet
(`src/roster/entryVisibility.js`: `entry.hidden === true || res.hidden === true`) —
die beiden Engines widersprechen sich heute.

**(B) Eine Option einer versteckten Gruppe bleibt sichtbar** (bereits als
[Issue 0132](0132-option-einer-versteckten-gruppe-bleibt-sichtbar.md) erfasst).
„Bloody Nora" selbst trägt kein `hidden`; versteckt ist allein die geteilte Gruppe
„Magic Weapons (Vampire Coast)", die sie hält. Die Angebots-Schicht (`offer.js`)
durchschreitet Gruppen und Gruppen-Verweise und verankert die Member **flach** am
Rahmen — die Sichtbarkeit der durchschrittenen Klammer geht dabei verloren. (A)
allein reicht deshalb nicht: die Gruppe verschwände, ihre Member blieben als
heimatlose Zeilen stehen.

Acceptance criteria:

1. Ein Vorkommen über einen `entryLink` mit **explizitem** `hidden="false"` auf ein
   Ziel mit `hidden="true"` ist versteckt (`isHidden: true`). `hidden="true"` am
   Verweis versteckt weiterhin unabhängig vom Ziel, und `hidden`-Modifikatoren an
   Verweis wie Ziel schlagen weiterhin beide Basiswerte — insbesondere macht der
   Aufdeck-Modifikator am Ziel das Vorkommen wieder sichtbar, sobald seine Bedingung
   greift. Kriterium 2 von Issue 0099 wird damit in seiner „false"-Hälfte bewusst
   zurückgenommen; die Begründung steht oben und in 0099s Nachtrag.
2. Eine Option, die ein Rahmen nur **durch** eine versteckte Gruppe (oder einen
   Verweis auf eine versteckte Gruppe) anbietet, trägt `isHidden: true` — und wird
   wieder sichtbar, sobald ein Modifikator die Klammer aufdeckt. Verschachtelte
   Klammern gelten dabei kumulativ.
3. An echten Katalogdaten (gst + Vampire Counts, DE-Fixtures): in einem Kontingent
   „Standard (VC-AB)" trägt kein Slot der Vampire-Coast-Inhalte
   (`Bloody Nora`, `Wharf Rats`, `Dirty Serpent`, die vier `… (Vampire Coast)`-Gruppen)
   `isHidden: false`; in einem Kontingent „Vampire Coast (WD#306-UK)" sind sie sichtbar.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code belegt.
   Bewusst erwartete Ausnahme: der eine Test aus 0099, der die zurückgenommene
   Hälfte von dessen Kriterium 2 festnagelt, wird auf die neue Regel umgeschrieben.

## Plan

- `effectiveState.js`: `baseHiddenOf` verknüpft das `hidden` des Trägers und das
  seines aufgelösten Ziels mit ODER (statt „eigenes vor geerbtem").
- `offer.js`: die Angebots-Auflistung führt die durchschrittenen Gruppen-/
  Gruppenverweis-Definitionen als **Sichtbarkeits-Klammern** mit und hängt sie an den
  Angebots-Anker (`visibilityGates`).
- `evalTree.js`: `attachOfferAnchor` nimmt die Klammern entgegen und legt sie am
  Knoten ab.
- `effectiveState.js`: das Basis-`hidden` eines Ankers schließt die Klammern ein.
- `modifiers.js`: an einem Anker mit Klammern greifen zusätzlich deren
  `field="hidden"`-Modifikatoren (nur diese), mit dem Anker als Träger — so bleibt
  das Aufdecken dynamisch.

## Tasks

## Decisions

- **Oder statt „eigenes vor geerbtem" (Kriterium 1).** Von den 42 versteckten geteilten
  Definitionen der DE-Fixtures gattern 37 über genau dieses Muster (`hidden="true"` plus
  bedingter Aufdeck-Modifikator); die fünf übrigen sind ein Mercenaries-Gruppeneintrag
  („Relics of Lustria") und vier erkennbar verwaiste Fremdarmee-Einträge
  (`[DARK ELVES]`, `[GREENSKINS]`), die ohnehin versteckt gehören. Kein Eintrag verliert
  durch die Änderung seine Erreichbarkeit.

- **Korrektur (2026-07-31, nach Rückfrage des Maintainers).** Die erste Fassung dieser
  Entscheidung nannte „Full Plate Armour" (`3869-2f40-dd21-6971`) und „Necrarch
  additional casting dice" (`68c7-4c56-8f0b-ad91`) als hingenommene Datenfehler, weil
  ihnen der Aufdeck-Modifikator fehle. **Das war falsch.** Beide tragen ihn — nur nicht
  in `<modifiers>`, sondern in einem bedingten `<modifierGroup>`
  (`Catalogue.xsd:523-538`), und die damalige Zählung sah nur in `<modifiers>` nach.
  Die Bedingung ist jeweils die Blutlinie: Full Plate Armour wird durch „Bloodline of
  Clan Blood Dragon" (`9fd9-e05c-ffcb-2c4d`) aufgedeckt, die Zusatzwürfel durch
  „Bloodline of Clan Necrarch" (`5017-296d-edef-4562`) — beides über
  `atLeast 1 selections scope="force" … includeChildSelections="true"`. Der Katalog ist
  an dieser Stelle korrekt, und die Engine wertet es korrekt aus: gegen die DE-Fixtures
  gemessen ist Full Plate Armour an Vampirlord (`7444-fade-d336-53b9`) und Vampirgraf
  (`a4d1-6e85-bee8-55d1`) ohne Blutlinie und mit Necrarch `isHidden: true`, mit Blood
  Dragon `isHidden: false`; die Zusatzwürfel spiegelbildlich. Beide Fälle sind jetzt als
  Echtdaten-Test festgenagelt (`effectiveState.baseHiddenInheritance.test.js`).

- **Herkunft:** Bugmeldung des Maintainers („in einer Vampirliste sehe ich beim Vampir
  im Editor solche Gegenstände wie ‚Bloody Nora'"), reproduziert an den DE-Fixtures über
  die Fassade `evaluate`.

## Log

- 2026-07-31 Reproduktion an echten Daten: `evaluate` gegen gst + Vampire Counts
  (DE-Fixtures), Vampirdiener im Kontingent „Standard (VC-AB)" — „Bloody Nora",
  „Wharf Rats", „Dirty Serpent" und die vier „(Vampire Coast)"-Gruppen melden
  `isHidden: false`. In der **laufenden App** (Wegwerf-Skript auf dem E2E-Harness,
  DE-Kataloge als Upload) standen dieselben Gegenstaende samt der „Relics of
  Lustria"-Talismane als lose Zeilen auf der Einheitenkarte.
- 2026-07-31 Tests zuerst: `src/evaluator/offer.hiddenGate.test.js` (9 Faelle) neu,
  ein Fall in `effectiveState.baseHiddenInheritance.test.js` auf die neue Regel
  umgeschrieben plus eine Gegenprobe ergaenzt. Vor der Umsetzung 6 rot / 13 gruen.
- 2026-07-31 Umsetzung wie geplant, vier Dateien: `effectiveState.js` (ODER statt
  Vorrang, Klammern im Basiswert), `offer.js` (Klammern mitfuehren), `evalTree.js`
  (`visibilityGates` am Anker), `modifiers.js` (nur `field="hidden"` der Klammern).
- 2026-07-31 Fundstueck aus der Nachmessung, das die Richtung unabhaengig bestaetigt:
  die Ruestungsgruppe des Vampirs (`66f2-d6a1-420c-5a39`) ist `hidden="true"` und wird
  nur fuer die Blutlinien Blood Dragon/Von Carstein aufgedeckt — die Regel der
  6. Edition. Vor der Aenderung standen „Heavy Armour"/„Light Armour" **ohne** jede
  Blutlinie auf der Karte; danach erscheinen sie genau dann, wenn die Blutlinie
  gewaehlt ist. Als zweiter Echtdaten-Test aufgenommen.
- 2026-07-31 Fakten per Exitcode: `npx vitest run` 261 Dateien / 2696 Tests exit 0;
  `node e2e/ui.test.js` exit 0; `npm run lint` exit 0; `npm run typecheck` exit 0;
  `npm run depcruise` 1 Warnung (0 Fehler) — dieselbe eine wie auf `main`, also
  unveraendert; `npm run knip` ohne neuen Befund (die Aenderung fuegt keinen Export
  hinzu).
- 2026-07-31 UI-Beleg: dieselbe Vampirkarte vor/nach der Aenderung als Screenshot
  aufgenommen und dem Maintainer geschickt.
- 2026-07-31 Version: kein Bump — vom Maintainer so entschieden (Vorschlag war
  1.9.4 als Patch); `package.json` bleibt bei 1.9.3.
- 2026-07-31 **Prozess-Abweichung, bewusst:** Rulebook-Invarianten 2 und 3
  (`test-author` schreibt die Tests, frischer Kontext prueft das Ergebnis) sind in
  dieser Sitzung nicht als Subagenten gelaufen — die Harness-Vorgabe dieser Sitzung
  untersagt das Starten von Subagenten ohne ausdrueckliche Bitte des Nutzers. Die
  Test-zuerst-Reihenfolge samt belegtem Rot ist eingehalten, die Gegenpruefung durch
  einen frischen Kontext fehlt und ist damit offen.

- 2026-07-31 **Korrektur nach Widerspruch des Maintainers** („ich denke nicht, dass es
  sich bei ‚Full Plate Armour' bei Vampiren um einen Katalogfehler handelt"): Der
  Eintrag traegt seinen Aufdeck-Modifikator in einem bedingten `<modifierGroup>`, nicht
  in `<modifiers>` — die urspruengliche Zaehlung sah nur in `<modifiers>` nach und hielt
  ihn deshalb faelschlich fuer ungegattert. Bedingung ist die Blutlinie „Blood Dragon"
  (`9fd9-e05c-ffcb-2c4d`), bei „Necrarch additional casting dice" entsprechend
  „Necrarch" (`5017-296d-edef-4562`). An den DE-Fixtures nachgemessen: an Vampirlord
  (`7444-fade-d336-53b9`) und Vampirgraf (`a4d1-6e85-bee8-55d1`) ist Full Plate Armour
  ohne Blutlinie und unter Necrarch `isHidden: true`, unter Blood Dragon
  `isHidden: false`; die Zusatzwuerfel spiegelbildlich. **Kein Katalogfehler, kein
  Verlust an Erreichbarkeit durch diese Aenderung.** Korrigierte Zaehlung ueber
  `<modifiers>` **und** `<modifierGroups>`: 37 von 42 versteckten geteilten Definitionen
  der Fixtures gattern ueber das Muster (vorher als „22 von 27" notiert). Nachgezogen:
  `effectiveState.js`, `effectiveState.baseHiddenInheritance.test.js`, Issue 0099,
  `docs/battlescribe-data-format.md` §8. Neu: 8 Echtdaten-Tests in
  `effectiveState.baseHiddenInheritance.test.js`, die beide Blutlinien-Gatter in beide
  Richtungen festnageln (`npx vitest run` dieser Datei: 20 Tests, exit 0).
- 2026-07-31 Die neuen Echtdaten-Faelle bereiteten den Datensatz zunaechst je Fall neu
  auf (14,8 s fuer die Datei) und rissen im ersten Suite-Lauf unter Parallellast das
  5-Sekunden-Zeitlimit — 1 Fehlschlag in `npx vitest run src/evaluator`. Behoben durch
  Memoisieren von `prepareDataset` in der Datei (1,5 s); zwei aufeinanderfolgende
  Laeufe danach: 72 Dateien / 904 Tests, exit 0. `npm run lint` exit 0 (1 Warnung,
  unveraendert gegen den Stand ohne diese Aenderung), `npm run typecheck` exit 0.
- 2026-07-31 Doku-Luecke geschlossen, die den Fehlschluss ueberhaupt moeglich machte:
  `docs/battlescribe-data-format.md` erwaehnte `modifierGroup` an keiner Stelle, obwohl
  die XSD es definiert (`Catalogue.xsd:107`, `523-538`) und die Engine es liest. §7.7
  hat jetzt einen eigenen Abschnitt samt Fallstrick-Kasten: wer fragt „gattert der
  Katalog diesen Eintrag?", muss `<modifiers>` **und** `<modifierGroups>` durchsuchen.

- **Vorbefund fuer ein eigenes Issue (nicht hier behoben):** `node
  scripts/measure-evaluator.js` bricht im dritten Messfall mit „Die nachgebildete
  Pipeline des Messverfahrens weicht von der Fassade `evaluate` ab" ab —
  **unveraendert auch auf `main`** (dort ebenso, Faelle 1 und 2 laufen durch).
  `scripts/lib/evaluator-measurement.js` ist der Fassade hinterher; ausserdem reisst
  die 100-ms-Schwelle schon auf `main`.

## Checkpoints

### Before implementation

- Does this match what was asked? Ja — gemeldet ist genau die Klasse „Gegenstände
  einer fremden Sonderliste stehen am gewöhnlichen Vampir"; beide Teilursachen liegen
  auf dem Weg vom Katalog-`hidden` zum `isHidden` des Berichts.
- What surprised me? Dass die Vererbung aus Issue 0099 an realen Daten **nie** greifen
  kann (kein `entryLink` lässt `hidden` weg) — der dort gebaute Pfad ist an echten
  Katalogen toter Code, und seine Vorrangregel dreht das gängigste Gatter-Muster der
  Kataloge ins Gegenteil.
- What am I assuming without having verified it? Dass Battlescribe selbst das
  `hidden` von Verweis und Ziel oder-verknüpft. Direkt nachgelesen ist das nirgends —
  weder Projekt-Referenz noch BSData-Wiki legen die Komposition fest; die Annahme
  stützt sich auf die Häufigkeitsverteilung im Katalog (22 : 2) und darauf, dass das
  Schreibmodell der App es längst so hält.

### Before the PR

- Does this match what was asked? Ja — der gemeldete Gegenstand und seine ganze Klasse
  sind am gewoehnlichen Vampir verschwunden, in der Sonderarmeeliste weiterhin da;
  belegt im Bericht (Tests) **und** in der laufenden App (Screenshot vorher/nachher).
- What surprised me? Dass die Aenderung eine zweite, unabhaengige Katalogregel
  mitrepariert, die niemand gemeldet hatte: die blutlinien-gegatterte Ruestung des
  Vampirs. Sie ist der beste Beleg dafuer, dass die Klammer-Regel stimmt — und
  zugleich der Grund, den Fall als Test aufzunehmen.
- What am I assuming without having verified it? Weiterhin die Komposition in
  Battlescribe selbst (siehe oben). Die frueher hier vermerkte Annahme — „Full Plate
  Armour" und „Necrarch additional casting dice" seien Datenfehler des Forks — ist
  **widerlegt**: sie stammte aus einer Zaehlung, die nur `<modifiers>` durchsuchte und
  `<modifierGroups>` uebersah. Siehe die Korrektur unter Decisions.
- Was die Annahme kosten wollte: eine falsche Meldung an den Maintainer und zwei
  unnoetige Katalog-Aenderungen. Aufgefallen ist sie nur, weil er widersprochen hat —
  „ich denke nicht, dass es sich um einen Katalogfehler handelt". Die Lehre steht in
  der Retro.

## Retro

- **Eine Suche ist kein Beweis, solange die Form des Gesuchten ungeprueft ist.** Die
  Behauptung „diesem Eintrag fehlt der Aufdeck-Modifikator" stuetzte sich auf eine
  Suche nach `<modifiers>`. Dass derselbe Modifikator auch in einem `<modifierGroup>`
  stehen darf, stand in der XSD und im Code (`catalogReader.js` zitiert
  `Catalogue.xsd:523-538`) — nur nicht in der Doku, aus der ich das Format gelesen
  habe. Aus einem Nullbefund einer Suche einen Datenfehler *des Nutzers* abzuleiten,
  war der eigentliche Fehler: die teuerste Schlussfolgerung auf der duennsten
  Grundlage. Die Gegenprobe waere billig gewesen — den Eintrag einmal mit der
  vermuteten Bedingung auswerten, statt ihre Abwesenheit zu behaupten.
- Aufgefallen ist es nur durch den Widerspruch des Maintainers. Genau die Rolle, die
  Invariante 3 (frischer Kontext prueft) haette spielen sollen und in dieser Sitzung
  nicht besetzt war.
