Status: needs-info
Type: fix
Blocked by: None

## Description

> **Erweitert am 2026-07-27** um die Ergebnisse einer Katalogdaten-Recherche. Sie
> beantwortet die ursprünglich offene Fachfrage weitgehend — und legt dabei frei,
> dass dies **kein reiner Scope-Fix** ist: die Behebung braucht neue Durchleitung
> bis in einen öffentlichen Vertrag und berührt die Prämisse von ADR-0032. Deshalb
> steht eine Frage an den Maintainer offen (siehe `## Decisions`).

Eine Query mit `scope="primary-catalogue"` kann die Engine nicht auflösen. Sie
verhält sich dabei korrekt — sie meldet `unresolvedScope` und wertet fail-closed
statt still falsch — aber die Regel wirkt nicht. **27 Vorkommen** in den
Fixture-Katalogen: 7 in der `.gst`, 20 in `Mercenaries (…).cat`.

### Was die Daten belegen

Alle 27 Vorkommen haben **dieselbe Gestalt**, ohne eine einzige Ausnahme:
`field="selections"`, `type="instanceOf"` oder `"notInstanceOf"`, `value="1"`,
`shared="true"`. Es variiert allein das `childId`.

Und jedes auflösbare `childId` ist die Wurzel-`id` eines **ganzen
Armeebuch-Katalogs** (`<catalogue … library="false">`), nicht die eines
Auswahl-Eintrags — belegt an `4049-c46d-7f80-44fb` (Orcs and Goblins),
`4d73-5ab0-9020-403c` (Vampire Counts), `731d-5b13-2a92-5427` (Ogre Kingdoms).
Die übrigen `childId`s tragen `childName`-Attribute, die weitere Armeen benennen
(„Tomb Kings", „Dogs of War"), deren Kataloge im Fixture-Satz fehlen.

Derselbe Id-Raum wird an einer zweiten Stelle benutzt: im `.ros`-Format trägt
**jedes Kontingent** ein `catalogueId`/`catalogueName`-Paar, das angibt, aus
welchem Armeebuch es gebaut wurde. In den aktuellen Fixture-Rostern stimmt diese
Id genau mit der Wurzel-`id` des jeweiligen Katalogs überein.

Dazu kommt genau eine Auszeichnung in den Katalogdaten selbst: das Attribut
`library`. Im Fixture-Satz ist `Mercenaries` der einzige Katalog mit
`library="true"`; die Armeebücher tragen `library="false"`. ADR-0032 beschreibt
die Sterntopologie passend dazu: alle 17 Armeekataloge verweisen per
`catalogueLink` auf Mercenaries, das selbst von nichts abhängt.

### Was sich daraus nur erschließen lässt

Aus diesen drei unabhängig beobachteten Tatsachen ergibt sich als Lesart:
`scope="primary-catalogue"` mit `field="selections"` und einem
`childId=<katalog-id>` fragt, **ob das führende Armeebuch gleich X ist** — es
unterscheidet das gewählte Armeebuch von der lediglich importierten
Mercenaries-Bibliothek. Kein Format-Dokument und keine ADR sagt das; es ist eine
Synthese der Belege, keine belegte Festlegung. Die vendorierte XSD hilft hier
nicht: sie typisiert `scope` als bloßes `xs:string` und enthält für keines der
drei Query-Elemente eine geschlossene Wertemenge. Das geschlossene Vokabular
dieses Projekts ist selbst verfasst, und `primary-catalogue` fehlt darin.

Nebenbefund: `docs/testing/constraint-matrix.md` vermutet als Bedeutung „die Armee
ist keine reine Mercenaries-Armee". Diese Vermutung ist durch die Auflösung der
`childId`s **widerlegt** — sie benennen konkrete Armeebücher, nicht
„Mercenaries-Sein". Die Stelle ist mit diesem Issue zu korrigieren.

### Warum das kein reiner Scope-Fix ist

Drei Befunde verschieben den Umfang deutlich:

1. **Die Katalog-Identität erreicht die Engine überhaupt nicht.** Die Roster-Form
   der Fassade führt je Kontingent nur `{ defId, count, children }`; das
   `catalogueId` des `.ros` wird vom Test-Adapter gar nicht gelesen. Die Tatsache,
   die die Regel braucht, ist im Auswertungsbaum nicht vorhanden. Das ist neue
   Durchleitung bis in einen öffentlichen Vertrag, nicht das Ergänzen eines
   Vokabelworts.

2. **Der Id-Raum, gegen den gematcht würde, ist nicht indiziert.** Die
   Symboltabelle des Resolvers wird aus Einträgen, Kontingenten, Kategorien und
   geteilten Einträgen gebaut; die Wurzel-`id` eines Katalogs kommt darin nicht
   vor. Ein `childId`, das einen Katalog benennt, ist damit strukturell
   unauflösbar — unabhängig von der Scope-Frage.

