---
status: active
branch: claude/metis-installieren-3kgqdl
pr:
---

# Pflichtgrenze am entryLink zählt ihre eigene Auswahl nicht

## Intent

Eine Grenze, die nicht an der Auswahl-Definition, sondern an dem `entryLink`
deklariert ist, der sie hereinzieht, zählt die eigene Auswahl nicht mit. Sie
meldet eine Pflicht als unerfüllt, obwohl die Auswahl im Roster gesetzt ist.

Ursache an den Daten: Ein Roster benennt eine so bezogene Auswahl mit zwei Ids
— `entryId` (das Ziel) und `entryLinkId` (der Verweis). Der Zählindex
registriert die Instanz unter der Ziel-Id, die Grenze fragt aber nach der
Link-Id. Ergebnis: Ist 0 gegen `min 1`.

Zwei belegte Fälle, beide aus `Mercenaries (…).cat`, beide `min` /
`scope="parent"`:

| Grenze | Deklariert an | Beobachtet |
|---|---|---|
| `dfd9-3e46-eda5-be8b` (min 1 *Hand Weapon*) | `entryLink b581-8a9e-9d0c-b7c8`, Z. 7462–7464 | Ist 0 / Grenze 1 |
| `feb1-c10d-9318-dbda` (min 1 *Light Armour*) | `entryLink d3dc-56c1-9565-889a`, Z. 4352–4354 | Ist 0 / Grenze 1 |

Die beiden Ids sind im Szenario `modifier-characteristic-value` aus der
`absent`-Liste entfernt und bewusst **nicht** nach `firing` verschoben — das
würde das falsche Verhalten als gewollt festschreiben. Das Manifest macht über
sie derzeit also schlicht keine Aussage; diese Lücke schließt erst dieser Fix.

Acceptance criteria:

1. Eine am `entryLink` deklarierte Grenze zählt die über diesen Verweis
   gesetzte Auswahl mit.
2. Die beiden belegten Fälle (*Hand Weapon*, *Light Armour*) melden keine
   Pflichtverletzung mehr.
3. Das Szenario `modifier-characteristic-value` nimmt beide Ids wieder in
   seine Erwartung auf.
4. Die übrige E2E-Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt —, und jede geänderte Erwartung ist einzeln begründet.
5. *(mitten im Lauf ergänzt, nachdem Review-Runde 2 eine Regression durch den
   eigenen Fix fand — siehe Log.)* Zeigen zwei Verweise unter demselben
   Eltern-Knoten auf dasselbe Ziel, zählt eine am Ziel deklarierte Grenze die
   Auswahlen beider Verweise zusammen. Ein Szenario an echten Katalogdaten
   hält das fest.

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/76-pflichtgrenze-am-entrylink-zaehlt-ihre-eigene-auswahl-nicht/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Nebenbefund beim E2E-Szenario `modifier-characteristic-value`
  (Alt-Issue 75, Slice 04); dort ausführlich dokumentiert. Nicht in einen
  laufenden Slice von 75 aufgenommen, weil die Behebung die Verletzungsliste
  an mehreren Stellen der Suite ändert.
- **Zweite Fundstelle derselben Wurzel, gefunden in Slice 75/07:** Der
  `.ros`-Leser der Testumgebung (`src/evaluator/__fixtures__/rosParser.js`)
  bindet eine Auswahl allein über `entryId` und ignoriert `entryLinkId`. Alles,
  was am `<entryLink>` selbst deklariert ist, gilt damit im Test nie — im
  Widerspruch zu `report.js`, das den Verweis-Slot ausdrücklich den Verweis
  tragen lässt. Belegt an `Ogre Kingdoms (6th definitive edition).cat:3165`:
  dort gewährt Verweis `d82e` „Bully Bully" bedingungslos. Betrifft 13 von 102
  vorhandenen Rostern in 4 Szenarien. Wer diese Grenze behebt, sollte beide
  Stellen zusammen anfassen: Engine-Zählung und Roster-Adapter benennen eine
  Auswahl nur dann gleich, wenn beide Ids tragen.
