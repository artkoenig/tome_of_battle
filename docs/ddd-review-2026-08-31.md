# DDD-Prüfung — dritter Durchgang, 31. August 2026

- **Datum:** 2026-08-31
- **Modus:** vollständig (strategisch und taktisch)
- **Gegenstand:** **allein der Code** — `src/`. Kein Dokument wurde geprüft, und es gibt deshalb
  keinen Abschnitt über die Abweichung zwischen Entwurf und Code. Wo ein Kommentar *im Code*
  zitiert wird, ist er als Code zitiert.
- **Umfang:** die fünf Kontexte unter `src/contexts/`, dazu `src/platform/`, `src/shared/`, `src/ui/`.
- **Zweck:** ein unabhängiger frischer Blick. Das Modell unten ist aus dem Code rekonstruiert —
  Importe, Ports, Schreibwege, Tests — und erst danach mit den beiden früheren Durchgängen
  verglichen worden.
- **Vorgehen:** jeder Befund nennt `pfad:zeile`. Vier von ihnen wurden zusätzlich **ausgeführt**:
  eine Wegwerf-Sonde unter vitest hat gebaute `.ros`-Dateien und mitgelieferte Katalog-XML durch
  die echten Module geschickt; die ausgegebenen Werte stehen unten wörtlich. Die Sondendateien
  sind gelöscht, im Baum ist nichts von ihnen geblieben.
- **Als gegeben genommene Rahmenbedingungen** (aus dem Code gelesen, nicht erfragt): reine
  Client-PWA ohne Backend (`src/platform/persistence/database.js`); ein Nutzer, ein Browser, also
  keine Nebenläufigkeit; das Battlescribe-Dateiformat ist fremd und fest; die Trennung in zwei
  Parser ist entschieden (`src/contexts/ruleengine/engine/catalogReader.js:1-6`, ADR-0030).

---

## Was trägt

Kein Höflichkeitsabschnitt. Vier Dinge sind hier besser als in den meisten Codebasen, die sich
domänengetrieben nennen, und sie sind der Grund, warum die Befunde unten klein und örtlich sind.

**Der Evaluator ist eine echte Published Language, und die Grenze wird maschinell gehalten.** Genau
ein Modul importiert `engine/`: `src/contexts/ruleengine/evaluator.js:54-66`. Nichts sonst in
`src/` greift daran vorbei — nachgezählt über jeden relativen Import der 183 Produktionsmodule,
nicht der Regel geglaubt, die es behauptet. `.cast/rules.json` führt 26 verbotene und 18 erlaubte
Kanten, jede einzelne `severity: error`.

**Der ganze Importgraph passt auf eine Seite und zeigt in eine Richtung.** Über 183
Produktionsmodule gibt es genau **eine** kontextübergreifende Kante:
`src/contexts/armylist/application/mandatoryListRules.js:28` → `ruleengine/readmodel/index.js`.
Die Kontexte erreichen die Plattform ausschließlich über ihre `ports/`-Module
(`src/contexts/armylist/ports/storagePort.js`, `catalog/ports/catalogRepository.js`,
`play/ports/storagePort.js`), und `src/shared/` hat Fan-out null — drei Blattmodule, die an nichts
hängen.

**`src/contexts/play/model/game.js` ist ein lehrbuchhaft kleines Aggregat.** Es hat eine benannte
Invariante und setzt sie dort durch, wo der Wert sich ändert: `withAdjustedWound` klemmt in
Zeile 96 auf `[0, max]`, `withAdjustedTracker` klemmt in Zeile 110 bei null. Es verweist auf die
Liste **allein über die Identität** (`rosterId`, Zeile 19, mit der Begründung in den Zeilen 7-8),
es ist durchgehend unveränderlich, und seine aggregatübergreifende Konsistenz ist ausdrücklich und
benannt: `withoutOrphanedWounds` (Zeile 152) nennt die Staleness-Regel samt ihrer Richtung —
*lieber ein verwaister Eintrag als eine gelöschte Wunde*. Das ist das Muster, an dem der Rest der
Codebasis zu messen ist, und Befund 1 gibt es genau deshalb: ein anderer Schreibweg folgt ihm nicht.

**Die Engine hat ein typisiertes Vokabular statt Primitiven.**
`src/contexts/ruleengine/engine/model.js` deklariert 20 eingefrorene Aufzählungen und
Value-Object-Fabriken (`costSumField:58`, `limitValueField:67`, `SELECTION_COUNT:48`) — 689 Zeilen,
die die Ubiquitous Language *sind*, in Code. Die Benennungsdisziplin hält über alle Kontexte: kein
`Manager`, `Helper`, `Util`, `DTO` oder `Processor` irgendwo unter `src/contexts/`, und ein einziges
platzhalterförmiges Verb (`prepareDataset`), das eine echte Phase der Engine benennt.

Und der Aufwand passt zur Einstufung. Produktions- und Testzeilen: `ruleengine` 12 677 / 31 311,
`armylist` 2 959 / 4 073, `play` 258 / 204. Das tiefste Modell hat die tiefsten Tests, dazu 128
manifest-getriebene Black-Box-Szenarien unter `docs/testing/`. Die Pyramide steht nicht auf dem
Kopf: 183 Testdateien auf Modellebene gegen 137 der Oberfläche und 2 im Browser.

---

## Übersicht

| # | Befund | Schwere | Sicherheit | Bereich | Gruppe |
|---|---|---|---|---|---|
| 1 | Eine negative Anzahl kommt durch den `.ros`-Import und **kauft Punkte zurück**; der Bericht nennt eine überzogene Liste daraufhin regelkonform | hoch | hoch — ausgeführt | armylist (supporting), Wirkung in ruleengine (core) | jetzt beheben |
| 2 | Zwei Eigentümer beantworten „in welcher Kostenart wird diese Liste gemessen", und sie widersprechen sich auf mitgelieferten Katalogdaten | mittel | hoch — ausgeführt | armylist / ruleengine | jetzt beheben |
| 3 | Eine Regel, drei Kopien: gegen welchen Katalog ein Kontingent auflöst — und die dritte Kopie weicht bereits ab | mittel | hoch | armylist / ui | jetzt beheben |
| 4 | Der Anwendungsfall `renameRoster` hat keinen Produktions-Aufrufer; der lebende Umbenennungsweg baut ihn nach und trägt eine Regel, die dem Anwendungsfall fehlt | mittel | hoch | armylist | jetzt beheben |
| 5 | „Das Löschen einer Liste beendet ihre Partie" ist in einem React-ViewModel von Hand sequenziert, obwohl das Domänenereignis dafür existiert | mittel | hoch | armylist ↔ play | einplanen |
| 6 | Das Prädikat „ist das ein Aufwertungs-Profil" steht dreimal da, über freiem Text; die Stichwort-Tabellen haben den Kommentar überlebt, der sie abschafft | mittel | hoch | armylist / ui | einplanen |
| 7 | Benachbarte gleichtypige String-Parameter; ein vertauschter Aufruf liefert eine gültig aussehende leere Antwort, statt zu scheitern | mittel | hoch — reproduziert | ruleengine / armylist | einplanen |
| 8 | `rulebook` ist eine Übersetzungsschicht gegen eine fremde Website, geschnitten und benannt als Bounded Context | gering | hoch | rulebook | beobachten |
| 9 | Die whfb6-Verknüpfungs-Einstellung wohnt im Kontext `armylist`; keine Armeeliste liest sie | gering | hoch | armylist | beobachten |
| 10 | Die eine kontextübergreifende Kante ist von einer Regel verboten, die nach ihrer Abwesenheit benannt ist, und rutscht unter einer breiteren Erlaubnis durch | gering | mittel | armylist ↔ ruleengine | beobachten |

