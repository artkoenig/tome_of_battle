Status: resolved
Type: refactor
Blocked by: [01]

## Description

Nachdem Slice 01 die dateiübergreifende Auflösung (Engine + Fassade + Kohärenz-
Diagnosen) an echten Daten belegt hat, baut diese Slice die eigentliche
**reale E2E-Szenarien-Suite** auf: pro Definitive-Edition-Armee-Katalog
aussagekräftige Roster-Szenarien, jeweils zusammen mit derselben
Spielsystemdatei **und** der gemeinsamen Mercenaries-`.cat` (alle drei
Armee-Kataloge deklarieren den `catalogueLink` auf Mercenaries). Damit ist
belegt, dass die Auflösung nicht auf einen Katalog zugeschnitten ist, sondern
katalogübergreifend die reale Regel-Semantik trägt.

Geprüft werden reale Domänen-Szenarien mit Assertions auf **bekannte, im
jeweiligen Katalog verifizierte** Definitions-IDs, Namen und Grenzwerte:

- **Ogre Kingdoms:** die realen armeeweiten Pflichtregeln „General" (`.gst`
  `1077-7379-f142-f382`, force-scope, min 1) und „Core" (`.gst`
  `35c2-d478-392a-aeb1`, force-scope, min 2) schlagen bei leerer Armee an (Ist 0
  gegen ihre Grenze) und sind erfüllt, sobald die geforderten Einheiten
  vorhanden sind; der reale **bedingte** `set→1`-Modifikator auf der Core-Grenze
  wirkt sichtbar — er hängt an der Selektion „Border Patrols rules"
  (`4e15-0353-165f-5528`, rein selektionsbasiert, daher von der Engine
  schaltbar): ohne diese Selektion bleibt die effektive Core-Untergrenze bei 2,
  mit ihr wird sie auf 1 gesetzt, und die zugehörige Verletzung für ein gegebenes
  Roster ändert sich entsprechend. Zusätzlich wird die **unbedingte**
  „Tyrant"-Obergrenze (`cb1c-3389-8f55-d6c6`, max 1) als Obergrenzen-Regel
  belegt: zwei Tyrants erzeugen die Verletzung Ist 2, Grenze 1.
- **Orcs and Goblins:** mindestens eine reale Regel (Pflicht-/Obergrenze oder
  bedingter Modifikator) wird an bekannten realen IDs/Werten geprüft; eine
  bekannt-regelkonforme Liste erzeugt keine falsche Verletzung.
- **Vampire Counts:** ebenso an mindestens einer bekannten realen Regel.

## Acceptance Criteria
- [ ] Die echten Ogre-Kingdoms-Daten (`.gst` + Ogre-`.cat` + Mercenaries-`.cat`)
      werden end-to-end ausgewertet: die realen armeeweiten Pflichtregeln
      „General" (`1077-7379-f142-f382`, min 1) und „Core" (`35c2-d478-392a-aeb1`,
      min 2) schlagen bei leerer Armee an (Ist 0 gegen ihre Grenze) und sind
      erfüllt, sobald die geforderten Einheiten vorhanden sind.
- [ ] Der reale **bedingte** `set→1`-Modifikator auf der Core-Grenze
      (`35c2-d478-392a-aeb1`) wirkt sichtbar: er hängt an der selektionsbasierten
      Bedingung „Border Patrols rules" (`4e15-0353-165f-5528`). Ohne diese
      Selektion ist die effektive Core-Untergrenze 2, mit ihr 1; die zugehörige
      Verletzung für ein gegebenes Roster ändert sich entsprechend. (Die
      punktebasierten Stufen 3/4/5/6 sind bewusst nicht Teil des Tests.)
- [ ] Die **unbedingte** „Tyrant"-Obergrenze (`cb1c-3389-8f55-d6c6`, max 1) wird
      als Obergrenzen-Regel belegt: zwei Tyrants erzeugen die Verletzung Ist 2,
      Grenze 1.
- [ ] Die echten Orcs-and-Goblins-Daten werden zusammen mit ihrer
      Spielsystemdatei und der Mercenaries-`.cat` end-to-end ausgewertet;
      mindestens eine reale Regel (Pflicht-/Obergrenze oder bedingter Modifikator)
      wird an bekannten realen IDs/Werten geprüft, und eine bekannt-regelkonforme
      Liste erzeugt keine falsche Verletzung.