- **Verwandt mit `078`** (verlinkter Eintrag zählt nicht unter seinem Typ):
  beide fragen, unter welchen Ids ein über einen Verweis gesetztes Vorkommen
  zählbar ist. Zusammen anzufassen ist vermutlich billiger als nacheinander.
- **Die Wurzel liegt an der Naht, nicht in der Zählschicht** (Recherche, mit
  Reproduktion belegt). `countIndex.targetsOf` ist bereits verweis-fähig: ist
  die Definition eines Knotens der `entryLink`, zählt er unter Link-Id *und*
  Ziel-Id (`node.def.id`, `node.def.targetId`). Der Knoten trägt aber nie die
  Link-Definition, weil der Roster-Adapter
  (`src/evaluator/__fixtures__/rosParser.js`) eine `<selection>` allein über
  `entryId` bindet und `entryLinkId` wegwirft. Der Verbund
  (`evalTree.attachInstance` → `resolved.lookup(instance.defId)`) kann die
  verlorene Information nicht erfinden.
- **Entscheidung: der Fix sitzt im Adapter, nicht in der Engine.** Eine
  `<selection>` mit `entryLinkId` wird an die Link-Definition gebunden; fehlt
  das Attribut, bleibt es bei `entryId`. Quelle: der Berichtsvertrag in
  `report.js` verlangt genau das — „ein Angebots-Anker den `entryLink`, nicht
  den Eintrag (nur so gelten die am Verweis deklarierten Grenzen)". Der
  Adapter widersprach diesem Vertrag; der `.ros` trägt beide Ids gerade
  deshalb.
- **Verworfen: die Link-Id zusätzlich am Knoten mitführen** (`defId` bleibt
  `entryId`, `targetsOf` bekommt die Link-Id dazu). Damit wäre die Grenze zwar
  nicht mehr verletzt, aber auch nie ausgewertet: `limitsOf(node.def)` läse
  weiter nur die Ziel-Definition, die am Verweis deklarierten Grenzen fielen
  still weg. Für eine `max`-Grenze am Verweis wäre das fail-open — schlechter
  als der jetzige Fehler.
- **Kein Versions-Bump vorgeschlagen.** Die Regel in `CLAUDE.md` knüpft den
  Bump an eine Änderung, die ein Nutzer sehen kann. `src/evaluator/` ist bis
  zum Cutover nicht an die App verdrahtet (ADR 0030) — importiert wird es nur
  von den eigenen Tests. Der Fix ändert damit nichts Sichtbares. Die
  Entscheidung liegt beim Menschen; ohne Widerspruch bleibt die Version.
- **Kein Auftrag an den `e2e-testcase-author`.** Es entsteht kein neues
  Szenario; zwei Ids kehren in die Erwartung eines bestehenden zurück. Die
  Erwartung ist aus den Katalogdaten begründet (beide Grenzen sind `min 1`,
  die Auswahl steht im Roster ⇒ keine Verletzung), nicht aus der
  Engine-Ausgabe abgelesen — die Trennung aus ADR 0033 bleibt gewahrt.

## Log

- Run gestartet. Der Branchname stammt nicht aus diesem Issue: die
  Cloud-Session ist fest auf `claude/metis-installieren-3kgqdl` verdrahtet und
  darf nirgends sonst hin pushen. Ein Issue = ein Branch = ein PR gilt
  weiterhin, nur trägt der Branch hier einen fremden Namen.
- Fakten werden zuerst erhoben (`researcher`), bevor Kriterium 1 in Tests
  gegossen wird.
- **Wegwerf-Spike, vor der Umsetzung, wieder zurückgenommen.** Eine Sonde
  wertete alle 100 Roster aller 29 Szenarien aus und verglich Verletzungen,
  Diagnosen und Slotzahl vor und nach der einzeiligen Adapter-Änderung:
  - Verletzungen 871 → 866; geändert **nur** die drei im Issue benannten
    Roster;
  - kein einziges Roster mit geänderter Diagnoseliste (insbesondere keine neue
    `unresolvedDefinition` — die Link-Ids lösen alle auf). Die absolute
    Diagnosezahl, die hier zuerst stand (7832), war ein Artefakt der Sonde:
    sie zählte über 100 Manifest-Einträge statt über alle 104 Läufe. Der
    Review hat unabhängig 7610 → 7610 über die 100 eindeutigen Dateien bzw.
    8009 über alle 104 Läufe gemessen; die tragende Aussage — keine geänderte
    Liste — reproduziert exakt;
  - Slotzahl geändert nur in denselben drei Rostern: der falsche
    Pflicht-Phantomslot verschwindet.