**Woran diese Bewertung hängt.** Es gibt kein `docs/ddd/subdomains.md`, die Einstufung im Abschnitt
*Grundlage* ist deshalb **vorgeschlagen, nicht dokumentiert**. Ist `armylist` doch Core statt
Supporting, steigen die Befunde 3, 4 und 6 je eine Stufe. Befund 1 bewegt sich nicht: eine nicht
durchgesetzte Invariante wird durch keinen Subdomain-Typ milder.

---

## Grundlage

Aus dem Code rekonstruiert. Wer eine Zeile korrigiert, verschiebt die Bewertungen mit.

| Bereich | Subdomain-Typ | Woraus abgeleitet |
|---|---|---|
| `contexts/ruleengine` | **core** | Das einzige wirklich unterscheidende Gut: ein von Grund auf eigener Auswerter eines fremden Regelformats, 12 677 Zeilen hinter einer Fassade, 31 311 Zeilen Tests und 128 Black-Box-Szenarien. Unterscheidung, nicht bloß Komplexität — ein Listenbauer ohne das ist ein Formular über einem Baum. |
| `contexts/armylist` | supporting | Geschäftsspezifisch, aber nicht unterscheidend. Jeder Listenbauer editiert einen Selektionsbaum; dafür wählt niemand diese App. 2 959 Zeilen, reine Daten plus reine Funktionen. |
| `contexts/play` | supporting | Der Begleiter am Tisch: Wunden, Runde, VP, CP. Klein, sauber modelliert, produktspezifisch. Vertretbar auch ein zweites Core, wenn der Spielmodus der Daseinsgrund des Produkts ist — das ist eine Frage ans Team und ändert unten nichts. |
| `contexts/catalog` | supporting | Import und Aktualisierung der Battlescribe-Daten. 158 Zeilen Orchestrierung; die Arbeit liegt in `platform/`. |
| `contexts/rulebook` | generic | Eine Nachschlagetabelle gegen eine fremde Website. 84 Zeilen. Siehe Befund 8. |
| `platform/battlescribe` | generic, aus Not selbst gebaut | Ein Parser für ein veröffentlichtes Fremdformat. Es gibt nichts zu kaufen — das Format hat eine Implementierung, und die steht nicht zum Verkauf. Richtig außerhalb der Kontexte gehalten. |
| `ui` | **kein Kontext** — die Kompositionswurzel | 9 478 Zeilen, 66 Importkanten in die Kontexte, keine zurück (`fachlogik-kein-rueckgriff`). Jede Beziehung zwischen Kontexten wird hier realisiert. Als Kontext gezählt wäre es der größte; es ist eine Schicht. |

**Nicht eingestuft:** nichts. **Rekonstruiert statt dokumentiert:** alles davon.

---

## Befunde

### 1. Eine negative Anzahl kommt durch den `.ros`-Import und kauft Punkte zurück

- **Schwere:** hoch
- **Sicherheit:** hoch — durchgehend ausgeführt, Werte unten zitiert
- **Symptom:** Umgehung der Invariante an einem zweiten Schreibweg (taktische Checkliste T5)
- **Fundstelle:**
  - `src/contexts/armylist/model/rosterSerialization.js:361` — das Loch
  - `src/contexts/armylist/model/subSelectionEditing.js:107-110` — dieselbe Regel, durchgesetzt
  - `src/contexts/armylist/model/rosterSerialization.js:337-338` — ein Nachbarfeld derselben
    Funktion wird sehr wohl geprüft
  - `src/contexts/ruleengine/acl/rosterAdapter.js:96` → `engine/costProjection.js:91,95` — der Weg
    zur falschen Antwort
- **Ausmaß:** ein Feld, ein Schreibweg, erreichbar aus einer Nutzerdatei.

**Was dasteht**

Der Editor setzt „die Anzahl einer Auswahl ist mindestens eins" genau dort durch, wo eine Anzahl
sich ändert:

```js
// subSelectionEditing.js:107-110
const changedCount = ownCountOf(childSelections[index]) + countDelta;
if (changedCount <= EMPTY_SELECTION_COUNT) {
  return withoutIndex(childSelections, index);      // die Auswahl entfällt stattdessen
}
```

Der `.ros`-Import tut das nicht:

```js
// rosterSerialization.js:361
const number = parseInt(node.getAttribute('number')) || 1;
```

`parseInt("-2")` ist `-2`, und `-2` ist truthy, also überlebt `-2`. Vierundzwanzig Zeilen früher,
in derselben Datei, wird die *Punktegrenze* desselben Dokuments geprüft, bevor ihr geglaubt wird
(`rosterSerialization.js:338`: `if (Number.isFinite(value) && value >= 0) return value;`). Ein Feld
des fremden Dokuments wird an der Grenze validiert, das Nachbarfeld nicht.

Die Anzahl reist danach unverändert weiter: `rosterAdapter.js:96` reicht sie als `count` durch, und
`costProjection.js:91` rechnet `perInstance * count`.

**Gemessen.** Eine Sonde hat zwei `.ros`-Dokumente gegen eine Grenze von 500 Punkten und eine
Einheit zu 100 Punkten importiert und beide über `evaluateAppRoster` ausgewertet:

```
number="-2"  →  IMPORTED number = -2
                costTotals = {"pts":-200}
                violations = []
number="6"   →  costTotals = {"pts":600}
                violations = ["budget::pts"]
```

**Warum das hier zählt**

