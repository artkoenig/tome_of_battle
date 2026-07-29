---
status: active
branch: claude/noch-zu-tun-x7e3rw
pr:
---

# Bezugsrahmen primary-catalogue wird nicht unterstützt

## Intent

Eine Query mit `scope="primary-catalogue"` kann die Engine nicht auflösen. Sie
verhält sich dabei korrekt — sie meldet `unresolvedScope` und wertet
fail-closed statt still falsch —, aber die Regel wirkt nicht.

27 Vorkommen in den Fixture-Katalogen: 7 in der `.gst`, 20 in
`Mercenaries (…).cat`.

Praktische Folge: Der einzige Katalogfall, der einen
`field="name"`-Modifikator mit einer `{this}`-Autor-Meldung verbindet, hängt an
genau diesem Bezugsrahmen und kann deshalb nie feuern. Die betroffene
E2E-Facette wurde ausgelassen und als Lücke dokumentiert; die Regel selbst
bleibt durch einen Modultest festgehalten.

Zu klären ist zuerst die Fachfrage, **was** `primary-catalogue` in einem
Mehr-Katalog-Datensatz (ADR 0032) bezeichnet — der Datensatz löst global by-id
auf und kennt keinen ausgezeichneten „primären" Katalog. Die Antwort gehört an
die Katalogdaten und an das Format-Dokument, nicht an eine Annahme.

Acceptance criteria:

1. Aus den Katalogdaten und dem Format-Dokument ist belegt, welchen
   Bezugsrahmen `primary-catalogue` bezeichnet.
2. Eine Query mit diesem Bezugsrahmen wird ausgewertet; die Diagnose
   `unresolvedScope` entfällt für sie.
3. Ein Szenario an echten Katalogdaten deckt den Fall ab (ADR 0033, verfasst
   vom Black-Box-Autor).
4. Die übrige E2E-Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt —, und jede geänderte Erwartung ist einzeln begründet.

## Plan

Der Bezugsrahmen ist kein Zählrahmen: ein Katalog ist kein Knoten des
Instanzbaums, also kann `scopeKey(frameKey, targetId)` ihn nie finden.
`primary-catalogue` wird deshalb — wie `limit::<id>` heute schon — **vor** jeder
Rahmen- und Indexarbeit in `query()` beantwortet, als Identitätsprüfung.

Module und Verträge:

1. **`catalogSet.js`** — neue reine Funktion, die aus den einzeln erhaltenen
   Dokumenten den Herkunftsindex baut: `Map<forceDefId, documentId>` über
   **alle** Kontingent-Definitionen eines Dokuments (Wurzel- und
   Unter-Kontingente). Das Aggregat selbst kennt die Herkunft nicht mehr
   (`datasetPreparation.js:121`), die Dokumente schon.
2. **`datasetPreparation.js`** — `prepareDataset` legt diesen Index in die
   `PreparedDataset`-Inhalte: `primaryCatalogueByForceDefId: Map<string,string>`.
   Additiv, der Griff bleibt undurchsichtig.
3. **`model.js`** — `ScopeKeyword.PRIMARY_CATALOGUE = 'primary-catalogue'` und
   ein eigener `ScopeKind` für die Berichts-Klassifikation.
4. **`query.js`** — `createQueryContext` nimmt den Index entgegen (fehlt er,
   gilt die leere Map). `query()` beantwortet den neuen Scope vor
   `resolveFrame`, also **unabhängig von `shared`** (ein Katalog wird durch
   `shared="false"` nicht enger).
5. **`violationClassification.js`** — `classifyScope` bildet das neue
   Schlüsselwort auf seinen `ScopeKind` ab, statt es als Eintrags-Id zu deuten.
6. **Aufrufer der Query-Kontexte** (Fixpunkt, Constraints, Bericht) reichen den
   Index durch.

Vertrag der Antwort:

| Lage | Ergebnis |
| --- | --- |
| Feld `SELECTION_COUNT`, `targetId` = Katalog-Id des umschließenden Kontingents | 1 |
| Feld `SELECTION_COUNT`, `targetId` ≠ dieser Katalog-Id | 0 |
| `targetId === null` (Prozent-Nenner) | 1 — der Rahmen hat genau einen Katalog |
| kein umschließendes Kontingent, oder dessen Id steht nicht im Index | 0 **mit** `unresolvedScope` (unverändert fail-closed) |
| ein anderes Feld als `SELECTION_COUNT` | der bestehende `unsupportedField`-Pfad |

Der `default`-Zweig von `resolveSharedFrame` bleibt unangetastet, damit `unit`
und `ancestor` weiter diagnostiziert werden (Issue 0086, Kriterium 4).

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/77-bezugsrahmen-primary-catalogue-wird-nicht-unterstuetzt/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Gefunden in Slice 07 von Alt-Issue 75.
- **Kriterium 1 ist eine Fachfrage, keine Implementierungsaufgabe.** Sie geht
  an die Daten und das Format-Dokument; fällt die Antwort so aus, dass der
  Bezugsrahmen in diesem Datensatz keinen Gegenstand hat, ist das ein
  legitimes Ergebnis und die übrigen Kriterien ändern ihre Form.