- **Der Fehler erzeugt eine Doppelmeldung, die das Issue nicht kennt.** Neben
  `dfd9`/`feb1` feuert `bdef-ba9b-d6ce-5b14` — die *eigene* `min 1` des
  Ziel-Eintrags — ein zweites Mal am Phantom, obwohl sie am realen Knoten
  erfüllt ist. Betrifft Roster 01 und 02. Dieselbe Wurzel, deshalb im selben
  Schnitt; die Erwartung nimmt sie mit auf. Achtung: `bdef` feuert in anderen
  Szenarien an anderen Ankern **zu Recht** — sie darf nicht pauschal in
  `absent`, nur in diesen beiden Rostern.
- **Test zuerst, rot gesehen.** Die drei Ids kamen in die `absent`-Listen des
  Szenarios, bevor eine Zeile Produktivcode fiel:
  `npx vitest run src/evaluator/e2e.testcatalog.test.js` — 104 Fälle,
  **3 rot**, Exit 1, mit genau den erwarteten Meldungen („Grenze
  dfd9-3e46-eda5-be8b darf nicht feuern", „… feb1-c10d-9318-dbda …").
- **Fix, danach grün.** `rosParser.defIdOf` bindet eine `<selection>` an
  `entryLinkId`, sonst an `entryId`. Derselbe Lauf: 104 Fälle, Exit 0.
- **Fakten per Exitcode, nach dem Adapter-Fix** (Zwischenstand): `npx vitest
  run` 207 Dateien / 2109 Fälle Exit 0; E2E 104 Fälle Exit 0; `typecheck`,
  `lint`, `depcruise`, `node src/solver/ui.test.js` je Exit 0.

- **Fakten per Exitcode, Endstand** (Adapter-Fix + Constraint-Fix + neues
  Szenario):

  | Kommando | Umfang | Exit |
  |---|---|---|
  | `npx vitest run` | 207 Dateien, 2113 Fälle | 0 |
  | `npx vitest run src/evaluator/e2e.testcatalog.test.js` | 108 Fälle (29 Szenarien) | 0 |
  | `node src/solver/ui.test.js` | Puppeteer-UI-E2E der Altengine | 0 |
  | `npm run typecheck` | `tsc --noEmit` | 0 |
  | `npm run lint` | `oxlint`, ohne Ausgabe | 0 |
  | `npm run depcruise` | 389 Module, 983 Kanten | 0 (1 Vorbefund-Warnung `no-circular` in `src/solver/`, unberührt) |

- **Erfüllt, nicht verschwunden.** Eine `absent`-Erwartung könnte auch aus dem
  falschen Grund halten — weil der Anker ganz wegfiel. Eine Slot-Sonde zeigt
  das Gegenteil; die Grenze wird ausgewertet und hält:

  ```
  01-ogre-no-light-armour.ros
    path=0/0/1 defId=b581-8a9e-9d0c-b7c8 target=abdb-bbd0-41b2-5dff
    anchor=occupied name=Hand Weapon min=1 max=1 current=1 mandatoryUnmet=false
  03-amazons-infolink-profile.ros
    path=0/1/2 defId=d3dc-56c1-9565-889a target=055f-8e4e-f170-35d2
    anchor=occupied name=Light Armour min=1 max=1 current=1 mandatoryUnmet=false
  ```

  Vorher standen hier zwei Slots je Auswahl: der belegte unter der Ziel-Id und
  ein Pflicht-Phantom unter der Link-Id mit `current=0`. Jetzt ist es einer,
  belegt, unter der Link-Id, mit dem Ziel über `target` erreichbar — genau der
  Vertrag aus `report.js`.
- **Dokumentation nachgezogen:** das Szenario-README beschrieb noch die
  Entfernung der Ids als Endzustand; `docs/testkatalog-evaluator-e2e.md` hat
  den Szenario-Eintrag mitbekommen (ADR 0006, Z. 31).