Eine negative Anzahl erzeugt nicht bloß eine seltsame Zeile. Sie **zieht ab**. Eine Datei mit einer
echten 600-Punkte-Armee plus einer Auswahl auf `number="-2"` meldet `violations: []` — die App sagt,
eine überzogene Liste sei regelkonform. Einem Spieler zu sagen, seine Liste sei legal, wenn sie es
nicht ist, ist die eine Antwort, für die es diese Anwendung gibt, und die falsche Antwort entsteht
stumm, ohne jede Diagnose.

Die Eintrittswahrscheinlichkeit ist begrenzt, und das gehört klar gesagt: Battlescribe schreibt
keine negativen Anzahlen, es braucht also eine von Hand bearbeitete oder beschädigte Datei. Genau
darum steht hier „hoch" und nicht „kritisch". Hält das Team eine falsche Legalitätsaussage
unabhängig von der Eingabe für kritisch, steigt der Befund — am Mechanismus ändert das nichts.

Kein Test nagelt die Grenze fest: keine Fixture unter `src/tests/` oder `e2e/` enthält `number="0"`
oder eine negative Anzahl.

**Behebung**

An der Grenze klemmen, im Ausdruck, der ohnehin schon dasteht:

```js
const parsed = parseInt(node.getAttribute('number'), 10);
const number = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
```

Danach die beiden Fälle (`number="-2"`, `number="0"`) in
`src/tests/contexts/armylist/model/rosterSerialization.test.js` aufnehmen. Besser noch, und
billig: eine einzige Fabrik für `Selection`, durch die beide Schreibwege gehen — so wie
`play/model/game.js` es vormacht. Dann hat die Regel einen Eigentümer, und der nächste Importweg
erbt sie.

**Aufwand:** unter einer Stunde für die Klemme samt Tests; ein halber Tag für die gemeinsame Fabrik.

---

### 2. Zwei Eigentümer für „in welcher Kostenart wird gemessen", uneins auf mitgelieferten Daten

- **Schwere:** mittel
- **Sicherheit:** hoch — ausgeführt und auf einem mitgelieferten Katalog reproduziert
- **Symptom:** dieselbe Regel doppelt über eine Kontextgrenze hinweg, die Kopien sind auseinandergelaufen
- **Fundstelle:**
  - `src/contexts/armylist/model/costTypeLabels.js:21` — `resolveCostLimitTypeId(roster, system)`
  - `src/contexts/ruleengine/readmodel/costDisplays.js:24` — `costLimitTypeIdOf(roster, costTypes)`
  - `src/platform/battlescribe/xmlParser.js:675` — der App-Parser nimmt die Kostenarten **allein** aus der `.gst`
  - `src/platform/battlescribe/xmlParser.js:569` — `parseCatalogueXML` liest überhaupt keine `costTypes`
  - `src/contexts/ruleengine/engine/datasetDescription.js:57-58` — die Engine liest sie aus **jedem** Dokument
  - `src/contexts/armylist/model/rosterSerialization.js:124,257` — der `.ros`-Export nutzt den blinden Eigentümer
- **Ausmaß:** zwei Funktionen mit derselben Regel, dazu ihre beiden Label-Zwillinge
  (`resolveCostTypeLabel:36` / `costTypeLabelOf:37`), von denen jeder dieselbe Trimm-Regel im
  eigenen Kommentar noch einmal aufschreibt.

**Was dasteht**

Beide Funktionen setzen dieselbe Regel um — *die eigene Einstellung der Liste, ersatzweise die erste
deklarierte Kostenart* — über zwei verschiedenen Listen von Kostenarten. Die Liste der App kommt
allein aus der Spielsystemdatei; die der Engine aus der Spielsystemdatei **und** jeder
Katalogwurzel, weil das Format eine Deklaration dort erlaubt (`datasetDescription.js:44-46`).

**Gemessen.** Ein Spielsystem ohne Kostenart-Deklaration, dazu ein Katalog, der eine deklariert:

```
app parser  system.costTypes      = []
app parser  catalogue.costTypes   = undefined
engine      description.costTypes = [{"id":"cat-pts","name":"pts",...}]
armylist    resolveCostLimitTypeId = null
ruleengine  costLimitTypeIdOf      = cat-pts
```

Das sind keine erfundenen Daten. Von den 20 Katalogen im Baum deklariert einer seine eigene
Kostenart:

```
src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/Lizardmen (6th definitive edition).cat
  <costType name="SC Saurus Chars" id="bc66-b624-4194-2f0f" defaultCostLimit="-1"/>
```

Der Bericht der Engine führt `SC Saurus Chars` in `costTotals`; die App kann sie nicht benennen
(`resolveCostTypeLabel` gibt `''` für eine Id, die ihre Liste nicht kennt), und der `.ros`-Export,
der über den blinden Eigentümer in `rosterSerialization.js:124` auflöst, schreibt sie nicht.

Die projekteigene Regel nennt das unabhängig vom Verhalten einen Defekt: `docs/glossary.md` führt
`resolveCostLimitTypeId` als *den* Bezeichner dieses Begriffs, unter dem geltenden Satz „a *term*
may only have one name in code. Nothing in `src/` may name the term differently."

**Warum das hier zählt**

Die Saurus-Charakter-Zuteilung eines Echsenmenschen-Spielers ist eine echte Grenze eines echten
Armeebuchs. Die eine Hälfte der App sieht sie, die andere nicht — also steht in einer Anzeige ein
leeres Label, wo ein Name hingehört, und einer exportierten Datei fehlt eine Spalte, die ein anderes
Werkzeug lesen wird. Die beiden Antworten werden weiter auseinanderlaufen, weil keine der beiden
Funktionen von der anderen weiß.

**Behebung**

Den einen Eigentümer bestimmen. Die Engine hat den richtigen — sie liest, was das Format tatsächlich
erlaubt. Also: `parseCatalogueXML` beibringen, `<costTypes>` zu lesen und so zusammenzuführen, wie
`datasetDescription.costTypesOf` es tut (je Id gewinnt die erste Deklaration); danach
`costLimitTypeIdOf`/`costTypeLabelOf` löschen und das Lesemodell das überlebende Paar aufrufen
lassen. Zwei Aufrufer ändern sich (`usePlayRoster.js:29`, `usePlayUnit.js:149,162`),
`useRosterDashboard.js:43` und `useNewRosterModal.js:90` ziehen nach. Zu beachten: die beiden sind
sich auch über einen Feldnamen uneins — `hidden` im Parser, `isHidden` in der Beschreibung —, und
das gehört in dieselbe Änderung.

**Aufwand:** ein bis zwei Tage, überwiegend Tests.

---

### 3. Eine Regel, drei Kopien: gegen welchen Katalog ein Kontingent auflöst