- [ ] Die echten Vampire-Counts-Daten werden ebenso (mit `.gst` + Mercenaries)
      end-to-end ausgewertet und an mindestens einer bekannten realen Regel
      geprüft.
- [ ] Für alle drei Kataloge werden per Verweis importierte Definitionen (auch
      katalogübergreifend über Mercenaries) berücksichtigt und erscheinen nicht
      fälschlich als unaufgelöst.
- [ ] Alle Tests (`npm test`) sind grün.

## Comments
- BLOCKER (slice not implemented): Both Ogre-specific ACs contradict the real fixture data (verified by reading the XML + running the engine). AC2: NO modifier in any of the 6 fixture files targets the Tyrant max cb1c-3389-8f55-d6c6 -> the Tyrant upper limit is UNCONDITIONAL. The real conditional character-allowance limit is on the Lord category max fda5-91c2-e17f-774c and is points-driven (limit::ecfa-8486-4f6c-c249), which the engine cannot evaluate from a unit-count roster. AC1: 'Ogre Bulls' (target 7754 in Mercenaries) is only reachable via a cross-catalog entryLink d82e; entryLinks seed no mandatory phantom, so its min 32ed never fires on an empty army and never runs a clean empty->satisfied cycle (only surfaces as an unresolvedScope artifact at actual 0). Real, verified Ogre rules that DO work: General min 1 (gst 1077-7379-f142-f382, force scope), Core min 2 (gst 35c2-d478-392a-aeb1, force scope, with real conditional set-modifiers 1/3/4/5/6), Tyrant max 1 (cb1c, unconditional, fires at actual 2), cross-catalog Mercenaries Pikemen. Recommend the caller reconcile the AC wording (which rule is 'mandatory' vs which carries the 'conditional modifier') before slice 02 asserts on it -- leaving status claimed for triage.
- RECONCILED (user-confirmed, data-verified): Ogre-ACs auf verifizierte echte Regeln umgestellt. Pflicht -> General 1077 (force min 1) + Core 35c2 (force min 2); bedingter Modifikator -> Core-set->1, selektionsbasiert an 4e15 'Border Patrols rules' (engine-schaltbar, query.js unterstuetzt SELECTION_COUNT); Tyrant cb1c bleibt als UNbedingte Obergrenze (2 -> Ist 2/Grenze 1). Punktebasierte Core-Stufen 3/4/5/6 (limit::ecfa) bewusst ausgenommen. Alte Bulls/Tyrant-Bedingung war gegen die echten Daten falsch.
- Reale E2E-Szenarien-Suite je Armee gebaut (e2e.ogreKingdoms/orcsAndGoblins/vampireCounts.test.js), alle gegen echte DE-Daten (gst + army.cat + Mercenaries) verifiziert per Engine-Lauf. Ogre: General-Pflicht 1077 (Anker Kategorie a37e, force min 1) und Core-Pflicht 35c2 (Anker Kategorie 64bf, force min 2) schlagen im leeren Kontingent 729f an (Ist 0) und sind erfuellt mit General-Aufwertung 1b7c + zwei Core-Einheiten; bedingter set->1-Modifikator ueber Selektion 4e15 'Border Patrols rules' schaltet die effektive Core-Untergrenze 2->1 (dieselbe 1-Core-Liste: ohne 4e15 verletzt Ist1/Grenze2, mit 4e15 erfuellt); unbedingte Tyrant-Obergrenze cb1c (Eintrag 2679, max 1): zwei Tyrants -> Ist 2/Grenze 1. O&G (Force 2bfa) und VC (Force e989): dieselben gst-Pflichtregeln General/Core als sichere Anker; regelkonforme Liste erzeugt keine falsche Verletzung. Fuer alle drei: kein DANGLING_ENTRY_LINK/INFO_LINK, ohne Mercenaries MISSING_CATALOGUE_DEPENDENCY (fc47) + baumelnder Mercenaries-Verweis f7d8. Shared loader realCatalogs.js um O&G/VC-Datensaetze und verifizierte Konstanten erweitert; neuer Testbaustein e2eRoster.js. npm test gruen (1812 Tests + Puppeteer-E2E).