3. **Die Granularität ist eine echte Gabelung.** Ein Roster kann Kontingente aus
   verschiedenen Katalogen enthalten (Verbündete, Border Patrols), und das
   `.ros`-Format markiert `catalogueId` **je Kontingent**, nicht je Roster. „Der
   primäre Katalog" ist damit nicht eindeutig: gemeint sein kann der des
   Kontingents oder der des Rosters. Das ist keine Formalie, sondern entscheidet
   das Ergebnis.

## Acceptance Criteria
- [ ] Es ist entschieden und begründet, ob `primary-catalogue` den Katalog des Kontingents oder den des Rosters bezeichnet.
- [ ] Die Katalog-Identität erreicht die Auswertung, ohne die Trennung der Engine von der Anwendung zu verletzen.
- [ ] Eine Query mit diesem Bezugsrahmen wird ausgewertet; die Diagnose `unresolvedScope` entfällt für sie.
- [ ] Das Verhältnis zu ADR-0032 ist geklärt und dort festgehalten — entweder als Ergänzung, die die flache Auflösung unberührt lässt, oder als begründete Änderung ihrer Prämisse.
- [ ] Die widerlegte Vermutung in `docs/testing/constraint-matrix.md` ist korrigiert.
- [ ] Die Regel ist im Format-Dokument beschrieben, damit der Black-Box-Autor Erwartungen daraus ableiten kann.
- [ ] Ein Szenario an echten Katalogdaten deckt den Fall ab (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Die übrige E2E-Suite bleibt grün; jede geänderte Erwartung ist einzeln begründet.

## Decisions
- `[po]` Beschreibung um die Ergebnisse einer Katalogdaten-Recherche erweitert. Belegt: alle 27 Vorkommen haben dieselbe Gestalt (field=selections, instanceOf/notInstanceOf, value=1, shared=true), und jedes aufloesbare childId ist die Wurzel-id eines Armeebuch-Katalogs mit library=false, nicht die eines Auswahl-Eintrags. Derselbe Id-Raum markiert im .ros je Kontingent das catalogueId. Mercenaries ist der einzige Katalog mit library=true. Die vendorierte XSD typisiert scope als bloszes xs:string ohne geschlossene Wertemenge; das geschlossene Vokabular des Projekts ist selbst verfasst und enthaelt primary-catalogue nicht.
- `[ask]` Bezeichnet 'primary-catalogue' den Katalog des Kontingents oder den des Rosters — und soll die Katalog-Identitaet dafuer in die Roster-Form der Fassade aufgenommen werden? Warum ich das nicht selbst entscheide: (1) Es aendert einen oeffentlichen Vertrag und das Datenmodell. Die Roster-Form der Fassade fuehrt je Kontingent nur { defId, count, children }; das catalogueId des .ros wird gar nicht gelesen. Die Tatsache, die die Regel braucht, ist im Auswertungsbaum nicht vorhanden — das ist neue Durchleitung, kein zusaetzliches Vokabelwort. (2) Es beruehrt die Praemisse von ADR-0032, die ausdruecklich keinen ausgezeichneten primaeren Katalog kennt und eine flache globale Id-Tabelle festlegt; die Wurzel-id eines Katalogs steht in dieser Tabelle nicht. Einen primaeren Katalog anzuerkennen oeffnet diese Entscheidung wieder, und das tue ich nicht still. (3) Die Granularitaet ist eine echte Gabelung, keine Formalie: ein Roster kann Kontingente aus verschiedenen Katalogen tragen (Verbuendete, Border Patrols), und das .ros markiert catalogueId je Kontingent, nicht je Roster — die beiden Lesarten liefern verschiedene Ergebnisse. Meine Empfehlung: je Kontingent, weil das Format es dort markiert und ein Kontingent der Rahmen ist, in dem die 27 Bedingungen stehen. Aber die Entscheidung ist deine.

## Comments
- Der praktische Aufhänger, bestätigt: der einzige Fall in allen fünf Fixture-Dateien, in dem ein `field="name"`-Modifikator und eine `{this}`-tragende Autor-Meldung in derselben `modifierGroup` stehen, ist die Amazon „0-1 Amazon Serpent Priestess" (`sharedSelectionEntries`, `9ddd-69c8-644d-abc2`, `Mercenaries (6th definitive edition).cat:4702`). Ihre `modifierGroup` (`:4814-4841`) ist durch eine `conditionGroup type="or"` (`:4827-4837`) bedingt, deren **alle sieben** Bedingungen `scope="primary-catalogue"` tragen. Weil der Scope nie auflöst, greift die Gruppe in keinem Kontingent, gleich welcher Armeekatalog führt. Die betroffene E2E-Facette ist in `docs/testing/author-message-tokens/README.md:140-183` als Lücke dokumentiert; dort ist auch vermerkt, dass ein Testroster entfernt wurde, weil es „aus dem falschen Grund" grün war.