- **Schwere:** mittel
- **Sicherheit:** hoch
- **Symptom:** Fachlogik in der Anwendungs- bzw. Darstellungsschicht, die Kopien laufen auseinander
- **Fundstelle:**
  - `src/contexts/armylist/application/rosterSelectionFactory.js:28` — `catalogueIdOfForce`, der benannte Eigentümer
  - `src/ui/viewmodels/editor/useForceSection.js:37` — Kopie, zwei Stufen
  - `src/ui/viewmodels/editor/useAutoFillSuggestions.js:78` — Kopie, **drei** Stufen
- **Ausmaß:** drei Umsetzungen; die dritte weicht bereits ab.

**Was dasteht**

```js
// rosterSelectionFactory.js:28-30 — der Eigentümer
export function catalogueIdOfForce(roster, force) {
  return force?.catalogueId || roster?.catalogueId || null;
}

// useForceSection.js:37
const forceCatalogueId = force?.catalogueId || roster?.catalogueId || null;

// useAutoFillSuggestions.js:78
const ownCatalogueId = force?.catalogueId || roster?.catalogueId || activeCatalogue?.id || null;
```

Die dritte hat einen Rückfall, den der Eigentümer nicht hat, und ihr Kommentar behauptet das
Gegenteil: *„dieselbe Rückfallregel wie im Aushebe-Dialog"* (Zeile 77). `useForceSection.js:25`
nennt den Eigentümer sogar beim Namen — *„dieselbe Regel wie `useRoster.catalogueIdOfForce`"* — und
zeigt damit auf einen Hook, den es nicht mehr gibt.

Die Regel zählt, weil Eintrags-Ids nur innerhalb ihres Katalogs eindeutig sind (ADR-0018),
festgehalten in `rosterSelectionFactory.js:21-22`. Wer gegen den falschen Katalog auflöst, löst den
falschen Eintrag auf.

Der Eigentümer wird von `contexts/armylist/model/index.js` nicht exportiert, aber nichts hindert
daran, ihn zu importieren: dieser Index nennt sich selbst *„eine Bequemlichkeits-Sammlung, keine
erzwungene Fassade"* (Zeile 14), und die Oberfläche importiert bereits sechs Module direkt aus
`application/`. Es hat schlicht niemand nachgesehen. Genau das macht die Behebung billig.

**Warum das hier zählt**

Zwei Kopien stimmen heute überein, eine tut es schon nicht mehr. Ein verbündetes Kontingent ohne
eigenes Armeebuch bekommt im Auffüll-Panel einen anderen Katalog als im Aushebe-Dialog — dieselbe
Einheit, gegen zwei Bücher aufgelöst, in zwei benachbarten Teilen eines Bildschirms.

**Behebung**

`catalogueIdOfForce` aus dem armylist-Index exportieren und an beiden Stellen importieren. Danach
den dritten Rückfall ausdrücklich entscheiden: entweder gehört `activeCatalogue?.id` für alle in die
Regel, oder er ist im Auffüll-Panel falsch. Nicht als stille dritte Variante stehen lassen.

**Aufwand:** eine Stunde, dazu die eine Entscheidung.

---

### 4. Der Umbenennungs-Anwendungsfall hat keinen Produktions-Aufrufer

- **Schwere:** mittel
- **Sicherheit:** hoch
- **Symptom:** Fachlogik in der Anwendungsschicht am Modell vorbei; eine Regel gilt nur auf einem Weg
- **Fundstelle:**
  - `src/contexts/armylist/application/renameRoster.js:13` — der Anwendungsfall
  - `src/ui/viewmodels/rosterCommandBindings.js:78` — der einzige Aufrufer, selbst unerreicht
  - `src/ui/viewmodels/useRosterList.js:193-197` — die lebende Umbenennung
- **Ausmaß:** ein Anwendungsfall, null Produktions-Aufrufer; eine Umgehung, die eine Regel trägt,
  die dem Anwendungsfall fehlt.

**Was dasteht**

`renameRoster(roster, newName)` ist ein benannter Anwendungsfall mit eigener Testdatei. Er wird
einmal aufgerufen, von `updateRosterName` in `rosterCommandBindings.js:78`, das über
`useRosterState:140` und `rosterContexts.jsx` durchgereicht wird — und von **keiner Komponente**
gerufen wird. Ein `grep` über `src/ui/` nach `updateRosterName` liefert die beiden Verdrahtungsmodule
und sonst nichts; jeder verbleibende Treffer ist ein Test.

Die Umbenennung, die ein Nutzer tatsächlich auslösen kann, ist diese:

```js
// useRosterList.js:193-197
const renameRoster = async (roster, newName) => {
  const trimmed = (newName || '').trim();
  if (!trimmed || trimmed === roster.name) return;
  await saveRoster({ ...roster, name: trimmed });
```

Hier wohnen zwei Regeln, die der Anwendungsfall nicht kennt: Namen werden getrimmt, und ein leerer
oder unveränderter Name ist kein Schreibvorgang. `knip` fängt den toten Pfad nicht — es ist
warn-only und liegt per Entscheidung außerhalb der Wrapper (`.claude/rules/forge.md`).

**Warum das hier zählt**

Das eine Verhalten, das das Schreibmodell für das Umbenennen besitzt, ist unerreichbar, und die
beiden Regeln, die das Umbenennen tatsächlich bestimmen, sitzen in einem React-Hook. Wird der
Editor-Weg irgendwann verdrahtet, erzeugt er ungetrimmte Namen und schreibt bei jedem Tastenanschlag
— und der Unterschied wird wie ein Oberflächenfehler aussehen.

**Behebung**

Entscheiden, welcher Weg überlebt. Entweder `updateRosterName` samt Kette löschen und Trimmen und
No-op-Wächter nach `renameRoster` holen — dort ist „der Name einer Liste ist getrimmt und nie leer"
eine Regel des Modells — und `useRosterList` ihn rufen lassen; oder den Editor-Weg verdrahten und
ihm dieselbe Regel geben. Das erste ist kleiner und entspricht dem, was das Produkt heute tut.

**Aufwand:** zwei bis drei Stunden.

---

### 5. Die kontextübergreifende Löschregel wohnt in einem React-ViewModel

- **Schwere:** mittel
- **Sicherheit:** hoch
- **Symptom:** eine Policy, die niemand aufzählen kann, in der Kompositionswurzel
- **Fundstelle:**
  - `src/ui/viewmodels/useRosterList.js:177-191` — die von Hand sequenzierte Regel
  - `src/shared/events/dataEvents.js:32` — `ROSTER_DELETED`, das es dafür gibt
  - `src/contexts/armylist/application/rosterStore.js:53` — wo es gemeldet wird
  - `src/ui/viewmodels/useAppData.js:175` — der einzige Abonnent, und der zieht nur den Anzeigestand nach