- **Nebenbefund, nicht in diesem Schnitt:** `npm install` zog
  `package-lock.json` von `1.8.2` auf `1.9.0`, weil `scripts/release.js`
  (`writePackageVersion`, Z. 46–52) nur `package.json` schreibt. Aus dem Diff
  zurückgenommen und als Issue `081` abgelegt — dient dieser Absicht nicht.

- **Review-Runde 1 (frischer Kontext), zwei Befunde, beide Dokumentation.**
  Der Review hat alle Zahlen unabhängig nachgemessen, die Vorbefunde
  (`depcruise`-Warnung, `knip` Exit 1, `measure-evaluator` Exit 1) an einem
  Worktree auf `HEAD` als vorbestehend belegt und die Zähne der neuen
  Erwartungen geprüft: das neue Manifest gegen den **alten** Adapter gelaufen
  ⇒ Exit 1 in genau den drei Fällen. Kriterien 1–4 alle erfüllt.

  | Befund | Kriterium | Triage |
  |---|---|---|
  | Das Szenario-README erzählt für `bdef` eine Geschichte, die nie stattfand: die Id war nie in `absent`, wurde also auch nie daraus entfernt (belegt: `git show HEAD:…/scenario.json`, nur ein Vorgänger-Commit `85cbb2c`) | 4 | **jetzt behoben** — der Abschnitt trennt jetzt die zwei zurückgeholten Ids von der einen neu gesetzten |
  | Der öffentliche Roster-Vertrag (`evaluator.js`, `@param roster`) sagt nicht, dass eine über einen `entryLink` gesetzte Auswahl unter der **Link**-Id zu übergeben ist. Die Regel steht bisher nur im Test-Adapter | keins | **an den Menschen** — außerhalb der Absicht dieses Issues; heute existiert kein Produktivkonsument (`evaluate` wird nur von Tests und `scripts/lib/` importiert) |

  | Zeile | Runde 1 |
  |---|---|
  | Kriterium 1 | 0 |
  | Kriterium 2 | 0 |
  | Kriterium 3 | 0 |
  | Kriterium 4 | 1 |
  | ohne Kriterium | 1 |
  | **gesamt** | **2** |

- **Review-Runde 2 (frischer Kontext) findet, was Runde 1 übersah — eine
  Regression durch den eigenen Fix.** Stop-Signal *Regression*, also Kurs
  korrigiert statt weitergemacht.

  Der Befund: `constraints.js` zählte eine Grenze unter `node.def.id`. Trägt
  der Knoten nach dem Adapter-Fix die **Link**-Id, dann zählt eine am
  **Ziel** deklarierte Grenze nur noch die Auswahlen, die durch *diesen einen*
  Verweis kamen. Zeigen zwei Verweise unter demselben Eltern-Knoten auf
  dasselbe Ziel, fällt eine `max`-Grenze fail-open.

  Belegt an `Vampire Counts (…).cat`: zwei `entryLink`s (`def42370`,
  `8f3d6ee5`) auf dasselbe Ziel `d612998a`, dessen `max 1 scope="parent"`
  (`f25f23c2`). Ein Roster, das den Gegenstand einmal durch jeden Verweis
  nimmt:

  | Stand | Ergebnis |
  |---|---|
  | `HEAD` | `f25f23c2` Ist 2 / Grenze 1 → verletzt |
  | nur Adapter-Fix | zwei Slots, je Ist 1 / Grenze 1 → **keine Verletzung** |
  | Adapter + Constraint-Fix | `f25f23c2` Ist 2 / Grenze 1 → verletzt |

  Das widerspricht der eigenen Formatregel des Projekts,
  `docs/battlescribe-data-format.md`: „`constraint`s mit `scope="parent"`
  vergleichen aufgelöste **Ziel-IDs**, nicht `entryLinkId`s (verschiedene
  Links können auf dasselbe Ziel zeigen)" — und dem Vertrag in `report.js`,
  der schon behauptete, die Constraint-Schicht zähle über das Ziel. Sie tat
  es nur für `categoryLink`.

  **Kurskorrektur:** `constraints.js` zählt jetzt für *jeden* Verweis die
  Ziel-Id (`isLinkDefinition`), nicht nur für `categoryLink`. Der Verweis
  bleibt der Anker — nur an ihm gelten die an ihm deklarierten Grenzen —,
  gezählt wird sein Ziel. Damit halten beide Richtungen.

  Nicht als „außerhalb der Absicht" an den Menschen gegeben: die Regression
  entstand in diesem Lauf, durch diese Änderung. Sie zu behalten hieße, einen
  Fehler gegen einen anderen zu tauschen.

  | Zeile | Runde 1 | Runde 2 |
  |---|---|---|
  | Kriterium 1 | 0 | 0 |
  | Kriterium 2 | 0 | 0 |
  | Kriterium 3 | 0 | 0 |
  | Kriterium 4 | 1 | 0 |
  | ohne Kriterium | 1 | 2 |
  | **gesamt** | **2** | **2** |

  Der zweite Befund der Runde 2 ist der aus Runde 1 wiederholte offene
  Roster-Vertrag; er bleibt beim Menschen.

