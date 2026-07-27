---
status: active
branch: resolver-immutability
pr:
---

# Resolver: unveränderliche Sicht ohne Mutation der Eingabe zusichern

## Intent

`resolveCatalogue` (`src/evaluator/resolver.js`) verspricht eine unveränderliche
Sicht auf die Katalogdaten, erreicht sie aber, indem es auf die gelesenen
Objekte schreibt (`modifier.target`, `condition.witnessDefinition`,
`info.resolved`, `link.resolved`). `effectiveState.js` formuliert die
entgegengesetzte Zusicherung („Basisdefinitionen werden nie mutiert",
Leitprinzip 5). Seit dem zweistufigen Schnitt der Fassade
(`prepareDataset` → `evaluate`, Main-Issue 75) reicht derselbe aufbereitete
Graph in beliebig viele Auswertungen hinein — das Aliasing ist tragend
geworden und gilt bisher allein durch Disziplin.

Akzeptanzkriterien (übernommen aus dem Alt-Issue
`docs/issues/80-resolver-baut-die-unveraenderliche-sicht-durch-mutation-seiner-eingabe/`):

1. Es ist entschieden und begründet, ob die Auflösung mutationsfrei wird
   (Seitentabellen) oder die Unveränderlichkeit nach der Aufbereitung
   erzwungen wird (Einfrieren).
2. Die gewählte Zusicherung gilt nicht nur per Dokumentation, sondern fällt
   bei Verletzung auf.
3. `resolver.js` und `effectiveState.js` sagen dasselbe über
   Unveränderlichkeit.
4. Ein Test hält fest, dass mehrere Auswertungen desselben aufbereiteten
   Datensatzes einander nicht beeinflussen.

## Plan

## Tasks

## Decisions

- Quelle des Intents: Alt-Issue 80 (`needs-triage`, Type refactor), gefunden
  bei der Standards-Prüfung von Main-Issue 75. Vom Menschen beauftragt:
  „such dir was Passendes aus dem Backlog aus" — Auswahlgrund: selbstständig
  umsetzbar, klare falsifizierbare Kriterien, echte interne Design-Entscheidung.
- Dieser Lauf ist ein Metis-Probelauf ohne Migration: das alte
  Workflow-Wiring des Projekts bleibt unangetastet; nur diese Issue-Datei
  folgt dem neuen Template.
- Die Design-Entscheidung (Kriterium 1) ist intern, nicht outward-facing —
  sie liegt beim Lauf, nicht beim Menschen. Der Implementer entscheidet am
  Code und begründet; die Entscheidung wird hier nachgetragen.
- Kein separater `test-author`: Kriterium 1 wählt die Mechanik erst am Code,
  die ein blinder Test-Autor nicht testen könnte; Kriterien 2 und 4 sind
  mechanisch scharf genug, dass ein tautologischer Test auffällt. Der
  Implementer schreibt die Tests selbst (Invariante 2). Gegenprüfung liegt
  beim Reviewer, Prüfung 3 (Tests gegen den Intent).

- **Kriterium 1, entschieden vom Implementer am Code:** Die einmalige Mutation
  während der Aufbereitung bleibt; die Unveränderlichkeit wird danach
  erzwungen (tiefes Einfrieren des aufbereiteten Graphen). Begründung: die
  Anreicherung „einmal auflösen, oft lesen" ist gemessene Architektur (die
  Aufbereitung ist 98,9–99,5 % der Kosten einer Auswertung); Seitentabellen
  hätten Nachschlage-Zugriffe durch mindestens sechs Verbrauchermodule
  gefädelt, ohne Verhaltensgewinn — und hätten für Kriterium 2 trotzdem einen
  eigenen Durchsetzungsmechanismus gebraucht. `Object.freeze` ist im Projekt
  bereits das idiomatische Mittel dafür, und ESM läuft im strict mode: ein
  Schreibzugriff wirft `TypeError` an der verursachenden Stelle.
- Annahme des Implementers, an den Reviewer weitergereicht: Das Einfrieren
  trifft als Nebenwirkung auch den geparsten Eingabe-Katalog (er teilt Objekte
  mit der aufgelösten Sicht). Belegt durch die grüne Gesamtsuite, dokumentiert
  im JSDoc — aber es ist eine Verhaltensänderung über den Resolver hinaus.
- Umgebung: Standard-Node im Sandbox ist v22.22.2 und verletzt `engines: ^24`;
  alle Läufe liefen unter v24.18.0 aus `NVM_DIR=/opt/nvm`.