- **Ausmaß:** eine Policy, eine Stelle, kein Abonnent.

**Was dasteht**

```js
// useRosterList.js:182-189
await deleteRoster(id);
// Eine Partie ohne Liste hat keinen Gegenstand …
await endGame(id);
reloadData();
} catch (err) { … showToast(…); }
```

Die beiden Kontexte sind richtig getrennt und richtig nur über `rosterId` gekoppelt
(`play/model/game.js:7-8`). Die Regel, die sie verbindet — *das Löschen einer Liste beendet ihre
Partie* —, steht weder in `armylist` noch in `play`. Sie sind zwei `await` in einem Hook, in der
Reihenfolge, in der sie zufällig geschrieben wurden. Ein `ROSTER_DELETED`-Ereignis existiert bereits
und wird bereits gemeldet; `play` abonniert es nicht.

Zwei Folgen, und es lohnt sich, genau zu sein, welche davon echt ist. Scheitert `endGame`, oder wird
der Tab zwischen den beiden `await` geschlossen, ist die Liste weg und der Partie-Datensatz
verwaist: das `catch` zeigt einen Toast, nichts wiederholt es, und beim Start räumt nichts verwaiste
Datensätze weg — `migrateStoredGames` (`gameStore.js:71`) holt nur den alten `gameState` herüber. In
dieser App leckt das einen kleinen Datensatz und beschädigt nichts, denn Ids sind frische UUIDs. Der
echte Preis ist der andere: die Regel ist unsichtbar. Niemand kann die Policies dieses Systems
aufzählen, weil es keinen Ort gibt, an dem sie stehen.

**Warum das hier zählt**

`play` wurde in einen eigenen Kontext gezogen, um eine eigene Lebensdauer zu haben. Eine
Lebensdauer-Regel, die im Aufrufer beider Kontexte wohnt, ist genau das, was diese Trennung
verhindern sollte — und der nächste Löschweg (ein Sammellöschen, ein „alles zurücksetzen" in den
Einstellungen) wird sie nicht mitbringen.

**Behebung**

`play` in seiner eigenen Anwendungsschicht auf `ROSTER_DELETED` abonnieren und `endGame` von dort
rufen; den zweiten `await` aus dem ViewModel streichen. Vorher zu wissen: `emitDataChange` stellt
synchron zu und schluckt den Wurf eines Verbrauchers (`dataEvents.js:62-68`), ein asynchroner
Abonnent muss seine eigene Ablehnung also selbst fangen — der Kanal tut es nicht. Das ist der ganze
Entwurf dieser Änderung, und er ist klein.

**Aufwand:** ein halber Tag.

---

### 6. Das Prädikat „ist das ein Aufwertungs-Profil", dreimal geschrieben, über freiem Text

- **Schwere:** mittel
- **Sicherheit:** hoch
- **Symptom:** ein unbenannter Fachbegriff; dieselbe Regel mehrfach umgesetzt
- **Fundstelle:**
  - `src/ui/viewmodels/editor/upgradeDetailElements.js:58-62` — einmal benannt, als `isUpgradeProfile`
  - `src/ui/viewmodels/editor/optionRowDerivations.js:90-91` — ausgeschrieben
  - `src/ui/viewmodels/editor/useUnitChips.js:139-140` — ausgeschrieben
  - `src/contexts/armylist/model/constants.js:2-19` — die vier Stichwort-Tabellen
  - `src/contexts/armylist/model/profileGrouping.js:15-21` — der Modell-Profil-Zwilling derselben Idee
  - `src/contexts/armylist/model/constants.js:21-24` — der Kommentar, der das für abgeschafft erklärt
- **Ausmaß:** vier Stichwort-Tabellen, fünf lesende Stellen, drei davon dasselbe Prädikat.

**Was dasteht**

Ob ein Profil als Aufwertung zählt, entscheidet ein Teilstring-Vergleich des freien Autorentextes
gegen eine fest verdrahtete zweisprachige Stichwortliste:

```js
// constants.js:14
export const UPGRADE_DETAILS_KEYWORDS = ['weapon', 'magic', 'items', 'rüstung', 'waffe'];
```

`upgradeDetailElements.js:59` gibt diesem Prädikat einen Namen. Die beiden anderen Stellen schreiben
es erneut aus:

```js
const typeLower = element.profileTypeName?.toLowerCase() || '';
if (!UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) continue;
```

Unmittelbar unter den Tabellen steht die Entscheidung, die sie hätte entfernen sollen:

> *„ADR-0034 ordnet systemgebundene Sonderfälle und Stichwort-Heuristiken weder der Engine noch dem
> Bericht zu — sie werden am Datenfehler im Katalog-Fork behoben."* (`constants.js:21-24`)

Die Tabellen, die dieser Kommentar für abgeschafft erklärt, sind die achtzehn Zeilen über ihm.

**Warum das hier zählt**

Ein englisch-deutscher Teilstring-Vergleich über vom Autor vergebene Namen ist ein Raten. Ein
Profiltyp namens `Magic Standard` trifft auf `magic`; `Armour` trifft weder `rüstung` noch `armour`
(das steht in der *Modell-Profil*-Ausschlussliste, nicht in dieser). Weil an drei Stellen geraten
wird, erreicht eine Korrektur einen Bildschirm und die anderen nicht — und weil dieselbe Idee in
`profileGrouping.js:15-21` eine zweite, anders geschriebene Umsetzung hat, wird die fünfte Stelle
später gefunden als die ersten vier.

**Warum das trotz Supporting-Bereich ein Befund ist:** es ist keine gewollte Einfachheit. Der Begriff
hat einen Namen in der Domäne, der Code sagt das, und eine der drei Stellen hat ihm diesen Namen
bereits gegeben. Die Doppelung einer *benannten* Regel ist bei jedem Subdomain-Typ ein Defekt.

**Behebung**

Zwei Schritte, in dieser Reihenfolge. Erstens: `isUpgradeProfile` aus `contexts/armylist/model/`
exportieren und alle drei Stellen es rufen lassen — das allein tötet das Auseinanderlaufen und
kostet eine Stunde. Danach die zweite Frage entscheiden, die der Kommentar längst beantwortet hat:
ob die *Art* eines Profils überhaupt ein Stichwort-Raten sein soll oder eine Tatsache, die der
Katalog-Fork deklariert. Im zweiten Fall entfallen die Tabellen und mit ihnen dieser Befund.

**Aufwand:** eine Stunde für den ersten Schritt; der zweite ist eine Katalogdaten-Frage, keine
Code-Frage.

---

### 7. Benachbarte gleichtypige String-Parameter, die vertauscht stumm scheitern