- **Kriterium 1 ist beantwortet: `primary-catalogue` bezeichnet das
  Armeebuch — den `<catalogue id=…>`, aus dem die Liste gebaut ist.**
  Quelle: Recherche-Briefing 2026-07-29 an den Fixture-Daten, drei
  unabhängige Belege.
  1. Alle 27 Vorkommen stehen an einer `condition`
     (`type="instanceOf"|"notInstanceOf"`, `field="selections"`,
     `shared="true"`, `value="1"`), nie an `constraint` oder `repeat`. Jede
     `childId` ist eine **Katalog-Wurzel-Id**: `731d-5b13-2a92-5427` =
     `<catalogue name="Ogre Kingdoms">`, `4049-c46d-7f80-44fb` = Orcs and
     Goblins, `4d73-5ab0-9020-403c` = Vampire Counts. Keine dieser Ids ist
     irgendwo im Datensatz ein Eintrags-, Kategorie- oder Kontingent-Id.
  2. Die Regeln lesen sich nur unter dieser Deutung richtig: Maneaters
     kosten außerhalb einer Ogerarmee einen Rare-Slot extra und sind in der
     Ogerarmee versteckt (`Mercenaries …cat:3832-3855`); Kampagnen-Einträge
     der `.gst` werden nur für benannte Armeebücher sichtbar (`.gst:2296-2330`).
  3. Der Autor sagt es selbst: die Bedingung auf `categoryEntry "Chariot"`
     (`.gst:773`) trägt den Kommentar „Tomb Kings may have more than one
     Chariot" an einem `notInstanceOf childId="9945-8537-0944-c67b"
     childName="Tomb Kings"`. Auch die übrigen `childName` sind
     Armeebuch-Namen.
  Die Format-Doku im Repo führt den Rahmen bisher nur als Lücke
  (`docs/battlescribe-data-format.md:1266`); das Upstream-Wiki nennt ihn
  gar nicht (dessen Aufzählung endet bei `primary category`). Die XSD typt
  `scope` als nackten String (`Catalogue.xsd:426`) und entscheidet nichts.

- **Default (unbeantwortet): der Rahmen ist das Kontingent, nicht das
  Roster.** Die XSD verlangt `catalogueId` am `<force>`
  (`Catalogue.xsd:645`) und kennt am `<roster>` nichts Vergleichbares
  (`:738-752`) — das spricht für „je Kontingent". Entscheiden **könnten**
  es nur Roster mit mehreren Katalogen; über alle 113 `<force>`-Elemente
  unter `docs/testing/**` benutzt jedes Roster genau einen `catalogueId`,
  der Fall kommt in den Daten also nicht vor. Als Default festgehalten, nicht
  als Fund.

- **Default (unbeantwortet): der Katalog wird aus der Herkunft der
  Kontingent-Definition abgeleitet, nicht aus dem `.ros`-Attribut.** Der
  Alternativweg — `<force catalogueId>` aus der `.ros` lesen — änderte den
  **öffentlichen Roster-Vertrag** der Fassade (`evaluator.js:82`), und das
  ist eine Entscheidung des Menschen, keine Vorgabe dieses Laufs. Die
  gewählte Ableitung kommt ohne Vertragsänderung aus, benutzt die Herkunft,
  die `datasetDescription.js:84-93` ohnehin schon berechnet, und trägt über
  den ganzen Fixture-Satz (`.gst` und `Mercenaries.cat` deklarieren null
  `forceEntry`s, jedes Kontingent stammt aus einem Armeebuch). Sie versagt
  erst, wenn ein Datensatz Kontingente in der `.gst` deklariert — dann
  greift der Fail-closed-Zweig (`unresolvedScope`), nicht eine stille
  Falschauskunft.
  Nebenbefund, der diesen Default stützt: die handgeschriebenen Roster im
  Repo tragen teils **falsche** `catalogueId`-Werte (`mercenaries-repeat-bug`
  und `explorer-force-constraints` benutzen eine `publicationId`, das
  `ogre-kingdoms`-Szenario das synthetische `"cat"`). Heute ist das folgenlos,
  weil `rosParser.js` das Attribut ignoriert — es wäre es nicht mehr.

- **Abgrenzung zu Issue 0086:** die drei Scopes treffen sich nur im
  `default`-Zweig von `resolveSharedFrame`. Dieser Lauf fügt **ein**
  Schlüsselwort hinzu und lässt den Zweig sonst unberührt, damit `unit` und
  `ancestor` weiter `unresolvedScope` melden (0086, Kriterium 4).

## Log

- **2026-07-29, Ausgangslage per Exitcode belegt.** `npx vitest run` — 222
  Dateien, 2267 Tests, Exit 0. `npm test` (vitest + Puppeteer-E2E des Solvers)
  läuft ebenfalls durch. Eine Probeauswertung der Recherche
  (`prepareDataset(gst + Ogre + Mercenaries)` gegen ein Ogre-Roster) meldet 46
  Diagnosen, davon **9 `unresolvedScope`, alle mit `scope:
  "primary-catalogue"`** — der Fund des Issues ist am laufenden Code
  reproduziert.
- **2026-07-29, Lücke in der Beweislage.** Das Submodul
  `docs/bsdata-catalogue-development-wiki` (Commit `f4949c3`) ist in diesem
  Arbeitsverzeichnis nicht ausgecheckt. Jede Wiki-Zitatstelle in
  `battlescribe-data-format.md` ist aus einem frischen Klon derzeit nicht
  nachprüfbar. Für dieses Issue folgenlos — die Antwort steht in den
  Katalogdaten selbst —, aber als Beobachtung festgehalten.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. Kriterium 1 ist aus den
  Katalogdaten beantwortet statt angenommen, und der geplante Eingriff ist
  genau der, den Kriterium 2 verlangt. Kriterium 3 (Szenario vom
  Black-Box-Autor) steht noch aus und kommt nach der Engine-Änderung — der
  Autor kann die Ableitung nicht beeinflussen, sie muss vorher stehen.
- **What surprised me?** Dreierlei. Erstens: `primary-catalogue` steht in
  **keiner** Quelle — weder in der Projekt-Doku noch im Upstream-Wiki noch
  in der XSD; die Kataloge benutzen ein Schlüsselwort, das die Spezifikation
  nicht kennt. Zweitens: der Rahmen ist gar kein Zählrahmen, deshalb passt
  er nicht in `resolveSharedFrame`, sondern neben `resolveLimitValue`.
  Drittens: die `catalogueId`-Werte in den vorhandenen Test-Rostern sind
  teils falsch — folgenlos nur, solange der Parser sie ignoriert.
- **What am I assuming without having verified it?** Dass ein Roster genau
  einen Armeekatalog hat (im Fixture-Satz belegt, allgemein nicht) und dass
  jedes Kontingent aus einem Armeebuch stammt statt aus der `.gst` (in
  diesem Datensatz belegt, allgemein nicht). Beides ist oben als Default
  festgehalten; trifft es nicht zu, meldet die Engine `unresolvedScope`
  statt still falsch zu antworten.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