- **Review-Runde 1, Triage der fünf Befunde** (alle mit Reproduktion, keiner
  nach der Reproduktionsregel verworfen):
  - *Blockierend, zurück an den Implementer:* Befund 1 (Kriterium 4 nicht
    erfüllt — der Test dafür ist tautologisch: leeres Roster, beide
    Assertions reduzieren sich auf `expect([]).toEqual([])`; der Reviewer hat
    es per Gegenprobe belegt: mit neutralisiertem `freezeResolvedView` fallen
    18 von 20 Assertions, und die 2 Überlebenden sind genau diese) und
    Befund 3 (Kriterium 3 der Substanz nach verletzt — das JSDoc behauptet,
    der übergebene Katalog werde mit eingefroren; `p.entries.push(…)`,
    `p.infos.push(…)`, `p.costTypes.push(…)`, `p.id = …` gelingen aber alle).
  - *Mitzufixen:* Befund 2 (die Einmal-pro-Graph-Vorbedingung von
    `resolveCatalogue` ist nicht dokumentiert; sie gilt heute nur durch die
    zufällige Lage der Aufrufstellen).
  - *Akzeptiert, mit Grund:* Befund 4 (`Set.prototype.add.call(…)` umgeht die
    Härtung). Kriterium 2 verlangt, dass eine Verletzung auffällt — gegen
    unabsichtliches Abdriften hält der Mechanismus, und der reguläre Zugriff
    wirft. Absichtliche Umgehung über das Prototyp-Objekt abzudichten wäre
    Aufwand ohne Schutzgewinn. Nur die absolute Formulierung muss weg.
  - *Von mir selbst behoben:* Befund 5 — `docs/evaluator-architecture.md:36`
    (Leitprinzip 5) sagte weiter „Basisdefinitionen werden nie mutiert" und
    widersprach damit dem Quelldokument nach wie vor. Jetzt präzisiert:
    einmalige Anreicherung während der Aufbereitung, danach eingefroren.
- Leistungskosten des Einfrierens, vom Reviewer gemessen: ~11 % von
  `prepareDataset` (1589,6 ms gegen 1428,8 ms, Median aus 5 warmen Läufen
  über die vier WHFB6-Kataloge + `.gst`). Entschieden, die Entscheidung nicht
  neu aufzurollen: das sind rund 160 ms einmalig je Datensatz auf einem
  Vorlauf, der ohnehin 1,4 s dauert, und die Zusicherung ist tragend, seit
  ein aufbereiteter Graph in beliebig viele Auswertungen reicht. Der Preis
  steht im PR-Text, damit er widersprechbar ist.

- **Review-Runde 2** (frischer Reviewer, nicht der aus Runde 1). Fakten grün
  (`npm test` 2108 Tests, `npm run lint`, `npm run typecheck`, alle Exit 0);
  Kriterien 1, 2 und 4 erfüllt, Kriterium 3 erneut nicht — an anderer Stelle
  und aus dem entgegengesetzten Grund als in Runde 1:
  - *Blockierend, zurück an den Implementer:* `effectiveState.js:5` trägt
    unverändert den Satz „Basisdefinitionen werden nie mutiert" — genau die
    Zusicherung, die der Intent als Widerspruch benennt. Der Implementer hatte
    in Runde 1 geurteilt, die Datei sei „true as written" und brauche keine
    Änderung; das Urteil hält der Zeile nicht stand. Dazu `effectiveState.js:8`
    („ein Schreibversuch wirft im Strict Mode") — dieselbe absolute
    Formulierung, die in `resolver.js` schon korrigiert wurde.
  - *Von mir selbst behoben:* Meine eigene Korrektur an
    `docs/evaluator-architecture.md` (Leitprinzip 5) aus Runde 1 trug denselben
    Fehler — sie behauptete den Wurf im strict mode absolut. Jetzt präzisiert:
    Felder über den strict mode, Mengen/Abbildungen über ersetzte Mutatoren,
    Prototyp-Umgehung ausdrücklich ausgenommen.
  - *Nicht blockierend, aber zur Nacharbeit beauftragt:* Die Begründung des
    Implementers, die beiden Gleichheitstests könnten „konstruktionsbedingt
    nicht kippen", ist widerlegt. Der Reviewer hat die Neutralisierung
    repliziert (8/11 wie gemeldet) und dann einen Test gebaut, der Kriterium 4
    ausdrückt *und* kippt: Schreibzugriff auf `limits[0].value` über
    `PreparedDataset.contentsOf`, danach Vergleich zweier Berichte —
    grün gegen HEAD, rot mit neutralisierter Durchsetzung (`limit-max-warriors`
    verschwindet, weil die Grenze auf 99 steigt). Der Test wird ergänzt.
- Perzeptionsregel geprüft: Kriterium 3 ist zweimal in Folge gerissen, aber
  nicht mit identischem Befund (Runde 1: `resolver.js` behauptete ein
  Einfrieren, das nicht stattfindet; Runde 2: `effectiveState.js` bestreitet
  einen Schreibzugriff, der stattfindet). Kein Stopp — aber der Implementer
  ist angewiesen, zu melden statt zu flicken, falls eine dritte Stelle
  dieselbe Zusicherung erneut anders formuliert; das wäre dann ein Problem
  der Verteilung, nicht der Formulierung.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja — der Mensch hat die Auswahl aus dem
  Backlog delegiert; Intent und Kriterien sind unverändert aus Alt-Issue 80
  übernommen, das den Befund am Code belegt.
- **What surprised me?** Nichts Materielles. Auffällig nur: Alt-Issue 73 ist
  `claimed` — ein unterbrochener Lauf des alten Workflows; nicht angefasst.
- **What am I assuming without having verified it?** (a) Dass die vier
  genannten Mutationsstellen nach dem Merge von Main-Issue 75 (#142,
  `85cbb2c`) noch so existieren — das Alt-Issue wurde währenddessen
  geschrieben. (b) Dass die E2E-Suite wiederholte Auswertungen desselben
  Datensatzes tatsächlich abdeckt, wie das Alt-Issue behauptet. Beides
  verifiziert der Implementer als Erstes; weicht es ab, meldet er Surprise.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