- **Schwere:** mittel
- **Sicherheit:** hoch — beim Schreiben dieser Prüfung versehentlich reproduziert
- **Symptom:** Primitive Obsession an der Modelloberfläche
- **Fundstelle:**
  - `src/contexts/ruleengine/acl/evaluationCache.js:134` — `evaluateAppRoster(system, roster)`
  - `src/contexts/armylist/model/catalogResolver.js:128` — `findEntryInSystem(system, entryId, catalogueId)`
  - `src/contexts/armylist/model/selectionMembers.js:39` — `findMemberDefById(def, defId, resolveGroupDef, targetDefId)`
  - `src/contexts/ruleengine/readmodel/slotIndex.js:60` — `isDirectChildPath(path, parentPath)`
  - `src/contexts/ruleengine/readmodel/listRuleGroups.js:65` — `resolveListRuleGroupFromReport(slots, forcePath, categoryId)`
  - `src/contexts/armylist/application/raiseUnit.js:70` — `raiseMembersInForce(slots, forceId, defId)`
- **Ausmaß:** 12 exportierte Funktionen unter `src/contexts/` nehmen zwei oder mehr gleichtypige
  String-Parameter, ausgezählt über alle 183 Produktionsmodule.

**Was dasteht**

Jeder Bezeichner des Modells ist ein nackter `string`: `Selection.id`, `selectionEntryId`,
`entryLinkId`, `forceEntryId`, `catalogueId`, `costLimitType`, dazu der Slot-`path` des Berichts
(`shared/rostermodel/types.js:9-38`). Wo zwei davon in einer Signatur nebeneinanderstehen, ist die
falsche Reihenfolge kein Typfehler — und, was mehr wiegt, auch kein Laufzeitfehler.

Ich habe das ungewollt reproduziert. Beim Schreiben der Sonde für Befund 1 rief ich
`evaluateAppRoster(roster, system)`. Es warf nicht. Es lieferte `EMPTY_RESULT`
(`evaluationCache.js:84-91`): einen vollständigen, korrekt geformten Bericht mit `violations: []`,
`costTotals: {}` und `diagnostics: []`. Ein vertauschter Aufruf und eine regelkonforme Armee sind
derselbe Wert.

Alle acht Produktions-Aufrufstellen von `evaluateAppRoster` übergeben die richtige Reihenfolge, es
gibt also keinen lebenden Fehler — der Befund ist das Versagensmuster, nicht ein Ausfall.

**Warum das hier zählt**

„Keine Verstöße" ist der folgenreichste Satz dieser App. Ihn aus einem fehlerhaften Aufruf zu
erzeugen, ohne Diagnose, ist dieselbe Art von Falschheit wie Befund 1, nur aus einer anderen
Richtung. `findEntryInSystem` verhält sich genauso: vertauscht man seine beiden Ids, liefert es
nichts, und das `?? null` des Aufrufers macht daraus „diesen Eintrag gibt es nicht".

**Behebung**

Keine gebrandeten Typen über die ganze Codebasis — das ist eine große Änderung für einen kleinen
Ertrag in JSDoc-typisiertem JavaScript. Stattdessen zwei billige Dinge. `evaluateAppRoster` einen
Wächter geben, der „kein Datensatz" von „falsches Argument" trennt: `system?.rawXmls` fehlt an einem
Roster, eine Zeile trennt die beiden Fälle und kann eine Diagnose melden statt einen sauberen
Bericht zurückzugeben. Und wo zwei Ids in einer Signatur nebeneinanderstehen, ein Objekt nehmen:
`findEntryInSystem(system, { entryId, catalogueId })` lässt sich nicht vertauschen. Für neue
Signaturen und die sechs oben genannten anwenden, den Rest lassen.

**Aufwand:** ein Tag, verteilt.

---

### 8. `rulebook` ist eine Übersetzungsschicht in den Kleidern eines Bounded Context

- **Schwere:** gering
- **Sicherheit:** hoch
- **Symptom:** anämischer Bounded Context — als ACL zulässig, dann aber auch so benennen
- **Fundstelle:** `src/contexts/rulebook/rulesLookup.js:1-64`, `synonyms.js:1-20`
- **Ausmaß:** 84 Zeilen; der ganze Kontext.

**Was dasteht**

`rulebook` hält die Basis-URL einer fremden Website (`rulesLookup.js:4`), eine
Namensnormalisierung, die deren typografische Eigenheiten aufsaugt (`normalizeName:16-21`), ein
Fraktions-Suffix-Muster, das deren Eindeutigmachungs-Schema entziffert (Zeile 9), und eine
Synonymtabelle aus 19 Zeilen, die Katalognamen auf die Schreibweisen dieser Seite abbildet —
*„Immune to Psycology" → „Immune to Psychology"*.