- **Vollvergleich nach der Kurskorrektur** (`HEAD`-Worktree gegen
  Arbeitsbaum, alle 104 Manifest-Läufe): Verletzungen 886 → 881, geändert
  weiterhin **nur** die drei Roster des Issues; Diagnosen 8009 → 8009, kein
  Fall mit geänderter Liste.

- **Szenario zur Kurskorrektur, vom Black-Box-Autor.** `docs/testing/
  shared-target-two-entrylinks/` mit vier Rostern am Doppelverweis
  `def42370` / `8f3d6ee5` auf dasselbe Ziel `d612998a` (*Armour of Heroes*,
  `max 1 scope="parent"` = `f25f23c2`). Roster 03 nimmt den Gegenstand durch
  beide Verweise, Roster 04 verteilt ihn auf zwei Träger — der Unterscheider,
  der „unter einem Elternteil gemeinsam gezählt" von „feuert immer" trennt.

  **Zähne belegt:** mit dem Adapter-Fix, aber *ohne* den Constraint-Fix fehlt
  in Roster 03 genau `f25f23c2` (die übrigen 9 Verletzungen des Rosters
  bleiben) — der E2E-Lauf ist in diesem Stand Exit 1. Mit beiden Änderungen
  feuert `f25f23c2` mit Ist 2 / Grenze 1. Das Szenario fängt also genau die
  Regression.

  **Zwei Erwartungen des Autors halten nicht** und sind aus dem Manifest
  genommen (weder `firing` noch `absent` — keine Aussage, nicht an die Engine
  angepasst, ADR 0033): `0aa08f91` (`scope="roster"`) und `76e2c1c8` (Gruppe,
  `scope="parent"`). Beide tragen `includeChildSelections="false"` **und**
  `includeChildForces="false"`; die Zählschicht summiert dann nur den
  Basis-Eimer, an dem keine Auswahl liegt. Auf einem `HEAD`-Worktree
  verhalten sie sich identisch — vorbestehend, nicht von diesem Schnitt
  berührt. Untersuchung als Issue `083` abgelegt, im Szenario-README
  dokumentiert.