Das ist eine Anti-Corruption Layer, und eine gute: das fremde Vokabular endet hier und erreicht das
Modell nie. Aber es ist wie ein Kontext geschnitten — flach, ohne `model/`, `application/`, `ports/`
oder `acl/`, anders als alle vier Geschwister — und `.cast/rules.json` gibt ihm eine
`kontext-intern-rulebook`-Regel, als hätte es Inneres zu schützen. Es hat eine Art Invariante
(„a genuine collision is left unresolved rather than guessed", Zeilen 26-28) und sonst kein
Verhalten.

**Warum das hier zählt**

Nur mild, und die Substanz stimmt bereits. Der Preis ist, dass die Kontextliste sich wie fünf
Gleiche liest, wo es vier Kontexte und einen Adapter sind — und dass der nächste Leser in
`rulebook/` nach Fachverhalten sucht, das dort nicht ist.

**Behebung**

Beim Namen nennen, was es ist: `src/contexts/rulebook/acl/`, oder neben die anderen
Übersetzungsschichten verschieben. Ein Satz im Modulkopf, der es als ACL gegen `6th.whfb.app`
benennt, trüge den größten Teil des Nutzens schon allein.

---

### 9. Die whfb6-Einstellung wohnt in einem Kontext, der sie nie liest

- **Schwere:** gering
- **Sicherheit:** hoch
- **Symptom:** ein Kontext besitzt einen Begriff, für den er keinen Grund hat
- **Fundstelle:**
  - `src/contexts/armylist/application/settings.js:1-40`
  - `src/contexts/armylist/ports/storagePort.js:15-17`
  - `src/ui/viewmodels/useRuleUrl.js:16-19`, `src/ui/components/SettingsDialog.jsx:13` — die Verbraucher
- **Ausmaß:** eine Einstellung, zwei Verbraucher, keiner in `armylist`.

**Was dasteht**

Ob Regel-Chips nach `6th.whfb.app` verlinken, wird von der Anwendungsschicht des Kontexts `armylist`
gespeichert und gemeldet, und sein Port reicht dafür drei Symbole aus der Plattform durch. Kein
Modul unter `src/contexts/armylist/` liest den Wert. Beide Verbraucher stehen anderswo: `useRuleUrl`,
was `rulebook`-Sache ist, und der Einstellungsdialog.

Der Kommentar des Moduls erklärt seinen Zuschnitt ehrlich — eine Einstellung, keine generische
Schlüssel/Wert-Fassade, *„würde nur Vorrat bauen"* (`settings.js:11-14`) —, und dieses Urteil ist
richtig. Falsch ist nur die Adresse.

**Warum das hier zählt**

Eine Armeeliste hat keine Meinung zu ausgehenden Links. Die Einstellung sitzt in `armylist`, weil
dieser Kontext bereits einen Speicher-Port hatte — und genau so sammeln Kontexte Begriffe an, die
ihnen nicht gehören.

**Behebung**

Stehen lassen, bis eine zweite Einstellung kommt — das ist der ehrliche Auslöser. Wenn sie kommt,
den Einstellungen ein eigenes kleines Anwendungsmodul außerhalb der vier Fachkontexte geben, statt
`armylist/application/settings.js` wachsen zu lassen.

---

### 10. Die eine kontextübergreifende Kante ist von einer Regel verboten, die nach ihrer Abwesenheit heißt

- **Schwere:** gering
- **Sicherheit:** mittel — die Code-Tatsachen stehen fest; ich konnte `cast` nicht ausführen, um zu
  bestätigen, wie es die Überschneidung auflöst (siehe *Nicht beurteilt*)
- **Symptom:** eine maschinell durchgesetzte Regel behauptet eine Grenzeigenschaft, der der Code widerspricht
- **Fundstelle:**
  - `src/contexts/armylist/application/mandatoryListRules.js:28` — die Kante
  - `.cast/rules.json` — `roster-keine-evaluator-abhaengigkeit` (`armylist/**` → `ruleengine/**`)
    und `kontext-kein-fremder-kontext` (`kontexte` → `kontexte`), beide verbieten sie
  - `.cast/rules.json` — `lesemodell-die-eine-tuer` (`**` → `readmodel-fassade`), erlaubt sie
- **Ausmaß:** eine Kante, die einzige ihrer Art in der Codebasis.

**Was dasteht**

`armylist` importiert `findMissingMandatoryListRules` aus dem Lesemodell der Regel-Engine. Die
Beziehung ist stimmig und gewollt: `armylist` ist stromabwärts **Customer** der Published Language
von `ruleengine`, und der Zustand selbst wird weiterhin als Argument hereingereicht, wie ADR-0039 es
verlangt (`applyMandatoryListRules(roster, { system, slots })`, Zeile 44) — importiert wird allein
die Funktion.

Das Problem ist, was die Regeln darüber sagen. Eine Regel, die wörtlich *roster hat keine
Evaluator-Abhängigkeit* heißt, verbietet die Kante; die Kante existiert; und eine breitere
Erlaubnis deckt sie, sodass der Widerspruch nie auffällt. Wer den Regelnamen glaubt, schließt, die
beiden Kontexte seien unabhängig. Sie sind es nicht, und sie sollten es nicht sein.

**Behebung**

Die Regel auf das umbenennen, was wahr ist — die Abhängigkeit ist erlaubt und geht allein durch die
eine Tür des Lesemodells —, oder sie auf `src/contexts/armylist/** → src/contexts/ruleengine/engine/**`
verengen, was die tatsächlich verbietenswerte Kante ist. So oder so: die Beziehung als
Customer/Supplier-Kante aufschreiben. Es ist die einzige, die das System hat, was sie billig zu
benennen und wertvoll richtig zu benennen macht.

---

## Priorisierung

### Jetzt beheben

| # | Befund | Aufwand | Erster Schritt |
|---|---|---|---|
| 1 | Negative Anzahl überlebt den `.ros`-Import | ~1 h | In `rosterSerialization.js:361` klemmen; die Fälle `number="-2"` und `number="0"` in die bestehende Testdatei aufnehmen |
| 3 | Drei Kopien der Kontingent-Katalog-Regel | ~1 h | `catalogueIdOfForce` aus dem armylist-Index exportieren und an beiden UI-Stellen importieren |
| 4 | Toter Umbenennungs-Anwendungsfall, vom lebenden Weg umgangen | ~3 h | Entscheiden, welcher Weg überlebt; Trimmen und No-op-Wächter nach `renameRoster` holen |
| 2 | Zwei uneinige Kostenart-Eigentümer | 1–2 d | `parseCatalogueXML` `<costTypes>` lesen lassen; danach den Zwilling im Lesemodell löschen |

Befund 2 ist größer als die anderen drei und gehört trotzdem hierher: er ist heute auf
mitgelieferten Katalogdaten falsch und räumt zugleich einen Verstoß gegen `docs/glossary.md` weg.

### Einplanen

| # | Befund | Aufwand | Was zuerst entschieden werden muss |
|---|---|---|---|
| 5 | Löschregel im React-ViewModel | ~0,5 d | Abonniert `play` das Ereignis `ROSTER_DELETED`, oder orchestriert ein Anwendungsfall beide? Dazu: wie ein asynchroner Abonnent sein eigenes Scheitern meldet, denn der Kanal schluckt es |
| 6 | Aufwertungs-Prädikat dreimal geschrieben | ~1 h + Daten | Bleiben Profilarten ein Stichwort-Raten, oder deklariert der Katalog-Fork sie? `constants.js:21-24` beantwortet das bereits; der Code ist nicht gefolgt |
| 7 | Stumm vertauschbare String-Parameter | ~1 d | Wie weit — die beiden billigen Maßnahmen, oder typisierte Bezeichner über das Modell |

### Beobachten

| # | Befund | Wieder ansehen, wenn |
|---|---|---|
| 8 | `rulebook` als Kontext geschnitten | es über eine Nachschlagetabelle hinauswächst oder eine zweite fremde Seite dazukommt |
| 9 | Einstellung im falschen Kontext | eine zweite App-Einstellung dazukommt |
| 10 | Regelname widerspricht der einen Kontextkante | eine zweite Kontextkante vorgeschlagen wird — vorher muss die Regel stimmen |

### Angenommene Abwägungen — nicht neu aufrollen

| Entscheidung | Wo sie im Code steht | Warum sie hier richtig ist |
|---|---|---|
| Zwei XML-Parser, App und Engine | `engine/catalogReader.js:1-6` (ADR-0030) | Die Unabhängigkeit des Reinraum-Evaluators ist der Sinn der Sache. Befund 2 spricht nicht dagegen; die Behebung bleibt innerhalb der Trennung. |
| Kein optimistisches Sperren an irgendeinem Aggregat | `platform/persistence/database.js` — ein Browser, ein Nutzer | Es gibt keinen zweiten Schreiber. Ein Versionsfeld bewachte nichts. |
| `armylist` als Daten plus reine Funktionen statt Klassen mit Methoden | `shared/rostermodel/types.js`, `application/*.js` | Für eine Supporting Subdomain richtig. Siehe *Keine Befunde*. |
| `dataEvents` benennt Speicher-Tatsachen, keine Fach-Tatsachen | `shared/events/dataEvents.js:1-23` | Es ist als Änderungskanal der Datenschicht ausgewiesen, nicht als Domänenereignis. Das ist die dokumentierte Ausnahme. |
| Der armylist-Index ist eine Bequemlichkeits-Sammlung, keine erzwungene Fassade | `contexts/armylist/model/index.js:14-16` | Gewollt. Genau deshalb ist Befund 3 eine Stunde Arbeit und kein Umbau. |
| `measure: true` als die eine Unreinheit einer reinen Engine | `contexts/ruleengine/evaluator.js:37-49` | Benannt, opt-in, ein Verbraucher. |

---

## Nicht beurteilt

| Bereich | Warum | Was es bräuchte |
|---|---|---|
| Ob `cast check` die Kante aus Befund 10 tatsächlich durchlässt | `cast` ist ein Plugin, nicht auf npm, und in diesem Container nicht installiert | `npm run cast` lokal laufen lassen oder die Ausgabe des Lint-Jobs in CI lesen |
| Änderungskopplung über die Grenzen (welche Dateien sich gemeinsam ändern) | Der Klon hat hier keine nutzbare Historientiefe | `git log --numstat` über einen vollen Klon, paarweise über die obersten Module |
| Ob `play` eine zweite Core Subdomain sein sollte | Das ist eine Produktfrage, keine Codefrage | Die Antwort des Teams auf „warum wählen Leute diese App" |
| Die 128 Evaluator-Szenarien als Fachdokumentation | Außerhalb des Umfangs einer reinen Code-Prüfung; sie sind Fixtures unter `docs/testing/` | Ein Durchgang über die `scenario.json`-Manifeste gegen die Regeln, die sie festzunageln behaupten |
| Laufzeitverhalten im Browser | Kein App-E2E gelaufen (`node e2e/ui.test.js` liegt außerhalb von `forge-test`) | Ihn laufen lassen; die Befunde 1 und 2 haben sichtbare Folgen in der Oberfläche |

---

## Keine Befunde

Hier festgehalten, damit sie niemand später nachträgt.

| Beobachtung | Warum das kein Befund ist |
|---|---|
| `armylist` hat kein reiches Aggregat — `Roster`, `Force` und `Selection` sind JSDoc-Typedefs über einfachen Objekten, das Verhalten steht in reinen Funktionen | Supporting Subdomain. Gewollte Einfachheit ist hier richtig, und der funktionale Stil ist durchgehend angewandt und gut getestet. Nur die *eine* nicht durchgesetzte Invariante aus Befund 1 ist ein Defekt, und sie ist genau als solche gemeldet, nicht als Anämie. |
| `dataEvents` führt `ROSTER_SAVED`, `SYSTEM_IMPORTED`, `SETTINGS_CHANGED` — CRUD-förmige Namen mit ganzen Objekten als Nutzlast | Ein Änderungsstrom, ausdrücklich als der der Datenschicht ausgewiesen und nicht als Domänenereignis ausgegeben (`dataEvents.js:1-23`). Das ist die dokumentierte Ausnahme, und die Auszeichnung stimmt. |
| Kein Event Sourcing, keine CQRS-Schreibseite, keine Specification-Objekte, keine Repository-Interfaces in einem `domain/`-Ordner | Das Fehlen eines Musters ist kein Defekt. Das Lesemodell unter `ruleengine/readmodel/` ist eine echte CQRS-Leseseite und genügt. |
| `ui` ist mit 9 478 Zeilen größer als vier der fünf Kontexte | Es ist die Kompositionswurzel, kein Kontext, und die Schichtgrenze wird in beide Richtungen maschinell gehalten. Größe allein ist kein Befund. |
| `withAdjustedTracker(game, field, delta)` adressiert `'round'\|'vp'\|'cp'` als String-Schlüssel | JSDoc-typisierte Union, ein Aufrufweg, drei Felder. Real, aber zu klein zum Einplanen. |
| Deutsche Kommentare über englischen Bezeichnern | Eine getroffene Entscheidung (`docs/glossary.md`, *„The German prose keeps its vocabulary"*), und die Zuordnungstabelle existiert. |
| Testabdeckung in Prozent | Nicht gemessen und hier nicht nützlich. Stattdessen ist benannt, *was* ungetestet ist: die `.ros`-Importgrenze aus Befund 1. |

---

## Verhältnis zu den beiden früheren Durchgängen

Diese Prüfung ist aus dem Code geschrieben worden, ohne sie zu Rate zu ziehen, und erst danach
verglichen. Der Vergleich ist kurz und gehört festgehalten.

Die Befunde **1, 2 und 5** landen auf Boden, den die Issues
[0199](issues/0199-roster-invariants-at-the-write-seams.md),
[0195](issues/0195-one-cost-type-rule-and-a-budget-value-in-the-shared-kernel.md)/[0201](issues/0201-ros-export-omits-catalogue-declared-cost-types.md)
und [0193](issues/0193-roster-deletion-becomes-a-domain-event-in-the-play-context.md) bereits
beschreiben — alle drei weiterhin `status: backlog`. Sie unabhängig wiederzufinden ist eine
Bestätigung, und dieser Durchgang legt die ausgeführten Belege dazu, ohne die sie argumentiert
wurden: die `costTotals: {"pts":-200}` bei `violations: []`, und die beiden Kostenart-Eigentümer,
die auf dieselbe Eingabe `null` und `cat-pts` antworten — auf einem Katalog, der in diesem
Repository mitgeliefert wird.

Die Befunde **3, 4, 6, 7, 8, 9 und 10** sind neu.

Neun Issues aus den August-Durchgängen (0193–0202) stehen offen. Die ehrliche Lesart ist: die
Engstelle dieser Codebasis ist nicht die Diagnose — sie hatte drei —, sondern dass die
diagnostizierte Arbeit nicht getan wird. Eine vierte Prüfung wäre Verschwendung. Die vier Punkte
unter *Jetzt beheben* summieren sich auf rund zwei Tage.