- **Review-Runde 3 (frischer Kontext), sechs Befunde — Abbruchpunkt erreicht.**
  Die Metis-Regel „sinkt die Befundzahl in drei aufeinanderfolgenden Runden
  nicht, halte an und frage den Menschen" greift: 2 → 2 → 6.

  | Zeile | Runde 1 | Runde 2 | Runde 3 |
  |---|---|---|---|
  | Kriterium 1 | 0 | 0 | 0 |
  | Kriterium 2 | 0 | 0 | 0 |
  | Kriterium 3 | 0 | 0 | 0 |
  | Kriterium 4 | 1 | 0 | 2 |
  | Kriterium 5 | — | — | 2 |
  | ohne Kriterium | 1 | 2 | 2 |
  | **gesamt** | **2** | **2** | **6** |

  Vier Befunde waren sachliche Fehler in meiner eigenen Aufzeichnung und sind
  **behoben**:

  | Befund | Was falsch war | Korrektur |
  |---|---|---|
  | F1 | Als Ursache für das Schweigen von `0aa08f91`/`76e2c1c8` nannte ich beide `include`-Flags. Widerlegt am selben Szenario: `f25f23c2` trägt dieselben Flags und **feuert** | Szenario-README und Issue `083` sagen jetzt, was widerlegt ist und dass die Ursache offen bleibt; `083` umbenannt |
  | F5 | Die `description`-Felder des neuen Manifests (= die Testnamen) behaupteten weiter, `0aa08f91`/`76e2c1c8` feuerten — ein grüner Lauf druckte also falsche Sätze | Beschreibungen und die Katalogtabellen im README auf „keine Aussage" gesetzt |
  | F4 | Checkpoint 2 nannte Kriterium 5 als offene Lücke und verwies auf ein Issue `082`, das nicht mehr existiert | Checkpoint 2 neu geschrieben |
  | F6 | Log behauptete, ohne den Constraint-Fix melde Roster 03 „gar keine" Verletzung — es sind 9, es fehlt genau `f25f23c2` | präzisiert |

  Zwei Befunde bleiben **offen und gehen an den Menschen** — sie berühren
  kein Kriterium, aber die Entscheidung, was von diesem Schnitt bleiben
  soll:

  - **F2 — der Adapter-Fix ist unbelegt.** Nimmt man nur `constraints.js`
    aus dem Arbeitsbaum und lässt `rosParser.js` auf `HEAD`, sind alle Suiten
    grün und die Fassaden-Ausgabe über alle 108 Läufe **byte-identisch** zum
    vollen Schnitt: 920 Verletzungen, 8267 Diagnosen. Die Kriterien 1–3
    erfüllt also bereits die Constraint-Änderung allein. Der Adapter-Fix ist
    kein No-op — er lässt in 12 von 108 Rostern den doppelten Slot zu einem
    zusammenfallen (der `report.js`-Ankervertrag, auf den sich die
    Entscheidung oben beruft) —, aber **keine Erwartung im Manifest prüft
    das**. Die Aufzeichnung schreibt den Erfolg damit der ungetesteten
    Hälfte zu.
  - **F3 — der Adapter-Fix verliert den Rückfall auf `entryId`.** `defIdOf`
    bindet an `entryLinkId` ohne Fallback. Wertet man
    `modifier-characteristic-value/rosters/01` gegen einen Datensatz *ohne*
    den Mercenaries-Katalog aus (ein nach ADR 0032 legitimer Teilsatz, den
    andere Szenarien auch fahren), entsteht neu
    `{"kind":"unresolvedDefinition","defId":"b581-8a9e-9d0c-b7c8"}` — 37 → 38
    Diagnosen. Genau die Annahme, die Checkpoint 1 als ungeprüft notierte,
    jetzt als reales Verhalten reproduziert. Kein Test deckt es ab.

  Die naheliegende Auflösung wäre, im Adapter auf `entryId` zurückzufallen,
  wenn die Link-Id im Datensatz nicht auflöst — das kann der Adapter aber
  nicht wissen, er kennt den Datensatz nicht. Die Alternative wäre, den
  Adapter-Fix ganz fallen zu lassen und nur `constraints.js` zu behalten.
  Beides ändert den öffentlichen Roster-Vertrag der Fassade und ist damit
  eine Entscheidung für den Menschen, nicht für mich.

- **Fremddokumentation bestätigt die Kurskorrektur.** Auf Bitte des Menschen
  im [BSData-Wiki](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview)
  nachgeschlagen. Zum `shared`-Attribut einer Grenze steht dort: gesetzt heißt
  *„the constrained value is a sum of all selections of this shared entry in
  roster in total"*, nicht gesetzt heißt *„the sum is calculated for a given
  entry link instance"*.

  Alle hier betroffenen Grenzen tragen `shared="true"`. Über alle Vorkommen
  des Eintrags zu summieren — also über die **Ziel**-Id statt über die Id des
  einzelnen Verweises — ist damit genau das dokumentierte Verhalten. Der
  Constraint-Fix setzt keine eigene Deutung durch, sondern holt nach, was das
  Format vorgibt; unsere eigene `docs/battlescribe-data-format.md` sagte es
  bereits (Zeile zum `shared`-Attribut), nur die Engine tat es nicht.

  `shared="false"` bleibt davon unberührt: `query.js` bindet diesen Fall
  weiterhin an den Teilbaum der Bezugsinstanz, also an die eine Verweis-
  Instanz. Kein Roster des Korpus ändert dadurch sein Ergebnis.

- **Nebenbefund des Reviews, an den Menschen:** Die Seite des `issue`-Skills
  verlangt `NNNN-slug.md` (vier Stellen), `CLAUDE.md` dieses Projekts und alle
  bestehenden Dateien verwenden drei (`NNN-`). `081` folgt den Nachbarn. Die
  beiden Texte widersprechen sich; das gehört in `metis` geklärt, nicht hier.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. Kriterium 1 und 2 sind mit der
  Sonde belegt: die drei benannten Fälle verschwinden, sonst ändert sich
  nichts. Kriterium 3 ist der Test, der zuerst geschrieben wird. Kriterium 4
  ist durch den Vollvergleich vorbereitet — jede geänderte Erwartung hat ihre
  Zeile im Diff.
- **What surprised me?** Zweierlei. Erstens sitzt der Fehler nicht dort, wo
  das Issue ihn vermutet: der Zählindex ist längst verweis-fähig, der
  Roster-Adapter wirft die Information vorher weg. Zweitens ist der Schaden
  größer als dokumentiert — der falsche Phantomknoten lässt auch eine
  fremde, längst erfüllte Grenze (`bdef`) ein zweites Mal feuern.
- **What am I assuming without having verified it?** Dass eine `<selection>`
  mit `entryLinkId` in *jedem* Datensatz an die Link-Definition binden darf.
  Belegt ist das nur für die 100 Roster der Testszenarien (alle Link-Ids lösen
  auf). Ein Roster, dessen Link-Id nicht im geladenen Datensatz steht, bekäme
  jetzt eine `unresolvedDefinition` statt einer Auflösung über `entryId`. Kein
  Fall dieser Art existiert heute; ein Rückfall auf `entryId` bliebe der
  Engine überlassen und wäre ein eigener Schnitt.

### Before the PR

- **Does this match what was asked?** Kriterien 1–3 und 5 ja, jeweils belegt:
  die drei falschen Verletzungen sind weg, die Grenzen werden am belegten
  Slot ausgewertet und halten (`min=1, current=1, mandatoryUnmet=false`), die
  Erwartung hat Zähne (Manifeste gegen `HEAD` ⇒ Exit 1 in genau drei Fällen),
  das Szenario zur Kurskorrektur liegt in der Suite (108 Fälle, Exit 0), und
  alle Suiten sind grün. **Kriterium 4 hält nicht vollständig:** Review-Runde
  3 hat zwei Begründungen widerlegt, die ich selbst geschrieben hatte (siehe
  Log). Sie sind korrigiert; ob das reicht, ist nicht mehr von mir zu
  beurteilen — die Runde hat den Abbruchpunkt der Regel erreicht.
- **What surprised me?** Dass der eigene Fix eine Regression einbaute, die
  die erste Review-Runde nicht sah, und dass die richtige Antwort schon
  zweimal im Repository stand: in `docs/battlescribe-data-format.md` als
  Formatregel und in `report.js` als Vertrag, den die Constraint-Schicht nur
  für `categoryLink` einhielt. Der Fehler war nicht, etwas Neues zu erfinden,
  sondern eine bestehende Regel nicht angewandt zu haben.
- **What am I assuming without having verified it?** Zweierlei. Erstens, dass
  `node.def.targetId` für jeden Verweis die zählbare Id ist — belegt für die
  104 Manifest-Läufe und die Doppelverweis-Sonde, nicht für Verweisketten
  über mehrere Stufen (`report.js` bevorzugt dort `resolved.id`; ob beide je
  auseinanderfallen, habe ich nicht geprüft). Zweitens, dass der Adapter-Fix
  auch für Roster aus fremden Datensätzen trägt — geprüft ist nur, dass in
  diesem Korpus jede Link-Id auflöst.

## Retro
